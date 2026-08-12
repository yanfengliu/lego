import {
  exactKeys,
  isDenseBoundedArray,
  isFartherId,
  isFiniteNumber,
  isNullableFiniteNumber,
  isRecord,
  isUnitInterval,
  sameIds,
} from "./real-build-farther-report-validation";

export interface FartherPanelCandidate {
  readonly candidateId: string;
  readonly originCandidateId: string;
}

export interface FartherValidatedPanel {
  readonly stepNumber: number;
  readonly status: "not-observable" | "unrevealing" | "revealing";
  readonly winningOriginCandidateId: string | null;
  readonly survivingCandidateIds: readonly string[];
  readonly rejectedCandidateIds: readonly string[];
}

export interface RealBuildFartherDeferralSummary {
  readonly trigger: unknown;
  readonly ownPanelMargin: unknown;
  readonly ownPanelMinimumMargin: unknown;
  readonly lookaheadStepNumber: unknown;
  readonly reachSteps: unknown;
  readonly lookaheadUpSign: unknown;
  readonly lookaheadMeasure: unknown;
  readonly lookaheadTurnDegrees: unknown;
  readonly wholeStepCandidates: unknown;
  readonly rendered: unknown;
  readonly bestAgreement: unknown;
  readonly runnerUpAgreement: unknown;
  readonly margin: unknown;
  readonly settled: unknown;
}

export function isCoherentUnresolvedDeferralScoreCard(
  deferral: RealBuildFartherDeferralSummary,
): boolean {
  if (
    deferral.settled !== false ||
    !Number.isSafeInteger(deferral.wholeStepCandidates) ||
    !Number.isSafeInteger(deferral.rendered) ||
    (deferral.wholeStepCandidates as number) < 0 ||
    deferral.wholeStepCandidates !== deferral.rendered
  ) {
    return deferral.settled !== false;
  }
  const rendered = deferral.rendered as number;
  if (rendered === 0) {
    return (
      deferral.bestAgreement === null &&
      deferral.runnerUpAgreement === null &&
      deferral.margin === null
    );
  }
  if (!isFiniteNumber(deferral.bestAgreement)) return false;
  if (rendered === 1) {
    return deferral.runnerUpAgreement === null && deferral.margin === null;
  }
  return (
    isFiniteNumber(deferral.runnerUpAgreement) &&
    isFiniteNumber(deferral.margin) &&
    deferral.bestAgreement >= deferral.runnerUpAgreement &&
    deferral.margin === deferral.bestAgreement - deferral.runnerUpAgreement
  );
}

