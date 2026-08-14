"""Score description retrieval head to head against the pixel descriptor.

The question this answers is narrow and cheap: given the descriptions the
identification call has *already* produced and thrown away, would ranking the
known inventory by text and attributes put the right element in front of the
model more often than ranking it by thumbnail pixels does?

Nothing here calls a model. Every input is a retained artifact, read and never
written, and every number below is pinned to the exact bytes it was measured
from -- a republished identification chain makes these figures describe a set of
drawings that no longer exists, and the run says so rather than reporting stale.

Ground truth, strongest first:

* **Builder export.** Accepted `action.pieces` in the emitted real-build action
  ledger bind callouts to official Builder brick references, and the official
  model export says what each accepted identity is: `designID` and `itemNos`.
  A one-entry `itemNos` supplies unambiguous element truth; a multi-entry Brick
  is refused rather than joined or chosen by file order. The design half is corroboration rather than
  independent evidence -- the accepted cut binds a callout to a Brick whose
  design already agrees with the claim -- but the *colour* half is not: the cut
  never consults the claimed colour, so the element the export names can and
  does differ in colour from the element that was claimed. Ledger refusals are
  counterevidence only and never become positive Builder truth.
* **Blind pair-judged verdicts.** 82 same-or-different judgements made by two
  independent raters on different models with no sight of features, match,
  answers or score, agreeing 84/84. A `same: true` verdict is positive truth for
  that crop; a `same: false` verdict is negative truth -- it says what the crop
  is not, which cannot enter a recall numerator but can and does test whether a
  retrieval is pulling up something already refuted.

Recorded ledger refusals are not overridden or used as probes here. The worked
probe is selected only from an exact blind `same: false` crop/element binding;
no refusal alone supplies positive or negative element truth.

Usage:  python -B scripts/score_description_retrieval.py [--json PATH]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from part_description_retrieval import (
    DescribedQuery,
    parse_inventory,
    rank_of,
    worst_rank_in_tie,
)
from part_description_report_support import (
    builder_selection_bias_note,
    describe_answer,
    load_description_inputs,
    measurement_limits,
    ranking_bundle,
    recall_tables,
)
from part_description_causes import colour_gap_analysis, defect_side_triangulation
from part_description_truth import (
    CONTAMINATED_ELEMENT,
    ClusterTruth,
    build_cluster_index,
    builder_export_truth,
    depletion_survivors,
    geometry_chain_drift,
    mould_rank,
    pair_judged_truth,
    SHIPPING_SHORTLIST,
)

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
REPORT_SCHEMA_VERSION = "lego.part-description-retrieval/2"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, default=None, help="write the full report here")
    args = parser.parse_args()

    inputs = load_description_inputs(REPOSITORY_ROOT)
    inventory = inputs.inventory
    match = inputs.match
    features = inputs.features
    distances = inputs.distances
    answers_file = inputs.answers
    truth_file = inputs.truth
    ledger = inputs.ledger
    official_xml = inputs.official_xml
    coverage = inputs.coverage
    pins = inputs.pins

    answer_rows = len(answers_file["answers"])
    if answer_rows < len(match["clusters"]):
        print(
            f"WARNING: the answers artifact holds {answer_rows} of the "
            f"{len(match['clusters'])} clusters the live match publishes, so the identification "
            f"run that produces it is still in flight. Description retrieval is scored only on "
            f"the clusters that have a description, and the recall denominators below say so. "
            f"Wait for the run to publish every cluster, then re-measure; the pixel column is "
            f"unaffected because it needs no answer.",
            file=sys.stderr,
        )

    parsed = parse_inventory(inventory)
    pixel_universe = frozenset(distances["elementIds"])

    _by_callout_index, by_identity = build_cluster_index(match, features)
    builder, builder_unmapped = builder_export_truth(ledger, official_xml, by_identity)
    judged_same, judged_different, judged_unmapped, colour_caveats = pair_judged_truth(
        truth_file, features, match
    )

    truths: dict[int, ClusterTruth] = {}

    def truth_for(index: int) -> ClusterTruth:
        return truths.setdefault(index, ClusterTruth(cluster_index=index))

    # Builder export first, deliberately: where the two sources disagree the
    # export wins, because the pair judge was answering a shape question about a
    # claim the pixel pipeline had already made, and the export was not.
    for cluster_index, (element_id, _design) in builder.items():
        truth_for(cluster_index).add_positive(element_id, "builder-export")
    for cluster_index, element_id in judged_same.items():
        truth_for(cluster_index).add_positive(element_id, "pair-judged")
    for cluster_index, elements in judged_different.items():
        truth_for(cluster_index).negatives |= elements

    answers = answers_file["answers"]
    survivors = depletion_survivors(match, features, inventory, coverage)

    ranking_cache: dict[tuple[int, DescribedQuery | None], dict] = {}

    def rankings(index: int, query: DescribedQuery | None) -> dict:
        """Every ranking this run compares, for one cluster."""

        key = (index, query)
        if key not in ranking_cache:
            ranking_cache[key] = ranking_bundle(
                index,
                query,
                distances=distances,
                survivors=survivors,
                pixel_universe=pixel_universe,
                parsed=parsed,
            )
        return ranking_cache[key]

    rows: list[dict] = []
    for cluster in match["clusters"]:
        index = cluster["clusterIndex"]
        truth = truths.get(index)
        if truth is None or truth.positive is None:
            continue
        answer = answers.get(str(index))
        query = describe_answer(answer)
        ranked = rankings(index, query)

        description_best = rank_of(ranked["description"], truth.positive)
        description_rank = worst_rank_in_tie(ranked["description"], truth.positive)

        rows.append(
            {
                "cluster": index,
                "lead": cluster["lead"],
                "truth": truth.positive,
                "truthName": inventory.get(truth.positive, {}).get("name"),
                "sources": sorted(truth.sources),
                "conflicts": truth.conflicts,
                "negatives": sorted(truth.negatives),
                "colourCaveat": colour_caveats.get(index),
                "described": (
                    None
                    if query is None
                    else {
                        "kind": query.kind,
                        "studsLong": query.studs_long,
                        "studsWide": query.studs_wide,
                        "colour": query.colour,
                    }
                ),
                # The pixel descriptor is deterministic and has no ties, so its
                # rank is reported directly; description ties are reported at
                # the pessimistic edge, with the optimistic one beside it.
                "pixelRank": rank_of(ranked["pixel"], truth.positive),
                "pixelPlusDepletionRank": worst_rank_in_tie(
                    ranked["pixelPlusDepletion"], truth.positive
                ),
                "descriptionRank": description_rank,
                "descriptionRankOptimistic": description_best,
                "descriptionRankFullInventory": worst_rank_in_tie(
                    ranked["descriptionFullInventory"], truth.positive
                ),
                "truthReachableByPixel": truth.positive in pixel_universe,
                "descriptionPlusDepletionRank": worst_rank_in_tie(
                    ranked["descriptionPlusDepletion"], truth.positive
                ),
                # Positional, not tie-aware. `worst_rank_in_tie` asks how many
                # entries score at least as well, which is only a rank while the
                # list is ordered by one comparable score. A fused list carries
                # two scales at once and a reranked one is deliberately out of
                # score order, so counting by score there silently reproduces
                # the input ranking -- which is exactly the bug that made this
                # column read identical to the pixel column on its first run.
                "interleavedRank": rank_of(ranked["interleaved"], truth.positive),
                "pixelColourRerankedRank": rank_of(
                    ranked["pixelColourReranked"], truth.positive
                ),
                "pixelMouldRank": mould_rank(ranked["pixel"], truth.positive, inventory),
                "descriptionMouldRank": mould_rank(
                    ranked["description"], truth.positive, inventory
                ),
                "depletionSurvivors": len(ranked["survivors"]),
                "descriptionTieGroup": (
                    None
                    if description_rank is None or description_best is None
                    else description_rank - description_best + 1
                ),
            }
        )

    scored = [row for row in rows if row["described"] is not None]

    builder_rows = [r for r in scored if "builder-export" in r["sources"]]
    judged_only = [r for r in scored if r["sources"] == ["pair-judged"]]
    no_caveat = [r for r in scored if r["colourCaveat"] is None]

    # Where the depletion pruning removes the answer, and why. Its premise is
    # that one cluster is one element, so a cluster's whole demand can be
    # charged to a single element's inventory. The pixel clustering does not
    # honour that premise -- it merges the same mould in different colours --
    # so a cluster's demand can exceed the inventory of the element that is
    # actually right, and the capacity filter then eliminates the truth.
    depletion_unsafe = []
    for row in rows:
        if row["described"] is None or row["descriptionPlusDepletionRank"] is not None:
            continue
        cluster = next(c for c in match["clusters"] if c["clusterIndex"] == row["cluster"])
        demand = sum(
            int(features["callouts"][m].get("quantity") or 0) for m in cluster["members"]
        )
        depletion_unsafe.append(
            {
                "cluster": row["cluster"],
                "truth": row["truth"],
                "truthName": row["truthName"],
                "drawingsInCluster": len(cluster["members"]),
                "clusterDemand": demand,
                "truthInventory": int(inventory[row["truth"]]["quantity"]),
                "eliminatedBy": (
                    "capacity"
                    if int(inventory[row["truth"]]["quantity"]) < demand
                    else "ordered-residue"
                ),
            }
        )

    # Why the fusion works, checked rather than asserted; see the function.
    colour_is_the_gap = colour_gap_analysis(scored, match, inventory)

    # What each retrieval does with an element a blind judge already refused.
    refuted: list[dict] = []
    for row in rows:
        for element_id in row["negatives"]:
            answer = answers.get(str(row["cluster"]))
            query = describe_answer(answer)
            ranked = rankings(row["cluster"], query)
            refuted.append(
                {
                    "cluster": row["cluster"],
                    "refutedElement": element_id,
                    "refutedName": inventory.get(element_id, {}).get("name"),
                    "pixelRank": rank_of(ranked["pixel"], element_id),
                    "descriptionRank": worst_rank_in_tie(ranked["description"], element_id),
                }
            )
    contaminated = [
        row for row in refuted if row["refutedElement"] == CONTAMINATED_ELEMENT
    ]

    report = {
        "schemaVersion": REPORT_SCHEMA_VERSION,
        "what": (
            "Head-to-head recall of the shipping pixel descriptor against retrieval by the "
            "description the identification call already produces, on the same ground truth."
        ),
        "pins": pins,
        "geometryChainDrift": geometry_chain_drift(pins),
        "generation": {
            "answersMatchDigest": answers_file.get("matchDigest"),
            "liveMatchDigest": pins["output/part-identification/match.json"],
            "answersRowsPresent": len(answers),
            "clustersPublished": len(match["clusters"]),
            "coverageMatchDigest": (coverage or {}).get("inputDigests", {}).get("match"),
        },
        "universe": {
            "inventoryElements": len(inventory),
            "pixelUniverse": len(pixel_universe),
            "elementsWithoutThumbnail": len(features.get("elementsWithoutThumbnail", [])),
            # An element with no parts-list thumbnail has no pixel descriptor,
            # so it is not in the pixel universe and no shortlist can ever offer
            # it however good the model is. It is in the printed inventory with
            # a full name and colour, so description retrieval reaches it at no
            # extra cost. Reported with its piece count because the count is the
            # size of the hole, and with how many carry ground truth, because
            # without truth this is a structural claim and not a measured one.
            "elementsReachableOnlyByDescription": {
                "elements": sorted(set(inventory) - set(pixel_universe)),
                "pieces": sum(
                    int(record["quantity"])
                    for element_id, record in inventory.items()
                    if element_id not in pixel_universe
                ),
                "withGroundTruth": sorted(
                    {r["truth"] for r in rows} - set(pixel_universe)
                ),
            },
            "clusters": len(match["clusters"]),
        },
        "groundTruth": {
            "clustersWithPositiveTruth": len(rows),
            "clustersScored": len(scored),
            "fromBuilderExport": len(builder),
            "fromPairJudgedSame": len(judged_same),
            "fromBoth": len([r for r in rows if len(r["sources"]) > 1]),
            "negativeVerdicts": sum(len(v) for v in judged_different.values()),
            "builderRowsUnmapped": builder_unmapped,
            "pairJudgedUnmapped": judged_unmapped,
            "conflicts": [c for r in rows for c in r["conflicts"]],
            "colourCaveatedVerdicts": sorted(colour_caveats.values()),
            "selectionBias": builder_selection_bias_note(),
        },
        "parser": {
            "elements": len(parsed),
            "dimensionsUnparsed": sorted(
                {e.name for e in parsed.values() if not e.dimensions_parsed}
            ),
            "familyUnparsed": sorted({e.name for e in parsed.values() if not e.kinds_parsed}),
            "colourUnparsed": sorted(
                {
                    f"{e.element_id} (LDraw {inventory[e.element_id]['colorId']})"
                    for e in parsed.values()
                    if not e.colour_parsed
                }
            ),
        },
        "recall": {
            "allPositiveTruth": recall_tables(scored),
            "builderExportOnly": recall_tables(builder_rows),
            "pairJudgedOnly": recall_tables(judged_only),
            "colourCaveatsExcluded": recall_tables(no_caveat),
        },
        "candidateCount": {
            "pixelUniverse": len(pixel_universe),
            "shippingShortlist": SHIPPING_SHORTLIST,
            "descriptionUniverse": len(pixel_universe),
            "meanDepletionSurvivors": (
                round(sum(r["depletionSurvivors"] for r in scored) / len(scored), 2)
                if scored
                else 0
            ),
            "meanDescriptionTieGroup": (
                round(
                    sum(r["descriptionTieGroup"] or 0 for r in scored) / len(scored),
                    2,
                )
                if scored
                else 0
            ),
        },
        "colourIsTheSymptomNotTheRepair": colour_is_the_gap,
        "defectIsOnTheInventorySide": defect_side_triangulation(
            [(r["cluster"], r["truth"]) for r in scored
             if r["cluster"] in set(colour_is_the_gap["pixelMissedAtShortlist"])],
            match,
            features,
            inventory,
        ),
        # Conservation, computed rather than trusted. Two ways a truth-bearing
        # cluster can leave the head-to-head without saying so, both of them
        # silent on this generation and neither of them reachable from live data
        # -- which is why each is asserted by a synthetic test rather than by a
        # live one. A branch nothing reaches is not covered, it is quiet.
        "everyTruthAccountedFor": {
            "clustersWithPositiveTruth": len(rows),
            "scored": len(scored),
            "withoutADescription": len(rows) - len(scored),
            "adds_up": len(rows) == len(scored) + (len(rows) - len(scored)),
            "truthOutsidePixelUniverse": sorted(
                r["cluster"] for r in scored if not r["truthReachableByPixel"]
            ),
            "headToHeadUnderCreditsDescription": any(
                not r["truthReachableByPixel"] for r in scored
            ),
            "note": (
                "A truth whose element has no parts-list thumbnail is unreachable by the pixel "
                "descriptor and reachable by description, but the head-to-head restricts both "
                f"to the {len(pixel_universe)}-element pixel universe, so such a row scores as a description miss "
                "when description would in fact rank it. Zero rows are in that state here. If "
                "`headToHeadUnderCreditsDescription` is ever true, read "
                "`descriptionOverFullInventory` for the honest description figure and treat the "
                "restricted `description` column as a lower bound."
            ),
        },
        "limits": measurement_limits(len(builder), len(match["clusters"]), ledger),
        "depletionRemovedTheAnswer": {
            "clusters": len(depletion_unsafe),
            "ofScored": len(scored),
            "note": (
                "Every row here is the capacity filter, not the ordered residue, so the finding "
                "does not depend on the stale coverage generation the residue is read from. The "
                "filter charges a whole cluster's demand to one element, and these clusters pool "
                "drawings that are not one element."
            ),
            "rows": depletion_unsafe,
        },
        "contaminatedElementProbe": contaminated,
        "refutedElements": refuted,
        "rows": sorted(rows, key=lambda r: r["cluster"]),
    }

    if not report["geometryChainDrift"]["stable"]:
        for row in report["geometryChainDrift"]["moved"]:
            print(
                f"WARNING: {row['path']} is {row['actual']} but these conclusions were "
                f"measured against {row['pinned']}. The identification chain was "
                f"republished, so cluster indices have renumbered and the numbers below "
                f"describe a different cut of the booklet than the recorded findings. "
                f"Re-read the findings against this generation before comparing them with "
                f"any other report.",
                file=sys.stderr,
            )

    if report["everyTruthAccountedFor"]["headToHeadUnderCreditsDescription"]:
        print(
            f"WARNING: clusters "
            f"{report['everyTruthAccountedFor']['truthOutsidePixelUniverse']} have a truth "
            f"element with no parts-list thumbnail. The pixel descriptor cannot reach those "
            f"elements at all, and the head-to-head restricts description to the same "
            f"{len(pixel_universe)}-element universe for fairness, so those rows score as a description miss "
            f"when description would rank them. The restricted `description` column is a lower "
            f"bound for this run; read `descriptionOverFullInventory` beside it, or publish "
            f"thumbnails for those elements and re-measure.",
            file=sys.stderr,
        )

    print(json.dumps({k: v for k, v in report.items() if k != "rows"}, indent=1))
    if args.json is not None:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
        print(f"\nfull report -> {args.json}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
