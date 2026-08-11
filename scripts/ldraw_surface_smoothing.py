"""Source-faithful LDraw face normals without importing a renderer.

The admission generator keeps original triangle and quad faces until this pass
has applied the same hard-edge policy as Three's pinned ``LDrawLoader``. Type-2
segments are hard, type-5 conditional lines are deliberately absent, and folds
past 67.5 degrees remain hard even when a source line does not align exactly.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence


Vector3 = tuple[float, float, float]
HardEdge = tuple[Vector3, Vector3]

_HASH_MULTIPLIER = (1.0 + 1e-10) * 1e2
_HARD_FOLD_DOT = 0.25


@dataclass(frozen=True)
class SmoothingFace:
    """One original LDraw type-3 or type-4 face after closure transforms."""

    points: tuple[Vector3, ...]
    effective_colour: str

    def __post_init__(self) -> None:
        if len(self.points) not in (3, 4):
            raise ValueError(
                f"LDraw smoothing face has {len(self.points)} vertices; expected a triangle or quad."
            )


def _add(left: Vector3, right: Vector3) -> Vector3:
    return (left[0] + right[0], left[1] + right[1], left[2] + right[2])


def _subtract(left: Vector3, right: Vector3) -> Vector3:
    return (left[0] - right[0], left[1] - right[1], left[2] - right[2])


def _scale(vector: Vector3, scalar: float) -> Vector3:
    return (vector[0] * scalar, vector[1] * scalar, vector[2] * scalar)


def _dot(left: Vector3, right: Vector3) -> float:
    return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]


def _cross(left: Vector3, right: Vector3) -> Vector3:
    return (
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    )


def _normalize(vector: Vector3) -> Vector3:
    length = math.hypot(*vector)
    if length == 0:
        return (0.0, 0.0, 0.0)
    return _scale(vector, 1.0 / length)


def _js_int32(value: float) -> int:
    """The signed 32-bit result of JavaScript's ``~~value`` operation."""

    wrapped = math.trunc(value) & 0xFFFF_FFFF
    return wrapped - 0x1_0000_0000 if wrapped >= 0x8000_0000 else wrapped


def _hash_vertex(point: Vector3) -> str:
    return ",".join(str(_js_int32(value * _HASH_MULTIPLIER)) for value in point)


def _hash_edge(first: Vector3, second: Vector3) -> str:
    return f"{_hash_vertex(first)}_{_hash_vertex(second)}"


def _normalized_ray(first: Vector3, second: Vector3) -> tuple[Vector3, Vector3]:
    direction = _normalize(_subtract(second, first))
    origin = _add(first, _scale(direction, -_dot(first, direction)))
    return origin, direction


def _hash_ray(ray: tuple[Vector3, Vector3]) -> str:
    return _hash_edge(ray[0], ray[1])


class _DisjointCorners:
    def __init__(self, count: int) -> None:
        self.parent = list(range(count))

    def find(self, corner: int) -> int:
        root = corner
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[corner] != corner:
            following = self.parent[corner]
            self.parent[corner] = root
            corner = following
        return root

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root


def _hard_edge_sets(
    hard_edges: Sequence[HardEdge], check_subsegments: bool
) -> tuple[set[str], dict[str, tuple[tuple[Vector3, Vector3], list[float]]]]:
    exact: set[str] = set()
    rays: dict[str, tuple[tuple[Vector3, Vector3], list[float]]] = {}
    for first, second in hard_edges:
        exact.add(_hash_edge(first, second))
        exact.add(_hash_edge(second, first))
        if not check_subsegments:
            continue
        ray = _normalized_ray(first, second)
        ray_hash = _hash_ray(ray)
        info = rays.get(ray_hash)
        if info is None:
            reverse_ray = _normalized_ray(second, first)
            info = (ray, [])
            rays[ray_hash] = info
            rays[_hash_ray(reverse_ray)] = info
        distance_first = _dot(info[0][1], first)
        distance_second = _dot(info[0][1], second)
        if distance_first > distance_second:
            distance_first, distance_second = distance_second, distance_first
        info[1].extend((distance_first, distance_second))
    return exact, rays


