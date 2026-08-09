import { describe, expect, it } from "vitest";

import { extractHighlightRegions } from "../instructions/highlight-region";
import { rankStepDelta, scoreStepDelta } from "./step-score";

const WIDTH = 80;
const HEIGHT = 60;
const PAGE_GREY = [0x89, 0x90, 0x93] as const;
const HIGHLIGHT_YELLOW = [0xff, 0xcc, 0x00] as const;

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function blankPage(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    pixels[index * 4] = PAGE_GREY[0];
    pixels[index * 4 + 1] = PAGE_GREY[1];
    pixels[index * 4 + 2] = PAGE_GREY[2];
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

function ink(pixels: Uint8ClampedArray, x: number, y: number): void {
  const offset = (y * WIDTH + x) * 4;
  pixels[offset] = HIGHLIGHT_YELLOW[0];
  pixels[offset + 1] = HIGHLIGHT_YELLOW[1];
  pixels[offset + 2] = HIGHLIGHT_YELLOW[2];
}

/** A printed highlight: closed by default, or open along its left side. */
function printedHighlight(box: Box, { open = false } = {}): Uint8ClampedArray {
  const pixels = blankPage();
  for (let x = box.minX; x <= box.maxX; x += 1) {
    ink(pixels, x, box.minY);
    ink(pixels, x, box.maxY);
  }
  for (let y = box.minY; y <= box.maxY; y += 1) {
    if (!open) ink(pixels, box.minX, y);
    ink(pixels, box.maxX, y);
  }
  return pixels;
}

function filledMask(box: Box): Uint8Array {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) mask[y * WIDTH + x] = 1;
  }
  return mask;
}

const TRUTH: Box = { minX: 20, minY: 15, maxX: 55, maxY: 40 };

function highlightOf(box: Box, options?: { open?: boolean }) {
  return extractHighlightRegions(printedHighlight(box, options), WIDTH, HEIGHT, {
    minimumOutlinePx: 10,
    closeRadiusPx: 0,
  });
}

describe("scoring a candidate against a step's highlight", () => {
  it("scores the placement the booklet drew at the top", () => {
    const highlight = highlightOf(TRUTH);

    const right = scoreStepDelta(filledMask(TRUTH), highlight);
    const shifted = scoreStepDelta(
      filledMask({ minX: 26, minY: 15, maxX: 61, maxY: 40 }),
      highlight,
    );
    const wrongSize = scoreStepDelta(
      filledMask({ minX: 20, minY: 15, maxX: 35, maxY: 40 }),
      highlight,
    );

    expect(right.basis).toBe("region");
    expect(right.regionIou).toBeGreaterThan(0.99);
    expect(right.score).toBeGreaterThan(shifted.score);
    expect(right.score).toBeGreaterThan(wrongSize.score);
  });

  it("still ranks placements when the contour never closed", () => {
    const highlight = highlightOf(TRUTH, { open: true });

    const right = scoreStepDelta(filledMask(TRUTH), highlight);
    const shifted = scoreStepDelta(
      filledMask({ minX: 30, minY: 15, maxX: 65, maxY: 40 }),
      highlight,
    );

    // No region exists, so regionIou is unavailable rather than zero — an
    // absent measurement must not read as a candidate that disagreed.
    expect(right.regionIou).toBeNull();
    expect(right.basis).toBe("stroke");
    expect(right.score).toBe(right.strokeF1);
    expect(right.score).toBeGreaterThan(shifted.score);
    expect(right.strokeRecall).toBeGreaterThan(0.9);
  });

  // An occluded piece is the reason a contour opens, and it is drawn with part
  // of its boundary deliberately unprinted. Charging a candidate for that
  // unprinted boundary — which is what `boundaryPrecision`, and therefore the
  // blended `score`, does — measures the drawing's occlusion. `rankStepDelta`
  // drops it on exactly the panels where it means something else.
  it("ranks an open contour on the printed line alone, not on the line it was never given", () => {
    const highlight = highlightOf(TRUTH, { open: true });
    // The drawn placement, and a candidate whose extra length runs off where the
    // booklet printed no yellow at all — the shape of an occluded seat.
    const right = scoreStepDelta(filledMask(TRUTH), highlight);
    const overlong = scoreStepDelta(
      filledMask({ minX: 20, minY: 15, maxX: 70, maxY: 40 }),
      highlight,
    );

    expect(right.basis).toBe("stroke");
    expect(rankStepDelta(right)).toBe(right.strokeRecall);
    // The two keys are genuinely different numbers here, so this is a choice
    // rather than a rename: the drawn placement explains all of the printed
    // line and is still marked down by the blend for the boundary the booklet
    // never drew.
    expect(right.strokeRecall).toBe(1);
    expect(right.boundaryPrecision).toBeLessThan(1);
    expect(rankStepDelta(right)).not.toBe(right.score);
    // And a candidate cannot buy the ranking key by spilling, which is the exact
    // property containment was chosen for on the exploded road: boundary drawn
    // where nothing was printed explains nothing, and the boundary it swallows
    // stops explaining what it used to.
    expect(rankStepDelta(overlong)).toBeLessThan(rankStepDelta(right));
    // A closed contour is unaffected: the region is available and it ranks.
    const closed = highlightOf(TRUTH);
    const drawn = scoreStepDelta(filledMask(TRUTH), closed);
    expect(drawn.basis).toBe("region");
    expect(rankStepDelta(drawn)).toBe(drawn.score);
  });

  it("will not let a candidate buy recall by covering the whole panel", () => {
    const highlight = highlightOf(TRUTH);
    const everything: Box = { minX: 0, minY: 0, maxX: WIDTH - 1, maxY: HEIGHT - 1 };

    const right = scoreStepDelta(filledMask(TRUTH), highlight);
    const greedy = scoreStepDelta(filledMask(everything), highlight);

    // A mask covering everything has its boundary at the frame edge, so it
    // prints almost none of what the booklet did.
    expect(greedy.boundaryPrecision).toBeLessThan(0.1);
    expect(greedy.score).toBeLessThan(right.score);
  });

  it("scores a placement nothing can see at zero rather than at a guess", () => {
    const highlight = highlightOf(TRUTH);

    const hidden = scoreStepDelta(new Uint8Array(WIDTH * HEIGHT), highlight);

    expect(hidden.candidateAreaPx).toBe(0);
    expect(hidden.candidateBoundaryPx).toBe(0);
    expect(hidden.strokeF1).toBe(0);
    expect(hidden.regionIou).toBe(0);
  });

  it("holds a tolerance that admits a pixel of drift but not a stud of it", () => {
    const highlight = highlightOf(TRUTH);
    const offByOne: Box = { minX: 21, minY: 16, maxX: 56, maxY: 41 };

    const tight = scoreStepDelta(filledMask(offByOne), highlight, { tolerancePx: 0 });
    const tolerant = scoreStepDelta(filledMask(offByOne), highlight, { tolerancePx: 2 });

    expect(tolerant.strokeF1).toBeGreaterThan(tight.strokeF1);
    expect(tolerant.strokeF1).toBeGreaterThan(0.9);
  });

  it("says what mismatched instead of scoring an incomparable raster", () => {
    const highlight = highlightOf(TRUTH);

    expect(() => scoreStepDelta(new Uint8Array(10), highlight)).toThrowError(
      /holds 10 pixels but the highlight was extracted at 80x60, needing 4800/,
    );
    expect(() =>
      scoreStepDelta(new Uint8Array(WIDTH * HEIGHT), highlight, { tolerancePx: -1 }),
    ).toThrowError(/tolerancePx must be a non-negative integer, received -1/);
  });
});
