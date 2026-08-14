"""Regression tests for generation-derived description-report prose."""

from __future__ import annotations

import unittest

from part_description_report_support import (
    builder_selection_bias_note,
    measurement_limits,
)


class DescriptionReportProseTests(unittest.TestCase):
    def test_measurement_limits_derive_accepted_steps_and_gaps(self) -> None:
        ledger = {
            "steps": [
                {"stepNumber": 1, "action": {"kind": "place-callouts", "pieces": [{}]}},
                {"stepNumber": 2, "action": {"kind": "transition"}},
                {"stepNumber": 3, "action": {"kind": "place-callouts", "pieces": []}},
                {"stepNumber": 4, "action": {"kind": "place-callouts", "pieces": [{}]}},
            ]
        }
        limits = measurement_limits(2, 9, ledger)
        self.assertEqual(limits["builderAcceptedPrintedSteps"], [1, 4])
        self.assertEqual(limits["builderAcceptedStepRanges"], "1 and 4")
        self.assertEqual(limits["builderStepsWithoutAcceptedPieces"], [2, 3])
        note = limits["unbiasedTruthCoversOnlyThePrintedPrefix"]
        self.assertIn("printed steps 1 and 4", note)
        self.assertIn("2 other retained step(s) (2-3)", note)
        self.assertNotIn("1-25", note)
        self.assertNotIn("step 13", note)

    def test_selection_bias_keeps_refusals_out_of_positive_truth(self) -> None:
        note = builder_selection_bias_note()
        self.assertIn("accepted action.pieces", note)
        self.assertIn("refusals remain counterevidence", note)
        self.assertNotIn("refused rows", note)


if __name__ == "__main__":
    unittest.main()
