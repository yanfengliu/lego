import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  createOrthographicViewCamera,
  fitOrthographicView,
  viewDirection,
  type OrthographicViewFrame,
  type OrthographicViewParameters,
} from "./camera-fit.ts";
import { overlap, silhouetteFromMask, silhouetteFromPixels } from "./silhouette.ts";

const FRAME: OrthographicViewFrame = {
  widthPx: 240,
  heightPx: 180,
  target: [0, 0, 0],
  sceneRadius: 4,
};

/**
 * A stand-in model with no graphics context: lattice points in an L, taller on
 * one arm, rasterised as discs through the same projection the real camera
 * implements. It is asymmetric in every axis, so a wrong azimuth or elevation
 * cannot coincidentally match.
 */
const MODEL: readonly (readonly [number, number, number])[] = (() => {
  const points: [number, number, number][] = [];
  for (let x = 0; x < 6; x += 1) points.push([x * 0.4 - 1.2, 0, -1.2]);
  for (let z = 0; z < 4; z += 1) points.push([-1.2, 0, z * 0.4 - 0.8]);
  for (let y = 1; y < 4; y += 1) points.push([-1.2, y * 0.3, -1.2]);
  return points;
})();

/**
 * World-sized, not pixel-sized. A feature that keeps a fixed pixel radius while
 * the camera scale changes does not scale with the model, and the equal-area
 * solve the fitter depends on has nothing to solve against.
 */
const DISC_RADIUS_UNITS = 0.15;

function renderModel(
  parameters: OrthographicViewParameters,
): ReturnType<typeof silhouetteFromMask> {
  const { widthPx, heightPx } = FRAME;
  const mask = new Uint8Array(widthPx * heightPx);
  const camera = createOrthographicViewCamera(parameters, FRAME);
  const radiusPx = DISC_RADIUS_UNITS * parameters.pixelsPerUnit;
  for (const point of MODEL) {
    const projected = new Vector3(...point).project(camera);
    const centerX = ((projected.x + 1) / 2) * widthPx;
    const centerY = ((1 - projected.y) / 2) * heightPx;
    const minX = Math.max(0, Math.floor(centerX - radiusPx));
    const maxX = Math.min(widthPx - 1, Math.ceil(centerX + radiusPx));
    const minY = Math.max(0, Math.floor(centerY - radiusPx));
    const maxY = Math.min(heightPx - 1, Math.ceil(centerY + radiusPx));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radiusPx ** 2) mask[y * widthPx + x] = 1;
      }
    }
  }
  return silhouetteFromMask(mask, widthPx, heightPx);
}

const SEED = { pixelsPerUnit: 40, centerXPx: FRAME.widthPx / 2, centerYPx: FRAME.heightPx / 2 };

describe("orthographic view camera", () => {
  it("puts the view axis exactly where the fit says it is", () => {
    const parameters: OrthographicViewParameters = {
      azimuthDegrees: 34,
      elevationDegrees: 27,
      pixelsPerUnit: 33,
      centerXPx: 71,
      centerYPx: 118,
    };
    const camera = createOrthographicViewCamera(parameters, FRAME);

    const projected = new Vector3(...FRAME.target).project(camera);
    expect(((projected.x + 1) / 2) * FRAME.widthPx).toBeCloseTo(parameters.centerXPx, 6);
    expect(((1 - projected.y) / 2) * FRAME.heightPx).toBeCloseTo(parameters.centerYPx, 6);
  });

  it("scales by exactly pixelsPerUnit along the image axes", () => {
    const parameters: OrthographicViewParameters = {
      azimuthDegrees: -18,
      elevationDegrees: 41,
      pixelsPerUnit: 25,
      centerXPx: 100,
      centerYPx: 90,
    };
    const camera = createOrthographicViewCamera(parameters, FRAME);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);

    const onRight = new Vector3(...FRAME.target).add(right).project(camera);
    const onUp = new Vector3(...FRAME.target).add(up).project(camera);
    expect(((onRight.x + 1) / 2) * FRAME.widthPx).toBeCloseTo(
      parameters.centerXPx + parameters.pixelsPerUnit,
      5,
    );
    expect(((1 - onUp.y) / 2) * FRAME.heightPx).toBeCloseTo(
      parameters.centerYPx - parameters.pixelsPerUnit,
      5,
    );
  });

  it("names the offending value rather than producing a broken frustum", () => {
    expect(() =>
      createOrthographicViewCamera(
        { ...SEED, azimuthDegrees: 0, elevationDegrees: 0, pixelsPerUnit: 0 },
        FRAME,
      ),
    ).toThrowError(/pixelsPerUnit must be positive, received 0/);
    expect(() =>
      createOrthographicViewCamera(
        { ...SEED, azimuthDegrees: Number.NaN, elevationDegrees: 0 },
        FRAME,
      ),
    ).toThrowError(/azimuthDegrees must be a finite number/);
  });

  it("stays well defined looking straight down", () => {
    const camera = createOrthographicViewCamera(
      { ...SEED, azimuthDegrees: 0, elevationDegrees: 90 },
      FRAME,
    );
    const projected = new Vector3(...FRAME.target).project(camera);

    expect(Number.isFinite(projected.x)).toBe(true);
    expect(Number.isFinite(projected.y)).toBe(true);
  });
});

