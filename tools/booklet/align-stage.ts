import { elementKeyOf, type AnswerKey } from "./answer-key/index.ts";
import { alignSteps, checkInventoryAgainstModel, type InventoryCheck } from "./align.ts";
import { repairAlignment, stepMatches, type RepairWindow } from "./align-repair.ts";
import type { BookletRead } from "./read.ts";

/**
 * Stage 2 assembled: the run alignment, its local repair, and the checks that
 * say whether the result can be trusted — per-element inventory conservation,
 * the bricks no step places, and bag order (no brick is used before the page
 * that opens its bag).
 */
export const ALIGN_STAGE_VERSION = "lego.booklet-align/1";

export interface AlignedPrintedStep {
  readonly step: number;
  readonly page: number;
  readonly matched: boolean;
  /** True when the local repair changed this step's bricks. */
  readonly repaired: boolean;
  readonly expected: readonly number[];
  readonly actual: readonly number[];
  /** Official brick uuids this step adds, in official build order. */
  readonly bricks: readonly string[];
  /** Last build unit the run alignment gave this step (for sub-build attach timing). */
  readonly unitEnd: number;
}

export interface BagViolation {
  readonly step: number;
  readonly page: number;
  readonly brick: string;
  readonly bag: number;
  readonly bagOpensOnPage: number;
}

export interface AlignStage {
  readonly version: typeof ALIGN_STAGE_VERSION;
  readonly steps: readonly AlignedPrintedStep[];
  readonly runMatchedSteps: number;
  readonly matchedSteps: number;
  readonly mismatchedSteps: readonly number[];
  readonly windows: readonly (RepairWindow & {
    readonly firstStep: number;
    readonly lastStep: number;
  })[];
  readonly unitsCovered: number;
  readonly unitCount: number;
  readonly unplaced: readonly {
    readonly uuid: string;
    readonly designRevision: string;
    readonly element: string;
  }[];
  readonly inventory: InventoryCheck;
  /** design/material groups (bricks without itemNos) matched to inventory elements. */
  readonly elementsMappedByInventory: number;
  readonly unresolvedElementGroups: readonly string[];
  readonly bagViolations: readonly BagViolation[];
  readonly bagOpeningsChecked: number;
  readonly sequenceProblems: readonly string[];
}

function descending(values: readonly number[]): number[] {
  return [...values].sort((left, right) => right - left);
}

export interface ElementResolution {
  readonly elementOf: ReadonlyMap<string, string>;
  /** design/material groups mapped to an inventory element by a unique quantity match. */
  readonly mappedByInventory: number;
  readonly unresolvedGroups: readonly string[];
}

/**
 * Each brick's element id: its own itemNos when the model carries them,
 * otherwise the one inventory element whose printed quantity equals the
 * number of bricks sharing its design and material — and only when exactly
 * one unclaimed element fits.
 */
export function resolveElements(
  key: AnswerKey,
  inventory: Readonly<Record<string, number>>,
): ElementResolution {
  const elementOf = new Map<string, string>();
  const claimed = new Set<string>();
  const groups = new Map<string, string[]>();
  for (const brick of key.model.bricks) {
    if (brick.itemNos.length > 0) {
      const listed = brick.itemNos.find((item) => item in inventory) ?? brick.itemNos.join(",");
      elementOf.set(brick.uuid, listed);
      claimed.add(listed);
    } else {
      const group = elementKeyOf(brick);
      groups.set(group, [...(groups.get(group) ?? []), brick.uuid]);
    }
  }
  let mappedByInventory = 0;
  const unresolvedGroups: string[] = [];
  for (const [group, members] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
    const fits = Object.entries(inventory).filter(
      ([element, quantity]) => !claimed.has(element) && quantity === members.length,
    );
    const target = fits.length === 1 ? fits[0]![0] : group;
    if (fits.length === 1) {
      claimed.add(target);
      mappedByInventory += 1;
    } else {
      unresolvedGroups.push(
        `${group} (${members.length} bricks, ${fits.length} inventory elements fit)`,
      );
    }
    for (const uuid of members) elementOf.set(uuid, target);
  }
  return { elementOf, mappedByInventory, unresolvedGroups };
}

export function runAlignStage(read: BookletRead, key: AnswerKey): AlignStage {
  const { units } = key.sequence;
  const resolution = resolveElements(key, read.inventory.quantities);
  const element = (uuid: string) => resolution.elementOf.get(uuid)!;
  const order = new Map<string, number>();
  for (const unit of units) for (const ref of unit.brickRefs) order.set(ref, order.size);

  const run = alignSteps(
    read.steps,
    units.map((unit) => ({ elements: unit.brickRefs.map(element) })),
  );
  const repairInput = run.steps.map((aligned, index) => ({
    callouts: read.steps[index]!.callouts,
    bricks: units
      .slice(aligned.unitStart, aligned.unitEnd)
      .flatMap((unit) => unit.brickRefs)
      .map((uuid) => ({ uuid, element: element(uuid), order: order.get(uuid)! })),
  }));
  const repaired = repairAlignment(repairInput);

  const steps: AlignedPrintedStep[] = run.steps.map((aligned, index) => {
    const bricks = repaired.steps[index]!.bricks;
    const counts = new Map<string, number>();
    for (const brick of bricks) counts.set(brick.element, (counts.get(brick.element) ?? 0) + 1);
    const before = repairInput[index]!.bricks.map(({ uuid }) => uuid).join(",");
    const after = bricks.map(({ uuid }) => uuid).join(",");
    return {
      step: aligned.step,
      page: aligned.page,
      matched: stepMatches(repaired.steps[index]!),
      repaired: before !== after,
      expected: descending(read.steps[index]!.callouts),
      actual: descending([...counts.values()]),
      bricks: bricks.map(({ uuid }) => uuid),
      unitEnd: aligned.unitEnd,
    };
  });

  const opening = new Map<number, number>();
  for (const { bag, page } of read.bagOpenings) if (!opening.has(bag)) opening.set(bag, page);
  const bagViolations: BagViolation[] = [];
  for (const step of steps) {
    for (const brick of step.bricks) {
      const bag = key.model.bags.get(brick)?.bag ?? null;
      if (bag === null || !opening.has(bag)) continue;
      if (step.page < opening.get(bag)!) {
        bagViolations.push({
          step: step.step,
          page: step.page,
          brick,
          bag,
          bagOpensOnPage: opening.get(bag)!,
        });
      }
    }
  }

  return {
    version: ALIGN_STAGE_VERSION,
    steps,
    runMatchedSteps: run.matchedSteps,
    matchedSteps: steps.filter(({ matched }) => matched).length,
    mismatchedSteps: steps.filter(({ matched }) => !matched).map(({ step }) => step),
    windows: repaired.windows.map((window) => ({
      ...window,
      firstStep: read.steps[window.first]!.step,
      lastStep: read.steps[window.last]!.step,
    })),
    unitsCovered: run.unitsCovered,
    unitCount: units.length,
    unplaced: key.sequence.unplaced.map((uuid) => ({
      uuid,
      designRevision: key.brickByUuid.get(uuid)!.designRevision,
      element: element(uuid),
    })),
    inventory: checkInventoryAgainstModel(
      read.inventory.quantities,
      key.model.bricks.map(({ uuid }) => element(uuid)),
    ),
    elementsMappedByInventory: resolution.mappedByInventory,
    unresolvedElementGroups: resolution.unresolvedGroups,
    bagViolations,
    bagOpeningsChecked: opening.size,
    sequenceProblems: key.sequence.problems,
  };
}
