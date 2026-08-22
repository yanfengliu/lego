import { createEmptyBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";
import { inspectFrozenLegacyBrowserOutputV2 } from "./real-build-artifact-legacy-browser-v2";

import {
  isRealBuildFartherCaptures,
  isRealBuildFartherDeferralCoherent,
  isRealBuildFartherEvidence,
} from "./real-build-farther-report-parser";
import { isRealBuildFartherDecisionPieceCoherent } from "./real-build-farther-decision-piece-coherence";
import type { RealBuildFartherEvidence } from "./real-build-farther-report-types";
import {
  createPanelCameraLineageContinuityState,
  panelCameraEvidenceDefect,
  type PanelCameraLineageContinuityState,
} from "./real-build-browser-output-panel-camera";
import { MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION } from "./real-build-farther-origin-source-manifest";
import { LEGACY_MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION_V2 } from "./real-build-farther-origin-source-attestation-legacy-v2";
import { isNullableRealBuildPngCapture } from "./real-build-png-capture";
import {
  isRealBuildSuccessfulStepMechanism,
  type RealBuildOptions,
  type RealBuildStepReport,
} from "./real-build-safety";
import { isRealBuildBrowserStepFailure } from "./real-build-browser-step-failure";
import type {
  LegacyRealBuildBrowserOutputBoundary,
  LegacyRealBuildBrowserOutputV2,
  RealBuildBrowserOutputBoundary,
  RealBuildBrowserOutput,
} from "./real-build-browser-output-types";
import { inspectBrowserOutputCanonicalTransitions } from "./real-build-browser-output-transition-continuity";
import { terminalCanonicalDocumentDefect } from "./real-build-browser-output-transition-continuity";
import { failedBrowserOutputEnvelopeDefect } from "./real-build-browser-output-failed-policy";
import {
  boundBrowserOutputReading,
  boundedBrowserActionMatches,
  describeDetachedBrowserValue,
  snapshotCurrentRealBuildBrowserOutput,
} from "./real-build-browser-output-snapshot";

export type {
  LegacyRealBuildBrowserOutputV2,
  RealBuildBrowserOutput,
  RealBuildIdentityBinding,
} from "./real-build-browser-output-types";

export { decodeRealBuildPngCapture } from "./real-build-png-capture";
export { MAXIMUM_REAL_BUILD_FARTHER_CAPTURES } from "./real-build-farther-report-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    JSON.stringify(Object.keys(value).sort((left, right) => left.localeCompare(right))) ===
    JSON.stringify([...keys].sort((left, right) => left.localeCompare(right)))
  );
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const REPORT_KEYS = [
  "stepNumber",
  "pageNumber",
  "panelFace",
  "calloutPieces",
  "expectedAssembledPieces",
  "attemptedPieces",
  "placedPieces",
  "action",
  "actionEvidenceDigest",
  "canonicalStepId",
  "prerequisites",
  "outcome",
  "validation",
  "fit",
  "camera",
  "panelCamera",
  "highlight",
  "arrows",
  "pieces",
  "jointVisual",
  "deferral",
  "farther",
  "fartherCaptures",
  "explodedGhost",
  "documentParts",
  "elapsedMs",
  "panelPng",
  "buildPng",
] as const;
const LEGACY_REPORT_KEYS_V2 = REPORT_KEYS.filter((key) => key !== "panelCamera");

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isNullableFiniteNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);
const isNullableDigest = (value: unknown): value is string | null =>
  value === null || (typeof value === "string" && DIGEST_PATTERN.test(value));
const isBoundedInteger = (value: unknown, maximum: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.length > 0);
const isTuple = (value: unknown, length: number): value is readonly number[] =>
  Array.isArray(value) && value.length === length && value.every(isFiniteNumber);
const isDenseBoundedArray = (value: unknown, maximum: number): value is readonly unknown[] => {
  if (!Array.isArray(value) || value.length > maximum) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
};

function isStepOutcome(value: unknown, generation: 2 | 3 | 4): boolean {
  if (!isRecord(value)) return false;
  if (value.status === "complete") {
    return (
      exactKeys(value, ["status", "mechanism", "failure"]) &&
      isRealBuildSuccessfulStepMechanism(value.mechanism) &&
      (generation === 4 || value.mechanism !== "compiled-observation") &&
      value.failure === null
    );
  }
  return (
    value.status === "failed" &&
    exactKeys(value, ["status", "mechanism", "attemptedMechanism", "failure"]) &&
    ["deferred", "blocked"].includes(value.mechanism as string) &&
    (value.attemptedMechanism === null ||
      (isRealBuildSuccessfulStepMechanism(value.attemptedMechanism) &&
        (generation === 4 || value.attemptedMechanism !== "compiled-observation"))) &&
    isRealBuildBrowserStepFailure(value.failure)
  );
}

