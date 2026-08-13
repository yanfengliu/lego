import {
  canonicalDigest,
  deepFreeze,
  sha256Hex,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { assertRealBuildSourceParityBrowserInput } from "./real-build-observation-source-parity-browser-input";
import {
  REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
  REAL_BUILD_SOURCE_PARITY_WORK_FACTOR,
  realBuildSourceParityPreparedPanelsManifest,
  realBuildSourceParityWorkGeometry,
} from "./real-build-observation-source-parity-contract";
export { REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES } from "./real-build-observation-source-parity-calibration-selection";
import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES } from "./real-build-observation-source-parity-calibration-selection";
import {
  boundedDenseSourceParityArray,
  exactSourceParityKeys,
  snapshotDenseSourceParityArray,
  snapshotSourceParityRecord,
  sourceParityDigest,
  sourceParityFinite,
} from "./real-build-observation-source-parity-output-primitives";
import type {
  RealBuildSourceParityBounds,
  RealBuildSourceParityProbePanel,
} from "./real-build-observation-source-parity-types";

export interface RealBuildSourceParityCalibrationPanelContract {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly width: number;
  readonly height: number;
  readonly pixelCount: number;
  readonly workFactor: typeof REAL_BUILD_SOURCE_PARITY_WORK_FACTOR;
}

export interface RealBuildSourceParityCalibrationContract {
  readonly schemaVersion: "lego.real-build-observation-source-parity-calibration-contract/1";
  readonly authority: "absent";
  readonly pdfDigest: Sha256Digest;
  readonly fullPreparedPanelsDigest: Sha256Digest;
  readonly calibrationPreparedPanelsDigest: Sha256Digest;
  readonly panels: readonly RealBuildSourceParityCalibrationPanelContract[];
  readonly calibrationDigest: Sha256Digest;
}

const authenticatedCalibrationContracts = new WeakSet<object>();
const PANEL_KEYS = [
  "stepNumber",
  "pageNumber",
  "minXPt",
  "maxXPt",
  "minYPt",
  "maxYPt",
  "calloutBoxes",
  "panelEvidenceDigest",
] as const;
const BOUNDS_KEYS = ["minXPt", "maxXPt", "minYPt", "maxYPt"] as const;

function snapshotBounds(value: unknown, label: string): RealBuildSourceParityBounds {
  exactSourceParityKeys(value, BOUNDS_KEYS, label);
  const raw = snapshotSourceParityRecord(value as RealBuildSourceParityBounds, BOUNDS_KEYS);
  const minXPt = sourceParityFinite(raw.minXPt, `${label}.minXPt`);
  const maxXPt = sourceParityFinite(raw.maxXPt, `${label}.maxXPt`);
  const minYPt = sourceParityFinite(raw.minYPt, `${label}.minYPt`);
  const maxYPt = sourceParityFinite(raw.maxYPt, `${label}.maxYPt`);
  if (maxXPt <= minXPt || maxYPt <= minYPt) {
    throw new RangeError(
      `${label} must have strictly increasing finite horizontal and vertical bounds.`,
    );
  }
  return Object.freeze({ minXPt, maxXPt, minYPt, maxYPt });
}

function snapshotPanel(value: unknown, index: number): RealBuildSourceParityProbePanel {
  const label = `Calibration full prepared panel row ${index}`;
  exactSourceParityKeys(value, PANEL_KEYS, label);
  const raw = snapshotSourceParityRecord(value as RealBuildSourceParityProbePanel, PANEL_KEYS);
  boundedDenseSourceParityArray(
    raw.calloutBoxes,
    0,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
    `${label}.calloutBoxes`,
  );
  const calloutBoxes = snapshotDenseSourceParityArray(raw.calloutBoxes).map((box, boxIndex) =>
    snapshotBounds(box, `${label}.calloutBoxes[${boxIndex}]`),
  );
  const bounds = snapshotBounds(
    {
      minXPt: raw.minXPt,
      maxXPt: raw.maxXPt,
      minYPt: raw.minYPt,
      maxYPt: raw.maxYPt,
    },
    `${label}.bounds`,
  );
  return Object.freeze({
    stepNumber: raw.stepNumber,
    pageNumber: raw.pageNumber,
    ...bounds,
    calloutBoxes: Object.freeze(calloutBoxes),
    panelEvidenceDigest: sourceParityDigest(
      raw.panelEvidenceDigest,
      `${label}.panelEvidenceDigest`,
    ),
  }) as RealBuildSourceParityProbePanel;
}

