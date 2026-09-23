import type { Collected } from "./collect";
import type {
  CalloutFlag,
  CalloutIdentification,
  IdentifyResult,
  InventoryElement,
  Reconciliation,
  Residual,
  StepTotals,
  TextCounts,
} from "./types";

/** Flags that leave a callout for a later closed-question check. */
export const RESIDUAL_FLAGS: ReadonlySet<CalloutFlag> = new Set<CalloutFlag>([
  "low-margin",
  "low-score",
  "conflict",
  "unlinked-picture",
  "no-picture",
  "merged-split",
  "unassigned",
  "assignment-unproven",
]);

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function spends(callout: CalloutIdentification): boolean {
  return (
    callout.step !== null && callout.elementId !== null && !callout.flags.includes("unassigned")
  );
}

/**
 * Stops the run when the report spends more of an element than the inventory
 * holds. The assignment never does, so a breach means the report and the
 * assignment disagree. In the review of 71f2f55, not summing the demand of
 * identical drawings passed every test while element 242026 was reported 27
 * times over its count of 13; that result is refused here, not printed.
 */
export function assertWithinInventory(
  assigned: ReadonlyMap<string, number>,
  capacity: ReadonlyMap<string, number>,
  callouts: readonly CalloutIdentification[],
): void {
  for (const [elementId, pieces] of assigned) {
    const held = capacity.get(elementId) ?? 0;
    if (pieces <= held) continue;
    const spent = callouts.filter((c) => spends(c) && c.elementId === elementId).map((c) => c.id);
    const more = spent.length > 5 ? ` and ${spent.length - 5} more` : "";
    throw new Error(
      `identifyBooklet assigned ${pieces} pieces of element ${elementId}, but the inventory prints ${held}, by callouts ${spent.slice(0, 5).join(", ")}${more}. The assignment never spends past an element's count, so the report disagrees with it: a defect in apps/web/src/instructions/identify, not in the booklet.`,
    );
  }
}

export function report(
  callouts: readonly CalloutIdentification[],
  inventory: readonly InventoryElement[],
  capacity: ReadonlyMap<string, number>,
): Pick<IdentifyResult, "summary" | "steps" | "reconciliation" | "residuals"> {
  const stepCallouts = callouts.filter((c) => c.step !== null);
  const assigned = new Map<string, number>();
  const bySteps = new Map<
    number,
    { pages: Set<number>; elements: Map<string, number>; unassigned: number }
  >();
  for (const c of stepCallouts) {
    const entry = bySteps.get(c.step!) ?? { pages: new Set(), elements: new Map(), unassigned: 0 };
    entry.pages.add(c.page);
    if (spends(c)) {
      entry.elements.set(c.elementId!, (entry.elements.get(c.elementId!) ?? 0) + c.count);
      assigned.set(c.elementId!, (assigned.get(c.elementId!) ?? 0) + c.count);
    } else entry.unassigned += c.count;
    bySteps.set(c.step!, entry);
  }
  assertWithinInventory(assigned, capacity, callouts);
  const steps: StepTotals[] = [...bySteps.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, e]) => ({
      step,
      pages: [...e.pages].sort((a, b) => a - b),
      elements: Object.fromEntries([...e.elements.entries()].sort((a, b) => byText(a[0], b[0]))),
      unassignedPieces: e.unassigned,
    }));
  const reconciliation: Reconciliation[] = [...capacity.entries()]
    .sort((a, b) => byText(a[0], b[0]))
    .map(([elementId, count]) => ({
      elementId,
      inventory: count,
      assigned: assigned.get(elementId) ?? 0,
    }));
  const residuals: Residual[] = callouts
    .filter((c) => c.flags.some((flag) => RESIDUAL_FLAGS.has(flag)))
    .map((c) => ({
      calloutId: c.id,
      page: c.page,
      step: c.step,
      count: c.count,
      flags: c.flags,
      elementId: c.elementId,
      candidates: c.candidates.slice(0, 3),
    }));
  const drawings = new Set(callouts.map((c) => c.drawing).filter((d) => d !== null));
  const assignedCallouts = stepCallouts.filter(spends);
  return {
    summary: {
      inventoryElements: capacity.size,
      inventoryPieces: [...capacity.values()].reduce((a, b) => a + b, 0),
      inventoryThumbnails: inventory.filter((e) => e.bbox !== null).length,
      callouts: callouts.length,
      calloutPieces: callouts.reduce((a, c) => a + c.count, 0),
      stepCallouts: stepCallouts.length,
      stepCalloutPieces: stepCallouts.reduce((a, c) => a + c.count, 0),
      calloutsWithPicture: callouts.filter((c) => c.bbox !== null).length,
      drawings: drawings.size,
      forcedByCapacity: {
        calloutsAssigned: assignedCallouts.length,
        piecesAssigned: assignedCallouts.reduce((a, c) => a + c.count, 0),
        elementsExact: reconciliation.filter((r) => r.assigned === r.inventory).length,
      },
      firstChoiceKept: assignedCallouts.filter((c) => c.firstChoice?.elementId === c.elementId)
        .length,
      residuals: residuals.length,
    },
    steps,
    reconciliation,
    residuals,
  };
}

/** The text layer's own counts, which no picture influences. */
export function textCounts(collected: Collected): TextCounts {
  const seen = new Map<number, number>();
  for (const { step } of collected.stepNumbers) seen.set(step, (seen.get(step) ?? 0) + 1);
  const lastStep = seen.size === 0 ? null : [...seen.keys()].reduce((a, b) => Math.max(a, b));
  const missingSteps: number[] = [];
  for (let step = 1; lastStep !== null && step <= lastStep; step += 1)
    if (!seen.has(step)) missingSteps.push(step);
  return {
    inventoryPages: collected.inventoryPages,
    unpairedElementIds: collected.unpairedElementIds,
    calloutLabelSizePt: collected.labelSizePt,
    overprintsDropped: collected.duplicateRuns,
    otherSizeCountLabels: collected.otherSizeCountLabels,
    stepNumbers: collected.stepNumbers.length,
    lastStep,
    missingSteps,
    repeatedSteps: [...seen]
      .filter(([, n]) => n > 1)
      .map(([step]) => step)
      .sort((a, b) => a - b),
  };
}
