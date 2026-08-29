"""Shared construction helpers and pinned facts for measured-part admission plans."""

from __future__ import annotations

from measured_part_tables import (
    BUILDER_CONNECTOR_SOURCE,
    BuilderConnectivityFact,
    MeasuredPartPlan,
)

PLATE_HEIGHT_LDU = 8
BRICK_HEIGHT_LDU = 24


def measured_part_plan(
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
