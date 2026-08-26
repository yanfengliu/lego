"""Bind exact authored non-stud connector projections to admitted design identities."""

from __future__ import annotations

from typing import Sequence

from ldcad_shadow_axle_holes import (
    emit_axle_hole_connectors,
    is_axle_hole_declaration,
)
from ldcad_shadow_axles import emit_axle_connectors
from ldcad_shadow_connectors import ShadowSnap

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


def source_connectors_for(
    design_id: str, snaps: Sequence[ShadowSnap], shadow_files: Sequence[str]
) -> list[tuple[str, Sequence[float], Sequence[float]]]:
    """Admit only the exact 4519 axle and two reviewed axle-hole projections."""

    eligible = [snap for snap in snaps if snap.is_axle_shaft]
    axles = emit_axle_connectors(snaps)
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
        return [
            (
                str(row["kind"]),
                row["positionLdu"],  # type: ignore[arg-type]
                row["normal"],  # type: ignore[arg-type]
            )
            for row in axles
        ]
    eligible_holes = [snap for snap in snaps if is_axle_hole_declaration(snap)]
    axle_holes = emit_axle_hole_connectors(snaps)
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
            (
                str(row["kind"]),
                row["positionLdu"],  # type: ignore[arg-type]
                row["normal"],  # type: ignore[arg-type]
            )
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
    return []