function isStepPrerequisites(value: unknown, maximum: number): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, [
      "blockingStep",
      "coverageFailures",
      "unresolvedCallouts",
      "missingDesigns",
      "calloutPieces",
      "expectedAssembledPieces",
      "resolvedPieces",
      "localFailure",
    ]) &&
    (value.blockingStep === null || Number.isSafeInteger(value.blockingStep)) &&
    Array.isArray(value.coverageFailures) &&
    value.coverageFailures.every(isRealBuildBrowserStepFailure) &&
    isStringArray(value.unresolvedCallouts) &&
    isStringArray(value.missingDesigns) &&
    isBoundedInteger(value.calloutPieces, maximum) &&
    isBoundedInteger(value.expectedAssembledPieces, maximum) &&
    isBoundedInteger(value.resolvedPieces, maximum) &&
    (value.localFailure === null || isRealBuildBrowserStepFailure(value.localFailure))
  );
}

function isStepValidation(value: unknown): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, [
      "attempted",
      "targetDocumentHash",
      "truthSnapshotHash",
      "validatorSetHash",
      "documentGloballyValid",
      "blockingIssues",
      "failure",
    ]) &&
    typeof value.attempted === "boolean" &&
    isNullableDigest(value.targetDocumentHash) &&
    isNullableDigest(value.truthSnapshotHash) &&
    isNullableDigest(value.validatorSetHash) &&
    (value.documentGloballyValid === null || typeof value.documentGloballyValid === "boolean") &&
    Array.isArray(value.blockingIssues) &&
    value.blockingIssues.every(
      (issue) =>
        isRecord(issue) &&
        exactKeys(issue, ["code", "message", "path", "partIds"]) &&
        typeof issue.code === "string" &&
        typeof issue.message === "string" &&
        typeof issue.path === "string" &&
        isStringArray(issue.partIds),
    ) &&
    (value.failure === null || typeof value.failure === "string")
  );
}

function isBlindSearch(value: unknown, maximum: number, renderBound: number): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, [
      "comparisonPrefixHash",
      "distinctCandidates",
      "feasible",
      "rendered",
      "bestScore",
      "runnerUpScore",
      "agreesWithHighlight",
      "refusal",
      "elapsedMs",
    ]) &&
    typeof value.comparisonPrefixHash === "string" &&
    DIGEST_PATTERN.test(value.comparisonPrefixHash) &&
    isBoundedInteger(value.distinctCandidates, maximum) &&
    typeof value.feasible === "boolean" &&
    isBoundedInteger(value.rendered, renderBound) &&
    isNullableFiniteNumber(value.bestScore) &&
    isNullableFiniteNumber(value.runnerUpScore) &&
    (value.agreesWithHighlight === null || typeof value.agreesWithHighlight === "boolean") &&
    (value.refusal === null || typeof value.refusal === "string") &&
    isFiniteNumber(value.elapsedMs) &&
    value.elapsedMs >= 0
  );
}

function isPieceReport(value: unknown, maximum: number, renderBound: number): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, [
      "catalogPartId",
      "blind",
      "enumerated",
      "afterProximity",
      "rendered",
      "bestScore",
      "runnerUpScore",
      "placed",
      "positionLdu",
      "orientationId",
      "failure",
    ]) &&
    typeof value.catalogPartId === "string" &&
    value.catalogPartId.length > 0 &&
    isBlindSearch(value.blind, maximum, renderBound) &&
    isBoundedInteger(value.enumerated, maximum) &&
    isBoundedInteger(value.afterProximity, maximum) &&
    isBoundedInteger(value.rendered, renderBound) &&
    isNullableFiniteNumber(value.bestScore) &&
    isNullableFiniteNumber(value.runnerUpScore) &&
    typeof value.placed === "boolean" &&
    (value.positionLdu === null || isTuple(value.positionLdu, 3)) &&
    (value.orientationId === null || typeof value.orientationId === "string") &&
    (value.failure === null || isRealBuildBrowserStepFailure(value.failure))
  );
}

function isWholeStepVisual(value: unknown, maximum: number): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      exactKeys(value, [
        "score",
        "minimumScore",
        "minimumExclusiveHighlightPixelsPerPiece",
        "calibrationDigest",
        "evidenceKind",
        "printedEvidencePixels",
        "unionHighlightPixels",
        "summedPieceHighlightPixels",
        "exclusiveHighlightPixelsByPiece",
        "unexplainedBoundsPx",
        "failure",
      ]) &&
      (value.unexplainedBoundsPx === null || isTuple(value.unexplainedBoundsPx, 4)) &&
      isNullableFiniteNumber(value.score) &&
      isFiniteNumber(value.minimumScore) &&
      isFiniteNumber(value.minimumExclusiveHighlightPixelsPerPiece) &&
      isNullableDigest(value.calibrationDigest) &&
      (value.evidenceKind === "region" || value.evidenceKind === "stroke") &&
      isBoundedInteger(value.printedEvidencePixels, Number.MAX_SAFE_INTEGER) &&
      isBoundedInteger(value.unionHighlightPixels, Number.MAX_SAFE_INTEGER) &&
      isBoundedInteger(value.summedPieceHighlightPixels, Number.MAX_SAFE_INTEGER) &&
      Array.isArray(value.exclusiveHighlightPixelsByPiece) &&
      value.exclusiveHighlightPixelsByPiece.length <= maximum &&
      value.exclusiveHighlightPixelsByPiece.every((entry) => isFiniteNumber(entry) && entry >= 0) &&
      (value.failure === null || isRealBuildBrowserStepFailure(value.failure)))
  );
}

