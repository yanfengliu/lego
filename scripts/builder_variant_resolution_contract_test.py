from __future__ import annotations

import copy
import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))


def load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {filename}.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


CONTRACT = load(
    "builder_variant_resolution_contract", "builder_variant_resolution_contract.py"
)
load("identify_builder_3245_variant_report", "identify_builder_3245_variant_report.py")
ASSESS = load(
    "assess_builder_3245_variant_resolution",
    "assess_builder_3245_variant_resolution.py",
)


def rectangle_x(x: float):
    corners = ((x, 1.0, -4.0), (x, 7.0, -4.0), (x, 7.0, 4.0), (x, 1.0, 4.0))
    return ((corners[0], corners[1], corners[2]), (corners[0], corners[2], corners[3]))


def box():
    lo, hi = (-10.0, 0.0, -10.0), (10.0, 8.0, 10.0)
    p = [
        (x, y, z)
        for x in (lo[0], hi[0])
        for y in (lo[1], hi[1])
        for z in (lo[2], hi[2])
    ]
    quads = ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3))
    return tuple(
        triangle
        for a, b, c, d in quads
        for triangle in ((p[a], p[b], p[c]), (p[a], p[c], p[d]))
    )


def target_report_rows():
    matrices = (
        ("turn0", [25, 0, 0, 0, -25, 0, 0, 0, -25]),
        ("turn180", [-25, 0, 0, 0, -25, 0, 0, 0, 25]),
    )
    scores = {
        "parts/3245a.dat": (6.0, 5.0),
        "parts/3245b.dat": (3.0, 2.0),
        "parts/3245c.dat": (0.05, 0.04),
    }
    return {
        "geometry": {
            "candidateMeasurements": [
                {
                    "root": root,
                    "frames": [
                        {
                            "frame": {"name": name, "linearLdu": linear},
                            "pairwiseDiscriminativeSurface": [
                                {
                                    "against": "first",
                                    "candidatePointsFartherThanThresholdFromOther": 3,
                                    "distanceToBuilderShell": {"maximumLdu": pair[0]},
                                },
                                {
                                    "against": "second",
                                    "candidatePointsFartherThanThresholdFromOther": 4,
                                    "distanceToBuilderShell": {"maximumLdu": pair[1]},
                                },
                            ],
                        }
                        for name, linear in matrices
                    ],
                }
                for root, pair in scores.items()
            ]
        }
    }


class ProperFrameTests(unittest.TestCase):
    def test_registry_is_exact_complete_proper_group(self) -> None:
        registry = CONTRACT.proper_orientation_registry()
        self.assertEqual(len(registry), 24)
        self.assertTrue(all(CONTRACT.determinant(row) == 1 for row in registry.values()))
        self.assertNotIn((-1, 0, 0, 0, 1, 0, 0, 0, 1), registry.values())

    def test_target_reflection_is_refused(self) -> None:
        report = target_report_rows()
        report["geometry"]["candidateMeasurements"][0]["frames"][0]["frame"]["linearLdu"] = [
            -25,
            0,
            0,
            0,
            25,
            0,
            0,
            0,
            25,
        ]
        with self.assertRaisesRegex(ValueError, "determinant-positive"):
            ASSESS.score_target(report, thresholds())


class GeometryContractTests(unittest.TestCase):
    def test_control_roster_contains_no_target_data(self) -> None:
        tokens = "\n".join(
            token
            for control in CONTRACT.CONTROLS
            for token in (control.name, control.design_revision, *control.candidate_roots)
        )
        self.assertNotIn("3245", tokens)
        self.assertEqual(
            [control.expected for control in CONTRACT.CONTROLS].count("unresolved"), 2
        )

    def test_pairwise_witness_selects_correct_surface_independent_of_order_and_winding(self) -> None:
        outer = box()
        correct = (*outer, *rectangle_x(0.0))
        decoy = (*outer, *rectangle_x(4.0))
        first = CONTRACT.score_candidates(correct, {"correct": correct, "decoy": decoy})
        reversed_correct = tuple(tuple(reversed(triangle)) for triangle in reversed(correct))
        reversed_decoy = tuple(tuple(reversed(triangle)) for triangle in reversed(decoy))
        second = CONTRACT.score_candidates(
            reversed_correct, {"decoy": reversed_decoy, "correct": reversed_correct}
        )
        self.assertEqual(first["rawVerdict"], "correct")
        self.assertEqual(second["rawVerdict"], "correct")
        self.assertEqual(first["observedBestScoreLdu"], second["observedBestScoreLdu"])
        self.assertEqual(first["runnerUpGapLdu"], second["runnerUpGapLdu"])

    def test_exact_alias_is_unresolved(self) -> None:
        surface = (*box(), *rectangle_x(0.0))
        result = CONTRACT.score_candidates(surface, {"root": surface, "alias": copy.deepcopy(surface)})
        self.assertEqual(result["rawVerdict"], "unresolved")
        self.assertEqual(result["ambiguousPairs"], [["alias", "root"]])


def thresholds():
    return {
        "maximumAcceptedWitnessDistanceLdu": 10.5,
        "minimumRunnerUpGapLdu": 1.5,
        "minimumRunnerUpRatio": 2.0,
    }


class TargetAssessmentTests(unittest.TestCase):
    def test_frozen_thresholds_select_only_the_geometric_surface(self) -> None:
        result = ASSESS.score_target(target_report_rows(), thresholds())
        self.assertEqual(result["selectedRoot"], "parts/3245c.dat")
        self.assertEqual(result["state"], "selected-under-control-derived-geometry-contract")
        self.assertEqual(result["runnerUpGapLdu"], 2.95)
        self.assertEqual(result["runnerUpRatio"], 60.0)

    def test_frozen_thresholds_refuse_a_near_tie(self) -> None:
        report = target_report_rows()
        for candidate in report["geometry"]["candidateMeasurements"]:
            if candidate["root"] == "parts/3245b.dat":
                for frame in candidate["frames"]:
                    frame["pairwiseDiscriminativeSurface"][0]["distanceToBuilderShell"][
                        "maximumLdu"
                    ] = 0.06
                    frame["pairwiseDiscriminativeSurface"][1]["distanceToBuilderShell"][
                        "maximumLdu"
                    ] = 0.055
        result = ASSESS.score_target(report, thresholds())
        self.assertIsNone(result["selectedRoot"])
        self.assertEqual(result["state"], "unresolved")
        self.assertFalse(result["gates"]["absoluteMargin"])
        self.assertFalse(result["gates"]["ratioMargin"])


if __name__ == "__main__":
    unittest.main()
