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
from measured_part_plan_test import PlanTests
from measured_part_source_connector_test import MeasuredSourceConnectorTests

__all__ = [
    "ExactBoundTests",
    "FrameTests",
    "MeasuredStudRowTests",
    "MeshMergeTests",
    "NumberLiteralTests",
    "PlanTests",
    "RenderTests",
    "MeasuredSourceConnectorTests",
]


class MeasuredPartFileBoundaryTests(unittest.TestCase):
    def test_refactored_python_modules_stay_below_500_physical_lines(self) -> None:
        scripts = Path(__file__).resolve().parent
        names = (
            "generate-set-6651557-source-pilot.py",
            "source_pilot_input_validation.py",
            "measured_part_emit.py",
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
