from __future__ import annotations

import hashlib
import json
import math
import os
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable


MAX_LDRAW_FILE_BYTES = 2 * 1024 * 1024
MAX_CLOSURE_FILES = 4_096
MAX_CLOSURE_BYTES = 64 * 1024 * 1024
MAX_RECURSION_DEPTH = 64
MAX_REFERENCES_PER_FILE = 8_192
MAX_CLOSURE_REFERENCES = 65_536
MAX_COMPRESSION_RATIO = 2_000


def canonical_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )


def sha256_prefixed(data: bytes) -> str:
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


class _PinnedBytesStream:
    """Seekable read-only view over one digest-verified immutable byte snapshot."""

    def __init__(self, data: bytes) -> None:
        self._data = data
        self._position = 0
        self.closed = False

    def read(self, size: int = -1) -> bytes:
        if self.closed:
            raise ValueError("I/O operation on closed pinned-byte stream")
        if size is None or size < 0:
            end = len(self._data)
        else:
            end = min(len(self._data), self._position + size)
        result = self._data[self._position : end]
        self._position = end
        return result

    def seek(self, offset: int, whence: int = os.SEEK_SET) -> int:
        if self.closed:
            raise ValueError("I/O operation on closed pinned-byte stream")
        if whence == os.SEEK_SET:
            position = offset
        elif whence == os.SEEK_CUR:
            position = self._position + offset
        elif whence == os.SEEK_END:
            position = len(self._data) + offset
        else:
            raise ValueError(f"Unsupported seek mode {whence}")
        if position < 0:
            raise ValueError(f"Negative pinned-byte seek position {position}")
        self._position = position
        return position

    def tell(self) -> int:
        return self._position

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def close(self) -> None:
        self.closed = True
        self._position = 0
        self._data = b""


def normalize_archive_member(name: str) -> str:
    if not name or "\0" in name:
        raise ValueError(f"Unsafe empty or NUL-containing LDraw archive member {name!r}")
    slash_name = name.replace("\\", "/")
    raw_parts = slash_name.split("/")
    path = PurePosixPath(slash_name)
    if (
        path.is_absolute()
        or any(part in ("", ".", "..") for part in raw_parts)
        or ":" in slash_name
        or any(ord(character) < 0x20 or ord(character) > 0x7E for character in slash_name)
    ):
        raise ValueError(f"Unsafe LDraw archive member {name!r}")
    normalized = "/".join(path.parts).lower()
    if normalized.startswith("ldraw/"):
        normalized = normalized.removeprefix("ldraw/")
    if not normalized:
        raise ValueError(f"LDraw archive member {name!r} has no logical path")
    return normalized


@dataclass(frozen=True)
class SourceRecord:
    archive_id: str
    path: str
    byte_length: int
    sha256: str
    title: str
    declared_name: str
    author: str
    ldraw_org: str
    license_expression: str

    def manifest_record(self) -> dict[str, object]:
        return {
            "archiveId": self.archive_id,
            "path": self.path,
            "bytes": self.byte_length,
            "sha256": self.sha256,
            "title": self.title,
            "declaredName": self.declared_name,
            "author": self.author,
            "ldrawOrg": self.ldraw_org,
            "licenseExpression": self.license_expression,
        }


