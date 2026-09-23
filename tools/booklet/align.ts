/**
 * Stage 2: which official bricks each printed step adds.
 *
 * The booklet was laid out from the official build sequence, so each printed
 * step is a run of consecutive build units (see answer-key/build-units.ts):
 * usually one, several when a sub-build is drawn boxed inside one step, or
 * the first two of a model merged. The aligner finds the run for every step
 * by dynamic programming, scoring a step as matched only when the multiset of
 * its callout quantities equals the multiset of per-element counts of the
 * bricks in its run. The text layer names no element per callout, so a count
 * multiset is the strongest check it allows; the per-element inventory check
 * below closes the gap globally.
 *
 * Mismatches are not forced to fit: the program minimises the number of
 * unmatched steps, then the pieces they disagree by, and reports each one.
 */
export const ALIGN_STAGE_VERSION = "lego.booklet-align/1";

export interface AlignStepInput {
  readonly step: number;
  readonly page: number;
  readonly callouts: readonly number[];
}

export interface AlignUnitInput {
  /** Element identity of each brick the unit adds. */
  readonly elements: readonly string[];
}

export interface AlignedStep {
  readonly step: number;
  readonly page: number;
  /** Half-open range of units this step covers. */
  readonly unitStart: number;
  readonly unitEnd: number;
  readonly matched: boolean;
  /** Callout quantities and brick counts per element, each sorted descending. */
  readonly expected: readonly number[];
  readonly actual: readonly number[];
}

export interface Alignment {
  readonly steps: readonly AlignedStep[];
  readonly matchedSteps: number;
  readonly mismatchedSteps: readonly number[];
  /** Units no step covers, which can only happen when steps run out first. */
  readonly unitsCovered: number;
}

const MISMATCH_COST = 1_000_000;
const PIECE_COST = 1_000;
/** Tie-breaks that keep attach-only units with the zero-callout steps that draw them. */
const EMPTY_STEP_WITHOUT_UNIT_COST = 1;
const LEADING_EMPTY_UNIT_COST = 1;
/** How far a mismatched step's brick count may stray from its callouts. */
const MISMATCH_PIECE_SLACK = 12;

function descending(values: readonly number[]): number[] {
  return [...values].sort((left, right) => right - left);
}

function elementCounts(units: readonly AlignUnitInput[], start: number, end: number): number[] {
  const counts = new Map<string, number>();
  for (let index = start; index < end; index += 1) {
    for (const element of units[index]!.elements)
      counts.set(element, (counts.get(element) ?? 0) + 1);
  }
  return descending([...counts.values()]);
}

function sameMultiset(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function alignSteps(
  steps: readonly AlignStepInput[],
  units: readonly AlignUnitInput[],
): Alignment {
  const m = steps.length;
  const n = units.length;
  const prefix = new Int32Array(n + 1);
  for (let index = 0; index < n; index += 1)
    prefix[index + 1] = prefix[index]! + units[index]!.elements.length;
  const pieces = steps.map(({ callouts }) => callouts.reduce((sum, value) => sum + value, 0));
  const expected = steps.map(({ callouts }) => descending(callouts));

  const width = n + 1;
  const cost = new Float64Array((m + 1) * width).fill(Number.POSITIVE_INFINITY);
  const back = new Int32Array((m + 1) * width).fill(-1);
  cost[0] = 0;
  for (let k = 0; k < m; k += 1) {
    const want = pieces[k]!;
    for (let start = 0; start <= n; start += 1) {
      const base = cost[k * width + start]!;
      if (base === Number.POSITIVE_INFINITY) continue;
      let leading = 0;
      let seenBrick = false;
      const running = new Map<string, number>();
      for (let end = start; end <= n; end += 1) {
        if (end > start) {
          const added = units[end - 1]!.elements;
          if (added.length > 0) seenBrick = true;
          else if (!seenBrick) leading += 1;
          for (const element of added) running.set(element, (running.get(element) ?? 0) + 1);
        }
        const have = prefix[end]! - prefix[start]!;
        if (have > want + MISMATCH_PIECE_SLACK) break;
        if (have < want - MISMATCH_PIECE_SLACK) continue;
        let stepCost: number;
        if (have === want && sameMultiset(descending([...running.values()]), expected[k]!)) {
          stepCost = 0;
        } else {
          stepCost = MISMATCH_COST + PIECE_COST * Math.abs(have - want);
        }
        if (want === 0 && end === start) stepCost += EMPTY_STEP_WITHOUT_UNIT_COST;
        if (want > 0) stepCost += LEADING_EMPTY_UNIT_COST * leading;
        const next = (k + 1) * width + end;
        const total = base + stepCost;
        if (total < cost[next]!) {
          cost[next] = total;
          back[next] = start;
        }
      }
    }
  }

  let end = n;
  if (cost[m * width + n] === Number.POSITIVE_INFINITY) {
    // The steps could not cover every unit within the slack; keep the best partial cover.
    end = 0;
    for (let index = 0; index <= n; index += 1) {
      if (cost[m * width + index]! < cost[m * width + end]!) end = index;
    }
  }
  const aligned: AlignedStep[] = [];
  let cursor = end;
  for (let k = m; k > 0; k -= 1) {
    const start = back[k * width + cursor]!;
    const step = steps[k - 1]!;
    const actual = start < 0 ? [] : elementCounts(units, start, cursor);
    aligned.push({
      step: step.step,
      page: step.page,
      unitStart: Math.max(start, 0),
      unitEnd: cursor,
      matched: start >= 0 && sameMultiset(actual, expected[k - 1]!),
      expected: expected[k - 1]!,
      actual,
    });
    cursor = Math.max(start, 0);
  }
  aligned.reverse();
  return {
    steps: aligned,
    matchedSteps: aligned.filter(({ matched }) => matched).length,
    mismatchedSteps: aligned.filter(({ matched }) => !matched).map(({ step }) => step),
    unitsCovered: end,
  };
}

export interface InventoryCheck {
  /** Inventory elements whose printed quantity differs from the official brick count. */
  readonly mismatches: readonly {
    readonly element: string;
    readonly inventory: number;
    readonly official: number;
  }[];
  /** Elements the official model uses that the inventory does not list. */
  readonly missingFromInventory: readonly string[];
}

/** Per-element conservation: the inventory must list exactly the official bricks. */
export function checkInventoryAgainstModel(
  inventory: Readonly<Record<string, number>>,
  officialElements: readonly string[],
): InventoryCheck {
  const official = new Map<string, number>();
  for (const element of officialElements) official.set(element, (official.get(element) ?? 0) + 1);
  const mismatches: { element: string; inventory: number; official: number }[] = [];
  for (const [element, quantity] of Object.entries(inventory)) {
    const count = official.get(element) ?? 0;
    if (count !== quantity) mismatches.push({ element, inventory: quantity, official: count });
  }
  const missingFromInventory = [...official.keys()]
    .filter((element) => !(element in inventory))
    .sort();
  return {
    mismatches: mismatches.sort((left, right) => left.element.localeCompare(right.element)),
    missingFromInventory,
  };
}
