"""Canonical report-row serialization for measured-part table generation."""

from __future__ import annotations

from typing import Any


def build_measured_part_report_row(part: Any, catalog_id: str) -> dict[str, object]:
    """Serialize one fully measured source expansion under its resolved identity."""

    return {
        "designId": part.plan.design_id,
        "catalogId": catalog_id,
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
        "sourceConnectors": len(part.source_connectors_ldu),
        "sourceConnectorKinds": sorted({row[0] for row in part.source_connectors_ldu}),
        "collisionBoxes": len(part.body_boxes_ldu) // 6,
        "meshTriangles": part.body_triangle_count + part.stud_triangle_count,
        "closureFileCount": len(part.closure),
        "shadowFiles": list(part.shadow_files),
    }


def build_render_only_part_report_row(part: Any, catalog_id: str) -> dict[str, object]:
    """Serialize one render-only source expansion under its resolved identity."""

    return {
        "designId": part.plan.design_id,
        "catalogId": catalog_id,
        "connectorSource": "preserved-catalog-definition-not-read-by-generator",
        "sourceStudFrameWitnesses": len(part.source_stud_seats_ldu),
        "meshTriangles": part.body_triangle_count + part.stud_triangle_count,
        "closureFileCount": len(part.closure),
        "structuralFieldsEmitted": 0,
    }
