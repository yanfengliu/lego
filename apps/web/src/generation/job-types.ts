export const GENERATION_CANDIDATE_LIMIT = 4 as const;
export const GENERATION_DIAGNOSTIC_LIMIT = 128 as const;

export type GenerationRunState =
  | "created"
  | "queued"
  | "running"
  | "draining"
  | "cancelling"
  | "cancelled"
  | "succeeded"
  | "failed"
  | "exhausted"
  | "persistenceFailed";

export type GenerationCandidateState =
  | "received"
  | "compiled"
  | "compileRejected"
  | "hardValid"
  | "hardInvalid"
  | "diagnosticRendered"
  | "diagnosticReviewed"
  | "rendered"
  | "critiqued"
  | "ranked"
  | "presented"
  | "archived"
  | "cancelled"
  | "processingFailed"
  | "persistenceFailed";

export type GenerationDiagnosticCode =
  | "DUPLICATE_CANDIDATE_ID"
  | "DUPLICATE_JOB_ID"
  | "INVALID_CANDIDATE_LINEAGE"
  | "INVALID_CANDIDATE_TRANSITION"
  | "INVALID_RUN_TRANSITION"
  | "MALFORMED_CANDIDATE"
  | "MALFORMED_JOB"
  | "NON_ACTIVE_JOB_EVENT"
  | "OVERLAPPING_JOB_REJECTED"
  | "OWNED_WORK_NOT_QUIESCED"
  | "POPULATION_LIMIT_REACHED"
  | "STALE_CANCELLATION_GENERATION"
  | "UNKNOWN_CANDIDATE";

export type Sha256Digest = `sha256:${string}`;

export interface CandidateIdentity {
  readonly candidateId: string;
  readonly parentCandidateId: string | null;
  readonly programHash: Sha256Digest;
}

export interface CandidateTransition {
  readonly from: GenerationCandidateState | null;
  readonly to: GenerationCandidateState;
  readonly cancellationGeneration: number;
}

export interface GenerationCandidate {
  readonly identity: CandidateIdentity;
  readonly state: GenerationCandidateState;
  readonly transitions: readonly CandidateTransition[];
}

export interface RunTransition {
  readonly from: GenerationRunState | null;
  readonly to: GenerationRunState;
  readonly cancellationGeneration: number;
}

export interface GenerationJobState {
  readonly jobId: string;
  readonly baseRevision: string;
  readonly baseDocumentHash: Sha256Digest;
  readonly observedRevision: string;
  readonly observedDocumentHash: Sha256Digest;
  readonly baseStatus: "current" | "stale";
  readonly cancellationGeneration: number;
  readonly runState: GenerationRunState;
  readonly runTransitions: readonly RunTransition[];
  readonly candidates: readonly GenerationCandidate[];
}

export interface GenerationDiagnostic {
  readonly sequence: number;
  readonly code: GenerationDiagnosticCode;
  readonly message: string;
  readonly jobId: string | null;
  readonly candidateId: string | null;
}

export interface GenerationSessionState {
  readonly schemaVersion: "lego.web-generation-session/1";
  readonly authority: {
    readonly namespace: "local-test";
    readonly authoritative: false;
  };
  readonly activeJob: GenerationJobState | null;
  readonly completedJobs: readonly GenerationJobState[];
  readonly diagnostics: readonly GenerationDiagnostic[];
}

export type GenerationSessionEvent =
  | {
      readonly type: "jobStarted";
      readonly jobId: string;
      readonly baseRevision: string;
      readonly baseDocumentHash: string;
    }
  | {
      readonly type: "runTransitioned";
      readonly jobId: string;
      readonly cancellationGeneration: number;
      readonly nextState: GenerationRunState;
    }
  | {
      readonly type: "candidateReceived";
      readonly jobId: string;
      readonly cancellationGeneration: number;
      readonly candidate: unknown;
    }
  | {
      readonly type: "candidateTransitioned";
      readonly jobId: string;
      readonly cancellationGeneration: number;
      readonly candidateId: string;
      readonly nextState: GenerationCandidateState;
    }
  | {
      readonly type: "cancellationRequested";
      readonly jobId: string;
    }
  | {
      readonly type: "documentChanged";
      readonly revision: string;
      readonly documentHash: string;
    };
