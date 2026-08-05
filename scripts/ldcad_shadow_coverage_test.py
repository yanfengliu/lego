from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from ldcad_shadow_coverage import (
    BUILDER_FRAME_BYTES,
    BUILDER_FRAME_SHA256,
    compare_positions,
    compare_studs,
    grip_evidence,
    read_builder_frames,
    summarize_coverage,
)
from ldcad_shadow_connectors import snap_instances
from ldcad_shadow_source import VerifiedShadowLibrary

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
LIVE_OFFICIAL = Path(r"C:\tmp\ldraw-complete-2026-07.zip")
LIVE_UNOFFICIAL = Path(r"C:\tmp\ldraw-unofficial-2026-08-02.zip")
LIVE_SHADOW = Path(r"C:\tmp\ldcad-shadow-20260802")
LIVE_REPORT = REPOSITORY_ROOT / "output/real-build/set-6651557-ldcad-shadow.json"


def coverage_rows(*rows: dict[str, object]) -> list[dict[str, object]]:
    defaults = {
        "builderHasRecord": True,
        "shadowFilesInClosure": 1,
        "antiStudClutches": 0,
        "femaleCylindersNotAntiStud": 0,
    }
    return [defaults | row for row in rows]


class ComparisonTests(unittest.TestCase):
    def test_two_identical_clutch_sets_agree_at_zero_ldu(self) -> None:
        positions = [[-10.0, 8.0, 0.0], [10.0, 8.0, 0.0]]
        result = compare_positions(positions, list(positions))
        self.assertEqual(result["agreementState"], "identical-sets")
        self.assertEqual(result["agreeing"], 2)
        self.assertEqual(result["maximumErrorOnAgreeingLdu"], 0.0)
        self.assertEqual(result["onlyInLdcadLdu"], [])
        self.assertEqual(result["onlyInBuilderLdu"], [])

    def test_an_extra_cell_on_one_side_is_reported_not_absorbed(self) -> None:
        result = compare_positions(
            [[-10.0, 8.0, 0.0], [30.0, 8.0, 10.0]], [[-10.0, 8.0, 0.0]]
        )
        self.assertEqual(result["agreementState"], "sets-differ")
        self.assertEqual(result["agreeing"], 1)
        self.assertEqual(result["onlyInLdcadLdu"], [[30.0, 8.0, 10.0]])
        self.assertEqual(result["onlyInBuilderLdu"], [])

    def test_a_cell_one_lattice_step_away_is_a_disagreement_not_a_match(self) -> None:
        result = compare_positions([[-10.0, 8.0, 0.0]], [[10.0, 8.0, 0.0]])
        self.assertEqual(result["agreeing"], 0)
        self.assertEqual(result["onlyInLdcadLdu"], [[-10.0, 8.0, 0.0]])
        self.assertEqual(result["onlyInBuilderLdu"], [[10.0, 8.0, 0.0]])

    def test_a_source_with_no_claim_leaves_every_cell_of_the_other_unmatched(self) -> None:
        result = compare_positions([], [[0.0, 8.0, 0.0], [20.0, 8.0, 0.0]])
        self.assertEqual(result["agreeing"], 0)
        self.assertEqual(result["builderClutches"], 2)
        self.assertEqual(len(result["onlyInBuilderLdu"]), 2)  # type: ignore[arg-type]

    def test_the_stud_check_names_the_ldraw_primitives_it_measured_against(self) -> None:
        result = compare_studs(
            [{"positionLdu": [0.0, 0.0, 0.0]}], [(0.0, 0.0, 0.0)]
        )
        self.assertEqual(result["agreeing"], 1)
        self.assertEqual(result["truthSource"], "ldraw-visible-stud-primitive-components")


class GripEvidenceTests(unittest.TestCase):
    def test_a_tube_at_the_corner_of_the_cell_is_counted_as_backing_it(self) -> None:
        rows = grip_evidence(
            [{"positionLdu": [0.0, 8.0, 0.0]}], [(-10.0, 8.0, -10.0), (10.0, 8.0, 10.0)]
        )
        self.assertEqual(rows[0]["nearestTubeChebyshevXZLdu"], 10.0)
        self.assertEqual(rows[0]["tubesAtThisCellsCorners"], 2)

    def test_a_tube_a_whole_stud_pitch_away_backs_nothing(self) -> None:
        rows = grip_evidence([{"positionLdu": [30.0, 8.0, 10.0]}], [(0.0, 8.0, 0.0)])
        self.assertEqual(rows[0]["nearestTubeChebyshevXZLdu"], 30.0)
        self.assertEqual(rows[0]["tubesAtThisCellsCorners"], 0)

    def test_a_part_with_no_measured_tube_reports_that_rather_than_a_distance(self) -> None:
        rows = grip_evidence([{"positionLdu": [-10.0, 8.0, 0.0]}], [])
        self.assertIsNone(rows[0]["nearestTubeChebyshevXZLdu"])
        self.assertEqual(rows[0]["measuredTubes"], 0)


