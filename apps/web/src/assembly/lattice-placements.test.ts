import { describe, expect, it } from "vitest";

import { PANEL_DELTA_SCHEMA_VERSION, type StepPanelDelta } from "./exploded-score";
import {
  latticeTranslations,
  LatticePlacementError,
  rankAgainstReference,
  scoreLatticeTranslations,
} from "./lattice-placements";

const A = { xPx: 24, yPx: 19 };
const B = { xPx: -34, yPx: 14 };
const UP = { xPx: 0, yPx: -13 };

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

function shifted(mask: Uint8Array, width: number, height: number, dx: number, dy: number) {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const target = y + dy;
    if (target < 0 || target >= height) continue;
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      const to = x + dx;
      if (to < 0 || to >= width) continue;
      out[target * width + to] = 1;
    }
  }
  return out;
}

describe("latticeTranslations", () => {
  it("returns one entry per distinct pixel offset and counts the aliases", () => {
    const offsets = latticeTranslations({ a: A, b: B, up: UP, studRange: 3, plateRange: 3 });
    const keys = new Set(offsets.map((entry) => `${entry.dxPx},${entry.dyPx}`));
    expect(keys.size).toBe(offsets.length);
    expect(offsets.some((entry) => entry.dxPx === 0 && entry.dyPx === 0)).toBe(true);
    // The projection of a three-dimensional lattice into two dimensions is
    // many-to-one in the continuum, and the dedupe is here for that. On this
    // booklet's own basis it removes nothing: all 343 world triples in range
    // round to distinct pixels, and the two closest sit 8px apart — a fifth of
    // a stud, but nowhere near a collision. So the candidate set really is
    // hundreds of separable places, and a rank over it means what it says.
    // The bound is tight on purpose: it is the one number the comment is about.
    expect(offsets.length).toBe(7 ** 3);
    let closest = Number.POSITIVE_INFINITY;
    for (let left = 0; left < offsets.length; left += 1) {
      for (let right = left + 1; right < offsets.length; right += 1) {
        const gap = Math.hypot(
          offsets[left]!.dxPx - offsets[right]!.dxPx,
          offsets[left]!.dyPx - offsets[right]!.dyPx,
        );
        if (gap < closest) closest = gap;
      }
    }
    expect(closest).toBeCloseTo(8.06, 1);
  });

  it("refuses a range in pixels rather than grid steps", () => {
    expect(() =>
      latticeTranslations({ a: A, b: B, up: UP, studRange: 200, plateRange: 1 }),
    ).toThrow(/studRange must be a whole number of grid steps between 0 and 64, received 200/);
  });
});

