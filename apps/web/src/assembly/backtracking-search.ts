import {
  expandStep,
  type BeamEntry,
  type SearchDriverDeps,
  type SearchDriverOptions,
  type StepTarget,
} from "./search-driver";

/**
 * The search that is allowed to be wrong, as long as it can come back.
 *
 * A placement can be locally symmetric: a 2x2 plate rotated a quarter turn
 * renders identically to the correct one, so the step it is made on has no
 * evidence against it. Requiring every step to be uniquely settled before
 * committing refuses those steps, and refusing is what a build cannot afford —
 * the step after a refusal has nothing to attach to.
 *
 * The booklet does not need the step to settle itself. It draws the same
 * growing object 359 times, so a symmetric mistake stops being symmetric as
 * soon as something lands that breaks the symmetry, and then it fails like any
 * other wrong placement. What that demands is not certainty up front but the
 * ability to go back far enough when the contradiction finally arrives.
 *
 * So this commits to the best candidate, keeps every rejected alternative, and
 * on failure walks back to the shallowest step that still has an untried
 * alternative. Nothing is deleted: `BuildTree` addresses a node by its parent
 * and its placement, so returning to an abandoned branch finds the work already
 * there and the branch that was wrong survives as the counterevidence it is.
 *
 * The point of the exercise is the number it reports. "How many steps had to be
 * undone, and how far back did the deepest reversal reach" is a measurement
 * that can be driven down; "prove this placement is unique" is not.
 */
export const BACKTRACKING_SEARCH_SCHEMA_VERSION = "lego.build-backtracking-search/1" as const;

export interface BacktrackingSearchOptions extends SearchDriverOptions {
  /**
   * Alternatives one step may be re-entered with before the search gives up on
   * it and retreats further. It bounds the fan-out per step, not the depth a
   * reversal may reach.
   */
  readonly maxAlternativesPerStep?: number;
  /**
   * Step expansions the whole search may spend. Exceeding it stops the search
   * and says so; it never truncates quietly into a shorter answer.
   */
  readonly expansionBudget?: number;
  /**
   * A candidate must beat this to be committed to. Zero evidence cannot confirm
   * a placement, so the default refuses a score of zero and nothing else.
   */
  readonly minimumStepScore?: number;
}

export interface SearchReversal {
  /** Printed step the search had reached when it ran out of alternatives. */
  readonly fromStepNumber: number;
  /** Printed step it resumed from, with a candidate it had not tried. */
  readonly toStepNumber: number;
  /** Steps undone, which is how far back this one reversal reached. */
  readonly steps: number;
  readonly reason: string;
}

export interface BacktrackingSearchResult {
  readonly schemaVersion: typeof BACKTRACKING_SEARCH_SCHEMA_VERSION;
  readonly stepsRequested: number;
  readonly stepsCompleted: number;
  /** The accepted head, or null when the search never left the seed. */
  readonly entry: BeamEntry | null;
  readonly reversals: readonly SearchReversal[];
  /** How far back the deepest single reversal reached, in steps. */
  readonly deepestReversalSteps: number;
  /** Every step undone across every reversal, counted once per undo. */
  readonly totalStepsUndone: number;
  readonly expansions: number;
  readonly totalEnumerated: number;
  readonly totalRendered: number;
  /**
   * Candidates the highlight localised to but the per-step render budget could
   * not reach. Reported rather than absorbed: an unrendered candidate is one
   * the search could not have chosen, so a completed build with a positive
   * count here is not a build that considered everything.
   */
  readonly unrenderedCandidates: number;
  readonly stopReason: "complete" | "exhausted" | "budget-exhausted";
  readonly failure: string | null;
}

interface SearchFrame {
  /** The branch this frame expands from; restoring it is what a rewind is. */
  readonly base: BeamEntry;
  readonly scored: ReturnType<typeof expandStep>["scored"];
  taken: number;
}

const DEFAULT_MAX_ALTERNATIVES_PER_STEP = 4;
const DEFAULT_EXPANSION_BUDGET = 4_000;
const DEFAULT_MINIMUM_STEP_SCORE = 0;

export interface BacktrackingSearchDeps extends SearchDriverDeps {
  /**
   * Called when the search abandons a branch and resumes from an earlier one,
   * so a caller holding a `BuildTree` can move its head. Optional because the
   * tree keeps the abandoned branch either way — a rewind is a pointer move,
   * never a deletion.
   */
  retreat?(toEntry: BeamEntry, fromStepNumber: number, toStepNumber: number): void;
}

/**
 * Walks the whole booklet, committing one placement per step and reversing as
 * far back as it has to when a later step contradicts an earlier one.
 */
