from __future__ import annotations
import hashlib
import importlib.util
import io
import math
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


SCRIPT = Path(__file__).with_name("discover-builder-shell.py")
SPEC = importlib.util.spec_from_file_location("discover_builder_shell", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Cannot load {SCRIPT}")
DISCOVERY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DISCOVERY)
CORE = DISCOVERY.CORE
META = CORE.META


class FakeObject:
    def __init__(
        self,
        type_name: str,
        name: str,
        path_id: int,
        byte_size: int,
        value: object | None = None,
        *,
        forbid_peek: bool = False,
        forbid_read: bool = False,
    ) -> None:
        self.type = SimpleNamespace(name=type_name)
        self._name = name
        self.path_id = path_id
        self.byte_size = byte_size
        self.value = value
        self.forbid_peek = forbid_peek
        self.forbid_read = forbid_read
        self.peek_calls = 0
        self.read_calls = 0

    def peek_name(self) -> str:
        self.peek_calls += 1
        if self.forbid_peek:
            raise AssertionError("unbounded object metadata must not be read")
        return self._name

    def read(self) -> object:
        self.read_calls += 1
        if self.forbid_read:
            raise AssertionError("object must not be decoded")
        return self.value


def mesh_value(*, compressed: object | None = None) -> object:
    return SimpleNamespace(
        m_Name="Shell",
        m_VertexData=SimpleNamespace(m_VertexCount=3, m_DataSize=b"v" * 36),
        m_IndexBuffer=b"i" * 6,
        m_SubMeshes=[SimpleNamespace(topology=0, indexCount=3)],
        m_MeshCompression=0,
        m_CompressedMesh=compressed,
    )


def text_value(name: str, payload: str | bytes) -> object:
    return SimpleNamespace(m_Name=name, m_Script=payload)


PRIMITIVE_XML = (
    '<Primitive><Connectivity><Fixed type="4" '
    'transform="1,0,0,0,1,0,0,0,1,2,3,4"/></Connectivity></Primitive>'
)
class FakeHandler:
    process_calls = 0

    def __init__(self, _mesh: object) -> None:
        self.m_Vertices = [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]

    def process(self) -> None:
        type(self).process_calls += 1

    def get_triangles(self) -> list[list[tuple[int, int, int]]]:
        return [[(0, 1, 2)]]


def environment(*, partinfo: bool = True) -> tuple[object, dict[str, FakeObject]]:
    arbitrary = FakeObject("Texture2D", "malicious", 1, 10, forbid_peek=True, forbid_read=True)
    other_mesh = FakeObject("Mesh", "NotShell", 2, 128, forbid_read=True)
    shell = FakeObject("Mesh", "Shell", 3, 128, mesh_value())
    primitive = FakeObject(
        "TextAsset",
        "Primitive.xml",
        4,
        200,
        text_value("Primitive.xml", PRIMITIVE_XML),
    )
    objects = [arbitrary, other_mesh, shell, primitive]
    named = {"arbitrary": arbitrary, "other": other_mesh, "shell": shell, "primitive": primitive}
    if partinfo:
        info = FakeObject(
            "TextAsset",
            "PartInfo.json",
            5,
            100,
            text_value("PartInfo.json", '{"designId":"3245","revision":"M","name":"Fixture"}'),
        )
        objects.append(info)
        named["partinfo"] = info
    container = {
        "Assets/Primitive.xml": primitive,
        **({"Assets/PartInfo.json": named["partinfo"]} if partinfo else {}),
    }
    return SimpleNamespace(objects=objects, container=container), named


def valid_report() -> dict[str, object]:
    return {
        "catalogAdmitted": False,
        "partInfo": None,
        "primitiveXml": {
            "connectorCenters": [{"center": [2.0, 3.0, 4.0], "kind": "Fixed", "type": "4"}],
            "name": "Primitive.xml",
            "pathId": "4",
            "serializedBytes": 200,
            "sha256": "sha256:" + "b" * 64,
        },
        "schemaVersion": CORE.SCHEMA_VERSION,
        "shell": {
            "canonicalMeshSha256": "sha256:" + "a" * 64,
            "canonicalTriangles": 1,
            "canonicalVertices": 3,
            "declaredCompression": 0,
            "declaredSubmeshes": 1,
            "declaredTopologies": [0],
            "declaredTriangles": 1,
            "declaredVertices": 3,
            "indexBufferBytes": 6,
            "pathId": "3",
            "serializedBytes": 128,
            "vertexDataBytes": 36,
        },
        "source": {
            "bundleBytes": CORE.BUNDLE_BYTES,
            "bundleSha256": "sha256:" + CORE.BUNDLE_SHA256,
            "designId": "3245",
            "revision": "M",
        },
        "status": "quarantined-source-evidence-only",
        "supported": False,
    }


