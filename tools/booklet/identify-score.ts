import { countElements } from "./align-identity.ts";
import type { StepIdentity } from "./identify-stage.ts";

/**
 * Identification scored against the official model (G3c-2), per printed step.
 *
 * Two comparisons, both against the identity alignment:
 * - run order: a step's identified elements (every callout, flagged ones
 *   included) against the official bricks of the units the aligner's run gave
 *   it, before any repair. A difference is either the booklet printing an
 *   element in another step than the model builds it, or identification
 *   naming the wrong element.
 * - after alignment: each callout against the bricks its step finally holds.
 *   A step that differed by run order but agrees here differed only by the
 *   booklet's re-lay: the repair found the element in a neighbouring step of
 *   the model, and each such move is reported with its direction. A callout
 *   that still differs names an element the model does not place there.
 *
 * Bound: the run boundaries come from an aligner that prefers runs agreeing
 * with identification, so run-order agreement is the most the model allows,
 * not an independent draw; a callout identification flagged was aligned by
 * count, so where it differs either side may be wrong.
 */
export interface ScoreBrick {
  readonly uuid: string;
  readonly element: string;
}

export interface ScoreStep {
  readonly identity: StepIdentity;
  /** Bricks of the step's run of official units, before repair. */
  readonly runOrder: readonly ScoreBrick[];
  /** Bricks the aligned step finally holds. */
  readonly final: readonly ScoreBrick[];
}

export type MoveDirection = "booklet earlier" | "booklet later";

export interface ElementMove {
  readonly element: string;
  readonly pieces: number;
  /** Printed step the booklet shows it in. */
  readonly bookletStep: number;
  /** Printed step whose run of official units builds it. */
  readonly modelStep: number;
  readonly direction: MoveDirection;
}

export interface StepDifference {
  readonly step: number;
  /** Pieces per element identification names beyond the run's, and the run's beyond identification's. */
  readonly identifiedOnly: Readonly<Record<string, number>>;
  readonly modelOnly: Readonly<Record<string, number>>;
  /** `moved`: the step agrees once the booklet's re-lay is applied; `unexplained`: it still differs. */
  readonly explanation: "moved" | "unexplained";
  /** True when a callout identification flagged is part of the difference. */
  readonly involvesFlagged: boolean;
}

export interface CalloutDifference {
  readonly step: number;
  readonly calloutId: string;
  readonly count: number;
  readonly identified: string | null;
  readonly flagged: boolean;
  /** Elements of the step's final bricks that no identified callout accounts for, with pieces. */
  readonly modelUnclaimed: Readonly<Record<string, number>>;
}

export interface IdentityScore {
  readonly stepsWithCallouts: number;
  readonly stepsAgreeingByRunOrder: number;
  readonly stepsMovedByBooklet: number;
  readonly stepsUnexplained: number;
  readonly differences: readonly StepDifference[];
  readonly moves: readonly ElementMove[];
  readonly callouts: number;
  readonly calloutsAgreeing: number;
  readonly calloutDifferences: readonly CalloutDifference[];
}

const identified = (identity: StepIdentity) => {
  const counts = new Map<string, number>();
  for (const { elementId, count } of identity.callouts) {
    const key = elementId ?? "(unidentified)";
    counts.set(key, (counts.get(key) ?? 0) + count);
  }
  return counts;
};

function surplus(
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>,
): Record<string, number> {
  const extra: [string, number][] = [];
  for (const [element, pieces] of left) {
    const over = pieces - (right.get(element) ?? 0);
    if (over > 0) extra.push([element, over]);
  }
  return Object.fromEntries(extra.sort(([a], [b]) => a.localeCompare(b)));
}

const empty = (record: Readonly<Record<string, number>>) => Object.keys(record).length === 0;

export function scoreIdentityAgainstModel(steps: readonly ScoreStep[]): IdentityScore {
  // Where the model builds each brick: the printed step whose run holds it.
  const modelStepOf = new Map<string, number>();
  for (const { identity, runOrder } of steps)
    for (const { uuid } of runOrder) modelStepOf.set(uuid, identity.step);
  const moveCounts = new Map<string, ElementMove>();
  for (const { identity, final } of steps) {
    for (const { uuid, element } of final) {
      const modelStep = modelStepOf.get(uuid);
      if (modelStep === undefined || modelStep === identity.step) continue;
      const key = `${element}|${identity.step}|${modelStep}`;
      const known = moveCounts.get(key);
      moveCounts.set(key, {
        element,
        pieces: (known?.pieces ?? 0) + 1,
        bookletStep: identity.step,
        modelStep,
        direction: identity.step < modelStep ? "booklet earlier" : "booklet later",
      });
    }
  }

  const differences: StepDifference[] = [];
  const calloutDifferences: CalloutDifference[] = [];
  let withCallouts = 0;
  let agreeing = 0;
  let callouts = 0;
  let calloutsAgreeing = 0;
  for (const { identity, runOrder, final } of steps) {
    if (identity.callouts.length === 0) continue;
    withCallouts += 1;
    const named = identified(identity);
    const run = countElements(runOrder.map(({ element }) => element));
    const held = countElements(final.map(({ element }) => element));
    const identifiedOnly = surplus(named, run);
    const modelOnly = surplus(run, named);
    const flaggedElements = new Set(
      identity.callouts
        .filter(({ flags }) => flags.length > 0)
        .map(({ elementId }) => elementId ?? "(unidentified)"),
    );
    if (empty(identifiedOnly) && empty(modelOnly)) agreeing += 1;
    else {
      const settled = empty(surplus(named, held)) && empty(surplus(held, named));
      differences.push({
        step: identity.step,
        identifiedOnly,
        modelOnly,
        explanation: settled ? "moved" : "unexplained",
        involvesFlagged: Object.keys(identifiedOnly).some((element) =>
          flaggedElements.has(element),
        ),
      });
    }
    const claimed = new Set(identity.callouts.map(({ elementId }) => elementId));
    const unclaimed = Object.fromEntries(
      [...held].filter(([element]) => !claimed.has(element)).sort(([a], [b]) => a.localeCompare(b)),
    );
    for (const callout of identity.callouts) {
      callouts += 1;
      if (callout.elementId !== null && held.get(callout.elementId) === callout.count) {
        calloutsAgreeing += 1;
        continue;
      }
      calloutDifferences.push({
        step: identity.step,
        calloutId: callout.id,
        count: callout.count,
        identified: callout.elementId,
        flagged: callout.flags.length > 0,
        modelUnclaimed: unclaimed,
      });
    }
  }
  const moves = [...moveCounts.values()].sort(
    (left, right) =>
      left.bookletStep - right.bookletStep || left.element.localeCompare(right.element),
  );
  return {
    stepsWithCallouts: withCallouts,
    stepsAgreeingByRunOrder: agreeing,
    stepsMovedByBooklet: differences.filter(({ explanation }) => explanation === "moved").length,
    stepsUnexplained: differences.filter(({ explanation }) => explanation === "unexplained").length,
    differences,
    moves,
    callouts,
    calloutsAgreeing,
    calloutDifferences,
  };
}
