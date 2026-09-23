"""Contracts for stable identities on exact measured clutch seats."""

from __future__ import annotations

import unittest

from measured_part_emit import render_blueprints
from measured_part_test_support import (
    ARCHIVE_SHA256,
    BUILDER_RECORDS,
    SHADOW_IDENTITY,
    measured,
    plan,
)


class MeasuredClutchSemanticPlanTests(unittest.TestCase):
    def test_plan_refuses_ambiguous_or_malformed_stable_semantics(self) -> None:
        with self.assertRaisesRegex(ValueError, "unique exact seats"):
            plan(
                clutch_port_semantics=(
                    ((0, 4, 0), "undersideClutch:left", ()),
                    ((0, 4, 0), "undersideClutch:right", ()),
                )
            )
        with self.assertRaisesRegex(ValueError, "unique stable undersideClutch IDs"):
            plan(
                clutch_port_semantics=(
                    ((0, 4, -10), "undersideClutch:stable", ()),
                    ((0, 4, 10), "undersideClutch:stable", ()),
                )
            )
        for invalid_id in ("undersideClutch:", "stud:0", "undersideClutch:bad id"):
            with self.subTest(invalid_id=invalid_id), self.assertRaisesRegex(
                ValueError, "must match"
            ):
                plan(clutch_port_semantics=(((0, 4, 0), invalid_id, ()),))
        with self.assertRaisesRegex(ValueError, "whole-LDU integer positions"):
            plan(
                clutch_port_semantics=(
                    ((0, 4.5, 0), "undersideClutch:center", ()),  # type: ignore[arg-type]
                )
            )
        for groups in (("",), ("shared", "shared")):
            with self.subTest(groups=groups), self.assertRaisesRegex(
                ValueError, "non-empty unique text"
            ):
                plan(
                    clutch_port_semantics=(
                        ((0, 4, 0), "undersideClutch:center", groups),
                    )
                )

    def test_plan_refuses_two_owners_for_capacity_claims(self) -> None:
        with self.assertRaisesRegex(ValueError, "not both"):
            plan(
                clutch_port_semantics=(
                    ((0, 4, 0), "undersideClutch:center", ("shared",)),
                ),
                clutch_shared_capacity_groups=(((0, 4, 0), ("legacy",)),),
            )


class MeasuredClutchSemanticEmitterTests(unittest.TestCase):
    def test_emitter_binds_stable_ids_to_exact_positions_in_measured_order(self) -> None:
        semantics = (
            ((0, 4, 10), "undersideClutch:0:1", ("positive",)),
            ((0, 4, -10), "undersideClutch:0:0", ("negative",)),
            ((0, 4, 0), "undersideClutch:center", ("negative", "positive")),
        )
        rendered = render_blueprints(
            [
                measured(
                    plan=plan(clutch_port_semantics=semantics),
                    clutches_ldu=((0.0, 4.0, -10.0), (0.0, 4.0, 0.0), (0.0, 4.0, 10.0)),
                )
            ],
            ARCHIVE_SHA256,
            BUILDER_RECORDS,
            SHADOW_IDENTITY,
        )

        first = rendered.index('id: "undersideClutch:0:0"')
        center = rendered.index('id: "undersideClutch:center"')
        last = rendered.index('id: "undersideClutch:0:1"')
        self.assertLess(first, center)
        self.assertLess(center, last)
        self.assertIn("positionLdu: [0, 4, 0]", rendered)
        self.assertIn('sharedCapacityGroupIds: ["negative", "positive"]', rendered)
        self.assertNotIn("clutchSharedCapacityGroupIds", rendered)

    def test_emitter_requires_exact_measured_position_set_coverage(self) -> None:
        part = measured(
            plan=plan(
                clutch_port_semantics=(
                    ((0, 4, -10), "undersideClutch:0:0", ()),
                    ((0, 4, 0), "undersideClutch:center", ()),
                )
            ),
            clutches_ldu=((0.0, 4.0, -10.0), (0.0, 4.0, 10.0)),
        )

        with self.assertRaisesRegex(ValueError, "do not exactly match measured source seats"):
            render_blueprints(
                [part], ARCHIVE_SHA256, BUILDER_RECORDS, SHADOW_IDENTITY
            )

    def test_absent_semantics_leave_legacy_emission_shape_unchanged(self) -> None:
        ordinary = render_blueprints(
            [measured()], ARCHIVE_SHA256, BUILDER_RECORDS, SHADOW_IDENTITY
        )
        legacy_capacity = render_blueprints(
            [
                measured(
                    plan=plan(
                        clutch_shared_capacity_groups=(
                            ((0, 4, -10), ("legacy",)),
                        )
                    )
                )
            ],
            ARCHIVE_SHA256,
            BUILDER_RECORDS,
            SHADOW_IDENTITY,
        )

        self.assertIn("clutchesLdu: [[0, 4, -10]],", ordinary)
        self.assertNotIn("clutchPortSemantics", ordinary)
        self.assertIn('clutchSharedCapacityGroupIds: [["legacy"]],', legacy_capacity)
        self.assertNotIn("clutchPortSemantics", legacy_capacity)


if __name__ == "__main__":
    unittest.main(verbosity=2)
