/** Dependency-injected production seam for one bounded N -> N+1 -> K farther search. */

import {
  createWholeStepCandidateBudgetLedger,
  type BudgetReservationFailure,
  type NarrowingRenderBudgetLedger,
  type WholeStepCandidateBudgetLedger,
} from "./real-build-deferral";
import type { NarrowingSubjectRenderBudgetLedger } from "./real-build-narrowing-subject-budget";
import {
  carryFartherFrontier,
  createFartherOriginFrontier,
  findFirstRevealingPanel,
  type FartherAtomicPieceIdentity,
  type FartherCandidate,
  type FartherCarryEvidence,
  type FartherFrontier,
  type FartherLineageStep,
  type FartherOriginCandidateInput,
  type FartherOriginEvidence,
  type FartherPanelObservationInput,
  type FartherParentExpansion,
  type FartherPlacementWitness,
  type FartherRefusal,
  type FirstRevealingPanelResult,
} from "./real-build-farther-panel";
import { freezeArray, freezeLineageStep } from "./real-build-farther-panel-freeze";

export interface FartherDriverOrigin<D> extends FartherOriginCandidateInput<D> {
  /** The N+1 agreement already measured by the deferring step. */
  readonly lookaheadAgreement: number;
}

export interface FartherDriverChild<D> {
  readonly candidateId: string;
  readonly document: D;
  readonly documentHash: string;
  readonly pieces: readonly FartherPlacementWitness[];
}

/** Structurally compatible with expandFartherPrintedStep; extra child fields remain recoverable. */
export interface FartherDriverExpansionOutput<D, C extends FartherDriverChild<D>> {
  readonly expansion: FartherParentExpansion<D>;
  readonly children: readonly C[];
  readonly narrowingBudgetExhausted: boolean;
  readonly candidateBudgetExhausted: boolean;
  readonly failure: { readonly message: string } | null;
}

export interface FartherDriverAlternative<D, C extends FartherDriverChild<D>> {
  readonly candidateId: string;
  readonly parentCandidateId: string;
  readonly originCandidateId: string;
  readonly document: D;
  readonly documentHash: string;
  readonly pieces: readonly FartherPlacementWitness[];
  readonly lineage: readonly FartherLineageStep[];
  /** Exact callback object, including opaque partIds/stepId/registrations/captures. */
  readonly source: C;
}

export interface FartherDriverParentAttempt<D, C extends FartherDriverChild<D>> {
  readonly parentCandidateId: string;
  readonly originCandidateId: string;
  readonly reservedBefore: number;
  readonly reservedAfter: number;
  readonly expansion: FartherParentExpansion<D>;
  readonly alternatives: readonly FartherDriverAlternative<D, C>[];
  readonly status: "complete" | "refused";
  readonly failure: string | null;
}

export interface FartherDriverEvidence {
  readonly origin: FartherOriginEvidence;
  readonly carry: FartherCarryEvidence | null;
  readonly panels: FirstRevealingPanelResult["evidence"] | null;
  readonly narrowingLedger: {
    readonly maximum: number;
    readonly reserved: number;
    readonly refusedReservation: boolean;
    readonly failedReservation: BudgetReservationFailure | null;
  };
  readonly candidateLedger: {
    readonly maximum: number;
    readonly reserved: number;
    readonly refusedReservation: boolean;
    readonly failedReservation: BudgetReservationFailure | null;
  };
}

/** Atomic authorization for the exact K-panel score rows the callback may render. */
export interface FartherPanelRenderReservation {
  readonly renderedBefore: number;
  readonly reservedForPanel: number;
  readonly renderedAfter: number;
  readonly maximumPanelRenders: number;
}

export interface FartherDriverDecision {
  readonly originCandidateId: string;
  readonly revealingStepNumber: number;
  readonly survivingCandidateIds: readonly string[];
  readonly rejectedCandidateIds: readonly string[];
  readonly descendantSettled: boolean;
  /** Kept separate so choosing an origin family never claims its children are settled. */
  readonly unresolvedDescendantIds: readonly string[];
}

export interface FartherDriverResult<
  D,
  O extends FartherDriverOrigin<D>,
  C extends FartherDriverChild<D>,
