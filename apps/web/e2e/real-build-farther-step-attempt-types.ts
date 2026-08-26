import type { DeferredUnresolvedCandidate } from "./real-build-deferred-step";
import type { scoreFartherDocumentsAgainstPanel } from "./real-build-farther-scoring";
import type { FartherStepPlace } from "./real-build-farther-step-expansion";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import type { PreparedRealBuildModules } from "./real-build-browser-preflight";
import type {
  RealBuildFartherCapture,
  RealBuildFartherEvidence,
  RealBuildOptions,
  RealBuildPanelRasterSpec,
  RealBuildPanelSpec,
  StepFailure,
} from "./real-build-safety";

export interface FartherPrintedStepInput<D> {
  readonly originSpec: RealBuildPanelSpec;
  readonly originStatus: "no-local-signal" | "unseparated";
  readonly originMargin: number | null;
  readonly originMinimumMargin: number | null;
  readonly baseDocument: D;
  readonly origins: readonly DeferredUnresolvedCandidate<D>[];
  readonly interveningSpec: RealBuildPanelSpec;
  readonly interveningEvidence: PanelRasterEvidence;
  /** Present only when K is an executable panel eligible for calibrated policy. */
  readonly fartherSpec: RealBuildPanelSpec | null;
  /** Raster-only K target, including a passive panel outside the execution prefix. */
  readonly fartherRasterSpec: RealBuildPanelRasterSpec | null;
  readonly loadFartherEvidence: (() => Promise<PanelRasterEvidence>) | null;
  readonly options: RealBuildOptions;
  readonly modules: Pick<PreparedRealBuildModules, "rendering" | "kernel" | "assembly">;
  readonly place: FartherStepPlace<D>;
  readonly scoreMeasuredOriginPanel?: typeof scoreFartherDocumentsAgainstPanel;
}

export interface FartherPrintedStepAttempt<D> {
  readonly evidence: RealBuildFartherEvidence;
  readonly captures: readonly RealBuildFartherCapture[];
  readonly selectedOrigin: DeferredUnresolvedCandidate<D> | null;
  readonly failure: StepFailure | null;
}
