import { validateRunEventV1, type ArtifactRefV1, type RunEventV1 } from "@lego-studio/protocol";

import {
  EMPTY_EVENT_HASH,
  RunLedgerError,
  type AppendRunEventInput,
  type CandidateState,
  type DiagnosticReason,
  type NativeRunTransition,
  type ProviderAttemptState,
  type RunLedgerLimits,
  type RunLedgerSnapshot,
  type RunState,
  type StoredNativeRunEvent,
} from "./run-ledger-types.ts";
import { canonicalJson, requestDigest, sha256, transitionLabel } from "./run-ledger-codec.ts";
import {
  CANDIDATE_TRANSITIONS,
  PROVIDER_ATTEMPT_TRANSITIONS,
  RUN_TRANSITIONS,
  isTerminalCandidateState,
  isTerminalProviderAttemptState,
  isTerminalRunState,
} from "./run-ledger-policy.ts";
import {
  applyRecoveryCheckpoint,
  assertRunRecoveryTarget,
  handlePersistenceBoundary,
} from "./run-ledger-recovery.ts";
import { indexRunArtifactRefs } from "./run-ledger-artifact-index.ts";

export interface MutableRunLedgerState {
  readonly runId: string;
  runState: RunState | null;
  runRecoveryCheckpoint: RunState | null;
  runRecoveryCancellationGeneration: number | null;
  cancellationGeneration: number;
  readonly providerAttempts: Map<string, ProviderAttemptState>;
  readonly candidates: Map<string, CandidateState>;
  readonly candidateRecoveryCheckpoints: Map<string, CandidateState>;
  readonly artifactRefsById: Map<string, ArtifactRefV1>;
  readonly artifactRefsByCas: Map<string, ArtifactRefV1>;
  referencedArtifactBytes: number;
  readonly events: StoredNativeRunEvent[];
  readonly idempotency: Map<string, { digest: string; event: StoredNativeRunEvent }>;
}

interface TransitionEvaluation {
  readonly diagnostic: boolean;
  readonly diagnosticReason?: DiagnosticReason;
}

export function createLedgerState(runId: string): MutableRunLedgerState {
  return {
    runId,
    runState: null,
    runRecoveryCheckpoint: null,
    runRecoveryCancellationGeneration: null,
    cancellationGeneration: 0,
    providerAttempts: new Map(),
    candidates: new Map(),
    candidateRecoveryCheckpoints: new Map(),
    artifactRefsById: new Map(),
    artifactRefsByCas: new Map(),
    referencedArtifactBytes: 0,
    events: [],
    idempotency: new Map(),
  };
}

function assertDeclaredTransitionAllowed(transition: NativeRunTransition): void {
  if (transition.from === null) {
    const validCreation =
      (transition.subject === "run" && transition.to === "created") ||
      (transition.subject === "providerAttempt" && transition.to === "created") ||
      (transition.subject === "candidate" && transition.to === "received");
    if (validCreation) return;
    throw new RunLedgerError("INVALID_TRANSITION", "Subject creation starts in the wrong state");
  }
  const allowed =
    transition.subject === "run"
      ? RUN_TRANSITIONS[transition.from]
      : transition.subject === "providerAttempt"
        ? PROVIDER_ATTEMPT_TRANSITIONS[transition.from]
        : CANDIDATE_TRANSITIONS[transition.from];
  if (!allowed.includes(transition.to as never)) {
    throw new RunLedgerError(
      "INVALID_TRANSITION",
      `${transition.subject} cannot transition from ${transition.from} to ${transition.to}`,
    );
  }
}

function assertCurrentState(state: MutableRunLedgerState, transition: NativeRunTransition): void {
  if (transition.subject === "run") {
    if (transition.subjectId !== state.runId || state.runState !== transition.from) {
      throw new RunLedgerError("INVALID_TRANSITION", "Run transition does not match current state");
    }
    return;
  }
  const states =
    transition.subject === "providerAttempt" ? state.providerAttempts : state.candidates;
  const current = states.get(transition.subjectId) ?? null;
  if (current !== transition.from) {
    throw new RunLedgerError(
      "INVALID_TRANSITION",
      `${transition.subject} transition does not match current state`,
    );
  }
}

