import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import type { PixelBounds } from "./panel-art";

export const MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS = 4_194_304;
export const MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES = 16;

export interface PanelArtStageComponentSummary {
  readonly scanIndex: number;
  readonly seedPixel: number;
  readonly areaPx: number;
  readonly bounds: PixelBounds;
  readonly touchesLeft: boolean;
  readonly touchesRight: boolean;
  readonly touchesTop: boolean;
  readonly touchesBottom: boolean;
}

export interface PanelArtStageComponentFacts {
  readonly width: number;
  readonly height: number;
  readonly componentCount: number;
  readonly setPixels: number;
  /** Digest of one canonical big-endian component label per raster pixel. */
  readonly componentPartitionDigest: Sha256Digest;
  readonly maximumAreaPx: number;
  readonly largestComponentCount: number;
  readonly retainedTopComponents: readonly PanelArtStageComponentSummary[];
  /** The historical first maximum in scan order. It remains reproducible, not authoritative. */
  readonly legacySelected: PanelArtStageComponentSummary | null;
  /** A unique non-frame-like maximum, retained only as a structural heuristic. */
  readonly unambiguousLargestSelection: PanelArtStageComponentSummary | null;
  readonly selectionRefusal:
    "no-component" | "equal-largest-components" | "frame-spanning-thin-component" | null;
}

export interface PanelArtStageComponentAnalysis {
  readonly mask: Uint8Array;
  readonly facts: PanelArtStageComponentFacts;
}

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "length")?.get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const TYPED_ARRAY_TAG = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const SHARED_BYTE_LENGTH =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;

function canonicalPartitionDigest(labels: Int32Array): Sha256Digest {
  const bytes = new Uint8Array(labels.length * 4);
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index]! + 1;
    const at = index * 4;
    bytes[at] = (label >>> 24) & 0xff;
    bytes[at + 1] = (label >>> 16) & 0xff;
    bytes[at + 2] = (label >>> 8) & 0xff;
    bytes[at + 3] = label & 0xff;
  }
  return `sha256:${sha256Hex(bytes)}`;
}

