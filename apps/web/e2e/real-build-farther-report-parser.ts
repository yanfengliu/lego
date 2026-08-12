import type { RealBuildOptions } from "./real-build-safety";
import {
  measuredFartherOriginProbeIneligibility,
  measuredFartherOriginKReportIneligibility,
} from "./real-build-farther-origin-policy";
import {
  MAXIMUM_REAL_BUILD_FARTHER_CAPTURES,
  type RealBuildFartherCapture,
  type RealBuildFartherEvidence,
} from "./real-build-farther-report-types";
import { isNullableRealBuildPngCapture } from "./real-build-png-capture";
import {
  isExactFailedBudgetReservation,
  isExactFailedCandidateReservation,
  isRealBuildFartherRefusalCoherent,
} from "./real-build-farther-refusal-parser";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  JSON.stringify(Object.keys(value).sort((left, right) => left.localeCompare(right))) ===
  JSON.stringify([...keys].sort((left, right) => left.localeCompare(right)));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isNullableFiniteNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);
const isBoundedInteger = (value: unknown, maximum: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
const isTuple = (value: unknown, length: number): value is readonly number[] =>
  Array.isArray(value) && value.length === length && value.every(isFiniteNumber);

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const sameIds = (actual: ReadonlySet<string>, expected: ReadonlySet<string>): boolean =>
  actual.size === expected.size && [...actual].every((id) => expected.has(id));

const FARTHER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/u;
function isDenseBoundedArray(value: unknown, maximum: number): value is readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function isFartherId(value: unknown): value is string {
  return typeof value === "string" && FARTHER_ID_PATTERN.test(value);
}

function isUnitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isFartherWitness(value: unknown): boolean {
  if (!isRecord(value) || !exactKeys(value, ["catalogPartId", "colorId", "transform"])) {
    return false;
  }
  if (
    !isFartherId(value.catalogPartId) ||
    !isFartherId(value.colorId) ||
    !isRecord(value.transform) ||
    !exactKeys(value.transform, ["positionLdu", "orientationId"]) ||
    !isTuple(value.transform.positionLdu, 3) ||
    !isFartherId(value.transform.orientationId)
  ) {
    return false;
  }
  return (value.transform.positionLdu as readonly number[]).every(
    (coordinate) => Math.abs(coordinate) <= 1_000_000_000,
  );
}

function isFartherWitnesses(value: unknown, maximum: number): boolean {
  return isDenseBoundedArray(value, maximum) && value.every(isFartherWitness);
}

function isFartherLineageStep(
  value: unknown,
  expectedStepNumber: number,
  maximumPieces: number,
): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, ["stepNumber", "documentHash", "pieces"]) &&
    value.stepNumber === expectedStepNumber &&
    typeof value.documentHash === "string" &&
    DIGEST_PATTERN.test(value.documentHash) &&
    isFartherWitnesses(value.pieces, maximumPieces)
  );
}

interface FartherRetainedParent {
  readonly candidateId: string;
  readonly originCandidateId: string;
  readonly lineage: readonly Record<string, unknown>[];
}

const atomicPieceKey = (piece: Record<string, unknown>): string =>
  `${String(piece.catalogPartId)}\u0000${String(piece.colorId)}`;

function hasExactAtomicPieces(
  witnesses: readonly unknown[],
  expectedAtomicPieces: readonly unknown[],
): boolean {
  if (witnesses.length !== expectedAtomicPieces.length) return false;
  const actual = witnesses
    .map((piece) => atomicPieceKey(piece as Record<string, unknown>))
    .sort((left, right) => left.localeCompare(right));
  const expected = expectedAtomicPieces
    .map((piece) => atomicPieceKey(piece as Record<string, unknown>))
    .sort((left, right) => left.localeCompare(right));
  return sameJson(actual, expected);
}

