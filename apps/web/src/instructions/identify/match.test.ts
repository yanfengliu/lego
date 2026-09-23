import { describe, expect, it } from "vitest";

import { comparePictures, featuresOf, overlap, rankReferences, type Features } from "./match";
import type { Picture } from "./pictures";

type Rgb = readonly [number, number, number];

const WEIGHTS = { alignSearchPx: 3, appearanceWeight: 0.5, colourWeight: 1 / 60 };

/** A filled `width` x `height` block with a lighter top band, cropped tight like a cut picture. */
function block(width: number, height: number, rgb: Rgb): Picture {
  const mask = new Uint8Array(width * height).fill(1);
  const colours = new Uint8Array(width * height * 3);
  for (let p = 0; p < width * height; p += 1) {
    const shade = Math.floor(p / width) < height * 0.3 ? 1.2 : 1;
    for (let c = 0; c < 3; c += 1) colours[p * 3 + c] = Math.min(255, Math.round(rgb[c]! * shade));
  }
  return { bbox: null, width, height, mask, rgb: colours, drawing: null, flags: [] };
}

function features(picture: Picture): Features {
  const f = featuresOf(picture);
  if (f === null) throw new Error("test picture has no ink");
  return f;
}

const RED: Rgb = [200, 40, 40];
const BLUE: Rgb = [40, 70, 190];

describe("featuresOf", () => {
  it("has nothing to compare for a picture without ink", () => {
    const empty = { ...block(4, 4, RED), mask: new Uint8Array(16) };
    expect(featuresOf(empty)).toBeNull();
  });

  it("measures area, centroid and mean colour over the ink only", () => {
    const picture = block(4, 2, RED);
    const mask = new Uint8Array([1, 1, 0, 0, 1, 1, 0, 0]);
    const f = features({ ...picture, mask });
    expect(f.area).toBe(4);
    expect([f.cx, f.cy]).toEqual([1, 1]);
    expect(f.meanRgb[2]).toBeCloseTo((48 * 2 + 40 * 2) / 4);
  });
});

describe("comparePictures", () => {
  it("scores a picture against itself as full overlap, full correlation, no colour distance", () => {
    const f = features(block(30, 12, RED));
    const scored = comparePictures(f, f, WEIGHTS);
    expect(scored).toMatchObject({ iou: 1, colourDistance: 0 });
    expect(scored.ncc).toBeCloseTo(1);
    expect(scored.score).toBeCloseTo(1.5);
  });

  it("cannot pass a 1x6 bar for a 1x4 bar at one fixed scale", () => {
    const scored = comparePictures(
      features(block(60, 10, RED)),
      features(block(40, 10, RED)),
      WEIGHTS,
    );
    expect(scored.iou).toBeCloseTo(40 / 60);
  });

  it("charges the colour distance for the same shape in another colour", () => {
    const red = features(block(30, 12, RED));
    const blue = features(block(30, 12, BLUE));
    const scored = comparePictures(red, blue, WEIGHTS);
    expect(scored.iou).toBe(1);
    expect(scored.colourDistance).toBeGreaterThan(200);
    expect(scored.score).toBeLessThan(comparePictures(red, red, WEIGHTS).score - 3);
  });

  it("finds the best shift within the search window when the centroids disagree", () => {
    // A bar with a one-pixel tail: its centroid sits off the bar's middle.
    const bar = block(20, 6, RED);
    const tailMask = new Uint8Array(26 * 6);
    for (let y = 0; y < 6; y += 1) for (let x = 0; x < 20; x += 1) tailMask[y * 26 + x] = 1;
    for (let x = 20; x < 26; x += 1) tailMask[5 * 26 + x] = 1;
    const tailed = { ...block(26, 6, RED), mask: tailMask };
    const searched = comparePictures(features(tailed), features(bar), WEIGHTS);
    const fixed = comparePictures(features(tailed), features(bar), {
      ...WEIGHTS,
      alignSearchPx: 0,
    });
    expect(searched.iou).toBeCloseTo(120 / 126);
    expect(searched.iou).toBeGreaterThan(fixed.iou);
  });
});

describe("overlap", () => {
  it("counts shared ink with the second picture shifted onto the first", () => {
    const a = features(block(4, 4, RED));
    const b = features(block(2, 2, RED));
    expect(overlap(a, b, 0, 0)).toBe(4);
    expect(overlap(a, b, 3, 3)).toBe(1);
    expect(overlap(a, b, 4, 0)).toBe(0);
  });
});

describe("rankReferences", () => {
  const references = [
    { elementId: "red-2x4", features: features(block(30, 12, RED)) },
    { elementId: "blue-2x4", features: features(block(30, 12, BLUE)) },
    { elementId: "red-2x6", features: features(block(45, 12, RED)) },
    { elementId: "red-tall", features: features(block(12, 45, RED)) },
  ];

  it("ranks the same shape and colour first, the same shape in another colour below it", () => {
    const ranked = rankReferences(features(block(30, 12, BLUE)), references, WEIGHTS, 3);
    expect(ranked.map((c) => c.elementId)).toEqual(["blue-2x4", "red-2x4", "red-2x6"]);
    expect(ranked[0]).toMatchObject({ iou: 1 });
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("returns at most `keep` candidates and breaks score ties by element id", () => {
    const twins = [
      { elementId: "b", features: features(block(10, 10, RED)) },
      { elementId: "a", features: features(block(10, 10, RED)) },
    ];
    expect(rankReferences(features(block(10, 10, RED)), twins, WEIGHTS, 1)).toEqual([
      { elementId: "a", score: 1.5, iou: 1 },
    ]);
  });
});
