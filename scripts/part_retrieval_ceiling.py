"""Measure the retrieval half of part identification: recall at k, and why it misses.

Identification is retrieval *then* vision. Only the vision half has been scored.
Every callout cluster is ranked against every retained inventory descriptor by
`thumbnailDistance`, and only the nearest six ever reach a card. If the correct
element is not in that six, no model and no prompt can answer correctly, so
recall at six is a hard ceiling on the whole pipeline and every prompt improvement is bounded by it.

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

Two elimination facts need no per-drawing truth at all and cover every retained
cluster: an element with no inventory thumbnail cannot be retrieved by
anything, and a shortlist whose every element holds fewer pieces than the
cluster draws cannot contain a right answer for that cluster.
"""

from __future__ import annotations

import collections
import hashlib
import math
from dataclasses import dataclass
from pathlib import Path

from part_action_ledger_official_contract import official_bricks as canonical_official_bricks
from part_identification_report_contract import read_bounded_bytes, read_json_artifact
from part_retrieval_work_contract import require_retrieval_comparison_budget

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
    data = read_bounded_bytes(path, "Retrieval-ceiling input")
    return "sha256:" + hashlib.sha256(data).hexdigest()


def load_json(path: Path):
    return read_json_artifact(path, "Retrieval-ceiling JSON input")[0]


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
    # Builder and pair truth name one exact crop member, while the published
    # matrix has one row per cluster lead. Retain the member row so downstream
    # mould and miss analyses cannot silently fall back to a different picture.
    distance_row: tuple[float, ...] | None = None


def cluster_of_member(clusters: list[dict]) -> dict[int, int]:
    return {
        member: cluster["clusterIndex"] for cluster in clusters for member in cluster["members"]
    }


def callouts_by_full_digest(callouts: list[dict]) -> dict[str, list[int]]:
    """Part-art callout indexes keyed by exact full crop SHA-256."""

    found: dict[str, list[int]] = collections.defaultdict(list)
    for index, callout in enumerate(callouts):
        if callout.get("evidenceKind") != "part-art":
            continue
        found[callout["sha256"]].append(index)
    return dict(found)


def pair_judged_truth(
    verdicts: list[dict],
    features: dict,
    clusters: list[dict],
    element_ids: list[str],
) -> tuple[list[TruthRecord], list[dict], list[dict]]:
    """Exact judged members as truth; never inherit a cluster lead's ranking."""

    callouts = features["callouts"]
    by_digest = callouts_by_full_digest(callouts)
    membership = cluster_of_member(clusters)
    element_index = {element: index for index, element in enumerate(element_ids)}
    inventory = [features["inventory"][element] for element in element_ids]
    matched_members = sum(
        len(by_digest.get(verdict.get("judgedCropSha256"), ())) for verdict in verdicts
    )
    require_retrieval_comparison_budget(0, matched_members, len(inventory))
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
        for index in indexes:
            cluster_index = membership[index]
            callout = callouts[index]
            try:
                row = tuple(
                    weighted_total(distance_terms(callout["descriptor"], candidate))
                    for candidate in inventory
                )
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError(
                    f"pair-judged crop {verdict['judgedCropSha256']} at feature index {index} "
                    "has no complete exact member descriptor; do not substitute its cluster lead"
                ) from error
            member_ranks = rank_lookup(list(row))
            if not verdict["same"]:
                negatives.append(
                    {
                        "n": verdict["n"],
                        "clusterIndex": cluster_index,
                        "calloutIdentity": callout["identity"],
                        "stepNumber": callout["stepNumber"],
                        "refutedElementId": element,
                        "refutedElementRank": (
                            None if position is None else member_ranks[position]
                        ),
                        "pieces": callout["quantity"],
                        "judgedCropSha256": verdict["judgedCropSha256"],
                    }
                )
                continue
            records.append(
                TruthRecord(
                    source="pair-judged",
                    cluster_index=cluster_index,
                    callout_identity=callout["identity"],
                    element_id=element,
                    rank=None if position is None else member_ranks[position],
                    pieces=callout["quantity"],
                    step_number=callout["stepNumber"],
                    distance_row=row,
                )
            )
    return records, negatives, unbindable


