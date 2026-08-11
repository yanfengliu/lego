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
    center_xz: tuple[float, float]
    radius_ldu: float
    y_min: float
    y_max: float
    base_y: float
    normal: Vector3
    triangle_count: int

    @property
    def position(self) -> Vector3:
        return (self.center_xz[0], self.base_y, self.center_xz[1])


def _cluster_connectors(
    triangles: Sequence[Triangle], body_bounds: tuple[Vector3, Vector3] | None, face: str
) -> list[MeasuredConnector]:
    connectors: list[MeasuredConnector] = []
    for members in connected_surface_components(triangles):
        points = [point for index in members for point in triangles[index]]
        min_x = min(point[0] for point in points)
        max_x = max(point[0] for point in points)
        min_z = min(point[2] for point in points)
        max_z = max(point[2] for point in points)
        min_y = min(point[1] for point in points)
        max_y = max(point[1] for point in points)
        center = ((min_x + max_x) / 2, (min_z + max_z) / 2)
        radius = max(math.hypot(point[0] - center[0], point[2] - center[1]) for point in points)
        if face == "top":
            base_y, normal = max_y, (0.0, -1.0, 0.0)
            if body_bounds is not None and abs(min_y - body_bounds[1][1]) < abs(
                max_y - body_bounds[0][1]
            ):
                base_y, normal = min_y, (0.0, 1.0, 0.0)
        else:
            base_y, normal = max_y, (0.0, 1.0, 0.0)
            if body_bounds is not None:
                base_y = body_bounds[1][1]
        connectors.append(
            MeasuredConnector(
                center_xz=center,
                radius_ldu=radius,
                y_min=min_y,
                y_max=max_y,
                base_y=base_y,
                normal=normal,
                triangle_count=len(members),
            )
        )
    return sorted(connectors, key=lambda row: (row.center_xz[0], row.center_xz[1]))


def measured_connectors(surface: MeasuredSurface) -> dict[str, list[MeasuredConnector]]:
    body_bounds = _bounds(surface.by_role(BODY_ROLE))
    return {
        "male": _cluster_connectors(surface.by_role(STUD_ROLE), body_bounds, "top"),
        "female": _cluster_connectors(surface.by_role(CLUTCH_ROLE), body_bounds, "bottom"),
    }
