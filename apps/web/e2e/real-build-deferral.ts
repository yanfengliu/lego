import type { StepFailure } from "./real-build-safety";
import type {
  NarrowingSubjectRenderBudgetLedger,
  NarrowingSubjectRenderLease,
} from "./real-build-narrowing-subject-budget";

export {
  createNarrowingSubjectRenderBudgetLedger,
  type NarrowingSubjectRenderBudgetLedger,
  type NarrowingSubjectRenderLease,
  type NarrowingSubjectRenderLeaseAttempt,
} from "./real-build-narrowing-subject-budget";

/**
 * Settling a printed step that its own panel cannot answer.
 *
 * A signal-less panel carries the whole candidate step to N+1, whose built art shows what N placed; a highlighted panel can reach the same path when its own score cannot distinguish the best two. `DeferralTrigger` names those two cases.
 *
 * Lookahead moves when the one settled prefix commits but never branches the document, and it refuses unless the later panel both corroborates and separates its winner.
 */

/**
 * Noise floor, not discriminator: probe 7762ebe measured right-pick margins 0.2085/0.0622, wrong-pick margins 0.1776/0.0238, so no margin separates truth; the former 0.0878 also mixed unrelated metrics and falsely refused one of two right picks.
 *
 * Stride-4 registration differs from stride 1 by at most 0.009916 per agreement, so a two-agreement margin carries twice that search noise. The absolute-agreement gate below decides correctness.
 */
export const DEFERRED_STEP_MINIMUM_MARGIN = 0.02;

/**
 * Absolute agreement is the measured discriminator: right picks 0.9031/0.8898 and best wrong picks 0.6946/0.8276 leave the window (0.827593, 0.889836], with zero observed false refusals in three and false accepts in two.
 *
 * Headroom is thin: 0.85 is 6.3 px and 4.5 px from the two observations, one pixel can move agreement by 0.0328, and excluded art measured 106%/236% of built art. Unlike margin, it does not degrade as near-duplicate candidates are added.
 */
export const DEFERRED_STEP_MINIMUM_AGREEMENT = 0.85;

/** One is the only measured reach; the apparent panel-3 evidence used oracle-built step-2 prefixes and cannot license two. */
export const DEFERRED_STEP_MAXIMUM_REACH_STEPS = 1;

/** `no-local-signal` means no highlight could score; `unseparated-by-own-panel` means every eligible placement was scored but the drawing could not distinguish the best two. Both defer to N+1's independent built-art witness. */
export type DeferralTrigger = "no-local-signal" | "unseparated-by-own-panel";

/**
 * Only a fully scored close or tied field earns lookahead; missing candidates, incomplete scoring, resource exhaustion, and malformed scores are run defects, not evidence that the drawing is ambiguous.
 *
 * Scores accompany the failure code because `ambiguous-placement-score` also names non-finite evidence and invalid margins. Deferral still must clear N+1's absolute-agreement and separation gates.
 */
export function ownPanelCannotSeparate(input: {
  readonly failure: StepFailure | null;
  readonly scores: readonly number[];
  readonly minimumMargin: number;
}): boolean {
  const { failure } = input;
  if (failure === null) return false;
  if (failure.code !== "ambiguous-placement-score" && failure.code !== "tied-placement-score") {
    return false;
  }
  return (
    Number.isFinite(input.minimumMargin) &&
    input.minimumMargin >= 0 &&
    input.scores.length >= 2 &&
    input.scores.every((score) => Number.isFinite(score))
  );
}

/** The clause every deferral refusal uses to state why it left its own panel. */
export function describeDeferralTrigger(trigger: DeferralTrigger): string {
  return trigger === "no-local-signal"
    ? "has no scoring signal of its own"
    : "scored every eligible candidate against its own printed highlight and could not separate the best two";
}

