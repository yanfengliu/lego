from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
from pathlib import Path

from builder_native_source import (
    NATIVE_PACK_BYTES,
    NATIVE_PACK_SHA256,
    NATIVE_RECORD_SHA256,
    NATIVE_REVIEW_RECORD_SHA256,
    measure_bounds,
    native_measurement,
    validate_native_pack,
)

from ldraw_source_archive import LDrawSourceLibrary, VerifiedArchive, canonical_bytes
from ldraw_surface_expander import ExpandedTriangle, ancestry_role_classifier, expand_surface
from set_6651557_ldraw_source_audit_plan import ARCHIVE_PINS
from discover_builder_shell_core import atomic_write_relative_windows


PILOT_DESIGN_IDS = (
    "5092",
    "30357",
    "35480",
    "51739",
    "77844",
    "93273",
    "15254",
    "2877",
)
VISIBLE_STUD_PRIMITIVES = frozenset(
    {
        "p/stud.dat",
        "p/stud2a.dat",
        "p/stug-1x3.dat",
        "p/stug-1x6.dat",
        "p/stug-2x1.dat",
        "p/stug-2x2.dat",
        "p/stug-3x1.dat",
    }
)

SOURCE_AUDIT_BYTES = 251_402
SOURCE_AUDIT_SHA256 = "cacee99596d0067223977a4cdf967e1aed6cbf072dec1aac8862e486a140cb42"
SOURCE_AUDIT_FILE_COUNT = 439
MAX_JSON_DEPTH = 128
MAX_JSON_NODES = 250_000
MAX_JSON_STRING_CHARACTERS = 2_000_000
MAX_JSON_AGGREGATE_STRING_CHARACTERS = 4_000_000


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_pinned_file(path: Path, expected_bytes: int, expected_sha256: str) -> bytes:
    resolved = path.resolve(strict=True)
    with resolved.open("rb") as stream:
        before = os.fstat(stream.fileno())
        data = stream.read(expected_bytes + 1)
        after = os.fstat(stream.fileno())
    if (before.st_dev, before.st_ino, before.st_size) != (
        after.st_dev,
        after.st_ino,
        after.st_size,
    ):
        raise ValueError(f"Pinned input changed identity or size during its held-handle read: {resolved}")
    if len(data) != expected_bytes or before.st_size != expected_bytes:
        raise ValueError(
            f"Pinned input {resolved} has {before.st_size} bytes and yielded {len(data)}; "
            f"expected exactly {expected_bytes}."
        )
    actual_sha256 = sha256_hex(data)
    if actual_sha256 != expected_sha256:
        raise ValueError(
            f"Pinned input {resolved} is sha256:{actual_sha256}; expected "
            f"sha256:{expected_sha256}. Re-acquire the reviewed bytes; do not update the pin."
        )
    return data


def strict_json(data: bytes, label: str) -> object:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} is not strict UTF-8 at byte {error.start}.") from error

    depth = 0
    in_string = False
    escaped = False
    for offset, character in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == '"':
            in_string = True
        elif character in "[{":
            depth += 1
            if depth > MAX_JSON_DEPTH:
                raise ValueError(
                    f"{label} exceeds the maximum JSON depth {MAX_JSON_DEPTH} at character {offset}."
                )
        elif character in "]}":
            depth -= 1
            if depth < 0:
                break

    def no_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"{label} repeats JSON key {key!r}.")
            result[key] = value
        return result

    def no_constant(value: str) -> object:
        raise ValueError(f"{label} contains forbidden non-finite JSON token {value}.")

    try:
        value = json.loads(text, object_pairs_hook=no_duplicates, parse_constant=no_constant)
    except json.JSONDecodeError as error:
        raise ValueError(
            f"{label} is malformed JSON at line {error.lineno}, column {error.colno}: {error.msg}"
        ) from error
    except RecursionError as error:
        raise ValueError(
            f"{label} exceeds the maximum JSON depth {MAX_JSON_DEPTH}; reduce nesting."
        ) from error

    nodes = 0
    aggregate_string_characters = 0
    stack: list[object] = [value]
    while stack:
        current = stack.pop()
        nodes += 1
        if nodes > MAX_JSON_NODES:
            raise ValueError(f"{label} exceeds the maximum JSON node count {MAX_JSON_NODES}.")
        if isinstance(current, str):
            if len(current) > MAX_JSON_STRING_CHARACTERS:
                raise ValueError(
                    f"{label} contains a {len(current)}-character string; maximum is "
                    f"{MAX_JSON_STRING_CHARACTERS}."
                )
            aggregate_string_characters += len(current)
        elif isinstance(current, list):
            stack.extend(current)
        elif isinstance(current, dict):
            stack.extend(current.values())
            stack.extend(current.keys())
    if aggregate_string_characters > MAX_JSON_AGGREGATE_STRING_CHARACTERS:
        raise ValueError(
            f"{label} contains {aggregate_string_characters} aggregate string characters; "
            f"maximum is {MAX_JSON_AGGREGATE_STRING_CHARACTERS}."
        )
    return value


