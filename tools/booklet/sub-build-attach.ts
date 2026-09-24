import type { BrickPlacement } from "./answer-key/index.ts";
import { MODEL_ASSEMBLY } from "./playback.ts";

/**
 * The printed step that attaches each sub-build to its parent, for reference
 * playback.
 *
 * The official sequence attaches a sub-build at a build unit, its attach unit
 * (answer-key/build-units.ts), and the run alignment gives each printed step
 * a run of consecutive units (align.ts). The run says when a sub-build
 * attaches only while it still describes the step: the local repair
 * (align-repair.ts) moves bricks between the printed steps of a window.
 * Booklet 6651557's window 30-33 is the case. The run gives printed step 31
 * units 48-50 and step 32 units 51-55. Unit 48 holds the two bricks of
 * sub-build S0 (attach unit 49); units 50-52 hold the four of S1 (attach unit
 * 53, a unit with no bricks). After the repair, step 31 holds S1's four
 * bricks and step 32 holds S0's two. The booklet builds S1 in an inset and
 * attaches it in step 31 (page 35), and builds and attaches S0 in step 32
 * (page 36); by the run alone S1 would attach in step 32.
 *
 * The rule, for each sub-build K (a level key; every physical copy has its
 * own) with attach unit A:
 * - complete(K) is the latest printed step whose bricks, as aligned after the
 *   repair, include a brick of K at any depth below it;
 * - runStep(A) is the printed step s with unitStart(s) <= A < unitEnd(s) in
 *   the run alignment (unitStart is the previous step's unitEnd, 0 for the
 *   first), or none when A is past the last step;
 * - when runStep(A) lies inside a solved repair window, K attaches at
 *   max(complete(K), the window's first step): inside a re-laid window the
 *   model's unit order is not the booklet's, and the booklet joins an inset
 *   sub-build in the step that completes it;
 * - otherwise K attaches at max(runStep(A), complete(K)): a sub-build
 *   finished in one step may join in a later step of its own. Sub-build S2 is
 *   built over printed steps 38-43 (units 66-73), and its attach unit 74,
 *   which holds no bricks, is the whole of printed step 44; page 45 shows S2
 *   joining at step 44, not 43;
 * - when a brick of K is in no printed step, complete(K) is unknown and K
 *   attaches at runStep(A);
 * - with no runStep(A), K never attaches while the booklet is replayed;
 * - a nested sub-build never attaches after its parent: it is clamped to the
 *   parent's step.
 *
 * After printed step s, a brick belongs to the deepest sub-build whose attach
 * step is after s, else to the finished model, "model".
 */
export interface AttachStepInput {
  readonly step: number;
  /** One past the last unit the run alignment gave this step. */
  readonly unitEnd: number;
  /** The official brick uuids of the step, as aligned after the local repair. */
  readonly bricks: readonly string[];
}

export interface AttachWindowInput {
  readonly solved: boolean;
  readonly firstStep: number;
  readonly lastStep: number;
}

/**
 * Which case of the rule set a sub-build's attach step: `run order`
 * (runStep(A), not before complete(K)), `completion` (complete(K), after
 * runStep(A)), `window`, `unaligned brick` (runStep(A), since complete(K) is
 * unknown), `never` (no runStep(A)), or `parent` (clamped to its parent's
 * attach step).
 */
export type AttachBasis =
  "run order" | "completion" | "window" | "unaligned brick" | "never" | "parent";

export interface SubBuildAttach {
  readonly key: string;
  /** The enclosing sub-build's key, or "model". */
  readonly parent: string;
  readonly attachUnit: number;
  readonly runStep: number | null;
  /** Null when one of its bricks is in no printed step. */
  readonly complete: number | null;
  /** The solved repair window holding runStep, if any. */
  readonly window: { readonly firstStep: number; readonly lastStep: number } | null;
  /** The printed step that attaches it to its parent; null when none does. */
  readonly attachStep: number | null;
  readonly basis: AttachBasis;
}

interface Level {
  readonly key: string;
  readonly parent: string;
  readonly depth: number;
  readonly attachUnit: number;
  bricks: number;
  aligned: number;
  complete: number | null;
}

