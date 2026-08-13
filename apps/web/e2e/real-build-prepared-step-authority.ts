import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { preflightRealBuildOptions } from "./real-build-contract";
import { snapshotRealBuildRunInput } from "./real-build-run-input-snapshot";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";

export const MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_PREPARED_STEP_PIECES = 1_024;
const MAXIMUM_PREPARED_RUN_JSON_DEPTH = 128;
const MAXIMUM_PREPARED_RUN_JSON_NODES = 2_000_000;

declare const preparedStepAuthorityType: unique symbol;

export interface RealBuildPreparedAtomicPiece {
  readonly identityKey: string;
  readonly catalogPartId: string;
  readonly colorId: string;
}

export interface RealBuildPreparedStepCompilerMetadata {
  readonly name: string;
  readonly sourceActionDigest: Sha256Digest;
}

export interface RealBuildPreparedStepAuthority {
  readonly stepNumber: number;
  readonly preparedRunInputDigest: Sha256Digest;
  readonly printedStepIdentity: Sha256Digest;
  readonly compilerMetadata: RealBuildPreparedStepCompilerMetadata;
  readonly expectedAtomicPieces: readonly RealBuildPreparedAtomicPiece[];
  readonly [preparedStepAuthorityType]: true;
}

/** Bounded inspection only. This value cannot authorize placement or budget use. */
export type RealBuildPreparedStepInspection = Readonly<{
  stepNumber: number;
  preparedRunInputDigest: Sha256Digest;
  printedStepIdentity: Sha256Digest;
  compilerMetadata: RealBuildPreparedStepCompilerMetadata;
  expectedAtomicPieces: readonly RealBuildPreparedAtomicPiece[];
  authority: "absent";
}>;

export type RealBuildPreparedObservationPolicyInspection = Readonly<{
  preparedRunInputDigest: Sha256Digest;
  minimumScore: number;
  minimumMargin: number;
  authority: "absent";
}>;

const preparedSteps = new WeakSet<object>();
const inspections = new WeakSet<object>();
const observationPolicies = new WeakSet<object>();

function snapshotWireBytes(value: unknown): Uint8Array {
  return snapshotHostileUint8Array(value, {
    maximumBytes: MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES,
    typeError: "Prepared run input must be a genuine Uint8Array of UTF-8 JSON bytes.",
    oversizeError: (length) =>
      `Prepared run input contains ${length} bytes, exceeding ${MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES}; no text was decoded or parsed.`,
    sharedError: "Prepared run input must not use concurrently mutable shared storage.",
    copyError: "Prepared run input changed or detached during bounded byte copying.",
  });
}

function requireBoundedJsonStructure(text: string): void {
  let depth = 0;
  let nodes = 1;
  let inString = false;
  let escaped = false;
  for (const character of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{" || character === "[") {
      depth += 1;
      nodes += 1;
      if (depth > MAXIMUM_PREPARED_RUN_JSON_DEPTH) {
        throw new RangeError(
          `Prepared run input JSON exceeds depth ${MAXIMUM_PREPARED_RUN_JSON_DEPTH}; it was not parsed.`,
        );
      }
    } else if (character === "}" || character === "]") depth -= 1;
    else if (character === ",") nodes += 1;
    if (nodes > MAXIMUM_PREPARED_RUN_JSON_NODES) {
      throw new RangeError(
        `Prepared run input JSON exceeds ${MAXIMUM_PREPARED_RUN_JSON_NODES} structural values; it was not parsed. Remove unknown expansion or split the retained input at its declared run boundary.`,
      );
    }
    if (depth < 0) throw new TypeError("Prepared run input JSON has unbalanced containers.");
  }
  if (inString || depth !== 0) {
    throw new TypeError("Prepared run input JSON has an unterminated string or container.");
  }
}

function parsePreparedRunInput(value: unknown): {
  readonly options: RealBuildOptions;
  readonly canonical: string;
} {
  const bytes = snapshotWireBytes(value);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError("Prepared run input is not well-formed UTF-8.");
  }
  requireBoundedJsonStructure(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError("Prepared run input is not valid JSON.");
  }
  let snapshot: ReturnType<typeof snapshotRealBuildRunInput>;
  try {
    snapshot = snapshotRealBuildRunInput(parsed as RealBuildOptions);
  } catch {
    throw new TypeError("Prepared run input is not bounded detached real-build option data.");
  }
  let failures: ReturnType<typeof preflightRealBuildOptions>;
  try {
    failures = preflightRealBuildOptions(snapshot.options);
  } catch {
    throw new TypeError("Prepared run input does not have the complete real-build option shape.");
  }
  if (failures.length > 0) {
    const first = failures[0]!;
    throw new TypeError(
      `Prepared run input failed deterministic preflight with ${first.code} at ${first.stage}; no step authority was created.`,
    );
  }
  return { options: snapshot.options, canonical: snapshot.canonical };
}

