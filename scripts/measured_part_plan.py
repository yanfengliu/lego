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
    BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
    BUILDER_CONNECTOR_SOURCE,
    LDCAD_SHADOW_CONNECTOR_SOURCE,
    BuilderConnectivityFact,
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
    builder_connectivity_fact: BuilderConnectivityFact | None = None,
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
        builder_connectivity_fact=builder_connectivity_fact,
    )


BUILDER_80015_CONNECTIVITY = BuilderConnectivityFact(
    source_id="https://api.prod.dbix.i.lego.com/api/v1/Bricks/80015?Revision=E&Platform=Android",
    source_revision="80015;revision-E;platform-Android",
    manifest_sha256="sha256:3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6",
    manifest_md5="md5:bb72d5b5609e411392df36903c8c5daa",
    bundle_sha256="sha256:f3a11d40f9de9fa54670bdd87db0a87e034896d87b56e64e9f382c3ef0098c75",
    primitive_xml_sha256="sha256:ad9aca4ca7275358e2f680ad154b5f577f8fc79b87a8ea1c60aea4558a0a23bc",
    independent_source_id="https://github.com/RolandMelkert/LDCadShadowLibrary",
    independent_source_revision="15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
    independent_part_sha256="sha256:c4dbcc5c5e2969e2b6e5c394519606a66b8483437503b8f4886cdf9262cd7170",
    independent_subpart_sha256="sha256:fa4324fccee90f9903c68c65a75bb4e747a76d429a94d648c10b9e24ceb4d879",
    extractor_id="lego-builder-custom2dfield-type22-centres/1",
    normalized_clutch_offsets_sha256="sha256:0e77ae20bce268bcde610fa8d2b34fa2e91a0c3a0132e298e933433591e8f0d5",
    clutches_source_ldu=(
        (-10, 8, -70),
        (10, 8, -70),
        (30, 8, -70),
        (50, 8, -50),
        (70, 8, -30),
        (70, 8, -10),
        (70, 8, 10),
    ),
    partial_overhangs=((30, -70, 2.2), (70, -30, 2.2)),
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
    # Exact render surfaces for the special plates used by the first underside
    # booklet panel. Their Builder records are already byte-pinned by the frame
    # report; admitting them through this route replaces the catalog's filled
    # wedge/arc drawings with the official LDraw closures, including the real
    # cavity walls, rings and ribs visible after printed step 4 turns the build.
    # For 30503, 6106 and 30565 the LDCad shadow records are whole-tree pinned and
    # each emitted clutch is checked against the expanded LDraw surface. 80015
    # instead retains its seven-seat, two-overhang byte-pinned Builder fact.
    _plan(
        "30503",
        "wedge-plate",
        4,
        4,
        variant="cut-corner",
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
    ),
    _plan(
        "6106",
        "wedge-plate",
        6,
        6,
        variant="cut-corner",
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
    ),
    _plan(
        "30565",
        "corner-plate",
        4,
        4,
        variant="round",
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
    ),
    _plan(
        "80015",
        "corner-plate",
        5,
        5,
        variant="quarter-ring",
        connector_grid_center_ldu=(30, -30),
        connector_source=BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
        builder_connectivity_fact=BUILDER_80015_CONNECTIVITY,
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
