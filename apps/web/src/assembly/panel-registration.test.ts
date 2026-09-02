import { describe, expect, it } from "vitest";

import {
  erodeMask,
  isolateAssembly,
  keyPanelArt,
  keyPrintedBoxes,
  PanelRegistrationError,
} from "./panel-art";
import { boundaryOffset, distanceToMask, measureDifferenceNoise } from "./panel-difference";
import { alignPanelMasks, warpMask, warpRaster } from "./panel-registration";

const PAGE = 0x8b9296;

function blankPanel(width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    pixels[pixel * 4] = (PAGE >> 16) & 0xff;
    pixels[pixel * 4 + 1] = (PAGE >> 8) & 0xff;
    pixels[pixel * 4 + 2] = PAGE & 0xff;
    pixels[pixel * 4 + 3] = 255;
  }
  return pixels;
}

function paintBox(
  pixels: Uint8ClampedArray,
  width: number,
  box: { x: number; y: number; w: number; h: number },
  hex: number,
): void {
  for (let y = box.y; y < box.y + box.h; y += 1) {
    for (let x = box.x; x < box.x + box.w; x += 1) {
      const at = (y * width + x) * 4;
      pixels[at] = (hex >> 16) & 0xff;
      pixels[at + 1] = (hex >> 8) & 0xff;
      pixels[at + 2] = hex & 0xff;
      pixels[at + 3] = 255;
    }
  }
}

function boxMask(
  width: number,
  height: number,
  boxes: readonly { x: number; y: number; w: number; h: number }[],
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const box of boxes) {
    for (let y = box.y; y < box.y + box.h; y += 1) {
      for (let x = box.x; x < box.x + box.w; x += 1) mask[y * width + x] = 1;
    }
  }
  return mask;
}

describe("keyPanelArt", () => {
  it("keeps everything that is not the page colour", () => {
    const pixels = blankPanel(20, 10);
    paintBox(pixels, 20, { x: 4, y: 3, w: 5, h: 4 }, 0x202020);
    const mask = keyPanelArt({ width: 20, height: 10, pixels }, { backgroundHex: PAGE });
    expect([...mask].reduce<number>((sum, value) => sum + value, 0)).toBe(20);
    expect(mask[3 * 20 + 4]).toBe(1);
    expect(mask[0]).toBe(0);
  });

  it("names the raster when the buffer does not match the dimensions", () => {
    expect(() =>
      keyPanelArt(
        { width: 20, height: 10, pixels: new Uint8ClampedArray(16) },
        { backgroundHex: PAGE },
      ),
    ).toThrow(/holds 16 bytes but 20x10 RGBA needs 800/);
  });
});

describe("erodeMask", () => {
  it("removes a rim of the radius and the frame edge with it", () => {
    const mask = boxMask(20, 20, [{ x: 5, y: 5, w: 8, h: 8 }]);
    const eroded = erodeMask(mask, 20, 20, 2);
    expect(eroded[7 * 20 + 7]).toBe(1);
    expect(eroded[5 * 20 + 5]).toBe(0);
    expect(eroded[6 * 20 + 6]).toBe(0);
  });

  it("severs a bridge thinner than twice the radius", () => {
    const mask = boxMask(40, 20, [
      { x: 2, y: 4, w: 10, h: 10 },
      { x: 12, y: 8, w: 14, h: 2 },
      { x: 26, y: 4, w: 10, h: 10 },
    ]);
    const eroded = erodeMask(mask, 40, 20, 2);
    for (let x = 12; x < 26; x += 1) expect(eroded[9 * 40 + x]).toBe(0);
    expect(eroded[8 * 40 + 6]).toBe(1);
    expect(eroded[8 * 40 + 30]).toBe(1);
  });
});

