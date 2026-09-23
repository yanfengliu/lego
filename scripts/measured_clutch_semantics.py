"""Stable measured underside-clutch identities bound to exact source seats."""

from __future__ import annotations

import re
from typing import Sequence

from measured_part_typescript_literals import numbers, string_literal

ClutchPortSemanticRow = tuple[tuple[int, int, int], str, tuple[str, ...]]
ClutchPortSemantics = tuple[ClutchPortSemanticRow, ...]

_CLUTCH_PORT_ID = re.compile(
    r"undersideClutch:[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)*\Z"
)


def validate_clutch_port_semantics(rows: ClutchPortSemantics) -> None:
    """Refuse ambiguous identities before a measured plan can be emitted."""

    positions = [position for position, _, _ in rows]
    if len(set(positions)) != len(positions):
        raise ValueError("Measured clutch semantics must name unique exact seats.")
    port_ids = [port_id for _, port_id, _ in rows]
    if len(set(port_ids)) != len(port_ids):
        raise ValueError("Measured clutch semantics must name unique stable undersideClutch IDs.")
    for position, port_id, groups in rows:
        if not all(type(value) is int for value in position):
            raise ValueError("Measured clutch semantic seats must use whole-LDU integer positions.")
        if type(port_id) is not str or _CLUTCH_PORT_ID.fullmatch(port_id) is None:
            raise ValueError(
                "Measured clutch semantic IDs must match "
                "'undersideClutch:<non-empty colon-separated token>'."
            )
        if (
            len(set(groups)) != len(groups)
            or any(type(group) is not str or not group.strip() for group in groups)
        ):
            raise ValueError(
                "Measured clutch shared-capacity groups must be non-empty unique text per seat."
            )


def render_clutch_port_semantics(
    design_id: str,
    rows: ClutchPortSemantics,
    measured_positions: Sequence[Sequence[float]],
) -> str:
    """Align position-keyed plan rows with the measured source order and emit them."""

    by_position = {position: (port_id, groups) for position, port_id, groups in rows}
    measured = [tuple(position) for position in measured_positions]
    if len(measured) != len(rows) or set(measured) != set(by_position):
        raise ValueError(
            f"Part {design_id} measured clutch semantic seats {sorted(by_position)} "
            f"do not exactly match measured source seats {sorted(set(measured))}."
        )
    rendered: list[str] = []
    for position in measured:
        port_id, groups = by_position[position]
        fields = [
            f"positionLdu: [{numbers(position)}]",
            f"id: {string_literal(port_id)}",
        ]
        if groups:
            group_literals = ", ".join(string_literal(group) for group in groups)
            fields.append(f"sharedCapacityGroupIds: [{group_literals}]")
        rendered.append("{ " + ", ".join(fields) + " }")
    return "[" + ", ".join(rendered) + "]"
