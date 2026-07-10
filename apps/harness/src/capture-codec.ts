import { createHash } from "node:crypto";

import {
  BUILTIN_COMPILER_SNAPSHOT_HASH,
  canonicalDigest,
  canonicalStringify,
  deepFreeze,
  documentStructuralHash,
  normalizeScopeCapability,
} from "@lego-studio/brick-kernel";
import {
  GENERATION_VERSION,
  RANKING_POLICY_HASH,
  cloneBoundedDataOnlyJson,
  normalizeRestrictedTextBrief,
  type CapturedMakerPopulationResult,
  type DeterministicMakerPopulationInput,
  type GeneratedRecipeResult,
} from "@lego-studio/generation";
import {
  PROTOCOL_VERSION,
  validateDeterministicMakerOutputV1,
  type BrickDocumentV1,
  type BuildBriefV1,
  type DeterministicMakerOutputV1,
  type ScopeCapabilityV1,
} from "@lego-studio/protocol";

import {
  HARNESS_VERSION,
  MAKER_CAPTURE_MANIFEST_VERSION,
  MAKER_CAPTURE_VERSION,
  type CandidateReplayCheckpoint,
  type DeterministicMakerCapture,
  type DeterministicMakerCaptureManifest,
  type Sha256Digest,
} from "./capture-types.ts";

export const MAX_CAPTURE_JSON_BYTES = 16 * 1024 * 1024;
const MAX_CAPTURE_TOTAL_CHARS = MAX_CAPTURE_JSON_BYTES * 3 + 128 * 1024;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;

export const DOWNSTREAM_REPLAY_POLICY = deepFreeze({
  schemaVersion: "lego.captured-output-replay-policy/1",
  boundary: "deterministic-recipe-results",
  maximumSlots: 4,
  maximumProgramOperations: 512,
  requiredChecks: [
    "canonical-request",
    "canonical-captured-output",
    "compiler-and-hard-validation",
    "independent-patch-verification",
    "structural-deduplication",
    "metrics-and-ranking",
    "candidate-checkpoints",
  ],
  positiveProofRequires: [
    "at-least-one-compiled-program",
    "at-least-one-hard-valid-candidate",
    "all-hard-valid-patches-independently-verified",
    "all-candidate-checkpoints-matched",
  ],
} as const);

export const DOWNSTREAM_REPLAY_POLICY_HASH = canonicalDigest(DOWNSTREAM_REPLAY_POLICY);

export type ValidatedMakerInput = Omit<
  DeterministicMakerPopulationInput,
  "document" | "brief" | "scope"
> & {
  readonly document: BrickDocumentV1;
  readonly brief: BuildBriefV1;
  readonly scope: ScopeCapabilityV1;
};

