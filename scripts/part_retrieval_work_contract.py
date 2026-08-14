"""Bound all descriptor comparisons performed by the retrieval report."""

from __future__ import annotations

import collections
import re
from collections.abc import Mapping

from part_identification_descriptor_contract import (
    DESCRIPTOR_GRID_CELLS,
    MAX_FEATURE_CALLOUTS,
    MAX_INVENTORY_ELEMENTS,
    bounded_observed,
)


MAX_REPORT_COMPARISON_CELLS = 512 * 1024 * 1024
MAX_LEDGER_STEPS = 359
MAX_LEDGER_IDENTITIES = 4_000
SHA256 = re.compile(r"^sha256:[0-9a-f]{64}$")
ELEMENT_ID = re.compile(r"^[0-9]{3,12}$")
CALLOUT_IDENTITY = re.compile(
    r"^p[0-9]+\|q[0-9]+\|x-?[0-9]+\.[0-9]{3}\|y-?[0-9]+\.[0-9]{3}$"
)


def _mapping(value: object, label: str) -> Mapping:
    if not isinstance(value, Mapping):
        raise ValueError(f"{label} must be a JSON object, received {type(value).__name__}")
    return value


def require_retrieval_comparison_budget(
    lead_rows: int, member_rows: int, inventory_elements: int
) -> int:
    """Bound a focused set of inventory-wide descriptor rows."""

    comparison_cells = (
        (lead_rows + member_rows) * inventory_elements * DESCRIPTOR_GRID_CELLS
    )
    if comparison_cells > MAX_REPORT_COMPARISON_CELLS:
        raise ValueError(
            f"retrieval report would compare {comparison_cells} descriptor cells across "
            f"{lead_rows} lead and {member_rows} exact-member rows; the bounded maximum is "
            f"{MAX_REPORT_COMPARISON_CELLS}"
        )
    return comparison_cells


def _physical_callouts(
    features: Mapping,
) -> tuple[list[Mapping], dict[str, int], set[str]]:
    callouts = features.get("callouts")
    if not isinstance(callouts, list) or not 1 <= len(callouts) <= MAX_FEATURE_CALLOUTS:
        raise ValueError("retrieval work preflight needs 1 through 4000 feature callouts")
    physical: list[Mapping] = []
    index_by_file: dict[str, int] = {}
    identities: set[str] = set()
    for index, raw_callout in enumerate(callouts):
        callout = _mapping(raw_callout, f"feature callout {index}")
        if callout.get("evidenceKind") != "part-art":
            continue
        file = callout.get("file")
        digest = callout.get("sha256")
        identity = callout.get("identity")
        if not isinstance(file, str) or not 1 <= len(file) <= 1_024:
            raise ValueError(f"physical feature callout {index} must retain one bounded file path")
        if file in index_by_file:
            raise ValueError(
                f"physical feature callout file {bounded_observed(file)} occurs at both indexes "
                f"{index_by_file[file]} and {index}; cluster leads would be ambiguous"
            )
        if not isinstance(digest, str) or SHA256.fullmatch(digest) is None:
            raise ValueError(f"physical feature callout {index} must retain one exact crop SHA-256")
        if not isinstance(identity, str) or CALLOUT_IDENTITY.fullmatch(identity) is None:
            raise ValueError(
                f"physical feature callout {index} must retain one canonical ASCII callout identity"
            )
        if identity in identities:
            raise ValueError(
                f"physical feature callout identity {bounded_observed(identity)} occurs more than once; "
                "accepted Builder pieces would be ambiguous"
            )
        index_by_file[file] = index
        identities.add(identity)
        physical.append(callout)
    if not physical:
        raise ValueError("retrieval work preflight needs at least one physical part-art callout")
    return physical, index_by_file, identities