class VerifiedArchive:
    def __init__(self, path: Path, pin: object) -> None:
        self.archive_id = str(getattr(pin, "archive_id"))
        self.path = path.resolve(strict=True)
        self.expected_bytes = int(getattr(pin, "byte_length"))
        self.expected_sha256 = str(getattr(pin, "sha256"))
        if not self.path.is_file():
            raise FileNotFoundError(f"{self.archive_id} LDraw archive does not exist: {self.path}")
        with self.path.open("rb") as source:
            before = os.fstat(source.fileno())
            snapshot = source.read(self.expected_bytes + 1)
            after = os.fstat(source.fileno())
        identities = {
            (info.st_dev, info.st_ino, info.st_size) for info in (before, after)
        }
        if len(identities) != 1:
            raise ValueError(
                f"{self.archive_id} LDraw archive changed identity or size during its bounded snapshot"
            )
        actual_bytes = before.st_size
        if actual_bytes != self.expected_bytes or len(snapshot) != self.expected_bytes:
            raise ValueError(
                f"{self.archive_id} LDraw archive has {actual_bytes} bytes and yielded "
                f"{len(snapshot)}; expected exactly {self.expected_bytes}"
            )
        actual_sha256 = hashlib.sha256(snapshot).hexdigest()
        if actual_sha256 != self.expected_sha256:
            raise ValueError(
                f"{self.archive_id} LDraw archive sha256:{actual_sha256} differs from pinned "
                f"sha256:{self.expected_sha256}"
            )
        self._snapshot = snapshot
        self._stream = _PinnedBytesStream(snapshot)
        try:
            self.archive = zipfile.ZipFile(self._stream)
        except BaseException:
            self._stream.close()
            self._snapshot = b""
            raise
        infos = self.archive.infolist()
        maximum = int(getattr(pin, "max_entry_count"))
        expected_count = int(getattr(pin, "entry_count"))
        if len(infos) > maximum or len(infos) != expected_count:
            self.close()
            raise ValueError(
                f"{self.archive_id} LDraw archive has {len(infos)} entries; expected {expected_count} and at most {maximum}"
            )
        self.members: dict[str, zipfile.ZipInfo] = {}
        try:
            for info in infos:
                if info.is_dir():
                    continue
                key = normalize_archive_member(info.filename)
                if key in self.members:
                    raise ValueError(
                        f"{self.archive_id} LDraw archive repeats case-normalized entry {key}"
                    )
                self.members[key] = info
        except BaseException:
            self.close()
            raise

    def close(self) -> None:
        self.archive.close()
        self._stream.close()
        self._snapshot = b""

    def verify_unchanged(self) -> None:
        if len(self._snapshot) != self.expected_bytes:
            raise ValueError(f"{self.archive_id} immutable LDraw snapshot changed size during traversal")
        actual_sha256 = hashlib.sha256(self._snapshot).hexdigest()
        if actual_sha256 != self.expected_sha256:
            raise ValueError(
                f"{self.archive_id} immutable LDraw snapshot changed during traversal: "
                f"sha256:{actual_sha256} differs from pinned sha256:{self.expected_sha256}"
            )

    def contains(self, path: str) -> bool:
        return path.lower() in self.members

    def read(self, path: str) -> bytes:
        key = path.lower()
        info = self.members.get(key)
        if info is None:
            raise FileNotFoundError(f"{self.archive_id} LDraw archive has no {key}")
        if info.flag_bits & 1:
            raise ValueError(f"Encrypted LDraw source is forbidden: {self.archive_id}:{key}")
        if info.file_size <= 0 or info.file_size > MAX_LDRAW_FILE_BYTES:
            raise ValueError(
                f"{self.archive_id}:{key} declares {info.file_size} bytes; allowed range is 1..{MAX_LDRAW_FILE_BYTES}"
            )
        if info.compress_size <= 0 or info.file_size > info.compress_size * MAX_COMPRESSION_RATIO:
            raise ValueError(f"{self.archive_id}:{key} exceeds the compression-ratio boundary")
        with self.archive.open(info, "r") as stream:
            data = stream.read(MAX_LDRAW_FILE_BYTES + 1)
        if len(data) != info.file_size:
            raise ValueError(
                f"{self.archive_id}:{key} produced {len(data)} bytes; ZIP metadata declared {info.file_size}"
            )
        return data


