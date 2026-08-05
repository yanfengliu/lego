"""Geometry a catalog-part admission score is measured with.

Two rules from docs/design/part-model.md decide the shape of this module.
Containment, never parity: an LDraw part has no inside because its hollows are
open primitives, so every point of the real surface must lie inside the union of
the candidate's convex bodies (line 70).
And a reference material volume is a bracket, never a single figure: the same
open surfaces make the three exact projection estimators disagree, and the width
of that disagreement is the measured cost of non-closure.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterator, Sequence

from part_admission_contract import (
    AXIS_INDEX,
    Body,
    CONTAINMENT_EPSILON_LDU,
    MAX_PLAN_INDEX_CELLS_PER_BODY,
    MAX_TRIANGLE_SUBDIVISION,
    PLAN_INDEX_CELL_LDU,
    QUANTIZATION_SCALE,
    Triangle,
    Vector2,
    Vector3,
)


def polygon_area(polygon: Sequence[Vector2]) -> float:
    total = 0.0
    count = len(polygon)
    for index in range(count):
        first = polygon[index]
        second = polygon[(index + 1) % count]
        total += first[0] * second[1] - second[0] * first[1]
    return abs(total) / 2


def _clip_half_plane(polygon: Sequence[Vector2], normal: Vector2, offset: float) -> list[Vector2]:
    """Keep the part of a convex plan polygon where normal . point <= offset."""

    result: list[Vector2] = []
    count = len(polygon)
    for index in range(count):
        current = polygon[index]
        following = polygon[(index + 1) % count]
        current_value = normal[0] * current[0] + normal[1] * current[1] - offset
        following_value = normal[0] * following[0] + normal[1] * following[1] - offset
        if current_value <= 0:
            result.append(current)
        if (current_value < 0) != (following_value < 0) and current_value != following_value:
            ratio = current_value / (current_value - following_value)
            result.append(
                (
                    current[0] + (following[0] - current[0]) * ratio,
                    current[1] + (following[1] - current[1]) * ratio,
                )
            )
    return result


def body_plan_polygon(body: Body) -> tuple[Vector2, ...]:
    if body.kind == "convex-prism":
        return body.polygon
    rectangle = (
        (body.minimum[0], body.minimum[2]),
        (body.maximum[0], body.minimum[2]),
        (body.maximum[0], body.maximum[2]),
        (body.minimum[0], body.maximum[2]),
    )
    if body.kind == "wedge" and body.cut_normal is not None:
        return tuple(_clip_half_plane(rectangle, body.cut_normal, body.cut_offset))
    return rectangle


def body_volume(body: Body) -> float:
    if body.kind == "box":
        return math.prod(body.maximum[axis] - body.minimum[axis] for axis in range(3))
    if body.kind == "cylinder":
        return math.pi * body.radius * body.radius * body.height
    if body.kind == "convex-prism":
        return polygon_area(body.polygon) * (body.maximum[1] - body.minimum[1])
    return polygon_area(body_plan_polygon(body)) * (body.maximum[1] - body.minimum[1])


def body_contains(body: Body, point: Vector3, epsilon: float = CONTAINMENT_EPSILON_LDU) -> bool:
    if body.kind == "cylinder":
        axis = AXIS_INDEX[body.axis]
        if abs(point[axis] - body.center[axis]) > body.height / 2 + epsilon:
            return False
        radial = math.hypot(
            *(point[other] - body.center[other] for other in range(3) if other != axis)
        )
        return radial <= body.radius + epsilon
    for axis in range(3):
        if point[axis] < body.minimum[axis] - epsilon or point[axis] > body.maximum[axis] + epsilon:
            return False
    if body.kind == "wedge" and body.cut_normal is not None:
        if body.cut_normal[0] * point[0] + body.cut_normal[1] * point[2] > body.cut_offset + epsilon:
            return False
        return True
    if body.kind == "convex-prism":
        count = len(body.polygon)
        for index in range(count):
            first = body.polygon[index]
            second = body.polygon[(index + 1) % count]
            edge = (second[0] - first[0], second[1] - first[1])
            length = math.hypot(*edge)
            signed = edge[0] * (point[2] - first[1]) - edge[1] * (point[0] - first[0])
            if signed < -epsilon * length:
                return False
    return True


def body_exterior_distance(body: Body, point: Vector3) -> float:
    """A lower bound on the distance from an outside point to this convex body."""

    if body.kind == "cylinder":
        axis = AXIS_INDEX[body.axis]
        axial = max(0.0, abs(point[axis] - body.center[axis]) - body.height / 2)
        radial = math.hypot(
            *(point[other] - body.center[other] for other in range(3) if other != axis)
        )
        return math.hypot(axial, max(0.0, radial - body.radius))
    box = math.hypot(
        *(
            max(0.0, body.minimum[axis] - point[axis], point[axis] - body.maximum[axis])
            for axis in range(3)
        )
    )
    if body.kind == "wedge" and body.cut_normal is not None:
        cut = body.cut_normal[0] * point[0] + body.cut_normal[1] * point[2] - body.cut_offset
        return max(box, cut)
    if body.kind == "convex-prism":
        plan = 0.0
        count = len(body.polygon)
        for index in range(count):
            first = body.polygon[index]
            second = body.polygon[(index + 1) % count]
            edge = (second[0] - first[0], second[1] - first[1])
            length = math.hypot(*edge)
            signed = edge[0] * (point[2] - first[1]) - edge[1] * (point[0] - first[0])
            plan = max(plan, -signed / length)
        vertical = max(0.0, body.minimum[1] - point[1], point[1] - body.maximum[1])
        return math.hypot(plan, vertical)
    return box


@dataclass
class PlanIndex:
    """Uniform (x, z) bucket index over candidate bodies, for point queries."""

    cell_ldu: float = PLAN_INDEX_CELL_LDU
    buckets: dict[tuple[int, int], list[int]] = field(default_factory=dict)
    everywhere: list[int] = field(default_factory=list)
    bodies: tuple[Body, ...] = ()

    @staticmethod
    def build(
        bodies: Sequence[Body],
        cell_ldu: float | None = None,
        epsilon: float = CONTAINMENT_EPSILON_LDU,
    ) -> "PlanIndex":
        """Bucket bodies by plan cell, padded by the containment epsilon.

        Without the padding a point that rounds a few units in the last place
        past a bucket boundary looks outside a body whose face it is exactly on:
        the body is registered in the next bucket along and never tested.

        The default cell tracks the median body, so a fine column decomposition
        does not put four hundred bodies in one bucket.
        """

        if cell_ldu is None:
            extents = sorted(
                max(body.maximum[0] - body.minimum[0], body.maximum[2] - body.minimum[2])
                for body in bodies
            )
            cell_ldu = min(PLAN_INDEX_CELL_LDU, max(1.0, extents[len(extents) // 2]))
        index = PlanIndex(cell_ldu=cell_ldu, bodies=tuple(bodies))
        for body in bodies:
            first_x = math.floor((body.minimum[0] - epsilon) / cell_ldu)
            last_x = math.floor((body.maximum[0] + epsilon) / cell_ldu)
            first_z = math.floor((body.minimum[2] - epsilon) / cell_ldu)
            last_z = math.floor((body.maximum[2] + epsilon) / cell_ldu)
            spans = (last_x - first_x + 1) * (last_z - first_z + 1)
            if spans > MAX_PLAN_INDEX_CELLS_PER_BODY:
                index.everywhere.append(body.index)
                continue
            for cell_x in range(first_x, last_x + 1):
                for cell_z in range(first_z, last_z + 1):
                    index.buckets.setdefault((cell_x, cell_z), []).append(body.index)
        return index

    def candidates(self, point: Vector3) -> list[int]:
        cell = (math.floor(point[0] / self.cell_ldu), math.floor(point[2] / self.cell_ldu))
        return self.buckets.get(cell, []) + self.everywhere

    def neighbourhood(self, point: Vector3) -> list[int]:
        cell_x = math.floor(point[0] / self.cell_ldu)
        cell_z = math.floor(point[2] / self.cell_ldu)
        found: list[int] = list(self.everywhere)
        for offset_x in (-1, 0, 1):
            for offset_z in (-1, 0, 1):
                found.extend(self.buckets.get((cell_x + offset_x, cell_z + offset_z), []))
        return found

    def contains_point(self, point: Vector3, epsilon: float = CONTAINMENT_EPSILON_LDU) -> bool:
        for body_index in self.candidates(point):
            if body_contains(self.bodies[body_index], point, epsilon):
                return True
        return False

    def escape_distance(self, point: Vector3) -> float:
        found = self.neighbourhood(point)
        if not found:
            return float("inf")
        return min(body_exterior_distance(self.bodies[body_index], point) for body_index in found)


def sample_triangle(triangle: Triangle, spacing_ldu: float) -> Iterator[Vector3]:
    """Barycentric grid over one triangle, at most `spacing_ldu` apart."""

    first, second, third = triangle
    longest = max(
        math.dist(first, second),
        math.dist(second, third),
        math.dist(third, first),
    )
    steps = max(1, min(MAX_TRIANGLE_SUBDIVISION, math.ceil(longest / spacing_ldu)))
    edge_one = tuple(second[axis] - first[axis] for axis in range(3))
    edge_two = tuple(third[axis] - first[axis] for axis in range(3))
    for row in range(steps + 1):
        for column in range(steps - row + 1):
            u = row / steps
            v = column / steps
            yield (
                first[0] + edge_one[0] * u + edge_two[0] * v,
                first[1] + edge_one[1] * u + edge_two[1] * v,
                first[2] + edge_one[2] * u + edge_two[2] * v,
            )


def triangle_area_normal(triangle: Triangle) -> Vector3:
    first, second, third = triangle
    edge_one = tuple(second[axis] - first[axis] for axis in range(3))
    edge_two = tuple(third[axis] - first[axis] for axis in range(3))
    return (
        (edge_one[1] * edge_two[2] - edge_one[2] * edge_two[1]) / 2,
        (edge_one[2] * edge_two[0] - edge_one[0] * edge_two[2]) / 2,
        (edge_one[0] * edge_two[1] - edge_one[1] * edge_two[0]) / 2,
    )


def projection_volumes(triangles: Sequence[Triangle]) -> dict[str, float]:
    """Three exact volume estimators that agree only on a closed oriented surface.

    Each is the divergence theorem applied to one of the fields (x,0,0), (0,y,0)
    and (0,0,z). For a closed oriented 2-manifold all three equal the enclosed
    volume; on an open surface they differ, and the spread is the measured cost
    of the open boundary rather than a modelling choice.
    """

    totals = [0.0, 0.0, 0.0]
    for triangle in triangles:
        normal = triangle_area_normal(triangle)
        for axis in range(3):
            centroid = sum(point[axis] for point in triangle) / 3
            totals[axis] += centroid * normal[axis]
    return {
        "projectionX": totals[0],
        "projectionY": totals[1],
        "projectionZ": totals[2],
        "divergence": sum(totals) / 3,
    }


def _quantize(point: Vector3) -> tuple[int, int, int]:
    return tuple(round(value * QUANTIZATION_SCALE) for value in point)  # type: ignore[return-value]


def open_boundary(triangles: Sequence[Triangle]) -> dict[str, int]:
    """Count directed edges that never cancel, then the ones that survive the
    stronger test of whether the boundary chain cancels on its supporting line."""

    directed: dict[tuple[tuple[int, int, int], tuple[int, int, int]], int] = {}
    for triangle in triangles:
        quantized = [_quantize(point) for point in triangle]
        for index in range(3):
            key = (quantized[index], quantized[(index + 1) % 3])
            directed[key] = directed.get(key, 0) + 1
    residual: list[tuple[tuple[int, int, int], tuple[int, int, int], int]] = []
    for (start, end), count in directed.items():
        surplus = count - directed.get((end, start), 0)
        if surplus > 0:
            residual.append((start, end, surplus))
    naive = sum(surplus for _, _, surplus in residual)

    lines: dict[tuple[tuple[int, int, int], tuple[int, int, int]], list[tuple[int, int, int]]] = {}
    for start, end, surplus in residual:
        direction = tuple(end[axis] - start[axis] for axis in range(3))
        divisor = math.gcd(math.gcd(abs(direction[0]), abs(direction[1])), abs(direction[2]))
        primitive = tuple(value // divisor for value in direction)
        if next((value for value in primitive if value != 0), 0) < 0:
            primitive = tuple(-value for value in primitive)
        moment = (
            start[1] * primitive[2] - start[2] * primitive[1],
            start[2] * primitive[0] - start[0] * primitive[2],
            start[0] * primitive[1] - start[1] * primitive[0],
        )
        parameter_start = sum(start[axis] * primitive[axis] for axis in range(3))
        parameter_end = sum(end[axis] * primitive[axis] for axis in range(3))
        sign = 1 if parameter_end > parameter_start else -1
        low, high = sorted((parameter_start, parameter_end))
        lines.setdefault((primitive, moment), []).append((low, high, sign * surplus))  # type: ignore[arg-type]

    surviving = 0
    for spans in lines.values():
        events: dict[int, int] = {}
        for low, high, weight in spans:
            events[low] = events.get(low, 0) + weight
            events[high] = events.get(high, 0) - weight
        ordered = sorted(events)
        coverage = 0
        uncancelled: set[tuple[int, int]] = set()
        for position, boundary in enumerate(ordered[:-1]):
            coverage += events[boundary]
            if coverage != 0:
                uncancelled.add((boundary, ordered[position + 1]))
        for low, high, weight in spans:
            if any(start >= low and end <= high for start, end in uncancelled):
                surviving += abs(weight)
    return {"directedEdgeResidual": naive, "supportingLineResidual": surviving}


def connected_surface_components(triangles: Sequence[Triangle]) -> list[list[int]]:
    """Group triangles that share an exact quantized vertex.

    Two stud primitives never touch, so a component is one stud, one tube, or one
    connected shell. Distance thresholds do not survive a 16-segment circle of
    radius 8, whose chord is wider than the 4 LDU gap between neighbouring tubes.
    """

    parent = list(range(len(triangles)))

    def find(node: int) -> int:
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    def union(left: int, right: int) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parent[max(left_root, right_root)] = min(left_root, right_root)

    owner: dict[tuple[int, int, int], int] = {}
    for index, triangle in enumerate(triangles):
        for point in triangle:
            key = _quantize(point)
            previous = owner.get(key)
            if previous is None:
                owner[key] = index
            else:
                union(previous, index)
    groups: dict[int, list[int]] = {}
    for index in range(len(triangles)):
        groups.setdefault(find(index), []).append(index)
    return [members for _, members in sorted(groups.items())]
