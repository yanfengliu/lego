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
  /** Printed step it unwound to. */
  readonly toStepNumber: number;
  /** Steps undone, which is how far back this one reversal reached. */
  readonly steps: number;
  /**
   * False when the search unwound and then stopped rather than carrying on from
   * there. The last descent of a failed search is one of these, and it is by
   * construction the deepest the search made — counting only the reversals that
   * resumed reported zero on exactly the run where the number is the answer.
   */
  readonly resumed: boolean;
  readonly reason: string;
}

export class BacktrackingSearchError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BacktrackingSearchError";
  }
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
   * Candidates that survived the prune but the per-step render budget could not
   * reach, summed over every expansion. Reported rather than absorbed: an
   * unrendered candidate is one the search could not have chosen, so a
   * completed build with a positive count here is not a build that considered
   * everything. It counts expansions, not steps, so re-entering a step after a
   * reversal counts its overflow again — the number is search effort spent
   * blind, not a per-booklet constant, and is not comparable across runs that
   * backtracked differently.
   */
  readonly unrenderedCandidates: number;
  /**
   * Expansions whose step highlight enclosed nothing. Nothing localised those,
   * so their rendered set is an arbitrary prefix of the enumeration and their
   * share of `unrenderedCandidates` was never pointed at by any picture.
   */
  readonly expansionsWithoutLocalisation: number;
  /**
   * Scored placements `maxAlternativesPerStep` never allowed the search to try.
   * A cap that decides the answer and does not say so turns "the booklet cannot
   * be built" into a sentence about the caller's own option, and this is the
   * count that separates the two.
   */
  readonly withheldAlternatives: number;
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
  // Validated the way `advanceBeam` validates its beam width. A zero alternative
  // allowance retreats from every step and then reports that the booklet cannot
  // be built, which is a true sentence about the wrong subject.
  if (!Number.isInteger(maxAlternativesPerStep) || maxAlternativesPerStep < 1) {
    throw new BacktrackingSearchError(
      `maxAlternativesPerStep must be a positive integer, received ${String(maxAlternativesPerStep)}. ` +
        `One is commit-and-never-reconsider; widen it when steps are ambiguous rather than disabling the retry.`,
    );
  }
  if (!Number.isInteger(expansionBudget) || expansionBudget < 1) {
    throw new BacktrackingSearchError(
      `expansionBudget must be a positive integer, received ${String(expansionBudget)}. ` +
        `The budget bounds how much of the booklet may be searched; it cannot be zero or negative.`,
    );
  }
  if (!Number.isFinite(minimumStepScore) || minimumStepScore < 0) {
    throw new BacktrackingSearchError(
      `minimumStepScore must be a finite score of zero or more, received ${String(minimumStepScore)}.`,
    );
  }

  const frames: SearchFrame[] = [];
  const reversals: SearchReversal[] = [];
  let current = seed;
  let cursor = 0;
  let expansions = 0;
  let totalEnumerated = 0;
  let totalRendered = 0;
  let unrenderedCandidates = 0;
  let expansionsWithoutLocalisation = 0;
  let withheldAlternatives = 0;
  /** Deepest index reached since the last successful advance at a shallower step. */
  let retreatFrom: number | null = null;
  let retreatReason = "";
  let stopReason: BacktrackingSearchResult["stopReason"] = "complete";
  let failure: string | null = null;

  /**
   * The descent that never came back is still a descent, and it is by
   * construction the deepest one the search made. Counting only reversals that
   * ended in a successful advance reported zero on precisely the run where the
   * number is the answer.
   */
  const closeOpenRetreat = (): void => {
    if (retreatFrom === null || retreatFrom <= cursor) return;
    reversals.push({
      fromStepNumber: targets[retreatFrom]!.stepNumber,
      toStepNumber: targets[cursor]?.stepNumber ?? targets[0]!.stepNumber,
      steps: retreatFrom - cursor,
      resumed: false,
      reason: retreatReason,
    });
    retreatFrom = null;
  };

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
    expansionsWithoutLocalisation,
    withheldAlternatives,
    stopReason,
    failure,
  });

  while (cursor < targets.length) {
    const target = targets[cursor]!;
    if (frames.length === cursor) {
      if (expansions >= expansionBudget) {
        closeOpenRetreat();
        stopReason = "budget-exhausted";
        failure =
          `The search spent its whole budget of ${expansionBudget} step expansion(s) at printed step ` +
          `${target.stepNumber}, having completed ${cursor} of ${targets.length} step(s) with ` +
          `${reversals.length} reversal(s). The ${cursor}-step prefix it was holding is returned as ` +
          `\`entry\`, and it is a prefix the search had not finished testing, not an answer.`;
        return finish();
      }
      const expansion = expandStep(current, target, deps, options);
      expansions += 1;
      totalEnumerated += expansion.enumerated;
      totalRendered += expansion.rendered;
      unrenderedCandidates += expansion.overflowed;
      if (!expansion.localised) expansionsWithoutLocalisation += 1;
      frames.push({ base: current, scored: expansion.scored, taken: 0 });
      // Alternatives this step will never be allowed to try. Counted at the one
      // moment they are known, so re-entering a frame cannot count them twice.
      withheldAlternatives += Math.max(0, expansion.scored.length - maxAlternativesPerStep);
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
          resumed: true,
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
    //
    // The deepest step of a descent is the one that names it, so the reason is
    // set once, at the deepest point, and kept while the search unwinds past it.
    if (retreatFrom === null) {
      retreatFrom = cursor;
      retreatReason =
        `Printed step ${target.stepNumber} had ${frame.scored.length} scored placement(s) of ` +
        `${target.catalogPartId}, of which ${limit} could be tried and ${frame.taken} were, and none ` +
        `survived — so an earlier step placed something the booklet does not draw, or this step's part is wrong for it.`;
    }
    frames.pop();
    cursor -= 1;
    if (cursor < 0) {
      cursor = 0;
      closeOpenRetreat();
      stopReason = "exhausted";
      const deepest = reversals.reduce((worst, one) => Math.max(worst, one.steps), 0);
      // Two very different verdicts, and the search knows which one it is
      // holding. Blaming the catalog and the camera for a limit the caller set
      // is the failure this repository keeps paying for.
      failure =
        withheldAlternatives > 0
          ? `The search exhausted every alternative it was allowed back to the first printed step, ` +
            `after ${reversals.length} reversal(s) reaching ${deepest} step(s) back. It withheld ` +
            `${withheldAlternatives} scored placement(s) that maxAlternativesPerStep ` +
            `${maxAlternativesPerStep} never let it try, so this is not yet a statement about the ` +
            `booklet. The deepest failure was: ${retreatReason}`
          : `The search exhausted every alternative back to the first printed step, after ` +
            `${reversals.length} reversal(s) reaching ${deepest} step(s) back, with no placement ` +
            `withheld by any budget. The deepest failure was: ${retreatReason}`;
      return finish();
    }
    current = frames[cursor]!.base;
    deps.retreat?.(current, targets[retreatFrom]!.stepNumber, targets[cursor]!.stepNumber);
  }

  return finish();
}