> {
  readonly decision: FartherDriverDecision | null;
  readonly refusal: FartherRefusal | null;
  /** Null on every refusal: partial work is evidence, never an admitted frontier. */
  readonly frontier: FartherFrontier<D> | null;
  readonly originAlternatives: readonly O[];
  readonly parentAttempts: readonly FartherDriverParentAttempt<D, C>[];
  readonly completedAlternatives: readonly FartherDriverAlternative<D, C>[];
  readonly rejectedAlternatives: readonly FartherDriverAlternative<D, C>[];
  readonly unresolvedAlternatives: readonly FartherDriverAlternative<D, C>[];
  readonly evidence: FartherDriverEvidence;
}

export interface FartherDriverInput<
  D,
  O extends FartherDriverOrigin<D>,
  C extends FartherDriverChild<D>,
> {
  readonly originStepNumber: number;
  readonly origins: readonly O[];
  readonly originEvidence: FartherOriginEvidence;
  readonly interveningStepNumber: number;
  readonly expectedAtomicPieces: readonly FartherAtomicPieceIdentity[];
  readonly maximumCandidates: number;
  readonly narrowingLedger: NarrowingRenderBudgetLedger;
  /** Opts the driver into refundable physical subject-render accounting. */
  readonly depthNarrowingLedger?: NarrowingSubjectRenderBudgetLedger;
  readonly minimumAgreement: number;
  readonly minimumMargin: number;
  readonly maximumPanelRenders: number;
  readonly maximumReachSteps: number;
  readonly fartherPanelsAvailableAfterK: boolean;
  readonly hashDocument: (document: D) => string;
  readonly expandParent: (input: {
    readonly parent: FartherCandidate<D>;
    readonly origin: O;
    readonly ledger: NarrowingRenderBudgetLedger;
    readonly depthNarrowingLedger?: NarrowingSubjectRenderBudgetLedger;
    readonly candidateLedger: WholeStepCandidateBudgetLedger;
  }) => FartherDriverExpansionOutput<D, C>;
  /** Exact N+1 scores already measured by the deferring step. */
  readonly originPanelObservation: FartherPanelObservationInput;
  readonly scoreFrontierPanel:
    | ((input: {
        readonly stepNumber: number;
        readonly alternatives: readonly FartherDriverAlternative<D, C>[];
        readonly reservation: FartherPanelRenderReservation;
      }) => FartherPanelObservationInput)
    | null;
}

const refusal = (
  code: FartherRefusal["code"],
  stage: FartherRefusal["stage"],
  stepNumber: number,
  message: string,
): FartherRefusal => Object.freeze({ code, stage, stepNumber, message });

const thrownMessage = (error: unknown): string => {
  try {
    return error instanceof Error ? error.message : String(error);
  } catch {
    return "an uninspectable thrown value";
  }
};

const sameWitnesses = (
  left: readonly FartherPlacementWitness[],
  right: readonly FartherPlacementWitness[],
): boolean => JSON.stringify(left) === JSON.stringify(right);

const isCoherentBudgetFailure = (
  failure: BudgetReservationFailure | null,
  reserved: number,
  budget: number,
): boolean =>
  failure === null ||
  (Object.keys(failure).length === 3 &&
    Object.hasOwn(failure, "reservedBefore") &&
    Object.hasOwn(failure, "requested") &&
    Object.hasOwn(failure, "budget") &&
    Number.isSafeInteger(failure.reservedBefore) &&
    failure.reservedBefore === reserved &&
    Number.isSafeInteger(failure.requested) &&
    failure.requested > 0 &&
    Number.isSafeInteger(failure.budget) &&
    failure.budget === budget &&
    reserved >= 0 &&
    reserved <= budget &&
    failure.requested > budget - reserved);

const isCoherentCandidateBudgetFailure = (
  failure: BudgetReservationFailure | null,
  reserved: number,
  budget: number,
): boolean =>
  failure === null ||
  (isCoherentBudgetFailure(failure, reserved, budget) &&
    failure.requested === 1 &&
    reserved === budget);

/** Runs exactly one intervening expansion and the N+1 / K=N+2 observation sequence. */
export function runFartherPanelDriver<
  D,
  O extends FartherDriverOrigin<D>,
  C extends FartherDriverChild<D>,
