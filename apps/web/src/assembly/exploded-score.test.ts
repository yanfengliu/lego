import { describe, expect, it } from "vitest";

import { extractHighlightRegions } from "../instructions/highlight-region";
import { ExplodedScoreError, panelDelta, scoreExplodedStep, type PanelArt } from "./exploded-score";

const WIDTH = 80;
const HEIGHT = 60;
const PAGE_GREY = 0x899093;
const BRICK = [0xa0, 0xa4, 0xa8] as const;
const OTHER_BRICK = [0x60, 0x64, 0x68] as const;
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
    pixels[index * 4] = (PAGE_GREY >> 16) & 0xff;
    pixels[index * 4 + 1] = (PAGE_GREY >> 8) & 0xff;
    pixels[index * 4 + 2] = PAGE_GREY & 0xff;
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

function fill(pixels: Uint8ClampedArray, box: Box, colour: readonly number[]): void {
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      pixels[offset] = colour[0]!;
      pixels[offset + 1] = colour[1]!;
      pixels[offset + 2] = colour[2]!;
    }
  }
}

function outline(pixels: Uint8ClampedArray, box: Box): void {
  for (let x = box.minX; x <= box.maxX; x += 1) {
    fill(pixels, { minX: x, maxX: x, minY: box.minY, maxY: box.minY }, HIGHLIGHT_YELLOW);
    fill(pixels, { minX: x, maxX: x, minY: box.maxY, maxY: box.maxY }, HIGHLIGHT_YELLOW);
  }
  for (let y = box.minY; y <= box.maxY; y += 1) {
    fill(pixels, { minX: box.minX, maxX: box.minX, minY: y, maxY: y }, HIGHLIGHT_YELLOW);
    fill(pixels, { minX: box.maxX, maxX: box.maxX, minY: y, maxY: y }, HIGHLIGHT_YELLOW);
  }
}

function maskOf(box: Box): Uint8Array {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) mask[y * WIDTH + x] = 1;
  }
  return mask;
}

function panelOf(pixels: Uint8ClampedArray, withHighlight: boolean): PanelArt {
  return {
    width: WIDTH,
    height: HEIGHT,
    pixels,
    highlight: withHighlight
      ? extractHighlightRegions(pixels, WIDTH, HEIGHT, { minimumOutlinePx: 8 })
      : null,
  };
}

const BUILT: Box = { minX: 10, minY: 30, maxX: 60, maxY: 50 };
const LANDS: Box = { minX: 20, minY: 12, maxX: 40, maxY: 28 };
const GHOST: Box = { minX: 20, minY: 1, maxX: 40, maxY: 9 };
const WRONG: Box = { minX: 44, minY: 12, maxX: 58, maxY: 28 };

/** Step N drawn exploded: the built assembly, plus a ghost of the new part. */
function explodedPanel(): Uint8ClampedArray {
  const pixels = blankPage();
  fill(pixels, BUILT, BRICK);
  fill(pixels, GHOST, BRICK);
  outline(pixels, GHOST);
  return pixels;
}

/** Step N+1: the same assembly with step N's part where it belongs. */
function nextPanel(): Uint8ClampedArray {
  const pixels = blankPage();
  fill(pixels, BUILT, BRICK);
  fill(pixels, LANDS, BRICK);
  return pixels;
}