def official_bricks(xml_text: str) -> dict[str, dict]:
    """Compatibility view over the one streamed, bounded official parser."""

    return {
        brick_ref: {
            "design": record["designId"],
            "itemNos": list(record["elementIds"]),
        }
        for brick_ref, record in canonical_official_bricks(xml_text).items()
    }


def builder_truth(
    ledger: dict,
    bricks: dict[str, dict],
    callouts: list[dict],
    clusters: list[dict],
    inventory: list[dict],
    element_index: dict[str, int],
) -> tuple[list[TruthRecord], list[dict]]:
    """Positive truth and diagnostics from accepted direct action pieces only."""

    index_of_identity = {callout["identity"]: index for index, callout in enumerate(callouts)}
    membership = cluster_of_member(clusters)
    member_rows: dict[int, tuple[float, ...]] = {}
    records: list[TruthRecord] = []
    steps: list[dict] = []
    for step in ledger["steps"]:
        # Only accepted direct pieces can become positive Builder truth.
        # Action-ledger /2 refusals carry counterevidence but no typed
        # independent-elimination witness, so even a refusal with a brickRef is
        # deliberately unread here.
        pairs = [
            (piece["calloutKey"], piece["brickRef"])
            for piece in step["action"].get("pieces", [])
        ]
        if not pairs:
            continue
        missing = [(key, brick_ref) for key, brick_ref in pairs if brick_ref not in bricks]
        if missing:
            key, brick_ref = missing[0]
            raise ValueError(
                f"accepted Builder action piece at step {step['stepNumber']} callout {key!r} "
                f"names Brick {brick_ref!r}, which is absent from the exact official-model export. "
                "Restore one reconciled ledger/model closure before scoring."
            )
        ambiguous = [
            (key, brick_ref, bricks[brick_ref]["itemNos"])
            for key, brick_ref in pairs
            if len(bricks[brick_ref]["itemNos"]) != 1
        ]
        if ambiguous:
            key, brick_ref, item_nos = ambiguous[0]
            raise ValueError(
                f"accepted Builder action piece at step {step['stepNumber']} callout {key!r} "
                f"Brick {brick_ref!r} resolves to official itemNos {item_nos!r}. Retrieval truth "
                "requires exactly one element identity; coverage or inventory intersection cannot "
                "choose among multiple official elements."
            )
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
                "scope": "accepted-action-pieces-only",
                "acceptedUnits": len(pairs),
                "acceptedCallouts": len(per_callout),
                "acceptedDesigns": designs,
                "acceptedElements": step_elements,
            }
        )
        for key, brick_refs in per_callout.items():
            index = index_of_identity.get(key)
            if index is None:
                continue
            cluster_index = membership[index]
            elements = sorted({item for brick in brick_refs for item in bricks[brick]["itemNos"]})
            if len(elements) != 1:
                continue
            row = member_rows.get(index)
            if row is None:
                try:
                    row = tuple(
                        weighted_total(distance_terms(callouts[index]["descriptor"], candidate))
                        for candidate in inventory
                    )
                except (KeyError, TypeError, ValueError) as error:
                    raise ValueError(
                        f"accepted Builder callout {key!r} at feature index {index} has no "
                        "complete exact member descriptor; do not substitute its cluster lead"
                    ) from error
                member_rows[index] = row
            element_position = element_index.get(elements[0])
            member_ranks = rank_lookup(list(row))
            records.append(
                TruthRecord(
                    source="builder",
                    cluster_index=cluster_index,
                    callout_identity=key,
                    element_id=elements[0],
                    rank=None if element_position is None else member_ranks[element_position],
                    pieces=callouts[index]["quantity"],
                    step_number=step["stepNumber"],
                    distance_row=row,
                )
            )
    return records, steps


