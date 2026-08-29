from __future__ import annotations

import ast
import math
import runpy
import unittest
from pathlib import Path

from part_admission_contract import (
    CANDIDATE_FRAME,
    CANDIDATE_SCHEMA_VERSION,
    Vector3,
    validate_candidate,
)
from part_admission_geometry import sample_triangle, triangle_sampling_plan
from part_admission_scorecard import score_candidate
from part_admission_surface import BODY_ROLE, MeasuredSurface


def candidate_document(bodies: list[dict[str, object]]) -> dict[str, object]:
    return {
        "schemaVersion": CANDIDATE_SCHEMA_VERSION,
        "designId": "test",
        "frame": CANDIDATE_FRAME,
        "derivation": "sampling diagnostics unit test",
        "bodies": bodies,
        "connectors": [],
    }


def box_body(minimum: Vector3, maximum: Vector3) -> dict[str, object]:
    return {"kind": "box", "tag": "body", "minLdu": list(minimum), "maxLdu": list(maximum)}


class SamplingPlanTests(unittest.TestCase):
    def test_sample_triangle_respects_and_reports_an_uncapped_requested_spacing(self) -> None:
        triangle = ((0.0, 0.0, 0.0), (3.0, 0.0, 0.0), (0.0, 0.0, 4.0))
        plan = triangle_sampling_plan(triangle, 1.0)
        points = list(sample_triangle(triangle, 1.0))

        self.assertEqual(plan.steps, 5)
        self.assertEqual(plan.effective_spacing_ldu, 1.0)
        self.assertFalse(plan.was_capped)
        self.assertEqual(len(points), 21)
        for point in points:
            self.assertTrue(
                any(math.dist(point, other) <= 1.0 for other in points if other != point)
            )

    def test_sample_triangle_refuses_nonpositive_and_nonfinite_spacing(self) -> None:
        triangle = ((0.0, 0.0, 0.0), (3.0, 0.0, 0.0), (0.0, 0.0, 4.0))

        for spacing in (0.0, -0.25, math.nan, math.inf, -math.inf):
            with self.subTest(spacing=spacing), self.assertRaisesRegex(
                ValueError, "finite number greater than 0 LDU"
            ):
                list(sample_triangle(triangle, spacing))

    def test_finite_subnormal_spacing_reaches_the_cap_without_overflow(self) -> None:
        triangle = ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0))

        plan = triangle_sampling_plan(triangle, 5e-324)

        self.assertEqual(plan.steps, 256)
        self.assertEqual(plan.effective_spacing_ldu, math.sqrt(2.0) / 256)
        self.assertTrue(plan.was_capped)

    def test_containment_reports_the_effective_spacing_when_the_grid_is_capped(self) -> None:
        surface = MeasuredSurface(
            design_id="test",
            triangles=(((0.0, 0.0, 0.0), (60.0, 0.0, 0.0), (0.0, 0.0, 80.0)),),
            roles=(BODY_ROLE,),
        )
        candidate = validate_candidate(
            candidate_document([box_body((0.0, -1.0, 0.0), (60.0, 1.0, 80.0))])
        )

        legacy = score_candidate(candidate, surface, 0.25)["collisionContainment"]
        containment = score_candidate(
            candidate, surface, 0.25, include_sampling_diagnostics=True
        )["collisionContainment"]

        self.assertEqual(
            set(legacy),  # type: ignore[arg-type]
            {
                "sampleSpacingLdu",
                "containmentEpsilonLdu",
                "pointsSampled",
                "pointsOutside",
                "pointsSampledByRole",
                "pointsOutsideByRole",
                "maximumEscapeLowerBoundLdu",
                "worstEscapes",
            },
        )
        self.assertEqual(
            set(containment) - set(legacy),  # type: ignore[arg-type]
            {
                "requestedSampleSpacingLdu",
                "maximumEffectiveSampleSpacingLdu",
                "maximumTriangleSubdivisions",
                "trianglesCappedBySubdivisionLimit",
            },
        )
        self.assertEqual(containment["sampleSpacingLdu"], 0.25)  # type: ignore[index]
        self.assertEqual(containment["requestedSampleSpacingLdu"], 0.25)  # type: ignore[index]
        self.assertEqual(
            containment["maximumEffectiveSampleSpacingLdu"],  # type: ignore[index]
            0.390625,
        )
        self.assertEqual(containment["maximumTriangleSubdivisions"], 256)  # type: ignore[index]
        self.assertEqual(containment["trianglesCappedBySubdivisionLimit"], 1)  # type: ignore[index]
        self.assertEqual(containment["pointsSampled"], 33_153)  # type: ignore[index]

    def test_generic_score_cli_versions_and_routes_every_row_through_diagnostics(self) -> None:
        script = Path(__file__).with_name("score-part-admission.py")
        module = runpy.run_path(str(script), run_name="score_part_admission_under_test")
        surface = MeasuredSurface(
            design_id="test",
            triangles=(((0.0, 0.0, 0.0), (60.0, 0.0, 0.0), (0.0, 0.0, 80.0)),),
            roles=(BODY_ROLE,),
        )
        score_report_candidate = module["score_report_candidate"]

        self.assertEqual(module["SCORECARD_SCHEMA_VERSION"], "lego.part-admission-scorecard/2")
        scorecard = score_report_candidate(  # type: ignore[operator]
            candidate_document([box_body((0.0, -1.0, 0.0), (60.0, 1.0, 80.0))]),
            surface,
            0.25,
        )
        containment = scorecard["collisionContainment"]
        self.assertEqual(containment["requestedSampleSpacingLdu"], 0.25)  # type: ignore[index]
        self.assertEqual(containment["maximumEffectiveSampleSpacingLdu"], 0.390625)  # type: ignore[index]
        self.assertEqual(containment["trianglesCappedBySubdivisionLimit"], 1)  # type: ignore[index]

        function_call_counts: dict[str, dict[str, int]] = {}
        for node in ast.parse(script.read_text(encoding="utf-8")).body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            function_call_counts[node.name] = {
                name: sum(
                    1
                    for descendant in ast.walk(node)
                    if isinstance(descendant, ast.Call)
                    and isinstance(descendant.func, ast.Name)
                    and descendant.func.id == name
                )
                for name in ("score_candidate", "score_report_candidate")
            }
        self.assertEqual(function_call_counts["score_report_candidate"]["score_candidate"], 1)
        self.assertEqual(function_call_counts["main"]["score_candidate"], 0)
        self.assertEqual(function_call_counts["main"]["score_report_candidate"], 2)


if __name__ == "__main__":
    unittest.main()