function isFitEvidence(value: unknown): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, [
      "azimuthDegrees",
      "elevationDegrees",
      "pixelsPerUnit",
      "residualPx",
      "coherence",
      "failure",
    ]) &&
    ["azimuthDegrees", "elevationDegrees", "pixelsPerUnit", "residualPx"].every((key) =>
      isNullableFiniteNumber(value[key]),
    ) &&
    isFiniteNumber(value.coherence) &&
    (value.failure === null || typeof value.failure === "string")
  );
}

function isCameraEvidence(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      exactKeys(value, [
        "azimuthDegrees",
        "elevationDegrees",
        "pixelsPerUnit",
        "residualPx",
        "coherence",
        "centerXPx",
        "centerYPx",
        "anchorIou",
        "anchorShiftPx",
        "anchorTurnDegrees",
      ]) &&
      [
        "azimuthDegrees",
        "elevationDegrees",
        "pixelsPerUnit",
        "residualPx",
        "coherence",
        "centerXPx",
        "centerYPx",
      ].every((key) => isFiniteNumber(value[key])) &&
      isNullableFiniteNumber(value.anchorIou) &&
      isNullableFiniteNumber(value.anchorTurnDegrees) &&
      (value.anchorShiftPx === null || isTuple(value.anchorShiftPx, 2)))
  );
}

function isHighlightEvidence(value: unknown, maximum: number): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, ["regions", "closedContourRate", "strokePx", "boundsPx"]) &&
    isBoundedInteger(value.regions, maximum) &&
    isFiniteNumber(value.closedContourRate) &&
    isFiniteNumber(value.strokePx) &&
    (value.boundsPx === null || isTuple(value.boundsPx, 4))
  );
}

function isExplodedGhostEvidence(value: unknown): boolean {
  if (value === null) return true;
  return (
    isRecord(value) &&
    exactKeys(value, [
      "displacements",
      "wholeStepCandidates",
      "rendered",
      "printedRegionPx",
      "ghostSilhouettePx",
      "containmentCeiling",
      "bestRegionIou",
      "runnerUpRegionIou",
      "bestOutsideRegionPx",
      "containedCandidates",
      "settled",
    ]) &&
    isBoundedInteger(value.displacements, Number.MAX_SAFE_INTEGER) &&
    isBoundedInteger(value.wholeStepCandidates, Number.MAX_SAFE_INTEGER) &&
    isBoundedInteger(value.rendered, Number.MAX_SAFE_INTEGER) &&
    isBoundedInteger(value.printedRegionPx, Number.MAX_SAFE_INTEGER) &&
    isBoundedInteger(value.ghostSilhouettePx, Number.MAX_SAFE_INTEGER) &&
    isFiniteNumber(value.containmentCeiling) &&
    isNullableFiniteNumber(value.bestRegionIou) &&
    isNullableFiniteNumber(value.runnerUpRegionIou) &&
    (value.bestOutsideRegionPx === null ||
      isBoundedInteger(value.bestOutsideRegionPx, Number.MAX_SAFE_INTEGER)) &&
    isBoundedInteger(value.containedCandidates, Number.MAX_SAFE_INTEGER) &&
    typeof value.settled === "boolean" &&
    // A settled exploded step must have redrawn something along an arrow and
    // found exactly one ghost the printed contour contains. Without this a run
    // could report `settled: true` having rendered nothing, which is the claim
    // this field exists to make checkable.
    (!value.settled ||
      (value.containedCandidates === 1 &&
        (value.displacements as number) > 0 &&
        (value.rendered as number) > 0 &&
        isFiniteNumber(value.bestRegionIou)))
  );
}

