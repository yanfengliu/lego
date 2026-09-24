import { countElements, stepCountsMatch, type IdentityTarget } from "./align-identity.ts";

/**
 * Local repair of an alignment where the booklet re-laid the official
 * sequence.
 *
 * Booklet editors sometimes print sibling sub-builds in the other order, move
 * a part into a neighbouring step, or hold a sub-build back and print it with
 * its twin later (pages 35-36 swap two sub-builds; pages 85-86 move two 2x2
 * plates forward three steps; a red 1x6-on-4x4 sub-build from step 136 is
 * printed with its twin at step 147). A run of consecutive units cannot
 * express that, so each cluster of unmatched steps is widened to the smallest
 * window whose bricks and callout pieces balance — neighbours that matched
 * only by coincidence join it — and solved again: the window's bricks are
 * redistributed among its steps so every step's element counts equal its
 * callouts, moving as few bricks as possible from where the run alignment put
 * them. The search is bounded; a window it cannot solve stays unmatched and
 * is reported, and so does a window whose search ran out of nodes, even when
 * it had found a redistribution by then: that one is not proven to move the
 * fewest bricks, so it is not applied.
 *
 * A step with an identity target (align-identity.ts) is solved by identity:
 * its trusted callouts are fixed slots that must receive their own element,
 * and only its flagged callouts are free slots the search assigns, as every
 * callout of a count-only step is. Because a booklet re-lay can move a part
 * several steps (pages 85-86 move two 2x2 plates forward three), a cluster
 * held to identity whose smallest balanced window cannot be redistributed
 * tries the next larger balanced window, up to the padding limit, and stops
 * at the first it solves or whose search runs out of nodes. A cluster aligned
 * by counts keeps the smallest balanced window only, as before.
 *
 * A repaired step matches its callouts by construction — its bricks were
 * chosen so they satisfy them — so it is evidence of nothing beyond the
 * window balancing. By identity that is a real check (every trusted element's
 * bricks sit in the window, only in other steps); by counts it is not. Callers
 * report such a step as fitted by repair, never as matched by run order.
 */
export const REPAIR_LIMITS = Object.freeze({
  /** Steps apart that still belong to one cluster. */
  clusterGap: 2,
  /** Furthest a window may reach past its cluster on each side. */
  maxPadding: 14,
  /** Search nodes per window. */
  nodeBudget: 400_000,
});

export interface RepairBrick {
  readonly uuid: string;
  readonly element: string;
  /** Position in official build order. */
  readonly order: number;
}

export interface RepairStep {
  readonly callouts: readonly number[];
  readonly bricks: readonly RepairBrick[];
  /** Held to identity when present; by counts otherwise. */
  readonly identity?: IdentityTarget | null;
}

export type RepairOutcome =
  "solved" | "unsolved (budget)" | "unsolved (no redistribution)" | "unsolved (no balanced window)";

export interface RepairWindow {
  /** Indexes into the step list, inclusive. */
  readonly first: number;
  readonly last: number;
  /** True only when the search finished and found a redistribution; the only case applied. */
  readonly solved: boolean;
  readonly outcome: RepairOutcome;
  /** Bricks moved to a different step than the run alignment gave them. */
  readonly moved: number;
  readonly nodes: number;
  /** Balanced windows tried before this outcome; more than one only for a cluster held to identity. */
  readonly windowsTried: number;
  readonly reason: string;
}

export function stepMatches(step: RepairStep): boolean {
  return stepCountsMatch(
    countElements(step.bricks.map(({ element }) => element)),
    step.callouts,
    step.identity,
  );
}

interface Slot {
  readonly step: number;
  readonly quantity: number;
  /** Index of the previous slot in the same step with the same quantity, or -1. */
  readonly twin: number;
}

/**
 * Finds per-step element counts for a window, or null within the node budget.
 * A trusted callout's element is fixed; the search assigns the free slots.
 */
