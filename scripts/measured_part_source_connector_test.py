"""Focused tests for carrying source-authored axle rows through measured tables."""

from __future__ import annotations

import unittest
from dataclasses import replace
from fractions import Fraction
from unittest.mock import Mock, patch

from ldcad_shadow_connectors import snap_instances
from ldcad_shadow_metas import parse_shadow_metas
from measured_part_tables import measured_part_report_row, scoreable_candidate
from measured_part_test_support import measured, plan
from measured_source_connectors import source_connectors_for

AXLE_HOLE_META = (
    "0 LDCad shadow info for synthetic axle hole\n"
    "0 Author: Repository Test\n"
    "0 !LICENSE CC BY-SA 4.0, see LICENSE.md\n\n"
    "0 !LDCAD SNAP_CYL [id=axleHole] [pos=0 2 0] [secs=A 6 1] [scale=YOnly] "
    "[slide=true] [caps=none] [gender=F]\n"
)
AXLE_HOLE_CLOSURE = ["p/axlehol5.dat", "p/stud2.dat", "parts/32064a.dat"]


def composed_axle_hole():
    meta = parse_shadow_metas(AXLE_HOLE_META, "p/axlehol5.dat")[0]
    source = snap_instances(meta)[0]
    return source.transformed(
        (
            Fraction(0),
            Fraction(0),
            Fraction(1),
            Fraction(-1),
            Fraction(0),
            Fraction(0),
            Fraction(0),
            Fraction(-20),
            Fraction(0),
        ),
        (Fraction(0), Fraction(10), Fraction(30)),
    )


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

    def test_axle_hole_projection_is_bound_to_32064as_exact_composed_route(self) -> None:
        snap = composed_axle_hole()
        expected = [("axleHole", [0.0, 10.0, 0.0], [0.0, 0.0, 1.0])]

        self.assertEqual(source_connectors_for("32064", [snap], AXLE_HOLE_CLOSURE), expected)
        self.assertEqual(source_connectors_for("32064a", [snap], AXLE_HOLE_CLOSURE), expected)
        with self.assertRaisesRegex(ValueError, "shadow closure"):
            source_connectors_for("32064", [snap], ["p/axlehol5.dat"])
        with self.assertRaisesRegex(ValueError, "p/axlehol5.dat A6x1 YOnly"):
            source_connectors_for(
                "32064",
                [replace(snap, source_path="p/wrong.dat")],
                AXLE_HOLE_CLOSURE,
            )
        for modifiers in ((None, None), ("YOnly", "cor")):
            with self.subTest(modifiers=modifiers):
                with self.assertRaisesRegex(ValueError, "A6x1 YOnly"):
                    source_connectors_for(
                        "32064",
                        [replace(snap, transform_modifiers=modifiers)],
                        AXLE_HOLE_CLOSURE,
                    )
        with self.assertRaisesRegex(ValueError, "admitted only for design 32064/32064a"):
            source_connectors_for("other", [snap], AXLE_HOLE_CLOSURE)

    def test_duplicate_axle_hole_declarations_cannot_hide_behind_one_midpoint(self) -> None:
        snap = composed_axle_hole()

        with self.assertRaisesRegex(ValueError, "measured 2 declarations"):
            source_connectors_for("32064", [snap, snap], AXLE_HOLE_CLOSURE)

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

    def test_report_names_axle_hole_as_an_unscored_source_connector_kind(self) -> None:
        row = measured_part_report_row(
            measured(
                source_connectors_ldu=(
                    ("axleHole", (0.0, -2.0, 0.0), (1.0, 0.0, 0.0)),
                )
            )
        )

        self.assertEqual(row["sourceConnectors"], 1)
        self.assertEqual(row["sourceConnectorKinds"], ["axleHole"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