describe("panelDelta", () => {
  it("reads a part's landing site out of two consecutive panels", () => {
    const delta = panelDelta(panelOf(explodedPanel(), true), panelOf(nextPanel(), false), {
      backgroundHex: PAGE_GREY,
    });

    expect(delta.emergedPx).toBe((LANDS.maxX - LANDS.minX + 1) * (LANDS.maxY - LANDS.minY + 1));
    expect(delta.emergedBounds).toEqual({
      minXPx: LANDS.minX,
      minYPx: LANDS.minY,
      maxXPx: LANDS.maxX,
      maxYPx: LANDS.maxY,
    });
  });

  it("drops the ghost, so a part is never placed where its own outline was", () => {
    const delta = panelDelta(panelOf(explodedPanel(), true), panelOf(nextPanel(), false), {
      backgroundHex: PAGE_GREY,
    });

    for (let y = GHOST.minY; y <= GHOST.maxY; y += 1) {
      for (let x = GHOST.minX; x <= GHOST.maxX; x += 1) {
        expect(delta.changedMask[y * WIDTH + x]).toBe(0);
      }
    }
    expect(delta.changedBounds?.minYPx).toBeGreaterThanOrEqual(LANDS.minY);
  });

  it("reports nothing emerged when the part lands inside what was drawn", () => {
    const inside: Box = { minX: 20, minY: 34, maxX: 34, maxY: 46 };
    const before = blankPage();
    fill(before, BUILT, BRICK);
    const after = blankPage();
    fill(after, BUILT, BRICK);
    fill(after, inside, OTHER_BRICK);

    const delta = panelDelta(panelOf(before, false), panelOf(after, false), {
      backgroundHex: PAGE_GREY,
    });

    expect(delta.emergedPx).toBe(0);
    expect(delta.emergedBounds).toBeNull();
    // The difference reading still sees it, because a brick in front of another
    // does not shade like the one behind it.
    expect(delta.changedPx).toBe((inside.maxX - inside.minX + 1) * (inside.maxY - inside.minY + 1));
  });

  it("refuses two panels that were not rendered at one raster", () => {
    const current = panelOf(explodedPanel(), false);
    const mismatched = { ...current, width: WIDTH - 1 };
    expect(() => panelDelta(current, mismatched, { backgroundHex: PAGE_GREY })).toThrow(
      /Panels must share a raster.*80x60.*79x60/s,
    );
  });
});

describe("scoreExplodedStep", () => {
  const delta = panelDelta(panelOf(explodedPanel(), true), panelOf(nextPanel(), false), {
    backgroundHex: PAGE_GREY,
  });

  it("ranks the placement that explains the difference above one that does not", () => {
    const right = scoreExplodedStep(
      { newlyVisibleMask: maskOf(LANDS), changedMask: maskOf(LANDS) },
      delta,
    );
    const wrong = scoreExplodedStep(
      { newlyVisibleMask: maskOf(WRONG), changedMask: maskOf(WRONG) },
      delta,
    );

    expect(right.score).toBe(1);
    expect(right.basis).toBe("emergence-and-change");
    expect(wrong.score).toBe(0);
  });

  it("does not let a placement hiding inside the region buy a perfect score", () => {
    const half: Box = { ...LANDS, maxX: LANDS.minX + 4 };
    const hiding = scoreExplodedStep(
      { newlyVisibleMask: maskOf(half), changedMask: maskOf(half) },
      delta,
    );

    // Every pixel it covers emerged, and it still loses: the region it fails to
    // explain counts against it, which is what a coverage score cannot do.
    expect(hiding.score).toBeLessThan(0.4);
  });

  it("calls emergence unavailable rather than zero when nothing emerged", () => {
    const before = blankPage();
    fill(before, BUILT, BRICK);
    const after = blankPage();
    fill(after, BUILT, BRICK);
    fill(after, { minX: 20, minY: 34, maxX: 34, maxY: 46 }, OTHER_BRICK);
    const hidden = panelDelta(panelOf(before, false), panelOf(after, false), {
      backgroundHex: PAGE_GREY,
    });

    const scored = scoreExplodedStep(
      {
        newlyVisibleMask: new Uint8Array(WIDTH * HEIGHT),
        changedMask: maskOf({ minX: 20, minY: 34, maxX: 34, maxY: 46 }),
      },
      hidden,
    );

    expect(scored.emergenceIou).toBeNull();
    expect(scored.basis).toBe("change");
    expect(scored.score).toBe(1);
  });

  it("names the raster a prediction should have been rendered at", () => {
    expect(() =>
      scoreExplodedStep(
        { newlyVisibleMask: new Uint8Array(4), changedMask: new Uint8Array(WIDTH * HEIGHT) },
        delta,
      ),
    ).toThrow(ExplodedScoreError);
    expect(() =>
      scoreExplodedStep(
        { newlyVisibleMask: new Uint8Array(4), changedMask: new Uint8Array(WIDTH * HEIGHT) },
        delta,
      ),
    ).toThrow(/newlyVisibleMask holds 4 pixels but the panel delta was computed at 80x60/);
  });
});
