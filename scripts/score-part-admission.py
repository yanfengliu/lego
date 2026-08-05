"""Score the six-part 6651557 pilot's candidate declarations and record the number.

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
import hashlib
import json
import os
import stat
import time
from pathlib import Path

from builder_native_source import measure_bounds
from ldraw_source_archive import LDrawSourceLibrary, VerifiedArchive, canonical_bytes
from ldraw_surface_expander import expand_surface
from part_admission_contract import CONTAINMENT_EPSILON_LDU, validate_candidate
from part_admission_lattice import LATTICE_TOLERANCE_LDU
from part_admission_ldraw_candidate import (
    DEFAULT_COLUMN_LDU,
    PRIMITIVE_ROLE_PINS,
    column_candidate,
    horizontally_inset_candidate,
    role_classifier,
)
from part_admission_scorecard import (
    CONNECTOR_MATCH_TOLERANCE_LDU,
    DEFAULT_SAMPLE_SPACING_LDU,
    score_candidate,
)
from part_admission_surface import MeasuredSurface, STUD_ROLE
from set_6651557_ldraw_source_audit_plan import ARCHIVE_PINS

PILOT_DESIGN_IDS = ("5092", "30357", "35480", "51739", "77844", "93273")
PILOT_BYTES = 10_130
PILOT_SHA256 = "368753adec40d517c5063cbe23f28b9ff21108f0f8824bb0671b8c2575794613"
SCORECARD_SCHEMA_VERSION = "lego.part-admission-scorecard/1"


def read_pilot(path: Path) -> dict[str, object]:
    resolved = path.resolve(strict=True)
    data = resolved.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if len(data) != PILOT_BYTES or digest != PILOT_SHA256:
        raise ValueError(
            f"Source pilot {resolved} is {len(data)} bytes sha256:{digest}; the approved report is "
            f"{PILOT_BYTES} bytes sha256:{PILOT_SHA256}. Regenerate it with "
            "scripts/generate-set-6651557-source-pilot.py rather than re-pinning this scorer."
        )
    report = json.loads(data.decode("utf-8"))
    if report.get("schemaVersion") != "lego.set-6651557-source-pilot/1":
        raise ValueError(f"Source pilot schemaVersion is {report.get('schemaVersion')!r}.")
    if report.get("authority", {}).get("state") != "measurement-only-not-catalog-admitted":
        raise ValueError("Source pilot is not in the measurement-only authority state.")
    return report


def measured_surface(library: LDrawSourceLibrary, design_id: str) -> MeasuredSurface:
    root = library.exact("official", f"parts/{design_id}.dat")
    triangles = expand_surface(
        library, root, role_classifier(lambda key: library.record(key).sha256)
    )
    return MeasuredSurface(
        design_id=design_id,
        triangles=tuple(triangle.points for triangle in triangles),
        roles=tuple(triangle.role for triangle in triangles),
    )


def bind_to_pilot(surface: MeasuredSurface, pilot_part: dict[str, object]) -> dict[str, object]:
    """Refuse to score a surface that differs from the approved pilot measurement."""

    expected = pilot_part["ldraw"]
    if not isinstance(expected, dict):
        raise TypeError(f"Source pilot part {surface.design_id} has no ldraw measurement object.")
    studs = surface.by_role(STUD_ROLE)
    solid = tuple(
        triangle for triangle, role in zip(surface.triangles, surface.roles) if role != STUD_ROLE
    )
    points = [point for triangle in surface.triangles for point in triangle]
    actual: dict[str, object] = {
        "triangleCount": len(surface.triangles),
        "studTriangleCount": len(studs),
        "bodyTriangleCount": len(solid),
        "uniquePositionCount": len({point for point in points}),
        "boundsLdu": measure_bounds(points),
        "bodyBoundsLdu": measure_bounds([point for triangle in solid for point in triangle]),
    }
    if studs:
        actual["studBoundsLdu"] = measure_bounds(
            [point for triangle in studs for point in triangle]
        )
    for field, value in actual.items():
        if expected.get(field) != value:
            raise ValueError(
                f"Part {surface.design_id} expands to {field}={value!r}; the approved source pilot "
                f"records {expected.get(field)!r}. The archives, the expander or the stud policy "
                "changed, so this scorecard would not describe the reviewed surface."
            )
    return {"checkedFields": sorted(actual), "state": "reproduces-approved-source-pilot"}


def write_report(path: Path, report: dict[str, object]) -> str:
    repository = Path(__file__).resolve().parents[1]
    boundary = (repository / "output").resolve(strict=True)
    target = Path(os.path.abspath(os.fspath(path)))
    if not target.is_relative_to(boundary) or target == boundary:
        raise ValueError(f"The scorecard must stay below {boundary}; received {target}.")
    parent = target.parent
    parent.mkdir(parents=True, exist_ok=True)
    for directory in (boundary, parent):
        info = os.lstat(directory)
        if stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400):
            raise ValueError(f"Scorecard output path {directory} is a symlink or reparse point.")
    payload = canonical_bytes(report) + b"\n"
    temporary = parent / f"{target.name}.partial"
    temporary.write_bytes(payload)
    os.replace(temporary, target)
    return hashlib.sha256(payload).hexdigest()


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
    digest = write_report(arguments.output, report)
    print(f"measured in {time.monotonic() - started:.1f}s")
    print(f"wrote {arguments.output.resolve(strict=True)}")
    print(f"sha256:{digest}")


if __name__ == "__main__":
    main()
