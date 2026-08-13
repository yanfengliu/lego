import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildStepAction } from "./real-build-safety";

const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const MAXIMUM_FIT_FAILURE_LENGTH = 4_096;
const MAXIMUM_CANONICAL_RUN_INPUT_BYTES = 16 * 1024 * 1024;
const MAXIMUM_RASTER_PIXELS = 16_777_216;

export interface RealBuildProvisionalRunPreparationFacts {
  readonly schemaVersion: "lego.real-build-provisional-run-preparation/1";
  readonly preparationIdentity: Sha256Digest;
  readonly preparedRunInputDigest: Sha256Digest;
  readonly browserContractDigest: Sha256Digest;
  readonly sourceClosureDigest: Sha256Digest;
  readonly moduleRequestDigest: Sha256Digest;
  readonly fetchedPdfDigest: Sha256Digest;
}

export interface RealBuildProvisionalStepPreparationFacts {
  readonly schemaVersion: "lego.real-build-provisional-step-preparation/1";
  readonly runPreparationIdentity: Sha256Digest;
  readonly preparedRunInputDigest: Sha256Digest;
  readonly printedStepIdentity: Sha256Digest;
  readonly panelDigest: Sha256Digest;
  readonly actionDigest: Sha256Digest;
  readonly piecePlanDigest: Sha256Digest;
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly panelFace: "studs-up" | "underside";
  readonly actionKind: RealBuildStepAction["kind"];
  readonly actionEvidenceDigest: Sha256Digest | null;
  readonly cropDigest: Sha256Digest;
  readonly rasterWidth: number;
  readonly rasterHeight: number;
  readonly workPixelsDigest: Sha256Digest;
  readonly builtMaskDigest: Sha256Digest;
  readonly fitDigest: Sha256Digest;
}

export interface RealBuildProvisionalFitScalars {
  readonly azimuthDegrees: number | null;
  readonly elevationDegrees: number | null;
  readonly pixelsPerUnit: number | null;
  readonly residualPx: number | null;
  readonly upSign: 1 | -1 | null;
}

function digest(label: string, value: unknown): Sha256Digest {
  if (typeof value !== "string" || !SHA256_DIGEST.test(value)) {
    throw new TypeError(`${label} must be one exact lowercase SHA-256 digest.`);
  }
  return value as Sha256Digest;
}

/** Combines only fixed-size detached digests; it never reads caller-owned wrappers. */
export function deriveRealBuildProvisionalRunPreparationFacts(
  ...input: readonly [unknown, unknown, unknown, unknown, unknown]
): RealBuildProvisionalRunPreparationFacts {
  const [canonicalRunInput, attestationDigest, requests, expectedPdf, fetchedPdf] = input;
  if (
    typeof canonicalRunInput !== "string" ||
    canonicalRunInput.length > MAXIMUM_CANONICAL_RUN_INPUT_BYTES ||
    new TextEncoder().encode(canonicalRunInput).byteLength > MAXIMUM_CANONICAL_RUN_INPUT_BYTES
  ) {
    throw new RangeError(
      `Canonical run input must be a primitive UTF-8 string of at most ${MAXIMUM_CANONICAL_RUN_INPUT_BYTES} bytes.`,
    );
  }
  const expected = digest("Preflight PDF digest", expectedPdf);
  const fetched = digest("Fetched PDF digest", fetchedPdf);
  if (expected !== fetched) {
    throw new TypeError(
      `Fetched PDF digest ${JSON.stringify(fetched)} does not equal preflight digest ${JSON.stringify(expected)}.`,
    );
  }
  const preparedRunInputDigest = canonicalDigest({
    schemaVersion: "lego.real-build-prepared-run-input/1",
    canonicalRunInput,
  });
  const moduleRequestDigest = digest("Module request digest", requests);
  const facts = {
    schemaVersion: "lego.real-build-provisional-run-preparation/1",
    preparedRunInputDigest,
    browserContractDigest: canonicalDigest({
      schemaVersion: "lego.real-build-browser-provisional-contract/1",
      preparedRunInputDigest,
    }),
    sourceClosureDigest: canonicalDigest({
      schemaVersion: "lego.real-build-browser-source-closure/1",
      attestationDigest: digest("Source attestation digest", attestationDigest),
      moduleRequestDigest,
    }),
    moduleRequestDigest,
    fetchedPdfDigest: fetched,
  } as const;
  return Object.freeze({
    ...facts,
    preparationIdentity: canonicalDigest({
      schemaVersion: "lego.real-build-provisional-run-preparation-identity/1",
      preparationFacts: facts,
    }),
  });
}

