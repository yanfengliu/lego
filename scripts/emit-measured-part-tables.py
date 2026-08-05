"""Emit the catalog's generated measured-part tables, and refuse to emit a failure.

Run:
  python -B scripts/emit-measured-part-tables.py \
    --official C:/tmp/ldraw-complete-2026-07.zip \
    --unofficial C:/tmp/ldraw-unofficial-2026-08-02.zip \
    --shadow C:/tmp/ldcad-shadow-20260802
  npx prettier --write packages/catalog/src/mesh-assets-6651557.ts \
    packages/catalog/src/part-blueprints-6651557-measured.ts \
    packages/catalog/src/ldraw-bundled-sources-6651557.ts

The first production admission emitted its tables from a scratch script that no
longer exists, which left generated files in Git with no way to reproduce them.
This is that path, made real: one measurement feeds the mesh, the collision
decomposition, the connectors and the per-file attribution, and every part is
scored by the existing part-admission scorer before a single line is written.

A hard fail is a refusal, not a low number: nothing is written unless every
planned part passes, so the catalog cannot gain a part whose own scorecard says
it under-claims. Scoring evidence goes to the gitignored output tree.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from ldcad_shadow_coverage import read_builder_frames
from ldcad_shadow_source import VerifiedShadowLibrary
from ldraw_source_archive import LDrawSourceLibrary, VerifiedArchive
from measured_part_emit import render_blueprints, render_bundled_sources, render_mesh_assets
from measured_part_plan import ADMITTED_PART_PLANS, BUNDLED_LDRAW_ARCHIVE_RECORD
from measured_part_tables import measure_part, scoreable_candidate
from part_admission_contract import validate_candidate
from part_admission_evidence import PILOT_DESIGN_IDS, bind_to_pilot, read_pilot, write_output_report
from part_admission_scorecard import DEFAULT_SAMPLE_SPACING_LDU, score_candidate
from set_6651557_ldraw_source_audit_plan import ARCHIVE_PINS

REPORT_SCHEMA_VERSION = "lego.measured-part-admission-emission/1"
GENERATED_FILES = {
    "meshAssets": "packages/catalog/src/mesh-assets-6651557.ts",
    "blueprints": "packages/catalog/src/part-blueprints-6651557-measured.ts",
    "bundledSources": "packages/catalog/src/ldraw-bundled-sources-6651557.ts",
}


def builder_records(report_path: Path) -> dict[str, dict[str, str]]:
    """Revision and record digest per design, from the pinned frame report."""

    import json

    report = json.loads(report_path.read_bytes().decode("utf-8"))
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
        help="measure and score without writing, so a gate can prove the tables reproduce",
    )
    arguments = parser.parse_args()

    pilot = read_pilot(arguments.pilot)
    pilot_parts = {str(row["designId"]): row for row in pilot["parts"]}  # type: ignore[index,union-attr]
    builder_clutches = read_builder_frames(arguments.builder_frame)
    builder = builder_records(arguments.builder_frame)
    shadow = VerifiedShadowLibrary(arguments.shadow)
    archive_paths = {"official": arguments.official, "unofficial": arguments.unofficial}
    library = LDrawSourceLibrary(
        [VerifiedArchive(archive_paths[pin.archive_id], pin) for pin in ARCHIVE_PINS]
    )
    started = time.monotonic()
    parts = []
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
            parts.append(part)
            scorecards.append(scorecard)
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
    rendered = {
        "meshAssets": render_mesh_assets(parts, archive_sha256),
        "blueprints": render_blueprints(
            parts, archive_sha256, builder, dict(shadow.identity())
        ),
        "bundledSources": render_bundled_sources(parts, BUNDLED_LDRAW_ARCHIVE_RECORD),
    }
    written: dict[str, object] = {}
    for key, relative in GENERATED_FILES.items():
        target = repository / relative
        previous = target.read_text(encoding="utf-8") if target.exists() else None
        if not arguments.check:
            target.write_text(rendered[key], encoding="utf-8", newline="\n")
        written[relative] = {
            "bytes": len(rendered[key].encode("utf-8")),
            "changedBeforePrettier": previous != rendered[key],
            "written": not arguments.check,
        }

    report = {
        "schemaVersion": REPORT_SCHEMA_VERSION,
        "authority": {
            "state": "emits-catalog-tables-only-after-every-part-scores-without-a-hard-fail",
            "partsEmitted": len(parts),
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
            for part in parts
        ],
        "scorecards": scorecards,
    }
    digest = write_output_report(arguments.report, report)
    print(f"measured in {time.monotonic() - started:.1f}s")
    print(f"wrote {arguments.report.resolve(strict=True)}")
    print(f"sha256:{digest}")


if __name__ == "__main__":
    main()
