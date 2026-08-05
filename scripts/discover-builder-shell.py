from __future__ import annotations
import argparse
import importlib
import importlib.util
import os
import stat
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath
from types import ModuleType
from typing import NamedTuple


WORKER_FLAG = "--quarantined-builder-shell-discovery-worker"
MAX_DIAGNOSTIC_BYTES = 4_000
WORKER_TIMEOUT_SECONDS = 120

def _load_sibling(module_name: str, filename: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, Path(__file__).with_name(filename))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load required sibling {filename}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CORE = _load_sibling("builder_shell_discovery_core", "discover_builder_shell_core.py")
EXTRACTOR = CORE.EXTRACTOR
SNAPSHOT = EXTRACTOR.SNAPSHOT
BUNDLE_BYTES = CORE.BUNDLE_BYTES
BUNDLE_SHA256 = CORE.BUNDLE_SHA256
SCHEMA_VERSION = CORE.SCHEMA_VERSION
OUTPUT_NAME = CORE.OUTPUT_NAME
MAX_REPORT_BYTES = CORE.MAX_REPORT_BYTES
canonical_json_bytes = CORE.canonical_json_bytes
strict_json_loads = CORE.strict_json_loads
sha256 = CORE.sha256
validate_report = CORE.validate_report
build_report = CORE.build_report
shell_report = CORE.shell_report
enumerate_candidates = CORE.META.enumerate_candidates
primitive_report = CORE.META.primitive_report
partinfo_report = CORE.META.partinfo_report
Candidate = CORE.META.Candidate


def _is_reparse(info: os.stat_result) -> bool:
    return bool(getattr(info, "st_file_attributes", 0) & 0x400)


def _absolute(path: Path) -> Path:
    return Path(os.path.abspath(os.fspath(path)))


def _chain(path: Path) -> list[tuple[Path, tuple[int, int, int, int]]]:
    absolute = _absolute(path)
    current = Path(absolute.anchor)
    rows: list[tuple[Path, tuple[int, int, int, int]]] = []
    for part in absolute.parts[1:]:
        current /= part
        info = os.lstat(current)
        if stat.S_ISLNK(info.st_mode) or _is_reparse(info):
            raise ValueError(f"Path {current} is a symlink or reparse point; refusing it.")
        identity_size = info.st_size if stat.S_ISREG(info.st_mode) else 0
        rows.append((current, (info.st_dev, info.st_ino, info.st_mode, identity_size)))
    return rows


def _assert_chain(
    rows: list[tuple[Path, tuple[int, int, int, int]]], label: str
) -> None:
    for path, expected in rows:
        info = os.lstat(path)
        identity_size = info.st_size if stat.S_ISREG(info.st_mode) else 0
        actual = (info.st_dev, info.st_ino, info.st_mode, identity_size)
        if stat.S_ISLNK(info.st_mode) or _is_reparse(info) or actual != expected:
            raise ValueError(f"{label} changed during use at {path}; refusing a TOCTOU result.")


def stable_directory(
    path: Path, label: str
) -> tuple[Path, list[tuple[Path, tuple[int, int, int, int]]]]:
    absolute = _absolute(path)
    rows = _chain(absolute)
    if not rows or not stat.S_ISDIR(rows[-1][1][2]):
        raise ValueError(f"{label} must be an existing regular directory; received {absolute}.")
    return absolute, rows


