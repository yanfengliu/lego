import { isAbsolute } from "node:path";

import { assertIdentifier } from "./run-ledger-codec.ts";
import {
  RunLedgerError,
  type ArtifactResolver,
  type RunLedgerLimits,
  type TestRunLedgerOptions,
} from "./run-ledger-types.ts";

const MEBIBYTE = 1024 * 1024;

export const RUN_LEDGER_LIMITS: RunLedgerLimits = Object.freeze({
  maxEvents: 100_000,
  maxProviderAttempts: 64,
  maxCandidates: 16,
  maxArtifactRefsPerEvent: 256,
  maxReferencedBytesPerEvent: 64 * MEBIBYTE,
  maxArtifactRefsPerRun: 10_000,
  maxReferencedBytesPerRun: 1024 * MEBIBYTE,
  maxPendingAppends: 32,
  maxPendingAppendBytes: 8 * MEBIBYTE,
  maxRecordBytes: 256 * 1024,
  maxLedgerBytes: 128 * MEBIBYTE,
});

const HARD_LIMITS: RunLedgerLimits = Object.freeze({
  maxEvents: 1_000_000,
  maxProviderAttempts: 64,
  maxCandidates: 16,
  maxArtifactRefsPerEvent: 256,
  maxReferencedBytesPerEvent: 64 * MEBIBYTE,
  maxArtifactRefsPerRun: 10_000,
  maxReferencedBytesPerRun: 1024 * MEBIBYTE,
  maxPendingAppends: 1024,
  maxPendingAppendBytes: 64 * MEBIBYTE,
  maxRecordBytes: MEBIBYTE,
  maxLedgerBytes: 256 * MEBIBYTE,
});

const LIMIT_KEYS = Object.freeze(Object.keys(RUN_LEDGER_LIMITS) as (keyof RunLedgerLimits)[]);

export interface NormalizedRunLedgerOptions {
  readonly root: string;
  readonly runId: string;
  readonly artifactResolver: ArtifactResolver;
  readonly limits: RunLedgerLimits;
}

function normalizeLimits(value: unknown): RunLedgerLimits {
  if (value === undefined) return RUN_LEDGER_LIMITS;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger limits must be a plain object");
  }
  let descriptors: PropertyDescriptorMap;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error("not plain");
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger limits must be a plain object", {
      cause: error,
    });
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string" || !LIMIT_KEYS.includes(key as never))) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger limits contain an unknown field");
  }
  if (Object.values(descriptors).some((descriptor) => !("value" in descriptor))) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger limits cannot contain accessors");
  }
  const supplied = value as Partial<Record<keyof RunLedgerLimits, unknown>>;
  const normalized = Object.fromEntries(
    LIMIT_KEYS.map((key) => [
      key,
      Object.prototype.hasOwnProperty.call(supplied, key) ? supplied[key] : RUN_LEDGER_LIMITS[key],
    ]),
  ) as unknown as RunLedgerLimits;
  for (const key of LIMIT_KEYS) {
    const limit = normalized[key];
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > HARD_LIMITS[key]) {
      throw new RunLedgerError("INVALID_ROOT", `${key} is outside run-ledger policy`);
    }
  }
  if (normalized.maxLedgerBytes < normalized.maxRecordBytes) {
    throw new RunLedgerError("INVALID_ROOT", "Ledger byte cap must cover one complete record");
  }
  return Object.freeze(normalized);
}

export function normalizeRunLedgerOptions(
  options: TestRunLedgerOptions,
): NormalizedRunLedgerOptions {
  if (typeof options !== "object" || options === null) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger options must be provided");
  }
  let descriptors: PropertyDescriptorMap;
  try {
    if (Object.getPrototypeOf(options) !== Object.prototype) throw new Error("not plain");
    descriptors = Object.getOwnPropertyDescriptors(options);
  } catch (error) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger options must be a plain object", {
      cause: error,
    });
  }
  const allowedKeys = new Set(["root", "namespace", "expectedRunId", "artifactResolver", "limits"]);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string" || !allowedKeys.has(key)) ||
    Object.values(descriptors).some((descriptor) => !("value" in descriptor))
  ) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger options have unknown or unsafe fields");
  }
  for (const required of ["root", "namespace", "expectedRunId", "artifactResolver"]) {
    if (!Object.prototype.hasOwnProperty.call(descriptors, required)) {
      throw new RunLedgerError("INVALID_ROOT", `Run-ledger option is missing: ${required}`);
    }
  }
  if (options.namespace !== "test") {
    throw new RunLedgerError(
      "INVALID_NAMESPACE",
      "This unreleased ledger implementation is restricted to the test namespace",
    );
  }
  if (
    typeof options.root !== "string" ||
    options.root.includes("\0") ||
    !isAbsolute(options.root)
  ) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger root must be an explicit absolute path");
  }
  assertIdentifier(options.expectedRunId, "Expected run ID");
  if (
    typeof options.artifactResolver !== "object" ||
    options.artifactResolver === null ||
    typeof options.artifactResolver.read !== "function"
  ) {
    throw new RunLedgerError("INVALID_ROOT", "An artifact-store resolver interface is required");
  }
  return {
    root: options.root,
    runId: options.expectedRunId,
    artifactResolver: options.artifactResolver,
    limits: normalizeLimits(options.limits),
  };
}
