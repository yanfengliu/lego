"""Builder-specific measured-part admission-plan tests."""

from __future__ import annotations

import unittest

from builder_ldraw_frame_pins import EXACT, PINNED_FRAME_DIGESTS, PINNED_FRAMES
from builder_native_source import NATIVE_RECORD_SHA256, NATIVE_REVIEW_RECORD_SHA256
from measured_part_plan import ADMITTED_PART_PLANS


class BuilderPlanTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