describe("isolateAssembly", () => {
  it("keeps the largest object and drops what an arrow tied to it", () => {
    // A big plate, a small ghost, and a one-pixel arrow between them: exactly
    // the shape of an exploded panel, which arrives keyed as a single blob.
    const width = 60;
    const height = 30;
    const mask = boxMask(width, height, [
      { x: 4, y: 6, w: 24, h: 18 },
      { x: 28, y: 14, w: 12, h: 2 },
      { x: 40, y: 10, w: 12, h: 10 },
    ]);
    const isolation = isolateAssembly({ width, height, mask }, { openingRadiusPx: 2 });
    expect(isolation.componentCount).toBe(2);
    expect(isolation.mask[12 * width + 12]).toBe(1);
    expect(isolation.mask[14 * width + 45]).toBe(0);
    expect(isolation.bounds?.maxXPx).toBeLessThan(35);
    expect(isolation.droppedFraction).toBeGreaterThan(0.2);
  });

  it("returns nothing, not everything, when the opening erases the art", () => {
    // No component survives the erosion, so there is no largest one. Testing
    // the label against a sentinel matched every pixel and handed back the
    // whole art as the assembly, reporting zero components and nothing dropped.
    const width = 40;
    const height = 20;
    const mask = boxMask(width, height, [
      { x: 4, y: 8, w: 12, h: 1 },
      { x: 20, y: 8, w: 12, h: 1 },
    ]);
    const isolation = isolateAssembly({ width, height, mask }, { openingRadiusPx: 2 });
    expect(isolation.componentCount).toBe(0);
    expect(isolation.areaPx).toBe(0);
    expect(isolation.erasedByOpening).toBe(true);
    expect(isolation.droppedFraction).toBe(1);
  });

  it("severs nothing by default, because opening printed art fragments it", () => {
    const width = 60;
    const height = 30;
    const mask = boxMask(width, height, [
      { x: 4, y: 6, w: 24, h: 18 },
      { x: 28, y: 14, w: 12, h: 2 },
      { x: 40, y: 10, w: 12, h: 10 },
    ]);
    const isolation = isolateAssembly({ width, height, mask });
    expect(isolation.componentCount).toBe(1);
    expect(isolation.droppedFraction).toBe(0);
    expect(isolation.mask[14 * width + 45]).toBe(1);
  });
});

/**
 * A sub-assembly box is joined to the model by its leader line, so the largest
 * connected non-background region is not the assembly.
 *
 * Step 14 of the sample booklet prints a white box holding a two-step
 * sub-assembly and joins it to the model with a printed leader line, so the box
 * and the model are one connected component — and a 400 by 170 rectangle of
 * white came through as assembly and read as a part that appeared between the
 * panels. Opening the mask to sever the line is worse than the problem: printed
 * art is line work, and a three-pixel erosion at a thousand-pixel panel width
 * fragmented step 4 into 125 components, the largest holding a sixth of the
 * drawing, which then fitted a camera at 21 pixels per stud against the
 * booklet's 40.
 *
 * The page is grey and the model is not white, so keying the white first takes
 * the callout box, the sub-assembly box, the step number and the progress bar
 * with their bounding boxes before components are counted. Panels fitting a
 * camera went 37 to 39 of 50 and median assembly agreement 66% to 74%. Raise the
 * white level past what the page prints and the case below goes red.
 */
describe("keyPrintedBoxes", () => {
  it("masks a white box and everything it contains, not just its fill", () => {
    const width = 120;
    const height = 90;
    const pixels = blankPanel(width, height);
    paintBox(pixels, width, { x: 10, y: 10, w: 40, h: 30 }, 0xffffff);
    // A thumbnail drawn inside the box: it has to go with the box, because it
    // is drawn under its own camera and is not this panel's model.
    paintBox(pixels, width, { x: 20, y: 18, w: 12, h: 10 }, 0x303030);
    const boxes = keyPrintedBoxes({ width, height, pixels });
    expect(boxes[25 * width + 25]).toBe(1);
    expect(boxes[12 * width + 12]).toBe(1);
    expect(boxes[80 * width + 100]).toBe(0);
  });

  it("leaves a speck of white alone", () => {
    const width = 120;
    const height = 90;
    const pixels = blankPanel(width, height);
    paintBox(pixels, width, { x: 10, y: 10, w: 4, h: 4 }, 0xffffff);
    const boxes = keyPrintedBoxes({ width, height, pixels });
    expect([...boxes].reduce<number>((sum, value) => sum + value, 0)).toBe(0);
  });
});