def triangle_points(
    triangles: list[ExpandedTriangle], role: str | None = None
) -> list[tuple[float, float, float]]:
    return [
        point
        for triangle in triangles
        if role is None or triangle.role == role
        for point in triangle.points
    ]


AuditedFile = tuple[dict[str, object], tuple[tuple[str, str], ...]]


def audited_file_table(value: object) -> dict[tuple[str, str], AuditedFile]:
    if not isinstance(value, dict) or not isinstance(value.get("files"), list):
        raise ValueError("Source audit must be an object with a files array.")
    rows = value["files"]
    if len(rows) != SOURCE_AUDIT_FILE_COUNT:
        raise ValueError(
            f"Source audit has {len(rows)} file records; expected exactly "
            f"{SOURCE_AUDIT_FILE_COUNT}."
        )
    required_keys = {
        "archiveId",
        "author",
        "bytes",
        "declaredName",
        "directReferences",
        "fileId",
        "ldrawOrg",
        "licenseExpression",
        "path",
        "sha256",
        "title",
    }
    manifest_keys = required_keys - {"directReferences", "fileId"}
    result: dict[tuple[str, str], AuditedFile] = {}
    for index, row in enumerate(rows):
        if not isinstance(row, dict) or set(row) != required_keys:
            received = sorted(row) if isinstance(row, dict) else type(row).__name__
            raise ValueError(
                f"Source audit files[{index}] keys are {received}; expected {sorted(required_keys)}."
            )
        archive_id = row["archiveId"]
        path = row["path"]
        if archive_id not in {"official", "unofficial"} or not isinstance(path, str):
            raise ValueError(
                f"Source audit files[{index}] has invalid archive/path {archive_id!r}/{path!r}."
            )
        key = (archive_id, path)
        if key in result or row["fileId"] != f"{archive_id}:{path}":
            raise ValueError(
                f"Source audit files[{index}] repeats or misidentifies {archive_id}:{path}."
            )
        digest = row["sha256"]
        if (
            not isinstance(digest, str)
            or len(digest) != 71
            or not digest.startswith("sha256:")
            or any(character not in "0123456789abcdef" for character in digest[7:])
        ):
            raise ValueError(f"Source audit files[{index}] has malformed sha256 {digest!r}.")
        references = row["directReferences"]
        if not isinstance(references, list) or not all(
            isinstance(reference, str) and ":" in reference for reference in references
        ):
            raise ValueError(
                f"Source audit files[{index}].directReferences must contain source file IDs."
            )
        parsed_references = tuple(
            sorted(
                (reference.split(":", 1)[0], reference.split(":", 1)[1])
                for reference in references
            )
        )
        if len(set(parsed_references)) != len(parsed_references):
            raise ValueError(f"Source audit files[{index}] repeats a direct reference.")
        result[key] = ({field: row[field] for field in manifest_keys}, parsed_references)
    missing_references = sorted(
        f"{archive}:{path}"
        for _, references in result.values()
        for archive, path in references
        if (archive, path) not in result
    )
    if missing_references:
        raise ValueError(
            "Source audit file table omits referenced records: " + ", ".join(missing_references[:8])
        )
    return result


