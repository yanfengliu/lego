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
 * A panel can fail to answer in a second way, and it arrives through a different
 * door: the panel draws a highlight, the candidates are scored against it, and
 * the drawing does not distinguish the best two. `DeferralTrigger` below is the
 * one place that names both.
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
 * show the winning candidate, or does not separate it from the runner-up, the
 * step fails with its own named code. Which of those two questions the decision
 * actually rests on is settled below, in the metric it is measured in.
 */

/**
 * How far the best candidate must beat the runner-up on the lookahead panel.
 *
 * **This is a noise floor, not a discriminator, and it cannot be anything else
 * on the data that exists.** The quantity gated here is
 * `registerPrefixAgreement`'s agreement, and in that quantity
 * `output/build-search/step1-deferral.json` (probe 7762ebe) recorded two
 * observations, *both right picks*: 0.2085 at panel 2 and 0.0622 at panel 3. The
 * false-accept rate of any bar on that data has denominator zero, so no value
 * here is calibrated — a bar can only be bounded above by the right answers it
 * would refuse, and 0.0622 bounds it below 0.0622.
 *
 * The previous value, 0.0878, was a maximum over a *different* quantity: three
 * `bestScore` margins and one `anchorIou`, spanning 0.076 to 0.514, against a
 * gated metric spanning 0.507 to 0.903. Their rank correlations with the gated
 * metric flip sign panel to panel (Spearman rho of `bestScore` −0.600 at panel 2
 * and +0.800 at panel 3; of `anchorIou` +1.000 and −0.400), so they do not order
 * candidates the same way and a bar measured in one does not bound the other. In
 * the gated metric that bar had a false-refusal rate of 1 in 2: it refuses the
 * measured right pick at panel 3.
 *
 * Margin cannot be made to work by choosing a better number either. Ablating the
 * right branch — the enumerator failing to offer the drawn placement is not
 * hypothetical, `truthEnumerated` is false for all four branches at panel 2 —
 * gives wrong-pick margins of 0.1776 and 0.0238. The minimum right margin
 * (0.0622) is below the maximum wrong one (0.1776), and the same interleaving
 * holds for the ratio, so no threshold on margin separates right from wrong on
 * this data.
 *
 * What is left for it to say is "these two candidates are not distinguishable by
 * this registration", and that has a measured size: replaying the search at
 * stride 1 instead of stride 4 moves the reported agreement by up to 0.009916,
 * and a margin differences two independently registered agreements, so it
 * carries up to twice that in pure search noise. Hence 0.02. Its false-accept
 * rate is 2 in 2 by construction; the gate that decides is the one below.
 */
export const DEFERRED_STEP_MINIMUM_MARGIN = 0.02;

/**
 * How much the winning candidate must agree with the lookahead panel outright.
 *
 * This is the discriminator. Of every quantity the probe recorded, the winner's
 * own absolute agreement is the only one that separates the right pick from the
 * wrong one: right picks scored 0.9031 (panel 2) and 0.8898 (panel 3), and the
 * best wrong candidate — the right branch ablated away, so the set no longer
 * contains the answer — scored 0.6946 and 0.8276. The separating window is
 * (0.827593, 0.889836], and 0.85 sits inside it. On every observation that
 * exists: false-refusal 0 of 3, false-accept 0 of 2.
 *
 * Its headroom is stated rather than hidden, because it is thin. 0.85 is 6.3 px
 * of registration error away from the panel-2 observation and 4.5 px from the
 * panel-3 one, and one pixel of registration error moves this agreement by up to
 * 0.0328. It is also not obviously portable across panels: the excluded region is
 * 106% of the built art at panel 2 and 236% at panel 3. What recommends it over
 * a margin is that it does not degrade as candidates are added, and production
 * runs a 400-candidate product in which the runner-up is a near-duplicate by
 * construction.
 */
export const DEFERRED_STEP_MINIMUM_AGREEMENT = 0.85;

/**
 * How many printed steps forward a deferral may look.
 *
 * One, because one is all that has ever been measured. The panel-3 observation
 * that would license two is oracle-conditioned — its prefixes were built from
 * the official transform of step 2 rotated into each branch, which no run can
 * do — and a real two-panel rule would carry step-2 candidates forward from a
 * set the probe showed does not contain the answer. Reachability comes before
 * ranking, so this stays at one until a second reach is measured without an
 * oracle.
 */
