import { FULL_PREPARED_PANELS_MANIFEST_BYTES } from "./real-build-observation-source-parity-field-names.ts";
import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { createRealBuildSourceParityCalibrationContract } from "./real-build-observation-source-parity-calibration-contract";
import {
  REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
  realBuildSourceParityPreparedPanelsManifest,
} from "./real-build-observation-source-parity-contract";
import {
  boundedDenseCaptureArray,
  exactCaptureRecord,
  snapshotCaptureBytes,
} from "./real-build-observation-source-parity-calibration-capture-structure";
import { MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_FULL_MANIFEST_BYTES } from "./real-build-observation-source-parity-calibration-publication-types";
import type { RealBuildSourceParityCalibrationContract } from "./real-build-observation-source-parity-calibration-contract";
import {
  sourceParityDigest,
  sourceParityFinite,
  sourceParityInteger,
} from "./real-build-observation-source-parity-output-primitives";
import type {
  RealBuildSourceParityBounds,
  RealBuildSourceParityProbePanel,
} from "./real-build-observation-source-parity-types";

const MANIFEST_SCHEMA = "lego.real-build-observation-source-parity-prepared-panels/1";
const decoder = new TextDecoder("utf-8", { fatal: true });

export interface ParsedRealBuildSourceParityCalibrationFullManifest {
  readonly bytes: Uint8Array;
  readonly digest: Sha256Digest;
  readonly pdfDigest: Sha256Digest;
  readonly panels: readonly RealBuildSourceParityProbePanel[];
  readonly contract: RealBuildSourceParityCalibrationContract;
}

function bounds(value: unknown, label: string): RealBuildSourceParityBounds {
  const row = exactCaptureRecord(value, ["minXPt", "maxXPt", "minYPt", "maxYPt"], label);
  const result = {
    minXPt: sourceParityFinite(row.minXPt, `${label}.minXPt`),
    maxXPt: sourceParityFinite(row.maxXPt, `${label}.maxXPt`),
    minYPt: sourceParityFinite(row.minYPt, `${label}.minYPt`),
    maxYPt: sourceParityFinite(row.maxYPt, `${label}.maxYPt`),
  };
  if (result.maxXPt <= result.minXPt || result.maxYPt <= result.minYPt) {
    throw new RangeError(`${label} must have strictly increasing finite coordinates.`);
  }
  return Object.freeze(result);
}

function panel(value: unknown, index: number): RealBuildSourceParityProbePanel {
  const label = `calibrationPublication.fullPreparedPanels.panels[${index}]`;
  const row = exactCaptureRecord(
    value,
    ["stepNumber", "pageNumber", "bounds", "calloutBoxes", "panelEvidenceDigest"],
    label,
  );
  const callouts = boundedDenseCaptureArray(
    row.calloutBoxes,
    0,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
    `${label}.calloutBoxes`,
  ).map((box, boxIndex) => bounds(box, `${label}.calloutBoxes[${boxIndex}]`));
  return Object.freeze({
    stepNumber: sourceParityInteger(row.stepNumber, index + 1, index + 1, `${label}.stepNumber`),
    pageNumber: sourceParityInteger(row.pageNumber, 1, 1_024, `${label}.pageNumber`),
    ...bounds(row.bounds, `${label}.bounds`),
    calloutBoxes: Object.freeze(callouts),
    panelEvidenceDigest: sourceParityDigest(
      row.panelEvidenceDigest,
      `${label}.panelEvidenceDigest`,
    ),
  });
}

/** Parses the exact JSON.stringify/no-newline prepared-panel convention and reproduces it. */
export function parseRealBuildSourceParityCalibrationFullPreparedPanelsManifest(
  value: unknown,
): ParsedRealBuildSourceParityCalibrationFullManifest {
  const bytes = snapshotCaptureBytes(
    value,
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_FULL_MANIFEST_BYTES,
    "calibrationPublication." + FULL_PREPARED_PANELS_MANIFEST_BYTES,
  );
  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch {
    throw new TypeError(
      "Calibration full prepared-panels manifest must be fatal UTF-8 without replacement characters.",
    );
  }
  const roundTrip = new TextEncoder().encode(text);
  if (roundTrip.length !== bytes.length || roundTrip.some((byte, index) => byte !== bytes[index])) {
    throw new TypeError(
      "Calibration full prepared-panels manifest must round-trip as exact UTF-8 without a byte-order mark.",
    );
  }
  if (text.length < 2 || text.endsWith("\n") || text.endsWith("\r")) {
    throw new TypeError(
      "Calibration full prepared-panels manifest must use exact JSON.stringify bytes with no trailing newline.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError(
      "Calibration full prepared-panels manifest must be one complete JSON value.",
    );
  }
  const root = exactCaptureRecord(
    parsed,
    ["schemaVersion", "authority", "pdfDigest", "panels"],
    "calibrationPublication.fullPreparedPanels",
  );
  if (root.schemaVersion !== MANIFEST_SCHEMA || root.authority !== "absent") {
    throw new TypeError(
      `Calibration full prepared-panels manifest must use ${MANIFEST_SCHEMA} with authority absent.`,
    );
  }
  const pdfDigest = sourceParityDigest(
    root.pdfDigest,
    "Calibration full prepared-panels PDF digest",
  ) as Sha256Digest;
  const panels = boundedDenseCaptureArray(
    root.panels,
    REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
    REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
    "calibrationPublication.fullPreparedPanels.panels",
  ).map(panel);
  const reproduced = JSON.stringify(realBuildSourceParityPreparedPanelsManifest(pdfDigest, panels));
  if (reproduced !== text) {
    throw new TypeError(
      "Calibration full prepared-panels rows do not reproduce the retained manifest bytes.",
    );
  }
  const digest = `sha256:${sha256Hex(bytes)}` as Sha256Digest;
  const contract = createRealBuildSourceParityCalibrationContract({
    pdfDigest,
    fullPreparedPanelsDigest: digest,
    panels,
  });
  return Object.freeze({
    bytes: new Uint8Array(bytes),
    digest,
    pdfDigest,
    panels: Object.freeze(panels),
    contract,
  });
}
