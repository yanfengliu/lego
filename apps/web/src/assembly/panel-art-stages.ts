import {
  downsampleMask,
  keyPanelArt,
  keyPrintedBoxes,
  requireRaster,
  type PanelRaster,
} from "./panel-art";
import {
  analyseTrustedPanelArtStageComponents,
  MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS,
  type PanelArtStageComponentFacts,
} from "./panel-art-stage-components";
export {
  analysePanelArtStageComponents,
  MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES,
  MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS,
  type PanelArtStageComponentFacts,
  type PanelArtStageComponentSummary,
} from "./panel-art-stage-components";

export const PANEL_ART_STAGES_SCHEMA_VERSION = "lego.panel-art-stages/1" as const;
export const MAXIMUM_PANEL_ART_STAGE_WORK_PIXELS = 1_048_576;
export const MAXIMUM_PANEL_ART_STAGE_WORK_FACTOR = 4;
export const MAXIMUM_PANEL_ART_STAGE_CALLOUT_RECTANGLES = 1_024;

export interface PanelArtStagePixelRectangle {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface PanelArtStages {
  readonly schemaVersion: typeof PANEL_ART_STAGES_SCHEMA_VERSION;
  readonly authority: "absent";
  readonly width: number;
  readonly height: number;
  readonly workWidth: number;
  readonly workHeight: number;
  readonly workFactor: number;
  readonly highArtKeyMask: Uint8Array;
  readonly highPrintedFurnitureMask: Uint8Array;
  readonly highCalloutClearMask: Uint8Array;
  /** H: high-resolution art after printed furniture and prepared callouts are removed. */
  readonly highCleanedArtMask: Uint8Array;
  /** Historical scan-order selection at high resolution. */
  readonly highLegacySelectedMask: Uint8Array;
  readonly highComponents: PanelArtStageComponentFacts;
  readonly highArtKeyDownsampledMask: Uint8Array;
  readonly highPrintedFurnitureDownsampledMask: Uint8Array;
  readonly highCalloutClearDownsampledMask: Uint8Array;
  readonly highCleanedArtDownsampledMask: Uint8Array;
  /** P: isolate H first, then point-downsample the selected component. */
  readonly isolateThenDownsampleMask: Uint8Array;
  /** D: point-downsample H first, then isolate in the work raster. */
  readonly downsampleThenIsolateMask: Uint8Array;
  readonly downsampledComponents: PanelArtStageComponentFacts;
  readonly workOnlyStage: {
    readonly status: "missing";
    readonly reason: "work-raster-candidate-is-not-coupled-to-panel-art-stages/1";
  };
}

export interface DerivePanelArtStagesInput {
  /** Trusted in-process crop; hostile bytes are admitted only by the external trace parser. */
  readonly raster: PanelRaster;
  readonly workFactor: number;
  readonly calloutRectangles?: readonly PanelArtStagePixelRectangle[];
  readonly backgroundHex: number;
  readonly backgroundToleranceLevels?: number;
  readonly printedBoxWhiteLevel?: number;
  readonly printedBoxMinimumAreaPx?: number;
  readonly printedBoxMarginPx?: number;
}

function exactRaster(input: DerivePanelArtStagesInput): PanelRaster {
  requireRaster(input.raster, "panel-art stage high crop");
  const { width, height, pixels } = input.raster;
  const pixelCount = width * height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    !Number.isSafeInteger(pixelCount) ||
    pixelCount > MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS
  ) {
    throw new RangeError(
      `Panel-art stage high crop ${String(width)}x${String(height)} must cover 1 through ${MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS} pixels.`,
    );
  }
  if (!(pixels instanceof Uint8ClampedArray)) {
    throw new TypeError("Panel-art stage high crop pixels must be one exact Uint8ClampedArray.");
  }
  if (typeof SharedArrayBuffer !== "undefined" && pixels.buffer instanceof SharedArrayBuffer) {
    throw new TypeError("Panel-art stage high crop cannot use SharedArrayBuffer storage.");
  }
  return { width, height, pixels: new Uint8ClampedArray(pixels) };
}

function workDimensions(width: number, height: number, factor: number): [number, number] {
  if (!Number.isSafeInteger(factor) || factor < 1 || factor > MAXIMUM_PANEL_ART_STAGE_WORK_FACTOR) {
    throw new RangeError(
      `Panel-art stage workFactor must be a safe integer from 1 through ${MAXIMUM_PANEL_ART_STAGE_WORK_FACTOR}; received ${String(factor)}.`,
    );
  }
  const workWidth = Math.max(1, Math.ceil(width / factor));
  const workHeight = Math.max(1, Math.ceil(height / factor));
  const workPixels = workWidth * workHeight;
  if (!Number.isSafeInteger(workPixels) || workPixels > MAXIMUM_PANEL_ART_STAGE_WORK_PIXELS) {
    throw new RangeError(
      `Panel-art stage work raster ${workWidth}x${workHeight} exceeds ${MAXIMUM_PANEL_ART_STAGE_WORK_PIXELS} pixels. Increase the bounded work factor or refuse the crop.`,
    );
  }
  return [workWidth, workHeight];
}

