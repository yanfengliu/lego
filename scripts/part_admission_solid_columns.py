"""Per-column solid intervals of a measured LDraw surface, read from BFC winding.

`column_candidate` keeps one [min y, max y] interval per 1-LDU plan column, so a
cavity that opens sideways is filled: 41682's flange recess, which a 1 x 2
plate's studs enter along +Z, sits between the flange top and the plate below
and was solid in every column over it. This derivation keeps each column's
solid intervals instead. A plan opts in (`collision_derivation`); every other
part keeps the height field.

How one column is measured:

- A body triangle reaches the column when its clip leaves the column's
  boundary planes by more than `BOUNDARY_EPSILON_LDU`. A face lying in a
  boundary plane, or a clip-roundoff sliver of one, belongs to the neighbouring
  column. The height field counts such a sliver as plan area: 41682's flange-top
  triangles have an edge on the z = 4 column boundary, their clip leaves a
  4.4e-16 LDU sliver in the column behind the flange, and that column was
  extended up to the flange top, 1 LDU past the flange's back face.
- The y extents of the reaching triangles cut the column into slabs. A slab some
  triangle passes through (a sloped or vertical face inside the column) stays
  solid: material finer than one column is not resolved, which is the
  conservative fallback.
- Any other slab holds no surface, so it is wholly inside or wholly outside the
  part. A vertical probe line at fixed generic points of the column counts the
  BFC crossings above the slab: an outward normal facing -Y is an entry, +Y an
  exit, and the slab is solid where the count is positive.
- Every probe line must be closed: its count never drops below zero and is zero
  past the last crossing, and the probes agree on every slab. Otherwise the
  surface is not closed along that column, parity cannot say what is inside it,
  and the derivation refuses rather than guess.
- Underside tube primitives (`CLUTCH_ROLE`: stud3, stud3a, stud4) are open where
  they meet a ceiling, so they take no part in the winding; each connected tube
  is solid over its own full height in every column it reaches, which is at
  least what the height field gave those columns.
- Stud primitives are left out, as in the height field; their cylinders are
  separate bodies.

Nothing here admits a part or writes to the catalog.
"""

from __future__ import annotations

import math
from typing import Sequence

from part_admission_contract import (
    CANDIDATE_FRAME,
    CANDIDATE_SCHEMA_VERSION,
    Triangle,
    validate_candidate,
)
from part_admission_geometry import connected_surface_components
from part_admission_lattice import STUD_PITCH_LDU
from part_admission_ldraw_candidate import (
    DEFAULT_COLUMN_LDU,
    MINIMUM_COLUMN_HEIGHT_LDU,
    _clip,
    _clutch_connectors,
    _greedy_rectangles,
    _stud_cylinders,
)
from part_admission_surface import BODY_ROLE, CLUTCH_ROLE, STUD_ROLE, MeasuredSurface

SOLID_INTERVAL_DERIVATION_ID = "column-solid-intervals"
BOUNDARY_EPSILON_LDU = 1e-9
# Fixed generic points inside a column, as fractions of its width. Irrational
# offsets keep a probe line off the half- and quarter-LDU grid LDraw edges sit on.
PROBE_FRACTIONS: tuple[tuple[float, float], ...] = (
    (0.5 + 0.0371 * math.sqrt(2), 0.5 - 0.0213 * math.sqrt(3)),
    (0.2 + 0.0117 * math.sqrt(5), 0.7 + 0.0091 * math.sqrt(7)),
    (0.8 - 0.0063 * math.sqrt(11), 0.25 + 0.0133 * math.sqrt(13)),
)

Cell = tuple[int, int]
Interval = tuple[float, float]


class OpenColumnSurfaceError(ValueError):
    """The body surface is not closed along a column, so its inside cannot be read."""


def _reach(triangle: Triangle, cell: Cell, column_ldu: float) -> Interval | None:
    """The y extent of a triangle inside one column's open interior, or None."""

    x0, z0 = cell[0] * column_ldu, cell[1] * column_ldu
    x1, z1 = x0 + column_ldu, z0 + column_ldu
    clipped: list[tuple[float, float, float]] = list(triangle)
    for axis, value, keep_greater in ((0, x0, True), (0, x1, False), (2, z0, True), (2, z1, False)):
        if not clipped:
            return None
        clipped = _clip(clipped, axis, value, keep_greater)
    if not clipped:
        return None
    xs = [point[0] for point in clipped]
    zs = [point[2] for point in clipped]
    eps = BOUNDARY_EPSILON_LDU
    if max(xs) <= x0 + eps or min(xs) >= x1 - eps or max(zs) <= z0 + eps or min(zs) >= z1 - eps:
        return None
    return (min(point[1] for point in clipped), max(point[1] for point in clipped))


