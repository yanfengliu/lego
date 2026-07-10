import {
  canTransitionCandidate,
  canTransitionRun,
  isTerminalCandidateState,
  isTerminalRunState,
} from "./job-transitions";
import {
  GENERATION_CANDIDATE_LIMIT,
  GENERATION_DIAGNOSTIC_LIMIT,
  type CandidateIdentity,
  type CandidateTransition,
  type GenerationCandidate,
  type GenerationDiagnosticCode,
  type GenerationJobState,
  type GenerationSessionEvent,
  type GenerationSessionState,
  type RunTransition,
  type Sha256Digest,
} from "./job-types";

export * from "./job-types";

const AUTHORITY = Object.freeze({ namespace: "local-test", authoritative: false } as const);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

function freezeTransition<T extends CandidateTransition | RunTransition>(transition: T): T {
  return Object.freeze(transition);
}

function freezeCandidate(candidate: GenerationCandidate): GenerationCandidate {
  return Object.freeze({
    ...candidate,
    identity: Object.isFrozen(candidate.identity)
      ? candidate.identity
      : Object.freeze({ ...candidate.identity }),
    transitions: Object.freeze([...candidate.transitions]),
  });
}

function freezeJob(job: GenerationJobState): GenerationJobState {
  return Object.freeze({
    ...job,
    runTransitions: Object.freeze([...job.runTransitions]),
    candidates: Object.freeze([...job.candidates]),
  });
}

function freezeSession(session: GenerationSessionState): GenerationSessionState {
  return Object.freeze({
    ...session,
    authority: AUTHORITY,
    completedJobs: Object.freeze([...session.completedJobs]),
    diagnostics: Object.freeze([...session.diagnostics]),
  });
}

export function createGenerationSession(): GenerationSessionState {
  return freezeSession({
    schemaVersion: "lego.web-generation-session/1",
    authority: AUTHORITY,
    activeJob: null,
    completedJobs: [],
    diagnostics: [],
  });
}

function appendDiagnostic(
  session: GenerationSessionState,
  code: GenerationDiagnosticCode,
  message: string,
  jobId: string | null,
  candidateId: string | null = null,
): GenerationSessionState {
  const diagnostic = Object.freeze({
    sequence: (session.diagnostics.at(-1)?.sequence ?? 0) + 1,
    code,
    message,
    jobId,
    candidateId,
  });
  const diagnostics = [...session.diagnostics, diagnostic].slice(-GENERATION_DIAGNOSTIC_LIMIT);
  return freezeSession({ ...session, diagnostics });
}

function withActiveJob(
  session: GenerationSessionState,
  activeJob: GenerationJobState,
): GenerationSessionState {
  return freezeSession({ ...session, activeJob: freezeJob(activeJob) });
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function isDigest(value: unknown): value is Sha256Digest {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function parseCandidateIdentity(value: unknown): CandidateIdentity | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join("\0") !== ["candidateId", "parentCandidateId", "programHash"].join("\0")) {
    return null;
  }
  if (!isIdentifier(record.candidateId) || !isDigest(record.programHash)) return null;
  if (record.parentCandidateId !== null && !isIdentifier(record.parentCandidateId)) return null;
  return Object.freeze({
    candidateId: record.candidateId,
    parentCandidateId: record.parentCandidateId,
    programHash: record.programHash,
  });
}

function requireActiveEventJob(
  session: GenerationSessionState,
  jobId: string,
  cancellationGeneration?: number,
): { readonly session: GenerationSessionState; readonly job: GenerationJobState } | null {
  const job = session.activeJob;
  if (!job || job.jobId !== jobId) return null;
  if (
    cancellationGeneration !== undefined &&
    cancellationGeneration !== job.cancellationGeneration
  ) {
    return null;
  }
  return { session, job };
}

function eventMismatchDiagnostic(
  session: GenerationSessionState,
  jobId: string,
  cancellationGeneration?: number,
  candidateId: string | null = null,
): GenerationSessionState {
  const job = session.activeJob;
  return job?.jobId === jobId && cancellationGeneration !== undefined
    ? appendDiagnostic(
        session,
        "STALE_CANCELLATION_GENERATION",
        `Ignored event for cancellation generation ${cancellationGeneration}; current generation is ${job.cancellationGeneration}`,
        jobId,
        candidateId,
      )
    : appendDiagnostic(
        session,
        "NON_ACTIVE_JOB_EVENT",
        `Ignored event for non-active job ${jobId}`,
        jobId,
        candidateId,
      );
}

function allCandidatesTerminal(job: GenerationJobState): boolean {
  return job.candidates.every(({ state }) => isTerminalCandidateState(state));
}

