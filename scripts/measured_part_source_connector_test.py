"""Focused tests for carrying source-authored axle rows through measured tables."""

from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from measured_part_tables import measured_part_report_row, scoreable_candidate
from measured_part_test_support import measured, plan
from measured_source_connectors import source_connectors_for


class MeasuredSourceConnectorTests(unittest.TestCase):
    def test_axle_projection_is_bound_exclusively_to_4519s_direct_shadow(self) -> None:
        rows = [
            {"kind": "axle", "positionLdu": [x, 0.0, 0.0], "normal": [1.0, 0.0, 0.0]}
            for x in (-20.0, 0.0, 20.0)
        ]
        eligible = Mock(is_axle_shaft=True, source_path="parts/4519.dat")
        with patch("measured_source_connectors.emit_axle_connectors", return_value=rows):
            self.assertEqual(
                len(source_connectors_for("4519", [eligible], ["parts/4519.dat"])),
                3,
            )
            with self.assertRaisesRegex(ValueError, "only parts/4519.dat in the composed"):
                source_connectors_for("4519", [eligible], ["parts/inherited.dat"])
            with self.assertRaisesRegex(ValueError, "admitted only for design 4519"):
                source_connectors_for("other", [eligible], ["parts/other.dat"])

    def test_duplicate_exact_declarations_cannot_hide_behind_deduplicated_seats(self) -> None:
        rows = [
            {"kind": "axle", "positionLdu": [x, 0.0, 0.0], "normal": [1.0, 0.0, 0.0]}
            for x in (-20.0, 0.0, 20.0)
        ]
        eligible = Mock(is_axle_shaft=True, source_path="parts/4519.dat")

        with patch("measured_source_connectors.emit_axle_connectors", return_value=rows):
            with self.assertRaisesRegex(ValueError, "measured 2 declarations"):
                source_connectors_for("4519", [eligible, eligible], ["parts/4519.dat"])

    def test_scoreable_candidate_restores_the_exact_source_local_axle_frame(self) -> None:
        part = measured(
            plan=plan(
                orientation_id="upright-yaw-90",
                translation_ldu=(10, 0, 20),
                connector_source="ldcad-shadow",
            ),
            clutches_ldu=(),
            source_connectors_ldu=(("axle", (10.0, 0.0, 40.0), (0.0, 0.0, 1.0)),),
            candidate={"connectors": [], "derivation": "unit source candidate"},
        )

        candidate = scoreable_candidate(part)

        self.assertEqual(
            candidate["connectors"],
            [
                {
                    "kind": "axle",
                    "gender": "male",
                    "positionLdu": [-20.0, 0.0, 0.0],
                    "normal": [-1.0, 0.0, 0.0],
                }
            ],
        )

    def test_report_names_the_unscored_source_connector_kind(self) -> None:
        row = measured_part_report_row(
            measured(
                source_connectors_ldu=(("axle", (-20.0, 0.0, 0.0), (-1.0, 0.0, 0.0)),)
            )
        )

        self.assertEqual(row["sourceConnectors"], 1)
        self.assertEqual(row["sourceConnectorKinds"], ["axle"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
