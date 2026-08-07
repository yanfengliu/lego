import type { StepFailure } from "./real-build-safety";

/**
 * Settling a printed step that its own panel cannot answer.
 *
 * The first printed step has nothing built to outline, so the panel prints no
 * highlight at all: `scoreStepDelta` gets a null region IoU and an empty stroke
 * mask, and every candidate scores exactly zero. That is a fact about the
 * booklet rather than a defect, and it is not a reason to guess — but it is also
 * not a dead end, because panel N+1 draws everything placed at step N as already
 * built. So a step with no local scoring signal carries its candidates forward
 * one panel and is settled there, against the art that shows what it built.
 *
 * Two things are deliberately *not* done here.
 *
 * The document never branches. One settled prefix exists at all times; the
 * lookahead only moves *when* step N settles, not how many documents the run
 * carries. Every contract downstream of the decision — the eager step report,
 * the canonical step id, the identity registrations, the per-step validation the
 * Node finalizer recomputes from the final document's prefix — is a contract
 * about the settled prefix, and all of them survive untouched.
 *
 * And a deferral refuses rather than guesses. If the panel it defers to does not
 * separate the candidates by a measured margin, the step fails with its own
 * named code. The margin below is not a round number; it is the largest margin
 * any *wrong* pick achieved in the measurement that motivated this code.
 */

/**
 * How far the best candidate must beat the runner-up on the lookahead panel.
 *
 * Taken from `output/build-search/step1-deferral.json` (probe committed at
 * 7762ebe), which scored the four step-1 branches against printed panels 2 and
 * 3 under five different discriminators and recorded which branch each picked.
 *
 * Four of those picks were *wrong*, and their margins are the bar to clear:
 * the greedy panel-3 delta score at 0.0212, the greedy panel-2 delta score at
 * 0.0365, the panel-3 `anchorIou` at 0.0168, and the cumulative panel-2+3 delta
 * at **0.0878** — the largest. The only discriminator that picked the branch the
 * booklet actually draws, and picked it at both panels, was prefix agreement
 * with the highlight's own region excluded: 0.2085 at panel 2 and 0.0622 at
 * panel 3.
 *
 * So the bar is the largest measured wrong margin, and it is required strictly:
 * every wrong pick in that measurement fails it, and the right pick at the panel
 * a one-step deferral actually uses clears it by 2.38x. A threshold no wrong
 * answer ever fails is decoration, which is why it is set from wrong answers
 * rather than from the right one.
 */
export const DEFERRED_STEP_MINIMUM_MARGIN = 0.0878;

/**
 * Shifts the coarse registration search samples, in pixels of stride.
 *
 * The search maximises agreement over translation because the panel's camera
 * fit pins angle and scale but not where the drawing sits on the page. Sampling
 * every fourth pixel in each axis costs a sixteenth of the work and moves the
 * chosen shift by at most a pixel; the reported agreement is then recomputed at
 * full resolution at that shift, so no reported number is a subsample.
 */
const REGISTRATION_SAMPLE_STRIDE = 4;
const REGISTRATION_SCALES = [8, 3, 1] as const;
const REGISTRATION_RADIUS = 4;

export interface PrefixAgreement {
  readonly agreement: number;
  readonly shiftPx: readonly [number, number];
  readonly evaluatedShifts: number;
}

export interface PrefixAgreementInput {
  /** Silhouette of the candidate prefix rendered at the lookahead panel's view. */
  readonly candidateMask: Uint8Array;
  /** The lookahead panel's art minus its own highlight: what step N built. */
  readonly builtMask: Uint8Array;
  /**
   * Where the lookahead panel stopped showing built art, so neither side is
   * defined there: its highlight region and the highlight's stroke. Panel N+1
   * draws the new part *over* what N built, and charging the candidate for the
   * bite the new part takes out rewards a wrong prefix that happens to fit
   * inside what is left. Measured: including it inverts the panel-3 ranking.
   */
  readonly excludedMask: Uint8Array;
  readonly width: number;
  readonly height: number;
  /** Centroid-difference seed, in pixels. */
  readonly seedPx: readonly [number, number];
}