def _reaches(
    triangles: Sequence[Triangle], column_ldu: float
) -> dict[Cell, list[tuple[int, Interval]]]:
    """Every column each triangle reaches, with the triangle index and its y extent there."""

    reached: dict[Cell, list[tuple[int, Interval]]] = {}
    for index, triangle in enumerate(triangles):
        first_x = math.floor(min(point[0] for point in triangle) / column_ldu)
        last_x = math.floor(max(point[0] for point in triangle) / column_ldu)
        first_z = math.floor(min(point[2] for point in triangle) / column_ldu)
        last_z = math.floor(max(point[2] for point in triangle) / column_ldu)
        for cell_x in range(first_x, last_x + 1):
            for cell_z in range(first_z, last_z + 1):
                extent = _reach(triangle, (cell_x, cell_z), column_ldu)
                if extent is not None:
                    reached.setdefault((cell_x, cell_z), []).append((index, extent))
    return reached


def _crossings(
    triangles: Sequence[Triangle], indices: Sequence[int], x: float, z: float
) -> list[tuple[float, int]] | None:
    """Signed crossings of the vertical line through (x, z), or None if it grazes an edge."""

    rows: list[tuple[float, int]] = []
    for index in indices:
        (ax, ay, az), (bx, by, bz), (cx, cy, cz) = triangles[index]
        determinant = (bx - ax) * (cz - az) - (cx - ax) * (bz - az)
        if determinant == 0:
            continue
        u = ((x - ax) * (cz - az) - (cx - ax) * (z - az)) / determinant
        v = ((bx - ax) * (z - az) - (x - ax) * (bz - az)) / determinant
        w = 1.0 - u - v
        if min(u, v, w) < -BOUNDARY_EPSILON_LDU:
            continue
        if min(u, v, w) <= BOUNDARY_EPSILON_LDU:
            return None
        # The outward normal's y component has the sign of this plan cross product
        # (see the sign check in the tests): negative faces up, so the line enters.
        normal_y = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
        rows.append((ay + u * (by - ay) + v * (cy - ay), 1 if normal_y < 0 else -1))
    rows.sort()
    return rows


def _closed(rows: Sequence[tuple[float, int]]) -> bool:
    """Whether the count along one line never goes negative and ends at zero."""

    count = 0
    position = 0
    while position < len(rows):
        level = rows[position][0]
        while position < len(rows) and rows[position][0] <= level + BOUNDARY_EPSILON_LDU:
            count += rows[position][1]
            position += 1
        if count < 0:
            return False
    return count == 0


def _breakpoints(extents: Sequence[Interval]) -> list[float]:
    values = sorted({value for extent in extents for value in extent})
    merged: list[float] = []
    for value in values:
        if not merged or value > merged[-1] + BOUNDARY_EPSILON_LDU:
            merged.append(value)
    return merged


def _merge(intervals: Sequence[Interval]) -> list[Interval]:
    merged: list[Interval] = []
    for low, high in sorted(intervals):
        if merged and low <= merged[-1][1] + BOUNDARY_EPSILON_LDU:
            merged[-1] = (merged[-1][0], max(merged[-1][1], high))
        else:
            merged.append((low, high))
    return merged


def _describe(cell: Cell, column_ldu: float) -> str:
    x0, z0 = cell[0] * column_ldu, cell[1] * column_ldu
    return f"x [{x0:g}, {x0 + column_ldu:g}] z [{z0:g}, {z0 + column_ldu:g}]"


