import { describe, expect, it } from "vitest";

import {
  GENERATION_CANDIDATE_LIMIT,
  createGenerationSession,
  reduceGenerationSession,
  type GenerationCandidateState,
  type GenerationSessionState,
} from "./job-state";

const BASE_HASH = `sha256:${"1".repeat(64)}`;
const OTHER_HASH = `sha256:${"2".repeat(64)}`;

function startJob(state = createGenerationSession(), jobId = "local-job-1") {
  return reduceGenerationSession(state, {
    type: "jobStarted",
    jobId,
    baseRevision: "revision-1",
    baseDocumentHash: BASE_HASH,
  });
}

function startRunningJob() {
  let state = startJob();
  state = reduceGenerationSession(state, {
    type: "runTransitioned",
    jobId: "local-job-1",
    cancellationGeneration: 0,
    nextState: "queued",
  });
  return reduceGenerationSession(state, {
    type: "runTransitioned",
    jobId: "local-job-1",
    cancellationGeneration: 0,
    nextState: "running",
  });
}

function receiveCandidate(
  state: GenerationSessionState,
  candidateId: string,
  parentCandidateId: string | null = null,
) {
  return reduceGenerationSession(state, {
    type: "candidateReceived",
    jobId: "local-job-1",
    cancellationGeneration: state.activeJob!.cancellationGeneration,
    candidate: {
      candidateId,
      parentCandidateId,
      programHash: `sha256:${"a".repeat(64)}`,
    },
  });
}

function transitionCandidate(
  state: GenerationSessionState,
  candidateId: string,
  nextState: GenerationCandidateState,
) {
  return reduceGenerationSession(state, {
    type: "candidateTransitioned",
    jobId: "local-job-1",
    cancellationGeneration: state.activeJob!.cancellationGeneration,
    candidateId,
    nextState,
  });
}

