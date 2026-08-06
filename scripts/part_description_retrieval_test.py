"""Tests for description-based part retrieval.

Two halves, the same shape the depletion walk uses. The synthetic half always
runs and fixes the semantics: which reading of a part name is the footprint,
what an unparsed field costs, what a tie is worth, and that the retrieval is a
pure ranking that writes nothing. The live half runs only when the retained
identification artifacts are present *and* still hash to the digests the
measured numbers came from, so a republished chain skips with a message naming
the drift rather than failing or passing stale.
"""

from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path

from part_description_retrieval import (
    DEFAULT_WEIGHTS,
    UNPARSED_DIMENSION_COST,
    UNPARSED_KIND_COST,
    DescribedQuery,
    colour_cost,
    colour_name,
    dimension_cost,
    kind_cost,
    kind_readings,
    parse_element,
    parse_inventory,
    rank_elements,
    rank_of,
    score_element,
    stud_dimensions,
    worst_rank_in_tie,
)

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
INVENTORY = REPOSITORY_ROOT / "output/part-identification/element-resolution.json"
INVENTORY_DIGEST = "sha256:9fb2abe8f764f3381135b378c7940f63b69a77ed0f6db8a8f28ba2d8224b3a30"


def inventory_matches_pin() -> bool:
    if not INVENTORY.is_file():
        return False
    digest = f"sha256:{hashlib.sha256(INVENTORY.read_bytes()).hexdigest()}"
    return digest == INVENTORY_DIGEST


class StudDimensionTests(unittest.TestCase):
    """A part name states its footprint positionally, and a height is not one."""

    def test_a_plain_two_term_run_is_the_footprint_longest_first(self) -> None:
        self.assertEqual(stud_dimensions("Plate 2 x 4"), (4, 2))
        self.assertEqual(stud_dimensions("Plate 4 x 2"), (4, 2))

    def test_a_third_term_is_a_height_and_never_a_stud_dimension(self) -> None:
        """Reading by size instead of by position turns these into other parts."""

        self.assertEqual(stud_dimensions("Brick 1 x 1 x 3"), (1, 1))
        self.assertEqual(stud_dimensions("Brick Curved 1 x 12 x 1 2/3 with Cutouts"), (12, 1))
        self.assertEqual(
            stud_dimensions("Brick Special 1 x 1 x 1 2/3 with Studs on 1 Side"), (1, 1)
        )

    def test_a_sub_stud_height_does_not_become_a_footprint(self) -> None:
        self.assertEqual(stud_dimensions("Plate 1 x 1 x 2/3 with Open Stud"), (1, 1))
        self.assertEqual(stud_dimensions("Brick Sloped 30 1 x 2 x 2/3"), (2, 1))

    def test_a_fractional_footprint_rounds_up_to_the_studs_it_overhangs(self) -> None:
        self.assertEqual(stud_dimensions("Brick Arch 1 1/2 x 1 1/2 Corner"), (2, 2))

    def test_several_runs_combine_as_a_bounding_box(self) -> None:
        self.assertEqual(stud_dimensions("Bracket 1 x 2 - 2 x 4"), (4, 2))
        self.assertEqual(stud_dimensions("Plate 2 x 3 with 1 x 1 Cutout"), (3, 2))
        self.assertEqual(
            stud_dimensions("Plate Round Corner 5 x 5 with 4 x 4 Round Cutout"), (5, 5)
        )

    def test_a_bare_angle_is_not_a_dimension_run(self) -> None:
        self.assertEqual(stud_dimensions("Tile 45 Cut 2 x 2 (Triangle)"), (2, 2))

    def test_a_name_with_no_run_reads_as_unparsed_rather_than_as_zero(self) -> None:
        for name in ("Bar 3L", "Technic Axle 3", "Minifig Head [Plain]"):
            self.assertIsNone(stud_dimensions(name), name)


