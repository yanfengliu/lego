import type { RealBuildOptions } from "./real-build-safety";
import {
  isFartherCarryEvidence,
  type FartherRetainedParent,
} from "./real-build-farther-carry-parser";
import {
  isCoherentUnresolvedDeferralScoreCard,
  isRealBuildFartherDeferralCoherent,
  validateFartherPanelEvidence,
  type FartherPanelCandidate,
  type FartherValidatedPanel,
  type RealBuildFartherDeferralSummary,
} from "./real-build-farther-panel-parser";
import {
  isExactFailedBudgetReservation,
  isExactFailedCandidateReservation,
  isRealBuildFartherRefusalCoherent,
} from "./real-build-farther-refusal-parser";
import type { RealBuildFartherEvidence } from "./real-build-farther-report-types";
import {
  DIGEST_PATTERN,
  exactKeys,
  hasExactAtomicPieces,
  isBoundedInteger,
  isDenseBoundedArray,
  isFartherId,
  isFartherWitnesses,
  isNullableFiniteNumber,
  isRecord,
  isTuple,
  isUnitInterval,
  sameJson,
} from "./real-build-farther-report-validation";
import { isRealBuildFartherDirectOriginTandemCoherent } from "./real-build-farther-tandem-parser";
import type { RealBuildSourceAttestation } from "./real-build-farther-origin-source-manifest";

export { isRealBuildFartherCaptures } from "./real-build-farther-capture-parser";
export { isRealBuildFartherDeferralCoherent };
export type { RealBuildFartherDeferralSummary };

