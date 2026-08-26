"""Run the complete archive-free measured-part table test suite directly.

The cohesive geometry, TypeScript-emission, and admission-plan cases live in
separate bounded modules. Importing their test classes here preserves the
original ``python -B scripts/measured_part_tables_test.py`` entrypoint and its
complete suite.
"""

from __future__ import annotations

import unittest
from pathlib import Path

from measured_part_emit_test import NumberLiteralTests, RenderTests
from measured_part_geometry_test import (
    ExactBoundTests,
    FrameTests,
    MeasuredStudRowTests,
    MeshMergeTests,
)
from measured_part_plan_catalog_contract_test import PlanCatalogContractTests
from measured_part_plan_test import PlanTests
from measured_part_source_connector_test import MeasuredSourceConnectorTests
from measured_part_tables import scoreable_candidate
from measured_part_test_support import measured, plan

__all__ = [
    "ExactBoundTests",
    "FrameTests",
    "MeasuredStudRowTests",
    "MeshMergeTests",
    "NumberLiteralTests",
    "PlanCatalogContractTests",
    "PlanTests",
    "RenderTests",
    "MeasuredSourceConnectorTests",
    "AxleHoleRoundTripTests",
]


class AxleHoleRoundTripTests(unittest.TestCase):
    def test_scoreable_candidate_restores_the_exact_source_local_axle_hole_frame(self) -> None:
        part = measured(
            plan=plan(
                orientation_id="upright-yaw-90",
                translation_ldu=(0, -12, 0),
                connector_source="ldcad-shadow",
            ),
            clutches_ldu=(),
            source_connectors_ldu=(("axleHole", (0.0, -2.0, 0.0), (1.0, 0.0, 0.0)),),
            candidate={"connectors": [], "derivation": "unit source candidate"},
        )

        candidate = scoreable_candidate(part)

        self.assertEqual(
            candidate["connectors"],
            [
                {
                    "kind": "axleHole",
                    "gender": "female",
                    "positionLdu": [0.0, 10.0, 0.0],
                    "normal": [0.0, 0.0, 1.0],
                }
            ],
        )

    def test_scoreable_candidate_inverts_a_non_upright_source_frame(self) -> None:
        part = measured(
            plan=plan(
                orientation_id="proper-m-p0000n0p0",
                translation_ldu=(5, -12, 7),
                connector_source="ldcad-shadow",
            ),
            clutches_ldu=(),
            source_connectors_ldu=(("axleHole", (8.0, -15.0, 5.0), (0.0, 0.0, 1.0)),),
            candidate={"connectors": [], "derivation": "unit source candidate"},
        )

        candidate = scoreable_candidate(part)

        self.assertEqual(
            candidate["connectors"],
            [
                {
                    "kind": "axleHole",
                    "gender": "female",
                    "positionLdu": [3.0, -2.0, 3.0],
                    "normal": [0.0, 1.0, 0.0],
                }
            ],
        )


class MeasuredPartFileBoundaryTests(unittest.TestCase):
    def test_refactored_python_modules_stay_below_500_physical_lines(self) -> None:
        scripts = Path(__file__).resolve().parent
        names = (
            "generate-set-6651557-source-pilot.py",
            "source_pilot_input_validation.py",
            "measured_part_emit.py",
            "measured_part_emit_headers.py",
            "measured_part_plan.py",
            "measured_part_plan_catalog_contract_test.py",
            "measured_part_render_only_plan.py",
            "measured_part_report_rows.py",
            "measured_part_typescript_literals.py",
            "measured_part_tables.py",
            "measured_part_geometry.py",
            "measured_part_tables_test.py",
            "measured_part_geometry_test.py",
            "measured_part_emit_test.py",
            "measured_part_plan_test.py",
            "measured_part_source_connector_test.py",
            "measured_source_connectors.py",
            "measured_part_test_support.py",
        )

        line_counts = {
            name: len((scripts / name).read_text(encoding="utf-8").splitlines())
            for name in names
        }
        self.assertEqual(
            {name: count for name, count in line_counts.items() if count >= 500},
            {},
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
