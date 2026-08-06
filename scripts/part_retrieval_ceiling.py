"""Measure the retrieval half of part identification: recall at k, and why it misses.

Identification is retrieval *then* vision. Only the vision half has been scored.
Every callout cluster is ranked against all 265 inventory descriptors by
`thumbnailDistance`, and only the nearest six ever reach a card. If the correct
element is not in that six, no model and no prompt can answer correctly, so
recall at six is a hard ceiling on the whole pipeline and every prompt
improvement is bounded by it.

This module reads retained artifacts and writes one report. It identifies
nothing, republishes nothing, and calls no model: every number is recomputed
from bytes that already exist, and the digests it measured are recorded in the
report so a later reader can tell which generation the numbers describe.

Truth is scarce and each source is biased differently, so the report keeps them
apart rather than averaging them:

* **builder** — the official Builder export resolves each placed piece to a
  designID and itemNos. Over the corroborated printed prefix (the steps the
  retained action ledger assembled before its cursor lost corroboration) this is
  the strongest truth available, and it is independent of the descriptor.
* **pair-judged** — the blind same-or-different verdicts. Their *selection* is
  unbiased (every drawing in printed steps 1..50 was put to a judge), but a
  positive verdict says the pipeline's own claim was right, so positives are
  conditioned on retrieval having already worked, and a negative verdict names
  no replacement. Positives are therefore an upper-biased sample and negatives
  leave the true rank unknown; the report states both bounds.

Two elimination facts need no per-drawing truth at all and cover all 269
clusters: an element with no inventory thumbnail cannot be retrieved by
anything, and a shortlist whose every element holds fewer pieces than the
cluster draws cannot contain a right answer for that cluster.
"""

from __future__ import annotations

import collections
import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REPORT = REPOSITORY_ROOT / "output/part-retrieval-ceiling.json"
RECALL_KS = (1, 3, 6, 10, 25)
DISPLAYED_K = 6

# Frozen copy of DISTANCE_WEIGHTS in scripts/part-thumbnail-image.mjs. Duplicated
# rather than imported because this is Python reading a JavaScript producer; the
# report asserts the recomputed totals reproduce the published distance rows, so
# a weight change here shows up as a reproduction failure rather than silently
# scoring a different function.
DISTANCE_WEIGHTS = {"shape": 0.34, "detail": 0.14, "aspect": 0.14, "colour": 0.32, "ink": 0.06}
TERMS = tuple(DISTANCE_WEIGHTS)


