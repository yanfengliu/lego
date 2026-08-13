import type { RealBuildBrowserOutput, RealBuildIdentityBinding } from "./real-build-browser-output";
import type { RealBuildStepReport, StepFailure } from "./real-build-safety";

export function retainedRealBuildRunOutput(input: {
  readonly reports: readonly RealBuildStepReport[];
  readonly document: unknown;
  readonly identityBindings: readonly RealBuildIdentityBinding[];
  readonly fetchedPdfDigest: string;
  readonly cleanupFailure: StepFailure | null;
  readonly elapsedMs: number;
}): RealBuildBrowserOutput {
  const retained = {
    schemaVersion: "lego.real-build-browser-output/3" as const,
    reports: input.reports,
    documentJson: JSON.stringify(input.document),
    identityBindings: input.identityBindings,
    fetchedPdfDigest: input.fetchedPdfDigest,
    totalElapsedMs: input.elapsedMs,
  };
  return input.cleanupFailure === null
    ? { ...retained, status: "executed" }
    : { ...retained, status: "failed", failure: input.cleanupFailure };
}
