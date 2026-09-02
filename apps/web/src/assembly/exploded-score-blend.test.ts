/**
 * A step's highlight is not always where the part ends up: this booklet draws
 * early steps exploded, so the outline has the right shape and orientation and the
 * wrong position, and a scorer that reads it as a position rejects the correct
 * placement. What replaces it is the next panel — and it takes two readings of
 * that panel, not one.
 *
 * Measured over five exploded steps of 6651557, ranking the true placement first:
 * the highlight score 0 of 5, the emerged region alone 4 of 5, everything the two
 * panels disagree on alone 3 of 5, the two blended 5 of 5. Neither reading is the
 * answer; each covers a case the other misses. Emergence cannot see a part that
 * lands wholly inside what is already drawn (a 2x2 brick in the middle of a 6x6
 * plate emerges nowhere), and the difference reading is bought cheaply by anything
 * that repaints a large area.
 *
 * Every other case in `exploded-score.test.ts` hands the scorer a candidate whose
 * emerged mask and changed mask are the same rectangle, so both readings return the
 * same number and any weight between them scores identically — the blend could be
 * set to either reading alone and nothing went red. The two steps below are
 * constructed so the readings disagree, and the true placement wins on the blend
 * while losing to an impostor under either reading on its own. That pins the weight
 * to the open interval (0.4545, 0.5455): 0 and 1 are red, and so is any move of
 * more than about 0.045 off the measured half.
 */

import { describe, expect, it } from "vitest";

import { panelDelta, scoreExplodedStep, type PanelArt } from "./exploded-score";

const WIDTH = 80;
const HEIGHT = 60;
const PAGE_GREY = 0x899093;
const BRICK = [0xa0, 0xa4, 0xa8] as const;
const OTHER_BRICK = [0x60, 0x64, 0x68] as const;

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The assembly already drawn in both panels. */
const BUILT: Box = { minX: 10, minY: 30, maxX: 60, maxY: 50 };
/** 200 px the next panel paints over bare page: emerged, and therefore changed. */
const EMERGED: Box = { minX: 20, minY: 10, maxX: 39, maxY: 19 };
/** 200 px the next panel repaints over the assembly: changed, and never emerged. */
const REPAINTED: Box = { minX: 20, minY: 32, maxX: 39, maxY: 41 };

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

function panelOf(pixels: Uint8ClampedArray): PanelArt {
  return { width: WIDTH, height: HEIGHT, pixels, highlight: null };
}

function maskOf(...boxes: readonly Box[]): Uint8Array {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (const box of boxes) {
    for (let y = box.minY; y <= box.maxY; y += 1) {
      for (let x = box.minX; x <= box.maxX; x += 1) mask[y * WIDTH + x] = 1;
    }
  }
  return mask;
}

/** Rows `[minY, minY + rows)` of the emerged strip: `20 * rows` pixels of it. */
function partOfEmerged(rows: number): Box {
  return { ...EMERGED, maxY: EMERGED.minY + rows - 1 };
}

function currentPanel(): Uint8ClampedArray {
  const pixels = blankPage();
  fill(pixels, BUILT, BRICK);
  return pixels;
}

function nextPanelArt(): Uint8ClampedArray {
  const pixels = blankPage();
  fill(pixels, BUILT, BRICK);
  fill(pixels, EMERGED, BRICK);
  fill(pixels, REPAINTED, OTHER_BRICK);
  return pixels;
}

const DELTA = panelDelta(panelOf(currentPanel()), panelOf(nextPanelArt()), {
  backgroundHex: PAGE_GREY,
});

describe("an exploded step needs both readings of the next panel, not either one", () => {
  it("separates what emerged from what merely changed", () => {
    expect(DELTA.emergedPx).toBe(200);
    expect(DELTA.changedPx).toBe(400);
  });

  /**
   * A part that lands half on bare page and half over the assembly. The impostor
   * repaints most of the changed area and emerges almost nowhere, which is what
   * the difference reading alone cannot refuse.
   */
  it("ranks the true placement over one the difference reading alone prefers", () => {
    const truth = scoreExplodedStep(
      { newlyVisibleMask: maskOf(partOfEmerged(8)), changedMask: maskOf(partOfEmerged(8)) },
      DELTA,
    );
    const impostor = scoreExplodedStep(
      {
        newlyVisibleMask: maskOf(partOfEmerged(2)),
        changedMask: maskOf(partOfEmerged(8), REPAINTED),
      },
      DELTA,
    );

    expect(truth.emergenceIou).toBeCloseTo(0.8, 10);
    expect(truth.changeIou).toBeCloseTo(0.4, 10);
    expect(impostor.emergenceIou).toBeCloseTo(0.2, 10);
    expect(impostor.changeIou).toBeCloseTo(0.9, 10);
    // Read by the difference alone the impostor wins 0.9 to 0.4; blended it loses.
    expect(impostor.changeIou).toBeGreaterThan(truth.changeIou);
    expect(truth.score).toBeGreaterThan(impostor.score);
  });

  /**
   * The mirror case, and the reason emergence is not simply promoted to the whole
   * score: an impostor sitting on the emerged region wins the emergence reading
   * outright while explaining almost nothing else the panels disagree about.
   */
  it("ranks the true placement over one the emerged region alone prefers", () => {
    const truth = scoreExplodedStep(
      {
        newlyVisibleMask: maskOf(partOfEmerged(4)),
        changedMask: maskOf(partOfEmerged(6), REPAINTED),
      },
      DELTA,
    );
    const impostor = scoreExplodedStep(
      {
        newlyVisibleMask: maskOf(partOfEmerged(9)),
        changedMask: maskOf(partOfEmerged(9), { minX: 45, minY: 5, maxX: 69, maxY: 24 }),
      },
      DELTA,
    );

    expect(truth.emergenceIou).toBeCloseTo(0.4, 10);
    expect(truth.changeIou).toBeCloseTo(0.8, 10);
    expect(impostor.emergenceIou).toBeCloseTo(0.9, 10);
    expect(impostor.changeIou).toBeCloseTo(0.2, 10);
    expect(impostor.emergenceIou!).toBeGreaterThan(truth.emergenceIou!);
    expect(truth.score).toBeGreaterThan(impostor.score);
  });

  it("keeps both readings inside one number rather than choosing between them", () => {
    const scored = scoreExplodedStep(
      { newlyVisibleMask: maskOf(partOfEmerged(8)), changedMask: maskOf(partOfEmerged(8)) },
      DELTA,
    );
    expect(scored.basis).toBe("emergence-and-change");
    // 0.5 * 0.8 + 0.5 * 0.4. A score equal to either reading is a score that
    // dropped the other one.
    expect(scored.score).toBeCloseTo(0.6, 10);
    expect(scored.score).not.toBeCloseTo(scored.emergenceIou!, 6);
    expect(scored.score).not.toBeCloseTo(scored.changeIou, 6);
  });
});
