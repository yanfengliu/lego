"""Geometry helpers shared by measured and render-only part measurement.

This module owns frame arithmetic, exact bound text, mesh merging, and collision
column clipping. It deliberately depends only on a structural plan protocol so
the measured-part data declarations can import and re-export these helpers
without a dependency cycle.
"""

from __future__ import annotations

import struct
from decimal import Decimal
from typing import Protocol, Sequence

from ldraw_surface_expander import ExpandedTriangle
from measured_stud_tables import MeasuredStudRow, compile_measured_stud_rows
from part_admission_surface import STUD_ROLE, MeasuredSurface

Vector3 = tuple[float, float, float]


class FramePlan(Protocol):
    """The source-to-catalog fields needed by geometry measurement."""

    design_id: str
    orientation_id: str
    translation_ldu: tuple[int, int, int]


# The catalog's four upright orientations, from packages/catalog/src/constants.ts.
# A measured part's source-to-catalog frame is one of these plus a whole-LDU
# translation, applied exactly once.
UPRIGHT_ORIENTATIONS: dict[str, tuple[int, ...]] = {
    "upright-yaw-0": (1, 0, 0, 0, 1, 0, 0, 0, 1),
    "upright-yaw-90": (0, 0, 1, 0, 1, 0, -1, 0, 0),
    "upright-yaw-180": (-1, 0, 0, 0, 1, 0, 0, 0, -1),
    "upright-yaw-270": (0, 0, -1, 0, 1, 0, 1, 0, 0),
}

# packages/catalog/src/mesh-assets.ts: the renderer scales catalog LDU by this
# and allocates the result as Float32, so two vertices closer than that cannot be
# held apart and declaring both would be declaring a vertex the pipeline merges.
MESH_RENDER_UNITS_PER_LDU = 0.05
# packages/catalog/src/exact-ldu.ts refuses a tenth fractional digit.
MAX_EXACT_FRACTIONAL_DIGITS = 9


def float32(value: float) -> float:
    """The renderer's own Float32 allocation of one coordinate."""

    return struct.unpack("<f", struct.pack("<f", value))[0]


def frame_point(point: Sequence[float], plan: FramePlan) -> Vector3:
    """One source-local LDU point in the catalog frame, applied exactly once."""

    matrix = UPRIGHT_ORIENTATIONS[plan.orientation_id]
    return tuple(  # type: ignore[return-value]
        matrix[row * 3 + 0] * point[0]
        + matrix[row * 3 + 1] * point[1]
        + matrix[row * 3 + 2] * point[2]
        + plan.translation_ldu[row]
        for row in range(3)
    )


def frame_direction(direction: Sequence[float], plan: FramePlan) -> Vector3:
    """Rotate an asset-local direction into the catalog frame without translation."""

    matrix = UPRIGHT_ORIENTATIONS[plan.orientation_id]
    return tuple(  # type: ignore[return-value]
        matrix[row * 3 + 0] * direction[0]
        + matrix[row * 3 + 1] * direction[1]
        + matrix[row * 3 + 2] * direction[2]
        for row in range(3)
    )


def frame_box(
    minimum: Sequence[float],
    maximum: Sequence[float],
    plan: FramePlan,
) -> tuple[Vector3, Vector3]:
    """An axis-aligned box carried through a quarter turn, corner by corner."""

    corners = [
        frame_point((x, y, z), plan)
        for x in (minimum[0], maximum[0])
        for y in (minimum[1], maximum[1])
        for z in (minimum[2], maximum[2])
    ]
    return (
        tuple(min(corner[axis] for corner in corners) for axis in range(3)),  # type: ignore[return-value]
        tuple(max(corner[axis] for corner in corners) for axis in range(3)),  # type: ignore[return-value]
    )


def exact_decimal_text(value: float, label: str) -> str:
    """The measured coordinate as the canonical decimal the closure prints.

    Every composed coordinate in an audited closure is a terminating decimal, so
    the shortest decimal that maps back to the measured double is that decimal.
    Both halves are checked here rather than assumed: the text must round-trip to
    the same double, and it must stay inside the fractional-digit bound
    `packages/catalog/src/exact-ldu.ts` enforces on the other side.
    """

    text = repr(float(value))
    if "e" in text or "E" in text or text in ("inf", "-inf", "nan"):
        raise ValueError(
            f"{label} measures {value!r}, which prints as {text!r}; an exact LDU bound is "
            "plain decimal text, so a coordinate this large or small cannot be declared."
        )
    if text.endswith(".0"):
        text = text[:-2]
    if float(Decimal(text)) != float(value):
        raise ValueError(
            f"{label} measures {value!r} but its canonical decimal {text!r} reads back as "
            f"{float(Decimal(text))!r}; the exact bound must name the measured value."
        )
    fractional = len(text.partition(".")[2])
    if fractional > MAX_EXACT_FRACTIONAL_DIGITS:
        raise ValueError(
            f"{label} measures {text!r} with {fractional} fractional digits; the exact LDU "
            f"representation carries {MAX_EXACT_FRACTIONAL_DIGITS}."
        )
    return text


