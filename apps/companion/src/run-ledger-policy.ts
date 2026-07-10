import { PROTOCOL_VERSION, SCHEMA_IDS } from "@lego-studio/protocol";

import { APPEND_SNAPSHOT_POLICY, canonicalJson, sha256 } from "./run-ledger-codec.ts";
import type {
  CandidateState,
  DiagnosticReason,
  ProviderAttemptState,
  RunState,
} from "./run-ledger-types.ts";

export const RUN_LEDGER_POLICY_VERSION = "lego.test-run-ledger-policy/1" as const;

function freezeTransitions<State extends string>(
  transitions: Record<State, State[]>,
): Readonly<Record<State, readonly State[]>> {
  for (const state of Object.keys(transitions) as State[]) Object.freeze(transitions[state]);
  return Object.freeze(transitions);
}

export const RUN_TRANSITIONS = freezeTransitions<RunState>({
  created: ["queued", "cancelling", "failed", "persistenceFailed"],
  queued: ["running", "draining", "cancelling", "failed", "persistenceFailed"],
  running: ["draining", "cancelling", "failed", "persistenceFailed"],
  draining: ["succeeded", "exhausted", "failed", "cancelling", "persistenceFailed"],
  cancelling: ["cancelled", "persistenceFailed"],
  persistenceFailed: ["queued", "running", "draining", "cancelling", "failed"],
  succeeded: [],
  exhausted: [],
  failed: [],
  cancelled: [],
});

export const PROVIDER_ATTEMPT_TRANSITIONS = freezeTransitions<ProviderAttemptState>({
  created: ["running", "failed", "cancelled"],
  running: ["succeeded", "failed", "timedOut", "cancelled"],
  succeeded: [],
  failed: [],
  timedOut: [],
  cancelled: [],
});

export const CANDIDATE_TRANSITIONS = freezeTransitions<CandidateState>({
  received: [
    "compiled",
    "compileRejected",
    "archived",
    "cancelled",
    "processingFailed",
    "persistenceFailed",
  ],
  compiled: [
    "hardValid",
    "hardInvalid",
    "archived",
    "cancelled",
    "processingFailed",
    "persistenceFailed",
  ],
  hardInvalid: [
    "diagnosticRendered",
    "archived",
    "cancelled",
    "processingFailed",
    "persistenceFailed",
  ],
  diagnosticRendered: [
    "diagnosticReviewed",
    "archived",
    "cancelled",
    "processingFailed",
    "persistenceFailed",
  ],
  diagnosticReviewed: ["archived", "cancelled", "processingFailed", "persistenceFailed"],
  hardValid: ["rendered", "archived", "cancelled", "processingFailed", "persistenceFailed"],
  rendered: ["critiqued", "archived", "cancelled", "processingFailed", "persistenceFailed"],
  critiqued: ["ranked", "archived", "cancelled", "processingFailed", "persistenceFailed"],
  ranked: ["presented", "archived", "cancelled", "processingFailed", "persistenceFailed"],
  persistenceFailed: [
    "received",
    "compiled",
    "hardInvalid",
    "diagnosticRendered",
    "diagnosticReviewed",
    "hardValid",
    "rendered",
    "critiqued",
    "ranked",
    "archived",
    "cancelled",
    "processingFailed",
  ],
  presented: [],
  compileRejected: [],
  archived: [],
  cancelled: [],
  processingFailed: [],
});

const TERMINAL_RUN_STATE_VALUES = Object.freeze<RunState[]>([
  "succeeded",
  "exhausted",
  "failed",
  "cancelled",
]);
const TERMINAL_PROVIDER_ATTEMPT_STATE_VALUES = Object.freeze<ProviderAttemptState[]>([
  "succeeded",
  "failed",
  "timedOut",
  "cancelled",
]);
const TERMINAL_CANDIDATE_STATE_VALUES = Object.freeze<CandidateState[]>([
  "presented",
  "compileRejected",
  "archived",
  "cancelled",
  "processingFailed",
]);
const TERMINAL_CANDIDATE_QUARANTINE_VALUES = Object.freeze<CandidateState[]>([
  "archived",
  "cancelled",
  "processingFailed",
]);