function calloutMask(
  width: number,
  height: number,
  rectangles: readonly PanelArtStagePixelRectangle[],
): Uint8Array {
  if (rectangles.length > MAXIMUM_PANEL_ART_STAGE_CALLOUT_RECTANGLES) {
    throw new RangeError(
      `Panel-art stages received ${rectangles.length} callout rectangles; maximum is ${MAXIMUM_PANEL_ART_STAGE_CALLOUT_RECTANGLES}.`,
    );
  }
  const result = new Uint8Array(width * height);
  if (rectangles.length === 0) return result;
  const stride = width + 1;
  const cells = stride * (height + 1);
  if (!Number.isSafeInteger(cells) || cells > 3 * MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS + 1) {
    throw new RangeError(`Panel-art callout union requires ${String(cells)} bounded grid cells.`);
  }
  const differences = new Int32Array(cells);
  for (const [index, rectangle] of rectangles.entries()) {
    const values = [rectangle.minX, rectangle.maxX, rectangle.minY, rectangle.maxY];
    if (
      values.some((value) => !Number.isSafeInteger(value)) ||
      rectangle.minX < 0 ||
      rectangle.minY < 0 ||
      rectangle.maxX >= width ||
      rectangle.maxY >= height ||
      rectangle.maxX < rectangle.minX ||
      rectangle.maxY < rectangle.minY
    ) {
      throw new RangeError(
        `Panel-art callout rectangle ${index} must be one non-empty inclusive safe-integer rectangle inside ${width}x${height}.`,
      );
    }
    const afterX = rectangle.maxX + 1;
    const afterY = rectangle.maxY + 1;
    differences[rectangle.minY * stride + rectangle.minX]! += 1;
    differences[rectangle.minY * stride + afterX]! -= 1;
    differences[afterY * stride + rectangle.minX]! -= 1;
    differences[afterY * stride + afterX]! += 1;
  }
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      const at = y * stride + x;
      row += differences[at]!;
      const coverage = row + (y === 0 ? 0 : differences[at - stride]!);
      differences[at] = coverage;
      if (coverage > 0) result[y * width + x] = 1;
    }
  }
  return result;
}

function sampled(mask: Uint8Array, width: number, height: number, factor: number): Uint8Array {
  return downsampleMask({ width, height, mask }, factor).mask;
}

/**
 * Derives the exact high-first production mask and the downsample-first counterfactual.
 * It records scan-order behavior without granting that behavior source-truth authority.
 */
export function derivePanelArtStages(input: DerivePanelArtStagesInput): PanelArtStages {
  const raster = exactRaster(input);
  const { width, height } = raster;
  const [workWidth, workHeight] = workDimensions(width, height, input.workFactor);
  const highArtKeyMask = keyPanelArt(raster, {
    backgroundHex: input.backgroundHex,
    toleranceLevels: input.backgroundToleranceLevels ?? 10,
  });
  const highPrintedFurnitureMask = keyPrintedBoxes(raster, {
    whiteLevel: input.printedBoxWhiteLevel ?? 246,
    minimumAreaPx: input.printedBoxMinimumAreaPx ?? 400,
    marginPx: input.printedBoxMarginPx ?? 6,
  });
  const highCalloutClearMask = calloutMask(width, height, input.calloutRectangles ?? []);
  const highCleanedArtMask = new Uint8Array(highArtKeyMask);
  for (let pixel = 0; pixel < highCleanedArtMask.length; pixel += 1) {
    if (highPrintedFurnitureMask[pixel] === 1 || highCalloutClearMask[pixel] === 1) {
      highCleanedArtMask[pixel] = 0;
    }
  }
  const high = analyseTrustedPanelArtStageComponents(highCleanedArtMask, width, height);
  const highCleanedArtDownsampledMask = sampled(
    highCleanedArtMask,
    width,
    height,
    input.workFactor,
  );
  const downsampled = analyseTrustedPanelArtStageComponents(
    highCleanedArtDownsampledMask,
    workWidth,
    workHeight,
  );
  return Object.freeze({
    schemaVersion: PANEL_ART_STAGES_SCHEMA_VERSION,
    authority: "absent",
    width,
    height,
    workWidth,
    workHeight,
    workFactor: input.workFactor,
    highArtKeyMask,
    highPrintedFurnitureMask,
    highCalloutClearMask,
    highCleanedArtMask,
    highLegacySelectedMask: high.mask,
    highComponents: high.facts,
    highArtKeyDownsampledMask: sampled(highArtKeyMask, width, height, input.workFactor),
    highPrintedFurnitureDownsampledMask: sampled(
      highPrintedFurnitureMask,
      width,
      height,
      input.workFactor,
    ),
    highCalloutClearDownsampledMask: sampled(highCalloutClearMask, width, height, input.workFactor),
    highCleanedArtDownsampledMask,
    isolateThenDownsampleMask: sampled(high.mask, width, height, input.workFactor),
    downsampleThenIsolateMask: downsampled.mask,
    downsampledComponents: downsampled.facts,
    workOnlyStage: Object.freeze({
      status: "missing",
      reason: "work-raster-candidate-is-not-coupled-to-panel-art-stages/1",
    }),
  });
}
