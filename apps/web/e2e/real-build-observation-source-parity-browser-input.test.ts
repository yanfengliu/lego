import { describe, expect, it } from "vitest";

import {
  assertRealBuildSourceParityBrowserInput,
  snapshotRealBuildSourceParityBrowserInput,
} from "./real-build-observation-source-parity-browser-input";
import { REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS } from "./real-build-observation-source-parity-contract";
import type { RealBuildSourceParityBrowserInputShape } from "./real-build-observation-source-parity-browser-input";
import type { RealBuildSourceParityMeasurementInput } from "./real-build-observation-source-parity-browser-types";

const digest = `sha256:${"0".repeat(64)}`;

function validInput(): RealBuildSourceParityMeasurementInput {
  return {
    urls: {
      pdfjsUrl: "/pdf.mjs",
      workerUrl: "/worker.mjs",
      pdfUrl: "/booklet.pdf",
      latticeUrl: "/lattice.ts",
      assemblyUrl: "/assembly.ts",
      panelRasterUrl: "/panel-raster.ts",
      candidateUrl: "/candidate.ts",
    },
    expectedPdfDigest: digest,
    expectedPdfBytes: 1,
    preparedPanelsDigest: digest,
    panels: Array.from({ length: REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS }, (_, index) => ({
      stepNumber: index + 1,
      pageNumber: index + 1,
      minXPt: 0,
      maxXPt: 1_000,
      minYPt: 0,
      maxYPt: 1,
      calloutBoxes: [],
      panelEvidenceDigest: digest,
    })),
  };
}

describe("source-parity browser input errors", () => {
  it.each([
    [
      "step leaf",
      (input: RealBuildSourceParityBrowserInputShape) =>
        ((input.panels[3] as { stepNumber: number }).stepNumber = 9),
      /panels\[3\]\.stepNumber observed 9; expected exactly 4/u,
    ],
    [
      "page leaf",
      (input: RealBuildSourceParityBrowserInputShape) =>
        ((input.panels[3] as { pageNumber: number }).pageNumber = 1.5),
      /panels\[3\]\.pageNumber observed 1.5; expected a safe integer from 1 through 400/u,
    ],
    [
      "monotonic page leaf",
      (input: RealBuildSourceParityBrowserInputShape) =>
        ((input.panels[3] as { pageNumber: number }).pageNumber = 2),
      /panels\[3\]\.pageNumber observed 2; expected at least prior page 3/u,
    ],
    [
      "coordinate leaf",
      (input: RealBuildSourceParityBrowserInputShape) =>
        ((input.panels[3] as { minXPt: number }).minXPt = Number.NaN),
      /panels\[3\]\.minXPt observed NaN; expected one finite number/u,
    ],
    [
      "ordered coordinate leaf",
      (input: RealBuildSourceParityBrowserInputShape) =>
        ((input.panels[3] as { maxXPt: number }).maxXPt = 0),
      /panels\[3\]\.maxXPt observed 0; expected greater than .*minXPt observed 0/u,
    ],
    [
      "digest leaf",
      (input: RealBuildSourceParityBrowserInputShape) =>
        ((input.panels[3] as { panelEvidenceDigest: string }).panelEvidenceDigest = "wrong"),
      /panels\[3\]\.panelEvidenceDigest observed "wrong"; expected an exact lowercase/u,
    ],
    [
      "callout collection leaf",
      (input: RealBuildSourceParityBrowserInputShape) =>
        ((input.panels[3] as { calloutBoxes: unknown }).calloutBoxes = "wrong"),
      /panels\[3\]\.calloutBoxes observed "wrong"; expected an Array/u,
    ],
    [
      "callout coordinate leaf",
      (input: RealBuildSourceParityBrowserInputShape) =>
        ((input.panels[3] as unknown as { calloutBoxes: unknown[] }).calloutBoxes = [
          { minXPt: 0, maxXPt: 1, minYPt: 0, maxYPt: Number.NaN },
        ]),
      /panels\[3\]\.calloutBoxes\[0\]\.maxYPt observed NaN; expected one finite number/u,
    ],
  ])("reports the exact invalid %s", (_label, mutate, expected) => {
    const input = validInput();
    mutate(input);
    expect(() => assertRealBuildSourceParityBrowserInput(input)).toThrowError(expected);
  });

  it("refuses a panel accessor without invoking it", () => {
    const input = validInput();
    let reads = 0;
    Object.defineProperty(input.panels[0], "stepNumber", {
      enumerable: true,
      get: () => {
        reads += 1;
        return 1;
      },
    });
    expect(() => snapshotRealBuildSourceParityBrowserInput(input)).toThrow(
      /panels\[0\]\.stepNumber must be one enumerable own data field/u,
    );
    expect(reads).toBe(0);
  });

  it("refuses a URL accessor without invoking it before measurement", () => {
    const input = validInput();
    let reads = 0;
    Object.defineProperty(input.urls, "pdfUrl", {
      enumerable: true,
      get: () => {
        reads += 1;
        return "/replacement.pdf";
      },
    });
    expect(() => snapshotRealBuildSourceParityBrowserInput(input)).toThrow(
      /urls\.pdfUrl must be one enumerable own data field/u,
    );
    expect(reads).toBe(0);
  });
});