function assertOwnedWorkAdmission(
  state: MutableRunLedgerState,
  transition: NativeRunTransition,
  limits: RunLedgerLimits,
): void {
  if (transition.subject === "run") return;
  const isCreation = transition.from === null;
  if (handlePersistenceBoundary(state, transition)) return;
  if (isCreation && state.runState !== "running") {
    throw new RunLedgerError("INVALID_TRANSITION", "New owned work requires a running run");
  }
  if (
    transition.subject === "providerAttempt" &&
    isCreation &&
    state.providerAttempts.size >= limits.maxProviderAttempts
  ) {
    throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Provider attempt limit reached");
  }
  if (
    transition.subject === "candidate" &&
    isCreation &&
    state.candidates.size >= limits.maxCandidates
  ) {
    throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Candidate limit reached");
  }
  if (
    state.runState !== "running" &&
    state.runState !== "draining" &&
    state.runState !== "cancelling"
  ) {
    throw new RunLedgerError("INVALID_TRANSITION", "Owned work cannot advance in this run state");
  }
  if (state.runState === "cancelling") {
    const terminal =
      transition.subject === "providerAttempt"
        ? isTerminalProviderAttemptState(transition.to)
        : isTerminalCandidateState(transition.to) || transition.to === "persistenceFailed";
    if (!terminal) {
      throw new RunLedgerError(
        "INVALID_TRANSITION",
        "Cancelling runs accept only terminal or quarantine transitions",
      );
    }
  }
}

function isQuiescent(state: MutableRunLedgerState): boolean {
  return (
    [...state.providerAttempts.values()].every((item) => isTerminalProviderAttemptState(item)) &&
    [...state.candidates.values()].every((item) => isTerminalCandidateState(item))
  );
}

export function evaluateTransition(
  state: MutableRunLedgerState,
  input: AppendRunEventInput,
  limits: RunLedgerLimits,
): TransitionEvaluation {
  const { transition } = input;
  assertDeclaredTransitionAllowed(transition);
  if (transition.subject === "run" && transition.subjectId !== state.runId) {
    throw new RunLedgerError("EXPECTED_RUN_MISMATCH", "Run transition is bound to another run");
  }

  if (input.cancellationGeneration < state.cancellationGeneration) {
    return { diagnostic: true, diagnosticReason: "stale-cancellation-generation" };
  }
  if (state.runState && isTerminalRunState(state.runState)) {
    if (input.cancellationGeneration !== state.cancellationGeneration) {
      throw new RunLedgerError(
        "INVALID_CANCELLATION_GENERATION",
        "Terminal runs cannot advance their cancellation generation",
      );
    }
    return { diagnostic: true, diagnosticReason: "run-terminal" };
  }
  const startsCancellation =
    transition.subject === "run" &&
    transition.to === "cancelling" &&
    transition.from !== "persistenceFailed";
  const expectedGeneration = startsCancellation
    ? state.cancellationGeneration + 1
    : state.cancellationGeneration;
  if (input.cancellationGeneration !== expectedGeneration) {
    throw new RunLedgerError(
      "INVALID_CANCELLATION_GENERATION",
      "Event cancellation generation is not the current allowed generation",
    );
  }
  if (transition.subject === "providerAttempt") {
    const current = state.providerAttempts.get(transition.subjectId);
    if (current && isTerminalProviderAttemptState(current)) {
      return { diagnostic: true, diagnosticReason: "subject-terminal" };
    }
  }
  if (transition.subject === "candidate") {
    const current = state.candidates.get(transition.subjectId);
    if (current && isTerminalCandidateState(current)) {
      return { diagnostic: true, diagnosticReason: "subject-terminal" };
    }
  }
  assertCurrentState(state, transition);
  assertRunRecoveryTarget(state, transition, input.cancellationGeneration);
  assertOwnedWorkAdmission(state, transition, limits);
  if (transition.subject === "run" && isTerminalRunState(transition.to) && !isQuiescent(state)) {
    throw new RunLedgerError(
      "RUN_NOT_QUIESCENT",
      "A run cannot become terminal while owned work is active",
    );
  }
  if (
    transition.subject === "run" &&
    transition.to === "succeeded" &&
    ![...state.candidates.values()].includes("presented")
  ) {
    throw new RunLedgerError(
      "INVALID_TRANSITION",
      "A succeeded run requires at least one presented candidate",
    );
  }
  return { diagnostic: false };
}

function nativeEventCore(
  input: AppendRunEventInput,
  event: Omit<RunEventV1, "eventHash">,
  evaluation: TransitionEvaluation,
): Omit<StoredNativeRunEvent, "event"> & { readonly event: Omit<RunEventV1, "eventHash"> } {
  return {
    schemaVersion: "lego.test-native-run-event/1",
    namespace: "test",
    cancellationGeneration: input.cancellationGeneration,
    diagnostic: evaluation.diagnostic,
    ...(evaluation.diagnosticReason ? { diagnosticReason: evaluation.diagnosticReason } : {}),
    requestDigest: requestDigest(input),
    transition: input.transition,
    artifactRefs: input.artifactRefs,
    event,
  };
}

