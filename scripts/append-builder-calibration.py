"""Append one reviewed Builder/LDraw suffix without recreating historical reports.

The retained Builder geometry is an append-only evidence bundle. When a newly
reviewed design follows every existing slice, this path proves the complete old
bundle byte-for-byte, independently re-encodes only the new Shell and LDraw
slices from pinned sources, and publishes only the exact committed final digest.
It never fabricates or substitutes unavailable historical Shell reports.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from types import ModuleType

from builder_calibration_sources import (
    DESIGNS,
    GEOMETRY_BUNDLE_BYTES,
    GEOMETRY_BUNDLE_SHA256,
    LDRAW_CLOSURE_FILES,
)


BASE_GEOMETRY_BYTES = 1_820_412
BASE_GEOMETRY_SHA256 = "7e91e1402f2ab609fee6e502336f86ee74fb3a94d970e9b0b75acf07f925a76f"
APPENDED_DESIGN_REVISION = "15573;L"
MAX_GEOMETRY_BYTES = 8 * 1024 * 1024


def load_generator() -> ModuleType:
    path = Path(__file__).resolve().with_name("generate-builder-calibration.py")
    spec = importlib.util.spec_from_file_location("builder_calibration_generator", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load Builder calibration generator {path}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _exact_payload(payload: bytes, expected_bytes: int, expected_digest: str, label: str) -> bytes:
    actual_digest = sha256(payload)
    if len(payload) != expected_bytes or actual_digest != expected_digest:
        raise ValueError(
            f"{label} is {len(payload)} bytes sha256:{actual_digest}; expected "
            f"{expected_bytes} bytes sha256:{expected_digest}."
        )
    return payload


def _reviewed_slice(payload: bytes, section: object, expected_offset: int, label: str) -> bytes:
    if not isinstance(section, dict):
        raise ValueError(f"{label} has no reviewed slice pin.")
    actual_digest = f"sha256:{sha256(payload)}"
    if (
        section.get("byteOffset") != expected_offset
        or section.get("byteLength") != len(payload)
        or section.get("triangleCount") != len(payload) // 36
        or len(payload) % 36 != 0
        or section.get("digest") != actual_digest
    ):
        raise ValueError(
            f"{label} encoded at offset {expected_offset} as {len(payload)} bytes "
            f"({len(payload) // 36} triangles) {actual_digest}; reviewed pin is {section}."
        )
    return payload


def reviewed_base_prefix(
    payload: bytes,
    *,
    base_bytes: int = BASE_GEOMETRY_BYTES,
    base_digest: str = BASE_GEOMETRY_SHA256,
    final_bytes: int = GEOMETRY_BUNDLE_BYTES,
    final_digest: str = GEOMETRY_BUNDLE_SHA256,
) -> tuple[bytes, str]:
    if len(payload) == base_bytes and sha256(payload) == base_digest:
        return payload, "reviewed-prefix"
    if len(payload) == final_bytes and sha256(payload) == final_digest:
        return (
            _exact_payload(payload[:base_bytes], base_bytes, base_digest, "Final-bundle prefix"),
            "reviewed-final-bundle",
        )
    raise ValueError(
        f"Base input is {len(payload)} bytes sha256:{sha256(payload)}; expected either the exact "
        f"{base_bytes}-byte reviewed prefix sha256:{base_digest} or the exact {final_bytes}-byte "
        f"final bundle sha256:{final_digest}."
    )


def assemble_append_only(
    base_geometry: bytes,
    builder_slice: bytes,
    ldraw_slice: bytes,
    design: dict[str, object],
    *,
    base_bytes: int = BASE_GEOMETRY_BYTES,
    base_digest: str = BASE_GEOMETRY_SHA256,
    final_bytes: int = GEOMETRY_BUNDLE_BYTES,
    final_digest: str = GEOMETRY_BUNDLE_SHA256,
) -> bytes:
    base = _exact_payload(base_geometry, base_bytes, base_digest, "Base Builder geometry")
    builder = _reviewed_slice(
        builder_slice, design.get("builderGeometry"), len(base), "Appended Builder Shell"
    )
    ldraw = _reviewed_slice(
        ldraw_slice,
        design.get("ldrawReferenceGeometry"),
        len(base) + len(builder),
        "Appended expanded LDraw",
    )
    return _exact_payload(
        base + builder + ldraw,
        final_bytes,
        final_digest,
        "Final Builder geometry",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Append one exact reviewed Builder/LDraw suffix to a pinned geometry bundle."
    )
    parser.add_argument("--base-geometry", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--cache-report", type=Path, required=True)
    parser.add_argument("--asset-audit", type=Path, required=True)
    parser.add_argument("--ldraw-official", type=Path, required=True)
    parser.add_argument("--ldraw-unofficial", type=Path, required=True)
    parser.add_argument("--shell-report", type=Path, required=True)
    parser.add_argument("--out-geometry", type=Path, required=True)
    args = parser.parse_args()

    generator = load_generator()
    design = next(
        (
            candidate
            for candidate in DESIGNS
            if candidate.get("designRevision") == APPENDED_DESIGN_REVISION
        ),
        None,
    )
    if design is None or design is not DESIGNS[-1]:
        raise ValueError(
            f"Append-only calibration requires {APPENDED_DESIGN_REVISION} as the final reviewed row."
        )

    base_input = generator.bounded_bytes(
        args.base_geometry,
        MAX_GEOMETRY_BYTES,
        "Base Builder geometry",
    )
    base, base_input_state = reviewed_base_prefix(
        base_input,
    )
    generator.verified_bytes(
        args.manifest,
        generator.MANIFEST_DIGEST,
        "Builder manifest",
        1_000_000,
    )
    cache = json.loads(
        generator.verified_bytes(
            args.cache_report,
            generator.CACHE_REPORT_DIGEST,
            "Builder cache report",
            1_000_000,
        )
    )
    audit = json.loads(
        generator.verified_bytes(
            args.asset_audit,
            generator.AUDIT_REPORT_DIGEST,
            "Builder asset audit",
            4_000_000,
        )
    )
    generator.validate_reports(cache, audit)

    report = json.loads(
        generator.bounded_bytes(
            args.shell_report,
            4_000_000,
            f"{APPENDED_DESIGN_REVISION} Shell report",
        )
    )
    builder_slice = generator.encode_shell(report, design)[0]
    official = generator.verified_bytes(
        args.ldraw_official,
        generator.LDRAW_OFFICIAL_DIGEST,
        "Official LDraw archive",
        200_000_000,
    )
    unofficial = generator.verified_bytes(
        args.ldraw_unofficial,
        generator.LDRAW_UNOFFICIAL_DIGEST,
        "Unofficial LDraw archive",
        120_000_000,
    )
    library = generator.LDrawLibrary(
        [
            ("Official LDraw archive", official),
            ("Unofficial LDraw archive", unofficial),
        ],
        LDRAW_CLOSURE_FILES,
    )
    try:
        ldraw_slice = generator.encode_ldraw(library.triangles("15573.dat"), design)
    finally:
        library.close()

    geometry = assemble_append_only(base, builder_slice, ldraw_slice, design)
    generator.write_atomic(args.out_geometry.resolve(), geometry)
    print(
        json.dumps(
            {
                "baseGeometry": {
                    "bytes": len(base),
                    "digest": f"sha256:{sha256(base)}",
                    "inputState": base_input_state,
                },
                "appendedDesignRevision": APPENDED_DESIGN_REVISION,
                "builderSlice": {
                    "bytes": len(builder_slice),
                    "digest": f"sha256:{sha256(builder_slice)}",
                },
                "ldrawSlice": {
                    "bytes": len(ldraw_slice),
                    "digest": f"sha256:{sha256(ldraw_slice)}",
                },
                "geometry": {
                    "path": str(args.out_geometry.resolve()),
                    "bytes": len(geometry),
                    "digest": f"sha256:{sha256(geometry)}",
                },
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
