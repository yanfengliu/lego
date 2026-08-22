import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  inspectRealBuildPreparedPanelFromRunInput,
  requireRealBuildPreparedPanelInspection,
  type RealBuildPreparedRunInputInspection,
} from "./real-build-prepared-step-authority";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { RealBuildBrowserOutputV4SourceEvidencePanel } from "./real-build-browser-output-v4-source-evidence-types";

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

/** Cross-binds every source row to one privately retained, bounded prepared-run parse. */
export function bindRealBuildBrowserOutputV4SourceEvidencePreparedRun(
  preparedRunValue: unknown,
  panels: readonly RealBuildBrowserOutputV4SourceEvidencePanel[],
): Readonly<{ preparedRunInputDigest: Sha256Digest; pdfDigest: Sha256Digest }> {
  let preparedRunInputDigest: Sha256Digest | undefined;
  let pdfDigest: Sha256Digest | undefined;
  for (let index = 0; index < panels.length; index += 1) {
    const panel = panels[index]!;
    const prepared = requireRealBuildPreparedPanelInspection(
      inspectRealBuildPreparedPanelFromRunInput(preparedRunValue, index + 1),
    );
    if (
      prepared.stepNumber !== panel.stepNumber ||
      prepared.pageNumber !== panel.pageNumber ||
      !equalBounds(prepared.bounds, panel) ||
      prepared.panelEvidenceDigest !== panel.panelEvidenceDigest ||
      prepared.calloutBoxes.length !== panel.calloutBoxes.length
    ) {
      throw new TypeError(
        `Source evidence step ${panel.stepNumber} does not equal its exact prepared-run PDF/page/bounds/callout row.`,
      );
    }
    for (let callout = 0; callout < panel.calloutBoxes.length; callout += 1) {
      if (!equalBounds(prepared.calloutBoxes[callout]!, panel.calloutBoxes[callout]!)) {
        throw new TypeError(
          `Source evidence step ${panel.stepNumber} callout ${callout} does not equal the prepared run.`,
        );
      }
    }
    preparedRunInputDigest ??= prepared.preparedRunInputDigest;
    pdfDigest ??= prepared.pdfDigest;
    if (
      prepared.preparedRunInputDigest !== preparedRunInputDigest ||
      prepared.pdfDigest !== pdfDigest
    ) {
      throw new TypeError(
        `Source evidence step ${panel.stepNumber} does not share one prepared-run/PDF identity.`,
      );
    }
  }
  const supplied = preparedRunValue as RealBuildPreparedRunInputInspection;
  if (
    panels.length !== 359 ||
    supplied.lastStep !== 359 ||
    supplied.preparedRunInputDigest !== preparedRunInputDigest ||
    supplied.authority !== "absent" ||
    preparedRunInputDigest === undefined ||
    pdfDigest === undefined
  ) {
    throw new TypeError(
      "Source evidence requires one exact authority-free prepared run covering steps 1 through 359.",
    );
  }
  return intrinsicRealBuildFreeze({ preparedRunInputDigest, pdfDigest });
}
