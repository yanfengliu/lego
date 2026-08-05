"""Does a declared female connector have room for a stud in the real part.

The scorer's male axis has LDraw truth to match against — a visible stud
primitive is either there or it is not. A female clutch has none: an LDraw
underside is a cavity, so nothing marks a cell, and the measured tubes sit at the
half pitch between cells rather than on them. What can still be measured is the
physical claim itself. A clutch says "a stud enters here", which is two facts
about the source surface:

  * the nominal stud volume — a 6 LDU radius, 4 LDU deep cylinder driven into the
    part from the connector's own face — is free of material, and
  * that face is open over the cell, rather than a closed skin a stud would meet.

Both are measured against the expanded LDraw surface, so a Builder-authored cell
is checked against geometry Builder did not supply. Neither is a coverage count:
a part may legitimately carry fewer clutches than cells, and this says nothing
about the ones that are absent.
"""

from __future__ import annotations

import math
from typing import Sequence

from part_admission_contract import Candidate, Connector, Triangle, Vector3
from part_admission_geometry import sample_triangle

STUD_RADIUS_LDU = 6.0
STUD_DEPTH_LDU = 4.0
LDRAW_CIRCLE_SEGMENTS = 16
# An LDraw circle is an inscribed 16-gon, so a socket wall that is nominally
# tangent to the stud reads as r * (1 - cos(pi / 16)) = 0.115288 LDU of material
# inside the stud volume. Anything at or under one sagitta is the tessellation,
# not the part. The bound is two sagittae so a nominally tangent wall cannot fail
# on where a sample happened to land, and it stays two orders of magnitude below
# the 6 LDU it is measuring.
LDRAW_INSCRIBED_SAGITTA_LDU = STUD_RADIUS_LDU * (
    1.0 - math.cos(math.pi / LDRAW_CIRCLE_SEGMENTS)
)
CLUTCH_ROOM_TOLERANCE_LDU = 2.0 * LDRAW_INSCRIBED_SAGITTA_LDU
FACE_OPENING_RADIUS_LDU = STUD_RADIUS_LDU - 1.0
FACE_PLANE_EPSILON_LDU = 1e-6
CLUTCH_SAMPLE_SPACING_LDU = 0.25
MAX_RECORDED_CLUTCH_ROWS = 32


def _axis_index(normal: Vector3) -> int:
    for axis in range(3):
        if abs(abs(normal[axis]) - 1.0) < 1e-9 and all(
            abs(normal[other]) < 1e-9 for other in range(3) if other != axis
        ):
            return axis
    raise ValueError(
        f"Clutch normal {list(normal)} is not an axis. This probe drives the nominal stud along the "
        "connector normal, so an off-axis clutch needs a measured swept volume before it can be "
        "checked at all."
    )


def _relevant(triangles: Sequence[Triangle], connector: Connector, axis: int) -> list[Triangle]:
    sign = 1.0 if connector.normal[axis] > 0 else -1.0
    low = [value - STUD_RADIUS_LDU for value in connector.position]
    high = [value + STUD_RADIUS_LDU for value in connector.position]
    low[axis] = min(connector.position[axis], connector.position[axis] - sign * STUD_DEPTH_LDU)
    high[axis] = max(connector.position[axis], connector.position[axis] - sign * STUD_DEPTH_LDU)
    selected = []
    for triangle in triangles:
        if all(
            max(point[a] for point in triangle) >= low[a] - 1e-9
            and min(point[a] for point in triangle) <= high[a] + 1e-9
            for a in range(3)
        ):
            selected.append(triangle)
    return selected


