import { parseStrictJsonBytes } from "../../../scripts/part-identification-strict-json.mjs";

import { TRANSITION_CLASSIFICATIONS_DIGEST_FIELD } from "./real-build-action-ledger-field-names.ts";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";
import type { LedgerStep, RealBuildActionLedgerProvenance } from "./real-build-ledger-contract";

/** Frozen inspection-only schema used by retained run-contract /4 artifacts. */
export const LEGACY_REAL_BUILD_ACTION_LEDGER_V3_SCHEMA = "lego.real-build-action-ledger/3" as const;

export interface LegacyRealBuildActionLedgerV3 {
  readonly schemaVersion: typeof LEGACY_REAL_BUILD_ACTION_LEDGER_V3_SCHEMA;
  readonly pdfDigest: string;
  readonly officialModelDigest: string;
  readonly coverageDigest: string;
  readonly calloutManifestDigest: string;
  readonly builderCalibrationDigest: string;
  readonly transitionClassificationsDigest: string;
  readonly steps: readonly LedgerStep[];
  readonly provenance: RealBuildActionLedgerProvenance;
}

const MAXIMUM_BYTES = 16 * 1024 * 1024;
const MAXIMUM_IDENTITIES = 4_000;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const CALLOUT_KEY = /^p\d+\|q\d+\|x-?\d+\.\d{3}\|y-?\d+\.\d{3}$/u;
const TOP_KEYS = [
  "schemaVersion",
  "pdfDigest",
  "officialModelDigest",
  "coverageDigest",
  "calloutManifestDigest",
  "builderCalibrationDigest",
  TRANSITION_CLASSIFICATIONS_DIGEST_FIELD,
  "steps",
  "provenance",
] as const;
const PROVENANCE_KEYS = [
  "generator",
  "authenticated",
  "expectedPrintedSteps",
  "requestedLastStep",
  "alignedThroughStep",
  "stopReason",
  "directPieceCount",
  "transitionStepCount",
  "refusals",
] as const;
const PIECE_KEYS = [
  "brickRef",
  "designId",
  "materialId",
  "catalogPartId",
  "colorId",
  "calloutKey",
  "identificationConfidence",
  "cropDigest",
  "identificationInputDigest",
  "evidenceDigest",
  "transform",
] as const;

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be a legacy /3 JSON object.`);
  }
  const observed = Object.keys(value);
  if (observed.length !== keys.length || observed.some((key) => !keys.includes(key))) {
    throw new TypeError(`${label} must contain exactly the frozen legacy /3 fields.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string, maximum = MAXIMUM_IDENTITIES): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new TypeError(`${label} must be a legacy /3 array of at most ${maximum} entries.`);
  }
  return value;
}

function string(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum) {
    throw new TypeError(`${label} must contain 1 through ${maximum} characters.`);
  }
  return value;
}

function digest(value: unknown, label: string): string {
  const result = string(value, label, 71);
  if (!DIGEST.test(result)) throw new TypeError(`${label} must be one lowercase sha256 digest.`);
  return result;
}

