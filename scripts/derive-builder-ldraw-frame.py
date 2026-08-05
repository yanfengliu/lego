"""Derive, verify and pin the Builder-to-LDraw frame of the 6651557 pilot parts.

Run:
  python -B scripts/derive-builder-ldraw-frame.py \
    --official C:/tmp/ldraw-complete-2026-07.zip \
    --unofficial C:/tmp/ldraw-unofficial-2026-08-02.zip \
    --native-pack C:/tmp/lego-21066-builder-native-part-pack.json

Every run re-expands the pinned archives, re-hashes the pinned native pack,
binds its surfaces to the approved source pilot, re-derives each frame from
scratch, and refuses to continue if the derived frame is not the pinned one.
It then emits the connectors each frame carries and scores them with the
existing part-admission scorer.

It measures and it emits candidates. It admits nothing: no PartDefinition is
written, BUILTIN_CATALOG_VERSION is untouched, no catalog frame is claimed, and
nothing is written outside the gitignored output tree.
"""

from __future__ import annotations

import argparse
import base64
import json
import time
from fractions import Fraction
from pathlib import Path

from builder_ldraw_field import (
    ABSENT_FAMILY,
    FEMALE_FAMILIES,
    MALE_FAMILIES,
    MARKER_FAMILIES,
    TUBE_FAMILIES,
    builder_field_nodes,
)
from builder_ldraw_frame import (
    BUILDER_NATIVE_FRAME_ID,
    FRAME_SCHEMA_VERSION,
    BuilderLdrawFrame,
    canonical_frame,
    emit_connectors,
    exact_frames,
    frames_modulo_symmetry,
    lattice_phase_census,
)
from builder_ldraw_frame_pins import (
    PINNED_FRAMES,
    UNAVAILABLE_DESIGN_IDS,
    check_pinned_digest,
    pinned_frame,
)
from builder_ldraw_frame_witness import (
    ldraw_self_symmetries,
    mesh_disagreement,
    native_shell_vertices,
    registered_frame,
)
from builder_native_source import (
    NATIVE_PACK_BYTES,
    NATIVE_PACK_SHA256,
    NATIVE_RECORD_SHA256,
    NATIVE_REVIEW_RECORD_SHA256,
    native_measurement,
    validate_native_pack,
)
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
from part_admission_surface import MeasuredSurface, measured_connectors
from set_6651557_ldraw_source_audit_plan import ARCHIVE_PINS

REPORT_SCHEMA_VERSION = "lego.builder-ldraw-frame-report/1"


def read_native_pack(path: Path) -> tuple[dict[str, dict[str, object]], bytes]:
    import hashlib

    resolved = path.resolve(strict=True)
    data = resolved.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if len(data) != NATIVE_PACK_BYTES or digest != NATIVE_PACK_SHA256:
        raise ValueError(
            f"Native pack {resolved} is {len(data)} bytes sha256:{digest}; the reviewed pack is "
            f"{NATIVE_PACK_BYTES} bytes sha256:{NATIVE_PACK_SHA256}. Re-acquire the reviewed bytes; "
            "do not update the pin."
        )
    by_id, binary, _ = validate_native_pack(json.loads(data.decode("utf-8")))
    return by_id, binary


def exact_anchor(value: float, label: str) -> Fraction:
    exact = Fraction(value)
    if exact.denominator != 1:
        raise ValueError(
            f"{label} measures {value!r}, which is not an integer LDU position. An exact frame is "
            "derived by rational equality against the stud lattice, so a fractional anchor has to "
            "be understood before it can anchor anything."
        )
    return exact