def measure_one_clutch(
    connector: Connector, triangles: Sequence[Triangle], spacing_ldu: float
) -> dict[str, object]:
    axis = _axis_index(connector.normal)
    sign = 1.0 if connector.normal[axis] > 0 else -1.0
    plane = connector.position[axis]
    plan = [a for a in range(3) if a != axis]
    intrusion = 0.0
    deepest: Vector3 | None = None
    inside = 0
    obstructing = 0
    first_material_depth: float | None = None
    for triangle in _relevant(triangles, connector, axis):
        for point in sample_triangle(triangle, spacing_ldu):
            radial = math.hypot(*(point[a] - connector.position[a] for a in plan))
            depth = sign * (plane - point[axis])
            if radial <= FACE_OPENING_RADIUS_LDU and abs(depth) <= FACE_PLANE_EPSILON_LDU:
                obstructing += 1
            if depth > 0 and (first_material_depth is None or depth < first_material_depth):
                if radial <= FACE_OPENING_RADIUS_LDU:
                    first_material_depth = depth
            if radial >= STUD_RADIUS_LDU or depth <= 0.0 or depth >= STUD_DEPTH_LDU:
                continue
            inside += 1
            clearance = min(STUD_RADIUS_LDU - radial, depth, STUD_DEPTH_LDU - depth)
            if clearance > intrusion:
                intrusion, deepest = clearance, point
    return {
        "positionLdu": [round(value, 9) for value in connector.position],
        "normal": [round(value, 9) for value in connector.normal],
        "surfacePointsInsideStudVolume": inside,
        "maximumIntrusionLdu": round(intrusion, 9),
        "deepestIntrudingPointLdu": None
        if deepest is None
        else [round(value, 6) for value in deepest],
        "facePointsBlockingOpening": obstructing,
        "firstMaterialDepthLdu": None
        if first_material_depth is None
        else round(first_material_depth, 9),
        "hasRoomForStud": intrusion <= CLUTCH_ROOM_TOLERANCE_LDU and obstructing == 0,
    }


def measure_clutch_room(
    candidate: Candidate,
    triangles: Sequence[Triangle],
    spacing_ldu: float = CLUTCH_SAMPLE_SPACING_LDU,
) -> dict[str, object]:
    """Every declared clutch, measured against the source surface it claims to grip."""

    rows = [
        measure_one_clutch(connector, triangles, spacing_ldu)
        for connector in candidate.female_connectors
    ]
    without_room = [row for row in rows if not row["hasRoomForStud"]]
    return {
        "studRadiusLdu": STUD_RADIUS_LDU,
        "studDepthLdu": STUD_DEPTH_LDU,
        "sampleSpacingLdu": spacing_ldu,
        "roomToleranceLdu": CLUTCH_ROOM_TOLERANCE_LDU,
        "ldrawInscribedSagittaLdu": LDRAW_INSCRIBED_SAGITTA_LDU,
        "declaredClutches": len(rows),
        "clutchesWithRoom": len(rows) - len(without_room),
        "maximumIntrusionLdu": max((float(row["maximumIntrusionLdu"]) for row in rows), default=0.0),
        "clutches": rows[:MAX_RECORDED_CLUTCH_ROWS],
        "clutchesRecorded": min(len(rows), MAX_RECORDED_CLUTCH_ROWS),
    }


def clutch_hard_fails(measurement: dict[str, object]) -> list[dict[str, object]]:
    """The one failure this measurement is allowed to declare, and why it is hard."""

    rows = measurement["clutches"]
    if not isinstance(rows, list):
        return []
    blocked = [row for row in rows if not row["hasRoomForStud"]]
    if not blocked:
        return []
    worst = max(blocked, key=lambda row: float(row["maximumIntrusionLdu"]))
    return [
        {
            "code": "female-connector-has-no-room-for-a-stud",
            "detail": (
                f"{len(blocked)} of {measurement['declaredClutches']} declared clutches claim a grip "
                f"the source surface does not leave room for; the worst sits at "
                f"{worst['positionLdu']} with {worst['maximumIntrusionLdu']} LDU of material inside "
                f"the nominal {STUD_RADIUS_LDU} by {STUD_DEPTH_LDU} LDU stud volume and "
                f"{worst['facePointsBlockingOpening']} sampled points closing its face, against a "
                f"tolerance of {CLUTCH_ROOM_TOLERANCE_LDU:.9f} LDU. A connector is a physical claim: "
                "a clutch where a stud cannot enter lets the editor attach where the real part "
                "cannot."
            ),
        }
    ]
