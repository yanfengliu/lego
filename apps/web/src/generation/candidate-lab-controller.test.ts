import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";
import { runDeterministicMakerPopulation } from "@lego-studio/generation";

import { LocalCandidateLabController, type CandidateLabWorker } from "./candidate-lab-controller";
import { createCandidateLabRequest } from "./candidate-lab-request";
import { computeTrustedPopulationDigest } from "./candidate-lab-verifier";

class FakeWorker implements CandidateLabWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }
}

function fixture() {
  const document = createEmptyBrickDocument({ id: "controller", name: "Controller" });
  const identity = {
    revision: document.revision,
    structuralHash: documentStructuralHash(document),
  };
  const states: unknown[] = [];
  const makerWorkers: FakeWorker[] = [];
  const verifierWorkers: FakeWorker[] = [];
  const controller = new LocalCandidateLabController(
    () => {
      const worker = new FakeWorker();
      makerWorkers.push(worker);
      return worker;
    },
    () => {
      const worker = new FakeWorker();
      verifierWorkers.push(worker);
      return worker;
    },
    () => identity,
    (state) => states.push(state),
  );
  return { controller, document, identity, states, makerWorkers, verifierWorkers };
}

function verifierResponse(
  requestId: string,
  request: ReturnType<typeof createCandidateLabRequest>,
) {
  return {
    kind: "trusted-population-digest",
    requestId,
    ...computeTrustedPopulationDigest(request),
  };
}

describe("local candidate lab controller", () => {
  it("terminates superseded work and ignores a late result from the old worker", () => {
    const { controller, document, makerWorkers, verifierWorkers } = fixture();
    const first = createCandidateLabRequest(document, "Build a red tower", "job-first");
    const second = createCandidateLabRequest(document, "Build a yellow column", "job-second");

    controller.start(first);
    controller.start(second);
    expect(makerWorkers[0]?.terminated).toBe(true);
    expect(verifierWorkers[0]?.terminated).toBe(true);
    expect(controller.getState()).toMatchObject({ status: "running", jobId: "job-second" });

    makerWorkers[0]?.emit({
      kind: "population-result",
      requestId: "job-first:0",
      result: runDeterministicMakerPopulation(first),
    });
    expect(controller.getState()).toMatchObject({ status: "running", jobId: "job-second" });
  });

  it("suppresses a result whose captured document became stale", () => {
    const { controller, document, identity, makerWorkers, verifierWorkers } = fixture();
    const request = createCandidateLabRequest(document, "Build a red tower", "job-stale");
    controller.start(request);
    identity.revision = "revision-newer";

    makerWorkers[0]?.emit({
      kind: "population-result",
      requestId: "job-stale:0",
      result: runDeterministicMakerPopulation(request),
    });

    expect(makerWorkers[0]?.terminated).toBe(true);
    expect(verifierWorkers[0]?.terminated).toBe(true);
    expect(controller.getState()).toMatchObject({ status: "idle" });
  });

  it("isolates malformed worker output and worker failures", () => {
    const { controller, document, makerWorkers, verifierWorkers } = fixture();
    const malformedRequest = createCandidateLabRequest(
      document,
      "Build a red tower",
      "job-malformed",
    );
    controller.start(malformedRequest);
    makerWorkers[0]?.emit({
      kind: "population-result",
      requestId: "job-malformed:0",
      result: null,
    });
    expect(controller.getState()).toMatchObject({ status: "running" });
    verifierWorkers[0]?.emit(verifierResponse("job-malformed:0", malformedRequest));
    expect(controller.getState()).toMatchObject({
      status: "failed",
      failure: { code: "MALFORMED_WORKER_RESPONSE" },
    });

    controller.start(createCandidateLabRequest(document, "Build a red tower", "job-error"));
    makerWorkers[1]?.onerror?.({ message: "worker exploded" } as ErrorEvent);
    expect(controller.getState()).toMatchObject({
      status: "failed",
      failure: { code: "WORKER_ERROR" },
    });
  });

  it("selects only a hard-valid candidate for exact-document preview", () => {
    const { controller, document, makerWorkers, verifierWorkers } = fixture();
    const request = createCandidateLabRequest(document, "Build an 18-piece tower", "job-ready");
    const result = runDeterministicMakerPopulation(request);
    if (!result.ok) throw new Error(result.failure.message);
    controller.start(request);
    verifierWorkers[0]?.emit(verifierResponse("job-ready:0", request));
    expect(controller.getState()).toMatchObject({ status: "running" });
    makerWorkers[0]?.emit({ kind: "population-result", requestId: "job-ready:0", result });

    expect(controller.getState()).toMatchObject({ status: "ready", selectedCandidateId: null });
    expect(makerWorkers[0]?.terminated).toBe(true);
    expect(verifierWorkers[0]?.terminated).toBe(true);
    const hardValid = result.attempts.find(({ status }) => status === "hard-valid");
    if (!hardValid) throw new Error("Expected a hard-valid fixture candidate");
    controller.selectCandidate(hardValid.candidateId);
    expect(controller.getState()).toMatchObject({
      status: "ready",
      selectedCandidateId: hardValid.candidateId,
    });

    controller.selectCandidate("missing-or-diagnostic");
    expect(controller.getState()).toMatchObject({
      status: "ready",
      selectedCandidateId: hardValid.candidateId,
    });
  });
});
