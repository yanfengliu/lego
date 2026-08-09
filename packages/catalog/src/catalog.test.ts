import { describe, expect, it } from "vitest";

import {
  BRICK_HEIGHT_LDU,
  BUILTIN_CATALOG_VERSION,
  getColorDefinition,
  getPartDefinition,
  PART_DEFINITIONS,
  type PartFamily,
  PLATE_HEIGHT_LDU,
  resolvePartId,
  STUD_HEIGHT_LDU,
  STUD_PITCH_LDU,
} from "./index.js";

/** Every family the catalog defines; a new one must be added here deliberately. */
const PART_FAMILY_NAMES = [
  "brick",
  "plate",
  "tile",
  "jumper-plate",
  "grille-tile",
  "wedge-plate",
  "technic-brick",
  "axle",
  "wheel",
  "arch",
  "curved-slope",
  "cheese-slope",
  "corner-plate",
] as const satisfies readonly PartFamily[];

/** A height its family does not fix, so the part declares its own. */
const DECLARED_HEIGHTS: Readonly<Record<string, number>> = { "builtin:curved-slope-1x2": 16 };

const SMOOTH_TOP_FAMILIES = new Set<string>([
  "tile",
  "grille-tile",
  "axle",
  "wheel",
  "curved-slope",
  "cheese-slope",
]);

const EXPECTED_PART_IDS = [
  "builtin:brick-1x1",
  "builtin:brick-1x2",
  "builtin:brick-1x3",
  "builtin:brick-1x4",
  "builtin:brick-2x2",
  "builtin:brick-2x3",
  "builtin:brick-2x4",
  "builtin:plate-1x1",
  "builtin:plate-1x2",
  "builtin:plate-1x3",
  "builtin:plate-1x4",
  "builtin:plate-2x2",
  "builtin:plate-2x3",
  "builtin:plate-2x4",
  "builtin:brick-1x6",
  "builtin:brick-1x8",
  "builtin:brick-2x6",
  "builtin:brick-2x8",
  "builtin:plate-1x6",
  "builtin:plate-1x8",
  "builtin:plate-2x6",
  "builtin:plate-2x8",
  "builtin:plate-4x4",
  "builtin:plate-4x6",
  "builtin:plate-4x8",
  "builtin:plate-6x6",
  "builtin:tile-1x1",
  "builtin:tile-1x2",
  "builtin:tile-1x4",
  "builtin:tile-1x6",
  "builtin:tile-2x2",
  "builtin:tile-2x4",
  "builtin:plate-1x10",
  "builtin:plate-1x12",
  "builtin:plate-2x10",
  "builtin:plate-2x12",
  "builtin:plate-4x10",
  "builtin:plate-4x12",
  "builtin:plate-6x8",
  "builtin:plate-6x10",
  "builtin:plate-6x12",
  "builtin:plate-6x16",
  "builtin:plate-8x8",
  "builtin:plate-8x16",
  "builtin:brick-1x10",
  "builtin:brick-1x12",
  "builtin:brick-1x16",
  "builtin:brick-2x10",
  "builtin:tile-1x3",
  "builtin:tile-1x8",
  "builtin:tile-2x6",
  "builtin:grille-tile-1x2",
  "builtin:jumper-plate-1x2",
  "builtin:jumper-plate-2x2",
  "builtin:jumper-plate-1x3",
  "builtin:wedge-plate-2x4-left",
  "builtin:wedge-plate-2x4-right",
  "builtin:wedge-plate-2x3-left",
  "builtin:wedge-plate-2x3-right",
  "builtin:technic-brick-1x2",
  "builtin:axle-1x2",
  "builtin:axle-1x4",
  "builtin:wheel-1x2",
  "builtin:arch-1x4",
  "builtin:arch-1x6",
  "builtin:curved-slope-1x2",
  "builtin:curved-slope-1x3",
  "builtin:curved-slope-1x4",
  "builtin:cheese-slope-1x1",
  "builtin:cheese-slope-2x1",
  "builtin:corner-plate-2x2",
  "builtin:plate-2x14",
  "builtin:wedge-plate-4x4-cut-corner",
  "builtin:wedge-plate-6x6-cut-corner",
  "builtin:wedge-plate-3x6-right",
  "builtin:corner-plate-4x4-round",
  "builtin:corner-plate-5x5-quarter-ring",
  // builtin.basic-parts/7: the first parts declared from measured source, in
  // admission order. Appended rather than interleaved, so no part already in
  // the catalog moves.
  "builtin:tile-1x2-cut-right-45",
  "builtin:plate-1x2-round-end",
  "builtin:wedge-plate-2x4-wing",
  "builtin:corner-plate-3x3",
  "builtin:curved-slope-1x4-double",
  // builtin.basic-parts/8: the designs LEGO Builder has no record of at all, so
  // their clutch cells come from the LDCad shadow library instead. Appended for
  // the same reason.
  "builtin:plate-3x3-corner-round",
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
] as const;

