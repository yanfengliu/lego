"""Why a shortlist missed: defective thumbnails, unrepresentative leads, term ablation.

A recall figure says how often the right element was on the card. This says why
it was not, and each answer is a different repair, so they are measured apart:

* **ablation** — rank the truth again with one distance term's weight removed. A
  miss that a single term causes is a weighting defect; one that survives every
  removal is a defective input.
* **sibling outlier** — two elements sharing a partNum are one mould drawn twice,
  so their inventory silhouettes must agree. One that disagrees has a bad crop,
  and in a group of three or more the odd one out is identifiable rather than
  symmetric. This needs no ground truth at all.
* **lead representativeness** — retrieval ranks one member per cluster. Every
  other member is answered from a shortlist cut for a drawing that is not it, so
  the measure is what changes when a member is ranked on its own descriptor.
"""

from __future__ import annotations

import collections
import math

from part_retrieval_ceiling import (
    DISPLAYED_K,
    DISTANCE_WEIGHTS,
    TERMS,
    distance_terms,
    rank_lookup,
    ranked_order,
    shape_distance,
    weighted_total,
)


def ablate(lead_descriptor: dict, inventory: list[dict], element_index: dict[str, int], element_id):
    """Rank of the truth element with each single term's weight removed."""

    terms = [distance_terms(lead_descriptor, candidate) for candidate in inventory]
    target = element_index[element_id]
    out = {}
    for dropped in ("none", *TERMS):
        weights = dict(DISTANCE_WEIGHTS)
        if dropped != "none":
            weights[dropped] = 0.0
        row = [weighted_total(term, weights) for term in terms]
        out[dropped] = rank_lookup(row)[target]
    out["termsAtTruth"] = {name: round(terms[target][name], 4) for name in TERMS}
    return out


def sibling_outliers(inventory: dict[str, dict], design_of: dict[str, str]) -> list[dict]:
    """Elements whose thumbnail disagrees with other thumbnails of the same mould.

    Two elements that differ only in colour are the same mould drawn twice, so
    their silhouettes must agree. One that does not is a defective crop, and in a
    group of three or more the odd one out is identifiable rather than symmetric.
    """

    groups: dict[str, list[str]] = collections.defaultdict(list)
    for element in inventory:
        groups[design_of[element]].append(element)
    found = []
    for design, elements in sorted(groups.items()):
        if len(elements) < 2:
            continue
        for element in elements:
            nearest = min(
                (
                    shape_distance(inventory[element], inventory[other])
                    + min(
                        1.0,
                        abs(math.log(inventory[element]["aspect"] / inventory[other]["aspect"]))
                        / math.log(3),
                    )
                )
                / 2
                for other in elements
                if other != element
            )
            found.append(
                {
                    "elementId": element,
                    "partNum": design,
                    "siblings": len(elements) - 1,
                    "nearestSiblingDistance": round(nearest, 4),
                    "identifiable": len(elements) >= 3,
                    "boxWidth": inventory[element]["boxWidth"],
                    "boxHeight": inventory[element]["boxHeight"],
                    "aspect": round(inventory[element]["aspect"], 4),
                }
            )
    found.sort(key=lambda row: -row["nearestSiblingDistance"])
    return found


def member_own_top(
    descriptor: dict, inventory_order: list[dict], element_ids: list[str], k: int = DISPLAYED_K
) -> list[str]:
    """The shortlist one drawing would have been given had it been its own lead."""

    row = [weighted_total(distance_terms(descriptor, candidate)) for candidate in inventory_order]
    return [element_ids[index] for index in ranked_order(row)[:k]]


def lead_representativeness(
    features: dict, clusters: list[dict], inventory_order: list[dict], element_ids: list[str]
):
    """How far each cluster's card is from the drawings it is supposed to answer for.

    Retrieval sees one member per cluster: the lead. Every other member is judged
    on a shortlist cut for a drawing that is not it. The measure is what changes
    when a member is ranked on its own descriptor instead.
    """

    callouts = features["callouts"]
    index_of_file = {callout["file"]: index for index, callout in enumerate(callouts)}
    rows = []
    for cluster in clusters:
        lead = index_of_file[cluster["lead"]]
        lead_top = {candidate["elementId"] for candidate in cluster["candidates"][:DISPLAYED_K]}
        divergent = 0
        divergent_pieces = 0
        worst_overlap = DISPLAYED_K
        for member in cluster["members"]:
            if member == lead:
                continue
            own = set(member_own_top(callouts[member]["descriptor"], inventory_order, element_ids))
            overlap = len(own & lead_top)
            worst_overlap = min(worst_overlap, overlap)
            if overlap < DISPLAYED_K:
                divergent += 1
                divergent_pieces += callouts[member]["quantity"]
        descriptors = [callouts[member]["descriptor"] for member in cluster["members"]]
        # A member joins on its distance to the lead alone, so two members can sit
        # twice the join radius apart. The diameter says whether a cluster is one
        # drawing repeated or a chain, and the drawn-size ratio says it in studs:
        # the booklet redraws a part at a fixed scale, so members that differ in
        # linear size are different parts.
        diameter = 0.0
        for left in range(len(descriptors)):
            for right in range(left + 1, len(descriptors)):
                diameter = max(
                    diameter,
                    weighted_total(distance_terms(descriptors[left], descriptors[right])),
                )
        sizes = [math.sqrt(descriptor["pixels"]) for descriptor in descriptors]
        rows.append(
            {
                "clusterIndex": cluster["clusterIndex"],
                "members": len(cluster["members"]),
                "pieces": cluster["pieces"],
                "membersWithDifferentOwnTop6": divergent,
                "piecesOnADivergentMember": divergent_pieces,
                "worstOverlapWithLeadTop6": worst_overlap,
                "diameter": round(diameter, 4),
                "drawnSizeRatio": round(max(sizes) / min(sizes), 4),
            }
        )
    return rows
