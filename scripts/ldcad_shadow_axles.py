"""Exact LDCad source bridge for the authored 3L axle shaft used by 4519."""

from __future__ import annotations

from fractions import Fraction
from typing import Callable, Sequence

from ldcad_shadow_connectors import (
    ShadowSnap,
    axis_normal,
    exact_float,
)

AXLE_LENGTH_LDU = Fraction(60)
AXLE_PORT_INSET_LDU = Fraction(10)
AXLE_PORT_PITCH_LDU = Fraction(20)


def emit_axle_connectors(
    snaps: Sequence[ShadowSnap],
    *,
    on_reject: Callable[[str, ShadowSnap], None] | None = None,
) -> list[dict[str, object]]:
    """Project exact capless, sliding `A 6 60` source segments to point ports."""

    seen: set[tuple[tuple[float, ...], tuple[float, ...]]] = set()
    connectors: list[dict[str, object]] = []
    for snap in snaps:
        if not snap.is_axle_shaft:
            continue
        direction = axis_normal(snap.hole_direction)
        assert direction is not None
        if any(value.denominator != 1 for value in snap.position):
            if on_reject is not None:
                on_reject("fractional-axle-segment-start", snap)
            continue
        exact_direction = snap.hole_direction
        end = tuple(snap.position[axis] + exact_direction[axis] * 60 for axis in range(3))
        positions = [
            tuple(snap.position[axis] + exact_direction[axis] * offset for axis in range(3))
            for offset in range(10, 60, 20)
        ]
        try:
            start_output = [
                exact_float(value, f"{snap.source_path}:{snap.source_line} axle segment start")
                for value in snap.position
            ]
            end_output = [
                exact_float(value, f"{snap.source_path}:{snap.source_line} axle segment end")
                for value in end
            ]
            position_outputs = [
                tuple(
                    exact_float(value, f"{snap.source_path}:{snap.source_line} axle port")
                    for value in position
                )
                for position in positions
            ]
        except ValueError:
            if on_reject is not None:
                on_reject("axle-position-not-exactly-representable", snap)
            continue
        source = {
            "path": snap.source_path,
            "line": snap.source_line,
            "command": snap.command,
            "section": "A 6 60",
            "caps": snap.caps,
            "slide": snap.slide,
            "centered": snap.centered,
            "gridCount": snap.grid_count,
            "scale": snap.transform_modifiers[0],
            "mirror": snap.transform_modifiers[1],
            "startLdu": start_output,
            "endLdu": end_output,
            "direction": list(direction),
        }
        for offset, position in zip(
            range(
                int(AXLE_PORT_INSET_LDU),
                int(AXLE_LENGTH_LDU),
                int(AXLE_PORT_PITCH_LDU),
            ),
            position_outputs,
        ):
            normal_sign = -1 if offset < AXLE_LENGTH_LDU / 2 else 1
            normal = tuple(0.0 if value == 0 else value * normal_sign for value in direction)
            key = (position, normal)
            if key in seen:
                if on_reject is not None:
                    on_reject("duplicate-of-an-already-emitted-axle-port", snap)
                continue
            seen.add(key)
            connectors.append(
                {
                    "kind": "axle",
                    "gender": "male",
                    "positionLdu": list(position),
                    "normal": list(normal),
                    "source": source,
                }
            )
    connectors.sort(key=lambda row: tuple(row["positionLdu"]))  # type: ignore[arg-type]
    return connectors