export function computeStoredEventHash(event: StoredNativeRunEvent): `sha256:${string}` {
  const protocolCore = {
    schemaVersion: event.event.schemaVersion,
    runId: event.event.runId,
    sequence: event.event.sequence,
    previousEventHash: event.event.previousEventHash,
    actorId: event.event.actorId,
    transition: event.event.transition,
    idempotencyKey: event.event.idempotencyKey,
    artifactHashes: event.event.artifactHashes,
  };
  return sha256(
    canonicalJson({
      schemaVersion: event.schemaVersion,
      namespace: event.namespace,
      cancellationGeneration: event.cancellationGeneration,
      diagnostic: event.diagnostic,
      ...(event.diagnosticReason ? { diagnosticReason: event.diagnosticReason } : {}),
      requestDigest: event.requestDigest,
      transition: event.transition,
      artifactRefs: event.artifactRefs,
      event: protocolCore,
    }),
  );
}

export function createStoredEvent(
  state: MutableRunLedgerState,
  input: AppendRunEventInput,
  limits: RunLedgerLimits,
): StoredNativeRunEvent {
  const evaluation = evaluateTransition(state, input, limits);
  const protocolCore = {
    schemaVersion: "lego.run-event/1",
    runId: state.runId,
    sequence: state.events.length,
    previousEventHash: state.events.at(-1)?.event.eventHash ?? EMPTY_EVENT_HASH,
    actorId: input.actorId,
    transition: transitionLabel(input.transition),
    idempotencyKey: input.idempotencyKey,
    artifactHashes: Object.freeze(input.artifactRefs.map(({ sha256: hash }) => hash)),
  } as const satisfies Omit<RunEventV1, "eventHash">;
  const core = nativeEventCore(input, protocolCore, evaluation);
  const eventHash = sha256(canonicalJson(core));
  const stored = Object.freeze({
    ...core,
    artifactRefs: Object.freeze([...core.artifactRefs]),
    event: Object.freeze({ ...protocolCore, eventHash }),
  }) as StoredNativeRunEvent;
  if (!validateRunEventV1(stored.event)) {
    throw new RunLedgerError("INVALID_RECORD", "Constructed event violates RunEventV1");
  }
  return stored;
}

function applyTransition(state: MutableRunLedgerState, event: StoredNativeRunEvent): void {
  if (event.diagnostic) return;
  const transition = event.transition;
  applyRecoveryCheckpoint(state, transition, event.cancellationGeneration);
  if (transition.subject === "run") {
    state.runState = transition.to;
    if (transition.to === "cancelling") {
      state.cancellationGeneration = event.cancellationGeneration;
    }
  } else if (transition.subject === "providerAttempt") {
    state.providerAttempts.set(transition.subjectId, transition.to);
  } else {
    state.candidates.set(transition.subjectId, transition.to);
  }
}

export function applyStoredEvent(
  state: MutableRunLedgerState,
  event: StoredNativeRunEvent,
  limits: RunLedgerLimits,
): void {
  const input: AppendRunEventInput = {
    schemaVersion: "lego.test-run-append/1",
    namespace: "test",
    expectedRunId: state.runId,
    actorId: event.event.actorId,
    idempotencyKey: event.event.idempotencyKey,
    cancellationGeneration: event.cancellationGeneration,
    transition: event.transition,
    artifactRefs: event.artifactRefs,
  };
  if (requestDigest(input) !== event.requestDigest) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Event request digest is inconsistent");
  }
  if (state.idempotency.has(input.idempotencyKey)) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Ledger repeats an idempotency key");
  }
  const expected = evaluateTransition(state, input, limits);
  if (
    expected.diagnostic !== event.diagnostic ||
    expected.diagnosticReason !== event.diagnosticReason
  ) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Event diagnostic disposition is inconsistent");
  }
  indexRunArtifactRefs(state, event.artifactRefs, limits);
  applyTransition(state, event);
  state.events.push(event);
  state.idempotency.set(input.idempotencyKey, { digest: event.requestDigest, event });
}

export function snapshotState(state: MutableRunLedgerState): RunLedgerSnapshot {
  const snapshot: RunLedgerSnapshot = {
    namespace: "test",
    runId: state.runId,
    runState: state.runState,
    runRecoveryCheckpoint: state.runRecoveryCheckpoint,
    runRecoveryCancellationGeneration: state.runRecoveryCancellationGeneration,
    cancellationGeneration: state.cancellationGeneration,
    eventCount: state.events.length,
    eventRoot: (state.events.at(-1)?.event.eventHash ?? EMPTY_EVENT_HASH) as `sha256:${string}`,
    providerAttempts: [...state.providerAttempts].map(([id, itemState]) =>
      Object.freeze({ id, state: itemState }),
    ),
    candidates: [...state.candidates].map(([id, itemState]) => {
      const recoveryCheckpoint = state.candidateRecoveryCheckpoints.get(id);
      return Object.freeze({
        id,
        state: itemState,
        ...(recoveryCheckpoint ? { recoveryCheckpoint } : {}),
      });
    }),
  };
  Object.freeze(snapshot.providerAttempts);
  Object.freeze(snapshot.candidates);
  return Object.freeze(snapshot);
}