>(input: FartherDriverInput<D, O, C>): FartherDriverResult<D, O, C> {
  const originAlternatives = freezeArray(input.origins);
  const attempts: FartherDriverParentAttempt<D, C>[] = [];
  const completed: FartherDriverAlternative<D, C>[] = [];
  let carryEvidence: FartherCarryEvidence | null = null;
  let panelEvidence: FirstRevealingPanelResult["evidence"] | null = null;
  let candidateLedger: WholeStepCandidateBudgetLedger | null = null;
  const subjectLedger = input.depthNarrowingLedger;
  const narrowingBudget = subjectLedger?.budget ?? input.narrowingLedger.budget;
  const narrowingReserved = () => subjectLedger?.committed ?? input.narrowingLedger.reserved;
  const narrowingRefused = () =>
    subjectLedger?.refusedReservation ?? input.narrowingLedger.refusedReservation;
  const narrowingFailure = () =>
    subjectLedger?.failedReservation ?? input.narrowingLedger.failedReservation;
  const freezeFailure = (
    failure: BudgetReservationFailure | null | undefined,
  ): BudgetReservationFailure | null =>
    failure === null || failure === undefined ? null : Object.freeze({ ...failure });

  const finish = (values: {
    decision?: FartherDriverDecision | null;
    refusal?: FartherRefusal | null;
    frontier?: FartherFrontier<D> | null;
    rejected?: readonly FartherDriverAlternative<D, C>[];
    unresolved?: readonly FartherDriverAlternative<D, C>[];
  }): FartherDriverResult<D, O, C> =>
    Object.freeze({
      decision: values.decision ?? null,
      refusal: values.refusal ?? null,
      frontier:
        values.refusal === null || values.refusal === undefined ? (values.frontier ?? null) : null,
      originAlternatives,
      parentAttempts: freezeArray(attempts),
      completedAlternatives: freezeArray(completed),
      rejectedAlternatives: freezeArray(values.rejected ?? []),
      unresolvedAlternatives: freezeArray(values.unresolved ?? (values.refusal ? completed : [])),
      evidence: Object.freeze({
        origin: Object.freeze({ ...input.originEvidence }),
        carry: carryEvidence,
        panels: panelEvidence,
        narrowingLedger: Object.freeze({
          maximum: narrowingBudget,
          reserved: narrowingReserved(),
          refusedReservation: narrowingRefused(),
          failedReservation: freezeFailure(narrowingFailure()),
        }),
        candidateLedger: Object.freeze({
          maximum: input.maximumCandidates,
          reserved: candidateLedger?.reserved ?? 0,
          refusedReservation: candidateLedger?.refusedReservation ?? false,
          failedReservation: freezeFailure(candidateLedger?.failedReservation),
        }),
      }),
    });

  const failInput = (stepNumber: number, message: string) =>
    finish({
      refusal: refusal("farther-input-invalid", "input", stepNumber, message),
    });
  if (
    input.interveningStepNumber !== input.originStepNumber + 1 ||
    !Number.isSafeInteger(input.maximumCandidates) ||
    input.maximumCandidates < 0 ||
    input.narrowingLedger.reserved !== 0 ||
    input.narrowingLedger.refusedReservation ||
    input.narrowingLedger.failedReservation !== null ||
    !Number.isSafeInteger(input.narrowingLedger.budget) ||
    input.narrowingLedger.budget < 0 ||
    (subjectLedger !== undefined &&
      (subjectLedger.budget !== input.narrowingLedger.budget ||
        subjectLedger.committed !== 0 ||
        subjectLedger.held !== 0 ||
        subjectLedger.activeLease ||
        subjectLedger.refusedReservation ||
        subjectLedger.failedReservation !== null))
  ) {
    return failInput(
      input.originStepNumber,
      `Farther driver requires intervening step ${input.originStepNumber + 1} and a fresh non-negative ` +
        `candidate/narrowing budget; received step ${input.interveningStepNumber}, candidate budget ` +
        `${String(input.maximumCandidates)}, and narrowing budget/reserved/refused ` +
        `${input.narrowingLedger.budget}/${input.narrowingLedger.reserved}/` +
        `${String(input.narrowingLedger.refusedReservation)}/${JSON.stringify(input.narrowingLedger.failedReservation)}` +
        (subjectLedger === undefined
          ? "."
          : ` with depth budget/committed/held/active/refused ${subjectLedger.budget}/` +
            `${subjectLedger.committed}/${subjectLedger.held}/${String(subjectLedger.activeLease)}/` +
            `${String(subjectLedger.refusedReservation)}/${JSON.stringify(subjectLedger.failedReservation)}.`),
    );
  }
  candidateLedger = createWholeStepCandidateBudgetLedger(input.maximumCandidates);

  const verifyHash = (candidateId: string, document: D, claimed: string): string | null => {
    let actual: string;
    try {
      actual = input.hashDocument(document);
    } catch (error) {
      return `Candidate ${JSON.stringify(candidateId)} could not be hashed: ${thrownMessage(error)}.`;
    }
    return actual === claimed
      ? null
      : `Candidate ${JSON.stringify(candidateId)} declares document hash ${JSON.stringify(claimed)}, ` +
          `but hashDocument returned ${JSON.stringify(actual)}.`;
  };
  const verifyAllKnownHashes = (
    additional: readonly FartherDriverAlternative<D, C>[] = [],
  ): string | null => {
    for (const origin of input.origins) {
      const error = verifyHash(origin.candidateId, origin.document, origin.documentHash);
      if (error !== null) return error;
    }
    for (const alternative of completed) {
      const error = verifyHash(
        alternative.candidateId,
        alternative.document,
        alternative.documentHash,
      );
      if (error !== null) return error;
    }
    for (const alternative of additional) {
      const error = verifyHash(
        alternative.candidateId,
        alternative.document,
        alternative.documentHash,
      );
      if (error !== null) return error;
    }
    return null;
  };
  for (const origin of input.origins) {
    const error = verifyHash(origin.candidateId, origin.document, origin.documentHash);
    if (error !== null) return failInput(input.originStepNumber, error);
  }
  const originResult = createFartherOriginFrontier({
    stepNumber: input.originStepNumber,
    candidates: input.origins.map(({ candidateId, document, documentHash, pieces }) => ({
      candidateId,
      document,
      documentHash,
      pieces,
    })),
  });
  if (originResult.frontier === null) return finish({ refusal: originResult.refusal });
  const originById = new Map(input.origins.map((origin) => [origin.candidateId, origin]));
  // Parse and account for the already-measured N+1 observation before any
  // expansion. Its evidence survives an aggregate carry refusal, but it cannot
  // select a family until every parent has produced a complete frontier.
  const originObservation = findFirstRevealingPanel({
    frontier: originResult.frontier,
    originEvidence: input.originEvidence,
    panels: [input.originPanelObservation],
    minimumAgreement: input.minimumAgreement,
    minimumMargin: input.minimumMargin,
    maximumPanelRenders: input.maximumPanelRenders,
    maximumReachSteps: input.maximumReachSteps,
    fartherPanelsAvailable: true,
  });
  panelEvidence = originObservation.evidence;
  if (
    originObservation.refusal !== null &&
    originObservation.refusal.code !== "farther-panel-limit-reached"
  ) {
    return finish({ refusal: originObservation.refusal });
  }

  for (const parent of originResult.frontier.candidates) {
    const origin = originById.get(parent.originCandidateId);
    if (origin === undefined) return failInput(input.originStepNumber, "Origin lineage was lost.");
    const beforeParent = verifyHash(
      parent.candidateId,
      parent.document,
      parent.lineage[0]!.documentHash,
    );
    const beforeOrigin = verifyHash(origin.candidateId, origin.document, origin.documentHash);
    if (beforeParent !== null || beforeOrigin !== null) {
      return failInput(input.originStepNumber, beforeParent ?? beforeOrigin!);
    }
    const reservedBefore = narrowingReserved();
    const candidatesReservedBefore = candidateLedger.reserved;
    let output: FartherDriverExpansionOutput<D, C>;
    try {
      output = input.expandParent({
        parent,
        origin,
        ledger: input.narrowingLedger,
        ...(subjectLedger === undefined ? {} : { depthNarrowingLedger: subjectLedger }),
        candidateLedger,
      });
    } catch (error) {
      const hashError = verifyAllKnownHashes();
      if (hashError !== null) return failInput(input.interveningStepNumber, hashError);
      return failInput(
        input.interveningStepNumber,
        `Expansion for parent ${JSON.stringify(parent.candidateId)} threw: ${thrownMessage(error)}.`,
      );
    }
    const callbackHashError = verifyAllKnownHashes();
    if (callbackHashError !== null) {
      return failInput(input.interveningStepNumber, callbackHashError);
    }
    const reservedAfter = narrowingReserved();
    const candidatesReservedAfter = candidateLedger.reserved;
    const expansion = output.expansion;
    if (
      narrowingRefused() !== (narrowingFailure() !== null) ||
      !isCoherentBudgetFailure(narrowingFailure(), reservedAfter, narrowingBudget) ||
      output.narrowingBudgetExhausted !== narrowingRefused()
    ) {
      return failInput(
        input.interveningStepNumber,
        `Expansion for parent ${JSON.stringify(parent.candidateId)} reported narrowing-budget exhaustion ` +
          `${String(output.narrowingBudgetExhausted)}, but the shared narrowing ledger recorded ` +
          `${String(narrowingRefused())} with witness ${JSON.stringify(narrowingFailure())}.`,
      );
    }
    if (
      candidateLedger.refusedReservation !== (candidateLedger.failedReservation !== null) ||
      !isCoherentCandidateBudgetFailure(
        candidateLedger.failedReservation,
        candidatesReservedAfter,
        candidateLedger.budget,
      ) ||
      output.candidateBudgetExhausted !== candidateLedger.refusedReservation
    ) {
      return failInput(
        input.interveningStepNumber,
        `Expansion for parent ${JSON.stringify(parent.candidateId)} reported candidate-budget exhaustion ` +
          `${String(output.candidateBudgetExhausted)}, but the shared candidate ledger recorded ` +
          `${String(candidateLedger.refusedReservation)} with witness ` +
          `${JSON.stringify(candidateLedger.failedReservation)}.`,
      );
    }
    if (
      expansion.parentCandidateId !== parent.candidateId ||
      expansion.narrowingRenders !== reservedAfter - reservedBefore
    ) {
      return failInput(
        input.interveningStepNumber,
        `Expansion for parent ${JSON.stringify(parent.candidateId)} reported parent/renders ` +
          `${JSON.stringify(expansion.parentCandidateId)}/${expansion.narrowingRenders}; required ` +
          `${JSON.stringify(parent.candidateId)}/${reservedAfter - reservedBefore} from the shared ledger.`,
      );
    }
    const childById = new Map(output.children.map((child) => [child.candidateId, child]));
    if (
      childById.size !== output.children.length ||
      expansion.children.length !== output.children.length ||
      expansion.children.length !== candidatesReservedAfter - candidatesReservedBefore
    ) {
      return failInput(
        input.interveningStepNumber,
        `Expansion for parent ${JSON.stringify(parent.candidateId)} returned ${expansion.children.length} ` +
          `frontier children and ${output.children.length} metadata children after reserving ` +
          `${candidatesReservedAfter - candidatesReservedBefore} aggregate candidates; required one unique, ` +
          `reserved metadata row each.`,
      );
    }
    const alternatives: FartherDriverAlternative<D, C>[] = [];
    for (const child of expansion.children) {
      const source = childById.get(child.candidateId);
      if (
        source === undefined ||
        source.document !== child.document ||
        source.documentHash !== child.documentHash ||
        !sameWitnesses(source.pieces, child.pieces)
      ) {
        return failInput(
          input.interveningStepNumber,
          `Child ${JSON.stringify(child.candidateId)} under parent ${JSON.stringify(parent.candidateId)} ` +
            `does not bind its exact frontier document, hash, pieces, and metadata row.`,
        );
      }
      const hashError = verifyHash(child.candidateId, child.document, child.documentHash);
      if (hashError !== null) return failInput(input.interveningStepNumber, hashError);
      alternatives.push(
        Object.freeze({
          candidateId: child.candidateId,
          parentCandidateId: parent.candidateId,
          originCandidateId: parent.originCandidateId,
          document: child.document,
          documentHash: child.documentHash,
          pieces: freezeLineageStep({
            stepNumber: input.interveningStepNumber,
            documentHash: child.documentHash,
            pieces: child.pieces,
          }).pieces,
          lineage: freezeArray([
            ...parent.lineage,
            freezeLineageStep({
              stepNumber: input.interveningStepNumber,
              documentHash: child.documentHash,
              pieces: child.pieces,
            }),
          ]),
          source,
        }),
      );
    }
    const completedHashError = verifyAllKnownHashes(alternatives);
    if (completedHashError !== null) {
      return failInput(input.interveningStepNumber, completedHashError);
    }
    const budgetRefused = output.narrowingBudgetExhausted || output.candidateBudgetExhausted;
    const failed = budgetRefused || output.failure !== null;
    const attempt = Object.freeze({
      parentCandidateId: parent.candidateId,
      originCandidateId: parent.originCandidateId,
      reservedBefore,
      reservedAfter,
      expansion,
      alternatives: freezeArray(alternatives),
      status: failed ? ("refused" as const) : ("complete" as const),
      failure: output.failure?.message ?? null,
    });
    attempts.push(attempt);
    completed.push(...alternatives);
    if (failed) {
      carryEvidence = carryFartherFrontier({
        frontier: originResult.frontier,
        stepNumber: input.interveningStepNumber,
        expectedAtomicPieces: input.expectedAtomicPieces,
        expansions: attempts.map(({ expansion: measured }) => measured),
        maximumCandidates: input.maximumCandidates,
        maximumNarrowingRenders: narrowingBudget,
      }).evidence;
      const code = output.narrowingBudgetExhausted
        ? "aggregate-narrowing-budget-exhausted"
        : output.candidateBudgetExhausted
          ? "aggregate-candidate-budget-exhausted"
          : "incomplete-parent-expansion";
      return finish({
        refusal: refusal(
          code,
          budgetRefused ? "budget" : "evidence",
          input.interveningStepNumber,
          output.narrowingBudgetExhausted
            ? `Step ${input.interveningStepNumber} refused parent ${JSON.stringify(parent.candidateId)} when ` +
                `its next narrowing batch exceeded the shared ${narrowingBudget}-render budget. ` +
                `The batch work was not invoked and no partial frontier was admitted.`
            : (output.failure?.message ??
                `Step ${input.interveningStepNumber} exceeded its aggregate candidate budget; no partial frontier was admitted.`),
        ),
      });
    }
  }

  const carried = carryFartherFrontier({
    frontier: originResult.frontier,
    stepNumber: input.interveningStepNumber,
    expectedAtomicPieces: input.expectedAtomicPieces,
    expansions: attempts.map(({ expansion }) => expansion),
    maximumCandidates: input.maximumCandidates,
    maximumNarrowingRenders: narrowingBudget,
  });
  carryEvidence = carried.evidence;
  if (carried.frontier === null) return finish({ refusal: carried.refusal });

  let hashError = verifyAllKnownHashes();
  if (hashError !== null) return failInput(input.interveningStepNumber, hashError);
  const nPlusOne = input.originPanelObservation;
  const first = findFirstRevealingPanel({
    frontier: carried.frontier,
    originEvidence: input.originEvidence,
    panels: [nPlusOne],
    minimumAgreement: input.minimumAgreement,
    minimumMargin: input.minimumMargin,
    maximumPanelRenders: input.maximumPanelRenders,
    maximumReachSteps: input.maximumReachSteps,
    fartherPanelsAvailable: true,
  });
  if (first.decision !== null) {
    panelEvidence = first.evidence;
    return finishDecision(first, carried.frontier, completed, finish);
  }
  if (first.refusal?.code !== "farther-panel-limit-reached") {
    panelEvidence = first.evidence;
    return finish({ refusal: first.refusal });
  }
  if (input.scoreFrontierPanel === null) {
    panelEvidence = first.evidence;
    return finish({
      refusal: refusal(
        "not-observable",
        "evidence",
        input.interveningStepNumber,
        `No panel K was supplied after step ${input.interveningStepNumber}; origin step ` +
          `${input.originStepNumber} remains not observable and no placement was guessed.`,
      ),
    });
  }
  if (input.maximumReachSteps < 2) {
    panelEvidence = first.evidence;
    return finish({
      refusal: refusal(
        "farther-panel-limit-reached",
        "budget",
        input.interveningStepNumber + 1,
        `Origin step ${input.originStepNumber} reached its ${input.maximumReachSteps}-step farther-panel ` +
          `limit before panel ${input.interveningStepNumber + 1}; that panel was not scored.`,
      ),
    });
  }
  hashError = verifyAllKnownHashes();
  if (hashError !== null) return failInput(input.interveningStepNumber + 1, hashError);
  const renderedBefore = first.evidence.panelRenders;
  const reservedForPanel = completed.length;
  const renderedAfter = renderedBefore + reservedForPanel;
  if (renderedAfter > input.maximumPanelRenders) {
    panelEvidence = first.evidence;
    return finish({
      refusal: refusal(
        "panel-render-budget-exhausted",
        "budget",
        input.interveningStepNumber + 1,
        `Panel ${input.interveningStepNumber + 1} would raise farther-panel renders from ` +
          `${renderedBefore} to ${renderedAfter}, above aggregate ${input.maximumPanelRenders} limit. ` +
          `The scoring callback was not invoked and no partial panel evidence was admitted.`,
      ),
    });
  }
  const reservation = Object.freeze({
    renderedBefore,
    reservedForPanel,
    renderedAfter,
    maximumPanelRenders: input.maximumPanelRenders,
  }) satisfies FartherPanelRenderReservation;
  let k: FartherPanelObservationInput;
  try {
    k = input.scoreFrontierPanel({
      stepNumber: input.interveningStepNumber + 1,
      alternatives: freezeArray(completed),
      reservation,
    });
  } catch (error) {
    hashError = verifyAllKnownHashes();
    if (hashError !== null) return failInput(input.interveningStepNumber + 1, hashError);
    panelEvidence = first.evidence;
    return finish({
      refusal: refusal(
        "incomplete-panel-evidence",
        "evidence",
        input.interveningStepNumber + 1,
        `Panel ${input.interveningStepNumber + 1} scoring callback threw: ${thrownMessage(error)}. ` +
          `Required exactly one finite agreement score for each of the ${reservedForPanel} reserved frontier candidates; ` +
          `the prior panel evidence was retained and no partial K panel was admitted.`,
      ),
    });
  }
  hashError = verifyAllKnownHashes();
  if (hashError !== null) return failInput(input.interveningStepNumber + 1, hashError);
  const final = findFirstRevealingPanel({
    frontier: carried.frontier,
    originEvidence: input.originEvidence,
    panels: [nPlusOne, k],
    minimumAgreement: input.minimumAgreement,
    minimumMargin: input.minimumMargin,
    maximumPanelRenders: input.maximumPanelRenders,
    maximumReachSteps: input.maximumReachSteps,
    fartherPanelsAvailable: input.fartherPanelsAvailableAfterK,
  });
  panelEvidence = final.evidence;
  if (final.decision === null) return finish({ refusal: final.refusal });
  return finishDecision(final, carried.frontier, completed, finish);
}

