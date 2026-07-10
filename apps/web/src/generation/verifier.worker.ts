import type { DeterministicMakerPopulationInput } from "@lego-studio/generation";

import { computeTrustedPopulationDigest } from "./candidate-lab-verifier";

interface VerifierWorkerScope {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: unknown): void;
}

const worker = self as unknown as VerifierWorkerScope;

worker.onmessage = ({ data }: MessageEvent<unknown>) => {
  if (
    typeof data !== "object" ||
    data === null ||
    !("kind" in data) ||
    data.kind !== "verify-population" ||
    !("requestId" in data) ||
    typeof data.requestId !== "string" ||
    !("input" in data)
  ) {
    return;
  }
  try {
    worker.postMessage({
      kind: "trusted-population-digest",
      requestId: data.requestId,
      ...computeTrustedPopulationDigest(data.input as DeterministicMakerPopulationInput),
    });
  } catch (error) {
    worker.postMessage({
      kind: "population-verification-error",
      requestId: data.requestId,
      message: error instanceof Error ? error.message : "Candidate verification crashed",
    });
  }
};

export {};