function safeInteger(label: string, value: unknown, minimum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be a safe integer of at least ${minimum}.`);
  }
  return value;
}

function finite(label: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
  return value;
}

/** Reads only own data descriptors; accessors and toJSON are never executed. */
export function snapshotRealBuildProvisionalFitScalars(
  value: unknown,
): RealBuildProvisionalFitScalars {
  if (value === null) {
    return Object.freeze({
      azimuthDegrees: null,
      elevationDegrees: null,
      pixelsPerUnit: null,
      residualPx: null,
      upSign: null,
    });
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("A provisional panel fit must be null or an object of own data fields.");
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new TypeError("A provisional panel fit refused bounded own-data inspection.");
  }
  const scalar = (key: keyof Omit<RealBuildProvisionalFitScalars, "upSign">): number => {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`A provisional panel fit requires own data field ${key}.`);
    }
    return finite(`Panel fit ${key}`, descriptor.value);
  };
  const upSignDescriptor = descriptors.upSign;
  if (
    upSignDescriptor !== undefined &&
    (!("value" in upSignDescriptor) ||
      (upSignDescriptor.value !== 1 && upSignDescriptor.value !== -1))
  ) {
    throw new TypeError(
      "A provisional panel fit upSign must be absent or the own data value 1/-1.",
    );
  }
  return Object.freeze({
    azimuthDegrees: scalar("azimuthDegrees"),
    elevationDegrees: scalar("elevationDegrees"),
    pixelsPerUnit: scalar("pixelsPerUnit"),
    residualPx: scalar("residualPx"),
    upSign: (upSignDescriptor?.value as 1 | -1 | undefined) ?? null,
  });
}

/**
 * Derives data-only step commitments from positional primitives. The caller
 * cannot supply an object for this function to traverse, stringify, or brand.
 */
export function deriveRealBuildProvisionalStepPreparationFacts(
  ...input: readonly [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
): RealBuildProvisionalStepPreparationFacts {
  const [
    runPreparationIdentity,
    preparedRunInputDigest,
    fetchedPdfDigest,
    panelDigest,
    actionDigest,
    piecePlanDigest,
    stepNumberValue,
    pageNumberValue,
    panelFace,
    actionKind,
    actionEvidenceDigestValue,
    minXPtValue,
    maxXPtValue,
    minYPtValue,
    maxYPtValue,
    widthValue,
    heightValue,
    workPixelsLengthValue,
    builtMaskLengthValue,
    workPixelsDigest,
    builtMaskDigest,
    azimuthDegreesValue,
    elevationDegreesValue,
    pixelsPerUnitValue,
    residualPxValue,
    upSignValue,
    fitFailure,
    fitCoherenceValue,
  ] = input;
  const stepNumber = safeInteger("Printed step number", stepNumberValue, 1);
  const pageNumber = safeInteger("Booklet page number", pageNumberValue, 1);
  if (panelFace !== "studs-up" && panelFace !== "underside") {
    throw new TypeError(`Printed step ${stepNumber} requires an exact non-null panel face.`);
  }
  if (
    actionKind !== "place-callouts" &&
    actionKind !== "multi-build-copy" &&
    actionKind !== "transition"
  ) {
    throw new TypeError(`Printed step ${stepNumber} requires a known action kind.`);
  }
  const actionEvidenceDigest =
    actionEvidenceDigestValue === null
      ? null
      : digest("Action evidence digest", actionEvidenceDigestValue);
  const minXPt = finite("Panel crop minXPt", minXPtValue);
  const maxXPt = finite("Panel crop maxXPt", maxXPtValue);
  const minYPt = finite("Panel crop minYPt", minYPtValue);
  const maxYPt = finite("Panel crop maxYPt", maxYPtValue);
  if (maxXPt <= minXPt || maxYPt <= minYPt) {
    throw new RangeError(
      `Printed step ${stepNumber} panel crop must have positive width and height.`,
    );
  }
  const rasterWidth = safeInteger("Work-raster width", widthValue, 1);
  const rasterHeight = safeInteger("Work-raster height", heightValue, 1);
  const rasterPixels = rasterWidth * rasterHeight;
  if (!Number.isSafeInteger(rasterPixels) || rasterPixels > MAXIMUM_RASTER_PIXELS) {
    throw new RangeError(
      `Printed step ${stepNumber} work-raster area must not exceed ${MAXIMUM_RASTER_PIXELS} pixels.`,
    );
  }
  const workPixelsLength = safeInteger("RGBA work-raster length", workPixelsLengthValue, 1);
  const builtMaskLength = safeInteger("Built-mask length", builtMaskLengthValue, 1);
  if (workPixelsLength !== rasterPixels * 4 || builtMaskLength !== rasterPixels) {
    throw new RangeError(
      `Printed step ${stepNumber} raster lengths ${workPixelsLength}/${builtMaskLength} do not match ${rasterWidth}x${rasterHeight} RGBA/mask semantics.`,
    );
  }
  const fitValues = [
    azimuthDegreesValue,
    elevationDegreesValue,
    pixelsPerUnitValue,
    residualPxValue,
  ];
  const fitAbsent = fitValues.every((value) => value === null);
  if (
    !fitAbsent &&
    fitValues.some((value) => typeof value !== "number" || !Number.isFinite(value))
  ) {
    throw new RangeError(
      `Printed step ${stepNumber} fit must be wholly absent or four finite scalars.`,
    );
  }
  if (!fitAbsent && ((pixelsPerUnitValue as number) <= 0 || (residualPxValue as number) < 0)) {
    throw new RangeError(
      `Printed step ${stepNumber} fit scale must be positive and residual non-negative.`,
    );
  }
  if (upSignValue !== null && upSignValue !== 1 && upSignValue !== -1) {
    throw new RangeError(`Printed step ${stepNumber} fit upSign must be null, 1, or -1.`);
  }
  if (fitAbsent && upSignValue !== null) {
    throw new RangeError(`Printed step ${stepNumber} cannot bind a fit upSign without a fit.`);
  }
  if (
    fitFailure !== null &&
    (typeof fitFailure !== "string" || fitFailure.length > MAXIMUM_FIT_FAILURE_LENGTH)
  ) {
    throw new RangeError(
      `Printed step ${stepNumber} fit failure must be null or at most ${MAXIMUM_FIT_FAILURE_LENGTH} characters.`,
    );
  }
  const fitCoherence = finite("Panel fit coherence", fitCoherenceValue);
  if (fitCoherence < 0 || fitCoherence > 1) {
    throw new RangeError(
      `Printed step ${stepNumber} fit coherence must lie from zero through one.`,
    );
  }
  const cropDigest = canonicalDigest({ minXPt, maxXPt, minYPt, maxYPt });
  const fitDigest = canonicalDigest({
    azimuthDegrees: fitAbsent ? null : azimuthDegreesValue,
    elevationDegrees: fitAbsent ? null : elevationDegreesValue,
    pixelsPerUnit: fitAbsent ? null : pixelsPerUnitValue,
    residualPx: fitAbsent ? null : residualPxValue,
    upSign: upSignValue,
    fitFailure,
    fitCoherence,
    panelFace,
  });
  const facts = {
    schemaVersion: "lego.real-build-provisional-step-preparation/1" as const,
    runPreparationIdentity: digest("Provisional run preparation identity", runPreparationIdentity),
    preparedRunInputDigest: digest("Prepared run input digest", preparedRunInputDigest),
    panelDigest: digest("Panel digest", panelDigest),
    actionDigest: digest("Action digest", actionDigest),
    piecePlanDigest: digest("Piece-plan digest", piecePlanDigest),
    stepNumber,
    pageNumber,
    panelFace,
    actionKind,
    actionEvidenceDigest,
    cropDigest,
    rasterWidth,
    rasterHeight,
    workPixelsDigest: digest("Work-pixel digest", workPixelsDigest),
    builtMaskDigest: digest("Built-mask digest", builtMaskDigest),
    fitDigest,
  } satisfies Omit<RealBuildProvisionalStepPreparationFacts, "printedStepIdentity">;
  return Object.freeze({
    ...facts,
    printedStepIdentity: canonicalDigest({
      schemaVersion: "lego.real-build-provisional-prepared-step/1",
      fetchedPdfDigest: digest("Fetched PDF digest", fetchedPdfDigest),
      preparationFacts: facts,
    }),
  });
}
