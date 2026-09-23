import { describe, expect, it } from "vitest";

import { deriveRealBuildPrefix50Step44ParentOnlyRegion } from "../e2e/real-build-prefix50-subbuild-return-review-camera-source";
import { deriveRealBuildPrefix50Step44YellowChildMask } from "../e2e/real-build-prefix50-subbuild-return-review-camera-source-mask";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT as HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH as WIDTH,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-source-commitments";

const BACKGROUND = [0x89, 0x90, 0x93, 0xff] as const;
const YELLOW = [0xff, 0xd8, 0x00, 0xff] as const;
const INK = [0x1a, 0x1d, 0x1b, 0xff] as const;

function blank(): Uint8Array {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) rgba.set(BACKGROUND, index * 4);
  return rgba;
}

function pixel(
  rgba: Uint8Array,
  x: number,
  y: number,
  color: readonly [number, number, number, number],
): void {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  rgba.set(color, (y * WIDTH + x) * 4);
}

function rectangle(
  rgba: Uint8Array,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  color: readonly [number, number, number, number],
): void {
  for (let y = minY; y <= maxY; y += 1)
    for (let x = minX; x <= maxX; x += 1) pixel(rgba, x, y, color);
}

function line(
  rgba: Uint8Array,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thicknessRadius = 0,
): void {
  let x = startX;
  let y = startY;
  const deltaX = Math.abs(endX - startX);
  const deltaY = -Math.abs(endY - startY);
  const stepX = startX < endX ? 1 : -1;
  const stepY = startY < endY ? 1 : -1;
  let error = deltaX + deltaY;
  for (;;) {
    rectangle(
      rgba,
      x - thicknessRadius,
      y - thicknessRadius,
      x + thicknessRadius,
      y + thicknessRadius,
      YELLOW,
    );
    if (x === endX && y === endY) break;
    const twiceError = error * 2;
    if (twiceError >= deltaY) {
      error += deltaY;
      x += stepX;
    }
    if (twiceError <= deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
}

function openAsymmetricContour(): Uint8Array {
  const rgba = blank();
  rectangle(rgba, 50, 330, 650, 420, INK);
  const primaryPath = [
    [100, 160],
    [150, 120],
    [170, 100],
    [450, 200],
    [460, 260],
    [430, 285],
  ] as const;
  for (let index = 1; index < primaryPath.length; index += 1)
    line(
      rgba,
      primaryPath[index - 1]![0],
      primaryPath[index - 1]![1],
      primaryPath[index]![0],
      primaryPath[index]![1],
      1,
    );
  line(rgba, 130, 205, 130, 235);
  line(rgba, 230, 270, 270, 270);
  pixel(rgba, 300, 300, INK);
  return rgba;
}

describe("prefix-50 Step-44 yellow child contour source mask", () => {
  it("fills the asymmetric occlusion-gapped contour, dilates one pixel, and preserves parent art the old box erased", () => {
    const rgba = openAsymmetricContour();
    const child = deriveRealBuildPrefix50Step44YellowChildMask(rgba);
    const parent = deriveRealBuildPrefix50Step44ParentOnlyRegion(rgba);
    const center = 180 * WIDTH + 250;
    const onePixelOutsideTopVertex = 98 * WIDTH + 170;
    const oldBoxOnlyParent = 300 * WIDTH + 300;

    expect(child.evidence).toMatchObject({
      componentSelection: {
        connectivity: 8,
        strategy: "unique-spanning-component-plus-contained-thin-fragments",
      },
      fillStrategy: "integer-pixel-center-convex-hull-inclusive",
      childExclusionDilation: { metric: "chebyshev", radiusPx: 1 },
      selectedHighlightComponentCount: 3,
      ignoredHighlightPixelCount: 0,
    });
    expect(child.highlightMask[center]).toBe(0);
    expect(child.filledHighlightMask[center]).toBe(1);
    expect(child.filledHighlightMask[onePixelOutsideTopVertex]).toBe(0);
    expect(child.highlightedChildExclusionMask[onePixelOutsideTopVertex]).toBe(1);
    expect(parent.highlightedChildExclusionMask[oldBoxOnlyParent]).toBe(0);
    expect(parent.eligibleMask[oldBoxOnlyParent]).toBe(1);
    expect(parent.parentOnlyForegroundMask[oldBoxOnlyParent]).toBe(1);
  });

  it("ignores unrelated exterior yellow and a thick interior blob instead of expanding the child hull", () => {
    const baseline = openAsymmetricContour();
    const expected = deriveRealBuildPrefix50Step44YellowChildMask(baseline);
    const adversarial = new Uint8Array(baseline);
    rectangle(adversarial, 600, 320, 605, 325, YELLOW);
    rectangle(adversarial, 300, 110, 311, 121, YELLOW);
    const actual = deriveRealBuildPrefix50Step44YellowChildMask(adversarial);

    expect(actual.highlightMask).toEqual(expected.highlightMask);
    expect(actual.filledHighlightMask).toEqual(expected.filledHighlightMask);
    expect(actual.highlightedChildExclusionMask).toEqual(expected.highlightedChildExclusionMask);
    expect(actual.evidence.thresholdHighlightPixelCount).toBe(
      expected.evidence.thresholdHighlightPixelCount + 180,
    );
    expect(actual.evidence.ignoredHighlightPixelCount).toBe(180);
  });

  it("refuses fragments that only look like a spanning contour after their gaps are invented", () => {
    const rgba = blank();
    line(rgba, 100, 120, 450, 120, 1);
    line(rgba, 450, 180, 450, 285, 1);
    expect(() => deriveRealBuildPrefix50Step44YellowChildMask(rgba)).toThrow(
      /spanning yellow child contour/u,
    );
  });

  it("refuses two unrelated spanning yellow components instead of choosing one by size", () => {
    const rgba = blank();
    rectangle(rgba, 40, 100, 260, 102, YELLOW);
    rectangle(rgba, 40, 100, 42, 180, YELLOW);
    rectangle(rgba, 430, 250, 680, 252, YELLOW);
    rectangle(rgba, 678, 170, 680, 252, YELLOW);
    expect(() => deriveRealBuildPrefix50Step44YellowChildMask(rgba)).toThrow(
      /exactly one.*found 2/u,
    );
  });
});