describe("warpMask and warpRaster", () => {
  it("carries a mask onto another raster at a scale and offset", () => {
    const source = boxMask(20, 20, [{ x: 4, y: 4, w: 4, h: 4 }]);
    const warped = warpMask(
      { width: 20, height: 20, mask: source },
      { width: 40, height: 40 },
      { scale: 2, offsetXPx: 3, offsetYPx: 5 },
    );
    expect(warped[(4 * 2 + 5) * 40 + (4 * 2 + 3)]).toBe(1);
    expect(warped[0]).toBe(0);
  });

  it("fills the page colour where the source does not reach", () => {
    const pixels = blankPanel(10, 10);
    paintBox(pixels, 10, { x: 2, y: 2, w: 4, h: 4 }, 0x101010);
    const warped = warpRaster(
      { width: 10, height: 10, pixels },
      { width: 30, height: 30 },
      { scale: 1, offsetXPx: 0, offsetYPx: 0 },
      PAGE,
    );
    expect(warped[(25 * 30 + 25) * 4]).toBe((PAGE >> 16) & 0xff);
    expect(warped[(3 * 30 + 3) * 4]).toBe(0x10);
  });

  it("refuses a transform that cannot be a panel scale", () => {
    expect(() =>
      warpMask(
        { width: 4, height: 4, mask: new Uint8Array(16) },
        { width: 4, height: 4 },
        { scale: 0, offsetXPx: 0, offsetYPx: 0 },
      ),
    ).toThrow(/scale must be a positive finite number, received 0/);
  });
});

