"""Materialize one exact, bounded LDraw archive closure for visual admission.

The browser receives only this verified closure, never either source archive.
Real runs use the repository's byte pins. ``--synthetic-fixture`` creates two
deterministic tiny archives and takes them through the identical verifier and
materializer for ordinary Playwright coverage.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import shutil
import stat
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from ldraw_source_archive import (
    LDrawSourceLibrary,
    VerifiedArchive,
    canonical_bytes,
    sha256_prefixed,
)
from set_6651557_ldraw_source_audit_plan import ARCHIVE_PINS


SCHEMA_VERSION = "lego.ldraw-materialized-visual-admission-closure/1"
MAX_MANIFEST_BYTES = 4 * 1024 * 1024
SYNTHETIC_OFFICIAL_SHA256 = "8726438f7c73502d6d23e4ce5783c9444e72b5257d8be0d886f010547a8bc0af"
SYNTHETIC_UNOFFICIAL_SHA256 = "d0d4c5d43e80e5258aa0ae1a69723161152bdd927d05c121a4ccc0c2b2c00ac8"

SYNTHETIC_ROOT_TEXT = """0 Synthetic Asymmetric Admission Wedge
0 Name: asymmetric.dat
0 Author: LEGO Studio synthetic fixture
0 !LDRAW_ORG Part
0 !LICENSE Licensed under CC BY 4.0 : see CAreadme.txt
0 BFC CERTIFY CCW
4 16 0 0 0 30 0 0 30 0 10 0 0 20
0 BFC CW
4 16 0 12 0 0 12 20 30 12.4 10 30 12 0
0 BFC CCW
4 16 0 0 0 0 12 0 30 12 0 30 0 0
4 16 30 0 0 30 12 0 30 12.4 10 30 0 10
4 16 30 0 10 30 12.4 10 0 12 20 0 0 20
4 16 0 0 20 0 12 20 0 12 0 0 0 0
3 16 4 16 2 12 16 2 4 20 2
3 16 12 16 2 4 16 2 4 13 4
5 24 4 16 2 12 16 2 4 20 2 4 13 4
3 16 18 16 2 26 16 2 18 20 2
3 16 26 16 2 18 16 2 18 13 4
2 24 18 16 2 26 16 2
"""

SYNTHETIC_UNUSED_TEXT = """0 Synthetic Unused Part
0 Name: unused.dat
0 Author: LEGO Studio synthetic fixture
0 !LDRAW_ORG Unofficial_Part
0 !LICENSE Licensed under CC BY 4.0 : see CAreadme.txt
0 BFC CERTIFY CCW
3 16 0 0 0 1 0 0 0 1 0
"""


@dataclass(frozen=True)
class SyntheticPin:
    archive_id: str
    logical_name: str
    byte_length: int
    sha256: str
    entry_count: int
    max_entry_count: int
    license_documents: tuple[object, ...] = ()


def _zip_bytes(member: str, payload: bytes) -> bytes:
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_STORED) as archive:
        info = zipfile.ZipInfo(member, date_time=(1980, 1, 1, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        info.compress_type = zipfile.ZIP_STORED
        archive.writestr(info, payload)
    return stream.getvalue()


def synthetic_archive_bytes() -> tuple[bytes, bytes]:
    return (
        _zip_bytes("ldraw/parts/asymmetric.dat", SYNTHETIC_ROOT_TEXT.encode("utf-8")),
        _zip_bytes("ldraw/parts/unused.dat", SYNTHETIC_UNUSED_TEXT.encode("utf-8")),
    )


def synthetic_pins(official: bytes, unofficial: bytes) -> tuple[SyntheticPin, SyntheticPin]:
    pins = (
        SyntheticPin(
            archive_id="official",
            logical_name="synthetic-official.zip",
            byte_length=len(official),
            sha256=hashlib.sha256(official).hexdigest(),
            entry_count=1,
            max_entry_count=1,
        ),
        SyntheticPin(
            archive_id="unofficial",
            logical_name="synthetic-unofficial.zip",
            byte_length=len(unofficial),
            sha256=hashlib.sha256(unofficial).hexdigest(),
            entry_count=1,
            max_entry_count=1,
        ),
    )
    expected = (SYNTHETIC_OFFICIAL_SHA256, SYNTHETIC_UNOFFICIAL_SHA256)
    actual = tuple(pin.sha256 for pin in pins)
    if actual != expected:
        raise ValueError(
            "Synthetic visual-admission archives changed: "
            f"official {len(official)} bytes sha256:{actual[0]}, unofficial "
            f"{len(unofficial)} bytes sha256:{actual[1]}; expected {expected}. "
            "Review the fixture geometry and repin its two tracked constants deliberately."
        )
    return pins


def _is_link(path: Path) -> bool:
    info = os.lstat(path)
    return stat.S_ISLNK(info.st_mode) or bool(
        getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    )


def _safe_output(output: Path) -> tuple[Path, Path]:
    absolute = Path(os.path.abspath(os.fspath(output)))
    parent = absolute.parent.resolve(strict=True)
    if _is_link(parent) or not parent.is_dir():
        raise ValueError(f"Visual-admission output parent is not a real directory: {parent}")
    if absolute.exists() or absolute.is_symlink():
        raise FileExistsError(
            f"Visual-admission materialization refuses existing output {absolute}; use a fresh run path."
        )
    return absolute, parent


def _write_exact(path: Path, payload: bytes) -> None:
    with path.open("xb") as target:
        written = target.write(payload)
        target.flush()
        os.fsync(target.fileno())
    if written != len(payload):
        raise OSError(f"Writing {path} stopped after {written} of {len(payload)} bytes")


def _archive_manifest(pin: object, source_label: str) -> dict[str, object]:
    return {
        "archiveId": str(getattr(pin, "archive_id")),
        "logicalName": str(getattr(pin, "logical_name")),
        "source": source_label,
        "bytes": int(getattr(pin, "byte_length")),
        "sha256": f"sha256:{getattr(pin, 'sha256')}",
        "entryCount": int(getattr(pin, "entry_count")),
    }


def _cleanup_created(output: Path, identity: tuple[int, int]) -> None:
    if not output.exists() or _is_link(output):
        return
    info = os.stat(output)
    if (info.st_dev, info.st_ino) != identity or not stat.S_ISDIR(info.st_mode):
        return
    shutil.rmtree(output)


def materialize(
    *,
    archive_paths: dict[str, Path],
    pins: Iterable[object],
    root_archive: str,
    root_path: str,
    output: Path,
    source_labels: dict[str, str],
) -> dict[str, object]:
    target, _ = _safe_output(output)
    pin_list = tuple(pins)
    if {str(getattr(pin, "archive_id")) for pin in pin_list} != {"official", "unofficial"}:
        raise ValueError("Visual admission requires exactly one official and one unofficial archive pin.")
    archives: list[VerifiedArchive] = []
    library: LDrawSourceLibrary | None = None
    target.mkdir()
    created = os.stat(target)
    identity = (created.st_dev, created.st_ino)
    try:
        for pin in pin_list:
            archive_id = str(getattr(pin, "archive_id"))
            path = archive_paths.get(archive_id)
            if path is None:
                raise ValueError(f"Visual admission has no input path for pinned {archive_id} archive.")
            archives.append(VerifiedArchive(path, pin))
        library = LDrawSourceLibrary(archives)
        root = library.exact(root_archive, root_path)
        records = library.closure(root)
        library.verify_unchanged()
        library_directory = target / "library"
        library_directory.mkdir()
        closure: list[dict[str, object]] = []
        seen_materialized: set[str] = set()
        for record in records:
            materialized_path = f"library/{record.path}"
            if materialized_path in seen_materialized:
                raise ValueError(f"LDraw closure repeats materialized logical path {materialized_path}.")
            seen_materialized.add(materialized_path)
            destination = target.joinpath(*materialized_path.split("/"))
            destination.parent.mkdir(parents=True, exist_ok=True)
            data = library.archives[record.archive_id].read(record.path)
            if len(data) != record.byte_length or sha256_prefixed(data) != record.sha256:
                raise ValueError(
                    f"LDraw closure bytes changed for {record.archive_id}:{record.path} before materialization."
                )
            _write_exact(destination, data)
            direct = [f"{archive}:{path}" for archive, path in library.dependencies((record.archive_id, record.path))]
            closure.append(
                {
                    **record.manifest_record(),
                    "fileId": f"{record.archive_id}:{record.path}",
                    "materializedPath": materialized_path,
                    "directReferences": direct,
                }
            )
        root_record = library.record(root)
        archives_manifest = [
            _archive_manifest(
                pin,
                source_labels[str(getattr(pin, "archive_id"))],
            )
            for pin in sorted(pin_list, key=lambda value: str(getattr(value, "archive_id")))
        ]
        base: dict[str, object] = {
            "schemaVersion": SCHEMA_VERSION,
            "archives": archives_manifest,
            "root": {
                "archiveId": root[0],
                "path": root[1],
                "fileId": f"{root[0]}:{root[1]}",
                "bytes": root_record.byte_length,
                "sha256": root_record.sha256,
            },
            "closure": closure,
            "closureDigest": sha256_prefixed(canonical_bytes(closure)),
            "fileCount": len(closure),
            "totalBytes": sum(record.byte_length for record in records),
        }
        manifest = {**base, "manifestDigest": sha256_prefixed(canonical_bytes(base))}
        payload = canonical_bytes(manifest) + b"\n"
        if len(payload) > MAX_MANIFEST_BYTES:
            raise ValueError(
                f"Visual-admission closure manifest is {len(payload)} bytes; maximum is {MAX_MANIFEST_BYTES}."
            )
        _write_exact(target / "manifest.json", payload)
        library.verify_unchanged()
        return manifest
    except BaseException:
        if library is not None:
            library.close()
            library = None
        else:
            for archive in archives:
                archive.close()
        _cleanup_created(target, identity)
        raise
    finally:
        if library is not None:
            library.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--official", type=Path)
    parser.add_argument("--unofficial", type=Path)
    parser.add_argument("--root-archive", choices=("official", "unofficial"), default="official")
    parser.add_argument("--root", default="parts/asymmetric.dat")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--synthetic-fixture", action="store_true")
    arguments = parser.parse_args()

    if arguments.synthetic_fixture:
        if arguments.official is not None or arguments.unofficial is not None:
            parser.error("--synthetic-fixture cannot be combined with real archive paths")
        official_bytes, unofficial_bytes = synthetic_archive_bytes()
        pins = synthetic_pins(official_bytes, unofficial_bytes)
        with tempfile.TemporaryDirectory(prefix="lego-visual-admission-archives-") as directory:
            official = Path(directory) / pins[0].logical_name
            unofficial = Path(directory) / pins[1].logical_name
            _write_exact(official, official_bytes)
            _write_exact(unofficial, unofficial_bytes)
            manifest = materialize(
                archive_paths={"official": official, "unofficial": unofficial},
                pins=pins,
                root_archive="official",
                root_path="parts/asymmetric.dat",
                output=arguments.output,
                source_labels={
                    "official": "generated-checksum-pinned-synthetic-fixture",
                    "unofficial": "generated-checksum-pinned-synthetic-fixture",
                },
            )
    else:
        if arguments.official is None or arguments.unofficial is None:
            parser.error("real materialization requires both --official and --unofficial")
        manifest = materialize(
            archive_paths={"official": arguments.official, "unofficial": arguments.unofficial},
            pins=ARCHIVE_PINS,
            root_archive=arguments.root_archive,
            root_path=arguments.root,
            output=arguments.output,
            source_labels={"official": "user-supplied-pinned-archive", "unofficial": "user-supplied-pinned-archive"},
        )
    print(
        json.dumps(
            {
                "manifest": str((arguments.output / "manifest.json").resolve(strict=True)),
                "manifestDigest": manifest["manifestDigest"],
                "closureDigest": manifest["closureDigest"],
                "fileCount": manifest["fileCount"],
                "totalBytes": manifest["totalBytes"],
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
