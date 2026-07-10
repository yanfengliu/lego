import {
  canonicalDigest,
  canonicalStringify,
  deepFreeze,
  normalizeBuildProgram,
} from "@lego-studio/brick-kernel";
import { validateBuildProgramV1, type BuildProgramV1 } from "@lego-studio/protocol";

import { cloneBoundedDataOnlyJson } from "./data-only.ts";
import { MAX_GENERATED_PROGRAM_OPERATIONS, type GeneratedRecipeResult } from "./recipes.ts";
import type {
  CandidateGenerationFailure,
  CapturedProgramFailure,
  CapturedProgramFailureCode,
  SupportedShape,
} from "./types.ts";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SUPPORTED_SHAPES = new Set<SupportedShape>(["tower", "staircase", "spire", "column"]);
const GENERATION_FAILURE_CODES = new Set<CandidateGenerationFailure["code"]>([
  "OPERATION_BUDGET_TOO_SMALL",
  "NO_CONNECTION_PATH",
]);

function failure(
  code: CapturedProgramFailureCode,
  message: string,
  path: string,
): { readonly ok: false; readonly failure: CapturedProgramFailure } {
  return { ok: false, failure: { stage: "captured-output", code, message, path } };
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string")) return null;
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    keys.some((key) => {
      const descriptor = descriptors[key];
      return !descriptor || !("value" in descriptor) || !descriptor.enumerable;
    })
  ) {
    return null;
  }
  const record = Object.create(null) as Record<string, unknown>;
  for (const key of keys) record[key] = descriptors[key]!.value;
  return record;
}

function commonIdentity(
  record: Record<string, unknown>,
  index: number,
):
  | { readonly ok: true; readonly strategyId: string; readonly shape: SupportedShape }
  | { readonly ok: false; readonly failure: CapturedProgramFailure } {
  if (typeof record.strategyId !== "string" || !IDENTIFIER.test(record.strategyId)) {
    return failure(
      "PROGRAM_RECORD_INVALID",
      "Captured strategy identifier violates the bounded identifier contract",
      `/capturedPrograms/${index}/strategyId`,
    );
  }
  if (typeof record.shape !== "string" || !SUPPORTED_SHAPES.has(record.shape as SupportedShape)) {
    return failure(
      "CANDIDATE_SHAPE_INVALID",
      "Captured strategy shape is not supported by the deterministic maker",
      `/capturedPrograms/${index}/shape`,
    );
  }
  return { ok: true, strategyId: record.strategyId, shape: record.shape as SupportedShape };
}

function normalizeProgram(
  record: Record<string, unknown>,
  index: number,
  maxOperations: number,
):
  | { readonly ok: true; readonly result: GeneratedRecipeResult }
  | { readonly ok: false; readonly failure: CapturedProgramFailure } {
  const identity = commonIdentity(record, index);
  if (!identity.ok) return identity;
  if (
    !validateBuildProgramV1(record.program) ||
    (record.program as BuildProgramV1).operations.length > maxOperations ||
    (record.program as BuildProgramV1).operations.length > MAX_GENERATED_PROGRAM_OPERATIONS ||
    typeof record.programHash !== "string" ||
    !DIGEST.test(record.programHash)
  ) {
    return failure(
      "PROGRAM_RECORD_INVALID",
      "Captured program violates the schema or admitted operation budget",
      `/capturedPrograms/${index}/program`,
    );
  }
  const program = record.program as BuildProgramV1;
  const normalizedProgram = normalizeBuildProgram(program);
  if (canonicalStringify(program) !== canonicalStringify(normalizedProgram)) {
    return failure(
      "PROGRAM_NOT_NORMALIZED",
      "Captured program must already use canonical normalized operation data",
      `/capturedPrograms/${index}/program`,
    );
  }
  if (canonicalDigest(normalizedProgram) !== record.programHash) {
    return failure(
      "PROGRAM_HASH_MISMATCH",
      "Captured program hash does not match its canonical program bytes",
      `/capturedPrograms/${index}/programHash`,
    );
  }
  return {
    ok: true,
    result: deepFreeze({
      strategyId: identity.strategyId,
      shape: identity.shape,
      program: normalizedProgram,
      programHash: record.programHash as `sha256:${string}`,
    }),
  };
}