def capture_regular_bytes(path: Path, maximum: int, label: str) -> bytes:
    absolute = _absolute(path)
    rows = _chain(absolute)
    before = os.lstat(absolute)
    if not stat.S_ISREG(before.st_mode):
        raise ValueError(f"{label} must be a regular file; received {absolute}.")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOINHERIT", 0)
    descriptor = os.open(absolute, flags)
    try:
        opened = os.fstat(descriptor)
        if (before.st_dev, before.st_ino) != (opened.st_dev, opened.st_ino):
            raise ValueError(f"{label} changed before its verified handle opened.")
        if opened.st_size > maximum:
            raise ValueError(f"{label} has {opened.st_size} bytes; limit is {maximum}.")
        chunks: list[bytes] = []
        remaining = maximum + 1
        while remaining:
            chunk = os.read(descriptor, min(65_536, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        payload = b"".join(chunks)
        after_handle = os.fstat(descriptor)
    finally:
        os.close(descriptor)
    after_path = os.lstat(absolute)
    _assert_chain(rows, label)
    identities = {
        (value.st_dev, value.st_ino, value.st_size)
        for value in (opened, after_handle, after_path)
    }
    if len(identities) != 1 or len(payload) != opened.st_size:
        raise ValueError(f"{label} changed while its verified handle was read.")
    if len(payload) > maximum:
        raise ValueError(f"{label} exceeds its {maximum}-byte limit.")
    return payload


def write_atomic_contained(
    root: Path,
    rows: list[tuple[Path, tuple[int, int, int, int]]],
    payload: bytes,
) -> Path:
    target = root / OUTPUT_NAME
    if target.parent != root:
        raise ValueError("Fixed discovery report escaped the caller-selected output root.")
    _assert_chain(rows, "Output root")
    if target.exists() or target.is_symlink():
        target_rows = _chain(target)
        if not target_rows or not stat.S_ISREG(target_rows[-1][1][2]):
            raise ValueError(f"Output target {target} is not a regular file.")
    CORE.atomic_write_relative_windows(
        root,
        OUTPUT_NAME,
        payload,
        lambda: _assert_chain(rows, "Output root"),
        (rows[-1][1][0], rows[-1][1][1]),
    )
    return target


class WorkerResult(NamedTuple):
    returncode: int
    stdout: bytes
    stderr: bytes
    timed_out: bool = False
    descendant_count: int = 0
    overflow_stream: str | None = None


def validate_worker_result(result: WorkerResult) -> None:
    if result.overflow_stream is not None:
        raise ValueError(
            f"Isolated discovery worker exceeded the active {MAX_DIAGNOSTIC_BYTES}-byte "
            f"{result.overflow_stream} cap; its exact process job was terminated."
        )
    if result.timed_out:
        raise ValueError(
            f"Isolated discovery worker exceeded {WORKER_TIMEOUT_SECONDS} seconds; "
            "its process job was terminated."
        )
    if result.descendant_count:
        raise ValueError(
            f"Isolated discovery worker left {result.descendant_count} descendant "
            "process(es); the job was terminated."
        )
    diagnostic = (result.stderr or result.stdout)[-MAX_DIAGNOSTIC_BYTES:]
    diagnostic_text = diagnostic.decode("utf-8", "replace").strip()
    if result.returncode:
        raise ValueError(
            f"Isolated discovery worker exited {result.returncode}. Bounded diagnostic:\n"
            f"{diagnostic_text or 'no diagnostic'}"
        )
    if result.stdout or result.stderr:
        raise ValueError(
            "Successful isolated discovery worker was not silent. Bounded diagnostic:\n"
            f"{diagnostic_text}"
        )


def run_worker(command: list[str], root: Path) -> WorkerResult:
    if sys.platform != "win32":
        raise ValueError("Pinned discovery workers require Windows job-object containment.")
    import ctypes
    import threading

    kernel, ExtendedLimit, ProcessIdList, ThreadEntry = CORE.META.windows_job_api()
    job = kernel.CreateJobObjectW(None, None)
    if not job:
        raise OSError(ctypes.get_last_error(), "CreateJobObjectW failed")
    process: subprocess.Popen[bytes] | None = None
    assigned = False
    primary_error: BaseException | None = None
    readers: list[threading.Thread] = []
    captures = {"stdout": bytearray(), "stderr": bytearray()}
    overflow: list[str | None] = [None]
    reader_errors: list[BaseException] = []
    overflow_lock = threading.Lock()

    def drain(stream: object, stream_name: str) -> None:
        try:
            while True:
                remaining = MAX_DIAGNOSTIC_BYTES + 1 - len(captures[stream_name])
                chunk = stream.read(min(1024, max(1, remaining)))
                if not chunk:
                    break
                captures[stream_name].extend(chunk)
                if len(captures[stream_name]) > MAX_DIAGNOSTIC_BYTES:
                    with overflow_lock:
                        if overflow[0] is None:
                            overflow[0] = stream_name
                            if not kernel.TerminateJobObject(job, 0xE0000001):
                                reader_errors.append(
                                    OSError(ctypes.get_last_error(), "Output-cap job termination failed")
                                )
                    break
        except BaseException as error:
            reader_errors.append(error)
            kernel.TerminateJobObject(job, 0xE0000002)
        finally:
            stream.close()

    try:
        limits = ExtendedLimit()
        limits.BasicLimitInformation.LimitFlags = 0x2000
        if not kernel.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
            raise OSError(ctypes.get_last_error(), "SetInformationJobObject failed")
        process = subprocess.Popen(
            command,
            cwd=root,
            env=SNAPSHOT.isolated_worker_environment(),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW | 0x00000004,
        )
        if not kernel.AssignProcessToJobObject(job, int(process._handle)):
            raise OSError(ctypes.get_last_error(), "AssignProcessToJobObject failed")
        assigned = True
        for stream, stream_name in ((process.stdout, "stdout"), (process.stderr, "stderr")):
            reader = threading.Thread(target=drain, args=(stream, stream_name), daemon=True)
            readers.append(reader)
            reader.start()
        snapshot = kernel.CreateToolhelp32Snapshot(0x00000004, 0)
        if snapshot == ctypes.c_void_p(-1).value:
            raise OSError(ctypes.get_last_error(), "CreateToolhelp32Snapshot failed")
        thread_id = 0
        try:
            entry = ThreadEntry(dwSize=ctypes.sizeof(ThreadEntry))
            more = kernel.Thread32First(snapshot, ctypes.byref(entry))
            while more:
                if entry.th32OwnerProcessID == process.pid:
                    thread_id = entry.th32ThreadID
                    break
                more = kernel.Thread32Next(snapshot, ctypes.byref(entry))
        finally:
            CORE.META.close_windows_handle(
                kernel, int(snapshot), "Worker thread-snapshot handle"
            )
        thread = kernel.OpenThread(0x0002, False, thread_id) if thread_id else 0
        if not thread:
            raise OSError(ctypes.get_last_error(), "OpenThread for suspended worker failed")
        try:
            if kernel.ResumeThread(thread) == 0xFFFFFFFF:
                raise OSError(ctypes.get_last_error(), "ResumeThread failed")
        finally:
            CORE.META.close_windows_handle(
                kernel, int(thread), "Suspended worker thread handle"
            )
        try:
            returncode = process.wait(timeout=WORKER_TIMEOUT_SECONDS)
            timed_out = False
        except subprocess.TimeoutExpired:
            timed_out, returncode = True, -1
            kernel.TerminateJobObject(job, 0xE0000003)
            process.wait(timeout=10)
        for reader in readers:
            reader.join(timeout=10)
            if reader.is_alive():
                kernel.TerminateJobObject(job, 0xE0000004)
                raise RuntimeError("Bounded worker output reader did not terminate.")
        if reader_errors:
            raise RuntimeError("Bounded worker output reader failed.") from reader_errors[0]
        process_ids = ProcessIdList()
        if not kernel.QueryInformationJobObject(
            job, 3, ctypes.byref(process_ids), ctypes.sizeof(process_ids), None
        ):
            raise OSError(ctypes.get_last_error(), "QueryInformationJobObject failed")
        # The terminated worker remains assigned until Popen closes its process handle.
        # Every additional assigned process was created by that worker and is leakage.
        descendants = max(0, int(process_ids.NumberOfAssignedProcesses) - 1)
    except BaseException as error:
        primary_error = error
        raise
    finally:
        cleanup_errors: list[BaseException] = []

        def process_signaled(timeout_ms: int) -> bool:
            if process is None:
                return True
            try:
                result = kernel.WaitForSingleObject(int(process._handle), timeout_ms)
            except BaseException as error:
                cleanup_errors.append(error)
                return False
            if result == 0:
                return True
            if result != 258:
                cleanup_errors.append(
                    OSError(f"WaitForSingleObject returned unexpected status 0x{result:08x}")
                )
            return False

        def terminate_owned_process(exit_code: int) -> bool:
            if process is None:
                return True
            already_signaled = process_signaled(0)
            terminated_job = False
            if assigned:
                try:
                    terminated_job = bool(kernel.TerminateJobObject(job, exit_code))
                except BaseException as error:
                    cleanup_errors.append(error)
                if not terminated_job:
                    cleanup_errors.append(
                        OSError(ctypes.get_last_error(), "Worker job termination failed")
                    )
            if already_signaled:
                return True
            if not terminated_job:
                try:
                    # Before assignment the job cannot own this suspended worker.
                    # The native helper terminates this exact process handle and
                    # falls back to NtTerminateProcess if Win32 termination fails.
                    CORE.META.terminate_windows_process(kernel, int(process._handle), exit_code)
                except BaseException as error:
                    cleanup_errors.append(error)
            if process_signaled(10_000):
                return True
            try:
                CORE.META.terminate_windows_process(kernel, int(process._handle), exit_code)
            except BaseException as error:
                cleanup_errors.append(error)
            if process_signaled(10_000):
                return True
            cleanup_errors.append(RuntimeError("Exact worker process did not terminate within 20 seconds."))
            return False

        try:
            try:
                terminated = terminate_owned_process(0xE0000005)
                if process is not None and terminated:
                    try:
                        process.wait(timeout=0)
                    except BaseException as error:
                        cleanup_errors.append(error)
            finally:
                for reader in readers:
                    try:
                        reader.join(timeout=10)
                        if reader.is_alive():
                            cleanup_errors.append(
                                RuntimeError("Bounded worker output reader did not terminate during cleanup.")
                            )
                    except BaseException as error:
                        cleanup_errors.append(error)
                if process is not None:
                    for stream in (process.stdout, process.stderr):
                        if stream is not None:
                            try:
                                stream.close()
                            except BaseException as error:
                                cleanup_errors.append(error)
        finally:
            try:
                CORE.META.close_windows_handle(kernel, int(job), "Worker job handle")
            except BaseException as error:
                cleanup_errors.append(error)

        if cleanup_errors:
            detail = "; ".join(f"{type(error).__name__}: {error}" for error in cleanup_errors)
            if primary_error is not None:
                primary_error.add_note(f"Worker cleanup also failed: {detail}")
            else:
                raise RuntimeError(f"Worker cleanup failed: {detail}") from cleanup_errors[0]
    return WorkerResult(
        returncode,
        bytes(captures["stdout"]),
        bytes(captures["stderr"]),
        timed_out,
        descendants,
        overflow[0],
    )


def snapshot_worker_main(arguments: list[str]) -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--packages", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(arguments)
    SNAPSHOT.validate_worker_runtime()
    packages, package_rows = stable_directory(args.packages, "Private package snapshot")
    bundle = _absolute(args.bundle)
    report = _absolute(args.report)
    private_root, private_rows = stable_directory(packages.parent, "Private worker root")
    if (
        packages.name != "packages"
        or bundle.parent != private_root
        or report.parent != private_root
        or report.exists()
    ):
        raise ValueError(
            "Worker inputs must be fresh siblings in one private controller-owned directory."
        )
    payloads = SNAPSHOT.capture_pinned_import_payloads(packages)
    SNAPSHOT.assert_exact_snapshot_tree(packages, payloads)
    bundle_payload = capture_regular_bytes(bundle, CORE.BUNDLE_BYTES, "Private captured bundle")
    _assert_chain(package_rows, "Private package snapshot")
    _assert_chain(private_rows, "Private worker root")
    if len(bundle_payload) != CORE.BUNDLE_BYTES or sha256(bundle_payload) != CORE.BUNDLE_SHA256:
        raise ValueError("Private bundle differs from the exact quarantined 3245-M capture.")
    sys.dont_write_bytecode = True
    sys.path[:] = [str(packages), *SNAPSHOT.trusted_runtime_paths()]
    sys.path_importer_cache.clear()
    importlib.invalidate_caches()
    pinned = {
        name for row in SNAPSHOT.PINNED_DISTRIBUTIONS for name in row["topLevels"]
    }
    preloaded = sorted(name for name in sys.modules if name.split(".", 1)[0] in pinned)
    if preloaded:
        raise ValueError(f"Pinned packages were imported before snapshot validation: {preloaded}.")
    baseline = set(sys.modules)
    handles: list[object] = []
    try:
        if hasattr(os, "add_dll_directory"):
            directories = sorted(
                {
                    packages.joinpath(*PurePosixPath(name).parts).parent
                    for name in payloads
                    if PurePosixPath(name).suffix.lower() in {".dll", ".pyd"}
                },
                key=str,
            )
            handles = [os.add_dll_directory(str(path)) for path in directories]
        unitypy = importlib.import_module("UnityPy")
        mesh_helper = importlib.import_module("UnityPy.helpers.MeshHelper")
        expected_unitypy = packages / "UnityPy" / "__init__.py"
        expected_helper = packages / "UnityPy" / "helpers" / "MeshHelper.py"
        if (
            Path(unitypy.__file__).resolve(strict=True) != expected_unitypy
            or Path(mesh_helper.__file__).resolve(strict=True) != expected_helper
        ):
            raise ValueError("Pinned UnityPy imports escaped the private RECORD-verified snapshot.")
        if getattr(unitypy, "__version__", None) != SNAPSHOT.UNITYPY_VERSION:
            raise ValueError(
                f"Imported UnityPy version differs from exact pin {SNAPSHOT.UNITYPY_VERSION}."
            )
        SNAPSHOT.assert_new_import_origins(baseline, packages)
        report_value = CORE.build_report(bundle_payload, unitypy.load, mesh_helper.MeshHandler)
        SNAPSHOT.assert_new_import_origins(baseline, packages)
        SNAPSHOT.assert_exact_snapshot_tree(packages, payloads)
        encoded = canonical_json_bytes(report_value)
        if len(encoded) > CORE.MAX_REPORT_BYTES:
            raise ValueError(
                f"Discovery report has {len(encoded)} bytes; limit is {CORE.MAX_REPORT_BYTES}."
            )
        EXTRACTOR.write_atomic(report, encoded)
    finally:
        for handle in reversed(handles):
            handle.close()
    return 0


def _run_once(
    index: int,
    private_root: Path,
    package_payloads: dict[str, bytes],
    bundle_payload: bytes,
) -> bytes:
    run_root = private_root / f"run-{index}"
    run_root.mkdir(mode=0o700)
    packages = run_root / "packages"
    bundle = run_root / "bundle.bin"
    report = run_root / "report.json"
    SNAPSHOT.write_private_import_snapshot(packages, package_payloads)
    SNAPSHOT.assert_exact_snapshot_tree(packages, package_payloads)
    EXTRACTOR.write_atomic(bundle, bundle_payload)
    command = [
        sys.executable, "-I", "-S", "-B", str(Path(__file__).resolve(strict=True)),
        WORKER_FLAG, "--packages", str(packages), "--bundle", str(bundle),
        "--report", str(report),
    ]
    validate_worker_result(run_worker(command, run_root))
    report_payload = capture_regular_bytes(
        report, CORE.MAX_REPORT_BYTES, f"Discovery worker {index} report"
    )
    value = CORE.validate_report(
        strict_json_loads(report_payload, f"Discovery worker {index} report")
    )
    if canonical_json_bytes(value) != report_payload:
        raise ValueError(f"Discovery worker {index} report is not exact canonical JSON.")
    return report_payload


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Discover bounded metadata from one exact quarantined Builder 3245-M bundle; "
            "never admit or support it."
        )
    )
    parser.add_argument("--unitypy", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    bundle_payload = capture_regular_bytes(
        args.bundle, CORE.BUNDLE_BYTES, "Quarantined Builder bundle"
    )
    actual_digest = sha256(bundle_payload)
    if len(bundle_payload) != CORE.BUNDLE_BYTES or actual_digest != CORE.BUNDLE_SHA256:
        raise ValueError(
            f"Quarantined Builder bundle identity is {len(bundle_payload)} bytes "
            f"sha256:{actual_digest}; expected exactly {CORE.BUNDLE_BYTES} bytes "
            f"sha256:{CORE.BUNDLE_SHA256}."
        )
    output_root, output_rows = stable_directory(args.output_root, "Output root")
    unitypy_root, unitypy_rows = stable_directory(args.unitypy, "UnityPy source root")
    SNAPSHOT.validate_worker_runtime()
    package_payloads = SNAPSHOT.capture_pinned_import_payloads(unitypy_root)
    _assert_chain(unitypy_rows, "UnityPy source root")
    with tempfile.TemporaryDirectory(prefix="lego-builder-3245-quarantine-") as directory:
        private_root = Path(directory).resolve(strict=True)
        private_root.chmod(0o700)
        first = _run_once(1, private_root, package_payloads, bundle_payload)
        second = _run_once(2, private_root, package_payloads, bundle_payload)
        if first != second:
            raise ValueError(
                "Two independent isolated discovery runs produced different report bytes; "
                "no output was released."
            )
    output = write_atomic_contained(output_root, output_rows, first)
    summary = {
        "bundleSha256": f"sha256:{CORE.BUNDLE_SHA256}",
        "output": str(output),
        "status": "quarantined-source-evidence-only",
    }
    print(canonical_json_bytes(summary).decode("utf-8"))
    return 0


if __name__ == "__main__":
    if sys.argv[1:2] == [WORKER_FLAG]:
        raise SystemExit(snapshot_worker_main(sys.argv[2:]))
    raise SystemExit(main())
