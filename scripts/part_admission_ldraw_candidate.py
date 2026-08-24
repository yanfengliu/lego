"""Derive a scoreable candidate part from the measured LDraw surface.

This is one candidate source among several possible ones; the scorer in
part_admission_scorecard.py does not depend on it. It reproduces the strategy
docs/design/part-model.md line 119 records for layer 4: a per-column
height-field decomposition of the expanded BFC surface into boxes, plus one
cylinder per visible stud.

Each column box is the exact y-interval of the real surface over that column's
plan rectangle, computed by clipping every triangle to the column, so the union
contains the surface by construction and the containment score verifies the
construction rather than assuming it. Connectors are emitted by the same
features that emit the bodies, which is the one-declaration rule.

Nothing here admits a part or writes to the catalog.
"""

from __future__ import annotations

import math
from typing import Callable, Iterable, Sequence

from part_admission_contract import (
    CANDIDATE_FRAME,
    CANDIDATE_SCHEMA_VERSION,
    Triangle,
    Vector3,
    validate_candidate,
)
from part_admission_geometry import PlanIndex, connected_surface_components
from part_admission_lattice import STUD_PITCH_LDU, lattice_cell_centers
from part_admission_surface import BODY_ROLE, CLUTCH_ROLE, MeasuredSurface, STUD_ROLE

SourceKey = tuple[str, str]

# The pilot's visible-stud policy, plus the two underside tube primitives the six
# pilot closures actually reference. Digests are pinned so a renamed or edited
# primitive cannot silently change what counts as a stud.
PRIMITIVE_ROLE_PINS: dict[SourceKey, tuple[str, str]] = {
    ("official", "p/stud.dat"): (
        "sha256:db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4",
        STUD_ROLE,
    ),
    ("official", "p/stud2.dat"): (
        "sha256:5ed3702c7d7000bfac2906f12b74ae312c59194a8e3b504952820c826b51c810",
        STUD_ROLE,
    ),
    ("official", "p/stud2a.dat"): (
        "sha256:61fbed54b085a30490045309778d1e2a6d95485e6558996b12674f848028d557",
        STUD_ROLE,
    ),
    ("official", "p/stug-1x3.dat"): (
        "sha256:f24de368545aa96580b811daa6c25e18f5bfdbaca1d4b11addcfa7cbb625f4c9",
        STUD_ROLE,
    ),
    ("official", "p/stug-1x6.dat"): (
        "sha256:907b74bad03688f6d2f22220db6ec4a6c922203a3e3001aa24f214c6ed48a226",
        STUD_ROLE,
    ),
    ("official", "p/stug-2x1.dat"): (
        "sha256:03d08cea230e892e1b6cbfe523c19b568a834c5888aac5c789d1fb8d6ee93d96",
        STUD_ROLE,
    ),
    ("official", "p/stug-2x2.dat"): (
        "sha256:16114159ea25719341a852d5403dc9982a6211f2fcb23f5c4c3eac05a2ad43f7",
        STUD_ROLE,
    ),
    ("official", "p/stug-3x1.dat"): (
        "sha256:9ae441c03c2e73972a26d74f7ead4de280947397dc09e2fd9857ca73ec87181a",
        STUD_ROLE,
    ),
    ("official", "p/stug2-4x1.dat"): (
        "sha256:179d252971d76f12196c7c2c3b6f89bb6c7eab21d9df9625f44a8064e49e4996",
        STUD_ROLE,
    ),
    ("official", "p/stud3.dat"): (
        "sha256:d29e9160faeaf85b2b72a098e89a81f41e0082517a82065d7b1f149b5fd2addd",
        CLUTCH_ROLE,
    ),
    ("official", "p/stud4.dat"): (
        "sha256:871cdcab26e7f5113488a24c453d6fabda75b275b06de592e0bfaad4292c12a3",
        CLUTCH_ROLE,
    ),
}

STUD_FOOTPRINT_RADIUS_LDU = 6.0
CLUTCH_BACKING_PROBE_DEPTH_LDU = 0.25
CLUTCH_BACKING_RINGS = tuple(
    STUD_FOOTPRINT_RADIUS_LDU * step / 3 for step in range(4)
)
CLUTCH_BACKING_SPOKES = 16
DEFAULT_COLUMN_LDU = 1.0
MINIMUM_COLUMN_HEIGHT_LDU = 0.001
BUILDER_HORIZONTAL_INSET_LDU = 0.25


