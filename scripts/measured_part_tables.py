"""Measure one admitted part completely, from the pinned sources it is declared from.

The catalog's three generated tables — the bundled render meshes, the measured
blueprints and the per-file LDraw attribution — are emitted from this one
measurement, so the mesh, the collision decomposition, the connectors and the
attribution cannot describe different geometry. `measured_part_emit.py` renders
them and `emit-measured-part-tables.py` drives both.

Nothing here decides that a part may be admitted. It measures; the caller scores
the result with the existing part-admission scorer and refuses on a hard fail.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from decimal import Decimal
from typing import Sequence

from ldcad_shadow_connectors import (
    compose_part_snaps,
    emit_clutch_connectors,
    emit_stud_connectors,
)
from ldcad_shadow_source import VerifiedShadowLibrary
from ldraw_source_archive import LDrawSourceLibrary, SourceRecord
from ldraw_surface_expander import expand_surface
from part_admission_ldraw_candidate import DEFAULT_COLUMN_LDU, column_candidate, role_classifier
from part_admission_surface import STUD_ROLE, MeasuredSurface

Vector3 = tuple[float, float, float]

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

BUILDER_CONNECTOR_SOURCE = "builder"
LDCAD_SHADOW_CONNECTOR_SOURCE = "ldcad-shadow"
CONNECTOR_SOURCES = (BUILDER_CONNECTOR_SOURCE, LDCAD_SHADOW_CONNECTOR_SOURCE)


@dataclass(frozen=True)
class MeasuredPartPlan:
    """What a part is called and how its source frame reaches the catalog.

    Everything else is measured. This carries only what measurement cannot
    decide: the catalog identity, the lattice height the placement rests on, and
    the quarter turn plus whole-LDU translation that normalizes the source frame.
    """

    design_id: str
    ldraw_path: str
    family: str
    width_studs: int
    length_studs: int
    variant: str | None
    height_ldu: int
    orientation_id: str
    translation_ldu: tuple[int, int, int]
    connector_grid_center_ldu: tuple[int, int]
    connector_source: str

    def __post_init__(self) -> None:
        if self.orientation_id not in UPRIGHT_ORIENTATIONS:
            raise ValueError(
                f"Part {self.design_id} names source-to-catalog orientation "
                f"{self.orientation_id!r}; the catalog frame is one of "
                f"{sorted(UPRIGHT_ORIENTATIONS)}."
            )
        if self.connector_source not in CONNECTOR_SOURCES:
            raise ValueError(
                f"Part {self.design_id} names connector source {self.connector_source!r}; "
                f"the admitted sources are {list(CONNECTOR_SOURCES)}."
            )
        if not all(isinstance(value, int) for value in self.translation_ldu):
            raise ValueError(
                f"Part {self.design_id} translates its source frame by "
                f"{list(self.translation_ldu)}; the translation is whole LDU so the raw frame "
                "is carried exactly rather than resampled."
            )


@dataclass(frozen=True)
class MeasuredPart:
    """One part measured end to end, in the catalog frame its plan declares."""

    plan: MeasuredPartPlan
    surface: MeasuredSurface
    positions_ldu: tuple[float, ...]
    indices: tuple[int, ...]
    body_triangle_count: int
    stud_triangle_count: int
    exact_body_bounds: tuple[tuple[str, str, str], tuple[str, str, str]]
    exact_bounds: tuple[tuple[str, str, str], tuple[str, str, str]]
    studs_ldu: tuple[tuple[float, float, float, float, float], ...]
    clutches_ldu: tuple[Vector3, ...]
    body_boxes_ldu: tuple[float, ...]
    root: SourceRecord
    closure: tuple[SourceRecord, ...]
    shadow_files: tuple[str, ...]
    candidate: dict[str, object]

    @property
    def mesh_asset_id(self) -> str:
        return f"ldraw:official:{self.plan.design_id}.dat"


def float32(value: float) -> float:
    """The renderer's own Float32 allocation of one coordinate."""

    return struct.unpack("<f", struct.pack("<f", value))[0]


def frame_point(point: Sequence[float], plan: MeasuredPartPlan) -> Vector3:
    """One source-local LDU point in the catalog frame, applied exactly once."""

    matrix = UPRIGHT_ORIENTATIONS[plan.orientation_id]
    return tuple(  # type: ignore[return-value]
        matrix[row * 3 + 0] * point[0]
        + matrix[row * 3 + 1] * point[1]
        + matrix[row * 3 + 2] * point[2]
        + plan.translation_ldu[row]
        for row in range(3)
    )


