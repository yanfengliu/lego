import { PART_DEFINITIONS, getPartDefinition, type PartDefinition } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import {
  PART_FAMILY_ORDER,
  countPartsByFamily,
  groupPartsByFamily,
  matchesPartQuery,
  normalizePartQuery,
  searchParts,
} from "./catalog-search";

function part(id: string): PartDefinition {
  const found = getPartDefinition(id);
  if (!found) throw new Error(`Test fixture references a part outside the catalog: ${id}`);
  return found;
}

describe("normalizePartQuery", () => {
  it("folds the ways a size gets typed onto one form", () => {
    for (const typed of ["2x4", "2 x 4", "2X4", "  2 X 4 "]) {
      expect(normalizePartQuery(typed)).toBe("2x4");
    }
  });
});

describe("matchesPartQuery", () => {
  const brick2x4 = part("builtin:brick-2x4");

  it("matches an empty query so the palette starts complete", () => {
    expect(matchesPartQuery(brick2x4, "")).toBe(true);
    expect(matchesPartQuery(brick2x4, "   ")).toBe(true);
  });

  it("finds a part by name, family, and size", () => {
    expect(matchesPartQuery(brick2x4, "brick")).toBe(true);
    expect(matchesPartQuery(brick2x4, "2x4")).toBe(true);
    expect(matchesPartQuery(brick2x4, "2 x 4")).toBe(true);
  });

  it("treats a size as symmetric, the way a builder reads it", () => {
    expect(matchesPartQuery(brick2x4, "4x2")).toBe(true);
  });

  it("finds a part by its LDraw identifier", () => {
    expect(matchesPartQuery(brick2x4, "3001")).toBe(true);
  });

  it("does not match an unrelated query", () => {
    expect(matchesPartQuery(brick2x4, "wheel")).toBe(false);
    expect(matchesPartQuery(brick2x4, "9x9")).toBe(false);
  });

  it("separates tiles from plates even though both are plate height", () => {
    expect(matchesPartQuery(part("builtin:tile-2x2"), "tile")).toBe(true);
    expect(matchesPartQuery(part("builtin:plate-2x2"), "tile")).toBe(false);
  });
});

describe("searchParts", () => {
  it("returns the whole catalog with no query or family filter", () => {
    expect(searchParts({ query: "", family: null })).toHaveLength(PART_DEFINITIONS.length);
  });

  it("restricts to one family", () => {
    const tiles = searchParts({ query: "", family: "tile" });
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every(({ family }) => family === "tile")).toBe(true);
  });

  it("combines a family filter with a size query", () => {
    const results = searchParts({ query: "2x4", family: "plate" });
    expect(results.map(({ id }) => id)).toEqual(["builtin:plate-2x4"]);
  });

  it("returns nothing rather than guessing when a query matches no part", () => {
    expect(searchParts({ query: "sprocket", family: null })).toEqual([]);
  });
});

describe("groupPartsByFamily", () => {
  it("keeps families in palette order and drops empty ones", () => {
    const groups = groupPartsByFamily(searchParts({ query: "", family: null }));
    expect(groups.map(({ family }) => family)).toEqual([...PART_FAMILY_ORDER]);

    const tileOnly = groupPartsByFamily(searchParts({ query: "", family: "tile" }));
    expect(tileOnly.map(({ family }) => family)).toEqual(["tile"]);
  });

  it("preserves catalog order inside a family", () => {
    const bricks = groupPartsByFamily(PART_DEFINITIONS)[0]!;
    const catalogOrder = PART_DEFINITIONS.filter(({ family }) => family === "brick").map(
      ({ id }) => id,
    );
    expect(bricks.parts.map(({ id }) => id)).toEqual(catalogOrder);
  });
});

describe("countPartsByFamily", () => {
  it("accounts for every part in the catalog exactly once", () => {
    const counts = countPartsByFamily();
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(PART_DEFINITIONS.length);
    expect(Object.keys(counts).sort()).toEqual([...PART_FAMILY_ORDER].sort());
  });
});
