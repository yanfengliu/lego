import { describe, expect, it } from "vitest";

import {
  CATALOG_COLOR_TOLERANCE,
  matchCatalogColor,
  parseHexColor,
  scoreColorCoverage,
} from "./catalog-color-match";

describe("parseHexColor", () => {
  it("reads a six-digit hex and rejects anything else", () => {
    expect(parseHexColor("#C91A09")).toEqual([201, 26, 9]);
    expect(parseHexColor(" #ffffff ")).toEqual([255, 255, 255]);
    expect(parseHexColor("#fff")).toBeNull();
    expect(parseHexColor("red")).toBeNull();
  });
});

describe("matchCatalogColor", () => {
  it("returns an exact catalog colour at zero distance", () => {
    expect(matchCatalogColor("#c91a09")).toMatchObject({ colorId: "builtin:red", distance: 0 });
  });

  it("finds the nearest colour for a shaded variant", () => {
    // Instruction art shades each brick, so a fill is rarely the exact swatch.
    const shaded = matchCatalogColor("#d02b18");
    expect(shaded?.colorId).toBe("builtin:red");
    expect(shaded!.distance).toBeGreaterThan(0);
    expect(shaded!.distance).toBeLessThan(CATALOG_COLOR_TOLERANCE);
  });

  it("still names a nearest colour for a fill far from the palette", () => {
    const match = matchCatalogColor("#7f00ff");
    expect(match).not.toBeNull();
    expect(match!.distance).toBeGreaterThan(CATALOG_COLOR_TOLERANCE);
  });

  it("returns nothing for an unreadable fill", () => {
    expect(matchCatalogColor("nonsense")).toBeNull();
  });
});

describe("scoreColorCoverage", () => {
  it("counts distinct fills, not occurrences", () => {
    const coverage = scoreColorCoverage(["#c91a09", "#c91a09", "#ffffff"]);

    expect(coverage.distinctFills).toBe(2);
    expect(coverage.matched).toBe(2);
    expect(coverage.matchedFraction).toBe(1);
  });

  it("reports the fills the catalog cannot account for, furthest first", () => {
    const coverage = scoreColorCoverage(["#c91a09", "#7f00ff", "#00ff88"]);

    expect(coverage.matched).toBe(1);
    expect(coverage.matchedFraction).toBeCloseTo(1 / 3);
    expect(coverage.unmatched).toHaveLength(2);
    const distances = coverage.unmatched.map(({ nearest }) => nearest!.distance);
    expect(distances[0]).toBeGreaterThanOrEqual(distances[1]!);
  });

  it("scores an empty page as no coverage rather than dividing by zero", () => {
    expect(scoreColorCoverage([])).toMatchObject({ distinctFills: 0, matchedFraction: 0 });
  });
});