def _is_hard_subsegment(
    first: Vector3,
    second: Vector3,
    rays: dict[str, tuple[tuple[Vector3, Vector3], list[float]]],
) -> bool:
    candidate_ray = _normalized_ray(first, second)
    info = rays.get(_hash_ray(candidate_ray))
    if info is None:
        return False
    distance_first = _dot(info[0][1], first)
    distance_second = _dot(info[0][1], second)
    if distance_first > distance_second:
        distance_first, distance_second = distance_second, distance_first
    distances = info[1]
    return any(
        distance_first >= distances[index] and distance_second <= distances[index + 1]
        for index in range(0, len(distances), 2)
    )


def smooth_face_normals(
    faces: Sequence[SmoothingFace], hard_edges: Sequence[HardEdge]
) -> tuple[tuple[Vector3, ...], ...]:
    """Return one unit normal per original face corner.

    This mirrors Three 0.185's LDrawLoader policy. Its expensive collinear
    subsegment check runs only when more than one effective face colour exists;
    that condition is intentionally part of the result rather than an
    unconditional approximation.
    """

    if not faces:
        return ()
    check_subsegments = len({face.effective_colour for face in faces}) > 1
    exact_hard_edges, hard_edge_rays = _hard_edge_sets(hard_edges, check_subsegments)
    face_normals = tuple(
        _normalize(
            _cross(
                _subtract(face.points[1], face.points[0]),
                _subtract(face.points[2], face.points[1]),
            )
        )
        for face in faces
    )
    corner_offsets: list[int] = []
    corner_count = 0
    for face in faces:
        corner_offsets.append(corner_count)
        corner_count += len(face.points)
    islands = _DisjointCorners(corner_count)

    half_edges: dict[str, tuple[int, int]] = {}
    for face_index, face in enumerate(faces):
        for edge_index, first in enumerate(face.points):
            second = face.points[(edge_index + 1) % len(face.points)]
            edge_hash = _hash_edge(first, second)
            if edge_hash in exact_hard_edges:
                continue
            if check_subsegments and _is_hard_subsegment(first, second, hard_edge_rays):
                continue
            # Assignment, rather than a list, matches LDrawLoader's last-edge
            # treatment of malformed non-manifold duplicate half edges.
            half_edges[edge_hash] = (face_index, edge_index)

    connected_pairs: set[tuple[int, int, int, int]] = set()
    for face_index, face in enumerate(faces):
        for edge_index, first in enumerate(face.points):
            second_index = (edge_index + 1) % len(face.points)
            second = face.points[second_index]
            own = half_edges.get(_hash_edge(first, second))
            other = half_edges.get(_hash_edge(second, first))
            if own != (face_index, edge_index) or other is None:
                continue
            other_face_index, other_edge_index = other
            if other_face_index == face_index:
                continue
            pair = tuple(sorted((face_index, other_face_index))) + tuple(
                sorted((edge_index, other_edge_index))
            )
            if pair in connected_pairs:
                continue
            connected_pairs.add(pair)
            if abs(_dot(face_normals[face_index], face_normals[other_face_index])) < _HARD_FOLD_DOT:
                continue
            other_next = (other_edge_index + 1) % len(faces[other_face_index].points)
            islands.union(
                corner_offsets[face_index] + edge_index,
                corner_offsets[other_face_index] + other_next,
            )
            islands.union(
                corner_offsets[face_index] + second_index,
                corner_offsets[other_face_index] + other_edge_index,
            )

    sum_by_island: dict[int, Vector3] = {}
    for face_index, face in enumerate(faces):
        for corner_index in range(len(face.points)):
            root = islands.find(corner_offsets[face_index] + corner_index)
            sum_by_island[root] = _add(sum_by_island.get(root, (0.0, 0.0, 0.0)), face_normals[face_index])
    normal_by_island = {root: _normalize(total) for root, total in sum_by_island.items()}
    return tuple(
        tuple(
            normal_by_island[islands.find(corner_offsets[face_index] + corner_index)]
            for corner_index in range(len(face.points))
        )
        for face_index, face in enumerate(faces)
    )
