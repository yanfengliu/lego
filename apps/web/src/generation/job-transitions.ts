import type { GenerationCandidateState, GenerationRunState } from "./job-types";

const RUN_TRANSITIONS: Readonly<Record<GenerationRunState, readonly GenerationRunState[]>> = {
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
};

const CANDIDATE_TRANSITIONS: Readonly<
  Record<GenerationCandidateState, readonly GenerationCandidateState[]>
> = {
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
};

const TERMINAL_RUN_STATES = new Set<GenerationRunState>([
  "succeeded",
  "exhausted",
  "failed",
  "cancelled",
]);
const TERMINAL_CANDIDATE_STATES = new Set<GenerationCandidateState>([
  "presented",
  "compileRejected",
  "archived",
  "cancelled",
  "processingFailed",
]);

export function canTransitionRun(from: GenerationRunState, to: GenerationRunState): boolean {
  return RUN_TRANSITIONS[from].includes(to);
}

export function canTransitionCandidate(
  from: GenerationCandidateState,
  to: GenerationCandidateState,
): boolean {
  return CANDIDATE_TRANSITIONS[from].includes(to);
}

export function isTerminalRunState(state: GenerationRunState): boolean {
  return TERMINAL_RUN_STATES.has(state);
}

export function isTerminalCandidateState(state: GenerationCandidateState): boolean {
  return TERMINAL_CANDIDATE_STATES.has(state);
}
