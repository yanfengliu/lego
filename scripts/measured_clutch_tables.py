"""Measured clutch rows: each seat in the catalog frame, with its normal when it is not down.

A clutch row is `(x, y, z)` for an underside seat, whose outward normal is the
catalog's +Y, and `(x, y, z, nx, ny, nz)` for any other axis normal. 41682's
flange recess takes a stud along +Z, so its two seats carry `(0, 0, 1)`; every
seat emitted before it faces down and keeps its three-number row.

Rows are ordered with every downward seat first, by position (the order every
part was emitted in before a seat could face elsewhere), then the others by
normal and position. A part that gains a sideways seat therefore keeps the ids
`undersideClutch:0..n-1` of the seats it already had.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence

Vector3 = tuple[float, float, float]
MeasuredClutchRow = tuple[float, float, float] | tuple[float, float, float, float, float, float]

DOWNWARD_CLUTCH_NORMAL: Vector3 = (0.0, 1.0, 0.0)


def _axis_unit(normal: Vector3) -> bool:
    return sorted(abs(value) for value in normal) == [0.0, 0.0, 1.0]


def measured_clutch_rows(
    design_id: str,
    source_clutches: Sequence[tuple[Sequence[float], Sequence[float]]],
    transform_point: Callable[[Sequence[float]], Vector3],
    transform_direction: Callable[[Sequence[float]], Vector3],
) -> tuple[MeasuredClutchRow, ...]:
    """Frame each source (position, outward normal) seat and order the rows."""

    framed: list[tuple[Vector3, Vector3]] = []
    for position, normal in source_clutches:
        catalog_normal = tuple(float(value) + 0.0 for value in transform_direction(normal))
        if not _axis_unit(catalog_normal):  # type: ignore[arg-type]
            raise ValueError(
                f"Part {design_id} clutch at source {list(position)} has outward normal "
                f"{list(normal)}, framed to {list(catalog_normal)}; a clutch seat faces along one "
                "signed coordinate axis."
            )
        framed.append((transform_point(position), catalog_normal))  # type: ignore[arg-type]
    downward = sorted(point for point, normal in framed if normal == DOWNWARD_CLUTCH_NORMAL)
    other = sorted(
        (normal, point) for point, normal in framed if normal != DOWNWARD_CLUTCH_NORMAL
    )
    return (*downward, *((*point, *normal) for normal, point in other))  # type: ignore[return-value]


def clutch_row_position(row: Sequence[float]) -> Vector3:
    return (row[0], row[1], row[2])


def clutch_row_normal(row: Sequence[float]) -> Vector3:
    return DOWNWARD_CLUTCH_NORMAL if len(row) == 3 else (row[3], row[4], row[5])
