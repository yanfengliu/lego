from __future__ import annotations

import importlib.util
import math
import re
import secrets
from pathlib import Path
from types import ModuleType
from typing import Callable


def _load_sibling(module_name: str, filename: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, Path(__file__).with_name(filename))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load required sibling {filename}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


META = _load_sibling("builder_shell_discovery_metadata", "discover_builder_shell_metadata.py")
EXTRACTOR = _load_sibling("builder_shell_extractor_foundation", "extract-builder-shell.py")
DESIGN_ID = META.DESIGN_ID
REVISION = META.REVISION
BUNDLE_BYTES = META.BUNDLE_BYTES
BUNDLE_SHA256 = META.BUNDLE_SHA256
SCHEMA_VERSION = META.SCHEMA_VERSION
OUTPUT_NAME = META.OUTPUT_NAME
MAX_SERIALIZED_BYTES = META.MAX_SERIALIZED_BYTES
MAX_TEXT_BYTES = META.MAX_TEXT_BYTES
MAX_REPORT_BYTES = META.MAX_REPORT_BYTES
MAX_CONNECTORS = META.MAX_CONNECTORS
MAX_METADATA_CHARACTERS = META.MAX_METADATA_CHARACTERS
SHA256_RE = META.SHA256_RE
Candidate = META.Candidate
canonical_json_bytes = META.canonical_json_bytes
strict_json_loads = META.strict_json_loads
sha256 = META.sha256


def shell_report(candidate: Candidate, mesh_handler_factory: Callable[[object], object]) -> dict[str, object]:
    mesh = candidate.reader.read()
    if getattr(mesh, "m_Name", None) != "Shell":
        raise ValueError("Decoded Shell name differs from bounded peek metadata.")
    vertex_data = getattr(mesh, "m_VertexData", None)
    vertex_bytes = getattr(vertex_data, "m_DataSize", None)
    if not isinstance(vertex_bytes, (bytes, bytearray)):
        raise ValueError("Shell vertex data is not a byte buffer.")
    vertex_data_bytes = len(vertex_bytes)
    META.bounded_int(vertex_data_bytes, MAX_SERIALIZED_BYTES, "Shell vertex data bytes")
    declared_vertices = META.bounded_int(
        getattr(vertex_data, "m_VertexCount", None),
        EXTRACTOR.MAX_VERTICES,
        "Shell declared vertices",
        minimum=1,
    )
    index_buffer = getattr(mesh, "m_IndexBuffer", None)
    if not isinstance(index_buffer, (bytes, bytearray, list, tuple)):
        raise ValueError("Shell index buffer has an unsupported representation.")
    index_buffer_bytes = len(index_buffer)
    META.bounded_int(
        index_buffer_bytes, EXTRACTOR.MAX_TRIANGLES * 4, "Shell index buffer bytes"
    )
    submeshes = getattr(mesh, "m_SubMeshes", None)
    if not isinstance(submeshes, (list, tuple)):
        raise ValueError("Shell submesh declaration is not a bounded sequence.")
    declared_submeshes = META.bounded_int(
        len(submeshes),
        EXTRACTOR.MAX_SUBMESHES,
        "Shell declared submeshes",
        minimum=1,
    )
    topologies: list[int] = []
    indexes = 0
    for index, submesh in enumerate(submeshes):
        topology = META.bounded_int(
            getattr(submesh, "topology", None), 4, f"Shell submesh {index} topology"
        )
        if topology != 0:
            raise ValueError(
                f"Shell submesh {index} uses unsupported non-triangle topology {topology}."
            )
        topologies.append(topology)
        indexes += META.bounded_int(
            getattr(submesh, "indexCount", None),
            EXTRACTOR.MAX_TRIANGLES * 3,
            f"Shell submesh {index} index count",
        )
        META.bounded_int(
            indexes, EXTRACTOR.MAX_TRIANGLES * 3, "Shell aggregate index count"
        )
    if indexes % 3:
        raise ValueError(
            f"Shell declares {indexes} triangle indexes, which is not divisible by three."
        )
    compression = META.bounded_int(
        getattr(mesh, "m_MeshCompression", None), 3, "Shell mesh compression"
    )
    compressed = getattr(mesh, "m_CompressedMesh", None)
    if compressed is not None:
        fields = (
            "m_BindPoses", "m_BoneIndices", "m_Colors", "m_FloatColors", "m_NormalSigns",
            "m_Normals", "m_TangentSigns", "m_Tangents", "m_Triangles", "m_UV",
            "m_Vertices", "m_Weights",
        )
        for field_name in fields:
            packed = getattr(compressed, field_name, None)
            if packed is None:
                continue
            maximum = (
                EXTRACTOR.MAX_TRIANGLES * 3
                if field_name == "m_Triangles"
                else EXTRACTOR.MAX_VERTICES * 8
            )
            META.bounded_int(
                getattr(packed, "m_NumItems", None),
                maximum,
                f"Shell compressed {field_name} item count",
            )
            packed_data = getattr(packed, "m_Data", None) or []
            if not isinstance(packed_data, (bytes, bytearray, list, tuple)) or len(
                packed_data
            ) > MAX_SERIALIZED_BYTES:
                raise ValueError(
                    f"Shell compressed {field_name} data is unsupported or oversized."
                )
    handler = mesh_handler_factory(mesh)
    handler.process()
    raw_groups = handler.get_triangles()

    def bounded_groups():
        for group_index, group in enumerate(raw_groups):
            if group_index >= EXTRACTOR.MAX_SUBMESHES:
                raise ValueError(
                    f"Decoded Shell exceeds {EXTRACTOR.MAX_SUBMESHES} triangle groups; "
                    "the over-limit group was not appended."
                )
            yield group

    bounded_handler = type(
        "BoundedMeshHandler",
        (),
        {"m_Vertices": handler.m_Vertices, "get_triangles": lambda _self: bounded_groups()},
    )()
    vertices, triangle_groups = EXTRACTOR.bounded_mesh_data(bounded_handler)
    triangle_count = sum(len(group) for group in triangle_groups)
    if (
        len(vertices) != declared_vertices
        or triangle_count != indexes // 3
        or len(triangle_groups) != declared_submeshes
    ):
        raise ValueError(
            "Canonical Shell counts do not reconcile with its bounded declarations."
        )
    return {
        "canonicalMeshSha256": f"sha256:{EXTRACTOR.mesh_digest(vertices, triangle_groups)}",
        "canonicalTriangles": triangle_count,
        "canonicalVertices": len(vertices),
        "declaredCompression": compression,
        "declaredSubmeshes": declared_submeshes,
        "declaredTopologies": topologies,
        "declaredTriangles": indexes // 3,
        "declaredVertices": declared_vertices,
        "indexBufferBytes": index_buffer_bytes,
        "pathId": candidate.path_id,
        "serializedBytes": candidate.serialized_bytes,
        "vertexDataBytes": vertex_data_bytes,
    }