def merged_mesh(
    surface: MeasuredSurface, plan: FramePlan
) -> tuple[tuple[float, ...], tuple[float, ...], tuple[int, ...], int, int]:
    """The expanded surface as one indexed mesh in its immutable source frame.

    Body-role triangles first, then stud-role, so the two render groups are
    contiguous. Vertices merge on the position and source-faithful normal the
    renderer can actually hold apart: composing a closure by two routes reaches
    the same corner with a 1e-15 difference Float32 cannot carry, while a hard
    LDraw edge deliberately keeps coincident positions in distinct normal
    islands. Coincident islands reuse the first measured source position so the
    emitted asset does not encode route-dependent 1e-15 aliases as distinct
    source vertices; a material collapse still fails instead of being welded.
    """

    order = [index for index, role in enumerate(surface.roles) if role != STUD_ROLE]
    stud_count = len(surface.roles) - len(order)
    order.extend(index for index, role in enumerate(surface.roles) if role == STUD_ROLE)
    positions: list[float] = []
    normals: list[float] = []
    indices: list[int] = []
    vertex_by_render_values: dict[tuple[float, ...], int] = {}
    source_position_by_render_position: dict[tuple[float, float, float], Vector3] = {}
    if surface.corner_normals is None:
        raise ValueError(
            f"Measured surface {surface.design_id} has no source-faithful corner normals; "
            "render mesh emission cannot fall back to globally averaged vertex normals."
        )
    for triangle_index in order:
        for point, normal in zip(
            surface.triangles[triangle_index], surface.corner_normals[triangle_index]
        ):
            framed = frame_point(point, plan)
            framed_normal = frame_direction(normal, plan)
            key = (
                float32(framed[0] * MESH_RENDER_UNITS_PER_LDU),
                float32(framed[1] * MESH_RENDER_UNITS_PER_LDU),
                float32(framed[2] * MESH_RENDER_UNITS_PER_LDU),
                float32(framed_normal[0]),
                float32(-framed_normal[1]),
                float32(framed_normal[2]),
            )
            render_position = key[:3]
            representative = source_position_by_render_position.get(render_position)
            if representative is None:
                representative = point
                source_position_by_render_position[render_position] = representative
            elif any(abs(representative[axis] - point[axis]) > 1e-9 for axis in range(3)):
                raise ValueError(
                    f"Measured surface {surface.design_id} source positions {representative!r} and "
                    f"{point!r} materially collapse to renderer position {render_position!r}; "
                    "reframe the source instead of welding distinct geometry."
                )
            vertex = vertex_by_render_values.get(key)
            if vertex is None:
                vertex = len(vertex_by_render_values)
                vertex_by_render_values[key] = vertex
                positions.extend(representative)
                normals.extend(normal)
            indices.append(vertex)
    return tuple(positions), tuple(normals), tuple(indices), len(order) - stud_count, stud_count


def require_front_side_surface(
    design_id: str, expanded: Sequence[ExpandedTriangle]
) -> None:
    """Refuse LDraw semantics a shared FrontSide admission material cannot carry."""

    for triangle in expanded:
        if triangle.certified and triangle.cull_enabled:
            continue
        condition = "BFC NOCERTIFY" if not triangle.certified else "BFC NOCLIP"
        raise ValueError(
            f"Part {design_id} cannot emit an exact FrontSide mesh: expanded triangle at "
            f"{triangle.source[0]}:{triangle.source[1]}:{triangle.line_number} requires "
            f"{condition} semantics. Keep it outside FrontSide admission or implement and "
            "integrity-bind its explicit two-sided material semantics."
        )


def _clamped_column_boxes(
    candidate: dict[str, object], plan: FramePlan, solid: tuple[Vector3, Vector3]
) -> tuple[float, ...]:
    """Column boxes clipped to the measured solid, flattened into sextuples.

    The plan grid is floor-aligned, so the outermost column of a part whose
    extent is not a whole LDU — 51739's wing ends at 38.5 — would otherwise
    reach half a unit past the part and disagree with its own measured bounds.
    """

    flat: list[float] = []
    for body in candidate["bodies"]:  # type: ignore[union-attr]
        if body["kind"] != "box":  # type: ignore[index]
            continue
        minimum = [max(float(body["minLdu"][axis]), solid[0][axis]) for axis in range(3)]  # type: ignore[index]
        maximum = [min(float(body["maxLdu"][axis]), solid[1][axis]) for axis in range(3)]  # type: ignore[index]
        if any(maximum[axis] <= minimum[axis] for axis in range(3)):
            continue
        low, high = frame_box(minimum, maximum, plan)
        flat.extend(low)
        flat.extend(high)
    return tuple(flat)


def _clamped_source_candidate(
    candidate: dict[str, object], solid: tuple[Vector3, Vector3]
) -> dict[str, object]:
    """The scoreable source-frame bodies after the same clipping emission uses.

    A boundary-only height-field cell can touch the measured solid on a plane
    and collapse to zero width when clipped. Such a cell has no collision volume
    and the runtime contract refuses it. Drop it here, before both scoring and
    emission, so the scorecard measures exactly the positive-volume boxes that
    enter the catalog.
    """

    bodies: list[dict[str, object]] = []
    for body in candidate["bodies"]:  # type: ignore[union-attr]
        row = dict(body)  # type: ignore[arg-type]
        if row["kind"] == "box":
            minimum = [
                max(float(row["minLdu"][axis]), solid[0][axis]) for axis in range(3)  # type: ignore[index]
            ]
            maximum = [
                min(float(row["maxLdu"][axis]), solid[1][axis]) for axis in range(3)  # type: ignore[index]
            ]
            if any(maximum[axis] <= minimum[axis] for axis in range(3)):
                continue
            row["minLdu"] = minimum
            row["maxLdu"] = maximum
        bodies.append(row)
    return {
        **candidate,
        "derivation": f"{candidate['derivation']} clipped to measured solid bounds",
        "bodies": bodies,
    }


def _stud_rows(candidate: dict[str, object], plan: FramePlan) -> tuple[MeasuredStudRow, ...]:
    return compile_measured_stud_rows(
        candidate,
        plan.design_id,
        lambda point: frame_point(point, plan),
        lambda direction: frame_direction(direction, plan),
    )