/** Internal counterpart for masks already snapshotted by the stage factory/parser. */
export function analyseTrustedPanelArtStageComponents(
  mask: Uint8Array,
  width: number,
  height: number,
): PanelArtStageComponentAnalysis {
  const labels = new Int32Array(mask.length).fill(-1);
  const stack = new Int32Array(mask.length);
  const retainedScanIndex = new Int32Array(MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES).fill(-1);
  const retainedSeedPixel = new Int32Array(MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES);
  const retainedAreaPx = new Int32Array(MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES);
  const retainedMinX = new Int32Array(MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES);
  const retainedMinY = new Int32Array(MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES);
  const retainedMaxX = new Int32Array(MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES);
  const retainedMaxY = new Int32Array(MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES);
  let retainedCount = 0;
  let componentCount = 0;
  let setPixels = 0;
  let maximumAreaPx = 0;
  let largestComponentCount = 0;
  let legacySelectedScanIndex = -1;
  for (let seed = 0; seed < mask.length; seed += 1) {
    if (mask[seed] !== 1 || labels[seed] !== -1) continue;
    const scanIndex = componentCount;
    componentCount += 1;
    let stackLength = 1;
    stack[0] = seed;
    labels[seed] = scanIndex;
    let areaPx = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    while (stackLength > 0) {
      const at = stack[--stackLength]!;
      const x = at % width;
      const y = (at - x) / width;
      areaPx += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      // Keep legacy left/right/up/down push order without per-pixel allocations.
      if (x > 0 && mask[at - 1] === 1 && labels[at - 1] === -1) {
        labels[at - 1] = scanIndex;
        stack[stackLength++] = at - 1;
      }
      if (x < width - 1 && mask[at + 1] === 1 && labels[at + 1] === -1) {
        labels[at + 1] = scanIndex;
        stack[stackLength++] = at + 1;
      }
      if (y > 0 && mask[at - width] === 1 && labels[at - width] === -1) {
        labels[at - width] = scanIndex;
        stack[stackLength++] = at - width;
      }
      if (y < height - 1 && mask[at + width] === 1 && labels[at + width] === -1) {
        labels[at + width] = scanIndex;
        stack[stackLength++] = at + width;
      }
    }
    setPixels += areaPx;
    let insertion = 0;
    while (
      insertion < retainedCount &&
      (retainedAreaPx[insertion]! > areaPx ||
        (retainedAreaPx[insertion] === areaPx && retainedSeedPixel[insertion]! < seed))
    ) {
      insertion += 1;
    }
    if (insertion < MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES) {
      const last = Math.min(retainedCount, MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES - 1);
      for (let slot = last; slot > insertion; slot -= 1) {
        retainedScanIndex[slot] = retainedScanIndex[slot - 1]!;
        retainedSeedPixel[slot] = retainedSeedPixel[slot - 1]!;
        retainedAreaPx[slot] = retainedAreaPx[slot - 1]!;
        retainedMinX[slot] = retainedMinX[slot - 1]!;
        retainedMinY[slot] = retainedMinY[slot - 1]!;
        retainedMaxX[slot] = retainedMaxX[slot - 1]!;
        retainedMaxY[slot] = retainedMaxY[slot - 1]!;
      }
      retainedScanIndex[insertion] = scanIndex;
      retainedSeedPixel[insertion] = seed;
      retainedAreaPx[insertion] = areaPx;
      retainedMinX[insertion] = minX;
      retainedMinY[insertion] = minY;
      retainedMaxX[insertion] = maxX;
      retainedMaxY[insertion] = maxY;
      if (retainedCount < MAXIMUM_PANEL_ART_STAGE_COMPONENT_SUMMARIES) retainedCount += 1;
    }
    if (areaPx > maximumAreaPx) {
      maximumAreaPx = areaPx;
      largestComponentCount = 1;
      legacySelectedScanIndex = scanIndex;
    } else if (areaPx === maximumAreaPx) {
      largestComponentCount += 1;
    }
  }
  const retained: PanelArtStageComponentSummary[] = [];
  for (let slot = 0; slot < retainedCount; slot += 1) {
    retained.push(
      Object.freeze({
        scanIndex: retainedScanIndex[slot]!,
        seedPixel: retainedSeedPixel[slot]!,
        areaPx: retainedAreaPx[slot]!,
        bounds: Object.freeze({
          minXPx: retainedMinX[slot]!,
          minYPx: retainedMinY[slot]!,
          maxXPx: retainedMaxX[slot]!,
          maxYPx: retainedMaxY[slot]!,
        }),
        touchesLeft: retainedMinX[slot] === 0,
        touchesRight: retainedMaxX[slot] === width - 1,
        touchesTop: retainedMinY[slot] === 0,
        touchesBottom: retainedMaxY[slot] === height - 1,
      }),
    );
  }
  const legacySelected =
    retained.find(({ scanIndex }) => scanIndex === legacySelectedScanIndex) ?? null;
  const selected = new Uint8Array(mask.length);
  if (legacySelected !== null) {
    for (let index = 0; index < labels.length; index += 1) {
      if (labels[index] === legacySelected.scanIndex) selected[index] = 1;
    }
  }
  const selectedWidth =
    legacySelected === null ? 0 : legacySelected.bounds.maxXPx - legacySelected.bounds.minXPx + 1;
  const selectedHeight =
    legacySelected === null ? 0 : legacySelected.bounds.maxYPx - legacySelected.bounds.minYPx + 1;
  const horizontalFrameSpanningThin =
    legacySelected !== null &&
    legacySelected.touchesLeft &&
    legacySelected.touchesRight &&
    selectedWidth >= Math.ceil(width * 0.9) &&
    selectedHeight <= Math.max(16, Math.ceil(height * 0.04));
  const verticalFrameSpanningThin =
    legacySelected !== null &&
    legacySelected.touchesTop &&
    legacySelected.touchesBottom &&
    selectedHeight >= Math.ceil(height * 0.9) &&
    selectedWidth <= Math.max(16, Math.ceil(width * 0.04));
  const selectionRefusal =
    legacySelected === null
      ? "no-component"
      : largestComponentCount > 1
        ? "equal-largest-components"
        : horizontalFrameSpanningThin || verticalFrameSpanningThin
          ? "frame-spanning-thin-component"
          : null;
  return {
    mask: selected,
    facts: Object.freeze({
      width,
      height,
      componentCount,
      setPixels,
      componentPartitionDigest: canonicalPartitionDigest(labels),
      maximumAreaPx,
      largestComponentCount,
      retainedTopComponents: Object.freeze(retained),
      legacySelected,
      unambiguousLargestSelection: selectionRefusal === null ? legacySelected : null,
      selectionRefusal,
    }),
  };
}

/** Hostile-safe recomputation from an intrinsic, non-shared, exact binary mask. */
export function analysePanelArtStageComponents(
  value: unknown,
  width: number,
  height: number,
): PanelArtStageComponentAnalysis {
  const pixels = width * height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    !Number.isSafeInteger(pixels) ||
    pixels > MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS
  ) {
    throw new RangeError(
      `Panel-art component dimensions ${String(width)}x${String(height)} exceed the bounded raster.`,
    );
  }
  let length: number;
  let buffer: ArrayBufferLike;
  try {
    if (TYPED_ARRAY_TAG?.call(value) !== "Uint8Array") throw null;
    length = TYPED_ARRAY_LENGTH?.call(value) as number;
    buffer = TYPED_ARRAY_BUFFER?.call(value) as ArrayBufferLike;
  } catch {
    throw new TypeError("Panel-art component mask must be one exact Uint8Array.");
  }
  if (length !== pixels) {
    throw new RangeError(
      `Panel-art component mask has ${length} bytes; expected exactly ${pixels}.`,
    );
  }
  if (SHARED_BYTE_LENGTH !== undefined) {
    try {
      SHARED_BYTE_LENGTH.call(buffer);
      throw new TypeError("Panel-art component mask cannot use SharedArrayBuffer storage.");
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("cannot use SharedArrayBuffer")) {
        throw error;
      }
    }
  }
  const mask = new Uint8Array(pixels);
  try {
    Uint8Array.prototype.set.call(mask, value as Uint8Array);
  } catch {
    throw new TypeError("Panel-art component mask could not be copied from live storage.");
  }
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] !== 0 && mask[pixel] !== 1) {
      throw new TypeError(`Panel-art component mask pixel ${pixel} must be exactly 0 or 1.`);
    }
  }
  return analyseTrustedPanelArtStageComponents(mask, width, height);
}
