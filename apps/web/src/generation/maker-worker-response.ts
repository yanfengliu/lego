import {
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
  type MakerPopulationSuccess,
} from "@lego-studio/generation";
import {
  validateAssemblyPatchV1,
  validateBrickDocumentV1,
  validateBuildProgramV1,
  validateValidationReportV1,
} from "@lego-studio/protocol";

import type { CandidateLabRequest } from "./candidate-lab-request";
import {
  parseTrustedPopulationDigest,
  type ParsedTrustedPopulationDigest,
} from "./candidate-lab-verifier-receipt";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const ATTEMPT_KEYS = [
  "candidateId",
  "document",
  "failure",
  "lineage",
  "metrics",
  "patch",
  "program",
  "programHash",
  "rank",
  "shape",
  "status",
  "strategyId",
  "structuralHash",
  "validationReport",
] as const;
const METRIC_KEYS = [
  "colorDiversityCount",
  "colorMatchPermyriad",
  "connectionCount",
  "diversityPermyriad",
  "partCount",
  "partCountFitPermyriad",
  "partTypeDiversityCount",
  "shapeMatchPermyriad",
  "weightedScorePermyriad",
] as const;
const SCORE_KEYS = [
  "colorMatchPermyriad",
  "shapeMatchPermyriad",
  "partCountFitPermyriad",
  "diversityPermyriad",
  "weightedScorePermyriad",
] as const;
const SUPPORTED_SHAPES = new Set(["tower", "staircase", "spire", "column"]);
const MAKER_INPUT_FAILURE_CODES = new Set([
  "INPUT_NOT_CLONEABLE",
  "INPUT_NOT_DATA_ONLY",
  "DOCUMENT_SCHEMA_INVALID",
  "DOCUMENT_HARD_INVALID",
  "BRIEF_SCHEMA_INVALID",
  "SCOPE_SCHEMA_INVALID",
  "JOB_ID_INVALID",
  "MODE_NOT_SUPPORTED",
  "REFERENCES_NOT_SUPPORTED",
  "PROMPT_EMPTY",
  "PROMPT_TOO_LARGE",
  "PROMPT_CONTROL_CHARACTER",
  "SHAPE_NOT_SUPPORTED",
  "SEMANTIC_REQUIREMENT_NOT_SUPPORTED",
  "STYLE_TAG_NOT_SUPPORTED",
  "REQUESTED_COLOR_NOT_ALLOWED",
  "BASE_NOT_EMPTY",
  "BASE_BINDING_MISMATCH",
  "SCOPE_NOT_FULL_EMPTY",
  "SCOPE_BROADENS_BRIEF",
  "UNSUPPORTED_CATALOG_PART",
  "UNSUPPORTED_COLOR",
  "ALLOWLIST_TOO_LARGE",
  "BRIEF_METADATA_TOO_LARGE",
  "BASE_METADATA_TOO_LARGE",
  "PART_BUDGET_TOO_SMALL",
  "OPERATION_BUDGET_TOO_SMALL",
  "WALL_TIME_BUDGET_TOO_SMALL",
  "OUTPUT_STORAGE_BUDGET_EXCEEDED",
  "TARGET_PART_COUNT_UNSUPPORTED",
  "TARGET_EXCEEDS_BUDGET",
  "ALLOWED_VOLUME_EMPTY",
]);
const COMPILATION_ISSUE_CODES = new Set([
  "BASE_DOCUMENT_SCHEMA_INVALID",
  "BASE_TRUTH_SNAPSHOT_UNSUPPORTED",
  "BUILD_PROGRAM_SCHEMA_INVALID",
  "SCOPE_SCHEMA_INVALID",
  "SCOPE_BASE_MISMATCH",
  "SCOPE_OVERLAP",
  "DUPLICATE_PROGRAM_OPERATION_ID",
  "DUPLICATE_LOCAL_PART_ID",
  "PART_REFERENCE_NOT_FOUND",
  "CONNECTION_REFERENCE_NOT_FOUND",
  "TEMPLATE_NOT_SUPPORTED",
  "OPERATION_APPLICATION_FAILED",
  "SCOPE_PART_LOCKED",
  "SCOPE_CONNECTION_LOCKED",
  "SCOPE_CATALOG_PART_NOT_ALLOWED",
  "SCOPE_COLOR_NOT_ALLOWED",
  "SCOPE_BOUNDS_UNAVAILABLE",
  "SCOPE_VOLUME_EXCEEDED",
  "SCOPE_ADDITION_BUDGET_EXCEEDED",
  "SCOPE_REMOVAL_BUDGET_EXCEEDED",
  "SCOPE_OPERATION_BUDGET_EXCEEDED",
  "SCOPE_REQUIRED_ATTACHMENT_MISSING",
  "SCOPE_REQUIRED_ATTACHMENT_INVALID",
  "SCOPE_REQUIRED_ATTACHMENT_OCCUPIED",
  "PATCH_INTRODUCES_BLOCKING_ISSUE",
  "HARD_VALIDATION_INCOMPLETE",
  "PATCH_SCHEMA_INVALID",
  "COMPILER_INTERNAL_MISMATCH",
]);

