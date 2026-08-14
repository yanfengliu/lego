"""Tests for the booklet depletion walk.

Two halves. The synthetic half always runs and fixes the semantics: what an
overdraft blames, what it deliberately cannot blame, what a refusal says, and
what each candidate filter removes. The live half runs only when the retained
artifacts are present *and* still hash to the digests these numbers were
measured from, so a republished identification chain skips with a message
naming the drift rather than failing or passing stale.
"""

from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path

from booklet_depletion_walk import (
    Claim,
    Cluster,
    consumed_before,
    infeasible_clusters,
    narrow_cluster,
    narrowing_score,
    walk_inventory,
)
from booklet_depletion_input_contract_test import DepletionInputClosureTests  # noqa: F401
from part_action_ledger_official_contract import official_bricks
from part_identification_report_contract_test import (  # noqa: F401
    ReportClosureTests,
    ReportInputBoundsTests,
)
from part_identification_report_contract_test_fixture import (
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

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
INVENTORY = REPOSITORY_ROOT / "output/part-identification/element-resolution.json"
MATCH = REPOSITORY_ROOT / "output/part-identification/match.json"
FEATURES = REPOSITORY_ROOT / "output/part-identification/features.json"
DISTANCES = REPOSITORY_ROOT / "output/part-identification/distances.json"
COVERAGE = REPOSITORY_ROOT / "output/real-build/catalog-coverage.json"
# An independently pinned algorithm-only fixture from before the four mis-read
# multiplier labels were reclassified. The current report CLI intentionally
# refuses its coverage/1 schema; this fixture scores only the pure walk method.
PRE_FIX_COVERAGE = (
    REPOSITORY_ROOT / "output/real-build/history/catalog-coverage-stale-57c5b34d.json"
)
PRE_FIX_DIGEST = "sha256:57c5b34d0ec6e5dfb62b6d249364e437a3d4a2553290e5ac8858367be0fcdef3"
# Read only, and only to corroborate: the emitted action ledger records which
# official Builder identity each refused callout was cut to, and the official
# model export says what that identity is. Neither file is written here.
ACTION_LEDGER = REPOSITORY_ROOT / "output/real-build/action-ledger.json"
OFFICIAL_MODEL = REPOSITORY_ROOT / "output/official-model/vx1087034_21066_a.xml"

# The exact artifact bytes every live number below was measured from. A digest
# that has moved means the identification chain was republished, and these
# figures describe a set of drawings that no longer exists.
PINNED = {
    INVENTORY: "sha256:9fb2abe8f764f3381135b378c7940f63b69a77ed0f6db8a8f28ba2d8224b3a30",
    MATCH: "sha256:5e46360fe5cbb128adbc114a1fbdb7047bfb9d61312911aa7f31ae0588921c94",
    FEATURES: "sha256:b4b5213c6750401b521ecabe8ef56477095a93d2fc85ee0113c13d1c03484268",
    DISTANCES: "sha256:91ef5dae10fc821803fe329029b7fdcb8909dabddbf947da18a5ac7acdd99f63",
    COVERAGE: "sha256:629caa20bcaf1a9ff1c3c30cc5ea733383afe0d609ec79c5ead1d796d1478874",
}


def artifacts_match_pins() -> bool:
    for path, digest in PINNED.items():
        if not path.is_file():
            return False
        if "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            return False
    return True


class WalkSemanticsTests(unittest.TestCase):
    def test_a_claim_inside_the_inventory_is_not_flagged(self) -> None:
        report = walk_inventory(
            {"A": 2},
            [Claim("c1", 1, "A", 1), Claim("c2", 4, "A", 1)],
        )
        self.assertIsNone(report.first_inconsistent_step)
        self.assertEqual(report.overdrafts, ())
        self.assertEqual(report.pieces_walked, 2)
        self.assertEqual(report.pieces_left_over, 0)

    def test_the_overdraft_is_reported_at_the_step_it_happens(self) -> None:
        report = walk_inventory(
            {"A": 1},
            [Claim("c1", 3, "A", 1), Claim("c2", 9, "A", 1)],
        )
        self.assertEqual(report.first_inconsistent_step, 9)
        self.assertEqual(report.overdrafts[0].callout_keys, ("c2",))
        self.assertEqual(report.overdrafts[0].remaining, 0)
        self.assertIn("printed step 9", report.overdrafts[0].reason)
        self.assertIn("exhausted at printed step 3", report.overdrafts[0].reason)

    def test_two_claims_in_the_same_step_are_blamed_together(self) -> None:
        report = walk_inventory(
            {"A": 1},
            [Claim("later", 5, "A", 1), Claim("earlier", 5, "A", 1)],
        )
        self.assertEqual(len(report.overdrafts), 1)
        self.assertEqual(report.overdrafts[0].callout_keys, ("earlier", "later"))
        self.assertEqual(report.overdrafts[0].demanded, 2)

    def test_an_element_never_spent_is_reported_as_left_over(self) -> None:
        report = walk_inventory({"A": 3, "B": 1}, [Claim("c1", 1, "A", 3)])
        self.assertEqual(report.leftover, (("B", 1),))
        self.assertEqual(report.pieces_left_over, 1)

    def test_the_walk_blames_the_last_claim_not_the_wrong_one(self) -> None:
        """The measured limitation, held as a test so it cannot be forgotten.

        This is the shape of the four mis-read multiplier labels: the wrong claim
        arrives first, the inventory only runs out later, and the walk blames the
        arrival that crossed the line. The suspect set is what carries the real
        candidate, so it must contain the early claim.
        """

        report = walk_inventory(
            {"A": 2},
            [
                Claim("wrong-and-early", 10, "A", 1),
                Claim("right", 20, "A", 1),
                Claim("right-but-blamed", 30, "A", 1),
            ],
        )
        self.assertEqual(report.first_inconsistent_step, 30)
        self.assertEqual(report.overdrafts[0].callout_keys, ("right-but-blamed",))
        suspects = {claim[1] for claim in report.suspects[0].claims}
        self.assertEqual(suspects, {"wrong-and-early", "right", "right-but-blamed"})
        self.assertIn("any claim in this list may be the wrong one", report.suspects[0].reason)

    def test_trusted_only_ignores_an_untrusted_spender_and_says_so(self) -> None:
        claims = [
            Claim("kept", 1, "A", 1, "vision-kept"),
            Claim("refused", 2, "A", 1, "refused"),
        ]
        loose = walk_inventory({"A": 1}, claims)
        strict = walk_inventory({"A": 1}, claims, trusted_only=True)
        self.assertEqual(loose.first_inconsistent_step, 2)
        self.assertIsNone(strict.first_inconsistent_step)
        self.assertTrue(any("refused" in note for note in strict.skipped))
        self.assertTrue(any("trusted_only=False" in note for note in strict.skipped))

    def test_a_claim_with_no_step_is_skipped_and_named(self) -> None:
        report = walk_inventory({"A": 1}, [Claim("floating", None, "A", 1)])
        self.assertEqual(report.claims_walked, 0)
        self.assertEqual(len(report.skipped), 1)
        self.assertIn("floating", report.skipped[0])
        self.assertIn("no printed step number", report.skipped[0])

    def test_a_claim_with_no_element_is_skipped_and_named(self) -> None:
        report = walk_inventory({"A": 1}, [Claim("unidentified", 4, None, 2)])
        self.assertEqual(report.claims_walked, 0)
        self.assertIn("no claimed element", report.skipped[0])


class RefusalTests(unittest.TestCase):
    def test_a_duplicate_callout_is_refused_by_name(self) -> None:
        with self.assertRaises(ValueError) as caught:
            walk_inventory({"A": 5}, [Claim("dup", 1, "A", 1), Claim("dup", 2, "A", 1)])
        self.assertIn("dup", str(caught.exception))
        self.assertIn("De-duplicate", str(caught.exception))

    def test_a_negative_quantity_is_refused_by_name(self) -> None:
        with self.assertRaises(ValueError) as caught:
            walk_inventory({"A": 5}, [Claim("bad", 1, "A", -2)])
        self.assertIn("bad", str(caught.exception))
        self.assertIn("repeat multiplier", str(caught.exception))

    def test_a_step_number_below_one_is_refused_by_name(self) -> None:
        with self.assertRaises(ValueError) as caught:
            walk_inventory({"A": 5}, [Claim("zeroth", 0, "A", 1)])
        self.assertIn("zeroth", str(caught.exception))
        self.assertIn("must carry None", str(caught.exception))

    def test_a_fractional_inventory_count_is_refused_by_name(self) -> None:
        with self.assertRaises(ValueError) as caught:
            walk_inventory({"A": 1.5}, [])  # type: ignore[dict-item]
        self.assertIn("'A'", str(caught.exception))
        self.assertIn("back-matter inventory", str(caught.exception))

    def test_scoring_no_clusters_is_refused_rather_than_reported_as_perfect(self) -> None:
        with self.assertRaises(ValueError) as caught:
            narrowing_score([])
        self.assertIn("read as a perfect reduction", str(caught.exception))


class ClusterTests(unittest.TestCase):
    def test_a_cluster_the_inventory_cannot_supply_is_refuted_without_order(self) -> None:
        cluster = Cluster(index=7, demand=2, callout_keys=("a", "b"), shortlist=("A",))
        found = infeasible_clusters({"A": 1}, [cluster], {7: "A"}, {7: 10})
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0].callout_keys, ("a", "b"))
        self.assertIn("cluster merged drawings", found[0].reason)

    def test_a_cluster_the_inventory_can_supply_is_left_alone(self) -> None:
        cluster = Cluster(index=7, demand=2, callout_keys=("a", "b"), shortlist=("A",))
        self.assertEqual(infeasible_clusters({"A": 2}, [cluster], {7: "A"}, {7: 10}), ())

    def test_each_filter_removes_what_it_claims_to(self) -> None:
        inventory = {"tooFew": 1, "exact": 2, "plenty": 9}
        cluster = Cluster(
            index=0, demand=2, callout_keys=("a", "b"), shortlist=("tooFew", "plenty")
        )
        residue = consumed_before(
            [Claim("elsewhere", 1, "plenty", 8, "vision-kept")],
            step_number=5,
            exclude=frozenset(cluster.callout_keys),
        )
        narrowing = narrow_cluster(
            inventory, ("tooFew", "exact", "plenty"), cluster, 5, residue
        )
        self.assertEqual(narrowing.capacity_survivors, ("exact", "plenty"))
        self.assertEqual(narrowing.exact_survivors, ("exact",))
        self.assertEqual(narrowing.ordered_survivors, ("exact",))
        self.assertEqual(narrowing.shortlist_capacity_survivors, ("plenty",))
        self.assertEqual(narrowing.shortlist_exact_survivors, ())

    def test_the_cluster_does_not_deplete_itself(self) -> None:
        """A cluster's own earlier claims must not eliminate its own element."""

        cluster = Cluster(index=0, demand=2, callout_keys=("a", "b"), shortlist=("A",))
        residue = consumed_before(
            [Claim("a", 1, "A", 1, "vision-kept")],
            step_number=5,
            exclude=frozenset(cluster.callout_keys),
        )
        narrowing = narrow_cluster({"A": 2}, ("A",), cluster, 5, residue)
        self.assertEqual(narrowing.ordered_survivors, ("A",))

    def test_an_untrusted_spender_does_not_eliminate_a_candidate(self) -> None:
        residue = consumed_before([Claim("x", 1, "A", 5, "refused")], step_number=9)
        self.assertEqual(residue["A"], 0)

    def test_a_ground_truth_label_absent_from_the_coverage_says_why(self) -> None:
        import booklet_depletion_report as report_module

        report = walk_inventory({"A": 1}, [Claim("unrelated", 1, "A", 1)])
        score = report_module.localisation_score(report, {"unrelated": Claim("x", 1, "A", 1)})
        self.assertEqual(score["presentInCoverage"], 0)
        self.assertTrue(
            all("not a part-art claim in this coverage" in row["note"] for row in score["labels"])
        )