def build_report(
    payload: bytes,
    loader: Callable[[bytes], object],
    mesh_handler_factory: Callable[[object], object],
) -> dict[str, object]:
    if len(payload) != BUNDLE_BYTES or sha256(payload) != BUNDLE_SHA256:
        raise ValueError(
            "Bundle bytes do not match the one exact quarantined 3245-M source identity."
        )
    environment = EXTRACTOR.load_environment_from_bytes(payload, loader)
    shell, primitive, partinfo = META.enumerate_candidates(environment)
    report = {
        "catalogAdmitted": False,
        "partInfo": META.partinfo_report(partinfo) if partinfo else None,
        "primitiveXml": META.primitive_report(primitive),
        "schemaVersion": SCHEMA_VERSION,
        "shell": shell_report(shell, mesh_handler_factory),
        "source": {
            "bundleBytes": BUNDLE_BYTES,
            "bundleSha256": f"sha256:{BUNDLE_SHA256}",
            "designId": DESIGN_ID,
            "revision": REVISION,
        },
        "status": "quarantined-source-evidence-only",
        "supported": False,
    }
    validate_report(report)
    return report


def _keys(value: object, expected: set[str], label: str) -> dict[str, object]:
    if not isinstance(value, dict) or set(value) != expected:
        actual = set(value) if isinstance(value, dict) else set()
        raise ValueError(
            f"{label} has unexpected schema; extra={sorted(actual - expected)}, "
            f"missing={sorted(expected - actual)}."
        )
    return value


def _asset_header(value: object, label: str) -> dict[str, object]:
    asset = _keys(value, {"name", "pathId", "serializedBytes", "sha256"}, label)
    path_id = asset["pathId"] if isinstance(asset["pathId"], str) else ""
    if (
        re.fullmatch(r"-?[0-9]+", path_id) is None
        or not isinstance(asset["sha256"], str)
        or SHA256_RE.fullmatch(asset["sha256"]) is None
    ):
        raise ValueError(f"{label} path or digest metadata is malformed.")
    META.bounded_name(asset["name"], f"{label} name")
    META.bounded_int(
        asset["serializedBytes"], MAX_TEXT_BYTES, f"{label} serialized bytes", minimum=1
    )
    return asset