class CoverageSummaryTests(unittest.TestCase):
    def test_each_source_is_credited_separately_and_ldraw_contributes_nothing(self) -> None:
        rows = coverage_rows(
            {"designId": "both", "antiStudClutches": 4},
            {"designId": "builderOnly", "antiStudClutches": 0},
            {"designId": "ldcadOnly", "antiStudClutches": 8, "builderHasRecord": False},
            {"designId": "neither", "antiStudClutches": 0, "builderHasRecord": False},
        )
        summary = summarize_coverage(rows, {"both": 4, "builderOnly": 2})
        self.assertEqual(summary["requiredLeaves"], 4)
        self.assertEqual(summary["bothSources"], 1)
        self.assertEqual(summary["ldcadOnly"], ["ldcadOnly"])
        self.assertEqual(summary["builderOnly"], ["builderOnly"])
        self.assertEqual(summary["femaleUncoveredByEitherSource"], ["neither"])
        self.assertEqual(summary["ldrawFemaleContribution"], 0)

    def test_a_builder_record_with_no_clutch_node_is_not_counted_as_coverage(self) -> None:
        rows = coverage_rows({"designId": "recordButNoClaim", "antiStudClutches": 0})
        summary = summarize_coverage(rows, {"recordButNoClaim": 0})
        self.assertEqual(summary["builderRecords"], 1)
        self.assertEqual(summary["builderAuthorsAClutchClaim"], 0)
        self.assertEqual(summary["builderRecordsWithNoClutchClaim"], 1)
        self.assertEqual(summary["femaleUncoveredByEitherSource"], ["recordButNoClaim"])

    def test_an_uncovered_leaf_that_has_some_other_female_snap_is_distinguished(self) -> None:
        rows = coverage_rows(
            {"designId": "arm", "femaleCylindersNotAntiStud": 1, "builderHasRecord": False},
            {"designId": "bar", "builderHasRecord": False},
        )
        summary = summarize_coverage(rows, {})
        self.assertEqual(summary["femaleUncoveredCount"], 2)
        self.assertEqual(summary["uncoveredWithSomeOtherFemaleCylinder"], ["arm"])


class BuilderFramePinTests(unittest.TestCase):
    def test_a_builder_frame_report_that_is_not_the_pinned_one_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "frame.json"
            target.write_text(json.dumps({"schemaVersion": "x", "parts": []}), encoding="utf-8")
            with self.assertRaises(ValueError) as error:
                read_builder_frames(target)
            message = str(error.exception)
            self.assertIn(str(BUILDER_FRAME_BYTES), message)
            self.assertIn(BUILDER_FRAME_SHA256, message)
            self.assertIn("must not move it", message)


