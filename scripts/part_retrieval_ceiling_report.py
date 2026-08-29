"""Measure the authenticated retrieval ceiling and write a digest-bound report."""

from __future__ import annotations

import argparse
import json
import math
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
    distance_terms,
    lead_truth_per_cluster,
    lead_diagnostic_truth,
    merge_truth,
    official_bricks,
    pair_sample_bounds,
    pair_judged_truth,
    rank_lookup,
    recall_at,
    ranked_order,
    weighted_total,
)
from part_retrieval_ceiling_report_inputs import (  # noqa: E402
    RetrievalInputVerificationHooks,
    load_verified_retrieval_inputs,
)
from part_retrieval_work_contract import require_report_comparison_budget  # noqa: E402
from part_retrieval_ceiling_causes import (  # noqa: E402
    ablate,
    attribute_misses,
    triangulate_defect_side,
    elimination_and_colour_blocks,
    lead_representativeness,
    sibling_outliers,
)
from part_identification_report_contract import (  # noqa: E402
    require_adjudication_chain,
    require_identification_chain,
    require_score_summary_chain,
    require_truth_v3,
)
REPORT_SCHEMA_VERSION = "lego.part-retrieval-ceiling/2"
MAX_REPRODUCTION_ABSOLUTE_DEVIATION = 1e-12


def verified_vision_confound(score: dict, score_digest: str) -> dict:
    """Publish only the headline numbers authenticated by exact score replay."""

    first_fifty = score["headline"]["firstFiftyAccuracy"]
    return {
        "status": "exact-recompiled-score-summary",
        "retainedScoreDigest": score_digest,
        "firstFiftyAccuracy": first_fifty["accuracy"],
        "firstFiftyCalloutsJudged": first_fifty["calloutsJudged"],
        "firstFiftyCorrect": first_fifty["correct"],
        "firstFiftyDrawingsJudged": first_fifty["drawingsJudged"],
    }


def require_reproduced_retrieval_inputs(
    worst_absolute_deviation: float, candidate_prefix_reproduced: bool
) -> None:
    """Refuse every metric unless retained rows and displayed candidates reproduce."""

    failures = []
    if (
        not isinstance(worst_absolute_deviation, (int, float))
        or isinstance(worst_absolute_deviation, bool)
        or not math.isfinite(worst_absolute_deviation)
        or worst_absolute_deviation > MAX_REPRODUCTION_ABSOLUTE_DEVIATION
    ):
        failures.append(
            "worstAbsoluteDeviationFromPublishedRows="
            + f"{worst_absolute_deviation!r} exceeds the finite "
            f"{MAX_REPRODUCTION_ABSOLUTE_DEVIATION} tolerance"
        )
    if candidate_prefix_reproduced is not True:
        failures.append(
            f"candidatePrefixReproduced={candidate_prefix_reproduced!r}, required True"
        )
    if failures:
        raise ValueError(
            "retrieval inputs do not reproduce the descriptor function and displayed candidate "
            f"prefix ({'; '.join(failures)}). Regenerate match and distances from the exact "
            "retained features before computing any recall or cause metric."
        )


def verified_rank_rows(
    rows: list[list[float]],
    worst_absolute_deviation: float,
    candidate_prefix_reproduced: bool,
) -> list[list[int]]:
    """Cross the reproduction gate before ranking any retained distance row."""

    require_reproduced_retrieval_inputs(
        worst_absolute_deviation, candidate_prefix_reproduced
    )
    return [rank_lookup(row) for row in rows]


