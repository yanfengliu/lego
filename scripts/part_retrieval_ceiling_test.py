"""Tests for the retrieval-ceiling measurement.

Two halves, following the depletion walk. The synthetic half always runs and
fixes the semantics: how a distance row is ranked and tie-broken, what recall at
k counts, how a blind verdict binds to a cluster, which source wins a
disagreement, and what a same-mould sibling comparison flags. The live half runs
only when the retained identification chain is present *and* still hashes to the
digests these numbers were measured from, so a republished chain skips with a
message naming the drift rather than passing stale numbers.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from part_action_ledger_official_contract_test import (  # noqa: F401
    OfficialBrickContractTests,
)
from part_action_ledger_report_contract_test import (  # noqa: F401
    ActionLedgerReportContractTests,
)
from part_identification_descriptor_contract_test import (  # noqa: F401
    DescriptorDiagnosticTests,
)
from part_retrieval_ceiling import (
    DISPLAYED_K,
    REPOSITORY_ROOT,
    TruthRecord,
    builder_truth,
    design_level_records,
    digest_of,
    distance_terms,
    lead_truth_per_cluster,
    lead_diagnostic_truth,
    load_json,
    merge_truth,
    official_bricks,
    pair_judged_truth,
    rank_lookup,
    ranked_order,
    recall_at,
    require_retrieval_comparison_budget,
    shape_distance,
    weighted_total,
)
from part_retrieval_ceiling_causes import (
    attribute_misses,
    sibling_outliers,
    triangulate_defect_side,
)
from part_retrieval_ceiling_report import (
    REPORT_SCHEMA_VERSION,
    verified_vision_confound,
    verified_rank_rows,
)

# The generation every live number below was measured against.
PINNED = {
    "output/part-identification/features.json": "sha256:2d687f879f9d9b8ca2ec6a2ae98e56179de54a86ddc1fa715f0114508388506f",
    "output/part-identification/match.json": "sha256:ed0f5102f0759da1b17b3b1cda2873f0fcc25e3ba53d4eb90971666c3a968fda",
    "output/part-identification/distances.json": "sha256:c9b706b5e1f75bb29100663baaa89b04cea197da50cd3e4581e687cb26b16dca",
    "output/part-identification/element-resolution.json": "sha256:9fb2abe8f764f3381135b378c7940f63b69a77ed0f6db8a8f28ba2d8224b3a30",
    "output/real-build/action-ledger.json": "sha256:872826151c5f4dd57de1b16cce1fc70849d933323e948f7904bb6b1077f7879d",
    "output/official-model/vx1087034_21066_a.xml": "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
    "scripts/fixtures/part-identification-truth-first50.json": "sha256:639e99ce1bf1785f1f99c9c696ddb4d678946f40b385b7e40547e87d7ece5445",
}


class ReportSchemaTests(unittest.TestCase):
    def test_member_local_truth_report_uses_schema_v2(self) -> None:
        self.assertEqual(REPORT_SCHEMA_VERSION, "lego.part-retrieval-ceiling/2")

    def test_exactly_recompiled_score_numbers_are_republished_with_provenance(self) -> None:
        confound = verified_vision_confound(
            {
                "headline": {
                    "firstFiftyAccuracy": {
                        "accuracy": 0.75,
                        "calloutsJudged": 8,
                        "correct": 6,
                        "drawingsJudged": 8,
                    }
                }
            },
            "sha256:" + "a" * 64,
        )
        self.assertEqual(confound["status"], "exact-recompiled-score-summary")
        self.assertEqual(confound["firstFiftyAccuracy"], 0.75)
        self.assertEqual(confound["retainedScoreDigest"], "sha256:" + "a" * 64)

    def test_lead_and_member_recomputations_share_one_bounded_budget(self) -> None:
        self.assertEqual(require_retrieval_comparison_budget(1, 1, 1), 1_568)
        with self.assertRaisesRegex(ValueError, "lead and 4000 exact-member rows"):
            require_retrieval_comparison_budget(4_000, 4_000, 4_096)

    def test_distance_drift_refuses_metrics_with_observed_value_and_remediation(self) -> None:
        with self.assertRaisesRegex(
            ValueError,
            "worstAbsoluteDeviationFromPublishedRows=0.25.*Regenerate match and distances",
        ):
            verified_rank_rows([None], 0.25, True)

    def test_candidate_prefix_drift_refuses_metrics_before_scoring(self) -> None:
        with self.assertRaisesRegex(
            ValueError,
            "candidatePrefixReproduced=False.*before computing any recall",
        ):
            verified_rank_rows([None], 0.0, False)

    def test_bounded_float_noise_and_exact_candidate_prefix_are_accepted(self) -> None:
        self.assertEqual(verified_rank_rows([[0.25]], 5e-13, True), [[1]])


def descriptor(grid, detail=None, aspect=1.0, ink=0.5, mean=(0, 0, 0), light=128):
    cells = list(grid)
    return {
        "grid": cells,
        "detail": list(detail if detail is not None else [0] * len(cells)),
        "aspect": aspect,
        "ink": ink,
        "pixels": 100,
        "boxWidth": 10,
        "boxHeight": 10,
        "mean": list(mean),
        "lightFace": light,
        "colours": [{"rgb": list(mean), "share": 1.0}],
    }


def record(cluster, element, rank, source="pair-judged", pieces=1):
    return TruthRecord(
        source=source,
        cluster_index=cluster,
        callout_identity=f"p1|q1|x0.000|y{cluster}.000",
        element_id=element,
        rank=rank,
        pieces=pieces,
        step_number=1,
    )


class RankingTest(unittest.TestCase):
    def test_ties_break_by_element_order_the_way_the_producer_sorts(self) -> None:
        self.assertEqual(ranked_order([0.5, 0.1, 0.5, 0.1]), [1, 3, 0, 2])
        self.assertEqual(rank_lookup([0.5, 0.1, 0.5, 0.1]), [3, 1, 4, 2])

    def test_shape_distance_is_one_when_nothing_overlaps(self) -> None:
        self.assertEqual(shape_distance({"grid": [255, 0]}, {"grid": [0, 255]}), 1.0)
        self.assertEqual(shape_distance({"grid": [255, 0]}, {"grid": [255, 0]}), 0.0)

    def test_identical_descriptors_are_zero_apart_on_every_term(self) -> None:
        one = descriptor([255, 0, 0, 255], detail=[10, 0, 0, 20])
        for name, value in distance_terms(one, dict(one)).items():
            self.assertEqual(value, 0.0, name)
        self.assertEqual(weighted_total(distance_terms(one, dict(one))), 0.0)

    def test_a_dropped_term_stops_contributing(self) -> None:
        left = descriptor([255, 0], mean=(0, 0, 0), light=0)
        right = descriptor([255, 0], mean=(255, 255, 255), light=255)
        terms = distance_terms(left, right)
        self.assertGreater(terms["colour"], 0.5)
        weights = {"shape": 0.34, "detail": 0.14, "aspect": 0.14, "colour": 0.0, "ink": 0.06}
        self.assertEqual(weighted_total(terms, weights), 0.0)


class RecallTest(unittest.TestCase):
    def test_recall_counts_hits_at_each_k_and_reports_unreachable_separately(self) -> None:
        rows = [record(0, "a", 1), record(1, "b", 7), record(2, "c", None)]
        scored = recall_at(rows, ks=(1, 6))
        self.assertEqual(scored["denominator"], 3)
        self.assertEqual(scored["unreachable"], 1)
        self.assertEqual(scored["recallAt1"], {"hits": 1, "of": 3, "rate": 1 / 3})
        self.assertEqual(scored["recallAt6"], {"hits": 1, "of": 3, "rate": 1 / 3})
        self.assertEqual(scored["rankHistogram"], {1: 1, 7: 1})

    def test_an_element_with_no_thumbnail_is_never_a_hit_at_any_k(self) -> None:
        scored = recall_at([record(0, "missing", None)], ks=(1, 25))
        self.assertEqual(scored["recallAt25"]["hits"], 0)
        self.assertEqual(scored["unreachable"], 1)

    def test_design_level_scoring_takes_the_best_element_of_the_right_mould(self) -> None:
        rows = [[0.1, 0.2, 0.3]]
        element_ids = ["1001", "1002", "1003"]
        design_of = {"1001": "3020", "1002": "3020", "1003": "3666"}
        lifted = design_level_records([record(0, "1002", 2)], design_of, element_ids, rows)
        self.assertEqual(lifted[0].rank, 1)


class TruthBindingTest(unittest.TestCase):
    def setUp(self) -> None:
        self.callouts = [
            {
                "identity": "p1|q1|x1.000|y1.000",
                "evidenceKind": "part-art",
                "sha256": "sha256:" + "a" * 64,
                "stepNumber": 3,
                "quantity": 1,
                "descriptor": descriptor([0, 255]),
            },
            {
                "identity": "p2|q1|x2.000|y2.000",
                "evidenceKind": "part-art",
                "sha256": "sha256:" + "b" * 64,
                "stepNumber": 4,
                "quantity": 1,
                "descriptor": descriptor([255, 0]),
            },
        ]
        self.features = {
            "callouts": self.callouts,
            "inventory": {
                "111": descriptor([255, 0]),
                "222": descriptor([0, 255]),
            },
        }
        self.clusters = [
            {"clusterIndex": 0, "members": [0], "pieces": 1, "lead": "one.png", "candidates": []},
            {"clusterIndex": 1, "members": [1], "pieces": 1, "lead": "two.png", "candidates": []},
        ]
        self.ranks = [[1, 4], [3, 1]]
        self.element_index = {"111": 0, "222": 1}
        self.inventory = [self.features["inventory"][element] for element in ("111", "222")]

    def test_a_positive_verdict_becomes_truth_and_a_negative_one_does_not(self) -> None:
        verdicts = [
            {"n": 1, "judgedCropSha256": "sha256:" + "a" * 64, "elementId": "222", "same": True},
            {"n": 2, "judgedCropSha256": "sha256:" + "b" * 64, "elementId": "111", "same": False},
        ]
        truth, negatives, unbindable = pair_judged_truth(
            verdicts, self.features, self.clusters, ["111", "222"]
        )
        self.assertEqual([(row.cluster_index, row.element_id, row.rank) for row in truth], [(0, "222", 1)])
        self.assertIsNotNone(truth[0].distance_row)
        self.assertEqual(len(negatives), 1)
        self.assertEqual(negatives[0]["refutedElementId"], "111")
        self.assertEqual(negatives[0]["refutedElementRank"], 1)
        self.assertEqual(unbindable, [])

    def test_a_verdict_whose_crop_is_gone_is_reported_rather_than_dropped(self) -> None:
        verdicts = [
            {"n": 9, "judgedCropSha256": "sha256:" + "c" * 64, "elementId": "111", "same": True}
        ]
        truth, _, unbindable = pair_judged_truth(
            verdicts, self.features, self.clusters, ["111", "222"]
        )
        self.assertEqual(truth, [])
        self.assertEqual(unbindable, [{"n": 9, "elementId": "111"}])

    def test_a_shared_prefix_does_not_bind_a_different_full_crop(self) -> None:
        prefix = "f" * 16
        judged = "sha256:" + prefix + "1" * 48
        retained = "sha256:" + prefix + "2" * 48
        features = {
            "callouts": [{**self.callouts[0], "sha256": retained}],
            "inventory": self.features["inventory"],
        }
        verdicts = [
            {"n": 1, "judgedCropSha256": judged, "elementId": "222", "same": True}
        ]
        truth, _, unbindable = pair_judged_truth(
            verdicts,
            features,
            [{"clusterIndex": 0, "members": [0]}],
            ["111", "222"],
        )
        self.assertEqual(truth, [])
        self.assertEqual(unbindable, [{"n": 1, "elementId": "222"}])

    def test_one_member_verdict_does_not_inherit_cluster_rank_or_quantity(self) -> None:
        features = {
            "callouts": self.callouts,
            "inventory": self.features["inventory"],
        }
        cluster = [{"clusterIndex": 0, "members": [0, 1], "pieces": 99}]
        verdicts = [
            {
                "n": 1,
                "judgedCropSha256": self.callouts[1]["sha256"],
                "elementId": "111",
                "same": True,
            }
        ]
        truth, _, _ = pair_judged_truth(verdicts, features, cluster, ["111", "222"])
        self.assertEqual(len(truth), 1)
        self.assertEqual(truth[0].callout_identity, self.callouts[1]["identity"])
        self.assertEqual(truth[0].pieces, self.callouts[1]["quantity"])
        self.assertEqual(truth[0].rank, 1)

    def test_the_builder_export_wins_a_disagreement_and_the_conflict_is_kept(self) -> None:
        merged, conflicts = merge_truth(
            [record(0, "111", 1, source="builder")], [record(0, "222", 5)]
        )
        self.assertEqual(merged[(0, "p1|q1|x0.000|y0.000")].element_id, "111")
        self.assertEqual(conflicts[0]["builderElementId"], "111")
        self.assertEqual(conflicts[0]["pairJudgedElementId"], "222")

    def test_refusals_never_become_builder_truth_but_accepted_action_pieces_do(self) -> None:
        ledger = {
            "steps": [
                {
                    "stepNumber": 3,
                    "pageNumber": 12,
                    "action": {
                        "pieces": [
                            {"calloutKey": self.callouts[0]["identity"], "brickRef": "accepted"}
                        ]
                    },
                }
            ],
            "provenance": {
                "refusals": [
                    {
                        "stepNumber": 4,
                        "calloutKey": self.callouts[1]["identity"],
                        "brickRef": "refused",
                        "reason": "self-contradicted identification is not trusted",
                    }
                ]
            },
        }
        truth, steps = builder_truth(
            ledger,
            {
                "accepted": {"design": "3001", "itemNos": ["111"]},
                "refused": {"design": "3002", "itemNos": ["222"]},
            },
            self.callouts,
            self.clusters,
            self.inventory,
            self.element_index,
        )
        self.assertEqual(
            [(row.callout_identity, row.element_id) for row in truth],
            [(self.callouts[0]["identity"], "111")],
        )
        self.assertEqual([step["stepNumber"] for step in steps], [3])

    def test_builder_truth_refuses_multiple_official_item_numbers(self) -> None:
        ledger = {
            "steps": [
                {
                    "stepNumber": 3,
                    "pageNumber": 12,
                    "action": {
                        "pieces": [
                            {"calloutKey": self.callouts[0]["identity"], "brickRef": "ambiguous"}
                        ]
                    },
                }
            ],
            "provenance": {"refusals": []},
        }
        with self.assertRaisesRegex(
            ValueError,
            "step 3.*callout.*Brick 'ambiguous'.*111.*222.*exactly one element identity.*"
            "inventory intersection cannot choose",
        ):
            builder_truth(
                ledger,
                {"ambiguous": {"design": "3001", "itemNos": ["111", "222"]}},
                self.callouts,
                self.clusters,
                self.inventory,
                self.element_index,
            )

    def test_builder_nonlead_uses_exact_member_rank_quantity_and_recall_row(self) -> None:
        callouts = [
            {
                **self.callouts[0],
                "file": "lead.png",
                "quantity": 2,
                "descriptor": descriptor([0, 255]),
            },
            {
                **self.callouts[1],
                "file": "member.png",
                "quantity": 7,
                "descriptor": descriptor([255, 0]),
            },
        ]
        clusters = [
            {
                "clusterIndex": 0,
                "members": [0, 1],
                "pieces": 99,
                "lead": "lead.png",
                "candidates": [],
            }
        ]
        ledger = {
            "steps": [
                {
                    "stepNumber": 4,
                    "pageNumber": 12,
                    "action": {
                        "pieces": [
                            {"calloutKey": callouts[1]["identity"], "brickRef": "member"}
                        ]
                    },
                }
            ],
            "provenance": {"refusals": []},
        }
        truth, _ = builder_truth(
            ledger,
            {"member": {"design": "3001", "itemNos": ["111"]}},
            callouts,
            clusters,
            self.inventory,
            self.element_index,
        )
        self.assertEqual(len(truth), 1)
        self.assertEqual(truth[0].rank, 1)
        self.assertEqual(truth[0].pieces, 7)
        self.assertIsNotNone(truth[0].distance_row)
        self.assertEqual(recall_at(truth, ks=(1,))["recallAt1"]["hits"], 1)
        self.assertEqual(
            design_level_records(
                truth,
                {"111": "3001", "222": "3002"},
                ["111", "222"],
                [[1.0, 0.0]],
            )[0].rank,
            1,
        )
        cause_truth, omitted = lead_diagnostic_truth(truth, clusters, callouts)
        self.assertEqual(cause_truth, [])
        self.assertEqual(omitted, 1)

    def test_cluster_level_view_refuses_conflicting_accepted_elements(self) -> None:
        first = record(5, "111", 1, source="builder")
        second = TruthRecord(
            source="builder",
            cluster_index=5,
            callout_identity="p2|q1|x2.000|y2.000",
            element_id="222",
            rank=2,
            pieces=1,
            step_number=2,
        )
        with self.assertRaisesRegex(
            ValueError,
            "cluster 5.*accepted callout.*step 1.*111.*p2\\|q1\\|x2.000\\|y2.000.*"
            "step 2.*222.*cluster-level scoring until accepted evidence agrees",
        ):
            lead_truth_per_cluster([second, first], [[1, 2]] * 6, self.element_index)

    def test_cluster_view_uses_published_lead_rank_not_lexical_member_rank(self) -> None:
        first = record(0, "111", 9, source="builder")
        second = TruthRecord(
            source="builder",
            cluster_index=0,
            callout_identity="p2|q1|x2.000|y2.000",
            element_id="111",
            rank=1,
            pieces=2,
            step_number=2,
            distance_row=(0.0, 1.0),
        )
        clustered = lead_truth_per_cluster([first, second], [[2, 1]], self.element_index)
        self.assertEqual(len(clustered), 1)
        self.assertEqual(clustered[0].rank, 2)
        self.assertEqual(clustered[0].pieces, 3)
        self.assertIsNone(clustered[0].distance_row)

    def test_official_bricks_reads_design_and_item_numbers(self) -> None:
        xml = (
            "<LXFML><Bricks>"
            '<Brick uuid="u-1" itemNos="302028,999" designID="3020;L">'
            '<Part materials="26:0" /></Brick>'
            "</Bricks></LXFML>"
        )
        self.assertEqual(
            official_bricks(xml), {"u-1": {"design": "3020", "itemNos": ["302028", "999"]}}
        )


class MissAccountingTest(unittest.TestCase):
    """A miss that cannot be ablated must still come back as a row.

    This generation has no truth element without a thumbnail, so the live half
    cannot exercise the path at all - which is exactly why it is driven here.
    A branch nothing reaches reports green forever.
    """

    def test_a_truth_with_no_thumbnail_is_attributed_not_dropped(self) -> None:
        unreachable = [record(7, "4211393", None)]
        attribution = attribute_misses([], [], unreachable)
        self.assertEqual(attribution["misses"], 1)
        self.assertEqual(attribution["unreachableMisses"], 1)
        self.assertTrue(attribution["everyMissAccountedFor"])
        self.assertEqual(
            attribution["byRepair"], {"publish-a-thumbnail-for-the-element": 1}
        )
        self.assertFalse(attribution["detail"][0]["droppingColourMakesItWorse"])

    def test_an_unablatable_miss_is_not_measurable_rather_than_absent(self) -> None:
        side = triangulate_defect_side([], {}, {}, {}, {}, [record(7, "4211393", None)])
        self.assertTrue(side["everyMissAccountedFor"])
        self.assertEqual(side["byVerdict"], {"not-measurable-no-thumbnail": 1})

    def test_an_element_with_no_sibling_is_its_own_verdict(self) -> None:
        ablation = [
            {
                "clusterIndex": 0,
                "elementId": "111",
                "name": "solo",
                "rank": 9,
                "colour": 9,
                "termsAtTruth": {"colour": 0.1, "shape": 0.1},
            }
        ]
        side = triangulate_defect_side(
            ablation,
            {0: descriptor([255], aspect=1.0)},
            {"111": descriptor([255], aspect=1.0)},
            {"111": "3020"},
            {"3020": ["111"]},
        )
        self.assertEqual(side["byVerdict"], {"no-sibling-to-compare": 1})
        self.assertTrue(side["everyMissAccountedFor"])


class SiblingOutlierTest(unittest.TestCase):
    def test_the_odd_thumbnail_of_a_mould_scores_furthest_from_its_siblings(self) -> None:
        inventory = {
            "1": descriptor([255, 255, 0, 0], aspect=2.0),
            "2": descriptor([255, 255, 0, 0], aspect=2.0),
            "3": descriptor([0, 0, 255, 255], aspect=0.5),
            "solo": descriptor([255, 0, 0, 0]),
        }
        design_of = {"1": "3020", "2": "3020", "3": "3020", "solo": "3666"}
        found = sibling_outliers(inventory, design_of)
        self.assertEqual({row["elementId"] for row in found}, {"1", "2", "3"})
        self.assertEqual(found[0]["elementId"], "3")
        self.assertTrue(found[0]["identifiable"])
        self.assertGreater(found[0]["nearestSiblingDistance"], 0.5)


def _drifted() -> list[str]:
    drift = []
    for relative, expected in PINNED.items():
        path = REPOSITORY_ROOT / relative
        if not path.exists():
            drift.append(f"{relative} is absent")
        elif digest_of(path) != expected:
            drift.append(f"{relative} is now {digest_of(path)[:23]}")
    return drift


@unittest.skipIf(_drifted(), f"could not verify against the pinned generation: {_drifted()}")
class PinnedGenerationTest(unittest.TestCase):
    """Numbers measured from one exact generation of the identification chain."""

    @classmethod
    def setUpClass(cls) -> None:
        import part_retrieval_ceiling_report as driver

        cls.report = driver.build_report(quick=True)

    def test_the_report_reproduces_the_published_distance_rows(self) -> None:
        self.assertLess(
            self.report["reproduction"]["worstAbsoluteDeviationFromPublishedRows"], 1e-12
        )
        self.assertTrue(self.report["reproduction"]["candidatePrefixReproduced"])

    def test_eleven_elements_holding_twenty_eight_pieces_have_no_thumbnail(self) -> None:
        structural = self.report["structuralCeiling"]
        self.assertEqual(len(structural["elementsWithoutThumbnail"]), 11)
        self.assertEqual(structural["piecesWithoutThumbnail"], 28)
        self.assertEqual(structural["elementsWithThumbnail"], 265)

    def test_ground_truth_covers_seventy_five_of_two_hundred_sixty_nine_clusters(self) -> None:
        coverage = self.report["groundTruthCoverage"]
        self.assertEqual(coverage["clustersTotal"], 269)
        self.assertEqual(coverage["clustersWithAnyTruth"], 75)
        self.assertEqual(coverage["fromBuilder"], 18)
        self.assertEqual(coverage["fromPairJudgedOnly"], 57)
        self.assertEqual(coverage["pairJudgedPositive"], 74)
        self.assertEqual(coverage["pairJudgedNegative"], 8)
        self.assertEqual(coverage["pairJudgedUnbindable"], [])

    def test_recall_at_six_is_below_one_on_every_truth_source(self) -> None:
        recall = self.report["recall"]
        self.assertEqual(recall["union"][f"recallAt{DISPLAYED_K}"], {"hits": 72, "of": 75, "rate": 72 / 75})
        self.assertEqual(recall["builderByCluster"][f"recallAt{DISPLAYED_K}"]["hits"], 16)
        self.assertEqual(recall["builderByCluster"]["denominator"], 18)
        self.assertEqual(recall["union"]["rankHistogram"], {1: 70, 2: 2, 17: 1, 20: 1, 197: 1})

    def test_scoring_the_mould_alone_hides_most_of_the_miss(self) -> None:
        recall = self.report["recall"]
        exact = recall["union"][f"recallAt{DISPLAYED_K}"]["rate"]
        mould = recall["unionDesignLevel"][f"recallAt{DISPLAYED_K}"]["rate"]
        self.assertGreater(mould, exact)
        self.assertEqual(recall["unionDesignLevel"][f"recallAt{DISPLAYED_K}"]["hits"], 74)

    def test_five_shortlists_cannot_supply_the_cluster_they_were_cut_for(self) -> None:
        elimination = self.report["eliminationWithoutTruth"]
        self.assertEqual(elimination["shortlistsEmptiedByCapacity"], 5)
        self.assertEqual(
            [row["clusterIndex"] for row in elimination["shortlistsEmptiedByCapacityDetail"]],
            [15, 44, 72, 128, 148],
        )
        self.assertEqual(elimination["shortlistsEmptiedByExactDemand"], 37)

    def test_a_miss_is_exactly_a_card_offering_no_candidate_of_the_right_colour(self) -> None:
        colour = self.report["colourAbsentFromShortlist"]
        self.assertEqual(colour["clusters"], 3)
        self.assertEqual(colour["ofClustersWithTruth"], 75)
        self.assertTrue(colour["coincidesWithTheMisses"])
        self.assertEqual(
            sorted(row["clusterIndex"] for row in colour["detail"]), [15, 53, 101]
        )

    def test_the_defect_is_on_the_inventory_side_and_a_tie_says_so(self) -> None:
        """The callout of the same part settles which side of the disagreement is broken.

        Two misses have a callout that matches the correctly cropped siblings and
        not the element's own thumbnail, so no descriptor change reaches them. The
        third agrees on both sides, and that tie is reported as a tie rather than
        invented into a defect.
        """

        side = self.report["defectSide"]
        self.assertEqual(side["byVerdict"], {"agrees-on-both-sides": 1, "inventory-thumbnail": 2})
        self.assertTrue(side["everyMissAccountedFor"])
        by_cluster = {row["clusterIndex"]: row for row in side["detail"]}
        self.assertEqual(by_cluster[101]["verdict"], "agrees-on-both-sides")
        self.assertEqual(by_cluster[101]["ratio"], 1.0)
        for cluster in (15, 53):
            self.assertGreater(by_cluster[cluster]["ratio"], 100.0)

    def test_the_published_outlier_list_says_it_is_truncated(self) -> None:
        """"Not in the worst fifteen" must not read as "has no sibling"."""

        block = self.report["defectiveInventoryThumbnails"]
        self.assertTrue(block["worstIsATruncatedView"])
        self.assertEqual(block["elementsWithSiblings"], 152)
        self.assertEqual(block["elementsWithNoSibling"], 113)
        self.assertEqual(
            block["elementsWithSiblings"] + block["elementsWithNoSibling"],
            self.report["structuralCeiling"]["elementsWithThumbnail"],
        )

    def test_the_shared_symptom_does_not_share_a_repair(self) -> None:
        """All three misses look like colour; two of them are not repaired by colour.

        Reading the symptom as the cause would send the work to the colour weight,
        which moves the two defective-thumbnail misses further away.
        """

        attribution = self.report["missAttribution"]
        self.assertEqual(attribution["misses"], 3)
        self.assertEqual(
            attribution["byRepair"],
            {"recrop-the-inventory-thumbnail": 2, "the-colour-term": 1},
        )
        self.assertEqual(attribution["colourReweightWouldHarm"], 2)
        self.assertTrue(attribution["everyMissAccountedFor"])
        self.assertEqual(attribution["unreachableMisses"], 0)
        worse = {row["clusterIndex"] for row in attribution["detail"] if row["droppingColourMakesItWorse"]}
        self.assertEqual(worse, {15, 53})

    def test_capacity_must_not_be_used_to_prune_a_single_drawing(self) -> None:
        """The filter that refutes a whole cluster deletes the right answer for a drawing.

        A cluster that pooled one mould in several colours draws more pieces than
        the true element holds, so capacity removes the truth - at rank 1 in
        almost every case. The claim and its counter-evidence ship together.
        """

        eliminated = self.report["eliminationWithoutTruth"]["capacityWouldEliminateTheTruthFor"]
        self.assertEqual(eliminated["ofClustersWithTruth"], 75)
        self.assertEqual(eliminated["clusters"], 11)
        self.assertEqual(eliminated["atRankOne"], 10)
        self.assertEqual(
            [row["clusterIndex"] for row in eliminated["detail"]],
            [1, 15, 44, 128, 135, 140, 151, 209, 220, 253, 257],
        )

    def test_the_descriptor_is_a_perfect_mould_retriever_on_unbiased_truth(self) -> None:
        mould = self.report["recall"]["builderByClusterDesignLevel"]
        self.assertEqual(mould["denominator"], 18)
        self.assertEqual(mould["rankHistogram"], {1: 18})
        self.assertEqual(mould["recallAt1"]["rate"], 1.0)

    def test_both_green_elements_carry_a_defective_inventory_thumbnail(self) -> None:
        worst = self.report["defectiveInventoryThumbnails"]["worst"]
        self.assertEqual([row["elementId"] for row in worst[:2]], ["302028", "383228"])
        self.assertGreater(worst[0]["nearestSiblingDistance"], 0.7)
        self.assertGreater(worst[1]["nearestSiblingDistance"], 0.3)
        self.assertTrue(all(row["identifiable"] for row in worst[:2]))

    def test_the_two_worst_ranked_truths_are_the_two_defective_thumbnails(self) -> None:
        by_cluster = {row["clusterIndex"]: row for row in self.report["detail"]["truth"]}
        self.assertEqual(by_cluster[53]["elementId"], "302028")
        self.assertEqual(by_cluster[53]["rank"], 197)
        self.assertEqual(by_cluster[15]["elementId"], "383228")
        self.assertEqual(by_cluster[15]["rank"], 17)

    def test_both_builder_misses_survive_every_within_step_pairing(self) -> None:
        misses = self.report["builderMissSensitivity"]["misses"]
        self.assertEqual({row["clusterIndex"] for row in misses}, {15, 53})
        self.assertTrue(all(row["missSurvivesEveryAcceptedPairing"] for row in misses))
        self.assertTrue(all(row["bestRankOverTheWholeStepSet"] > DISPLAYED_K for row in misses))

    def test_the_pair_judged_sample_bounds_recall_below_one(self) -> None:
        bounds = self.report["recall"]["pairJudgedSampleBounds"]
        self.assertEqual(bounds["drawings"], 82)
        self.assertEqual(bounds["knownHits"], 73)
        self.assertEqual(bounds["unknownRank"], 8)
        self.assertLess(bounds["upperBoundAtK"], 1.0)


if __name__ == "__main__":
    unittest.main()
