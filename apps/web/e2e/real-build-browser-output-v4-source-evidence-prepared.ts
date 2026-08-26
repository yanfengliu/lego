import type { Sha256Digest } from "@lego-studio/brick-kernel";

import { inspectRealBuildPreparedBrowserOutputBoundaryFromRunInput } from "./real-build-prepared-step-authority";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { RealBuildBrowserOutputV4SourceEvidencePanelInput } from "./real-build-browser-output-v4-source-evidence-types";
import { stepPanelEvidenceDigest } from "./real-build-panel-evidence-digest";

export type RealBuildBrowserOutputV4PreparedSourcePanel =
  RealBuildBrowserOutputV4SourceEvidencePanelInput["panel"];

function equalBounds(
  left: Readonly<{ minXPt: number; maxXPt: number; minYPt: number; maxYPt: number }>,
  right: Readonly<{ minXPt: number; maxXPt: number; minYPt: number; maxYPt: number }>,
): boolean {
  return (
    left.minXPt === right.minXPt &&
    left.maxXPt === right.maxXPt &&
    left.minYPt === right.minYPt &&
    left.maxYPt === right.maxYPt
  );
}

/** Cross-binds the requested action prefix and passive suffix to the complete source index. */
export function bindRealBuildBrowserOutputV4SourceEvidencePreparedRun(
  preparedRunValue: unknown,
  panels: readonly RealBuildBrowserOutputV4PreparedSourcePanel[],
): Readonly<{ preparedRunInputDigest: Sha256Digest; pdfDigest: Sha256Digest }> {
  if (panels.length !== 359) {
    throw new TypeError("Source evidence requires the complete 359-panel source/index container.");
  }
  const prepared = inspectRealBuildPreparedBrowserOutputBoundaryFromRunInput(preparedRunValue);
  if (
    prepared.panels.length !== prepared.lastStep ||
    prepared.panels.some((panel, index) => panel.stepNumber !== index + 1) ||
    prepared.passivePanels.length > prepared.fartherPanelMaximumReachSteps ||
    prepared.passivePanels.some(
      (panel, index) =>
        panel.stepNumber !== prepared.lastStep + index + 1 || panel.stepNumber > 359,
    ) ||
    prepared.authority !== "absent"
  ) {
    throw new TypeError(
      "Source evidence requires one exact authority-free prepared action prefix plus its bounded ordered raster-only suffix within the 359-panel source/index container.",
    );
  }
  for (const preparedPanel of [...prepared.panels, ...prepared.passivePanels]) {
    const panel = panels[preparedPanel.stepNumber - 1]!;
    const panelEvidenceDigest = stepPanelEvidenceDigest({
      pdfDigest: prepared.inputDigests.pdf,
      stepNumber: preparedPanel.stepNumber,
      pageNumber: preparedPanel.pageNumber,
      bounds: preparedPanel,
      calloutBoxes: preparedPanel.calloutBoxes,
    });
    if (
      preparedPanel.stepNumber !== panel.stepNumber ||
      preparedPanel.pageNumber !== panel.pageNumber ||
      !equalBounds(preparedPanel, panel) ||
      panelEvidenceDigest !== panel.panelEvidenceDigest ||
      preparedPanel.calloutBoxes.length !== panel.calloutBoxes.length
    ) {
      throw new TypeError(
        `Source evidence step ${panel.stepNumber} does not equal its exact prepared-run PDF/page/bounds/callout row.`,
      );
    }
    for (let callout = 0; callout < panel.calloutBoxes.length; callout += 1) {
      if (!equalBounds(preparedPanel.calloutBoxes[callout]!, panel.calloutBoxes[callout]!)) {
        throw new TypeError(
          `Source evidence step ${panel.stepNumber} callout ${callout} does not equal the prepared run.`,
        );
      }
    }
  }
  if (
    !/^sha256:[0-9a-f]{64}$/u.test(prepared.preparedRunInputDigest) ||
    !/^sha256:[0-9a-f]{64}$/u.test(prepared.inputDigests.pdf)
  ) {
    throw new TypeError(
      "Source evidence requires exact prepared-run and PDF digests for the bound action/passive window.",
    );
  }
  return intrinsicRealBuildFreeze({
    preparedRunInputDigest: prepared.preparedRunInputDigest,
    pdfDigest: prepared.inputDigests.pdf as Sha256Digest,
  });
}
