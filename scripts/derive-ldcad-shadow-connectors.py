"""Measure the LDCad Shadow Library as a third connector source for set 6651557.

Run:
  python -B scripts/derive-ldcad-shadow-connectors.py \
    --official C:/tmp/ldraw-complete-2026-07.zip \
    --unofficial C:/tmp/ldraw-unofficial-2026-08-02.zip \
    --shadow C:/tmp/ldcad-shadow-20260802 \
    --native-pack C:/tmp/lego-21066-builder-native-part-pack.json

Female connectors are not recoverable from LDraw geometry: an underside is a
cavity, so the whole-footprint backing rule emits zero clutch cells, and the
measured tubes sit half a stud pitch off the cell lattice. Builder's authored
`Custom2DField` answers that for the parts it has a record for, and 30357 has
none. This asks whether the shadow library answers it for the rest.

It answers by measurement, in four steps that can each fail loudly:

  * the shadow tree is verified whole against a pinned manifest digest first;
  * the composed male studs are checked against the LDraw-measured stud centres,
    so the transform composition is validated before its female claims are read;
  * every clutch it emits for a part Builder also covers is compared position by
    position against the pinned Builder frame report; and
  * every clutch it emits at all is driven through the existing clutchRoom probe
    against the real expanded LDraw surface, because authored metadata is a claim
    and the geometry is what checks it.

It measures. It emits no `PartDefinition`, bumps no catalog version, claims no
catalog frame, and writes only inside the gitignored output tree.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from builder_native_source import NATIVE_PACK_BYTES, NATIVE_PACK_SHA256
from ldcad_shadow_connectors import (
    SHADOW_COMPOSITION_ID,
    ShadowSnap,
    compose_part_snaps,
    emit_clutch_connectors,
    emit_stud_connectors,
    snap_census,
)
from ldcad_shadow_coverage import (
    BUILDER_FRAME_BYTES,
    BUILDER_FRAME_SHA256,
    POSITION_TOLERANCE_LDU,
    builder_clutch_claims,
    compare_positions,
    compare_studs,
    coverage_row,
    grip_evidence,
    read_builder_frames,
    summarize_coverage,
)
from ldcad_shadow_source import VerifiedShadowLibrary
from ldraw_source_archive import LDrawSourceLibrary, VerifiedArchive
from part_admission_contract import (
    CANDIDATE_FRAME,
    CANDIDATE_SCHEMA_VERSION,
    validate_candidate,
)
from part_admission_evidence import (
    PILOT_BYTES,
    PILOT_DESIGN_IDS,
    PILOT_SHA256,
    bind_to_pilot,
    measured_surface,
    read_pilot,
    write_output_report,
)
from part_admission_ldraw_candidate import DEFAULT_COLUMN_LDU, column_candidate
from part_admission_scorecard import DEFAULT_SAMPLE_SPACING_LDU, score_candidate
from part_admission_surface import measured_connectors
from set_6651557_ldraw_source_audit_plan import ARCHIVE_PINS

REPORT_SCHEMA_VERSION = "lego.ldcad-shadow-connector-report/2"
MAX_RECORDED_REJECTIONS = 64


def rejection_recorder() -> tuple[list[dict[str, object]], object]:
    rows: list[dict[str, object]] = []

    def record(reason: str, snap: ShadowSnap) -> None:
        if len(rows) < MAX_RECORDED_REJECTIONS:
            rows.append(
                {
                    "reason": reason,
                    "source": f"{snap.source_path}:{snap.source_line}",
                    "positionLdu": [str(value) for value in snap.position],
                }
            )

    return rows, record


def measure_pilot(
    library: LDrawSourceLibrary,
    shadow: VerifiedShadowLibrary,
    surfaces: dict[str, object],
    builder_frames: dict[str, list[list[float]]],
    column_ldu: float,
    sample_spacing_ldu: float,
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    parts: list[dict[str, object]] = []
    scorecards: list[dict[str, object]] = []
    for design_id in PILOT_DESIGN_IDS:
        surface = surfaces[design_id]
        composition = compose_part_snaps(library, shadow, ("official", f"parts/{design_id}.dat"))
        rejections, recorder = rejection_recorder()
        clutches = emit_clutch_connectors(composition.snaps, on_reject=recorder)  # type: ignore[arg-type]
        studs = emit_stud_connectors(composition.snaps)
        truth = measured_connectors(surface)  # type: ignore[arg-type]
        builder = builder_frames.get(design_id)
        row: dict[str, object] = {
            "designId": design_id,
            "shadowFiles": composition.shadow_files_used,
            "ldrawFilesWalked": composition.files_visited,
            "metasByCommand": composition.metas_by_command,
            "snapCensus": snap_census(composition.snaps),
            "emittedClutches": clutches,
            "emittedStuds": len(studs),
            "rejectedSnaps": rejections,
            "gripEvidence": grip_evidence(
                clutches, [tube.position for tube in truth["female"]]
            ),
            "studValidation": compare_studs(studs, [stud.position for stud in truth["male"]]),
            "builderComparison": (
                {"state": "builder-has-no-record-for-this-design", "ldcadClutches": len(clutches)}
                if builder is None
                else compare_positions(
                    sorted([float(v) for v in c["positionLdu"]] for c in clutches), builder
                )
            ),
        }
        parts.append(row)
        candidate = validate_candidate(
            {
                "schemaVersion": CANDIDATE_SCHEMA_VERSION,
                "designId": design_id,
                "frame": CANDIDATE_FRAME,
                "derivation": (
                    f"{SHADOW_COMPOSITION_ID} connectors over "
                    f"ldraw-column-height-field/{column_ldu:g}ldu bodies"
                ),
                "bodies": column_candidate(surface, column_ldu)["bodies"],  # type: ignore[arg-type]
                "connectors": studs + clutches,
            }
        )
        scorecard = score_candidate(candidate, surface, sample_spacing_ldu)  # type: ignore[arg-type]
        scorecards.append(scorecard)
        print(
            f"{design_id}: shadowFiles={len(composition.shadow_files_used)} "
            f"clutches={len(clutches)} studs={len(studs)} "
            f"builder={row['builderComparison'].get('agreementState', 'no-record')} "  # type: ignore[union-attr]
            f"composite={float(scorecard['score']['composite']):.4f} "  # type: ignore[index,arg-type]
            f"clutchRoom={scorecard['clutchRoom']['clutchesWithRoom']}"  # type: ignore[index]
            f"/{scorecard['clutchRoom']['declaredClutches']} "  # type: ignore[index]
            f"hardFails={[f['code'] for f in scorecard['hardFails']]}",  # type: ignore[index]
            flush=True,
        )
    return parts, scorecards


def main() -> None:
    repository = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--official", type=Path, required=True)
    parser.add_argument("--unofficial", type=Path, required=True)
    parser.add_argument("--shadow", type=Path, required=True)
    parser.add_argument("--native-pack", type=Path, required=True)
    parser.add_argument(
        "--pilot", type=Path, default=repository / "output/real-build/set-6651557-source-pilot.json"
    )
    parser.add_argument(
        "--builder-frame",
        type=Path,
        default=repository / "output/real-build/set-6651557-builder-ldraw-frame.json",
    )
    parser.add_argument(
        "--audit",
        type=Path,
        default=repository
        / "packages/catalog/src/quarantine/set-6651557-ldraw-source-audit.generated.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repository / "output/real-build/set-6651557-ldcad-shadow.json",
    )
    parser.add_argument("--column-ldu", type=float, default=DEFAULT_COLUMN_LDU)
    parser.add_argument("--sample-spacing-ldu", type=float, default=DEFAULT_SAMPLE_SPACING_LDU)
    arguments = parser.parse_args()

    pilot = read_pilot(arguments.pilot)
    pilot_parts = {str(row["designId"]): row for row in pilot["parts"]}  # type: ignore[index,union-attr]
    builder_frames = read_builder_frames(arguments.builder_frame)
    builder_claims = builder_clutch_claims(arguments.native_pack)
    audit = json.loads(arguments.audit.read_bytes().decode("utf-8"))
    shadow = VerifiedShadowLibrary(arguments.shadow)
    archive_paths = {"official": arguments.official, "unofficial": arguments.unofficial}
    library = LDrawSourceLibrary(
        [VerifiedArchive(archive_paths[pin.archive_id], pin) for pin in ARCHIVE_PINS]
    )
    started = time.monotonic()
    try:
        library.verify_unchanged()
        surfaces: dict[str, object] = {}
        bindings: dict[str, object] = {}
        for design_id in PILOT_DESIGN_IDS:
            surfaces[design_id] = measured_surface(library, design_id)
            bindings[design_id] = bind_to_pilot(surfaces[design_id], pilot_parts[design_id])  # type: ignore[arg-type]
        coverage = [
            coverage_row(
                library,
                shadow,
                str(row["designId"]),
                row.get("rootFileId"),
                builder_claims.get(str(row["designId"])),
            )
            for row in audit["parts"]
        ]
        library.verify_unchanged()
        parts, scorecards = measure_pilot(
            library,
            shadow,
            surfaces,
            builder_frames,
            arguments.column_ldu,
            arguments.sample_spacing_ldu,
        )
        library.verify_unchanged()
    finally:
        library.close()

    report = {
        "schemaVersion": REPORT_SCHEMA_VERSION,
        "authority": {
            "state": "measurement-only-not-catalog-admitted",
            "partDefinitionsEmitted": False,
            "catalogVersionBumped": False,
            "catalogFrameClaimed": False,
            "connectorTruthClaimed": False,
            "collisionTruthClaimed": False,
            "builderFramePinsModified": False,
            "runtimeExposed": False,
        },
        "inputs": {
            "shadowLibrary": shadow.identity(),
            "sourcePilot": {"bytes": PILOT_BYTES, "sha256": f"sha256:{PILOT_SHA256}"},
            "builderFrameReport": {
                "bytes": BUILDER_FRAME_BYTES,
                "sha256": f"sha256:{BUILDER_FRAME_SHA256}",
                "role": "read-only comparison target; its frame pins are not touched",
            },
            "nativePack": {
                "bytes": NATIVE_PACK_BYTES,
                "sha256": f"sha256:{NATIVE_PACK_SHA256}",
                "role": (
                    "checksum-pinned source of record-level clutch-count counterevidence; "
                    "it grants no catalog frame or connector authority"
                ),
            },
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
            "positionToleranceLdu": POSITION_TOLERANCE_LDU,
            "compositionId": SHADOW_COMPOSITION_ID,
        },
        "pilotBinding": bindings,
        "pilotParts": parts,
        "connectorScorecards": scorecards,
        "requiredLeafCoverage": coverage,
        "coverageSummary": summarize_coverage(coverage, builder_claims),
    }
    digest = write_output_report(arguments.output, report)
    print(f"measured in {time.monotonic() - started:.1f}s")
    print(f"wrote {arguments.output.resolve(strict=True)}")
    print(f"sha256:{digest}")


if __name__ == "__main__":
    main()