def _body_column(
    design_id: str,
    triangles: Sequence[Triangle],
    reached: Sequence[tuple[int, Interval]],
    cell: Cell,
    column_ldu: float,
) -> tuple[list[Interval], int]:
    """One column's solid intervals from the body surface, and how many slabs were mixed."""

    indices = [index for index, _ in reached]
    extents = [extent for _, extent in reached]
    probes: list[tuple[tuple[float, float], list[tuple[float, int]]]] = []
    for fraction_x, fraction_z in PROBE_FRACTIONS:
        point = ((cell[0] + fraction_x) * column_ldu, (cell[1] + fraction_z) * column_ldu)
        rows = _crossings(triangles, indices, *point)
        if rows is None:
            continue
        if not _closed(rows):
            raise OpenColumnSurfaceError(
                f"Part {design_id} body surface is not closed along column "
                f"{_describe(cell, column_ldu)}: the vertical line at x={point[0]:.6f} "
                f"z={point[1]:.6f} crosses {[(round(y, 6), sign) for y, sign in rows]} "
                "(+1 enters, -1 leaves), so parity cannot say what is inside it. Keep this "
                "part on the column height field, or measure a closed body surface first."
            )
        probes.append((point, rows))
    if not probes:
        raise OpenColumnSurfaceError(
            f"Part {design_id} column {_describe(cell, column_ldu)}: all "
            f"{len(PROBE_FRACTIONS)} probe lines graze a triangle edge, so no crossing count "
            "is exact there. Add a probe point off this column's edges."
        )
    solid: list[Interval] = []
    mixed = 0
    levels = _breakpoints(extents)
    for low, high in zip(levels, levels[1:]):
        if any(
            first < high - BOUNDARY_EPSILON_LDU and last > low + BOUNDARY_EPSILON_LDU
            for first, last in extents
        ):
            solid.append((low, high))
            mixed += 1
            continue
        middle = (low + high) / 2
        verdicts = {sum(sign for y, sign in rows if y < middle) > 0 for _, rows in probes}
        if len(verdicts) != 1:
            raise OpenColumnSurfaceError(
                f"Part {design_id} column {_describe(cell, column_ldu)}: probe lines at "
                f"{[tuple(round(value, 6) for value in point) for point, _ in probes]} disagree "
                f"on whether y ({low:g}, {high:g}) is solid, although no surface crosses that "
                "slab inside the column; the surface is not closed there."
            )
        if verdicts.pop():
            solid.append((low, high))
    return _merge(solid), mixed


def _sheet(levels: Sequence[float], surface_low: float, surface_high: float) -> list[Interval]:
    """A zero-thickness sheet as a minimum-height body, clamped to the surface as the height field does."""

    sheets: list[Interval] = []
    for level in levels:
        low = level - MINIMUM_COLUMN_HEIGHT_LDU / 2
        high = level + MINIMUM_COLUMN_HEIGHT_LDU / 2
        if low < surface_low:
            low, high = surface_low, surface_low + MINIMUM_COLUMN_HEIGHT_LDU
        elif high > surface_high:
            low, high = surface_high - MINIMUM_COLUMN_HEIGHT_LDU, surface_high
        sheets.append((low, high))
    return sheets


def solid_interval_columns(
    surface: MeasuredSurface, column_ldu: float = DEFAULT_COLUMN_LDU
) -> tuple[dict[Cell, list[Interval]], dict[str, int]]:
    """Each column's solid intervals, and counts of how each was reached."""

    if column_ldu <= 0 or STUD_PITCH_LDU % column_ldu != 0:
        raise ValueError(
            f"Column size {column_ldu} LDU must be positive and divide the 20 LDU stud pitch, so "
            "column boundaries fall on stud-cell boundaries."
        )
    body = [t for t, role in zip(surface.triangles, surface.roles) if role == BODY_ROLE]
    tubes = [t for t, role in zip(surface.triangles, surface.roles) if role == CLUTCH_ROLE]
    if not body:
        raise ValueError(
            f"Measured surface {surface.design_id} has no body triangles; a solid-interval "
            "derivation needs a body surface to read."
        )
    solid_points = [point for triangle in (*body, *tubes) for point in triangle]
    surface_low = min(point[1] for point in solid_points)
    surface_high = max(point[1] for point in solid_points)
    counts = {"columns": 0, "mixedSlabs": 0, "tubeEnvelopes": 0, "sheets": 0}
    columns: dict[Cell, list[Interval]] = {}
    for cell, reached in sorted(_reaches(body, column_ldu).items()):
        intervals, mixed = _body_column(surface.design_id, body, reached, cell, column_ldu)
        if not intervals:
            intervals = _sheet(_breakpoints([extent for _, extent in reached]), surface_low, surface_high)
            counts["sheets"] += len(intervals)
        columns[cell] = intervals
        counts["columns"] += 1
        counts["mixedSlabs"] += mixed
    for members in connected_surface_components(tubes):
        component = [tubes[index] for index in members]
        # The whole tube's own height, not its extent in the column: inside a
        # stud4 annulus only the bottom ring reaches a column, yet the wall is
        # solid from the ceiling it hangs from down to that ring.
        envelope = (
            min(point[1] for triangle in component for point in triangle),
            max(point[1] for triangle in component for point in triangle),
        )
        for cell in _reaches(component, column_ldu):
            columns[cell] = _merge([*columns.get(cell, []), envelope])
            counts["tubeEnvelopes"] += 1
    return columns, counts


