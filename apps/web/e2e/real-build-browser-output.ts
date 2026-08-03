import type { RealBuildStepReport, StepFailure } from "./real-build-safety";

export interface RealBuildIdentityBinding {
  readonly identityKey: string;
  readonly partId: string;
  readonly stepNumber: number;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
}

export type RealBuildBrowserOutput =
  | {
      readonly schemaVersion: "lego.real-build-browser-output/1";
      readonly status: "executed";
      readonly reports: readonly RealBuildStepReport[];
      readonly documentJson: string;
      readonly identityBindings: readonly RealBuildIdentityBinding[];
      readonly fetchedPdfDigest: string;
      readonly totalElapsedMs: number;
    }
  | {
      readonly schemaVersion: "lego.real-build-browser-output/1";
      readonly status: "failed";
      readonly reports: readonly RealBuildStepReport[];
      readonly documentJson: string | null;
      readonly identityBindings: readonly RealBuildIdentityBinding[];
      readonly fetchedPdfDigest: string | null;
      readonly failure: StepFailure;
      readonly totalElapsedMs: number;
    };