export function validateFartherPanelEvidence(
  value: unknown,
  panelIndex: number,
  originStepNumber: number,
  candidateMaximum: number,
  originCandidates: readonly Record<string, unknown>[],
  finalCandidates: readonly FartherPanelCandidate[],
  minimumAgreement: number,
  minimumMargin: number,
): FartherValidatedPanel | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "stepNumber",
      "reachSteps",
      "status",
      "reason",
      "scores",
      "bestAgreement",
      "familyMargin",
      "descendantMargin",
    ]) ||
    value.stepNumber !== originStepNumber + panelIndex + 1 ||
    value.reachSteps !== panelIndex + 1 ||
    !isDenseBoundedArray(value.scores, candidateMaximum) ||
    !isNullableFiniteNumber(value.bestAgreement) ||
    !isNullableFiniteNumber(value.familyMargin) ||
    !isNullableFiniteNumber(value.descendantMargin)
  ) {
    return null;
  }
  const scoresExpectedFromOrigin = panelIndex === 0;
  const scoredCandidates: readonly FartherPanelCandidate[] = scoresExpectedFromOrigin
    ? originCandidates.map((candidate) => ({
        candidateId: candidate.candidateId as string,
        originCandidateId: candidate.candidateId as string,
      }))
    : finalCandidates;
  const expectedScoreIds = new Set(scoredCandidates.map(({ candidateId }) => candidateId));
  const scoreIds = new Set<string>();
  const scoreById = new Map<string, number>();
  for (const score of value.scores) {
    if (
      !isRecord(score) ||
      !exactKeys(score, ["candidateId", "agreement"]) ||
      !isFartherId(score.candidateId) ||
      scoreIds.has(score.candidateId) ||
      !isUnitInterval(score.agreement)
    ) {
      return null;
    }
    scoreIds.add(score.candidateId);
    scoreById.set(score.candidateId, score.agreement as number);
  }
  if (value.status === "not-observable") {
    return ["occluded", "no-built-art", "camera-unresolved"].includes(String(value.reason)) &&
      value.scores.length === 0 &&
      value.bestAgreement === null &&
      value.familyMargin === null &&
      value.descendantMargin === null
      ? {
          stepNumber: value.stepNumber as number,
          status: "not-observable",
          winningOriginCandidateId: null,
          survivingCandidateIds: [],
          rejectedCandidateIds: [],
        }
      : null;
  }
  if (
    (value.status !== "unrevealing" && value.status !== "revealing") ||
    !sameIds(scoreIds, expectedScoreIds) ||
    (scoresExpectedFromOrigin &&
      originCandidates.some(
        (candidate) =>
          scoreById.get(candidate.candidateId as string) !== candidate.lookaheadAgreement,
      ))
  ) {
    return null;
  }
  const familyScores = originCandidates
    .map((origin) => {
      const agreements = scoredCandidates
        .filter(({ originCandidateId }) => originCandidateId === origin.candidateId)
        .map(({ candidateId }) => scoreById.get(candidateId)!);
      return agreements.length === 0
        ? null
        : {
            originCandidateId: origin.candidateId as string,
            agreement: Math.max(...agreements),
          };
    })
    .filter(
      (family): family is { readonly originCandidateId: string; readonly agreement: number } =>
        family !== null,
    )
    .sort((left, right) => right.agreement - left.agreement);
  if (familyScores.length !== originCandidates.length || familyScores.length < 2) return null;
  const winner = familyScores[0]!;
  const bestAgreement = winner.agreement;
  const familyMargin = bestAgreement - familyScores[1]!.agreement;
  const winnerLeaves = finalCandidates.filter(
    ({ originCandidateId }) => originCandidateId === winner.originCandidateId,
  );
  const orderedWinnerLeaves = scoresExpectedFromOrigin
    ? winnerLeaves
    : [...winnerLeaves].sort(
        (left, right) => scoreById.get(right.candidateId)! - scoreById.get(left.candidateId)!,
      );
  const descendantMargin =
    scoresExpectedFromOrigin || orderedWinnerLeaves.length < 2
      ? null
      : scoreById.get(orderedWinnerLeaves[0]!.candidateId)! -
        scoreById.get(orderedWinnerLeaves[1]!.candidateId)!;
  const revealing = bestAgreement >= minimumAgreement && familyMargin > minimumMargin;
  const status = revealing ? "revealing" : "unrevealing";
  const reason = revealing
    ? null
    : bestAgreement < minimumAgreement
      ? "weak-agreement"
      : "ambiguous-family";
  if (
    value.status !== status ||
    value.reason !== reason ||
    value.bestAgreement !== bestAgreement ||
    value.familyMargin !== familyMargin ||
    value.descendantMargin !== descendantMargin
  ) {
    return null;
  }
  const survivingCandidateIds = revealing
    ? scoresExpectedFromOrigin
      ? winnerLeaves.map(({ candidateId }) => candidateId)
      : orderedWinnerLeaves
          .filter(({ candidateId }) => bestAgreement - scoreById.get(candidateId)! <= minimumMargin)
          .map(({ candidateId }) => candidateId)
    : [];
  const surviving = new Set(survivingCandidateIds);
  return {
    stepNumber: value.stepNumber as number,
    status,
    winningOriginCandidateId: winner.originCandidateId,
    survivingCandidateIds,
    rejectedCandidateIds: revealing
      ? finalCandidates
          .filter(({ candidateId }) => !surviving.has(candidateId))
          .map(({ candidateId }) => candidateId)
      : [],
  };
}

