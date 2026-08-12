import type { RealBuildBrowserOutput } from "./real-build-browser-output";
import { describeBrowserThrown } from "./real-build-browser-error-boundary";
import type { StepFailure } from "./real-build-safety";

export function realBuildCleanupFailure(resource: string, error: unknown): StepFailure {
  return {
    code: "rendering-error",
    stage: "rendering",
    inputKey: resource,
    message:
      `Real-build cleanup for ${resource} failed after task-owned evidence had been retained: ` +
      `${describeBrowserThrown(error)}. The retained reports and canonical document bytes remain ` +
      `available, but the output is failed because resource cleanup did not complete.`,
  };
}

/** Mutates only the not-yet-delivered result so a finally-path cannot erase retained evidence. */
export function retainRealBuildCleanupFailure(
  output: RealBuildBrowserOutput,
  failure: StepFailure,
): void {
  const mutable = output as unknown as Record<string, unknown>;
  if (output.status === "executed") {
    mutable.status = "failed";
    mutable.failure = failure;
    return;
  }
  const prior = output.failure;
  mutable.failure = {
    ...prior,
    message: `${prior.message} Cleanup also failed: ${failure.message}`,
  } satisfies StepFailure;
}
