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

# The k values both retrievals are reported at. 6 is the shipping shortlist size
# and is not changed by anything here; the rest bracket it so the shape of the
# rank distribution is visible rather than a single pass/fail.
RECALL_K = (1, 3, 6, 10, 25)

BRICK_RECORD = re.compile(r'<Brick designID="([^"]+)" itemNos="([^"]+)" uuid="([^"]+)"')

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
    ledger: dict, official_xml: str, by_identity: dict[str, int]
) -> tuple[dict[int, tuple[str, str]], list[str]]:
    """cluster -> (elementId, designId) from the official Builder export.

    Returns the unmapped callout keys beside it: a ledger piece whose callout is
    not in the live match is a callout the current gallery cut differently, and
    saying so is the point -- an unmapped row is missing truth, not a pass.
    """

    bricks = {m.group(3): (m.group(1), m.group(2)) for m in BRICK_RECORD.finditer(official_xml)}
    rows: list[tuple[str, str]] = []
    for step in ledger.get("steps", []):
        for piece in step["action"].get("pieces", []):
            rows.append((piece["calloutKey"], piece["brickRef"]))
    for refusal in ledger.get("provenance", {}).get("refusals", []):
        rows.append((refusal["calloutKey"], refusal["brickRef"]))

    truth: dict[int, tuple[str, str]] = {}
    unmapped: list[str] = []
    for callout_key, brick_ref in rows:
        cluster_index = by_identity.get(callout_key)
        record = bricks.get(brick_ref)
        if cluster_index is None or record is None:
            unmapped.append(callout_key)
            continue
        design_id, item_nos = record
        truth[cluster_index] = (item_nos, design_id.split(";")[0])
    return truth, sorted(set(unmapped))


def pair_judged_truth(
    truth_file: dict, features: dict, by_callout_index: dict[int, int]
) -> tuple[dict[int, str], dict[int, set[str]], list[str], dict[int, str]]:
    """cluster -> judged-same element, judged-different elements, unmapped, colour caveats."""

    cluster_by_crop: dict[str, int] = {}
    for index, cluster_index in by_callout_index.items():
        sha = features["callouts"][index]["sha256"]
        cluster_by_crop.setdefault(sha[: len("sha256:") + 16], cluster_index)

    same: dict[int, str] = {}
    different: dict[int, set[str]] = collections.defaultdict(set)
    unmapped: list[str] = []
    caveats: dict[int, str] = {}
    for verdict in truth_file["verdicts"]:
        cluster_index = cluster_by_crop.get(verdict["judgedCropSha256"])
        if cluster_index is None:
            unmapped.append(f"n={verdict['n']} {verdict['judgedCropSha256']}")
            continue
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