function reduceJobStarted(
  session: GenerationSessionState,
  event: Extract<GenerationSessionEvent, { type: "jobStarted" }>,
): GenerationSessionState {
  if (
    !isIdentifier(event.jobId) ||
    !isIdentifier(event.baseRevision) ||
    !isDigest(event.baseDocumentHash)
  ) {
    return appendDiagnostic(
      session,
      "MALFORMED_JOB",
      "Rejected a malformed local generation job",
      isIdentifier(event.jobId) ? event.jobId : null,
    );
  }
  const active = session.activeJob;
  if (active && !isTerminalRunState(active.runState)) {
    return appendDiagnostic(
      session,
      "OVERLAPPING_JOB_REJECTED",
      `Job ${event.jobId} cannot overlap active job ${active.jobId}`,
      event.jobId,
    );
  }
  if (
    active?.jobId === event.jobId ||
    session.completedJobs.some(({ jobId }) => jobId === event.jobId)
  ) {
    return appendDiagnostic(
      session,
      "DUPLICATE_JOB_ID",
      `Job ID ${event.jobId} has already been used in this session`,
      event.jobId,
    );
  }
  const runTransition = freezeTransition({
    from: null,
    to: "created" as const,
    cancellationGeneration: 0,
  });
  const job = freezeJob({
    jobId: event.jobId,
    baseRevision: event.baseRevision,
    baseDocumentHash: event.baseDocumentHash,
    observedRevision: event.baseRevision,
    observedDocumentHash: event.baseDocumentHash,
    baseStatus: "current",
    cancellationGeneration: 0,
    runState: "created",
    runTransitions: [runTransition],
    candidates: [],
  });
  return freezeSession({
    ...session,
    activeJob: job,
    completedJobs: active ? [...session.completedJobs, active] : session.completedJobs,
  });
}

function reduceRunTransitioned(
  session: GenerationSessionState,
  event: Extract<GenerationSessionEvent, { type: "runTransitioned" }>,
): GenerationSessionState {
  const matched = requireActiveEventJob(session, event.jobId, event.cancellationGeneration);
  if (!matched) {
    return eventMismatchDiagnostic(session, event.jobId, event.cancellationGeneration);
  }
  const { job } = matched;
  if (event.nextState === "cancelling" || !canTransitionRun(job.runState, event.nextState)) {
    return appendDiagnostic(
      session,
      "INVALID_RUN_TRANSITION",
      `Run cannot transition from ${job.runState} to ${event.nextState}`,
      job.jobId,
    );
  }
  if (isTerminalRunState(event.nextState) && !allCandidatesTerminal(job)) {
    return appendDiagnostic(
      session,
      "OWNED_WORK_NOT_QUIESCED",
      `Run cannot enter ${event.nextState} while candidate work remains active`,
      job.jobId,
    );
  }
  if (
    event.nextState === "succeeded" &&
    !job.candidates.some(({ state }) => state === "presented")
  ) {
    return appendDiagnostic(
      session,
      "INVALID_RUN_TRANSITION",
      "A succeeded run requires at least one presented candidate",
      job.jobId,
    );
  }
  const transition = freezeTransition({
    from: job.runState,
    to: event.nextState,
    cancellationGeneration: job.cancellationGeneration,
  });
  return withActiveJob(session, {
    ...job,
    runState: event.nextState,
    runTransitions: [...job.runTransitions, transition],
  });
}

function reduceCandidateReceived(
  session: GenerationSessionState,
  event: Extract<GenerationSessionEvent, { type: "candidateReceived" }>,
): GenerationSessionState {
  const matched = requireActiveEventJob(session, event.jobId, event.cancellationGeneration);
  if (!matched) {
    return eventMismatchDiagnostic(session, event.jobId, event.cancellationGeneration);
  }
  const { job } = matched;
  if (job.runState !== "running") {
    return appendDiagnostic(
      session,
      "INVALID_RUN_TRANSITION",
      `Candidates cannot be received while the run is ${job.runState}`,
      job.jobId,
    );
  }
  const identity = parseCandidateIdentity(event.candidate);
  if (!identity) {
    return appendDiagnostic(
      session,
      "MALFORMED_CANDIDATE",
      "Rejected a malformed candidate without affecting its siblings",
      job.jobId,
    );
  }
  if (
    job.candidates.some(({ identity: existing }) => existing.candidateId === identity.candidateId)
  ) {
    return appendDiagnostic(
      session,
      "DUPLICATE_CANDIDATE_ID",
      `Candidate ID ${identity.candidateId} already exists`,
      job.jobId,
      identity.candidateId,
    );
  }
  if (
    identity.parentCandidateId !== null &&
    !job.candidates.some(
      ({ identity: existing }) => existing.candidateId === identity.parentCandidateId,
    )
  ) {
    return appendDiagnostic(
      session,
      "INVALID_CANDIDATE_LINEAGE",
      `Candidate ${identity.candidateId} references an unknown parent`,
      job.jobId,
      identity.candidateId,
    );
  }
  if (job.candidates.length >= GENERATION_CANDIDATE_LIMIT) {
    return appendDiagnostic(
      session,
      "POPULATION_LIMIT_REACHED",
      `Candidate population is limited to ${GENERATION_CANDIDATE_LIMIT}`,
      job.jobId,
      identity.candidateId,
    );
  }
  const transition = freezeTransition({
    from: null,
    to: "received" as const,
    cancellationGeneration: job.cancellationGeneration,
  });
  const candidate = freezeCandidate({
    identity,
    state: "received",
    transitions: [transition],
  });
  return withActiveJob(session, {
    ...job,
    candidates: [...job.candidates, candidate],
  });
}