export class DeferralInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DeferralInputError";
  }
}

function agreementAt(input: PrefixAgreementInput, dx: number, dy: number, stride: number): number {
  const { candidateMask, builtMask, excludedMask, width, height } = input;
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < height; y += stride) {
    const sourceY = y - dy;
    const rowInside = sourceY >= 0 && sourceY < height;
    for (let x = 0; x < width; x += stride) {
      const index = y * width + x;
      if (excludedMask[index] === 1) continue;
      const sourceX = x - dx;
      const here =
        rowInside && sourceX >= 0 && sourceX < width
          ? candidateMask[sourceY * width + sourceX]!
          : 0;
      const there = builtMask[index]!;
      if (here === 1) {
        union += 1;
        if (there === 1) intersection += 1;
      } else if (there === 1) {
        union += 1;
      }
    }
  }
  return union === 0 ? 0 : intersection / union;
}

/**
 * Best agreement between a candidate prefix and the lookahead panel's built art,
 * maximised over translation.
 *
 * The exclusion is applied in panel space rather than model space, because it is
 * a fact about where the page stopped showing built art rather than about where
 * any candidate put a brick.
 */
export function registerPrefixAgreement(input: PrefixAgreementInput): PrefixAgreement {
  const expected = input.width * input.height;
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.width <= 0 ||
    input.height <= 0 ||
    input.candidateMask.length !== expected ||
    input.builtMask.length !== expected ||
    input.excludedMask.length !== expected
  ) {
    throw new DeferralInputError(
      `Prefix agreement needs three masks of exactly ${input.width}x${input.height} = ${expected} bytes; ` +
        `received ${input.candidateMask.length}/${input.builtMask.length}/${input.excludedMask.length}. ` +
        `A mask of a different size would silently compare two different rasters.`,
    );
  }
  let best = {
    dx: Math.round(input.seedPx[0]),
    dy: Math.round(input.seedPx[1]),
    value: 0,
  };
  best.value = agreementAt(input, best.dx, best.dy, REGISTRATION_SAMPLE_STRIDE);
  let evaluatedShifts = 1;
  for (const scale of REGISTRATION_SCALES) {
    for (let dy = -REGISTRATION_RADIUS; dy <= REGISTRATION_RADIUS; dy += 1) {
      for (let dx = -REGISTRATION_RADIUS; dx <= REGISTRATION_RADIUS; dx += 1) {
        const candidate = { dx: best.dx + dx * scale, dy: best.dy + dy * scale };
        const value = agreementAt(input, candidate.dx, candidate.dy, REGISTRATION_SAMPLE_STRIDE);
        evaluatedShifts += 1;
        if (value > best.value) best = { ...candidate, value };
      }
    }
  }
  return {
    agreement: agreementAt(input, best.dx, best.dy, 1),
    shiftPx: [best.dx, best.dy],
    evaluatedShifts,
  };
}

export interface DeferredCandidateScore<T> {
  readonly candidate: T;
  readonly agreement: number;
}

export interface DeferredPlacementDecision<T> {
  readonly winner: DeferredCandidateScore<T> | null;
  readonly runnerUp: DeferredCandidateScore<T> | null;
  readonly margin: number | null;
  readonly failure: StepFailure | null;
}

/**
 * Picks the deferred step's placement, or refuses and says which gate refused.
 *
 * The candidate list is the whole printed step, not one piece: a step whose
 * panel says nothing cannot settle its pieces one at a time, because the second
 * piece is enumerated on top of the first.
 */
