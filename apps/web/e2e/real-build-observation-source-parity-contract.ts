import type {
  RealBuildSourceParityBounds,
  RealBuildSourceParityProbePanel,
} from "./real-build-observation-source-parity-types";

export const REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS = 359;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS = 1_048_576;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS = 1_024;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS = 96_000_000;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS = 480_000_000;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_CAPTURE_ROWS = 1_795;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_ROWS = 3_590;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_BYTES = 128 * 1024 * 1024;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES = 96 * 1024 * 1024;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES = 384 * 1024 * 1024;
export const REAL_BUILD_SOURCE_PARITY_PANEL_WIDTH = 1_000;
export const REAL_BUILD_SOURCE_PARITY_WORK_FACTOR = 2;
export const REAL_BUILD_SOURCE_PARITY_RENDER_SCALE = 6;

export function realBuildSourceParityWorkGeometry(bounds: RealBuildSourceParityBounds): {
  readonly width: number;
  readonly height: number;
  readonly pixels: number;
} {
  const sourceWidth = (bounds.maxXPt - bounds.minXPt) * REAL_BUILD_SOURCE_PARITY_RENDER_SCALE;
  const sourceHeight = (bounds.maxYPt - bounds.minYPt) * REAL_BUILD_SOURCE_PARITY_RENDER_SCALE;
  const ratio = REAL_BUILD_SOURCE_PARITY_PANEL_WIDTH / sourceWidth;
  const fitWidth = Math.max(1, Math.round(REAL_BUILD_SOURCE_PARITY_PANEL_WIDTH));
  const fitHeight = Math.max(1, Math.round(sourceHeight * ratio));
  const width = Math.ceil(fitWidth / REAL_BUILD_SOURCE_PARITY_WORK_FACTOR);
  const height = Math.ceil(fitHeight / REAL_BUILD_SOURCE_PARITY_WORK_FACTOR);
  return { width, height, pixels: width * height };
}

const exactBounds = (value: RealBuildSourceParityBounds): RealBuildSourceParityBounds => ({
  minXPt: value.minXPt,
  maxXPt: value.maxXPt,
  minYPt: value.minYPt,
  maxYPt: value.maxYPt,
});

export function realBuildSourceParityPreparedPanelsManifest(
  pdfDigest: string,
  panels: readonly RealBuildSourceParityProbePanel[],
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: "lego.real-build-observation-source-parity-prepared-panels/1",
    authority: "absent",
    pdfDigest,
    panels: panels.map((panel) => ({
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      bounds: exactBounds(panel),
      calloutBoxes: panel.calloutBoxes.map(exactBounds),
      panelEvidenceDigest: panel.panelEvidenceDigest,
    })),
  };
}