class KindReadingTests(unittest.TestCase):
    """A drawing is often honestly two families at once, so kinds are a set."""

    def test_a_family_word_admits_every_reading_a_describer_could_use(self) -> None:
        self.assertEqual(kind_readings("Brick Arch 1 x 4"), frozenset({"arch", "brick", "slope"}))
        self.assertEqual(kind_readings("Plate Round Corner 4 x 4"), frozenset({"round", "plate"}))
        self.assertEqual(kind_readings("Wedge Plate 4 x 2 Left"), frozenset({"wedge", "plate"}))

    def test_a_technic_brick_is_still_a_brick(self) -> None:
        self.assertIn("brick", kind_readings("Technic Brick 1 x 1 with Axle Hole"))
        self.assertIn("technic", kind_readings("Technic Brick 1 x 1 with Axle Hole"))

    def test_a_technic_axle_is_not_a_brick(self) -> None:
        self.assertNotIn("brick", kind_readings("Technic Axle 3"))

    def test_a_separator_tool_is_not_a_brick_despite_the_word(self) -> None:
        self.assertEqual(kind_readings("Brick and Axle Separator v2.0"), frozenset({"other"}))

    def test_an_unrecognised_family_is_empty_and_not_other(self) -> None:
        """Empty means the parser did not read it; {"other"} is a positive claim."""

        self.assertEqual(kind_readings("Nonexistent Widget 1 x 1"), frozenset())


class CostTests(unittest.TestCase):
    """What each field is worth, and what silence is worth."""

    def test_an_exact_footprint_costs_nothing_and_a_far_one_costs_everything(self) -> None:
        self.assertEqual(dimension_cost((4, 2), (4, 2)), 0.0)
        self.assertGreater(dimension_cost((4, 2), (14, 2)), 0.5)

    def test_one_stud_out_costs_more_on_a_small_part_than_a_large_one(self) -> None:
        """Which is why a 2 x 4 does not rank beside a 2 x 14."""

        self.assertGreater(dimension_cost((2, 1), (3, 1)), dimension_cost((10, 6), (11, 6)))

    def test_an_unparsed_dimension_is_neutral_rather_than_free_or_fatal(self) -> None:
        self.assertEqual(dimension_cost(None, (4, 2)), UNPARSED_DIMENSION_COST)
        self.assertEqual(dimension_cost((4, 2), None), UNPARSED_DIMENSION_COST)
        self.assertLess(UNPARSED_DIMENSION_COST, 1.0)
        self.assertGreater(UNPARSED_DIMENSION_COST, 0.0)

    def test_a_kind_inside_the_names_readings_costs_nothing(self) -> None:
        self.assertEqual(kind_cost("arch", frozenset({"arch", "brick"})), 0.0)
        self.assertEqual(kind_cost("plate", frozenset({"arch", "brick"})), 1.0)
        self.assertEqual(kind_cost("plate", frozenset()), UNPARSED_KIND_COST)

    def test_colour_is_exact_because_the_prompt_names_the_vocabulary(self) -> None:
        self.assertEqual(colour_cost("Green", "Green"), 0.0)
        self.assertEqual(colour_cost("Green", "Dark Green"), 1.0)
        self.assertEqual(colour_cost("Light Bluish Gray", "Dark Bluish Gray"), 1.0)

    def test_an_ldraw_code_with_no_catalog_name_is_unparsed_not_guessed(self) -> None:
        self.assertIsNone(colour_name(47))
        self.assertEqual(colour_name(2), "Green")
        self.assertEqual(colour_name("72"), "Dark Bluish Gray")


class DescribedQueryTests(unittest.TestCase):
    """An answer row is read strictly; 0 studs means unread, not zero studs."""

    def test_a_zero_stud_count_is_unread_rather_than_zero(self) -> None:
        query = DescribedQuery.from_answer(
            {"kind": "plate", "studsLong": 0, "studsWide": 2, "colour": "Black"}
        )
        self.assertIsNone(query.studs_long)
        self.assertIsNone(query.dimensions)

    def test_a_kind_outside_the_prompt_vocabulary_is_dropped(self) -> None:
        query = DescribedQuery.from_answer({"kind": "macaroni", "colour": "Black"})
        self.assertIsNone(query.kind)

    def test_dimensions_are_normalised_longest_first(self) -> None:
        query = DescribedQuery.from_answer(
            {"kind": "plate", "studsLong": 2, "studsWide": 4, "colour": "Black"}
        )
        self.assertEqual(query.dimensions, (4, 2))


