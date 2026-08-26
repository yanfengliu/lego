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


if __name__ == "__main__":
    unittest.main(verbosity=2)
