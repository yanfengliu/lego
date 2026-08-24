"""Admission-plan tests for measured-part tables."""

from __future__ import annotations

import unittest

from builder_ldraw_frame_pins import EXACT, PINNED_FRAME_DIGESTS, PINNED_FRAMES
from builder_native_source import NATIVE_RECORD_SHA256, NATIVE_REVIEW_RECORD_SHA256
from measured_part_plan import ADMITTED_PART_PLANS, RENDER_ONLY_PART_PLANS
from measured_part_tables import (
    BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
    LDCAD_SHADOW_CONNECTOR_SOURCE,
    measured_part_report_row,
)
from measured_part_test_support import measured, plan, record


class PlanTests(unittest.TestCase):
    def test_plan_refuses_an_unknown_validated_connection_stud_profile(self) -> None:
        with self.assertRaisesRegex(ValueError, "only admitted source-rounding normalization"):
            plan(validated_connection_stud_profile="invented-profile/1")

    def test_emission_report_uses_the_explicit_28802_catalog_identity(self) -> None:
        part = measured(
            plan=ADMITTED_PART_PLANS[13],
            studs_ldu=((0.0, 0.0, 0.0, 1.0, 1.0),) * 6,
            clutches_ldu=((0.0, 0.0, 0.0),) * 2,
            body_boxes_ldu=(0.0,) * (23 * 6),
            body_triangle_count=500,
            stud_triangle_count=118,
            closure=(record("parts/28802.dat", "sha256:11"),) * 19,
            shadow_files=("p/stud.dat", "p/stud2.dat", "p/stud3.dat", "parts/28802.dat"),
        )

        self.assertEqual(
            measured_part_report_row(part),
            {
                "designId": "28802",
                "catalogId": "builtin:bracket-1x2-1x4-rounded-bottom",
                "connectorSource": LDCAD_SHADOW_CONNECTOR_SOURCE,
                "studs": 6,
                "clutches": 2,
                "sourceConnectors": 0,
                "sourceConnectorKinds": [],
                "collisionBoxes": 23,
                "meshTriangles": 618,
                "closureFileCount": 19,
                "shadowFiles": [
                    "p/stud.dat",
                    "p/stud2.dat",
                    "p/stud3.dat",
                    "parts/28802.dat",
                ],
            },
        )

    def test_every_admitted_plan_has_a_distinct_catalog_identity(self) -> None:
        identities = [
            (row.family, row.width_studs, row.length_studs, row.variant)
            for row in ADMITTED_PART_PLANS
        ]

        self.assertEqual(len(identities), len(set(identities)))

    def test_admitted_source_roots_keep_their_position_and_connector_source(self) -> None:
        self.assertEqual(
            [row.design_id for row in ADMITTED_PART_PLANS],
            [
                "5092",
                "35480",
                "51739",
                "77844",
                "93273",
                "30357",
                "2450",
                "79491",
                "30503",
                "6106",
                "30565",
                "80015",
                "25269",
                "28802",
                "35787",
                "11253",
                "15254",
                "41682",
                "2877",
                "3040",
                "4519",
            ],
        )
        self.assertTrue(all(row.connector_source == "builder" for row in ADMITTED_PART_PLANS[:5]))
        self.assertTrue(
            all(
                row.connector_source == LDCAD_SHADOW_CONNECTOR_SOURCE
                for row in ADMITTED_PART_PLANS[5:11]
            )
        )
        self.assertEqual(
            ADMITTED_PART_PLANS[11].connector_source,
            BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
        )
        self.assertEqual(
            ADMITTED_PART_PLANS[12].connector_source,
            LDCAD_SHADOW_CONNECTOR_SOURCE,
        )
        self.assertEqual(
            (
                ADMITTED_PART_PLANS[13].connector_source,
                ADMITTED_PART_PLANS[13].catalog_id,
                ADMITTED_PART_PLANS[13].display_name,
            ),
            (
                LDCAD_SHADOW_CONNECTOR_SOURCE,
                "builtin:bracket-1x2-1x4-rounded-bottom",
                "Bracket 1 x 2 - 1 x 4 Rounded Bottom",
            ),
        )
        self.assertEqual(
            (
                ADMITTED_PART_PLANS[14].connector_source,
                ADMITTED_PART_PLANS[14].catalog_id,
                ADMITTED_PART_PLANS[14].display_name,
            ),
            (
                LDCAD_SHADOW_CONNECTOR_SOURCE,
                "builtin:tile-2x2-triangular",
                "Tile 2 x 2 Triangular",
            ),
        )
        self.assertEqual(
            (
                ADMITTED_PART_PLANS[15].connector_source,
                ADMITTED_PART_PLANS[15].catalog_id,
                ADMITTED_PART_PLANS[15].display_name,
                ADMITTED_PART_PLANS[15].validated_connection_stud_profile,
            ),
            (
                LDCAD_SHADOW_CONNECTOR_SOURCE,
                "builtin:roller-skate",
                "Roller Skate",
                "nominal-stud-tube/1",
            ),
        )
        self.assertEqual(
            (
                ADMITTED_PART_PLANS[16].connector_source,
                ADMITTED_PART_PLANS[16].catalog_id,
                ADMITTED_PART_PLANS[16].display_name,
                ADMITTED_PART_PLANS[16].height_ldu,
                ADMITTED_PART_PLANS[16].orientation_id,
                ADMITTED_PART_PLANS[16].translation_ldu,
            ),
            (
                "builder",
                "builtin:arch-1x6-thin-top",
                "Arch 1 x 6 x 2 Thin Top",
                48,
                "upright-yaw-90",
                (0, -24, 0),
            ),
        )
        self.assertTrue(
            all(
                row.validated_connection_stud_profile is None
                for row in ADMITTED_PART_PLANS[:15]
            )
        )
        self.assertIsNone(ADMITTED_PART_PLANS[16].validated_connection_stud_profile)
        self.assertEqual(
            (
                ADMITTED_PART_PLANS[17].connector_source,
                ADMITTED_PART_PLANS[17].catalog_id,
                ADMITTED_PART_PLANS[17].display_name,
                ADMITTED_PART_PLANS[17].height_ldu,
                ADMITTED_PART_PLANS[17].orientation_id,
                ADMITTED_PART_PLANS[17].translation_ldu,
            ),
            (
                LDCAD_SHADOW_CONNECTOR_SOURCE,
                "builtin:bracket-2x2-1x2-vertical-studs",
                "Bracket 2 x 2 with 1 x 2 Vertical Studs",
                28,
                "upright-yaw-0",
                (0, 6, 0),
            ),
        )
        self.assertIsNone(ADMITTED_PART_PLANS[17].validated_connection_stud_profile)
        self.assertEqual(
            (
                ADMITTED_PART_PLANS[18].connector_source,
                ADMITTED_PART_PLANS[18].catalog_id,
                ADMITTED_PART_PLANS[18].display_name,
                ADMITTED_PART_PLANS[18].height_ldu,
                ADMITTED_PART_PLANS[18].orientation_id,
                ADMITTED_PART_PLANS[18].translation_ldu,
            ),
            (
                "builder",
                "builtin:brick-1x2-grille",
                "Brick 1 x 2 with Grille",
                24,
                "upright-yaw-90",
                (0, -12, 0),
            ),
        )
        self.assertIsNone(ADMITTED_PART_PLANS[18].validated_connection_stud_profile)

    def test_4519_plan_pins_only_the_exact_ldcad_axle_route(self) -> None:
        axle = ADMITTED_PART_PLANS[20]

        self.assertEqual(
            (
                axle.design_id,
                axle.connector_source,
                axle.catalog_id,
                axle.display_name,
                axle.family,
                axle.width_studs,
                axle.length_studs,
                axle.height_ldu,
                axle.orientation_id,
                axle.translation_ldu,
            ),
            (
                "4519",
                LDCAD_SHADOW_CONNECTOR_SOURCE,
                "builtin:axle-1x3",
                "Technic Axle 3",
                "axle",
                1,
                3,
                12,
                "upright-yaw-0",
                (0, 0, 0),
            ),
        )

    def test_3040_plan_and_builder_packet_pin_one_identity_frame_and_source(self) -> None:
        plan_3040 = ADMITTED_PART_PLANS[19]
        self.assertEqual(
            (
                plan_3040.design_id,
                plan_3040.connector_source,
                plan_3040.catalog_id,
                plan_3040.display_name,
                plan_3040.family,
                plan_3040.width_studs,
                plan_3040.length_studs,
                plan_3040.variant,
                plan_3040.height_ldu,
                plan_3040.orientation_id,
                plan_3040.translation_ldu,
            ),
            (
                "3040",
                "builder",
                "builtin:slope-1x2-45",
                "Slope 45 1 x 2",
                "slope",
                1,
                2,
                "45",
                24,
                "upright-yaw-0",
                (0, -12, 10),
            ),
        )

        frame = PINNED_FRAMES["3040"]
        self.assertEqual(
            (
                frame.revision,
                frame.record_sha256,
                frame.turn,
                tuple(int(value) for value in frame.translation),
                frame.derivation,
                PINNED_FRAME_DIGESTS["3040"],
            ),
            (
                "F",
                "63ab72a4ff3b2d85b58af6586a1592124ab42019a84cb5faef137ee699836b28",
                "turn0",
                (0, 24, 0),
                EXACT,
                "65d6be01240cad2790e9fb54fabb056b99c232c26736b33b7340f8a85511a4bf",
            ),
        )
        self.assertEqual(NATIVE_RECORD_SHA256["3040"], frame.record_sha256)
        self.assertEqual(
            NATIVE_REVIEW_RECORD_SHA256["3040"],
            "17afd7907052b6e3e78343a6d26af45c81b7d277d80128b35e9f02c483905075",
        )

    def test_11253_report_retains_the_reviewed_stud_profile(self) -> None:
        row = measured_part_report_row(
            measured(plan=ADMITTED_PART_PLANS[15])
        )

        self.assertEqual(
            row["validatedConnectionStudProfile"], "nominal-stud-tube/1"
        )

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
