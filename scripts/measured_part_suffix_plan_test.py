"""Exact-suffix admission-plan tests for measured-part tables."""

from __future__ import annotations

import unittest

from measured_part_plan import ADMITTED_PART_PLANS


class ExactSuffixPlanTests(unittest.TestCase):
    def test_exact_suffix_plans_pin_distinct_frames_and_connector_semantics(self) -> None:
        brick, tower = ADMITTED_PART_PLANS[29:31]

        self.assertEqual(
            (
                brick.design_id,
                brick.ldraw_path,
                brick.catalog_id,
                brick.variant,
                brick.height_ldu,
                brick.orientation_id,
                brick.translation_ldu,
                brick.allow_ldcad_square_s6_clutches,
                brick.validated_connection_stud_profile,
            ),
            (
                "3245c",
                "parts/3245c.dat",
                "builtin:brick-1x2x2-without-understud",
                "without-understud",
                48,
                "upright-yaw-90",
                (0, -24, 0),
                False,
                "nominal-stud-tube/1",
            ),
        )
        self.assertEqual(
            brick.clutch_shared_capacity_groups,
            (
                ((0, 24, -10), ("3245c:negative-z-half",)),
                ((0, 24, 0), ("3245c:negative-z-half", "3245c:positive-z-half")),
                ((0, 24, 10), ("3245c:positive-z-half",)),
            ),
        )
        self.assertEqual(
            (
                tower.design_id,
                tower.ldraw_path,
                tower.catalog_id,
                tower.variant,
                tower.height_ldu,
                tower.translation_ldu,
                tower.allow_ldcad_square_s6_clutches,
                tower.validated_connection_stud_profile,
            ),
            (
                "2453b",
                "parts/2453b.dat",
                "builtin:brick-1x1x5-solid-stud",
                "solid-stud",
                120,
                (0, -60, 0),
                True,
                "nominal-stud-tube/1",
            ),
        )

    def test_v29_plans_pin_distinct_exact_identities_and_frames(self) -> None:
        bracket, axle_holder_brick = ADMITTED_PART_PLANS[31:33]

        self.assertEqual(
            (
                bracket.design_id,
                bracket.ldraw_path,
                bracket.catalog_id,
                bracket.display_name,
                bracket.family,
                bracket.width_studs,
                bracket.length_studs,
                bracket.variant,
                bracket.height_ldu,
                bracket.orientation_id,
                bracket.translation_ldu,
                bracket.connector_source,
                bracket.validated_connection_stud_profile,
                bracket.allow_ldcad_square_s6_clutches,
            ),
            (
                "10201",
                "parts/10201.dat",
                "builtin:bracket-1x2-1x4-rounded-corners",
                "Bracket 1 x 2 - 1 x 4 with Rounded Corners",
                "bracket",
                4,
                1,
                "rounded-corners",
                20,
                "upright-yaw-0",
                (0, -10, 0),
                "ldcad-shadow",
                "nominal-stud-tube/1",
                True,
            ),
        )
        self.assertEqual(
            (
                axle_holder_brick.design_id,
                axle_holder_brick.ldraw_path,
                axle_holder_brick.catalog_id,
                axle_holder_brick.display_name,
                axle_holder_brick.family,
                axle_holder_brick.width_studs,
                axle_holder_brick.length_studs,
                axle_holder_brick.variant,
                axle_holder_brick.height_ldu,
                axle_holder_brick.orientation_id,
                axle_holder_brick.translation_ldu,
                axle_holder_brick.connector_source,
                axle_holder_brick.validated_connection_stud_profile,
                axle_holder_brick.allow_ldcad_square_s6_clutches,
            ),
            (
                "3245b",
                "parts/3245b.dat",
                "builtin:brick-1x2x2-inside-axle-holder",
                "Brick 1 x 2 x 2 with Inside Axle Holder",
                "brick",
                1,
                2,
                "inside-axle-holder",
                48,
                "upright-yaw-90",
                (0, -24, 0),
                "ldcad-shadow",
                "nominal-stud-tube/1",
                False,
            ),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
