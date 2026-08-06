"""Spend the printed inventory in printed order, and report where it runs out.

Every callout in this booklet is currently identified in isolation: one crop,
one claim, one verdict. The only cross-step structure anything uses is global
conservation — claimed totals against the printed inventory — and a global
total is exactly the wrong shape for finding a local mistake. It reports that
the set is 26 pieces over and says nothing about which of 859 drawings did it.

A booklet is a sequence, and the sequence is a much stronger constraint than
its total. After printed step N the remaining pieces are known exactly, so a
claim that needs more of an element than remains is provably wrong *at that
step*, and it names the callouts that made it. This module is that walk.

It measures and it reports. It admits no part, resolves no identity, overrides
no pair-judged verdict, and writes nothing: `booklet_depletion_report.py` reads
artifacts and hands plain data here.

Three checks, all order-aware:

* **overdraft** — at printed step N the step's claims on one element need more
  than the walk has left. The offenders are every callout in that step's group,
  because within one step there is no order to blame.
* **suspect set** — for an element that ends the walk overdrawn, every claim on
  it in step order with the running total. The first claim past the inventory is
  rarely the wrong one; the set is what localises.
* **leftover** — an element the walk never spends. The booklet's back matter is
  a complete bag, so a leftover is an under-claim somewhere, and it names the
  pieces no drawing accounted for.

Plus the two cluster-level facts the walk needs and the isolated view cannot
have: a cluster of identical drawings whose demand exceeds its assigned
element's inventory is refuted by the printed inventory alone, and the survivors
of the capacity, exact-demand and ordered-residue filters are the candidate set
sequence leaves standing.
"""

from __future__ import annotations

import collections
from dataclasses import dataclass, field

# Identification confidences the real-build ledger lets become a placed piece.
# Kept as data rather than imported, because this module must be able to walk a
# historical artifact whose vocabulary predates the current trust rule.
TRUSTED_CONFIDENCES = frozenset({"vision-kept", "pair-judged-same"})


@dataclass(frozen=True)
class Claim:
    """One callout's claim: this many of this element, at this printed step."""

    callout_key: str
    step_number: int | None
    element_id: str | None
    quantity: int
    confidence: str | None = None


@dataclass(frozen=True)
class Cluster:
    """A group of drawings the matcher judged identical, and its shortlist."""

    index: int
    demand: int
    callout_keys: tuple[str, ...]
    shortlist: tuple[str, ...] = ()


@dataclass(frozen=True)
class Overdraft:
    """A printed step whose claims on one element exceed what the walk has left."""

    step_number: int
    element_id: str
    demanded: int
    remaining: int
    callout_keys: tuple[str, ...]
    reason: str


@dataclass(frozen=True)
class SuspectSet:
    """Every claim on an overdrawn element, in step order, with the running total."""

    element_id: str
    inventory: int
    claimed: int
    exhausted_at_step: int | None
    claims: tuple[tuple[int, str, int, int], ...]  # step, callout, quantity, cumulative
    reason: str


@dataclass(frozen=True)
class WalkReport:
    """What one pass over the printed sequence spent, and where it broke."""

    first_inconsistent_step: int | None
    overdrafts: tuple[Overdraft, ...]
    suspects: tuple[SuspectSet, ...]
    leftover: tuple[tuple[str, int], ...]
    steps_walked: int
    claims_walked: int
    pieces_walked: int
    pieces_overdrawn: int
    pieces_left_over: int
    skipped: tuple[str, ...] = field(default=())


