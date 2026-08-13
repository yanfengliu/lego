import { snapshotRealBuildSourceParityBrowserInput } from "./real-build-observation-source-parity-browser-input";
import { measureValidatedDenseRealBuildObservationSourceParityInBrowser } from "./real-build-observation-source-parity-browser-measure";
import type { RealBuildSourceParityMeasurementInput } from "./real-build-observation-source-parity-browser-types";
import type { RealBuildSourceParityBrowserResult } from "./real-build-observation-source-parity-types";

export type RealBuildSourceParityBrowserInput = RealBuildSourceParityMeasurementInput;

export async function runRealBuildObservationSourceParityInBrowser(
  input: RealBuildSourceParityBrowserInput,
): Promise<RealBuildSourceParityBrowserResult> {
  const snapshot = snapshotRealBuildSourceParityBrowserInput(input);
  return measureValidatedDenseRealBuildObservationSourceParityInBrowser(snapshot);
}