export function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function sha256Text(value: string): Sha256Digest {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function canonicalJson(value: unknown): string {
  return canonicalStringify(value);
}

export function makerOutputFromPrograms(
  programs: readonly GeneratedRecipeResult[],
): DeterministicMakerOutputV1 {
  const output = {
    schemaVersion: "lego.deterministic-maker-output/1",
    makerVersion: GENERATION_VERSION,
    slots: programs.map((result, index) => ({
      index,
      strategyId: result.strategyId,
      shape: result.shape,
      outcome:
        "program" in result
          ? {
              kind: "program" as const,
              program: result.program,
              normalizedProgramHash: result.programHash,
            }
          : {
              kind: "generationFailure" as const,
              failure: result.failure,
            },
    })),
  } as const satisfies DeterministicMakerOutputV1;
  if (!validateDeterministicMakerOutputV1(output)) {
    throw new Error("Released deterministic maker produced an invalid output boundary");
  }
  return deepFreeze(output);
}

export function programsFromMakerOutput(
  output: DeterministicMakerOutputV1,
): readonly GeneratedRecipeResult[] {
  return deepFreeze(
    output.slots.map((slot) =>
      slot.outcome.kind === "program"
        ? {
            strategyId: slot.strategyId,
            shape: slot.shape,
            program: slot.outcome.program,
            programHash: slot.outcome.normalizedProgramHash,
          }
        : {
            strategyId: slot.strategyId,
            shape: slot.shape,
            failure: slot.outcome.failure,
          },
    ),
  ) as readonly GeneratedRecipeResult[];
}

export function candidateCheckpoints(
  population: CapturedMakerPopulationResult,
): readonly CandidateReplayCheckpoint[] {
  if (!population.ok) return deepFreeze([]);
  return deepFreeze(
    population.attempts.map((attempt, attemptIndex) => ({
      attemptIndex,
      candidateId: attempt.candidateId,
      strategyId: attempt.strategyId,
      status: attempt.status,
      programHash: attempt.programHash,
      structuralHash: attempt.structuralHash,
      compilerSnapshotHash:
        (attempt.patch?.provenance.compilerSnapshotHash as Sha256Digest | undefined) ?? null,
      patchHash: attempt.patch ? canonicalDigest(attempt.patch) : null,
      documentHash: attempt.document ? canonicalDigest(attempt.document) : null,
      validationReportHash: attempt.validationReport
        ? canonicalDigest(attempt.validationReport)
        : null,
      metricsHash: attempt.metrics ? canonicalDigest(attempt.metrics) : null,
      rank: attempt.rank,
      candidateDigest: canonicalDigest(attempt),
    })),
  );
}

export function createCaptureManifest(
  input: ValidatedMakerInput,
  capturedOutput: DeterministicMakerOutputV1,
  population: CapturedMakerPopulationResult,
  requestJson: string,
  capturedProgramsJson: string,
  populationJson: string,
): DeterministicMakerCaptureManifest {
  const normalized = normalizeRestrictedTextBrief(input);
  return deepFreeze({
    schemaVersion: MAKER_CAPTURE_MANIFEST_VERSION,
    harnessVersion: HARNESS_VERSION,
    namespace: "test",
    integrity: "unsealed",
    authenticated: false,
    boundary: "deterministic-recipe-results",
    jobId: input.jobId,
    protocolVersion: PROTOCOL_VERSION,
    generationVersion: capturedOutput.makerVersion,
    compilerSnapshotHash: BUILTIN_COMPILER_SNAPSHOT_HASH,
    rankingPolicyHash: RANKING_POLICY_HASH,
    replayPolicyHash: DOWNSTREAM_REPLAY_POLICY_HASH,
    baseDocumentHash: documentStructuralHash(input.document),
    truthSnapshotHash: canonicalDigest(input.document.truth),
    briefHash: canonicalDigest(input.brief),
    normalizedBriefHash: normalized.ok ? canonicalDigest(normalized.brief) : null,
    scopeDigest: canonicalDigest(normalizeScopeCapability(input.scope)),
    requestHash: sha256Text(requestJson),
    requestByteLength: utf8ByteLength(requestJson),
    capturedProgramsHash: sha256Text(capturedProgramsJson),
    capturedProgramsByteLength: utf8ByteLength(capturedProgramsJson),
    populationHash: sha256Text(populationJson),
    populationByteLength: utf8ByteLength(populationJson),
    resultOk: population.ok,
    candidates: candidateCheckpoints(population),
  });
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string")) return null;
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index]) ||
    actual.some((key) => {
      const descriptor = descriptors[key];
      return !descriptor || !("value" in descriptor) || !descriptor.enumerable;
    })
  ) {
    return null;
  }
  const record = Object.create(null) as Record<string, unknown>;
  for (const key of actual) record[key] = descriptors[key]!.value;
  return record;
}

function nullableDigest(value: unknown): value is Sha256Digest | null {
  return value === null || (typeof value === "string" && DIGEST.test(value));
}

function validCandidateCheckpoint(value: unknown, index: number): boolean {
  const record = exactRecord(value, [
    "attemptIndex",
    "candidateId",
    "strategyId",
    "status",
    "programHash",
    "structuralHash",
    "compilerSnapshotHash",
    "patchHash",
    "documentHash",
    "validationReportHash",
    "metricsHash",
    "rank",
    "candidateDigest",
  ]);
  return Boolean(
    record &&
    record.attemptIndex === index &&
    typeof record.candidateId === "string" &&
    IDENTIFIER.test(record.candidateId) &&
    typeof record.strategyId === "string" &&
    IDENTIFIER.test(record.strategyId) &&
    (record.status === "failed" ||
      record.status === "duplicate" ||
      record.status === "hard-valid") &&
    nullableDigest(record.programHash) &&
    nullableDigest(record.structuralHash) &&
    nullableDigest(record.compilerSnapshotHash) &&
    nullableDigest(record.patchHash) &&
    nullableDigest(record.documentHash) &&
    nullableDigest(record.validationReportHash) &&
    nullableDigest(record.metricsHash) &&
    (record.rank === null || (Number.isSafeInteger(record.rank) && (record.rank as number) >= 1)) &&
    typeof record.candidateDigest === "string" &&
    DIGEST.test(record.candidateDigest),
  );
}

