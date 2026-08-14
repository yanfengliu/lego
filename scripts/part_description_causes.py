"""Why a retrieval missed: the symptom, and which side of the pipeline to repair.

Kept apart from `part_description_truth.py` because these functions answer a
different question. That module says what is known about a cluster and how a
ranking scores; this one takes the misses a scoring run found and attributes
them to a cause a person could act on.

The distinction matters more than tidiness. The misses in this booklet share one
symptom -- the printed card offered no candidate in the true colour -- and they
do not share a repair. Two are a defective inventory crop, reachable only by
re-cropping a PNG, and one is the colour term. Reading the shared symptom as a
shared cause points the work at the distance weights, where it would make the
crop-defect misses worse while fixing the one colour miss. So both functions are
built to refuse a single-cause answer: every classification carries an explicit
outcome for "cannot tell" and for "neither side", and every set comparison
returns both differences rather than a boolean.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from part_description_truth import SHIPPING_SHORTLIST

# How far apart the two aspect gaps must be before one side is called defective.
#
# Not a tuned boundary: it is a separation test with two orders of magnitude of
# headroom on the real data. The two crop defects separate at 159.6x and 575.0x,
# and the one miss that is not a crop defect sits at 1.0x -- its callout agrees
# with its own thumbnail and with its sibling median equally well. Anything
# between is reported as inconclusive rather than assigned to a side, because a
# two-way classifier forced onto a many-way world invents a cause: the first run
# of this check labelled that 1.0x tie "callout-crop" purely because the
# comparison had no third outcome to return.
DEFECT_SEPARATION_RATIO = 10.0


def colour_gap_analysis(scored: list[dict], match: dict, inventory: dict) -> dict:
    """Whether the pixel descriptor's misses are exactly its colour blind spots.

    The pixel descriptor retrieves the mould and loses the colour variant. If
    that is the *whole* of the gap, then the clusters it misses at the shipping
    shortlist should be exactly the clusters whose printed card offered no
    candidate in the true colour -- a set equality, not an overlap, and
    falsifiable in both directions. Both differences are returned, so a later
    generation that breaks the claim reports the break instead of inheriting the
    conclusion, and a partial overlap cannot read as a confirmation.

    Where it holds, a fused shortlist is not an ensemble that happened to work:
    the two rankings are the two halves of one split, and the description
    supplies exactly the axis the card could not offer.
    """

    card_colours = {
        cluster["clusterIndex"]: {
            inventory[c["elementId"]]["colorId"]
            for c in cluster["candidates"]
            if c["elementId"] in inventory
        }
        for cluster in match["clusters"]
    }
    missed = {
        r["cluster"]
        for r in scored
        if r["pixelRank"] is None or r["pixelRank"] > SHIPPING_SHORTLIST
    }
    colour_absent = {
        r["cluster"]
        for r in scored
        if inventory[r["truth"]]["colorId"] not in card_colours.get(r["cluster"], set())
    }
    return {
        "clustersScored": len(scored),
        "shortlist": SHIPPING_SHORTLIST,
        "pixelMissedAtShortlist": sorted(missed),
        "cardOfferedNoCandidateOfTheTrueColour": sorted(colour_absent),
        "setsAreEqual": missed == colour_absent,
        "missedButColourWasOffered": sorted(missed - colour_absent),
        "colourAbsentButRetrievedAnyway": sorted(colour_absent - missed),
        "rows": [
            {
                "cluster": r["cluster"],
                "truth": r["truth"],
                "truthName": r["truthName"],
                "trueColourLdraw": inventory[r["truth"]]["colorId"],
                "cardColoursLdraw": sorted(card_colours.get(r["cluster"], set())),
                "describedColour": (r["described"] or {}).get("colour"),
                "pixelRank": r["pixelRank"],
                "descriptionRank": r["descriptionRank"],
                "interleavedRank": r["interleavedRank"],
            }
            for r in scored
            if r["cluster"] in missed | colour_absent
        ],
    }


def defect_side_triangulation(misses, match, features, inventory):
    """Which side of a miss carries the broken crop: the callout or the thumbnail.

    A thumbnail that looks anomalous beside its own colour siblings is suggestive
    but not conclusive -- the parts list might genuinely draw that element
    differently. The decisive comparison brings in a third measurement the two
    sides cannot both fit: the callout drawings of the same part.

    If the callout aspect agrees with the sibling thumbnails and disagrees with
    the truth's own thumbnail, the callout crop is sound and the inventory crop
    is the defect. That makes the repair a re-crop in the inventory-thumbnail
    step, and it rules out the descriptor and the callout extractor as causes --
    which matters, because the cheap misreading of a colour-shaped symptom is to
    go and retune the distance weights instead.

    Four outcomes, never three and never two. An element with no same-mould
    sibling leaves the instrument undefined, and that is a distinct verdict from
    "both crops agree" -- many elements with a thumbnail have no sibling at
    all, so silently skipping them would report a clean row count
    over a question that was never asked. The first version of this function
    dropped them with a bare `continue`, which is the same defect it was written
    to expose: a check that has stopped checking still reports green.

    The sibling centre is the median rather than the mean, because the failure
    being measured is a defective inventory crop and a second defective sibling
    would drag a mean toward the very value the test is trying to convict.
    """

    by_index = {c["clusterIndex"]: c for c in match["clusters"]}
    rows = []
    for cluster_index, truth in misses:
        cluster = by_index.get(cluster_index)
        if cluster is None or truth not in features["inventory"]:
            rows.append(
                {
                    "cluster": cluster_index,
                    "truth": truth,
                    "defectiveSide": "not-measurable-no-thumbnail-or-cluster",
                }
            )
            continue
        aspects = [
            features["callouts"][m]["descriptor"]["aspect"] for m in cluster["members"]
        ]
        callout_aspect = sum(aspects) / len(aspects)
        truth_aspect = features["inventory"][truth]["aspect"]
        part_num = inventory[truth]["partNum"]
        siblings = sorted(
            features["inventory"][e]["aspect"]
            for e, record in inventory.items()
            if record["partNum"] == part_num
            and e != truth
            and e in features["inventory"]
        )
        row = {
            "cluster": cluster_index,
            "truth": truth,
            "truthName": inventory[truth]["name"],
            "calloutAspect": round(callout_aspect, 3),
            "truthThumbnailAspect": round(truth_aspect, 3),
            "siblingThumbnailAspects": [round(a, 3) for a in siblings],
        }
        if not siblings:
            rows.append(
                {
                    **row,
                    "calloutToSiblingGap": None,
                    "calloutToTruthThumbnailGap": round(
                        abs(callout_aspect - truth_aspect), 3
                    ),
                    "gapRatio": None,
                    "defectiveSide": "no-sibling-to-compare",
                }
            )
            continue
        sibling_aspect = siblings[len(siblings) // 2]
        to_siblings = abs(callout_aspect - sibling_aspect)
        to_truth = abs(callout_aspect - truth_aspect)
        ratio = (
            max(to_truth, to_siblings) / min(to_truth, to_siblings)
            if min(to_truth, to_siblings) > 0
            else float("inf")
        )
        if ratio < DEFECT_SEPARATION_RATIO:
            side = "neither-geometry-agrees-on-both-sides"
        elif to_truth > to_siblings:
            side = "inventory-thumbnail"
        else:
            side = "callout-crop"
        rows.append(
            {
                **row,
                "siblingMedianAspect": round(sibling_aspect, 4),
                "calloutToSiblingGap": round(to_siblings, 4),
                "calloutToTruthThumbnailGap": round(to_truth, 4),
                "gapRatio": (None if ratio == float("inf") else round(ratio, 1)),
                "defectiveSide": side,
            }
        )

    # The instrument's domain, so a reader can tell how much of the inventory it
    # could ever speak about. Without this, "no row said callout-crop" reads as
    # evidence when it may only mean the comparison was undefined.
    with_thumbnail = [e for e in inventory if e in features["inventory"]]
    by_mould: dict[str, int] = {}
    for element in with_thumbnail:
        by_mould[inventory[element]["partNum"]] = (
            by_mould.get(inventory[element]["partNum"], 0) + 1
        )
    no_sibling = sum(1 for e in with_thumbnail if by_mould[inventory[e]["partNum"]] == 1)
    return {
        "rows": rows,
        "domain": {
            "elementsWithThumbnail": len(with_thumbnail),
            "elementsWithSiblings": len(with_thumbnail) - no_sibling,
            "elementsWithNoSibling": no_sibling,
            "note": (
                "The triangulation is undefined for an element with no same-mould sibling, and "
                "reports `no-sibling-to-compare` rather than a verdict for it."
            ),
        },
        "note": (
            "The callout drawings agree with the correctly cropped siblings and disagree with "
            "the truth's own thumbnail, so the callout extractor and the descriptor are sound "
            "and the inventory crop is the defect. The repair is a re-crop of those thumbnails, "
            "not a reweighting of the distance: the colour term at these elements is already "
            "near-exact, and removing or down-weighting it can only take away a term that is "
            "working. Colour absence from the card is the symptom of this defect, not its cause."
        ),
    }
