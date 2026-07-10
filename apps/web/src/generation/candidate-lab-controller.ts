import type { HardValidCandidate, MakerPopulationSuccess } from "@lego-studio/generation";

import type { CandidateLabRequest } from "./candidate-lab-request";
import { parsePopulationWorkerResponse } from "./maker-worker-response";

export interface CandidateLabWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

export interface CandidateLabDocumentIdentity {
  revision: string;
  structuralHash: string;
}

interface CandidateLabBaseState {
  readonly jobId: string;
  readonly baseRevision: string;
  readonly baseDocumentHash: string;
}

export type CandidateLabState =
  | { readonly status: "idle" }
  | (CandidateLabBaseState & { readonly status: "running" })
  | (CandidateLabBaseState & {
      readonly status: "ready";
      readonly population: MakerPopulationSuccess;
      readonly selectedCandidateId: string | null;
      readonly verificationDurationMs: number;
    })
  | (CandidateLabBaseState & {
      readonly status: "failed";
      readonly failure: {
        readonly code:
          | "MALFORMED_WORKER_RESPONSE"
          | "WORKER_ERROR"
          | "WORKER_MESSAGE_ERROR"
          | "WORKER_START_ERROR"
          | "MAKER_INPUT_REJECTED";
        readonly message: string;
        readonly detailCode?: string;
      };
    });

interface ActiveWorkers {
  readonly makerWorker: CandidateLabWorker;
  readonly verifierWorker: CandidateLabWorker;
  readonly requestId: string;
  readonly base: CandidateLabBaseState;
  readonly input: CandidateLabRequest;
  makerReceived: boolean;
  verifierReceived: boolean;
  makerResponse?: unknown;
  verifierResponse?: unknown;
}

export class LocalCandidateLabController {
  private state: CandidateLabState = { status: "idle" };
  private active: ActiveWorkers | null = null;
  private requestSequence = 0;
  private destroyed = false;

  constructor(
    private readonly createMakerWorker: () => CandidateLabWorker,
    private readonly createVerifierWorker: () => CandidateLabWorker,
    private readonly getDocumentIdentity: () => CandidateLabDocumentIdentity,
    private readonly onState: (state: CandidateLabState) => void,
  ) {}

  getState(): CandidateLabState {
    return this.state;
  }

  private publish(state: CandidateLabState) {
    this.state = state;
    if (!this.destroyed) this.onState(state);
  }

  private stopActive() {
    const active = this.active;
    this.active = null;
    if (!active) return;
    for (const worker of [active.makerWorker, active.verifierWorker]) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    }
  }

  private activeBaseIsCurrent(active: ActiveWorkers): boolean {
    const current = this.getDocumentIdentity();
    return (
      current.revision === active.base.baseRevision &&
      current.structuralHash === active.base.baseDocumentHash
    );
  }

  private failActive(
    active: ActiveWorkers,
    code:
      | "MALFORMED_WORKER_RESPONSE"
      | "WORKER_ERROR"
      | "WORKER_MESSAGE_ERROR"
      | "WORKER_START_ERROR"
      | "MAKER_INPUT_REJECTED",
    message: string,
    detailCode?: string,
  ) {
    if (this.active !== active) return;
    this.stopActive();
    this.publish({
      ...active.base,
      status: "failed",
      failure: { code, message, ...(detailCode === undefined ? {} : { detailCode }) },
    });
  }

  private receive(active: ActiveWorkers, source: "maker" | "verifier", data: unknown) {
    if (this.active !== active) return;
    if (!this.activeBaseIsCurrent(active)) {
      this.stopActive();
      this.publish({ status: "idle" });
      return;
    }
    const receivedKey = source === "maker" ? "makerReceived" : "verifierReceived";
    const responseKey = source === "maker" ? "makerResponse" : "verifierResponse";
    if (active[receivedKey]) {
      this.failActive(
        active,
        "MALFORMED_WORKER_RESPONSE",
        `${source} worker returned more than one terminal response`,
      );
      return;
    }
    active[receivedKey] = true;
    active[responseKey] = data;
    if (!active.makerReceived || !active.verifierReceived) return;

    const parsed = parsePopulationWorkerResponse(
      active.makerResponse,
      active.verifierResponse,
      active.requestId,
      active.input,
    );
    if (!parsed.ok) {
      this.failActive(active, parsed.code, parsed.message, parsed.detailCode);
      return;
    }
    this.stopActive();
    this.publish({
      ...active.base,
      status: "ready",
      population: parsed.result,
      selectedCandidateId: null,
      verificationDurationMs: parsed.verificationDurationMs,
    });
  }

  start(input: CandidateLabRequest) {
    if (this.destroyed) return;
    this.stopActive();
    const base: CandidateLabBaseState = {
      jobId: input.jobId,
      baseRevision: input.document.revision,
      baseDocumentHash: input.brief.baseDocumentHash,
    };
    const requestId = `${input.jobId}:${this.requestSequence++}`;
    this.publish({ ...base, status: "running" });
    let makerWorker: CandidateLabWorker | null = null;
    let verifierWorker: CandidateLabWorker | null = null;
    try {
      makerWorker = this.createMakerWorker();
      verifierWorker = this.createVerifierWorker();
    } catch (error) {
      makerWorker?.terminate();
      verifierWorker?.terminate();
      this.publish({
        ...base,
        status: "failed",
        failure: {
          code: "WORKER_START_ERROR",
          message: error instanceof Error ? error.message : "Candidate worker could not start",
        },
      });
      return;
    }
    const active: ActiveWorkers = {
      makerWorker,
      verifierWorker,
      requestId,
      base,
      input,
      makerReceived: false,
      verifierReceived: false,
    };
    this.active = active;
    makerWorker.onmessage = ({ data }) => this.receive(active, "maker", data);
    verifierWorker.onmessage = ({ data }) => this.receive(active, "verifier", data);
    makerWorker.onerror = (event) =>
      this.failActive(active, "WORKER_ERROR", event.message || "Candidate maker worker failed");
    verifierWorker.onerror = (event) =>
      this.failActive(active, "WORKER_ERROR", event.message || "Candidate verifier worker failed");
    makerWorker.onmessageerror = () =>
      this.failActive(
        active,
        "WORKER_MESSAGE_ERROR",
        "Candidate maker response could not be deserialized",
      );
    verifierWorker.onmessageerror = () =>
      this.failActive(
        active,
        "WORKER_MESSAGE_ERROR",
        "Candidate verifier response could not be deserialized",
      );
    try {
      makerWorker.postMessage({ kind: "run-population", requestId, input });
      verifierWorker.postMessage({ kind: "verify-population", requestId, input });
    } catch (error) {
      this.failActive(
        active,
        "WORKER_START_ERROR",
        error instanceof Error ? error.message : "Candidate request could not be sent",
      );
    }
  }

  selectCandidate(candidateId: string) {
    if (this.state.status !== "ready") return;
    const candidate = this.state.population.attempts.find(
      (attempt): attempt is HardValidCandidate =>
        attempt.candidateId === candidateId && attempt.status === "hard-valid",
    );
    if (!candidate) return;
    this.publish({ ...this.state, selectedCandidateId: candidate.candidateId });
  }

  clear() {
    if (this.destroyed) return;
    this.stopActive();
    this.publish({ status: "idle" });
  }

  destroy() {
    this.destroyed = true;
    this.stopActive();
  }
}
