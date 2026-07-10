import type { ArtifactRefV1, RunEventV1 } from "@lego-studio/protocol";

export const TEST_RUN_NAMESPACE = "test" as const;
export const EMPTY_EVENT_HASH = `sha256:${"0".repeat(64)}` as const;

export type RunState =
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

export type ProviderAttemptState =
  "created" | "running" | "succeeded" | "failed" | "timedOut" | "cancelled";

export type CandidateState =
  | "received"
  | "compiled"
  | "hardInvalid"
  | "diagnosticRendered"
  | "diagnosticReviewed"
  | "hardValid"
  | "rendered"
  | "critiqued"
  | "ranked"
  | "persistenceFailed"
  | "presented"
  | "compileRejected"
  | "archived"
  | "cancelled"
  | "processingFailed";

export interface RunTransition {
  readonly subject: "run";
  readonly subjectId: string;
  readonly from: RunState | null;
  readonly to: RunState;
}

export interface ProviderAttemptTransition {
  readonly subject: "providerAttempt";
  readonly subjectId: string;
  readonly from: ProviderAttemptState | null;
  readonly to: ProviderAttemptState;
}

export interface CandidateTransition {
  readonly subject: "candidate";
  readonly subjectId: string;
  readonly from: CandidateState | null;
  readonly to: CandidateState;
}

export type NativeRunTransition = RunTransition | ProviderAttemptTransition | CandidateTransition;

export interface AppendRunEventInput {
  readonly schemaVersion: "lego.test-run-append/1";
  readonly namespace: "test";
  readonly expectedRunId: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly cancellationGeneration: number;
  readonly transition: NativeRunTransition;
  readonly artifactRefs: readonly ArtifactRefV1[];
}

export type DiagnosticReason =
  "stale-cancellation-generation" | "run-terminal" | "subject-terminal";

export interface StoredNativeRunEvent {
  readonly schemaVersion: "lego.test-native-run-event/1";
  readonly namespace: "test";
  readonly cancellationGeneration: number;
  readonly diagnostic: boolean;
  readonly diagnosticReason?: DiagnosticReason;
  readonly requestDigest: `sha256:${string}`;
  readonly transition: NativeRunTransition;
  readonly artifactRefs: readonly ArtifactRefV1[];
  readonly event: RunEventV1;
}

export interface RunLedgerSnapshot {
  readonly namespace: "test";
  readonly runId: string;
  readonly runState: RunState | null;
  readonly runRecoveryCheckpoint: RunState | null;
  readonly runRecoveryCancellationGeneration: number | null;
  readonly cancellationGeneration: number;
  readonly eventCount: number;
  readonly eventRoot: `sha256:${string}`;
  readonly providerAttempts: readonly {
    readonly id: string;
    readonly state: ProviderAttemptState;
  }[];
  readonly candidates: readonly {
    readonly id: string;
    readonly state: CandidateState;
    readonly recoveryCheckpoint?: CandidateState;
  }[];
}

export interface AppendRunEventResult {
  readonly disposition: "committed" | "diagnostic" | "idempotent";
  readonly event: StoredNativeRunEvent;
}

export interface FinalizeRunBundleInput {
  readonly schemaVersion: "lego.test-run-finalize/1";
  readonly namespace: "test";
  readonly expectedRunId: string;
  readonly expectedEventCount: number;
  readonly expectedEventRoot: `sha256:${string}`;
  readonly append: AppendRunEventInput;
}

/** Trusted local CAS read interface only; network-backed resolvers are outside this test slice. */
export interface ArtifactResolver {
  read(reference: ArtifactRefV1): Promise<Uint8Array>;
}

export interface RunLedgerLimits {
  readonly maxEvents: number;
  readonly maxProviderAttempts: number;
  readonly maxCandidates: number;
  readonly maxArtifactRefsPerEvent: number;
  readonly maxReferencedBytesPerEvent: number;
  readonly maxArtifactRefsPerRun: number;
  readonly maxReferencedBytesPerRun: number;
  readonly maxPendingAppends: number;
  readonly maxPendingAppendBytes: number;
  readonly maxRecordBytes: number;
  readonly maxLedgerBytes: number;
}

export interface TestRunLedgerOptions {
  readonly root: string;
  readonly namespace: "test";
  readonly expectedRunId: string;
  readonly artifactResolver: ArtifactResolver;
  readonly limits?: Partial<RunLedgerLimits>;
}

export interface TestRunLedger {
  readonly namespace: "test";
  readonly runId: string;
  append(input: AppendRunEventInput): Promise<AppendRunEventResult>;
  finalizeBundle(input: FinalizeRunBundleInput): Promise<AppendRunEventResult>;
  events(): readonly StoredNativeRunEvent[];
  snapshot(): RunLedgerSnapshot;
  close(): Promise<void>;
}

export type RunLedgerErrorCode =
  | "INVALID_NAMESPACE"
  | "INVALID_ROOT"
  | "ROOT_NOT_OWNED"
  | "EXPECTED_RUN_MISMATCH"
  | "INVALID_RECORD"
  | "INVALID_TRANSITION"
  | "INVALID_CANCELLATION_GENERATION"
  | "RUN_NOT_QUIESCENT"
  | "IDEMPOTENCY_CONFLICT"
  | "ARTIFACT_UNRESOLVED"
  | "LEDGER_LIMIT_EXCEEDED"
  | "LEDGER_CORRUPTION"
  | "PERSISTENCE_FAILED"
  | "LEDGER_CLOSED"
  | "LEDGER_BUSY"
  | "POLICY_MISMATCH"
  | "STALE_CHECKPOINT"
  | "UNSAFE_PATH";

export class RunLedgerError extends Error {
  readonly code: RunLedgerErrorCode;

  constructor(code: RunLedgerErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RunLedgerError";
    this.code = code;
  }
}
