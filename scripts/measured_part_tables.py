"""Measure one admitted part completely, from the pinned sources it is declared from.

The catalog's generated mesh modules, measured blueprints, render-only
blueprints and per-file attribution are emitted from one measurement, so their
values stay aligned. Twenty rows take the full-measurement generator route:
sixteen are current fully measured catalog definitions, while four special-
plate render promotions preserve their preceding catalog physical semantics.
Twelve `/13` render promotions intentionally consume only mesh and visual bounds
while `part-factory.ts` retains their preceding physical semantics.

The distinct render-only route expands a pinned official LDraw root into mesh,
bounds, stud-frame witnesses and attribution only. It deliberately has no
connector source, clutch rows, allowances or collision decomposition, because
those physical semantics remain the preceding catalog definition's bytes.

`measured_part_emit.py` renders the tables and `emit-measured-part-tables.py`
drives both.

Nothing here decides that a part may be admitted. It measures; the caller scores
the result with the existing part-admission scorer and refuses on a hard fail.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from ldcad_shadow_connectors import (
    compose_part_snaps,
    emit_clutch_connectors,
    emit_stud_connectors,
)
from ldcad_shadow_source import VerifiedShadowLibrary
from ldraw_source_archive import LDrawSourceLibrary, SourceRecord
from ldraw_surface_expander import expand_surface
from measured_part_geometry import (
    MAX_EXACT_FRACTIONAL_DIGITS,
    MESH_RENDER_UNITS_PER_LDU,
    UPRIGHT_ORIENTATIONS,
    Vector3,
    _clamped_column_boxes,
    _clamped_source_candidate,
    _stud_rows,
    exact_decimal_text,
    float32,
    frame_box,
    frame_direction,
    frame_point,
    merged_mesh,
    require_front_side_surface,
)
from measured_stud_tables import MeasuredStudRow, require_matching_stud_frames
from part_admission_ldraw_candidate import DEFAULT_COLUMN_LDU, column_candidate, role_classifier
from part_admission_surface import STUD_ROLE, MeasuredSurface

BUILDER_CONNECTOR_SOURCE = "builder"
BUILDER_CONNECTIVITY_CONNECTOR_SOURCE = "builder-connectivity-fact"
LDCAD_SHADOW_CONNECTOR_SOURCE = "ldcad-shadow"
CONNECTOR_SOURCES = (
    BUILDER_CONNECTOR_SOURCE,
    BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
    LDCAD_SHADOW_CONNECTOR_SOURCE,
)


@dataclass(frozen=True)
class BuilderConnectivityFact:
    """One byte-pinned Builder field whose full clutch set is already settled."""

    source_id: str
    source_revision: str
    manifest_sha256: str
    manifest_md5: str
    bundle_sha256: str
    primitive_xml_sha256: str
    independent_source_id: str
    independent_source_revision: str
    independent_part_sha256: str
    independent_subpart_sha256: str
    extractor_id: str
    normalized_clutch_offsets_sha256: str
    clutches_source_ldu: tuple[Vector3, ...]
    partial_overhangs: tuple[tuple[float, float, float], ...]


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
    builder_connectivity_fact: BuilderConnectivityFact | None = None
    catalog_id: str | None = None
    display_name: str | None = None
    validated_connection_stud_profile: str | None = None

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
        has_connectivity_fact = self.builder_connectivity_fact is not None
        expects_connectivity_fact = self.connector_source == BUILDER_CONNECTIVITY_CONNECTOR_SOURCE
        if has_connectivity_fact != expects_connectivity_fact:
            raise ValueError(
                f"Part {self.design_id} names connector source {self.connector_source!r} and "
                f"builder_connectivity_fact present={has_connectivity_fact}; the byte-pinned "
                "fact is required exactly for builder-connectivity-fact parts."
            )
        if not all(isinstance(value, int) for value in self.translation_ldu):
            raise ValueError(
                f"Part {self.design_id} translates its source frame by "
                f"{list(self.translation_ldu)}; the translation is whole LDU so the raw frame "
                "is carried exactly rather than resampled."
            )
        if self.validated_connection_stud_profile not in (None, "nominal-stud-tube/1"):
            raise ValueError(
                f"Part {self.design_id} names validated connection stud profile "
                f"{self.validated_connection_stud_profile!r}; the only admitted "
                "source-rounding normalization is 'nominal-stud-tube/1'."
            )


@dataclass(frozen=True)
class RenderOnlyPartPlan:
    """Identity and source frame for an exact render promotion.

    Unlike `MeasuredPartPlan`, this declaration cannot name a connector source
    or carry connector/collision facts. That absence is the admission boundary:
    the generated render-only table cannot accidentally import an LDCad seat or
    a measured height-field into catalog truth.
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

    def __post_init__(self) -> None:
        if self.orientation_id not in UPRIGHT_ORIENTATIONS:
            raise ValueError(
                f"Render-only part {self.design_id} names source-to-catalog orientation "
                f"{self.orientation_id!r}; the catalog frame is one of "
                f"{sorted(UPRIGHT_ORIENTATIONS)}."
            )
        if not all(isinstance(value, int) for value in self.translation_ldu):
            raise ValueError(
                f"Render-only part {self.design_id} translates its source frame by "
                f"{list(self.translation_ldu)}; the translation is whole LDU so the raw "
                "frame is carried exactly rather than resampled."
            )