def validate_report(value: object) -> dict[str, object]:
    report_keys = {
        "catalogAdmitted", "partInfo", "primitiveXml", "schemaVersion", "shell",
        "source", "status", "supported",
    }
    report = _keys(value, report_keys, "Discovery report")
    if (
        report["schemaVersion"] != SCHEMA_VERSION
        or report["status"] != "quarantined-source-evidence-only"
        or report["catalogAdmitted"] is not False
        or report["supported"] is not False
    ):
        raise ValueError("Discovery report attempts to alter its fixed quarantine authority.")
    source = _keys(
        report["source"],
        {"bundleBytes", "bundleSha256", "designId", "revision"},
        "Discovery source",
    )
    expected_source = {
        "bundleBytes": BUNDLE_BYTES,
        "bundleSha256": f"sha256:{BUNDLE_SHA256}",
        "designId": DESIGN_ID,
        "revision": REVISION,
    }
    if source != expected_source:
        raise ValueError("Discovery report source identity differs from the exact 3245-M pin.")
    shell_keys = {
        "canonicalMeshSha256", "canonicalTriangles", "canonicalVertices",
        "declaredCompression", "declaredSubmeshes", "declaredTopologies",
        "declaredTriangles", "declaredVertices", "indexBufferBytes", "pathId",
        "serializedBytes", "vertexDataBytes",
    }
    shell = _keys(report["shell"], shell_keys, "Shell tuple")
    path_id = shell["pathId"] if isinstance(shell["pathId"], str) else ""
    if (
        re.fullmatch(r"-?[0-9]+", path_id) is None
        or not isinstance(shell["canonicalMeshSha256"], str)
        or SHA256_RE.fullmatch(shell["canonicalMeshSha256"]) is None
    ):
        raise ValueError("Shell tuple has malformed path or canonical digest metadata.")
    bounds = (
        ("serializedBytes", MAX_SERIALIZED_BYTES),
        ("vertexDataBytes", MAX_SERIALIZED_BYTES),
        ("indexBufferBytes", EXTRACTOR.MAX_TRIANGLES * 4),
        ("declaredVertices", EXTRACTOR.MAX_VERTICES),
        ("canonicalVertices", EXTRACTOR.MAX_VERTICES),
        ("declaredTriangles", EXTRACTOR.MAX_TRIANGLES),
        ("canonicalTriangles", EXTRACTOR.MAX_TRIANGLES),
        ("declaredSubmeshes", EXTRACTOR.MAX_SUBMESHES),
        ("declaredCompression", 3),
    )
    for key, maximum in bounds:
        META.bounded_int(
            shell[key],
            maximum,
            f"Shell tuple {key}",
            minimum=1 if key not in {"indexBufferBytes", "declaredCompression"} else 0,
        )
    if (
        shell["canonicalVertices"] != shell["declaredVertices"]
        or shell["canonicalTriangles"] != shell["declaredTriangles"]
    ):
        raise ValueError("Shell tuple canonical counts do not equal declarations.")
    topologies = shell["declaredTopologies"]
    if (
        not isinstance(topologies, list)
        or len(topologies) != shell["declaredSubmeshes"]
        or any(value != 0 for value in topologies)
    ):
        raise ValueError("Shell tuple topology declarations are malformed or unsupported.")
    primitive = _keys(
        report["primitiveXml"],
        {"connectorCenters", "name", "pathId", "serializedBytes", "sha256"},
        "Primitive XML",
    )
    _asset_header(
        {key: primitive[key] for key in ("name", "pathId", "serializedBytes", "sha256")},
        "Primitive XML",
    )
    centers = primitive["connectorCenters"]
    if not isinstance(centers, list) or not 1 <= len(centers) <= MAX_CONNECTORS:
        raise ValueError("Primitive XML connector-center list is malformed.")
    for index, row in enumerate(centers):
        item = _keys(row, {"center", "kind", "type"}, f"Connector center {index}")
        META.bounded_name(item["kind"], f"Connector center {index} kind")
        if item["type"] is not None:
            META.bounded_name(item["type"], f"Connector center {index} type")
        center = item["center"]
        if (
            not isinstance(center, list)
            or len(center) != 3
            or any(
                isinstance(number, bool)
                or not isinstance(number, (int, float))
                or not math.isfinite(number)
                or abs(number) > 1_000_000_000
                for number in center
            )
        ):
            raise ValueError(f"Connector center {index} is not a bounded finite triple.")
    partinfo = report["partInfo"]
    if partinfo is not None:
        part = _keys(
            partinfo,
            {"identity", "name", "pathId", "serializedBytes", "sha256"},
            "Partinfo",
        )
        _asset_header(
            {key: part[key] for key in ("name", "pathId", "serializedBytes", "sha256")},
            "Partinfo",
        )
        identity = _keys(
            part["identity"], {"designId", "name", "revision"}, "Partinfo identity"
        )
        name = identity["name"]
        if (
            identity["designId"] != DESIGN_ID
            or identity["revision"] not in {None, REVISION}
            or (
                name is not None
                and (
                    not isinstance(name, str)
                    or not name
                    or len(name) > MAX_METADATA_CHARACTERS
                )
            )
        ):
            raise ValueError("Partinfo identity conflicts with the exact 3245-M source.")
    return report


