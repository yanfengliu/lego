import type {
  AssemblyPatchV1,
  BrickDocumentV1,
  BuildBriefV1,
  BuildProgramV1,
  ScopeCapabilityV1,
  ValidationReportV1,
} from "@lego-studio/protocol";
import type { CompilationIssue, Sha256Digest } from "@lego-studio/brick-kernel";

export type SupportedShape = "tower" | "staircase" | "spire" | "column";

export type MakerInputFailureCode =
  | "INPUT_NOT_CLONEABLE"
  | "INPUT_NOT_DATA_ONLY"
  | "DOCUMENT_SCHEMA_INVALID"
  | "DOCUMENT_HARD_INVALID"
  | "BRIEF_SCHEMA_INVALID"
  | "SCOPE_SCHEMA_INVALID"
  | "JOB_ID_INVALID"
  | "MODE_NOT_SUPPORTED"
  | "REFERENCES_NOT_SUPPORTED"
  | "PROMPT_EMPTY"
  | "PROMPT_TOO_LARGE"
  | "PROMPT_CONTROL_CHARACTER"
  | "SHAPE_NOT_SUPPORTED"
  | "SEMANTIC_REQUIREMENT_NOT_SUPPORTED"
  | "STYLE_TAG_NOT_SUPPORTED"
  | "REQUESTED_COLOR_NOT_ALLOWED"
  | "BASE_NOT_EMPTY"
  | "BASE_BINDING_MISMATCH"
  | "SCOPE_NOT_FULL_EMPTY"
  | "SCOPE_BROADENS_BRIEF"
  | "UNSUPPORTED_CATALOG_PART"
  | "UNSUPPORTED_COLOR"
  | "ALLOWLIST_TOO_LARGE"
  | "BRIEF_METADATA_TOO_LARGE"
  | "BASE_METADATA_TOO_LARGE"
  | "PART_BUDGET_TOO_SMALL"
  | "OPERATION_BUDGET_TOO_SMALL"
  | "WALL_TIME_BUDGET_TOO_SMALL"
  | "OUTPUT_STORAGE_BUDGET_EXCEEDED"
  | "TARGET_PART_COUNT_UNSUPPORTED"
  | "TARGET_EXCEEDS_BUDGET"
  | "ALLOWED_VOLUME_EMPTY";

export interface MakerInputFailure {
  readonly stage: "input";
  readonly code: MakerInputFailureCode;
  readonly message: string;
  readonly path: string;
}

export type CapturedProgramFailureCode =
  | "CAPTURE_NOT_DATA_ONLY"
  | "CANDIDATE_COUNT_MISMATCH"
  | "CANDIDATE_SHAPE_INVALID"
  | "DUPLICATE_STRATEGY_ID"
  | "FAILURE_RECORD_INVALID"
  | "PROGRAM_NOT_NORMALIZED"
  | "PROGRAM_RECORD_INVALID"
  | "PROGRAM_HASH_MISMATCH";

export interface CapturedProgramFailure {
  readonly stage: "captured-output";
  readonly code: CapturedProgramFailureCode;
  readonly message: string;
  readonly path: string;
}

export interface NormalizedTextBrief {
  readonly schemaVersion: "lego.normalized-text-brief/1";
  readonly sourceBriefHash: Sha256Digest;
  readonly normalizedPrompt: string;
  readonly requestedShape: SupportedShape;
  readonly requestedColorIds: readonly string[];
  readonly colorIntent: "explicit" | "default";
  readonly allowedCatalogPartIds: readonly string[];
  readonly allowedColorIds: readonly string[];
  readonly targetPartCount: number;
  readonly candidateLimit: number;
  readonly generationVolume: ScopeCapabilityV1["allowedVolume"];
}

export interface NormalizeRestrictedTextBriefInput {
  readonly document: unknown;
  readonly brief: unknown;
  readonly scope: unknown;
}

export interface NormalizedBriefSuccess {
  readonly ok: true;
  readonly brief: NormalizedTextBrief;
  readonly document: BrickDocumentV1;
  readonly sourceBrief: BuildBriefV1;
  readonly scope: ScopeCapabilityV1;
}

export interface NormalizedBriefFailure {
  readonly ok: false;
  readonly failure: MakerInputFailure;
}