function isDeferralEvidence(
  value: unknown,
  maximumPieces: number,
  expectedPieces: number,
  narrowingRenderBound: number,
): boolean {
  if (value === null) return true;
  return (
    isRecord(value) &&
    exactKeys(value, [
      "trigger",
      "ownPanelMargin",
      "ownPanelMinimumMargin",
      "lookaheadStepNumber",
      "reachSteps",
      "lookaheadUpSign",
      "lookaheadMeasure",
      "lookaheadTurnDegrees",
      "lookaheadTurnAnchorIou",
      "lookaheadTurnMargin",
      "narrowingRenders",
      "offeredPerPiece",
      "carriedPerPiece",
      "wholeStepCandidates",
      "rendered",
      "lookaheadBuiltPixels",
      "bestAgreement",
      "runnerUpAgreement",
      "margin",
      "minimumMargin",
      "minimumAgreement",
      "settled",
    ]) &&
    (value.trigger === "no-local-signal" || value.trigger === "unseparated-by-own-panel") &&
    isNullableFiniteNumber(value.ownPanelMargin) &&
    isNullableFiniteNumber(value.ownPanelMinimumMargin) &&
    // The local numbers travel as a pair or not at all: a margin with nothing to
    // compare it against cannot be read, and a minimum with no margin claims a
    // local ranking the step did not have. A step that deferred because its own
    // panel could not separate its candidates must carry both, because that
    // margin is the whole reason it left its own panel.
    (value.ownPanelMargin === null) === (value.ownPanelMinimumMargin === null) &&
    (value.trigger !== "unseparated-by-own-panel" || value.ownPanelMargin !== null) &&
    (value.lookaheadStepNumber === null ||
      isBoundedInteger(value.lookaheadStepNumber, 1_000_000)) &&
    isBoundedInteger(value.reachSteps, 1_000_000) &&
    (value.lookaheadUpSign === null ||
      value.lookaheadUpSign === 1 ||
      value.lookaheadUpSign === -1) &&
    (value.lookaheadMeasure === null ||
      value.lookaheadMeasure === "iou" ||
      value.lookaheadMeasure === "containment") &&
    isNullableFiniteNumber(value.lookaheadTurnDegrees) &&
    isNullableFiniteNumber(value.lookaheadTurnAnchorIou) &&
    isNullableFiniteNumber(value.lookaheadTurnMargin) &&
    isBoundedInteger(value.narrowingRenders, narrowingRenderBound + 1) &&
    isDenseBoundedArray(value.offeredPerPiece, maximumPieces) &&
    isDenseBoundedArray(value.carriedPerPiece, maximumPieces) &&
    value.offeredPerPiece.length === value.carriedPerPiece.length &&
    // One enumeration row per assembled piece. A transition defers no pieces;
    // every other deferral must say what each printed piece offered/carried.
    value.offeredPerPiece.length === expectedPieces &&
    value.offeredPerPiece.every((count) => isBoundedInteger(count, Number.MAX_SAFE_INTEGER)) &&
    value.carriedPerPiece.every((count, index) =>
      isBoundedInteger(count, (value.offeredPerPiece as readonly number[])[index] as number),
    ) &&
    // A settled deferral rendered its candidates through some camera, so it
    // knows which face and which quarter turn that camera was at. Reporting
    // `settled` without them is the claim this pair exists to make checkable:
    // the run that could not say either rendered every candidate upright at
    // turn zero and did not know it.
    (!value.settled ||
      (value.lookaheadUpSign !== null &&
        value.lookaheadMeasure !== null &&
        isFiniteNumber(value.lookaheadTurnDegrees))) &&
    isBoundedInteger(value.wholeStepCandidates, Number.MAX_SAFE_INTEGER) &&
    isBoundedInteger(value.rendered, Number.MAX_SAFE_INTEGER) &&
    isBoundedInteger(value.lookaheadBuiltPixels, Number.MAX_SAFE_INTEGER) &&
    isNullableFiniteNumber(value.bestAgreement) &&
    isNullableFiniteNumber(value.runnerUpAgreement) &&
    isNullableFiniteNumber(value.margin) &&
    isFiniteNumber(value.minimumMargin) &&
    isFiniteNumber(value.minimumAgreement) &&
    typeof value.settled === "boolean" &&
    // A settled deferral must name the panel that settled it and the margin it
    // cleared. Without this a run could report `settled: true` with no reach and
    // no evidence, which is exactly the claim this field exists to make checkable.
    (!value.settled ||
      (value.lookaheadStepNumber !== null &&
        (value.reachSteps as number) > 0 &&
        isFiniteNumber(value.bestAgreement)))
  );
}

function isArrowEvidence(value: unknown, maximum: number): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, [
      "kept",
      "redPx",
      "rejected",
      "displacementFamily",
      "displacementFamilyLdu",
    ]) &&
    isBoundedInteger(value.kept, maximum) &&
    isBoundedInteger(value.redPx, Number.MAX_SAFE_INTEGER) &&
    isBoundedInteger(value.rejected, maximum) &&
    isBoundedInteger(value.displacementFamily, Number.MAX_SAFE_INTEGER) &&
    Array.isArray(value.displacementFamilyLdu) &&
    value.displacementFamilyLdu.length <= 8 &&
    value.displacementFamilyLdu.every((entry) => isTuple(entry, 3))
  );
}