class DiscoveryBoundaryTests(unittest.TestCase):
    def setUp(self) -> None:
        FakeHandler.process_calls = 0

    def test_never_adds_3245_to_supported_shells(self) -> None:
        supported = DISCOVERY.EXTRACTOR.SUPPORTED_SHELLS
        self.assertFalse(any(row.get("designRevision", "").startswith("3245") for row in supported))
        self.assertFalse(any(row.get("bundleSha256") == DISCOVERY.BUNDLE_SHA256 for row in supported))

    def test_enumeration_reads_only_bounded_candidate_names_and_decodes_nothing(self) -> None:
        fixture, objects = environment()
        shell, primitive, partinfo = DISCOVERY.enumerate_candidates(fixture)
        self.assertEqual((shell.path_id, primitive.path_id, partinfo.path_id), ("3", "4", "5"))
        self.assertEqual(objects["arbitrary"].peek_calls, 0)
        self.assertEqual(objects["arbitrary"].read_calls, 0)
        self.assertEqual(sum(value.read_calls for value in objects.values()), 0)
        self.assertEqual(objects["other"].peek_calls, 1)

    def test_build_report_is_finite_canonical_deterministic_and_quarantined(self) -> None:
        payload = b"synthetic exact capture"
        digest = hashlib.sha256(payload).hexdigest()
        reports: list[bytes] = []
        for _ in range(2):
            fixture, objects = environment()
            with mock.patch.multiple(CORE, BUNDLE_BYTES=len(payload), BUNDLE_SHA256=digest):
                report = DISCOVERY.build_report(payload, lambda seen: fixture if seen == payload else None, FakeHandler)
                reports.append(DISCOVERY.canonical_json_bytes(report))
            self.assertEqual(objects["shell"].read_calls, 1)
            self.assertEqual(objects["primitive"].read_calls, 1)
            self.assertEqual(objects["partinfo"].read_calls, 1)
            self.assertEqual(objects["other"].read_calls, 0)
            self.assertEqual(report["shell"]["canonicalVertices"], 3)
            self.assertEqual(report["primitiveXml"]["connectorCenters"][0]["center"], [2.0, 3.0, 4.0])
            self.assertEqual(report["partInfo"]["identity"], {"designId": "3245", "name": "Fixture", "revision": "M"})
            self.assertIs(report["catalogAdmitted"], False)
            self.assertIs(report["supported"], False)
        self.assertEqual(reports[0], reports[1])
        self.assertNotIn(b"NaN", reports[0])
        self.assertNotIn(b"Infinity", reports[0])

    def test_wrong_bundle_identity_fails_before_loader(self) -> None:
        loader = mock.Mock(side_effect=AssertionError("wrong bundle must not be parsed"))
        with self.assertRaisesRegex(ValueError, "exact quarantined"):
            DISCOVERY.build_report(b"wrong", loader, FakeHandler)
        loader.assert_not_called()

    def test_missing_and_duplicate_shell_fail_without_decoding(self) -> None:
        fixture, objects = environment(partinfo=False)
        fixture.objects.remove(objects["shell"])
        with self.assertRaisesRegex(ValueError, "exactly one Mesh named Shell; found 0"):
            DISCOVERY.enumerate_candidates(fixture)
        duplicate = FakeObject("Mesh", "Shell", 30, 128, mesh_value(), forbid_read=True)
        fixture, objects = environment(partinfo=False)
        fixture.objects.append(duplicate)
        with self.assertRaisesRegex(ValueError, "exactly one Mesh named Shell; found 2"):
            DISCOVERY.enumerate_candidates(fixture)
        self.assertEqual(objects["shell"].read_calls, 0)
        self.assertEqual(duplicate.read_calls, 0)

    def test_object_candidate_and_serialized_bounds_precede_metadata_or_decode(self) -> None:
        fixture, _ = environment(partinfo=False)
        fixture.objects = [FakeObject("Texture2D", "a", 1, 1), FakeObject("Texture2D", "b", 2, 1), FakeObject("Texture2D", "c", 3, 1)]
        with mock.patch.object(META, "MAX_OBJECTS", 2), self.assertRaisesRegex(ValueError, "more than 2 objects"):
            DISCOVERY.enumerate_candidates(fixture)
        oversized = FakeObject("Mesh", "Shell", 9, META.MAX_SERIALIZED_BYTES + 1, forbid_peek=True, forbid_read=True)
        fixture = SimpleNamespace(objects=[oversized], container={})
        with self.assertRaisesRegex(ValueError, "serialized size"):
            DISCOVERY.enumerate_candidates(fixture)
        self.assertEqual((oversized.peek_calls, oversized.read_calls), (0, 0))
        fixture, _ = environment(partinfo=False)
        with mock.patch.object(META, "MAX_NAMED_CANDIDATES", 1), self.assertRaisesRegex(ValueError, "more than 1 bounded named candidates"):
            DISCOVERY.enumerate_candidates(fixture)

    def test_duplicate_primitive_and_partinfo_metadata_are_rejected(self) -> None:
        fixture, objects = environment()
        fixture.objects.append(FakeObject("TextAsset", "Connectivity.xml", 6, 80, forbid_read=True))
        with self.assertRaisesRegex(ValueError, "exactly one bounded primitive XML"):
            DISCOVERY.enumerate_candidates(fixture)
        fixture, objects = environment()
        fixture.objects.append(FakeObject("TextAsset", "PartInformation.json", 7, 80, forbid_read=True))
        with self.assertRaisesRegex(ValueError, "identity is ambiguous"):
            DISCOVERY.enumerate_candidates(fixture)

    def test_compressed_declaration_bound_fails_before_mesh_processing(self) -> None:
        packed = SimpleNamespace(m_NumItems=DISCOVERY.EXTRACTOR.MAX_VERTICES * 8 + 1, m_Data=b"")
        compressed = SimpleNamespace(m_Vertices=packed)
        candidate = DISCOVERY.Candidate(
            FakeObject("Mesh", "Shell", 3, 128, mesh_value(compressed=compressed)),
            "3",
            "Shell",
            128,
            (),
        )
        with self.assertRaisesRegex(ValueError, "compressed m_Vertices item count"):
            DISCOVERY.shell_report(candidate, FakeHandler)
        self.assertEqual(FakeHandler.process_calls, 0)

    def test_decoded_empty_group_bound_fails_before_over_limit_group_append(self) -> None:
        class ForbiddenGroup:
            def __iter__(self) -> object:
                raise AssertionError("over-limit empty group must not be visited")

        class EmptyGroupHandler(FakeHandler):
            def get_triangles(self) -> object:
                return iter(([], [], ForbiddenGroup()))

        candidate = DISCOVERY.Candidate(
            FakeObject("Mesh", "Shell", 3, 128, mesh_value()), "3", "Shell", 128, ()
        )
        with (
            mock.patch.object(CORE.EXTRACTOR, "MAX_SUBMESHES", 2),
            self.assertRaisesRegex(ValueError, "exceeds 2 triangle groups"),
        ):
            DISCOVERY.shell_report(candidate, EmptyGroupHandler)