describe("alignPanelMasks", () => {
  it("recovers a scale and a shift it was not told about", () => {
    const width = 160;
    const height = 120;
    // An L, so the alignment cannot be satisfied by a translation of a disc.
    const currentMask = boxMask(width, height, [
      { x: 30, y: 20, w: 60, h: 20 },
      { x: 30, y: 40, w: 20, h: 50 },
    ]);
    const scale = 1.12;
    const shiftX = 14;
    const shiftY = -9;
    const nextMask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceX = Math.round((x - shiftX) / scale);
        const sourceY = Math.round((y - shiftY) / scale);
        if (sourceX < 0 || sourceX >= width || sourceY < 0 || sourceY >= height) continue;
        if (currentMask[sourceY * width + sourceX] === 1) nextMask[y * width + x] = 1;
      }
    }
    // Deliberately started 5% off the truth, because handing in the answer as
    // the guess would pass against a search that ignored the scale entirely.
    const guess = (1 / scale) * 1.05;
    const alignment = alignPanelMasks(
      { width, height, mask: nextMask },
      { width, height, mask: currentMask },
      { scaleGuess: guess, scaleSpan: 0.1, scaleSteps: 21, coarseStridePx: 2, searchRadiusPx: 40 },
    );
    expect(alignment.iou).toBeGreaterThan(0.9);
    expect(alignment.iou).toBeGreaterThan(alignment.iouUnregistered);
    // It has to have moved most of the way back to the truth, and not have
    // stopped at the wall of its own range doing it.
    expect(alignment.transform.scale).toBeGreaterThan((1 / scale) * 0.98);
    expect(alignment.transform.scale).toBeLessThan((1 / scale) * 1.02);
    expect(alignment.scaleAtSearchBoundary).toBe(false);
  });

  it("holds the scale it was given when offered a single step", () => {
    const width = 120;
    const height = 90;
    const mask = boxMask(width, height, [{ x: 20, y: 20, w: 50, h: 40 }]);
    const alignment = alignPanelMasks(
      { width, height, mask },
      { width, height, mask },
      { scaleGuess: 1, scaleSpan: 0, scaleSteps: 1, coarseStridePx: 2, searchRadiusPx: 10 },
    );
    expect(alignment.transform.scale).toBe(1);
    expect(alignment.scaleAtSearchBoundary).toBe(false);
    expect(alignment.iou).toBeCloseTo(1, 5);
  });

  it("says when the winning scale sat on the wall of its own range", () => {
    const width = 120;
    const height = 90;
    const currentMask = boxMask(width, height, [{ x: 20, y: 20, w: 50, h: 40 }]);
    // A guess 40% out with a range of 5%: the truth is unreachable, so the
    // search can only stop at the edge, and it has to say so rather than return
    // the edge as a measurement.
    const alignment = alignPanelMasks(
      { width, height, mask: currentMask },
      { width, height, mask: currentMask },
      { scaleGuess: 1.4, scaleSpan: 0.05, scaleSteps: 11, coarseStridePx: 2, searchRadiusPx: 20 },
    );
    expect(alignment.scaleAtSearchBoundary).toBe(true);
  });

  it("refuses a search parameter that would silently search nothing", () => {
    const mask = boxMask(20, 20, [{ x: 4, y: 4, w: 8, h: 8 }]);
    expect(() =>
      alignPanelMasks(
        { width: 20, height: 20, mask },
        { width: 20, height: 20, mask },
        { scaleGuess: 1, coarseStridePx: 2.5 },
      ),
    ).toThrow(/coarseStridePx to be a whole number of at least 1, received 2.5/);
    expect(() =>
      alignPanelMasks(
        { width: 20, height: 20, mask },
        { width: 20, height: 20, mask },
        { scaleGuess: 1, searchRadiusPx: -4 },
      ),
    ).toThrow(/searchRadiusPx to be a whole number of at least 0, received -4/);
  });

  it("never reports an agreement above one, however far it shrinks the source", () => {
    // The first version counted a warped source pixel once per source pixel
    // rather than once per target pixel, so collapsing the source onto fewer
    // target pixels inflated the intersection and shrank the union. Every pair
    // then scored best at the smallest scale on offer and two of five came back
    // over 100% agreement.
    const width = 120;
    const height = 90;
    const currentMask = boxMask(width, height, [{ x: 20, y: 20, w: 50, h: 40 }]);
    const nextMask = boxMask(width, height, [{ x: 20, y: 20, w: 50, h: 40 }]);
    const alignment = alignPanelMasks(
      { width, height, mask: nextMask },
      { width, height, mask: currentMask },
      { scaleGuess: 0.6, scaleSpan: 0.8, scaleSteps: 17, coarseStridePx: 2, searchRadiusPx: 30 },
    );
    expect(alignment.iou).toBeLessThanOrEqual(1);
    expect(alignment.iouAtCentroids).toBeLessThanOrEqual(1);
    expect(alignment.iouUnregistered).toBeLessThanOrEqual(1);
    // And the search must climb back out to the true scale of one, which the
    // range has to be wide enough to contain or the assertion checks nothing.
    expect(alignment.transform.scale).toBeGreaterThan(0.95);
    expect(alignment.transform.scale).toBeLessThan(1.05);
  });

  it("says which panel keyed to nothing", () => {
    expect(() =>
      alignPanelMasks(
        { width: 8, height: 8, mask: new Uint8Array(64) },
        { width: 8, height: 8, mask: boxMask(8, 8, [{ x: 1, y: 1, w: 3, h: 3 }]) },
        { scaleGuess: 1 },
      ),
    ).toThrow(/step N panel has 9 set pixels and the step N\+1 panel has 0/);
  });
});