@unittest.skipUnless(
    artifacts_match_pins(),
    "the retained identification and coverage artifacts are absent or no longer hash to the "
    "digests in PINNED, so the live numbers below describe a different set of drawings. Re-run "
    "`python -B scripts/booklet_depletion_report.py` and re-pin.",
)
class LiveBookletTests(unittest.TestCase):
    """The measured position, pinned so a regression in it is visible."""

    @classmethod
    def setUpClass(cls) -> None:
        import booklet_depletion_report as report_module

        inventory_raw = json.loads(INVENTORY.read_text(encoding="utf-8"))
        cls.inventory = {e: int(v["quantity"]) for e, v in inventory_raw.items()}
        cls.claims = report_module.claims_from_coverage(
            json.loads(COVERAGE.read_text(encoding="utf-8"))
        )
        cls.clusters, _ = report_module.clusters_from_match(
            json.loads(MATCH.read_text(encoding="utf-8")),
            json.loads(FEATURES.read_text(encoding="utf-8")),
        )

    def test_the_printed_inventory_is_276_elements_and_1465_pieces(self) -> None:
        self.assertEqual(len(self.inventory), 276)
        self.assertEqual(sum(self.inventory.values()), 1465)

    def test_the_first_inconsistent_printed_step_is_13(self) -> None:
        report = walk_inventory(self.inventory, list(self.claims))
        self.assertEqual(report.first_inconsistent_step, 13)
        self.assertEqual(report.overdrafts[0].callout_keys, ("p17|q1|x46.591|y469.673",))
        self.assertEqual(report.overdrafts[0].element_id, "4166619")

    def test_the_trusted_only_walk_breaks_at_the_same_step(self) -> None:
        """A weaker trust rule cannot rescue it, which is what makes it a defect."""

        report = walk_inventory(self.inventory, list(self.claims), trusted_only=True)
        self.assertEqual(report.first_inconsistent_step, 13)
        self.assertEqual(report.overdrafts[0].callout_keys, ("p17|q1|x46.591|y469.673",))
        self.assertEqual(report.pieces_overdrawn, 28)

    def test_the_published_claims_overdraw_167_pieces_and_leave_177(self) -> None:
        report = walk_inventory(self.inventory, list(self.claims))
        self.assertEqual(report.pieces_overdrawn, 167)
        self.assertEqual(report.pieces_left_over, 177)
        self.assertEqual(len(report.overdrafts), 94)

    def test_35_clusters_demand_more_than_their_element_holds(self) -> None:
        by_key = {c.callout_key: c for c in self.claims}
        assignment = {}
        first_steps = {}
        for cluster in self.clusters:
            claimed = {
                by_key[k].element_id for k in cluster.callout_keys if by_key[k].element_id
            }
            if len(claimed) == 1:
                assignment[cluster.index] = next(iter(claimed))
            steps = [
                by_key[k].step_number
                for k in cluster.callout_keys
                if by_key[k].step_number is not None
            ]
            first_steps[cluster.index] = min(steps) if steps else None
        refuted = infeasible_clusters(self.inventory, self.clusters, assignment, first_steps)
        self.assertEqual(len(refuted), 35)
        self.assertIn(1, {c.index for c in refuted})

    def test_the_refused_pair_at_steps_5_and_7_is_one_two_piece_cluster(self) -> None:
        by_key = {c.callout_key: c for c in self.claims}
        holders = [
            c
            for c in self.clusters
            if "p12|q1|x108.829|y453.870" in c.callout_keys
            or "p13|q1|x83.311|y434.390" in c.callout_keys
        ]
        self.assertEqual(len(holders), 1)
        cluster = holders[0]
        self.assertEqual(cluster.demand, 2)
        self.assertEqual(
            sorted(by_key[k].step_number for k in cluster.callout_keys), [5, 7]
        )
        # Every element on its published shortlist fails the exact-demand filter,
        # so the drawing's identity is not on its own shortlist.
        narrowing = narrow_cluster(
            self.inventory, tuple(self.inventory), cluster, 5, consumed_before([], 5)
        )
        self.assertEqual(narrowing.shortlist_exact_survivors, ())
        self.assertEqual(self.inventory["302028"], cluster.demand)

    def test_the_refusals_are_still_refusals(self) -> None:
        """Nothing in this module may promote a refused callout to an identity."""

        by_key = {c.callout_key: c for c in self.claims}
        for key in ("p12|q1|x108.829|y453.870", "p13|q1|x83.311|y434.390"):
            self.assertEqual(by_key[key].confidence, "refused")

    def test_the_four_known_mis_read_labels_are_gone_from_the_current_coverage(self) -> None:
        import booklet_depletion_report as report_module

        keys = {c.callout_key for c in self.claims}
        for key in report_module.KNOWN_MISREAD_MULTIPLIER_LABELS:
            self.assertNotIn(key, keys)