function isFartherCarryEvidence(
  value: unknown,
  carryIndex: number,
  originStepNumber: number,
  options: Pick<
    RealBuildOptions,
    | "maxParts"
    | "deferredCandidateBudget"
    | "deferredNarrowingRenderBudget"
    | "fartherPanelMaximumReachSteps"
  >,
  expectedParents: ReadonlyMap<string, FartherRetainedParent>,
  allowParentPrefix: boolean,
): boolean {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "stepNumber",
      "parentCandidates",
      "parentsExpanded",
      "offeredCandidates",
      "narrowingRenders",
      "maximumCandidates",
      "maximumNarrowingRenders",
      "expectedAtomicPieces",
      "perParent",
      "measuredLineages",
    ]) ||
    value.stepNumber !== originStepNumber + carryIndex + 1 ||
    (value.stepNumber as number) - originStepNumber > options.fartherPanelMaximumReachSteps ||
    value.parentCandidates !== expectedParents.size ||
    !isBoundedInteger(value.parentsExpanded, value.parentCandidates as number) ||
    !isBoundedInteger(value.offeredCandidates, options.deferredCandidateBudget + 1) ||
    !isBoundedInteger(value.narrowingRenders, options.deferredNarrowingRenderBudget + 1) ||
    !isBoundedInteger(value.maximumCandidates, options.deferredCandidateBudget) ||
    !isBoundedInteger(value.maximumNarrowingRenders, options.deferredNarrowingRenderBudget) ||
    !isDenseBoundedArray(value.expectedAtomicPieces, options.maxParts) ||
    !value.expectedAtomicPieces.every(
      (piece) =>
        isRecord(piece) &&
        exactKeys(piece, ["catalogPartId", "colorId"]) &&
        isFartherId(piece.catalogPartId) &&
        isFartherId(piece.colorId),
    ) ||
    !isDenseBoundedArray(value.perParent, options.deferredCandidateBudget) ||
    !isDenseBoundedArray(value.measuredLineages, options.deferredCandidateBudget + 1)
  ) {
    return false;
  }

  const expectedParentIds = [...expectedParents.keys()];
  const expectedAtomicPieces = value.expectedAtomicPieces as readonly unknown[];
  const parentIds = new Set<string>();
  for (const parent of value.perParent) {
    if (
      !isRecord(parent) ||
      !exactKeys(parent, [
        "parentCandidateId",
        "offeredCandidates",
        "narrowingRenders",
        "offeredPerPiece",
        "carriedPerPiece",
      ]) ||
      !isFartherId(parent.parentCandidateId) ||
      parentIds.has(parent.parentCandidateId) ||
      !isBoundedInteger(parent.offeredCandidates, options.deferredCandidateBudget + 1) ||
      !isBoundedInteger(parent.narrowingRenders, options.deferredNarrowingRenderBudget + 1) ||
      !isDenseBoundedArray(parent.offeredPerPiece, options.maxParts) ||
      !isDenseBoundedArray(parent.carriedPerPiece, options.maxParts) ||
      parent.offeredPerPiece.length !== expectedAtomicPieces.length ||
      parent.carriedPerPiece.length !== expectedAtomicPieces.length ||
      !parent.offeredPerPiece.every((count) => isBoundedInteger(count, Number.MAX_SAFE_INTEGER)) ||
      !parent.carriedPerPiece.every((count, index) =>
        isBoundedInteger(count, (parent.offeredPerPiece as readonly number[])[index] as number),
      )
    ) {
      return false;
    }
    parentIds.add(parent.parentCandidateId);
  }
  if (
    (allowParentPrefix
      ? !sameJson([...parentIds], expectedParentIds.slice(0, parentIds.size))
      : !sameIds(parentIds, new Set(expectedParentIds))) ||
    value.parentsExpanded !== parentIds.size ||
    (!allowParentPrefix && value.parentsExpanded !== expectedParents.size) ||
    (value.perParent as readonly Record<string, unknown>[]).reduce<number>(
      (total, parent) => total + ((parent as Record<string, unknown>).offeredCandidates as number),
      0,
    ) !== value.offeredCandidates ||
    (value.perParent as readonly Record<string, unknown>[]).reduce<number>(
      (total, parent) => total + ((parent as Record<string, unknown>).narrowingRenders as number),
      0,
    ) !== value.narrowingRenders
  ) {
    return false;
  }

  const lineageCandidateIds = new Set<string>();
  for (const measured of value.measuredLineages) {
    const retainedParent = isRecord(measured)
      ? expectedParents.get(String(measured.parentCandidateId))
      : undefined;
    if (
      !isRecord(measured) ||
      !exactKeys(measured, ["candidateId", "parentCandidateId", "originCandidateId", "lineage"]) ||
      !isFartherId(measured.candidateId) ||
      !isFartherId(measured.parentCandidateId) ||
      !isFartherId(measured.originCandidateId) ||
      retainedParent === undefined ||
      measured.originCandidateId !== retainedParent.originCandidateId ||
      lineageCandidateIds.has(measured.candidateId) ||
      !isDenseBoundedArray(measured.lineage, options.fartherPanelMaximumReachSteps + 1) ||
      measured.lineage.length !== carryIndex + 2 ||
      !measured.lineage.every((step, lineageIndex) =>
        isFartherLineageStep(step, originStepNumber + lineageIndex, options.maxParts),
      ) ||
      !retainedParent.lineage.every((step, index) =>
        sameJson(step, (measured.lineage as readonly unknown[])[index]),
      ) ||
      !hasExactAtomicPieces(
        (measured.lineage as readonly Record<string, unknown>[]).at(-1)!
          .pieces as readonly unknown[],
        expectedAtomicPieces,
      )
    ) {
      return false;
    }
    lineageCandidateIds.add(measured.candidateId);
  }
  return lineageCandidateIds.size === (value.offeredCandidates as number);
}