export function isRealBuildFartherEvidence(
  value: unknown,
  reportStepNumber: number,
  expectedPieces: number,
  deferral: RealBuildFartherDeferralSummary | null,
  options: Pick<
    RealBuildOptions,
    | "maxParts"
    | "deferredCandidateBudget"
    | "deferredNarrowingRenderBudget"
    | "fartherPanelMaximumReachSteps"
    | "fartherPanelRenderBudget"
    | "minimumDeferredAgreement"
    | "minimumDeferredAgreementMargin"
    | "inputDigests"
    | "renderScale"
    | "panelWidth"
    | "workFactor"
    | "measuredFartherOriginSourceAttestation"
    | "panels"
  >,
  expectedSourceAttestation?: RealBuildSourceAttestation,
): value is RealBuildFartherEvidence | null {
  if (value === null) {
    if (deferral === null) return true;
    if (!isCoherentUnresolvedDeferralScoreCard(deferral)) return false;
    const actionable =
      deferral.settled === false &&
      (deferral.wholeStepCandidates as number) >= 2 &&
      deferral.lookaheadStepNumber === reportStepNumber + 1 &&
      options.panels.some(({ stepNumber }) => stepNumber === deferral.lookaheadStepNumber) &&
      options.fartherPanelMaximumReachSteps >= 2;
    return !actionable;
  }
  if (
    !isRecord(value) ||
    !exactKeys(value, ["origin", "carries", "panels", "budgets", "refusal", "decision"]) ||
    !isRecord(value.origin) ||
    !exactKeys(value.origin, ["evidence", "candidates"]) ||
    !isRecord(value.origin.evidence) ||
    !exactKeys(value.origin.evidence, ["stepNumber", "status", "margin", "minimumMargin"]) ||
    value.origin.evidence.stepNumber !== reportStepNumber ||
    !["no-local-signal", "unseparated"].includes(String(value.origin.evidence.status)) ||
    !isNullableFiniteNumber(value.origin.evidence.margin) ||
    !isNullableFiniteNumber(value.origin.evidence.minimumMargin) ||
    (value.origin.evidence.status === "no-local-signal" &&
      (value.origin.evidence.margin !== null || value.origin.evidence.minimumMargin !== null)) ||
    (value.origin.evidence.status === "unseparated" &&
      (value.origin.evidence.margin === null || value.origin.evidence.minimumMargin === null)) ||
    !isDenseBoundedArray(value.origin.candidates, options.deferredCandidateBudget) ||
    value.origin.candidates.length < 2 ||
    !isDenseBoundedArray(value.carries, options.fartherPanelMaximumReachSteps) ||
    !isDenseBoundedArray(value.panels, options.fartherPanelMaximumReachSteps) ||
    !isRecord(value.budgets) ||
    !exactKeys(value.budgets, [
      "offeredCandidates",
      "maximumCandidates",
      "narrowingRenders",
      "maximumNarrowingRenders",
      "panelRenders",
      "maximumPanelRenders",
      "reachSteps",
      "maximumReachSteps",
      "refusedReservation",
      "failedNarrowingReservation",
      "candidateRefusedReservation",
      "failedCandidateReservation",
    ])
  ) {
    return false;
  }
  if (!isRealBuildFartherDeferralCoherent(value, deferral)) {
    return false;
  }

  const originIds = new Set<string>();
  for (const candidate of value.origin.candidates) {
    if (
      !isRecord(candidate) ||
      !exactKeys(candidate, [
        "candidateId",
        "documentHash",
        "pieces",
        "lookaheadAgreement",
        "lookaheadShiftPx",
      ]) ||
      !isFartherId(candidate.candidateId) ||
      originIds.has(candidate.candidateId) ||
      typeof candidate.documentHash !== "string" ||
      !DIGEST_PATTERN.test(candidate.documentHash) ||
      !isFartherWitnesses(candidate.pieces, options.maxParts) ||
      (candidate.pieces as readonly unknown[]).length !== expectedPieces ||
      !isUnitInterval(candidate.lookaheadAgreement) ||
      !isTuple(candidate.lookaheadShiftPx, 2) ||
      candidate.lookaheadShiftPx.some((coordinate) => Math.abs(coordinate) > 1_000_000)
    ) {
      return false;
    }
    originIds.add(candidate.candidateId);
  }
  const originCandidates = value.origin.candidates as readonly Record<string, unknown>[];
  if (
    value.panels.length === 0 &&
    (originCandidates.length <= options.fartherPanelRenderBudget ||
      !isRecord(value.refusal) ||
      value.refusal.code !== "panel-render-budget-exhausted" ||
      value.refusal.stage !== "budget" ||
      value.refusal.stepNumber !== reportStepNumber + 1)
  ) {
    return false;
  }
  const preparedOriginPanel = options.panels.find(
    ({ stepNumber }) => stepNumber === reportStepNumber,
  );
  const preparedOriginPieces =
    preparedOriginPanel?.action.kind === "place-callouts"
      ? preparedOriginPanel.pieces.map(({ catalogPartId, colorId }) => ({ catalogPartId, colorId }))
      : [];
  if (
    preparedOriginPanel === undefined ||
    originCandidates.some(
      (candidate) =>
        !hasExactAtomicPieces(candidate.pieces as readonly unknown[], preparedOriginPieces),
    )
  ) {
    return false;
  }
  let expectedParents = new Map<string, FartherRetainedParent>(
    originCandidates.map((candidate) => [
      candidate.candidateId as string,
      {
        candidateId: candidate.candidateId as string,
        originCandidateId: candidate.candidateId as string,
        lineage: [
          {
            stepNumber: reportStepNumber,
            documentHash: candidate.documentHash,
            pieces: candidate.pieces,
          },
        ],
      },
    ]),
  );
  const carries = value.carries as readonly Record<string, unknown>[];
  if (
    !isRealBuildFartherDirectOriginTandemCoherent({
      reportStepNumber,
      carries,
      panels: value.panels as readonly Record<string, unknown>[],
      refusal: value.refusal,
      decision: value.decision,
      preparedOriginPanel,
      originCandidates,
      options,
      ...(expectedSourceAttestation === undefined ? {} : { expectedSourceAttestation }),
    })
  ) {
    return false;
  }
  const prefixRefusalStages = new Map<string, string>([
    ["incomplete-parent-expansion", "evidence"],
    ["aggregate-candidate-budget-exhausted", "budget"],
    ["aggregate-narrowing-budget-exhausted", "budget"],
  ]);
  const allowParentPrefix =
    value.decision === null &&
    isRecord(value.refusal) &&
    prefixRefusalStages.get(String(value.refusal.code)) === value.refusal.stage &&
    value.refusal.stepNumber === carries.at(-1)?.stepNumber;
  for (let index = 0; index < carries.length; index += 1) {
    const carry = carries[index];
    if (
      carry === undefined ||
      !isFartherCarryEvidence(
        carry,
        index,
        reportStepNumber,
        options,
        expectedParents,
        allowParentPrefix,
      )
    ) {
      return false;
    }
    if (
      carry.parentsExpanded !== carry.parentCandidates &&
      (!allowParentPrefix || index !== carries.length - 1)
    ) {
      return false;
    }
    const preparedPanel = options.panels.find(({ stepNumber }) => stepNumber === carry.stepNumber);
    const preparedAtomicPieces =
      preparedPanel?.action.kind === "place-callouts"
        ? preparedPanel.pieces.map(({ catalogPartId, colorId }) => ({ catalogPartId, colorId }))
        : null;
    if (
      preparedAtomicPieces === null ||
      !hasExactAtomicPieces(carry.expectedAtomicPieces as readonly unknown[], preparedAtomicPieces)
    ) {
      return false;
    }
    expectedParents = new Map(
      (carry.measuredLineages as readonly Record<string, unknown>[]).map((measured) => [
        measured.candidateId as string,
        {
          candidateId: measured.candidateId as string,
          originCandidateId: measured.originCandidateId as string,
          lineage: measured.lineage as readonly Record<string, unknown>[],
        },
      ]),
    );
  }
  const finalLineages: readonly FartherPanelCandidate[] =
    carries.length === 0
      ? originCandidates.map((candidate) => ({
          candidateId: candidate.candidateId as string,
          originCandidateId: candidate.candidateId as string,
        }))
      : [...expectedParents.values()].map(({ candidateId, originCandidateId }) => ({
          candidateId,
          originCandidateId,
        }));
  const panels = value.panels as readonly Record<string, unknown>[];
  const validatedPanels: FartherValidatedPanel[] = [];
  for (let index = 0; index < panels.length; index += 1) {
    const validated = validateFartherPanelEvidence(
      panels[index],
      index,
      reportStepNumber,
      options.deferredCandidateBudget + 1,
      originCandidates,
      finalLineages,
      options.minimumDeferredAgreement,
      options.minimumDeferredAgreementMargin,
    );
    if (validated === null) return false;
    validatedPanels.push(validated);
  }
  if (
    !isBoundedInteger(value.budgets.offeredCandidates, options.deferredCandidateBudget + 1) ||
    value.budgets.maximumCandidates !== options.deferredCandidateBudget ||
    !isBoundedInteger(value.budgets.narrowingRenders, options.deferredNarrowingRenderBudget + 1) ||
    value.budgets.maximumNarrowingRenders !== options.deferredNarrowingRenderBudget ||
    !isBoundedInteger(value.budgets.panelRenders, options.fartherPanelRenderBudget) ||
    value.budgets.maximumPanelRenders !== options.fartherPanelRenderBudget ||
    !isBoundedInteger(value.budgets.reachSteps, options.fartherPanelMaximumReachSteps) ||
    value.budgets.maximumReachSteps !== options.fartherPanelMaximumReachSteps ||
    typeof value.budgets.refusedReservation !== "boolean" ||
    typeof value.budgets.candidateRefusedReservation !== "boolean" ||
    !(
      value.budgets.failedNarrowingReservation === null ||
      isExactFailedBudgetReservation(
        value.budgets.failedNarrowingReservation,
        value.budgets.narrowingRenders,
        value.budgets.maximumNarrowingRenders,
      )
    ) ||
    !(
      value.budgets.failedCandidateReservation === null ||
      isExactFailedCandidateReservation(
        value.budgets.failedCandidateReservation,
        value.budgets.offeredCandidates,
        value.budgets.maximumCandidates,
      )
    )
  ) {
    return false;
  }
  const offeredCandidates = carries.reduce(
    (total, carry) => total + (carry.offeredCandidates as number),
    0,
  );
  const narrowingRenders = carries.reduce(
    (total, carry) => total + (carry.narrowingRenders as number),
    0,
  );
  const panelRenders = panels.reduce(
    (total, panel) => total + (panel.scores as readonly unknown[]).length,
    0,
  );
  const reachSteps = Math.max(
    0,
    ...carries.map((carry) => (carry.stepNumber as number) - reportStepNumber),
    ...panels.map((panel) => panel.reachSteps as number),
  );
  if (
    value.budgets.offeredCandidates !== offeredCandidates ||
    value.budgets.narrowingRenders !== narrowingRenders ||
    value.budgets.panelRenders !== panelRenders ||
    value.budgets.reachSteps !== reachSteps ||
    (value.refusal === null) === (value.decision === null) ||
    (value.refusal !== null &&
      !isRealBuildFartherRefusalCoherent({
        refusal: value.refusal,
        originStepNumber: reportStepNumber,
        carries,
        panels,
        panelStatuses: validatedPanels.map(({ status }) => status),
        budgets: value.budgets,
        maximumReachSteps: options.fartherPanelMaximumReachSteps,
        originCandidateCount: originCandidates.length,
        finalCandidateCount: finalLineages.length,
      })) ||
    (value.budgets.refusedReservation === true) !==
      (isRecord(value.refusal) &&
        value.refusal.code === "aggregate-narrowing-budget-exhausted" &&
        value.refusal.stage === "budget") ||
    (value.budgets.failedNarrowingReservation !== null) !==
      (isRecord(value.refusal) &&
        value.refusal.code === "aggregate-narrowing-budget-exhausted" &&
        value.refusal.stage === "budget") ||
    (value.budgets.candidateRefusedReservation === true) !==
      (isRecord(value.refusal) &&
        value.refusal.code === "aggregate-candidate-budget-exhausted" &&
        value.refusal.stage === "budget") ||
    (value.budgets.failedCandidateReservation !== null) !==
      (isRecord(value.refusal) &&
        value.refusal.code === "aggregate-candidate-budget-exhausted" &&
        value.refusal.stage === "budget")
  ) {
    return false;
  }

  const finalIds = finalLineages.map(({ candidateId }) => candidateId);
  if (value.decision !== null) {
    if (
      !isRecord(value.decision) ||
      !exactKeys(value.decision, [
        "originCandidateId",
        "revealingStepNumber",
        "survivingCandidateIds",
        "rejectedCandidateIds",
        "descendantSettled",
      ]) ||
      !originIds.has(String(value.decision.originCandidateId)) ||
      !Number.isSafeInteger(value.decision.revealingStepNumber) ||
      !isDenseBoundedArray(value.decision.survivingCandidateIds, finalIds.length) ||
      !isDenseBoundedArray(value.decision.rejectedCandidateIds, finalIds.length) ||
      !value.decision.survivingCandidateIds.every(isFartherId) ||
      !value.decision.rejectedCandidateIds.every(isFartherId) ||
      typeof value.decision.descendantSettled !== "boolean"
    ) {
      return false;
    }
    const surviving = value.decision.survivingCandidateIds as readonly string[];
    const rejected = value.decision.rejectedCandidateIds as readonly string[];
    const revealingStepNumber = value.decision.revealingStepNumber as number;
    const decisionPanel = validatedPanels.find(
      ({ stepNumber }) => stepNumber === revealingStepNumber,
    );
    const firstRevealingPanel = validatedPanels.find(({ status }) => status === "revealing");
    if (
      decisionPanel === undefined ||
      firstRevealingPanel !== decisionPanel ||
      validatedPanels.at(-1) !== decisionPanel ||
      decisionPanel.status !== "revealing" ||
      value.decision.originCandidateId !== decisionPanel.winningOriginCandidateId ||
      !sameJson(surviving, decisionPanel.survivingCandidateIds) ||
      !sameJson(rejected, decisionPanel.rejectedCandidateIds) ||
      value.decision.descendantSettled !== (decisionPanel.survivingCandidateIds.length === 1)
    ) {
      return false;
    }
  }
  return true;
}