describe("web generation job state", () => {
  it("uses the normative run states in an authority-neutral local test namespace", () => {
    const initial = createGenerationSession();
    const created = startJob(initial);

    expect(created.authority).toEqual({ namespace: "local-test", authoritative: false });
    expect(created.activeJob).toMatchObject({
      jobId: "local-job-1",
      runState: "created",
      cancellationGeneration: 0,
      baseRevision: "revision-1",
      baseDocumentHash: BASE_HASH,
      baseStatus: "current",
    });
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.activeJob)).toBe(true);

    const queued = reduceGenerationSession(created, {
      type: "runTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 0,
      nextState: "queued",
    });
    const running = reduceGenerationSession(queued, {
      type: "runTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 0,
      nextState: "running",
    });

    expect(created.activeJob?.runState).toBe("created");
    expect(queued.activeJob?.runState).toBe("queued");
    expect(running.activeJob?.runState).toBe("running");
  });

  it("retains an immutable four-candidate population and rejects a fifth", () => {
    let state = startRunningJob();
    for (let index = 1; index <= GENERATION_CANDIDATE_LIMIT; index += 1) {
      state = receiveCandidate(state, `candidate-${index}`);
    }
    const beforeFifth = state;
    state = receiveCandidate(state, "candidate-5");

    expect(state.activeJob?.candidates).toHaveLength(4);
    expect(state.activeJob?.candidates.map(({ state: candidateState }) => candidateState)).toEqual([
      "received",
      "received",
      "received",
      "received",
    ]);
    expect(state.activeJob?.candidates).toBe(beforeFifth.activeJob?.candidates);
    expect(state.diagnostics.at(-1)?.code).toBe("POPULATION_LIMIT_REACHED");
    expect(Object.isFrozen(state.activeJob?.candidates[0]?.identity)).toBe(true);
  });

  it("isolates malformed and failed candidates without disturbing siblings", () => {
    let state = startRunningJob();
    state = receiveCandidate(state, "candidate-good-1");
    state = reduceGenerationSession(state, {
      type: "candidateReceived",
      jobId: "local-job-1",
      cancellationGeneration: 0,
      candidate: { candidateId: "candidate-bad", parentCandidateId: null },
    });
    state = receiveCandidate(state, "candidate-good-2");
    state = reduceGenerationSession(state, {
      type: "candidateTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 0,
      candidateId: "candidate-good-1",
      nextState: "processingFailed",
    });

    expect(state.activeJob?.candidates.map(({ identity }) => identity.candidateId)).toEqual([
      "candidate-good-1",
      "candidate-good-2",
    ]);
    expect(state.activeJob?.candidates.map(({ state: candidateState }) => candidateState)).toEqual([
      "processingFailed",
      "received",
    ]);
    expect(state.diagnostics.some(({ code }) => code === "MALFORMED_CANDIDATE")).toBe(true);
  });

  it("preserves parent candidates and rejects unknown lineage", () => {
    let state = startRunningJob();
    state = receiveCandidate(state, "parent");
    const parentBefore = state.activeJob!.candidates[0];
    state = receiveCandidate(state, "child", "parent");
    state = receiveCandidate(state, "orphan", "missing-parent");

    expect(state.activeJob?.candidates).toHaveLength(2);
    expect(state.activeJob?.candidates[0]).toBe(parentBefore);
    expect(state.activeJob?.candidates[1]?.identity.parentCandidateId).toBe("parent");
    expect(state.diagnostics.at(-1)?.code).toBe("INVALID_CANDIDATE_LINEAGE");
  });

  it("increments cancellation generation once and ignores late events", () => {
    const state = receiveCandidate(startRunningJob(), "candidate-1");
    const cancelling = reduceGenerationSession(state, {
      type: "cancellationRequested",
      jobId: "local-job-1",
    });
    const repeated = reduceGenerationSession(cancelling, {
      type: "cancellationRequested",
      jobId: "local-job-1",
    });
    const afterLateEvent = reduceGenerationSession(repeated, {
      type: "candidateTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 0,
      candidateId: "candidate-1",
      nextState: "compiled",
    });

    expect(cancelling.activeJob).toMatchObject({
      runState: "cancelling",
      cancellationGeneration: 1,
    });
    expect(repeated).toBe(cancelling);
    expect(afterLateEvent.activeJob?.candidates[0]?.state).toBe("received");
    expect(afterLateEvent.diagnostics.at(-1)?.code).toBe("STALE_CANCELLATION_GENERATION");
  });

  it("permits only cancellation terminalization after cancellation starts", () => {
    const running = receiveCandidate(startRunningJob(), "candidate-1");
    const cancelling = reduceGenerationSession(running, {
      type: "cancellationRequested",
      jobId: "local-job-1",
    });
    const continuedWork = transitionCandidate(cancelling, "candidate-1", "compiled");

    expect(continuedWork.activeJob?.candidates[0]?.state).toBe("received");
    expect(continuedWork.diagnostics.at(-1)?.code).toBe("INVALID_CANDIDATE_TRANSITION");
  });

  it("does not finish cancellation until owned candidates are terminal", () => {
    let state = receiveCandidate(startRunningJob(), "candidate-1");
    state = reduceGenerationSession(state, {
      type: "cancellationRequested",
      jobId: "local-job-1",
    });
    const premature = reduceGenerationSession(state, {
      type: "runTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 1,
      nextState: "cancelled",
    });
    state = reduceGenerationSession(premature, {
      type: "candidateTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 1,
      candidateId: "candidate-1",
      nextState: "cancelled",
    });
    state = reduceGenerationSession(state, {
      type: "runTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 1,
      nextState: "cancelled",
    });

    expect(premature.activeJob?.runState).toBe("cancelling");
    expect(premature.diagnostics.at(-1)?.code).toBe("OWNED_WORK_NOT_QUIESCED");
    expect(state.activeJob?.runState).toBe("cancelled");
  });

  it("marks the captured base stale after manual editing without rewriting candidates", () => {
    let state = receiveCandidate(startRunningJob(), "candidate-1");
    const candidateBefore = state.activeJob!.candidates[0];
    state = reduceGenerationSession(state, {
      type: "documentChanged",
      revision: "revision-2",
      documentHash: OTHER_HASH,
    });

    expect(state.activeJob).toMatchObject({
      baseStatus: "stale",
      observedRevision: "revision-2",
      observedDocumentHash: OTHER_HASH,
    });
    expect(state.activeJob?.candidates[0]).toBe(candidateBefore);
    expect(state.activeJob?.candidates[0]?.state).toBe("received");
  });

  it("rejects overlapping jobs and accepts a new job only after the current job is terminal", () => {
    const running = startRunningJob();
    const rejected = reduceGenerationSession(running, {
      type: "jobStarted",
      jobId: "overlap",
      baseRevision: "revision-2",
      baseDocumentHash: OTHER_HASH,
    });

    expect(rejected.activeJob?.jobId).toBe("local-job-1");
    expect(rejected.diagnostics.at(-1)?.code).toBe("OVERLAPPING_JOB_REJECTED");

    let terminal = reduceGenerationSession(startJob(), {
      type: "cancellationRequested",
      jobId: "local-job-1",
    });
    terminal = reduceGenerationSession(terminal, {
      type: "runTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 1,
      nextState: "cancelled",
    });
    const replacement = reduceGenerationSession(terminal, {
      type: "jobStarted",
      jobId: "local-job-2",
      baseRevision: "revision-2",
      baseDocumentHash: OTHER_HASH,
    });

    expect(replacement.completedJobs.map(({ jobId }) => jobId)).toEqual(["local-job-1"]);
    expect(replacement.activeJob?.jobId).toBe("local-job-2");
  });

  it("fails closed on illegal normative transitions", () => {
    const created = startJob();
    const invalidRun = reduceGenerationSession(created, {
      type: "runTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 0,
      nextState: "succeeded",
    });

    expect(invalidRun.activeJob?.runState).toBe("created");
    expect(invalidRun.diagnostics.at(-1)?.code).toBe("INVALID_RUN_TRANSITION");
  });

  it("records an immutable normative success path without changing candidate identity", () => {
    let state = receiveCandidate(startRunningJob(), "candidate-1");
    const received = state.activeJob!.candidates[0]!;
    const identity = received.identity;
    const path = ["compiled", "hardValid", "rendered", "critiqued", "ranked", "presented"] as const;

    for (const nextState of path) {
      state = transitionCandidate(state, "candidate-1", nextState);
    }
    state = reduceGenerationSession(state, {
      type: "runTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 0,
      nextState: "draining",
    });
    state = reduceGenerationSession(state, {
      type: "runTransitioned",
      jobId: "local-job-1",
      cancellationGeneration: 0,
      nextState: "succeeded",
    });

    expect(received.state).toBe("received");
    expect(state.activeJob?.candidates[0]?.identity).toBe(identity);
    expect(state.activeJob?.candidates[0]?.transitions.map(({ to }) => to)).toEqual([
      "received",
      ...path,
    ]);
    expect(state.activeJob?.runState).toBe("succeeded");
  });
});
