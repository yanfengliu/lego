"""Windows job-object containment for the isolated discovery worker.

One suspended child is created, assigned to an exact Job before it resumes,
drained through actively capped pipes, and terminated through the Job with an
exact-process fallback. Nothing here interprets a bundle; it only bounds the
process that does.
"""

from __future__ import annotations

import subprocess
import sys
import threading
from pathlib import Path
from types import ModuleType
from typing import NamedTuple


MAX_DIAGNOSTIC_BYTES = 4_000
WORKER_TIMEOUT_SECONDS = 120

CORE: ModuleType | None = None
SNAPSHOT: ModuleType | None = None


def bind(core: ModuleType) -> None:
    """Share the caller's already-loaded sibling modules rather than reloading them."""
    global CORE, SNAPSHOT
    CORE = core
    SNAPSHOT = core.SNAPSHOT


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
