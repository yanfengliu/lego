import { useEffect, useMemo, useRef, useState } from "react";

import { documentStructuralHash } from "@lego-studio/brick-kernel";
import type { HardValidCandidate } from "@lego-studio/generation";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { LocalCandidateLabController, type CandidateLabState } from "./candidate-lab-controller";
import { createCandidateLabRequest } from "./candidate-lab-request";

function createJobId(): string {
  return `local-lab-${crypto.randomUUID()}`;
}

export interface LocalCandidateLab {
  readonly state: CandidateLabState;
  readonly selectedCandidate: HardValidCandidate | null;
  readonly generate: (prompt: string) => void;
  readonly selectCandidate: (candidateId: string) => void;
  readonly clear: () => void;
}

export function useCandidateLab(document: BrickDocumentV1): LocalCandidateLab {
  const documentHash = useMemo(() => documentStructuralHash(document), [document]);
  const controllerRef = useRef<LocalCandidateLabController | null>(null);
  const [state, setState] = useState<CandidateLabState>({ status: "idle" });

  useEffect(() => {
    const controller = new LocalCandidateLabController(
      () => new Worker(new URL("./maker.worker.ts", import.meta.url), { type: "module" }),
      () => new Worker(new URL("./verifier.worker.ts", import.meta.url), { type: "module" }),
      () => ({ revision: document.revision, structuralHash: documentHash }),
      setState,
    );
    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
      controller.destroy();
    };
  }, [document.revision, documentHash]);

  const currentState: CandidateLabState =
    state.status !== "idle" &&
    (state.baseRevision !== document.revision || state.baseDocumentHash !== documentHash)
      ? { status: "idle" }
      : state;

  const selectedCandidate =
    currentState.status === "ready" && currentState.selectedCandidateId !== null
      ? (currentState.population.attempts.find(
          (attempt): attempt is HardValidCandidate =>
            attempt.status === "hard-valid" &&
            attempt.candidateId === currentState.selectedCandidateId,
        ) ?? null)
      : null;

  return {
    state: currentState,
    selectedCandidate,
    generate: (prompt) => {
      const jobId = createJobId();
      controllerRef.current?.start(createCandidateLabRequest(document, prompt, jobId));
    },
    selectCandidate: (candidateId) => controllerRef.current?.selectCandidate(candidateId),
    clear: () => controllerRef.current?.clear(),
  };
}