def _validate(inventory: dict[str, int], claims: list[Claim]) -> None:
    """Refuse an input the walk cannot mean anything over, naming the value."""

    for element_id, quantity in inventory.items():
        if not isinstance(quantity, int) or quantity < 0:
            raise ValueError(
                f"inventory element {element_id!r} holds {quantity!r}, which is not a "
                f"non-negative whole number of pieces. A depletion walk subtracts from this "
                f"count, so it must come from the printed back-matter inventory as an integer; "
                f"fix the inventory reader rather than coercing the value here."
            )
    seen: set[str] = set()
    for claim in claims:
        if claim.callout_key in seen:
            raise ValueError(
                f"callout {claim.callout_key!r} appears twice in the claims handed to the walk. "
                f"A callout is one drawing and spends its pieces once; two rows for it would "
                f"double-count the inventory. De-duplicate the callout manifest by identity "
                f"before walking it."
            )
        seen.add(claim.callout_key)
        if not isinstance(claim.quantity, int) or claim.quantity < 0:
            raise ValueError(
                f"callout {claim.callout_key!r} claims quantity {claim.quantity!r}, which is not "
                f"a non-negative whole number. The printed Nx label is a count; re-read it, or "
                f"classify the callout as semantic if the label is a repeat multiplier."
            )
        if claim.step_number is not None and (
            not isinstance(claim.step_number, int) or claim.step_number < 1
        ):
            raise ValueError(
                f"callout {claim.callout_key!r} sits at printed step {claim.step_number!r}, which "
                f"is not a step number at or above 1. The walk orders claims by printed step, so "
                f"an unnumbered claim must carry None and be skipped rather than sorted."
            )


def walk_inventory(
    inventory: dict[str, int],
    claims: list[Claim],
    *,
    trusted_only: bool = False,
) -> WalkReport:
    """Walk printed steps in order, spending `inventory`, and report every break.

    `trusted_only` restricts the spenders to `TRUSTED_CONFIDENCES`. That walk is
    the conservative one: trusted claims are a subset of all claims, so the
    remaining count it reports is an upper bound on what is really available, and
    an overdraft it finds is an overdraft under any weaker trust rule too.
    """

    _validate(inventory, claims)

    skipped: list[str] = []
    by_step: dict[int, list[Claim]] = collections.defaultdict(list)
    for claim in claims:
        if claim.step_number is None:
            skipped.append(
                f"{claim.callout_key}: no printed step number, so it has no position in the "
                f"sequence and cannot be walked. Recover its step from the panel it was cropped "
                f"from before it can constrain anything."
            )
            continue
        if claim.element_id is None:
            skipped.append(
                f"{claim.callout_key}: no claimed element, so it spends nothing. Identify it, or "
                f"leave it out of the conservation grade rather than counting it as free."
            )
            continue
        if trusted_only and claim.confidence not in TRUSTED_CONFIDENCES:
            skipped.append(
                f"{claim.callout_key}: confidence {claim.confidence!r} is not one of "
                f"{sorted(TRUSTED_CONFIDENCES)}, and this walk was asked for trusted spenders "
                f"only. Re-identify it, or run the walk with trusted_only=False to include it."
            )
            continue
        by_step[claim.step_number].append(claim)

    remaining = dict(inventory)
    exhausted_at: dict[str, int] = {}
    overdrafts: list[Overdraft] = []
    per_element: dict[str, list[tuple[int, str, int, int]]] = collections.defaultdict(list)
    claimed_total: collections.Counter[str] = collections.Counter()
    claims_walked = 0
    pieces_walked = 0

    for step_number in sorted(by_step):
        grouped: dict[str, list[Claim]] = collections.defaultdict(list)
        for claim in by_step[step_number]:
            grouped[str(claim.element_id)].append(claim)
        for element_id in sorted(grouped):
            group = sorted(grouped[element_id], key=lambda item: item.callout_key)
            demanded = sum(item.quantity for item in group)
            have = remaining.get(element_id, 0)
            keys = tuple(item.callout_key for item in group)
            if demanded > have:
                overdrafts.append(
                    Overdraft(
                        step_number=step_number,
                        element_id=element_id,
                        demanded=demanded,
                        remaining=have,
                        callout_keys=keys,
                        reason=(
                            f"printed step {step_number} claims {demanded} of element {element_id} "
                            f"across {', '.join(keys)}, but the printed inventory has {have} left "
                            f"at that step"
                            + (
                                f"; it was exhausted at printed step {exhausted_at[element_id]}."
                                if element_id in exhausted_at
                                else " (it holds "
                                f"{inventory.get(element_id, 0)} in total)."
                            )
                            + " Either one of these drawings is a different element, or an earlier "
                            "claim on this element is wrong; the walk cannot say which, so read "
                            "the suspect set for this element."
                        ),
                    )
                )
            for item in group:
                claims_walked += 1
                pieces_walked += item.quantity
                claimed_total[element_id] += item.quantity
                per_element[element_id].append(
                    (step_number, item.callout_key, item.quantity, claimed_total[element_id])
                )
            remaining[element_id] = have - demanded
            if remaining[element_id] <= 0 and element_id not in exhausted_at:
                exhausted_at[element_id] = step_number

    suspects: list[SuspectSet] = []
    for element_id in sorted(per_element):
        held = inventory.get(element_id, 0)
        claimed = claimed_total[element_id]
        if claimed <= held:
            continue
        suspects.append(
            SuspectSet(
                element_id=element_id,
                inventory=held,
                claimed=claimed,
                exhausted_at_step=exhausted_at.get(element_id),
                claims=tuple(per_element[element_id]),
                reason=(
                    f"element {element_id} holds {held} printed pieces but is claimed {claimed} "
                    f"times across {len(per_element[element_id])} callouts. The walk blames the "
                    f"claim that crossed the line, which is only the last one to arrive; any "
                    f"claim in this list may be the wrong one. Re-identify these drawings "
                    f"together, or split the cluster that merged them."
                ),
            )
        )

    leftover = tuple(
        (element_id, count)
        for element_id, count in sorted(remaining.items())
        if count > 0
    )
    return WalkReport(
        first_inconsistent_step=overdrafts[0].step_number if overdrafts else None,
        overdrafts=tuple(overdrafts),
        suspects=tuple(suspects),
        leftover=leftover,
        steps_walked=len(by_step),
        claims_walked=claims_walked,
        pieces_walked=pieces_walked,
        pieces_overdrawn=sum(-count for count in remaining.values() if count < 0),
        pieces_left_over=sum(count for _, count in leftover),
        skipped=tuple(skipped),
    )