def ldraw_measurement(
    library: LDrawSourceLibrary,
    design_id: str,
    root: tuple[str, str],
    audited_files: dict[tuple[str, str], AuditedFile],
    stud_sources: frozenset[tuple[str, str, str]],
) -> dict[str, object]:
    closure = library.closure(root)
    opened_sources: set[tuple[str, str]] = set()
    triangles = expand_surface(
        library,
        root,
        ancestry_role_classifier(stud_sources, lambda key: library.record(key).sha256),
        opened_sources.add,
    )
    if not triangles:
        raise ValueError(f"Pilot LDraw root {design_id} expands to no triangles.")
    uncertified = sum(not triangle.certified for triangle in triangles)
    unculled = sum(not triangle.cull_enabled for triangle in triangles)
    if uncertified or unculled:
        raise ValueError(
            f"Pilot LDraw root {design_id} expands to {uncertified} uncertified and {unculled} "
            "non-cull-safe triangles; review the exact source branch before mesh use."
        )
    closure_keys = {(record.archive_id, record.path) for record in closure}
    if opened_sources != closure_keys:
        raise ValueError(
            f"Pilot LDraw root {design_id} closure/expansion sources differ: closure-only "
            f"{sorted(closure_keys - opened_sources)}, expansion-only "
            f"{sorted(opened_sources - closure_keys)}."
        )
    for record in closure:
        key = (record.archive_id, record.path)
        audited = audited_files.get(key)
        if audited is None:
            raise ValueError(f"Pilot LDraw root {design_id} opened unaudited source {key}.")
        expected_manifest, expected_references = audited
        if record.manifest_record() != expected_manifest:
            raise ValueError(
                f"Pilot LDraw source {record.archive_id}:{record.path} metadata or digest differs "
                "from the exact source-audit file table."
            )
        actual_references = tuple(sorted(library.dependencies(key)))
        if actual_references != expected_references:
            raise ValueError(
                f"Pilot LDraw source {record.archive_id}:{record.path} resolves references "
                f"{actual_references}; audit pins {expected_references}."
            )
    all_points = triangle_points(triangles)
    body_points = triangle_points(triangles, "body")
    stud_points = triangle_points(triangles, "stud")
    root_record = library.record(root)
    closure_manifest = [record.manifest_record() for record in closure]
    result: dict[str, object] = {
        "root": root_record.manifest_record(),
        "closureFileCount": len(closure),
        "closureBytes": sum(record.byte_length for record in closure),
        "closureManifestSha256": f"sha256:{sha256_hex(canonical_bytes(closure_manifest))}",
        "triangleCount": len(triangles),
        "bodyTriangleCount": sum(triangle.role == "body" for triangle in triangles),
        "studTriangleCount": sum(triangle.role == "stud" for triangle in triangles),
        "uniquePositionCount": len(set(all_points)),
        "boundsLdu": measure_bounds(all_points),
        "bodyBoundsLdu": measure_bounds(body_points),
        "allTrianglesCertifiedAndCullSafe": True,
    }
    if stud_points:
        result["studBoundsLdu"] = measure_bounds(stud_points)
    return result


def audited_roots(value: object) -> dict[str, tuple[str, str]]:
    if not isinstance(value, dict) or not isinstance(value.get("parts"), list):
        raise ValueError("Source audit must be an object with a parts array.")
    result: dict[str, tuple[str, str]] = {}
    for row in value["parts"]:
        if not isinstance(row, dict) or row.get("designId") not in PILOT_DESIGN_IDS:
            continue
        design_id = str(row["designId"])
        expected_id = f"official:parts/{design_id}.dat"
        if row.get("state") != "ldraw-root-and-closure-resolved-not-admitted" or row.get("rootFileId") != expected_id:
            raise ValueError(
                f"Source audit route {design_id} is {row.get('state')!r}/{row.get('rootFileId')!r}; "
                f"expected the reviewed unresolved-admission route {expected_id}."
            )
        result[design_id] = ("official", f"parts/{design_id}.dat")
    if set(result) != set(PILOT_DESIGN_IDS):
        raise ValueError(f"Source audit pilot routes are {sorted(result)}; expected {list(PILOT_DESIGN_IDS)}.")
    return result


def _is_reparse(info: os.stat_result) -> bool:
    return bool(getattr(info, "st_file_attributes", 0) & 0x400)


def _absolute(path: Path) -> Path:
    return Path(os.path.abspath(os.fspath(path)))


def _path_chain(path: Path) -> list[tuple[Path, tuple[int, int, int, int]]]:
    absolute = _absolute(path)
    current = Path(absolute.anchor)
    result: list[tuple[Path, tuple[int, int, int, int]]] = []
    for part in absolute.parts[1:]:
        current /= part
        info = os.lstat(current)
        if stat.S_ISLNK(info.st_mode) or _is_reparse(info):
            raise ValueError(f"Pilot output path {current} is a symlink or reparse point.")
        identity_size = info.st_size if stat.S_ISREG(info.st_mode) else 0
        result.append((current, (info.st_dev, info.st_ino, info.st_mode, identity_size)))
    return result


