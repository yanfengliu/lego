"""Handle-relative atomic publication of one bounded report on Windows.

The concerns are split so that a reviewer never has to re-derive handle
lifetimes from one long function: API binding, root opening, temporary
creation, payload writing, pre-commit verification, the commit rename,
post-commit target binding, and cleanup each stand alone.

Failure atomicity: every check that can reject the payload runs *before* the
rename commits. Once the rename succeeds the temporary handle is never
deleted, so a failing post-commit proof can no longer leave the output root
holding neither the previous report nor the new one.
"""

from __future__ import annotations

import secrets
from pathlib import Path
from types import SimpleNamespace
from typing import Callable


CHUNK_BYTES = 65_536
FILE_ATTRIBUTE_DIRECTORY = 0x10
FILE_ATTRIBUTE_REPARSE_POINT = 0x400
FILE_INFO_BASIC = 0
FILE_INFO_ID = 18
FILE_RENAME_INFORMATION = 10
FILE_DISPOSITION_INFORMATION = 13

# Only the statuses this operation can actually surface are named; an unlisted
# status is still reported as its exact hexadecimal NTSTATUS.
NTSTATUS_NAMES = {
    0xC0000022: "STATUS_ACCESS_DENIED",
    0xC0000034: "STATUS_OBJECT_NAME_NOT_FOUND",
    0xC0000035: "STATUS_OBJECT_NAME_COLLISION",
    0xC000003A: "STATUS_OBJECT_PATH_NOT_FOUND",
    0xC0000043: "STATUS_SHARING_VIOLATION",
    0xC000007F: "STATUS_DISK_FULL",
    0xC0000098: "STATUS_FILE_INVALID",
    0xC00000BA: "STATUS_FILE_IS_A_DIRECTORY",
    0xC0000121: "STATUS_CANNOT_DELETE",
    0xC0000275: "STATUS_NOT_A_REPARSE_POINT",
}

_API: SimpleNamespace | None = None


def status_text(status: int) -> str:
    code = status & 0xFFFFFFFF
    name = NTSTATUS_NAMES.get(code)
    return f"0x{code:08x} ({name})" if name else f"0x{code:08x}"


def _build_api() -> SimpleNamespace:
    import ctypes
    from ctypes import wintypes

    class UnicodeString(ctypes.Structure):
        _fields_ = [
            ("Length", wintypes.USHORT), ("MaximumLength", wintypes.USHORT),
            ("Buffer", wintypes.LPWSTR),
        ]

    class ObjectAttributes(ctypes.Structure):
        _fields_ = [
            ("Length", wintypes.ULONG), ("RootDirectory", wintypes.HANDLE),
            ("ObjectName", ctypes.POINTER(UnicodeString)), ("Attributes", wintypes.ULONG),
            ("SecurityDescriptor", wintypes.LPVOID),
            ("SecurityQualityOfService", wintypes.LPVOID),
        ]

    class IoStatusBlock(ctypes.Structure):
        _fields_ = [("Status", wintypes.LPVOID), ("Information", ctypes.c_size_t)]

    class FileBasicInfo(ctypes.Structure):
        _fields_ = [
            ("CreationTime", ctypes.c_longlong), ("LastAccessTime", ctypes.c_longlong),
            ("LastWriteTime", ctypes.c_longlong), ("ChangeTime", ctypes.c_longlong),
            ("FileAttributes", wintypes.DWORD),
        ]

    class FileId128(ctypes.Structure):
        _fields_ = [("Identifier", ctypes.c_ubyte * 16)]

    class FileIdInfo(ctypes.Structure):
        _fields_ = [("VolumeSerialNumber", ctypes.c_ulonglong), ("FileId", FileId128)]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    ntdll = ctypes.WinDLL("ntdll", use_last_error=True)
    kernel.CreateFileW.restype = wintypes.HANDLE
    kernel.CreateFileW.argtypes = [
        wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID,
        wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE,
    ]
    kernel.GetFileInformationByHandleEx.argtypes = [
        wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD
    ]
    kernel.WriteFile.argtypes = [
        wintypes.HANDLE, wintypes.LPVOID, wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD), wintypes.LPVOID,
    ]
    kernel.ReadFile.argtypes = [
        wintypes.HANDLE, wintypes.LPVOID, wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD), wintypes.LPVOID,
    ]
    kernel.FlushFileBuffers.argtypes = [wintypes.HANDLE]
    kernel.GetFileSizeEx.argtypes = [wintypes.HANDLE, ctypes.POINTER(ctypes.c_longlong)]
    kernel.SetFilePointerEx.argtypes = [
        wintypes.HANDLE, ctypes.c_longlong, ctypes.POINTER(ctypes.c_longlong),
        wintypes.DWORD,
    ]
    kernel.SetFilePointerEx.restype = wintypes.BOOL
    kernel.SetFileInformationByHandle.argtypes = [
        wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD
    ]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    ntdll.NtCreateFile.restype = wintypes.LONG
    ntdll.NtCreateFile.argtypes = [
        ctypes.POINTER(wintypes.HANDLE), wintypes.ULONG,
        ctypes.POINTER(ObjectAttributes), ctypes.POINTER(IoStatusBlock),
        wintypes.LPVOID, wintypes.ULONG, wintypes.ULONG, wintypes.ULONG,
        wintypes.ULONG, wintypes.LPVOID, wintypes.ULONG,
    ]
    ntdll.NtSetInformationFile.restype = wintypes.LONG
    ntdll.NtSetInformationFile.argtypes = [
        wintypes.HANDLE, ctypes.POINTER(IoStatusBlock), wintypes.LPVOID,
        wintypes.ULONG, wintypes.ULONG,
    ]
    return SimpleNamespace(
        ctypes=ctypes,
        wintypes=wintypes,
        kernel=kernel,
        ntdll=ntdll,
        UnicodeString=UnicodeString,
        ObjectAttributes=ObjectAttributes,
        IoStatusBlock=IoStatusBlock,
        FileBasicInfo=FileBasicInfo,
        FileIdInfo=FileIdInfo,
    )


