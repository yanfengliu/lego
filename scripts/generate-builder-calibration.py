"""Build the exact Builder Shell and expanded LDraw geometry bundle the real build reads.

One output: `output/real-build/builder-shell-geometry.bin`, the concatenation of
every design's decoded Builder Shell triangles followed by every design's
expanded LDraw triangles, at the byte offsets `builder_calibration_sources.py`
pins. It is the *geometry* half of the calibration and nothing else; the frames
themselves are derived in `apps/web/e2e/real-build-builder-calibration.ts` from
these bytes and the reviewed source pins, so there is exactly one implementation
of the frame rule rather than two that have to agree.

Every run re-expands the pinned archives, re-encodes the reviewed Shell reports,
and refuses to write anything unless each slice reproduces its reviewed digest
and the whole bundle reproduces its reviewed length and SHA-256.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
import stat
import struct
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterable

from builder_calibration_sources import (
    DESIGNS,
    GEOMETRY_BUNDLE_BYTES,
    GEOMETRY_BUNDLE_SHA256,
    LDRAW_CLOSURE_DIGEST,
    LDRAW_CLOSURE_FILES,
)


OFFICIAL_MODEL_DIGEST = "c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922"
MANIFEST_DIGEST = "3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6"
CACHE_REPORT_DIGEST = "bf853ffadc349f43f13cf24c2f790a9bc556103c1c96fb24ad064aa502e475d8"
AUDIT_REPORT_DIGEST = "ab85e95fa94267b19dd16a160d270e48bf752926697c893db01b0597e7a8f4c4"
LDRAW_OFFICIAL_DIGEST = "6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae"
LDRAW_UNOFFICIAL_DIGEST = "09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4"
EXPECTED_GEOMETRY_DIGEST = GEOMETRY_BUNDLE_SHA256

MAX_LDRAW_ZIP_ENTRIES = 100_000
MAX_LDRAW_ZIP_CENTRAL_DIRECTORY_BYTES = 64 * 1024 * 1024
MAX_LDRAW_ZIP_ENTRY_BYTES = 8 * 1024 * 1024
MAX_LDRAW_ZIP_TOTAL_BYTES = 1_000_000_000
MAX_LDRAW_ZIP_FILENAME_BYTES = 512
MAX_LDRAW_ZIP_COMPRESSION_RATIO = 250
LDRAW_ZIP_REMEDIATION = (
    "Use the reviewed pinned official/unofficial LDraw archive or remove non-library payloads; "
    "do not raise a bound to admit an unreviewed archive."
)
ZIP_EOCD_SIGNATURE = b"PK\x05\x06"
ZIP64_EOCD_SIGNATURE = b"PK\x06\x06"
ZIP64_LOCATOR_SIGNATURE = b"PK\x06\x07"
ZIP_CENTRAL_DIRECTORY_SIGNATURE = b"PK\x01\x02"

LDRAW_CLOSURE_LICENSE = "Licensed under CC BY 4.0 : see CAreadme.txt"
LDRAW_CLOSURE_MANIFEST = {
    "schemaVersion": "lego.builder-ldraw-closure/2",
    "archiveSha256": f"sha256:{LDRAW_OFFICIAL_DIGEST}",
    "roots": sorted(f"{design['designId']}.dat" for design in DESIGNS),
    "files": [list(record) for record in LDRAW_CLOSURE_FILES],
}


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def canonical_json(value: object) -> bytes:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode(
        "utf-8"
    )


def bounded_bytes(path: Path, maximum: int, label: str) -> bytes:
    resolved = path.resolve(strict=True)
    with resolved.open("rb") as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode):
            raise ValueError(
                f"{label} {resolved} is not a regular file. Copy the exact reviewed source "
                "to a stable local file before calibration."
            )
        if before.st_size > maximum:
            raise ValueError(
                f"{label} has {before.st_size} bytes; limit is {maximum}. Use the exact pinned "
                "source or a smaller reviewed input; do not raise the limit for unreviewed data."
            )
        payload = stream.read(maximum + 1)
        after = os.fstat(stream.fileno())
    if len(payload) > maximum or len(payload) != before.st_size or after.st_size != before.st_size:
        raise ValueError(
            f"{label} changed while the same open handle was being captured or exceeded its "
            f"{maximum}-byte limit. Retry from a stable local copy; the captured bytes were "
            "discarded."
        )
    return payload


def verified_bytes(path: Path, expected: str, label: str, maximum: int) -> bytes:
    payload = bounded_bytes(path, maximum, label)
    actual = sha256(payload)
    if actual != expected:
        raise ValueError(
            f"{label} SHA-256 differs: {actual} != {expected}. Use the exact reviewed source; "
            "changing the expected digest does not authorize replacement bytes."
        )
    return payload


def write_atomic(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


def transform_point(
    matrix: tuple[float, ...], translation: tuple[float, ...], point: tuple[float, ...]
):
    return tuple(
        translation[row] + sum(matrix[row * 3 + column] * point[column] for column in range(3))
        for row in range(3)
    )


def preflight_zip_directory(payload: bytes, label: str) -> None:
    """Bounds central-directory allocation before ZipFile materializes ZipInfo rows."""
    minimum_eocd_size = 22
    search_start = max(0, len(payload) - (65_535 + minimum_eocd_size))
    cursor = len(payload)
    eocd_offset = -1
    eocd: tuple[object, ...] | None = None
    while cursor > search_start:
        candidate = payload.rfind(ZIP_EOCD_SIGNATURE, search_start, cursor)
        if candidate < 0:
            break
        if candidate + minimum_eocd_size <= len(payload):
            parsed = struct.unpack_from("<4s4H2LH", payload, candidate)
            comment_length = parsed[7]
            if candidate + minimum_eocd_size + comment_length == len(payload):
                eocd_offset = candidate
                eocd = parsed
                break
        cursor = candidate
    if eocd is None:
        raise ValueError(
            f"{label} has no terminal ZIP end-of-central-directory record within the bounded "
            f"65,535-byte comment window. {LDRAW_ZIP_REMEDIATION}"
        )

    disk_number = int(eocd[1])
    central_disk = int(eocd[2])
    entries_on_disk = int(eocd[3])
    entry_count = int(eocd[4])
    central_size = int(eocd[5])
    central_offset = int(eocd[6])
    directory_end_limit = eocd_offset
    zip64 = (
        entries_on_disk == 0xFFFF
        or entry_count == 0xFFFF
        or central_size == 0xFFFFFFFF
        or central_offset == 0xFFFFFFFF
    )
    if zip64:
        locator_offset = eocd_offset - 20
        if locator_offset < 0:
            raise ValueError(
                f"{label} advertises ZIP64 metadata but has no ZIP64 locator before the "
                f"end record. {LDRAW_ZIP_REMEDIATION}"
            )
        locator = struct.unpack_from("<4sLQL", payload, locator_offset)
        if locator[0] != ZIP64_LOCATOR_SIGNATURE or locator[1] != 0 or locator[3] != 1:
            raise ValueError(
                f"{label} has missing or multi-disk ZIP64 locator metadata. Split archives and "
                f"multi-disk sources are unsupported. {LDRAW_ZIP_REMEDIATION}"
            )
        zip64_offset = int(locator[2])
        if zip64_offset < 0 or zip64_offset + 56 > locator_offset:
            raise ValueError(
                f"{label} ZIP64 end record offset {zip64_offset} is outside the captured bytes. "
                f"{LDRAW_ZIP_REMEDIATION}"
            )
        zip64_eocd = struct.unpack_from("<4sQ2H2L4Q", payload, zip64_offset)
        zip64_record_size = int(zip64_eocd[1])
        if (
            zip64_eocd[0] != ZIP64_EOCD_SIGNATURE
            or zip64_record_size < 44
            or zip64_offset + 12 + zip64_record_size > locator_offset
            or zip64_eocd[4] != 0
            or zip64_eocd[5] != 0
            or zip64_eocd[6] != zip64_eocd[7]
        ):
            raise ValueError(
                f"{label} has malformed, inconsistent, or multi-disk ZIP64 end metadata. "
                f"{LDRAW_ZIP_REMEDIATION}"
            )
        disk_number = int(zip64_eocd[4])
        central_disk = int(zip64_eocd[5])
        entries_on_disk = int(zip64_eocd[6])
        entry_count = int(zip64_eocd[7])
        central_size = int(zip64_eocd[8])
        central_offset = int(zip64_eocd[9])
        directory_end_limit = zip64_offset
    if disk_number != 0 or central_disk != 0 or entries_on_disk != entry_count:
        raise ValueError(
            f"{label} is a split or multi-disk ZIP ({entries_on_disk}/{entry_count} entries on "
            f"disk {disk_number}/{central_disk}); only one complete archive is allowed. "
            f"{LDRAW_ZIP_REMEDIATION}"
        )
    if entry_count > MAX_LDRAW_ZIP_ENTRIES:
        raise ValueError(
            f"{label} declares {entry_count} ZIP entries; limit is {MAX_LDRAW_ZIP_ENTRIES}. "
            f"The count is rejected before ZipInfo allocation. {LDRAW_ZIP_REMEDIATION}"
        )
    if central_size > MAX_LDRAW_ZIP_CENTRAL_DIRECTORY_BYTES:
        raise ValueError(
            f"{label} central directory is {central_size} bytes; limit is "
            f"{MAX_LDRAW_ZIP_CENTRAL_DIRECTORY_BYTES}. {LDRAW_ZIP_REMEDIATION}"
        )
    if entry_count > 0 and central_size < entry_count * 46:
        raise ValueError(
            f"{label} central directory declares {entry_count} entries in only {central_size} "
            f"bytes; at least {entry_count * 46} bytes are required. "
            f"{LDRAW_ZIP_REMEDIATION}"
        )
    if central_offset < 0 or central_size < 0 or central_offset + central_size > directory_end_limit:
        raise ValueError(
            f"{label} central directory range {central_offset}+{central_size} exceeds its "
            f"captured end boundary {directory_end_limit}. {LDRAW_ZIP_REMEDIATION}"
        )
    directory_end = central_offset + central_size
    if directory_end != directory_end_limit:
        raise ValueError(
            f"{label} central directory ends at byte {directory_end}, but its end record begins "
            f"at byte {directory_end_limit}. Trailing or prepended archive records are not "
            f"accepted. {LDRAW_ZIP_REMEDIATION}"
        )

    actual_entry_count = 0
    cursor = central_offset
    while cursor < directory_end:
        if cursor + 46 > directory_end:
            raise ValueError(
                f"{label} central-directory row {actual_entry_count + 1} has fewer than the "
                f"required 46 header bytes at offset {cursor}. {LDRAW_ZIP_REMEDIATION}"
            )
        if payload[cursor : cursor + 4] != ZIP_CENTRAL_DIRECTORY_SIGNATURE:
            raise ValueError(
                f"{label} central-directory row {actual_entry_count + 1} at offset {cursor} "
                f"does not start with a file-header signature. {LDRAW_ZIP_REMEDIATION}"
            )
        filename_size, extra_size, comment_size = struct.unpack_from(
            "<3H", payload, cursor + 28
        )
        row_size = 46 + filename_size + extra_size + comment_size
        if cursor + row_size > directory_end:
            raise ValueError(
                f"{label} central-directory row {actual_entry_count + 1} declares {row_size} "
                f"bytes at offset {cursor}, beyond directory end {directory_end}. "
                f"{LDRAW_ZIP_REMEDIATION}"
            )
        actual_entry_count += 1
        if actual_entry_count > MAX_LDRAW_ZIP_ENTRIES:
            raise ValueError(
                f"{label} contains more than {MAX_LDRAW_ZIP_ENTRIES} central-directory rows; "
                f"the raw count is rejected before ZipInfo allocation. {LDRAW_ZIP_REMEDIATION}"
            )
        cursor += row_size
    if actual_entry_count != entry_count:
        raise ValueError(
            f"{label} end metadata declares {entry_count} ZIP entries, but the bounded raw "
            f"central directory contains {actual_entry_count}; rejected before ZipInfo "
            f"allocation. {LDRAW_ZIP_REMEDIATION}"
        )


class LDrawLibrary:
    def __init__(
        self,
        sources: list[tuple[str, bytes]],
        closure_files: tuple[tuple[str, str, str, str], ...] | None = None,
    ) -> None:
        self.buffers: list[io.BytesIO] = []
        self.archives: list[zipfile.ZipFile] = []
        self.maps: list[dict[str, zipfile.ZipInfo]] = []
        self.labels: list[str] = []
        try:
            for label, payload in sources:
                preflight_zip_directory(payload, label)
                buffer = io.BytesIO(payload)
                self.buffers.append(buffer)
                try:
                    archive = zipfile.ZipFile(buffer, mode="r", allowZip64=True)
                except (zipfile.BadZipFile, zipfile.LargeZipFile) as error:
                    raise ValueError(
                        f"{label} is not a readable bounded ZIP archive: {error}. "
                        f"{LDRAW_ZIP_REMEDIATION}"
                    ) from error
                self.archives.append(archive)
                self.labels.append(label)
                infos = archive.infolist()
                if len(infos) > MAX_LDRAW_ZIP_ENTRIES:
                    raise ValueError(
                        f"{label} contains {len(infos)} ZIP entries; limit is "
                        f"{MAX_LDRAW_ZIP_ENTRIES}. {LDRAW_ZIP_REMEDIATION}"
                    )
                mapping: dict[str, zipfile.ZipInfo] = {}
                aggregate_size = 0
                for info in infos:
                    encoded_name_size = len(info.filename.encode("utf-8", "surrogatepass"))
                    if encoded_name_size > MAX_LDRAW_ZIP_FILENAME_BYTES:
                        raise ValueError(
                            f"{label} ZIP entry name is {encoded_name_size} bytes; limit is "
                            f"{MAX_LDRAW_ZIP_FILENAME_BYTES}: {info.filename!r}. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    normalized_name = info.filename.replace("\\", "/")
                    normalized_path = PurePosixPath(normalized_name)
                    if (
                        normalized_path.is_absolute()
                        or ".." in normalized_path.parts
                        or ":" in normalized_name
                    ):
                        raise ValueError(
                            f"{label} contains unsafe ZIP entry path {info.filename!r}. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    unix_mode = info.external_attr >> 16
                    if unix_mode != 0 and stat.S_ISLNK(unix_mode):
                        raise ValueError(
                            f"{label} contains symbolic-link ZIP entry {info.filename!r}. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    if info.is_dir():
                        continue
                    if info.flag_bits & 0x1:
                        raise ValueError(
                            f"{label} contains encrypted ZIP entry {info.filename!r}; encrypted "
                            f"library members are unsupported. {LDRAW_ZIP_REMEDIATION}"
                        )
                    if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                        raise ValueError(
                            f"{label} ZIP entry {info.filename!r} uses unsupported compression "
                            f"method {info.compress_type}; only stored or deflated members are "
                            f"allowed. {LDRAW_ZIP_REMEDIATION}"
                        )
                    if info.file_size < 0 or info.compress_size < 0:
                        raise ValueError(
                            f"{label} ZIP entry {info.filename!r} has negative size metadata. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    if info.file_size > MAX_LDRAW_ZIP_ENTRY_BYTES:
                        raise ValueError(
                            f"{label} ZIP entry {info.filename!r} expands to {info.file_size} "
                            f"bytes; per-entry limit is {MAX_LDRAW_ZIP_ENTRY_BYTES}. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    if info.file_size > 0 and info.compress_size == 0:
                        raise ValueError(
                            f"{label} ZIP entry {info.filename!r} declares {info.file_size} "
                            f"expanded bytes from zero compressed bytes. {LDRAW_ZIP_REMEDIATION}"
                        )
                    compression_ratio = info.file_size / max(1, info.compress_size)
                    if compression_ratio > MAX_LDRAW_ZIP_COMPRESSION_RATIO:
                        raise ValueError(
                            f"{label} ZIP entry {info.filename!r} has compression ratio "
                            f"{compression_ratio:.2f}; limit is "
                            f"{MAX_LDRAW_ZIP_COMPRESSION_RATIO}. {LDRAW_ZIP_REMEDIATION}"
                        )
                    aggregate_size += info.file_size
                    if aggregate_size > MAX_LDRAW_ZIP_TOTAL_BYTES:
                        raise ValueError(
                            f"{label} expands to more than {MAX_LDRAW_ZIP_TOTAL_BYTES} bytes in "
                            f"aggregate (limit crossed at {info.filename!r}). "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    normalized = normalized_name.removeprefix("ldraw/").lower()
                    if normalized in mapping:
                        raise ValueError(
                            f"{label} repeats case-normalized entry {normalized!r} at "
                            f"{mapping[normalized].filename!r} and {info.filename!r}. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    mapping[normalized] = info
                self.maps.append(mapping)
        except BaseException:
            self.close()
            raise
        self.closure_by_path = (
            {record[0]: record for record in closure_files} if closure_files is not None else None
        )
        self.cache: dict[str, list[tuple[tuple[float, ...], ...]]] = {}
        self.used_closure_files: set[str] = set()

    def close(self) -> None:
        for archive in self.archives:
            archive.close()
        for buffer in self.buffers:
            buffer.close()

    @staticmethod
    def candidates(reference: str) -> list[str]:
        normalized = reference.replace("\\", "/").lower()
        path = PurePosixPath(normalized)
        if path.is_absolute() or ".." in path.parts or ":" in normalized:
            raise ValueError(f"Unsafe LDraw reference {reference!r}")
        if normalized.startswith("s/"):
            candidates = [f"parts/{normalized}", normalized]
        elif normalized.startswith(("8/", "48/")):
            candidates = [f"p/{normalized}", normalized]
        else:
            candidates = [f"parts/{normalized}", f"p/{normalized}", normalized]
        return list(dict.fromkeys(candidates))

    def read(self, reference: str) -> tuple[str, str]:
        for index, (archive, mapping) in enumerate(zip(self.archives, self.maps, strict=True)):
            for candidate in self.candidates(reference):
                stored = mapping.get(candidate)
                if stored is not None:
                    try:
                        with archive.open(stored, mode="r") as stream:
                            payload = stream.read(stored.file_size + 1)
                    except (OSError, RuntimeError, zipfile.BadZipFile) as error:
                        raise ValueError(
                            f"{self.labels[index]} ZIP entry {stored.filename!r} failed bounded "
                            f"read/CRC verification: {error}. Re-acquire the exact pinned archive."
                        ) from error
                    if len(payload) != stored.file_size:
                        raise ValueError(
                            f"{self.labels[index]} ZIP entry {stored.filename!r} yielded "
                            f"{len(payload)} bytes; central-directory size is {stored.file_size}. "
                            "Re-acquire the exact pinned archive; truncated or overlong members "
                            "are rejected."
                        )
                    try:
                        text = payload.decode("utf-8")
                    except UnicodeDecodeError as error:
                        raise ValueError(
                            f"{self.labels[index]} ZIP entry {stored.filename!r} is not UTF-8 at "
                            f"byte {error.start}. Re-acquire a standards-conforming pinned LDraw "
                            "archive; replacement decoding would change source text."
                        ) from error
                    expected = (
                        self.closure_by_path.get(candidate)
                        if self.closure_by_path is not None
                        else None
                    )
                    if self.closure_by_path is not None and (index != 0 or expected is None):
                        raise ValueError(
                            f"LDraw closure reached unpinned file {candidate!r} in "
                            f"{self.labels[index]}. Only the metadata-pinned official closure of "
                            f"the {len(LDRAW_CLOSURE_FILES)} reviewed files may contribute calibration "
                            "geometry; review and pin any source-graph change before rerunning."
                        )
                    if expected is not None:
                        (
                            _,
                            expected_sha256,
                            expected_author,
                            expected_organization,
                            expected_license,
                        ) = expected
                        actual_sha256 = sha256(payload)
                        if actual_sha256 != expected_sha256:
                            raise ValueError(
                                f"LDraw closure file {candidate!r} SHA-256 is {actual_sha256}; "
                                f"expected {expected_sha256}. Re-acquire the exact pinned archive; "
                                "do not update the closure for replacement bytes."
                            )
                        required_headers = (
                            f"0 Author: {expected_author}",
                            f"0 !LICENSE {expected_license}",
                            f"0 !LDRAW_ORG {expected_organization}",
                        )
                        stripped_lines = [line.strip() for line in text.splitlines()]
                        for required_header in required_headers:
                            count = stripped_lines.count(required_header)
                            if count != 1:
                                raise ValueError(
                                    f"LDraw closure file {candidate!r} contains {count} exact "
                                    f"{required_header!r} headers; expected 1. Re-acquire the exact "
                                    "pinned archive and preserve file-level author/license/status "
                                    "provenance."
                                )
                        self.used_closure_files.add(candidate)
                    return f"zip:{index}:{candidate}", text
        raise FileNotFoundError(
            f"LDraw reference not found: {reference}. Verify the reviewed root identifier and "
            "both pinned archives; substitution is not allowed."
        )

    def assert_complete_closure(self) -> None:
        if self.closure_by_path is None:
            return
        expected = set(self.closure_by_path)
        if self.used_closure_files != expected:
            missing = sorted(expected - self.used_closure_files)
            unexpected = sorted(self.used_closure_files - expected)
            raise ValueError(
                f"LDraw transitive closure of the {len(LDRAW_CLOSURE_MANIFEST['roots'])} reviewed "
                f"roots differs from its metadata pin; missing={missing}, unexpected={unexpected}. "
                "Re-acquire the exact archives or review and pin the complete changed graph before "
                "generating evidence."
            )

    def triangles(self, reference: str, stack: tuple[str, ...] = ()):
        key, text = self.read(reference)
        if key in self.cache:
            return self.cache[key]
        if key in stack:
            raise ValueError(f"Recursive LDraw reference: {' -> '.join((*stack, key))}")
        if len(stack) >= 64:
            raise ValueError(f"LDraw recursion exceeds 64 at {reference}")
        result: list[tuple[tuple[float, ...], ...]] = []
        for line_number, raw in enumerate(text.splitlines(), 1):
            fields = raw.strip().split()
            if not fields:
                continue
            try:
                if fields[0] == "1" and len(fields) >= 15:
                    translation = tuple(map(float, fields[2:5]))
                    matrix = tuple(map(float, fields[5:14]))
                    child = self.triangles(" ".join(fields[14:]), (*stack, key))
                    result.extend(
                        tuple(transform_point(matrix, translation, point) for point in triangle)
                        for triangle in child
                    )
                elif fields[0] == "3" and len(fields) >= 11:
                    values = list(map(float, fields[2:11]))
                    result.append(tuple(tuple(values[index : index + 3]) for index in (0, 3, 6)))
                elif fields[0] == "4" and len(fields) >= 14:
                    values = list(map(float, fields[2:14]))
                    quad = [tuple(values[index : index + 3]) for index in (0, 3, 6, 9)]
                    result.extend(((quad[0], quad[1], quad[2]), (quad[0], quad[2], quad[3])))
            except ValueError as error:
                raise ValueError(f"Malformed LDraw numeric record {key}:{line_number}: {error}") from error
            if len(result) > 2_000_000:
                raise ValueError(f"Expanded LDraw triangle cap exceeded for {reference}")
        self.cache[key] = result
        return result


def encode_shell(report: dict[str, object], design: dict[str, object]) -> tuple[bytes, list[tuple[float, ...]]]:
    source = design
    expected_keys = {"schemaVersion", "bundleSha256", "shellPathId", "shellCanonicalSha256", "verticesLdu", "triangles"}
    if set(report) != expected_keys or report["schemaVersion"] != "lego.builder-shell-inspection/2":
        raise ValueError(f"{design['designRevision']} Shell inspection has unexpected keys or schema")
    for key in ("bundleSha256", "shellPathId", "shellCanonicalSha256"):
        if report[key] != source[key]:
            raise ValueError(f"{design['designRevision']} Shell inspection {key} differs from pin")
    vertices = [tuple(map(float, point)) for point in report["verticesLdu"]]
    triangles = [tuple(map(int, triangle)) for triangle in report["triangles"]]
    if len(vertices) != source["shellVertexCount"] or len(triangles) != source["shellTriangleCount"]:
        raise ValueError(f"{design['designRevision']} Shell inspection count differs from pin")
    payload = bytearray()
    flattened: list[tuple[float, ...]] = []
    for triangle in triangles:
        if len(triangle) != 3 or any(index < 0 or index >= len(vertices) for index in triangle):
            raise ValueError(f"{design['designRevision']} has an invalid triangle index")
        points = [vertices[index] for index in triangle]
        a, b, c = points
        ab = tuple(b[i] - a[i] for i in range(3))
        ac = tuple(c[i] - a[i] for i in range(3))
        cross = (ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0])
        if sum(value * value for value in cross) <= 1e-12:
            raise ValueError(f"{design['designRevision']} contains a degenerate Shell triangle")
        for point in points:
            if any(not math.isfinite(value) for value in point):
                raise ValueError(f"{design['designRevision']} contains a non-finite Shell vertex")
            encoded = struct.pack("<fff", point[0] * 0.04, -point[1] * 0.04, point[2] * 0.04)
            payload.extend(encoded)
            x, y, z = struct.unpack("<fff", encoded)
            flattened.append((x / 0.04, -y / 0.04, z / 0.04))
    reference = design["builderGeometry"]
    if len(payload) != reference["byteLength"] or f"sha256:{sha256(payload)}" != reference["digest"]:
        raise ValueError(f"{design['designRevision']} Builder triangle slice differs from reviewed pin")
    return bytes(payload), flattened


def encode_ldraw(triangles: Iterable[tuple[tuple[float, ...], ...]], design: dict[str, object]) -> bytes:
    payload = bytearray()
    count = 0
    for triangle in triangles:
        count += 1
        for point in triangle:
            if any(not math.isfinite(value) for value in point):
                raise ValueError(f"{design['designRevision']} expanded LDraw contains non-finite data")
            payload.extend(struct.pack("<fff", *point))
    reference = design["ldrawReferenceGeometry"]
    if count != reference["triangleCount"] or len(payload) != reference["byteLength"]:
        raise ValueError(f"{design['designRevision']} expanded LDraw count differs from reviewed pin")
    if f"sha256:{sha256(payload)}" != reference["digest"]:
        raise ValueError(f"{design['designRevision']} expanded LDraw slice differs from reviewed pin")
    return bytes(payload)


def point_segment_distance(point, start, end) -> float:
    direction = tuple(end[i] - start[i] for i in range(3))
    denominator = sum(value * value for value in direction)
    ratio = 0 if denominator <= 1e-24 else max(0.0, min(1.0, sum((point[i] - start[i]) * direction[i] for i in range(3)) / denominator))
    closest = tuple(start[i] + ratio * direction[i] for i in range(3))
    return math.dist(point, closest)


def point_triangle_distance(point, triangle) -> float:
    a, b, c = triangle
    ab = tuple(b[i] - a[i] for i in range(3)); ac = tuple(c[i] - a[i] for i in range(3)); ap = tuple(point[i] - a[i] for i in range(3))
    dot = lambda left, right: sum(left[i] * right[i] for i in range(3))
    d1, d2 = dot(ab, ap), dot(ac, ap)
    if d1 <= 0 and d2 <= 0: return math.dist(point, a)
    bp = tuple(point[i] - b[i] for i in range(3)); d3, d4 = dot(ab, bp), dot(ac, bp)
    if d3 >= 0 and d4 <= d3: return math.dist(point, b)
    vc = d1 * d4 - d3 * d2
    if vc <= 0 and d1 >= 0 and d3 <= 0:
        ratio = d1 / (d1 - d3); return math.dist(point, tuple(a[i] + ratio * ab[i] for i in range(3)))
    cp = tuple(point[i] - c[i] for i in range(3)); d5, d6 = dot(ab, cp), dot(ac, cp)
    if d6 >= 0 and d5 <= d6: return math.dist(point, c)
    vb = d5 * d2 - d1 * d6
    if vb <= 0 and d2 >= 0 and d6 <= 0:
        ratio = d2 / (d2 - d6); return math.dist(point, tuple(a[i] + ratio * ac[i] for i in range(3)))
    va = d3 * d6 - d5 * d4
    if va <= 0 and d4 - d3 >= 0 and d5 - d6 >= 0:
        ratio = (d4 - d3) / (d4 - d3 + d5 - d6); return math.dist(point, tuple(b[i] + ratio * (c[i] - b[i]) for i in range(3)))
    denominator = va + vb + vc
    if abs(denominator) <= 1e-24: return min(point_segment_distance(point, a, b), point_segment_distance(point, b, c), point_segment_distance(point, c, a))
    v, w = vb / denominator, vc / denominator
    return math.dist(point, tuple(a[i] + ab[i] * v + ac[i] * w for i in range(3)))


def validate_reports(cache: dict[str, object], audit: dict[str, object]) -> None:
    """Every reviewed design must be one verified bundle with one Shell of the pinned identity."""

    cache_by_id = {str(entry["id"]): entry for entry in cache["bundles"]}
    audit_by_id = {str(entry["id"]): entry for entry in audit["parts"]}
    for design in DESIGNS:
        design_id = str(design["designId"])
        cached, audited = cache_by_id.get(design_id), audit_by_id.get(design_id)
        if cached is None or audited is None or not cached["verified"]:
            raise ValueError(
                f"Source reports do not contain one verified {design_id}; the cache report "
                f"{'has no row' if cached is None else 'marks it unverified'} and the asset audit "
                f"{'has no row' if audited is None else 'has one'}."
            )
        if f"sha256:{cached['sha256']}" != design["bundleSha256"]:
            raise ValueError(
                f"Cache report bundle SHA-256 for {design_id} is sha256:{cached['sha256']}; the "
                f"reviewed pin is {design['bundleSha256']}."
            )
        shell = [mesh for mesh in audited["meshes"] if mesh["name"] == "Shell"]
        if (
            len(shell) != 1
            or str(shell[0]["pathId"]) != design["shellPathId"]
            or f"sha256:{shell[0]['canonicalSha256']}" != design["shellCanonicalSha256"]
        ):
            raise ValueError(
                f"Asset audit Shell identity for {design_id} is {len(shell)} mesh(es) at "
                f"{[str(mesh['pathId']) for mesh in shell]}; the reviewed pin is one Shell at "
                f"{design['shellPathId']} hashing {design['shellCanonicalSha256']}."
            )
        if f"sha256:{audited['primitiveXmlSha256']}" != design["primitiveXmlSha256"]:
            raise ValueError(
                f"Asset audit primitive XML for {design_id} hashes "
                f"sha256:{audited['primitiveXmlSha256']}; the reviewed pin is "
                f"{design['primitiveXmlSha256']}."
            )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the exact retained Builder Shell and LDraw geometry bundle."
    )
    parser.add_argument("--official-model", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--cache-report", type=Path, required=True)
    parser.add_argument("--asset-audit", type=Path, required=True)
    parser.add_argument("--ldraw-official", type=Path, required=True)
    parser.add_argument("--ldraw-unofficial", type=Path, required=True)
    parser.add_argument(
        "--shell-report",
        action="append",
        required=True,
        metavar="DESIGN;REVISION=PATH",
        help="One decoded Shell inspection per design, as emitted by extract-builder-shell.py.",
    )
    parser.add_argument("--out-geometry", type=Path, required=True)
    args = parser.parse_args()

    actual_closure_digest = sha256(canonical_json(LDRAW_CLOSURE_MANIFEST))
    if actual_closure_digest != LDRAW_CLOSURE_DIGEST:
        raise ValueError(
            f"Embedded LDraw closure manifest SHA-256 is {actual_closure_digest}; expected "
            f"{LDRAW_CLOSURE_DIGEST}. Restore the reviewed metadata pin before reading source "
            "archives."
        )

    reports: dict[str, Path] = {}
    for entry in args.shell_report:
        design_revision, _, raw_path = entry.partition("=")
        if not raw_path or design_revision in reports:
            raise ValueError(
                f"--shell-report {entry!r} must be DESIGN;REVISION=PATH and may name each design once."
            )
        reports[design_revision] = Path(raw_path)
    expected_designs = {str(design["designRevision"]) for design in DESIGNS}
    if set(reports) != expected_designs:
        missing = sorted(expected_designs - set(reports))
        extra = sorted(set(reports) - expected_designs)
        raise ValueError(
            f"Shell reports must cover exactly the {len(expected_designs)} reviewed designs; "
            f"missing={missing}, unexpected={extra}."
        )

    verified_bytes(args.official_model, OFFICIAL_MODEL_DIGEST, "Official model", 16 * 1024 * 1024)
    verified_bytes(args.manifest, MANIFEST_DIGEST, "Builder manifest", 1_000_000)
    cache = json.loads(
        verified_bytes(args.cache_report, CACHE_REPORT_DIGEST, "Builder cache report", 1_000_000)
    )
    audit = json.loads(
        verified_bytes(args.asset_audit, AUDIT_REPORT_DIGEST, "Builder asset audit", 4_000_000)
    )
    validate_reports(cache, audit)
    ldraw_official = verified_bytes(
        args.ldraw_official, LDRAW_OFFICIAL_DIGEST, "Official LDraw archive", 200_000_000
    )
    ldraw_unofficial = verified_bytes(
        args.ldraw_unofficial, LDRAW_UNOFFICIAL_DIGEST, "Unofficial LDraw archive", 120_000_000
    )

    builder_slices: list[bytes] = []
    for design in DESIGNS:
        report = json.loads(
            bounded_bytes(
                reports[str(design["designRevision"])],
                4_000_000,
                f"{design['designRevision']} Shell report",
            )
        )
        builder_slices.append(encode_shell(report, design)[0])
    library = LDrawLibrary(
        [
            ("Official LDraw archive", ldraw_official),
            ("Unofficial LDraw archive", ldraw_unofficial),
        ],
        LDRAW_CLOSURE_FILES,
    )
    try:
        ldraw_slices = [
            encode_ldraw(library.triangles(f"{design['designId']}.dat"), design)
            for design in DESIGNS
        ]
        library.assert_complete_closure()
    finally:
        library.close()
    geometry = b"".join((*builder_slices, *ldraw_slices))
    geometry_digest = sha256(geometry)
    if len(geometry) != GEOMETRY_BUNDLE_BYTES or geometry_digest != EXPECTED_GEOMETRY_DIGEST:
        raise ValueError(
            f"Combined geometry differs: {len(geometry)} bytes sha256:{geometry_digest}; expected "
            f"{GEOMETRY_BUNDLE_BYTES}/sha256:{EXPECTED_GEOMETRY_DIGEST}"
        )
    offset = 0
    for section in [design["builderGeometry"] for design in DESIGNS] + [
        design["ldrawReferenceGeometry"] for design in DESIGNS
    ]:
        if section["byteOffset"] != offset:  # type: ignore[index]
            raise ValueError(
                f"Reviewed slice layout has a gap or reorder at byte {offset}; the pin says "
                f"{section['byteOffset']}."  # type: ignore[index]
            )
        offset += int(section["byteLength"])  # type: ignore[index,arg-type]
    if offset != len(geometry):
        raise ValueError(f"Reviewed slices cover {offset} bytes, not the {len(geometry)} written.")
    write_atomic(args.out_geometry.resolve(), geometry)
    print(
        json.dumps(
            {
                "geometry": str(args.out_geometry.resolve()),
                "geometryBytes": len(geometry),
                "geometrySha256": geometry_digest,
                "closureFiles": len(LDRAW_CLOSURE_FILES),
                "designs": [design["designRevision"] for design in DESIGNS],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
