import {
  REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS,
  realBuildSourceParityWorkGeometry,
} from "./real-build-observation-source-parity-contract";
import type {
  RealBuildSourceParityBounds,
  RealBuildSourceParityProbePanel,
} from "./real-build-observation-source-parity-types";
import { REAL_BUILD_SOURCE_PARITY_CLASSES } from "./real-build-observation-source-parity-types";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;

export interface RealBuildSourceParityBrowserInputShape {
  readonly expectedPdfDigest: string;
  readonly expectedPdfBytes: number;
  readonly preparedPanelsDigest: string;
  readonly panels: readonly RealBuildSourceParityProbePanel[];
}

function observed(value: unknown): string {
  if (typeof value === "string") {
    const bounded = value.length <= 80 ? value : `${value.slice(0, 77)}...`;
    return JSON.stringify(bounded);
  }
  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  if (Array.isArray(value)) return `Array(length=${value.length})`;
  return typeof value;
}

function assertDigest(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new TypeError(
      `${path} observed ${observed(value)}; expected an exact lowercase sha256:<64 hex> digest.`,
    );
  }
}

function assertPositiveBounds(value: unknown, path: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} observed ${observed(value)}; expected one bounds data object.`);
  }
  const bounds = value as Record<keyof RealBuildSourceParityBounds, unknown>;
  for (const key of ["minXPt", "maxXPt", "minYPt", "maxYPt"] as const) {
    if (typeof bounds[key] !== "number" || !Number.isFinite(bounds[key])) {
      throw new RangeError(
        `${path}.${key} observed ${observed(bounds[key])}; expected one finite number.`,
      );
    }
  }
  if ((bounds.maxXPt as number) <= (bounds.minXPt as number)) {
    throw new RangeError(
      `${path}.maxXPt observed ${bounds.maxXPt}; expected greater than ${path}.minXPt observed ${bounds.minXPt}.`,
    );
  }
  if ((bounds.maxYPt as number) <= (bounds.minYPt as number)) {
    throw new RangeError(
      `${path}.maxYPt observed ${bounds.maxYPt}; expected greater than ${path}.minYPt observed ${bounds.minYPt}.`,
    );
  }
}

export function assertRealBuildSourceParityBrowserInput(
  input: RealBuildSourceParityBrowserInputShape,
): void {
  assertDigest(input.expectedPdfDigest, "Source-parity browser input.expectedPdfDigest");
  assertDigest(input.preparedPanelsDigest, "Source-parity browser input.preparedPanelsDigest");
  if (
    !Number.isSafeInteger(input.expectedPdfBytes) ||
    input.expectedPdfBytes < 1 ||
    input.expectedPdfBytes > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES
  ) {
    throw new RangeError(
      `Source-parity browser input.expectedPdfBytes observed ${observed(input.expectedPdfBytes)}; expected a safe integer from 1 through ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES}.`,
    );
  }
  if (!Array.isArray(input.panels)) {
    throw new TypeError(
      `Source-parity browser input.panels observed ${observed(input.panels)}; expected an Array of exactly ${REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS} panels.`,
    );
  }
  if (input.panels.length !== REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS) {
    throw new RangeError(
      `Source-parity browser input.panels.length observed ${input.panels.length}; expected exactly ${REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS}.`,
    );
  }
  let previousPage = 0;
  let totalPanelPixels = 0;
  for (let index = 0; index < input.panels.length; index += 1) {
    const panel = input.panels[index]!;
    const path = `Source-parity browser input.panels[${index}]`;
    if (panel === null || typeof panel !== "object" || Array.isArray(panel)) {
      throw new TypeError(`${path} observed ${observed(panel)}; expected one panel data object.`);
    }
    if (panel.stepNumber !== index + 1) {
      throw new TypeError(
        `${path}.stepNumber observed ${observed(panel.stepNumber)}; expected exactly ${index + 1}.`,
      );
    }
    if (!Number.isSafeInteger(panel.pageNumber) || panel.pageNumber < 1 || panel.pageNumber > 400) {
      throw new RangeError(
        `${path}.pageNumber observed ${observed(panel.pageNumber)}; expected a safe integer from 1 through 400.`,
      );
    }
    if (panel.pageNumber < previousPage) {
      throw new RangeError(
        `${path}.pageNumber observed ${panel.pageNumber}; expected at least prior page ${previousPage}.`,
      );
    }
    assertPositiveBounds(panel, path);
    assertDigest(panel.panelEvidenceDigest, `${path}.panelEvidenceDigest`);

    const { pixels: workPixels } = realBuildSourceParityWorkGeometry(panel);
    totalPanelPixels += workPixels;
    if (
      !Number.isSafeInteger(workPixels) ||
      workPixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS ||
      totalPanelPixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS ||
      totalPanelPixels * REAL_BUILD_SOURCE_PARITY_CLASSES.length >
        REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS
    ) {
      throw new RangeError(
        `${path} derived cumulative work pixels ${observed(totalPanelPixels)}; expected this row and the running total to remain within the pre-render panel and comparison bounds.`,
      );
    }
    if (!Array.isArray(panel.calloutBoxes)) {
      throw new TypeError(
        `${path}.calloutBoxes observed ${observed(panel.calloutBoxes)}; expected an Array of 0 through ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS} bounds.`,
      );
    }
    if (panel.calloutBoxes.length > REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS) {
      throw new RangeError(
        `${path}.calloutBoxes.length observed ${panel.calloutBoxes.length}; expected 0 through ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS}.`,
      );
    }
    for (let calloutIndex = 0; calloutIndex < panel.calloutBoxes.length; calloutIndex += 1) {
      assertPositiveBounds(
        panel.calloutBoxes[calloutIndex],
        `${path}.calloutBoxes[${calloutIndex}]`,
      );
    }
    previousPage = panel.pageNumber;
  }
}