function stepReportShapeDefect(
  report: unknown,
  index: number,
  generation: 2 | 3 | 4,
  options: LegacyRealBuildBrowserOutputBoundary,
  panelCameraContinuity: PanelCameraLineageContinuityState | null,
): string | null {
  // A render count is not a part count. These were bounded by `maxParts`, which
  // held only while every search rendered fewer candidates than the model has
  // pieces; an exploded step renders its candidate set once per member of the
  // arrow's travel family, and printed step 2's 105 by 22 went straight through
  // a ceiling that was never about renders. The bound is the run's own render
  // budgets, which is what actually caps the number.
  const renderBound = Math.max(options.blindRenderBudget, options.explodedGhostRenderBudget);
  const panel = options.panels.find(({ stepNumber }) => stepNumber === index + 1);
  if (
    !isRecord(report) ||
    !exactKeys(report, generation === 2 ? LEGACY_REPORT_KEYS_V2 : REPORT_KEYS) ||
    panel === undefined ||
    report.stepNumber !== index + 1 ||
    report.pageNumber !== panel.pageNumber ||
    // Bound to the prepared panel rather than merely well-typed: the run may
    // only report the face its inputs declared, so it cannot invent one for a
    // step whose icons were never read.
    report.panelFace !== panel.panelFace ||
    report.calloutPieces !== panel.calloutPieces ||
    report.expectedAssembledPieces !== panel.action.assembledPieces ||
    !isBoundedInteger(report.attemptedPieces, options.maxParts) ||
    !isBoundedInteger(report.placedPieces, options.maxParts) ||
    !boundedBrowserActionMatches(report.action, panel.action, report.actionEvidenceDigest) ||
    (report.canonicalStepId !== null && typeof report.canonicalStepId !== "string") ||
    !isStepPrerequisites(report.prerequisites, options.maxParts) ||
    !isStepOutcome(report.outcome, generation) ||
    !isStepValidation(report.validation) ||
    !isFitEvidence(report.fit) ||
    !isCameraEvidence(report.camera) ||
    !isHighlightEvidence(report.highlight, options.maxParts) ||
    !isArrowEvidence(report.arrows, options.maxParts) ||
    !Array.isArray(report.pieces) ||
    report.pieces.length > options.maxParts ||
    !report.pieces.every((piece) => isPieceReport(piece, options.maxParts, renderBound)) ||
    !isWholeStepVisual(report.jointVisual, options.maxParts) ||
    !isExplodedGhostEvidence(report.explodedGhost) ||
    !isBoundedInteger(report.documentParts, options.maxParts) ||
    !isFiniteNumber(report.elapsedMs) ||
    report.elapsedMs < 0 ||
    !isNullableRealBuildPngCapture(report.panelPng) ||
    !isNullableRealBuildPngCapture(report.buildPng)
  ) {
    return `Replay browser-output report ${index} must match the complete prepared-panel boundary shape.`;
  }
  if (
    !isDeferralEvidence(
      report.deferral,
      options.maxParts,
      report.expectedAssembledPieces as number,
      options.deferredNarrowingRenderBudget,
    )
  ) {
    return `Replay browser-output report[${index}].deferral must have the exact bounded deferral-evidence shape for its prepared piece count.`;
  }
  const deferral = report.deferral as Parameters<typeof isRealBuildFartherEvidence>[3];
  const outcomeUsesDeferredLookahead =
    isRecord(report.outcome) &&
    (report.outcome.status === "complete"
      ? report.outcome.mechanism === "deferred-lookahead"
      : report.outcome.attemptedMechanism === "deferred-lookahead");
  const pieceReportsDeferredFailure = (report.pieces as readonly Record<string, unknown>[]).some(
    (piece) =>
      isRecord(piece.failure) &&
      [
        "deferred-panel-unscored",
        "deferred-reach-unmeasured",
        "weak-deferred-agreement",
        "ambiguous-deferred-placement",
      ].includes(piece.failure.code as string),
  );
  if (
    (deferral !== null) !== outcomeUsesDeferredLookahead ||
    (pieceReportsDeferredFailure && deferral === null)
  ) {
    return `Replay browser-output report[${index}] must retain deferral evidence exactly when its outcome or piece failures say deferred lookahead ran.`;
  }
  if (!isRealBuildFartherDeferralCoherent(report.farther, deferral)) {
    return `Replay browser-output report[${index}] deferral/farther cross-fields must repeat the same trigger, own-panel evidence, N+1 step, candidate scores, and unresolved settlement.`;
  }
  if (
    !isRealBuildFartherEvidence(
      report.farther,
      report.stepNumber as number,
      report.expectedAssembledPieces as number,
      deferral,
      options,
      generation === 2
        ? LEGACY_MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION_V2
        : MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION,
    )
  ) {
    return `Replay browser-output report[${index}].farther must be an exact bounded branch proof tied to the prepared N/N+1 panels, parent frontier, lineages, budgets, scores, refusal, and decision.`;
  }
  if (
    report.farther !== null &&
    !isRealBuildFartherDecisionPieceCoherent({
      farther: report.farther as RealBuildFartherEvidence,
      reportPieces: report.pieces as RealBuildStepReport["pieces"],
      preparedPieces: panel.pieces,
    })
  ) {
    return `Replay browser-output report[${index}] completed farther decision must reproduce the selected origin's exact catalog, color and transform witnesses in its placed piece rows.`;
  }
  if (
    !isRealBuildFartherCaptures(
      report.fartherCaptures,
      report.farther as RealBuildFartherEvidence | null,
    )
  ) {
    return `Replay browser-output report[${index}].fartherCaptures must contain one exact source PNG per panel, every N+1 score render, dense capture IDs, and only score-bound candidate IDs.`;
  }
  if (generation === 3) {
    if (panelCameraContinuity === null) {
      return `Replay browser-output report[${index}] has no generation-3 panel-camera continuity state.`;
    }
    const defect = panelCameraEvidenceDefect(
      report.panelCamera,
      report,
      index,
      options.panelCameraBranchBudget!,
      panelCameraContinuity,
      {
        pdfDigest: options.inputDigests.pdf,
        panels: options.panels,
      },
    );
    if (defect !== null) return defect;
  }
  return null;
}

