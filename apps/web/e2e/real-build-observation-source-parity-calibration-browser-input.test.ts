import { canonicalDigest, sha256Hex } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  requireValidatedRealBuildSourceParityCalibrationBrowserInput,
  snapshotRealBuildSourceParityCalibrationBrowserInput,
  type RealBuildSourceParityCalibrationBrowserInput,
} from "./real-build-observation-source-parity-calibration-browser-input";
import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES } from "./real-build-observation-source-parity-calibration-selection";
import { realBuildSourceParityPreparedPanelsManifest } from "./real-build-observation-source-parity-contract";

const digest = (value: string): `sha256:${string}` => `sha256:${sha256Hex(value)}`;

function input(): RealBuildSourceParityCalibrationBrowserInput {
  const expectedPdfDigest = digest("pdf");
  const panels = REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.map(
    ({ stepNumber, pageNumber }) => ({
      stepNumber,
      pageNumber,
      minXPt: 0,
      maxXPt: 1_000,
      minYPt: 0,
      maxYPt: 1,
      calloutBoxes: [],
      panelEvidenceDigest: digest(`panel-${stepNumber}`),
    }),
  );
  const fullPreparedPanelsDigest = digest("full-359");
  const calibrationPreparedPanelsDigest = digest(
    JSON.stringify(realBuildSourceParityPreparedPanelsManifest(expectedPdfDigest, panels)),
  );
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
    expectedPdfDigest,
    expectedPdfBytes: 1,
    fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest,
    calibrationDigest: canonicalDigest({
      schemaVersion: "lego.real-build-observation-source-parity-calibration-contract/1",
      authority: "absent",
      pdfDigest: expectedPdfDigest,
      fullPreparedPanelsDigest,
      calibrationPreparedPanelsDigest,
      panels: panels.map(({ stepNumber, pageNumber }) => ({
        stepNumber,
        pageNumber,
        width: 500,
        height: 1,
        pixelCount: 500,
        workFactor: 2,
      })),
    }),
    panels,
  };
}

describe("exact-five calibration browser input", () => {
  it("detaches and brands only the fixed five step/page rows", () => {
    const raw = input();
    const snapshot = snapshotRealBuildSourceParityCalibrationBrowserInput(raw);
    expect(snapshot).not.toBe(raw);
    expect(snapshot.panels.map(({ stepNumber, pageNumber }) => [stepNumber, pageNumber])).toEqual(
      REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.map(({ stepNumber, pageNumber }) => [
        stepNumber,
        pageNumber,
      ]),
    );
    expect(() => requireValidatedRealBuildSourceParityCalibrationBrowserInput(raw)).toThrow(
      /exact snapshot admitted/u,
    );
    expect(() =>
      requireValidatedRealBuildSourceParityCalibrationBrowserInput(snapshot),
    ).not.toThrow();
  });

  it("refuses a tuple substitution before measurement", () => {
    const raw = input();
    (raw.panels[1] as { stepNumber: number }).stepNumber = 102;
    expect(() => snapshotRealBuildSourceParityCalibrationBrowserInput(raw)).toThrow(
      /panels\[1\]\.stepNumber observed 102; expected fixed calibration step 101/u,
    );
  });

  it("refuses a syntactically valid but unreproduced calibration contract before work", () => {
    const raw = input();
    (raw as { calibrationDigest: string }).calibrationDigest = digest("detached-contract");
    expect(() => snapshotRealBuildSourceParityCalibrationBrowserInput(raw)).toThrow(
      /contract reproduces sha256:.*expected declared calibrationDigest sha256:/u,
    );
  });

  it("refuses hidden numeric array elements before branding", () => {
    const raw = input();
    const panels = [...raw.panels];
    Object.defineProperty(panels, "0", {
      enumerable: false,
      configurable: true,
      writable: true,
      value: panels[0],
    });
    (raw as { panels: readonly unknown[] }).panels = panels;
    expect(() => snapshotRealBuildSourceParityCalibrationBrowserInput(raw)).toThrow(
      /dense accessor-free standard Array with no extra fields/u,
    );
  });

  it("refuses an outer accessor without invoking it", () => {
    const raw = input() as unknown as Record<string, unknown>;
    let reads = 0;
    Object.defineProperty(raw, "expectedPdfDigest", {
      enumerable: true,
      get: () => {
        reads += 1;
        return digest("replacement");
      },
    });
    expect(() => snapshotRealBuildSourceParityCalibrationBrowserInput(raw)).toThrow(
      /expectedPdfDigest must be one enumerable own data field/u,
    );
    expect(reads).toBe(0);
  });

  it("contains a hostile proxy trap before any fetch-capable object is branded", () => {
    const raw = new Proxy(input(), {
      ownKeys: () => {
        throw new Error("trap-fired");
      },
    });
    expect(() => snapshotRealBuildSourceParityCalibrationBrowserInput(raw)).toThrow(
      /refused safe descriptor inspection before any field access/u,
    );
  });
});