def reference_candidates(reference: str) -> tuple[str, ...]:
    normalized = reference.replace("\\", "/").lower()
    raw_parts = normalized.split("/")
    path = PurePosixPath(normalized)
    if (
        not normalized
        or "\0" in normalized
        or path.is_absolute()
        or any(part in ("", ".", "..") for part in raw_parts)
        or ":" in normalized
        or any(ord(character) < 0x20 or ord(character) > 0x7E for character in normalized)
    ):
        raise ValueError(f"Unsafe LDraw reference {reference!r}")
    if normalized.startswith(("parts/", "p/")):
        candidates = [normalized]
    elif normalized.startswith("s/"):
        candidates = [f"parts/{normalized}", normalized]
    elif normalized.startswith(("8/", "48/")):
        candidates = [f"p/{normalized}", normalized]
    else:
        candidates = [f"parts/{normalized}", f"p/{normalized}", normalized]
    return tuple(dict.fromkeys(candidates))


def license_expression(line: str) -> str:
    known = {
        "0 !LICENSE Licensed under CC BY 4.0 : see CAreadme.txt": "CC-BY-4.0",
        "0 !LICENSE Licensed under CC BY 2.0 and CC BY 4.0 : see CAreadme.txt": (
            "CC-BY-2.0 OR CC-BY-4.0"
        ),
    }
    expression = known.get(line)
    if expression is None:
        raise ValueError(f"Unsupported LDraw license declaration {line!r}")
    return expression


def exactly_one(lines: list[str], prefix: str, source_key: str) -> str:
    matches = [line for line in lines if line.startswith(prefix)]
    if len(matches) != 1:
        raise ValueError(
            f"{source_key} needs exactly one {prefix.strip()} header; found {len(matches)}"
        )
    return matches[0]