export function selectDeferredPlacement<T>(input: {
  readonly stepNumber: number;
  readonly lookaheadStepNumber: number;
  readonly lookaheadBuiltPixels: number;
  readonly scores: readonly DeferredCandidateScore<T>[];
  readonly minimumMargin: number;
}): DeferredPlacementDecision<T> {
  const refuse = (
    code: StepFailure["code"],
    message: string,
    margin: number | null = null,
  ): DeferredPlacementDecision<T> => ({
    winner: null,
    runnerUp: null,
    margin,
    failure: { code, stage: "evidence", stepNumber: input.stepNumber, message },
  });

  // The honest limit of a one-step lookahead, named before it can bite: if the
  // panel a step defers to is itself signal-less, the deferral has nothing to
  // score with and must say so rather than pick.
  if (!Number.isSafeInteger(input.lookaheadBuiltPixels) || input.lookaheadBuiltPixels <= 0) {
    return refuse(
      "deferred-panel-unscored",
      `Step ${input.stepNumber} has no scoring signal of its own and deferred to printed step ` +
        `${input.lookaheadStepNumber}, whose panel shows ${input.lookaheadBuiltPixels} already-built ` +
        `pixel(s). A one-step lookahead settles step N against the art panel N+1 draws of what N built; ` +
        `with nothing drawn there the deferral has nothing to score, and picking anyway would be a guess.`,
    );
  }
  if (input.scores.length === 0) {
    return refuse(
      "no-placement-candidate",
      `Step ${input.stepNumber} deferred to printed step ${input.lookaheadStepNumber} with no whole-step ` +
        `candidate to carry. Nothing was enumerated that places every piece of the printed step.`,
    );
  }
  if (
    !Number.isFinite(input.minimumMargin) ||
    input.minimumMargin < 0 ||
    input.scores.some(({ agreement }) => !Number.isFinite(agreement))
  ) {
    return refuse(
      "ambiguous-deferred-placement",
      `Step ${input.stepNumber} produced non-finite deferred agreement evidence or an invalid minimum ` +
        `margin ${input.minimumMargin} against printed step ${input.lookaheadStepNumber}.`,
    );
  }

  const ordered = [...input.scores].sort((left, right) => right.agreement - left.agreement);
  const winner = ordered[0]!;
  const runnerUp = ordered[1] ?? null;
  const margin = runnerUp === null ? null : winner.agreement - runnerUp.agreement;
  if (winner.agreement <= 0) {
    return refuse(
      "zero-placement-score",
      `Step ${input.stepNumber} best deferred candidate agrees with printed step ` +
        `${input.lookaheadStepNumber}'s already-built art at ${winner.agreement} over ` +
        `${input.scores.length} candidate(s); zero agreement cannot confirm a placement.`,
      margin,
    );
  }
  if (margin !== null && margin <= input.minimumMargin) {
    return refuse(
      "ambiguous-deferred-placement",
      `Step ${input.stepNumber} deferred to printed step ${input.lookaheadStepNumber} and separated its best ` +
        `two of ${input.scores.length} whole-step candidates by ${margin} (${winner.agreement} against ` +
        `${runnerUp!.agreement}), at or below the required ${input.minimumMargin}. That margin is the largest ` +
        `one a measured wrong pick achieved, so a decision inside it is not distinguishable from the wrong ` +
        `answers already recorded.`,
      margin,
    );
  }
  return { winner, runnerUp, margin, failure: null };
}

export interface DeferralEvidence {
  /** Printed step whose panel settled this one, or null when nothing did. */
  readonly lookaheadStepNumber: number | null;
  /** How many printed steps forward the settling panel was. */
  readonly reachSteps: number;
  readonly wholeStepCandidates: number;
  readonly rendered: number;
  readonly lookaheadBuiltPixels: number;
  readonly bestAgreement: number | null;
  readonly runnerUpAgreement: number | null;
  readonly margin: number | null;
  readonly minimumMargin: number;
  readonly settled: boolean;
}