def role_classifier(
    digest_for_source: Callable[[SourceKey], str],
) -> Callable[[tuple[SourceKey, ...]], str]:
    """Role for a triangle, from the pinned identity of any ancestor primitive.

    Ancestry rather than the immediate file: a stud's own triangles live in
    4-4cyli.dat, which is also a wall of a tube and a rim of a plate.
    """

    def classify(ancestry: tuple[SourceKey, ...]) -> str:
        for key in ancestry:
            pinned = PRIMITIVE_ROLE_PINS.get(key)
            if pinned is None:
                continue
            expected_digest, role = pinned
            actual = digest_for_source(key)
            if actual != expected_digest:
                raise ValueError(
                    f"Primitive {key[0]}:{key[1]} is {actual}; the pinned role policy expects "
                    f"{expected_digest}. Re-measure the policy before scoring against it."
                )
            return role
        return BODY_ROLE

    return classify


def _clip(polygon: Sequence[Vector3], axis: int, value: float, keep_greater: bool) -> list[Vector3]:
    result: list[Vector3] = []
    count = len(polygon)
    for index in range(count):
        current = polygon[index]
        following = polygon[(index + 1) % count]
        current_value = current[axis] - value
        following_value = following[axis] - value
        inside_current = current_value >= 0 if keep_greater else current_value <= 0
        inside_following = following_value >= 0 if keep_greater else following_value <= 0
        if inside_current:
            result.append(current)
        if inside_current != inside_following and current_value != following_value:
            ratio = current_value / (current_value - following_value)
            result.append(
                tuple(  # type: ignore[arg-type]
                    current[a] + (following[a] - current[a]) * ratio for a in range(3)
                )
            )
    return result


def _extend(
    cells: dict[tuple[int, int], tuple[float, float]],
    cell: tuple[int, int],
    low: float,
    high: float,
) -> None:
    existing = cells.get(cell)
    cells[cell] = (
        low if existing is None else min(existing[0], low),
        high if existing is None else max(existing[1], high),
    )


def _height_field(
    triangles: Iterable[Triangle], column_ldu: float
) -> dict[tuple[int, int], tuple[float, float]]:
    """Exact minimum and maximum surface y over each plan column.

    A clip with no plan area — a vertical wall standing on a column boundary —
    is deferred, because taking it at face value opens a full-width column
    outside the part wherever a face happens to land on a grid line. It is
    applied only when no column that already shares that plane covers it.
    """

    cells: dict[tuple[int, int], tuple[float, float]] = {}
    deferred: list[tuple[tuple[int, int], float, float, list[tuple[int, int]]]] = []
    for triangle in triangles:
        first_x = math.floor(min(point[0] for point in triangle) / column_ldu)
        last_x = math.floor(max(point[0] for point in triangle) / column_ldu)
        first_z = math.floor(min(point[2] for point in triangle) / column_ldu)
        last_z = math.floor(max(point[2] for point in triangle) / column_ldu)
        for cell_x in range(first_x, last_x + 1):
            for cell_z in range(first_z, last_z + 1):
                clipped: list[Vector3] = list(triangle)
                for axis, index, keep_greater in (
                    (0, cell_x, True),
                    (0, cell_x + 1, False),
                    (2, cell_z, True),
                    (2, cell_z + 1, False),
                ):
                    if not clipped:
                        break
                    clipped = _clip(clipped, axis, index * column_ldu, keep_greater)
                if not clipped:
                    continue
                low = min(point[1] for point in clipped)
                high = max(point[1] for point in clipped)
                span_x = max(point[0] for point in clipped) - min(point[0] for point in clipped)
                span_z = max(point[2] for point in clipped) - min(point[2] for point in clipped)
                if span_x > 0 and span_z > 0:
                    _extend(cells, (cell_x, cell_z), low, high)
                    continue
                offsets: list[list[int]] = []
                for axis, index in ((0, cell_x), (2, cell_z)):
                    if all(point[axis] == index * column_ldu for point in clipped):
                        offsets.append([0, -1])
                    elif all(point[axis] == (index + 1) * column_ldu for point in clipped):
                        offsets.append([0, 1])
                    else:
                        offsets.append([0])
                homes = [
                    (cell_x + offset_x, cell_z + offset_z)
                    for offset_x in offsets[0]
                    for offset_z in offsets[1]
                ]
                deferred.append(((cell_x, cell_z), low, high, homes))
    for cell, low, high, homes in deferred:
        if any(
            home in cells and cells[home][0] <= low + 1e-9 and cells[home][1] >= high - 1e-9
            for home in homes
        ):
            continue
        _extend(cells, cell, low, high)
    return cells