/** The printed step whose run holds each unit: unit -> step, for units the run covers. */
function runStepOfUnit(steps: readonly AttachStepInput[]): (unit: number) => number | null {
  const owner: number[] = [];
  let start = 0;
  for (const { step, unitEnd } of steps) {
    for (let unit = start; unit < unitEnd; unit += 1) owner[unit] = step;
    start = Math.max(start, unitEnd);
  }
  return (unit) => owner[unit] ?? null;
}

/**
 * Each sub-build's attach step by the rule above, keyed by level key.
 * `placements` is the official sequence (answer-key/build-units.ts).
 */
export function subBuildAttachSteps(input: {
  readonly steps: readonly AttachStepInput[];
  readonly windows: readonly AttachWindowInput[];
  readonly placements: ReadonlyMap<string, BrickPlacement>;
}): ReadonlyMap<string, SubBuildAttach> {
  const levels = new Map<string, Level>();
  for (const placement of input.placements.values()) {
    placement.levels.forEach((level, depth) => {
      const known = levels.get(level.key);
      if (known) known.bricks += 1;
      else {
        levels.set(level.key, {
          key: level.key,
          parent: depth === 0 ? MODEL_ASSEMBLY : placement.levels[depth - 1]!.key,
          depth,
          attachUnit: level.attachUnit,
          bricks: 1,
          aligned: 0,
          complete: null,
        });
      }
    });
  }
  const seen = new Set<string>();
  for (const { step, bricks } of input.steps) {
    for (const uuid of bricks) {
      const first = !seen.has(uuid);
      seen.add(uuid);
      for (const { key } of input.placements.get(uuid)?.levels ?? []) {
        const level = levels.get(key)!;
        if (first) level.aligned += 1;
        level.complete = Math.max(level.complete ?? step, step);
      }
    }
  }

  const runStepOf = runStepOfUnit(input.steps);
  const result = new Map<string, SubBuildAttach>();
  // Outermost first, so a nested sub-build is clamped to its parent's final step.
  for (const level of [...levels.values()].sort((left, right) => left.depth - right.depth)) {
    const runStep = runStepOf(level.attachUnit);
    const complete = level.aligned === level.bricks ? level.complete : null;
    const window =
      runStep === null
        ? undefined
        : input.windows.find(
            ({ solved, firstStep, lastStep }) =>
              solved && firstStep <= runStep && runStep <= lastStep,
          );
    let attachStep: number | null;
    let basis: AttachBasis;
    if (runStep === null) {
      attachStep = null;
      basis = "never";
    } else if (complete === null) {
      attachStep = runStep;
      basis = "unaligned brick";
    } else if (window) {
      attachStep = Math.max(complete, window.firstStep);
      basis = "window";
    } else {
      attachStep = Math.max(runStep, complete);
      basis = complete > runStep ? "completion" : "run order";
    }
    const parentStep =
      level.parent === MODEL_ASSEMBLY ? null : result.get(level.parent)!.attachStep;
    if (parentStep !== null && (attachStep === null || attachStep > parentStep)) {
      attachStep = parentStep;
      basis = "parent";
    }
    result.set(level.key, {
      key: level.key,
      parent: level.parent,
      attachUnit: level.attachUnit,
      runStep,
      complete,
      window: window ? { firstStep: window.firstStep, lastStep: window.lastStep } : null,
      attachStep,
      basis,
    });
  }
  return result;
}

/**
 * The assembly a placed brick belongs to once printed step `step` is built:
 * the deepest sub-build not yet attached, or "model".
 */
export function assemblyAfterStep(
  placement: BrickPlacement,
  step: number,
  attach: ReadonlyMap<string, SubBuildAttach>,
): string {
  for (let depth = placement.levels.length - 1; depth >= 0; depth -= 1) {
    const { key } = placement.levels[depth]!;
    const level = attach.get(key);
    if (!level) {
      throw new Error(
        `Sub-build ${key} has no attach step; compute subBuildAttachSteps from the placements this brick comes from.`,
      );
    }
    if (level.attachStep === null || level.attachStep > step) return key;
  }
  return MODEL_ASSEMBLY;
}
