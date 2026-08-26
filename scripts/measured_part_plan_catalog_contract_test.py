"""Catalog-report and render-only contracts extracted from the main plan suite."""

from __future__ import annotations

import unittest

from measured_part_plan import ADMITTED_PART_PLANS, RENDER_ONLY_PART_PLANS
from measured_part_tables import measured_part_report_row
from measured_part_test_support import measured


class PlanCatalogContractTests(unittest.TestCase):
    def test_11253_report_retains_the_reviewed_stud_profile(self) -> None:
        row = measured_part_report_row(measured(plan=ADMITTED_PART_PLANS[15]))

        self.assertEqual(row["validatedConnectionStudProfile"], "nominal-stud-tube/1")

    def test_render_only_roots_are_distinct_and_cannot_name_a_connector_source(self) -> None:
        self.assertEqual(
            [row.design_id for row in RENDER_ONLY_PART_PLANS],
            [
                "41770a",
                "41769a",
                "43723a",
                "43722a",
                "54383",
                "3659",
                "3455",
                "11477",
                "50950",
                "61678",
                "54200",
                "85984",
            ],
        )
        self.assertTrue(
            all(not hasattr(row, "connector_source") for row in RENDER_ONLY_PART_PLANS)
        )
        self.assertEqual(
            len(
                {
                    (row.family, row.width_studs, row.length_studs, row.variant)
                    for row in RENDER_ONLY_PART_PLANS
                }
            ),
            len(RENDER_ONLY_PART_PLANS),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