function requirePreparedPanel(panel: RealBuildPanelSpec, stepNumber: number): void {
  if (panel.action.kind !== "place-callouts") {
    throw new TypeError(
      `Prepared step ${stepNumber} uses ${panel.action.kind}; this authority currently admits only exact place-callouts steps.`,
    );
  }
  if (panel.panelFace === null) {
    throw new TypeError(
      `Prepared step ${stepNumber} has no booklet-derived panel face; placement search remains refused.`,
    );
  }
  if (
    panel.action.evidenceDigest === null ||
    !/^sha256:[0-9a-f]{64}$/u.test(panel.action.evidenceDigest)
  ) {
    throw new TypeError(
      `Prepared step ${stepNumber} requires one exact action evidence digest before compiler metadata can be derived.`,
    );
  }
  if (panel.pieces.length < 1 || panel.pieces.length > MAXIMUM_REAL_BUILD_PREPARED_STEP_PIECES) {
    throw new RangeError(
      `Prepared step ${stepNumber} declares ${panel.pieces.length} direct pieces; required 1 through ${MAXIMUM_REAL_BUILD_PREPARED_STEP_PIECES}.`,
    );
  }
  if (panel.omittedPieces.length !== 0 || panel.omittedPhysicalPieces !== 0) {
    throw new TypeError(
      `Prepared step ${stepNumber} includes omitted physical pieces; this search authority cannot silently reinterpret fixed-ledger placements as searched pieces.`,
    );
  }
  if (
    panel.coverageFailures.length !== 0 ||
    panel.missingDesigns.length !== 0 ||
    panel.unresolvedCallouts.length !== 0
  ) {
    throw new TypeError(
      `Prepared step ${stepNumber} retains unresolved coverage, catalog, or callout prerequisites; placement search remains refused.`,
    );
  }
}

/**
 * Inspects how a complete run input would bind one step. Successful authority
 * issuance intentionally has no public producer until PDF/action-ledger
 * preparation itself is nonforgeable; caller bytes cannot certify themselves.
 */