function reduceCandidateTransitioned(
  session: GenerationSessionState,
  event: Extract<GenerationSessionEvent, { type: "candidateTransitioned" }>,
): GenerationSessionState {
  const matched = requireActiveEventJob(session, event.jobId, event.cancellationGeneration);
  if (!matched) {
    return eventMismatchDiagnostic(
      session,
      event.jobId,
      event.cancellationGeneration,
      event.candidateId,
    );
  }
  const { job } = matched;
  const index = job.candidates.findIndex(
    ({ identity }) => identity.candidateId === event.candidateId,
  );
  const candidate = job.candidates[index];
  if (!candidate) {
    return appendDiagnostic(
      session,
      "UNKNOWN_CANDIDATE",
      `Candidate ${event.candidateId} does not exist`,
      job.jobId,
      event.candidateId,
    );
  }
  if (
    (job.runState === "cancelling" &&
      event.nextState !== "cancelled" &&
      event.nextState !== "persistenceFailed") ||
    !canTransitionCandidate(candidate.state, event.nextState)
  ) {
    return appendDiagnostic(
      session,
      "INVALID_CANDIDATE_TRANSITION",
      `Candidate cannot transition from ${candidate.state} to ${event.nextState}`,
      job.jobId,
      event.candidateId,
    );
  }
  const transition = freezeTransition({
    from: candidate.state,
    to: event.nextState,
    cancellationGeneration: job.cancellationGeneration,
  });
  const nextCandidate = freezeCandidate({
    identity: candidate.identity,
    state: event.nextState,
    transitions: [...candidate.transitions, transition],
  });
  const candidates = [...job.candidates];
  candidates[index] = nextCandidate;
  return withActiveJob(session, { ...job, candidates });
}

function reduceCancellationRequested(
  session: GenerationSessionState,
  event: Extract<GenerationSessionEvent, { type: "cancellationRequested" }>,
): GenerationSessionState {
  const job = session.activeJob;
  if (!job || job.jobId !== event.jobId) {
    return eventMismatchDiagnostic(session, event.jobId);
  }
  if (job.runState === "cancelling" || job.runState === "cancelled") return session;
  if (!canTransitionRun(job.runState, "cancelling")) {
    return appendDiagnostic(
      session,
      "INVALID_RUN_TRANSITION",
      `Run in ${job.runState} cannot be cancelled`,
      job.jobId,
    );
  }
  const cancellationGeneration = job.cancellationGeneration + 1;
  const transition = freezeTransition({
    from: job.runState,
    to: "cancelling" as const,
    cancellationGeneration,
  });
  return withActiveJob(session, {
    ...job,
    cancellationGeneration,
    runState: "cancelling",
    runTransitions: [...job.runTransitions, transition],
  });
}

function reduceDocumentChanged(
  session: GenerationSessionState,
  event: Extract<GenerationSessionEvent, { type: "documentChanged" }>,
): GenerationSessionState {
  const job = session.activeJob;
  if (!job || !isIdentifier(event.revision) || !isDigest(event.documentHash)) return session;
  if (job.observedRevision === event.revision && job.observedDocumentHash === event.documentHash) {
    return session;
  }
  const baseStatus =
    event.revision === job.baseRevision && event.documentHash === job.baseDocumentHash
      ? "current"
      : "stale";
  return withActiveJob(session, {
    ...job,
    observedRevision: event.revision,
    observedDocumentHash: event.documentHash,
    baseStatus,
  });
}

export function reduceGenerationSession(
  session: GenerationSessionState,
  event: GenerationSessionEvent,
): GenerationSessionState {
  switch (event.type) {
    case "jobStarted":
      return reduceJobStarted(session, event);
    case "runTransitioned":
      return reduceRunTransitioned(session, event);
    case "candidateReceived":
      return reduceCandidateReceived(session, event);
    case "candidateTransitioned":
      return reduceCandidateTransitioned(session, event);
    case "cancellationRequested":
      return reduceCancellationRequested(session, event);
    case "documentChanged":
      return reduceDocumentChanged(session, event);
  }
}
