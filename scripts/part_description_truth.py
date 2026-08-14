"""Ground truth, rankings and recall for the description-retrieval comparison.

Split out of the driver so each half stays readable: this module owns *what is
known* about a cluster and *how a ranking is scored*, and
`score_description_retrieval.py` owns reading the artifacts and printing the
report. Nothing here writes a file, accepts a candidate, or alters a label.

The two ground-truth sources and why they are not equally strong are described
in the driver's module docstring; the one rule that lives here is the conflict
rule: the first source to claim a cluster keeps it, and the driver adds the
Builder export first, so the export wins and the disagreement is recorded rather
than dropped.
"""

from __future__ import annotations

import collections
import hashlib
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from booklet_depletion_walk import Claim, Cluster, consumed_before, narrow_cluster
from part_action_ledger_official_contract import official_bricks
from part_description_retrieval import rank_of, worst_rank_in_tie
from part_identification_report_contract import require_truth_v3

# The k values both retrievals are reported at. 6 is the shipping shortlist size
# and is not changed by anything here; the rest bracket it so the shape of the
# rank distribution is visible rather than a single pass/fail.
RECALL_K = (1, 3, 6, 10, 25)

# How many candidates the shipping card actually puts in front of the model.
# Read from here rather than written as a 6 at each use so that "the shortlist"
# and "recall at the shortlist" cannot drift apart. Nothing in this comparison
# changes it; it is the number the ceiling is a ceiling at.
SHIPPING_SHORTLIST = 6


# A pair-judged verdict answers "is this the same part?" about two drawings, and
# two of the 82 raters' notes record in words that the two sides are the same
# shape in different colours and were still called same. Those verdicts are
# shape truth, not element truth: as an element label they name the wrong
# colour, which credits a colour-blind retrieval and penalises a colour-aware
# one. They are not dropped -- the run reports which notes this caught and what
# the recall is with and without them, so the catch is auditable rather than a
# silent exclusion.
COLOUR_CAVEAT_NOTE = re.compile(r"colou?r\s+differs", re.I)

# The element the printed inventory holds two of as a Green Plate 2 x 4, whose
# parts-list thumbnail is a contaminated crop: two overlapping plates beside a
# printed "2x" glyph on grey. It is the worked example of a drawing the pixel
# descriptor cannot retrieve, so both retrievals are asked about it by name.
CONTAMINATED_ELEMENT = "302028"


def digest(path: Path) -> str:
    return f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"


def load(path: Path) -> object:
    if not path.is_file():
        raise SystemExit(
            f"{path} is absent, so there is nothing to measure against. This scorer reads "
            f"retained identification artifacts and writes none of them; re-run the chain that "
            f"publishes it, or point --root at the tree that has it."
        )
    return json.loads(path.read_text(encoding="utf-8"))


@dataclass
class ClusterTruth:
    """What is known about one cluster's identity, and who said so."""

    cluster_index: int
    positive: str | None = None
    sources: set[str] = field(default_factory=set)
    negatives: set[str] = field(default_factory=set)
    conflicts: list[str] = field(default_factory=list)

    def add_positive(self, element_id: str, source: str) -> None:
        if self.positive is not None and self.positive != element_id:
            self.conflicts.append(
                f"cluster {self.cluster_index} was given {self.positive} by "
                f"{sorted(self.sources)} and {element_id} by {source}"
            )
            return
        self.positive = element_id
        self.sources.add(source)


def build_cluster_index(match: dict, features: dict) -> tuple[dict[int, int], dict[str, int]]:
    """callout array index -> cluster index, and callout identity -> cluster index."""

    by_callout_index: dict[int, int] = {}
    for cluster in match["clusters"]:
        for member in cluster["members"]:
            by_callout_index[member] = cluster["clusterIndex"]
    callouts = features["callouts"]
    by_identity: dict[str, int] = {}
    for index, cluster_index in by_callout_index.items():
        by_identity[callouts[index]["identity"]] = cluster_index
    return by_callout_index, by_identity