describe("scoreLatticeTranslations", () => {
  const width = 200;
  const height = 160;
  const silhouette = boxMask(width, height, [{ x: 60, y: 40, w: 30, h: 16 }]);
  const built = boxMask(width, height, [{ x: 40, y: 90, w: 90, h: 30 }]);
  const trueDx = A.xPx + B.xPx;
  const trueDy = A.yPx + B.yPx + 2 * -UP.yPx;

  function deltaFor(dx: number, dy: number): StepPanelDelta {
    const landed = shifted(silhouette, width, height, dx, dy);
    const emerged = new Uint8Array(width * height);
    for (let pixel = 0; pixel < landed.length; pixel += 1) {
      if (landed[pixel] === 1 && built[pixel] !== 1) emerged[pixel] = 1;
    }
    let emergedPx = 0;
    for (const value of emerged) emergedPx += value;
    return {
      schemaVersion: PANEL_DELTA_SCHEMA_VERSION,
      width,
      height,
      emergedMask: emerged,
      changedMask: landed,
      evidenceMask: new Uint8Array(width * height).fill(1),
      emergedPx,
      changedPx: landed.reduce<number>((sum, value) => sum + value, 0),
      emergedBounds: null,
      changedBounds: null,
    };
  }

  it("ranks the offset the delta was built from first", () => {
    const delta = deltaFor(trueDx, trueDy);
    const sweep = scoreLatticeTranslations(
      { width, height, mask: silhouette },
      built,
      latticeTranslations({ a: A, b: B, up: UP, studRange: 3, plateRange: 3 }),
      delta,
    );
    expect(sweep.scored.length).toBeGreaterThan(5);
    const ranking = rankAgainstReference(sweep, { xPx: trueDx, yPx: trueDy }, 30);
    expect(ranking).not.toBeNull();
    expect(ranking!.referenceRank).toBe(0);
    expect(ranking!.margin).toBeGreaterThan(0);
    expect(ranking!.bestToReferencePx).toBe(0);
    expect(ranking!.referenceSnapPx).toBe(0);
  });

  it("says how far a reference off the lattice had to be snapped", () => {
    // Nothing bounds the snap, so a reference nowhere near a candidate comes
    // back as a confident rank over a placement nobody proposed. The distance
    // is what lets a caller refuse it.
    const delta = deltaFor(trueDx, trueDy);
    const sweep = scoreLatticeTranslations(
      { width, height, mask: silhouette },
      built,
      latticeTranslations({ a: A, b: B, up: UP, studRange: 3, plateRange: 3 }),
      delta,
    );
    const ranking = rankAgainstReference(sweep, { xPx: 9999, yPx: -9999 }, 30);
    expect(ranking!.referenceSnapPx).toBeGreaterThan(1000);
  });

  it("drops candidates nothing would hold up and says how many", () => {
    const delta = deltaFor(trueDx, trueDy);
    const sweep = scoreLatticeTranslations(
      { width, height, mask: silhouette },
      built,
      latticeTranslations({ a: A, b: B, up: UP, studRange: 4, plateRange: 4 }),
      delta,
      { builtContactMarginPx: 2 },
    );
    expect(sweep.rejectedUnsupported).toBeGreaterThan(0);
    expect(sweep.scored.length).toBeLessThan(sweep.offered);
  });

  it("names the mismatch when the delta is not the silhouette's raster", () => {
    const delta = deltaFor(trueDx, trueDy);
    expect(() =>
      scoreLatticeTranslations(
        { width: 100, height: 80, mask: new Uint8Array(8000) },
        new Uint8Array(8000),
        [],
        delta,
      ),
    ).toThrow(/delta is 200x160 and the silhouette raster is 100x80/);
  });

  it("refuses an empty silhouette with the reason a highlight can be empty", () => {
    const delta = deltaFor(trueDx, trueDy);
    expect(() =>
      scoreLatticeTranslations(
        { width, height, mask: new Uint8Array(width * height) },
        built,
        [],
        delta,
      ),
    ).toThrow(/yellow highlight never closed/);
  });

  it("refuses to score more candidates than it was allowed", () => {
    const delta = deltaFor(trueDx, trueDy);
    expect(() =>
      scoreLatticeTranslations(
        { width, height, mask: silhouette },
        built,
        latticeTranslations({ a: A, b: B, up: UP, studRange: 8, plateRange: 8 }),
        delta,
        { maximumCandidates: 10 },
      ),
    ).toThrow(/is over the 10 this sweep will score/);
    expect(new LatticePlacementError("x").name).toBe("LatticePlacementError");
  });
});

describe("rankAgainstReference", () => {
  it("needs a pixels-per-stud to report a distance in studs", () => {
    expect(() =>
      rankAgainstReference(
        {
          schemaVersion: "lego.lattice-placement/1",
          scored: [
            {
              translation: { dxPx: 0, dyPx: 0, studsA: 0, studsB: 0, plates: 0, aliases: 1 },
              score: {
                schemaVersion: "lego.exploded-step-score/1",
                emergenceIou: 1,
                changeIou: 1,
                score: 1,
                basis: "emergence-and-change",
                predictedNewlyVisiblePx: 1,
                predictedChangedPx: 1,
              },
              onFramePx: 1,
              touchingBuiltPx: 1,
            },
          ],
          offered: 1,
          rejectedOffFrame: 0,
          rejectedUnsupported: 0,
        },
        { xPx: 0, yPx: 0 },
        0,
      ),
    ).toThrow(/needs a positive pixelsPerStud/);
  });
});
