"""Score the seven-part 6651557 pilot's candidate declarations and record the number.

Run:
  python -B scripts/score-part-admission.py \
    --official C:/tmp/ldraw-complete-2026-07.zip \
    --unofficial C:/tmp/ldraw-unofficial-2026-08-02.zip

It measures, it does not admit: no PartDefinition is emitted, no frame is
claimed, nothing is written outside the gitignored output tree. Every run
re-expands the pinned archives and binds its own measurement to the approved
source pilot report before scoring, so a scorecard cannot drift from the
evidence the pilot already established.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from ldraw_source_archive import LDrawSourceLibrary, VerifiedArchive
from part_admission_contract import CONTAINMENT_EPSILON_LDU, validate_candidate
from part_admission_evidence import (
    PILOT_BYTES,
    PILOT_DESIGN_IDS,
    PILOT_SHA256,
    bind_to_pilot,
    measured_surface,
    read_pilot,
    write_output_report,
)
from part_admission_lattice import LATTICE_TOLERANCE_LDU
from part_admission_ldraw_candidate import (
    DEFAULT_COLUMN_LDU,
    PRIMITIVE_ROLE_PINS,
    column_candidate,
    horizontally_inset_candidate,
)
from part_admission_scorecard import (
    CONNECTOR_MATCH_TOLERANCE_LDU,
    DEFAULT_SAMPLE_SPACING_LDU,
    score_candidate,
)
from part_admission_surface import MeasuredSurface
from set_6651557_ldraw_source_audit_plan import ARCHIVE_PINS

SCORECARD_SCHEMA_VERSION = "lego.part-admission-scorecard/1"


def summarize(scorecards: list[dict[str, object]]) -> dict[str, object]:
    return {
        "parts": len(scorecards),
        "hardFailingParts": sorted(
            str(row["designId"]) for row in scorecards if row["hardFails"]
        ),
        "compositeByPart": {
            str(row["designId"]): round(float(row["score"]["composite"]), 6)  # type: ignore[index]
            for row in scorecards
        },
        "meanComposite": sum(
            float(row["score"]["composite"]) for row in scorecards  # type: ignore[index]
        )
        / len(scorecards),
        "totalSurfacePointsSampled": sum(
            int(row["collisionContainment"]["pointsSampled"]) for row in scorecards  # type: ignore[index]
        ),
        "totalSurfacePointsOutside": sum(
            int(row["collisionContainment"]["pointsOutside"]) for row in scorecards  # type: ignore[index]
        ),
    }


def main() -> None:
    repository = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--official", type=Path, required=True)
    parser.add_argument("--unofficial", type=Path, required=True)
    parser.add_argument(
        "--pilot", type=Path, default=repository / "output/real-build/set-6651557-source-pilot.json"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repository / "output/real-build/set-6651557-part-admission-scorecard.json",
    )
    parser.add_argument("--column-ldu", type=float, default=DEFAULT_COLUMN_LDU)
    parser.add_argument(
        "--column-sweep",
        default="4,2,1",
        help="comma-separated column sizes to score, so the body-count/over-claim trade is visible",
    )
    parser.add_argument("--sample-spacing-ldu", type=float, default=DEFAULT_SAMPLE_SPACING_LDU)
    parser.add_argument("--skip-inset-probe", action="store_true")
    arguments = parser.parse_args()
    sweep = [float(value) for value in arguments.column_sweep.split(",") if value.strip()]
    if arguments.column_ldu not in sweep:
        sweep.append(arguments.column_ldu)

    pilot = read_pilot(arguments.pilot)
    pilot_parts = {str(row["designId"]): row for row in pilot["parts"]}  # type: ignore[index,union-attr]
    archive_paths = {"official": arguments.official, "unofficial": arguments.unofficial}
    archives = [VerifiedArchive(archive_paths[pin.archive_id], pin) for pin in ARCHIVE_PINS]
    library = LDrawSourceLibrary(archives)
    started = time.monotonic()
    surfaces: dict[str, MeasuredSurface] = {}
    bindings: dict[str, object] = {}
    try:
        library.verify_unchanged()
        for design_id in PILOT_DESIGN_IDS:
            surfaces[design_id] = measured_surface(library, design_id)
            bindings[design_id] = bind_to_pilot(surfaces[design_id], pilot_parts[design_id])
        library.verify_unchanged()
    finally:
        library.close()

    candidates: list[dict[str, object]] = []
    inset_scorecards: list[dict[str, object]] = []
    for column_ldu in sweep:
        scorecards: list[dict[str, object]] = []
        for design_id in PILOT_DESIGN_IDS:
            surface = surfaces[design_id]
            candidate = column_candidate(surface, column_ldu)
            scorecard = score_candidate(
                validate_candidate(candidate), surface, arguments.sample_spacing_ldu
            )
            scorecards.append(scorecard)
            print(
                f"column={column_ldu:g} {design_id}: "
                f"composite={float(scorecard['score']['composite']):.4f} "  # type: ignore[index,arg-type]
                f"bodies={scorecard['bodyBudget']['bodyCount']} "  # type: ignore[index]
                f"outside={scorecard['collisionContainment']['pointsOutside']}",  # type: ignore[index]
                flush=True,
            )
            if column_ldu == arguments.column_ldu and not arguments.skip_inset_probe:
                inset_scorecards.append(
                    score_candidate(
                        validate_candidate(horizontally_inset_candidate(candidate)),
                        surface,
                        arguments.sample_spacing_ldu,
                    )
                )
        candidates.append(
            {
                "candidateId": f"ldraw-column-height-field/{column_ldu:g}ldu",
                "columnLdu": column_ldu,
                "headline": column_ldu == arguments.column_ldu,
                "intent": "the layer-4 strategy part-model.md line 119 records, scored on this run",
                "parts": scorecards,
                "summary": summarize(scorecards),
            }
        )
    if inset_scorecards:
        candidates.append(
            {
                "candidateId": "builder-style-horizontal-inset-probe",
                "columnLdu": arguments.column_ldu,
                "headline": False,
                "intent": (
                    "the same bodies inset 0.25 LDU on every horizontal face, which is what "
                    "part-model.md line 121 measures of Builder's authored boxes; it exists to "
                    "prove this scorer fires on the under-claim it is built to catch"
                ),
                "parts": inset_scorecards,
                "summary": summarize(inset_scorecards),
            }
        )
    report = {
        "schemaVersion": SCORECARD_SCHEMA_VERSION,
        "authority": {
            "state": "measurement-only-not-catalog-admitted",
            "partDefinitionsEmitted": False,
            "framesClaimed": False,
            "connectorTruthClaimed": False,
            "collisionTruthClaimed": False,
            "runtimeExposed": False,
        },
        "inputs": {
            "sourcePilot": {"bytes": PILOT_BYTES, "sha256": f"sha256:{PILOT_SHA256}"},
            "officialArchive": {
                "bytes": ARCHIVE_PINS[0].byte_length,
                "sha256": f"sha256:{ARCHIVE_PINS[0].sha256}",
            },
            "unofficialArchive": {
                "bytes": ARCHIVE_PINS[1].byte_length,
                "sha256": f"sha256:{ARCHIVE_PINS[1].sha256}",
            },
        },
        "parameters": {
            "columnLdu": arguments.column_ldu,
            "sampleSpacingLdu": arguments.sample_spacing_ldu,
            "containmentEpsilonLdu": CONTAINMENT_EPSILON_LDU,
            "connectorMatchToleranceLdu": CONNECTOR_MATCH_TOLERANCE_LDU,
            "latticeToleranceLdu": LATTICE_TOLERANCE_LDU,
        },
        "primitiveRolePolicy": {
            f"{archive}:{path}": {"sha256": digest, "role": role}
            for (archive, path), (digest, role) in sorted(PRIMITIVE_ROLE_PINS.items())
        },
        "pilotBinding": bindings,
        "candidates": candidates,
    }
    digest = write_output_report(arguments.output, report)
    print(f"measured in {time.monotonic() - started:.1f}s")
    print(f"wrote {arguments.output.resolve(strict=True)}")
    print(f"sha256:{digest}")


if __name__ == "__main__":
    main()