def measured_part_catalog_id(plan: MeasuredPartPlan | RenderOnlyPartPlan) -> str:
    """Return the exact catalog identity the emission report must retain."""

    explicit = plan.catalog_id if isinstance(plan, MeasuredPartPlan) else None
    if explicit is not None:
        return explicit
    suffix = "" if plan.variant is None else f"-{plan.variant}"
    return f"builtin:{plan.family}-{plan.width_studs}x{plan.length_studs}{suffix}"


@dataclass(frozen=True)
class MeasuredPart:
    """One part measured end to end, in the catalog frame its plan declares."""

    plan: MeasuredPartPlan
    surface: MeasuredSurface
    positions_ldu: tuple[float, ...]
    normals_asset_local: tuple[float, ...]
    indices: tuple[int, ...]
    body_triangle_count: int
    stud_triangle_count: int
    exact_body_bounds: tuple[tuple[str, str, str], tuple[str, str, str]]
    exact_bounds: tuple[tuple[str, str, str], tuple[str, str, str]]
    studs_ldu: tuple[MeasuredStudRow, ...]
    clutches_ldu: tuple[Vector3, ...]
    body_boxes_ldu: tuple[float, ...]
    root: SourceRecord
    closure: tuple[SourceRecord, ...]
    shadow_files: tuple[str, ...]
    candidate: dict[str, object]

    @property
    def mesh_asset_id(self) -> str:
        return f"ldraw:official:{self.plan.design_id}.dat"


@dataclass(frozen=True)
class RenderOnlyPart:
    """Only the source-derived bytes a render promotion is allowed to emit."""

    plan: RenderOnlyPartPlan
    surface: MeasuredSurface
    positions_ldu: tuple[float, ...]
    normals_asset_local: tuple[float, ...]
    indices: tuple[int, ...]
    body_triangle_count: int
    stud_triangle_count: int
    exact_body_bounds: tuple[tuple[str, str, str], tuple[str, str, str]]
    exact_bounds: tuple[tuple[str, str, str], tuple[str, str, str]]
    source_stud_seats_ldu: tuple[Vector3, ...]
    root: SourceRecord
    closure: tuple[SourceRecord, ...]

    @property
    def mesh_asset_id(self) -> str:
        return f"ldraw:official:{self.plan.design_id}.dat"


def measured_part_report_row(part: MeasuredPart) -> dict[str, object]:
    """Canonical evidence row for one fully measured source expansion."""

    return {
        "designId": part.plan.design_id,
        "catalogId": measured_part_catalog_id(part.plan),
        "connectorSource": part.plan.connector_source,
        **(
            {}
            if part.plan.validated_connection_stud_profile is None
            else {
                "validatedConnectionStudProfile": part.plan.validated_connection_stud_profile
            }
        ),
        "studs": len(part.studs_ldu),
        "clutches": len(part.clutches_ldu),
        "collisionBoxes": len(part.body_boxes_ldu) // 6,
        "meshTriangles": part.body_triangle_count + part.stud_triangle_count,
        "closureFileCount": len(part.closure),
        "shadowFiles": list(part.shadow_files),
    }


def render_only_part_report_row(part: RenderOnlyPart) -> dict[str, object]:
    """Canonical evidence row for one render-only source expansion."""

    return {
        "designId": part.plan.design_id,
        "catalogId": measured_part_catalog_id(part.plan),
        "connectorSource": "preserved-catalog-definition-not-read-by-generator",
        "sourceStudFrameWitnesses": len(part.source_stud_seats_ldu),
        "meshTriangles": part.body_triangle_count + part.stud_triangle_count,
        "closureFileCount": len(part.closure),
        "structuralFieldsEmitted": 0,
    }


def _bounds(points: Sequence[Vector3]) -> tuple[Vector3, Vector3]:
    return (
        tuple(min(point[axis] for point in points) for axis in range(3)),  # type: ignore[return-value]
        tuple(max(point[axis] for point in points) for axis in range(3)),  # type: ignore[return-value]
    )