/** Coarse translation costs one sixteenth of full sampling, then reports the winning shift at full resolution. Against the probe's eight pairs it moved the optimum by up to 7.3 px and agreement by 0.009916; the margin floor is sized from that measurement. */
const REGISTRATION_SAMPLE_STRIDE = 4;
export const REGISTRATION_SCALES = [8, 3, 1] as const;
export const REGISTRATION_RADIUS = 4;

/**
 * How far this registration can move a candidate, in pixels along each axis.
 *
 * A maximisation is also a blindness, and its blind spot is exactly its search
 * domain: any difference between two candidates that is a translation inside
 * this reach is deleted from the evidence and reports as agreement rather than
 * as an error. Driven the first time at 3 pixels per Three.js *unit* rather than
 * 20 per stud, a whole stud was three pixels wide, every difference in a
 * four-hundred-candidate set was inside this number, and the search dutifully
 * translated each wrong answer on top of the right one: 0.995 to 1.000 across
 * the set, best-to-runner-up 0.0047. At 20 pixels per stud the same candidates
 * separate 1.000 from 0.781.
 *
 * So before trusting this score, state the smallest difference it must resolve
 * in pixels and check that it is larger than this. Widening the search widens
 * the blind spot, which is why the number is pinned in
 * `apps/web/test/real-build-deferral.test.ts` rather than left implicit.
 */
export const REGISTRATION_REACH_PX = REGISTRATION_SCALES.reduce(
  (total, scale) => total + scale * REGISTRATION_RADIUS,
  0,
);

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
  /**
   * What "agrees" means, which is decided by whether the lookahead panel could
   * be made to draw only what step N built.
   *
   * `"iou"` when its highlight closes: the excluded region removes the pieces
   * panel N+1 places, so the two sides are the same assembly and either one
   * having a pixel the other lacks is a disagreement.
   *
   * `"containment"` when it does not. About half of this booklet's contours are
   * open — printed step 7 draws two, 1338px of stroke enclosing no filled region
   * — and with nothing to remove, `builtMask` is what step N built *plus* the
   * pieces step N+1 places. It is then a superset of what any step-N candidate
   * can draw, so equality is the wrong question and the right one is whether
   * everything the candidate draws is drawn there as built. This is printed step
   * 5's move one level up: drop the term that charges a candidate for ink no
   * candidate could own, and let the existing separation margin decide.
   */
  readonly measure: "iou" | "containment";
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
      } else if (there === 1 && input.measure === "iou") {
        union += 1;
      }
    }
  }
  return union === 0 ? 0 : intersection / union;
}

/** Best translated agreement; exclusion stays in panel space because it names where the page stopped drawing, not where a candidate put a brick. */
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

/** Refuses unmeasured reach before rendering or publishing an uncalibrated score. */
export function deferredReachFailure(input: {
  readonly stepNumber: number;
  readonly lookaheadStepNumber: number;
  readonly reachSteps: number;
}): StepFailure | null {
  if (input.reachSteps <= DEFERRED_STEP_MAXIMUM_REACH_STEPS) return null;
  return {
    code: "deferred-reach-unmeasured",
    stage: "evidence",
    stepNumber: input.stepNumber,
    message:
      `Step ${input.stepNumber} would defer ${input.reachSteps} printed steps forward, to step ` +
      `${input.lookaheadStepNumber}. Only a reach of ${DEFERRED_STEP_MAXIMUM_REACH_STEPS} has been ` +
      `calibrated: the deeper observation that exists was built from the official transform of the ` +
      `intervening step, which no run can reproduce, and a real deeper deferral would carry candidates ` +
      `forward from a set never shown to contain the answer. Request the intervening printed step.`,
  };
}

