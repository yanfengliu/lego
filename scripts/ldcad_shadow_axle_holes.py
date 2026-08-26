"""Exact LDCad source bridge for the inherited 32064a and 73230 axle holes."""

from __future__ import annotations

from fractions import Fraction
from typing import Callable, Sequence

from ldcad_shadow_connectors import ShadowSnap, exact_float

AXLE_HOLE_SOURCE_PATHS = frozenset(("p/axlehol4.dat", "p/axlehol5.dat"))
AXLE_HOLE_SOURCE_LENGTH_LDU = Fraction(1)
AXLE_HOLE_COMPOSED_LENGTH_LDU = Fraction(20)


def is_axle_hole_declaration(snap: ShadowSnap) -> bool:
    """Whether one snap is the exact scalable axle-hole declaration both routes use."""

    return (
        snap.command == "SNAP_CYL"
        and snap.gender == "F"
        and snap.caps == "none"
        and snap.slide
        and not snap.centered
        and snap.snap_id == "axlehole"
        and snap.group == ""
        and snap.grid_count == 1
        and snap.transform_modifiers == ("YOnly", None)
        and len(snap.sections) == 1
        and snap.sections[0].variant == "A"
        and snap.sections[0].radius == 6
        and snap.sections[0].length == AXLE_HOLE_SOURCE_LENGTH_LDU
    )


def _unit_axis(vector: tuple[Fraction, Fraction, Fraction]) -> tuple[float, float, float] | None:
    nonzero = [axis for axis, value in enumerate(vector) if value != 0]
    if len(nonzero) != 1:
        return None
    axis = nonzero[0]
    result = [0.0, 0.0, 0.0]
    result[axis] = -1.0 if vector[axis] < 0 else 1.0
    return (result[0], result[1], result[2])


def emit_axle_hole_connectors(
    snaps: Sequence[ShadowSnap],
    *,
    on_reject: Callable[[str, ShadowSnap], None] | None = None,
) -> list[dict[str, object]]:
    """Project the exact inherited A6 segment to one source-local axle-hole port."""

    seen: set[tuple[tuple[float, ...], tuple[float, ...]]] = set()
    connectors: list[dict[str, object]] = []
    for snap in snaps:
        if not is_axle_hole_declaration(snap):
            continue
        if snap.source_path not in AXLE_HOLE_SOURCE_PATHS:
            if on_reject is not None:
                on_reject("unexpected-axle-hole-source-path", snap)
            continue
        # The source deliberately anchors an uncentred snap at its y=1 end.
        # Its local -Y direction therefore runs from that endpoint through the
        # hole, which becomes the one admitted outward frame after composition.
        direction = snap.hole_direction
        normal = _unit_axis(direction)
        if normal is None:
            if on_reject is not None:
                on_reject("non-axis-axle-hole-segment", snap)
            continue
        section = snap.sections[0]
        delta = tuple(value * section.length for value in direction)
        if sum(abs(value) for value in delta) != AXLE_HOLE_COMPOSED_LENGTH_LDU:
            if on_reject is not None:
                on_reject("unexpected-axle-hole-segment-length", snap)
            continue
        end = tuple(snap.position[axis] + delta[axis] for axis in range(3))
        midpoint = tuple((snap.position[axis] + end[axis]) / 2 for axis in range(3))
        exact_points = (*snap.position, *end, *midpoint)
        if any(value.denominator != 1 for value in exact_points):
            if on_reject is not None:
                on_reject("fractional-axle-hole-segment", snap)
            continue
        try:
            start_output = [
                exact_float(value, f"{snap.source_path}:{snap.source_line} axle-hole start")
                for value in snap.position
            ]
            end_output = [
                exact_float(value, f"{snap.source_path}:{snap.source_line} axle-hole end")
                for value in end
            ]
            midpoint_output = tuple(
                exact_float(value, f"{snap.source_path}:{snap.source_line} axle-hole midpoint")
                for value in midpoint
            )
        except ValueError:
            if on_reject is not None:
                on_reject("axle-hole-position-not-exactly-representable", snap)
            continue
        key = (midpoint_output, normal)
        if key in seen:
            if on_reject is not None:
                on_reject("duplicate-of-an-already-emitted-axle-hole", snap)
            continue
        seen.add(key)
        connectors.append(
            {
                "kind": "axleHole",
                "gender": "female",
                "positionLdu": list(midpoint_output),
                "normal": list(normal),
                "source": {
                    "path": snap.source_path,
                    "line": snap.source_line,
                    "command": snap.command,
                    "id": snap.snap_id,
                    "group": snap.group,
                    "section": "A 6 1",
                    "caps": snap.caps,
                    "slide": snap.slide,
                    "centered": snap.centered,
                    "gridCount": snap.grid_count,
                    "scale": snap.transform_modifiers[0],
                    "mirror": snap.transform_modifiers[1],
                    "startLdu": start_output,
                    "endLdu": end_output,
                    "midpointLdu": list(midpoint_output),
                    "direction": list(normal),
                    "segmentLengthLdu": float(AXLE_HOLE_COMPOSED_LENGTH_LDU),
                },
            }
        )
    connectors.sort(key=lambda row: tuple(row["positionLdu"]))  # type: ignore[arg-type]
    return connectors
