import { Buffer } from "node:buffer";

import { validateBrickDocumentV1 } from "@lego-studio/protocol";

import type { RealBuildOptions, RealBuildStepReport, StepFailure } from "./real-build-safety";

export interface RealBuildIdentityBinding {
  readonly identityKey: string;
  readonly partId: string;
  readonly stepNumber: number;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
}

export type RealBuildBrowserOutput =
  | {
      readonly schemaVersion: "lego.real-build-browser-output/2";
      readonly status: "executed";
      readonly reports: readonly RealBuildStepReport[];
      readonly documentJson: string;
      readonly identityBindings: readonly RealBuildIdentityBinding[];
      readonly fetchedPdfDigest: string;
      readonly totalElapsedMs: number;
    }
  | {
      readonly schemaVersion: "lego.real-build-browser-output/2";
      readonly status: "failed";
      readonly reports: readonly RealBuildStepReport[];
      readonly documentJson: string | null;
      readonly identityBindings: readonly RealBuildIdentityBinding[];
      readonly fetchedPdfDigest: string | null;
      readonly failure: StepFailure;
      readonly totalElapsedMs: number;
    };

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
const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const MAXIMUM_STEP_CAPTURE_BYTES = 16 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
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
  "highlight",
  "arrows",
  "pieces",
  "jointVisual",
  "deferral",
  "explodedGhost",
  "documentParts",
  "elapsedMs",
  "panelPng",
  "buildPng",
] as const;

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

export function decodeRealBuildPngCapture(value: string): Buffer {
  if (!value.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new TypeError("Real-build step capture must be an exact PNG data URL.");
  }
  const encoded = value.slice(PNG_DATA_URL_PREFIX.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) {
    throw new TypeError("Real-build step capture must contain canonical base64.");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (
    bytes.length < PNG_SIGNATURE.length ||
    bytes.length > MAXIMUM_STEP_CAPTURE_BYTES ||
    bytes.toString("base64") !== encoded ||
    !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new TypeError(
      `Real-build step capture must be a ${PNG_SIGNATURE.length}..${MAXIMUM_STEP_CAPTURE_BYTES}-byte canonical PNG.`,
    );
  }
  return bytes;
}

function isNullablePngCapture(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  try {
    decodeRealBuildPngCapture(value);
    return true;
  } catch {
    return false;
  }
}

function isStepFailure(value: unknown): value is StepFailure {
  if (!isRecord(value)) return false;
  const allowed = new Set([
    "code",
    "stage",
    "message",
    "causedByStep",
    "pieceIndex",
    "catalogPartId",
    "inputKey",
    "stepNumber",
  ]);
  return (
    Object.keys(value).every((key) => allowed.has(key)) &&
    typeof value.code === "string" &&
    value.code.length > 0 &&
    typeof value.stage === "string" &&
    value.stage.length > 0 &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    ["causedByStep", "pieceIndex", "stepNumber"].every(
      (key) => value[key] === undefined || Number.isSafeInteger(value[key]),
    ) &&
    ["catalogPartId", "inputKey"].every(
      (key) => value[key] === undefined || typeof value[key] === "string",
    )
  );
}

function isStepOutcome(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.status === "complete") {
    return (
      exactKeys(value, ["status", "mechanism", "failure"]) &&
      [
        "anchor-orientation",
        "highlight",
        "arrow",
        "exhaustive",
        "deferred-lookahead",
        "exploded-ghost",
        "instruction-transition",
        "official-ledger",
      ].includes(String(value.mechanism)) &&
      value.failure === null
    );
  }
  return (
    value.status === "failed" &&
    exactKeys(value, ["status", "mechanism", "attemptedMechanism", "failure"]) &&
    ["deferred", "blocked"].includes(String(value.mechanism)) &&
    (value.attemptedMechanism === null || typeof value.attemptedMechanism === "string") &&
    isStepFailure(value.failure)
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
    value.coverageFailures.every(isStepFailure) &&
    isStringArray(value.unresolvedCallouts) &&
    isStringArray(value.missingDesigns) &&
    isBoundedInteger(value.calloutPieces, maximum) &&
    isBoundedInteger(value.expectedAssembledPieces, maximum) &&
    isBoundedInteger(value.resolvedPieces, maximum) &&
    (value.localFailure === null || isStepFailure(value.localFailure))
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
    (value.failure === null || isStepFailure(value.failure))
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
      (value.failure === null || isStepFailure(value.failure)))
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

function isDeferralEvidence(value: unknown): boolean {
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
  options: Pick<
    RealBuildOptions,
    "lastStep" | "maxParts" | "panels" | "blindRenderBudget" | "explodedGhostRenderBudget"
  >,
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
    !exactKeys(report, REPORT_KEYS) ||
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
    JSON.stringify(report.action) !== JSON.stringify(panel.action) ||
    !isNullableDigest(report.actionEvidenceDigest) ||
    (report.canonicalStepId !== null && typeof report.canonicalStepId !== "string") ||
    !isStepPrerequisites(report.prerequisites, options.maxParts) ||
    !isStepOutcome(report.outcome) ||
    !isStepValidation(report.validation) ||
    !isFitEvidence(report.fit) ||
    !isCameraEvidence(report.camera) ||
    !isHighlightEvidence(report.highlight, options.maxParts) ||
    !isArrowEvidence(report.arrows, options.maxParts) ||
    !Array.isArray(report.pieces) ||
    report.pieces.length > options.maxParts ||
    !report.pieces.every((piece) => isPieceReport(piece, options.maxParts, renderBound)) ||
    !isWholeStepVisual(report.jointVisual, options.maxParts) ||
    !isDeferralEvidence(report.deferral) ||
    !isExplodedGhostEvidence(report.explodedGhost) ||
    !isBoundedInteger(report.documentParts, options.maxParts) ||
    !isFiniteNumber(report.elapsedMs) ||
    report.elapsedMs < 0 ||
    !isNullablePngCapture(report.panelPng) ||
    !isNullablePngCapture(report.buildPng)
  ) {
    return `Replay browser-output report ${index} must match the complete prepared-panel boundary shape.`;
  }
  return null;
}