class RankingTests(unittest.TestCase):
    """A rank is reproducible, and a tie is reported as a tie."""

    def setUp(self) -> None:
        self.elements = parse_inventory(
            {
                "green24": {"partNum": "3020", "name": "Plate 2 x 4", "colorId": "2", "quantity": 2},
                "black24": {"partNum": "3020", "name": "Plate 2 x 4", "colorId": "0", "quantity": 14},
                "green210": {
                    "partNum": "3832",
                    "name": "Plate 2 x 10",
                    "colorId": "2",
                    "quantity": 1,
                },
                "blackbrick": {
                    "partNum": "3001",
                    "name": "Brick 2 x 4",
                    "colorId": "0",
                    "quantity": 3,
                },
            }
        )

    def test_colour_and_footprint_together_pick_the_one_element(self) -> None:
        query = DescribedQuery.from_answer(
            {"kind": "plate", "studsLong": 4, "studsWide": 2, "colour": "Green"}
        )
        ranked = rank_elements(query, self.elements)
        self.assertEqual(ranked[0][0], "green24")
        self.assertEqual(rank_of(ranked, "green24"), 1)

    def test_a_tie_is_reported_at_its_pessimistic_edge(self) -> None:
        """Two elements at the same score is not a retrieval of either."""

        query = DescribedQuery.from_answer(
            {"kind": "plate", "studsLong": 4, "studsWide": 2, "colour": "Red"}
        )
        ranked = rank_elements(query, self.elements)
        self.assertEqual(ranked[0][1], ranked[1][1])
        self.assertEqual(worst_rank_in_tie(ranked, ranked[0][0]), 2)
        self.assertEqual(rank_of(ranked, ranked[0][0]), 1)

    def test_the_universe_can_be_restricted_without_changing_the_order(self) -> None:
        query = DescribedQuery.from_answer(
            {"kind": "plate", "studsLong": 4, "studsWide": 2, "colour": "Green"}
        )
        full = [e for e, _ in rank_elements(query, self.elements)]
        restricted = [
            e
            for e, _ in rank_elements(
                query, self.elements, restrict_to=frozenset({"green24", "green210"})
            )
        ]
        self.assertEqual(restricted, [e for e in full if e in {"green24", "green210"}])

    def test_an_absent_element_ranks_as_none_rather_than_as_last(self) -> None:
        query = DescribedQuery.from_answer(
            {"kind": "plate", "studsLong": 4, "studsWide": 2, "colour": "Green"}
        )
        ranked = rank_elements(query, self.elements, restrict_to=frozenset({"black24"}))
        self.assertIsNone(rank_of(ranked, "green24"))
        self.assertIsNone(worst_rank_in_tie(ranked, "green24"))

    def test_scoring_is_a_pure_function_of_the_two_descriptions(self) -> None:
        query = DescribedQuery.from_answer(
            {"kind": "plate", "studsLong": 4, "studsWide": 2, "colour": "Green"}
        )
        first = score_element(query, self.elements["green24"], DEFAULT_WEIGHTS)
        second = score_element(query, self.elements["green24"], DEFAULT_WEIGHTS)
        self.assertEqual(first, second)
        self.assertEqual(first, 0.0)


