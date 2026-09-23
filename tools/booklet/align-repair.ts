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
 * is reported.
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
}

export interface RepairWindow {
  /** Indexes into the step list, inclusive. */
  readonly first: number;
  readonly last: number;
  readonly solved: boolean;
  /** Bricks moved to a different step than the run alignment gave them. */
  readonly moved: number;
  readonly nodes: number;
  readonly reason: string;
}

function descending(values: readonly number[]): number[] {
  return [...values].sort((left, right) => right - left);
}

export function stepMatches(step: RepairStep): boolean {
  const counts = new Map<string, number>();
  for (const { element } of step.bricks) counts.set(element, (counts.get(element) ?? 0) + 1);
  const actual = descending([...counts.values()]);
  const expected = descending(step.callouts);
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}

interface Slot {
  readonly step: number;
  readonly quantity: number;
  /** Index of the previous slot in the same step with the same quantity, or -1. */
  readonly twin: number;
}

/** Finds per-step element counts for a window, or null within the node budget. */
function solveWindow(steps: readonly RepairStep[]): {
  counts: Map<string, number>[] | null;
  moved: number;
  nodes: number;
} {
  const totals = new Map<string, number>();
  const baseline = steps.map((step) => {
    const counts = new Map<string, number>();
    for (const { element } of step.bricks) {
      counts.set(element, (counts.get(element) ?? 0) + 1);
      totals.set(element, (totals.get(element) ?? 0) + 1);
    }
    return counts;
  });
  const elements = [...totals.keys()].sort();
  const slots: Slot[] = [];
  steps.forEach((step, index) => {
    for (const quantity of step.callouts) slots.push({ step: index, quantity, twin: -1 });
  });
  slots.sort((left, right) => right.quantity - left.quantity || left.step - right.step);
  const ordered: Slot[] = slots.map((slot, index) => {
    const previous = index > 0 ? slots[index - 1]! : null;
    return previous && previous.step === slot.step && previous.quantity === slot.quantity
      ? { ...slot, twin: index - 1 }
      : slot;
  });

  const remaining = new Map(totals);
  const used = steps.map(() => new Set<string>());
  const assignment = new Int32Array(ordered.length).fill(-1);
  let best: { counts: Map<string, number>[]; moved: number } | null = null;
  let nodes = 0;
  let open = elements.length;

  const visit = (index: number, moved: number): void => {
    if (nodes >= REPAIR_LIMITS.nodeBudget) return;
    if (best !== null && moved >= best.moved) return;
    nodes += 1;
    if (index === ordered.length) {
      if (open === 0) {
        const counts = steps.map(() => new Map<string, number>());
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
  visit(0, 0);
  const found = best as { counts: Map<string, number>[]; moved: number } | null;
  return { counts: found?.counts ?? null, moved: found?.moved ?? 0, nodes };
}

/** Turns per-step element counts into concrete bricks, keeping each where it was when it can stay. */
function distribute(
  steps: readonly RepairStep[],
  counts: readonly Map<string, number>[],
): RepairBrick[][] {
  const result: RepairBrick[][] = steps.map(() => []);
  const byElement = new Map<string, { brick: RepairBrick; from: number }[]>();
  steps.forEach((step, index) => {
    for (const brick of step.bricks) {
      const list = byElement.get(brick.element) ?? [];
      list.push({ brick, from: index });
      byElement.set(brick.element, list);
    }
  });
  for (const [element, entries] of byElement) {
    entries.sort((left, right) => left.brick.order - right.brick.order);
    const capacity = counts.map((map) => map.get(element) ?? 0);
    const leftover: RepairBrick[] = [];
    for (const { brick, from } of entries) {
      if (capacity[from]! > 0) {
        capacity[from]! -= 1;
        result[from]!.push(brick);
      } else {
        leftover.push(brick);
      }
    }
    let target = 0;
    for (const brick of leftover) {
      while (capacity[target] === 0) target += 1;
      capacity[target]! -= 1;
      result[target]!.push(brick);
    }
  }
  for (const list of result) list.sort((left, right) => left.order - right.order);
  return result;
}

/** The smallest window around [low, high] whose bricks and callout pieces balance. */
function balancedWindow(
  steps: readonly RepairStep[],
  low: number,
  high: number,
): [number, number] | null {
  const drift = [0];
  for (const step of steps) {
    drift.push(
      drift.at(-1)! + step.bricks.length - step.callouts.reduce((sum, value) => sum + value, 0),
    );
  }
  let best: [number, number] | null = null;
  for (let first = low; first >= Math.max(0, low - REPAIR_LIMITS.maxPadding); first -= 1) {
    for (
      let last = high;
      last <= Math.min(steps.length - 1, high + REPAIR_LIMITS.maxPadding);
      last += 1
    ) {
      if (drift[last + 1] !== drift[first]) continue;
      if (!best || last - first < best[1] - best[0]) best = [first, last];
      break;
    }
  }
  return best;
}

/**
 * Repairs every cluster of unmatched steps it can. Returns the new step
 * bricks and one record per cluster.
 */
export function repairAlignment(steps: readonly RepairStep[]): {
  readonly steps: readonly RepairStep[];
  readonly windows: readonly RepairWindow[];
} {
  const current = steps.map((step) => ({ callouts: step.callouts, bricks: [...step.bricks] }));
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
    const range = balancedWindow(
      current,
      Math.max(0, low - 1),
      Math.min(current.length - 1, high + 1),
    );
    if (!range) {
      windows.push({
        first: low,
        last: high,
        solved: false,
        moved: 0,
        nodes: 0,
        reason: `no window within ${REPAIR_LIMITS.maxPadding} steps balances its bricks against its callout pieces`,
      });
      continue;
    }
    const [first, last] = range;
    const window = current.slice(first, last + 1);
    const { counts, moved, nodes } = solveWindow(window);
    if (counts) {
      distribute(window, counts).forEach((list, offset) => {
        current[first + offset]!.bricks = list;
      });
    }
    windows.push({
      first,
      last,
      solved: counts !== null,
      moved,
      nodes,
      reason: counts
        ? `redistributed ${moved} brick(s) so every step matches`
        : nodes >= REPAIR_LIMITS.nodeBudget
          ? `search budget of ${REPAIR_LIMITS.nodeBudget} nodes exhausted`
          : "no redistribution makes every step match",
    });
  }
  return { steps: current, windows };
}