class LDrawSourceLibrary:
    def __init__(self, archives: Iterable[VerifiedArchive]) -> None:
        self.archives = {archive.archive_id: archive for archive in archives}
        if set(self.archives) != {"official", "unofficial"}:
            raise ValueError("LDraw audit requires exactly official and unofficial archives")
        self.precedence = ("official", "unofficial")
        self._bytes: dict[tuple[str, str], bytes] = {}
        self._records: dict[tuple[str, str], SourceRecord] = {}
        self._dependencies: dict[tuple[str, str], tuple[tuple[str, str], ...]] = {}

    def close(self) -> None:
        for archive in self.archives.values():
            archive.close()

    def verify_unchanged(self) -> None:
        for archive in self.archives.values():
            archive.verify_unchanged()

    def exact(self, archive_id: str, path: str) -> tuple[str, str]:
        normalized = path.lower()
        archive = self.archives.get(archive_id)
        if archive is None or not archive.contains(normalized):
            raise FileNotFoundError(f"{archive_id} LDraw root is missing: {normalized}")
        return archive_id, normalized

    def resolve(self, reference: str, source_archive_id: str) -> tuple[str, str]:
        if source_archive_id == "official":
            archive_ids = ("official",)
        elif source_archive_id == "unofficial":
            archive_ids = ("unofficial", "official")
        else:
            raise ValueError(f"Unknown LDraw source archive {source_archive_id!r}")
        for archive_id in archive_ids:
            archive = self.archives[archive_id]
            for candidate in reference_candidates(reference):
                if archive.contains(candidate):
                    return archive_id, candidate
        raise FileNotFoundError(f"LDraw reference not found in pinned archives: {reference}")

    def text(self, key: tuple[str, str]) -> str:
        data = self._bytes.get(key)
        if data is None:
            data = self.archives[key[0]].read(key[1])
            self._bytes[key] = data
        try:
            return data.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise ValueError(f"{key[0]}:{key[1]} is not UTF-8 LDraw text") from error

    def record(self, key: tuple[str, str]) -> SourceRecord:
        cached = self._records.get(key)
        if cached is not None:
            return cached
        text = self.text(key)
        lines = text.splitlines()
        source_key = f"{key[0]}:{key[1]}"
        if not lines or not lines[0].startswith("0 "):
            raise ValueError(f"{source_key} needs a type-0 title on line 1")
        name_line = exactly_one(lines, "0 Name:", source_key)
        author_line = exactly_one(lines, "0 Author:", source_key)
        org_line = exactly_one(lines, "0 !LDRAW_ORG", source_key)
        license_line = exactly_one(lines, "0 !LICENSE", source_key)
        declared_name = name_line.removeprefix("0 Name:").strip().replace("\\", "/")
        logical_name = key[1].removeprefix("parts/").removeprefix("p/")
        if declared_name.lower() != logical_name:
            raise ValueError(
                f"{source_key} declares Name {declared_name!r}; expected {logical_name!r}"
            )
        data = self._bytes[key]
        record = SourceRecord(
            archive_id=key[0],
            path=key[1],
            byte_length=len(data),
            sha256=sha256_prefixed(data),
            title=lines[0].removeprefix("0 ").strip(),
            declared_name=declared_name,
            author=author_line.removeprefix("0 Author:").strip(),
            ldraw_org=org_line.removeprefix("0 !LDRAW_ORG").strip(),
            license_expression=license_expression(license_line),
        )
        self._records[key] = record
        return record

    def dependencies(self, key: tuple[str, str]) -> tuple[tuple[str, str], ...]:
        cached = self._dependencies.get(key)
        if cached is not None:
            return cached
        dependencies: list[tuple[str, str]] = []
        source_key = f"{key[0]}:{key[1]}"
        for line_number, raw_line in enumerate(self.text(key).splitlines(), 1):
            stripped = raw_line.strip()
            fields = stripped.split()
            if not fields or fields[0] != "1":
                continue
            reference_fields = stripped.split(maxsplit=14)
            if len(reference_fields) < 15:
                raise ValueError(f"Malformed LDraw type-1 record {source_key}:{line_number}")
            try:
                values = [float(value) for value in reference_fields[2:14]]
            except ValueError as error:
                raise ValueError(
                    f"Malformed LDraw transform {source_key}:{line_number}: {error}"
                ) from error
            if any(not math.isfinite(value) for value in values):
                raise ValueError(f"Non-finite LDraw transform {source_key}:{line_number}")
            dependencies.append(self.resolve(reference_fields[14], key[0]))
            if len(dependencies) > MAX_REFERENCES_PER_FILE:
                raise ValueError(
                    f"{source_key} exceeds {MAX_REFERENCES_PER_FILE} type-1 references"
                )
        result = tuple(dict.fromkeys(dependencies))
        self._dependencies[key] = result
        return result

    def closure(self, root: tuple[str, str]) -> list[SourceRecord]:
        visited: set[tuple[str, str]] = set()
        reference_count = 0

        def visit(key: tuple[str, str], stack: tuple[tuple[str, str], ...]) -> None:
            nonlocal reference_count
            if key in stack:
                chain = " -> ".join(f"{archive}:{path}" for archive, path in (*stack, key))
                raise ValueError(f"Recursive LDraw reference: {chain}")
            if key in visited:
                return
            if len(stack) >= MAX_RECURSION_DEPTH:
                raise ValueError(f"LDraw recursion exceeds {MAX_RECURSION_DEPTH} at {key}")
            self.record(key)
            visited.add(key)
            if len(visited) > MAX_CLOSURE_FILES:
                raise ValueError(f"LDraw closure exceeds {MAX_CLOSURE_FILES} files at {key}")
            dependencies = self.dependencies(key)
            reference_count += len(dependencies)
            if reference_count > MAX_CLOSURE_REFERENCES:
                raise ValueError(
                    f"LDraw closure exceeds {MAX_CLOSURE_REFERENCES} type-1 references at {key}"
                )
            for dependency in dependencies:
                visit(dependency, (*stack, key))

        visit(root, ())
        records = sorted((self.record(key) for key in visited), key=lambda row: (row.archive_id, row.path))
        total_bytes = sum(record.byte_length for record in records)
        if total_bytes > MAX_CLOSURE_BYTES:
            raise ValueError(f"LDraw closure has {total_bytes} bytes; limit is {MAX_CLOSURE_BYTES}")
        return records