def builder_export_truth(
    ledger: dict, official_xml: str | bytes, by_identity: dict[str, int]
) -> tuple[dict[int, tuple[str, str]], list[str]]:
    """cluster -> (elementId, designId) from accepted Builder action pieces.

    Returns the unmapped callout keys beside it: a ledger piece whose callout is
    not in the live match is a callout the current gallery cut differently, and
    saying so is the point -- an unmapped row is missing truth, not a pass.

    Ledger refusals are counterevidence, never positive truth. Action-ledger /2
    has no typed independent-elimination witness that could prove a refused
    callout's Brick assignment without relying on the rejected claim.
    """

    bricks = official_bricks(official_xml)
    rows: list[tuple[str, str, str]] = []
    for step_index, step in enumerate(ledger.get("steps", [])):
        step_context = (
            f"step {step['stepNumber']}"
            if "stepNumber" in step
            else f"ledger steps[{step_index}]"
        )
        for piece in step["action"].get("pieces", []):
            rows.append((step_context, piece["calloutKey"], piece["brickRef"]))

    truth: dict[int, tuple[str, str]] = {}
    provenance: dict[int, tuple[str, str, str, tuple[str, str]]] = {}
    unmapped: list[str] = []
    for step_number, callout_key, brick_ref in rows:
        cluster_index = by_identity.get(callout_key)
        record = bricks.get(brick_ref)
        if cluster_index is None:
            unmapped.append(callout_key)
            continue
        if record is None:
            raise ValueError(
                f"accepted Builder action piece at {step_number} callout {callout_key!r} names "
                f"Brick {brick_ref!r}, which is absent from the exact official-model export. "
                "Restore one reconciled ledger/model closure before scoring description truth."
            )
        element_ids = record["elementIds"]
        if not isinstance(element_ids, tuple) or len(element_ids) != 1:
            raise ValueError(
                f"accepted Builder action piece at {step_number} callout {callout_key!r} Brick "
                f"{brick_ref!r} resolves to official itemNos {element_ids!r}. Description truth "
                "requires exactly one element identity; it cannot concatenate or choose among "
                "multiple official elements by attribute or file order."
            )
        resolved = (element_ids[0], record["designId"])
        held = provenance.get(cluster_index)
        if held is not None and held[3] != resolved:
            held_step, held_callout, held_brick, held_resolved = held
            raise ValueError(
                f"accepted Builder action pieces conflict for cluster {cluster_index}: "
                f"{held_step} callout {held_callout!r} Brick {held_brick!r} resolves to "
                f"element/design {held_resolved[0]!r}/{held_resolved[1]!r}, but "
                f"{step_number} callout {callout_key!r} Brick {brick_ref!r} resolves to "
                f"{resolved[0]!r}/{resolved[1]!r}. Refuse cluster-level scoring until the "
                "accepted evidence agrees; file order cannot choose truth."
            )
        truth.setdefault(cluster_index, resolved)
        provenance.setdefault(
            cluster_index, (step_number, callout_key, brick_ref, resolved)
        )
    return truth, sorted(set(unmapped))


def pair_judged_truth(
    truth_file: dict, features: dict, match: dict
) -> tuple[dict[int, str], dict[int, set[str]], list[str], dict[int, str]]:
    """Lead-local description truth from exact full crop+element verdicts.

    The answer being scored belongs to the cluster card's lead drawing. A
    verdict for another member remains valid evidence about that exact crop,
    but cannot be promoted into truth for the lead's description.
    """

    require_truth_v3(truth_file)
    callouts = features["callouts"]
    by_crop: dict[str, list[int]] = collections.defaultdict(list)
    by_file: dict[str, list[int]] = collections.defaultdict(list)
    member_cluster: dict[int, int] = {}
    for index, callout in enumerate(callouts):
        by_crop[callout["sha256"]].append(index)
        by_file[callout["file"]].append(index)
    lead_by_cluster: dict[int, int] = {}
    for cluster in match["clusters"]:
        cluster_index = cluster["clusterIndex"]
        for member in cluster["members"]:
            member_cluster[member] = cluster_index
        lead_indexes = by_file.get(cluster["lead"], [])
        if len(lead_indexes) != 1:
            raise ValueError(
                f"cluster {cluster_index} lead {cluster['lead']!r} maps to {len(lead_indexes)} "
                "feature rows; description truth requires one exact card member"
            )
        lead_by_cluster[cluster_index] = lead_indexes[0]

    same: dict[int, str] = {}
    different: dict[int, set[str]] = collections.defaultdict(set)
    unmapped: list[str] = []
    caveats: dict[int, str] = {}
    for verdict in truth_file["verdicts"]:
        matches = by_crop.get(verdict["judgedCropSha256"], [])
        matching_lead_clusters = {
            member_cluster[index]
            for index in matches
            if index in member_cluster
            and lead_by_cluster.get(member_cluster[index]) == index
        }
        if len(matching_lead_clusters) != 1:
            unmapped.append(
                f"n={verdict['n']} {verdict['judgedCropSha256']} "
                f"(exact crop maps to {len(matching_lead_clusters)} distinct current card leads "
                f"across {len(matches)} byte-identical feature rows)"
            )
            continue
        cluster_index = next(iter(matching_lead_clusters))
        if verdict["same"]:
            same[cluster_index] = verdict["elementId"]
            if COLOUR_CAVEAT_NOTE.search(verdict.get("note") or ""):
                caveats[cluster_index] = f"n={verdict['n']}: {verdict['note']}"
        else:
            different[cluster_index].add(verdict["elementId"])
    return same, dict(different), unmapped, caveats