function whole(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new TypeError(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value as number;
}

function inspectTransform(value: unknown, label: string): void {
  if (value === null) return;
  const transform = record(value, ["orientationId", "positionLdu"], label);
  string(transform.orientationId, `${label}.orientationId`, 128);
  const position = array(transform.positionLdu, `${label}.positionLdu`, 3);
  if (
    position.length !== 3 ||
    position.some(
      (coordinate) =>
        typeof coordinate !== "number" ||
        !Number.isFinite(coordinate) ||
        Math.abs(coordinate) > 1_000_000,
    )
  ) {
    throw new TypeError(`${label}.positionLdu must contain three bounded finite coordinates.`);
  }
}

function inspectPiece(value: unknown, label: string, copy: boolean): void {
  const piece = record(value, copy ? [...PIECE_KEYS, "sourceBrickRef"] : PIECE_KEYS, label);
  for (const [field, maximum] of [
    ["brickRef", 256],
    ["designId", 64],
    ["materialId", 64],
    ["catalogPartId", 256],
    ["colorId", 128],
  ] as const) {
    string(piece[field], `${label}.${field}`, maximum);
  }
  if (copy) string(piece.sourceBrickRef, `${label}.sourceBrickRef`, 256);
  if (piece.calloutKey !== null) {
    const key = string(piece.calloutKey, `${label}.calloutKey`, 512);
    if (!CALLOUT_KEY.test(key)) throw new TypeError(`${label}.calloutKey is not canonical.`);
  }
  if (
    piece.identificationConfidence !== "vision-kept" &&
    piece.identificationConfidence !== "pair-judged-same" &&
    piece.identificationConfidence !== "official-model"
  ) {
    throw new TypeError(`${label}.identificationConfidence is outside the frozen legacy /3 enum.`);
  }
  if (piece.cropDigest !== null) digest(piece.cropDigest, `${label}.cropDigest`);
  digest(piece.identificationInputDigest, `${label}.identificationInputDigest`);
  digest(piece.evidenceDigest, `${label}.evidenceDigest`);
  inspectTransform(piece.transform, `${label}.transform`);
}

function inspectStep(value: unknown, index: number): { direct: number; transition: number } {
  const label = `Legacy action ledger steps[${index}]`;
  const step = record(
    value,
    ["stepNumber", "pageNumber", "panelEvidenceDigest", "callouts", "action"],
    label,
  );
  whole(step.stepNumber, `${label}.stepNumber`, index + 1, index + 1);
  whole(step.pageNumber, `${label}.pageNumber`, 1, 10_000);
  digest(step.panelEvidenceDigest, `${label}.panelEvidenceDigest`);
  for (const [calloutIndex, rawCallout] of array(step.callouts, `${label}.callouts`).entries()) {
    const calloutLabel = `${label}.callouts[${calloutIndex}]`;
    const callout = record(
      rawCallout,
      ["calloutKey", "physicalBrickRefs", "semanticMultiplierQuantity"],
      calloutLabel,
    );
    const key = string(callout.calloutKey, `${calloutLabel}.calloutKey`, 512);
    if (!CALLOUT_KEY.test(key)) throw new TypeError(`${calloutLabel}.calloutKey is not canonical.`);
    const refs = array(callout.physicalBrickRefs, `${calloutLabel}.physicalBrickRefs`).map(
      (ref, refIndex) => string(ref, `${calloutLabel}.physicalBrickRefs[${refIndex}]`, 256),
    );
    if (new Set(refs).size !== refs.length) {
      throw new TypeError(`${calloutLabel}.physicalBrickRefs must be unique.`);
    }
    whole(
      callout.semanticMultiplierQuantity,
      `${calloutLabel}.semanticMultiplierQuantity`,
      0,
      10_000,
    );
  }
  if (typeof step.action !== "object" || step.action === null || Array.isArray(step.action)) {
    throw new TypeError(`${label}.action must be a legacy /3 JSON object.`);
  }
  const action = step.action as Record<string, unknown>;
  if (action.kind === "place-callouts") {
    record(action, ["kind", "pieces", "omittedPieces"], `${label}.action`);
    const pieces = array(action.pieces, `${label}.action.pieces`);
    pieces.forEach((piece, pieceIndex) =>
      inspectPiece(piece, `${label}.action.pieces[${pieceIndex}]`, false),
    );
    array(action.omittedPieces, `${label}.action.omittedPieces`).forEach((piece, pieceIndex) =>
      inspectPiece(piece, `${label}.action.omittedPieces[${pieceIndex}]`, false),
    );
    return { direct: pieces.length, transition: 0 };
  }
  if (action.kind === "multi-build-copy") {
    record(action, ["kind", "sourceStepNumber", "copies"], `${label}.action`);
    whole(action.sourceStepNumber, `${label}.action.sourceStepNumber`, 1, index);
    array(action.copies, `${label}.action.copies`).forEach((piece, pieceIndex) =>
      inspectPiece(piece, `${label}.action.copies[${pieceIndex}]`, true),
    );
    return { direct: 0, transition: 0 };
  }
  if (action.kind === "transition") {
    record(action, ["kind", "transition", "classificationEvidenceDigest"], `${label}.action`);
    if (
      action.transition !== "rotation" &&
      action.transition !== "attachment" &&
      action.transition !== "final-view"
    ) {
      throw new TypeError(`${label}.action.transition is outside the frozen legacy /3 enum.`);
    }
    digest(action.classificationEvidenceDigest, `${label}.action.classificationEvidenceDigest`);
    return { direct: 0, transition: 1 };
  }
  throw new TypeError(`${label}.action.kind is outside the frozen legacy /3 action union.`);
}

/**
 * Admits canonical retained `/3` bytes for inspection only.
 *
 * This API returns the original `/3` object and never adds `/4` fields, upgrades
 * a confidence, or grants current publication/execution authority.
 */
export function admitCanonicalLegacyRealBuildActionLedgerV3Bytes(input: {
  readonly bytes: Uint8Array;
  readonly label: string;
}): LegacyRealBuildActionLedgerV3 {
  const bytes = snapshotHostileUint8Array(input.bytes, {
    maximumBytes: MAXIMUM_BYTES,
    typeError: `${input.label} must be a genuine Uint8Array of frozen legacy /3 UTF-8 JSON bytes.`,
    oversizeError: (length) =>
      `${input.label} contains ${length} bytes, exceeding the ${MAXIMUM_BYTES}-byte legacy ledger limit.`,
    sharedError: `${input.label} must not use concurrently mutable shared storage.`,
    copyError: `${input.label} changed or detached during bounded byte copying.`,
  });
  let parsed: unknown;
  try {
    parsed = parseStrictJsonBytes(bytes);
  } catch {
    throw new TypeError(`${input.label} must be duplicate-free finite legacy /3 UTF-8 JSON.`);
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).schemaVersion !== LEGACY_REAL_BUILD_ACTION_LEDGER_V3_SCHEMA
  ) {
    throw new TypeError(
      `${input.label} must use frozen ${LEGACY_REAL_BUILD_ACTION_LEDGER_V3_SCHEMA}; current /4 bytes belong to current admission.`,
    );
  }
  const ledger = record(parsed, TOP_KEYS, input.label);
  for (const field of [
    "pdfDigest",
    "officialModelDigest",
    "coverageDigest",
    "calloutManifestDigest",
    "builderCalibrationDigest",
    TRANSITION_CLASSIFICATIONS_DIGEST_FIELD,
  ]) {
    digest(ledger[field], `${input.label}.${field}`);
  }
  const steps = array(ledger.steps, `${input.label}.steps`, 359);
  if (steps.length < 1)
    throw new TypeError(`${input.label}.steps must retain a nonempty /3 prefix.`);
  let directPieceCount = 0;
  let transitionStepCount = 0;
  steps.forEach((step, index) => {
    const counts = inspectStep(step, index);
    directPieceCount += counts.direct;
    transitionStepCount += counts.transition;
  });
  const provenance = record(ledger.provenance, PROVENANCE_KEYS, `${input.label}.provenance`);
  if (
    provenance.generator !== "apps/web/e2e/real-build-action-ledger.spec.ts" ||
    provenance.authenticated !== false ||
    provenance.expectedPrintedSteps !== 359
  ) {
    throw new TypeError(
      `${input.label}.provenance must retain the frozen generator, authenticated=false, and expectedPrintedSteps=359.`,
    );
  }
  const requestedLastStep = whole(
    provenance.requestedLastStep,
    `${input.label}.provenance.requestedLastStep`,
    1,
    359,
  );
  whole(
    provenance.alignedThroughStep,
    `${input.label}.provenance.alignedThroughStep`,
    steps.length,
    steps.length,
  );
  if (steps.length > requestedLastStep) {
    throw new TypeError(`${input.label}.steps crosses its frozen requestedLastStep.`);
  }
  string(provenance.stopReason, `${input.label}.provenance.stopReason`, 16_384);
  whole(
    provenance.directPieceCount,
    `${input.label}.provenance.directPieceCount`,
    directPieceCount,
    directPieceCount,
  );
  whole(
    provenance.transitionStepCount,
    `${input.label}.provenance.transitionStepCount`,
    transitionStepCount,
    transitionStepCount,
  );
  array(provenance.refusals, `${input.label}.provenance.refusals`).forEach((rawRefusal, index) => {
    const label = `${input.label}.provenance.refusals[${index}]`;
    const refusal = record(rawRefusal, ["stepNumber", "calloutKey", "brickRef", "reason"], label);
    whole(refusal.stepNumber, `${label}.stepNumber`, 1, requestedLastStep);
    if (refusal.calloutKey !== null) string(refusal.calloutKey, `${label}.calloutKey`, 512);
    if (refusal.brickRef !== null) string(refusal.brickRef, `${label}.brickRef`, 256);
    string(refusal.reason, `${label}.reason`, 16_384);
  });
  const canonical = Buffer.from(`${JSON.stringify(parsed, null, 1)}\n`, "utf8");
  if (!canonical.equals(Buffer.from(bytes))) {
    throw new TypeError(`${input.label} is not the exact canonical frozen legacy /3 encoding.`);
  }
  return parsed as LegacyRealBuildActionLedgerV3;
}