function validManifest(value: unknown): value is DeterministicMakerCaptureManifest {
  const record = exactRecord(value, [
    "schemaVersion",
    "harnessVersion",
    "namespace",
    "integrity",
    "authenticated",
    "boundary",
    "jobId",
    "protocolVersion",
    "generationVersion",
    "compilerSnapshotHash",
    "rankingPolicyHash",
    "replayPolicyHash",
    "baseDocumentHash",
    "truthSnapshotHash",
    "briefHash",
    "normalizedBriefHash",
    "scopeDigest",
    "requestHash",
    "requestByteLength",
    "capturedProgramsHash",
    "capturedProgramsByteLength",
    "populationHash",
    "populationByteLength",
    "resultOk",
    "candidates",
  ]);
  if (!record || !Array.isArray(record.candidates) || record.candidates.length > 4) return false;
  const fixedValues =
    record.schemaVersion === MAKER_CAPTURE_MANIFEST_VERSION &&
    record.harnessVersion === HARNESS_VERSION &&
    record.namespace === "test" &&
    record.integrity === "unsealed" &&
    record.authenticated === false &&
    record.boundary === "deterministic-recipe-results";
  const digests = [
    record.compilerSnapshotHash,
    record.rankingPolicyHash,
    record.replayPolicyHash,
    record.baseDocumentHash,
    record.truthSnapshotHash,
    record.briefHash,
    record.scopeDigest,
    record.requestHash,
    record.capturedProgramsHash,
    record.populationHash,
  ];
  const byteLengths = [
    record.requestByteLength,
    record.capturedProgramsByteLength,
    record.populationByteLength,
  ];
  return Boolean(
    fixedValues &&
    typeof record.jobId === "string" &&
    IDENTIFIER.test(record.jobId) &&
    typeof record.protocolVersion === "string" &&
    IDENTIFIER.test(record.protocolVersion) &&
    typeof record.generationVersion === "string" &&
    IDENTIFIER.test(record.generationVersion) &&
    digests.every((digest) => typeof digest === "string" && DIGEST.test(digest)) &&
    nullableDigest(record.normalizedBriefHash) &&
    byteLengths.every(
      (length) =>
        Number.isSafeInteger(length) &&
        (length as number) > 0 &&
        (length as number) <= MAX_CAPTURE_JSON_BYTES,
    ) &&
    typeof record.resultOk === "boolean" &&
    record.candidates.every(validCandidateCheckpoint),
  );
}

export type CaptureSnapshotResult =
  | { readonly ok: true; readonly capture: DeterministicMakerCapture }
  | { readonly ok: false; readonly reason: "not-data-only" | "invalid-shape" };

export function snapshotCapture(value: unknown): CaptureSnapshotResult {
  const detached = cloneBoundedDataOnlyJson(value, {
    maxDepth: 16,
    maxNodes: 1_024,
    maxStringChars: MAX_CAPTURE_JSON_BYTES,
    maxKeyChars: 128,
    maxTotalChars: MAX_CAPTURE_TOTAL_CHARS,
  });
  if (detached === null) return { ok: false, reason: "not-data-only" };
  try {
    canonicalStringify(detached);
  } catch {
    return { ok: false, reason: "not-data-only" };
  }
  const record = exactRecord(detached, [
    "schemaVersion",
    "manifestHash",
    "manifest",
    "requestJson",
    "capturedProgramsJson",
    "populationJson",
  ]);
  if (
    !record ||
    record.schemaVersion !== MAKER_CAPTURE_VERSION ||
    typeof record.manifestHash !== "string" ||
    !DIGEST.test(record.manifestHash) ||
    !validManifest(record.manifest) ||
    typeof record.requestJson !== "string" ||
    typeof record.capturedProgramsJson !== "string" ||
    typeof record.populationJson !== "string"
  ) {
    return { ok: false, reason: "invalid-shape" };
  }
  return { ok: true, capture: deepFreeze(record as unknown as DeterministicMakerCapture) };
}

export function hasBoundedJsonStructure(value: string): boolean {
  let depth = 0;
  let structuralTokens = 0;
  let currentStringLength = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      } else {
        currentStringLength += 1;
        if (currentStringLength > 65_536) return false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      currentStringLength = 0;
    } else if (character === "{" || character === "[") {
      depth += 1;
      structuralTokens += 1;
      if (depth > 64) return false;
    } else if (character === "}" || character === "]") {
      depth -= 1;
      structuralTokens += 1;
      if (depth < 0) return false;
    } else if (character === "," || character === ":") {
      structuralTokens += 1;
    }
    if (structuralTokens > 200_000) return false;
  }
  return !inString && depth === 0;
}