def _builder_member_row_counts(
    ledger: object, physical_identities: set[str]
) -> tuple[int, int]:
    """Preflight accepted Builder pieces and count exact descriptors we will rank."""

    value = _mapping(ledger, "action ledger")
    steps = value.get("steps")
    if not isinstance(steps, list) or not 1 <= len(steps) <= MAX_LEDGER_STEPS:
        count = len(steps) if isinstance(steps, list) else type(steps).__name__
        raise ValueError(
            f"retrieval work preflight needs 1 through {MAX_LEDGER_STEPS} action-ledger steps; "
            f"received {count}"
        )
    accepted_piece_count = 0
    accepted_callouts: set[str] = set()
    for step_index, raw_step in enumerate(steps):
        step = _mapping(raw_step, f"action ledger step {step_index}")
        action = _mapping(step.get("action"), f"action ledger step {step_index}.action")
        kind = action.get("kind")
        if kind == "place-callouts":
            pieces = action.get("pieces")
            if not isinstance(pieces, list) or len(pieces) > MAX_LEDGER_IDENTITIES:
                raise ValueError(
                    f"action ledger step {step_index}.action.pieces must be an array of at most "
                    f"{MAX_LEDGER_IDENTITIES} accepted pieces"
                )
            accepted_piece_count += len(pieces)
            if accepted_piece_count > MAX_LEDGER_IDENTITIES:
                raise ValueError(
                    f"action ledger has more than {MAX_LEDGER_IDENTITIES} accepted pieces; "
                    "refuse descriptor work before authenticating the ledger"
                )
            for piece_index, raw_piece in enumerate(pieces):
                piece = _mapping(
                    raw_piece,
                    f"action ledger step {step_index}.action.pieces[{piece_index}]",
                )
                key = piece.get("calloutKey")
                if not isinstance(key, str) or CALLOUT_IDENTITY.fullmatch(key) is None:
                    raise ValueError(
                        f"action ledger step {step_index}.action.pieces[{piece_index}].calloutKey "
                        "must be one canonical ASCII callout identity"
                    )
                if key not in physical_identities:
                    raise ValueError(
                        f"action ledger step {step_index}.action.pieces[{piece_index}].calloutKey "
                        f"{bounded_observed(key)} does not bind one exact physical feature callout"
                    )
                accepted_callouts.add(key)
        elif kind not in {"multi-build-copy", "transition"}:
            raise ValueError(
                f"action ledger step {step_index}.action.kind is {bounded_observed(kind)}; required "
                "place-callouts, multi-build-copy, or transition"
            )
    return len(accepted_callouts), accepted_piece_count


def _cluster_counts(
    clusters: object, index_by_file: dict[str, int]
) -> tuple[int, int, int]:
    if not isinstance(clusters, list) or not 1 <= len(clusters) <= MAX_FEATURE_CALLOUTS:
        raise ValueError("retrieval work preflight needs 1 through 4000 bounded clusters")
    physical_indexes = set(index_by_file.values())
    assigned: set[int] = set()
    nonlead_rows = 0
    within_cluster_pairs = 0
    for expected_index, raw_cluster in enumerate(clusters):
        cluster = _mapping(raw_cluster, f"match cluster {expected_index}")
        if cluster.get("clusterIndex") != expected_index:
            raise ValueError(
                f"match cluster position {expected_index} must retain clusterIndex {expected_index}"
            )
        members = cluster.get("members")
        if (
            not isinstance(members, list)
            or not members
            or any(type(member) is not int for member in members)
            or len(set(members)) != len(members)
            or any(member not in physical_indexes for member in members)
        ):
            raise ValueError(
                f"match cluster {expected_index} members must be unique physical callout indexes"
            )
        overlap = assigned.intersection(members)
        if overlap:
            raise ValueError(
                f"match cluster {expected_index} repeats already assigned members {sorted(overlap)}"
            )
        lead = cluster.get("lead")
        lead_index = index_by_file.get(lead) if isinstance(lead, str) else None
        if lead_index is None or lead_index not in members:
            raise ValueError(
                f"match cluster {expected_index} lead {bounded_observed(lead)} must map to exactly one member file"
            )
        assigned.update(members)
        nonlead_rows += len(members) - 1
        within_cluster_pairs += len(members) * (len(members) - 1) // 2
    if assigned != physical_indexes:
        missing = sorted(physical_indexes - assigned)
        raise ValueError(
            f"match clusters must assign every physical callout exactly once; missing indexes {missing[:20]}"
        )
    return len(clusters), nonlead_rows, within_cluster_pairs


