"""Synthetic fixtures shared by measured-part table tests."""

from __future__ import annotations

from ldraw_source_archive import SourceRecord
from measured_part_tables import (
    MeasuredPart,
    MeasuredPartPlan,
    RenderOnlyPart,
    RenderOnlyPartPlan,
)
from part_admission_surface import BODY_ROLE, MeasuredSurface

ARCHIVE_SHA256 = "6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae"
SHADOW_IDENTITY = {
    "libraryId": "ldcad-shadow-library",
    "commit": "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
    "manifestSha256": "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
}
BUILDER_RECORDS = {
    "unit": {"revision": "A", "recordSha256": "sha256:ab", "frameSha256": "sha256:cd"}
}


def plan(**overrides: object) -> MeasuredPartPlan:
    fields: dict[str, object] = {
        "design_id": "unit",
        "ldraw_path": "parts/unit.dat",
        "family": "plate",
        "width_studs": 1,
        "length_studs": 2,
        "variant": None,
        "height_ldu": 8,
        "orientation_id": "upright-yaw-0",
        "translation_ldu": (0, -4, 0),
        "connector_grid_center_ldu": (0, 0),
        "connector_source": "builder",
    }
    fields.update(overrides)
    return MeasuredPartPlan(**fields)  # type: ignore[arg-type]


def record(path: str, digest: str) -> SourceRecord:
    return SourceRecord(
        archive_id="official",
        path=path,
        byte_length=10,
        sha256=digest,
        title="Unit",
        declared_name=path,
        author="Unit Author",
        ldraw_org="Part UPDATE 2026-01",
        license_expression="CC-BY-4.0",
    )


def measured(**overrides: object) -> MeasuredPart:
    fields: dict[str, object] = {
        "plan": plan(),
        "surface": MeasuredSurface(
            design_id="unit",
            triangles=(((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),),
            roles=(BODY_ROLE,),
            corner_normals=(((0.0, -1.0, 0.0),) * 3,),
        ),
        "positions_ldu": (0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0),
        "normals_asset_local": (0.0, -1.0, 0.0) * 3,
        "indices": (0, 1, 2),
        "body_triangle_count": 1,
        "stud_triangle_count": 0,
        "exact_body_bounds": (("-10", "-4", "-20"), ("10", "4", "20")),
        "exact_bounds": (("-10", "-8", "-20"), ("10", "4", "20")),
        "studs_ldu": ((0.0, -4.0, -10.0, 6.0, 4.0),),
        "clutches_ldu": ((0.0, 4.0, -10.0),),
        "body_boxes_ldu": (-10.0, -4.0, -20.0, 10.0, 4.0, 20.0),
        "root": record("parts/unit.dat", "sha256:11"),
        "closure": (record("parts/unit.dat", "sha256:11"), record("p/stud.dat", "sha256:22")),
        "shadow_files": ("p/stud.dat", "parts/unit.dat"),
        "candidate": {},
    }
    fields.update(overrides)
    return MeasuredPart(**fields)  # type: ignore[arg-type]


def render_only(**overrides: object) -> RenderOnlyPart:
    render_plan = RenderOnlyPartPlan(
        design_id="render-unit",
        ldraw_path="parts/render-unit.dat",
        family="cheese-slope",
        width_studs=1,
        length_studs=1,
        variant=None,
        height_ldu=16,
        orientation_id="upright-yaw-0",
        translation_ldu=(0, 8, 0),
    )
    fields: dict[str, object] = {
        "plan": render_plan,
        "surface": MeasuredSurface(
            design_id="render-unit",
            triangles=(((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),),
            roles=(BODY_ROLE,),
            corner_normals=(((0.0, -1.0, 0.0),) * 3,),
        ),
        "positions_ldu": (0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0),
        "normals_asset_local": (0.0, -1.0, 0.0) * 3,
        "indices": (0, 1, 2),
        "body_triangle_count": 1,
        "stud_triangle_count": 0,
        "exact_body_bounds": (("-10", "-7.6", "-10"), ("10", "8", "10")),
        "exact_bounds": (("-10", "-7.6", "-10"), ("10", "8", "10")),
        "source_stud_seats_ldu": (),
        "root": record("parts/render-unit.dat", "sha256:44"),
        "closure": (record("parts/render-unit.dat", "sha256:44"),),
    }
    fields.update(overrides)
    return RenderOnlyPart(**fields)  # type: ignore[arg-type]
