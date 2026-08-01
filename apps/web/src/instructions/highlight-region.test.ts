import { describe, expect, it } from "vitest";

import {
  extractHighlightRegions,
  isHighlightPixel,
  type HighlightRegionBounds,
} from "./highlight-region";

const PAGE_GREY = [0x89, 0x90, 0x93] as const;
const HIGHLIGHT_YELLOW = [0xff, 0xcc, 0x00] as const;

function page(width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = PAGE_GREY[0];
    pixels[index * 4 + 1] = PAGE_GREY[1];
    pixels[index * 4 + 2] = PAGE_GREY[2];
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

function paint(pixels: Uint8ClampedArray, width: number, x: number, y: number): void {
  const offset = (y * width + x) * 4;
  pixels[offset] = HIGHLIGHT_YELLOW[0];
  pixels[offset + 1] = HIGHLIGHT_YELLOW[1];
  pixels[offset + 2] = HIGHLIGHT_YELLOW[2];
}

/** A hollow rectangle of highlight stroke, optionally with one pixel missing. */
function strokeRectangle(
  pixels: Uint8ClampedArray,
  width: number,
  box: HighlightRegionBounds,
  gapAt: number | null = null,
): void {
  for (let x = box.minXPx; x <= box.maxXPx; x += 1) {
    if (x !== gapAt) paint(pixels, width, x, box.minYPx);
    paint(pixels, width, x, box.maxYPx);
  }
  for (let y = box.minYPx; y <= box.maxYPx; y += 1) {
    paint(pixels, width, box.minXPx, y);
    paint(pixels, width, box.maxXPx, y);
  }
}

describe("extracting a step's highlight region", () => {
  it("keys the printed yellow and nothing else on the page", () => {
    expect(isHighlightPixel(0xff, 0xcc, 0x00)).toBe(true);
    expect(isHighlightPixel(0xee, 0xcc, 0x11)).toBe(true);
    // Page grey, black line art, white plastic and red plastic all stay out.
    expect(isHighlightPixel(0x89, 0x90, 0x93)).toBe(false);
    expect(isHighlightPixel(0x1a, 0x1a, 0x1a)).toBe(false);
    expect(isHighlightPixel(0xff, 0xff, 0xff)).toBe(false);
    expect(isHighlightPixel(0xc9, 0x1a, 0x09)).toBe(false);
  });

  it("fills what a closed outline encloses, stroke included", () => {
    const pixels = page(60, 40);
    strokeRectangle(pixels, 60, { minXPx: 10, minYPx: 8, maxXPx: 39, maxYPx: 29 });

    const extraction = extractHighlightRegions(pixels, 60, 40, {
      minimumOutlinePx: 10,
      closeRadiusPx: 0,
    });

    expect(extraction.regions).toHaveLength(1);
    const region = extraction.regions[0]!;
    expect(region.leaked).toBe(false);
    expect(region.bounds).toEqual({ minXPx: 10, minYPx: 8, maxXPx: 39, maxYPx: 29 });
    // 30 x 22 rectangle: every pixel of it is stroke or enclosed.
    expect(region.areaPx).toBe(30 * 22);
    expect(region.enclosedPx).toBe(28 * 20);
    expect(extraction.mask[20 * 60 + 25]).toBe(1);
    expect(extraction.mask[2 * 60 + 2]).toBe(0);
  });

  it("reports a gapped outline as leaked instead of silently enclosing nothing", () => {
    const pixels = page(60, 40);
    strokeRectangle(pixels, 60, { minXPx: 10, minYPx: 8, maxXPx: 39, maxYPx: 29 }, 25);

    const extraction = extractHighlightRegions(pixels, 60, 40, {
      minimumOutlinePx: 10,
      closeRadiusPx: 0,
    });

    expect(extraction.leakedRegions).toBe(1);
    expect(extraction.regions[0]!.enclosedPx).toBe(0);
    expect(extraction.regions[0]!.leaked).toBe(true);
    // Nothing inside was claimed, so a score against this cannot quietly pass.
    expect(extraction.mask[20 * 60 + 25]).toBe(0);
  });

  it("keeps several highlights on one page apart", () => {
    const pixels = page(120, 40);
    strokeRectangle(pixels, 120, { minXPx: 5, minYPx: 5, maxXPx: 30, maxYPx: 30 });
    strokeRectangle(pixels, 120, { minXPx: 60, minYPx: 8, maxXPx: 100, maxYPx: 25 });

    const extraction = extractHighlightRegions(pixels, 120, 40, {
      minimumOutlinePx: 10,
      closeRadiusPx: 0,
    });

    expect(extraction.regions).toHaveLength(2);
    // Largest first, so the dominant region of a step is regions[0].
    expect(extraction.regions[0]!.areaPx).toBe(41 * 18);
    expect(extraction.regions[1]!.areaPx).toBe(26 * 26);
    expect(extraction.leakedRegions).toBe(0);
  });

  it("discards specks too small to be a step outline, and says how many", () => {
    const pixels = page(60, 40);
    strokeRectangle(pixels, 60, { minXPx: 10, minYPx: 8, maxXPx: 39, maxYPx: 29 });
    paint(pixels, 60, 50, 35);
    paint(pixels, 60, 51, 35);

    const extraction = extractHighlightRegions(pixels, 60, 40, {
      minimumOutlinePx: 10,
      closeRadiusPx: 0,
    });

    expect(extraction.regions).toHaveLength(1);
    expect(extraction.discardedComponents).toBe(1);
    expect(extraction.keyedPx).toBe(extraction.regions[0]!.outlinePx + 2);
  });

  it("finds nothing on a page with no highlight, rather than inventing a region", () => {
    const extraction = extractHighlightRegions(page(40, 40), 40, 40);

    expect(extraction.regions).toEqual([]);
    expect(extraction.keyedPx).toBe(0);
    expect(extraction.mask.every((value) => value === 0)).toBe(true);
  });

  it("reports how many contours closed, which is the share a fill can serve", () => {
    const pixels = page(120, 40);
    strokeRectangle(pixels, 120, { minXPx: 5, minYPx: 5, maxXPx: 30, maxYPx: 30 });
    strokeRectangle(pixels, 120, { minXPx: 60, minYPx: 8, maxXPx: 100, maxYPx: 25 }, 80);

    const extraction = extractHighlightRegions(pixels, 120, 40, {
      minimumOutlinePx: 10,
      closeRadiusPx: 0,
    });

    expect(extraction.regions).toHaveLength(2);
    expect(extraction.closedContourRate).toBe(0.5);
  });

  it("names the raster it was handed when it does not match", () => {
    expect(() => extractHighlightRegions(page(10, 10), 20, 10)).toThrowError(
      /holds 400 bytes but 20x10 RGBA needs 800/,
    );
    expect(() => extractHighlightRegions(page(10, 10), 0, 10)).toThrowError(
      /width must be a positive integer, received 0/,
    );
  });
});