/**
 * Reuses the complete current report/action/farther shape for browser-output /4 while
 * deliberately leaving camera and document authority to the new external evidence roles.
 * Generation-2 and generation-3 readers continue through their frozen/current paths.
 */
export function realBuildBrowserOutputV4BaseReportDefect(
  report: unknown,
  index: number,
  options: RealBuildBrowserOutputBoundary,
): string | null {
  return stepReportShapeDefect(report, index, 4, options, null);
}

/**
 * The two separable questions a self-labelled browser output has to answer.
 *
 * They were one question, and that is why a run that did not finish reported
 * nothing about the part it did. `envelopeDefect` and `reportDefects` ask
 * whether these bytes are a browser output at all — a hostile or garbled object
 * cannot be trusted and its rows must not be retained. `reproductionDefect`
 * asks something else entirely: whether an *executed* output accounts for every
 * piece its prepared panels declare. A prefix that refused at printed step 12 of
 * 50 fails that and only that, which is not a defect of the bytes but the
 * ordinary state of this project — and its first eleven rows are exactly the
 * evidence a survey needs. Merging the two meant one unfinished prefix threw
 * away every refusal it had already measured.
 */
export interface RealBuildBrowserOutputReading {
  readonly envelopeDefect: string | null;
  readonly reportDefects: readonly (string | null)[];
  /** Non-null when an executed output does not account for its prepared inputs — a finding, not a parse error. */
  readonly reproductionDefect: string | null;
}