def _mould_pair_count(resolution: object, element_ids: object) -> int:
    if (
        not isinstance(element_ids, list)
        or not 1 <= len(element_ids) <= MAX_INVENTORY_ELEMENTS
        or any(not isinstance(element, str) or ELEMENT_ID.fullmatch(element) is None for element in element_ids)
        or len(set(element_ids)) != len(element_ids)
    ):
        raise ValueError("retrieval work preflight needs 1 through 4096 unique numeric element ids")
    records = _mapping(resolution, "element resolution")
    if not 1 <= len(records) <= MAX_INVENTORY_ELEMENTS:
        raise ValueError("element resolution must contain 1 through 4096 bounded records")
    groups: collections.Counter[str] = collections.Counter()
    for element_id, raw_record in records.items():
        if not isinstance(element_id, str) or ELEMENT_ID.fullmatch(element_id) is None:
            raise ValueError(
                f"element resolution id {bounded_observed(element_id)} must contain 3 through 12 digits"
            )
        record = _mapping(raw_record, f"element resolution {element_id}")
        part_num = record.get("partNum")
        quantity = record.get("quantity")
        if not isinstance(part_num, str) or not 1 <= len(part_num) <= 64:
            raise ValueError(f"element resolution {element_id} must retain one bounded partNum")
        if type(quantity) is not int or not 1 <= quantity <= 10_000:
            raise ValueError(
                f"element resolution {element_id} quantity must be an integer from 1 through 10000"
            )
        if element_id in element_ids:
            groups[part_num] += 1
    missing = sorted(set(element_ids) - set(records))
    if missing:
        raise ValueError(
            f"element resolution must cover every inventory descriptor; missing {missing[:20]}"
        )
    return sum(size * (size - 1) for size in groups.values())


def require_report_comparison_budget(
    *,
    features: object,
    clusters: object,
    verdicts: object,
    ledger: object,
    element_ids: object,
    resolution: object,
    quick: bool,
) -> dict[str, int]:
    """Validate comparison topology and cap the selected report mode before work."""

    if type(quick) is not bool:
        raise ValueError(
            f"retrieval report quick mode must be boolean, received {bounded_observed(quick)}"
        )
    features_value = _mapping(features, "part-identification features")
    physical, index_by_file, physical_identities = _physical_callouts(features_value)
    cluster_rows, nonlead_rows, within_pairs = _cluster_counts(clusters, index_by_file)
    inventory = _mapping(features_value.get("inventory"), "features inventory")
    if not isinstance(element_ids, list) or set(inventory) != set(element_ids):
        raise ValueError(
            "retrieval work preflight requires elementIds to equal the validated inventory descriptors"
        )
    sibling_pairs = _mould_pair_count(resolution, element_ids)
    if not isinstance(verdicts, list):
        raise ValueError("retrieval work preflight requires a bounded truth verdict array")
    by_digest: collections.Counter[str] = collections.Counter(
        callout["sha256"] for callout in physical
    )
    exact_member_rows = 0
    for index, raw_verdict in enumerate(verdicts):
        verdict = _mapping(raw_verdict, f"truth verdict {index}")
        digest = verdict.get("judgedCropSha256")
        if not isinstance(digest, str) or SHA256.fullmatch(digest) is None:
            raise ValueError(f"truth verdict {index} must retain one exact judged crop SHA-256")
        exact_member_rows += by_digest[digest]
    builder_member_rows, accepted_builder_pieces = _builder_member_row_counts(
        ledger, physical_identities
    )
    selected_nonlead_rows = 0 if quick else nonlead_rows
    selected_within_pairs = 0 if quick else within_pairs
    # Every exact callout can contribute at most one merged lead-diagnostic truth
    # row. Counting all of them is conservative and includes duplicate lead work
    # before the actual miss set is known from retained ranks.
    miss_ablation_rows = len(physical)
    inventory_rows = (
        cluster_rows
        + exact_member_rows
        + builder_member_rows
        + selected_nonlead_rows
        + miss_ablation_rows
    )
    descriptor_comparisons = (
        inventory_rows * len(inventory) + selected_within_pairs + sibling_pairs
    )
    comparison_cells = descriptor_comparisons * DESCRIPTOR_GRID_CELLS
    counts = {
        "clusterLeadRows": cluster_rows,
        "exactTruthMemberRows": exact_member_rows,
        "builderTruthMemberRows": builder_member_rows,
        "acceptedBuilderPieces": accepted_builder_pieces,
        "nonleadInventoryRows": selected_nonlead_rows,
        "withinClusterMemberPairs": selected_within_pairs,
        "sameMouldSiblingComparisons": sibling_pairs,
        "conservativeMissAblationRows": miss_ablation_rows,
        "descriptorComparisons": descriptor_comparisons,
        "descriptorCells": comparison_cells,
    }
    if comparison_cells > MAX_REPORT_COMPARISON_CELLS:
        raise ValueError(
            f"retrieval report {('quick' if quick else 'full')} mode would compare "
            f"{comparison_cells} descriptor cells; the bounded maximum is "
            f"{MAX_REPORT_COMPARISON_CELLS}. Breakdown: {counts}"
        )
    return counts
