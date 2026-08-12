import {
  measuredFartherOriginProbeIneligibility,
  measuredFartherOriginKReportIneligibility,
} from "./real-build-farther-origin-policy";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";
import { isRecord } from "./real-build-farther-report-validation";

type MeasuredFartherOriginOptions = Parameters<
  typeof measuredFartherOriginProbeIneligibility
>[0]["options"] &
  Pick<RealBuildOptions, "panels">;

export function isRealBuildFartherDirectOriginTandemCoherent(input: {
  readonly reportStepNumber: number;
  readonly carries: readonly Record<string, unknown>[];
  readonly panels: readonly Record<string, unknown>[];
  readonly refusal: unknown;
  readonly decision: unknown;
  readonly preparedOriginPanel: RealBuildPanelSpec;
  readonly originCandidates: readonly Record<string, unknown>[];
  readonly options: MeasuredFartherOriginOptions;
}): boolean {
  const {
    reportStepNumber,
    carries,
    panels,
    refusal,
    decision,
    preparedOriginPanel,
    originCandidates,
    options,
  } = input;
  // A zero-panel budget refusal and an N+1-only origin observation are generic
  // driver states. Only a carry-free report that claims to have reached K is
  // the measured direct-origin shortcut and inherits its exact calibration.
  const claimsDirectOriginK =
    carries.length === 0 &&
    (panels.some(({ stepNumber }) => stepNumber === reportStepNumber + 2) ||
      (isRecord(refusal) && refusal.stepNumber === reportStepNumber + 2));
  if (!claimsDirectOriginK) return true;

  const interveningSpec = options.panels.find(
    ({ stepNumber }) => stepNumber === reportStepNumber + 1,
  );
  const fartherSpec = options.panels.find(({ stepNumber }) => stepNumber === reportStepNumber + 2);
  if (
    interveningSpec === undefined ||
    measuredFartherOriginProbeIneligibility({
      originSpec: preparedOriginPanel,
      interveningSpec,
      fartherSpec: fartherSpec ?? null,
      origins: originCandidates as unknown as Parameters<
        typeof measuredFartherOriginProbeIneligibility
      >[0]["origins"],
      options,
    }) !== null
  ) {
    return false;
  }
  const kPanel = panels.find(({ stepNumber }) => stepNumber === reportStepNumber + 2);
  return measuredFartherOriginKReportIneligibility({ kPanel, decision }) === null;
}