@unittest.skipUnless(
    LIVE_SHADOW.is_dir()
    and LIVE_OFFICIAL.is_file()
    and LIVE_UNOFFICIAL.is_file()
    and LIVE_REPORT.is_file(),
    "pinned local LDCad shadow library, LDraw archives or measurement report are not present",
)
class LiveMeasurementRegressionTests(unittest.TestCase):
    """The numbers this measurement established, pinned so a regression is loud.

    These are derived measurements, not source: no shadow-library text is
    committed, only the positions and counts the walk produces from it.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.report = json.loads(LIVE_REPORT.read_text(encoding="utf-8"))
        cls.parts = {str(row["designId"]): row for row in cls.report["pilotParts"]}

    def test_the_pinned_checkout_verifies_whole(self) -> None:
        library = VerifiedShadowLibrary(LIVE_SHADOW)
        self.assertEqual(library.file_count, 4_257)
        self.assertEqual(library.identity()["declaredLicense"], "CC-BY-SA-4.0")

    def test_every_file_in_the_pinned_library_parses_rather_than_only_the_ones_needed(self) -> None:
        """A reader that only survives the files it was written against is untested.

        The 121 required leaves touch a small part of the tree, so the arity of a
        grid clause and a self-agreeing repeated parameter both first appeared
        outside them — 52 files and one file respectively.
        """

        library = VerifiedShadowLibrary(LIVE_SHADOW)
        parsed = 0
        instances = 0
        anti_studs = 0
        refused: list[str] = []
        for path in sorted(library.shadow_paths()):
            try:
                for meta in library.read(path).metas:
                    if meta.command in ("SNAP_CYL", "SNAP_CLP", "SNAP_FGR", "SNAP_GEN"):
                        snaps = snap_instances(meta)
                        instances += len(snaps)
                        anti_studs += sum(1 for snap in snaps if snap.is_anti_stud)
                parsed += 1
            except ValueError as error:  # pragma: no cover - a refusal is the failure
                refused.append(f"{path}: {error}")
        self.assertEqual(refused[:3], [])
        self.assertEqual(parsed, 4_251)
        self.assertEqual(instances, 29_099)
        self.assertEqual(anti_studs, 18_024)

    def test_the_report_stays_measurement_only(self) -> None:
        authority = self.report["authority"]
        self.assertEqual(authority["state"], "measurement-only-not-catalog-admitted")
        for claim in (
            "partDefinitionsEmitted",
            "catalogVersionBumped",
            "catalogFrameClaimed",
            "connectorTruthClaimed",
            "collisionTruthClaimed",
            "builderFramePinsModified",
            "runtimeExposed",
        ):
            self.assertFalse(authority[claim], claim)

    def test_ldcad_rescues_30357_with_eight_clutches_on_its_own_stud_lattice(self) -> None:
        part = self.parts["30357"]
        self.assertEqual(
            [row["positionLdu"] for row in part["emittedClutches"]],
            [
                [0.0, 8.0, 0.0],
                [0.0, 8.0, 20.0],
                [0.0, 8.0, 40.0],
                [20.0, 8.0, 0.0],
                [20.0, 8.0, 20.0],
                [20.0, 8.0, 40.0],
                [40.0, 8.0, 0.0],
                [40.0, 8.0, 20.0],
            ],
        )
        self.assertEqual(part["builderComparison"]["state"], "builder-has-no-record-for-this-design")
        self.assertEqual(part["studValidation"]["agreeing"], 8)
        self.assertEqual(part["studValidation"]["maximumErrorOnAgreeingLdu"], 0.0)
        self.assertTrue(
            all(row["tubesAtThisCellsCorners"] > 0 for row in part["gripEvidence"]),
            "every 30357 clutch should have a measured tube at a corner of its own cell",
        )
        scorecard = {str(row["designId"]): row for row in self.report["connectorScorecards"]}["30357"]
        self.assertEqual(scorecard["hardFails"], [])
        self.assertEqual(scorecard["clutchRoom"]["declaredClutches"], 8)
        self.assertEqual(scorecard["clutchRoom"]["clutchesWithRoom"], 8)

    def test_ldcad_and_builder_agree_exactly_where_both_have_a_claim(self) -> None:
        for design_id in ("5092", "35480", "93273"):
            with self.subTest(design_id=design_id):
                comparison = self.parts[design_id]["builderComparison"]
                self.assertEqual(comparison["agreementState"], "identical-sets")
                self.assertEqual(comparison["maximumErrorOnAgreeingLdu"], 0.0)

    def test_the_two_disagreements_are_recorded_rather_than_smoothed(self) -> None:
        wing = self.parts["51739"]["builderComparison"]
        self.assertEqual(wing["agreeing"], 4)
        self.assertEqual(wing["onlyInLdcadLdu"], [[-30.0, 8.0, 10.0], [30.0, 8.0, 10.0]])
        self.assertEqual(wing["onlyInBuilderLdu"], [])
        slope = self.parts["77844"]["builderComparison"]
        self.assertEqual(slope["ldcadClutches"], 0)
        self.assertEqual(slope["builderClutches"], 5)
        self.assertEqual(slope["agreeing"], 0)

    def test_every_emitted_clutch_passes_the_clutch_room_probe(self) -> None:
        declared = 0
        with_room = 0
        for scorecard in self.report["connectorScorecards"]:
            declared += int(scorecard["clutchRoom"]["declaredClutches"])
            with_room += int(scorecard["clutchRoom"]["clutchesWithRoom"])
            self.assertEqual(scorecard["hardFails"], [], scorecard["designId"])
        self.assertEqual(declared, 21)
        self.assertEqual(with_room, 21)

    def test_the_coverage_over_the_required_leaves_is_the_measured_one(self) -> None:
        summary = self.report["coverageSummary"]
        self.assertEqual(summary["requiredLeaves"], 121)
        self.assertEqual(summary["withAnyShadowFileInClosure"], 112)
        self.assertEqual(summary["withAtLeastOneAntiStudClutch"], 55)
        self.assertEqual(summary["builderAuthorsAClutchClaim"], 84)
        self.assertEqual(summary["ldrawFemaleContribution"], 0)
        self.assertEqual(len(summary["ldcadOnly"]), 17)
        self.assertEqual(summary["femaleUncoveredCount"], 20)
        self.assertIn("30357", summary["ldcadOnly"])


if __name__ == "__main__":
    unittest.main()