const terminalRunStates = new Set(TERMINAL_RUN_STATE_VALUES);
const terminalProviderAttemptStates = new Set(TERMINAL_PROVIDER_ATTEMPT_STATE_VALUES);
const terminalCandidateStates = new Set(TERMINAL_CANDIDATE_STATE_VALUES);
const terminalCandidateQuarantineStates = new Set(TERMINAL_CANDIDATE_QUARANTINE_VALUES);

export function isTerminalRunState(state: RunState): boolean {
  return terminalRunStates.has(state);
}

export function isTerminalProviderAttemptState(state: ProviderAttemptState): boolean {
  return terminalProviderAttemptStates.has(state);
}

export function isTerminalCandidateState(state: CandidateState): boolean {
  return terminalCandidateStates.has(state);
}

export function isTerminalCandidateQuarantineState(state: CandidateState): boolean {
  return terminalCandidateQuarantineStates.has(state);
}

export const RUN_RECOVERY_TARGET = Object.freeze<
  Record<
    Exclude<RunState, "persistenceFailed" | "succeeded" | "exhausted" | "failed" | "cancelled">,
    RunState
  >
>({
  created: "queued",
  queued: "queued",
  running: "running",
  draining: "draining",
  cancelling: "cancelling",
});

const POLICY_DESCRIPTOR = Object.freeze({
  policyVersion: RUN_LEDGER_POLICY_VERSION,
  namespace: "test",
  protocolVersion: PROTOCOL_VERSION,
  schemaIds: Object.freeze({
    artifactRef: SCHEMA_IDS.artifactRefV1,
    runEvent: SCHEMA_IDS.runEventV1,
    appendRequest: "lego.test-run-append/1",
    nativeEvent: "lego.test-native-run-event/1",
    binding: "lego.test-run-binding/2",
    writerLock: "lego.test-run-writer-lock/1",
  }),
  canonicalization: Object.freeze({
    version: "sorted-json-finite-data/1",
    appendSnapshot: APPEND_SNAPSHOT_POLICY,
  }),
  eventHash: "sha256-native-event-core/1",
  sequence: "zero-based-monotonic-hash-chain/1",
  cancellation: "generation-monotonic-stale-diagnostic/1",
  recovery: Object.freeze({
    semantics: "recorded-checkpoint-resume-target-or-terminal-quarantine/1",
    runTargets: RUN_RECOVERY_TARGET,
  }),
  ownedWorkAdmission: "running-progress-draining-finish-cancelling-quiesce/1",
  success: "requires-presented-candidate/1",
  artifactVerification: "intrinsic-length-cap-ordinary-snapshot-sha256/1",
  jsonlRecovery: "canonical-prefix-single-handle-truncate-fsync/1",
  directoryDurability: "atomic-rename-best-effort-parent-fsync/1",
  fileIdentity: "nofollow-single-hardlink-fstat/1",
  writerLease: "os-exclusive-create-manual-stale-recovery/1",
  pendingAdmission: "count-first-detached-canonical-byte-budget/1",
  artifactResolver: "trusted-local-cas-no-network-timeout/1",
  diagnostics: Object.freeze([
    "stale-cancellation-generation",
    "run-terminal",
    "subject-terminal",
  ] satisfies DiagnosticReason[]),
  transitions: Object.freeze({
    run: RUN_TRANSITIONS,
    providerAttempt: PROVIDER_ATTEMPT_TRANSITIONS,
    candidate: CANDIDATE_TRANSITIONS,
  }),
  terminals: Object.freeze({
    run: TERMINAL_RUN_STATE_VALUES,
    providerAttempt: TERMINAL_PROVIDER_ATTEMPT_STATE_VALUES,
    candidate: TERMINAL_CANDIDATE_STATE_VALUES,
    candidateQuarantine: TERMINAL_CANDIDATE_QUARANTINE_VALUES,
  }),
});

export const RUN_LEDGER_POLICY_HASH = sha256(canonicalJson(POLICY_DESCRIPTOR));