const jsonDigest = (value: unknown): Sha256Digest => `sha256:${sha256Hex(JSON.stringify(value))}`;

export function createRealBuildSourceParityCalibrationContract(
  rawInput: unknown,
): RealBuildSourceParityCalibrationContract {
  exactSourceParityKeys(
    rawInput,
    ["pdfDigest", "fullPreparedPanelsDigest", "panels"],
    "Source-parity calibration contract input",
  );
  const input = snapshotSourceParityRecord(
    rawInput as {
      readonly pdfDigest: unknown;
      readonly fullPreparedPanelsDigest: unknown;
      readonly panels: unknown;
    },
    ["pdfDigest", "fullPreparedPanelsDigest", "panels"],
  );
  const pdfDigest = sourceParityDigest(input.pdfDigest, "Calibration PDF digest") as Sha256Digest;
  const fullPreparedPanelsDigest = sourceParityDigest(
    input.fullPreparedPanelsDigest,
    "Calibration full prepared-panels digest",
  ) as Sha256Digest;
  boundedDenseSourceParityArray(
    input.panels,
    REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
    REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
    "Calibration full prepared panels",
  );
  const panels = snapshotDenseSourceParityArray(input.panels).map(snapshotPanel);
  assertRealBuildSourceParityBrowserInput({
    expectedPdfDigest: pdfDigest,
    expectedPdfBytes: 1,
    preparedPanelsDigest: fullPreparedPanelsDigest,
    panels,
  });
  const reproducedFullDigest = jsonDigest(
    realBuildSourceParityPreparedPanelsManifest(pdfDigest, panels),
  );
  if (reproducedFullDigest !== fullPreparedPanelsDigest) {
    throw new TypeError(
      `Calibration full prepared panels reproduce ${reproducedFullDigest}, not declared ${fullPreparedPanelsDigest}.`,
    );
  }
  const calibrationPanels = REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.map(
    ({ stepNumber, pageNumber }, index) => {
      const panel = panels[stepNumber - 1]!;
      if (panel.stepNumber !== stepNumber || panel.pageNumber !== pageNumber) {
        throw new TypeError(
          `Calibration row ${index} must bind printed step ${stepNumber} to booklet page ${pageNumber}; observed step ${String(panel.stepNumber)} on page ${String(panel.pageNumber)}.`,
        );
      }
      return panel;
    },
  );
  const calibrationPreparedPanelsDigest = jsonDigest(
    realBuildSourceParityPreparedPanelsManifest(pdfDigest, calibrationPanels),
  );
  const contractBase = {
    schemaVersion: "lego.real-build-observation-source-parity-calibration-contract/1" as const,
    authority: "absent" as const,
    pdfDigest,
    fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest,
    panels: calibrationPanels.map((panel) => {
      const geometry = realBuildSourceParityWorkGeometry(panel);
      return {
        stepNumber: panel.stepNumber,
        pageNumber: panel.pageNumber,
        width: geometry.width,
        height: geometry.height,
        pixelCount: geometry.pixels,
        workFactor: 2 as const,
      };
    }),
  };
  const contract = deepFreeze({
    ...contractBase,
    calibrationDigest: canonicalDigest(contractBase),
  });
  authenticatedCalibrationContracts.add(contract);
  return contract;
}

export function requireRealBuildSourceParityCalibrationContract(
  value: unknown,
): RealBuildSourceParityCalibrationContract {
  if (
    value === null ||
    typeof value !== "object" ||
    !authenticatedCalibrationContracts.has(value)
  ) {
    throw new TypeError(
      "Calibration adjudication requires an authenticated current contract derived from all 359 prepared panels.",
    );
  }
  return value as RealBuildSourceParityCalibrationContract;
}