def _assert_path_chain(
    rows: list[tuple[Path, tuple[int, int, int, int]]], label: str
) -> None:
    for path, expected in rows:
        info = os.lstat(path)
        identity_size = info.st_size if stat.S_ISREG(info.st_mode) else 0
        actual = (info.st_dev, info.st_ino, info.st_mode, identity_size)
        if stat.S_ISLNK(info.st_mode) or _is_reparse(info) or actual != expected:
            raise ValueError(f"{label} changed identity at {path}; refusing publication.")


def write_report(path: Path, report: dict[str, object]) -> str:
    if os.name != "nt":
        raise RuntimeError(
            "The source-pilot report writer currently requires Windows handle-relative "
            "publication; do not replace it with a pathname fallback."
        )
    output_boundary = _absolute(Path(__file__).resolve().parents[1] / "output")
    requested = _absolute(path)
    if not requested.is_relative_to(output_boundary) or requested == output_boundary:
        raise ValueError(
            f"Pilot report must stay below {output_boundary}; received {requested}."
        )
    boundary_rows = _path_chain(output_boundary)
    parent_rows = _path_chain(requested.parent)
    if not parent_rows or not stat.S_ISDIR(parent_rows[-1][1][2]):
        raise ValueError(
            f"Pilot report parent must be an existing non-reparse directory: {requested.parent}."
        )
    if requested.exists() or requested.is_symlink():
        target_info = os.lstat(requested)
        if not stat.S_ISREG(target_info.st_mode) or _is_reparse(target_info):
            raise ValueError(f"Pilot report target must be a regular non-reparse file: {requested}")
    payload = canonical_bytes(report) + b"\n"

    def verify() -> None:
        _assert_path_chain(boundary_rows, "Pilot output boundary")
        _assert_path_chain(parent_rows, "Pilot output parent")

    verify()
    atomic_write_relative_windows(
        requested.parent,
        requested.name,
        payload,
        verify,
        (parent_rows[-1][1][0], parent_rows[-1][1][1]),
    )
    return sha256_hex(payload)


def fractional_bound(row: dict[str, object]) -> bool:
    ldraw = row["ldraw"]
    if not isinstance(ldraw, dict):
        raise TypeError("Internal pilot row lost its LDraw measurement object.")
    measured = ldraw["boundsLdu"]
    if not isinstance(measured, dict):
        raise TypeError("Internal pilot row lost its LDraw bounds object.")
    return any(
        not float(coordinate).is_integer()
        for side in ("min", "max")
        for coordinate in measured[side]
    )


def frame_count(row: dict[str, object], section: str, frame: str) -> int:
    native = row["builderNative"]
    if not isinstance(native, dict):
        return 0
    summary = native[section]
    if not isinstance(summary, dict):
        raise TypeError(f"Internal pilot native {section} summary is not an object.")
    frames = summary["frames"]
    if not isinstance(frames, dict):
        raise TypeError(f"Internal pilot native {section} frame summary is not an object.")
    value = frames.get(frame, 0)
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"Internal pilot native {section} frame count is not an integer.")
    return value