def atomic_write_relative_windows(
    root: Path,
    target_name: str,
    payload: bytes,
    verify: Callable[[], None],
    expected_root_identity: tuple[int, int],
) -> None:
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
    root_handle = kernel.CreateFileW(
        str(root), 0x20 | 0x80, 0x1 | 0x2, None, 3,
        0x02000000 | 0x00200000, None,
    )
    if root_handle == ctypes.c_void_p(-1).value:
        raise OSError(ctypes.get_last_error(), f"Cannot open output root {root}")
    file_handle = wintypes.HANDLE()
    binding_handle = wintypes.HANDLE()
    published = False
    primary_error: BaseException | None = None
    cleanup_errors: list[BaseException] = []
    try:
        root_info = FileBasicInfo()
        if not kernel.GetFileInformationByHandleEx(
            root_handle, 0, ctypes.byref(root_info), ctypes.sizeof(root_info)
        ):
            raise OSError(ctypes.get_last_error(), "Cannot inspect output-root handle")
        if not root_info.FileAttributes & 0x10 or root_info.FileAttributes & 0x400:
            raise ValueError("Output-root handle is not a non-reparse directory.")
        root_id = FileIdInfo()
        if not kernel.GetFileInformationByHandleEx(
            root_handle, 18, ctypes.byref(root_id), ctypes.sizeof(root_id)
        ):
            raise OSError(ctypes.get_last_error(), "Cannot inspect output-root file identity")
        observed_root_identity = (
            int(root_id.VolumeSerialNumber),
            int.from_bytes(bytes(root_id.FileId.Identifier), "little"),
        )
        if observed_root_identity != expected_root_identity:
            raise ValueError(
                "Output-root handle does not name the exact prevalidated directory; "
                f"opened {observed_root_identity}, expected {expected_root_identity}."
            )
        verify()
        temporary_name = f".{target_name}.{secrets.token_hex(16)}"
        name_buffer = ctypes.create_unicode_buffer(temporary_name)
        name = UnicodeString(
            len(temporary_name.encode("utf-16-le")),
            len(temporary_name.encode("utf-16-le")) + 2,
            ctypes.cast(name_buffer, wintypes.LPWSTR),
        )
        attributes = ObjectAttributes(
            ctypes.sizeof(ObjectAttributes), root_handle, ctypes.pointer(name),
            0x40, None, None,
        )
        status_block = IoStatusBlock()
        status = ntdll.NtCreateFile(
            ctypes.byref(file_handle), 0x40000000 | 0x00010000 | 0x00100000,
            ctypes.byref(attributes), ctypes.byref(status_block), None, 0x100,
            0x1, 2, 0x20 | 0x40, None, 0,
        )
        if status < 0:
            raise OSError(f"NtCreateFile failed for private output temporary: 0x{status & 0xFFFFFFFF:08x}")
        for offset in range(0, len(payload), 65_536):
            chunk = payload[offset : offset + 65_536]
            written = wintypes.DWORD()
            buffer = ctypes.create_string_buffer(chunk)
            if not kernel.WriteFile(
                file_handle, buffer, len(chunk), ctypes.byref(written), None
            ) or written.value != len(chunk):
                raise OSError(ctypes.get_last_error(), "Bounded output write failed")
        if not kernel.FlushFileBuffers(file_handle):
            raise OSError(ctypes.get_last_error(), "Bounded output flush failed")
        verify()
        encoded_name = target_name.encode("utf-16-le")
        rename = ctypes.create_string_buffer(20 + len(encoded_name))
        ctypes.c_ubyte.from_buffer(rename, 0).value = 1
        ctypes.c_void_p.from_buffer(rename, 8).value = int(root_handle)
        ctypes.c_uint32.from_buffer(rename, 16).value = len(encoded_name)
        ctypes.memmove(ctypes.addressof(rename) + 20, encoded_name, len(encoded_name))
        rename_status = ntdll.NtSetInformationFile(
            file_handle, ctypes.byref(status_block), rename, ctypes.sizeof(rename), 10
        )
        if rename_status < 0:
            raise OSError(
                f"Handle-relative output publication failed: "
                f"0x{rename_status & 0xFFFFFFFF:08x}"
            )
        verify()
        target_buffer = ctypes.create_unicode_buffer(target_name)
        target = UnicodeString(
            len(encoded_name),
            len(encoded_name) + 2,
            ctypes.cast(target_buffer, wintypes.LPWSTR),
        )
        target_attributes = ObjectAttributes(
            ctypes.sizeof(ObjectAttributes), root_handle, ctypes.pointer(target),
            0x40, None, None,
        )
        binding_status = ntdll.NtCreateFile(
            ctypes.byref(binding_handle), 0x0001 | 0x0080 | 0x00100000,
            ctypes.byref(target_attributes), ctypes.byref(status_block), None, 0,
            0x1 | 0x2 | 0x4, 1, 0x20 | 0x40 | 0x00200000, None, 0,
        )
        if binding_status < 0:
            raise OSError(
                f"Handle-relative output binding failed: "
                f"0x{binding_status & 0xFFFFFFFF:08x}"
            )
        original_id = FileIdInfo()
        bound_id = FileIdInfo()
        for handle, info, label in (
            (file_handle, original_id, "publication"),
            (binding_handle, bound_id, "bound target"),
        ):
            if not kernel.GetFileInformationByHandleEx(
                handle, 18, ctypes.byref(info), ctypes.sizeof(info)
            ):
                raise OSError(ctypes.get_last_error(), f"Cannot inspect {label} file identity")
        original_identity = (
            int(original_id.VolumeSerialNumber), bytes(original_id.FileId.Identifier)
        )
        bound_identity = (int(bound_id.VolumeSerialNumber), bytes(bound_id.FileId.Identifier))
        if original_identity != bound_identity:
            raise ValueError("Published output target does not name the exact renamed file handle.")
        bound_basic = FileBasicInfo()
        if not kernel.GetFileInformationByHandleEx(
            binding_handle, 0, ctypes.byref(bound_basic), ctypes.sizeof(bound_basic)
        ):
            raise OSError(ctypes.get_last_error(), "Cannot inspect bound output target")
        if bound_basic.FileAttributes & (0x10 | 0x400):
            raise ValueError("Published output target is a directory or reparse point.")
        bound_size = ctypes.c_longlong()
        if not kernel.GetFileSizeEx(binding_handle, ctypes.byref(bound_size)):
            raise OSError(ctypes.get_last_error(), "Cannot inspect bound output size")
        if bound_size.value != len(payload):
            raise ValueError(
                f"Published output has {bound_size.value} bytes; expected exact {len(payload)} bytes."
            )
        observed = bytearray()
        remaining = len(payload) + 1
        while remaining > 0:
            chunk_size = min(65_536, remaining)
            buffer = ctypes.create_string_buffer(chunk_size)
            read = wintypes.DWORD()
            if not kernel.ReadFile(
                binding_handle, buffer, chunk_size, ctypes.byref(read), None
            ):
                raise OSError(ctypes.get_last_error(), "Bounded output verification read failed")
            if read.value == 0:
                break
            observed.extend(buffer.raw[: read.value])
            remaining -= read.value
        if bytes(observed) != payload:
            raise ValueError("Published output bytes differ from the exact canonical payload.")
        published = True
    except BaseException as error:
        primary_error = error
        raise
    finally:
        if file_handle.value:
            if not published:
                delete = wintypes.BOOLEAN(1)
                cleanup_status = ntdll.NtSetInformationFile(
                    file_handle, ctypes.byref(status_block), ctypes.byref(delete),
                    ctypes.sizeof(delete), 13,
                )
                if cleanup_status < 0:
                    cleanup_errors.append(
                        OSError(
                            f"Handle-relative output cleanup failed: "
                            f"0x{cleanup_status & 0xFFFFFFFF:08x}"
                        )
                    )
        for handle, label in (
            (binding_handle.value, "Bound output handle"),
            (file_handle.value, "Publication handle"),
            (root_handle, "Output-root handle"),
        ):
            if handle:
                try:
                    META.close_windows_handle(kernel, int(handle), label)
                except BaseException as error:
                    cleanup_errors.append(error)
        if cleanup_errors:
            detail = "; ".join(f"{type(error).__name__}: {error}" for error in cleanup_errors)
            if primary_error is not None:
                primary_error.add_note(f"Output publication cleanup also failed: {detail}")
            else:
                raise RuntimeError(f"Output publication cleanup failed: {detail}") from cleanup_errors[0]