@dataclass(frozen=True)
class InfeasibleCluster:
    """A cluster of identical drawings the printed inventory cannot supply."""

    index: int
    demand: int
    inventory: int
    element_id: str
    first_step: int | None
    callout_keys: tuple[str, ...]
    reason: str


def infeasible_clusters(
    inventory: dict[str, int],
    clusters: list[Cluster],
    assignment: dict[int, str],
    first_steps: dict[int, int | None],
) -> tuple[InfeasibleCluster, ...]:
    """Clusters whose assigned element has fewer pieces than the cluster draws.

    This needs no order at all, and is reported beside the walk because it is the
    same defect seen without a sequence: the drawings were merged, or the element
    is wrong. It is stated per cluster so the offending drawings are named.
    """

    found: list[InfeasibleCluster] = []
    for cluster in clusters:
        element_id = assignment.get(cluster.index)
        if element_id is None:
            continue
        held = inventory.get(element_id, 0)
        if cluster.demand <= held:
            continue
        found.append(
            InfeasibleCluster(
                index=cluster.index,
                demand=cluster.demand,
                inventory=held,
                element_id=element_id,
                first_step=first_steps.get(cluster.index),
                callout_keys=cluster.callout_keys,
                reason=(
                    f"cluster {cluster.index} draws {cluster.demand} pieces across "
                    f"{len(cluster.callout_keys)} callouts and is assigned element {element_id}, "
                    f"which the printed inventory holds {held} of. No assignment of this cluster "
                    f"to this element can be right. Either the cluster merged drawings that are "
                    f"not the same part, or the element is wrong; splitting the cluster and "
                    f"re-matching each drawing would satisfy this."
                ),
            )
        )
    return tuple(found)


@dataclass(frozen=True)
class Narrowing:
    """What survives each filter for one cluster, and what that cost."""

    index: int
    demand: int
    first_step: int | None
    universe: int
    capacity_survivors: tuple[str, ...]
    exact_survivors: tuple[str, ...]
    ordered_survivors: tuple[str, ...]
    shortlist: tuple[str, ...]
    shortlist_capacity_survivors: tuple[str, ...]
    shortlist_exact_survivors: tuple[str, ...]


