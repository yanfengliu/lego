"""One measured LDraw surface, and the connectors it actually carries.

A role per triangle is the whole trick: the visible stud primitives the source
pilot pins mark studs, the underside tube primitives mark tubes, and everything
else is body. Components are found by shared exact vertices rather than by
distance, because a 16-segment circle of radius 8 has a chord wider than the gap
between neighbouring tubes, so any threshold either splits one tube or merges two.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

from part_admission_contract import Triangle, Vector3
from part_admission_geometry import connected_surface_components

BODY_ROLE = "body"
STUD_ROLE = "stud"
CLUTCH_ROLE = "clutchTube"


@dataclass(frozen=True)
class MeasuredSurface:
    """One expanded, BFC-corrected LDraw surface with a role per triangle."""

    design_id: str
    triangles: tuple[Triangle, ...]
    roles: tuple[str, ...]
    # One source-faithful asset-local unit normal for every triangle corner.
    corner_normals: tuple[Triangle, ...] | None = None

    def __post_init__(self) -> None:
        if len(self.triangles) != len(self.roles):
            raise ValueError(
                f"Measured surface {self.design_id} has {len(self.triangles)} triangles and "
                f"{len(self.roles)} roles; every triangle needs exactly one role."
            )
        if not self.triangles:
            raise ValueError(f"Measured surface {self.design_id} has no triangles to measure.")
        if self.corner_normals is not None and len(self.corner_normals) != len(self.triangles):
            raise ValueError(
                f"Measured surface {self.design_id} has {len(self.triangles)} triangles and "
                f"{len(self.corner_normals)} corner-normal rows; every triangle needs one row."
            )

    def by_role(self, role: str) -> tuple[Triangle, ...]:
        return tuple(
            triangle for triangle, actual in zip(self.triangles, self.roles) if actual == role
        )


def _bounds(triangles: Sequence[Triangle]) -> tuple[Vector3, Vector3] | None:
    points = [point for triangle in triangles for point in triangle]
    if not points:
        return None
    minimum = tuple(min(point[axis] for point in points) for axis in range(3))
    maximum = tuple(max(point[axis] for point in points) for axis in range(3))
    return minimum, maximum  # type: ignore[return-value]


@dataclass(frozen=True)
class MeasuredConnector:
    center: Vector3
    radius_ldu: float
    minimum: Vector3
    maximum: Vector3
    axis: int
    seat: Vector3
    normal: Vector3
    triangle_count: int

    @property
    def position(self) -> Vector3:
        return self.seat

    @property
    def center_xz(self) -> tuple[float, float]:
        return (self.center[0], self.center[2])

    @property
    def y_min(self) -> float:
        return self.minimum[1]

    @property
    def y_max(self) -> float:
        return self.maximum[1]

    @property
    def base_y(self) -> float:
        return self.seat[1]

    @property
    def height_ldu(self) -> float:
        return self.maximum[self.axis] - self.minimum[self.axis]


def _cluster_connectors(
    triangles: Sequence[Triangle], body_bounds: tuple[Vector3, Vector3] | None, face: str
) -> list[MeasuredConnector]:
    connectors: list[MeasuredConnector] = []
    for members in connected_surface_components(triangles):
        points = [point for index in members for point in triangles[index]]
        minimum = tuple(min(point[axis] for point in points) for axis in range(3))
        maximum = tuple(max(point[axis] for point in points) for axis in range(3))
        center = tuple((minimum[axis] + maximum[axis]) / 2 for axis in range(3))
        if face == "top":
            extents = tuple(maximum[axis] - minimum[axis] for axis in range(3))
            shortest = min(extents)
            axes = [axis for axis, extent in enumerate(extents) if abs(extent - shortest) <= 1e-9]
            if len(axes) != 1:
                raise ValueError(
                    f"Visible stud component has extents {list(extents)}; exactly one short "
                    "cylinder axis is required to measure its outward connector frame."
                )
            axis = axes[0]
            seats_on_min_face = body_bounds is None or abs(maximum[axis] - body_bounds[0][axis]) <= abs(
                minimum[axis] - body_bounds[1][axis]
            )
            seat = list(center)
            seat[axis] = maximum[axis] if seats_on_min_face else minimum[axis]
            normal = [0.0, 0.0, 0.0]
            normal[axis] = -1.0 if seats_on_min_face else 1.0
        else:
            axis = 1
            seat = [center[0], maximum[1], center[2]]
            normal = [0.0, 1.0, 0.0]
            if body_bounds is not None:
                seat[1] = body_bounds[1][1]
        perpendicular = [other for other in range(3) if other != axis]
        radius = max(
            math.hypot(
                point[perpendicular[0]] - center[perpendicular[0]],
                point[perpendicular[1]] - center[perpendicular[1]],
            )
            for point in points
        )
        connectors.append(
            MeasuredConnector(
                center=center,  # type: ignore[arg-type]
                radius_ldu=radius,
                minimum=minimum,  # type: ignore[arg-type]
                maximum=maximum,  # type: ignore[arg-type]
                axis=axis,
                seat=tuple(seat),  # type: ignore[arg-type]
                normal=tuple(normal),  # type: ignore[arg-type]
                triangle_count=len(members),
            )
        )
    return sorted(connectors, key=lambda row: (row.position, row.normal))


def measured_connectors(surface: MeasuredSurface) -> dict[str, list[MeasuredConnector]]:
    body_bounds = _bounds(surface.by_role(BODY_ROLE))
    return {
        "male": _cluster_connectors(surface.by_role(STUD_ROLE), body_bounds, "top"),
        "female": _cluster_connectors(surface.by_role(CLUTCH_ROLE), body_bounds, "bottom"),
    }