export interface PopulationWorkerSuccess {
  readonly ok: true;
  readonly result: MakerPopulationSuccess;
  readonly verificationDurationMs: number;
}

export interface PopulationWorkerFailure {
  readonly ok: false;
  readonly code: "MALFORMED_WORKER_RESPONSE" | "WORKER_ERROR" | "MAKER_INPUT_REJECTED";
  readonly message: string;
  readonly detailCode?: string;
}

export type ParsedPopulationWorkerResponse = PopulationWorkerSuccess | PopulationWorkerFailure;

function malformed(message: string): PopulationWorkerFailure {
  return { ok: false, code: "MALFORMED_WORKER_RESPONSE", message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function validMetrics(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, METRIC_KEYS)) return false;
  if (
    !METRIC_KEYS.every((key) => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0)
  ) {
    return false;
  }
  return (
    (value.partCount as number) >= 10 &&
    (value.partCount as number) <= 40 &&
    (value.connectionCount as number) <= 512 &&
    (value.partTypeDiversityCount as number) <= (value.partCount as number) &&
    (value.colorDiversityCount as number) <= (value.partCount as number) &&
    SCORE_KEYS.every((key) => (value[key] as number) <= 10_000)
  );
}

function validLineage(value: unknown, candidateId: string, strategyId: string): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["candidateId", "generation", "parentCandidateId", "strategyId"]) &&
    value.candidateId === candidateId &&
    value.parentCandidateId === null &&
    value.generation === 0 &&
    value.strategyId === strategyId
  );
}

function validCompilationIssue(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  const expected =
    value.operationId === undefined
      ? ["code", "message", "path"]
      : ["code", "message", "operationId", "path"];
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index]) &&
    COMPILATION_ISSUE_CODES.has(String(value.code)) &&
    isBoundedString(value.message, 1_024) &&
    typeof value.path === "string" &&
    value.path.length <= 512 &&
    (value.operationId === undefined || isIdentifier(value.operationId))
  );
}

function validCandidateFailure(value: unknown, expectedStage: string): boolean {
  if (!isRecord(value) || value.stage !== expectedStage || !isBoundedString(value.message, 1_024)) {
    return false;
  }
  if (expectedStage === "generation") {
    return (
      hasExactKeys(value, ["code", "message", "stage"]) &&
      (value.code === "OPERATION_BUDGET_TOO_SMALL" || value.code === "NO_CONNECTION_PATH")
    );
  }
  if (expectedStage === "compile") {
    return (
      hasExactKeys(value, ["code", "issues", "message", "stage"]) &&
      value.code === "COMPILATION_REJECTED" &&
      Array.isArray(value.issues) &&
      value.issues.length > 0 &&
      value.issues.length <= 128 &&
      value.issues.every(validCompilationIssue)
    );
  }
  if (expectedStage === "validation") {
    return (
      hasExactKeys(value, ["code", "message", "stage"]) && value.code === "HARD_VALIDATION_REJECTED"
    );
  }
  if (expectedStage === "deduplication") {
    return (
      hasExactKeys(value, ["code", "duplicateOfCandidateId", "message", "stage"]) &&
      value.code === "DUPLICATE_STRUCTURAL_HASH" &&
      isIdentifier(value.duplicateOfCandidateId)
    );
  }
  return false;
}