function solveWindow(
  steps: readonly RepairStep[],
  nodeBudget: number,
): {
  counts: Map<string, number>[] | null;
  moved: number;
  nodes: number;
  /** The search stopped at the node budget, so `counts` (if any) is not proven minimal. */
  exhausted: boolean;
} {
  const totals = new Map<string, number>();
  const baseline = steps.map((step) => {
    const counts = countElements(step.bricks.map(({ element }) => element));
    for (const [element, count] of counts) totals.set(element, (totals.get(element) ?? 0) + count);
    return counts;
  });
  const elements = [...totals.keys()].sort();
  const remaining = new Map(totals);
  const used = steps.map(() => new Set<string>());
  // Trusted callouts are fixed slots: their element is spent before the search starts.
  const fixed = steps.map(() => new Map<string, number>());
  let fixedMoved = 0;
  for (const [index, step] of steps.entries()) {
    for (const [element, pieces] of step.identity?.elements ?? []) {
      const left = (remaining.get(element) ?? 0) - pieces;
      if (left < 0) return { counts: null, moved: 0, nodes: 0, exhausted: false };
      remaining.set(element, left);
      used[index]!.add(element);
      fixed[index]!.set(element, pieces);
      fixedMoved += Math.max(0, pieces - (baseline[index]!.get(element) ?? 0));
    }
  }
  const slots: Slot[] = [];
  steps.forEach((step, index) => {
    for (const quantity of step.identity ? step.identity.flagged : step.callouts)
      slots.push({ step: index, quantity, twin: -1 });
  });
  slots.sort((left, right) => right.quantity - left.quantity || left.step - right.step);
  const ordered: Slot[] = slots.map((slot, index) => {
    const previous = index > 0 ? slots[index - 1]! : null;
    return previous && previous.step === slot.step && previous.quantity === slot.quantity
      ? { ...slot, twin: index - 1 }
      : slot;
  });

  const assignment = new Int32Array(ordered.length).fill(-1);
  let best: { counts: Map<string, number>[]; moved: number } | null = null;
  let nodes = 0;
  let open = elements.filter((element) => remaining.get(element)! > 0).length;

  let exhausted = false;
  const visit = (index: number, moved: number): void => {
    // Pruned before the budget check: a branch that cannot beat the best is not unexplored work.
    if (best !== null && moved >= best.moved) return;
    if (nodes >= nodeBudget) {
      exhausted = true;
      return;
    }
    nodes += 1;
    if (index === ordered.length) {
      if (open === 0) {
        const counts = fixed.map((map) => new Map(map));
        ordered.forEach((slot, at) =>
          counts[slot.step]!.set(elements[assignment[at]!]!, slot.quantity),
        );
        best = { counts, moved };
      }
      return;
    }
    // Every element still holding bricks needs a slot of its own.
    if (open > ordered.length - index) return;
    const slot = ordered[index]!;
    const floor = slot.twin >= 0 ? assignment[slot.twin]! + 1 : 0;
    const here = baseline[slot.step]!;
    const candidates: { at: number; cost: number }[] = [];
    for (let at = floor; at < elements.length; at += 1) {
      const element = elements[at]!;
      if (remaining.get(element)! < slot.quantity || used[slot.step]!.has(element)) continue;
      candidates.push({ at, cost: Math.max(0, slot.quantity - (here.get(element) ?? 0)) });
    }
    candidates.sort((left, right) => left.cost - right.cost || left.at - right.at);
    for (const { at, cost } of candidates) {
      const element = elements[at]!;
      const left = remaining.get(element)! - slot.quantity;
      remaining.set(element, left);
      if (left === 0) open -= 1;
      used[slot.step]!.add(element);
      assignment[index] = at;
      visit(index + 1, moved + cost);
      assignment[index] = -1;
      used[slot.step]!.delete(element);
      if (left === 0) open += 1;
      remaining.set(element, left + slot.quantity);
    }
  };
  visit(0, fixedMoved);
  const found = best as { counts: Map<string, number>[]; moved: number } | null;
  return { counts: found?.counts ?? null, moved: found?.moved ?? 0, nodes, exhausted };
}

const byOrder = (left: RepairBrick, right: RepairBrick) => left.order - right.order;

/**
 * Turns per-step element counts into concrete bricks. Bricks of one element
 * are interchangeable to the counts but not to playback, since each has its
 * own pose, so which one moves matters. A step whose count of an element is
 * unchanged keeps its own bricks. A step left with a surplus gives bricks to
 * the steps short of them, the surplus and shortfalls paired in step order,
 * which moves each the least distance; and it gives the brick the model
 * builds nearest the receiving step: its earliest to an earlier step, its
 * latest to a later one. Printed step 31 draws two black 1x2x2 bricks from
 * one sub-build (units 50 and 51) where the run gave it only the first; the
 * second must come from the start of step 32's run, not the 1x2x2 built four
 * units later at the other end of the model.
 */
function distribute(
  steps: readonly RepairStep[],
  counts: readonly Map<string, number>[],
): RepairBrick[][] {
  const result: RepairBrick[][] = steps.map(() => []);
  const elements = new Set(steps.flatMap(({ bricks }) => bricks.map(({ element }) => element)));
  for (const element of elements) {
    const held = steps.map(({ bricks }) =>
      bricks.filter((brick) => brick.element === element).sort(byOrder),
    );
    const donors: number[] = [];
    const receivers: number[] = [];
    held.forEach((bricks, index) => {
      const need = counts[index]!.get(element) ?? 0;
      for (let count = bricks.length; count > need; count -= 1) donors.push(index);
      for (let count = bricks.length; count < need; count += 1) receivers.push(index);
    });
    donors.forEach((from, pair) => {
      const to = receivers[pair]!;
      result[to]!.push(to < from ? held[from]!.shift()! : held[from]!.pop()!);
    });
    held.forEach((bricks, index) => result[index]!.push(...bricks));
  }
  for (const list of result) list.sort(byOrder);
  return result;
}

