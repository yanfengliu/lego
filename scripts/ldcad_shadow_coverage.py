"""Compare the shadow library's clutch claims with what is already known.

Three things this repository already established are the only reason an LDCad
measurement can be believed or doubted at all: the LDraw-measured visible stud
primitives, the pinned Builder-to-LDraw frame report and its emitted clutch
cells, and the 121 required leaves of the 6651557 source-resolution audit. This
module holds the comparisons against all three, and the pin that keeps the
Builder report read-only.

It compares and it counts. It emits no `PartDefinition`, admits nothing, and
writes nothing.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from ldcad_shadow_connectors import (
    compose_part_snaps,
    emit_clutch_connectors,
    emit_stud_connectors,
    snap_census,
)
from ldcad_shadow_source import VerifiedShadowLibrary
from ldraw_source_archive import LDrawSourceLibrary

# The Builder frame report this measurement is checked against. It is read, not
# written: the frame pins it carries stay exactly as
# scripts/derive-builder-ldraw-frame.py produced them, and a byte that differs
# is a refusal rather than a re-pin.
BUILDER_FRAME_BYTES = 46_200
BUILDER_FRAME_SHA256 = "fdc1281ceed64863f1d9622a3ad6cbc93591e285cdcf1d9e68657c39e404f849"
BUILDER_FRAME_SCHEMA = "lego.builder-ldraw-frame-report/1"
BUILDER_FEMALE_FAMILY = 15
POSITION_TOLERANCE_LDU = 1e-9
TUBE_AT_CELL_CORNER_LDU = 10.0
TUBE_CORNER_TOLERANCE_LDU = 1e-6


def read_builder_frames(path: Path) -> dict[str, list[list[float]]]:
    """The pinned Builder clutch positions, per design, or a refusal naming the drift."""

    resolved = path.resolve(strict=True)
    data = resolved.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if len(data) != BUILDER_FRAME_BYTES or digest != BUILDER_FRAME_SHA256:
        raise ValueError(
            f"Builder frame report {resolved} is {len(data)} bytes sha256:{digest}; the pinned "
            f"report is {BUILDER_FRAME_BYTES} bytes sha256:{BUILDER_FRAME_SHA256}. Regenerate it "
            "with scripts/derive-builder-ldraw-frame.py rather than re-pinning this reader; this "
            "measurement compares against it and must not move it."
        )
    report = json.loads(data.decode("utf-8"))
    if report.get("schemaVersion") != BUILDER_FRAME_SCHEMA:
        raise ValueError(
            f"Builder frame report schemaVersion is {report.get('schemaVersion')!r}; expected "
            f"{BUILDER_FRAME_SCHEMA!r}."
        )
    return {
        str(part["designId"]): sorted(
            [float(value) for value in row["positionLdu"]]
            for row in part["emittedConnectors"]
            if row["gender"] == "female"
        )
        for part in report["parts"]
    }


def compare_positions(ldcad: list[list[float]], builder: list[list[float]]) -> dict[str, object]:
    """Position-by-position agreement between two clutch sets, in LDU."""

    pairs = sorted(
        (max(abs(left[axis] - right[axis]) for axis in range(3)), index, other)
        for index, left in enumerate(ldcad)
        for other, right in enumerate(builder)
    )
    used_left: set[int] = set()
    used_right: set[int] = set()
    matched: list[dict[str, object]] = []
    for distance, index, other in pairs:
        if index in used_left or other in used_right or distance > POSITION_TOLERANCE_LDU:
            continue
        used_left.add(index)
        used_right.add(other)
        matched.append({"positionLdu": ldcad[index], "chebyshevErrorLdu": distance})
    matched.sort(key=lambda row: tuple(row["positionLdu"]))  # type: ignore[arg-type]
    return {
        "ldcadClutches": len(ldcad),
        "builderClutches": len(builder),
        "agreeing": len(matched),
        "maximumErrorOnAgreeingLdu": max(
            (float(row["chebyshevErrorLdu"]) for row in matched), default=0.0
        ),
        "onlyInLdcadLdu": [row for index, row in enumerate(ldcad) if index not in used_left],
        "onlyInBuilderLdu": [row for index, row in enumerate(builder) if index not in used_right],
        "agreementState": (
            "identical-sets" if len(matched) == len(ldcad) == len(builder) else "sets-differ"
        ),
    }


def compare_studs(
    ldcad: list[dict[str, object]], surface_studs: list[tuple[float, float, float]]
) -> dict[str, object]:
    """Composed male studs against the LDraw-measured visible stud centres.

    This is the check that validates the walk itself. The shadow library says
    nothing about where a stud is — it inherits `p/stud.dat` through the same
    type-1 matrices the geometry uses — so if the composition were wrong these
    would not land on the measured primitives, and no female claim from the same
    walk could be believed either.
    """

    positions = [[float(value) for value in row["positionLdu"]] for row in ldcad]
    return compare_positions(positions, [list(point) for point in surface_studs]) | {
        "truthSource": "ldraw-visible-stud-primitive-components",
    }


def grip_evidence(
    clutches: list[dict[str, object]], tubes: list[tuple[float, float, float]]
) -> list[dict[str, object]]:
    """How near each declared grip sits to a real underside tube.

    The clutchRoom probe answers whether a stud *fits*; it cannot answer whether
    anything *holds* it. A stud is gripped between the tubes and walls at the
    corners of its cell, so a tube exactly 10 LDU away in both plan axes is the
    geometry that makes the claim work, and a claimed cell with no tube within a
    stud pitch is a claim resting on a wall instead. This measures the distance
    and leaves the judgement to the reader rather than turning it into a verdict.
    """

    rows: list[dict[str, object]] = []
    for clutch in clutches:
        position = [float(value) for value in clutch["positionLdu"]]  # type: ignore[union-attr]
        distances = [
            max(abs(position[0] - tube[0]), abs(position[2] - tube[2])) for tube in tubes
        ]
        rows.append(
            {
                "positionLdu": position,
                "measuredTubes": len(tubes),
                "nearestTubeChebyshevXZLdu": min(distances) if distances else None,
                "tubesAtThisCellsCorners": sum(
                    1
                    for distance in distances
                    if abs(distance - TUBE_AT_CELL_CORNER_LDU) <= TUBE_CORNER_TOLERANCE_LDU
                ),
            }
        )
    return rows


def coverage_row(
    library: LDrawSourceLibrary,
    shadow: VerifiedShadowLibrary,
    design_id: str,
    root_file_id: str | None,
    builder_clutch_nodes: int | None,
) -> dict[str, object]:
    """One required leaf: what each source has for it, if anything.

    A leaf with no clutch from either source is not automatically a hole in the
    reconstruction — a minifig arm, a bar and an axle have no anti-stud to
    author — so the census of what female cylinders the walk *did* find is kept
    beside the count, and the difference is left visible instead of averaged.
    """

    common = {
        "designId": design_id,
        "builderHasRecord": builder_clutch_nodes is not None,
        "builderClutchNodes": builder_clutch_nodes,
    }
    if root_file_id is None:
        return common | {
            "state": "no-selected-ldraw-root-so-no-composed-walk",
            "shadowFileByDesignId": shadow.resolve(f"{design_id}.dat"),
            "shadowFilesNamedLikeDesign": shadow.variants(design_id),
            "shadowFilesInClosure": 0,
            "antiStudClutches": 0,
            "studs": 0,
            "femaleCylindersNotAntiStud": 0,
        }
    archive_id, path = root_file_id.split(":", 1)
    composition = compose_part_snaps(library, shadow, (archive_id, path))
    clutches = emit_clutch_connectors(composition.snaps)
    return common | {
        "state": "composed",
        "rootFileId": root_file_id,
        "ldrawFilesWalked": composition.files_visited,
        "shadowFilesInClosure": len(composition.shadow_files_used),
        "shadowFiles": composition.shadow_files_used,
        "antiStudClutches": len(clutches),
        "studs": len(emit_stud_connectors(composition.snaps)),
        "femaleCylindersNotAntiStud": sum(
            1
            for snap in composition.snaps
            if snap.command == "SNAP_CYL" and snap.gender == "F" and not snap.is_anti_stud
        ),
        "snapShapes": snap_census(composition.snaps)["byCommandGenderShape"],
        "metasByCommand": composition.metas_by_command,
        "snapsClearedBySnapClear": composition.cleared,
        "includesFollowed": composition.includes_followed,
        "nestedIncludesNotFollowed": composition.nested_includes_not_followed,
    }


def builder_clutch_claims(pack_path: Path) -> dict[str, int]:
    """How many under-stud-clutch nodes each Builder record authors, by design.

    Read straight off the `Custom2DField` grid codes rather than through the
    frame derivation, because coverage is a question about whether Builder
    authored a claim at all — a record whose field this repository cannot yet
    place still authored one.
    """

    from builder_native_source import NATIVE_PACK_BYTES, NATIVE_PACK_SHA256, validate_native_pack

    resolved = pack_path.resolve(strict=True)
    data = resolved.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if len(data) != NATIVE_PACK_BYTES or digest != NATIVE_PACK_SHA256:
        raise ValueError(
            f"Native pack {resolved} is {len(data)} bytes sha256:{digest}; the reviewed pack is "
            f"{NATIVE_PACK_BYTES} bytes sha256:{NATIVE_PACK_SHA256}. Re-acquire the reviewed bytes; "
            "do not update the pin."
        )
    records, _, _ = validate_native_pack(json.loads(data.decode("utf-8")))
    claims: dict[str, int] = {}
    for design_id, record in records.items():
        total = 0
        for primitive in record.get("connectivityPrimitives", []):
            if not isinstance(primitive, dict) or primitive.get("kind") != "Custom2DField":
                continue
            for cell in str(primitive.get("grid", "")).split(","):
                head = cell.strip().split(":")[0]
                if head.isdecimal() and int(head) == BUILDER_FEMALE_FAMILY:
                    total += 1
        claims[str(design_id)] = total
    return claims


def summarize_coverage(
    rows: list[dict[str, object]], builder_claims: dict[str, int]
) -> dict[str, object]:
    """Female-connector coverage over the required leaves, source by source."""

    with_shadow = [row for row in rows if int(row["shadowFilesInClosure"]) > 0]  # type: ignore[arg-type]
    with_female = [row for row in rows if int(row["antiStudClutches"]) > 0]  # type: ignore[arg-type]
    builder_covered = {
        str(row["designId"]) for row in rows if builder_claims.get(str(row["designId"]), 0) > 0
    }
    ldcad_covered = {str(row["designId"]) for row in with_female}
    uncovered_rows = [
        row
        for row in rows
        if str(row["designId"]) not in builder_covered and str(row["designId"]) not in ldcad_covered
    ]
    return {
        "requiredLeaves": len(rows),
        "withAnyShadowFileInClosure": len(with_shadow),
        "withAtLeastOneAntiStudClutch": len(with_female),
        "totalAntiStudClutches": sum(int(row["antiStudClutches"]) for row in rows),  # type: ignore[arg-type]
        "builderRecords": sum(1 for row in rows if row["builderHasRecord"]),
        "builderAuthorsAClutchClaim": len(builder_covered),
        "builderRecordsWithNoClutchClaim": sum(
            1
            for row in rows
            if row["builderHasRecord"] and not builder_claims.get(str(row["designId"]))
        ),
        "bothSources": len(builder_covered & ldcad_covered),
        "ldcadOnly": sorted(ldcad_covered - builder_covered),
        "builderOnly": sorted(builder_covered - ldcad_covered),
        "femaleUncoveredByEitherSource": sorted(str(row["designId"]) for row in uncovered_rows),
        "femaleUncoveredCount": len(uncovered_rows),
        "uncoveredWithSomeOtherFemaleCylinder": sorted(
            str(row["designId"])
            for row in uncovered_rows
            if int(row["femaleCylindersNotAntiStud"]) > 0  # type: ignore[arg-type]
        ),
        "ldrawFemaleContribution": 0,
        "ldrawFemaleContributionReason": (
            "an LDraw underside is a cavity, so the whole-footprint backing rule emits no clutch "
            "cell on any part and the measured tubes sit 10 LDU off the cell lattice; LDraw "
            "contributes zero female connectors by construction, not by omission"
        ),
    }