type RealBuildBrowserOutputBoundary = Pick<
  RealBuildOptions,
  | "lastStep"
  | "maxParts"
  | "inputDigests"
  | "panels"
  | "blindRenderBudget"
  | "explodedGhostRenderBudget"
>;

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
  /** Non-null when the bytes are not a readable browser output, so nothing in them may be retained. */
  readonly envelopeDefect: string | null;
  /** One entry per retained report, in order: null when that row may be read, else why it may not. */
  readonly reportDefects: readonly (string | null)[];
  /** Non-null when an executed output does not account for its prepared inputs — a finding, not a parse error. */
  readonly reproductionDefect: string | null;
}

/** Reads a self-labelled browser-output object without deciding what to do about what it finds. */
export function readRealBuildBrowserOutput(
  value: unknown,
  options: RealBuildBrowserOutputBoundary,
): RealBuildBrowserOutputReading {
  const unreadable = (envelopeDefect: string): RealBuildBrowserOutputReading => ({
    envelopeDefect,
    reportDefects: [],
    reproductionDefect: null,
  });
  if (!isRecord(value) || (value.status !== "executed" && value.status !== "failed")) {
    return unreadable("Replay browser-output must be an executed or failed object.");
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
    value.schemaVersion !== "lego.real-build-browser-output/2" ||
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
  for (let index = 0; index < value.reports.length; index += 1) {
    const report: unknown = value.reports[index];
    const shapeDefect = stepReportShapeDefect(report, index, options);
    const stepNumber = shapeDefect === null ? (report as RealBuildStepReport).stepNumber : null;
    reportDefects.push(
      shapeDefect ??
        (stepNumber !== null && seenSteps.has(stepNumber)
          ? `Replay browser-output repeats printed step ${stepNumber}.`
          : null),
    );
    if (stepNumber !== null) seenSteps.add(stepNumber);
  }
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
              ? `the browser fetched PDF ${String(value.fetchedPdfDigest)} but the prepared inputs pin ${options.inputDigests.pdf}`
              : value.identityBindings.length !== expectedBindings
                ? `${value.identityBindings.length} identity binding(s) were retained against ${expectedBindings} the requested panels declare`
                : null;
    if (executedMismatch !== null) {
      // A binding count is a symptom; the steps hold the cause, and they are
      // right here. Without them this refusal says the run placed nothing and
      // leaves finding out why to a separate investigation.
      const outcomes = value.reports
        .filter((_, index) => reportDefects[index] === null)
        .slice(0, 6)
        .map((report) => {
          const entry = report as RealBuildStepReport;
          const failure = entry.outcome.failure;
          return (
            `step ${entry.stepNumber} ${entry.outcome.status}/${entry.outcome.mechanism} ` +
            `${entry.placedPieces}/${entry.expectedAssembledPieces} placed ` +
            // The evidence the step had to work from. A placement score of zero
            // means something different when the panel printed no highlight at
            // all than when it printed one the candidate missed, and only these
            // separate the two.
            `[highlight ${entry.highlight.regions} region(s), ${entry.highlight.strokePx}px stroke, ` +
            `closed ${entry.highlight.closedContourRate}; arrows ${entry.arrows.kept} kept ` +
            `${entry.arrows.rejected} rejected, family ${entry.arrows.displacementFamily} ` +
            `${JSON.stringify(entry.arrows.displacementFamilyLdu)}]` +
            (failure === null ? "" : ` — ${failure.code}: ${failure.message}`)
          );
        });
      return reading(
        `Executed replay browser-output does not reproduce its prepared inputs: ${executedMismatch}. ` +
          (outcomes.length === 0
            ? "No step reports were retained."
            : `Steps: ${outcomes.join(" | ")}`),
      );
    }
    try {
      const document: unknown = JSON.parse(value.documentJson as string);
      if (!validateBrickDocumentV1(document)) {
        throw new TypeError("document is not a valid BrickDocumentV1");
      }
    } catch (error) {
      return reading(
        `Executed replay browser-output documentJson is invalid JSON. ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else if (
    (value.documentJson !== null && typeof value.documentJson !== "string") ||
    (value.fetchedPdfDigest !== null &&
      (typeof value.fetchedPdfDigest !== "string" ||
        !DIGEST_PATTERN.test(value.fetchedPdfDigest) ||
        value.fetchedPdfDigest !== options.inputDigests.pdf)) ||
    !isRecord(value.failure) ||
    typeof value.failure.code !== "string" ||
    typeof value.failure.stage !== "string" ||
    typeof value.failure.message !== "string" ||
    value.failure.message.length === 0
  ) {
    // A failed output that cannot say *why* it failed is unreadable, not
    // incomplete: there is no finding in it to retain.
    return unreadable(
      "Failed replay browser-output must retain a structured failure and only exact optional PDF/document evidence.",
    );
  }
  return reading(null);
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
