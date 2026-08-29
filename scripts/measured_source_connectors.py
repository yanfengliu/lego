"""Bind exact authored non-stud connector projections to admitted design identities."""

from __future__ import annotations

from fractions import Fraction
from typing import Sequence

from ldcad_shadow_axle_holes import (
    emit_axle_hole_connectors,
    is_axle_hole_declaration,
)
from ldcad_shadow_axles import emit_axle_connectors
from ldcad_shadow_connectors import ShadowSnap, axis_normal, exact_float
from measured_source_connector_rows import (
    CONNECTOR_AXIAL_SPAN_SCHEMA_VERSION,
    THROUGH_AXLE_BORE_COLLISION_SCHEMA_VERSION,
    ConnectorAxialSpan,
    MeasuredSourceConnector,
    ThroughAxleBoreCollisionEvidence,
)

EXACT_32064A_SHADOW_FILES = [
    "p/axlehol5.dat",
    "p/stud2.dat",
    "parts/32064a.dat",
]
EXACT_32064A_SOURCE_FACTS = {
    "path": "p/axlehol5.dat",
    "command": "SNAP_CYL",
    "id": "axlehole",
    "group": "",
    "section": "A 6 1",
    "caps": "none",
    "slide": True,
    "centered": False,
    "gridCount": 1,
    "scale": "YOnly",
    "mirror": None,
    "startLdu": [0.0, 10.0, -10.0],
    "endLdu": [0.0, 10.0, 10.0],
    "midpointLdu": [0.0, 10.0, 0.0],
    "direction": [0.0, 0.0, 1.0],
    "segmentLengthLdu": 20.0,
}
EXACT_73230_SHADOW_FILES = [
    "p/axlehol4.dat",
    "p/stud2.dat",
    "parts/73230.dat",
]
EXACT_73230_SOURCE_FACTS = {
    "path": "p/axlehol4.dat",
    "command": "SNAP_CYL",
    "id": "axlehole",
    "group": "",
    "section": "A 6 1",
    "caps": "none",
    "slide": True,
    "centered": False,
    "gridCount": 1,
    "scale": "YOnly",
    "mirror": None,
    "startLdu": [0.0, 10.0, 10.0],
    "endLdu": [0.0, 10.0, -10.0],
    "midpointLdu": [0.0, 10.0, 0.0],
    "direction": [0.0, 0.0, -1.0],
    "segmentLengthLdu": 20.0,
}
EXACT_3245B_SHADOW_FILES = [
    "p/stud.dat",
    "parts/3245b.dat",
    "parts/s/3245bs02.dat",
]
EXACT_3245B_AXLE_HOLDER_SOURCE_FACTS = {
    "path": "parts/3245b.dat",
    "line": 12,
    "command": "SNAP_CYL",
    "gender": "F",
    "id": "",
    "group": "",
    "section": "A 6 44",
    "caps": "one",
    "slide": False,
    "centered": False,
    "gridCount": 1,
    "scale": None,
    "mirror": None,
    "positionLdu": [0.0, 48.0, 0.0],
    "orientation": [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
    "startLdu": [0.0, 48.0, 0.0],
    "endLdu": [0.0, 4.0, 0.0],
    "openEndLdu": [0.0, 48.0, 0.0],
    "closedEndLdu": [0.0, 4.0, 0.0],
    "midpointLdu": [0.0, 26.0, 0.0],
    "direction": [0.0, -1.0, 0.0],
    "outwardNormal": [0.0, 1.0, 0.0],
    "segmentLengthLdu": 44.0,
}


def _is_a6x44_axle_holder(snap: ShadowSnap) -> bool:
    return (
        snap.command == "SNAP_CYL"
        and snap.gender == "F"
        and len(snap.sections) == 1
        and snap.sections[0].variant == "A"
        and snap.sections[0].radius == 6
        and snap.sections[0].length == 44
    )


def _axle_holder_source_facts(snap: ShadowSnap) -> dict[str, object]:
    direction = snap.hole_direction
    length = snap.sections[0].length if len(snap.sections) == 1 else Fraction(0)
    end = tuple(snap.position[axis] + direction[axis] * length for axis in range(3))
    midpoint = tuple((snap.position[axis] + end[axis]) / 2 for axis in range(3))
    return {
        "path": snap.source_path,
        "line": snap.source_line,
        "command": snap.command,
        "gender": snap.gender,
        "id": snap.snap_id,
        "group": snap.group,
        "section": (
            f"{snap.sections[0].variant} {snap.sections[0].radius} "
            f"{snap.sections[0].length}"
            if len(snap.sections) == 1
            else None
        ),
        "caps": snap.caps,
        "slide": snap.slide,
        "centered": snap.centered,
        "gridCount": snap.grid_count,
        "scale": snap.transform_modifiers[0],
        "mirror": snap.transform_modifiers[1],
        "positionLdu": [float(value) for value in snap.position],
        "orientation": [float(value) for value in snap.orientation],
        "startLdu": [float(value) for value in snap.position],
        "endLdu": [float(value) for value in end],
        "openEndLdu": [float(value) for value in snap.position],
        "closedEndLdu": [float(value) for value in end],
        "midpointLdu": [float(value) for value in midpoint],
        "direction": [float(value) for value in direction],
        "outwardNormal": [float(-value) for value in direction],
        "segmentLengthLdu": float(length),
    }


def _project_3245b_blind_axle_holder(snap: ShadowSnap) -> MeasuredSourceConnector:
    """Project one fixed blind A6 holder to its exact source-local midpoint."""

    direction = snap.hole_direction
    outward_direction = tuple(-value for value in direction)
    normal = axis_normal(outward_direction)
    if normal is None:
        raise ValueError("Part 3245b's blind axle-holder direction must be axis aligned.")
    length = snap.sections[0].length
    end = tuple(snap.position[axis] + direction[axis] * length for axis in range(3))
    midpoint = tuple((snap.position[axis] + end[axis]) / 2 for axis in range(3))
    if any(value.denominator != 1 for value in (*snap.position, *end, *midpoint)):
        raise ValueError("Part 3245b's blind axle-holder span must stay on whole LDU.")
    open_end = tuple(
        exact_float(value, f"{snap.source_path}:{snap.source_line} axle-holder open end")
        for value in snap.position
    )
    closed_end = tuple(
        exact_float(value, f"{snap.source_path}:{snap.source_line} axle-holder closed end")
        for value in end
    )
    return MeasuredSourceConnector(
        kind="blindAxleHole",
        position_ldu=tuple(
            exact_float(value, f"{snap.source_path}:{snap.source_line} axle-holder midpoint")
            for value in midpoint
        ),
        normal=normal,
        axial_span=ConnectorAxialSpan(
            schema_version=CONNECTOR_AXIAL_SPAN_SCHEMA_VERSION,
            open_end_ldu=open_end,
            closed_end_ldu=closed_end,
            depth_ldu=exact_float(
                length, f"{snap.source_path}:{snap.source_line} axle-holder depth"
            ),
            sliding=False,
        ),
    )


def _projection_from_emitted_row(
    row: dict[str, object], *, retain_through_bore: bool = False
) -> MeasuredSourceConnector:
    source = row.get("source")
    through_bore = None
    if retain_through_bore:
        if not isinstance(source, dict):
            raise ValueError("A measured through axle-hole row must retain its source segment.")
        source_section = source.get("section")
        section_tokens = str(source_section).split()
        if section_tokens != ["A", "6", "1"]:
            raise ValueError(
                f"A measured through axle-hole needs source section A 6 1, received {source_section!r}."
            )
        through_bore = ThroughAxleBoreCollisionEvidence(
            schema_version=THROUGH_AXLE_BORE_COLLISION_SCHEMA_VERSION,
            source_section="A 6 1",
            start_ldu=tuple(source["startLdu"]),  # type: ignore[arg-type]
            end_ldu=tuple(source["endLdu"]),  # type: ignore[arg-type]
            radius_ldu=float(section_tokens[1]),
            segment_length_ldu=float(source["segmentLengthLdu"]),
            caps=str(source["caps"]),
            sliding=bool(source["slide"]),
        )
    return MeasuredSourceConnector(
        kind=str(row["kind"]),
        position_ldu=tuple(row["positionLdu"]),  # type: ignore[arg-type]
        normal=tuple(row["normal"]),  # type: ignore[arg-type]
        through_bore_collision=through_bore,
    )


def source_connectors_for(
    design_id: str, snaps: Sequence[ShadowSnap], shadow_files: Sequence[str]
) -> list[MeasuredSourceConnector]:
    """Admit exact reviewed source projections for bounded named designs."""

    eligible = [snap for snap in snaps if snap.is_axle_shaft]
    axles = emit_axle_connectors(snaps)
    eligible_holes = [snap for snap in snaps if is_axle_hole_declaration(snap)]
    axle_holes = emit_axle_hole_connectors(snaps)
    holders = [snap for snap in snaps if _is_a6x44_axle_holder(snap)]
    if design_id == "3245b":
        holder_facts = [_axle_holder_source_facts(snap) for snap in holders]
        holder_rows = [_project_3245b_blind_axle_holder(snap) for snap in holders]
        projected = holder_rows
        expected_projection = [
            MeasuredSourceConnector(
                kind="blindAxleHole",
                position_ldu=tuple(
                    EXACT_3245B_AXLE_HOLDER_SOURCE_FACTS["midpointLdu"]  # type: ignore[arg-type]
                ),
                normal=tuple(
                    EXACT_3245B_AXLE_HOLDER_SOURCE_FACTS["outwardNormal"]  # type: ignore[arg-type]
                ),
                axial_span=ConnectorAxialSpan(
                    schema_version=CONNECTOR_AXIAL_SPAN_SCHEMA_VERSION,
                    open_end_ldu=tuple(
                        EXACT_3245B_AXLE_HOLDER_SOURCE_FACTS["openEndLdu"]  # type: ignore[arg-type]
                    ),
                    closed_end_ldu=tuple(
                        EXACT_3245B_AXLE_HOLDER_SOURCE_FACTS["closedEndLdu"]  # type: ignore[arg-type]
                    ),
                    depth_ldu=EXACT_3245B_AXLE_HOLDER_SOURCE_FACTS["segmentLengthLdu"],  # type: ignore[arg-type]
                    sliding=False,
                ),
            )
        ]
        if (
            len(holders) != 1
            or holder_facts != [EXACT_3245B_AXLE_HOLDER_SOURCE_FACTS]
            or projected != expected_projection
            or list(shadow_files) != EXACT_3245B_SHADOW_FILES
            or eligible
            or axles
            or eligible_holes
            or axle_holes
        ):
            raise ValueError(
                "Part 3245b requires exactly one fixed female one-cap A6x44 declaration, "
                f"source facts {EXACT_3245B_AXLE_HOLDER_SOURCE_FACTS}, midpoint projection "
                f"{expected_projection}, exactly the shadow closure {EXACT_3245B_SHADOW_FILES}, "
                "and no competing generic axle projection; measured holder facts "
                f"{holder_facts}, projection {projected}, closure {list(shadow_files)}, "
                f"{len(axles)} axle endpoints, and {len(axle_holes)} generic axle-hole endpoints."
            )
        return holder_rows
    if design_id == "4519":
        source_paths = [snap.source_path for snap in eligible]
        if (
            len(eligible) != 1
            or source_paths != ["parts/4519.dat"]
            or len(axles) != 3
            or list(shadow_files) != ["parts/4519.dat"]
        ):
            raise ValueError(
                "Part 4519 requires exactly one eligible declaration from parts/4519.dat, "
                "exactly three emitted seats, and only parts/4519.dat in the composed shadow "
                f"closure; measured {len(eligible)} declarations from {source_paths}, "
                f"{len(axles)} seats, and closure {list(shadow_files)}."
            )
        return [_projection_from_emitted_row(row) for row in axles]
    axle_hole_route = (
        (EXACT_32064A_SHADOW_FILES, EXACT_32064A_SOURCE_FACTS)
        if design_id in ("32064", "32064a")
        else (EXACT_73230_SHADOW_FILES, EXACT_73230_SOURCE_FACTS)
        if design_id == "73230"
        else None
    )
    if axle_hole_route is not None:
        expected_shadow_files, expected_source_facts = axle_hole_route
        source_paths = [snap.source_path for snap in eligible_holes]
        projected = [
            (row.get("kind"), row.get("gender"), row.get("positionLdu"), row.get("normal"))
            for row in axle_holes
        ]
        source = axle_holes[0].get("source") if len(axle_holes) == 1 else None
        source_facts = (
            {key: source.get(key) for key in expected_source_facts}
            if isinstance(source, dict)
            else None
        )
        expected_projection = [
            (
                "axleHole",
                "female",
                expected_source_facts["midpointLdu"],
                expected_source_facts["direction"],
            )
        ]
        if (
            len(eligible_holes) != 1
            or eligible
            or axles
            or source_paths != [expected_source_facts["path"]]
            or projected != expected_projection
            or source_facts != expected_source_facts
            or list(shadow_files) != expected_shadow_files
        ):
            raise ValueError(
                f"Part {design_id} requires exactly one {expected_source_facts['path']} A6x1 "
                "YOnly declaration composed to midpoint "
                f"{expected_source_facts['midpointLdu']} with normal "
                f"{expected_source_facts['direction']} and only {expected_shadow_files} in its "
                "shadow closure; measured "
                f"{len(eligible_holes)} declarations from {source_paths}, projection "
                f"{projected}, source facts {source_facts}, and closure {list(shadow_files)}."
            )
        return [
            _projection_from_emitted_row(row, retain_through_bore=True)
            for row in axle_holes
        ]
    if eligible or axles:
        raise ValueError(
            f"Part {design_id} exposes {len(eligible)} exact A6x60 declarations and "
            f"{len(axles)} axle seats; that source route is admitted only for design 4519."
        )
    if eligible_holes or axle_holes:
        raise ValueError(
            f"Part {design_id} exposes {len(eligible_holes)} exact A6x1 YOnly declarations "
            f"and {len(axle_holes)} axle-hole seats; that source route is admitted only for "
            "design 32064/32064a or 73230."
        )
    if holders:
        raise ValueError(
            f"Part {design_id} exposes {len(holders)} exact fixed female A6x44 declarations; "
            "that blind axle-holder route is admitted only for design 3245b."
        )
    return []
