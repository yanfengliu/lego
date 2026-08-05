from __future__ import annotations

import base64
import csv
import hashlib
import importlib.util
import io
import os
import py_compile
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from types import ModuleType
from unittest import mock


SCRIPTS = Path(__file__).resolve().parent


def load_script(name: str, file_name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / file_name)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {file_name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


GENERATOR = load_script("builder_calibration_generator", "generate-builder-calibration.py")
EXTRACTOR = load_script("builder_shell_extractor", "extract-builder-shell.py")
SNAPSHOT = EXTRACTOR.SNAPSHOT


class BoundedInputTests(unittest.TestCase):
    def test_both_tools_reject_oversized_files_before_unbounded_reads(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.bin"
            path.write_bytes(b"12345")

            with self.assertRaisesRegex(ValueError, "5 bytes; limit is 4"):
                GENERATOR.bounded_bytes(path, 4, "Generator input")
            with self.assertRaisesRegex(ValueError, "5 bytes; limit is 4"):
                EXTRACTOR.bounded_bytes(path, 4, "Extractor input")
            self.assertEqual(GENERATOR.bounded_bytes(path, 5, "Generator input"), b"12345")
            self.assertEqual(EXTRACTOR.bounded_bytes(path, 5, "Extractor input"), b"12345")

    def test_extract_parser_receives_the_exact_captured_bytes_after_path_replacement(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bundle.bin"
            path.write_bytes(b"reviewed-bundle")
            captured = EXTRACTOR.bounded_bytes(path, 100, "Extractor input")
            path.write_bytes(b"replacement-path-bytes")
            seen: list[bytes] = []

            def loader(payload: bytes) -> object:
                seen.append(payload)
                return object()

            EXTRACTOR.load_environment_from_bytes(captured, loader)
            self.assertEqual(seen, [b"reviewed-bundle"])

    def test_atomic_writer_replaces_the_complete_target(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.json"
            path.write_bytes(b"old")
            GENERATOR.write_atomic(path, b"new-complete-report")
            self.assertEqual(path.read_bytes(), b"new-complete-report")
            self.assertEqual(list(path.parent.glob(f".{path.name}.*")), [])


class PinnedImportSnapshotTests(unittest.TestCase):
    @staticmethod
    def write_distribution(root: Path, source: str) -> tuple[dict[str, object], ...]:
        package = root / "verified_package"
        dist_info = root / "verified_package-1.0.dist-info"
        package.mkdir()
        dist_info.mkdir()
        files = {
            "verified_package/__init__.py": source.encode("utf-8"),
            "verified_package-1.0.dist-info/METADATA": (
                "Metadata-Version: 2.4\nName: verified-package\nVersion: 1.0\n"
            ).encode("utf-8"),
            "verified_package-1.0.dist-info/WHEEL": (
                "Wheel-Version: 1.0\nGenerator: project fixture\n"
                "Root-Is-Purelib: true\nTag: py3-none-any\n"
            ).encode("utf-8"),
        }
        for relative, payload in files.items():
            path = root.joinpath(*relative.split("/"))
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
        record_buffer = io.StringIO(newline="")
        writer = csv.writer(record_buffer, lineterminator="\n")
        for relative, payload in sorted(files.items()):
            digest = base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).rstrip(b"=")
            writer.writerow((relative, f"sha256={digest.decode('ascii')}", len(payload)))
        writer.writerow(("verified_package-1.0.dist-info/RECORD", "", ""))
        record_payload = record_buffer.getvalue().encode("utf-8")
        (dist_info / "RECORD").write_bytes(record_payload)
        return (
            {
                "distInfo": "verified_package-1.0.dist-info",
                "name": "verified-package",
                "version": "1.0",
                "recordSha256": hashlib.sha256(record_payload).hexdigest(),
                "wheelTags": ("py3-none-any",),
                "topLevels": ("verified_package",),
            },
        )

    @staticmethod
    def import_package(
        root: Path,
        module: str = "verified_package",
        *,
        disable_bytecode: bool,
        python_path: Path | None = None,
    ) -> subprocess.CompletedProcess[str]:
        command = [sys.executable, "-I", "-S"]
        if disable_bytecode:
            command.append("-B")
        command.extend(
            (
                "-c",
                "import importlib,sys;sys.path.insert(0,sys.argv[1]);"
                "m=importlib.import_module(sys.argv[2]);print(getattr(m,'VALUE',''))",
                str(root),
                module,
            )
        )
        environment = os.environ.copy()
        if python_path is not None:
            environment["PYTHONPATH"] = str(python_path)
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
            env=environment,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

    def test_timestamp_valid_malicious_bytecode_cannot_enter_private_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "original"
            root.mkdir()
            marker = Path(directory) / "malicious-bytecode-ran.txt"
            malicious = (
                "from pathlib import Path\n"
                f"Path({str(marker)!r}).write_text('executed', encoding='utf-8')\n"
            )
            benign_base = "VALUE = 'verified-source'\n"
            padding = len(malicious.encode("utf-8")) - len(benign_base.encode("utf-8"))
            self.assertGreater(padding, 1)
            benign = benign_base + "#" * (padding - 1) + "\n"
            self.assertEqual(len(benign.encode("utf-8")), len(malicious.encode("utf-8")))
            pins = self.write_distribution(root, benign)
            source = root / "verified_package" / "__init__.py"
            source_stat = source.stat()
            source.write_bytes(malicious.encode("utf-8"))
            os.utime(source, ns=(source_stat.st_atime_ns, source_stat.st_mtime_ns))
            py_compile.compile(
                str(source),
                doraise=True,
                invalidation_mode=py_compile.PycInvalidationMode.TIMESTAMP,
            )
            source.write_bytes(benign.encode("utf-8"))
            os.utime(source, ns=(source_stat.st_atime_ns, source_stat.st_mtime_ns))

            vulnerable_import = self.import_package(root, disable_bytecode=False)
            self.assertEqual(vulnerable_import.returncode, 0, vulnerable_import.stderr)
            self.assertEqual(marker.read_text(encoding="utf-8"), "executed")
            marker.unlink()

            payloads = SNAPSHOT.capture_pinned_import_payloads(root, pins)
            self.assertFalse(any(path.endswith(".pyc") for path in payloads))
            snapshot = Path(directory) / "snapshot"
            SNAPSHOT.write_private_import_snapshot(snapshot, payloads)
            SNAPSHOT.assert_exact_snapshot_tree(snapshot, payloads)
            isolated_import = self.import_package(snapshot, disable_bytecode=True)
            self.assertEqual(isolated_import.returncode, 0, isolated_import.stderr)
            self.assertEqual(isolated_import.stdout.strip(), "verified-source")
            self.assertFalse(marker.exists())
            self.assertEqual(list(snapshot.rglob("*.pyc")), [])

    def test_unpinned_transitive_module_and_pythonpath_cannot_execute(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "original"
            root.mkdir()
            marker = Path(directory) / "unpinned-module-ran.txt"
            source = "import unpinned_dependency\nVALUE = unpinned_dependency.VALUE\n"
            pins = self.write_distribution(root, source)
            (root / "unpinned_dependency.py").write_text(
                "from pathlib import Path\n"
                f"Path({str(marker)!r}).write_text('executed', encoding='utf-8')\n"
                "VALUE = 'unpinned'\n",
                encoding="utf-8",
            )
            vulnerable_import = self.import_package(root, disable_bytecode=True)
            self.assertEqual(vulnerable_import.returncode, 0, vulnerable_import.stderr)
            self.assertEqual(marker.read_text(encoding="utf-8"), "executed")
            marker.unlink()

            payloads = SNAPSHOT.capture_pinned_import_payloads(root, pins)
            self.assertNotIn("unpinned_dependency.py", payloads)
            snapshot = Path(directory) / "snapshot"
            SNAPSHOT.write_private_import_snapshot(snapshot, payloads)
            isolated_import = self.import_package(
                snapshot,
                disable_bytecode=True,
                python_path=root,
            )
            self.assertNotEqual(isolated_import.returncode, 0)
            self.assertIn("No module named 'unpinned_dependency'", isolated_import.stderr)
            self.assertFalse(marker.exists())

    def test_original_tree_mutation_after_capture_cannot_change_snapshot_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "original"
            root.mkdir()
            pins = self.write_distribution(root, "VALUE = 'captured'\n")
            payloads = SNAPSHOT.capture_pinned_import_payloads(root, pins)
            original_source = root / "verified_package" / "__init__.py"
            original_source.write_text("VALUE = 'mutated'\n", encoding="utf-8")
            snapshot = Path(directory) / "snapshot"
            SNAPSHOT.write_private_import_snapshot(snapshot, payloads)
            SNAPSHOT.assert_exact_snapshot_tree(snapshot, payloads)
            imported = self.import_package(snapshot, disable_bytecode=True)
            self.assertEqual(imported.returncode, 0, imported.stderr)
            self.assertEqual(imported.stdout.strip(), "captured")
            self.assertEqual(
                (snapshot / "verified_package" / "__init__.py").read_bytes(),
                b"VALUE = 'captured'\n",
            )

    def test_snapshot_tree_rejects_injected_bytecode(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "original"
            root.mkdir()
            pins = self.write_distribution(root, "VALUE = 'captured'\n")
            payloads = SNAPSHOT.capture_pinned_import_payloads(root, pins)
            snapshot = Path(directory) / "snapshot"
            SNAPSHOT.write_private_import_snapshot(snapshot, payloads)
            injected = snapshot / "verified_package" / "__pycache__" / "injected.pyc"
            injected.parent.mkdir()
            injected.write_bytes(b"forged")
            with self.assertRaisesRegex(ValueError, "forbidden bytecode"):
                SNAPSHOT.assert_exact_snapshot_tree(snapshot, payloads)


class FrameAndShellTests(unittest.TestCase):
    def test_rejects_unpinned_shell_identity_before_any_parser_call(self) -> None:
        with self.assertRaisesRegex(ValueError, "not an exact supported pin"):
            EXTRACTOR.supported_shell("0" * 64, "1", "1" * 64, 3, 1)

    def test_non_target_and_oversized_shells_never_reach_read_or_process(self) -> None:
        class FakeType:
            name = "Mesh"

        class FakeObject:
            type = FakeType()

            def __init__(self, path_id: int, byte_size: int, data: object | None = None) -> None:
                self.path_id = path_id
                self.byte_size = byte_size
                self.data = data
                self.read_calls = 0

            def read(self) -> object:
                self.read_calls += 1
                if self.data is None:
                    raise AssertionError("bounded objects must fail before read")
                return self.data

        process_calls: list[object] = []

        class FakeHandler:
            def __init__(self, data: object) -> None:
                self.data = data

            def process(self) -> None:
                process_calls.append(self.data)

        non_target = FakeObject(1, EXTRACTOR.MAX_SHELL_SERIALIZED_BYTES + 1)
        oversized_target = FakeObject(2, EXTRACTOR.MAX_SHELL_SERIALIZED_BYTES + 1)
        environment = type("Environment", (), {"objects": [non_target, oversized_target]})()
        fake_source = {
            "designRevision": "fixture;1",
            "shellPathId": "2",
            "serializedBytes": 128,
            "vertexDataBytes": 64,
            "indexBufferBytes": 6,
            "vertices": 3,
            "triangles": 1,
        }
        with self.assertRaisesRegex(ValueError, "serialized byte size"):
            EXTRACTOR.extract_pinned_shell(environment, fake_source, FakeHandler)
        self.assertEqual(non_target.read_calls, 0)
        self.assertEqual(oversized_target.read_calls, 0)
        self.assertEqual(process_calls, [])

        vertex_data = type(
            "VertexData",
            (),
            {"m_VertexCount": EXTRACTOR.MAX_VERTICES + 1, "m_DataSize": b""},
        )()
        oversized_declaration = type(
            "Mesh",
            (),
            {
                "m_Name": "Shell",
                "m_VertexData": vertex_data,
                "m_IndexBuffer": [],
                "m_SubMeshes": [],
                "m_CompressedMesh": None,
            },
        )()
        target = FakeObject(2, 128, oversized_declaration)
        environment = type("Environment", (), {"objects": [non_target, target]})()
        with self.assertRaisesRegex(ValueError, "declared vertex count"):
            EXTRACTOR.extract_pinned_shell(environment, fake_source, FakeHandler)
        self.assertEqual(non_target.read_calls, 0)
        self.assertEqual(target.read_calls, 1)
        self.assertEqual(process_calls, [])

    def test_rejects_unpinned_unitypy_record_before_import(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pins = PinnedImportSnapshotTests.write_distribution(
                root, "VALUE = 'captured'\n"
            )
            (root / "verified_package-1.0.dist-info" / "RECORD").write_text(
                "modified-record", encoding="utf-8"
            )
            with self.assertRaisesRegex(ValueError, "RECORD SHA-256 is"):
                SNAPSHOT.capture_pinned_import_payloads(root, pins)

    def test_report_validator_rejects_geometry_tampering_despite_pinned_scalar_digest(self) -> None:
        canonical_vertices = [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]
        triangles = [(0, 1, 2)]
        source = {
            "bundleSha256": "a" * 64,
            "shellPathId": "123",
            "shellCanonicalSha256": EXTRACTOR.mesh_digest(
                canonical_vertices, [triangles]
            ),
            "vertices": 3,
            "triangles": 1,
        }
        report = {
            "schemaVersion": "lego.builder-shell-inspection/2",
            "bundleSha256": "sha256:" + "a" * 64,
            "shellPathId": "123",
            "shellCanonicalSha256": "sha256:" + source["shellCanonicalSha256"],
            "verticesLdu": [[-25.0 * value for value in vertex] for vertex in canonical_vertices],
            "triangles": [[0, 1, 2]],
        }
        self.assertIs(EXTRACTOR.validate_shell_report(report, source), report)
        report["verticesLdu"][1][0] = -50.0
        with self.assertRaisesRegex(ValueError, "worker report mesh SHA-256"):
            EXTRACTOR.validate_shell_report(report, source)

    def test_strict_worker_report_json_rejects_nonfinite_and_extra_schema_fields(self) -> None:
        with self.assertRaisesRegex(ValueError, "non-finite JSON constant NaN"):
            SNAPSHOT.finite_json_loads(b'{"coordinate":NaN}', "Fixture report")
        source = {
            "bundleSha256": "a" * 64,
            "shellPathId": "123",
            "shellCanonicalSha256": "b" * 64,
            "vertices": 1,
            "triangles": 1,
        }
        report = {
            "schemaVersion": "lego.builder-shell-inspection/2",
            "bundleSha256": "sha256:" + "a" * 64,
            "shellPathId": "123",
            "shellCanonicalSha256": "sha256:" + "b" * 64,
            "verticesLdu": [[0.0, 0.0, 0.0]],
            "triangles": [[0, 0, 0]],
            "authority": "self-certified",
        }
        with self.assertRaisesRegex(ValueError, "unexpected schema"):
            EXTRACTOR.validate_shell_report(report, source)

    def test_asymmetric_connector_sets_derive_one_frame_and_reject_tampering(self) -> None:
        design = GENERATOR.DESIGNS[0]
        self.assertEqual(
            GENERATOR.derive_frame(
                design["catalogStudCenters"], design["builderStudCentersLdu"]
            ),
            {"positionLdu": [30, -4, -30], "orientationId": "upright-yaw-0"},
        )
        changed = [list(point) for point in design["builderStudCentersLdu"]]
        changed[0][0] += 1
        with self.assertRaisesRegex(ValueError, "expected exactly one"):
            GENERATOR.derive_frame(design["catalogStudCenters"], changed)

    def test_shell_validator_rejects_an_out_of_range_triangle_index(self) -> None:
        source = {
            "bundleSha256": "sha256:" + "a" * 64,
            "shellPathId": "fixture-shell",
            "shellCanonicalSha256": "sha256:" + "b" * 64,
            "shellVertexCount": 3,
            "shellTriangleCount": 1,
        }
        report = {
            "schemaVersion": "lego.builder-shell-inspection/2",
            "bundleSha256": source["bundleSha256"],
            "shellPathId": source["shellPathId"],
            "shellCanonicalSha256": source["shellCanonicalSha256"],
            "verticesLdu": [[0, 0, 0], [25, 0, 0], [0, 25, 0]],
            "triangles": [[0, 1, 3]],
        }
        design = {
            "designRevision": "project-authored;1",
            "sourceIdentity": source,
            "builderGeometry": {"byteLength": 36, "digest": "sha256:" + "c" * 64},
        }
        with self.assertRaisesRegex(ValueError, "invalid triangle index"):
            GENERATOR.encode_shell(report, design)


class LDrawLibraryTests(unittest.TestCase):
    @staticmethod
    def archive_bytes(
        entries: list[tuple[str, str | bytes]],
        compression: int = zipfile.ZIP_STORED,
    ) -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=compression) as archive:
            for name, value in entries:
                archive.writestr(name, value)
        return buffer.getvalue()

    @staticmethod
    def library(payload: bytes) -> object:
        return GENERATOR.LDrawLibrary([("Fixture LDraw archive", payload)])

    def test_rejects_case_collisions_and_unsafe_references(self) -> None:
        payload = self.archive_bytes(
            [("ldraw/parts/Foo.dat", "0 upper"), ("ldraw/parts/foo.dat", "0 lower")]
        )
        with self.assertRaisesRegex(ValueError, "repeats case-normalized entry"):
            self.library(payload)
        with self.assertRaisesRegex(ValueError, "Unsafe LDraw reference"):
            GENERATOR.LDrawLibrary.candidates("../outside.dat")

    def test_reads_the_captured_archive_bytes_after_the_source_path_is_replaced(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "library.zip"
            path.write_bytes(self.archive_bytes([("ldraw/parts/a.dat", "0 original")]))
            captured = GENERATOR.bounded_bytes(path, 10_000, "Fixture archive")
            path.write_bytes(self.archive_bytes([("ldraw/parts/a.dat", "0 replacement")]))
            library = self.library(captured)
            try:
                self.assertEqual(library.read("a.dat")[1], "0 original")
            finally:
                library.close()

    def test_pinned_closure_validates_file_hash_headers_and_completeness(self) -> None:
        text = "\n".join(
            (
                "0 Fixture",
                "0 Author: Project Fixture",
                f"0 !LICENSE {GENERATOR.LDRAW_CLOSURE_LICENSE}",
                "0 !LDRAW_ORG Part UPDATE 2026-01",
                "3 16 0 0 0 1 0 0 0 1 0",
            )
        )
        payload = self.archive_bytes([("ldraw/parts/a.dat", text)])
        closure = (
            (
                "parts/a.dat",
                GENERATOR.sha256(text.encode("utf-8")),
                "Project Fixture",
                "Part UPDATE 2026-01",
            ),
        )
        library = GENERATOR.LDrawLibrary(
            [("Fixture LDraw archive", payload)], closure
        )
        try:
            self.assertEqual(len(library.triangles("a.dat")), 1)
            library.assert_complete_closure()
        finally:
            library.close()

        changed = (("parts/a.dat", "0" * 64, "Project Fixture", "Part UPDATE 2026-01"),)
        library = GENERATOR.LDrawLibrary(
            [("Fixture LDraw archive", payload)], changed
        )
        try:
            with self.assertRaisesRegex(ValueError, "SHA-256 is.*expected"):
                library.triangles("a.dat")
        finally:
            library.close()

    def test_rejects_entry_count_before_reading_any_member(self) -> None:
        payload = self.archive_bytes(
            [("ldraw/parts/a.dat", "0 a"), ("ldraw/parts/b.dat", "0 b")]
        )
        with (
            mock.patch.object(GENERATOR, "MAX_LDRAW_ZIP_ENTRIES", 1),
            mock.patch.object(
                GENERATOR.zipfile,
                "ZipFile",
                side_effect=AssertionError("ZipInfo rows must not be allocated before count bounds"),
            ),
            self.assertRaisesRegex(ValueError, r"2 ZIP entries; limit is 1.*do not raise"),
        ):
            self.library(payload)

    def test_rejects_forged_eocd_count_before_zipinfo_allocation(self) -> None:
        payload = bytearray(
            self.archive_bytes(
                [("ldraw/parts/a.dat", "0 a"), ("ldraw/parts/b.dat", "0 b")]
            )
        )
        eocd_offset = payload.rfind(GENERATOR.ZIP_EOCD_SIGNATURE)
        self.assertGreaterEqual(eocd_offset, 0)
        struct.pack_into("<2H", payload, eocd_offset + 8, 1, 1)
        with (
            mock.patch.object(
                GENERATOR.zipfile,
                "ZipFile",
                side_effect=AssertionError("forged count must fail before ZipInfo allocation"),
            ),
            self.assertRaisesRegex(
                ValueError,
                r"declares 1 ZIP entries.*contains 2.*before ZipInfo allocation",
            ),
        ):
            self.library(bytes(payload))

    def test_rejects_per_entry_and_aggregate_expansion_before_member_reads(self) -> None:
        per_entry = self.archive_bytes([("ldraw/parts/large.dat", "12345")])
        aggregate = self.archive_bytes(
            [("ldraw/parts/a.dat", "123"), ("ldraw/parts/b.dat", "456")]
        )
        with (
            mock.patch.object(GENERATOR, "MAX_LDRAW_ZIP_ENTRY_BYTES", 4),
            mock.patch.object(
                zipfile.ZipFile,
                "open",
                side_effect=AssertionError("member data must not be read during preflight"),
            ),
            self.assertRaisesRegex(ValueError, r"expands to 5 bytes; per-entry limit is 4"),
        ):
            self.library(per_entry)
        with (
            mock.patch.object(GENERATOR, "MAX_LDRAW_ZIP_ENTRY_BYTES", 10),
            mock.patch.object(GENERATOR, "MAX_LDRAW_ZIP_TOTAL_BYTES", 5),
            mock.patch.object(
                zipfile.ZipFile,
                "open",
                side_effect=AssertionError("member data must not be read during preflight"),
            ),
            self.assertRaisesRegex(ValueError, r"more than 5 bytes in aggregate"),
        ):
            self.library(aggregate)

    def test_rejects_excessive_compression_ratio_and_unsafe_paths_before_member_reads(self) -> None:
        compressed = self.archive_bytes(
            [("ldraw/parts/repeated.dat", "0" * 10_000)],
            compression=zipfile.ZIP_DEFLATED,
        )
        unsafe = self.archive_bytes([("ldraw/parts/../../outside.dat", "0 outside")])
        with (
            mock.patch.object(GENERATOR, "MAX_LDRAW_ZIP_COMPRESSION_RATIO", 2),
            mock.patch.object(
                zipfile.ZipFile,
                "open",
                side_effect=AssertionError("member data must not be read during preflight"),
            ),
            self.assertRaisesRegex(ValueError, r"compression ratio .* limit is 2"),
        ):
            self.library(compressed)
        with (
            mock.patch.object(
                zipfile.ZipFile,
                "open",
                side_effect=AssertionError("member data must not be read during preflight"),
            ),
            self.assertRaisesRegex(ValueError, r"unsafe ZIP entry path"),
        ):
            self.library(unsafe)

    def test_rejects_recursive_and_malformed_records_with_source_context(self) -> None:
        identity_a_to_b = "1 16 0 0 0 1 0 0 0 1 0 0 0 1 b.dat"
        identity_b_to_a = "1 16 0 0 0 1 0 0 0 1 0 0 0 1 a.dat"
        malformed = "3 16 0 0 0 1 0 0 0 nope 1"
        payload = self.archive_bytes(
            [
                ("ldraw/parts/a.dat", identity_a_to_b),
                ("ldraw/parts/b.dat", identity_b_to_a),
                ("ldraw/parts/malformed.dat", malformed),
            ]
        )
        library = self.library(payload)
        try:
            with self.assertRaisesRegex(ValueError, "Recursive LDraw reference"):
                library.triangles("a.dat")
            with self.assertRaisesRegex(ValueError, r"parts/malformed\.dat:1"):
                library.triangles("malformed.dat")
        finally:
            library.close()


if __name__ == "__main__":
    unittest.main()
