"""Which parts the catalog admits from measured source, and under what identity.

This hand-authored input carries identity, lattice height, source frame,
connector source, and reviewed connector-capacity membership. Capacity-seat
positions are checked fail-closed against measured clutch rows; group membership
remains authored policy. Every other emitted number is measured from pinned archives.

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
    RenderOnlyPartPlan,
)
from measured_part_render_only_plan import (
    BUNDLED_LDRAW_ARCHIVE_RECORD,
    RENDER_ONLY_PART_PLANS,
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
    catalog_id: str | None = None,
    display_name: str | None = None,
    validated_connection_stud_profile: str | None = None,
    allow_ldcad_square_s6_clutches: bool = False,
    clutch_shared_capacity_groups: tuple[
        tuple[tuple[int, int, int], tuple[str, ...]], ...
    ] = (),
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
        catalog_id=catalog_id,
        display_name=display_name,
        validated_connection_stud_profile=validated_connection_stud_profile,
        allow_ldcad_square_s6_clutches=allow_ldcad_square_s6_clutches,
        clutch_shared_capacity_groups=clutch_shared_capacity_groups,
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
    # builtin.basic-parts/14: the corrected manifest-v6 step-18 crop identifies
    # the two printed quarter tiles as 25269 rather than the adjacent 3069 tile.
    # Its official LDraw root supplies the exact visible surface and collision
    # height field. The LDCad shadow subpart independently authors the one central
    # clutch and passes the same clutch-room probe as the other shadow-sourced
    # measured parts; Builder record presence grants no connector authority.
    _plan(
        "25269",
        "tile",
        1,
        1,
        variant="quarter-round",
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
    ),
    # builtin.basic-parts/15: 28802 is a distinct rounded-bottom bracket. Its
    # official closure supplies the exact mesh and collision height field; the
    # pinned LDCad walk authors both female clutches and verifies all six visible
    # male stud frames, including four studs whose outward normal is horizontal.
    _plan(
        "28802",
        "bracket",
        4,
        1,
        variant="rounded-bottom",
        height_ldu=20,
        translation_ldu=(0, -10, 0),
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:bracket-1x2-1x4-rounded-bottom",
        display_name="Bracket 1 x 2 - 1 x 4 Rounded Bottom",
    ),
    # builtin.basic-parts/16: the pinned official-model inventory distribution
    # records eighteen 35787 triangular tiles. The official root supplies the
    # exact canonical diagonal mesh and conservative collision height field. Its
    # exact LDCad subpart authors three female cells whose centres lie on or
    # inside the occupied triangular half. The pinned Builder native pack retains
    # one unframed family-15 clutch node in a type-23 Custom2DField plus three
    # Slider primitives, but has no reviewed frame for this design; retain that
    # contradiction as counterevidence and grant it no connector authority.
    _plan(
        "35787",
        "tile",
        2,
        2,
        variant="triangular",
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:tile-2x2-triangular",
        display_name="Tile 2 x 2 Triangular",
    ),
    # builtin.basic-parts/17: 11253 is minifig footwear rather than a plate-
    # shaped envelope, so its palette family names that role. The official
    # closure supplies the exact roller and shoe surface plus its one visible
    # stud. The exact LDCad shadow walk authors the single underside clutch;
    # Builder agrees only on the unframed clutch count and remains
    # counterevidence rather than a connector source.
    _plan(
        "11253",
        "minifig-accessory",
        1,
        1,
        variant="roller-skate",
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:roller-skate",
        display_name="Roller Skate",
        validated_connection_stud_profile="nominal-stud-tube/1",
    ),
    # builtin.basic-parts/18: 15254 is the five-piece thin-top arch first used
    # by printed step 28. Its official closure supplies the six visible studs,
    # exact shell and conservative collision height field. The pinned Builder
    # revision-J record supplies the two end clutches through an exact six-stud
    # correspondence; both proper frames and their two mirrored equivalents are
    # one connector-observable symmetry class. LDCad's S6x44 rows remain
    # excluded because they are not the standard round R6x4 anti-stud profile.
    _plan(
        "15254",
        "arch",
        1,
        6,
        variant="thin-top",
        height_ldu=48,
        orientation_id="upright-yaw-90",
        translation_ldu=(0, -24, 0),
        catalog_id="builtin:arch-1x6-thin-top",
        display_name="Arch 1 x 6 x 2 Thin Top",
    ),
    # builtin.basic-parts/19: step 40 first uses the 41682 bracket. Its exact
    # official closure supplies the horizontal plate, vertical wall and two
    # side-facing stud surfaces. The pinned LDCad root independently authors
    # the four underside clutches and both directional studs; all six frames
    # land on one normal-grouped 20-LDU lattice and every clutch has measured
    # room for a nominal stud. Builder has no record for this design and grants
    # no authority.
    _plan(
        "41682",
        "bracket",
        2,
        2,
        variant="vertical-studs",
        height_ldu=28,
        translation_ldu=(0, 6, 0),
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:bracket-2x2-1x2-vertical-studs",
        display_name="Bracket 2 x 2 with 1 x 2 Vertical Studs",
    ),
    # builtin.basic-parts/20: step 35 first uses the 2877 grille brick. Its
    # exact official closure supplies the asymmetric grille shell and two top
    # studs. The checksum-pinned Builder revision-E record has two exact frame
    # classes after the stud correspondence; Builder's own asymmetric shell
    # selects turn180, and its framed type-22 field exclusively authors the two
    # underside clutch cells. LDCad's square S6x20 rows are not standard round
    # R6x4 anti-studs and grant no connector authority.
    _plan(
        "2877",
        "brick",
        1,
        2,
        variant="grille",
        height_ldu=BRICK_HEIGHT_LDU,
        orientation_id="upright-yaw-90",
        translation_ldu=(0, -12, 0),
        catalog_id="builtin:brick-1x2-grille",
        display_name="Brick 1 x 2 with Grille",
    ),
    # builtin.basic-parts/21: step 43 first uses the 3040 45-degree slope. Its
    # moved-to official root resolves to the exact 3040b shell, whose visible
    # stud and checksum-pinned stud3a underside tube provide an exact Builder
    # frame modulo the source's x reflection. The framed revision-F field
    # exclusively authors the two underside clutch cells; LDCad's square S6
    # rows are diagnostic only and grant no connector authority. The official
    # stud primitive is the nominal six-LDU round profile; its triangulated
    # source radius is slightly above six, so validated stud/tube connections
    # use the already admitted nominal source-rounding normalization while
    # ordinary collision retains the measured radius.
    _plan(
        "3040",
        "slope",
        1,
        2,
        variant="45",
        height_ldu=BRICK_HEIGHT_LDU,
        translation_ldu=(0, -12, 10),
        catalog_id="builtin:slope-1x2-45",
        display_name="Slope 45 1 x 2",
        validated_connection_stud_profile="nominal-stud-tube/1",
    ),
    # builtin.basic-parts/22: step 45 first uses 4519, the three-module axle.
    # Its exact official root already lies on the catalog's x-axis convention.
    # The pinned LDCad part shadow contributes one centred, sliding, capless
    # male A6x60 shaft; the narrow source gate projects only that exact fact to
    # the three discrete seats the existing axle definitions use. LDraw owns
    # the body and collision field but does not author those connection seats.
    _plan(
        "4519",
        "axle",
        1,
        3,
        height_ldu=12,
        translation_ldu=(0, 0, 0),
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:axle-1x3",
        display_name="Technic Axle 3",
    ),
    # builtin.basic-parts/23: the official 32064 alias resolves to 32064a, the
    # one-hole Technic brick in the printed and official inventories. Its exact
    # closure supplies the open-sided shell, two top studs and conservative
    # collision height field. The pinned LDCad composition authors the two
    # underside clutches and the one transverse female axle-hole seat; Builder's
    # revision-I record remains counterevidence and grants no connector authority.
    _plan(
        "32064",
        "technic-brick",
        1,
        2,
        height_ldu=BRICK_HEIGHT_LDU,
        orientation_id="upright-yaw-90",
        translation_ldu=(0, -12, 0),
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:technic-brick-1x2-axle-hole",
        display_name="Technic Brick 1 x 2 with Axle Hole",
    ),
    # builtin.basic-parts/24: step 59 first uses the regular 3 x 3 plate. Its
    # exact official closure supplies the shell and nine visible studs. The
    # pinned LDCad root independently authors the matching regular 3 x 3 grid
    # of nine underside clutches. The square plate is quarter-turn symmetric,
    # and yaw zero is the canonical catalog frame.
    _plan(
        "11212",
        "plate",
        3,
        3,
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        validated_connection_stud_profile="nominal-stud-tube/1",
    ),
    # builtin.basic-parts/25: a stale quarantine locator associates step 76
    # with the 2 x 2 plate with two studs along one edge, but supplies no
    # printed-identity authority. Its exact official closure supplies the
    # asymmetric stud surface and conservative collision field. The pinned
    # LDCad walk directly authors both visible studs and all four regular
    # underside clutches; Builder's unframed revision-E record remains
    # count-only counterevidence.
    _plan(
        "33909",
        "plate",
        2,
        2,
        variant="two-studs",
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:plate-2x2-two-studs",
        display_name="Plate 2 x 2 with 2 Studs on One Edge",
        validated_connection_stud_profile="nominal-stud-tube/1",
    ),
    # builtin.basic-parts/26: seven stale quarantine locators associate steps
    # 265, 268, 271, 274, 277, 282 and 336 with the regular 1 x 5 plate, but all
    # are self-contradicted and supply no printed-identity authority. The exact
    # official closure supplies the five-stud surface and conservative collision
    # field. A quarter turn selects the catalog's width-first frame; the exact
    # LDCad walk authors all five studs and five underside clutches.
    _plan(
        "78329",
        "plate",
        1,
        5,
        orientation_id="upright-yaw-90",
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        validated_connection_stud_profile="nominal-stud-tube/1",
    ),
    # builtin.basic-parts/27: the bounded first-50 tranche appends four exact
    # official roots together. Each square-S6 socket is admitted only by the
    # design-scoped opt-in whose semantics are calibrated against the pinned
    # 2877, 3040 and 15254 Builder clutch frames; arbitrary square barrels stay
    # rejected. None of these declarations authenticates a printed placement.
    _plan(
        "99563",
        "tile",
        1,
        2,
        variant="chamfered-indented",
        orientation_id="upright-yaw-90",
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:tile-1x2-chamfered-indented",
        display_name="Tile 1 x 2 Chamfered with 2 Top Indentations",
        allow_ldcad_square_s6_clutches=True,
        clutch_shared_capacity_groups=(
            ((0, 4, -10), ("99563:negative-z-half",)),
            ((0, 4, 0), ("99563:negative-z-half", "99563:positive-z-half")),
            ((0, 4, 10), ("99563:positive-z-half",)),
        ),
    ),
    _plan(
        "73230",
        "technic-brick",
        1,
        1,
        variant="axle-hole",
        height_ldu=BRICK_HEIGHT_LDU,
        orientation_id="upright-yaw-90",
        translation_ldu=(0, -12, 0),
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:technic-brick-1x1-axle-hole",
        display_name="Technic Brick 1 x 1 with Axle Hole",
        validated_connection_stud_profile="nominal-stud-tube/1",
        allow_ldcad_square_s6_clutches=True,
    ),
    _plan(
        "35464",
        "slope",
        1,
        1,
        variant="double-45",
        height_ldu=16,
        translation_ldu=(0, 8, 0),
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:slope-1x1-double-45",
        display_name="Slope 45 1 x 1 Double",
        allow_ldcad_square_s6_clutches=True,
    ),
    _plan(
        "49307",
        "curved-slope",
        1,
        1,
        variant="outside-bow",
        height_ldu=16,
        translation_ldu=(0, 8, 0),
        connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE,
        catalog_id="builtin:curved-slope-1x1-outside-bow",
        display_name="Curved Slope 1 x 1 x 2/3 Outside Bow",
        allow_ldcad_square_s6_clutches=True,
    ),
)
