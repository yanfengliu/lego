"""The measured part as the part-admission scorer reads it.

Split from measured_part_tables.py so that module stays under 500 lines; the
emitter scores every full measured part with this before it writes a table.
"""

from __future__ import annotations

from measured_clutch_tables import clutch_row_normal, clutch_row_position
from measured_part_geometry import frame_direction, frame_point, inverse_orientation_id
from measured_part_tables import MeasuredPart, MeasuredPartPlan
from measured_source_connector_rows import source_connector_candidate_row


def scoreable_candidate(part: MeasuredPart) -> dict[str, object]:
    """The measured part as the part-admission scorer's own candidate shape.

    Scoring happens in the source-local frame the scorer measures in, against the
    same surface, so the number recorded for an admitted part is a number about
    the declaration actually emitted rather than about a differently framed one.
    """

    inverse = inverse_orientation_id(part.plan.orientation_id)
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
        (
            frame_point(
                tuple(
                    clutch_row_position(row)[axis] - part.plan.translation_ldu[axis]
                    for axis in range(3)
                ),
                unframe,
            ),
            frame_direction(clutch_row_normal(row), unframe),
        )
        for row in part.clutches_ldu
    ]
    source_connectors = [
        source_connector_candidate_row(
            row,
            lambda point: frame_point(
                tuple(point[axis] - part.plan.translation_ldu[axis] for axis in range(3)),
                unframe,
            ),
            lambda direction: frame_direction(direction, unframe),
        )
        for row in part.source_connectors_ldu
    ]
    candidate = dict(part.candidate)
    candidate["connectors"] = [
        row for row in candidate["connectors"] if row["kind"] == "stud"  # type: ignore[union-attr,index]
    ] + [
        {
            "kind": "undersideClutch",
            "gender": "female",
            "positionLdu": list(position),
            "normal": [value + 0.0 for value in normal],
        }
        for position, normal in clutches
    ] + source_connectors
    candidate["derivation"] = (
        f"{part.plan.connector_source} connectors over "
        f"{candidate['derivation']}"  # type: ignore[index]
    )
    return candidate
