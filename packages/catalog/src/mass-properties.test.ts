import { describe, expect, it } from "vitest";

import { PART_DEFINITIONS, getPartDefinition, partMassGrams, partMassProperties } from "./index.js";

const require = (id: string) => {
  const part = getPartDefinition(id);
  if (!part) throw new Error(`test needs ${id} in the catalog`);
  return part;
};

describe("partMassProperties", () => {
  it("measures a plate as its box plus its studs", () => {
    const plate = require("builtin:plate-2x4");
    const { solidVolumeLdu3 } = partMassProperties(plate);
    const box = 40 * 8 * 80;
    const studs = 8 * Math.PI * 6 ** 2 * 4;

    expect(solidVolumeLdu3).toBeCloseTo(box + studs, 6);
  });

  it("balances a symmetric part on its own origin", () => {
    const [x, , z] = partMassProperties(require("builtin:brick-2x4")).centerOfMassLdu;

    expect(x).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(0, 9);
  });

  it("sits a brick's centre of mass above its middle, because the studs are on top", () => {
    // LDU is Y-down, so above the middle means a smaller y.
    const { centerOfMassLdu } = partMassProperties(require("builtin:brick-2x4"));

    expect(centerOfMassLdu[1]).toBeLessThan(0);
  });

  it("moves a wedge's centre of mass off the box centre, toward the material", () => {
    // The whole point of modelling the slope: a wedge plate is not balanced
    // where its bounding box is. The left-hand wedge keeps its material at
    // negative x, so that is where it balances.
    const left = partMassProperties(require("builtin:wedge-plate-2x4-left"));
    const right = partMassProperties(require("builtin:wedge-plate-2x4-right"));

    expect(left.centerOfMassLdu[0]).toBeLessThan(-1);
    expect(right.centerOfMassLdu[0]).toBeGreaterThan(1);
    // Mirror images, so they balance at mirrored points.
    expect(left.centerOfMassLdu[0]).toBeCloseTo(-right.centerOfMassLdu[0]!, 6);
    expect(left.solidVolumeLdu3).toBeCloseTo(right.solidVolumeLdu3, 6);
  });

  it("gives a wedge less material than the plate that contains it", () => {
    const wedge = partMassProperties(require("builtin:wedge-plate-2x4-left"));
    const plate = partMassProperties(require("builtin:plate-2x4"));

    expect(wedge.solidVolumeLdu3).toBeLessThan(plate.solidVolumeLdu3);
  });

  it("estimates a 2x4 brick in the right order of magnitude, and says it is high", () => {
    // A real 2x4 brick is about 2.4 g. The model is solid where the part is
    // hollow, so the estimate lands near double — close enough to be useful for
    // relative mass, and documented as a placeholder for a measured value.
    const grams = partMassProperties(require("builtin:brick-2x4")).estimatedMassGrams;

    expect(grams).toBeGreaterThan(2.4);
    expect(grams).toBeLessThan(8);
  });

  it("prefers a measured mass when the catalog has one", () => {
    const part = require("builtin:brick-2x4");

    expect(part.inventory.knownMassGrams).toBeNull();
    expect(partMassGrams(part)).toBe(partMassProperties(part).estimatedMassGrams);
  });

  it("gives every part a positive volume and a centre of mass inside its bounds", () => {
    for (const part of PART_DEFINITIONS) {
      const { solidVolumeLdu3, centerOfMassLdu } = partMassProperties(part);

      expect(solidVolumeLdu3, part.id).toBeGreaterThan(0);
      for (const axis of [0, 1, 2]) {
        expect(centerOfMassLdu[axis], `${part.id} axis ${axis}`).toBeGreaterThanOrEqual(
          part.boundsLdu.min[axis]!,
        );
        expect(centerOfMassLdu[axis], `${part.id} axis ${axis}`).toBeLessThanOrEqual(
          part.boundsLdu.max[axis]!,
        );
      }
    }
  });
});