def consumed_before(
    claims: list[Claim],
    step_number: int,
    *,
    exclude: frozenset[str] = frozenset(),
    trusted_only: bool = True,
) -> collections.Counter[str]:
    """Pieces spent strictly before `step_number`, ignoring `exclude`d callouts.

    Only trusted claims count by default. Their consumption is a lower bound on
    what the booklet has really used, so the residue it leaves is an upper bound
    on availability — which is the direction that makes an elimination sound.
    """

    used: collections.Counter[str] = collections.Counter()
    for claim in claims:
        if claim.callout_key in exclude:
            continue
        if claim.step_number is None or claim.element_id is None:
            continue
        if claim.step_number >= step_number:
            continue
        if trusted_only and claim.confidence not in TRUSTED_CONFIDENCES:
            continue
        used[claim.element_id] += claim.quantity
    return used


def narrow_cluster(
    inventory: dict[str, int],
    universe: tuple[str, ...],
    cluster: Cluster,
    first_step: int | None,
    residue: collections.Counter[str],
) -> Narrowing:
    """The candidate elements each sequence filter leaves standing for one cluster.

    * capacity — the element must hold at least the cluster's demand.
    * exact — the element must hold exactly it. The booklet's bag is consumed
      completely, so under a one-to-one cluster/element assignment this is the
      expected regime rather than a coincidence; it is reported separately from
      capacity because it is a prior, not a proof.
    * ordered — capacity against what the trusted prefix has already spent.
    """

    demand = cluster.demand
    capacity = tuple(e for e in universe if inventory.get(e, 0) >= demand)
    exact = tuple(e for e in universe if inventory.get(e, 0) == demand)
    if first_step is None:
        ordered = capacity
    else:
        ordered = tuple(e for e in capacity if inventory.get(e, 0) - residue[e] >= demand)
    return Narrowing(
        index=cluster.index,
        demand=demand,
        first_step=first_step,
        universe=len(universe),
        capacity_survivors=capacity,
        exact_survivors=exact,
        ordered_survivors=ordered,
        shortlist=cluster.shortlist,
        shortlist_capacity_survivors=tuple(
            e for e in cluster.shortlist if inventory.get(e, 0) >= demand
        ),
        shortlist_exact_survivors=tuple(
            e for e in cluster.shortlist if inventory.get(e, 0) == demand
        ),
    )


def narrowing_score(narrowings: list[Narrowing]) -> dict[str, float | int]:
    """The aggregate reduction, so a later run can say whether it got better."""

    if not narrowings:
        raise ValueError(
            "narrowing_score was given no clusters, so there is nothing to score. A score of "
            "zero over zero clusters would read as a perfect reduction; hand it the clusters "
            "the match artifact actually published."
        )
    count = len(narrowings)
    return {
        "clusters": count,
        "universe": narrowings[0].universe,
        "meanCapacitySurvivors": sum(len(n.capacity_survivors) for n in narrowings) / count,
        "meanOrderedSurvivors": sum(len(n.ordered_survivors) for n in narrowings) / count,
        "meanExactSurvivors": sum(len(n.exact_survivors) for n in narrowings) / count,
        "clustersReducedByCapacity": sum(
            1 for n in narrowings if len(n.capacity_survivors) < n.universe
        ),
        "clustersReducedFurtherByOrder": sum(
            1 for n in narrowings if len(n.ordered_survivors) < len(n.capacity_survivors)
        ),
        "shortlistsEmptiedByCapacity": sum(
            1 for n in narrowings if n.shortlist and not n.shortlist_capacity_survivors
        ),
        "shortlistsEmptiedByExactDemand": sum(
            1 for n in narrowings if n.shortlist and not n.shortlist_exact_survivors
        ),
        "meanShortlistCapacitySurvivors": sum(
            len(n.shortlist_capacity_survivors) for n in narrowings
        )
        / count,
        "meanShortlistExactSurvivors": sum(len(n.shortlist_exact_survivors) for n in narrowings)
        / count,
        "clustersWithShortlist": sum(1 for n in narrowings if n.shortlist),
    }