def _api() -> SimpleNamespace:
    global _API
    if _API is None:
        _API = _build_api()
    return _API


def _file_identity(api: SimpleNamespace, handle: object, label: str) -> tuple[int, bytes]:
    info = api.FileIdInfo()
    if not api.kernel.GetFileInformationByHandleEx(
        handle, FILE_INFO_ID, api.ctypes.byref(info), api.ctypes.sizeof(info)
    ):
        raise OSError(api.ctypes.get_last_error(), f"Cannot inspect {label} file identity")
    return int(info.VolumeSerialNumber), bytes(info.FileId.Identifier)


def _file_attributes(api: SimpleNamespace, handle: object, label: str) -> int:
    info = api.FileBasicInfo()
    if not api.kernel.GetFileInformationByHandleEx(
        handle, FILE_INFO_BASIC, api.ctypes.byref(info), api.ctypes.sizeof(info)
    ):
        raise OSError(api.ctypes.get_last_error(), f"Cannot inspect {label}")
    return int(info.FileAttributes)


def open_output_root(api: SimpleNamespace, root: Path) -> object:
    """Open the caller's prevalidated output directory without following a reparse point."""
    handle = api.kernel.CreateFileW(
        str(root), 0x20 | 0x80, 0x1 | 0x2, None, 3, 0x02000000 | 0x00200000, None
    )
    if handle == api.ctypes.c_void_p(-1).value:
        raise OSError(api.ctypes.get_last_error(), f"Cannot open output root {root}")
    return handle


def assert_output_root(
    api: SimpleNamespace,
    root_handle: object,
    root: Path,
    expected_root_identity: tuple[int, int],
) -> None:
    attributes = _file_attributes(api, root_handle, f"output-root handle for {root}")
    if not attributes & FILE_ATTRIBUTE_DIRECTORY or attributes & FILE_ATTRIBUTE_REPARSE_POINT:
        raise ValueError(
            f"Output-root handle for {root} is not a non-reparse directory "
            f"(attributes 0x{attributes:08x}). Point --output-root at a real local "
            "directory; a junction, symlink, or file is never followed."
        )
    volume, identifier = _file_identity(api, root_handle, f"output root {root}")
    observed = (volume, int.from_bytes(identifier, "little"))
    if observed != expected_root_identity:
        raise ValueError(
            "Output-root handle does not name the exact prevalidated directory; "
            f"opened {observed}, expected {expected_root_identity}."
        )


