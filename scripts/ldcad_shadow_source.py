"""One pinned LDCad Shadow Library, read as hostile text under fixed bounds.

The shadow library is a parallel tree of `.dat` files that add connectivity
metadata to LDraw parts it does not own. LDCad appends a shadow file's content
to the identically named LDraw file while loading, so a snap meta inherits the
LDraw reference frame it is written against, and a whole anti-stud field
compresses to one `[grid=...]` clause.

This module reads that tree and nothing else. It does not compose transforms,
does not decide what a snap means, and admits nothing: every identity, bound and
refusal here exists so a later measurement can say which exact bytes it read.

Licence: the library is CC BY-SA 4.0 by Roland Melkert and the named
contributors in each file's `!HISTORY` lines. Reading it to compare numbers is
attribution-bound fact extraction; copying a shadow file, or shipping a
connector set derived from a substantial part of it, is a share-alike
obligation this repository has not taken on. Nothing here writes a shadow file
into the repository.
"""

from __future__ import annotations

import hashlib
import json
import os
import stat
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from ldcad_shadow_metas import ShadowMeta, parse_shadow_metas

SHADOW_LIBRARY_ID = "ldcad-shadow-library"
SHADOW_LIBRARY_SOURCE = "https://github.com/RolandMelkert/LDCadShadowLibrary"
SHADOW_LIBRARY_COMMIT = "15aa1e718b6a8da37d24fc7af5e52e262c041bfb"
SHADOW_LIBRARY_LICENSE = "CC-BY-SA-4.0"
SHADOW_LIBRARY_ATTRIBUTION = (
    "LDCad Shadow Library by Roland Melkert and its per-file !HISTORY contributors, CC BY-SA 4.0"
)
# The manifest is the sorted [lowercased path, bytes, sha256] table of every
# tracked file outside .git, hashed as canonical JSON. The repository's own
# .gitattributes pins `*.dat text eol=crlf` and `*.md text eol=lf`, so a fresh
# checkout of the pinned commit reproduces these bytes on any platform.
SHADOW_MANIFEST_SHA256 = "668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f"
SHADOW_FILE_COUNT = 4_257
SHADOW_TOTAL_BYTES = 1_768_204

MAX_SHADOW_FILE_BYTES = 64 * 1024
MAX_SHADOW_FILES = 8_192
MAX_SHADOW_TOTAL_BYTES = 16 * 1024 * 1024


@dataclass(frozen=True)
class ShadowFile:
    path: str
    byte_length: int
    sha256: str
    metas: tuple[ShadowMeta, ...]


def normalize_shadow_path(name: str) -> str:
    """One shadow-library relative path, or a refusal naming the unsafe input."""

    if not name or "\0" in name:
        raise ValueError(f"Unsafe empty or NUL-containing shadow path {name!r}")
    slashed = name.replace("\\", "/")
    parts = slashed.split("/")
    if (
        PurePosixPath(slashed).is_absolute()
        or any(part in ("", ".", "..") for part in parts)
        or ":" in slashed
        or any(ord(character) < 0x20 or ord(character) > 0x7E for character in slashed)
    ):
        raise ValueError(f"Unsafe shadow-library path {name!r}")
    return slashed.lower()


def shadow_candidates(reference: str) -> tuple[str, ...]:
    """Where a shadow reference could live, in LDraw's own search order."""

    normalized = normalize_shadow_path(reference)
    if normalized.startswith(("parts/", "p/")):
        candidates = [normalized]
    elif normalized.startswith("s/"):
        candidates = [f"parts/{normalized}", normalized]
    else:
        candidates = [f"parts/{normalized}", f"p/{normalized}", normalized]
    return tuple(dict.fromkeys(candidates))