export const DEFERRED_STEP_MAXIMUM_REACH_STEPS = 1;

/**
 * Why a printed step is being settled by a later panel than its own.
 *
 * `no-local-signal` is the first printed step's case: the panel prints no
 * highlight at all, so `scoreStepDelta` has nothing to compare against and every
 * candidate scores exactly zero.
 *
 * `unseparated-by-own-panel` is the same fact reached from the other side. The
 * panel did print a highlight, every eligible candidate was scored against it,
 * and the best two came back indistinguishable — which is what a booklet draws
 * whenever the shape it is drawing does not change under the displacement that
 * separates two seats. A long thin plate slid along its own axis barely changes
 * its silhouette, so the panel's own art cannot say which of the two it drew.
 *
 * Both are "this panel cannot answer", and the booklet supplies the same remedy
 * for both: panel N+1 draws everything placed at step N as already built,
 * seated and unhighlighted, so it is an independent witness that panel N is not.
 */
export type DeferralTrigger = "no-local-signal" | "unseparated-by-own-panel";

/**
 * Whether a step's own panel scored its candidates and could not choose.
 *
 * Deliberately narrow, and the narrowness is the point: what earns a lookahead
 * is evidence that the *drawing* does not distinguish two placements, not any
 * failure to reach a decision. `zero-placement-score` says nothing scored at
 * all, `no-placement-candidate` that nothing was eligible,
 * `incomplete-placement-scoring` that not every eligible candidate was scored,
 * and `resource-budget-exhausted` that the search could not be afforded. Each of
 * those is a defect in how this step was looked at, and answering it with the
 * next panel would use a second picture to paper over the first one never having
 * been read properly.
 *
 * Deferring is not deciding. The step still has to clear the lookahead's own
 * gates, and if panel N+1 cannot separate the two either it refuses by name —
 * `weak-deferred-agreement` or `ambiguous-deferred-placement` — rather than
 * picking the survivor of two inconclusive comparisons.
 *
 * The scores are required as well as the code because `selectUniquePlacementScore`
 * spends `ambiguous-placement-score` on two unrelated things: a margin below the
 * minimum, and non-finite scoring evidence or an invalid minimum margin. Only
 * the first is a fact about the drawing. The second is a defect in the run, and
 * a defect that deferred would be a defect that reached a later panel and
 * settled there.
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

/**
 * Shifts the coarse registration search samples, in pixels of stride.
 *
 * The search maximises agreement over translation because the panel's camera
 * fit pins angle and scale but not where the drawing sits on the page. Sampling
 * every fourth pixel in each axis costs a sixteenth of the work; the reported
 * agreement is then recomputed at full resolution at the chosen shift, so no
 * reported number is a subsample.
 *
 * What the subsampling costs was measured rather than assumed, because this
 * docstring used to claim it moved the chosen shift "by at most a pixel":
 * replaying the same search at stride 1 on the probe's eight mask pairs moves
 * the optimum by up to 7.3 px and reports an agreement up to 0.009916 below the
 * stride-1 optimum. `DEFERRED_STEP_MINIMUM_MARGIN` is sized from that number.
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
 * Refuses a deferral that would look further forward than has been measured.
 *
 * Separate from the decision procedure because the caller must be able to refuse
 * before it renders a few hundred candidate prefixes, and because a refusal that
 * arrives after scoring publishes a margin and an agreement that nothing
 * calibrates.
 */
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

/**
 * Picks the deferred step's placement, or refuses and says which gate refused.
 *
 * The candidate list is the whole printed step, not one piece: a step whose
 * panel says nothing cannot settle its pieces one at a time, because the second
 * piece is enumerated on top of the first.
 */
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
  /** Complete leaves reached before a later all-or-nothing refusal. */
  readonly exploredCandidates: readonly WholeStepCandidate<D>[];
  /** Distinct placements offered for each piece on the first branch explored. */
  readonly perPiece: readonly number[];
  /**
   * Of those, how many survived the step's own panel on that branch.
   *
   * Identical to `perPiece` when nothing narrowed. Reported separately so a
   * refusal can say whether a product blew up because the step is genuinely
   * that open or because its own panel said nothing useful about it.
   */
  readonly perPieceCarried: readonly number[];
  readonly narrowingRenders: number;
  readonly overBudget: boolean;
  readonly budget: number;
  readonly overNarrowingBudget: boolean;
  readonly narrowingBudget: number;
}