@unittest.skipUnless(
    PRE_FIX_COVERAGE.is_file()
    and "sha256:" + hashlib.sha256(PRE_FIX_COVERAGE.read_bytes()).hexdigest() == PRE_FIX_DIGEST
    and artifacts_match_pins(),
    "the retained pre-fix coverage is absent or no longer hashes to PRE_FIX_DIGEST, so the walk "
    "cannot be scored against the four mis-read multiplier labels. Restore the retained history "
    "artifact, or drop this ground-truth check rather than weakening it.",
)
class GroundTruthLocalisationTests(unittest.TestCase):
    """Score the pure walk against a historical defect whose answer is known.

    The four labels were resolved by a hand read of the printed pages, so this is
    a real test of the method and not of its own output. It measures a limit, and
    the limit is the point: the walk narrows, it does not localise.
    """

    @classmethod
    def setUpClass(cls) -> None:
        import booklet_depletion_report as report_module

        cls.module = report_module
        inventory_raw = json.loads(INVENTORY.read_text(encoding="utf-8"))
        inventory = {e: int(v["quantity"]) for e, v in inventory_raw.items()}
        claims = report_module.claims_from_coverage(
            json.loads(PRE_FIX_COVERAGE.read_text(encoding="utf-8"))
        )
        cls.report = walk_inventory(inventory, claims)
        cls.by_key = {c.callout_key: c for c in claims}

    def test_all_four_labels_are_part_art_claims_in_this_coverage(self) -> None:
        score = self.module.localisation_score(self.report, self.by_key)
        self.assertEqual(score["presentInCoverage"], 4)

    def test_no_overdraft_blames_any_of_the_four(self) -> None:
        """Each sits early in its element's run, so a later claim takes the blame."""

        score = self.module.localisation_score(self.report, self.by_key)
        self.assertEqual(score["blamedByAnOverdraft"], 0)

    def test_all_four_land_inside_a_suspect_set(self) -> None:
        score = self.module.localisation_score(self.report, self.by_key)
        self.assertEqual(score["insideASuspectSet"], 4)
        self.assertEqual(score["calloutsInsideASuspectSet"], 349)
        self.assertEqual(score["calloutsWalked"], 878)

    def test_the_pre_fix_walk_broke_at_printed_step_7(self) -> None:
        """One of the two callouts pair judging later refused, found by inventory alone."""

        self.assertEqual(self.report.first_inconsistent_step, 7)
        self.assertEqual(self.report.overdrafts[0].callout_keys, ("p13|q1|x83.311|y434.390",))