/** Picks or refuses a whole printed-step candidate; pieces cannot settle independently because each is enumerated on the preceding one. */
export function selectDeferredPlacement<T>(input: {
  readonly stepNumber: number;
  readonly trigger: DeferralTrigger;
  readonly lookaheadStepNumber: number;
  readonly reachSteps: number;
  readonly lookaheadBuiltPixels: number;
  readonly scores: readonly DeferredCandidateScore<T>[];
  readonly minimumMargin: number;
  readonly minimumAgreement: number;
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

  // Reach is checked before anything is scored, because it is a fact about how
  // far this decision procedure has ever been measured rather than about these
  // candidates. The caller checks it before it renders anything; this repeats it
  // so the decision procedure itself cannot be handed an uncalibrated reach.
  const reachFailure = deferredReachFailure(input);
  if (reachFailure !== null) {
    return { winner: null, runnerUp: null, margin: null, failure: reachFailure };
  }

  // The honest limit of a one-step lookahead, named before it can bite: if the
  // panel a step defers to is itself signal-less, the deferral has nothing to
  // score with and must say so rather than pick.
  if (!Number.isSafeInteger(input.lookaheadBuiltPixels) || input.lookaheadBuiltPixels <= 0) {
    return refuse(
      "deferred-panel-unscored",
      `Step ${input.stepNumber} ${describeDeferralTrigger(input.trigger)} and deferred to printed step ` +
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
    !Number.isFinite(input.minimumAgreement) ||
    input.minimumAgreement <= 0 ||
    input.scores.some(({ agreement }) => !Number.isFinite(agreement))
  ) {
    return refuse(
      "ambiguous-deferred-placement",
      `Step ${input.stepNumber} produced non-finite deferred agreement evidence or an invalid minimum ` +
        `margin ${input.minimumMargin} / minimum agreement ${input.minimumAgreement} against printed step ` +
        `${input.lookaheadStepNumber}.`,
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
  // The discriminator, and it is asked first: whether the winner is the drawn
  // assembly at all is a different question from whether it beat its runner-up,
  // and only the first one has ever separated a right pick from a wrong one. A
  // set that does not contain the answer still has a best member, and that
  // member's margin can be large.
  if (winner.agreement < input.minimumAgreement) {
    return refuse(
      "weak-deferred-agreement",
      `Step ${input.stepNumber} best deferred candidate agrees with printed step ` +
        `${input.lookaheadStepNumber}'s already-built art at ${winner.agreement} over ` +
        `${input.scores.length} candidate(s), below the required ${input.minimumAgreement}. Every recorded ` +
        `right pick cleared that outright and the best candidate of a set with the answer removed did not, ` +
        `so a winner under it is more likely to be the least wrong of the wrong ones than the drawn placement.`,
      margin,
    );
  }
  if (margin !== null && margin <= input.minimumMargin) {
    return refuse(
      "ambiguous-deferred-placement",
      `Step ${input.stepNumber} deferred to printed step ${input.lookaheadStepNumber} and separated its best ` +
        `two of ${input.scores.length} whole-step candidates by ${margin} (${winner.agreement} against ` +
        `${runnerUp!.agreement}), at or below the required ${input.minimumMargin}. That is the size of this ` +
        `registration's own search noise, so the two are not distinguishable by it — it is not a claim that ` +
        `a larger margin would have been right.`,
      margin,
    );
  }
  return { winner, runnerUp, margin, failure: null };
}

export interface DeferralEvidence {
  /** Why this step's own panel could not settle it. */
  readonly trigger: DeferralTrigger;
  /**
   * How far apart this step's own panel put its best two candidates, and the
   * margin it had to clear, in `scoreStepDelta`'s units.
   *
   * Null on a `no-local-signal` deferral, where there was no local ranking to
   * report at all. Retained because the deferral replaces the local piece
   * reports with its own, and a record that only carried the lookahead's numbers
   * could not be checked against the claim that the local evidence really was
   * inconclusive.
   */
  readonly ownPanelMargin: number | null;
  readonly ownPanelMinimumMargin: number | null;
  /** Printed step whose panel settled this one, or null when nothing did. */
  readonly lookaheadStepNumber: number | null;
  /** How many printed steps forward the settling panel was. */
  readonly reachSteps: number;
  /**
   * Which face the settling panel is drawn from, as the `upSign` the candidates
   * were rendered with. `-1` is a panel drawn from underneath.
   *
   * Reported because the lookahead panel is a different printed page from the
   * one that deferred, and the booklet turns the model over between them: this
   * deferral used to render every candidate upright at the fitted azimuth, which
   * is the opposite side of the drawing whenever the settling panel is an
   * underside one. Null when no camera was resolved.
   */
  readonly lookaheadUpSign: 1 | -1 | null;
  /**
   * Whether the settling panel's own new pieces could be removed from its art
   * before the rest was attributed to this step, and so what "agrees" meant.
   * `"iou"` on a closed contour, `"containment"` on an open one.
   */
  readonly lookaheadMeasure: "iou" | "containment" | null;
  /**
   * The quarter turn the settling panel's own art put the already-settled prefix
   * at, added to its fitted azimuth. Zero by definition when nothing is built
   * yet, because the branch the first printed step settles into is what fixes
   * the world frame rather than something a registration can measure.
   */
  readonly lookaheadTurnDegrees: number | null;
  /** The registration agreement at that turn, and its margin over the next. */
  readonly lookaheadTurnAnchorIou: number | null;
  readonly lookaheadTurnMargin: number | null;
  readonly wholeStepCandidates: number;
  readonly narrowingRenders: number;
  readonly offeredPerPiece: readonly number[];
  readonly carriedPerPiece: readonly number[];
  readonly rendered: number;
  readonly lookaheadBuiltPixels: number;
  readonly bestAgreement: number | null;
  readonly runnerUpAgreement: number | null;
  readonly margin: number | null;
  readonly minimumMargin: number;
  readonly minimumAgreement: number;
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

export type WholeStepPlacementTransform = {
  readonly positionLdu: readonly [number, number, number];
  readonly orientationId: string;
};

export interface WholeStepCandidate<D, O = WholeStepPlacementTransform> {
  readonly document: D;
  readonly partIds: readonly string[];
  readonly stepId: string | null;
  readonly transforms: readonly WholeStepPlacementTransform[];
  /** Exact opaque enumerator rows chosen for this product branch, in piece order. */
  readonly offeredCandidates: readonly O[];
}

export interface WholeStepEnumeration<D, O = WholeStepPlacementTransform> {
  readonly candidates: readonly WholeStepCandidate<D, O>[];
  readonly exploredCandidates: readonly WholeStepCandidate<D, O>[];
  readonly perPiece: readonly number[];
  readonly perPieceCarried: readonly number[];
  readonly narrowingRenders: number;
  readonly overBudget: boolean;
  readonly budget: number;
  readonly overNarrowingBudget: boolean;
  readonly narrowingBudget: number;
}

/** One live atomic narrowing-render allowance shared by any number of enumerations. */
export interface BudgetReservationFailure {
  /** Successfully reserved work before the first refused atomic request. */
  readonly reservedBefore: number;
  /** The complete atomic batch that did not fit. */
  readonly requested: number;
  readonly budget: number;
}

export interface NarrowingRenderBudgetLedger {
  readonly budget: number;
  readonly reserved: number;
  readonly refusedReservation: boolean;
  readonly failedReservation: BudgetReservationFailure | null;
  tryReserve(renderCount: number): boolean;
}

/** One live atomic complete-candidate allowance shared by every parent enumeration. */
export interface WholeStepCandidateBudgetLedger {
  readonly budget: number;
  readonly reserved: number;
  readonly refusedReservation: boolean;
  readonly failedReservation: BudgetReservationFailure | null;
  tryReserve(candidateCount: number): boolean;
}

export function createWholeStepCandidateBudgetLedger(
  budget: number,
): WholeStepCandidateBudgetLedger {
  if (!Number.isSafeInteger(budget) || budget < 0) {
    throw new RangeError(
      `Whole-step candidate budget is ${String(budget)}; required a non-negative safe integer.`,
    );
  }
  let reserved = 0;
  let failedReservation: BudgetReservationFailure | null = null;
  return Object.freeze({
    budget,
    get reserved() {
      return reserved;
    },
    get refusedReservation() {
      return failedReservation !== null;
    },
    get failedReservation() {
      return failedReservation;
    },
    tryReserve(candidateCount: number): boolean {
      if (!Number.isSafeInteger(candidateCount) || candidateCount < 0) {
        throw new RangeError(
          `Whole-step candidate reservation is ${String(candidateCount)}; required a non-negative safe integer.`,
        );
      }
      if (failedReservation !== null) return false;
      if (candidateCount > budget - reserved) {
        failedReservation = Object.freeze({
          reservedBefore: reserved,
          requested: candidateCount,
          budget,
        });
        return false;
      }
      reserved += candidateCount;
      return true;
    },
  });
}

export function createNarrowingRenderBudgetLedger(budget: number): NarrowingRenderBudgetLedger {
  if (!Number.isSafeInteger(budget) || budget < 0) {
    throw new RangeError(
      `Narrowing-render budget is ${String(budget)}; required a non-negative safe integer.`,
    );
  }
  let reserved = 0;
  let failedReservation: BudgetReservationFailure | null = null;
  return Object.freeze({
    budget,
    get reserved() {
      return reserved;
    },
    get refusedReservation() {
      return failedReservation !== null;
    },
    get failedReservation() {
      return failedReservation;
    },
    tryReserve(renderCount: number): boolean {
      if (!Number.isSafeInteger(renderCount) || renderCount < 0) {
        throw new RangeError(
          `Narrowing-render reservation is ${String(renderCount)}; required a non-negative safe integer.`,
        );
      }
      if (failedReservation !== null) return false;
      if (renderCount > budget - reserved) {
        failedReservation = Object.freeze({
          reservedBefore: reserved,
          requested: renderCount,
          budget,
        });
        return false;
      }
      reserved += renderCount;
      return true;
    },
  });
}

export interface WholeStepNarrowingBatchPlan<O> {
  /** Worst-case physical subject rasters held atomically before execute runs. */
  readonly maximumSubjectRenders: number;
  /** Executes synchronously; each actual subject raster must be charged before it begins. */
  readonly execute: (lease: NarrowingSubjectRenderLease) => readonly O[];
}

/**
 * The placements a panel's own score cannot tell apart from its best one.
 *
 * This is `selectUniquePlacementScore`'s rule read down the ranking instead of
 * across the top two. That selector accepts a winner when it beats the runner-up
 * by at least `minimumMargin` and refuses when it does not, which is a claim
 * that a gap that size is a real separation on this panel and a smaller one is
 * not. Applied to every candidate rather than to the second, it says which
 * placements the panel has separated from the best and which it has not — and
 * only the ones it has not need a second panel to choose between them.
 *
 * No new number: the margin is the run's own `minimumScoreMargin`, used for
 * exactly what it already means. What the narrowing can still get wrong is
 * dropping the drawn placement, if this panel scores it more than a margin below
 * something else — which is why the lookahead's deciding gate is the winner's
 * *absolute* agreement rather than its margin. A set that no longer contains the
 * answer still has a best member, and that gate is what refuses it.
 */
export function placementsOwnPanelCannotSeparate<T>(input: {
  readonly scored: readonly { readonly candidate: T; readonly score: number }[];
  readonly minimumMargin: number;
}): readonly T[] {
  const finite = input.scored.filter(({ score }) => Number.isFinite(score));
  if (finite.length === 0 || !Number.isFinite(input.minimumMargin) || input.minimumMargin < 0) {
    return input.scored.map(({ candidate }) => candidate);
  }
  const best = Math.max(...finite.map(({ score }) => score));
  return finite
    .filter(({ score }) => best - score < input.minimumMargin)
    .map(({ candidate }) => candidate);
}

interface WholeStepEnumerationInput<D, O> {
  readonly baseDocument: D;
  readonly stepId: string | null;
  readonly pieces: readonly { readonly catalogPartId: string; readonly colorId: string }[];
  readonly enumerateDistinct: (document: D, catalogPartId: string) => readonly O[];
  readonly narrow:
    | ((input: {
        readonly document: D;
        /** The branch's already-open printed step, or null before its first piece. */
        readonly stepId: string | null;
        readonly catalogPartId: string;
        readonly colorId: string;
        readonly offered: readonly O[];
      }) => readonly O[])
    | null;
  /** Opt-in physical-render planner; mutually exclusive with the historical logical-row narrow. */
  readonly prepareNarrowing?: (input: {
    readonly document: D;
    readonly stepId: string | null;
    readonly catalogPartId: string;
    readonly colorId: string;
    readonly offered: readonly O[];
  }) => WholeStepNarrowingBatchPlan<O>;
  readonly narrowingRenderBudget: number;
  /** Optional authoritative aggregate allowance shared across parent enumerations. */
  readonly narrowingRenderBudgetLedger?: NarrowingRenderBudgetLedger;
  /** Authoritative physical-subject allowance used only with prepareNarrowing. */
  readonly narrowingSubjectRenderBudgetLedger?: NarrowingSubjectRenderBudgetLedger;
  /** Optional authoritative aggregate complete-leaf allowance. */
  readonly candidateBudgetLedger?: WholeStepCandidateBudgetLedger;
  /**
   * Stable occupancy key used to quotient permutations of identical pieces.
   *
   * Keys must uniquely and deterministically identify distinct occupancies for
   * a catalog part. When omitted, the historical full permutation product is
   * retained. When supplied, construction order remains untouched because
   * support and legality can be order-dependent; only complete candidates with
   * the same sorted occupancy multiset are deduplicated.
   */
  readonly placementKey?: (catalogPartId: string, transform: WholeStepPlacementTransform) => string;
  readonly place: (
    document: D,
    catalogPartId: string,
    offeredCandidate: O,
    colorId: string,
    stepId: string | null,
  ) => { readonly document: D; readonly partId: string; readonly stepId: string };
  readonly budget: number;
}

type WholeStepTransformAdapter<O> = [O] extends [WholeStepPlacementTransform]
  ? {
      readonly transformOf?: (offeredCandidate: O) => WholeStepPlacementTransform;
      readonly snapshotOfferedCandidate?: (offeredCandidate: O) => O;
    }
  : {
      readonly transformOf: (offeredCandidate: O) => WholeStepPlacementTransform;
      /** Must return detached immutable plain data; this snapshot is narrowed, placed, and retained. */
      readonly snapshotOfferedCandidate: (offeredCandidate: O) => O;
    };

function wholeStepData(value: unknown, key: string, label: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor =
      value !== null && (typeof value === "object" || typeof value === "function")
        ? Object.getOwnPropertyDescriptor(value, key)
        : undefined;
  } catch {
    throw new TypeError(`${label}.${key} could not be inspected without invoking code.`);
  }
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an own data property.`);
  }
  return descriptor.value;
}
function snapshotWholeStepTransform(
  value: unknown,
  label: string,
): { readonly key: string; readonly transform: WholeStepPlacementTransform } {
  const position = wholeStepData(value, "positionLdu", label);
  const orientation = wholeStepData(value, "orientationId", label);
  let isArray: boolean;
  try {
    isArray = Array.isArray(position);
  } catch {
    throw new TypeError(`${label}.positionLdu could not be inspected without invoking code.`);
  }
  const length = wholeStepData(position, "length", `${label}.positionLdu`);
  const coordinates = [0, 1, 2].map((index) =>
    wholeStepData(position, String(index), `${label}.positionLdu`),
  );
  if (
    !isArray ||
    length !== 3 ||
    coordinates.some((value) => !Number.isSafeInteger(value)) ||
    typeof orientation !== "string" ||
    orientation.length === 0
  ) {
    throw new TypeError(
      `${label} must expose a dense 3-safe-integer positionLdu tuple and a non-empty string orientationId.`,
    );
  }
  const tuple = Object.freeze(coordinates) as unknown as readonly [number, number, number];
  return Object.freeze({
    key: `${tuple.join(",")}\u0000${orientation.length}:${orientation}`,
    transform: Object.freeze({ positionLdu: tuple, orientationId: orientation }),
  });
}

export function enumerateWholeStepCandidates<D, O = WholeStepPlacementTransform>(
  input: WholeStepEnumerationInput<D, O> & WholeStepTransformAdapter<O>,
): WholeStepEnumeration<D, O> {
  if (input.narrow !== null && input.prepareNarrowing !== undefined) {
    throw new TypeError(
      "Whole-step enumeration accepts either historical narrow or prepareNarrowing, not both.",
    );
  }
  if (
    input.prepareNarrowing !== undefined &&
    input.narrowingSubjectRenderBudgetLedger === undefined
  ) {
    throw new TypeError(
      "Whole-step prepareNarrowing requires a narrowingSubjectRenderBudgetLedger so its maximum is held before work.",
    );
  }
  if (
    input.prepareNarrowing === undefined &&
    input.narrowingSubjectRenderBudgetLedger !== undefined
  ) {
    throw new TypeError(
      "Whole-step narrowingSubjectRenderBudgetLedger is only valid with prepareNarrowing.",
    );
  }
  const transformOf =
    input.transformOf ??
    ((offeredCandidate: O) => offeredCandidate as unknown as WholeStepPlacementTransform);
  const snapshotOfferedCandidate =
    input.snapshotOfferedCandidate ?? ((offeredCandidate: O): O => offeredCandidate);
  const candidates: WholeStepCandidate<D, O>[] = [];
  const perPiece: number[] = [];
  const perPieceCarried: number[] = [];
  let narrowingRenders = 0;
  let overBudget = false;
  let overNarrowingBudget = false;

  const completeOccupancyKeys = new Set<string>();
  const completeOccupancyKey = (candidate: WholeStepCandidate<D, O>): string | null => {
    if (input.placementKey === undefined) return null;
    const grouped = new Map<string, string[]>();
    for (const [index, piece] of input.pieces.entries()) {
      const identity = `${piece.catalogPartId}\u0000${piece.colorId}`;
      const placements = grouped.get(identity) ?? [];
      placements.push(input.placementKey(piece.catalogPartId, candidate.transforms[index]!));
      grouped.set(identity, placements);
    }
    return JSON.stringify(
      [...grouped]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([identity, placements]) => [identity, placements.sort()] as const),
    );
  };

  const walk = (partial: WholeStepCandidate<D, O>, pieceIndex: number): void => {
    if (overBudget || overNarrowingBudget) return;
    if (pieceIndex === input.pieces.length) {
      const occupancyKey = completeOccupancyKey(partial);
      if (occupancyKey !== null) {
        if (completeOccupancyKeys.has(occupancyKey)) return;
        completeOccupancyKeys.add(occupancyKey);
      }
      if (input.candidateBudgetLedger !== undefined) {
        if (!input.candidateBudgetLedger.tryReserve(1)) {
          overBudget = true;
          return;
        }
      }
      candidates.push(partial);
      if (input.candidateBudgetLedger === undefined && candidates.length > input.budget) {
        overBudget = true;
      }
      return;
    }
    const piece = input.pieces[pieceIndex]!;
    const offered = input
      .enumerateDistinct(partial.document, piece.catalogPartId)
      .map(snapshotOfferedCandidate);
    const offeredByTransform = new Map<string, O>();
    for (const offeredCandidate of offered) {
      const { key: transformKey } = snapshotWholeStepTransform(
        transformOf(offeredCandidate),
        `Whole-step enumerator candidate for piece ${pieceIndex} ${piece.catalogPartId}`,
      );
      if (offeredByTransform.has(transformKey)) {
        throw new TypeError(
          `Whole-step enumerator returned duplicate transform ${transformKey} for piece ${pieceIndex} ` +
            `${piece.catalogPartId}; each transform must have exactly one opaque candidate payload so ` +
            `connection or build-plate evidence cannot be discarded by transform-keyed occupancy deduplication.`,
        );
      }
      offeredByTransform.set(transformKey, offeredCandidate);
    }
    if (perPiece.length === pieceIndex) perPiece.push(offered.length);
    let carried: readonly O[] = offered;
    // A single offer is already decided, and rendering it would spend the
    // narrowing budget to confirm a set of one.
    if (input.prepareNarrowing !== undefined && offered.length > 1) {
      const plan = input.prepareNarrowing({
        document: partial.document,
        stepId: partial.stepId,
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
        offered,
      });
      if (
        !Number.isSafeInteger(plan.maximumSubjectRenders) ||
        plan.maximumSubjectRenders < 0 ||
        typeof plan.execute !== "function"
      ) {
        throw new TypeError(
          `Whole-step narrowing plan for piece ${pieceIndex} ${piece.catalogPartId} must expose a non-negative safe-integer maximumSubjectRenders and a synchronous execute callback.`,
        );
      }
      const attempt = input.narrowingSubjectRenderBudgetLedger!.tryLease(
        plan.maximumSubjectRenders,
        plan.execute,
      );
      if (!attempt.admitted) {
        overNarrowingBudget = true;
        return;
      }
      narrowingRenders += attempt.charged;
      carried = attempt.value;
    } else if (input.narrow !== null && offered.length > 1) {
      narrowingRenders += offered.length;
      if (input.narrowingRenderBudgetLedger === undefined) {
        if (narrowingRenders > input.narrowingRenderBudget) {
          overNarrowingBudget = true;
          return;
        }
      } else {
        if (!input.narrowingRenderBudgetLedger.tryReserve(offered.length)) {
          overNarrowingBudget = true;
          return;
        }
      }
      carried = input.narrow({
        document: partial.document,
        stepId: partial.stepId,
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
        offered,
      });
    }
    if (perPieceCarried.length === pieceIndex) perPieceCarried.push(carried.length);
    const carriedTransformKeys = new Set<string>();
    for (const carriedCandidate of carried) {
      if (overBudget || overNarrowingBudget) return;
      const { key: transformKey, transform } = snapshotWholeStepTransform(
        transformOf(carriedCandidate),
        `Whole-step narrowed candidate for piece ${pieceIndex} ${piece.catalogPartId}`,
      );
      const offeredCandidate = offeredByTransform.get(transformKey);
      if (offeredCandidate === undefined) {
        throw new TypeError(
          `Whole-step narrowing returned transform ${transformKey} for piece ${pieceIndex} ` +
            `${piece.catalogPartId}, but that transform was not in the enumerator's offered set.`,
        );
      }
      if (carriedTransformKeys.has(transformKey)) {
        throw new TypeError(
          `Whole-step narrowing returned duplicate transform ${transformKey} for piece ${pieceIndex} ` +
            `${piece.catalogPartId}; narrowing must return a subset without duplicate branches.`,
        );
      }
      carriedTransformKeys.add(transformKey);
      let applied;
      try {
        applied = input.place(
          partial.document,
          piece.catalogPartId,
          offeredCandidate,
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
          offeredCandidates: [...partial.offeredCandidates, offeredCandidate],
        },
        pieceIndex + 1,
      );
    }
  };

  walk(
    {
      document: input.baseDocument,
      partIds: [],
      stepId: input.stepId,
      transforms: [],
      offeredCandidates: [],
    },
    0,
  );
  return {
    candidates: overBudget || overNarrowingBudget ? [] : candidates,
    exploredCandidates: candidates,
    perPiece,
    perPieceCarried,
    narrowingRenders,
    overBudget,
    budget: input.budget,
    overNarrowingBudget,
    narrowingBudget: input.narrowingRenderBudget,
  };
}
