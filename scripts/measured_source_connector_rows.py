"""Typed source-authored connector rows shared by measurement and emission."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Sequence

Vector3 = tuple[float, float, float]
PointTransform = Callable[[Sequence[float]], Vector3]
DirectionTransform = Callable[[Sequence[float]], Vector3]
CONNECTOR_AXIAL_SPAN_SCHEMA_VERSION = "connector-axial-span/1"
THROUGH_AXLE_BORE_COLLISION_SCHEMA_VERSION = (
    "measured-through-axle-bore-collision/1"
)


@dataclass(frozen=True)
class ConnectorAxialSpan:
    """Exact finite axis segment for a one-sided connector seat."""

    schema_version: str
    open_end_ldu: Vector3
    closed_end_ldu: Vector3
    depth_ldu: float
    sliding: bool


@dataclass(frozen=True)
class ThroughAxleBoreCollisionEvidence:
    """Exact open A6x1 segment whose bounded bore may admit one connected axle."""

    schema_version: str
    source_section: str
    start_ldu: Vector3
    end_ldu: Vector3
    radius_ldu: float
    segment_length_ldu: float
    caps: str
    sliding: bool


@dataclass(frozen=True)
class MeasuredSourceConnector:
    """One source-authored connector after projection into a declared frame."""

    kind: str
    position_ldu: Vector3
    normal: Vector3
    axial_span: ConnectorAxialSpan | None = None
    through_bore_collision: ThroughAxleBoreCollisionEvidence | None = None


def transform_source_connector(
    row: MeasuredSourceConnector,
    transform_point: PointTransform,
    transform_direction: DirectionTransform,
) -> MeasuredSourceConnector:
    span = row.axial_span
    through_bore = row.through_bore_collision
    return MeasuredSourceConnector(
        kind=row.kind,
        position_ldu=transform_point(row.position_ldu),
        normal=transform_direction(row.normal),
        axial_span=(
            None
            if span is None
            else ConnectorAxialSpan(
                schema_version=span.schema_version,
                open_end_ldu=transform_point(span.open_end_ldu),
                closed_end_ldu=transform_point(span.closed_end_ldu),
                depth_ldu=span.depth_ldu,
                sliding=span.sliding,
            )
        ),
        through_bore_collision=(
            None
            if through_bore is None
            else ThroughAxleBoreCollisionEvidence(
                schema_version=through_bore.schema_version,
                source_section=through_bore.source_section,
                start_ldu=transform_point(through_bore.start_ldu),
                end_ldu=transform_point(through_bore.end_ldu),
                radius_ldu=through_bore.radius_ldu,
                segment_length_ldu=through_bore.segment_length_ldu,
                caps=through_bore.caps,
                sliding=through_bore.sliding,
            )
        ),
    )


def source_connector_sort_key(row: MeasuredSourceConnector) -> tuple[object, ...]:
    span = row.axial_span
    through_bore = row.through_bore_collision
    return (
        row.kind,
        row.position_ldu,
        row.normal,
        () if span is None else span.open_end_ldu,
        () if span is None else span.closed_end_ldu,
        () if through_bore is None else through_bore.start_ldu,
        () if through_bore is None else through_bore.end_ldu,
    )


def source_connector_candidate_row(
    row: MeasuredSourceConnector,
    transform_point: PointTransform,
    transform_direction: DirectionTransform,
) -> dict[str, object]:
    transformed = transform_source_connector(row, transform_point, transform_direction)
    payload: dict[str, object] = {
        "kind": transformed.kind,
        "gender": "female" if transformed.kind in ("axleHole", "blindAxleHole") else "male",
        "positionLdu": list(transformed.position_ldu),
        "normal": list(transformed.normal),
    }
    span = transformed.axial_span
    if span is not None:
        payload["axialSpan"] = {
            "schemaVersion": span.schema_version,
            "openEndLdu": list(span.open_end_ldu),
            "closedEndLdu": list(span.closed_end_ldu),
            "depthLdu": span.depth_ldu,
            "sliding": span.sliding,
        }
    through_bore = transformed.through_bore_collision
    if through_bore is not None:
        payload["throughBoreCollision"] = {
            "schemaVersion": through_bore.schema_version,
            "sourceSection": through_bore.source_section,
            "startLdu": list(through_bore.start_ldu),
            "endLdu": list(through_bore.end_ldu),
            "radiusLdu": through_bore.radius_ldu,
            "segmentLengthLdu": through_bore.segment_length_ldu,
            "caps": through_bore.caps,
            "sliding": through_bore.sliding,
        }
    return payload