function readRealBuildBrowserOutputGeneration(
  value: unknown,
  options: LegacyRealBuildBrowserOutputBoundary,
  generation: 2 | 3,
): RealBuildBrowserOutputReading {
  const unreadable = (envelopeDefect: string): RealBuildBrowserOutputReading => ({
    envelopeDefect,
    reportDefects: [],
    reproductionDefect: null,
  });
  if (!isRecord(value) || (value.status !== "executed" && value.status !== "failed")) {
    return unreadable("Replay browser-output must be an executed or failed object.");
  }
  if (
    generation === 3 &&
    (!Number.isSafeInteger(options.panelCameraBranchBudget) ||
      options.panelCameraBranchBudget! < 8 ||
      options.panelCameraBranchBudget! > 800_000 ||
      options.panelCameraBranchBudget! % 8 !== 0)
  ) {
    return unreadable(
      `Current browser-output /3 requires panelCameraBranchBudget to be a safe multiple of eight from 8 through 800000; received ${String(options.panelCameraBranchBudget)}.`,
    );
  }
  const expectedKeys =
    value.status === "executed"
      ? [
          "schemaVersion",
          "status",
          "reports",
          "documentJson",
          "identityBindings",
          "fetchedPdfDigest",
          "totalElapsedMs",
        ]
      : [
          "schemaVersion",
          "status",
          "reports",
          "documentJson",
          "identityBindings",
          "fetchedPdfDigest",
          "failure",
          "totalElapsedMs",
        ];
  if (
    !exactKeys(value, expectedKeys) ||
    value.schemaVersion !== `lego.real-build-browser-output/${generation}` ||
    !Array.isArray(value.reports) ||
    value.reports.length > options.lastStep ||
    !Array.isArray(value.identityBindings) ||
    value.identityBindings.length > options.maxParts ||
    !Number.isFinite(value.totalElapsedMs) ||
    (value.totalElapsedMs as number) < 0 ||
    (value.totalElapsedMs as number) > 4 * 60 * 60 * 1_000
  ) {
    return unreadable(
      "Replay browser-output must have the exact schema, bounded report/binding counts, and elapsed time.",
    );
  }
  const reportDefects: (string | null)[] = [];
  const seenSteps = new Set<number>();
  const canonicalDocumentBoundary =
    generation === 3
      ? inspectBrowserOutputCanonicalTransitions(
          value.documentJson,
          options.panels,
          options.lastStep,
          options.maxParts,
        )
      : { present: false, defect: null, transitionWitnesses: new Map(), finalDocument: null };
  const panelCameraContinuity = createPanelCameraLineageContinuityState(
    generation === 3
      ? documentStructuralHash(
          createEmptyBrickDocument({
            id: "real-build",
            name: "Real booklet rebuild",
            maxParts: options.maxParts,
          }),
        )
      : "legacy-v2-does-not-parse-panel-camera-evidence",
    canonicalDocumentBoundary.transitionWitnesses,
  );
  for (let index = 0; index < value.reports.length; index += 1) {
    const report: unknown = value.reports[index];
    const shapeDefect = stepReportShapeDefect(
      report,
      index,
      generation,
      options,
      panelCameraContinuity,
    );
    const stepNumber = shapeDefect === null ? (report as RealBuildStepReport).stepNumber : null;
    reportDefects.push(
      shapeDefect ??
        (stepNumber !== null && seenSteps.has(stepNumber)
          ? `Replay browser-output repeats printed step ${stepNumber}.`
          : null),
    );
    if (stepNumber !== null) seenSteps.add(stepNumber);
  }
  const terminalDocumentDefect =
    generation === 3
      ? terminalCanonicalDocumentDefect({
          boundary: canonicalDocumentBoundary,
          expectedRootDocumentHash: panelCameraContinuity.expectedRootDocumentHash,
          acceptedDocumentHash: panelCameraContinuity.acceptedDocumentHash,
          acceptedDocumentParts: panelCameraContinuity.acceptedDocumentParts,
          acceptedSteps: [...panelCameraContinuity.acceptedSteps.values()],
        })
      : null;
  const seenIdentities = new Set<string>();
  const seenParts = new Set<string>();
  for (const binding of value.identityBindings) {
    if (
      !isRecord(binding) ||
      !exactKeys(binding, [
        "identityKey",
        "partId",
        "stepNumber",
        "designId",
        "materialId",
        "catalogPartId",
        "colorId",
      ]) ||
      Object.entries(binding).some(([name, field]) =>
        name === "stepNumber"
          ? !Number.isInteger(field)
          : typeof field !== "string" || field.length === 0,
      ) ||
      (binding.stepNumber as number) < 1 ||
      (binding.stepNumber as number) > options.lastStep ||
      seenIdentities.has(binding.identityKey as string) ||
      seenParts.has(binding.partId as string)
    ) {
      return unreadable(
        "Replay browser-output identity bindings must be unique, complete, and step-bounded.",
      );
    }
    seenIdentities.add(binding.identityKey as string);
    seenParts.add(binding.partId as string);
  }
  const reading = (reproductionDefect: string | null): RealBuildBrowserOutputReading => ({
    envelopeDefect: null,
    reportDefects,
    reproductionDefect,
  });
  if (value.status === "executed") {
    const expectedBindings = options.panels
      .filter(({ stepNumber }) => stepNumber <= options.lastStep)
      .reduce(
        (total, panel) =>
          total +
          (panel.action.kind === "transition"
            ? 0
            : panel.action.kind === "multi-build-copy"
              ? panel.action.copies.length
              : panel.pieces.length + panel.omittedPieces.length),
        0,
      );
    // One condition per cause, naming what it saw. As a single boolean this
    // covered four unrelated failures — no document, an empty one, the wrong
    // PDF, and a binding count that disagrees with the panels — under one
    // sentence that named none of them, so every one of them read as "the
    // browser produced nothing".
    const executedMismatch =
      value.reports.length !== options.lastStep
        ? `${value.reports.length} step report(s) were retained against the requested prefix of ${options.lastStep}`
        : typeof value.documentJson !== "string"
          ? `documentJson is ${value.documentJson === null ? "null" : typeof value.documentJson}, not a string`
          : value.documentJson.length === 0
            ? "documentJson is empty, so the run finished without a document"
            : value.fetchedPdfDigest !== options.inputDigests.pdf
              ? `the browser fetched PDF ${describeDetachedBrowserValue(value.fetchedPdfDigest)} but the prepared inputs pin ${options.inputDigests.pdf}`
              : value.identityBindings.length !== expectedBindings
                ? `${value.identityBindings.length} identity binding(s) were retained against ${expectedBindings} the requested panels declare`
                : null;
    if (executedMismatch !== null) {
      const outcomes = value.reports
        .filter((_, index) => reportDefects[index] === null)
        .slice(0, 6)
        .map((report) => {
          const entry = report as RealBuildStepReport;
          const failure = entry.outcome.failure;
          return (
            `step ${entry.stepNumber} ${entry.outcome.status}/${entry.outcome.mechanism} ` +
            `${entry.placedPieces}/${entry.expectedAssembledPieces} placed ` +
            `[highlight ${entry.highlight.regions} region(s), ${entry.highlight.strokePx}px stroke, ` +
            `closed ${entry.highlight.closedContourRate}; arrows ${entry.arrows.kept} kept ` +
            `${entry.arrows.rejected} rejected, family ${entry.arrows.displacementFamily} ` +
            `${JSON.stringify(entry.arrows.displacementFamilyLdu)}]` +
            (failure === null
              ? ""
              : ` — ${failure.code.slice(0, 128)}: ${failure.message.slice(0, 512)}`)
          );
        });
      return reading(
        `Executed replay browser-output does not reproduce its prepared inputs: ${executedMismatch}. ` +
          (outcomes.length === 0
            ? "No step reports were retained."
            : `Steps: ${outcomes.join(" | ")}`),
      );
    }
    if (generation === 3 && canonicalDocumentBoundary.defect !== null) {
      return reading(
        `Executed replay browser-output canonical transition boundary could not inspect documentJson: ` +
          `${canonicalDocumentBoundary.defect}.`,
      );
    }
    if (generation === 3 && terminalDocumentDefect !== null) {
      return reading(`Executed replay browser-output ${terminalDocumentDefect}.`);
    }
  } else {
    const failedDefect = failedBrowserOutputEnvelopeDefect(value, options.inputDigests.pdf);
    if (failedDefect !== null) return unreadable(failedDefect);
  }
  if (
    generation === 3 &&
    value.status === "failed" &&
    value.documentJson !== null &&
    terminalDocumentDefect !== null
  ) {
    return unreadable(`Failed replay browser-output ${terminalDocumentDefect}.`);
  }
  return reading(null);
}

