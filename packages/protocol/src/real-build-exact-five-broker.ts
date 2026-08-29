import type { ErrorObject, ValidateFunction } from "ajv";

import {
  validateRealBuildExactFiveBrokerChallengeV1 as generatedValidateChallenge,
  validateRealBuildExactFiveBrokerConsumptionReceiptV1 as generatedValidateReceipt,
} from "./generated/validators.generated.js";
import type {
  RealBuildExactFiveBrokerChallengeV1,
  RealBuildExactFiveBrokerConsumptionReceiptV1,
} from "./generated/public-types.generated.js";
import { safeDiagnosticValue } from "./safe-diagnostic-value.ts";

const STRUCTURED_CLONE = globalThis.structuredClone;
const OBJECT_KEYS = Object.keys;
const OBJECT_FREEZE = Object.freeze;
const ARRAY_IS_ARRAY = Array.isArray;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const NUMBER_IS_FINITE = Number.isFinite;
const NUMBER_MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

/** The signed receipt must be consumed and inspected inside this exact challenge interval. */
export const REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS = 2 * 60 * 1_000;

/**
 * A local validation input, not a wire artifact. `observedAtUnixMs` comes from the
 * consumer's clock and therefore must never be accepted from the signed receipt.
 */
export interface RealBuildExactFiveBrokerConsumptionExchangeV1 {
  readonly challenge: RealBuildExactFiveBrokerChallengeV1;
  readonly receipt: RealBuildExactFiveBrokerConsumptionReceiptV1;
  readonly observedAtUnixMs: number;
}

export interface RealBuildExactFiveBrokerConsumptionTimelineV1 {
  readonly issuedAtUnixMs: number;
  readonly consumedAtUnixMs: number;
  readonly inspectionStartedAtUnixMs: number;
  readonly inspectionFinishedAtUnixMs: number;
}

export interface RealBuildExactFiveBrokerMonotonicTimelineV1 {
  readonly issuedAtMonotonicMs: number;
  readonly inspectionStartedAtMonotonicMs: number;
  readonly inspectionFinishedAtMonotonicMs: number;
}

export interface RealBuildExactFiveBrokerConsumptionExchangeValidator {
  (value: unknown): boolean;
  errors: ErrorObject[] | null | undefined;
}

export interface RealBuildExactFiveBrokerConsumptionTimelineValidator {
  (value: unknown): boolean;
  errors: ErrorObject[] | null | undefined;
}

export interface RealBuildExactFiveBrokerMonotonicTimelineValidator {
  (value: unknown): boolean;
  errors: ErrorObject[] | null | undefined;
}

function semanticError(instancePath: string, message: string): ErrorObject {
  return {
    keyword: "semantic",
    instancePath,
    schemaPath: "#/semantic",
    params: {},
    message,
  };
}

function prefixedErrors(prefix: string, errors: readonly ErrorObject[] | null | undefined) {
  if (errors === null || errors === undefined) return [];
  const prefixed: ErrorObject[] = [];
  for (let index = 0; index < errors.length; index += 1) {
    const error = errors[index]!;
    prefixed[index] = { ...error, instancePath: `${prefix}${error.instancePath}` };
  }
  return prefixed;
}

function validationExpectation(error: ErrorObject): string {
  const params = error.params as Record<string, unknown>;
  if (error.keyword === "const") return `must equal ${safeDiagnosticValue(params.allowedValue)}`;
  if (error.keyword === "enum" && ARRAY_IS_ARRAY(params.allowedValues)) {
    let allowed = "";
    for (let index = 0; index < params.allowedValues.length; index += 1) {
      if (index > 0) allowed += ", ";
      allowed += safeDiagnosticValue(params.allowedValues[index]);
    }
    return `must be one of ${allowed}`;
  }
  if (error.keyword === "required" && typeof params.missingProperty === "string") {
    return `must include required property ${safeDiagnosticValue(params.missingProperty)}`;
  }
  if (error.keyword === "additionalProperties" && typeof params.additionalProperty === "string") {
    return `must not contain unsupported property ${safeDiagnosticValue(params.additionalProperty)}`;
  }
  if (error.keyword === "not") {
    return "must use one uninterrupted ASCII wire spelling with no CR, LF, vertical tab, form feed, NEL, Unicode line separator, or Unicode paragraph separator";
  }
  return error.message ?? "failed its schema or semantic requirement";
}

