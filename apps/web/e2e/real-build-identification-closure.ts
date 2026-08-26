import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { verifyBookletCatalogCoverageClosure } from "../../../scripts/booklet-catalog-coverage.mjs";
import { PartIdentificationArtifactBindingError } from "../../../scripts/part-identification-artifacts.mjs";
import { parseStrictJsonBytes } from "../../../scripts/part-identification-strict-json.mjs";
import { MAXIMUM_REAL_BUILD_PRINTED_STEPS } from "./real-build-artifact-policy";

const MAXIMUM_OBSERVED_STRING_CHARACTERS = 120;

function boundedObserved(value: unknown): string {
  try {
    if (typeof value === "string") {
      if (value.length <= MAXIMUM_OBSERVED_STRING_CHARACTERS) return JSON.stringify(value);
      const prefix = `${value.slice(0, MAXIMUM_OBSERVED_STRING_CHARACTERS - 3)}...`;
      return `${JSON.stringify(prefix)} (string length ${value.length})`;
    }
    if (typeof value === "bigint") return `${value}n`;
    if (value === null || typeof value !== "object") {
      return Object.is(value, -0) ? "-0" : String(value);
    }
    if (Array.isArray(value)) return `Array(length=${value.length})`;
    return `Object(keys=${Object.keys(value).length})`;
  } catch {
    return `<uninspectable ${value === null ? "null" : typeof value}>`;
  }
}

export interface RawJsonArtifact {
  readonly bytes: Uint8Array;
  readonly digest: string;
  readonly value: unknown;
}

