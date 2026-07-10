export type Sha256Digest = `sha256:${string}`;

export const HARNESS_VERSION = "lego.harness/1" as const;
export const MAKER_CAPTURE_VERSION = "lego.deterministic-maker-capture/1" as const;
export const MAKER_CAPTURE_MANIFEST_VERSION =
  "lego.deterministic-maker-capture-manifest/1" as const;
export const MAKER_REPLAY_REPORT_VERSION = "lego.deterministic-maker-replay-report/1" as const;

export interface CandidateReplayCheckpoint {
  readonly attemptIndex: number;
  readonly candidateId: string;
  readonly strategyId: string;
  readonly status: "failed" | "duplicate" | "hard-valid";
  readonly programHash: Sha256Digest | null;
  readonly structuralHash: Sha256Digest | null;
  readonly compilerSnapshotHash: Sha256Digest | null;
  readonly patchHash: Sha256Digest | null;
  readonly documentHash: Sha256Digest | null;
  readonly validationReportHash: Sha256Digest | null;
  readonly metricsHash: Sha256Digest | null;
  readonly rank: number | null;
  readonly candidateDigest: Sha256Digest;
}

export interface DeterministicMakerCaptureManifest {
  readonly schemaVersion: typeof MAKER_CAPTURE_MANIFEST_VERSION;
  readonly harnessVersion: typeof HARNESS_VERSION;
  readonly namespace: "test";
  readonly integrity: "unsealed";
  readonly authenticated: false;
  readonly boundary: "deterministic-recipe-results";
  readonly jobId: string;
  readonly protocolVersion: string;
  readonly generationVersion: string;
  readonly compilerSnapshotHash: Sha256Digest;
  readonly rankingPolicyHash: Sha256Digest;
  readonly replayPolicyHash: Sha256Digest;
  readonly baseDocumentHash: Sha256Digest;
  readonly truthSnapshotHash: Sha256Digest;
  readonly briefHash: Sha256Digest;
  readonly normalizedBriefHash: Sha256Digest | null;
  readonly scopeDigest: Sha256Digest;
  readonly requestHash: Sha256Digest;
  readonly requestByteLength: number;
  readonly capturedProgramsHash: Sha256Digest;
  readonly capturedProgramsByteLength: number;
  readonly populationHash: Sha256Digest;
  readonly populationByteLength: number;
  readonly resultOk: boolean;
  readonly candidates: readonly CandidateReplayCheckpoint[];
}

export interface DeterministicMakerCapture {
  readonly schemaVersion: typeof MAKER_CAPTURE_VERSION;
  readonly manifestHash: Sha256Digest;
  readonly manifest: DeterministicMakerCaptureManifest;
  readonly requestJson: string;
  readonly capturedProgramsJson: string;
  readonly populationJson: string;
}

export type MakerCaptureFailureCode =
  "INPUT_NOT_DATA_ONLY" | "CAPTURED_OUTPUT_NOT_DATA_ONLY" | "CAPTURE_SIZE_EXCEEDED";

export interface MakerCaptureFailure {
  readonly code: MakerCaptureFailureCode;
  readonly message: string;
}

export type MakerCaptureResult =
  | { readonly ok: true; readonly capture: DeterministicMakerCapture }
  | { readonly ok: false; readonly failure: MakerCaptureFailure };

export type MakerReplayFailureCode =
  | "CAPTURE_NOT_DATA_ONLY"
  | "CAPTURE_SHAPE_INVALID"
  | "MANIFEST_HASH_MISMATCH"
  | "REQUEST_HASH_MISMATCH"
  | "CAPTURED_PROGRAMS_HASH_MISMATCH"
  | "POPULATION_HASH_MISMATCH"
  | "REQUEST_NOT_CANONICAL"
  | "CAPTURED_PROGRAMS_NOT_CANONICAL"
  | "POPULATION_NOT_CANONICAL"
  | "MANIFEST_MISMATCH"
  | "REPLAY_DIVERGED"
  | "PATCH_VERIFICATION_FAILED";

export interface MakerReplayCheckpoint {
  readonly kind: "request" | "captured-output" | "population" | "candidate";
  readonly id: string;
  readonly expectedHash: Sha256Digest;
  readonly actualHash: Sha256Digest | null;
  readonly passed: boolean;
}

export interface DeterministicMakerReplayReport {
  readonly schemaVersion: typeof MAKER_REPLAY_REPORT_VERSION;
  readonly status: "passed" | "audit-only" | "failed";
  readonly failureCode: MakerReplayFailureCode | null;
  readonly failureMessage: string | null;
  readonly captureManifestHash: Sha256Digest | null;
  readonly requestHash: Sha256Digest | null;
  readonly capturedProgramsHash: Sha256Digest | null;
  readonly capturedPopulationHash: Sha256Digest | null;
  readonly replayedPopulationHash: Sha256Digest | null;
  readonly executedDownstreamReplay: boolean;
  readonly executedCompiler: boolean;
  readonly nonVacuous: boolean;
  readonly capturedResultOk: boolean | null;
  readonly checkedCandidateCount: number;
  readonly compiledCandidateCount: number;
  readonly hardValidCandidateCount: number;
  readonly patchVerifiedCandidateCount: number;
  readonly checkpoints: readonly MakerReplayCheckpoint[];
}