def pixel_ranking(distances: dict, cluster_index: int) -> list[tuple[str, float]]:
    """Every element ordered by the shipping pixel descriptor, nearest first."""

    element_ids = distances["elementIds"]
    row = distances["rows"][cluster_index]
    scored = list(zip(element_ids, row))
    scored.sort(key=lambda pair: (pair[1], pair[0]))
    return scored


def interleave(
    first: list[tuple[str, float]], second: list[tuple[str, float]]
) -> list[tuple[str, float]]:
    """Alternate two rankings, first occurrence wins, duplicates dropped.

    The parameter-free fusion, chosen because it needs no weight between two
    scores that are not on the same scale and cannot be put on one without a
    calibration set -- which would be a knob fitted to the answer. Its top six
    is exactly three from each retrieval, so the shortlist size the pipeline
    ships is unchanged and the comparison stays honest about what it costs: a
    fused shortlist of six shows the model three pixel candidates instead of six.
    """

    fused: list[tuple[str, float]] = []
    seen: set[str] = set()
    for index in range(max(len(first), len(second))):
        for source in (first, second):
            if index < len(source) and source[index][0] not in seen:
                seen.add(source[index][0])
                fused.append(source[index])
    return fused


def depletion_survivors(
    match: dict, features: dict, inventory: dict, coverage: dict | None
) -> dict[int, frozenset[str]]:
    """The elements each cluster's demand and printed position leave standing.

    Reuses `booklet_depletion_walk.narrow_cluster` unchanged, so this is the same
    pruning the shipping walk reports, applied to the generation being scored.
    """

    quantities = {element_id: int(record["quantity"]) for element_id, record in inventory.items()}
    universe = tuple(sorted(quantities))
    callouts = features["callouts"]

    claims: list[Claim] = []
    if coverage is not None:
        for callout_key, row in coverage.get("byCallout", {}).items():
            claims.append(
                Claim(
                    callout_key=callout_key,
                    step_number=row.get("stepNumber"),
                    element_id=row.get("elementId"),
                    quantity=int(row.get("quantity") or 0),
                    confidence=row.get("identificationConfidence"),
                )
            )

    survivors: dict[int, frozenset[str]] = {}
    for cluster in match["clusters"]:
        members = cluster["members"]
        demand = sum(int(callouts[m].get("quantity") or 0) for m in members)
        steps = [callouts[m].get("stepNumber") for m in members]
        steps = [s for s in steps if isinstance(s, int)]
        first_step = min(steps) if steps else None
        own_keys = frozenset(callouts[m]["identity"] for m in members)
        residue = (
            consumed_before(claims, first_step, exclude=own_keys)
            if first_step is not None and claims
            else collections.Counter()
        )
        narrowing = narrow_cluster(
            quantities,
            universe,
            Cluster(index=cluster["clusterIndex"], demand=demand, callout_keys=()),
            first_step,
            residue,
        )
        survivors[cluster["clusterIndex"]] = frozenset(narrowing.ordered_survivors)
    return survivors