def create_private_temporary(
    api: SimpleNamespace, root_handle: object, root: Path, target_name: str
) -> tuple[object, str, object]:
    """Create the unshared temporary that the report is written and proven in."""
    temporary_name = f".{target_name}.{secrets.token_hex(16)}"
    encoded = temporary_name.encode("utf-16-le")
    buffer = api.ctypes.create_unicode_buffer(temporary_name)
    name = api.UnicodeString(
        len(encoded), len(encoded) + 2, api.ctypes.cast(buffer, api.wintypes.LPWSTR)
    )
    attributes = api.ObjectAttributes(
        api.ctypes.sizeof(api.ObjectAttributes), root_handle, api.ctypes.pointer(name),
        0x40, None, None,
    )
    handle = api.wintypes.HANDLE()
    status_block = api.IoStatusBlock()
    status = api.ntdll.NtCreateFile(
        api.ctypes.byref(handle),
        0x80000000 | 0x40000000 | 0x00010000 | 0x00100000,
        api.ctypes.byref(attributes), api.ctypes.byref(status_block), None, 0x100,
        0x1, 2, 0x20 | 0x40, None, 0,
    )
    if status < 0:
        raise OSError(
            f"Cannot create the private publication temporary {temporary_name!r} inside "
            f"output root {root}: NtCreateFile returned {status_text(status)}. The root must "
            "be a writable local non-reparse directory that grants this user FILE_ADD_FILE. "
            "Dead end: retrying with another temporary name does not help — the name is "
            "already 16 fresh random bytes, so a collision is not the cause; fix the root's "
            "permissions, read-only attribute, or free space instead."
        )
    return handle, temporary_name, status_block


def write_payload(api: SimpleNamespace, handle: object, payload: bytes, root: Path) -> None:
    for offset in range(0, len(payload), CHUNK_BYTES):
        chunk = payload[offset : offset + CHUNK_BYTES]
        written = api.wintypes.DWORD()
        buffer = api.ctypes.create_string_buffer(chunk)
        if not api.kernel.WriteFile(
            handle, buffer, len(chunk), api.ctypes.byref(written), None
        ) or written.value != len(chunk):
            raise OSError(
                api.ctypes.get_last_error(),
                f"Bounded output write failed at byte {offset} of {len(payload)} inside "
                f"output root {root}",
            )
    if not api.kernel.FlushFileBuffers(handle):
        raise OSError(
            api.ctypes.get_last_error(),
            f"Bounded output flush failed for the publication temporary in {root}",
        )


def read_back(api: SimpleNamespace, handle: object, expected_bytes: int, label: str) -> bytes:
    """Read a bounded file through one already-held handle, never through its name."""
    position = api.ctypes.c_longlong()
    if not api.kernel.SetFilePointerEx(handle, 0, api.ctypes.byref(position), 0):
        raise OSError(api.ctypes.get_last_error(), f"Cannot rewind {label} for verification")
    observed = bytearray()
    remaining = expected_bytes + 1
    while remaining > 0:
        chunk_size = min(CHUNK_BYTES, remaining)
        buffer = api.ctypes.create_string_buffer(chunk_size)
        read = api.wintypes.DWORD()
        if not api.kernel.ReadFile(handle, buffer, chunk_size, api.ctypes.byref(read), None):
            raise OSError(api.ctypes.get_last_error(), f"Bounded {label} verification read failed")
        if read.value == 0:
            break
        observed.extend(buffer.raw[: read.value])
        remaining -= read.value
    return bytes(observed)