describe("measureDifferenceNoise", () => {
  it("reads the bulk difference over the pixels both panels drew", () => {
    const width = 20;
    const height = 20;
    const left = blankPanel(width, height);
    const right = blankPanel(width, height);
    paintBox(left, width, { x: 4, y: 4, w: 8, h: 8 }, 0x303030);
    paintBox(right, width, { x: 4, y: 4, w: 8, h: 8 }, 0x333333);
    const shared = boxMask(width, height, [{ x: 4, y: 4, w: 8, h: 8 }]);
    const noise = measureDifferenceNoise(
      { width, height, pixels: left },
      { width, height, pixels: right },
      shared,
    );
    expect(noise.sharedPx).toBe(64);
    expect(noise.medianDistance).toBe(9);
    expect(noise.p99Distance).toBe(9);
  });

  it("refuses a shared mask that is not the panels' raster", () => {
    // A mask of the wrong length walked off the end of the difference and the
    // quantiles came back at 765, the top of the range, instead of failing.
    expect(() =>
      measureDifferenceNoise(
        { width: 8, height: 8, pixels: blankPanel(8, 8) },
        { width: 8, height: 8, pixels: blankPanel(8, 8) },
        new Uint8Array(128),
      ),
    ).toThrow(/shared mask holds 128 bytes but 8x8 needs 64/);
  });

  it("refuses two rasters that are not the same frame", () => {
    expect(() =>
      measureDifferenceNoise(
        { width: 4, height: 4, pixels: blankPanel(4, 4) },
        { width: 5, height: 4, pixels: blankPanel(5, 4) },
        new Uint8Array(16),
      ),
    ).toThrow(/step N is 4x4 and the warped step N\+1 is 5x4/);
  });
});

describe("boundaryOffset", () => {
  it("reads how far one outline sits from another", () => {
    const width = 80;
    const height = 60;
    // Outlines, not fills: this measures edge against edge, and two solid
    // squares three pixels apart mostly overlap.
    const outline = (x0: number) =>
      boxMask(width, height, [
        { x: x0, y: 20, w: 20, h: 1 },
        { x: x0, y: 39, w: 20, h: 1 },
        { x: x0, y: 20, w: 1, h: 20 },
        { x: x0 + 19, y: 20, w: 1, h: 20 },
      ]);
    const offset = boundaryOffset(outline(20), outline(23), width, height);
    expect(offset.matchedFraction).toBe(1);
    // Three pixels along one axis and none along the other, so the median of
    // the whole outline sits between the two rather than at either.
    expect(offset.medianPx).toBeGreaterThanOrEqual(1);
    expect(offset.p90Px).toBeGreaterThanOrEqual(2);
    expect(offset.p90Px).toBeLessThanOrEqual(4);
  });

  it("reports the share that found nothing at all in range", () => {
    const width = 80;
    const height = 60;
    const left = boxMask(width, height, [{ x: 5, y: 5, w: 10, h: 10 }]);
    const right = boxMask(width, height, [{ x: 60, y: 45, w: 10, h: 10 }]);
    const offset = boundaryOffset(left, right, width, height, 6);
    expect(offset.matchedFraction).toBe(0);
    // Null, not the radius. Reporting the overflow bucket's index would make
    // "no counterpart within six pixels" indistinguishable from "seven pixels
    // away", and the second is a measurement while the first is a failure.
    expect(offset.medianPx).toBeNull();
    expect(offset.p90Px).toBeNull();
    expect(offset.searchRadiusPx).toBe(6);
  });

  it("refuses masks that are not the raster it was told", () => {
    expect(() => boundaryOffset(new Uint8Array(40), new Uint8Array(1200), 40, 30)).toThrow(
      /boundary source mask holds 40 bytes but 40x30 needs 1200/,
    );
    expect(() => boundaryOffset(new Uint8Array(1200), new Uint8Array(1200), 40, 30, 0)).toThrow(
      /whole search radius of at least one pixel, received 0/,
    );
  });
});

describe("distanceToMask", () => {
  it("gives the distance to the nearest set pixel, and infinity when there is none", () => {
    const width = 40;
    const height = 30;
    const target = boxMask(width, height, [{ x: 10, y: 10, w: 2, h: 2 }]);
    const field = distanceToMask(target, width, height);
    expect(field[10 * width + 10]).toBe(0);
    expect(field[10 * width + 13]).toBeCloseTo(2, 1);
    // The box spans rows 10 and 11, so the nearest set pixel from row 20 is 9 away.
    expect(field[20 * width + 10]).toBeCloseTo(9, 0);
    expect(distanceToMask(new Uint8Array(width * height), width, height)[0]).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("PanelRegistrationError", () => {
  it("is named so a caller can tell it from a renderer failure", () => {
    expect(new PanelRegistrationError("x").name).toBe("PanelRegistrationError");
  });
});