export interface RawBinaryArtifact {
  readonly bytes: Uint8Array;
  readonly digest: string;
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** Constructs all JSON artifact fields from one retained byte sequence. */
export function rawJsonArtifactFromBytes(bytes: Uint8Array, label: string): RawJsonArtifact {
  let value: unknown;
  try {
    value = parseStrictJsonBytes(bytes);
  } catch (error) {
    throw new TypeError(
      `${label} retained bytes must be strict UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  return { bytes, digest: sha256(bytes), value };
}

function bindRawJsonArtifact(artifact: RawJsonArtifact, label: string): RawJsonArtifact {
  let value: unknown;
  try {
    value = parseStrictJsonBytes(artifact.bytes);
  } catch (error) {
    throw new TypeError(
      `${label} bytes must be strict UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  const digest = sha256(artifact.bytes);
  if (artifact.digest !== digest) {
    throw new TypeError(
      `${label} declares digest ${JSON.stringify(artifact.digest)}, but its bounded bytes hash to ${digest}.`,
    );
  }
  if (!isDeepStrictEqual(artifact.value, value)) {
    throw new TypeError(
      `${label} supplied value does not equal the value parsed from its bounded bytes; callers may not independently trust or replace parsed fields.`,
    );
  }
  return { bytes: artifact.bytes, digest, value };
}

function bindRawBinaryArtifact(artifact: RawBinaryArtifact, label: string): RawBinaryArtifact {
  if (!(artifact.bytes instanceof Uint8Array)) {
    throw new TypeError(`${label} must supply exact retained binary bytes.`);
  }
  const digest = sha256(artifact.bytes);
  if (artifact.digest !== digest) {
    throw new TypeError(
      `${label} declares digest ${JSON.stringify(artifact.digest)}, but its bounded bytes hash to ${digest}.`,
    );
  }
  return { bytes: artifact.bytes, digest };
}

interface CoverageDescriptor {
  readonly identification?: {
    readonly source?: unknown;
    readonly model?: unknown;
    readonly assignment?: unknown;
  };
  readonly lastStep?: unknown;
}

export type RealBuildIdentificationSource = "deterministic" | "adjudicated";

export interface RealBuildIdentificationMode {
  readonly source: RealBuildIdentificationSource;
  readonly model: string | null;
  readonly assignment: "nearest" | "one-to-one" | "quantity-informed";
  readonly lastStep: number;
}

export type RealBuildIdentificationInputRole = "identification-answers";

export class RealBuildIdentificationClosureError extends Error {
  readonly inputRole: RealBuildIdentificationInputRole;

  constructor(inputRole: RealBuildIdentificationInputRole, message: string, cause: Error) {
    super(message, { cause });
    this.name = "RealBuildIdentificationClosureError";
    this.inputRole = inputRole;
  }
}

export interface RealBuildIdentificationClosureInput {
  readonly coverage: RawJsonArtifact;
  readonly manifest: RawJsonArtifact;
  readonly features: RawJsonArtifact;
  readonly match: RawJsonArtifact;
  readonly distances: RawJsonArtifact;
  readonly cards?: RawJsonArtifact | null;
  readonly cardImages?: RawBinaryArtifact | null;
  readonly answers?: RawJsonArtifact | null;
  /** Filesystem root for retained content-addressed call proofs and answer checkpoints. */
  readonly traceRoot?: string | null;
  /** Exact in-memory trace bytes used by replay-only and synthetic closures. */
  readonly traceArtifacts?: Readonly<Record<string, Uint8Array>> | null;
  readonly elementResolution: RawJsonArtifact;
  /**
   * The retained blind pair-judging verdicts. Mandatory in both identification
   * modes: the verdicts are a trust source of their own, so a closure that could
   * be recompiled without them would be a closure in which dropping the trust
   * source leaves no trace in the coverage bytes.
   */
  readonly pairJudged: RawJsonArtifact;
  readonly requestedLastStep: number;
}

function describeCoverageMode(
  coverageArtifact: RawJsonArtifact,
  requestedLastStep: number,
): RealBuildIdentificationMode {
  if (
    !Number.isSafeInteger(requestedLastStep) ||
    requestedLastStep < 1 ||
    requestedLastStep > MAXIMUM_REAL_BUILD_PRINTED_STEPS
  ) {
    throw new RangeError(
      `Requested identification prefix must be a safe integer from 1 through ${MAXIMUM_REAL_BUILD_PRINTED_STEPS}; received ${boundedObserved(requestedLastStep)}. Request a real printed-booklet prefix.`,
    );
  }
  const coverage = coverageArtifact.value as CoverageDescriptor;
  const source = coverage.identification?.source;
  const model = coverage.identification?.model;
  const assignment = coverage.identification?.assignment;
  const lastStep = coverage.lastStep;
  if (
    (source !== "deterministic" && source !== "adjudicated") ||
    (source === "deterministic" ? model !== null : typeof model !== "string") ||
    (assignment !== "nearest" &&
      assignment !== "one-to-one" &&
      assignment !== "quantity-informed") ||
    !Number.isSafeInteger(lastStep) ||
    (lastStep as number) < 1 ||
    (lastStep as number) > MAXIMUM_REAL_BUILD_PRINTED_STEPS ||
    lastStep !== requestedLastStep
  ) {
    throw new TypeError(
      `Coverage must declare a deterministic/adjudicated source, compatible model, supported assignment, ` +
        `and the exact requested compiled prefix ${requestedLastStep}; broader or shorter coverage cannot ` +
        `supply identity authority for this run. ` +
        `received source=${boundedObserved(source)}, model=${boundedObserved(model)}, ` +
        `assignment=${boundedObserved(assignment)}, lastStep=${boundedObserved(lastStep)}.`,
    );
  }
  return {
    source,
    model: model as string | null,
    assignment,
    lastStep: lastStep as number,
  };
}

/** Selects conditional input roles from the exact bounded coverage bytes, without consulting outputs. */
export function identifyRealBuildIdentificationMode(
  coverage: RawJsonArtifact,
  requestedLastStep: number,
): RealBuildIdentificationMode {
  return describeCoverageMode(bindRawJsonArtifact(coverage, "Catalog coverage"), requestedLastStep);
}

export function prepareRealBuildIdentificationClosure(input: RealBuildIdentificationClosureInput) {
  const coverageArtifact = bindRawJsonArtifact(input.coverage, "Catalog coverage");
  const manifestArtifact = bindRawJsonArtifact(input.manifest, "Callout manifest");
  const featuresArtifact = bindRawJsonArtifact(input.features, "Identification features");
  const matchArtifact = bindRawJsonArtifact(input.match, "Identification match");
  const distancesArtifact = bindRawJsonArtifact(input.distances, "Identification distances");
  const elementResolutionArtifact = bindRawJsonArtifact(
    input.elementResolution,
    "Element resolution",
  );
  const pairJudgedArtifact = bindRawJsonArtifact(input.pairJudged, "Pair-judged truth");
  const mode = describeCoverageMode(coverageArtifact, input.requestedLastStep);
  if (
    mode.source === "adjudicated" &&
    (input.cards == null || input.cardImages == null || input.answers == null)
  ) {
    throw new TypeError(
      "Adjudicated coverage requires exact retained identification-card manifest, card-image bundle, and answer bytes across all three roles; regenerate or retain every role.",
    );
  }
  if (
    mode.source === "deterministic" &&
    (input.cards != null ||
      input.cardImages != null ||
      input.answers != null ||
      input.traceRoot != null ||
      input.traceArtifacts != null)
  ) {
    throw new TypeError(
      "Deterministic coverage must omit adjudication card-manifest, card-image, and answer roles plus their proof trace; those bytes are neither read nor retained for deterministic replay.",
    );
  }
  const cardsArtifact =
    mode.source === "deterministic"
      ? null
      : bindRawJsonArtifact(input.cards!, "Identification cards");
  const cardImagesArtifact =
    mode.source === "deterministic"
      ? null
      : bindRawBinaryArtifact(input.cardImages!, "Identification card images");
  const answersArtifact =
    mode.source === "deterministic"
      ? null
      : bindRawJsonArtifact(input.answers!, "Identification answers");
  return {
    coverageBytes: coverageArtifact.bytes,
    manifestBytes: manifestArtifact.bytes,
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
    cardsArtifact,
    cardImagesArtifact,
    answersArtifact,
    traceRoot: mode.source === "deterministic" ? null : (input.traceRoot ?? null),
    traceArtifacts: mode.source === "deterministic" ? null : (input.traceArtifacts ?? null),
    pairJudgedArtifact,
    elementsArtifact: elementResolutionArtifact,
    source: mode.source,
    model: mode.model,
    assignment: mode.assignment,
    lastStep: mode.lastStep,
  };
}

export function attributeRealBuildIdentificationClosureError(error: unknown): Error {
  if (error instanceof PartIdentificationArtifactBindingError) {
    return new RealBuildIdentificationClosureError(
      "identification-answers",
      `The identification answers artifact does not bind the retained match/cards/prompt closure: ${error.message}`,
      error,
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** Recompiles coverage from every identity-bearing raw artifact before the browser can use it. */
export function verifyRealBuildIdentificationClosure(
  input: RealBuildIdentificationClosureInput,
): unknown {
  try {
    return verifyBookletCatalogCoverageClosure(prepareRealBuildIdentificationClosure(input));
  } catch (error) {
    throw attributeRealBuildIdentificationClosureError(error);
  }
}