export type NormalizeRestrictedTextBriefResult = NormalizedBriefSuccess | NormalizedBriefFailure;

export interface CandidateLineage {
  readonly candidateId: string;
  readonly parentCandidateId: null;
  readonly generation: 0;
  readonly strategyId: string;
}

export interface CandidateMetrics {
  readonly partCount: number;
  readonly connectionCount: number;
  readonly partTypeDiversityCount: number;
  readonly colorDiversityCount: number;
  readonly colorMatchPermyriad: number;
  readonly shapeMatchPermyriad: number;
  readonly partCountFitPermyriad: number;
  readonly diversityPermyriad: number;
  readonly weightedScorePermyriad: number;
}

export interface CandidateGenerationFailure {
  readonly stage: "generation";
  readonly code: "OPERATION_BUDGET_TOO_SMALL" | "NO_CONNECTION_PATH";
  readonly message: string;
}

export interface CandidateCompilationFailure {
  readonly stage: "compile";
  readonly code: "COMPILATION_REJECTED";
  readonly message: string;
  readonly issues: readonly CompilationIssue[];
}

export interface CandidateValidationFailure {
  readonly stage: "validation";
  readonly code: "HARD_VALIDATION_REJECTED";
  readonly message: string;
}

export interface CandidateDeduplicationFailure {
  readonly stage: "deduplication";
  readonly code: "DUPLICATE_STRUCTURAL_HASH";
  readonly message: string;
  readonly duplicateOfCandidateId: string;
}

export type CandidateFailureEvidence =
  | CandidateGenerationFailure
  | CandidateCompilationFailure
  | CandidateValidationFailure
  | CandidateDeduplicationFailure;

interface CandidateIdentity {
  readonly candidateId: string;
  readonly strategyId: string;
  readonly shape: SupportedShape;
  readonly lineage: CandidateLineage;
}

export interface FailedCandidateAttempt extends CandidateIdentity {
  readonly status: "failed";
  readonly program: BuildProgramV1 | null;
  readonly programHash: Sha256Digest | null;
  readonly structuralHash: null;
  readonly document: null;
  readonly patch: null;
  readonly validationReport: null;
  readonly metrics: null;
  readonly rank: null;
  readonly failure:
    CandidateGenerationFailure | CandidateCompilationFailure | CandidateValidationFailure;
}

export interface DuplicateCandidateAttempt extends CandidateIdentity {
  readonly status: "duplicate";
  readonly program: BuildProgramV1;
  readonly programHash: Sha256Digest;
  readonly structuralHash: Sha256Digest;
  readonly document: null;
  readonly patch: null;
  readonly validationReport: null;
  readonly metrics: null;
  readonly rank: null;
  readonly failure: CandidateDeduplicationFailure;
}

export interface HardValidCandidate extends CandidateIdentity {
  readonly status: "hard-valid";
  readonly program: BuildProgramV1;
  readonly programHash: Sha256Digest;
  readonly structuralHash: Sha256Digest;
  readonly document: BrickDocumentV1;
  readonly patch: AssemblyPatchV1;
  readonly validationReport: ValidationReportV1;
  readonly metrics: CandidateMetrics;
  readonly rank: number;
  readonly failure: null;
}

export type CandidateAttempt =
  FailedCandidateAttempt | DuplicateCandidateAttempt | HardValidCandidate;

export interface DeterministicMakerPopulationInput {
  readonly jobId: string;
  readonly document: unknown;
  readonly brief: unknown;
  readonly scope: unknown;
}

export interface MakerPopulationSuccess {
  readonly ok: true;
  readonly makerVersion: string;
  readonly rankingPolicyHash: Sha256Digest;
  readonly jobId: string;
  readonly normalizedBrief: NormalizedTextBrief;
  readonly attempts: readonly CandidateAttempt[];
  readonly rankedCandidates: readonly HardValidCandidate[];
}

export interface MakerPopulationFailure {
  readonly ok: false;
  readonly failure: MakerInputFailure;
}

export type MakerPopulationResult = MakerPopulationSuccess | MakerPopulationFailure;

export interface CapturedMakerPopulationFailure {
  readonly ok: false;
  readonly failure: MakerInputFailure | CapturedProgramFailure;
}

export type CapturedMakerPopulationResult = MakerPopulationSuccess | CapturedMakerPopulationFailure;