def verify_written_bytes(
    api: SimpleNamespace, handle: object, payload: bytes, temporary_name: str, root: Path
) -> None:
    """Prove the temporary already holds the exact payload, before anything commits."""
    attributes = _file_attributes(api, handle, f"publication temporary {temporary_name!r}")
    if attributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT):
        raise ValueError(
            f"Publication temporary {temporary_name!r} in {root} is a directory or reparse "
            f"point (attributes 0x{attributes:08x}); nothing was published."
        )
    size = api.ctypes.c_longlong()
    if not api.kernel.GetFileSizeEx(handle, api.ctypes.byref(size)):
        raise OSError(
            api.ctypes.get_last_error(),
            f"Cannot inspect the size of publication temporary {temporary_name!r} in {root}",
        )
    if size.value != len(payload):
        raise ValueError(
            f"Publication temporary {temporary_name!r} in {root} holds {size.value} bytes; "
            f"expected exactly {len(payload)}. Nothing was published and any previous report "
            "is untouched."
        )
    observed = read_back(api, handle, len(payload), f"publication temporary {temporary_name!r}")
    if observed != payload:
        raise ValueError(
            f"Publication temporary {temporary_name!r} in {root} does not read back as the "
            "exact canonical payload. Nothing was published and any previous report is "
            "untouched."
        )


def commit_rename(
    api: SimpleNamespace,
    handle: object,
    status_block: object,
    root_handle: object,
    root: Path,
    target_name: str,
) -> None:
    """The one committing step: replace the published name with the proven temporary."""
    encoded_name = target_name.encode("utf-16-le")
    rename = api.ctypes.create_string_buffer(20 + len(encoded_name))
    api.ctypes.c_ubyte.from_buffer(rename, 0).value = 1
    api.ctypes.c_void_p.from_buffer(rename, 8).value = int(root_handle)
    api.ctypes.c_uint32.from_buffer(rename, 16).value = len(encoded_name)
    api.ctypes.memmove(api.ctypes.addressof(rename) + 20, encoded_name, len(encoded_name))
    status = api.ntdll.NtSetInformationFile(
        handle, api.ctypes.byref(status_block), rename, api.ctypes.sizeof(rename),
        FILE_RENAME_INFORMATION,
    )
    if status < 0:
        raise OSError(
            f"Cannot publish the verified report as {target_name!r} inside output root {root}: "
            f"the handle-relative rename returned {status_text(status)}. The usual cause is "
            f"that {root / target_name} is held open by another process — an editor, viewer, "
            "indexer, or antivirus scanner — with a sharing mode that denies delete, or that "
            "this user lacks delete/write permission on it. Close whatever holds that exact "
            "file open, or fix its permissions, and rerun. Dead end: deleting the target first "
            "does not make this succeed atomically and is not what this operation does — it "
            "publishes by rename or leaves the previous report in place. Nothing was published "
            "and any previous report is untouched."
        )


def bind_published_target(
    api: SimpleNamespace, root_handle: object, root: Path, target_name: str
) -> object:
    """Reopen the published name so its identity can be compared with what was renamed."""
    encoded_name = target_name.encode("utf-16-le")
    buffer = api.ctypes.create_unicode_buffer(target_name)
    name = api.UnicodeString(
        len(encoded_name), len(encoded_name) + 2,
        api.ctypes.cast(buffer, api.wintypes.LPWSTR),
    )
    attributes = api.ObjectAttributes(
        api.ctypes.sizeof(api.ObjectAttributes), root_handle, api.ctypes.pointer(name),
        0x40, None, None,
    )
    handle = api.wintypes.HANDLE()
    status_block = api.IoStatusBlock()
    status = api.ntdll.NtCreateFile(
        api.ctypes.byref(handle), 0x0001 | 0x0080 | 0x00100000,
        api.ctypes.byref(attributes), api.ctypes.byref(status_block), None, 0,
        0x1 | 0x2 | 0x4, 1, 0x20 | 0x40 | 0x00200000, None, 0,
    )
    if status < 0:
        raise OSError(
            f"The report bytes were already committed to {root / target_name}, but reopening "
            f"that exact name to prove it binds the renamed file returned {status_text(status)}. "
            "Only a concurrent writer in the output root can cause this: something replaced, "
            "removed, or locked the published name between the rename and this check. Treat the "
            "published file as unproven, take the output root out of use by other processes, and "
            "rerun the discovery. Dead end: the file was not deleted and must not be — deleting "
            "it would destroy both this report and the one it replaced."
        )
    return handle