def mould_rank(
    ranked: list[tuple[str, float]], truth: str, inventory: dict[str, dict]
) -> int | None:
    """The best rank of any element sharing the truth's part number.

    Scored beside the element rank because the two answer different questions.
    An element is a mould *and* a colour; the pixel descriptor's residual miss on
    the independent ground truth is almost entirely colour, so scoring only at
    element level reads as a shape failure it did not make -- and scoring only at
    mould level hides exactly the failure this comparison is about, since a
    green plate retrieved as its grey twin is the wrong piece to place.
    """

    part_num = inventory.get(truth, {}).get("partNum")
    if part_num is None:
        return None
    for position, (candidate, _) in enumerate(ranked, start=1):
        if inventory.get(candidate, {}).get("partNum") == part_num:
            return position
    return None


def recall_table(ranks: list[int | None]) -> dict[str, float | int]:
    total = len(ranks)
    table: dict[str, float | int] = {"clusters": total}
    for k in RECALL_K:
        hits = sum(1 for rank in ranks if rank is not None and rank <= k)
        table[f"recallAt{k}"] = round(hits / total, 4) if total else 0.0
        table[f"hitsAt{k}"] = hits
    present = sorted(r for r in ranks if r is not None)
    table["notRanked"] = sum(1 for r in ranks if r is None)
    if present:
        table["medianRank"] = present[len(present) // 2]
        table["meanRank"] = round(sum(present) / len(present), 2)
        table["worstRank"] = present[-1]
    return table


# The geometry chain: every input whose bytes decide which drawings exist, how
# they cluster, and what the pixel descriptor says about them. If any of these
# move, the cluster indices renumber and every number measured against them
# describes a set of drawings that no longer exists.
#
# `answers-claude-opus-5.json` is deliberately NOT here. It is the one input a
# concurrent identification run is expected to republish, and it did move during
# this measurement (0f2ffb13 -> 0613481b) while the chain below did not. Pinning
# it would turn an expected republication into a false drift alarm; it is
# checked differently, by requiring its own `matchDigest` to equal the live
# match, which is the property that actually matters for it.
GEOMETRY_CHAIN_PINS = {
    "output/part-identification/element-resolution.json": (
        "sha256:9fb2abe8f764f3381135b378c7940f63b69a77ed0f6db8a8f28ba2d8224b3a30"
    ),
    "output/part-identification/match.json": (
        "sha256:ed0f5102f0759da1b17b3b1cda2873f0fcc25e3ba53d4eb90971666c3a968fda"
    ),
    "output/part-identification/distances.json": (
        "sha256:c9b706b5e1f75bb29100663baaa89b04cea197da50cd3e4581e687cb26b16dca"
    ),
    "output/part-identification/features.json": (
        "sha256:2d687f879f9d9b8ca2ec6a2ae98e56179de54a86ddc1fa715f0114508388506f"
    ),
    "scripts/fixtures/part-identification-truth-first50.json": (
        "sha256:52535395f5612332a966f274b99dfb24fb0150b2ccdab5fc6bd59fe137c596b6"
    ),
    "output/real-build/action-ledger.json": (
        "sha256:872826151c5f4dd57de1b16cce1fc70849d933323e948f7904bb6b1077f7879d"
    ),
    "output/official-model/vx1087034_21066_a.xml": (
        "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922"
    ),
}


def geometry_chain_drift(pins: dict[str, str]) -> dict:
    """Whether this run's inputs are the ones the recorded conclusions describe.

    Reported rather than asserted, and every moved input is named with both
    digests. A run against a drifted chain is not wrong, it is about a different
    booklet cut -- so the honest outcome is "these numbers describe generation
    X", not a failure. Silence would let a reader compare two reports measured
    over different drawings and read the agreement as corroboration.
    """

    moved = []
    for path, expected in GEOMETRY_CHAIN_PINS.items():
        actual = pins.get(path)
        if actual != expected:
            moved.append({"path": path, "pinned": expected, "actual": actual})
    return {
        "stable": not moved,
        "inputsChecked": len(GEOMETRY_CHAIN_PINS),
        "moved": moved,
        "note": (
            "The geometry chain is every input that decides which drawings exist and how they "
            "cluster. It excludes the answers artifact, which a concurrent identification run "
            "is expected to republish and which is checked instead by requiring its own "
            "matchDigest to equal the live match."
        ),
    }