def merge_truth(
    builder: list[TruthRecord], judged: list[TruthRecord]
) -> tuple[dict[tuple[int, str], TruthRecord], list[dict]]:
    """One truth per exact callout, Builder winning; conflicts remain inspectable."""

    merged: dict[tuple[int, str], TruthRecord] = {}
    conflicts: list[dict] = []
    for record in builder:
        merged[(record.cluster_index, record.callout_identity)] = record
    for record in judged:
        key = (record.cluster_index, record.callout_identity)
        held = merged.get(key)
        if held is None:
            merged[key] = record
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


def lead_truth_per_cluster(
    records: list[TruthRecord], lead_ranks: list[list[int]], element_index: dict[str, int]
) -> list[TruthRecord]:
    """One agreed truth element per cluster, scored only on its published lead row."""

    by_cluster: dict[int, list[TruthRecord]] = collections.defaultdict(list)
    for record in records:
        by_cluster[record.cluster_index].append(record)
    result = []
    for cluster_index, cluster_records in sorted(by_cluster.items()):
        cluster_records.sort(key=lambda item: item.callout_identity)
        held = cluster_records[0]
        conflicts = [record for record in cluster_records if record.element_id != held.element_id]
        if conflicts:
            record = conflicts[0]
            raise ValueError(
                f"cluster-level Builder truth conflicts for cluster {cluster_index}: accepted "
                f"callout {held.callout_identity!r} at step {held.step_number!r} names element "
                f"{held.element_id!r}, while accepted callout {record.callout_identity!r} at "
                f"step {record.step_number!r} names element {record.element_id!r}. Refuse "
                "cluster-level scoring until accepted evidence agrees."
            )
        position = element_index.get(held.element_id)
        result.append(
            TruthRecord(
                source="builder-cluster-lead",
                cluster_index=cluster_index,
                callout_identity=f"cluster:{cluster_index}:published-lead",
                element_id=held.element_id,
                rank=None if position is None else lead_ranks[cluster_index][position],
                pieces=sum(record.pieces for record in cluster_records),
                step_number=None,
            )
        )
    return result


def lead_diagnostic_truth(
    records: list[TruthRecord], clusters: list[dict], callouts: list[dict]
) -> tuple[list[TruthRecord], int]:
    """Keep only exact truth records compatible with published-lead diagnostics."""

    index_of_file = {callout["file"]: index for index, callout in enumerate(callouts)}
    lead_identity = {
        cluster["clusterIndex"]: callouts[index_of_file[cluster["lead"]]]["identity"]
        for cluster in clusters
    }
    kept = [
        record
        for record in records
        if record.distance_row is None
        or record.callout_identity == lead_identity.get(record.cluster_index)
    ]
    return kept, len(records) - len(kept)


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


def pair_sample_bounds(
    judged: list[TruthRecord], negatives: list[dict], k: int
) -> dict[str, int | float | None]:
    """Recall interval over exact judged callout members."""

    judged_callouts = {record.callout_identity for record in judged} | {
        row["calloutIdentity"] for row in negatives
    }
    hits = sum(1 for record in judged if record.rank is not None and record.rank <= k)
    unknown = len(
        {row["calloutIdentity"] for row in negatives}
        - {record.callout_identity for record in judged}
    )
    denominator = len(judged_callouts)
    return {
        "drawings": denominator,
        "knownHits": hits,
        "unknownRank": unknown,
        "lowerBoundAtK": hits / denominator if denominator else None,
        "upperBoundAtK": (hits + unknown) / denominator if denominator else None,
    }


def design_level_records(records, design_of, element_ids, rows) -> list[TruthRecord]:
    """The same drawings scored on mould only: the best-ranked same-design element."""

    lifted = []
    for record in records:
        want = design_of.get(record.element_id)
        row = record.distance_row if record.distance_row is not None else rows[record.cluster_index]
        order = ranked_order(row)
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
                distance_row=record.distance_row,
            )
        )
    return lifted