class MetadataParserTests(unittest.TestCase):
    @staticmethod
    def candidate(name: str, payload: str) -> object:
        reader = FakeObject("TextAsset", name, 4, 200, text_value(name, payload))
        return DISCOVERY.Candidate(reader, "4", name, 200, ())

    def test_primitive_rejects_dtd_malformed_transform_nonfinite_and_bounds(self) -> None:
        payloads = (
            '<!DOCTYPE x [<!ENTITY x "boom">]><Primitive><Connectivity/></Primitive>',
            '<Primitive><Connectivity><Fixed transform="1,2"/></Connectivity></Primitive>',
            '<Primitive><Connectivity><Fixed transform="1,0,0,0,1,0,0,0,1,2,3,NaN"/></Connectivity></Primitive>',
        )
        patterns = ("forbidden DTD", "expected 12", "non-finite")
        for payload, pattern in zip(payloads, patterns, strict=True):
            with self.subTest(pattern=pattern), self.assertRaisesRegex(ValueError, pattern):
                DISCOVERY.primitive_report(self.candidate("Primitive.xml", payload))
        nested = '<Primitive><Connectivity><Group><Fixed transform="1,0,0,0,1,0,0,0,1,2,3,4"/></Group></Connectivity></Primitive>'
        with mock.patch.object(META, "MAX_XML_NODES", 3), self.assertRaisesRegex(ValueError, "node/depth bounds"):
            DISCOVERY.primitive_report(self.candidate("Primitive.xml", nested))

    def test_partinfo_rejects_wrong_conflicting_or_nonfinite_identity(self) -> None:
        fixtures = (
            ('{"designId":"9999"}', "exact design 3245"),
            ('{"designId":"3245","revision":"N"}', "revision conflicts"),
            ('{"designId":"3245","nested":{"designId":"9999"}}', "exact design 3245"),
            ('{"designId":"3245","score":NaN}', "non-finite JSON"),
            ('{"designId":"3245","designId":"3245"}', "repeats JSON key"),
        )
        for payload, pattern in fixtures:
            with self.subTest(pattern=pattern), self.assertRaisesRegex(ValueError, pattern):
                DISCOVERY.partinfo_report(self.candidate("PartInfo.json", payload))

    def test_report_validator_rejects_authority_tampering_extra_fields_and_nonfinite(self) -> None:
        report = valid_report()
        DISCOVERY.validate_report(report)
        report["supported"] = True
        with self.assertRaisesRegex(ValueError, "quarantine authority"):
            DISCOVERY.validate_report(report)
        report = valid_report()
        report["authority"] = "self-certified"
        with self.assertRaisesRegex(ValueError, "unexpected schema"):
            DISCOVERY.validate_report(report)
        report = valid_report()
        report["primitiveXml"]["connectorCenters"][0]["center"][0] = math.inf
        with self.assertRaisesRegex(ValueError, "bounded finite triple"):
            DISCOVERY.validate_report(report)
        with self.assertRaisesRegex(ValueError, "repeats JSON key"):
            DISCOVERY.strict_json_loads(b'{"a":1,"a":2}', "Fixture")