def _greedy_rectangles(cells: set[tuple[int, int]]) -> list[tuple[int, int, int, int]]:
    """Merge equal-height columns into maximal rectangles, x first then z."""

    remaining = set(cells)
    rectangles: list[tuple[int, int, int, int]] = []
    for cell_x, cell_z in sorted(cells, key=lambda cell: (cell[1], cell[0])):
        if (cell_x, cell_z) not in remaining:
            continue
        last_x = cell_x
        while (last_x + 1, cell_z) in remaining:
            last_x += 1
        last_z = cell_z
        while all((column, last_z + 1) in remaining for column in range(cell_x, last_x + 1)):
            last_z += 1
        for column in range(cell_x, last_x + 1):
            for row in range(cell_z, last_z + 1):
                remaining.discard((column, row))
        rectangles.append((cell_x, last_x, cell_z, last_z))
    return rectangles


def _stud_cylinders(
    triangles: Sequence[Triangle], solid_bounds: tuple[Vector3, Vector3]
) -> list[dict[str, object]]:
    """One axis-aware cylinder and outward connector per visible stud component."""

    cylinders: list[dict[str, object]] = []
    for members in connected_surface_components(triangles):
        points = [point for index in members for point in triangles[index]]
        low = tuple(min(point[axis] for point in points) for axis in range(3))
        high = tuple(max(point[axis] for point in points) for axis in range(3))
        extents = tuple(high[axis] - low[axis] for axis in range(3))
        shortest = min(extents)
        axes = [axis for axis, extent in enumerate(extents) if abs(extent - shortest) <= 1e-9]
        if len(axes) != 1:
            raise ValueError(
                f"Stud component in measured surface has extents {list(extents)}; exactly one "
                "short cylinder axis is required before its connector normal can be emitted."
            )
        axis = axes[0]
        perpendicular = [other for other in range(3) if other != axis]
        center = tuple((low[coordinate] + high[coordinate]) / 2 for coordinate in range(3))
        radius = max(
            math.hypot(
                point[perpendicular[0]] - center[perpendicular[0]],
                point[perpendicular[1]] - center[perpendicular[1]],
            )
            for point in points
        )
        seats_on_min_face = abs(high[axis] - solid_bounds[0][axis]) <= abs(
            low[axis] - solid_bounds[1][axis]
        )
        seat = high[axis] if seats_on_min_face else low[axis]
        position = list(center)
        position[axis] = seat
        normal = [0.0, 0.0, 0.0]
        normal[axis] = -1.0 if seats_on_min_face else 1.0
        cylinders.append(
            {
                "body": {
                    "kind": "cylinder",
                    "tag": "stud",
                    "axis": "xyz"[axis],
                    "centerLdu": list(center),
                    "radiusLdu": radius,
                    "heightLdu": extents[axis],
                },
                "connector": {
                    "kind": "stud",
                    "gender": "male",
                    "positionLdu": position,
                    "normal": normal,
                },
            }
        )
    return sorted(cylinders, key=lambda row: tuple(row["connector"]["positionLdu"]))  # type: ignore[index]


def _clutch_connectors(
    bodies: Sequence[dict[str, object]],
    stud_centers: Sequence[tuple[float, float]],
    plan_bounds: tuple[float, float, float, float],
    bottom_y: float,
) -> list[dict[str, object]]:
    """A clutch only where a whole stud footprint is backed by solid on that face.

    part-model.md line 77: taking the cell centre instead would invent a grip
    wherever a conservative body overshoots the real part.
    """

    candidate = validate_candidate(
        {
            "schemaVersion": CANDIDATE_SCHEMA_VERSION,
            "designId": "probe",
            "frame": CANDIDATE_FRAME,
            "derivation": "clutch-backing-probe",
            "bodies": list(bodies),
            "connectors": [],
        }
    )
    index = PlanIndex.build(candidate.bodies)
    if stud_centers:
        centers_x = sorted({round(center[0], 6) for center in stud_centers})
        centers_z = sorted({round(center[1], 6) for center in stud_centers})
    else:
        centers_x = lattice_cell_centers(plan_bounds[0], plan_bounds[1])
        centers_z = lattice_cell_centers(plan_bounds[2], plan_bounds[3])
    probe_y = bottom_y - CLUTCH_BACKING_PROBE_DEPTH_LDU
    connectors: list[dict[str, object]] = []
    for center_x in centers_x:
        for center_z in centers_z:
            backed = True
            for radius in CLUTCH_BACKING_RINGS:
                spokes = 1 if radius == 0 else CLUTCH_BACKING_SPOKES
                for spoke in range(spokes):
                    angle = 2 * math.pi * spoke / spokes
                    point = (
                        center_x + radius * math.cos(angle),
                        probe_y,
                        center_z + radius * math.sin(angle),
                    )
                    if not index.contains_point(point):
                        backed = False
                        break
                if not backed:
                    break
            if backed:
                connectors.append(
                    {
                        "kind": "undersideClutch",
                        "gender": "female",
                        "positionLdu": [center_x, bottom_y, center_z],
                        "normal": [0.0, 1.0, 0.0],
                    }
                )
    return connectors