interface FartherPanelCandidate {
  readonly candidateId: string;
  readonly originCandidateId: string;
}

interface FartherValidatedPanel {
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

function isCoherentUnresolvedDeferralScoreCard(deferral: RealBuildFartherDeferralSummary): boolean {
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

function validateFartherPanelEvidence(
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
  // A zero-panel budget refusal and an N+1-only origin observation are generic
  // driver states. Only a carry-free report that claims to have reached K is
  // the measured direct-origin shortcut and inherits its exact calibration.
  const claimsDirectOriginK =
    carries.length === 0 &&
    ((value.panels as readonly Record<string, unknown>[]).some(
      ({ stepNumber }) => stepNumber === reportStepNumber + 2,
    ) ||
      (isRecord(value.refusal) && value.refusal.stepNumber === reportStepNumber + 2));
  if (claimsDirectOriginK) {
    const interveningSpec = options.panels.find(
      ({ stepNumber }) => stepNumber === reportStepNumber + 1,
    );
    const fartherSpec = options.panels.find(
      ({ stepNumber }) => stepNumber === reportStepNumber + 2,
    );
    if (
      interveningSpec === undefined ||
      measuredFartherOriginProbeIneligibility({
        originSpec: preparedOriginPanel,
        interveningSpec,
        fartherSpec: fartherSpec ?? null,
        origins: originCandidates as unknown as Parameters<
          typeof measuredFartherOriginProbeIneligibility
        >[0]["origins"],
        options,
      }) !== null
    ) {
      return false;
    }
    const kPanel = (value.panels as readonly Record<string, unknown>[]).find(
      ({ stepNumber }) => stepNumber === reportStepNumber + 2,
    );
    if (measuredFartherOriginKReportIneligibility({ kPanel, decision: value.decision }) !== null) {
      return false;
    }
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

export function isRealBuildFartherCaptures(
  value: unknown,
  evidence: RealBuildFartherEvidence | null,
): value is readonly RealBuildFartherCapture[] {
  if (!isDenseBoundedArray(value, MAXIMUM_REAL_BUILD_FARTHER_CAPTURES)) return false;
  if (evidence === null) return value.length === 0;
  const expected = evidence.panels.flatMap((panel) => [
    { role: "source-panel" as const, panelStepNumber: panel.stepNumber, candidateId: null },
    ...panel.scores.map(({ candidateId }) => ({
      role: "candidate-render" as const,
      panelStepNumber: panel.stepNumber,
      candidateId,
    })),
  ]);
  if (value.length !== expected.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    const capture = value[index];
    const descriptor = expected[index]!;
    if (
      !isRecord(capture) ||
      !exactKeys(capture, ["captureId", "role", "panelStepNumber", "candidateId", "png"]) ||
      capture.captureId !== index ||
      capture.role !== descriptor.role ||
      capture.panelStepNumber !== descriptor.panelStepNumber ||
      capture.candidateId !== descriptor.candidateId ||
      typeof capture.png !== "string" ||
      !isNullableRealBuildPngCapture(capture.png)
    ) {
      return false;
    }
  }
  return true;
}
