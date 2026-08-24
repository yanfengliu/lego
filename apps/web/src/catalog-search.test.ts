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

  it("keeps the admitted 25269 quarter-round tile discoverable by identifier, shape, and size", () => {
    const quarterRound = part("builtin:tile-1x1-quarter-round");
    expect(matchesPartQuery(quarterRound, "25269")).toBe(true);
    expect(matchesPartQuery(quarterRound, "quarter-round")).toBe(true);
    expect(matchesPartQuery(quarterRound, "1x1")).toBe(true);
  });

  it("keeps 28802 discoverable by identifier, family, both named faces, and shape", () => {
    const bracket = part("builtin:bracket-1x2-1x4-rounded-bottom");
    for (const query of ["28802", "bracket", "1x2", "1x4", "rounded bottom"]) {
      expect(matchesPartQuery(bracket, query), query).toBe(true);
    }
  });

  it("keeps 35787 discoverable by identifier, triangular shape, and 2x2 size", () => {
    const triangular = part("builtin:tile-2x2-triangular");
    for (const query of ["35787", "triangular", "2x2"]) {
      expect(matchesPartQuery(triangular, query), query).toBe(true);
    }
  });

  it("keeps 11253 discoverable as minifig footwear rather than a plate", () => {
    const rollerSkate = part("builtin:roller-skate");
    for (const query of ["11253", "roller", "skate", "minifig", "accessory", "1x1"]) {
      expect(matchesPartQuery(rollerSkate, query), query).toBe(true);
    }
    expect(matchesPartQuery(rollerSkate, "plate")).toBe(false);
  });

  it("keeps 15254 discoverable by identifier, arch shape, thin top, and 1x6 size", () => {
    const arch = part("builtin:arch-1x6-thin-top");
    for (const query of ["15254", "arch", "thin top", "1x6", "6x1"]) {
      expect(matchesPartQuery(arch, query), query).toBe(true);
    }
  });

  it("keeps 41682 discoverable by identifier, bracket shape, vertical studs, and 2x2 size", () => {
    const bracket = part("builtin:bracket-2x2-1x2-vertical-studs");
    for (const query of ["41682", "bracket", "vertical studs", "2x2"]) {
      expect(matchesPartQuery(bracket, query), query).toBe(true);
    }
  });

  it("keeps 2877 discoverable by identifier, grille brick shape, and 1x2 size", () => {
    const grilleBrick = part("builtin:brick-1x2-grille");
    for (const query of ["2877", "grille", "brick", "1x2", "2x1"]) {
      expect(matchesPartQuery(grilleBrick, query), query).toBe(true);
    }
  });

  it("keeps 3040 discoverable by identifier, straight-slope family, angle, and size", () => {
    const slope = part("builtin:slope-1x2-45");
    for (const query of ["3040", "slope", "45", "1x2", "2x1"]) {
      expect(matchesPartQuery(slope, query), query).toBe(true);
    }
  });

  it("keeps 4519 discoverable by identifier, axle family, and 1x3 size", () => {
    const axle = part("builtin:axle-1x3");
    for (const query of ["4519", "axle", "technic", "1x3", "3x1"]) {
      expect(matchesPartQuery(axle, query), query).toBe(true);
    }
  });

  it("keeps 32064 discoverable by identifier, Technic family, axle hole, and 1x2 size", () => {
    const axleHoleBrick = part("builtin:technic-brick-1x2-axle-hole");
    for (const query of ["32064", "technic", "axle hole", "1x2", "2x1"]) {
      expect(matchesPartQuery(axleHoleBrick, query), query).toBe(true);
    }
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

  it("filters the singleton minifig-accessory family", () => {
    expect(searchParts({ query: "", family: "minifig-accessory" }).map(({ id }) => id)).toEqual([
      "builtin:roller-skate",
    ]);
  });

  it("filters the singleton straight-slope family", () => {
    expect(searchParts({ query: "", family: "slope" }).map(({ id }) => id)).toEqual([
      "builtin:slope-1x2-45",
    ]);
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