export interface DeferralSummary {
  /** Printed steps whose own panel gave no scoring signal at all. */
  readonly deferredSteps: number;
  /** Of those, how many a later panel actually settled. */
  readonly settledByLookahead: number;
  /**
   * The deepest reach any settlement needed, in printed steps.
   *
   * This is the number `building-system.md` asks the loop to drive: a deferral
   * with no such measure is untestable, because "it settled" and "it settled by
   * looking one panel further than it should have had to" read the same.
   */
  readonly deepestSettlementReachSteps: number;
}

export function summariseDeferrals(
  steps: readonly { readonly deferral: DeferralEvidence | null }[],
): DeferralSummary {
  let deferredSteps = 0;
  let settledByLookahead = 0;
  let deepestSettlementReachSteps = 0;
  for (const { deferral } of steps) {
    if (deferral === null) continue;
    deferredSteps += 1;
    if (!deferral.settled) continue;
    settledByLookahead += 1;
    deepestSettlementReachSteps = Math.max(deepestSettlementReachSteps, deferral.reachSteps);
  }
  return { deferredSteps, settledByLookahead, deepestSettlementReachSteps };
}

export interface WholeStepCandidate<D> {
  readonly document: D;
  readonly partIds: readonly string[];
  readonly stepId: string | null;
  readonly transforms: readonly {
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId: string;
  }[];
}

export interface WholeStepEnumeration<D> {
  readonly candidates: readonly WholeStepCandidate<D>[];
  /** Distinct placements offered for each piece on the first branch explored. */
  readonly perPiece: readonly number[];
  readonly overBudget: boolean;
  readonly budget: number;
}

/**
 * Every way the whole printed step could be placed, as complete documents.
 *
 * Depth-first over the pieces because a later piece is enumerated on top of an
 * earlier one, so the set is a product rather than a union. It refuses over its
 * budget rather than truncating: a quietly capped product reads as a settled
 * step that was never fully considered.
 */
export function enumerateWholeStepCandidates<D>(input: {
  readonly baseDocument: D;
  readonly stepId: string | null;
  readonly pieces: readonly { readonly catalogPartId: string; readonly colorId: string }[];
  readonly enumerateDistinct: (
    document: D,
    catalogPartId: string,
  ) => readonly {
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId: string;
  }[];
  readonly place: (
    document: D,
    catalogPartId: string,
    transform: {
      readonly positionLdu: readonly [number, number, number];
      readonly orientationId: string;
    },
    colorId: string,
    stepId: string | null,
  ) => { readonly document: D; readonly partId: string; readonly stepId: string };
  readonly budget: number;
}): WholeStepEnumeration<D> {
  const candidates: WholeStepCandidate<D>[] = [];
  const perPiece: number[] = [];
  let overBudget = false;

  const walk = (partial: WholeStepCandidate<D>, pieceIndex: number): void => {
    if (overBudget) return;
    if (pieceIndex === input.pieces.length) {
      candidates.push(partial);
      if (candidates.length > input.budget) overBudget = true;
      return;
    }
    const piece = input.pieces[pieceIndex]!;
    const offered = input.enumerateDistinct(partial.document, piece.catalogPartId);
    if (perPiece.length === pieceIndex) perPiece.push(offered.length);
    for (const transform of offered) {
      if (overBudget) return;
      let applied;
      try {
        applied = input.place(
          partial.document,
          piece.catalogPartId,
          transform,
          piece.colorId,
          partial.stepId,
        );
      } catch {
        // The editor is the arbiter of legality; a placement it refuses is not
        // a candidate. Swallowed deliberately and only here, because the
        // enumerator already filtered for support and collision and a refusal
        // at this point is the rarer disagreement between the two.
        continue;
      }
      walk(
        {
          document: applied.document,
          partIds: [...partial.partIds, applied.partId],
          stepId: applied.stepId,
          transforms: [...partial.transforms, transform],
        },
        pieceIndex + 1,
      );
    }
  };

  walk({ document: input.baseDocument, partIds: [], stepId: input.stepId, transforms: [] }, 0);
  return {
    candidates: overBudget ? [] : candidates,
    perPiece,
    overBudget,
    budget: input.budget,
  };
}
