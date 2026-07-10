import {
  runDeterministicMakerPopulation,
  type DeterministicMakerPopulationInput,
} from "@lego-studio/generation";

interface MakerWorkerScope {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: unknown): void;
}

const worker = self as unknown as MakerWorkerScope;

worker.onmessage = ({ data }: MessageEvent<unknown>) => {
  if (
    typeof data !== "object" ||
    data === null ||
    !("kind" in data) ||
    data.kind !== "run-population" ||
    !("requestId" in data) ||
    typeof data.requestId !== "string" ||
    !("input" in data)
  ) {
    return;
  }
  try {
    worker.postMessage({
      kind: "population-result",
      requestId: data.requestId,
      result: runDeterministicMakerPopulation(data.input as DeterministicMakerPopulationInput),
    });
  } catch (error) {
    worker.postMessage({
      kind: "population-error",
      requestId: data.requestId,
      message: error instanceof Error ? error.message : "Candidate population crashed",
    });
  }
};

export {};
