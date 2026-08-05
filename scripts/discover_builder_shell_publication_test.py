from __future__ import annotations
import hashlib
import io
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

from discover_builder_shell_test_support import (
    CORE,
    DISCOVERY,
    META,
    PUBLICATION,
    SCRIPT,
    valid_report,
)


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
            real_token_hex = PUBLICATION.secrets.token_hex

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
            with mock.patch.object(PUBLICATION.secrets, "token_hex", synchronized_token_hex):
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

    def test_failed_verification_never_destroys_the_previously_published_report(self) -> None:
        """A rejected publication must leave the output root with the older report.

        Regression for non-atomic publication: the rename used to commit before the
        identity/byte postcheck, so a failed postcheck deleted the file that had
        already replaced the previous report and the root was left with neither.
        """
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "output"
            root.mkdir()
            output, rows = DISCOVERY.stable_directory(root, "Output")
            published = DISCOVERY.write_atomic_contained(output, rows, b"published-v1")
            self.assertEqual(published.read_bytes(), b"published-v1")

            output, rows = DISCOVERY.stable_directory(root, "Output")
            with (
                mock.patch.object(
                    PUBLICATION,
                    "verify_written_bytes",
                    side_effect=ValueError("injected pre-commit verification failure"),
                ),
                self.assertRaisesRegex(ValueError, "injected pre-commit verification failure"),
            ):
                DISCOVERY.write_atomic_contained(output, rows, b"published-v2")
            self.assertEqual(published.read_bytes(), b"published-v1")
            self.assertEqual([entry.name for entry in root.iterdir()], [DISCOVERY.OUTPUT_NAME])

            # After the commit the previous report is already gone, so a failing
            # proof must report loudly and leave the new bytes rather than delete.
            output, rows = DISCOVERY.stable_directory(root, "Output")
            with (
                mock.patch.object(
                    PUBLICATION,
                    "bind_published_target",
                    side_effect=OSError("injected post-commit binding failure"),
                ),
                self.assertRaisesRegex(OSError, "injected post-commit binding failure"),
            ):
                DISCOVERY.write_atomic_contained(output, rows, b"published-v3")
            self.assertEqual(published.read_bytes(), b"published-v3")
            self.assertEqual([entry.name for entry in root.iterdir()], [DISCOVERY.OUTPUT_NAME])

    @unittest.skipUnless(os.name == "nt", "handle-relative publication is Windows-only")
    def test_native_publication_failures_name_the_status_path_and_remedy(self) -> None:
        """Every NTSTATUS path names what failed, on which file, and what fixes it."""
        self.assertEqual(PUBLICATION.status_text(0xC0000022), "0xc0000022 (STATUS_ACCESS_DENIED)")
        self.assertEqual(PUBLICATION.status_text(-1073741790), "0xc0000022 (STATUS_ACCESS_DENIED)")
        self.assertEqual(PUBLICATION.status_text(0xC0FFFFFF), "0xc0ffffff")

        api = PUBLICATION._api()

        class FailingNtdll:
            def __getattr__(self, name: str) -> object:
                return getattr(api.ntdll, name)

            def NtCreateFile(self, *_arguments: object) -> int:
                return -1073741790  # STATUS_ACCESS_DENIED

            def NtSetInformationFile(self, *_arguments: object) -> int:
                return -1073741757  # STATUS_SHARING_VIOLATION

        failing = SimpleNamespace(**vars(api))
        failing.ntdll = FailingNtdll()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target_name = "report.json"
            root_handle = PUBLICATION.open_output_root(api, root)
            try:
                handle, temporary_name, status_block = PUBLICATION.create_private_temporary(
                    api, root_handle, root, target_name
                )
                try:
                    with self.assertRaises(OSError) as creation:
                        PUBLICATION.create_private_temporary(
                            failing, root_handle, root, target_name
                        )
                    with self.assertRaises(OSError) as rename:
                        PUBLICATION.commit_rename(
                            failing, handle, status_block, root_handle, root, target_name
                        )
                    with self.assertRaises(OSError) as binding:
                        PUBLICATION.bind_published_target(
                            failing, root_handle, root, target_name
                        )
                    with self.assertRaises(OSError) as discard:
                        PUBLICATION._discard_temporary(
                            failing, handle, status_block, temporary_name, root
                        )
                finally:
                    META.close_windows_handle(api.kernel, int(handle.value), "Fixture handle")
            finally:
                META.close_windows_handle(api.kernel, int(root_handle), "Fixture root handle")
            self.assertFalse((root / target_name).exists())

        expectations = (
            (creation, "STATUS_ACCESS_DENIED", str(root), "FILE_ADD_FILE", "Dead end"),
            (rename, "STATUS_SHARING_VIOLATION", str(root / target_name), "held open", "Dead end"),
            (binding, "STATUS_ACCESS_DENIED", str(root / target_name), "already committed", "Dead end"),
            (discard, "STATUS_SHARING_VIOLATION", str(root / temporary_name), "by hand", "Dead end"),
        )
        for raised, status, path, remedy, dead_end in expectations:
            message = str(raised.exception)
            with self.subTest(status=status, path=path):
                self.assertIn(status, message)
                self.assertIn(path, message)
                self.assertIn(remedy, message)
                self.assertIn(dead_end, message)

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
                    mock.patch.object(DISCOVERY.WORKER.subprocess, "Popen", return_value=process),
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
                mock.patch.object(DISCOVERY.WORKER.subprocess, "Popen", side_effect=capture_process),
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
