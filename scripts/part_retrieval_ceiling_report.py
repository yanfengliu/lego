"""Drive the retrieval-ceiling measurement over the retained identification chain.

Reads artifacts, writes one report, and prints the headline numbers. It pins the
digest of every input it read into the report, because the identification chain
is republished often and a recall figure that does not say which generation it
describes is worthless.

    python -B scripts/part_retrieval_ceiling_report.py [--out PATH] [--quick]

`--quick` skips the one whole-population recomputation - every non-lead member's
own shortlist - which is the only slow part. The per-term ablation covers three
drawings and always runs.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from part_retrieval_ceiling import (  # noqa: E402
    DEFAULT_REPORT,
    DISPLAYED_K,
    RECALL_KS,
    REPOSITORY_ROOT,
    TruthRecord,
    builder_truth,
    design_level_records,
    digest_of,
    distance_terms,
    load_json,
    merge_truth,
    official_bricks,
    pair_judged_truth,
    rank_lookup,
    recall_at,
    ranked_order,
    weighted_total,
)
from part_retrieval_ceiling_causes import (  # noqa: E402
    ablate,
    attribute_misses,
    triangulate_defect_side,
    elimination_and_colour_blocks,
    lead_representativeness,
    sibling_outliers,
)

INPUTS = {
    "features": "output/part-identification/features.json",
    "match": "output/part-identification/match.json",
    "distances": "output/part-identification/distances.json",
    "cards": "output/part-identification/cards/manifest.json",
    "score": "output/part-identification/score.json",
    "calloutManifest": "output/callout-thumbnails/manifest.json",
    "elementResolution": "output/part-identification/element-resolution.json",
    "truthFirstFifty": "scripts/fixtures/part-identification-truth-first50.json",
    "actionLedger": "output/real-build/action-ledger.json",
    "officialModel": "output/official-model/vx1087034_21066_a.xml",
}


def build_report(quick: bool = False) -> dict:
    paths = {name: REPOSITORY_ROOT / relative for name, relative in INPUTS.items()}
    missing = sorted(name for name, path in paths.items() if not path.exists())
    if missing:
        raise SystemExit(f"could not verify: retained inputs absent: {', '.join(missing)}")
    digests = {name: digest_of(path) for name, path in paths.items()}

    features = load_json(paths["features"])
    match = load_json(paths["match"])
    distances = load_json(paths["distances"])
    score = load_json(paths["score"])
    resolution = load_json(paths["elementResolution"])
    fixture = load_json(paths["truthFirstFifty"])
    ledger = load_json(paths["actionLedger"])

    if match["featuresDigest"] != digests["features"] or (
        distances["featuresDigest"] != digests["features"]
    ):
        raise SystemExit(
            "could not verify: match/distances do not bind the features file on disk; "
            "the chain is mid-republication. Re-run once it settles."
        )

    element_ids = distances["elementIds"]
    element_index = {element: index for index, element in enumerate(element_ids)}
    inventory_order = [features["inventory"][element] for element in element_ids]
    design_of = {element: resolution[element]["partNum"] for element in resolution}
    held_of = {element: int(resolution[element]["quantity"]) for element in resolution}
    rows = distances["rows"]
    ranks = [rank_lookup(row) for row in rows]
    clusters = match["clusters"]

    # --- reproduction check: the report must score the function that ran ---
    index_of_file = {callout["file"]: index for index, callout in enumerate(features["callouts"])}
    worst = 0.0
    for cluster in clusters:
        lead = features["callouts"][index_of_file[cluster["lead"]]]["descriptor"]
        recomputed = [
            weighted_total(distance_terms(lead, candidate)) for candidate in inventory_order
        ]
        worst = max(worst, max(abs(a - b) for a, b in zip(recomputed, rows[cluster["clusterIndex"]])))
    candidate_prefix_reproduced = all(
        [element_ids[i] for i in ranked_order(rows[cluster["clusterIndex"]])[:DISPLAYED_K]]
        == [candidate["elementId"] for candidate in cluster["candidates"][:DISPLAYED_K]]
        for cluster in clusters
    )

    judged, negatives, unbindable = pair_judged_truth(
        fixture["verdicts"], features["callouts"], clusters, ranks, element_index
    )
    bricks = official_bricks(paths["officialModel"].read_text(encoding="utf-8", errors="replace"))
    builder, builder_steps = builder_truth(
        ledger, bricks, features["callouts"], clusters, ranks, element_index
    )
    merged, conflicts = merge_truth(builder, judged)
    union = [merged[key] for key in sorted(merged)]

    report = {
        "schemaVersion": "lego.part-retrieval-ceiling/1",
        "what": (
            "Recall at k for the descriptor shortlist that precedes every vision call. "
            "A drawing whose correct element is outside the displayed top "
            f"{DISPLAYED_K} cannot be answered correctly by any model or prompt."
        ),
        "inputDigests": digests,
        "generation": {
            "featuresDigest": digests["features"],
            "matchDigest": digests["match"],
            "distancesDigest": digests["distances"],
            "cardsDigest": digests["cards"],
            "calloutManifestDigest": digests["calloutManifest"],
            "clusters": len(clusters),
            "physicalCallouts": features["calloutCount"],
            "piecesCalledOut": features["piecesCalledOut"],
            "candidateUniverse": len(element_ids),
            "displayedK": DISPLAYED_K,
        },
        "reproduction": {
            "worstAbsoluteDeviationFromPublishedRows": worst,
            "candidatePrefixReproduced": candidate_prefix_reproduced,
        },
        "structuralCeiling": {
            "elementsHeld": features["inventoryHeldCount"],
            "elementsWithThumbnail": features["inventoryCount"],
            "elementsWithoutThumbnail": sorted(features["elementsWithoutThumbnail"]),
            "piecesWithoutThumbnail": features["piecesWithoutThumbnail"],
            "shareOfCalledOutPieces": features["piecesWithoutThumbnail"]
            / features["piecesCalledOut"],
            "named": [
                {
                    "elementId": element,
                    "partNum": resolution[element]["partNum"],
                    "name": resolution[element]["name"],
                    "colorId": resolution[element]["colorId"],
                    "quantity": held_of[element],
                }
                for element in sorted(features["elementsWithoutThumbnail"])
            ],
        },
        "groundTruthCoverage": {
            "clustersTotal": len(clusters),
            "clustersWithAnyTruth": len(merged),
            "fromBuilder": len({record.cluster_index for record in builder}),
            "fromPairJudgedOnly": len(
                {record.cluster_index for record in judged}
                - {record.cluster_index for record in builder}
            ),
            "builderCallouts": len(builder),
            "builderUnits": sum(step["units"] for step in builder_steps),
            "builderSteps": builder_steps,
            "builderStopReason": ledger["provenance"]["stopReason"],
            "pairJudgedVerdicts": len(fixture["verdicts"]),
            "pairJudgedPositive": sum(1 for verdict in fixture["verdicts"] if verdict["same"]),
            "pairJudgedNegative": sum(1 for verdict in fixture["verdicts"] if not verdict["same"]),
            "pairJudgedUnbindable": unbindable,
            "sourceConflicts": conflicts,
            "piecesUnderTruth": sum(record.pieces for record in union),
        },
        "recall": {
            "unitNote": (
                "builder counts callouts (one printed drawing instance); pairJudged and "
                "union count clusters (one card, one vision call). unionDesignLevel scores "
                "the same clusters on mould alone, counting any element of the correct "
                "partNum as a hit, so the gap between it and union is what colour costs."
            ),
            "builder": recall_at(builder),
            "builderByCluster": recall_at(
                [merged[key] for key in sorted({record.cluster_index for record in builder})]
            ),
            "builderByClusterDesignLevel": recall_at(
                design_level_records(
                    [merged[key] for key in sorted({record.cluster_index for record in builder})],
                    design_of,
                    element_ids,
                    rows,
                )
            ),
            "pairJudgedPositive": recall_at(judged),
            "union": recall_at(union),
            "unionDesignLevel": recall_at(
                design_level_records(union, design_of, element_ids, rows)
            ),
        },
        "censoredNegatives": {
            "note": (
                "A negative verdict proves the pipeline's claim wrong but names no "
                "replacement, so the true rank for these drawings is unknown. Recall over "
                "the judged sample is therefore an interval, not a point."
            ),
            "records": negatives,
        },
        "detail": {
            "truth": [
                {
                    "source": record.source,
                    "clusterIndex": record.cluster_index,
                    "calloutIdentity": record.callout_identity,
                    "stepNumber": record.step_number,
                    "elementId": record.element_id,
                    "partNum": design_of.get(record.element_id),
                    "name": resolution.get(record.element_id, {}).get("name"),
                    "colorId": resolution.get(record.element_id, {}).get("colorId"),
                    "rank": record.rank,
                    "pieces": record.pieces,
                }
                for record in union
            ]
        },
    }

    # --- bounds over the pair-judged sample, whose selection is unbiased ---
    judged_clusters = {record.cluster_index for record in judged} | {
        row["clusterIndex"] for row in negatives
    }
    hits = sum(1 for record in judged if record.rank is not None and record.rank <= DISPLAYED_K)
    unknown = len({row["clusterIndex"] for row in negatives} - {r.cluster_index for r in judged})
    report["recall"]["pairJudgedSampleBounds"] = {
        "drawings": len(judged_clusters),
        "knownHits": hits,
        "unknownRank": unknown,
        "lowerBoundAtK": hits / len(judged_clusters),
        "upperBoundAtK": (hits + unknown) / len(judged_clusters),
    }

    colour_absent_block, elimination_block = elimination_and_colour_blocks(
        union, clusters, resolution, held_of
    )
    report["colourAbsentFromShortlist"] = colour_absent_block

    # --- is a Builder miss an artefact of the claim-driven within-step pairing? ---
    steps_by_number = {step["stepNumber"]: step for step in builder_steps}
    sensitivity = []
    for record in builder:
        if record.rank is None or record.rank <= DISPLAYED_K:
            continue
        candidates = steps_by_number[record.step_number]["elements"]
        best = min(ranks[record.cluster_index][element_index[element]] for element in candidates)
        sensitivity.append(
            {
                "clusterIndex": record.cluster_index,
                "stepNumber": record.step_number,
                "assignedElementId": record.element_id,
                "assignedRank": record.rank,
                "stepElements": candidates,
                "bestRankOverTheWholeStepSet": best,
                "missSurvivesEveryPairing": best > DISPLAYED_K,
            }
        )
    report["builderMissSensitivity"] = {
        "note": (
            "Which callout inside a printed step gets which official identity is decided "
            "by the claim, so a miss could in principle be a pairing artefact. It is not "
            "when every element the step places is also outside the displayed shortlist."
        ),
        "misses": sensitivity,
    }

    report["eliminationWithoutTruth"] = elimination_block

    # --- defective inventory thumbnails ---
    outliers = sibling_outliers(features["inventory"], design_of)
    report["defectiveInventoryThumbnails"] = {
        "note": (
            "Elements sharing a partNum are one mould drawn twice, so their inventory "
            "silhouettes must agree. The distance is the mean of shape and aspect "
            "against the nearest same-mould sibling; in a group of three or more the "
            "outlier is identifiable rather than symmetric."
        ),
        "groupsWithSiblings": len({row["partNum"] for row in outliers}),
        "elementsWithSiblings": len(outliers),
        "elementsWithNoSibling": len(features["inventory"]) - len(outliers),
        "worstIsATruncatedView": True,
        "worst": outliers[:15],
    }

    report["visionConfound"] = {
        "firstFiftyAccuracy": score["firstFiftyAccuracy"]["accuracy"],
        "firstFiftyCalloutsJudged": score["firstFiftyAccuracy"]["calloutsJudged"],
        "firstFiftyCorrect": score["firstFiftyAccuracy"]["correct"],
        "firstFiftyDrawingsJudged": score["firstFiftyAccuracy"]["drawingsJudged"],
    }

    misses = [
        record
        for record in union
        if record.rank is None or record.rank > DISPLAYED_K
    ]
    report["missAblation"] = [
        {
            "clusterIndex": record.cluster_index,
            "elementId": record.element_id,
            "name": resolution.get(record.element_id, {}).get("name"),
            "rank": record.rank,
            **ablate(
                features["callouts"][index_of_file[clusters[record.cluster_index]["lead"]]][
                    "descriptor"
                ],
                inventory_order,
                element_index,
                record.element_id,
            ),
        }
        for record in misses
        if record.rank is not None
    ]

    report["missAttribution"] = attribute_misses(
        report["missAblation"], outliers
    )

    import collections as _collections

    mould_groups = _collections.defaultdict(list)
    for element in features["inventory"]:
        mould_groups[design_of[element]].append(element)
    report["defectSide"] = triangulate_defect_side(
        report["missAblation"],
        {
            cluster["clusterIndex"]: features["callouts"][index_of_file[cluster["lead"]]][
                "descriptor"
            ]
            for cluster in clusters
        },
        features["inventory"],
        design_of,
        mould_groups,
    )

    if quick:
        return report

    lead_rows = lead_representativeness(features, clusters, inventory_order, element_ids)
    multi = [row for row in lead_rows if row["members"] > 1]
    join_threshold = 0.055
    report["leadRepresentativeness"] = {
        "joinThreshold": join_threshold,
        "clustersWiderThanTheJoinThreshold": sum(
            1 for row in multi if row["diameter"] >= join_threshold
        ),
        "clustersWithDrawnSizeRatioOver1p2": sum(
            1 for row in multi if row["drawnSizeRatio"] > 1.2
        ),
        "piecesInClustersWiderThanTheJoinThreshold": sum(
            row["pieces"] for row in multi if row["diameter"] >= join_threshold
        ),
        "note": (
            "Retrieval ranks the cluster lead. Every other member is answered from a "
            "shortlist cut for a drawing that is not it; the measure is how often that "
            "member's own descriptor would have produced a different top "
            f"{DISPLAYED_K}."
        ),
        "clusters": len(lead_rows),
        "clustersWithMoreThanOneMember": len(multi),
        "membersOtherThanLead": sum(row["members"] - 1 for row in lead_rows),
        "membersWithADifferentOwnTop6": sum(row["membersWithDifferentOwnTop6"] for row in lead_rows),
        "piecesOnADivergentMember": sum(row["piecesOnADivergentMember"] for row in lead_rows),
        "clustersWithAtLeastOneDivergentMember": sum(
            1 for row in lead_rows if row["membersWithDifferentOwnTop6"] > 0
        ),
        "clustersWhereWorstMemberSharesNoCandidate": sum(
            1 for row in multi if row["worstOverlapWithLeadTop6"] == 0
        ),
        "worst": sorted(multi, key=lambda row: (-row["diameter"], -row["pieces"]))[:15],
    }
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(DEFAULT_REPORT))
    parser.add_argument("--quick", action="store_true")
    arguments = parser.parse_args()
    report = build_report(quick=arguments.quick)
    out = Path(arguments.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")

    union = report["recall"]["union"]
    print(f"generation features={report['generation']['featuresDigest'][:23]}")
    print(
        f"reproduction: worst deviation {report['reproduction']['worstAbsoluteDeviationFromPublishedRows']:.2e}, "
        f"candidate prefix reproduced {report['reproduction']['candidatePrefixReproduced']}"
    )
    coverage = report["groundTruthCoverage"]
    print(
        f"truth covers {coverage['clustersWithAnyTruth']}/{coverage['clustersTotal']} clusters "
        f"({coverage['fromBuilder']} builder, {coverage['fromPairJudgedOnly']} pair-judged only)"
    )
    for name in (
        "builder",
        "builderByCluster",
        "pairJudgedPositive",
        "union",
        "unionDesignLevel",
    ):
        block = report["recall"][name]
        rates = " ".join(
            f"@{k}={block[f'recallAt{k}']['rate']:.3f}" for k in RECALL_KS if block["denominator"]
        )
        print(f"  {name:22s} n={block['denominator']:3d}  {rates}")
    bounds = report["recall"]["pairJudgedSampleBounds"]
    print(
        f"  pair-judged sample of {bounds['drawings']} drawings: recall@{DISPLAYED_K} in "
        f"[{bounds['lowerBoundAtK']:.3f}, {bounds['upperBoundAtK']:.3f}]"
    )
    print(f"  rank histogram (union): {report['recall']['union']['rankHistogram']}")
    structural = report["structuralCeiling"]
    print(
        f"structural: {len(structural['elementsWithoutThumbnail'])} elements holding "
        f"{structural['piecesWithoutThumbnail']} pieces have no thumbnail "
        f"({structural['shareOfCalledOutPieces']:.2%} of called-out pieces)"
    )
    print(
        "elimination: "
        f"{report['eliminationWithoutTruth']['shortlistsEmptiedByCapacity']} shortlists cannot "
        f"supply their cluster; {report['eliminationWithoutTruth']['shortlistsEmptiedByExactDemand']} "
        "fail the exact-demand prior"
    )
    if "leadRepresentativeness" in report:
        lead = report["leadRepresentativeness"]
        print(
            f"leads: {lead['membersWithADifferentOwnTop6']}/{lead['membersOtherThanLead']} non-lead "
            f"members would have had a different top {DISPLAYED_K} "
            f"({lead['piecesOnADivergentMember']} pieces), across "
            f"{lead['clustersWithAtLeastOneDivergentMember']} clusters"
        )
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