/**
 * Every window around [low, high], within the padding limit, whose bricks and
 * callout pieces balance: smallest first, then the one reaching back least.
 */
function balancedWindows(
  steps: readonly RepairStep[],
  low: number,
  high: number,
): [number, number][] {
  const drift = [0];
  for (const step of steps) {
    drift.push(
      drift.at(-1)! + step.bricks.length - step.callouts.reduce((sum, value) => sum + value, 0),
    );
  }
  const found: [number, number][] = [];
  for (let first = low; first >= Math.max(0, low - REPAIR_LIMITS.maxPadding); first -= 1) {
    for (
      let last = high;
      last <= Math.min(steps.length - 1, high + REPAIR_LIMITS.maxPadding);
      last += 1
    ) {
      if (drift[last + 1] === drift[first]) found.push([first, last]);
    }
  }
  return found.sort(
    (left, right) => left[1] - left[0] - (right[1] - right[0]) || right[0] - left[0],
  );
}

function windowReason(
  outcome: RepairOutcome,
  moved: number,
  budget: number,
  foundUnproven: boolean,
  tried: number,
): string {
  if (outcome === "solved") {
    return `redistributed ${moved} brick(s) so every step matches its callouts${tried > 1 ? ` (the smallest of ${tried} balanced windows tried that could be)` : ""}`;
  }
  if (outcome === "unsolved (budget)") {
    return `the search stopped at its budget of ${budget} nodes${foundUnproven ? `; its best redistribution so far (moving ${moved} brick(s)) is not proven minimal and was not applied` : " without a redistribution"}`;
  }
  return tried > 1
    ? `no redistribution makes every step match in any of the ${tried} balanced windows within ${REPAIR_LIMITS.maxPadding} steps`
    : "no redistribution makes every step match";
}

/**
 * Repairs every cluster of unmatched steps it can. Returns the new step
 * bricks and one record per cluster.
 */
export function repairAlignment(
  steps: readonly RepairStep[],
  limits: { readonly nodeBudget: number } = REPAIR_LIMITS,
): {
  readonly steps: readonly RepairStep[];
  readonly windows: readonly RepairWindow[];
} {
  const current = steps.map((step) => ({
    callouts: step.callouts,
    bricks: [...step.bricks],
    identity: step.identity ?? null,
  }));
  const unmatched = current.flatMap((step, index) => (stepMatches(step) ? [] : [index]));
  const clusters: [number, number][] = [];
  for (const index of unmatched) {
    const last = clusters.at(-1);
    if (last && index - last[1] <= REPAIR_LIMITS.clusterGap) last[1] = index;
    else clusters.push([index, index]);
  }
  const windows: RepairWindow[] = [];
  for (const [low, high] of clusters) {
    // An earlier window may already have fixed this cluster.
    if (current.slice(low, high + 1).every((step) => stepMatches(step))) continue;
    const ranges = balancedWindows(
      current,
      Math.max(0, low - 1),
      Math.min(current.length - 1, high + 1),
    );
    if (ranges.length === 0) {
      windows.push({
        first: low,
        last: high,
        solved: false,
        outcome: "unsolved (no balanced window)",
        moved: 0,
        nodes: 0,
        windowsTried: 0,
        reason: `no window within ${REPAIR_LIMITS.maxPadding} steps balances its bricks against its callout pieces`,
      });
      continue;
    }
    // By counts the smallest balanced window is the only one tried, as before identity existed.
    const byIdentity = current.slice(low, high + 1).some(({ identity }) => identity !== null);
    const candidates = byIdentity ? ranges : ranges.slice(0, 1);
    let record: RepairWindow | null = null;
    let nodesSpent = 0;
    for (const [tried, [first, last]] of candidates.entries()) {
      const window = current.slice(first, last + 1);
      const { counts, moved, nodes, exhausted } = solveWindow(window, limits.nodeBudget);
      nodesSpent += nodes;
      const outcome: RepairOutcome = exhausted
        ? "unsolved (budget)"
        : counts
          ? "solved"
          : "unsolved (no redistribution)";
      if (outcome === "unsolved (no redistribution)" && tried + 1 < candidates.length) continue;
      if (counts && outcome === "solved") {
        distribute(window, counts).forEach((list, offset) => {
          current[first + offset]!.bricks = list;
        });
      }
      // A window that exhausted its search is named; when none redistributes, the smallest is.
      const [reportFirst, reportLast] =
        outcome === "unsolved (no redistribution)" ? ranges[0]! : [first, last];
      record = {
        first: reportFirst,
        last: reportLast,
        solved: outcome === "solved",
        outcome,
        moved: outcome === "solved" ? moved : 0,
        nodes: nodesSpent,
        windowsTried: tried + 1,
        reason: windowReason(outcome, moved, limits.nodeBudget, counts !== null, tried + 1),
      };
      break;
    }
    windows.push(record!);
  }
  return { steps: current, windows };
}