describe("fitting a booklet panel's camera", () => {
  it("recovers a view it was never told, from geometry alone", () => {
    const truth: OrthographicViewParameters = {
      azimuthDegrees: 37,
      elevationDegrees: 28,
      pixelsPerUnit: 46,
      centerXPx: 132,
      centerYPx: 84,
    };
    const target = renderModel(truth);

    const fit = fitOrthographicView(renderModel, target, SEED);

    expect(fit.failure).toBeNull();
    expect(fit.best!.iou).toBeGreaterThan(0.95);
    // Five refinement passes take the 15-degree sweep to 0.47 degrees, so that
    // is the resolution the angles can be held to, not an arbitrary slack.
    expect(Math.abs(fit.best!.azimuthDegrees - truth.azimuthDegrees)).toBeLessThan(0.5);
    expect(Math.abs(fit.best!.elevationDegrees - truth.elevationDegrees)).toBeLessThan(0.5);
    expect(fit.best!.pixelsPerUnit).toBeCloseTo(truth.pixelsPerUnit, 0);
    expect(fit.best!.centerXPx).toBeCloseTo(truth.centerXPx, 0);
    expect(fit.best!.centerYPx).toBeCloseTo(truth.centerYPx, 0);
  });

  it("recovers scale and offset it was seeded far away from", () => {
    const truth: OrthographicViewParameters = {
      azimuthDegrees: 120,
      elevationDegrees: 35,
      pixelsPerUnit: 32,
      centerXPx: 80,
      centerYPx: 110,
    };
    const target = renderModel(truth);

    // Twice the scale and the opposite corner of the frame, so the first trial
    // render lands mostly outside it and measures a truncated area.
    const fit = fitOrthographicView(renderModel, target, {
      pixelsPerUnit: 70,
      centerXPx: 200,
      centerYPx: 20,
    });

    expect(fit.best!.iou).toBeGreaterThan(0.95);
    expect(fit.best!.pixelsPerUnit).toBeCloseTo(truth.pixelsPerUnit, 0);
    expect(fit.best!.centerXPx).toBeCloseTo(truth.centerXPx, 0);
    expect(fit.best!.centerYPx).toBeCloseTo(truth.centerYPx, 0);
  });

  it("needs more than one alignment pass when the seed starts off the frame", () => {
    const truth: OrthographicViewParameters = {
      azimuthDegrees: 120,
      elevationDegrees: 35,
      pixelsPerUnit: 32,
      centerXPx: 80,
      centerYPx: 110,
    };
    const target = renderModel(truth);
    const farSeed = { pixelsPerUnit: 70, centerXPx: 200, centerYPx: 20 };

    const once = fitOrthographicView(renderModel, target, farSeed, { alignmentPasses: 1 });
    const enough = fitOrthographicView(renderModel, target, farSeed, { alignmentPasses: 6 });

    // A single pass measures a clipped silhouette, so it does not merely land
    // imprecisely — it picks the wrong direction entirely.
    expect(Math.abs(once.best!.azimuthDegrees - truth.azimuthDegrees)).toBeGreaterThan(10);
    expect(enough.best!.azimuthDegrees).toBeCloseTo(truth.azimuthDegrees, 1);
  });

  it("is exact when its trial render is never clipped", () => {
    const truth: OrthographicViewParameters = {
      azimuthDegrees: 120,
      elevationDegrees: 35,
      pixelsPerUnit: 32,
      centerXPx: 80,
      centerYPx: 110,
    };
    const target = renderModel(truth);

    const fit = fitOrthographicView(renderModel, target, {
      pixelsPerUnit: truth.pixelsPerUnit,
      centerXPx: truth.centerXPx,
      centerYPx: truth.centerYPx,
    });

    expect(fit.best!.iou).toBe(1);
  });

  it("scores below 1 on a target too small to rasterise cleanly, even when the fit is right", () => {
    // The same view at a scale where the model spans 43 pixels. The fit still
    // recovers the parameters, but a sub-pixel residual is a large fraction of
    // a 3-pixel feature, so an IoU is only comparable against another IoU
    // measured at the same scale.
    const truth: OrthographicViewParameters = {
      azimuthDegrees: 120,
      elevationDegrees: 35,
      pixelsPerUnit: 18,
      centerXPx: 60,
      centerYPx: 130,
    };
    const target = renderModel(truth);

    const fit = fitOrthographicView(renderModel, target, SEED, { alignmentPasses: 8 });

    expect(target.area).toBeLessThan(400);
    expect(fit.best!.azimuthDegrees).toBeCloseTo(truth.azimuthDegrees, 1);
    expect(fit.best!.iou).toBeLessThan(0.95);
    expect(fit.best!.iou).toBeGreaterThan(0.8);
  });

  it("refines past the resolution of the sweep it started from", () => {
    const truth: OrthographicViewParameters = {
      azimuthDegrees: 52,
      elevationDegrees: 32,
      pixelsPerUnit: 40,
      centerXPx: 120,
      centerYPx: 90,
    };
    const target = renderModel(truth);
    const swept = fitOrthographicView(renderModel, target, SEED, { refinePasses: 0 });
    const refined = fitOrthographicView(renderModel, target, SEED, { refinePasses: 4 });

    // The sweep can only land on a multiple of 15 degrees; 52 is not one.
    expect(Math.abs(swept.best!.azimuthDegrees - truth.azimuthDegrees)).toBeGreaterThan(1);
    expect(Math.abs(refined.best!.azimuthDegrees - truth.azimuthDegrees)).toBeLessThan(
      Math.abs(swept.best!.azimuthDegrees - truth.azimuthDegrees),
    );
    expect(refined.best!.iou).toBeGreaterThan(swept.best!.iou);
  });

  it("says why it failed, with the numbers needed to diagnose it", () => {
    const empty = silhouetteFromMask(new Uint8Array(240 * 180), 240, 180);

    const fit = fitOrthographicView(renderModel, empty, SEED);

    expect(fit.best).toBeNull();
    // The raster size and the likely cause, not just "empty": a caller reading
    // this should not have to open the fitter to know what to check next.
    expect(fit.failure).toContain("240x180");
    expect(fit.failure).toMatch(/background colour/);
  });

  it("distinguishes a target it never reached from one it never overlapped", () => {
    // A target the model cannot overlap at any scale: one pixel in a corner,
    // far from anything an equal-area align will put the model on.
    const stray = new Uint8Array(240 * 180);
    stray[0] = 1;
    const fit = fitOrthographicView(renderModel, silhouetteFromMask(stray, 240, 180), SEED, {
      refinePasses: 0,
    });

    if (fit.best === null) {
      expect(fit.failure).toContain("1-pixel target");
      expect(fit.failure).toMatch(/disjoint rather than merely misaligned/);
    } else {
      // Overlapping a single pixel is possible; the point is that a zero-overlap
      // result must explain itself rather than return a meaningless best.
      expect(fit.failure).toBeNull();
      expect(fit.best.iou).toBeGreaterThan(0);
    }
  });

  it("says how many directions it was given when it was given none", () => {
    const target = renderModel({ ...SEED, azimuthDegrees: 0, elevationDegrees: 30 });

    expect(() =>
      fitOrthographicView(renderModel, target, SEED, { azimuthDegrees: [] }),
    ).toThrowError(/received 0 and 7/);
  });

  it("reports every direction it tried, best first", () => {
    const target = renderModel({ ...SEED, azimuthDegrees: 15, elevationDegrees: 30 });

    const fit = fitOrthographicView(renderModel, target, SEED, { keepRanked: 5 });

    expect(fit.ranked).toHaveLength(5);
    expect(fit.ranked[0]!.iou).toBe(fit.best!.iou);
    for (let index = 1; index < fit.ranked.length; index += 1) {
      expect(fit.ranked[index - 1]!.iou).toBeGreaterThanOrEqual(fit.ranked[index]!.iou);
    }
    expect(fit.renders).toBeGreaterThan(0);
  });

  it("points the camera where the azimuth and elevation say", () => {
    expect(
      viewDirection(0, 0)
        .toArray()
        .map((value) => Math.round(value * 1000) / 1000),
    ).toEqual([0, 0, 1]);
    expect(
      viewDirection(90, 0)
        .toArray()
        .map((value) => Math.round(value * 1000) / 1000),
    ).toEqual([1, 0, 0]);
    expect(
      viewDirection(0, 90)
        .toArray()
        .map((value) => Math.round(value * 1000) / 1000),
    ).toEqual([0, 1, 0]);
  });
});