export function readRealBuildBrowserOutput(
  value: unknown,
  options: RealBuildBrowserOutputBoundary,
): RealBuildBrowserOutputReading {
  const snapshot = snapshotCurrentRealBuildBrowserOutput(value, options.lastStep, options.maxParts);
  if (!snapshot.ok) {
    return {
      envelopeDefect: `Replay browser-output could not be safely detached: ${snapshot.defect}.`,
      reportDefects: [],
      reproductionDefect: null,
    };
  }
  try {
    return boundBrowserOutputReading(
      readRealBuildBrowserOutputGeneration(snapshot.value, options, 3),
    );
  } catch {
    return {
      envelopeDefect: "Replay browser-output detached data could not be safely inspected.",
      reportDefects: [],
      reproductionDefect: null,
    };
  }
}

export function inspectLegacyRealBuildBrowserOutputV2(
  value: unknown,
  options: LegacyRealBuildBrowserOutputBoundary,
): LegacyRealBuildBrowserOutputV2 {
  return inspectFrozenLegacyBrowserOutputV2(
    value,
    options as RealBuildOptions,
  ) as LegacyRealBuildBrowserOutputV2;
}

/**
 * Rejects a browser output unless its bytes are readable and every retained row
 * matches its prepared panel.
 *
 * This is the boundary a *published* artifact and a *replay* must clear: a role
 * whose rows do not describe the panels they claim is corrupt evidence and must
 * not be republished. It deliberately does not ask whether the run finished,
 * which is `reproductionDefect`'s question and belongs in the score.
 */
export function assertReadableRealBuildBrowserOutput(
  value: unknown,
  options: RealBuildBrowserOutputBoundary,
): asserts value is RealBuildBrowserOutput {
  const { envelopeDefect, reportDefects } = readRealBuildBrowserOutput(value, options);
  const defect = envelopeDefect ?? reportDefects.find((entry) => entry !== null);
  if (defect !== undefined && defect !== null) throw new TypeError(defect);
}

/** Rejects a self-labelled browser-output object unless its complete boundary shape is coherent. */
export function assertRealBuildBrowserOutput(
  value: unknown,
  options: RealBuildBrowserOutputBoundary,
): asserts value is RealBuildBrowserOutput {
  assertReadableRealBuildBrowserOutput(value, options);
  const { reproductionDefect } = readRealBuildBrowserOutput(value, options);
  if (reproductionDefect !== null) throw new TypeError(reproductionDefect);
}

export function isRealBuildBrowserOutput(
  value: unknown,
  options: RealBuildBrowserOutputBoundary,
): value is RealBuildBrowserOutput {
  try {
    assertRealBuildBrowserOutput(value, options);
    return true;
  } catch {
    return false;
  }
}