class VerifiedShadowLibrary:
    """The pinned shadow tree, verified whole before a single meta is read."""

    def __init__(self, root: Path, *, expect_pin: bool = True) -> None:
        self.root = root.resolve(strict=True)
        if not self.root.is_dir():
            raise NotADirectoryError(f"Shadow library root is not a directory: {self.root}")
        rows: list[list[object]] = []
        payloads: dict[str, bytes] = {}
        total = 0
        for directory, subdirectories, filenames in os.walk(self.root):
            subdirectories[:] = sorted(name for name in subdirectories if name != ".git")
            for filename in sorted(filenames):
                full = Path(directory) / filename
                info = os.lstat(full)
                if stat.S_ISLNK(info.st_mode) or bool(
                    getattr(info, "st_file_attributes", 0) & 0x400
                ):
                    raise ValueError(f"Shadow library entry {full} is a symlink or reparse point.")
                if info.st_size > MAX_SHADOW_FILE_BYTES:
                    raise ValueError(
                        f"Shadow file {full} is {info.st_size} bytes; the bound is "
                        f"{MAX_SHADOW_FILE_BYTES}."
                    )
                relative = normalize_shadow_path(
                    str(full.relative_to(self.root)).replace(os.sep, "/")
                )
                data = full.read_bytes()
                total += len(data)
                if len(rows) >= MAX_SHADOW_FILES or total > MAX_SHADOW_TOTAL_BYTES:
                    raise ValueError(
                        f"Shadow library exceeds its bounds at {relative}: "
                        f"{len(rows) + 1} files, {total} bytes."
                    )
                rows.append([relative, len(data), hashlib.sha256(data).hexdigest()])
                payloads[relative] = data
        rows.sort()
        manifest = json.dumps(
            rows, ensure_ascii=False, separators=(",", ":"), sort_keys=True
        ).encode("utf-8")
        self.manifest_sha256 = hashlib.sha256(manifest).hexdigest()
        self.file_count = len(rows)
        self.total_bytes = total
        if expect_pin and (
            self.manifest_sha256 != SHADOW_MANIFEST_SHA256
            or self.file_count != SHADOW_FILE_COUNT
            or self.total_bytes != SHADOW_TOTAL_BYTES
        ):
            raise ValueError(
                f"Shadow library at {self.root} has {self.file_count} files, {self.total_bytes} "
                f"bytes, manifest sha256:{self.manifest_sha256}; the pinned checkout of commit "
                f"{SHADOW_LIBRARY_COMMIT} is {SHADOW_FILE_COUNT} files, {SHADOW_TOTAL_BYTES} bytes, "
                f"manifest sha256:{SHADOW_MANIFEST_SHA256}. Re-check out the pinned commit rather "
                "than re-pinning this reader."
            )
        self._payloads = payloads
        self._digests = {row[0]: (int(row[1]), str(row[2])) for row in rows}  # type: ignore[arg-type]
        self._parsed: dict[str, ShadowFile] = {}

    def contains(self, path: str) -> bool:
        return normalize_shadow_path(path) in self._payloads

    def resolve(self, reference: str) -> str | None:
        for candidate in shadow_candidates(reference):
            if candidate in self._payloads:
                return candidate
        return None

    def shadow_paths(self) -> tuple[str, ...]:
        """Every `.dat` path the verified tree holds, so a sweep can read them all."""

        return tuple(sorted(path for path in self._payloads if path.endswith(".dat")))

    def variants(self, design_id: str, limit: int = 8) -> list[str]:
        """Shadow files whose name starts with this design id, up to `limit`.

        LDraw splits some designs into lettered variants — 3245 is 3245a, 3245b
        and 3245c — so "no shadow file for 3245" and "no shadow information for
        that design at all" are different findings, and only this tells them
        apart.
        """

        prefix = normalize_shadow_path(f"{design_id}.dat").removesuffix(".dat")
        return sorted(
            path
            for path in self._payloads
            if path.startswith(("parts/", "p/"))
            and "/" not in path.removeprefix("parts/").removeprefix("p/")
            and path.rsplit("/", 1)[-1].startswith(prefix)
        )[:limit]

    def read(self, path: str) -> ShadowFile:
        key = normalize_shadow_path(path)
        cached = self._parsed.get(key)
        if cached is not None:
            return cached
        data = self._payloads.get(key)
        if data is None:
            raise FileNotFoundError(f"Shadow library has no {key}")
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise ValueError(f"Shadow file {key} is not UTF-8 text") from error
        byte_length, digest = self._digests[key]
        parsed = ShadowFile(
            path=key,
            byte_length=byte_length,
            sha256=digest,
            metas=parse_shadow_metas(text, key),
        )
        self._parsed[key] = parsed
        return parsed

    def identity(self) -> dict[str, object]:
        """What this measurement read, in the form the bill of materials records."""

        return {
            "libraryId": SHADOW_LIBRARY_ID,
            "source": SHADOW_LIBRARY_SOURCE,
            "commit": SHADOW_LIBRARY_COMMIT,
            "declaredLicense": SHADOW_LIBRARY_LICENSE,
            "attribution": SHADOW_LIBRARY_ATTRIBUTION,
            "fileCount": self.file_count,
            "totalBytes": self.total_bytes,
            "manifestSha256": f"sha256:{self.manifest_sha256}",
            "allowedRole": "authoring-time connector fact measurement; no shadow file is committed",
        }
