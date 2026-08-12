import type { RealBuildInputDigests, RealBuildStepReport, StepFailure } from "./real-build-safety";

export interface RealBuildDiagnosticPrefix {
  readonly schemaVersion: "lego.real-build-diagnostic-prefix/1";
  readonly throughStepNumber: number;
  readonly targetEquivalence: "unreconciled";
  readonly documentJson: string;
  readonly structuralHash: string;
  readonly parts: number;
}

export interface RealBuildResult {
  readonly schemaVersion: "lego.real-build-result/4";
  readonly authority: {
    readonly kind: "local-diagnostic";
    readonly authenticated: false;
    readonly trustSealDigest: null;
    readonly reason: "released-companion-broker-unavailable";
  };
  readonly status: "completed" | "prefix-complete" | "incomplete" | "input-rejected";
  readonly requestedLastStep: number;
  readonly expectedPrintedSteps: number;
  readonly assembledTargetParts: number;
  readonly inputDigests: RealBuildInputDigests;
  readonly inputFailures: readonly StepFailure[];
  readonly completionFailures: readonly StepFailure[];
  readonly steps: readonly RealBuildStepReport[];
  readonly diagnosticPrefix: RealBuildDiagnosticPrefix | null;
  readonly documentJson: string | null;
  readonly structuralHash: string | null;
  readonly finalParts: number;
  readonly totalElapsedMs: number;
}