def ldraw_anchors(surface: MeasuredSurface) -> tuple[list[tuple[Fraction, ...]], list[tuple[Fraction, ...]]]:
    """Stud centres and underside tube centres, exactly, from the measured surface."""

    measured = measured_connectors(surface)
    studs = [
        (
            exact_anchor(row.center_xz[0], f"{surface.design_id} stud x"),
            exact_anchor(row.base_y, f"{surface.design_id} stud base y"),
            exact_anchor(row.center_xz[1], f"{surface.design_id} stud z"),
        )
        for row in measured["male"]
    ]
    tubes = [
        (
            exact_anchor(row.center_xz[0], f"{surface.design_id} tube x"),
            exact_anchor(row.y_max, f"{surface.design_id} tube opening y"),
            exact_anchor(row.center_xz[1], f"{surface.design_id} tube z"),
        )
        for row in measured["female"]
    ]
    return studs, tubes


def family_census(nodes) -> dict[str, object]:
    counts: dict[int, int] = {}
    for node in nodes:
        counts[node.family] = counts.get(node.family, 0) + 1
    named = {
        **{family: name for family, name in MALE_FAMILIES.items()},
        **{family: name for family, name in FEMALE_FAMILIES.items()},
        **{family: name for family, name in TUBE_FAMILIES.items()},
        **{family: name for family, name in MARKER_FAMILIES.items()},
        ABSENT_FAMILY: "absent-node",
    }
    return {
        "nodes": len(nodes),
        "byFamily": {
            str(family): {
                "count": count,
                "meaning": named.get(family, "unmapped"),
                "emitted": family in MALE_FAMILIES or family in FEMALE_FAMILIES,
            }
            for family, count in sorted(counts.items())
        },
    }


def derive_one(
    design_id: str,
    record: dict[str, object],
    surface: MeasuredSurface,
    vertices: list[tuple[float, float, float]],
) -> dict[str, object]:
    nodes = builder_field_nodes(record)
    revision = str(record["revision"])
    record_sha256 = str(record["recordSha256"])
    studs, tubes = ldraw_anchors(surface)
    symmetries = ldraw_self_symmetries(surface)
    candidates = exact_frames(design_id, revision, record_sha256, nodes, studs, tubes)
    classes = frames_modulo_symmetry(candidates, symmetries)
    witness: dict[str, object]
    if candidates:
        scored = [
            {
                "turn": candidates[group[0]].turn,
                "translationLdu": [str(v) for v in candidates[group[0]].translation],
                "members": len(group),
                **mesh_disagreement(candidates[group[0]], vertices, surface),
            }
            for group in classes
        ]
        scored.sort(key=lambda row: float(row["meanDistanceLdu"]))
        best = classes[
            [candidates[group[0]].turn for group in classes].index(str(scored[0]["turn"]))
        ]
        frame = canonical_frame([candidates[index] for index in best])
        witness = {
            "method": "exact-lattice-correspondence",
            "exactFrames": len(candidates),
            "equivalenceClasses": len(classes),
            "residualLdu": 0,
            "classes": scored,
            "selectionMarginRatio": (
                float(scored[1]["meanDistanceLdu"]) / float(scored[0]["meanDistanceLdu"])
                if len(scored) > 1 and float(scored[0]["meanDistanceLdu"]) > 0
                else None
            ),
        }
    else:
        frame, witness = registered_frame(
            design_id, revision, record_sha256, vertices, surface
        )
    check_pinned_digest(frame)
    pinned = pinned_frame(design_id)
    if (frame.turn, frame.translation, frame.derivation) != (
        pinned.turn,
        pinned.translation,
        pinned.derivation,
    ):
        raise ValueError(
            f"Derived frame for {design_id} is {frame.turn} {[str(v) for v in frame.translation]} "
            f"({frame.derivation}); the pin is {pinned.turn} "
            f"{[str(v) for v in pinned.translation]} ({pinned.derivation})."
        )
    round_trip = round_trip_check(frame, nodes)
    connectors = emit_connectors(nodes, frame)
    return {
        "designId": design_id,
        "builderRevision": revision,
        "builderRecordSha256": f"sha256:{record_sha256}",
        "frame": {
            "schemaVersion": FRAME_SCHEMA_VERSION,
            "builderNativeFrameId": BUILDER_NATIVE_FRAME_ID,
            "turn": frame.turn,
            "linearLdu": list(frame.linear),
            "translationLdu": [str(value) for value in frame.translation],
            "determinantSign": frame.determinant_sign,
            "derivation": frame.derivation,
            "sha256": f"sha256:{frame.digest}",
            "canonicalText": frame.canonical_text,
        },
        "derivationWitness": witness,
        "ldrawSelfSymmetries": [
            {"turn": turn, "translationLdu": [str(v) for v in translation]}
            for turn, translation in symmetries
        ],
        "roundTrip": round_trip,
        "studCorrespondence": {
            "builderMaleNodes": sum(1 for node in nodes if node.family in MALE_FAMILIES),
            "ldrawMeasuredStuds": len(studs),
            "maximumPositionErrorLdu": max_position_error(frame, nodes, MALE_FAMILIES, studs),
        },
        "tubeCorrespondence": {
            "builderTubeNodes": sum(1 for node in nodes if node.family in TUBE_FAMILIES),
            "ldrawMeasuredTubes": len(tubes),
            "maximumPositionErrorLdu": max_position_error(frame, nodes, TUBE_FAMILIES, tubes),
        },
        "nodeCensus": family_census(nodes),
        "latticePhaseByFamily": lattice_phase_census(nodes, frame),
        "emittedConnectors": connectors,
    }


