import type { CandidateReplayCheckpointV1 } from "@lego-studio/protocol";

import type { CandidateState, NativeRunTransition } from "./run-ledger-types.ts";

export const RECORDER_EVENT_KEYS = Object.freeze({
  runCreated: "test-recorder-run-created",
  runQueued: "test-recorder-run-queued",
  runRunning: "test-recorder-run-running",
  attemptCreated: "test-recorder-attempt-created",
  attemptRunning: "test-recorder-attempt-running",
  attemptSucceeded: "test-recorder-attempt-succeeded",
  runDraining: "test-recorder-run-draining",
  finalize: "test-recorder-bundle-finalized",
});

export interface CandidateTransitionStep {
  readonly idempotencyKey: string;
  readonly transition: NativeRunTransition;
}

export function candidateTransitionSteps(
  candidate: CandidateReplayCheckpointV1,
): readonly CandidateTransitionStep[] {
  // Capture checkpoints are unsealed harness evidence. Until a released trusted
  // verifier replays them, the broker may record receipt and quarantine only.
  const states = ["received", "archived"] as const satisfies readonly CandidateState[];
  return states.map((state, index) => ({
    idempotencyKey: `test-recorder-candidate-${candidate.attemptIndex}-${index}`,
    transition: {
      subject: "candidate",
      subjectId: candidate.candidateId,
      from: index === 0 ? null : states[index - 1]!,
      to: state,
    },
  }));
}
