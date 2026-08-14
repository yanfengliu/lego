import type { BrowserCrop, CalloutTarget, PixelBounds } from "./callout-types";
import {
  assertBoundedCalloutCropRaster,
  boundedCalloutPngDataUrl,
} from "./callout-browser-resource-bounds";

export interface SemanticCropInput {
  readonly target: CalloutTarget;
  readonly box: PixelBounds;
  readonly background: readonly [number, number, number];
  readonly quantityMask: PixelBounds;
  readonly scale: number;
  readonly canvas: HTMLCanvasElement;
  readonly pixels: Uint8ClampedArray;
  readonly textPixels: Uint8Array;
}

export async function renderSemanticCrop(input: SemanticCropInput): Promise<BrowserCrop | null> {
  const { target, box, background, quantityMask, scale, canvas, pixels, textPixels } = input;
  const inside = (bounds: PixelBounds, x: number, y: number): boolean =>
    x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  const clamp = (bounds: PixelBounds): PixelBounds => ({
    left: Math.max(0, Math.min(canvas.width - 1, bounds.left)),
    top: Math.max(0, Math.min(canvas.height - 1, bounds.top)),
    right: Math.max(0, Math.min(canvas.width - 1, bounds.right)),
    bottom: Math.max(0, Math.min(canvas.height - 1, bounds.bottom)),
  });
  const inset = Math.round(2 * scale);
  const actionPadding = Math.round(16 * scale);
  const region =
    target.regionKind === "panel-neighbor-action"
      ? {
          left: box.left + Math.max(inset, Math.round((box.right - box.left) * 0.08)),
          right: box.right - inset,
          top: box.top - actionPadding,
          bottom: Math.min(box.bottom - inset, quantityMask.bottom + actionPadding),
        }
      : {
          left: box.left + inset,
          right: box.right - inset,
          top: box.top + inset,
          bottom: box.bottom - inset,
        };
  const cropRectPx = clamp(region);
  const width = cropRectPx.right - cropRectPx.left + 1;
  const height = cropRectPx.bottom - cropRectPx.top + 1;
  if (width < 16 || height < 16) return null;
  assertBoundedCalloutCropRaster(width, height, `${target.identity} semantic callout crop`);
  const cell = document.createElement("canvas");
  cell.width = width;
  cell.height = height;
  const context = cell.getContext("2d")!;
  context.drawImage(canvas, cropRectPx.left, cropRectPx.top, width, height, 0, 0, width, height);
  let sourceTextGlyphPixels = 0;
  let sourceQuantityGlyphPixels = 0;
  let foregroundPixels = 0;
  let textGlyphOverlapPixels = 0;
  let foregroundLeft = width;
  let foregroundTop = height;
  let foregroundRight = -1;
  let foregroundBottom = -1;
  for (let y = cropRectPx.top; y <= cropRectPx.bottom; y += 1) {
    for (let x = cropRectPx.left; x <= cropRectPx.right; x += 1) {
      const at = y * canvas.width + x;
      const from = at * 4;
      const differs =
        Math.abs(pixels[from]! - background[0]) +
          Math.abs(pixels[from + 1]! - background[1]) +
          Math.abs(pixels[from + 2]! - background[2]) >
        30;
      if (!differs) continue;
      const text = textPixels[at] === 1;
      const quantity = inside(quantityMask, x, y);
      if (text) sourceTextGlyphPixels += 1;
      if (text && quantity) sourceQuantityGlyphPixels += 1;
      if (!quantity) {
        foregroundPixels += 1;
        if (text) textGlyphOverlapPixels += 1;
        const relativeX = x - cropRectPx.left;
        const relativeY = y - cropRectPx.top;
        foregroundLeft = Math.min(foregroundLeft, relativeX);
        foregroundTop = Math.min(foregroundTop, relativeY);
        foregroundRight = Math.max(foregroundRight, relativeX);
        foregroundBottom = Math.max(foregroundBottom, relativeY);
      }
    }
  }
  const maskLeft = Math.max(0, quantityMask.left - cropRectPx.left);
  const maskTop = Math.max(0, quantityMask.top - cropRectPx.top);
  const maskRight = Math.min(width, quantityMask.right - cropRectPx.left + 1);
  const maskBottom = Math.min(height, quantityMask.bottom - cropRectPx.top + 1);
  if (maskRight > maskLeft && maskBottom > maskTop) {
    context.fillStyle = `rgb(${background[0]}, ${background[1]}, ${background[2]})`;
    context.fillRect(maskLeft, maskTop, maskRight - maskLeft, maskBottom - maskTop);
  }
  const contamination: string[] = [];
  if (sourceQuantityGlyphPixels === 0) contamination.push("quantity-mask-empty");
  if (foregroundPixels === 0) contamination.push("action-region-empty");
  const url = await boundedCalloutPngDataUrl(cell, `${target.identity} semantic callout crop`);
  return {
    url,
    widthPx: width,
    heightPx: height,
    strategy: "semantic-action-region",
    evidenceKind: target.evidenceKind,
    regionKind: target.regionKind,
    masksApplied: ["quantity-label"],
    contamination,
    foregroundPixels,
    sourceTextGlyphPixels,
    sourceQuantityGlyphPixels,
    textGlyphOverlapPixels,
    quantityGlyphOverlapPixels: 0,
    quantityGlyphPixelsMasked: sourceQuantityGlyphPixels,
    cropRectPx,
    boundaryClearancePx:
      foregroundPixels === 0
        ? { left: 0, top: 0, right: 0, bottom: 0 }
        : {
            left: foregroundLeft,
            top: foregroundTop,
            right: width - 1 - foregroundRight,
            bottom: height - 1 - foregroundBottom,
          },
    sourceComponent: null,
  };
}
