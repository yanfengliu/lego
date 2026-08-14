import { describe, expect, it } from "vitest";

import {
  clampCalloutPixelBounds,
  discardEmptyLegacyComponent,
  insideCalloutPixelBounds,
  sampledCalloutBackground,
} from "./callout-browser-pixels";

describe("callout browser pixel helpers", () => {
  it("clamps inclusive bounds and tests membership", () => {
    const bounds = clampCalloutPixelBounds({ left: -1, top: 1, right: 5, bottom: 9 }, 4, 6);
    expect(bounds).toEqual({ left: 0, top: 1, right: 3, bottom: 5 });
    expect(insideCalloutPixelBounds(bounds, 3, 5)).toBe(true);
    expect(insideCalloutPixelBounds(bounds, 4, 5)).toBe(false);
  });

  it("selects the common sampled background bucket", () => {
    expect(
      sampledCalloutBackground({ left: 0, top: 0, right: 2, bottom: 2 }, (x, y) =>
        x === 2 && y === 2 ? [0, 0, 0] : [250, 250, 250],
      ),
    ).toEqual([252, 252, 252]);
  });

  it("drops a text-only legacy candidate without weakening ranked publication evidence", () => {
    expect(discardEmptyLegacyComponent("legacy-seed", 0)).toBe(true);
    expect(discardEmptyLegacyComponent("ranked-component", 0)).toBe(false);
    expect(discardEmptyLegacyComponent("legacy-seed", 1)).toBe(false);
  });
});
