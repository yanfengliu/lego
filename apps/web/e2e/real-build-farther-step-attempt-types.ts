import type { DeferredUnresolvedCandidate } from "./real-build-deferred-step";
import type {
  RealBuildFartherCapture,
  RealBuildFartherEvidence,
  StepFailure,
} from "./real-build-safety";

export interface FartherPrintedStepAttempt<D> {
  readonly evidence: RealBuildFartherEvidence;
  readonly captures: readonly RealBuildFartherCapture[];
  readonly selectedOrigin: DeferredUnresolvedCandidate<D> | null;
  readonly failure: StepFailure | null;
}