def build_report(quick: bool = False) -> dict:
    inputs = load_verified_retrieval_inputs(
        quick=quick,
        repository_root=REPOSITORY_ROOT,
        hooks=RetrievalInputVerificationHooks(
            require_identification_chain, require_truth_v3, require_adjudication_chain,
            require_score_summary_chain, require_report_comparison_budget,
        ),
    )
    features = inputs.features
    match = inputs.match
    distances = inputs.distances
    score = inputs.score
    resolution = inputs.resolution
    fixture = inputs.truth_fixture
    ledger = inputs.action_ledger
    official_model = inputs.official_model
    digests = inputs.digests
    clusters = match["clusters"]
    element_ids = distances["elementIds"]
    element_index = {element: index for index, element in enumerate(element_ids)}
    inventory_order = [features["inventory"][element] for element in element_ids]
    design_of = {element: resolution[element]["partNum"] for element in resolution}
    held_of = {element: int(resolution[element]["quantity"]) for element in resolution}
    rows = distances["rows"]
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
    try:
        ranks = verified_rank_rows(rows, worst, candidate_prefix_reproduced)
    except ValueError as error:
        raise SystemExit(
            f"could not verify the retrieval-report derivation before scoring: {error}"
        ) from error

    judged, negatives, unbindable = pair_judged_truth(
        fixture["verdicts"], features, clusters, element_ids
    )
    bricks = official_bricks(official_model)
    builder, builder_steps = builder_truth(
        ledger, bricks, features["callouts"], clusters, inventory_order, element_index
    )
    merged, conflicts = merge_truth(builder, judged)
    union = [merged[key] for key in sorted(merged)]
    builder_by_cluster = lead_truth_per_cluster(builder, ranks, element_index)
    # Cause blocks below were designed around the published lead shortlist.
    # Exact Builder and pair records retain their own row for recall, but a non-lead member
    # must not be silently fed back through its cluster lead for attribution.
    lead_diagnostic_union, member_local_omitted = lead_diagnostic_truth(
        union, clusters, features["callouts"]
    )

    report = {
        "schemaVersion": REPORT_SCHEMA_VERSION,
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
            "clustersWithAnyTruth": len({record.cluster_index for record in union}),
            "fromBuilder": len({record.cluster_index for record in builder}),
            "fromPairJudgedOnly": len(
                {record.cluster_index for record in judged}
                - {record.cluster_index for record in builder}
            ),
            "builderCallouts": len(builder),
            "acceptedBuilderUnits": sum(step["acceptedUnits"] for step in builder_steps),
            "acceptedBuilderSteps": builder_steps,
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
                "builder, pairJudged, and union count exact callouts. Builder and pair-judged "
                "ranks are recomputed from each exact member's descriptor; neither rank nor "
                "pieces inherit from its similarity cluster. builderByCluster instead counts "
                "one agreed Builder element per cluster against that cluster's published lead row. "
                "unionDesignLevel scores the same callouts on mould alone, counting any element of the correct "
                "partNum as a hit, so the gap between it and union is what colour costs."
            ),
            "builder": recall_at(builder),
            "builderByCluster": recall_at(builder_by_cluster),
            "builderByClusterDesignLevel": recall_at(
                design_level_records(builder_by_cluster, design_of, element_ids, rows)
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
                    "memberLocalDistanceRow": record.distance_row is not None,
                }
                for record in union
            ]
        },
    }

    # --- bounds over the pair-judged sample, whose selection is unbiased ---
    report["recall"]["pairJudgedSampleBounds"] = pair_sample_bounds(
        judged, negatives, DISPLAYED_K
    )

    colour_absent_block, elimination_block = elimination_and_colour_blocks(
        lead_diagnostic_union, clusters, resolution, held_of
    )
    colour_absent_block["memberLocalRecordsOmitted"] = member_local_omitted
    colour_absent_block["memberLocalNote"] = (
        "Non-lead exact Builder and pair-judged records are scored in recall from their own "
        "descriptor and omitted from this lead-shortlist-only cause block."
    )
    report["colourAbsentFromShortlist"] = colour_absent_block

    # --- is a Builder miss an artefact of the claim-driven within-step pairing? ---
    steps_by_number = {step["stepNumber"]: step for step in builder_steps}
    sensitivity = []
    for record in builder:
        if record.rank is None or record.rank <= DISPLAYED_K:
            continue
        candidates = steps_by_number[record.step_number]["acceptedElements"]
        exact_ranks = rank_lookup(list(record.distance_row or rows[record.cluster_index]))
        best = min(exact_ranks[element_index[element]] for element in candidates)
        sensitivity.append(
            {
                "clusterIndex": record.cluster_index,
                "stepNumber": record.step_number,
                "assignedElementId": record.element_id,
                "assignedRank": record.rank,
                "acceptedStepElements": candidates,
                "bestRankOverTheWholeStepSet": best,
                "missSurvivesEveryAcceptedPairing": best > DISPLAYED_K,
            }
        )
    report["builderMissSensitivity"] = {
        "note": (
            "Which accepted callout gets which accepted official identity can depend on the "
            "claim, so a miss could be a pairing artefact inside that accepted subset. Refused "
            "rows are not positive truth and are excluded from this diagnostic."
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

    report["visionConfound"] = verified_vision_confound(score, digests["score"])

    misses = [
        record
        for record in lead_diagnostic_union
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

    unreachable_misses = [record for record in misses if record.rank is None]
    report["missAttribution"] = attribute_misses(
        report["missAblation"], outliers, unreachable_misses
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
        unreachable_misses,
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
        f"reproduction: worst deviation {report['reproduction']["worstAbsoluteDeviationFromPublishedRows"]:.2e}, "
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
            f"{lead["clustersWithAtLeastOneDivergentMember"]} clusters"
        )
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