def digest_of(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------
# distance, replicated exactly from part-thumbnail-image.mjs
# --------------------------------------------------------------------------


def shape_distance(left: dict, right: dict) -> float:
    inter = 0
    union = 0
    for a, b in zip(left["grid"], right["grid"]):
        if a < b:
            inter += a
            union += b
        else:
            inter += b
            union += a
    return 1.0 if union == 0 else 1.0 - inter / union


def detail_distance(left: dict, right: dict) -> float:
    total = 0.0
    count = 0
    for lg, rg, ld, rd in zip(left["grid"], right["grid"], left["detail"], right["detail"]):
        if min(lg, rg) / 255.0 < 0.35:
            continue
        total += abs(ld - rd) / 255.0
        count += 1
    return 1.0 if count == 0 else total / count


def colour_distance(left: dict, right: dict) -> float:
    a = left["mean"]
    b = right["mean"]
    mean = math.dist(a, b) / 441
    dominant = math.dist(left["colours"][0]["rgb"], right["colours"][0]["rgb"]) / 441
    face = abs(left["lightFace"] - right["lightFace"]) / 255
    return min(1.0, (mean + dominant + face) / 3)


def distance_terms(left: dict, right: dict) -> dict[str, float]:
    return {
        "shape": shape_distance(left, right),
        "detail": detail_distance(left, right),
        "aspect": min(1.0, abs(math.log(left["aspect"] / right["aspect"])) / math.log(3)),
        "colour": colour_distance(left, right),
        "ink": min(1.0, abs(left["ink"] - right["ink"]) * 2),
    }


def weighted_total(terms: dict[str, float], weights: dict[str, float] = DISTANCE_WEIGHTS) -> float:
    return sum(terms[name] * weights[name] for name in TERMS)


def ranked_order(row: list[float]) -> list[int]:
    """Element indexes best-first, tie-broken by position, as the producer sorts."""

    return sorted(range(len(row)), key=lambda index: (row[index], index))


def rank_lookup(row: list[float]) -> list[int]:
    """One-based rank of every element in one distance row."""

    ranks = [0] * len(row)
    for position, index in enumerate(ranked_order(row)):
        ranks[index] = position + 1
    return ranks


# --------------------------------------------------------------------------
# ground truth
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class TruthRecord:
    """One drawing whose correct element is known, and where retrieval put it."""

    source: str
    cluster_index: int
    callout_identity: str
    element_id: str
    rank: int | None
    pieces: int
    step_number: int | None


def cluster_of_member(clusters: list[dict]) -> dict[int, int]:
    return {
        member: cluster["clusterIndex"] for cluster in clusters for member in cluster["members"]
    }


def callouts_by_short_digest(callouts: list[dict]) -> dict[str, list[int]]:
    """Part-art callout indexes keyed the way the truth fixture keys a verdict."""

    found: dict[str, list[int]] = collections.defaultdict(list)
    for index, callout in enumerate(callouts):
        if callout.get("evidenceKind") != "part-art":
            continue
        found["sha256:" + callout["sha256"][len("sha256:") :][:16]].append(index)
    return dict(found)


def pair_judged_truth(
    verdicts: list[dict],
    callouts: list[dict],
    clusters: list[dict],
    ranks: list[list[int]],
    element_index: dict[str, int],
) -> tuple[list[TruthRecord], list[dict], list[dict]]:
    """Positive verdicts as truth; negatives and unbindable verdicts reported apart."""

    by_digest = callouts_by_short_digest(callouts)
    membership = cluster_of_member(clusters)
    pieces = {cluster["clusterIndex"]: cluster["pieces"] for cluster in clusters}
    records: list[TruthRecord] = []
    negatives: list[dict] = []
    unbindable: list[dict] = []
    for verdict in verdicts:
        indexes = by_digest.get(verdict["judgedCropSha256"])
        if not indexes:
            unbindable.append({"n": verdict["n"], "elementId": verdict["elementId"]})
            continue
        element = verdict["elementId"]
        position = element_index.get(element)
        for cluster_index in sorted({membership[index] for index in indexes}):
            callout = callouts[indexes[0]]
            if not verdict["same"]:
                negatives.append(
                    {
                        "n": verdict["n"],
                        "clusterIndex": cluster_index,
                        "calloutIdentity": callout["identity"],
                        "stepNumber": callout["stepNumber"],
                        "refutedElementId": element,
                        "refutedElementRank": (
                            None if position is None else ranks[cluster_index][position]
                        ),
                        "pieces": pieces[cluster_index],
                    }
                )
                continue
            records.append(
                TruthRecord(
                    source="pair-judged",
                    cluster_index=cluster_index,
                    callout_identity=callout["identity"],
                    element_id=element,
                    rank=None if position is None else ranks[cluster_index][position],
                    pieces=pieces[cluster_index],
                    step_number=callout["stepNumber"],
                )
            )
    return records, negatives, unbindable


def official_bricks(xml_text: str) -> dict[str, dict]:
    """designID and itemNos of every physical Brick in the official export."""

    import re

    found = {}
    for match in re.finditer(
        r'<Brick designID="([^"]+)" itemNos="([^"]+)" uuid="([^"]+)"', xml_text
    ):
        found[match.group(3)] = {
            "design": match.group(1).split(";")[0],
            "itemNos": match.group(2).split(","),
        }
    return found


def builder_truth(
    ledger: dict,
    bricks: dict[str, dict],
    callouts: list[dict],
    clusters: list[dict],
    ranks: list[list[int]],
    element_index: dict[str, int],
) -> tuple[list[TruthRecord], list[dict]]:
    """Per-callout truth over the printed prefix the ledger corroborated.

    The cursor advances by the printed callout quantities alone, so the *set* of
    official identities cut to a printed step owes nothing to any identification
    claim. Which callout inside a step gets which identity does: the assembler
    prefers the claim's design. A step that places one design is therefore exact,
    and a step that places several is recorded with its whole design set so a
    reader can see how much of the pairing rests on the claim.
    """

    index_of_identity = {callout["identity"]: index for index, callout in enumerate(callouts)}
    membership = cluster_of_member(clusters)
    pieces = {cluster["clusterIndex"]: cluster["pieces"] for cluster in clusters}
    refused = collections.defaultdict(list)
    for refusal in ledger["provenance"]["refusals"]:
        if refusal["brickRef"]:
            refused[refusal["stepNumber"]].append((refusal["calloutKey"], refusal["brickRef"]))

    records: list[TruthRecord] = []
    steps: list[dict] = []
    for step in ledger["steps"]:
        pairs = [
            (callout["calloutKey"], brick_ref)
            for callout in step["callouts"]
            for brick_ref in callout["physicalBrickRefs"]
        ]
        pairs.extend(refused.get(step["stepNumber"], []))
        if not pairs:
            continue
        designs = sorted({bricks[brick]["design"] for _, brick in pairs})
        per_callout: dict[str, list[str]] = collections.defaultdict(list)
        for key, brick in pairs:
            per_callout[key].append(brick)
        step_elements = sorted(
            {item for _, brick in pairs for item in bricks[brick]["itemNos"]} & set(element_index)
        )
        steps.append(
            {
                "stepNumber": step["stepNumber"],
                "pageNumber": step["pageNumber"],
                "units": len(pairs),
                "callouts": len(per_callout),
                "designs": designs,
                "elements": step_elements,
                "withinStepAssignmentForced": len(designs) == 1,
            }
        )
        for key, brick_refs in per_callout.items():
            index = index_of_identity.get(key)
            if index is None:
                continue
            cluster_index = membership[index]
            elements = sorted(
                {item for brick in brick_refs for item in bricks[brick]["itemNos"]}
                & set(element_index)
            )
            if len(elements) != 1:
                continue
            records.append(
                TruthRecord(
                    source="builder",
                    cluster_index=cluster_index,
                    callout_identity=key,
                    element_id=elements[0],
                    rank=ranks[cluster_index][element_index[elements[0]]],
                    pieces=pieces[cluster_index],
                    step_number=step["stepNumber"],
                )
            )
    return records, steps


def merge_truth(
    builder: list[TruthRecord], judged: list[TruthRecord]
) -> tuple[dict[int, TruthRecord], list[dict]]:
    """One truth per cluster, Builder winning; disagreements reported, not averaged."""

    merged: dict[int, TruthRecord] = {}
    conflicts: list[dict] = []
    for record in builder:
        merged[record.cluster_index] = record
    for record in judged:
        held = merged.get(record.cluster_index)
        if held is None:
            merged[record.cluster_index] = record
            continue
        if held.element_id != record.element_id:
            conflicts.append(
                {
                    "clusterIndex": record.cluster_index,
                    "calloutIdentity": record.callout_identity,
                    "builderElementId": held.element_id,
                    "pairJudgedElementId": record.element_id,
                }
            )
    return merged, conflicts


# --------------------------------------------------------------------------
# scoring
# --------------------------------------------------------------------------


def recall_at(records, ks=RECALL_KS) -> dict:
    total = len(records)
    out = {
        "denominator": total,
        "unreachable": sum(1 for record in records if record.rank is None),
    }
    for k in ks:
        hits = sum(1 for record in records if record.rank is not None and record.rank <= k)
        out[f"recallAt{k}"] = {"hits": hits, "of": total, "rate": (hits / total) if total else None}
    ranked = [record.rank for record in records if record.rank is not None]
    out["rankHistogram"] = dict(sorted(collections.Counter(ranked).items()))
    out["worstRanks"] = sorted(ranked, reverse=True)[:10]
    return out


def design_level_records(records, design_of, element_ids, rows) -> list[TruthRecord]:
    """The same drawings scored on mould only: the best-ranked same-design element."""

    lifted = []
    for record in records:
        want = design_of.get(record.element_id)
        order = ranked_order(rows[record.cluster_index])
        rank = None
        for position, index in enumerate(order):
            if design_of.get(element_ids[index]) == want:
                rank = position + 1
                break
        lifted.append(
            TruthRecord(
                source=record.source,
                cluster_index=record.cluster_index,
                callout_identity=record.callout_identity,
                element_id=record.element_id,
                rank=rank,
                pieces=record.pieces,
                step_number=record.step_number,
            )
        )
    return lifted