@unittest.skipUnless(
    ACTION_LEDGER.is_file() and OFFICIAL_MODEL.is_file() and artifacts_match_pins(),
    "the emitted action ledger or the official model export is absent, so the walk's narrowed "
    "candidate for the refused pair cannot be corroborated against what the official program "
    "places at those steps. Re-run the real-build action ledger.",
)
class BuilderCutCorroborationTests(unittest.TestCase):
    """A second, independent source for the walk's narrowed candidate.

    The walk narrows printed steps 5 and 7 to one element by inventory alone.
    This checks that source against another: the official Builder cut for those
    steps, minus the identities its trusted callouts already took, leaves exactly
    one Brick each, and the model export says what it is. Corroboration only; it
    settles nothing about the refusal, which stands.
    """

    @classmethod
    def setUpClass(cls) -> None:
        ledger = json.loads(ACTION_LEDGER.read_text(encoding="utf-8"))
        cls.refusals = {
            row["calloutKey"]: row["brickRef"]
            for row in ledger.get("provenance", {}).get("refusals", [])
        }
        cls.bricks = official_bricks(OFFICIAL_MODEL.read_bytes())

    def test_both_refused_callouts_were_cut_to_the_same_element(self) -> None:
        seen = set()
        for key in ("p12|q1|x108.829|y453.870", "p13|q1|x83.311|y434.390"):
            self.assertIn(key, self.refusals, f"{key} is not a recorded ledger refusal")
            record = self.bricks[self.refusals[key]]
            seen.add((record["designId"], record["elementIds"]))
        self.assertEqual(seen, {("3020", ("302028",))})

    def test_that_element_is_the_one_the_inventory_walk_leaves_standing(self) -> None:
        inventory_raw = json.loads(INVENTORY.read_text(encoding="utf-8"))
        self.assertEqual(inventory_raw["302028"]["partNum"], "3020")
        self.assertEqual(int(inventory_raw["302028"]["quantity"]), 2)


if __name__ == "__main__":
    unittest.main()
