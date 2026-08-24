"""Pure bounded geometry operations for the quarantined 3245-M variant check.

This module can describe and compare the one exact retained Builder Shell, but it
cannot admit a part or write any catalog truth.  The controller keeps decoded
vertices inside its private temporary directory and publishes only measurements.
"""

from __future__ import annotations

import hashlib
import math
import re
import struct
from typing import Callable, Iterable, NamedTuple, Sequence


SCHEMA_VERSION = "lego.quarantined-builder-3245-variant/1"
WORKER_SCHEMA_VERSION = "lego.quarantined-builder-3245-shell/1"
OUTPUT_NAME = "variant-verdict.json"
DESIGN_ID = "3245"
REVISION = "M"
MAX_OBJECTS = 100_000
MAX_MESH_BYTES = 512 * 1024
MAX_VERTICES = 65_536
MAX_TRIANGLES = 131_072
MAX_SUBMESHES = 64
MAX_WORKER_REPORT_BYTES = 8 * 1024 * 1024
MAX_REPORT_BYTES = 512 * 1024
SURFACE_SAMPLE_SPACING_LDU = 8.0
DISCRIMINATIVE_DISTANCE_LDU = 0.5
BUILDER_NATIVE_FRAME_ID = "lego-builder-native-to-catalog-ldu/1"
BUILDER_NATIVE_BASIS_LINEAR_LDU = (25, 0, 0, 0, -25, 0, 0, 0, -25)


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _bounded_int(value: object, maximum: int, label: str, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(
            f"{label} must be an integer within {minimum}..{maximum}; received {value!r}."
        )
    return value


def _shell_reader(environment: object) -> object:
    objects = getattr(environment, "objects", None)
    if objects is None:
        raise ValueError("Builder bundle exposes no bounded object sequence.")
    shells: list[object] = []
    for count, reader in enumerate(objects, 1):
        if count > MAX_OBJECTS:
            raise ValueError(
                f"Builder bundle exposes more than {MAX_OBJECTS} objects; no further object "
                "is inspected or decoded."
            )
        if getattr(getattr(reader, "type", None), "name", None) != "Mesh":
            continue
        size = _bounded_int(
            getattr(reader, "byte_size", None), MAX_MESH_BYTES, "Mesh serialized bytes", 1
        )
        peek_name = getattr(reader, "peek_name", None)
        if not callable(peek_name):
            raise ValueError("Bounded Mesh candidate lacks the pinned peek_name metadata API.")
        name = peek_name()
        if not isinstance(name, str) or len(name) > 256:
            raise ValueError("Bounded Mesh candidate has a malformed name.")
        path_id = str(getattr(reader, "path_id", ""))
        if re.fullmatch(r"-?[0-9]+", path_id) is None:
            raise ValueError(f"Bounded Mesh candidate has malformed path ID {path_id!r}.")
        if name == "Shell":
            shells.append((reader, size))
    if len(shells) != 1:
        raise ValueError(f"Builder bundle must expose exactly one Mesh named Shell; found {len(shells)}.")
    return shells[0]


def decode_shell(
    environment: object, mesh_handler_factory: Callable[[object], object]
) -> dict[str, object]:
    reader, serialized_bytes = _shell_reader(environment)
    mesh = reader.read()
    if getattr(mesh, "m_Name", None) != "Shell":
        raise ValueError("Decoded Shell name differs from bounded peek metadata.")
    vertex_data = getattr(mesh, "m_VertexData", None)
    declared_vertices = _bounded_int(
        getattr(vertex_data, "m_VertexCount", None), MAX_VERTICES, "Shell declared vertices", 1
    )
    vertex_blob = getattr(vertex_data, "m_DataSize", None)
    if not isinstance(vertex_blob, (bytes, bytearray)) or len(vertex_blob) > MAX_MESH_BYTES:
        raise ValueError("Shell vertex data is unsupported or exceeds its byte bound.")
    submeshes = getattr(mesh, "m_SubMeshes", None)
    if not isinstance(submeshes, (list, tuple)):
        raise ValueError("Shell submesh declaration is not a bounded sequence.")
    declared_submeshes = _bounded_int(
        len(submeshes), MAX_SUBMESHES, "Shell declared submeshes", 1
    )
    declared_indexes = 0
    for index, submesh in enumerate(submeshes):
        topology = _bounded_int(
            getattr(submesh, "topology", None), 4, f"Shell submesh {index} topology"
        )
        if topology != 0:
            raise ValueError(f"Shell submesh {index} uses non-triangle topology {topology}.")
        declared_indexes += _bounded_int(
            getattr(submesh, "indexCount", None),
            MAX_TRIANGLES * 3,
            f"Shell submesh {index} index count",
        )
        _bounded_int(declared_indexes, MAX_TRIANGLES * 3, "Shell aggregate indexes")
    if declared_indexes % 3:
        raise ValueError(f"Shell declares {declared_indexes} indexes, not a triangle multiple.")

    handler = mesh_handler_factory(mesh)
    handler.process()
    raw_vertices = getattr(handler, "m_Vertices", None)
    if not isinstance(raw_vertices, (list, tuple)):
        raise ValueError("Decoded Shell vertices are not a bounded sequence.")
    if len(raw_vertices) != declared_vertices:
        raise ValueError(
            f"Decoded Shell has {len(raw_vertices)} vertices; declaration says {declared_vertices}."
        )
    vertices: list[list[float]] = []
    for vertex_index, raw_vertex in enumerate(raw_vertices):
        if not isinstance(raw_vertex, (list, tuple)) or len(raw_vertex) != 3:
            raise ValueError(f"Decoded Shell vertex {vertex_index} is not a finite triple.")
        vertex = [float(value) for value in raw_vertex]
        if any(not math.isfinite(value) or abs(value) > 1_000_000 for value in vertex):
            raise ValueError(f"Decoded Shell vertex {vertex_index} is non-finite or oversized.")
        vertices.append(vertex)

    raw_groups = handler.get_triangles()
    groups: list[list[list[int]]] = []
    triangle_count = 0
    for group_index, raw_group in enumerate(raw_groups):
        if group_index >= MAX_SUBMESHES:
            raise ValueError(f"Decoded Shell exceeds {MAX_SUBMESHES} triangle groups.")
        group: list[list[int]] = []
        for triangle_index, raw_triangle in enumerate(raw_group):
            triangle_count += 1
            if triangle_count > MAX_TRIANGLES:
                raise ValueError(f"Decoded Shell exceeds {MAX_TRIANGLES} triangles.")
            if not isinstance(raw_triangle, (list, tuple)) or len(raw_triangle) != 3:
                raise ValueError(
                    f"Decoded Shell triangle {group_index}:{triangle_index} is not an index triple."
                )
            triangle: list[int] = []
            for raw_index in raw_triangle:
                index = int(raw_index)
                if isinstance(raw_index, bool) or float(raw_index) != index:
                    raise ValueError("Decoded Shell triangle contains a non-integral index.")
                if not 0 <= index < len(vertices):
                    raise ValueError("Decoded Shell triangle index is outside the vertex array.")
                triangle.append(index)
            group.append(triangle)
        groups.append(group)
    if len(groups) != declared_submeshes or triangle_count * 3 != declared_indexes:
        raise ValueError("Decoded Shell group and triangle counts do not reconcile with declarations.")
    canonical = bytearray()
    for vertex in vertices:
        canonical.extend(struct.pack("<ddd", *vertex))
    canonical.extend(b"\x00")
    for group in groups:
        for triangle in group:
            canonical.extend(struct.pack("<III", *triangle))
        canonical.extend(b"\xff\xff\xff\xff")
    return {
        "canonicalMeshSha256": f"sha256:{sha256(bytes(canonical))}",
        "pathId": str(getattr(reader, "path_id", "")),
        "serializedBytes": serialized_bytes,
        "triangleGroups": groups,
        "triangles": triangle_count,
        "vertices": vertices,
    }


def finite_bounds(points: Iterable[Sequence[float]]) -> list[list[float]]:
    rows = [tuple(float(value) for value in point) for point in points]
    if not rows or any(len(row) != 3 or any(not math.isfinite(v) for v in row) for row in rows):
        raise ValueError("A finite nonempty point population is required for bounds.")
    return [
        [min(row[axis] for row in rows) for axis in range(3)],
        [max(row[axis] for row in rows) for axis in range(3)],
    ]


class SameFrame(NamedTuple):
    name: str
    linear: tuple[int, int, int, int, int, int, int, int, int]
    translation: tuple[float, float, float]

    def apply(self, point: Sequence[float]) -> tuple[float, float, float]:
        return tuple(
            sum(self.linear[axis * 3 + source] * float(point[source]) for source in range(3))
            + self.translation[axis]
            for axis in range(3)
        )  # type: ignore[return-value]


TARGET_BODY_BOUNDS = ((-20.0, 0.0, -10.0), (20.0, 48.0, 10.0))
FRAME_TOLERANCE_LDU = 2e-4


def same_frame_candidates(vertices: Sequence[Sequence[float]]) -> list[SameFrame]:
    """Apply the established native basis, then register the shared body exterior."""

    turns = {
        "turn0": BUILDER_NATIVE_BASIS_LINEAR_LDU,
        "turn90": (0, 0, 25, 0, -25, 0, 25, 0, 0),
        "turn180": (-25, 0, 0, 0, -25, 0, 0, 0, 25),
        "turn270": (0, 0, -25, 0, -25, 0, -25, 0, 0),
    }
    target_center = tuple(
        (TARGET_BODY_BOUNDS[0][axis] + TARGET_BODY_BOUNDS[1][axis]) / 2
        for axis in range(3)
    )
    target_extent = tuple(
        TARGET_BODY_BOUNDS[1][axis] - TARGET_BODY_BOUNDS[0][axis] for axis in range(3)
    )
    found: list[SameFrame] = []
    for name, linear in turns.items():
        provisional = SameFrame(name, linear, (0.0, 0.0, 0.0))
        moved = [provisional.apply(point) for point in vertices]
        bounds = finite_bounds(moved)
        extent = tuple(bounds[1][axis] - bounds[0][axis] for axis in range(3))
        if any(abs(extent[axis] - target_extent[axis]) > FRAME_TOLERANCE_LDU for axis in range(3)):
            continue
        center = tuple((bounds[0][axis] + bounds[1][axis]) / 2 for axis in range(3))
        translation = tuple(target_center[axis] - center[axis] for axis in range(3))
        frame = SameFrame(name, linear, translation)
        final_bounds = finite_bounds(frame.apply(point) for point in vertices)
        if any(
            abs(final_bounds[end][axis] - TARGET_BODY_BOUNDS[end][axis])
            > FRAME_TOLERANCE_LDU
            for end in range(2)
            for axis in range(3)
        ):
            raise ValueError(f"Shared-body frame {name} did not reproduce its fixed bounds.")
        found.append(frame)
    if [frame.name for frame in found] != ["turn0", "turn180"]:
        raise ValueError(
            "Exact Shell/shared-body registration must leave only the 180-degree self-symmetry; "
            f"found {[frame.name for frame in found]}."
        )
    return found


def shell_triangles(
    vertices: Sequence[Sequence[float]], groups: Sequence[Sequence[Sequence[int]]]
) -> list[tuple[tuple[float, float, float], ...]]:
    result: list[tuple[tuple[float, float, float], ...]] = []
    for group in groups:
        for triangle in group:
            result.append(
                tuple(tuple(float(value) for value in vertices[index]) for index in triangle)
            )
    return result


def transform_triangles(
    triangles: Sequence[Sequence[Sequence[float]]], frame: SameFrame
) -> list[tuple[tuple[float, float, float], ...]]:
    return [tuple(frame.apply(point) for point in triangle) for triangle in triangles]


def _point_segment_distance(
    point: Sequence[float], start: Sequence[float], end: Sequence[float]
) -> float:
    direction = tuple(end[axis] - start[axis] for axis in range(3))
    denominator = sum(value * value for value in direction)
    ratio = 0.0
    if denominator > 1e-24:
        ratio = max(
            0.0,
            min(
                1.0,
                sum(
                    (point[axis] - start[axis]) * direction[axis] for axis in range(3)
                )
                / denominator,
            ),
        )
    closest = tuple(start[axis] + ratio * direction[axis] for axis in range(3))
    return math.dist(point, closest)


def point_triangle_distance(
    point: Sequence[float], triangle: Sequence[Sequence[float]]
) -> float:
    a, b, c = triangle
    ab = tuple(b[i] - a[i] for i in range(3))
    ac = tuple(c[i] - a[i] for i in range(3))
    ap = tuple(point[i] - a[i] for i in range(3))
    dot = lambda left, right: sum(left[i] * right[i] for i in range(3))
    d1, d2 = dot(ab, ap), dot(ac, ap)
    if d1 <= 0 and d2 <= 0:
        return math.dist(point, a)
    bp = tuple(point[i] - b[i] for i in range(3))
    d3, d4 = dot(ab, bp), dot(ac, bp)
    if d3 >= 0 and d4 <= d3:
        return math.dist(point, b)
    vc = d1 * d4 - d3 * d2
    if vc <= 0 and d1 >= 0 and d3 <= 0:
        ratio = d1 / (d1 - d3)
        return math.dist(point, tuple(a[i] + ratio * ab[i] for i in range(3)))
    cp = tuple(point[i] - c[i] for i in range(3))
    d5, d6 = dot(ab, cp), dot(ac, cp)
    if d6 >= 0 and d5 <= d6:
        return math.dist(point, c)
    vb = d5 * d2 - d1 * d6
    if vb <= 0 and d2 >= 0 and d6 <= 0:
        ratio = d2 / (d2 - d6)
        return math.dist(point, tuple(a[i] + ratio * ac[i] for i in range(3)))
    va = d3 * d6 - d5 * d4
    if va <= 0 and d4 - d3 >= 0 and d5 - d6 >= 0:
        ratio = (d4 - d3) / (d4 - d3 + d5 - d6)
        return math.dist(point, tuple(b[i] + ratio * (c[i] - b[i]) for i in range(3)))
    denominator = va + vb + vc
    if abs(denominator) <= 1e-24:
        return min(
            _point_segment_distance(point, a, b),
            _point_segment_distance(point, b, c),
            _point_segment_distance(point, c, a),
        )
    v, w = vb / denominator, vc / denominator
    return math.dist(point, tuple(a[i] + v * ab[i] + w * ac[i] for i in range(3)))


def nearest_distances(
    points: Sequence[Sequence[float]], triangles: Sequence[Sequence[Sequence[float]]]
) -> list[float]:
    if not points or not triangles:
        raise ValueError("Distance measurement needs nonempty point and triangle populations.")
    return [min(point_triangle_distance(point, triangle) for triangle in triangles) for point in points]


def distance_summary(distances: Sequence[float]) -> dict[str, object]:
    if not distances or any(not math.isfinite(value) or value < 0 for value in distances):
        raise ValueError("Distance summary requires a finite nonnegative population.")
    ordered = sorted(distances)
    percentile_index = min(len(ordered) - 1, math.ceil(len(ordered) * 0.95) - 1)
    return {
        "count": len(ordered),
        "maximumLdu": round(ordered[-1], 6),
        "meanLdu": round(sum(ordered) / len(ordered), 6),
        "p95Ldu": round(ordered[percentile_index], 6),
        "rmsLdu": round(math.sqrt(sum(value * value for value in ordered) / len(ordered)), 6),
    }


def interior_points(points: Sequence[Sequence[float]]) -> list[tuple[float, float, float]]:
    """Shell vertices off every shared exterior body plane and the top-stud plane."""

    return [
        tuple(float(value) for value in point)
        for point in points
        if abs(float(point[0])) < 19.5
        and abs(float(point[2])) < 9.5
        and 0.5 < float(point[1]) <= 48.0 + FRAME_TOLERANCE_LDU
    ]


def surface_digest(triangles: Sequence[Sequence[Sequence[float]]]) -> str:
    payload = bytearray()
    for triangle in triangles:
        if len(triangle) != 3:
            raise ValueError("Surface digest requires triangles.")
        for point in triangle:
            if len(point) != 3 or any(not math.isfinite(float(value)) for value in point):
                raise ValueError("Surface digest received a malformed point.")
            payload.extend(struct.pack("<ddd", *(float(value) for value in point)))
    return f"sha256:{sha256(bytes(payload))}"


def sample_surface(
    triangles: Sequence[Sequence[Sequence[float]]],
    spacing: float = SURFACE_SAMPLE_SPACING_LDU,
) -> list[tuple[float, float, float]]:
    """Fixed barycentric surface population, invariant to triangle winding."""

    if not math.isfinite(spacing) or spacing <= 0:
        raise ValueError("Surface sample spacing must be positive and finite.")
    points: set[tuple[float, float, float]] = set()
    for triangle in triangles:
        if len(triangle) != 3:
            raise ValueError("Surface sampling requires triangles.")
        edges = (
            math.dist(triangle[0], triangle[1]),
            math.dist(triangle[1], triangle[2]),
            math.dist(triangle[2], triangle[0]),
        )
        divisions = max(1, math.ceil(max(edges) / spacing))
        for first in range(divisions + 1):
            for second in range(divisions + 1 - first):
                third = divisions - first - second
                point = tuple(
                    (
                        first * float(triangle[0][axis])
                        + second * float(triangle[1][axis])
                        + third * float(triangle[2][axis])
                    )
                    / divisions
                    for axis in range(3)
                )
                points.add(tuple(round(value, 9) for value in point))
    if not points:
        raise ValueError("Surface sampling produced an empty population.")
    return sorted(points)


def rms_combined(left: Sequence[float], right: Sequence[float]) -> float:
    if not left or not right:
        raise ValueError("A symmetric RMS requires two nonempty distance populations.")
    values = [*left, *right]
    return round(math.sqrt(sum(value * value for value in values) / len(values)), 6)


def discriminative_points(
    source_points: Sequence[Sequence[float]],
    other_surface: Sequence[Sequence[Sequence[float]]],
) -> list[tuple[float, float, float]]:
    distances = nearest_distances(source_points, other_surface)
    return [
        tuple(float(value) for value in point)
        for point, distance in zip(source_points, distances, strict=True)
        if distance > DISCRIMINATIVE_DISTANCE_LDU
    ]


def _rectangle_x(x: float, reverse_diagonal: bool = False):
    corners = ((x, 8.0, -6.0), (x, 40.0, -6.0), (x, 40.0, 6.0), (x, 8.0, 6.0))
    if reverse_diagonal:
        return ((corners[0], corners[1], corners[3]), (corners[1], corners[2], corners[3]))
    return ((corners[0], corners[1], corners[2]), (corners[0], corners[2], corners[3]))


def _synthetic_rms(left, right) -> float:
    left_points = interior_points(sample_surface(left))
    right_points = interior_points(sample_surface(right))
    return rms_combined(
        nearest_distances(left_points, right), nearest_distances(right_points, left)
    )


def instrument_controls() -> dict[str, object]:
    """Held construction controls fixed without any 3245 vertex or candidate surface."""

    exact = _rectangle_x(0.0)
    retessellated = _rectangle_x(0.0, True)
    left = _rectangle_x(-4.0)
    right = _rectangle_x(4.0)
    exact_rms = _synthetic_rms(exact, retessellated)
    left_rms = _synthetic_rms(exact, left)
    right_rms = _synthetic_rms(exact, right)
    missing = _synthetic_rms((*left, *right), left)
    cases = [
        {
            "case": "same-surface-opposite-diagonal",
            "expected": "rms-at-most-1e-9-ldu",
            "measuredRmsLdu": exact_rms,
            "passed": exact_rms <= 1e-9,
        },
        {
            "case": "same-exterior-interior-plane-shift-left",
            "expected": "rms-at-least-3-ldu",
            "measuredRmsLdu": left_rms,
            "passed": left_rms >= 3.0,
        },
        {
            "case": "same-exterior-interior-plane-shift-right",
            "expected": "rms-at-least-3-ldu",
            "measuredRmsLdu": right_rms,
            "passed": right_rms >= 3.0,
        },
        {
            "case": "symmetric-direction-detects-missing-interior-surface",
            "expected": "rms-at-least-2-ldu",
            "measuredRmsLdu": missing,
            "passed": missing >= 2.0,
        },
    ]
    return {
        "contains3245Data": False,
        "population": len(cases),
        "allPassed": all(bool(row["passed"]) for row in cases),
        "cases": cases,
    }