def frame_box(
    minimum: Sequence[float], maximum: Sequence[float], plan: MeasuredPartPlan
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


def _bounds(points: Sequence[Vector3]) -> tuple[Vector3, Vector3]:
    return (
        tuple(min(point[axis] for point in points) for axis in range(3)),  # type: ignore[return-value]
        tuple(max(point[axis] for point in points) for axis in range(3)),  # type: ignore[return-value]
    )


def _exact_bounds(
    points: Sequence[Vector3], plan: MeasuredPartPlan, label: str
) -> tuple[tuple[str, str, str], tuple[str, str, str]]:
    minimum, maximum = _bounds([frame_point(point, plan) for point in points])
    axes = "xyz"
    return (
        tuple(  # type: ignore[return-value]
            exact_decimal_text(minimum[axis], f"{plan.design_id} {label} min {axes[axis]}")
            for axis in range(3)
        ),
        tuple(  # type: ignore[return-value]
            exact_decimal_text(maximum[axis], f"{plan.design_id} {label} max {axes[axis]}")
            for axis in range(3)
        ),
    )


def merged_mesh(
    surface: MeasuredSurface, plan: MeasuredPartPlan
) -> tuple[tuple[float, ...], tuple[int, ...], int, int]:
    """The expanded surface as one indexed mesh in its immutable source frame.

    Body-role triangles first, then stud-role, so the two render groups are
    contiguous. Vertices merge on the position the renderer can actually hold
    apart: composing a closure by two routes reaches the same corner with a
    1e-15 LDU difference Float32 cannot carry, and declaring both would declare
    vertices the pipeline then collapses. The positions kept are the measured
    source values, never the quantized ones.
    """

    order = [index for index, role in enumerate(surface.roles) if role != STUD_ROLE]
    stud_count = len(surface.roles) - len(order)
    order.extend(index for index, role in enumerate(surface.roles) if role == STUD_ROLE)
    positions: list[float] = []
    indices: list[int] = []
    vertex_by_render_position: dict[tuple[float, float, float], int] = {}
    for triangle_index in order:
        for point in surface.triangles[triangle_index]:
            framed = frame_point(point, plan)
            key = (
                float32(framed[0] * MESH_RENDER_UNITS_PER_LDU),
                float32(framed[1] * MESH_RENDER_UNITS_PER_LDU),
                float32(framed[2] * MESH_RENDER_UNITS_PER_LDU),
            )
            vertex = vertex_by_render_position.get(key)
            if vertex is None:
                vertex = len(vertex_by_render_position)
                vertex_by_render_position[key] = vertex
                positions.extend(point)
            indices.append(vertex)
    return tuple(positions), tuple(indices), len(order) - stud_count, stud_count


def _clamped_column_boxes(
    candidate: dict[str, object], plan: MeasuredPartPlan, solid: tuple[Vector3, Vector3]
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
        low, high = frame_box(minimum, maximum, plan)
        flat.extend(low)
        flat.extend(high)
    return tuple(flat)


def _stud_rows(
    candidate: dict[str, object], plan: MeasuredPartPlan
) -> tuple[tuple[float, float, float, float, float], ...]:
    """One row per measured stud: its seat, then its own collision cylinder."""

    rows: list[tuple[float, float, float, float, float]] = []
    for body in candidate["bodies"]:  # type: ignore[union-attr]
        if body["kind"] != "cylinder":  # type: ignore[index]
            continue
        center = frame_point(body["centerLdu"], plan)  # type: ignore[index,arg-type]
        height = float(body["heightLdu"])  # type: ignore[index]
        rows.append(
            (center[0], center[1] + height / 2, center[2], float(body["radiusLdu"]), height)  # type: ignore[index]
        )
    return tuple(sorted(rows))


def measure_part(
    library: LDrawSourceLibrary,
    shadow: VerifiedShadowLibrary,
    plan: MeasuredPartPlan,
    builder_clutches: dict[str, list[list[float]]],
    column_ldu: float = DEFAULT_COLUMN_LDU,
) -> MeasuredPart:
    """Everything the three generated tables need, from one expansion."""

    root_key = library.exact("official", plan.ldraw_path)
    expanded = expand_surface(
        library, root_key, role_classifier(lambda key: library.record(key).sha256)
    )
    surface = MeasuredSurface(
        design_id=plan.design_id,
        triangles=tuple(triangle.points for triangle in expanded),
        roles=tuple(triangle.role for triangle in expanded),
    )
    positions, indices, body_triangles, stud_triangles = merged_mesh(surface, plan)
    solid_points = [
        point
        for triangle, role in zip(surface.triangles, surface.roles)
        if role != STUD_ROLE
        for point in triangle
    ]
    all_points = [point for triangle in surface.triangles for point in triangle]
    candidate = column_candidate(surface, column_ldu)

    if plan.connector_source == BUILDER_CONNECTOR_SOURCE:
        source_clutches = builder_clutches.get(plan.design_id)
        if source_clutches is None:
            raise ValueError(
                f"Part {plan.design_id} declares Builder connectors, but the pinned "
                "Builder-to-LDraw frame report has no record for that design."
            )
        shadow_files: tuple[str, ...] = ()
    else:
        composition = compose_part_snaps(library, shadow, root_key)
        source_clutches = [
            [float(value) for value in row["positionLdu"]]  # type: ignore[union-attr]
            for row in emit_clutch_connectors(composition.snaps)
        ]
        if not emit_stud_connectors(composition.snaps) and any(
            role == STUD_ROLE for role in surface.roles
        ):
            raise ValueError(
                f"Part {plan.design_id} has stud geometry but its shadow walk composed no male "
                "stud, so the composition could not be validated before its female claims were "
                "read."
            )
        shadow_files = tuple(composition.shadow_files_used)

    return MeasuredPart(
        plan=plan,
        surface=surface,
        positions_ldu=positions,
        indices=indices,
        body_triangle_count=body_triangles,
        stud_triangle_count=stud_triangles,
        exact_body_bounds=_exact_bounds(solid_points, plan, "body bounds"),
        exact_bounds=_exact_bounds(all_points, plan, "visual bounds"),
        studs_ldu=_stud_rows(candidate, plan),
        clutches_ldu=tuple(sorted(frame_point(row, plan) for row in source_clutches)),
        body_boxes_ldu=_clamped_column_boxes(candidate, plan, _bounds(solid_points)),
        root=library.record(root_key),
        closure=tuple(library.closure(root_key)),
        shadow_files=shadow_files,
        candidate=candidate,
    )


def scoreable_candidate(part: MeasuredPart) -> dict[str, object]:
    """The measured part as the part-admission scorer's own candidate shape.

    Scoring happens in the source-local frame the scorer measures in, against the
    same surface, so the number recorded for an admitted part is a number about
    the declaration actually emitted rather than about a differently framed one.
    """

    inverse = {
        "upright-yaw-0": "upright-yaw-0",
        "upright-yaw-90": "upright-yaw-270",
        "upright-yaw-180": "upright-yaw-180",
        "upright-yaw-270": "upright-yaw-90",
    }[part.plan.orientation_id]
    unframe = MeasuredPartPlan(
        design_id=part.plan.design_id,
        ldraw_path=part.plan.ldraw_path,
        family=part.plan.family,
        width_studs=part.plan.width_studs,
        length_studs=part.plan.length_studs,
        variant=part.plan.variant,
        height_ldu=part.plan.height_ldu,
        orientation_id=inverse,
        translation_ldu=(0, 0, 0),
        connector_grid_center_ldu=part.plan.connector_grid_center_ldu,
        connector_source=part.plan.connector_source,
    )
    clutches = [
        frame_point(
            (
                row[0] - part.plan.translation_ldu[0],
                row[1] - part.plan.translation_ldu[1],
                row[2] - part.plan.translation_ldu[2],
            ),
            unframe,
        )
        for row in part.clutches_ldu
    ]
    candidate = dict(part.candidate)
    candidate["connectors"] = [
        row for row in candidate["connectors"] if row["kind"] == "stud"  # type: ignore[union-attr,index]
    ] + [
        {
            "kind": "undersideClutch",
            "gender": "female",
            "positionLdu": list(position),
            "normal": [0.0, 1.0, 0.0],
        }
        for position in clutches
    ]
    candidate["derivation"] = (
        f"{part.plan.connector_source} connectors over "
        f"{candidate['derivation']}"  # type: ignore[index]
    )
    return candidate