def verify_published_target(
    api: SimpleNamespace,
    handle: object,
    bound_handle: object,
    payload: bytes,
    root: Path,
    target_name: str,
) -> None:
    published_path = root / target_name
    if _file_identity(api, handle, "publication") != _file_identity(
        api, bound_handle, "bound target"
    ):
        raise ValueError(
            f"Published output {published_path} does not name the exact renamed file handle; "
            "a concurrent writer replaced it after the commit. The committed file was left in "
            "place rather than deleted, because deleting it would destroy the report it "
            "replaced as well. Take the output root out of use and rerun."
        )
    attributes = _file_attributes(api, bound_handle, f"bound output target {published_path}")
    if attributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT):
        raise ValueError(
            f"Published output {published_path} is a directory or reparse point "
            f"(attributes 0x{attributes:08x})."
        )
    size = api.ctypes.c_longlong()
    if not api.kernel.GetFileSizeEx(bound_handle, api.ctypes.byref(size)):
        raise OSError(
            api.ctypes.get_last_error(), f"Cannot inspect the size of {published_path}"
        )
    if size.value != len(payload):
        raise ValueError(
            f"Published output {published_path} has {size.value} bytes; expected exactly "
            f"{len(payload)} bytes."
        )
    if read_back(api, bound_handle, len(payload), f"published output {published_path}") != payload:
        raise ValueError(
            f"Published output {published_path} bytes differ from the exact canonical payload."
        )


def _discard_temporary(
    api: SimpleNamespace,
    handle: object,
    status_block: object,
    temporary_name: str,
    root: Path,
) -> None:
    delete = api.wintypes.BOOLEAN(1)
    status = api.ntdll.NtSetInformationFile(
        handle, api.ctypes.byref(status_block), api.ctypes.byref(delete),
        api.ctypes.sizeof(delete), FILE_DISPOSITION_INFORMATION,
    )
    if status < 0:
        raise OSError(
            f"Cannot discard the unpublished temporary {root / temporary_name} by its own "
            f"handle: NtSetInformationFile returned {status_text(status)}. No report was "
            "published and any previous report is untouched, but that exact hidden file is "
            "still on disk and must be deleted by hand. Dead end: rerunning the discovery "
            "creates a differently named temporary and never removes this one."
        )


def atomic_write_relative_windows(
    root: Path,
    target_name: str,
    payload: bytes,
    verify: Callable[[], None],
    expected_root_identity: tuple[int, int],
    close_handle: Callable[[object, int, str], None],
) -> None:
    api = _api()
    root_handle = open_output_root(api, root)
    file_handle = api.wintypes.HANDLE()
    binding_handle = api.wintypes.HANDLE()
    status_block = api.IoStatusBlock()
    temporary_name = ""
    renamed = False
    primary_error: BaseException | None = None
    cleanup_errors: list[BaseException] = []
    try:
        assert_output_root(api, root_handle, root, expected_root_identity)
        verify()
        file_handle, temporary_name, status_block = create_private_temporary(
            api, root_handle, root, target_name
        )
        write_payload(api, file_handle, payload, root)
        verify()
        # Everything that can reject the payload happens here, before the commit.
        verify_written_bytes(api, file_handle, payload, temporary_name, root)
        verify()
        commit_rename(api, file_handle, status_block, root_handle, root, target_name)
        renamed = True
        # Past this point nothing is deleted: the previous report has already been
        # replaced, so discarding this handle would leave the root with neither.
        verify()
        binding_handle = bind_published_target(api, root_handle, root, target_name)
        verify_published_target(
            api, file_handle, binding_handle, payload, root, target_name
        )
    except BaseException as error:
        primary_error = error
        raise
    finally:
        if file_handle.value and not renamed:
            try:
                _discard_temporary(api, file_handle, status_block, temporary_name, root)
            except BaseException as error:
                cleanup_errors.append(error)
        for handle, label in (
            (binding_handle.value, "Bound output handle"),
            (file_handle.value, "Publication handle"),
            (root_handle, "Output-root handle"),
        ):
            if handle:
                try:
                    close_handle(api.kernel, int(handle), label)
                except BaseException as error:
                    cleanup_errors.append(error)
        if cleanup_errors:
            detail = "; ".join(f"{type(error).__name__}: {error}" for error in cleanup_errors)
            if primary_error is not None:
                primary_error.add_note(f"Output publication cleanup also failed: {detail}")
            else:
                raise RuntimeError(
                    f"Output publication cleanup failed after publishing {root / target_name}: "
                    f"{detail}"
                ) from cleanup_errors[0]
