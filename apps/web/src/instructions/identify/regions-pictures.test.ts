import { describe, expect, it } from "vitest";

import { extractPictures, type Picture } from "./pictures";
import { compositeRegion } from "./raster";
import { findAnchor, framingBox, planRegions, type LabelBox } from "./regions";
import type { DecodedImage, FillPath, ImagePaint, PageScan, Rect } from "./types";

type Rgb = readonly [number, number, number];
const RED: Rgb = [200, 40, 40];
const BLUE: Rgb = [40, 70, 190];
const PX_PER_PT = 4;

/** A bar of `rgb` on white; each side's margin in points, zero where the bar runs off the image. */
function barImage(key: string, barW: number, barH: number, margin: Rect, rgb: Rgb): DecodedImage {
  const width = (barW + margin.x0 + margin.x1) * PX_PER_PT;
  const height = (barH + margin.y0 + margin.y1) * PX_PER_PT;
  const pixels = new Uint8Array(width * height * 3).fill(255);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const x = column / PX_PER_PT - margin.x0;
      const y = row / PX_PER_PT - margin.y1;
      if (x < 0 || x >= barW || y < 0 || y >= barH) continue;
      pixels.set(rgb, (row * width + column) * 3);
    }
  }
  return { width, height, rgb: pixels, alpha: null, digest: `sha256:${key}` };
}

function paint(
  imageKey: string,
  order: number,
  x: number,
  y: number,
  w: number,
  h: number,
): ImagePaint {
  return { imageKey, order, transform: [w, 0, 0, h, x, y], clip: null };
}

function scan(paints: readonly ImagePaint[], fills: readonly FillPath[] = []): PageScan {
  return { pageNumber: 1, widthPt: 600, heightPt: 800, texts: [], paints, fills };
}

function label(xPt: number, yPt: number): LabelBox {
  return { xPt, yPt, sizePt: 8, widthPt: 8 };
}

function cut(
  page: PageScan,
  labels: readonly LabelBox[],
  images: readonly DecodedImage[],
  useBoxes: boolean,
): Map<number, Picture> {
  const byKey = new Map(images.map((image) => [image.digest.slice("sha256:".length), image]));
  const pictures = new Map<number, Picture>();
  for (const plan of planRegions(page, labels, { useBoxes })) {
    const raster = compositeRegion(plan.rect, 3, plan.paints, byKey, 14);
    const options = { backgroundTolerance: 14, expectedRiseRatio: 0.93, minComponentPx: 3 };
    for (const [index, picture] of extractPictures(plan, labels, raster, byKey, options))
      pictures.set(index, picture);
  }
  return pictures;
}

const NO_MARGIN: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };

describe("findAnchor", () => {
  it("takes the image whose bottom-left corner sits just above the label, the largest on a tie", () => {
    const small = paint("a", 0, 100, 206, 10, 10);
    const large = paint("b", 1, 100.5, 206, 30, 10);
    const offside = paint("c", 2, 130, 206, 50, 50);
    expect(findAnchor(label(100, 200), [small, large, offside])).toEqual({
      paint: large,
      rule: "offset",
      risePt: 6,
    });
  });

  it("accepts a drawing whose rectangle reaches down around its own label", () => {
    const around = paint("a", 0, 95, 199, 60, 40);
    expect(findAnchor(label(100, 200), [around])).toMatchObject({
      paint: around,
      rule: "contains",
    });
  });

  it("finds nothing when no image lines up with the label", () => {
    expect(
      findAnchor(label(100, 200), [
        paint("a", 0, 104, 206, 10, 10),
        paint("b", 1, 100, 240, 10, 10),
      ]),
    ).toBeNull();
  });
});

describe("framingBox", () => {
  const box = (x0: number, y0: number, x1: number, y1: number, isRectangle = true): FillPath => ({
    bounds: { x0, y0, x1, y1 },
    isRectangle,
  });

  it("takes the smallest filled rectangle around the label, never the page or a non-rectangle", () => {
    const fills = [
      box(0, 0, 600, 800),
      box(90, 190, 300, 300),
      box(95, 195, 200, 260),
      box(98, 198, 120, 220, false),
    ];
    expect(framingBox(scan([], fills), label(100, 200))).toEqual({
      x0: 95,
      y0: 195,
      x1: 200,
      y1: 260,
    });
    expect(framingBox(scan([], [box(0, 0, 600, 800)]), label(100, 200))).toBeNull();
  });
});

