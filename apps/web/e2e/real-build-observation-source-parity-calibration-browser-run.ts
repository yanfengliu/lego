import {
  snapshotRealBuildSourceParityCalibrationBrowserInput,
  type RealBuildSourceParityCalibrationBrowserInput,
} from "./real-build-observation-source-parity-calibration-browser-input";
import type { RealBuildSourceParityCalibrationBrowserCaptureWire } from "./real-build-observation-source-parity-calibration-capture-types";
import { measureValidatedCalibrationRealBuildObservationSourceParityInBrowser } from "./real-build-observation-source-parity-browser-measure";

export async function runRealBuildObservationSourceParityCalibrationInBrowser(
  rawInput: RealBuildSourceParityCalibrationBrowserInput,
): Promise<RealBuildSourceParityCalibrationBrowserCaptureWire> {
  const input = snapshotRealBuildSourceParityCalibrationBrowserInput(rawInput);
  return measureValidatedCalibrationRealBuildObservationSourceParityInBrowser(input);
}
