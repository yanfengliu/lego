import type { RealBuildOptions, RealBuildStepReport, StepFailure } from "./real-build-safety";

export type LegacyRealBuildBrowserOutputBoundary = Pick<
  RealBuildOptions,
  | "lastStep"
  | "maxParts"
  | "inputDigests"
  | "panels"
  | "blindRenderBudget"
  | "explodedGhostRenderBudget"
  | "deferredCandidateBudget"
  | "deferredNarrowingRenderBudget"
  | "fartherPanelMaximumReachSteps"
  | "fartherPanelRenderBudget"
  | "minimumDeferredAgreement"
  | "minimumDeferredAgreementMargin"
  | "renderScale"
  | "panelWidth"
  | "workFactor"
  | "measuredFartherOriginSourceAttestation"
> & { readonly panelCameraBranchBudget?: number };

export type RealBuildBrowserOutputBoundary = LegacyRealBuildBrowserOutputBoundary & {
  readonly panelCameraBranchBudget: number;
};

export interface RealBuildIdentityBinding {
  readonly identityKey: string;
  readonly partId: string;
  readonly stepNumber: number;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
}

interface RealBuildBrowserOutputExecutedFields<R> {
  readonly status: "executed";
  readonly reports: readonly R[];
  readonly documentJson: string;
  readonly identityBindings: readonly RealBuildIdentityBinding[];
  readonly fetchedPdfDigest: string;
  readonly totalElapsedMs: number;
}

interface RealBuildBrowserOutputFailedFields<R> {
  readonly status: "failed";
  readonly reports: readonly R[];
  readonly documentJson: string | null;
  readonly identityBindings: readonly RealBuildIdentityBinding[];
  readonly fetchedPdfDigest: string | null;
  readonly failure: StepFailure;
  readonly totalElapsedMs: number;
}

/** Current browser evidence. Generation 3 makes panel-camera evidence explicit per report. */
export type RealBuildBrowserOutput =
  | (RealBuildBrowserOutputExecutedFields<RealBuildStepReport> & {
      readonly schemaVersion: "lego.real-build-browser-output/3";
    })
  | (RealBuildBrowserOutputFailedFields<RealBuildStepReport> & {
      readonly schemaVersion: "lego.real-build-browser-output/3";
    });

/** Frozen inspection shape for retained generation-2 bytes; never accepted as current evidence. */
export type LegacyRealBuildBrowserOutputV2 =
  | (RealBuildBrowserOutputExecutedFields<unknown> & {
      readonly schemaVersion: "lego.real-build-browser-output/2";
    })
  | (RealBuildBrowserOutputFailedFields<unknown> & {
      readonly schemaVersion: "lego.real-build-browser-output/2";
    });