def solid_interval_candidate(
    surface: MeasuredSurface, column_ldu: float = DEFAULT_COLUMN_LDU
) -> dict[str, object]:
    """The part as boxes over each column's solid intervals, plus its stud cylinders."""

    columns, counts = solid_interval_columns(surface, column_ldu)
    groups: dict[tuple[int, int], set[Cell]] = {}
    for cell, intervals in columns.items():
        for low, high in intervals:
            groups.setdefault((round(low * 1e9), round(high * 1e9)), set()).add(cell)
    bodies: list[dict[str, object]] = []
    for key in sorted(groups):
        low, high = key[0] / 1e9, key[1] / 1e9
        for first_x, last_x, first_z, last_z in _greedy_rectangles(groups[key]):
            bodies.append(
                {
                    "kind": "box",
                    "tag": "body",
                    "minLdu": [first_x * column_ldu, low, first_z * column_ldu],
                    "maxLdu": [(last_x + 1) * column_ldu, high, (last_z + 1) * column_ldu],
                }
            )
    solid_triangles = [
        triangle for triangle, role in zip(surface.triangles, surface.roles) if role != STUD_ROLE
    ]
    solid_points = [point for triangle in solid_triangles for point in triangle]
    solid_bounds = (
        tuple(min(point[axis] for point in solid_points) for axis in range(3)),
        tuple(max(point[axis] for point in solid_points) for axis in range(3)),
    )
    studs = _stud_cylinders(surface.by_role(STUD_ROLE), solid_bounds)  # type: ignore[arg-type]
    connectors = [row["connector"] for row in studs]
    bodies.extend(row["body"] for row in studs)  # type: ignore[misc]
    plan_bounds = (
        min(float(body["minLdu"][0]) for body in bodies if body["tag"] == "body"),  # type: ignore[index]
        max(float(body["maxLdu"][0]) for body in bodies if body["tag"] == "body"),  # type: ignore[index]
        min(float(body["minLdu"][2]) for body in bodies if body["tag"] == "body"),  # type: ignore[index]
        max(float(body["maxLdu"][2]) for body in bodies if body["tag"] == "body"),  # type: ignore[index]
    )
    stud_centers = [
        (float(row["connector"]["positionLdu"][0]), float(row["connector"]["positionLdu"][2]))  # type: ignore[index]
        for row in studs
    ]
    clutches = _clutch_connectors(bodies, stud_centers, plan_bounds, solid_bounds[1][1])  # type: ignore[arg-type]
    connectors.extend(clutches)
    candidate = {
        "schemaVersion": CANDIDATE_SCHEMA_VERSION,
        "designId": surface.design_id,
        "frame": CANDIDATE_FRAME,
        "derivation": (
            f"ldraw-{SOLID_INTERVAL_DERIVATION_ID}/{column_ldu:g}ldu: BFC-winding solid intervals "
            f"over {counts['columns']} closed body columns ({counts['mixedSlabs']} slabs a face "
            f"crosses kept solid, {counts['tubeEnvelopes']} underside-tube envelopes, "
            f"{counts['sheets']} zero-thickness sheets), {len(studs)} stud cylinders, and the "
            "part-model.md line 77 backing rule applied to the bottom face, which emitted "
            f"{len(clutches)} clutch cells"
        ),
        "bodies": bodies,
        "connectors": connectors,
    }
    validate_candidate(candidate)
    return candidate