function normalizeGenerationFailure(
  record: Record<string, unknown>,
  index: number,
):
  | { readonly ok: true; readonly result: GeneratedRecipeResult }
  | { readonly ok: false; readonly failure: CapturedProgramFailure } {
  const identity = commonIdentity(record, index);
  if (!identity.ok) return identity;
  const detail = exactRecord(record.failure, ["stage", "code", "message"]);
  if (
    !detail ||
    detail.stage !== "generation" ||
    typeof detail.code !== "string" ||
    !GENERATION_FAILURE_CODES.has(detail.code as CandidateGenerationFailure["code"]) ||
    typeof detail.message !== "string" ||
    detail.message.length < 1 ||
    detail.message.length > 1_024
  ) {
    return failure(
      "FAILURE_RECORD_INVALID",
      "Captured generation failure violates the closed failure contract",
      `/capturedPrograms/${index}/failure`,
    );
  }
  return {
    ok: true,
    result: deepFreeze({
      strategyId: identity.strategyId,
      shape: identity.shape,
      failure: {
        stage: "generation",
        code: detail.code as CandidateGenerationFailure["code"],
        message: detail.message,
      },
    }),
  };
}

export type NormalizeCapturedProgramsResult =
  | { readonly ok: true; readonly programs: readonly GeneratedRecipeResult[] }
  | { readonly ok: false; readonly failure: CapturedProgramFailure };

export function normalizeCapturedPrograms(
  value: unknown,
  expectedCount: number,
  maxOperations: number,
): NormalizeCapturedProgramsResult {
  const detached = cloneBoundedDataOnlyJson(value, {
    maxDepth: 24,
    maxNodes: 8_000,
    maxStringChars: 8_192,
    maxKeyChars: 128,
    maxTotalChars: 512_000,
  });
  try {
    if (detached !== null) canonicalStringify(detached);
  } catch {
    return failure(
      "CAPTURE_NOT_DATA_ONLY",
      "Captured program results must be acyclic bounded data-only JSON",
      "/capturedPrograms",
    );
  }
  if (!Array.isArray(detached)) {
    return failure(
      "CAPTURE_NOT_DATA_ONLY",
      "Captured program results must be a bounded data-only array",
      "/capturedPrograms",
    );
  }
  if (detached.length !== expectedCount) {
    return failure(
      "CANDIDATE_COUNT_MISMATCH",
      "Captured program count does not match the admitted candidate budget",
      "/capturedPrograms",
    );
  }
  const programs: GeneratedRecipeResult[] = [];
  const strategyIds = new Set<string>();
  for (let index = 0; index < detached.length; index += 1) {
    const valueAtIndex = detached[index];
    const programRecord = exactRecord(valueAtIndex, [
      "strategyId",
      "shape",
      "program",
      "programHash",
    ]);
    const failureRecord = programRecord
      ? null
      : exactRecord(valueAtIndex, ["strategyId", "shape", "failure"]);
    const normalized = programRecord
      ? normalizeProgram(programRecord, index, maxOperations)
      : failureRecord
        ? normalizeGenerationFailure(failureRecord, index)
        : failure(
            "PROGRAM_RECORD_INVALID",
            "Captured program result has unknown or missing fields",
            `/capturedPrograms/${index}`,
          );
    if (!normalized.ok) return normalized;
    if (strategyIds.has(normalized.result.strategyId)) {
      return failure(
        "DUPLICATE_STRATEGY_ID",
        "Captured program results repeat a strategy identifier",
        `/capturedPrograms/${index}/strategyId`,
      );
    }
    strategyIds.add(normalized.result.strategyId);
    programs.push(normalized.result);
  }
  return { ok: true, programs: deepFreeze(programs) };
}