def column_candidate(
    surface: MeasuredSurface, column_ldu: float = DEFAULT_COLUMN_LDU
) -> dict[str, object]:
    """Per-column height-field decomposition of one measured surface."""

    if column_ldu <= 0 or STUD_PITCH_LDU % column_ldu != 0:
        raise ValueError(
            f"Column size {column_ldu} LDU must be positive and divide the 20 LDU stud pitch, so "
            "column boundaries fall on stud-cell boundaries."
        )
    solid_triangles = [
        triangle
        for triangle, role in zip(surface.triangles, surface.roles)
        if role != STUD_ROLE
    ]
    if not solid_triangles:
        raise ValueError(
            f"Measured surface {surface.design_id} has only stud-role triangles; a column "
            "decomposition needs a body."
        )
    cells = _height_field(solid_triangles, column_ldu)
    surface_low = min(low for low, _ in cells.values())
    surface_high = max(high for _, high in cells.values())
    groups: dict[tuple[int, int], set[tuple[int, int]]] = {}
    for cell, (low, high) in cells.items():
        if high - low < MINIMUM_COLUMN_HEIGHT_LDU:
            # A column whose only surface is one horizontal sheet — 35480's open-stud
            # ledge meets its cavity ceiling on the same plane, so the real material
            # there is zero-thickness. The sheet is still surface that has to be
            # contained, so it becomes a body of the minimum thickness rather than
            # being dropped, which would fail containment for a point the part has.
            middle = (low + high) / 2
            low, high = middle - MINIMUM_COLUMN_HEIGHT_LDU / 2, middle + MINIMUM_COLUMN_HEIGHT_LDU / 2
            # Clamped to the measured surface, so giving a sheet a thickness can
            # never grow the part past its own bounds and turn an exact eight-LDU
            # plate into an off-lattice 8.0005.
            if low < surface_low:
                low, high = surface_low, surface_low + MINIMUM_COLUMN_HEIGHT_LDU
            elif high > surface_high:
                low, high = surface_high - MINIMUM_COLUMN_HEIGHT_LDU, surface_high
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
    clutches = _clutch_connectors(bodies, stud_centers, plan_bounds, solid_bounds[1][1])
    connectors.extend(clutches)
    candidate = {
        "schemaVersion": CANDIDATE_SCHEMA_VERSION,
        "designId": surface.design_id,
        "frame": CANDIDATE_FRAME,
        "derivation": (
            f"ldraw-column-height-field/{column_ldu:g}ldu: exact per-column surface y-interval "
            f"boxes, {len(studs)} stud cylinders, and the part-model.md line 77 backing rule "
            f"(a whole stud footprint solid on that face) applied to the bottom face, which "
            f"emitted {len(clutches)} clutch cells"
        ),
        "bodies": bodies,
        "connectors": connectors,
    }
    validate_candidate(candidate)
    return candidate


def horizontally_inset_candidate(
    candidate: dict[str, object], inset_ldu: float = BUILDER_HORIZONTAL_INSET_LDU
) -> dict[str, object]:
    """The Builder failure mode as a probe: shrink every horizontal face inward.

    part-model.md line 121 measures Builder's authored boxes inset a uniform
    0.25 LDU on every horizontal face, which is why its collision path is
    refused. Scoring this proves the scorer fires on the under-claim it exists
    to catch.
    """

    bodies: list[dict[str, object]] = []
    for body in candidate["bodies"]:  # type: ignore[index]
        row = dict(body)  # type: ignore[arg-type]
        if row["kind"] == "cylinder":
            row["radiusLdu"] = max(float(row["radiusLdu"]) - inset_ldu, 1e-3)
        elif row["kind"] in ("box", "wedge"):
            minimum = list(row["minLdu"])  # type: ignore[arg-type]
            maximum = list(row["maxLdu"])  # type: ignore[arg-type]
            for axis in (0, 2):
                if maximum[axis] - minimum[axis] > 2 * inset_ldu + 1e-9:
                    minimum[axis] += inset_ldu
                    maximum[axis] -= inset_ldu
            row["minLdu"] = minimum
            row["maxLdu"] = maximum
        bodies.append(row)
    probe = dict(candidate)
    probe["bodies"] = bodies
    probe["derivation"] = f"{candidate['derivation']} + builder-style {inset_ldu:g} LDU horizontal inset"
    validate_candidate(probe)
    return probe