export function runBacktrackingSearch(
  seed: BeamEntry,
  targets: readonly StepTarget[],
  deps: BacktrackingSearchDeps,
  options: BacktrackingSearchOptions = {},
): BacktrackingSearchResult {
  const maxAlternativesPerStep =
    options.maxAlternativesPerStep ?? DEFAULT_MAX_ALTERNATIVES_PER_STEP;
  const expansionBudget = options.expansionBudget ?? DEFAULT_EXPANSION_BUDGET;
  const minimumStepScore = options.minimumStepScore ?? DEFAULT_MINIMUM_STEP_SCORE;

  const frames: SearchFrame[] = [];
  const reversals: SearchReversal[] = [];
  let current = seed;
  let cursor = 0;
  let expansions = 0;
  let totalEnumerated = 0;
  let totalRendered = 0;
  let unrenderedCandidates = 0;
  /** Deepest index reached since the last successful advance at a shallower step. */
  let retreatFrom: number | null = null;
  let retreatReason = "";
  let stopReason: BacktrackingSearchResult["stopReason"] = "complete";
  let failure: string | null = null;

  const finish = (): BacktrackingSearchResult => ({
    schemaVersion: BACKTRACKING_SEARCH_SCHEMA_VERSION,
    stepsRequested: targets.length,
    stepsCompleted: cursor,
    entry: cursor === 0 ? null : current,
    reversals,
    deepestReversalSteps: reversals.reduce((deepest, one) => Math.max(deepest, one.steps), 0),
    totalStepsUndone: reversals.reduce((total, one) => total + one.steps, 0),
    expansions,
    totalEnumerated,
    totalRendered,
    unrenderedCandidates,
    stopReason,
    failure,
  });

  while (cursor < targets.length) {
    const target = targets[cursor]!;
    if (frames.length === cursor) {
      if (expansions >= expansionBudget) {
        stopReason = "budget-exhausted";
        failure =
          `The search spent its whole budget of ${expansionBudget} step expansion(s) at printed step ` +
          `${target.stepNumber}, having completed ${cursor} of ${targets.length} step(s) with ${reversals.length} reversal(s). ` +
          `It stopped rather than returning the prefix it happened to be holding.`;
        return finish();
      }
      const expansion = expandStep(current, target, deps, options);
      expansions += 1;
      totalEnumerated += expansion.enumerated;
      totalRendered += expansion.rendered;
      unrenderedCandidates += expansion.overflowed;
      frames.push({ base: current, scored: expansion.scored, taken: 0 });
    }

    const frame = frames[cursor]!;
    const limit = Math.min(frame.scored.length, maxAlternativesPerStep);
    let advanced = false;
    while (frame.taken < limit) {
      const pick = frame.scored[frame.taken]!;
      frame.taken += 1;
      // Zero evidence cannot confirm a placement, so a candidate that explains
      // none of the printed highlight is not an alternative worth committing to.
      if (pick.score.score <= minimumStepScore) continue;
      const applied = deps.apply(frame.base, pick.candidate, target.stepNumber);
      current = {
        nodeId: applied.nodeId,
        document: applied.document,
        cumulativeScore: frame.base.cumulativeScore + pick.score.score,
        stepScores: [...frame.base.stepScores, pick.score.score],
      };
      if (retreatFrom !== null && retreatFrom > cursor) {
        reversals.push({
          fromStepNumber: targets[retreatFrom]!.stepNumber,
          toStepNumber: target.stepNumber,
          steps: retreatFrom - cursor,
          reason: retreatReason,
        });
      }
      retreatFrom = null;
      cursor += 1;
      advanced = true;
      break;
    }
    if (advanced) continue;

    // Nothing left at this depth. Retreat one step and try the alternative the
    // shallower frame has not spent yet; the frame just abandoned stays in the
    // tree, which is what makes the branch counterevidence rather than a gap.
    if (retreatFrom === null || cursor > retreatFrom) {
      retreatFrom = cursor;
      retreatReason =
        `Printed step ${target.stepNumber} had ${frame.scored.length} scored placement(s) of ` +
        `${target.catalogPartId} and none of the ${limit} it was allowed to try survived, so an earlier ` +
        `step must have placed something the booklet does not draw.`;
    }
    frames.pop();
    cursor -= 1;
    if (cursor < 0) {
      cursor = 0;
      stopReason = "exhausted";
      failure =
        `The search exhausted every alternative back to the first printed step. ` +
        `${reversals.length} reversal(s) were made and the deepest reached ` +
        `${reversals.reduce((deepest, one) => Math.max(deepest, one.steps), 0)} step(s) back; ` +
        `the booklet cannot be satisfied by any placement this catalog and camera can produce.`;
      return finish();
    }
    current = frames[cursor]!.base;
    deps.retreat?.(current, targets[retreatFrom]!.stepNumber, targets[cursor]!.stepNumber);
  }

  return finish();
}