export type WholeStepPlacementTransform = {
  readonly positionLdu: readonly [number, number, number];
  readonly orientationId: string;
};

/**
 * One live narrowing-render allowance shared by any number of enumerations.
 *
 * A reservation is atomic: `tryReserve` returns false without changing
 * `reserved` when the whole batch would cross `budget`. Callers can therefore
 * hand the same ledger to every parent expansion without multiplying a
 * per-parent allowance or starting a render batch that cannot finish.
 */
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

/**
 * One live complete-candidate allowance shared by every parent enumeration.
 *
 * Each unique complete leaf reserves one unit before it can enter the retained
 * evidence. A failed reservation leaves `reserved` unchanged, so callers keep
 * the complete leaves already reached while refusing the aggregate frontier.
 */
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

/**
 * Every way the whole printed step could be placed, as complete documents.
 *
 * Depth-first over the pieces because a later piece is enumerated on top of an
 * earlier one, so the set is a product rather than a union. It refuses over its
 * budget rather than truncating: a quietly capped product reads as a settled
 * step that was never fully considered.
 *
 * `narrow` is how a step that *has* a panel keeps that product finite. It is
 * given every placement offered on a branch and returns the ones the step's own
 * panel could not separate; a step whose panel says nothing passes null and
 * carries the whole product, as printed step 1 does.
 */
export function enumerateWholeStepCandidates<D>(input: {
  readonly baseDocument: D;
  readonly stepId: string | null;
  readonly pieces: readonly { readonly catalogPartId: string; readonly colorId: string }[];
  readonly enumerateDistinct: (
    document: D,
    catalogPartId: string,
  ) => readonly WholeStepPlacementTransform[];
  readonly narrow:
    | ((input: {
        readonly document: D;
        /**
         * The printed step this branch has already opened, or null before its
         * first piece. Narrowing places a probe part to render it, and a probe
         * that opened a second step of its own would collide with the one the
         * branch is building.
         */
        readonly stepId: string | null;
        readonly catalogPartId: string;
        readonly colorId: string;
        readonly offered: readonly WholeStepPlacementTransform[];
      }) => readonly WholeStepPlacementTransform[])
    | null;
  readonly narrowingRenderBudget: number;
  /**
   * Optional aggregate allowance shared across parent enumerations. The local
   * `narrowingRenderBudget` keeps its historical per-enumeration meaning only
   * when no shared ledger is supplied. With a ledger, its atomic reservation
   * is authoritative so every refusal has one unambiguous provenance.
   */
  readonly narrowingRenderBudgetLedger?: NarrowingRenderBudgetLedger;
  /**
   * Optional aggregate complete-leaf allowance shared across parent
   * enumerations. A refused leaf is not retained, while earlier reserved leaves
   * remain available as immutable evidence through `exploredCandidates`. When
   * supplied, this is the authoritative candidate allowance; `budget` keeps
   * its historical per-enumeration meaning only when no shared ledger exists.
   */
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
    transform: WholeStepPlacementTransform,
    colorId: string,
    stepId: string | null,
  ) => { readonly document: D; readonly partId: string; readonly stepId: string };
  readonly budget: number;
}): WholeStepEnumeration<D> {
  const candidates: WholeStepCandidate<D>[] = [];
  const perPiece: number[] = [];
  const perPieceCarried: number[] = [];
  let narrowingRenders = 0;
  let overBudget = false;
  let overNarrowingBudget = false;

  const completeOccupancyKeys = new Set<string>();
  const completeOccupancyKey = (candidate: WholeStepCandidate<D>): string | null => {
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

  const walk = (partial: WholeStepCandidate<D>, pieceIndex: number): void => {
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
    const offered = input.enumerateDistinct(partial.document, piece.catalogPartId);
    if (perPiece.length === pieceIndex) perPiece.push(offered.length);
    let carried = offered;
    // A single offer is already decided, and rendering it would spend the
    // narrowing budget to confirm a set of one.
    if (input.narrow !== null && offered.length > 1) {
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
    for (const transform of carried) {
      if (overBudget || overNarrowingBudget) return;
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