export function isRealBuildFartherDeferralCoherent(
  value: unknown,
  deferral: RealBuildFartherDeferralSummary | null,
): boolean {
  if (value === null) return true;
  if (
    deferral === null ||
    !isRecord(value) ||
    !isRecord(value.origin) ||
    !isRecord(value.origin.evidence) ||
    !Array.isArray(value.origin.candidates) ||
    !Array.isArray(value.carries) ||
    !Array.isArray(value.panels)
  ) {
    return false;
  }
  const expectedOriginStatus =
    deferral.trigger === "no-local-signal"
      ? "no-local-signal"
      : deferral.trigger === "unseparated-by-own-panel"
        ? "unseparated"
        : null;
  if (
    expectedOriginStatus === null ||
    value.origin.evidence.status !== expectedOriginStatus ||
    value.origin.evidence.margin !== deferral.ownPanelMargin ||
    value.origin.evidence.minimumMargin !== deferral.ownPanelMinimumMargin ||
    value.origin.candidates.length !== deferral.wholeStepCandidates ||
    deferral.settled !== false
  ) {
    return false;
  }
  const agreementByOrigin = new Map<string, number>();
  for (const candidate of value.origin.candidates) {
    if (
      !isRecord(candidate) ||
      !isFartherId(candidate.candidateId) ||
      !isUnitInterval(candidate.lookaheadAgreement) ||
      agreementByOrigin.has(candidate.candidateId)
    ) {
      return false;
    }
    agreementByOrigin.set(candidate.candidateId, candidate.lookaheadAgreement);
  }
  const orderedAgreements = [...agreementByOrigin.values()].sort((left, right) => right - left);
  const bestAgreement = orderedAgreements[0] ?? null;
  const runnerUpAgreement = orderedAgreements[1] ?? null;
  const margin =
    bestAgreement === null || runnerUpAgreement === null ? null : bestAgreement - runnerUpAgreement;
  if (
    deferral.bestAgreement !== bestAgreement ||
    deferral.runnerUpAgreement !== runnerUpAgreement ||
    deferral.margin !== margin
  ) {
    return false;
  }
  if (value.panels.length === 0) {
    return (
      value.origin.candidates.length === deferral.rendered &&
      value.carries.length === 0 &&
      isRecord(value.refusal) &&
      value.refusal.code === "panel-render-budget-exhausted" &&
      value.refusal.stage === "budget" &&
      value.refusal.stepNumber === deferral.lookaheadStepNumber &&
      value.decision === null &&
      isRecord(value.budgets) &&
      value.budgets.offeredCandidates === 0 &&
      value.budgets.narrowingRenders === 0 &&
      value.budgets.panelRenders === 0 &&
      value.budgets.reachSteps === 0 &&
      value.budgets.refusedReservation === false &&
      value.budgets.failedNarrowingReservation === null &&
      value.budgets.candidateRefusedReservation === false &&
      value.budgets.failedCandidateReservation === null
    );
  }
  const firstPanel = value.panels[0];
  if (
    !isRecord(firstPanel) ||
    !Array.isArray(firstPanel.scores) ||
    firstPanel.stepNumber !== deferral.lookaheadStepNumber ||
    firstPanel.scores.length !== deferral.rendered
  ) {
    return false;
  }
  const seenScores = new Set<string>();
  for (const score of firstPanel.scores) {
    if (
      !isRecord(score) ||
      !isFartherId(score.candidateId) ||
      seenScores.has(score.candidateId) ||
      score.agreement !== agreementByOrigin.get(score.candidateId)
    ) {
      return false;
    }
    seenScores.add(score.candidateId);
  }
  return (
    sameIds(seenScores, new Set(agreementByOrigin.keys())) &&
    firstPanel.bestAgreement === bestAgreement
  );
}
