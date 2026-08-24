import { describe, expect, it } from "vitest";

import {
  canonicalizeOpaqueGroundRgba,
  measureExactBottomBackgroundRecut,
} from "./part-identification-source-art-canonical.mjs";

const BACKGROUND = [140, 148, 148, 255];

function raster(width, height, pixels = []) {
  const data = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) data.set(BACKGROUND, pixel * 4);
  for (const { x, y, rgba } of pixels) data.set(rgba, (y * width + x) * 4);
  return { width, height, data };
}

describe("opaque-ground source-art canonicalization", () => {
  it("is invariant to exact background margins", () => {
    const narrow = canonicalizeOpaqueGroundRgba(
      raster(4, 4, [
        { x: 1, y: 1, rgba: [10, 20, 30, 255] },
        { x: 2, y: 1, rgba: [40, 50, 60, 255] },
      ]),
    );
    const wide = canonicalizeOpaqueGroundRgba(
      raster(7, 6, [
        { x: 2, y: 3, rgba: [10, 20, 30, 255] },
        { x: 3, y: 3, rgba: [40, 50, 60, 255] },
      ]),
    );
    expect(narrow.boundsHalfOpen).toEqual({ left: 1, top: 1, right: 3, bottom: 2 });
    expect(wide.boundsHalfOpen).toEqual({ left: 2, top: 3, right: 4, bottom: 4 });
    expect(narrow.canonicalRgba).toEqual(wide.canonicalRgba);
    expect(narrow.framedSha256).toBe(wide.framedSha256);
  });

  it("distinguishes same-size and same-count changed pixels", () => {
    const first = canonicalizeOpaqueGroundRgba(
      raster(4, 4, [{ x: 1, y: 1, rgba: [10, 20, 30, 255] }]),
    );
    const changed = canonicalizeOpaqueGroundRgba(
      raster(4, 4, [{ x: 1, y: 1, rgba: [10, 20, 31, 255] }]),
    );
    expect(changed.canonicalRgba.byteLength).toBe(first.canonicalRgba.byteLength);
    expect(changed.framedSha256).not.toBe(first.framedSha256);
  });

  it("refuses corner disagreement, transparency, all-ground, and malformed rasters", () => {
    expect(() =>
      canonicalizeOpaqueGroundRgba(
        raster(3, 3, [{ x: 2, y: 2, rgba: [10, 20, 30, 255] }]),
        "corner",
      ),
    ).toThrow(/all four corners/);
    expect(() =>
      canonicalizeOpaqueGroundRgba(
        raster(3, 3, [{ x: 1, y: 1, rgba: [10, 20, 30, 254] }]),
        "alpha",
      ),
    ).toThrow(/not exactly opaque/);
    expect(() => canonicalizeOpaqueGroundRgba(raster(3, 3), "blank")).toThrow(
      /only its exact corner background/,
    );
    expect(() =>
      canonicalizeOpaqueGroundRgba({ width: 3, height: 3, data: new Uint8Array(4) }, "short"),
    ).toThrow(/bounded positive RGBA8 raster/);
  });

  it("proves only an exact decoded prefix plus complete background bottom rows", () => {
    const legacy = raster(3, 4, [{ x: 1, y: 1, rgba: [10, 20, 30, 255] }]);
    const current = {
      width: 3,
      height: 3,
      data: legacy.data.slice(0, 3 * 3 * 4),
    };
    expect(measureExactBottomBackgroundRecut(legacy, current)).toMatchObject({
      backgroundRgba: BACKGROUND,
      currentPrefixBytes: 36,
      removedBytes: 12,
      removedRows: 1,
    });

    const changedPrefix = { ...current, data: current.data.slice() };
    changedPrefix.data[(1 * 3 + 1) * 4] = 11;
    expect(() => measureExactBottomBackgroundRecut(legacy, changedPrefix)).toThrow(
      /not an exact prefix/,
    );

    const changedSuffix = { ...legacy, data: legacy.data.slice() };
    changedSuffix.data[(3 * 3 + 1) * 4] = 10;
    expect(() => measureExactBottomBackgroundRecut(changedSuffix, current)).toThrow(
      /removed suffix contains a non-background pixel/,
    );
  });
});