@unittest.skipUnless(
    inventory_matches_pin(),
    f"{INVENTORY} is absent or no longer hashes to {INVENTORY_DIGEST}, so the printed inventory "
    "these counts describe is not the one on disk. Re-derive element resolution, then re-measure "
    "and update the pin rather than relaxing the assertion.",
)
class LiveInventoryTests(unittest.TestCase):
    """What the parser can and cannot read out of the real printed inventory."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
        cls.parsed = parse_inventory(cls.inventory)

    def test_every_element_resolves_to_a_family(self) -> None:
        unparsed = sorted({e.name for e in self.parsed.values() if not e.kinds_parsed})
        self.assertEqual(unparsed, [], f"no family reading for {unparsed}")

    def test_the_names_without_a_stud_footprint_are_named_not_counted(self) -> None:
        """Twenty names, nineteen of them genuinely dimensionless parts.

        The twentieth, "Wedge Plate 4 Stud 45 Angle Plate", states its stud
        count in prose rather than as a run, and is a real gap in the parser
        rather than a part without a footprint. It is listed here so it stays
        visible instead of being absorbed into a pass rate.
        """

        unparsed = sorted({e.name for e in self.parsed.values() if not e.dimensions_parsed})
        self.assertEqual(len(unparsed), 20, unparsed)
        self.assertIn("Wedge Plate 4 Stud 45° Angle Plate", unparsed)
        self.assertIn("Technic Axle 3", unparsed)

    def test_the_only_unnamed_colour_is_the_one_the_prompt_also_leaves_out(self) -> None:
        """LDraw 47 is transparent, has no catalog definition, and is not invented."""

        unparsed = sorted(
            {e.element_id for e in self.parsed.values() if not e.colour_parsed}
        )
        self.assertEqual(len(unparsed), 3, unparsed)
        for element_id in unparsed:
            self.assertEqual(self.inventory[element_id]["colorId"], "47")

    def test_the_contaminated_green_plate_is_retrieved_first_from_its_description(self) -> None:
        """The worked example the whole comparison rests on.

        302028 is a Green Plate 2 x 4 whose parts-list thumbnail is a
        contaminated crop, and the pixel descriptor ranks it 197th of 265 for
        the drawings that are it. Described as a green 4 x 2 plate it is first.
        This asserts the retrieval, not the identity of any callout: no label,
        assignment or refusal is written or overridden anywhere in this module.
        """

        query = DescribedQuery.from_answer(
            {"kind": "plate", "studsLong": 4, "studsWide": 2, "colour": "Green"}
        )
        ranked = rank_elements(query, self.parsed)
        self.assertEqual(ranked[0][0], "302028")
        self.assertEqual(worst_rank_in_tie(ranked, "302028"), 1)

    def test_a_described_colour_alone_does_not_decide_a_shape(self) -> None:
        """Green is rare in this inventory, but rarity must not outvote geometry."""

        query = DescribedQuery.from_answer(
            {"kind": "plate", "studsLong": 10, "studsWide": 2, "colour": "Green"}
        )
        ranked = rank_elements(query, self.parsed)
        self.assertEqual(self.inventory[ranked[0][0]]["name"], "Plate 2 x 10")


class ScorerSemanticsTests(unittest.TestCase):
    """How the head-to-head driver handles missing, conflicting and unmapped truth."""

    def setUp(self) -> None:
        import part_description_causes as causes
        import part_description_truth as truth

        self.scorer = truth
        self.causes = causes

    def test_an_unranked_truth_counts_as_a_miss_and_is_reported_separately(self) -> None:
        """A filter that removes the answer must not read as a smaller universe."""

        table = self.scorer.recall_table([1, 2, None, None])
        self.assertEqual(table["clusters"], 4)
        self.assertEqual(table["hitsAt6"], 2)
        self.assertEqual(table["recallAt6"], 0.5)
        self.assertEqual(table["notRanked"], 2)

    def test_recall_over_no_clusters_is_zero_rather_than_perfect(self) -> None:
        table = self.scorer.recall_table([])
        self.assertEqual(table["clusters"], 0)
        self.assertEqual(table["recallAt1"], 0.0)

    def test_the_stronger_source_wins_a_conflict_and_the_conflict_is_recorded(self) -> None:
        truth = self.scorer.ClusterTruth(cluster_index=15)
        truth.add_positive("383228", "builder-export")
        truth.add_positive("4210678", "pair-judged")
        self.assertEqual(truth.positive, "383228")
        self.assertEqual(truth.sources, {"builder-export"})
        self.assertEqual(len(truth.conflicts), 1)
        self.assertIn("383228", truth.conflicts[0])
        self.assertIn("4210678", truth.conflicts[0])

    def test_agreeing_sources_are_both_credited(self) -> None:
        truth = self.scorer.ClusterTruth(cluster_index=9)
        truth.add_positive("4106977", "builder-export")
        truth.add_positive("4106977", "pair-judged")
        self.assertEqual(truth.sources, {"builder-export", "pair-judged"})
        self.assertEqual(truth.conflicts, [])

    def test_interleaving_alternates_and_keeps_the_first_occurrence(self) -> None:
        first = [("a", 0.1), ("b", 0.2), ("c", 0.3)]
        second = [("c", 1.0), ("d", 2.0), ("e", 3.0)]
        self.assertEqual(
            [e for e, _ in self.scorer.interleave(first, second)],
            ["a", "c", "b", "d", "e"],
        )

    def test_interleaving_a_ranking_with_an_empty_one_changes_nothing(self) -> None:
        first = [("a", 0.1), ("b", 0.2)]
        self.assertEqual(self.scorer.interleave(first, []), first)

    def test_a_fused_ranking_is_scored_positionally_not_by_score(self) -> None:
        """The regression for a bug that made the fused column read as its input.

        `worst_rank_in_tie` counts how many entries score at least as well, which
        is a rank only while the list is ordered by one comparable score. Applied
        to a list holding two scales, or to one deliberately reordered against
        its score, it recovers the original ranking and the fusion looks like it
        did nothing -- which is exactly what the first run of this comparison
        reported. Fused and reranked lists are scored by position.
        """

        pixel = [("wrong", 0.10), ("truth", 0.90)]

        # A rerank keeps the input's scores and changes only the order, so
        # counting by score hands back the input rank and the rerank reads as
        # having done nothing. This is the failure that actually shipped into
        # the first run of the comparison: the reranked column was identical to
        # the pixel column in every cell, including its worst rank of 197.
        reranked = [pixel[1], pixel[0]]
        self.assertEqual(rank_of(reranked, "truth"), 1)
        self.assertEqual(worst_rank_in_tie(reranked, "truth"), 2)

        # A fusion carries each entry's score from whichever ranking contributed
        # it, so counting by score compares a description distance against pixel
        # distances and reports a number that is not a rank in either.
        described = [("truth", 0.00), ("wrong", 1.00)]
        fused = self.scorer.interleave(pixel, described)
        self.assertEqual([e for e, _ in fused], ["wrong", "truth"])
        self.assertEqual(rank_of(fused, "truth"), 2)
        self.assertEqual(worst_rank_in_tie(fused, "truth"), 1)

    def _colour_gap_case(self, rows: list[tuple[int, str, int | None, list[str]]]) -> dict:
        """(cluster, truthColour, pixelRank, cardColours) -> the analysis over them."""

        inventory: dict[str, dict] = {}
        match: dict = {"clusters": []}
        scored: list[dict] = []
        for cluster, truth_colour, pixel_rank, card_colours in rows:
            truth = f"truth{cluster}"
            inventory[truth] = {"partNum": "0", "name": "T", "colorId": truth_colour, "quantity": 1}
            candidates = []
            for offset, colour in enumerate(card_colours):
                element = f"c{cluster}_{offset}"
                inventory[element] = {
                    "partNum": "0",
                    "name": "C",
                    "colorId": colour,
                    "quantity": 1,
                }
                candidates.append({"elementId": element})
            match["clusters"].append({"clusterIndex": cluster, "candidates": candidates})
            scored.append(
                {
                    "cluster": cluster,
                    "truth": truth,
                    "truthName": "T",
                    "described": {"colour": "X"},
                    "pixelRank": pixel_rank,
                    "descriptionRank": 1,
                    "interleavedRank": 1,
                }
            )
        return self.causes.colour_gap_analysis(scored, match, inventory)

    def test_colour_absence_and_a_miss_are_reported_as_the_same_event(self) -> None:
        """The load-bearing claim: the misses are exactly the colour blind spots."""

        analysis = self._colour_gap_case(
            [
                (1, "0", 1, ["0", "72"]),  # retrieved, true colour offered
                (2, "2", 197, ["0", "72"]),  # missed, true colour absent
                (3, "0", 20, ["379", "71"]),  # missed, true colour absent
            ]
        )
        self.assertTrue(analysis["setsAreEqual"])
        self.assertEqual(analysis["pixelMissedAtShortlist"], [2, 3])
        self.assertEqual(analysis["cardOfferedNoCandidateOfTheTrueColour"], [2, 3])
        self.assertEqual(analysis["missedButColourWasOffered"], [])
        self.assertEqual(analysis["colourAbsentButRetrievedAnyway"], [])

    def test_a_partial_overlap_cannot_read_as_a_confirmation(self) -> None:
        """Both differences are reported, so the claim is falsifiable either way."""

        missed_anyway = self._colour_gap_case(
            [
                (1, "0", 99, ["0", "72"]),  # missed although the colour was there
                (2, "2", 197, ["0", "72"]),
            ]
        )
        self.assertFalse(missed_anyway["setsAreEqual"])
        self.assertEqual(missed_anyway["missedButColourWasOffered"], [1])

        retrieved_anyway = self._colour_gap_case(
            [
                (1, "2", 3, ["0", "72"]),  # colour absent, retrieved regardless
            ]
        )
        self.assertFalse(retrieved_anyway["setsAreEqual"])
        self.assertEqual(retrieved_anyway["colourAbsentButRetrievedAnyway"], [1])

    def test_a_truth_that_never_ranks_counts_as_missed_at_the_shortlist(self) -> None:
        analysis = self._colour_gap_case([(1, "2", None, ["0"])])
        self.assertEqual(analysis["pixelMissedAtShortlist"], [1])

    def test_the_shortlist_boundary_is_the_shipping_one(self) -> None:
        """Rank 6 is on the card; rank 7 is not. This comparison never changes k."""

        analysis = self._colour_gap_case([(1, "2", 6, ["0"]), (2, "2", 7, ["0"])])
        self.assertEqual(self.scorer.SHIPPING_SHORTLIST, 6)
        self.assertEqual(analysis["pixelMissedAtShortlist"], [2])

    def _triangulation_case(
        self, callout: float, truth_thumb: float, siblings: list[float]
    ) -> dict:
        """One miss, with the aspects of its callout, its thumbnail and its siblings."""

        inventory = {"truth": {"partNum": "P", "name": "T", "colorId": "2", "quantity": 1}}
        feature_inventory = {"truth": {"aspect": truth_thumb}}
        for offset, aspect in enumerate(siblings):
            element = f"sib{offset}"
            inventory[element] = {
                "partNum": "P",
                "name": "S",
                "colorId": "0",
                "quantity": 1,
            }
            feature_inventory[element] = {"aspect": aspect}
        features = {
            "inventory": feature_inventory,
            "callouts": [{"descriptor": {"aspect": callout}}],
        }
        match = {"clusters": [{"clusterIndex": 1, "members": [0]}]}
        return self.causes.defect_side_triangulation(
            [(1, "truth")], match, features, inventory
        )["rows"][0]

    def test_a_callout_matching_its_siblings_convicts_the_inventory_thumbnail(self) -> None:
        """The repair this points at is a re-crop, not a reweighting."""

        row = self._triangulation_case(1.688, 0.862, [1.693, 1.693, 1.687])
        self.assertEqual(row["defectiveSide"], "inventory-thumbnail")
        self.assertGreater(row["gapRatio"], self.causes.DEFECT_SEPARATION_RATIO)

    def test_a_callout_matching_only_its_own_thumbnail_convicts_the_callout(self) -> None:
        row = self._triangulation_case(0.900, 0.898, [1.700, 1.690])
        self.assertEqual(row["defectiveSide"], "callout-crop")

    def test_agreement_on_both_sides_is_its_own_outcome(self) -> None:
        """The regression for a two-way test forced onto a three-way world.

        Cluster 101's callout agrees with its own thumbnail and with its sibling
        equally well -- neither crop is defective and its miss has some other
        cause. With only two outcomes available the comparison returned
        "callout-crop" for it, inventing a defect out of a tie and pointing the
        repair at a file that is fine.
        """

        row = self._triangulation_case(0.731, 0.723, [0.723])
        self.assertEqual(row["defectiveSide"], "neither-geometry-agrees-on-both-sides")
        self.assertLess(row["gapRatio"], self.causes.DEFECT_SEPARATION_RATIO)

    def test_the_separation_threshold_has_headroom_rather_than_being_a_boundary(self) -> None:
        """The real data sits at 1.0x, 60.7x and 263.8x; nothing sits near 10x."""

        self.assertEqual(self.causes.DEFECT_SEPARATION_RATIO, 10.0)
        tie = self._triangulation_case(0.731, 0.723, [0.723])
        thumbnail = self._triangulation_case(1.688, 0.862, [1.693, 1.693, 1.687])
        self.assertLess(tie["gapRatio"] * 5, self.causes.DEFECT_SEPARATION_RATIO)
        self.assertGreater(thumbnail["gapRatio"], self.causes.DEFECT_SEPARATION_RATIO * 5)

    def test_an_element_with_no_sibling_gets_a_verdict_of_its_own_not_a_skip(self) -> None:
        """The regression for a bare `continue` that reported a clean row count.

        113 of the 265 elements with a thumbnail have no same-mould sibling, so
        the triangulation is simply undefined for them. Dropping those rows made
        "no row said callout-crop" look like evidence when the question had not
        been asked -- the same defect the instrument exists to expose.
        """

        analysis = self.causes.defect_side_triangulation(
            [(1, "truth")],
            {"clusters": [{"clusterIndex": 1, "members": [0]}]},
            {
                "inventory": {"truth": {"aspect": 0.9}},
                "callouts": [{"descriptor": {"aspect": 1.7}}],
            },
            {"truth": {"partNum": "P", "name": "T", "colorId": "2", "quantity": 1}},
        )
        self.assertEqual(len(analysis["rows"]), 1)
        row = analysis["rows"][0]
        self.assertEqual(row["defectiveSide"], "no-sibling-to-compare")
        self.assertIsNone(row["calloutToSiblingGap"])
        self.assertIsNone(row["gapRatio"])

    def test_every_miss_handed_in_comes_back_as_a_row(self) -> None:
        """No input may vanish, whatever the instrument can or cannot say about it."""

        analysis = self.causes.defect_side_triangulation(
            [(1, "truth"), (2, "truth"), (99, "absent")],
            {"clusters": [{"clusterIndex": 1, "members": [0]}]},
            {
                "inventory": {"truth": {"aspect": 0.9}},
                "callouts": [{"descriptor": {"aspect": 1.7}}],
            },
            {"truth": {"partNum": "P", "name": "T", "colorId": "2", "quantity": 1}},
        )
        self.assertEqual(len(analysis["rows"]), 3)
        self.assertEqual(
            analysis["rows"][1]["defectiveSide"], "not-measurable-no-thumbnail-or-cluster"
        )

    def test_the_sibling_centre_is_a_median_so_a_second_bad_crop_cannot_drag_it(self) -> None:
        """The failure being measured is a defective crop, so the centre must resist one.

        Two sound siblings at 1.69 and one that is itself miscropped at 0.86. A
        mean would sit at 1.41 and blunt the verdict; the median stays at 1.69
        and the inventory thumbnail is still convicted.
        """

        row = self._triangulation_case(1.688, 0.862, [0.860, 1.690, 1.693])
        self.assertEqual(row["siblingMedianAspect"], 1.69)
        self.assertEqual(row["defectiveSide"], "inventory-thumbnail")

    def test_the_domain_counts_account_for_every_element_with_a_thumbnail(self) -> None:
        analysis = self.causes.defect_side_triangulation(
            [],
            {"clusters": []},
            {"inventory": {"a": {"aspect": 1.0}, "b": {"aspect": 1.0}, "c": {"aspect": 1.0}}},
            {
                "a": {"partNum": "P", "name": "A", "colorId": "0", "quantity": 1},
                "b": {"partNum": "P", "name": "B", "colorId": "2", "quantity": 1},
                "c": {"partNum": "Q", "name": "C", "colorId": "0", "quantity": 1},
                "d": {"partNum": "R", "name": "D", "colorId": "0", "quantity": 1},
            },
        )
        domain = analysis["domain"]
        self.assertEqual(domain["elementsWithThumbnail"], 3)
        self.assertEqual(domain["elementsWithSiblings"], 2)
        self.assertEqual(domain["elementsWithNoSibling"], 1)
        self.assertEqual(
            domain["elementsWithSiblings"] + domain["elementsWithNoSibling"],
            domain["elementsWithThumbnail"],
        )

    def test_a_builder_row_with_no_live_cluster_is_named_rather_than_dropped(self) -> None:
        ledger = {
            "steps": [
                {
                    "action": {
                        "pieces": [
                            {"calloutKey": "p11|q1|x1|y1", "brickRef": "known"},
                            {"calloutKey": "p99|q9|x9|y9", "brickRef": "known"},
                        ]
                    }
                }
            ],
            "provenance": {"refusals": []},
        }
        xml = '<Brick designID="3020;L" itemNos="302028" uuid="known" />'
        truth, unmapped = self.scorer.builder_export_truth(ledger, xml, {"p11|q1|x1|y1": 4})
        self.assertEqual(truth, {4: ("302028", "3020")})
        self.assertEqual(unmapped, ["p99|q9|x9|y9"])

    def test_a_refused_callout_carries_truth_without_carrying_a_verdict(self) -> None:
        """The export names what the Builder cut placed; it does not accept anything."""

        ledger = {
            "steps": [],
            "provenance": {
                "refusals": [{"calloutKey": "p12|q1|x108.829|y453.870", "brickRef": "u"}]
            },
        }
        xml = '<Brick designID="3020;L" itemNos="302028" uuid="u" />'
        truth, unmapped = self.scorer.builder_export_truth(
            ledger, xml, {"p12|q1|x108.829|y453.870": 53}
        )
        self.assertEqual(truth[53], ("302028", "3020"))
        self.assertEqual(unmapped, [])


if __name__ == "__main__":
    unittest.main()
