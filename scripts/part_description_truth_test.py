"""Focused truth-locality and input-closure tests for description scoring."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from part_description_truth import builder_export_truth, pair_judged_truth
from part_identification_report_contract import (
    ArtifactContractError,
    read_card_images_artifact,
    read_json_artifact,
    require_score_summary_chain,
    require_truth_v3,
)
from part_identification_report_contract_test_fixture import (
    materialize_report_contract_fixture,
    report_contract_test_verifier_patch,
)


_TEST_VERIFIER_PATCH = None


def setUpModule() -> None:
    global _TEST_VERIFIER_PATCH
    _TEST_VERIFIER_PATCH = report_contract_test_verifier_patch()
    _TEST_VERIFIER_PATCH.start()


def tearDownModule() -> None:
    if _TEST_VERIFIER_PATCH is not None:
        _TEST_VERIFIER_PATCH.stop()


def sha(character: str) -> str:
    return "sha256:" + character * 64


class PairJudgedTruthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.lead_sha = "sha256:" + "a" * 16 + "b" * 48
        self.member_sha = "sha256:" + "c" * 64
        self.features = {
            "callouts": [
                {"file": "lead.png", "sha256": self.lead_sha},
                {"file": "member.png", "sha256": self.member_sha},
            ]
        }
        self.match = {
            "clusters": [
                {"clusterIndex": 0, "lead": "lead.png", "members": [0, 1]}
            ]
        }

    @staticmethod
    def truth(crop: str, *, same: bool = True) -> dict:
        return {
            "schemaVersion": "lego.part-identification-truth/3",
            "lastStep": 1,
            "pairsJudged": 1,
            "pairsUnjudgeable": 0,
            "verdicts": [
                {
                    "n": 1,
                    "judgedCropSha256": crop,
                    "elementId": "1234",
                    "same": same,
                    "note": "",
                }
            ],
            "unjudgeable": [],
        }

    def test_exact_full_lead_crop_can_grade_its_description(self) -> None:
        same, different, unmapped, caveats = pair_judged_truth(
            self.truth(self.lead_sha), self.features, self.match
        )
        self.assertEqual(same, {0: "1234"})
        self.assertEqual(different, {})
        self.assertEqual(unmapped, [])
        self.assertEqual(caveats, {})

    def test_same_prefix_different_suffix_is_not_a_crop_match(self) -> None:
        hostile = "sha256:" + "a" * 16 + "d" * 48
        same, different, unmapped, _ = pair_judged_truth(
            self.truth(hostile), self.features, self.match
        )
        self.assertEqual(same, {})
        self.assertEqual(different, {})
        self.assertEqual(len(unmapped), 1)
        self.assertIn("0 distinct current card leads", unmapped[0])

    def test_non_lead_member_truth_never_propagates_to_the_cluster_answer(self) -> None:
        same, different, unmapped, _ = pair_judged_truth(
            self.truth(self.member_sha, same=False), self.features, self.match
        )
        self.assertEqual(same, {})
        self.assertEqual(different, {})
        self.assertEqual(len(unmapped), 1)
        self.assertIn("0 distinct current card leads", unmapped[0])

    def test_identical_nonlead_copy_does_not_make_one_lead_ambiguous(self) -> None:
        self.features["callouts"][1]["sha256"] = self.lead_sha
        same, different, unmapped, _ = pair_judged_truth(
            self.truth(self.lead_sha), self.features, self.match
        )
        self.assertEqual(same, {0: "1234"})
        self.assertEqual(different, {})
        self.assertEqual(unmapped, [])

    def test_identical_crops_that_are_two_card_leads_are_ambiguous(self) -> None:
        self.features["callouts"][1]["sha256"] = self.lead_sha
        self.match["clusters"] = [
            {"clusterIndex": 0, "lead": "lead.png", "members": [0]},
            {"clusterIndex": 1, "lead": "member.png", "members": [1]},
        ]
        same, different, unmapped, _ = pair_judged_truth(
            self.truth(self.lead_sha), self.features, self.match
        )
        self.assertEqual(same, {})
        self.assertEqual(different, {})
        self.assertIn("2 distinct current card leads", unmapped[0])

    def test_truth_v2_is_refused_instead_of_silently_reinterpreted(self) -> None:
        truth = self.truth(self.lead_sha)
        truth["schemaVersion"] = "lego.part-identification-truth/2"
        with self.assertRaisesRegex(ArtifactContractError, "truth/3"):
            pair_judged_truth(truth, self.features, self.match)


class BuilderExportTruthTests(unittest.TestCase):
    OFFICIAL = (
        "<LXFML><Bricks>"
        '<Brick designID="3001;A" itemNos="1001" uuid="accepted">'
        '<Part materials="26:0" /></Brick>'
        '<Brick designID="3002;B" itemNos="1002" uuid="refused">'
        '<Part materials="21:0" /></Brick>'
        '<Brick designID="3003;C" itemNos="1003" uuid="conflict">'
        '<Part materials="194:0" /></Brick>'
        "</Bricks></LXFML>"
    )

    def test_only_direct_accepted_action_pieces_become_positive_truth(self) -> None:
        ledger = {
            "steps": [
                {
                    "stepNumber": 4,
                    "action": {
                        "pieces": [
                            {"calloutKey": "accepted-callout", "brickRef": "accepted"}
                        ]
                    },
                }
            ],
            "provenance": {
                "refusals": [
                    {
                        "calloutKey": "refused-callout",
                        "brickRef": "refused",
                        "reason": "unanswered identification is not trusted",
                    }
                ]
            },
        }
        truth, unmapped = builder_export_truth(
            ledger,
            self.OFFICIAL,
            {"accepted-callout": 7, "refused-callout": 8},
        )
        self.assertEqual(truth, {7: ("1001", "3001")})
        self.assertEqual(unmapped, [])

    def test_conflicting_accepted_pieces_cannot_overwrite_cluster_truth(self) -> None:
        ledger = {
            "steps": [
                {
                    "stepNumber": 4,
                    "action": {
                        "pieces": [
                            {"calloutKey": "first-callout", "brickRef": "accepted"}
                        ]
                    },
                },
                {
                    "stepNumber": 9,
                    "action": {
                        "pieces": [
                            {"calloutKey": "second-callout", "brickRef": "conflict"}
                        ]
                    },
                },
            ],
            "provenance": {"refusals": []},
        }
        with self.assertRaisesRegex(
            ValueError,
            "cluster 7.*step 4 callout 'first-callout'.*Brick 'accepted'.*1001.*"
            "step 9 callout 'second-callout'.*Brick 'conflict'.*1003.*file order cannot choose",
        ):
            builder_export_truth(
                ledger,
                self.OFFICIAL,
                {"first-callout": 7, "second-callout": 7},
            )

    def test_attribute_reordering_cannot_hide_one_unambiguous_element(self) -> None:
        ledger = {
            "steps": [
                {
                    "stepNumber": 4,
                    "action": {
                        "pieces": [
                            {"calloutKey": "accepted-callout", "brickRef": "accepted"}
                        ]
                    },
                }
            ],
            "provenance": {"refusals": []},
        }
        xml = (
            "<LXFML><Bricks>"
            '<Brick uuid="accepted" itemNos="1001" designID="3001;A">'
            '<Part materials="26:0" /></Brick>'
            "</Bricks></LXFML>"
        )
        truth, unmapped = builder_export_truth(
            ledger, xml, {"accepted-callout": 7}
        )
        self.assertEqual(truth, {7: ("1001", "3001")})
        self.assertEqual(unmapped, [])

    def test_multiple_official_item_numbers_are_not_joined_or_chosen(self) -> None:
        ledger = {
            "steps": [
                {
                    "stepNumber": 4,
                    "action": {
                        "pieces": [
                            {"calloutKey": "accepted-callout", "brickRef": "accepted"}
                        ]
                    },
                }
            ],
            "provenance": {"refusals": []},
        }
        xml = (
            "<LXFML><Bricks>"
            '<Brick itemNos="1001,1002" uuid="accepted" designID="3001;A">'
            '<Part materials="26:0" /></Brick>'
            "</Bricks></LXFML>"
        )
        with self.assertRaisesRegex(
            ValueError,
            "step 4.*accepted-callout.*accepted.*1001.*1002.*exactly one element identity",
        ):
            builder_export_truth(ledger, xml, {"accepted-callout": 7})

    def test_an_accepted_live_callout_cannot_name_an_absent_official_brick(self) -> None:
        ledger = {
            "steps": [
                {
                    "stepNumber": 4,
                    "action": {
                        "pieces": [
                            {"calloutKey": "accepted-callout", "brickRef": "missing"}
                        ]
                    },
                }
            ],
            "provenance": {"refusals": []},
        }
        with self.assertRaisesRegex(
            ValueError,
            "step 4.*accepted-callout.*Brick 'missing'.*absent.*reconciled ledger/model",
        ):
            builder_export_truth(
                ledger, self.OFFICIAL, {"accepted-callout": 7}
            )


class TruthStructureContractTests(unittest.TestCase):
    TRACKED_TRUTH = Path(__file__).resolve().parent / "fixtures/part-identification-truth-first50.json"

    @staticmethod
    def empty_truth() -> dict:
        return {
            "schemaVersion": "lego.part-identification-truth/3",
            "lastStep": 1,
            "pairsJudged": 0,
            "pairsUnjudgeable": 0,
            "verdicts": [],
            "unjudgeable": [],
        }

    def test_total_rows_are_bounded_before_row_validation(self) -> None:
        truth = self.empty_truth()
        truth["verdicts"] = [{}] * 4_001
        truth["pairsJudged"] = 4_001
        with self.assertRaisesRegex(ArtifactContractError, "bounded maximum"):
            require_truth_v3(truth)

    def test_last_step_is_a_bounded_printed_step(self) -> None:
        truth = self.empty_truth()
        truth["lastStep"] = 360
        with self.assertRaisesRegex(ArtifactContractError, "1 through 359"):
            require_truth_v3(truth)

    def test_ordinals_must_cover_every_pair_sheet_row(self) -> None:
        truth = self.empty_truth()
        truth.update(
            {
                "pairsJudged": 1,
                "verdicts": [
                    {
                        "n": 2,
                        "judgedCropSha256": sha("a"),
                        "elementId": "1234",
                        "same": True,
                    }
                ],
            }
        )
        with self.assertRaisesRegex(ArtifactContractError, "cover 1 through 1"):
            require_truth_v3(truth)

    def test_unjudgeable_rows_keep_bounded_reason_and_positive_counts(self) -> None:
        truth = self.empty_truth()
        truth.update(
            {
                "pairsUnjudgeable": 1,
                "unjudgeable": [
                    {
                        "n": 1,
                        "judgedCropSha256": sha("a"),
                        "elementId": None,
                        "reason": "blank candidate",
                        "callouts": 0,
                        "pieces": 1,
                    }
                ],
            }
        )
        with self.assertRaisesRegex(ArtifactContractError, "callout/piece counts"):
            require_truth_v3(truth)

    def test_detached_fields_are_refused_at_every_truth_shape(self) -> None:
        verdict = {
            "n": 1,
            "judgedCropSha256": sha("a"),
            "elementId": "1234",
            "same": True,
        }
        unjudgeable = {
            "n": 1,
            "judgedCropSha256": sha("a"),
            "elementId": None,
            "reason": "blank candidate",
            "callouts": 1,
            "pieces": 1,
        }
        cases = []
        top = self.empty_truth()
        top["detached"] = "authority"
        cases.append(top)
        judged = self.empty_truth()
        judged.update({"pairsJudged": 1, "verdicts": [{**verdict, "detached": True}]})
        cases.append(judged)
        blank = self.empty_truth()
        blank.update(
            {"pairsUnjudgeable": 1, "unjudgeable": [{**unjudgeable, "detached": True}]}
        )
        cases.append(blank)
        for truth in cases:
            with self.subTest(keys=sorted(truth)):
                with self.assertRaisesRegex(ArtifactContractError, "unsupported|exactly"):
                    require_truth_v3(truth)

    def test_the_actual_tracked_truth_v3_fixture_is_accepted(self) -> None:
        truth = json.loads(self.TRACKED_TRUTH.read_text(encoding="utf-8"))
        self.assertEqual(
            sum("raterConfidence" in verdict for verdict in truth["verdicts"]), 8
        )
        require_truth_v3(truth)

    def test_rater_confidence_has_exact_raters_and_bounded_levels(self) -> None:
        truth = self.empty_truth()
        truth.update(
            {
                "pairsJudged": 1,
                "verdicts": [
                    {
                        "n": 1,
                        "judgedCropSha256": sha("a"),
                        "elementId": "1234",
                        "same": True,
                        "raterConfidence": {"primary": "high", "secondary": "certain"},
                    }
                ],
            }
        )
        with self.assertRaisesRegex(ArtifactContractError, "low, medium, or high"):
            require_truth_v3(truth)

    def test_top_level_source_assignment_and_rater_metadata_are_bounded(self) -> None:
        tracked = json.loads(self.TRACKED_TRUTH.read_text(encoding="utf-8"))
        cases = []
        invalid_source = json.loads(json.dumps(tracked))
        invalid_source["source"] = "self-certifying-model"
        cases.append(invalid_source)
        invalid_assignment = json.loads(json.dumps(tracked))
        invalid_assignment["assignment"] = "invented"
        cases.append(invalid_assignment)
        detached_rater_field = json.loads(json.dumps(tracked))
        detached_rater_field["raters"]["authority"] = True
        cases.append(detached_rater_field)
        for truth in cases:
            with self.subTest(source=truth.get("source"), assignment=truth.get("assignment")):
                with self.assertRaises(ArtifactContractError):
                    require_truth_v3(truth)

    def test_rater_metadata_matches_the_cross_runtime_truth_contract(self) -> None:
        tracked = json.loads(self.TRACKED_TRUTH.read_text(encoding="utf-8"))
        cases = []
        same_rater = json.loads(json.dumps(tracked))
        same_rater["raters"]["secondary"] = same_rater["raters"]["primary"]
        cases.append(same_rater)
        partial_agreement = json.loads(json.dumps(tracked))
        partial_agreement["raters"]["agreement"] = "83/83"
        cases.append(partial_agreement)
        unsorted_adjudication = json.loads(json.dumps(tracked))
        unsorted_adjudication["raters"]["descriptionDivergenceAdjudicated"] = [38, 34]
        cases.append(unsorted_adjudication)
        empty_note = json.loads(json.dumps(tracked))
        empty_note["raters"]["adjudicationNote"] = ""
        cases.append(empty_note)
        long_name = json.loads(json.dumps(tracked))
        long_name["raters"]["primary"] = "r" * 201
        cases.append(long_name)
        for truth in cases:
            with self.subTest(raters=truth["raters"]):
                with self.assertRaisesRegex(ArtifactContractError, "Truth/3 raters"):
                    require_truth_v3(truth)


class ScoreSummaryContractTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        materialize_report_contract_fixture(root)
        paths = {
            "features": root / "output/part-identification/features.json",
            "match": root / "output/part-identification/match.json",
            "distances": root / "output/part-identification/distances.json",
            "elementResolution": root
            / "output/part-identification/element-resolution.json",
            "truthFirstFifty": root
            / "scripts/fixtures/part-identification-truth-first50.json",
            "cards": root / "output/part-identification/cards/manifest.json",
            "answers": root
            / "output/part-identification/answers-claude-opus-5.json",
            "inventoryLabels": root / "output/inventory-thumbnails/labels.json",
            "score": root / "output/part-identification/score.json",
        }
        artifacts = {
            role: read_json_artifact(path, f"Score fixture {role}")
            for role, path in paths.items()
        }
        self.digests = {role: artifact[1] for role, artifact in artifacts.items()}
        _, self.digests["cardImages"] = read_card_images_artifact(
            paths["cards"].parent, artifacts["cards"][0]
        )
        self.summary = artifacts["score"][0]

    def test_summary_and_nested_score_from_one_closure_are_accepted(self) -> None:
        require_score_summary_chain(self.summary, digests=self.digests)

    def test_top_level_individual_score_is_not_mistaken_for_a_summary(self) -> None:
        self.summary["schemaVersion"] = "lego.part-identification-score/2"
        with self.assertRaisesRegex(ArtifactContractError, "score-summary/2"):
            require_score_summary_chain(self.summary, digests=self.digests)

    def test_headline_shared_digest_must_equal_summary_shared_digest(self) -> None:
        self.summary["headline"]["inputDigests"]["match"] = sha("9")
        with self.assertRaisesRegex(ArtifactContractError, "headline binds match"):
            require_score_summary_chain(self.summary, digests=self.digests)

    def test_each_variant_keeps_the_summary_shared_generation(self) -> None:
        self.summary["variants"][0]["inputDigests"]["distances"] = sha("9")
        with self.assertRaisesRegex(ArtifactContractError, "variant 0 binds shared distances"):
            require_score_summary_chain(self.summary, digests=self.digests)

    def test_headline_cards_and_answers_bind_the_bytes_read_by_the_report(self) -> None:
        self.summary["headline"]["inputDigests"]["cards"] = sha("9")
        with self.assertRaisesRegex(ArtifactContractError, "headline binds cards"):
            require_score_summary_chain(self.summary, digests=self.digests)

    def test_headline_card_images_bind_the_exact_retained_bundle(self) -> None:
        self.summary["headline"]["inputDigests"]["cardImages"] = sha("9")
        with self.assertRaisesRegex(ArtifactContractError, "headline binds cardImages"):
            require_score_summary_chain(self.summary, digests=self.digests)

    def test_shared_inventory_labels_bind_the_exact_retained_bytes(self) -> None:
        self.digests["inventoryLabels"] = sha("9")
        with self.assertRaisesRegex(ArtifactContractError, "summary binds inventoryLabels"):
            require_score_summary_chain(self.summary, digests=self.digests)


if __name__ == "__main__":
    unittest.main()
