import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { downsampleRaster } from "../src/assembly/panel-art";
import { stepPanelEvidenceDigest } from "../e2e/real-build-panel-evidence-digest";
import { inspectRealBuildPreparedRunInput } from "../e2e/real-build-prepared-step-authority";
import { completeRealBuildTestOptions } from "./real-build-test-options";

const ENCODER = new TextEncoder();
export const SOURCE_EVIDENCE_TEST_PDF_DIGEST =
  `sha256:${sha256Hex("source-evidence-test-pdf")}` as Sha256Digest;

export const SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS = (() => {
  const base = completeRealBuildTestOptions(359);
  const bounds = { minXPt: 0, maxXPt: 100, minYPt: 0, maxYPt: 0.1 };
  const calloutBoxes: readonly [] = [];
  const panels = base.panels.map((panel) => ({
    ...panel,
    ...bounds,
    calloutBoxes,
    action:
      panel.action.kind === "transition"
        ? {
            ...panel.action,
            panelEvidenceDigest: stepPanelEvidenceDigest({
              pdfDigest: SOURCE_EVIDENCE_TEST_PDF_DIGEST,
              stepNumber: panel.stepNumber,
              pageNumber: panel.pageNumber,
              bounds,
              calloutBoxes,
            }),
          }
        : panel.action,
  }));
  return {
    ...base,
    panels,
    inputDigests: { ...base.inputDigests, pdf: SOURCE_EVIDENCE_TEST_PDF_DIGEST },
    coverageInputBindings: {
      ...base.coverageInputBindings,
      pdf: SOURCE_EVIDENCE_TEST_PDF_DIGEST,
    },
  };
})();

export const SOURCE_EVIDENCE_TEST_PREPARED_RUN = inspectRealBuildPreparedRunInput(
  ENCODER.encode(JSON.stringify(SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS)),
);

export function sourceEvidenceTestPanelInput(stepNumber: number, heightPt = 0.1) {
  const preparedPanel = SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.panels[stepNumber - 1]!;
  const pageNumber = preparedPanel.pageNumber;
  const bounds = { minXPt: 0, maxXPt: 100, minYPt: 0, maxYPt: heightPt };
  const calloutBoxes: readonly [] = [];
  const panel = {
    stepNumber,
    pageNumber,
    ...bounds,
    calloutBoxes,
    panelEvidenceDigest: stepPanelEvidenceDigest({
      pdfDigest: SOURCE_EVIDENCE_TEST_PDF_DIGEST,
      stepNumber,
      pageNumber,
      bounds,
      calloutBoxes,
    }) as Sha256Digest,
  };
  const highHeight = Math.max(1, Math.round((heightPt * 1_000) / 100));
  const high = new Uint8ClampedArray(1_000 * highHeight * 4);
  for (let pixel = 0; pixel < high.length / 4; pixel += 1) {
    high[pixel * 4] = 0x89;
    high[pixel * 4 + 1] = 0x90;
    high[pixel * 4 + 2] = 0x93;
    high[pixel * 4 + 3] = 255;
  }
  const markedX = (stepNumber % 500) * 2;
  high[markedX * 4] = 0;
  high[markedX * 4 + 1] = 0;
  high[markedX * 4 + 2] = 0;
  const work = downsampleRaster({ width: 1_000, height: highHeight, pixels: high }, 2).pixels;
  return {
    pdfDigest: SOURCE_EVIDENCE_TEST_PDF_DIGEST,
    panel,
    highRgba: high,
    workRgba: work,
  };
}
