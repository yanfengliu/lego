import { describe, expect, it } from "vitest";

import { boundedReplayRaster } from "./callout-source-replay-bounds";

const STEP_18_BOX = {
  minXPt: 14.672900199890137,
  minYPt: 482.3388671875,
  maxXPt: 166.74398803710938,
  maxYPt: 529.578857421875,
};

describe("independent source replay raster bounds", () => {
  it("derives the exact bounded step-18 source and guarded clip", () => {
    expect(boundedReplayRaster(6_122.832, 4_354.016, 8, STEP_18_BOX)).toMatchObject({
      pageWidthPx: 6_123,
      pageHeightPx: 4_355,
      sourceBoxPx: { left: 117, top: 117, right: 1_334, bottom: 495 },
      sourceBoxPixels: 461_622,
      clipRenderBoxPx: { left: 0, top: 0, right: 1_462, bottom: 623 },
      clipRenderPixels: 912_912,
    });
  });

  it("rejects an off-page source box before canvas dimensions are assigned", () => {
    expect(() =>
      boundedReplayRaster(6_122.832, 4_354.016, 8, {
        ...STEP_18_BOX,
        minXPt: 1_000,
        maxXPt: 1_100,
      }),
    ).toThrow(/expected an in-page box/u);
  });

  it("rejects inverted source coordinates before negative clip dimensions can reach canvas", () => {
    expect(() =>
      boundedReplayRaster(6_122.832, 4_354.016, 8, {
        ...STEP_18_BOX,
        minXPt: 100,
        maxXPt: 50,
      }),
    ).toThrow(/expected an in-page box/u);
  });

  it("rejects an over-limit page before any source or clip allocation", () => {
    expect(() => boundedReplayRaster(8_000, 8_000, 8, STEP_18_BOX)).toThrow(
      /total area in 1\.\.32000000 before canvas allocation/u,
    );
  });

  it("rejects an over-limit raster axis even when total pixels fit", () => {
    expect(() =>
      boundedReplayRaster(16_385, 1_000, 8, {
        minXPt: 1,
        minYPt: 1,
        maxXPt: 2,
        maxYPt: 2,
      }),
    ).toThrow(/each axis in 1\.\.16384/u);
  });
});