def main() -> None:
    repository = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Measure the fixed eight-part 6651557 source pilot without admitting catalog truth.")
    parser.add_argument("--official", type=Path, required=True)
    parser.add_argument("--unofficial", type=Path, required=True)
    parser.add_argument("--native-pack", type=Path, required=True)
    parser.add_argument(
        "--source-audit",
        type=Path,
        default=repository / "packages/catalog/src/quarantine/set-6651557-ldraw-source-audit.generated.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repository / "output/real-build/set-6651557-source-pilot.json",
    )
    arguments = parser.parse_args()

    source_audit = strict_json(
        read_pinned_file(arguments.source_audit, SOURCE_AUDIT_BYTES, SOURCE_AUDIT_SHA256),
        "set 6651557 source audit",
    )
    roots = audited_roots(source_audit)
    audited_files = audited_file_table(source_audit)
    stud_sources: set[tuple[str, str, str]] = set()
    for path in VISIBLE_STUD_PRIMITIVES:
        audited = audited_files.get(("official", path))
        if audited is None:
            raise ValueError(f"Visible-stud policy source official:{path} is absent from the audit.")
        digest = audited[0]["sha256"]
        if not isinstance(digest, str):
            raise TypeError(f"Visible-stud policy source official:{path} lost its digest.")
        stud_sources.add(("official", path, digest))
    native_pack = strict_json(
        read_pinned_file(arguments.native_pack, NATIVE_PACK_BYTES, NATIVE_PACK_SHA256),
        "set 6651557 Builder native pack",
    )
    native_by_id, native_binary, native_header = validate_native_pack(native_pack)

    archive_paths = {"official": arguments.official, "unofficial": arguments.unofficial}
    archives = [VerifiedArchive(archive_paths[pin.archive_id], pin) for pin in ARCHIVE_PINS]
    library = LDrawSourceLibrary(archives)
    try:
        library.verify_unchanged()
        parts: list[dict[str, object]] = []
        for design_id in PILOT_DESIGN_IDS:
            native_record = native_by_id.get(design_id)
            native = (
                native_measurement(
                    native_binary,
                    native_record,
                    NATIVE_RECORD_SHA256[design_id],
                    NATIVE_REVIEW_RECORD_SHA256[design_id],
                )
                if native_record is not None
                and design_id in NATIVE_RECORD_SHA256
                and design_id in NATIVE_REVIEW_RECORD_SHA256
                else None
            )
            parts.append(
                {
                    "designId": design_id,
                    "ldraw": ldraw_measurement(
                        library,
                        design_id,
                        roots[design_id],
                        audited_files,
                        frozenset(stud_sources),
                    ),
                    "builderNative": native,
                    "builderNativeState": (
                        "checksum-pinned-record-measured"
                        if native is not None
                        else "unavailable-bundle-integrity-mismatch"
                    ),
                }
            )
        library.verify_unchanged()
    finally:
        library.close()

    report: dict[str, object] = {
        "schemaVersion": "lego.set-6651557-source-pilot/1",
        "authority": {
            "state": "measurement-only-not-catalog-admitted",
            "partDefinitionsEmitted": False,
            "framesClaimed": False,
            "connectorTruthClaimed": False,
            "collisionTruthClaimed": False,
            "runtimeExposed": False,
        },
        "inputs": {
            "sourceAudit": {"bytes": SOURCE_AUDIT_BYTES, "sha256": f"sha256:{SOURCE_AUDIT_SHA256}"},
            "officialArchive": {
                "bytes": ARCHIVE_PINS[0].byte_length,
                "sha256": f"sha256:{ARCHIVE_PINS[0].sha256}",
            },
            "unofficialArchive": {
                "bytes": ARCHIVE_PINS[1].byte_length,
                "sha256": f"sha256:{ARCHIVE_PINS[1].sha256}",
            },
            "builderNativePack": {
                "bytes": NATIVE_PACK_BYTES,
                "sha256": f"sha256:{NATIVE_PACK_SHA256}",
                "header": native_header,
            },
        },
        "visibleStudPrimitivePolicy": sorted(VISIBLE_STUD_PRIMITIVES),
        "coverage": {
            "pilotParts": len(PILOT_DESIGN_IDS),
            "ldrawSurfaces": len(parts),
            "builderNativeSurfaces": sum(row["builderNative"] is not None for row in parts),
        },
        "contractPressure": {
            "fractionalLdrawBounds": [row["designId"] for row in parts if fractional_bound(row)],
            "missingChecksumPinnedBuilderNativeSurface": [
                row["designId"] for row in parts if row["builderNative"] is None
            ],
            "nonUprightBuilderConnectivity": [
                row["designId"]
                for row in parts
                if frame_count(row, "connectivity", "axis-aligned-non-upright")
                or frame_count(row, "connectivity", "oriented")
            ],
            "nonAxisAlignedBuilderCollision": [
                row["designId"]
                for row in parts
                if frame_count(row, "collision", "axis-aligned-non-upright")
                or frame_count(row, "collision", "oriented")
            ],
        },
        "parts": parts,
    }
    digest = write_report(arguments.output, report)
    print(f"wrote {arguments.output.resolve(strict=True)}")
    print(f"sha256:{digest}")


if __name__ == "__main__":
    main()