function validateAttempt(
  value: unknown,
  request: CandidateLabRequest,
): value is MakerPopulationSuccess["attempts"][number] {
  if (!isRecord(value) || !hasExactKeys(value, ATTEMPT_KEYS)) return false;
  if (
    !isIdentifier(value.candidateId) ||
    !isIdentifier(value.strategyId) ||
    !SUPPORTED_SHAPES.has(String(value.shape)) ||
    !validLineage(value.lineage, value.candidateId, value.strategyId)
  ) {
    return false;
  }
  if (value.status === "hard-valid") {
    if (
      !isDigest(value.programHash) ||
      !isDigest(value.structuralHash) ||
      !validateBuildProgramV1(value.program) ||
      !validateBrickDocumentV1(value.document) ||
      !validateAssemblyPatchV1(value.patch) ||
      !validateValidationReportV1(value.validationReport) ||
      !validMetrics(value.metrics) ||
      !Number.isSafeInteger(value.rank) ||
      (value.rank as number) < 1 ||
      (value.rank as number) > 4 ||
      value.failure !== null
    ) {
      return false;
    }
    const truthHash = canonicalDigest(request.document.truth);
    const scopeDigest = canonicalDigest(normalizeScopeCapability(request.scope));
    return (
      canonicalDigest(value.program) === value.programHash &&
      documentStructuralHash(value.document) === value.structuralHash &&
      value.validationReport.patchValid === true &&
      value.validationReport.documentGloballyValid === true &&
      value.validationReport.targetDocumentHash === value.structuralHash &&
      value.validationReport.truthSnapshotHash === truthHash &&
      value.patch.baseRevision === request.document.revision &&
      value.patch.baseDocumentHash === request.brief.baseDocumentHash &&
      value.patch.truthSnapshotHash === truthHash &&
      value.patch.scopeCapabilityId === request.scope.capabilityId &&
      value.patch.scopeDigest === scopeDigest &&
      value.patch.provenance.jobId === request.jobId &&
      value.patch.provenance.candidateId === value.candidateId &&
      value.patch.provenance.buildProgramHash === value.programHash
    );
  }
  if (value.document !== null || value.patch !== null || value.validationReport !== null) {
    return false;
  }
  if (value.rank !== null || value.metrics !== null) return false;
  if (value.status === "duplicate") {
    return (
      validCandidateFailure(value.failure, "deduplication") &&
      validateBuildProgramV1(value.program) &&
      isDigest(value.programHash) &&
      canonicalDigest(value.program) === value.programHash &&
      isDigest(value.structuralHash)
    );
  }
  if (value.status !== "failed" || !isRecord(value.failure)) return false;
  if (value.failure.stage === "generation") {
    return (
      validCandidateFailure(value.failure, "generation") &&
      value.program === null &&
      value.programHash === null &&
      value.structuralHash === null
    );
  }
  if (value.failure.stage === "compile" || value.failure.stage === "validation") {
    return (
      validCandidateFailure(value.failure, value.failure.stage) &&
      validateBuildProgramV1(value.program) &&
      isDigest(value.programHash) &&
      canonicalDigest(value.program) === value.programHash &&
      value.structuralHash === null
    );
  }
  return false;
}

function parseSuccess(
  value: Record<string, unknown>,
  request: CandidateLabRequest,
): MakerPopulationSuccess | null {
  const normalized = normalizeRestrictedTextBrief(request);
  if (!normalized.ok) return null;
  if (
    !hasExactKeys(value, [
      "attempts",
      "jobId",
      "makerVersion",
      "normalizedBrief",
      "ok",
      "rankedCandidates",
      "rankingPolicyHash",
    ]) ||
    value.ok !== true ||
    value.jobId !== request.jobId ||
    value.makerVersion !== GENERATION_VERSION ||
    value.rankingPolicyHash !== RANKING_POLICY_HASH ||
    !isRecord(value.normalizedBrief) ||
    !Array.isArray(value.attempts) ||
    value.attempts.length !== normalized.brief.candidateLimit ||
    !Array.isArray(value.rankedCandidates) ||
    value.rankedCandidates.length > normalized.brief.candidateLimit ||
    !value.attempts.every((attempt) => validateAttempt(attempt, request)) ||
    !value.rankedCandidates.every((attempt) => validateAttempt(attempt, request)) ||
    canonicalStringify(value.normalizedBrief) !== canonicalStringify(normalized.brief)
  ) {
    return null;
  }
  const candidateIds = value.attempts.map(({ candidateId }) => candidateId);
  if (new Set(candidateIds).size !== candidateIds.length) return null;
  const hardValid = value.attempts.filter(({ status }) => status === "hard-valid");
  if (
    value.rankedCandidates.length !== hardValid.length ||
    value.rankedCandidates.some(
      (candidate, index) =>
        candidate.status !== "hard-valid" ||
        candidate.rank !== index + 1 ||
        !hardValid.some(
          (attempt) =>
            attempt.candidateId === candidate.candidateId &&
            canonicalStringify(attempt) === canonicalStringify(candidate),
        ),
    )
  ) {
    return null;
  }
  for (let index = 0; index < value.attempts.length; index += 1) {
    const attempt = value.attempts[index]!;
    if (attempt.status !== "duplicate") continue;
    const duplicateOf = value.attempts
      .slice(0, index)
      .find(({ candidateId }) => candidateId === attempt.failure.duplicateOfCandidateId);
    if (!duplicateOf || duplicateOf.structuralHash !== attempt.structuralHash) return null;
  }
  return deepFreeze(value as unknown as MakerPopulationSuccess);
}

