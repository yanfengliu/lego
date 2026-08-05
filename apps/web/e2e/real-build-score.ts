import {
  isAtomicStepComplete,
  type RealBuildAccounting,
  type RealBuildResult,
} from "./real-build-safety";

export const REAL_BUILD_SCORE_SCHEMA = "lego.real-build-score/3" as const;

const capturePath = (stepNumber: number, kind: "panel" | "build"): string =>
  `step-${String(stepNumber).padStart(3, "0")}-${kind}.png`;

/** Creates the only accepted retained score projection from a locally finalized result. */
export function createRealBuildScore(input: {
  readonly runId: string;
  readonly result: RealBuildResult;
  readonly accounting: RealBuildAccounting;
  readonly lastStep: number;
}) {
  const built = input.result.steps.filter(isAtomicStepComplete);
  return {
    schemaVersion: REAL_BUILD_SCORE_SCHEMA,
    authority: input.result.authority,
    runId: input.runId,
    status: input.result.status,
    inputDigests: input.result.inputDigests,
    accounting: input.accounting,
    lastStep: input.lastStep,
    stepsAttempted: input.result.steps.length,
    stepsComplete: built.length,
    piecesPlaced: input.result.steps.reduce((total, step) => total + step.placedPieces, 0),
    finalParts: input.result.finalParts,
    structuralHash: input.result.structuralHash,
    inputFailures: input.result.inputFailures,
    completionFailures: input.result.completionFailures,
    failures: input.result.steps
      .filter((step) => step.outcome.status === "failed")
      .map((step) => ({ stepNumber: step.stepNumber, failure: step.outcome.failure })),
    totalElapsedMs: input.result.totalElapsedMs,
    steps: input.result.steps.map(({ panelPng, buildPng, ...step }) => ({
      ...step,
      panelPng: panelPng === null ? null : capturePath(step.stepNumber, "panel"),
      buildPng: buildPng === null ? null : capturePath(step.stepNumber, "build"),
    })),
  };
}
