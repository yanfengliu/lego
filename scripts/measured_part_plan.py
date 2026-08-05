"""Which parts the catalog admits from measured source, and under what identity.

This is the one hand-authored input to the generated tables, and it is
deliberately small: a catalog id, a lattice height, the quarter turn and
whole-LDU translation that normalize the source frame, and which authored source
the female connectors come from. Every number in the emitted tables is measured
from the pinned archives instead.

Order is contract. A new part is appended rather than interleaved, because
catalog order is part of the truth digest and appending is what proves the parts
already in the catalog were not regenerated.
"""

from __future__ import annotations

from measured_part_tables import (
    BUILDER_CONNECTOR_SOURCE,
    LDCAD_SHADOW_CONNECTOR_SOURCE,
    MeasuredPartPlan,
)

PLATE_HEIGHT_LDU = 8
BRICK_HEIGHT_LDU = 24


def _plan(
    design_id: str,
    family: str,
    width_studs: int,
    length_studs: int,
    *,
    variant: str | None = None,
    height_ldu: int = PLATE_HEIGHT_LDU,
    orientation_id: str = "upright-yaw-0",
    translation_ldu: tuple[int, int, int] = (0, -4, 0),
    connector_grid_center_ldu: tuple[int, int] = (0, 0),
    connector_source: str = BUILDER_CONNECTOR_SOURCE,
) -> MeasuredPartPlan:
    return MeasuredPartPlan(
        design_id=design_id,
        ldraw_path=f"parts/{design_id}.dat",
        family=family,
        width_studs=width_studs,
        length_studs=length_studs,
        variant=variant,
        height_ldu=height_ldu,
        orientation_id=orientation_id,
        translation_ldu=translation_ldu,
        connector_grid_center_ldu=connector_grid_center_ldu,
        connector_source=connector_source,
    )


ADMITTED_PART_PLANS: tuple[MeasuredPartPlan, ...] = (
    # The first production admission, at builtin.basic-parts/7. Its five parts
    # take their female connectors from LEGO Builder's authored Custom2DField
    # through the pinned per-part frame. 5092, 35480 and 51739 turn a quarter so
    # the catalog's width-first convention holds; 93273 sits 16 LDU tall so its
    # frame lifts by 8 rather than dropping by 4.
    _plan("5092", "tile", 1, 2, variant="cut-right-45", orientation_id="upright-yaw-90"),
    _plan("35480", "plate", 1, 2, variant="round-end", orientation_id="upright-yaw-90"),
    _plan("51739", "wedge-plate", 2, 4, variant="wing", orientation_id="upright-yaw-90"),
    _plan("77844", "corner-plate", 3, 3, connector_grid_center_ldu=(20, 20)),
    _plan(
        "93273",
        "curved-slope",
        1,
        4,
        variant="double",
        height_ldu=16,
        translation_ldu=(0, 8, 0),
    ),
    # builtin.basic-parts/8: the designs the LDCad shadow library rescues, none of
    # which the 107-record Builder pack has any record of. LDraw alone gives each
    # of them studs and zero clutch cells, which is a part that can be built on
    # and never placed on anything. Their raw horizontal frames are preserved
    # rather than recentred, so the connector lattice is centred independently.
    _plan(
        "30357",
        "plate",
        3,
        3,
        variant="corner-round",
        connector_grid_center_ldu=(20, 20),
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
    ),
    _plan(
        "2450",
        "wedge-plate",
        3,
        3,
        variant="cut-corner",
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
    ),
    _plan(
        "79491",
        "corner-plate",
        2,
        2,
        variant="round",
        connector_grid_center_ldu=(10, 10),
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
    ),
)

# The archive the bundled geometry is read from, byte-pinned. It is repeated in
# the emitted attribution table so a reader can check the files without this
# script, and it must stay equal to ARCHIVE_PINS[0].
BUNDLED_LDRAW_ARCHIVE_RECORD: dict[str, object] = {
    "archiveId": "official",
    "source": "https://library.ldraw.org/library/official",
    "version": "ldraw-complete-2026-07",
    "bytes": 144_722_356,
    "sha256": "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
}
