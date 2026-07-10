import {
  RUN_RECOVERY_TARGET,
  isTerminalCandidateQuarantineState,
  isTerminalProviderAttemptState,
} from "./run-ledger-policy.ts";
import type { MutableRunLedgerState } from "./run-ledger-state.ts";
import { RunLedgerError, type NativeRunTransition } from "./run-ledger-types.ts";

export function assertRunRecoveryTarget(
  state: MutableRunLedgerState,
  transition: NativeRunTransition,
  cancellationGeneration: number,
): void {
  if (transition.subject !== "run" || transition.from !== "persistenceFailed") return;
  if (state.runRecoveryCheckpoint === null || state.runRecoveryCancellationGeneration === null) {
    throw new RunLedgerError("INVALID_TRANSITION", "Run recovery has no durable checkpoint");
  }
  if (cancellationGeneration !== state.runRecoveryCancellationGeneration) {
    throw new RunLedgerError(
      "INVALID_CANCELLATION_GENERATION",
      "Run recovery must preserve its recorded cancellation generation",
    );
  }
  const checkpoint = state.runRecoveryCheckpoint;
  if (!Object.prototype.hasOwnProperty.call(RUN_RECOVERY_TARGET, checkpoint)) {
    throw new RunLedgerError("INVALID_TRANSITION", "Run recovery checkpoint is invalid");
  }
  const resumeTarget = RUN_RECOVERY_TARGET[checkpoint as keyof typeof RUN_RECOVERY_TARGET];
  if (transition.to !== resumeTarget && transition.to !== "failed") {
    throw new RunLedgerError(
      "INVALID_TRANSITION",
      "Run recovery may return only to its exact checkpoint or fail terminally",
    );
  }
}

function assertCandidateRecoveryTarget(
  state: MutableRunLedgerState,
  transition: Extract<NativeRunTransition, { subject: "candidate" }>,
): void {
  const checkpoint = state.candidateRecoveryCheckpoints.get(transition.subjectId);
  if (!checkpoint) {
    throw new RunLedgerError("INVALID_TRANSITION", "Candidate recovery has no durable checkpoint");
  }
  if (transition.to !== checkpoint && !isTerminalCandidateQuarantineState(transition.to)) {
    throw new RunLedgerError(
      "INVALID_TRANSITION",
      "Candidate recovery may return only to its exact checkpoint or terminal quarantine",
    );
  }
}

export function handlePersistenceBoundary(
  state: MutableRunLedgerState,
  transition: NativeRunTransition,
): boolean {
  if (state.runState === "persistenceFailed") {
    if (
      transition.subject === "providerAttempt" &&
      transition.from !== null &&
      isTerminalProviderAttemptState(transition.to)
    ) {
      return true;
    }
    if (transition.subject === "candidate") {
      if (
        transition.from !== null &&
        transition.from !== "persistenceFailed" &&
        transition.to === "persistenceFailed"
      ) {
        return true;
      }
      if (
        transition.from === "persistenceFailed" &&
        isTerminalCandidateQuarantineState(transition.to)
      ) {
        assertCandidateRecoveryTarget(state, transition);
        return true;
      }
    }
    throw new RunLedgerError(
      "INVALID_TRANSITION",
      "Owned work cannot resume until the enclosing run leaves persistenceFailed",
    );
  }
  if (transition.subject === "candidate" && transition.to === "persistenceFailed") {
    throw new RunLedgerError(
      "INVALID_TRANSITION",
      "The enclosing run must enter persistenceFailed before its candidate",
    );
  }
  if (transition.subject === "candidate" && transition.from === "persistenceFailed") {
    assertCandidateRecoveryTarget(state, transition);
  }
  return false;
}

export function applyRecoveryCheckpoint(
  state: MutableRunLedgerState,
  transition: NativeRunTransition,
  cancellationGeneration: number,
): void {
  if (transition.subject === "run") {
    if (transition.to === "persistenceFailed" && transition.from !== null) {
      state.runRecoveryCheckpoint = transition.from;
      state.runRecoveryCancellationGeneration = cancellationGeneration;
    } else if (transition.from === "persistenceFailed") {
      state.runRecoveryCheckpoint = null;
      state.runRecoveryCancellationGeneration = null;
    }
    return;
  }
  if (transition.subject !== "candidate") return;
  if (transition.to === "persistenceFailed" && transition.from !== null) {
    state.candidateRecoveryCheckpoints.set(transition.subjectId, transition.from);
  } else if (transition.from === "persistenceFailed") {
    state.candidateRecoveryCheckpoints.delete(transition.subjectId);
  }
}