def _exact_bounds(
    points: Sequence[Vector3], plan: MeasuredPartPlan | RenderOnlyPartPlan, label: str
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


def measure_render_only_part(
    library: LDrawSourceLibrary,
    plan: RenderOnlyPartPlan,
    column_ldu: float = DEFAULT_COLUMN_LDU,
) -> RenderOnlyPart:
    """Expand one official root without reading any connector/collision source.

    The temporary column candidate is used only to locate visible source stud
    seats so TypeScript can prove the declared frame aligns those studs with the
    predecessor's already-authored male connectors. None of its bodies or
    connector rows enter a generated catalog table.
    """

    root_key = library.exact("official", plan.ldraw_path)
    expanded = expand_surface(
        library, root_key, role_classifier(lambda key: library.record(key).sha256)
    )
    require_front_side_surface(plan.design_id, expanded)
    surface = MeasuredSurface(
        design_id=plan.design_id,
        triangles=tuple(triangle.points for triangle in expanded),
        roles=tuple(triangle.role for triangle in expanded),
        corner_normals=tuple(triangle.corner_normals for triangle in expanded),
    )
    positions, normals, indices, body_triangles, stud_triangles = merged_mesh(surface, plan)
    solid_points = [
        point
        for triangle, role in zip(surface.triangles, surface.roles)
        if role != STUD_ROLE
        for point in triangle
    ]
    all_points = [point for triangle in surface.triangles for point in triangle]
    source_stud_seats = tuple(row[:3] for row in _stud_rows(column_candidate(surface, column_ldu), plan))
    return RenderOnlyPart(
        plan=plan,
        surface=surface,
        positions_ldu=positions,
        normals_asset_local=normals,
        indices=indices,
        body_triangle_count=body_triangles,
        stud_triangle_count=stud_triangles,
        exact_body_bounds=_exact_bounds(solid_points, plan, "body bounds"),
        exact_bounds=_exact_bounds(all_points, plan, "visual bounds"),
        source_stud_seats_ldu=source_stud_seats,
        root=library.record(root_key),
        closure=tuple(library.closure(root_key)),
    )


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
    require_front_side_surface(plan.design_id, expanded)
    surface = MeasuredSurface(
        design_id=plan.design_id,
        triangles=tuple(triangle.points for triangle in expanded),
        roles=tuple(triangle.role for triangle in expanded),
        corner_normals=tuple(triangle.corner_normals for triangle in expanded),
    )
    positions, normals, indices, body_triangles, stud_triangles = merged_mesh(surface, plan)
    solid_points = [
        point
        for triangle, role in zip(surface.triangles, surface.roles)
        if role != STUD_ROLE
        for point in triangle
    ]
    all_points = [point for triangle in surface.triangles for point in triangle]
    solid_bounds = _bounds(solid_points)
    candidate = _clamped_source_candidate(column_candidate(surface, column_ldu), solid_bounds)

    if plan.connector_source == BUILDER_CONNECTOR_SOURCE:
        source_clutches = builder_clutches.get(plan.design_id)
        if source_clutches is None:
            raise ValueError(
                f"Part {plan.design_id} declares Builder connectors, but the pinned "
                "Builder-to-LDraw frame report has no record for that design."
            )
        shadow_files: tuple[str, ...] = ()
    elif plan.connector_source == BUILDER_CONNECTIVITY_CONNECTOR_SOURCE:
        fact = plan.builder_connectivity_fact
        assert fact is not None
        source_clutches = [list(position) for position in fact.clutches_source_ldu]
        shadow_files = ()
    else:
        composition = compose_part_snaps(library, shadow, root_key)
        source_clutches = [
            [float(value) for value in row["positionLdu"]]  # type: ignore[union-attr]
            for row in emit_clutch_connectors(composition.snaps)
        ]
        shadow_studs = emit_stud_connectors(composition.snaps)
        visible_studs = [
            row
            for row in candidate["connectors"]  # type: ignore[union-attr]
            if row["kind"] == "stud"  # type: ignore[index]
        ]
        require_matching_stud_frames(plan.design_id, shadow_studs, visible_studs)
        shadow_files = tuple(composition.shadow_files_used)

    return MeasuredPart(
        plan=plan,
        surface=surface,
        positions_ldu=positions,
        normals_asset_local=normals,
        indices=indices,
        body_triangle_count=body_triangles,
        stud_triangle_count=stud_triangles,
        exact_body_bounds=_exact_bounds(solid_points, plan, "body bounds"),
        exact_bounds=_exact_bounds(all_points, plan, "visual bounds"),
        studs_ldu=_stud_rows(candidate, plan),
        clutches_ldu=tuple(sorted(frame_point(row, plan) for row in source_clutches)),
        body_boxes_ldu=_clamped_column_boxes(candidate, plan, solid_bounds),
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
        builder_connectivity_fact=part.plan.builder_connectivity_fact,
        catalog_id=part.plan.catalog_id,
        display_name=part.plan.display_name,
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