function finishDecision<D, O extends FartherDriverOrigin<D>, C extends FartherDriverChild<D>>(
  panel: FirstRevealingPanelResult,
  frontier: FartherFrontier<D>,
  completed: readonly FartherDriverAlternative<D, C>[],
  finish: (values: {
    decision?: FartherDriverDecision | null;
    refusal?: FartherRefusal | null;
    frontier?: FartherFrontier<D> | null;
    rejected?: readonly FartherDriverAlternative<D, C>[];
    unresolved?: readonly FartherDriverAlternative<D, C>[];
  }) => FartherDriverResult<D, O, C>,
): FartherDriverResult<D, O, C> {
  const decision = panel.decision!;
  const surviving = new Set(decision.survivingCandidateIds);
  const alternativeById = new Map(
    completed.map((alternative) => [alternative.candidateId, alternative]),
  );
  const unresolved = decision.descendantSettled
    ? []
    : decision.survivingCandidateIds.map((candidateId) => alternativeById.get(candidateId)!);
  const rejected = completed.filter(({ candidateId }) => !surviving.has(candidateId));
  return finish({
    decision: Object.freeze({
      ...decision,
      survivingCandidateIds: freezeArray(decision.survivingCandidateIds),
      rejectedCandidateIds: freezeArray(decision.rejectedCandidateIds),
      unresolvedDescendantIds: freezeArray(unresolved.map(({ candidateId }) => candidateId)),
    }),
    refusal: null,
    frontier,
    rejected,
    unresolved,
  });
}
