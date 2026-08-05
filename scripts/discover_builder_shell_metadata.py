from __future__ import annotations

import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
from typing import NamedTuple


DESIGN_ID = "3245"
REVISION = "M"
BUNDLE_BYTES = 85_098
BUNDLE_SHA256 = "1aa4e8333df9914191a4d941a7ce0f95460311eabd8f159f9e4a9b1e5c1c9534"
SCHEMA_VERSION = "lego.quarantined-builder-shell-discovery/1"
OUTPUT_NAME = "builder-3245-M-shell-discovery.json"
MAX_OBJECTS = 100_000
MAX_NAMED_CANDIDATES = 512
MAX_SERIALIZED_BYTES = 512 * 1024
MAX_TEXT_BYTES = 256 * 1024
MAX_REPORT_BYTES = 512 * 1024
MAX_XML_NODES = 4_096
MAX_XML_DEPTH = 64
MAX_CONNECTORS = 4_096
MAX_METADATA_CHARACTERS = 256
SHA256_RE = re.compile(r"sha256:[0-9a-f]{64}")


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def canonical_json_bytes(value: object) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False
    ).encode("utf-8")


def strict_json_loads(payload: bytes, label: str) -> object:
    def pairs(rows: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in rows:
            if key in result:
                raise ValueError(f"{label} repeats JSON key {key!r}.")
            result[key] = value
        return result

    def constant(value: str) -> object:
        raise ValueError(f"{label} contains non-finite JSON constant {value}.")

    try:
        return json.loads(
            payload.decode("utf-8", "strict"), object_pairs_hook=pairs, parse_constant=constant
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} is not strict UTF-8 JSON: {error}.") from error


def bounded_int(value: object, maximum: int, label: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(
            f"{label} must be an integer within {minimum}..{maximum}; received {value!r}."
        )
    return value


def bounded_name(value: object, label: str) -> str:
    if not isinstance(value, str) or not value or len(value) > MAX_METADATA_CHARACTERS:
        raise ValueError(
            f"{label} must be a nonempty string of at most {MAX_METADATA_CHARACTERS} characters."
        )
    if any(ord(character) < 32 for character in value):
        raise ValueError(f"{label} contains a control character.")
    return value


class Candidate(NamedTuple):
    reader: object
    path_id: str
    name: str
    serialized_bytes: int
    locators: tuple[str, ...]


def _locator_map(environment: object) -> dict[str, tuple[str, ...]]:
    container = getattr(environment, "container", {}) or {}
    if not hasattr(container, "items"):
        raise ValueError("Bundle container metadata is not a mapping.")
    found: dict[str, list[str]] = {}
    for index, (raw_locator, reader) in enumerate(container.items(), 1):
        if index > MAX_OBJECTS:
            raise ValueError(f"Bundle exposes more than {MAX_OBJECTS} container metadata rows.")
        locator = bounded_name(raw_locator, f"Container locator {index}")
        found.setdefault(str(getattr(reader, "path_id", "")), []).append(locator)
    return {key: tuple(sorted(values)) for key, values in found.items()}


def _classify(candidate: Candidate) -> str | None:
    text = " ".join((candidate.name, *candidate.locators)).casefold()
    compact = re.sub(r"[^a-z0-9]", "", text)
    if "partinfo" in compact or "partinformation" in compact:
        return "partinfo"
    if "primitive" in compact or "connectivity" in compact:
        return "primitive"
    return None


def enumerate_candidates(environment: object) -> tuple[Candidate, Candidate, Candidate | None]:
    locators = _locator_map(environment)
    shells: list[Candidate] = []
    primitives: list[Candidate] = []
    partinfos: list[Candidate] = []
    candidate_count = 0
    for object_count, reader in enumerate(environment.objects, 1):
        if object_count > MAX_OBJECTS:
            raise ValueError(
                f"Bundle exposes more than {MAX_OBJECTS} objects; no further object is decoded."
            )
        type_name = getattr(getattr(reader, "type", None), "name", None)
        if type_name not in {"Mesh", "TextAsset"}:
            continue
        candidate_count += 1
        if candidate_count > MAX_NAMED_CANDIDATES:
            raise ValueError(
                f"Bundle exposes more than {MAX_NAMED_CANDIDATES} bounded named candidates."
            )
        maximum = MAX_SERIALIZED_BYTES if type_name == "Mesh" else MAX_TEXT_BYTES
        size = bounded_int(
            getattr(reader, "byte_size", None),
            maximum,
            f"{type_name} candidate serialized size",
            minimum=1,
        )
        peek = getattr(reader, "peek_name", None)
        if not callable(peek):
            raise ValueError(
                f"Bounded {type_name} candidate lacks the pinned peek_name metadata API."
            )
        name = bounded_name(peek(), f"{type_name} candidate name")
        path_id = str(getattr(reader, "path_id", ""))
        if re.fullmatch(r"-?[0-9]+", path_id) is None:
            raise ValueError(f"{type_name} candidate has malformed path ID {path_id!r}.")
        candidate = Candidate(reader, path_id, name, size, locators.get(path_id, ()))
        if type_name == "Mesh" and name == "Shell":
            shells.append(candidate)
        elif type_name == "TextAsset":
            classification = _classify(candidate)
            if classification == "primitive":
                primitives.append(candidate)
            elif classification == "partinfo":
                partinfos.append(candidate)
    if len(shells) != 1:
        raise ValueError(f"Bundle must expose exactly one Mesh named Shell; found {len(shells)}.")
    if len(primitives) != 1:
        raise ValueError(
            f"Bundle must expose exactly one bounded primitive XML TextAsset; found {len(primitives)}."
        )
    if len(partinfos) > 1:
        raise ValueError(
            f"Bundle exposes {len(partinfos)} bounded partinfo candidates; identity is ambiguous."
        )
    return shells[0], primitives[0], partinfos[0] if partinfos else None


def _read_text(candidate: Candidate, label: str) -> bytes:
    value = candidate.reader.read()
    if getattr(value, "m_Name", None) != candidate.name:
        raise ValueError(f"{label} decoded name differs from bounded peek metadata.")
    script = getattr(value, "m_Script", None)
    if isinstance(script, str):
        payload = script.encode("utf-8", "surrogateescape")
    elif isinstance(script, (bytes, bytearray)):
        payload = bytes(script)
    else:
        raise ValueError(f"{label} payload has unsupported type {type(script).__name__}.")
    if not payload or len(payload) > MAX_TEXT_BYTES:
        raise ValueError(
            f"{label} payload has {len(payload)} bytes; required range is 1..{MAX_TEXT_BYTES}."
        )
    return payload


def _xml_root(payload: bytes, label: str) -> ET.Element:
    try:
        text = payload.decode("utf-8", "strict")
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} is not strict UTF-8 XML: {error}.") from error
    if re.search(r"<!\s*(?:DOCTYPE|ENTITY)\b", text, re.IGNORECASE):
        raise ValueError(f"{label} contains a forbidden DTD or entity declaration.")
    try:
        root = ET.fromstring(text)
    except ET.ParseError as error:
        raise ValueError(f"{label} is malformed XML: {error}.") from error
    stack = [(root, 1)]
    count = 0
    while stack:
        node, depth = stack.pop()
        count += 1
        if count > MAX_XML_NODES or depth > MAX_XML_DEPTH:
            raise ValueError(
                f"{label} exceeds XML node/depth bounds {MAX_XML_NODES}/{MAX_XML_DEPTH}."
            )
        if (
            not isinstance(node.tag, str)
            or len(node.tag) > MAX_METADATA_CHARACTERS
            or len(node.attrib) > 32
        ):
            raise ValueError(f"{label} contains malformed element metadata.")
        for key, value in node.attrib.items():
            bounded_name(key, f"{label} attribute name")
            if len(value) > 4_096:
                raise ValueError(f"{label} attribute {key!r} exceeds 4096 characters.")
        if len(node.text or "") > 4_096 or len(node.tail or "") > 4_096:
            raise ValueError(f"{label} contains oversized element text.")
        stack.extend((child, depth + 1) for child in node)
    return root


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def primitive_report(candidate: Candidate) -> dict[str, object]:
    payload = _read_text(candidate, "Primitive XML")
    root = _xml_root(payload, "Primitive XML")
    connectivity = [
        node for node in root.iter() if _local_name(node.tag).casefold() == "connectivity"
    ]
    if len(connectivity) != 1:
        raise ValueError(
            f"Primitive XML must contain exactly one Connectivity element; found {len(connectivity)}."
        )
    centers: list[dict[str, object]] = []
    for node in connectivity[0].iter():
        if node is connectivity[0]:
            continue
        transforms = [
            value
            for key, value in node.attrib.items()
            if _local_name(key).casefold() == "transform"
        ]
        if not transforms:
            continue
        if len(transforms) != 1:
            raise ValueError("Primitive connector repeats its transform attribute.")
        values = [part for part in re.split(r"[,\s]+", transforms[0].strip()) if part]
        if len(values) != 12:
            raise ValueError(
                f"Primitive connector transform has {len(values)} values; expected 12."
            )
        try:
            numbers = [float(value) for value in values]
        except ValueError as error:
            raise ValueError("Primitive connector transform contains a non-number.") from error
        if any(
            not math.isfinite(value) or abs(value) > 1_000_000_000 for value in numbers
        ):
            raise ValueError(
                "Primitive connector transform contains a non-finite or unbounded value."
            )
        connector_type = next(
            (
                value
                for key, value in node.attrib.items()
                if _local_name(key).casefold() == "type"
            ),
            None,
        )
        if connector_type is not None and len(connector_type) > MAX_METADATA_CHARACTERS:
            raise ValueError("Primitive connector type metadata is oversized.")
        center = [0.0 if value == 0 else value for value in numbers[-3:]]
        centers.append(
            {
                "center": center,
                "kind": bounded_name(_local_name(node.tag), "Connector kind"),
                "type": connector_type,
            }
        )
        if len(centers) > MAX_CONNECTORS:
            raise ValueError(
                f"Primitive XML exposes more than {MAX_CONNECTORS} connector centers."
            )
    if not centers:
        raise ValueError("Primitive XML contains no bounded connector transform centers.")
    centers.sort(key=lambda row: canonical_json_bytes(row))
    return {
        "connectorCenters": centers,
        "name": candidate.name,
        "pathId": candidate.path_id,
        "serializedBytes": candidate.serialized_bytes,
        "sha256": f"sha256:{sha256(payload)}",
    }


def _identity_pairs(value: object, label: str) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    stack = [(value, 0)]
    nodes = 0
    while stack:
        current, depth = stack.pop()
        nodes += 1
        if nodes > MAX_XML_NODES or depth > 32:
            raise ValueError(f"{label} exceeds metadata node/depth bounds.")
        if isinstance(current, dict):
            for key, child in current.items():
                bounded_name(key, f"{label} key")
                if isinstance(child, (str, int)) and not isinstance(child, bool):
                    result.append((key, str(child)))
                elif child is not None:
                    stack.append((child, depth + 1))
        elif isinstance(current, list):
            if len(current) > MAX_XML_NODES:
                raise ValueError(f"{label} contains an oversized list.")
            stack.extend((child, depth + 1) for child in current)
        else:
            raise ValueError(f"{label} contains unsupported scalar {type(current).__name__}.")
    return result


def partinfo_report(candidate: Candidate) -> dict[str, object]:
    payload = _read_text(candidate, "Partinfo")
    pairs: list[tuple[str, str]] = []
    if payload.lstrip().startswith(b"<"):
        root = _xml_root(payload, "Partinfo")
        for node in root.iter():
            pairs.extend((_local_name(key), value) for key, value in node.attrib.items())
            if node.text and node.text.strip():
                pairs.append((_local_name(node.tag), node.text.strip()))
    else:
        pairs = _identity_pairs(strict_json_loads(payload, "Partinfo"), "Partinfo")
    aliases = {
        "designId": {"design", "designid", "designnumber", "partid"},
        "revision": {"revision", "designrevision", "version"},
        "name": {"name", "designname", "partname"},
    }
    found: dict[str, set[str]] = {key: set() for key in aliases}
    for key, value in pairs:
        normalized = re.sub(r"[^a-z0-9]", "", key.casefold())
        for field, names in aliases.items():
            if normalized in names:
                if not value or len(value) > MAX_METADATA_CHARACTERS:
                    raise ValueError(f"Partinfo {field} is empty or oversized.")
                found[field].add(value)
    if len(found["designId"]) != 1 or next(iter(found["designId"]), None) != DESIGN_ID:
        raise ValueError(
            f"Partinfo must identify exact design {DESIGN_ID}; found {sorted(found['designId'])}."
        )
    if len(found["revision"]) > 1 or (
        found["revision"] and found["revision"] != {REVISION}
    ):
        raise ValueError(
            f"Partinfo revision conflicts with exact revision {REVISION}: {sorted(found['revision'])}."
        )
    if len(found["name"]) > 1:
        raise ValueError(f"Partinfo contains conflicting names: {sorted(found['name'])}.")
    return {
        "identity": {
            "designId": DESIGN_ID,
            "name": next(iter(found["name"]), None),
            "revision": next(iter(found["revision"]), None),
        },
        "name": candidate.name,
        "pathId": candidate.path_id,
        "serializedBytes": candidate.serialized_bytes,
        "sha256": f"sha256:{sha256(payload)}",
    }


def windows_job_api() -> tuple[object, type[object], type[object], type[object]]:
    import ctypes
    from ctypes import wintypes

    class BasicLimit(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_longlong),
            ("PerJobUserTimeLimit", ctypes.c_longlong),
            ("LimitFlags", wintypes.DWORD),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", wintypes.DWORD),
            ("Affinity", ctypes.c_size_t),
            ("PriorityClass", wintypes.DWORD),
            ("SchedulingClass", wintypes.DWORD),
        ]

    class IoCounters(ctypes.Structure):
        _fields_ = [
            (name, ctypes.c_ulonglong)
            for name in (
                "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
                "ReadTransferCount", "WriteTransferCount", "OtherTransferCount",
            )
        ]

    class ExtendedLimit(ctypes.Structure):
        _fields_ = [
            ("BasicLimitInformation", BasicLimit), ("IoInfo", IoCounters),
            ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    class ProcessIdList(ctypes.Structure):
        _fields_ = [
            ("NumberOfAssignedProcesses", wintypes.DWORD),
            ("NumberOfProcessIdsInList", wintypes.DWORD),
            ("ProcessIdList", ctypes.c_size_t * 4096),
        ]

    class ThreadEntry(ctypes.Structure):
        _fields_ = [
            ("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD),
            ("th32ThreadID", wintypes.DWORD), ("th32OwnerProcessID", wintypes.DWORD),
            ("tpBasePri", wintypes.LONG), ("tpDeltaPri", wintypes.LONG),
            ("dwFlags", wintypes.DWORD),
        ]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateJobObjectW.restype = wintypes.HANDLE
    kernel.CreateJobObjectW.argtypes = [wintypes.LPVOID, wintypes.LPCWSTR]
    kernel.SetInformationJobObject.argtypes = [
        wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD
    ]
    kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel.QueryInformationJobObject.argtypes = [
        wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD, wintypes.LPVOID
    ]
    kernel.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
    kernel.TerminateJobObject.restype = wintypes.BOOL
    kernel.TerminateProcess.argtypes = [wintypes.HANDLE, wintypes.UINT]
    kernel.TerminateProcess.restype = wintypes.BOOL
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.WaitForSingleObject.restype = wintypes.DWORD
    kernel.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    kernel.Thread32First.argtypes = [wintypes.HANDLE, ctypes.POINTER(ThreadEntry)]
    kernel.Thread32Next.argtypes = [wintypes.HANDLE, ctypes.POINTER(ThreadEntry)]
    kernel.OpenThread.restype = wintypes.HANDLE
    kernel.OpenThread.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.ResumeThread.argtypes = [wintypes.HANDLE]
    kernel.ResumeThread.restype = wintypes.DWORD
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    return kernel, ExtendedLimit, ProcessIdList, ThreadEntry


def terminate_windows_process(kernel: object, process_handle: int, exit_code: int) -> None:
    import ctypes
    from ctypes import wintypes

    primary_error: BaseException | None = None
    try:
        if kernel.TerminateProcess(process_handle, exit_code):
            return
        primary_error = OSError(ctypes.get_last_error(), "TerminateProcess failed")
    except BaseException as error:
        primary_error = error
    ntdll = ctypes.WinDLL("ntdll", use_last_error=True)
    ntdll.NtTerminateProcess.restype = wintypes.LONG
    ntdll.NtTerminateProcess.argtypes = [wintypes.HANDLE, wintypes.LONG]
    status = ntdll.NtTerminateProcess(process_handle, ctypes.c_long(exit_code).value)
    if status < 0:
        error = OSError(f"NtTerminateProcess failed: 0x{status & 0xFFFFFFFF:08x}")
        if primary_error is not None:
            error.add_note(f"Win32 termination also failed: {primary_error}")
        raise error


def close_windows_handle(kernel: object, handle: int, label: str) -> None:
    import ctypes
    from ctypes import wintypes

    primary_error: BaseException | None = None
    try:
        if kernel.CloseHandle(handle):
            return
        primary_error = OSError(ctypes.get_last_error(), f"{label} CloseHandle failed")
    except BaseException as error:
        primary_error = error
    ntdll = ctypes.WinDLL("ntdll", use_last_error=True)
    ntdll.NtClose.restype = wintypes.LONG
    ntdll.NtClose.argtypes = [wintypes.HANDLE]
    status = ntdll.NtClose(handle)
    if status < 0:
        error = OSError(f"{label} NtClose failed: 0x{status & 0xFFFFFFFF:08x}")
        if primary_error is not None:
            error.add_note(f"Win32 closure also failed: {primary_error}")
        raise error