function validMakerFailure(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["code", "message", "path", "stage"]) &&
    value.stage === "input" &&
    MAKER_INPUT_FAILURE_CODES.has(String(value.code)) &&
    isBoundedString(value.message, 1_024) &&
    typeof value.path === "string" &&
    value.path.length <= 512
  );
}

function parseDetachedResponse(
  value: unknown,
  trustedDigest: ParsedTrustedPopulationDigest,
  requestId: string,
  request: CandidateLabRequest,
): ParsedPopulationWorkerResponse {
  if (!isRecord(value) || value.requestId !== requestId) {
    return malformed("Worker response was not bound to the active request");
  }
  if (value.kind === "population-error") {
    return hasExactKeys(value, ["kind", "message", "requestId"]) &&
      isBoundedString(value.message, 1_024)
      ? { ok: false, code: "WORKER_ERROR", message: value.message }
      : malformed("Worker returned a malformed execution error");
  }
  if (
    value.kind !== "population-result" ||
    !hasExactKeys(value, ["kind", "requestId", "result"]) ||
    !isRecord(value.result)
  ) {
    return malformed("Worker returned malformed population evidence");
  }
  const resultBytes = new TextEncoder().encode(canonicalStringify(value.result)).byteLength;
  if (resultBytes > request.brief.budgets.maxStoredBytes) {
    return malformed("Worker response exceeded the admitted retained-byte budget");
  }
  if (
    trustedDigest.expectedCanonicalDigest !== canonicalDigest(value.result) ||
    trustedDigest.expectedOk !== value.result.ok
  ) {
    return malformed("Maker result did not match the independent trusted replay");
  }
  if (value.result.ok === false) {
    if (
      !hasExactKeys(value.result, ["failure", "ok"]) ||
      !validMakerFailure(value.result.failure)
    ) {
      return malformed("Worker returned a malformed maker failure");
    }
    return {
      ok: false,
      code: "MAKER_INPUT_REJECTED",
      detailCode: String(value.result.failure.code),
      message: String(value.result.failure.message),
    };
  }
  if (value.result.ok !== true) return malformed("Worker result omitted its outcome");
  const result = parseSuccess(value.result, request);
  return result
    ? {
        ok: true,
        result,
        verificationDurationMs: trustedDigest.verificationDurationMs,
      }
    : malformed("Worker returned an invalid candidate population");
}

export function parsePopulationWorkerResponse(
  value: unknown,
  trustedDigestValue: unknown,
  requestId: string,
  request: CandidateLabRequest,
): ParsedPopulationWorkerResponse {
  // This value can only originate from the same Vite-bundled worker. We still detach it into a
  // bounded data-only snapshot before parsing so cycles, accessors, exotic objects, and excess
  // bytes fail closed instead of reaching React or the viewport.
  const detached = cloneBoundedDataOnlyJson(value, {
    maxDepth: 32,
    maxNodes: 50_000,
    maxStringChars: 8_192,
    maxKeyChars: 128,
    maxTotalChars: Math.min(request.brief.budgets.maxStoredBytes + 16_384, 1_100_000),
  });
  if (detached === null) {
    return malformed("Worker response was not bounded data-only evidence");
  }
  const trustedDigest = parseTrustedPopulationDigest(trustedDigestValue, requestId, request);
  if (!trustedDigest.ok) return trustedDigest;
  try {
    return parseDetachedResponse(detached, trustedDigest.digest, requestId, request);
  } catch {
    return malformed("Worker response could not be parsed safely");
  }
}