describe("planRegions", () => {
  it("shares one region among the labels of one callout box, and keeps distant labels apart", () => {
    const fills: FillPath[] = [
      { bounds: { x0: 90, y0: 190, x1: 300, y1: 260 }, isRectangle: true },
    ];
    const boxed = planRegions(scan([], fills), [label(100, 200), label(200, 200)], {
      useBoxes: true,
    });
    expect(boxed.map((plan) => [plan.labels, plan.boxed])).toEqual([[[0, 1], true]]);
    const apart = planRegions(scan([]), [label(100, 200), label(400, 500)], { useBoxes: false });
    expect(apart.map((plan) => plan.labels)).toEqual([[0], [1]]);
  });
});

describe("extractPictures", () => {
  it("re-joins a drawing the exporter cut into two tiles, and marks it composite", () => {
    const left = barImage("left", 10, 8, { x0: 2, y0: 2, x1: 0, y1: 2 }, RED);
    const right = barImage("right", 10, 8, { x0: 0, y0: 2, x1: 2, y1: 2 }, RED);
    const page = scan([paint("left", 0, 100, 106, 12, 12), paint("right", 1, 112, 106, 12, 12)]);
    const picture = cut(page, [label(100, 100)], [left, right], false).get(0)!;
    expect(picture.flags).toEqual([]);
    expect(picture.drawing).toBe("composite:100.000,100.000");
    expect(picture.bbox!.x0).toBeCloseTo(102, 0);
    expect(picture.bbox!.x1).toBeCloseTo(122, 0);
  });

  it("cuts two touching drawings apart along their own paints and flags both", () => {
    const red = barImage("red", 22, 8, { x0: 2, y0: 2, x1: 0, y1: 2 }, RED);
    const blue = barImage("blue", 20, 8, { x0: 0, y0: 2, x1: 2, y1: 2 }, BLUE);
    const page = scan([paint("red", 0, 100, 106, 24, 12), paint("blue", 1, 124, 106, 22, 12)]);
    const pictures = cut(page, [label(100, 100), label(124, 100)], [red, blue], false);
    const [a, b] = [pictures.get(0)!, pictures.get(1)!];
    expect(a.flags).toContain("merged-split");
    expect(b.flags).toContain("merged-split");
    expect(a.bbox!.x1).toBeCloseTo(124, 0);
    expect(b.bbox!.x0).toBeCloseTo(124, 0);
    expect(a.drawing).toBe("sha256:red@24.00x12.00");
    expect(b.drawing).toBe("sha256:blue@22.00x12.00");
  });

  it("gives a label with no aligned image the ink where its picture should be, and says so", () => {
    const bar = barImage("bar", 20, 8, { x0: 2, y0: 2, x1: 2, y1: 2 }, RED);
    const fills: FillPath[] = [{ bounds: { x0: 90, y0: 90, x1: 200, y1: 160 }, isRectangle: true }];
    const page = scan([paint("bar", 0, 104, 106, 24, 12)], fills);
    const picture = cut(page, [label(100, 100)], [bar], true).get(0)!;
    expect(picture.flags).toEqual(["unlinked-picture"]);
    expect(picture.drawing).toBe("composite:100.000,100.000");
    expect(picture.bbox!.x0).toBeCloseTo(106, 0);
  });

  it("reports a label with nothing drawn near it as having no picture", () => {
    const fills: FillPath[] = [{ bounds: { x0: 90, y0: 90, x1: 200, y1: 160 }, isRectangle: true }];
    const picture = cut(scan([], fills), [label(100, 100)], [], true).get(0)!;
    expect(picture).toMatchObject({
      bbox: null,
      drawing: null,
      flags: ["unlinked-picture", "no-picture"],
    });
  });
});

describe("compositeRegion", () => {
  it("refuses a region too large to rasterize, naming its size and the setting to lower", () => {
    expect(() =>
      compositeRegion({ x0: 0, y0: 0, x1: 2000, y1: 2000 }, 3, [], new Map(), 14),
    ).toThrow(
      /A callout region of 2000.0x2000.0pt needs 36000000 pixels at 3.00 px\/pt, over the 4000000 limit; lower gridPxPerPt\./,
    );
  });

  it("keeps the colours of a painted image at the requested scale", () => {
    const image = barImage("solid", 4, 4, NO_MARGIN, BLUE);
    const raster = compositeRegion(
      { x0: 0, y0: 0, x1: 4, y1: 4 },
      2,
      [paint("solid", 0, 0, 0, 4, 4)],
      new Map([["solid", image]]),
      14,
    );
    expect([raster.width, raster.height]).toEqual([8, 8]);
    expect(Array.from(raster.rgb.subarray(0, 3))).toEqual([...BLUE]);
    expect(raster.paintIndex.every((index) => index === 0)).toBe(true);
  });
});