class FilesystemAndWorkerTests(unittest.TestCase):
    def test_regular_capture_rejects_nonregular_symlink_and_simulated_toctou(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            regular = root / "regular.bin"
            regular.write_bytes(b"captured")
            self.assertEqual(DISCOVERY.capture_regular_bytes(regular, 8, "Fixture"), b"captured")
            with self.assertRaisesRegex(ValueError, "regular file"):
                DISCOVERY.capture_regular_bytes(root, 100, "Directory")
            link = root / "link.bin"
            try:
                link.symlink_to(regular)
            except OSError:
                with (
                    mock.patch.object(
                        DISCOVERY,
                        "_chain",
                        side_effect=ValueError("symlink or reparse point"),
                    ),
                    self.assertRaisesRegex(ValueError, "symlink or reparse"),
                ):
                    DISCOVERY.capture_regular_bytes(link, 100, "Symlink")
            else:
                with self.assertRaisesRegex(ValueError, "symlink or reparse"):
                    DISCOVERY.capture_regular_bytes(link, 100, "Symlink")
            with mock.patch.object(DISCOVERY, "_assert_chain", side_effect=ValueError("TOCTOU replacement")), self.assertRaisesRegex(ValueError, "TOCTOU"):
                DISCOVERY.capture_regular_bytes(regular, 100, "Fixture")

    def test_atomic_output_is_fixed_contained_and_rejects_symlink_target(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, rows = DISCOVERY.stable_directory(Path(directory), "Output")
            target = DISCOVERY.write_atomic_contained(root, rows, b"canonical")
            self.assertEqual(target, root / DISCOVERY.OUTPUT_NAME)
            self.assertEqual(target.read_bytes(), b"canonical")
            root, rows = DISCOVERY.stable_directory(root, "Output")
            replaced = DISCOVERY.write_atomic_contained(root, rows, b"canonical-v2")
            self.assertEqual(replaced, target)
            self.assertEqual(replaced.read_bytes(), b"canonical-v2")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outside = root / "outside.bin"
            outside.write_bytes(b"outside")
            target = root / DISCOVERY.OUTPUT_NAME
            try:
                target.symlink_to(outside)
            except OSError:
                target.write_bytes(b"simulated-link-placeholder")
                output, rows = DISCOVERY.stable_directory(root, "Output")
                with (
                    mock.patch.object(
                        DISCOVERY,
                        "_chain",
                        side_effect=ValueError("symlink or reparse point"),
                    ),
                    self.assertRaisesRegex(ValueError, "symlink or reparse"),
                ):
                    DISCOVERY.write_atomic_contained(output, rows, b"no escape")
            output, rows = DISCOVERY.stable_directory(root, "Output")
            if target.is_symlink():
                with self.assertRaisesRegex(ValueError, "symlink or reparse"):
                    DISCOVERY.write_atomic_contained(output, rows, b"no escape")
            self.assertEqual(outside.read_bytes(), b"outside")

        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory)
            root, moved, outside = parent / "root", parent / "moved", parent / "outside"
            root.mkdir()
            outside.mkdir()
            output, rows = DISCOVERY.stable_directory(root, "Output")
            start, finished = threading.Event(), threading.Event()
            swap_errors: list[str] = []
            real_token_hex = CORE.secrets.token_hex

            def adversary() -> None:
                start.wait(5)
                try:
                    os.replace(root, moved)
                    linked = subprocess.run(
                        ["cmd.exe", "/c", "mklink", "/J", str(root), str(outside)],
                        capture_output=True,
                        text=True,
                        check=False,
                        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                    )
                    if linked.returncode:
                        swap_errors.append(linked.stderr or linked.stdout)
                except OSError as error:
                    swap_errors.append(str(error))
                finally:
                    finished.set()

            def synchronized_token_hex(byte_count: int) -> str:
                start.set()
                if not finished.wait(5):
                    raise AssertionError("root-swap adversary did not run")
                return real_token_hex(byte_count)

            thread = threading.Thread(target=adversary)
            thread.start()
            publication_error: ValueError | None = None
            with mock.patch.object(CORE.secrets, "token_hex", synchronized_token_hex):
                try:
                    DISCOVERY.write_atomic_contained(output, rows, b"must-not-escape")
                except ValueError as error:
                    publication_error = error
            thread.join(5)
            self.assertFalse(thread.is_alive())
            self.assertFalse((outside / DISCOVERY.OUTPUT_NAME).exists())
            if swap_errors:
                self.assertIsNone(publication_error)
                self.assertEqual(
                    (root / DISCOVERY.OUTPUT_NAME).read_bytes(),
                    b"must-not-escape",
                )
                self.assertFalse(moved.exists())
            else:
                self.assertIsNotNone(publication_error)
                self.assertRegex(str(publication_error), "Output root changed")
                self.assertEqual(list(moved.iterdir()), [])

    @unittest.skipUnless(os.name == "nt", "handle-relative publication is Windows-only")
    def test_atomic_output_rejects_wrong_prevalidated_root_identity_before_creation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target_name = "wrong-identity.json"
            verify = mock.Mock(side_effect=AssertionError("verification must follow identity binding"))

            with self.assertRaisesRegex(ValueError, "exact prevalidated directory"):
                CORE.atomic_write_relative_windows(
                    root,
                    target_name,
                    b"must-not-publish",
                    verify,
                    (-1, -1),
                )

            verify.assert_not_called()
            self.assertFalse((root / target_name).exists())
            self.assertEqual(list(root.iterdir()), [])

    def test_atomic_publication_locks_and_binds_the_final_target(self) -> None:
        canonical = b"canonical-publication"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "output"
            root.mkdir()
            rows = DISCOVERY._chain(root)
            target = root / DISCOVERY.OUTPUT_NAME
            displaced = root / "displaced.json"
            real_assert_chain = DISCOVERY._assert_chain
            attempted = False
            swap_errors: list[OSError] = []

            def adversarial_assert_chain(
                expected: list[tuple[Path, tuple[int, int, int, int]]], label: str
            ) -> None:
                nonlocal attempted
                real_assert_chain(expected, label)
                if attempted or not target.exists():
                    return
                attempted = True
                try:
                    os.replace(target, displaced)
                    target.write_bytes(b"attacker-replacement")
                except OSError as error:
                    swap_errors.append(error)

            with mock.patch.object(
                DISCOVERY, "_assert_chain", side_effect=adversarial_assert_chain
            ):
                returned = DISCOVERY.write_atomic_contained(root, rows, canonical)
            self.assertTrue(attempted)
            self.assertTrue(swap_errors)
            self.assertEqual(returned.read_bytes(), canonical)
            self.assertFalse(displaced.exists())

    def test_timeout_nonzero_noise_and_descendant_leak_all_fail(self) -> None:
        cases = (
            (DISCOVERY.WorkerResult(1, b"x" * 4001, b"", False, 0, "stdout"), "active 4000-byte stdout cap"),
            (DISCOVERY.WorkerResult(-1, b"", b"", True, 0), "exceeded"),
            (DISCOVERY.WorkerResult(7, b"", b"broken", False, 0), "exited 7"),
            (DISCOVERY.WorkerResult(0, b"noise", b"", False, 0), "not silent"),
            (DISCOVERY.WorkerResult(0, b"", b"", False, 2), "descendant process"),
        )
        for result, pattern in cases:
            with self.subTest(pattern=pattern), self.assertRaisesRegex(ValueError, pattern):
                DISCOVERY.validate_worker_result(result)
        DISCOVERY.validate_worker_result(DISCOVERY.WorkerResult(0, b"", b""))

    def test_run_worker_actively_caps_stdout_and_stderr(self) -> None:
        for stream_name, descriptor in (("stdout", 1), ("stderr", 2)):
            with self.subTest(stream=stream_name), tempfile.TemporaryDirectory() as directory:
                started = time.monotonic()
                result = DISCOVERY.run_worker(
                    [
                        sys.executable,
                        "-I",
                        "-S",
                        "-B",
                        "-c",
                        f"import os\nwhile True:\n os.write({descriptor}, b'x' * 1024)",
                    ],
                    Path(directory),
                )
                elapsed = time.monotonic() - started
                self.assertEqual(result.overflow_stream, stream_name)
                self.assertEqual(len(getattr(result, stream_name)), 4_001)
                self.assertLess(elapsed, 5)
                self.assertEqual(list(Path(directory).iterdir()), [])
                with self.assertRaisesRegex(ValueError, f"active 4000-byte {stream_name} cap"):
                    DISCOVERY.validate_worker_result(result)

    def test_pre_assignment_failure_kills_exact_worker_and_always_closes_job(self) -> None:
        _kernel, ExtendedLimit, ProcessIdList, ThreadEntry = META.windows_job_api()

        class RejectingKernel:
            def __init__(self) -> None:
                self.job_closed = False
                self.job_terminations = 0
                self.process_terminations = 0
                self.process: SuspendedProcess | None = None

            def CreateJobObjectW(self, _security: object, _name: object) -> int:
                return 101

            def SetInformationJobObject(self, *_arguments: object) -> bool:
                return True

            def AssignProcessToJobObject(self, *_arguments: object) -> bool:
                return False

            def TerminateJobObject(self, *_arguments: object) -> bool:
                self.job_terminations += 1
                return True

            def TerminateProcess(self, _handle: int, _exit_code: int) -> bool:
                self.process_terminations += 1
                if self.process is not None:
                    self.process.returncode = -9
                return True

            def WaitForSingleObject(self, _handle: int, _timeout_ms: int) -> int:
                return 0 if self.process is not None and self.process.returncode is not None else 258

            def CloseHandle(self, handle: int) -> bool:
                self.job_closed = handle == 101
                return True

        class SuspendedProcess:
            def __init__(self, wait_times_out: bool) -> None:
                self._handle = 202
                self.pid = 303
                self.stdout = io.BytesIO()
                self.stderr = io.BytesIO()
                self.returncode: int | None = None
                self.kill_calls = 0
                self.wait_calls = 0
                self.wait_times_out = wait_times_out

            def poll(self) -> int | None:
                return self.returncode

            def kill(self) -> None:
                self.kill_calls += 1
                if not self.wait_times_out:
                    self.returncode = -9

            def wait(self, timeout: float | None = None) -> int:
                self.wait_calls += 1
                if self.wait_times_out:
                    raise subprocess.TimeoutExpired("synthetic suspended worker", timeout)
                return self.returncode or 0

        for wait_times_out in (False, True):
            with self.subTest(wait_times_out=wait_times_out), tempfile.TemporaryDirectory() as directory:
                kernel = RejectingKernel()
                process = SuspendedProcess(wait_times_out)
                kernel.process = process
                with (
                    mock.patch.object(
                        META,
                        "windows_job_api",
                        return_value=(kernel, ExtendedLimit, ProcessIdList, ThreadEntry),
                    ),
                    mock.patch.object(DISCOVERY.subprocess, "Popen", return_value=process),
                    mock.patch.object(
                        DISCOVERY.SNAPSHOT, "isolated_worker_environment", return_value={}
                    ),
                    self.assertRaisesRegex(OSError, "AssignProcessToJobObject failed") as raised,
                ):
                    DISCOVERY.run_worker(["synthetic-worker"], Path(directory))
                self.assertGreaterEqual(kernel.process_terminations, 1)
                self.assertEqual(process.kill_calls, 0)
                self.assertGreaterEqual(process.wait_calls, 1)
                self.assertTrue(process.stdout.closed)
                self.assertTrue(process.stderr.closed)
                self.assertTrue(kernel.job_closed)
                self.assertEqual(kernel.job_terminations, 0)
                if wait_times_out:
                    self.assertIn(
                        "Worker cleanup also failed",
                        "\n".join(getattr(raised.exception, "__notes__", [])),
                    )

    def test_native_fallbacks_close_real_job_and_kill_real_suspended_worker(self) -> None:
        import ctypes

        kernel, ExtendedLimit, ProcessIdList, ThreadEntry = META.windows_job_api()
        real_popen = subprocess.Popen
        created: list[subprocess.Popen[bytes]] = []

        class FaultInjectingKernel:
            job_handle: int | None = None

            def __getattr__(self, name: str) -> object:
                return getattr(kernel, name)

            def CreateJobObjectW(self, security: object, name: object) -> int:
                handle = kernel.CreateJobObjectW(security, name)
                self.job_handle = int(handle)
                return handle

            def AssignProcessToJobObject(self, _job: int, _process: int) -> bool:
                return False

            def TerminateProcess(self, _process: int, _exit_code: int) -> bool:
                raise OSError("injected Win32 termination failure")

            def CloseHandle(self, handle: int) -> bool:
                if int(handle) == self.job_handle:
                    raise OSError("injected Win32 job-close failure")
                return bool(kernel.CloseHandle(handle))

        injected = FaultInjectingKernel()

        def capture_process(*arguments: object, **keywords: object) -> subprocess.Popen[bytes]:
            process = real_popen(*arguments, **keywords)
            created.append(process)
            return process

        with tempfile.TemporaryDirectory() as directory:
            with (
                mock.patch.object(
                    META,
                    "windows_job_api",
                    return_value=(injected, ExtendedLimit, ProcessIdList, ThreadEntry),
                ),
                mock.patch.object(DISCOVERY.subprocess, "Popen", side_effect=capture_process),
                self.assertRaisesRegex(OSError, "AssignProcessToJobObject failed"),
            ):
                DISCOVERY.run_worker(
                    [sys.executable, "-I", "-S", "-B", "-c", "while True: pass"],
                    Path(directory),
                )
            self.assertEqual(len(created), 1)
            self.assertIsNotNone(created[0].poll())
            self.assertIsNotNone(injected.job_handle)
            process_ids = ProcessIdList()
            ctypes.set_last_error(0)
            self.assertFalse(
                kernel.QueryInformationJobObject(
                    injected.job_handle,
                    3,
                    ctypes.byref(process_ids),
                    ctypes.sizeof(process_ids),
                    None,
                )
            )
            self.assertEqual(ctypes.get_last_error(), 6)

    def test_native_fallback_closes_every_worker_owned_kernel_handle(self) -> None:
        import ctypes
        from ctypes import wintypes

        kernel, ExtendedLimit, ProcessIdList, ThreadEntry = META.windows_job_api()

        class FaultInjectingKernel:
            def __init__(self) -> None:
                self.owned: dict[str, int] = {}
                self.win32_close_failures: set[int] = set()

            def __getattr__(self, name: str) -> object:
                return getattr(kernel, name)

            def CreateJobObjectW(self, security: object, name: object) -> int:
                handle = int(kernel.CreateJobObjectW(security, name))
                self.owned["job"] = handle
                return handle

            def CreateToolhelp32Snapshot(self, flags: int, process_id: int) -> int:
                handle = int(kernel.CreateToolhelp32Snapshot(flags, process_id))
                self.owned["snapshot"] = handle
                return handle

            def OpenThread(self, access: int, inherit: bool, thread_id: int) -> int:
                handle = int(kernel.OpenThread(access, inherit, thread_id))
                self.owned["thread"] = handle
                return handle

            def CloseHandle(self, handle: int) -> bool:
                numeric = int(handle)
                if numeric in self.owned.values():
                    self.win32_close_failures.add(numeric)
                    raise OSError("injected Win32 owned-handle close failure")
                return bool(kernel.CloseHandle(handle))

        injected = FaultInjectingKernel()
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(
            META,
            "windows_job_api",
            return_value=(injected, ExtendedLimit, ProcessIdList, ThreadEntry),
        ):
            result = DISCOVERY.run_worker(
                [sys.executable, "-I", "-S", "-B", "-c", "pass"],
                Path(directory),
            )
        DISCOVERY.validate_worker_result(result)
        self.assertEqual(set(injected.owned), {"job", "snapshot", "thread"})
        self.assertEqual(injected.win32_close_failures, set(injected.owned.values()))

        kernel.GetHandleInformation.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(wintypes.DWORD),
        ]
        kernel.GetHandleInformation.restype = wintypes.BOOL
        for label, handle in injected.owned.items():
            with self.subTest(handle=label):
                flags = wintypes.DWORD()
                ctypes.set_last_error(0)
                self.assertFalse(kernel.GetHandleInformation(handle, ctypes.byref(flags)))
                self.assertEqual(ctypes.get_last_error(), 6)

    def test_run_once_uses_exact_isolated_flags_and_rejects_oversized_report(self) -> None:
        report_payload = DISCOVERY.canonical_json_bytes(valid_report())
        with tempfile.TemporaryDirectory() as directory:
            private = Path(directory)
            seen: list[str] = []

            def fake_run(command: list[str], root: Path) -> object:
                seen.extend(command)
                (root / "report.json").write_bytes(report_payload)
                return DISCOVERY.WorkerResult(0, b"", b"")

            with (
                mock.patch.object(DISCOVERY.SNAPSHOT, "write_private_import_snapshot"),
                mock.patch.object(DISCOVERY.SNAPSHOT, "assert_exact_snapshot_tree"),
                mock.patch.object(DISCOVERY, "run_worker", side_effect=fake_run),
            ):
                result = DISCOVERY._run_once(1, private, {}, b"bundle")
            self.assertEqual(result, report_payload)
            self.assertEqual(seen[1:4], ["-I", "-S", "-B"])
            self.assertIn(DISCOVERY.WORKER_FLAG, seen)
        with tempfile.TemporaryDirectory() as directory:
            private = Path(directory)

            def oversized(_command: list[str], root: Path) -> object:
                (root / "report.json").write_bytes(b"x" * (DISCOVERY.MAX_REPORT_BYTES + 1))
                return DISCOVERY.WorkerResult(0, b"", b"")

            with (
                mock.patch.object(DISCOVERY.SNAPSHOT, "write_private_import_snapshot"),
                mock.patch.object(DISCOVERY.SNAPSHOT, "assert_exact_snapshot_tree"),
                mock.patch.object(DISCOVERY, "run_worker", side_effect=oversized),
                self.assertRaisesRegex(ValueError, "limit is"),
            ):
                DISCOVERY._run_once(1, private, {}, b"bundle")

    def test_controller_requires_two_byte_identical_runs_before_atomic_release(self) -> None:
        payload = b"synthetic bundle"
        digest = hashlib.sha256(payload).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bundle, unitypy, output = root / "bundle.bin", root / "unitypy", root / "output"
            bundle.write_bytes(payload)
            unitypy.mkdir()
            output.mkdir()
            arguments = [str(SCRIPT), "--unitypy", str(unitypy), "--bundle", str(bundle), "--output-root", str(output)]
            with (
                mock.patch.object(sys, "argv", arguments),
                mock.patch.multiple(CORE, BUNDLE_BYTES=len(payload), BUNDLE_SHA256=digest),
                mock.patch.object(DISCOVERY.SNAPSHOT, "validate_worker_runtime"),
                mock.patch.object(DISCOVERY.SNAPSHOT, "capture_pinned_import_payloads", return_value={}),
                mock.patch.object(DISCOVERY, "_run_once", side_effect=[b"first", b"second"]) as run,
                mock.patch.object(DISCOVERY, "write_atomic_contained") as write,
                self.assertRaisesRegex(ValueError, "different report bytes"),
            ):
                DISCOVERY.main()
            self.assertEqual(run.call_count, 2)
            write.assert_not_called()

    def test_untrusted_snapshot_and_post_import_origin_fail_without_report(self) -> None:
        payload = b"bundle"
        digest = hashlib.sha256(payload).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bundle, unitypy, output = root / "bundle.bin", root / "unitypy", root / "output"
            bundle.write_bytes(payload)
            unitypy.mkdir()
            output.mkdir()
            arguments = [str(SCRIPT), "--unitypy", str(unitypy), "--bundle", str(bundle), "--output-root", str(output)]
            with (
                mock.patch.object(sys, "argv", arguments),
                mock.patch.multiple(CORE, BUNDLE_BYTES=len(payload), BUNDLE_SHA256=digest),
                mock.patch.object(DISCOVERY.SNAPSHOT, "validate_worker_runtime"),
                mock.patch.object(DISCOVERY.SNAPSHOT, "capture_pinned_import_payloads", side_effect=ValueError("untrusted RECORD")),
                mock.patch.object(DISCOVERY, "_run_once") as run,
                self.assertRaisesRegex(ValueError, "untrusted RECORD"),
            ):
                DISCOVERY.main()
            run.assert_not_called()

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            packages, bundle, report = root / "packages", root / "bundle.bin", root / "report.json"
            (packages / "UnityPy" / "helpers").mkdir(parents=True)
            init = packages / "UnityPy" / "__init__.py"
            helper = packages / "UnityPy" / "helpers" / "MeshHelper.py"
            init.write_text("", encoding="utf-8")
            helper.write_text("", encoding="utf-8")
            bundle.write_bytes(payload)
            unity_module = SimpleNamespace(__file__=str(init), __version__=DISCOVERY.SNAPSHOT.UNITYPY_VERSION, load=object())
            helper_module = SimpleNamespace(__file__=str(helper), MeshHandler=object())
            original_path = list(sys.path)
            original_dont_write = sys.dont_write_bytecode
            try:
                with (
                    mock.patch.multiple(CORE, BUNDLE_BYTES=len(payload), BUNDLE_SHA256=digest),
                    mock.patch.object(DISCOVERY.SNAPSHOT, "validate_worker_runtime"),
                    mock.patch.object(DISCOVERY.SNAPSHOT, "capture_pinned_import_payloads", return_value={}),
                    mock.patch.object(DISCOVERY.SNAPSHOT, "assert_exact_snapshot_tree"),
                    mock.patch.object(
                        DISCOVERY.SNAPSHOT,
                        "trusted_runtime_paths",
                        return_value=[
                            path
                            for path in original_path
                            if path and Path(path).is_relative_to(Path(sys.base_prefix))
                        ],
                    ),
                    mock.patch.object(DISCOVERY.SNAPSHOT, "PINNED_DISTRIBUTIONS", ()),
                    mock.patch.object(DISCOVERY.SNAPSHOT, "assert_new_import_origins", side_effect=[None, ValueError("untrusted import origin")]),
                    mock.patch.object(DISCOVERY.importlib, "import_module", side_effect=[unity_module, helper_module]),
                    mock.patch.object(CORE, "build_report", return_value=valid_report()),
                    self.assertRaisesRegex(ValueError, "untrusted import origin"),
                ):
                    DISCOVERY.snapshot_worker_main(["--packages", str(packages), "--bundle", str(bundle), "--report", str(report)])
            finally:
                sys.path[:] = original_path
                sys.dont_write_bytecode = original_dont_write
            self.assertFalse(report.exists())


if __name__ == "__main__":
    unittest.main()
