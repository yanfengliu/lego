import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";
import {
  LEGACY_DIGEST_PATTERN,
  legacyBoundedInteger,
  legacyDeferral,
  legacyDenseArray,
  legacyExactKeys,
  legacyFinite,
  legacyNullableFinite,
  legacyNullablePng,
  legacyRecord,
  legacyStepFailure,
  legacyTuple,
} from "./real-build-artifact-legacy-browser-v2-values";

export const LEGACY_REPORT_KEYS_V2 = [
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
  "farther",
  "fartherCaptures",
  "explodedGhost",
  "documentParts",
  "elapsedMs",
  "panelPng",
  "buildPng",
] as const;

const nullableDigest = (value: unknown): boolean =>
  value === null || (typeof value === "string" && LEGACY_DIGEST_PATTERN.test(value));

function stringArray(value: unknown): boolean {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.length > 0)
  );
}

function prerequisites(value: unknown, maximum: number): boolean {
  return (
    legacyRecord(value) &&
    legacyExactKeys(value, [
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
    value.coverageFailures.every(legacyStepFailure) &&
    stringArray(value.unresolvedCallouts) &&
    stringArray(value.missingDesigns) &&
    legacyBoundedInteger(value.calloutPieces, maximum) &&
    legacyBoundedInteger(value.expectedAssembledPieces, maximum) &&
    legacyBoundedInteger(value.resolvedPieces, maximum) &&
    (value.localFailure === null || legacyStepFailure(value.localFailure))
  );
}

function outcome(value: unknown): boolean {
  if (!legacyRecord(value)) return false;
  if (value.status === "complete") {
    return (
      legacyExactKeys(value, ["status", "mechanism", "failure"]) &&
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
    legacyExactKeys(value, ["status", "mechanism", "attemptedMechanism", "failure"]) &&
    ["deferred", "blocked"].includes(String(value.mechanism)) &&
    (value.attemptedMechanism === null || typeof value.attemptedMechanism === "string") &&
    legacyStepFailure(value.failure)
  );
}

function validation(value: unknown): boolean {
  return (
    legacyRecord(value) &&
    legacyExactKeys(value, [
      "attempted",
      "targetDocumentHash",
      "truthSnapshotHash",
      "validatorSetHash",
      "documentGloballyValid",
      "blockingIssues",
      "failure",
    ]) &&
    typeof value.attempted === "boolean" &&
    nullableDigest(value.targetDocumentHash) &&
    nullableDigest(value.truthSnapshotHash) &&
    nullableDigest(value.validatorSetHash) &&
    (value.documentGloballyValid === null || typeof value.documentGloballyValid === "boolean") &&
    Array.isArray(value.blockingIssues) &&
    value.blockingIssues.every(
      (issue) =>
        legacyRecord(issue) &&
        legacyExactKeys(issue, ["code", "message", "path", "partIds"]) &&
        typeof issue.code === "string" &&
        typeof issue.message === "string" &&
        typeof issue.path === "string" &&
        stringArray(issue.partIds),
    ) &&
    (value.failure === null || typeof value.failure === "string")
  );
}

function fit(value: unknown): boolean {
  return (
    legacyRecord(value) &&
    legacyExactKeys(value, [
      "azimuthDegrees",
      "elevationDegrees",
      "pixelsPerUnit",
      "residualPx",
      "coherence",
      "failure",
    ]) &&
    ["azimuthDegrees", "elevationDegrees", "pixelsPerUnit", "residualPx"].every((key) =>
      legacyNullableFinite(value[key]),
    ) &&
    legacyFinite(value.coherence) &&
    (value.failure === null || typeof value.failure === "string")
  );
}

function camera(value: unknown): boolean {
  return (
    value === null ||
    (legacyRecord(value) &&
      legacyExactKeys(value, [
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
      ].every((key) => legacyFinite(value[key])) &&
      legacyNullableFinite(value.anchorIou) &&
      legacyNullableFinite(value.anchorTurnDegrees) &&
      (value.anchorShiftPx === null || legacyTuple(value.anchorShiftPx, 2)))
  );
}

function blind(value: unknown, maximum: number, renderBound: number): boolean {
  return (
    legacyRecord(value) &&
    legacyExactKeys(value, [
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
    LEGACY_DIGEST_PATTERN.test(value.comparisonPrefixHash) &&
    legacyBoundedInteger(value.distinctCandidates, maximum) &&
    typeof value.feasible === "boolean" &&
    legacyBoundedInteger(value.rendered, renderBound) &&
    legacyNullableFinite(value.bestScore) &&
    legacyNullableFinite(value.runnerUpScore) &&
    (value.agreesWithHighlight === null || typeof value.agreesWithHighlight === "boolean") &&
    (value.refusal === null || typeof value.refusal === "string") &&
    legacyFinite(value.elapsedMs) &&
    value.elapsedMs >= 0
  );
}

function pieces(value: unknown, maximum: number, renderBound: number): boolean {
  return (
    legacyDenseArray(value, maximum) &&
    value.every(
      (piece) =>
        legacyRecord(piece) &&
        legacyExactKeys(piece, [
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
        typeof piece.catalogPartId === "string" &&
        piece.catalogPartId.length > 0 &&
        blind(piece.blind, maximum, renderBound) &&
        legacyBoundedInteger(piece.enumerated, maximum) &&
        legacyBoundedInteger(piece.afterProximity, maximum) &&
        legacyBoundedInteger(piece.rendered, renderBound) &&
        legacyNullableFinite(piece.bestScore) &&
        legacyNullableFinite(piece.runnerUpScore) &&
        typeof piece.placed === "boolean" &&
        (piece.positionLdu === null || legacyTuple(piece.positionLdu, 3)) &&
        (piece.orientationId === null || typeof piece.orientationId === "string") &&
        (piece.failure === null || legacyStepFailure(piece.failure)),
    )
  );
}

function jointVisual(value: unknown, maximum: number): boolean {
  return (
    value === null ||
    (legacyRecord(value) &&
      legacyExactKeys(value, [
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
      legacyNullableFinite(value.score) &&
      legacyFinite(value.minimumScore) &&
      legacyFinite(value.minimumExclusiveHighlightPixelsPerPiece) &&
      nullableDigest(value.calibrationDigest) &&
      ["region", "stroke"].includes(String(value.evidenceKind)) &&
      ["printedEvidencePixels", "unionHighlightPixels", "summedPieceHighlightPixels"].every((key) =>
        legacyBoundedInteger(value[key], Number.MAX_SAFE_INTEGER),
      ) &&
      legacyDenseArray(value.exclusiveHighlightPixelsByPiece, maximum) &&
      value.exclusiveHighlightPixelsByPiece.every((entry) => legacyFinite(entry) && entry >= 0) &&
      (value.unexplainedBoundsPx === null || legacyTuple(value.unexplainedBoundsPx, 4)) &&
      (value.failure === null || legacyStepFailure(value.failure)))
  );
}

function exploded(value: unknown): boolean {
  if (value === null) return true;
  if (
    !legacyRecord(value) ||
    !legacyExactKeys(value, [
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
    ])
  )
    return false;
  const integers = [
    "displacements",
    "wholeStepCandidates",
    "rendered",
    "printedRegionPx",
    "ghostSilhouettePx",
    "containedCandidates",
  ];
  if (
    !integers.every((key) => legacyBoundedInteger(value[key], Number.MAX_SAFE_INTEGER)) ||
    !legacyFinite(value.containmentCeiling) ||
    !legacyNullableFinite(value.bestRegionIou) ||
    !legacyNullableFinite(value.runnerUpRegionIou) ||
    !(
      value.bestOutsideRegionPx === null ||
      legacyBoundedInteger(value.bestOutsideRegionPx, Number.MAX_SAFE_INTEGER)
    ) ||
    typeof value.settled !== "boolean"
  )
    return false;
  return (
    !value.settled ||
    (value.containedCandidates === 1 &&
      (value.displacements as number) > 0 &&
      (value.rendered as number) > 0 &&
      legacyFinite(value.bestRegionIou))
  );
}

export function assertFrozenLegacyReportBaseV2(input: {
  readonly value: unknown;
  readonly index: number;
  readonly options: RealBuildOptions;
}): { readonly report: Record<string, unknown>; readonly panel: RealBuildPanelSpec } {
  const { value, index, options } = input;
  const panel = options.panels.find(({ stepNumber }) => stepNumber === index + 1);
  const renderBound = Math.max(options.blindRenderBudget, options.explodedGhostRenderBudget);
  if (
    !legacyRecord(value) ||
    !legacyExactKeys(value, LEGACY_REPORT_KEYS_V2) ||
    panel === undefined ||
    value.stepNumber !== index + 1 ||
    value.pageNumber !== panel.pageNumber ||
    value.panelFace !== panel.panelFace ||
    value.calloutPieces !== panel.calloutPieces ||
    value.expectedAssembledPieces !== panel.action.assembledPieces ||
    !legacyBoundedInteger(value.attemptedPieces, options.maxParts) ||
    !legacyBoundedInteger(value.placedPieces, options.maxParts) ||
    JSON.stringify(value.action) !== JSON.stringify(panel.action) ||
    !nullableDigest(value.actionEvidenceDigest) ||
    !(value.canonicalStepId === null || typeof value.canonicalStepId === "string") ||
    !prerequisites(value.prerequisites, options.maxParts) ||
    !outcome(value.outcome) ||
    !validation(value.validation) ||
    !fit(value.fit) ||
    !camera(value.camera) ||
    !legacyRecord(value.highlight) ||
    !legacyExactKeys(value.highlight, ["regions", "closedContourRate", "strokePx", "boundsPx"]) ||
    !legacyBoundedInteger(value.highlight.regions, options.maxParts) ||
    !legacyFinite(value.highlight.closedContourRate) ||
    !legacyFinite(value.highlight.strokePx) ||
    !(value.highlight.boundsPx === null || legacyTuple(value.highlight.boundsPx, 4)) ||
    !legacyRecord(value.arrows) ||
    !legacyExactKeys(value.arrows, [
      "kept",
      "redPx",
      "rejected",
      "displacementFamily",
      "displacementFamilyLdu",
    ]) ||
    !legacyBoundedInteger(value.arrows.kept, options.maxParts) ||
    !legacyBoundedInteger(value.arrows.redPx, Number.MAX_SAFE_INTEGER) ||
    !legacyBoundedInteger(value.arrows.rejected, options.maxParts) ||
    !legacyBoundedInteger(value.arrows.displacementFamily, Number.MAX_SAFE_INTEGER) ||
    !legacyDenseArray(value.arrows.displacementFamilyLdu, 8) ||
    !value.arrows.displacementFamilyLdu.every((entry) => legacyTuple(entry, 3)) ||
    !pieces(value.pieces, options.maxParts, renderBound) ||
    !jointVisual(value.jointVisual, options.maxParts) ||
    !legacyDeferral(
      value.deferral,
      options.maxParts,
      value.expectedAssembledPieces as number,
      options.deferredNarrowingRenderBudget,
    ) ||
    !exploded(value.explodedGhost) ||
    !legacyBoundedInteger(value.documentParts, options.maxParts) ||
    !legacyFinite(value.elapsedMs) ||
    value.elapsedMs < 0 ||
    !legacyNullablePng(value.panelPng) ||
    !legacyNullablePng(value.buildPng)
  ) {
    throw new TypeError(
      `Legacy browser-output /2 report[${index}] violates its frozen exact schema.`,
    );
  }
  return { report: value, panel };
}