export function inspectRealBuildPreparedStepInput(
  preparedRunInputBytes: unknown,
  stepNumber: unknown,
): RealBuildPreparedStepInspection {
  if (
    !Number.isSafeInteger(stepNumber) ||
    (stepNumber as number) < 1 ||
    (stepNumber as number) > 359
  ) {
    throw new RangeError("Prepared step number must be a safe integer from 1 through 359.");
  }
  const prepared = parsePreparedRunInput(preparedRunInputBytes);
  if ((stepNumber as number) > prepared.options.lastStep) {
    throw new RangeError(
      `Prepared step ${String(stepNumber)} lies beyond requested lastStep ${prepared.options.lastStep}.`,
    );
  }
  const panel = prepared.options.panels.find(
    ({ stepNumber: candidate }) => candidate === stepNumber,
  );
  if (panel === undefined) {
    throw new TypeError(
      `Prepared run input has no exact panel for printed step ${String(stepNumber)}.`,
    );
  }
  requirePreparedPanel(panel, stepNumber as number);
  const preparedRunInputDigest = canonicalDigest({
    schemaVersion: "lego.real-build-prepared-run-input/1",
    canonicalRunInput: prepared.canonical,
  });
  const printedStepIdentity = canonicalDigest({
    schemaVersion: "lego.real-build-prepared-step/1",
    preparedRunInputDigest,
    panel,
  });
  const expectedAtomicPieces = Object.freeze(
    panel.pieces.map(({ identityKey, catalogPartId, colorId }) =>
      Object.freeze({ identityKey, catalogPartId, colorId }),
    ),
  );
  const compilerMetadata = Object.freeze({
    name: `Printed step ${String(stepNumber)}`,
    sourceActionDigest: panel.action.evidenceDigest as Sha256Digest,
  });
  const inspection = Object.freeze({
    stepNumber: stepNumber as number,
    preparedRunInputDigest,
    printedStepIdentity,
    compilerMetadata,
    expectedAtomicPieces,
    authority: "absent",
  });
  inspections.add(inspection);
  return inspection;
}

/** Bounded inspection of the exact thresholds committed by prepared run input bytes. */
export function inspectRealBuildPreparedObservationPolicy(
  preparedRunInputBytes: unknown,
): RealBuildPreparedObservationPolicyInspection {
  const prepared = parsePreparedRunInput(preparedRunInputBytes);
  if (
    !Number.isFinite(prepared.options.minimumDeferredAgreement) ||
    prepared.options.minimumDeferredAgreement <= 0 ||
    prepared.options.minimumDeferredAgreement > 1 ||
    !Number.isFinite(prepared.options.minimumDeferredAgreementMargin) ||
    prepared.options.minimumDeferredAgreementMargin < 0 ||
    prepared.options.minimumDeferredAgreementMargin > 1
  ) {
    throw new RangeError(
      "Prepared observation policy requires finite unit-interval minimumDeferredAgreement and minimumDeferredAgreementMargin values.",
    );
  }
  const inspection = Object.freeze({
    preparedRunInputDigest: canonicalDigest({
      schemaVersion: "lego.real-build-prepared-run-input/1",
      canonicalRunInput: prepared.canonical,
    }),
    minimumScore: prepared.options.minimumDeferredAgreement,
    minimumMargin: prepared.options.minimumDeferredAgreementMargin,
    authority: "absent" as const,
  });
  observationPolicies.add(inspection);
  return inspection;
}

export function requireRealBuildPreparedObservationPolicyInspection(
  value: unknown,
): RealBuildPreparedObservationPolicyInspection {
  if (value === null || typeof value !== "object" || !observationPolicies.has(value)) {
    throw new TypeError(
      "Prepared observation policy must be the exact non-authoritative result of bounded run-input inspection.",
    );
  }
  return value as RealBuildPreparedObservationPolicyInspection;
}

export function requireRealBuildPreparedStepInspection(
  value: unknown,
): RealBuildPreparedStepInspection {
  if (value === null || typeof value !== "object" || !inspections.has(value)) {
    throw new TypeError(
      "Prepared step inspection must be the exact non-authoritative result of bounded run-input inspection.",
    );
  }
  return value as RealBuildPreparedStepInspection;
}

export function requireRealBuildPreparedStepAuthority(
  value: unknown,
  stepNumber?: number,
): RealBuildPreparedStepAuthority {
  if (
    value === null ||
    typeof value !== "object" ||
    !preparedSteps.has(value) ||
    (stepNumber !== undefined &&
      (value as RealBuildPreparedStepAuthority).stepNumber !== stepNumber)
  ) {
    throw new TypeError(
      "Prepared step authority must be the exact private result of bounded run-input preflight.",
    );
  }
  return value as RealBuildPreparedStepAuthority;
}
