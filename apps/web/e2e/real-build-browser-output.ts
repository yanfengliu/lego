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
      readonly schemaVersion: "lego.real-build-browser-output/1";
      readonly status: "executed";
      readonly reports: readonly RealBuildStepReport[];
      readonly documentJson: string;
      readonly identityBindings: readonly RealBuildIdentityBinding[];
      readonly fetchedPdfDigest: string;
      readonly totalElapsedMs: number;
    }
  | {
      readonly schemaVersion: "lego.real-build-browser-output/1";
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

function isBlindSearch(value: unknown, maximum: number): boolean {
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
    isBoundedInteger(value.rendered, maximum) &&
    isNullableFiniteNumber(value.bestScore) &&
    isNullableFiniteNumber(value.runnerUpScore) &&
    (value.agreesWithHighlight === null || typeof value.agreesWithHighlight === "boolean") &&
    (value.refusal === null || typeof value.refusal === "string") &&
    isFiniteNumber(value.elapsedMs) &&
    value.elapsedMs >= 0
  );
}

function isPieceReport(value: unknown, maximum: number): boolean {
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
    isBlindSearch(value.blind, maximum) &&
    isBoundedInteger(value.enumerated, maximum) &&
    isBoundedInteger(value.afterProximity, maximum) &&
    isBoundedInteger(value.rendered, maximum) &&
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
        "unionHighlightPixels",
        "summedPieceHighlightPixels",
        "exclusiveHighlightPixelsByPiece",
        "failure",
      ]) &&
      isNullableFiniteNumber(value.score) &&
      isFiniteNumber(value.minimumScore) &&
      isFiniteNumber(value.minimumExclusiveHighlightPixelsPerPiece) &&
      isNullableDigest(value.calibrationDigest) &&
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

function assertStepReportShape(
  report: unknown,
  index: number,
  options: Pick<RealBuildOptions, "lastStep" | "maxParts" | "panels">,
): asserts report is RealBuildStepReport {
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
    !report.pieces.every((piece) => isPieceReport(piece, options.maxParts)) ||
    !isWholeStepVisual(report.jointVisual, options.maxParts) ||
    !isBoundedInteger(report.documentParts, options.maxParts) ||
    !isFiniteNumber(report.elapsedMs) ||
    report.elapsedMs < 0 ||
    !isNullablePngCapture(report.panelPng) ||
    !isNullablePngCapture(report.buildPng)
  ) {
    throw new TypeError(
      `Replay browser-output report ${index} must match the complete prepared-panel boundary shape.`,
    );
  }
}

/** Rejects a self-labelled browser-output object unless its complete boundary shape is coherent. */
export function assertRealBuildBrowserOutput(
  value: unknown,
  options: Pick<RealBuildOptions, "lastStep" | "maxParts" | "inputDigests" | "panels">,
): asserts value is RealBuildBrowserOutput {
  if (!isRecord(value) || (value.status !== "executed" && value.status !== "failed")) {
    throw new TypeError("Replay browser-output must be an executed or failed object.");
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
    value.schemaVersion !== "lego.real-build-browser-output/1" ||
    !Array.isArray(value.reports) ||
    value.reports.length > options.lastStep ||
    (value.status === "executed" && value.reports.length !== options.lastStep) ||
    !Array.isArray(value.identityBindings) ||
    value.identityBindings.length > options.maxParts ||
    !Number.isFinite(value.totalElapsedMs) ||
    (value.totalElapsedMs as number) < 0 ||
    (value.totalElapsedMs as number) > 4 * 60 * 60 * 1_000
  ) {
    throw new TypeError(
      "Replay browser-output must have the exact schema, bounded report/binding counts, and elapsed time.",
    );
  }
  const seenSteps = new Set<number>();
  for (let index = 0; index < value.reports.length; index += 1) {
    const report = value.reports[index];
    assertStepReportShape(report, index, options);
    if (seenSteps.has(report.stepNumber)) {
      throw new TypeError(`Replay browser-output repeats printed step ${report.stepNumber}.`);
    }
    seenSteps.add(report.stepNumber);
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
      throw new TypeError(
        "Replay browser-output identity bindings must be unique, complete, and step-bounded.",
      );
    }
    seenIdentities.add(binding.identityKey as string);
    seenParts.add(binding.partId as string);
  }
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
      typeof value.documentJson !== "string"
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
      // leaves finding out why to a separate investigation, except the reports
      // never reach disk — publication is downstream of this throw.
      const outcomes = (Array.isArray(value.reports) ? value.reports : [])
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
      throw new TypeError(
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
      throw new TypeError("Executed replay browser-output documentJson is invalid JSON.", {
        cause: error,
      });
    }
  } else {
    if (
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
      throw new TypeError(
        "Failed replay browser-output must retain a structured failure and only exact optional PDF/document evidence.",
      );
    }
  }
}

export function isRealBuildBrowserOutput(
  value: unknown,
  options: Pick<RealBuildOptions, "lastStep" | "maxParts" | "inputDigests" | "panels">,
): value is RealBuildBrowserOutput {
  try {
    assertRealBuildBrowserOutput(value, options);
    return true;
  } catch {
    return false;
  }
}
