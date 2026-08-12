import {
  MAXIMUM_REAL_BUILD_FARTHER_CAPTURES,
  type RealBuildFartherCapture,
  type RealBuildFartherEvidence,
} from "./real-build-farther-report-types";
import { isNullableRealBuildPngCapture } from "./real-build-png-capture";
import { exactKeys, isDenseBoundedArray, isRecord } from "./real-build-farther-report-validation";

export function isRealBuildFartherCaptures(
  value: unknown,
  evidence: RealBuildFartherEvidence | null,
): value is readonly RealBuildFartherCapture[] {
  if (!isDenseBoundedArray(value, MAXIMUM_REAL_BUILD_FARTHER_CAPTURES)) return false;
  if (evidence === null) return value.length === 0;
  const expected = evidence.panels.flatMap((panel) => [
    { role: "source-panel" as const, panelStepNumber: panel.stepNumber, candidateId: null },
    ...panel.scores.map(({ candidateId }) => ({
      role: "candidate-render" as const,
      panelStepNumber: panel.stepNumber,
      candidateId,
    })),
  ]);
  if (value.length !== expected.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    const capture = value[index];
    const descriptor = expected[index]!;
    if (
      !isRecord(capture) ||
      !exactKeys(capture, ["captureId", "role", "panelStepNumber", "candidateId", "png"]) ||
      capture.captureId !== index ||
      capture.role !== descriptor.role ||
      capture.panelStepNumber !== descriptor.panelStepNumber ||
      capture.candidateId !== descriptor.candidateId ||
      typeof capture.png !== "string" ||
      !isNullableRealBuildPngCapture(capture.png)
    ) {
      return false;
    }
  }
  return true;
}
