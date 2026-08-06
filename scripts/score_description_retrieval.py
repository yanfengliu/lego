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

* **Builder export.** The emitted real-build action ledger records, per callout,
  which official Builder identity that piece was cut to, and the official model
  export says what that identity is: `designID` and `itemNos`, and `itemNos` is
  the element. The design half is corroboration rather than independent evidence
  -- the cut binds a callout to a Brick whose design already agrees with the
  claim -- but the *colour* half is not: the cut never consults the claimed
  colour, so the element the export names can and does differ in colour from the
  element that was claimed. Both refused callouts are here too, and their
  identity was reached by elimination inside the step's cut rather than from any
  identification, which makes those two rows fully independent.
* **Blind pair-judged verdicts.** 82 same-or-different judgements made by two
  independent raters on different models with no sight of features, match,
  answers or score, agreeing 84/84. A `same: true` verdict is positive truth for
  that crop; a `same: false` verdict is negative truth -- it says what the crop
  is not, which cannot enter a recall numerator but can and does test whether a
  retrieval is pulling up something already refuted.

The two refusals at printed steps 5 and 7 are not overridden here and cannot be:
this module writes no label, no assignment and no artifact. It reports where the
Builder-export element for those crops lands in each ranking, which is a
measurement about the retrievals, not a verdict about the crops.

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
    DescriptionWeights,
    colour_cost,
    parse_inventory,
    rank_elements,
    rank_of,
    worst_rank_in_tie,
)
from part_description_truth import (
    COLOUR_CAVEAT_NOTE,
    CONTAMINATED_ELEMENT,
    ClusterTruth,
    build_cluster_index,
    builder_export_truth,
    depletion_survivors,
    digest,
    interleave,
    load,
    mould_rank,
    pair_judged_truth,
    pixel_ranking,
    recall_table,
)

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
INVENTORY = REPOSITORY_ROOT / "output/part-identification/element-resolution.json"
MATCH = REPOSITORY_ROOT / "output/part-identification/match.json"
FEATURES = REPOSITORY_ROOT / "output/part-identification/features.json"
DISTANCES = REPOSITORY_ROOT / "output/part-identification/distances.json"
ANSWERS = REPOSITORY_ROOT / "output/part-identification/answers-claude-opus-5.json"
TRUTH = REPOSITORY_ROOT / "scripts/fixtures/part-identification-truth-first50.json"
ACTION_LEDGER = REPOSITORY_ROOT / "output/real-build/action-ledger.json"
OFFICIAL_MODEL = REPOSITORY_ROOT / "output/official-model/vx1087034_21066_a.xml"
COVERAGE = REPOSITORY_ROOT / "output/real-build/catalog-coverage.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, default=None, help="write the full report here")
    args = parser.parse_args()

    inventory = load(INVENTORY)
    match = load(MATCH)
    features = load(FEATURES)
    distances = load(DISTANCES)
    answers_file = load(ANSWERS)
    truth_file = load(TRUTH)
    ledger = load(ACTION_LEDGER)
    official_xml = OFFICIAL_MODEL.read_text(encoding="utf-8", errors="replace")
    coverage = json.loads(COVERAGE.read_text(encoding="utf-8")) if COVERAGE.is_file() else None

    pins = {
        str(path.relative_to(REPOSITORY_ROOT)).replace("\\", "/"): digest(path)
        for path in (
            INVENTORY,
            MATCH,
            FEATURES,
            DISTANCES,
            ANSWERS,
            TRUTH,
            ACTION_LEDGER,
            OFFICIAL_MODEL,
        )
    }

    if answers_file.get("matchDigest") != pins["output/part-identification/match.json"]:
        print(
            f"WARNING: the answers artifact was produced against match "
            f"{answers_file.get('matchDigest')} but the live match is "
            f"{pins['output/part-identification/match.json']}. A cluster index means a "
            f"different drawing in each, so every description below is being compared against "
            f"the wrong cluster. Re-run once the identification chain has settled on one match, "
            f"then re-measure.",
            file=sys.stderr,
        )

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

    by_callout_index, by_identity = build_cluster_index(match, features)
    builder, builder_unmapped = builder_export_truth(ledger, official_xml, by_identity)
    judged_same, judged_different, judged_unmapped, colour_caveats = pair_judged_truth(
        truth_file, features, by_callout_index
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

    def rankings(index: int, query: DescribedQuery | None) -> dict:
        """Every ranking this run compares, for one cluster."""

        pixel = pixel_ranking(distances, index)
        surviving = survivors.get(index, frozenset()) & pixel_universe
        description = (
            rank_elements(query, parsed, DescriptionWeights(), restrict_to=pixel_universe)
            if query is not None
            else []
        )
        # Pixels for the mould, the description for the colour. The pixel
        # descriptor's residual miss on the independent ground truth is almost
        # entirely colour -- it puts the right mould first and the wrong shade of
        # it -- and colour is the one field a describer states in a closed
        # fourteen-word vocabulary. So: keep the pixel order, and move every
        # element whose catalog colour is the colour that was described ahead of
        # every element whose is not. A stable sort, no weight, no new call.
        colour_reranked = sorted(
            pixel,
            key=lambda row: colour_cost(
                None if query is None else query.colour,
                parsed[row[0]].colour if row[0] in parsed else None,
            ),
        )
        return {
            "pixel": pixel,
            "pixelPlusDepletion": [row for row in pixel if row[0] in surviving],
            "description": description,
            "descriptionPlusDepletion": [row for row in description if row[0] in surviving],
            "interleaved": interleave(pixel, description),
            "pixelColourReranked": colour_reranked,
            "survivors": surviving,
        }

    rows: list[dict] = []
    for cluster in match["clusters"]:
        index = cluster["clusterIndex"]
        truth = truths.get(index)
        if truth is None or truth.positive is None:
            continue
        answer = answers.get(str(index))
        query = DescribedQuery.from_answer(answer) if isinstance(answer, dict) else None
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

    def table(subset: list[dict]) -> dict:
        return {
            "pixel": recall_table([r["pixelRank"] for r in subset]),
            "pixelPlusDepletion": recall_table([r["pixelPlusDepletionRank"] for r in subset]),
            "description": recall_table([r["descriptionRank"] for r in subset]),
            "descriptionOptimisticTies": recall_table(
                [r["descriptionRankOptimistic"] for r in subset]
            ),
            "descriptionPlusDepletion": recall_table(
                [r["descriptionPlusDepletionRank"] for r in subset]
            ),
            "interleavedPixelAndDescription": recall_table(
                [r["interleavedRank"] for r in subset]
            ),
            "pixelColourReranked": recall_table(
                [r["pixelColourRerankedRank"] for r in subset]
            ),
            "pixelMouldOnly": recall_table([r["pixelMouldRank"] for r in subset]),
            "descriptionMouldOnly": recall_table([r["descriptionMouldRank"] for r in subset]),
        }

    builder_rows = [r for r in scored if "builder-export" in r["sources"]]
    judged_only = [r for r in scored if r["sources"] == ["pair-judged"]]
    no_caveat = [r for r in scored if r["colourCaveat"] is None]

    # The worked example, asked of both retrievals by name.
    contaminated: list[dict] = []
    refused_keys = {
        row["calloutKey"]: row["stepNumber"]
        for row in ledger.get("provenance", {}).get("refusals", [])
    }
    for callout_key, step_number in refused_keys.items():
        index = by_identity.get(callout_key)
        if index is None:
            contaminated.append({"calloutKey": callout_key, "cluster": None})
            continue
        answer = answers.get(str(index))
        query = DescribedQuery.from_answer(answer) if isinstance(answer, dict) else None
        ranked = rankings(index, query)
        contaminated.append(
            {
                "printedStep": step_number,
                "calloutKey": callout_key,
                "cluster": index,
                "builderExportElement": builder.get(index, (None, None))[0],
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
                "pixelRankOf302028": rank_of(ranked["pixel"], CONTAMINATED_ELEMENT),
                "descriptionRankOf302028": worst_rank_in_tie(
                    ranked["description"], CONTAMINATED_ELEMENT
                ),
                "descriptionRankOf302028Optimistic": rank_of(
                    ranked["description"], CONTAMINATED_ELEMENT
                ),
                "descriptionPlusDepletionRankOf302028": worst_rank_in_tie(
                    ranked["descriptionPlusDepletion"], CONTAMINATED_ELEMENT
                ),
                "interleavedRankOf302028": rank_of(ranked["interleaved"], CONTAMINATED_ELEMENT),
                "pixelTop6": [element for element, _ in ranked["pixel"][:6]],
                "descriptionTop6": [element for element, _ in ranked["description"][:6]],
                "note": (
                    "Reported as a measurement about the two retrievals. The pair-judged "
                    "refusal at this step is not overridden, relabelled or weakened by this "
                    "run, which writes no assignment and no label."
                ),
            }
        )

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

    # What each retrieval does with an element a blind judge already refused.
    refuted: list[dict] = []
    for row in rows:
        for element_id in row["negatives"]:
            answer = answers.get(str(row["cluster"]))
            query = DescribedQuery.from_answer(answer) if isinstance(answer, dict) else None
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

    report = {
        "what": (
            "Head-to-head recall of the shipping pixel descriptor against retrieval by the "
            "description the identification call already produces, on the same ground truth."
        ),
        "pins": pins,
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
            "selectionBias": (
                "The 82 pair-judged verdicts were judged against the claims the pixel "
                "descriptor's own one-to-one assignment produced, so a 'same' verdict is by "
                "construction an element the pixel route had already proposed. That subset "
                "measures the pixel descriptor on the cases where it agreed with a judge, not "
                "on a sample of the booklet, and it favours the pixel route. The Builder "
                "export does not have this shape: it names the element from the official "
                "program, its colour half never consults any claim, and its two refused rows "
                "were reached by elimination inside the printed step's cut."
            ),
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
            "allPositiveTruth": table(scored),
            "builderExportOnly": table(builder_rows),
            "pairJudgedOnly": table(judged_only),
            "colourCaveatsExcluded": table(no_caveat),
        },
        "candidateCount": {
            "pixelUniverse": len(pixel_universe),
            "shippingShortlist": 6,
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
        "limits": {
            "unbiasedTruthCoversOnlyThePrintedPrefix": (
                f"The Builder export is the only unbiased source here and it reaches "
                f"{len(builder)} of {len(match['clusters'])} clusters, all inside printed steps "
                f"1-12, because the action ledger stops being corroborated at step 13. Nothing "
                f"below measures the other clusters against an independent label; the "
                f"pair-judged subset that does reach further is conditioned on the pixel route "
                f"having already proposed the element."
            ),
            "theDescriptionColumnIsModelOutput": (
                "The pixel ranking is deterministic and needs no model call. The description "
                "ranking is derived from provider output, which this repository treats as "
                "untrusted data: it cannot declare itself valid and it varies between runs. A "
                "fused shortlist therefore changes the trust shape of retrieval as well as its "
                "recall -- half the candidates would come from a source that has to be re-earned "
                "on every republication, and the recall figures here describe one generation of "
                "that source. Read recall@6 = 1.000 as 'these two rankings are complementary on "
                "the labels we have', not as 'retrieval is solved'."
            ),
            "descriptionsWereProducedWhileSeeingSixCandidates": (
                "Every description read here came from the shipping prompt, which shows the "
                "query and six pixel-selected candidates before asking for the description. A "
                "description could in principle be pulled toward what was on offer. The two "
                "cases that matter most argue against that here: for the green Plate 2 x 4 and "
                "the green Plate 2 x 10 the call said Green while no green element was on its "
                "shortlist at all."
            ),
        },
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

    print(json.dumps({k: v for k, v in report.items() if k != "rows"}, indent=1))
    if args.json is not None:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
        print(f"\nfull report -> {args.json}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