function validationFailure(
  label: string,
  errors: readonly ErrorObject[] | null | undefined,
  fallback: string,
): string {
  const error = errors?.[0];
  if (error === undefined) return fallback;
  const expectation = validationExpectation(error);
  return `${label} failed at ${error.instancePath || "/"}: ${expectation}${expectation[expectation.length - 1] === "." ? "" : "."}`;
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || ARRAY_IS_ARRAY(value)) return false;
  const keys = OBJECT_KEYS(value);
  if (keys.length !== expectedKeys.length) return false;
  for (let expectedIndex = 0; expectedIndex < expectedKeys.length; expectedIndex += 1) {
    let found = false;
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      if (keys[keyIndex] === expectedKeys[expectedIndex]) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

function exactExchangeRecord(
  value: unknown,
): value is Record<"challenge" | "receipt" | "observedAtUnixMs", unknown> {
  return exactRecord(value, ["challenge", "observedAtUnixMs", "receipt"]);
}

function timelineSemanticError(
  value: RealBuildExactFiveBrokerConsumptionTimelineV1,
): ErrorObject | null {
  const samples = [
    ["issuedAtUnixMs", value.issuedAtUnixMs],
    ["consumedAtUnixMs", value.consumedAtUnixMs],
    ["inspectionStartedAtUnixMs", value.inspectionStartedAtUnixMs],
    ["inspectionFinishedAtUnixMs", value.inspectionFinishedAtUnixMs],
  ] as const;
  for (let index = 0; index < samples.length; index += 1) {
    const sampleEntry = samples[index]!;
    const name = sampleEntry[0];
    const sample = sampleEntry[1];
    if (!NUMBER_IS_SAFE_INTEGER(sample) || sample < 0) {
      return semanticError(
        `/${name}`,
        `Exact-five broker ${name} must be one non-negative safe Unix-millisecond integer.`,
      );
    }
  }
  if (
    value.issuedAtUnixMs >
    NUMBER_MAX_SAFE_INTEGER - REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS
  ) {
    return semanticError(
      "/issuedAtUnixMs",
      `Exact-five broker challenge issuedAtUnixMs ${value.issuedAtUnixMs} cannot form a safe two-minute expiry; it must be no greater than ${NUMBER_MAX_SAFE_INTEGER - REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS}.`,
    );
  }
  const expiresAtUnixMs = value.issuedAtUnixMs + REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS;
  if (value.consumedAtUnixMs < value.issuedAtUnixMs) {
    return semanticError(
      "/consumedAtUnixMs",
      `Exact-five broker consumedAtUnixMs ${value.consumedAtUnixMs} precedes issuedAtUnixMs ${value.issuedAtUnixMs}; consumption must occur at or after issue.`,
    );
  }
  if (value.inspectionStartedAtUnixMs < value.consumedAtUnixMs) {
    return semanticError(
      "/inspectionStartedAtUnixMs",
      `Exact-five broker inspectionStartedAtUnixMs ${value.inspectionStartedAtUnixMs} precedes consumedAtUnixMs ${value.consumedAtUnixMs}; inspection must start at or after consumption.`,
    );
  }
  if (value.inspectionFinishedAtUnixMs < value.inspectionStartedAtUnixMs) {
    return semanticError(
      "/inspectionFinishedAtUnixMs",
      `Exact-five broker inspectionFinishedAtUnixMs ${value.inspectionFinishedAtUnixMs} precedes inspectionStartedAtUnixMs ${value.inspectionStartedAtUnixMs}; inspection must finish at or after it starts.`,
    );
  }
  if (value.inspectionFinishedAtUnixMs > expiresAtUnixMs) {
    return semanticError(
      "/inspectionFinishedAtUnixMs",
      `Exact-five broker inspectionFinishedAtUnixMs ${value.inspectionFinishedAtUnixMs} exceeds challenge expiry ${expiresAtUnixMs}; inspection must finish no later than expiry.`,
    );
  }
  return null;
}

function monotonicTimelineSemanticError(
  value: RealBuildExactFiveBrokerMonotonicTimelineV1,
): ErrorObject | null {
  const samples = [
    ["issuedAtMonotonicMs", value.issuedAtMonotonicMs],
    ["inspectionStartedAtMonotonicMs", value.inspectionStartedAtMonotonicMs],
    ["inspectionFinishedAtMonotonicMs", value.inspectionFinishedAtMonotonicMs],
  ] as const;
  for (let index = 0; index < samples.length; index += 1) {
    const sampleEntry = samples[index]!;
    const name = sampleEntry[0];
    const sample = sampleEntry[1];
    if (typeof sample !== "number" || !NUMBER_IS_FINITE(sample) || sample < 0) {
      return semanticError(
        `/${name}`,
        `Exact-five broker ${name} must be one finite non-negative monotonic-millisecond sample.`,
      );
    }
  }
  if (value.inspectionStartedAtMonotonicMs < value.issuedAtMonotonicMs) {
    return semanticError(
      "/inspectionStartedAtMonotonicMs",
      `Exact-five broker inspectionStartedAtMonotonicMs ${value.inspectionStartedAtMonotonicMs} precedes issuedAtMonotonicMs ${value.issuedAtMonotonicMs}; inspection must start at or after issue.`,
    );
  }
  if (value.inspectionFinishedAtMonotonicMs < value.inspectionStartedAtMonotonicMs) {
    return semanticError(
      "/inspectionFinishedAtMonotonicMs",
      `Exact-five broker ${"inspectionFinishedAtMonotonicMs"} ${value.inspectionFinishedAtMonotonicMs} precedes inspectionStartedAtMonotonicMs ${value.inspectionStartedAtMonotonicMs}; inspection must finish at or after it starts.`,
    );
  }
  const elapsedMs = value.inspectionFinishedAtMonotonicMs - value.issuedAtMonotonicMs;
  if (elapsedMs > REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS) {
    return semanticError(
      "/inspectionFinishedAtMonotonicMs",
      `Exact-five broker monotonic inspection elapsed ${elapsedMs} ms; it must finish within ${REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS} ms of issue.`,
    );
  }
  return null;
}

function exchangeSemanticError(
  value: RealBuildExactFiveBrokerConsumptionExchangeV1,
): ErrorObject | null {
  const { challenge, receipt, observedAtUnixMs } = value;
  const bindingError = (field: string, observed: string, expected: string): ErrorObject | null =>
    observed === expected
      ? null
      : semanticError(
          `/receipt/${field}`,
          field === "challengeNonce"
            ? "Exact-five broker receipt challengeNonce does not equal the live challenge nonce; it must reproduce the held 64-hex nonce exactly."
            : `Exact-five broker receipt ${field} ${safeDiagnosticValue(observed)} does not equal live challenge ${field} ${safeDiagnosticValue(expected)}.`,
        );
  const bindings = [
    ["namespace", receipt.namespace, challenge.namespace],
    ["purpose", receipt.purpose, challenge.purpose],
    ["scope", receipt.scope, challenge.scope],
    ["requestDigest", receipt.requestDigest, challenge.requestDigest],
    ["challengeNonce", receipt.challengeNonce, challenge.challengeNonce],
    [
      "reviewPresentationDigest",
      receipt.reviewPresentationDigest,
      challenge.reviewPresentationDigest,
    ],
  ] as const;
  for (let index = 0; index < bindings.length; index += 1) {
    const binding = bindings[index]!;
    const field = binding[0];
    const observed = binding[1];
    const expected = binding[2];
    const error = bindingError(field, observed, expected);
    if (error !== null) return error;
  }
  if (!NUMBER_IS_SAFE_INTEGER(observedAtUnixMs) || observedAtUnixMs < 0) {
    return semanticError(
      "/observedAtUnixMs",
      `Exact-five broker observedAtUnixMs ${safeDiagnosticValue(observedAtUnixMs)} must be one non-negative safe Unix-millisecond integer.`,
    );
  }
  const timelineError = timelineSemanticError({
    issuedAtUnixMs: challenge.issuedAtUnixMs,
    consumedAtUnixMs: receipt.consumedAtUnixMs,
    inspectionStartedAtUnixMs: observedAtUnixMs,
    inspectionFinishedAtUnixMs: observedAtUnixMs,
  });
  if (timelineError === null) return null;
  if (timelineError.instancePath === "/inspectionStartedAtUnixMs") {
    return semanticError(
      "/observedAtUnixMs",
      `Exact-five broker observedAtUnixMs ${observedAtUnixMs} precedes receipt consumedAtUnixMs ${receipt.consumedAtUnixMs}; the consumer clock sample must occur at or after consumption.`,
    );
  }
  if (timelineError.instancePath === "/inspectionFinishedAtUnixMs") {
    const expiresAtUnixMs =
      challenge.issuedAtUnixMs + REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS;
    return semanticError(
      "/observedAtUnixMs",
      `Exact-five broker observedAtUnixMs ${observedAtUnixMs} exceeds challenge expiry ${expiresAtUnixMs}; the consumer clock sample must occur no later than expiry.`,
    );
  }
  const pathMap: Readonly<Record<string, string>> = {
    "/issuedAtUnixMs": "/challenge/issuedAtUnixMs",
    "/consumedAtUnixMs": "/receipt/consumedAtUnixMs",
  };
  return { ...timelineError, instancePath: pathMap[timelineError.instancePath] ?? "" };
}

/**
 * Checks structural roots, cross-record binding, and pre-verification wall-clock
 * order relative to a caller-provided sample. It does not verify a signature,
 * held challenge identity, trust, ledger continuity, one use, or authority. Use
 * `parseRealBuildExactFiveBrokerConsumptionExchangeV1` when the detached result
 * will be consumed after validation.
 */
export const validateRealBuildExactFiveBrokerConsumptionExchangeV1 = ((value: unknown): boolean => {
  let detached: unknown;
  try {
    detached = STRUCTURED_CLONE(value);
  } catch {
    validateRealBuildExactFiveBrokerConsumptionExchangeV1.errors = [
      semanticError("", "Exact-five broker exchange must be detached structured-cloneable data."),
    ];
    return false;
  }
  if (!exactExchangeRecord(detached)) {
    validateRealBuildExactFiveBrokerConsumptionExchangeV1.errors = [
      semanticError(
        "",
        "Exact-five broker exchange must contain exactly challenge, receipt, and consumer-supplied observedAtUnixMs.",
      ),
    ];
    return false;
  }
  if (!generatedValidateChallenge(detached.challenge)) {
    validateRealBuildExactFiveBrokerConsumptionExchangeV1.errors = prefixedErrors(
      "/challenge",
      generatedValidateChallenge.errors,
    );
    return false;
  }
  if (!generatedValidateReceipt(detached.receipt)) {
    validateRealBuildExactFiveBrokerConsumptionExchangeV1.errors = prefixedErrors(
      "/receipt",
      generatedValidateReceipt.errors,
    );
    return false;
  }
  const error = exchangeSemanticError(
    detached as unknown as RealBuildExactFiveBrokerConsumptionExchangeV1,
  );
  validateRealBuildExactFiveBrokerConsumptionExchangeV1.errors = error === null ? null : [error];
  return error === null;
}) as RealBuildExactFiveBrokerConsumptionExchangeValidator;
validateRealBuildExactFiveBrokerConsumptionExchangeV1.errors = null;

/** Returns the exact detached exchange that was checked, never the caller's mutable object. */
export function parseRealBuildExactFiveBrokerConsumptionExchangeV1(
  value: unknown,
): Readonly<RealBuildExactFiveBrokerConsumptionExchangeV1> {
  let detached: unknown;
  try {
    detached = STRUCTURED_CLONE(value);
  } catch {
    throw new TypeError("Exact-five broker exchange must be detached structured-cloneable data.");
  }
  if (!validateRealBuildExactFiveBrokerConsumptionExchangeV1(detached)) {
    throw new TypeError(
      validationFailure(
        "Exact-five broker challenge/receipt exchange",
        validateRealBuildExactFiveBrokerConsumptionExchangeV1.errors,
        "Exact-five broker challenge/receipt exchange failed cross-record validation.",
      ),
    );
  }
  const exchange = detached as RealBuildExactFiveBrokerConsumptionExchangeV1;
  OBJECT_FREEZE(exchange.challenge);
  OBJECT_FREEZE(exchange.receipt.seal);
  OBJECT_FREEZE(exchange.receipt);
  return OBJECT_FREEZE(exchange);
}

export const validateRealBuildExactFiveBrokerConsumptionTimelineV1 = ((value: unknown): boolean => {
  let detached: unknown;
  try {
    detached = STRUCTURED_CLONE(value);
  } catch {
    validateRealBuildExactFiveBrokerConsumptionTimelineV1.errors = [
      semanticError("", "Exact-five broker timeline must be detached structured-cloneable data."),
    ];
    return false;
  }
  if (
    !exactRecord(detached, [
      "consumedAtUnixMs",
      "inspectionFinishedAtUnixMs",
      "inspectionStartedAtUnixMs",
      "issuedAtUnixMs",
    ])
  ) {
    validateRealBuildExactFiveBrokerConsumptionTimelineV1.errors = [
      semanticError("", "Exact-five broker timeline must contain exactly four clock samples."),
    ];
    return false;
  }
  const error = timelineSemanticError(
    detached as unknown as RealBuildExactFiveBrokerConsumptionTimelineV1,
  );
  validateRealBuildExactFiveBrokerConsumptionTimelineV1.errors = error === null ? null : [error];
  return error === null;
}) as RealBuildExactFiveBrokerConsumptionTimelineValidator;
validateRealBuildExactFiveBrokerConsumptionTimelineV1.errors = null;

export function assertRealBuildExactFiveBrokerConsumptionTimelineV1(value: unknown): void {
  if (validateRealBuildExactFiveBrokerConsumptionTimelineV1(value)) return;
  throw new TypeError(
    validationFailure(
      "Exact-five broker challenge timeline",
      validateRealBuildExactFiveBrokerConsumptionTimelineV1.errors,
      "Exact-five broker challenge timeline failed validation.",
    ),
  );
}

export const validateRealBuildExactFiveBrokerMonotonicTimelineV1 = ((value: unknown): boolean => {
  let detached: unknown;
  try {
    detached = STRUCTURED_CLONE(value);
  } catch {
    validateRealBuildExactFiveBrokerMonotonicTimelineV1.errors = [
      semanticError("", "Exact-five broker monotonic timeline must be structured-cloneable data."),
    ];
    return false;
  }
  if (
    !exactRecord(detached, [
      "inspectionFinishedAtMonotonicMs",
      "inspectionStartedAtMonotonicMs",
      "issuedAtMonotonicMs",
    ])
  ) {
    validateRealBuildExactFiveBrokerMonotonicTimelineV1.errors = [
      semanticError("", "Exact-five broker monotonic timeline must contain exactly three samples."),
    ];
    return false;
  }
  const error = monotonicTimelineSemanticError(
    detached as unknown as RealBuildExactFiveBrokerMonotonicTimelineV1,
  );
  validateRealBuildExactFiveBrokerMonotonicTimelineV1.errors = error === null ? null : [error];
  return error === null;
}) as RealBuildExactFiveBrokerMonotonicTimelineValidator;
validateRealBuildExactFiveBrokerMonotonicTimelineV1.errors = null;

export function assertRealBuildExactFiveBrokerMonotonicTimelineV1(value: unknown): void {
  if (validateRealBuildExactFiveBrokerMonotonicTimelineV1(value)) return;
  throw new TypeError(
    validationFailure(
      "Exact-five broker monotonic challenge timeline",
      validateRealBuildExactFiveBrokerMonotonicTimelineV1.errors,
      "Exact-five broker monotonic challenge timeline failed validation.",
    ),
  );
}

/** Structural wire validation only; it cannot establish freshness or bind a receipt. */
export const validateRealBuildExactFiveBrokerChallengeStructureV1 =
  generatedValidateChallenge as ValidateFunction<RealBuildExactFiveBrokerChallengeV1>;

/** Structural wire validation only; it cannot establish freshness or bind a challenge. */
export const validateRealBuildExactFiveBrokerConsumptionReceiptStructureV1 =
  generatedValidateReceipt as ValidateFunction<RealBuildExactFiveBrokerConsumptionReceiptV1>;

/**
 * Structural wire validation only. The exchange parser checks binding and timing
 * against caller-provided data; only the bounded inspector supplies held local
 * state and cryptographic inspection. Neither check grants admission authority.
 */
export const validateRealBuildExactFiveBrokerChallengeV1 =
  validateRealBuildExactFiveBrokerChallengeStructureV1;

/**
 * Structural wire validation only. The exchange parser checks binding and timing
 * against caller-provided data; only the bounded inspector supplies held local
 * state and cryptographic inspection. Neither check grants admission authority.
 */
export const validateRealBuildExactFiveBrokerConsumptionReceiptV1 =
  validateRealBuildExactFiveBrokerConsumptionReceiptStructureV1;