def max_position_error(
    frame: BuilderLdrawFrame, nodes, families, targets: list[tuple[Fraction, ...]]
) -> str | None:
    selected = [node for node in nodes if node.family in families]
    if not selected or not targets:
        return None
    worst = Fraction(0)
    pool = list(targets)
    for node in selected:
        mapped = frame.apply(node.builder)
        best = min(pool, key=lambda target: sum(abs(mapped[a] - target[a]) for a in range(3)))
        worst = max(worst, max(abs(mapped[a] - best[a]) for a in range(3)))
        pool.remove(best)
    return str(worst)


def round_trip_check(frame: BuilderLdrawFrame, nodes) -> dict[str, object]:
    exact = all(frame.invert(frame.apply(node.builder)) == node.builder for node in nodes)
    if not exact:
        raise ValueError(
            f"Frame for {frame.design_id} does not round-trip its own nodes exactly. A frame that "
            "cannot be inverted cannot carry a document back to Builder coordinates."
        )
    return {
        "nodesChecked": len(nodes),
        "state": "builder-to-ldraw-to-builder-is-exactly-the-identity",
        "arithmetic": "exact rational, not floating point",
    }


def main() -> None:
    repository = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--official", type=Path, required=True)
    parser.add_argument("--unofficial", type=Path, required=True)
    parser.add_argument("--native-pack", type=Path, required=True)
    parser.add_argument(
        "--pilot", type=Path, default=repository / "output/real-build/set-6651557-source-pilot.json"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repository / "output/real-build/set-6651557-builder-ldraw-frame.json",
    )
    parser.add_argument("--column-ldu", type=float, default=DEFAULT_COLUMN_LDU)
    parser.add_argument("--sample-spacing-ldu", type=float, default=DEFAULT_SAMPLE_SPACING_LDU)
    arguments = parser.parse_args()

    pilot = read_pilot(arguments.pilot)
    pilot_parts = {str(row["designId"]): row for row in pilot["parts"]}  # type: ignore[index,union-attr]
    records, binary = read_native_pack(arguments.native_pack)
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

    parts: list[dict[str, object]] = []
    unavailable: list[dict[str, object]] = []
    scorecards: list[dict[str, object]] = []
    for design_id in PILOT_DESIGN_IDS:
        record = records.get(design_id)
        if record is None:
            fallback = validate_candidate(
                column_candidate(surfaces[design_id], arguments.column_ldu)
            )
            unavailable.append(
                {
                    "designId": design_id,
                    "state": "absent-from-the-107-record-builder-pack",
                    "cost": (
                        "no authored node lattice, so no frame, no revision pin and no female "
                        "connectors; it falls back to the LDraw geometric rule"
                    ),
                    "ldrawFallbackMaleConnectors": len(fallback.male_connectors),
                    "ldrawFallbackFemaleConnectors": len(fallback.female_connectors),
                    "ldrawMeasuredUndersideTubes": len(
                        measured_connectors(surfaces[design_id])["female"]
                    ),
                }
            )
            continue
        native_measurement(
            binary,
            record,
            NATIVE_RECORD_SHA256[design_id],
            NATIVE_REVIEW_RECORD_SHA256[design_id],
        )
        vertices = native_shell_vertices(binary, record)
        row = derive_one(design_id, record, surfaces[design_id], vertices)
        parts.append(row)
        print(
            f"{design_id}: {row['frame']['turn']} t={row['frame']['translationLdu']} "  # type: ignore[index]
            f"{row['frame']['derivation']} "  # type: ignore[index]
            f"studError={row['studCorrespondence']['maximumPositionErrorLdu']} "  # type: ignore[index]
            f"female={sum(1 for c in row['emittedConnectors'] if c['gender'] == 'female')}",  # type: ignore[index]
            flush=True,
        )
        candidate = validate_candidate(
            {
                "schemaVersion": CANDIDATE_SCHEMA_VERSION,
                "designId": design_id,
                "frame": CANDIDATE_FRAME,
                "derivation": (
                    f"builder-custom2dfield-connectors/{row['frame']['sha256']} over "  # type: ignore[index]
                    f"ldraw-column-height-field/{arguments.column_ldu:g}ldu bodies"
                ),
                "bodies": column_candidate(surfaces[design_id], arguments.column_ldu)["bodies"],
                "connectors": row["emittedConnectors"],
            }
        )
        scorecard = score_candidate(candidate, surfaces[design_id], arguments.sample_spacing_ldu)
        scorecards.append(scorecard)
        print(
            f"    scored: composite={float(scorecard['score']['composite']):.4f} "  # type: ignore[index,arg-type]
            f"maleMatched={scorecard['connectorCoverage']['male']['matched']} "  # type: ignore[index]
            f"clutchesWithRoom={scorecard['clutchRoom']['clutchesWithRoom']}"  # type: ignore[index]
            f"/{scorecard['clutchRoom']['declaredClutches']} "  # type: ignore[index]
            f"hardFails={[f['code'] for f in scorecard['hardFails']]}",  # type: ignore[index]
            flush=True,
        )

    report = {
        "schemaVersion": REPORT_SCHEMA_VERSION,
        "authority": {
            "state": "measurement-only-not-catalog-admitted",
            "partDefinitionsEmitted": False,
            "catalogVersionBumped": False,
            "catalogFrameClaimed": False,
            "builderToLdrawFrameClaimed": True,
            "connectorTruthClaimed": False,
            "collisionTruthClaimed": False,
            "runtimeExposed": False,
        },
        "inputs": {
            "sourcePilot": {"bytes": PILOT_BYTES, "sha256": f"sha256:{PILOT_SHA256}"},
            "nativePack": {"bytes": NATIVE_PACK_BYTES, "sha256": f"sha256:{NATIVE_PACK_SHA256}"},
            "officialArchive": {
                "bytes": ARCHIVE_PINS[0].byte_length,
                "sha256": f"sha256:{ARCHIVE_PINS[0].sha256}",
            },
            "unofficialArchive": {
                "bytes": ARCHIVE_PINS[1].byte_length,
                "sha256": f"sha256:{ARCHIVE_PINS[1].sha256}",
            },
        },
        "pilotBinding": bindings,
        "pinnedFrameDigests": {
            design_id: f"sha256:{frame.digest}" for design_id, frame in PINNED_FRAMES.items()
        },
        "unavailable": unavailable,
        "unavailableDesignIds": list(UNAVAILABLE_DESIGN_IDS),
        "parts": parts,
        "connectorScorecards": scorecards,
    }
    digest = write_output_report(arguments.output, report)
    print(f"measured in {time.monotonic() - started:.1f}s")
    print(f"wrote {arguments.output.resolve(strict=True)}")
    print(f"sha256:{digest}")


if __name__ == "__main__":
    main()