describe("starter catalog", () => {
  it("publishes the mesh route's measured geometry modes as version 11", () => {
    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/11");
  });

  it("does not expose inherited object properties as catalog entries", () => {
    expect(resolvePartId("constructor")).toBeUndefined();
    expect(resolvePartId("toString")).toBeUndefined();
    expect(getPartDefinition("constructor")).toBeUndefined();
    expect(getColorDefinition("constructor")).toBeUndefined();
  });

  it("contains exactly the approved parts, every family accounted for", () => {
    expect(PART_DEFINITIONS.map(({ id }) => id)).toEqual(EXPECTED_PART_IDS);
    expect(new Set(PART_DEFINITIONS.map(({ id }) => id))).toHaveLength(EXPECTED_PART_IDS.length);
    const perFamily = Object.fromEntries(
      PART_FAMILY_NAMES.map((family) => [
        family,
        PART_DEFINITIONS.filter((part) => part.family === family).length,
      ]),
    );
    expect(perFamily).toEqual({
      brick: 15,
      plate: 30,
      tile: 10,
      "jumper-plate": 3,
      "grille-tile": 1,
      "wedge-plate": 9,
      "technic-brick": 1,
      axle: 2,
      wheel: 1,
      arch: 2,
      "curved-slope": 4,
      "cheese-slope": 2,
      "corner-plate": 5,
    });
    // Every part belongs to a family the palette knows how to show.
    expect(
      PART_DEFINITIONS.filter(({ family }) => !PART_FAMILY_NAMES.includes(family)),
    ).toHaveLength(0);
  });

  it("uses integer LDU dimensions and centered bounds", () => {
    // Parametric parts only. A part declared from measured source keeps its
    // source frame — 77844's corner runs -10 to 50 LDU — and states its extents
    // exactly; catalog-measured-parts.test.ts holds it to that contract instead.
    for (const part of PART_DEFINITIONS) {
      if (part.geometry.generatorId === "builtin:preloaded-mesh-reference/1") continue;
      const expectedHeight =
        DECLARED_HEIGHTS[part.id] ??
        (part.family === "brick" ||
        part.family === "technic-brick" ||
        part.family === "arch" ||
        part.family === "curved-slope"
          ? BRICK_HEIGHT_LDU
          : part.family === "cheese-slope"
            ? 16
            : part.family === "axle"
              ? 12
              : part.family === "wheel"
                ? 62
                : PLATE_HEIGHT_LDU);
      const { dimensions } = part;

      expect(dimensions.widthLdu).toBe(dimensions.widthStuds * STUD_PITCH_LDU);
      expect(dimensions.lengthLdu).toBe(dimensions.lengthStuds * STUD_PITCH_LDU);
      expect(dimensions.heightLdu).toBe(expectedHeight);
      expect(Object.values(dimensions).every(Number.isInteger)).toBe(true);
      // Bounds are centred on the part's own origin, so a quarter turn is a
      // rotation and never also a translation. A part whose solid the stud
      // footprint does not describe declares its own — a 2L axle really is 39
      // LDU long, half a unit of moulding clearance short of the 40 the lattice
      // gives it — but it must still be centred, and its size still integral in
      // halves so repeated rotation cannot drift.
      const declared = part.geometry.bodyBoundsLdu;
      const expectedBody = declared ?? {
        min: [-dimensions.widthLdu / 2, -expectedHeight / 2, -dimensions.lengthLdu / 2],
        max: [dimensions.widthLdu / 2, expectedHeight / 2, dimensions.lengthLdu / 2],
      };
      expect(part.bodyBoundsLdu).toEqual(expectedBody);
      for (const axis of [0, 1, 2]) {
        if (declared === undefined) {
          expect(part.bodyBoundsLdu.min[axis]).toBe(-part.bodyBoundsLdu.max[axis]!);
        }
        expect(Number.isInteger(part.bodyBoundsLdu.max[axis]! * 2)).toBe(true);
      }

      const studOverhang = SMOOTH_TOP_FAMILIES.has(part.family) ? 0 : STUD_HEIGHT_LDU;
      expect(part.boundsLdu).toEqual({
        min: [expectedBody.min[0], expectedBody.min[1]! - studOverhang, expectedBody.min[2]],
        max: expectedBody.max,
      });
    }
  });
});
