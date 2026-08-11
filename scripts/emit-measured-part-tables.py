"""Emit the catalog's generated measured-part tables, and refuse to emit a failure.

Run:
  python -B scripts/emit-measured-part-tables.py \
    --official C:/tmp/ldraw-complete-2026-07.zip \
    --unofficial C:/tmp/ldraw-unofficial-2026-08-02.zip \
    --shadow C:/tmp/ldcad-shadow-20260802 \
    --pilot output/real-build/set-6651557-source-pilot.json \
    --builder-frame output/real-build/set-6651557-builder-ldraw-frame.json

The first production admission emitted its tables from a scratch script that no
longer exists, which left generated files in Git with no way to reproduce them.
This is that path, made real: one measurement emits aligned mesh, collision,
connector and attribution tables, and every full measured part is scored before
a line is written. The separate render-only plan emits only mesh, exact bounds,
stud-frame witnesses and attribution; it has no connector, allowance or
collision field to import, and the TypeScript admission asserts the preceding
catalog physical semantics remain byte-identical.

A hard fail is a refusal, not a low number: nothing is written unless every
planned part passes, so the catalog cannot gain a part whose own scorecard says
it under-claims. Scoring evidence goes to the gitignored output tree.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path

from ldcad_shadow_coverage import parse_builder_frames
from ldcad_shadow_source import VerifiedShadowLibrary
from ldraw_source_archive import LDrawSourceLibrary, VerifiedArchive
from measured_part_emit import (
    canonical_typescript,
    enforce_generated_check,
    render_blueprints,
    render_bundled_sources,
    render_mesh_asset_aggregator,
    render_mesh_asset_chunk,
    render_render_only_blueprints,
)
from measured_part_plan import (
    ADMITTED_PART_PLANS,
    BUNDLED_LDRAW_ARCHIVE_RECORD,
    RENDER_ONLY_PART_PLANS,
)
from measured_part_tables import measure_part, measure_render_only_part, scoreable_candidate
from part_admission_contract import validate_candidate
from part_admission_evidence import PILOT_DESIGN_IDS, bind_to_pilot, parse_pilot, write_output_report
from part_admission_scorecard import DEFAULT_SAMPLE_SPACING_LDU, score_candidate
from set_6651557_ldraw_source_audit_plan import ARCHIVE_PINS

REPORT_SCHEMA_VERSION = "lego.measured-part-admission-emission/3"
GENERATED_FILES = {
    "meshAssets": "packages/catalog/src/mesh-assets-6651557.ts",
    "meshAssetsMeasuredA": "packages/catalog/src/mesh-assets-6651557-measured-a.ts",
    "meshAssetsMeasuredB": "packages/catalog/src/mesh-assets-6651557-measured-b.ts",
    "meshAssetsMeasuredC": "packages/catalog/src/mesh-assets-6651557-measured-c.ts",
    "meshAssetsRenderOnly": "packages/catalog/src/mesh-assets-6651557-render-only.ts",
    "blueprints": "packages/catalog/src/part-blueprints-6651557-measured.ts",
    "renderOnlyBlueprints": "packages/catalog/src/part-blueprints-6651557-render-only.ts",
    "bundledSources": "packages/catalog/src/ldraw-bundled-sources-6651557.ts",
}


def bound_input(path: Path, label: str) -> tuple[bytes, dict[str, object]]:
    """Read one required ignored input and retain the exact identity consumed."""

    try:
        content = path.read_bytes()
    except OSError as error:
        flag = f"--{label.replace('_', '-')}"
        raise SystemExit(
            f"Measured-part table generation needs {label.replace('_', ' ')} at {path}: "
            f"{error}. Generate that input first or pass its exact path with {flag}."
        ) from error
    return content, {
        "bytes": len(content),
        "sha256": f"sha256:{hashlib.sha256(content).hexdigest()}",
    }


def assert_bound_input_unchanged(path: Path, label: str, expected: bytes) -> None:
    """Refuse a run whose prepared input changed while it was being consumed."""

    try:
        current = path.read_bytes()
    except OSError as error:
        raise SystemExit(
            f"Measured-part table generation could not re-read {label} at {path}: {error}. "
            "Keep the prepared input stable for the whole run."
        ) from error
    if current != expected:
        raise SystemExit(
            f"Measured-part table generation saw {label} change while running at {path}. "
            "Restore one exact prepared input and rerun; do not combine measurements from two versions."
        )


def builder_records(report_bytes: bytes) -> dict[str, dict[str, str]]:
    """Revision and record digest per design, from the pinned frame report."""

    report = json.loads(report_bytes.decode("utf-8"))
    return {
        str(part["designId"]): {
            "revision": str(part["builderRevision"]),
            "recordSha256": str(part["builderRecordSha256"]),
            "frameSha256": str(part["frame"]["sha256"]),
        }
        for part in report["parts"]
    }


def main() -> None:
    repository = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--official", type=Path, required=True)
    parser.add_argument("--unofficial", type=Path, required=True)
    parser.add_argument("--shadow", type=Path, required=True)
    parser.add_argument(
        "--pilot", type=Path, default=repository / "output/real-build/set-6651557-source-pilot.json"
    )
    parser.add_argument(
        "--builder-frame",
        type=Path,
        default=repository / "output/real-build/set-6651557-builder-ldraw-frame.json",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=repository / "output/real-build/set-6651557-measured-part-emission.json",
    )
    parser.add_argument("--sample-spacing-ldu", type=float, default=DEFAULT_SAMPLE_SPACING_LDU)
    parser.add_argument(
        "--check",
        action="store_true",
        help="measure, score, canonicalize, and refuse if committed tables do not reproduce",
    )
    arguments = parser.parse_args()

    pilot_bytes, pilot_binding = bound_input(arguments.pilot, "pilot")
    builder_frame_bytes, builder_frame_binding = bound_input(
        arguments.builder_frame, "builder_frame"
    )
    pilot = parse_pilot(pilot_bytes, arguments.pilot)
    pilot_parts = {str(row["designId"]): row for row in pilot["parts"]}  # type: ignore[index,union-attr]
    builder_clutches = parse_builder_frames(builder_frame_bytes, arguments.builder_frame)
    builder = builder_records(builder_frame_bytes)
    shadow = VerifiedShadowLibrary(arguments.shadow)
    archive_paths = {"official": arguments.official, "unofficial": arguments.unofficial}
    library = LDrawSourceLibrary(
        [VerifiedArchive(archive_paths[pin.archive_id], pin) for pin in ARCHIVE_PINS]
    )
    started = time.monotonic()
    measured_parts = []
    render_only_parts = []
    scorecards: list[dict[str, object]] = []
    bindings: dict[str, object] = {}
    try:
        library.verify_unchanged()
        for plan in ADMITTED_PART_PLANS:
            part = measure_part(library, shadow, plan, builder_clutches)
            if plan.design_id in PILOT_DESIGN_IDS:
                bindings[plan.design_id] = bind_to_pilot(
                    part.surface, pilot_parts[plan.design_id]
                )
            else:
                bindings[plan.design_id] = {
                    "state": "bound-to-pinned-archive-and-declared-source-route",
                    "route": f"official:{plan.ldraw_path}",
                    "rootSha256": part.root.sha256,
                }
            scorecard = score_candidate(
                validate_candidate(scoreable_candidate(part)),
                part.surface,
                arguments.sample_spacing_ldu,
            )
            print(
                f"{plan.design_id}: composite="
                f"{float(scorecard['score']['composite']):.6f} "  # type: ignore[index,arg-type]
                f"bodies={scorecard['bodyBudget']['bodyCount']} "  # type: ignore[index]
                f"studs={len(part.studs_ldu)} clutches={len(part.clutches_ldu)} "
                f"clutchRoom={scorecard['clutchRoom']['clutchesWithRoom']}"  # type: ignore[index]
                f"/{scorecard['clutchRoom']['declaredClutches']} "  # type: ignore[index]
                f"triangles={part.body_triangle_count + part.stud_triangle_count} "
                f"hardFails={[row['code'] for row in scorecard['hardFails']]}",  # type: ignore[index,union-attr]
                flush=True,
            )
            measured_parts.append(part)
            scorecards.append(scorecard)
        for plan in RENDER_ONLY_PART_PLANS:
            part = measure_render_only_part(library, plan)
            bindings[plan.design_id] = {
                "state": "render-only-bound-to-pinned-official-root-with-no-connector-or-collision-source",
                "route": f"official:{plan.ldraw_path}",
                "rootSha256": part.root.sha256,
            }
            print(
                f"{plan.design_id}: renderOnly=true studs={len(part.source_stud_seats_ldu)} "
                f"triangles={part.body_triangle_count + part.stud_triangle_count} "
                "structuralFields=0",
                flush=True,
            )
            render_only_parts.append(part)
        library.verify_unchanged()
    finally:
        library.close()

    failing = [
        str(card["designId"])
        for card in scorecards
        if card["hardFails"]  # type: ignore[truthy-iterable]
    ]
    if failing:
        raise SystemExit(
            f"Refusing to emit: {', '.join(failing)} hard-fail the part-admission scorer. "
            "A hard fail says the declaration claims something the measured source does not "
            "support, so no table is written. Remove the part from ADMITTED_PART_PLANS or fix "
            "the declaration; do not weaken the scorer."
        )

    archive_sha256 = str(BUNDLED_LDRAW_ARCHIVE_RECORD["sha256"]).split(":")[-1]
    mesh_parts = [*measured_parts, *render_only_parts]
    rendered = {
        "meshAssets": render_mesh_asset_aggregator(),
        "meshAssetsMeasuredA": render_mesh_asset_chunk(
            measured_parts[:6], archive_sha256, "SET_6651557_MEASURED_MESH_ASSETS_A"
        ),
        "meshAssetsMeasuredB": render_mesh_asset_chunk(
            measured_parts[6:9], archive_sha256, "SET_6651557_MEASURED_MESH_ASSETS_B"
        ),
        "meshAssetsMeasuredC": render_mesh_asset_chunk(
            measured_parts[9:], archive_sha256, "SET_6651557_MEASURED_MESH_ASSETS_C"
        ),
        "meshAssetsRenderOnly": render_mesh_asset_chunk(
            render_only_parts,
            archive_sha256,
            "SET_6651557_RENDER_ONLY_MESH_ASSETS",
            render_only=True,
        ),
        "blueprints": render_blueprints(
            measured_parts, archive_sha256, builder, dict(shadow.identity())
        ),
        "renderOnlyBlueprints": render_render_only_blueprints(
            render_only_parts, archive_sha256
        ),
        "bundledSources": render_bundled_sources(mesh_parts, BUNDLED_LDRAW_ARCHIVE_RECORD),
    }
    assert_bound_input_unchanged(arguments.pilot, "source pilot", pilot_bytes)
    assert_bound_input_unchanged(
        arguments.builder_frame, "Builder-to-LDraw frame report", builder_frame_bytes
    )
    written: dict[str, object] = {}
    drifted: list[str] = []
    for key, relative in GENERATED_FILES.items():
        target = repository / relative
        canonical = canonical_typescript(repository, target, rendered[key])
        canonical_bytes = canonical.encode("utf-8")
        previous = target.read_bytes() if target.exists() else None
        matches = previous == canonical_bytes
        if arguments.check and not matches:
            drifted.append(relative)
        if not arguments.check:
            target.write_bytes(canonical_bytes)
        written[relative] = {
            "bytes": len(canonical_bytes),
            "sha256": f"sha256:{hashlib.sha256(canonical_bytes).hexdigest()}",
            "matchedBeforeAction": matches,
            "written": not arguments.check,
        }

    report = {
        "schemaVersion": REPORT_SCHEMA_VERSION,
        "authority": {
            "state": "full-measured-parts-score-before-emission-and-render-only-parts-emit-no-physical-semantics",
            "partsEmitted": len(mesh_parts),
            "fullMeasuredParts": len(measured_parts),
            "renderOnlyParts": len(render_only_parts),
            "hardFailingParts": failing,
        },
        "inputs": {
            "officialArchive": {
                "bytes": ARCHIVE_PINS[0].byte_length,
                "sha256": f"sha256:{ARCHIVE_PINS[0].sha256}",
            },
            "unofficialArchive": {
                "bytes": ARCHIVE_PINS[1].byte_length,
                "sha256": f"sha256:{ARCHIVE_PINS[1].sha256}",
            },
            "shadowLibrary": shadow.identity(),
            "sourcePilot": pilot_binding,
            "builderFrame": builder_frame_binding,
        },
        "sourceBinding": bindings,
        "generatedFiles": written,
        "parts": [
            {
                "designId": part.plan.design_id,
                "catalogId": (
                    f"builtin:{part.plan.family}-{part.plan.width_studs}x{part.plan.length_studs}"
                    + ("" if part.plan.variant is None else f"-{part.plan.variant}")
                ),
                "connectorSource": part.plan.connector_source,
                "studs": len(part.studs_ldu),
                "clutches": len(part.clutches_ldu),
                "collisionBoxes": len(part.body_boxes_ldu) // 6,
                "meshTriangles": part.body_triangle_count + part.stud_triangle_count,
                "closureFileCount": len(part.closure),
                "shadowFiles": list(part.shadow_files),
            }
            for part in measured_parts
        ]
        + [
            {
                "designId": part.plan.design_id,
                "catalogId": (
                    f"builtin:{part.plan.family}-{part.plan.width_studs}x{part.plan.length_studs}"
                    + ("" if part.plan.variant is None else f"-{part.plan.variant}")
                ),
                "connectorSource": "preserved-catalog-definition-not-read-by-generator",
                "sourceStudFrameWitnesses": len(part.source_stud_seats_ldu),
                "meshTriangles": part.body_triangle_count + part.stud_triangle_count,
                "closureFileCount": len(part.closure),
                "structuralFieldsEmitted": 0,
            }
            for part in render_only_parts
        ],
        "scorecards": scorecards,
    }
    digest = write_output_report(arguments.report, report)
    print(f"measured in {time.monotonic() - started:.1f}s")
    print(f"wrote {arguments.report.resolve(strict=True)}")
    print(f"sha256:{digest}")
    enforce_generated_check(drifted)


if __name__ == "__main__":
    main()