describe("silhouettes", () => {
  it("keys out an exact background and nothing else", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let index = 0; index < 16; index += 1) {
      pixels[index * 4] = 0x89;
      pixels[index * 4 + 1] = 0x90;
      pixels[index * 4 + 2] = 0x93;
      pixels[index * 4 + 3] = 255;
    }
    pixels[5 * 4] = 0xc9;
    pixels[5 * 4 + 1] = 0x1a;
    pixels[5 * 4 + 2] = 0x09;

    const silhouette = silhouetteFromPixels(pixels, 4, 4, { backgroundHex: 0x899093 });

    expect(silhouette.area).toBe(1);
    expect(silhouette.centroidXPx).toBe(1);
    expect(silhouette.centroidYPx).toBe(1);
    expect(silhouette.bounds).toEqual({ minXPx: 1, minYPx: 1, maxXPx: 1, maxYPx: 1 });
  });

  it("admits a page raster's antialiasing only when asked", () => {
    const pixels = new Uint8ClampedArray(2 * 1 * 4);
    pixels.set([0x89, 0x90, 0x93, 255, 0x8b, 0x92, 0x95, 255]);

    expect(silhouetteFromPixels(pixels, 2, 1, { backgroundHex: 0x899093 }).area).toBe(1);
    expect(silhouetteFromPixels(pixels, 2, 1, { backgroundHex: 0x899093, tolerance: 3 }).area).toBe(
      0,
    );
  });

  it("reports an empty region as empty rather than as a point at the origin", () => {
    const silhouette = silhouetteFromMask(new Uint8Array(9), 3, 3);

    expect(silhouette.area).toBe(0);
    expect(silhouette.centroidXPx).toBeNull();
    expect(silhouette.bounds).toBeNull();
  });

  it("names both rasters, and which is which, when two cannot be compared", () => {
    const small = silhouetteFromMask(new Uint8Array(4), 2, 2);
    const large = silhouetteFromMask(new Uint8Array(9), 3, 3);

    expect(() => overlap(small, large)).toThrowError(/left is 2x2, right is 3x3/);
  });

  it("scores identical regions at 1 and disjoint regions at 0", () => {
    const left = new Uint8Array(9);
    left[0] = 1;
    const right = new Uint8Array(9);
    right[8] = 1;

    expect(
      overlap(silhouetteFromMask(left, 3, 3), silhouetteFromMask(left.slice(), 3, 3)).iou,
    ).toBe(1);
    expect(overlap(silhouetteFromMask(left, 3, 3), silhouetteFromMask(right, 3, 3)).iou).toBe(0);
  });
});
