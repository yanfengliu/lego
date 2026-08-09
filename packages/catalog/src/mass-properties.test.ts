import { describe, expect, it } from "vitest";

import {
  PART_DEFINITIONS,
  getPartDefinition,
  partMassGrams,
  partMassProperties,
  type ParametricPartDefinition,
} from "./index.js";

const require = (id: string): ParametricPartDefinition => {
  const part = getPartDefinition(id);
  if (!part) throw new Error(`test needs ${id} in the catalog`);
  if (part.geometry.generatorId === "builtin:preloaded-mesh-reference/1") {
    throw new Error(`test needs ${id} to retain its legacy parametric recipe`);
  }
  return part as ParametricPartDefinition;
};

describe("partMassProperties", () => {
  it("measures a plate as its shell plus its studs, with the cavity taken out", () => {
    // A plate is not a block. `3020.dat` builds it from two nested `box5`
    // solids, and this now models both: the outer body less the cavity that its
    // eight clutches need, which is what the mass has to reflect. A filled
    // 2 x 4 plate would weigh 25600 LDU cubed before its studs; the real one
    // weighs 9216 less, and that 9216 is the cavity to the LDU.
    const plate = require("builtin:plate-2x4");
    const { solidVolumeLdu3 } = partMassProperties(plate);
    const outerBody = 40 * 8 * 80;
    const cavity = 32 * 4 * 72;
    const studs = 8 * Math.PI * 6 ** 2 * 4;

    expect(outerBody - cavity).toBe(16_384);
    expect(solidVolumeLdu3).toBeCloseTo(outerBody - cavity + studs, 6);
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

  it("gives a wedge less material than the solid plate it is cut from", () => {
    // The yardstick is the filled prism, named here rather than read off
    // `plate-2x4`. That plate is now a shell and the wedge is still a filled
    // block, so their masses are two different modelling generations and
    // comparing them would measure the gap between those rather than the cut.
    // What is under test is unchanged: the sloped face removes material. When
    // the wedge becomes a shell too, this goes back to comparing the two parts.
    const wedge = partMassProperties(require("builtin:wedge-plate-2x4-left"));
    const plate = require("builtin:plate-2x4");
    const solidPlateBody =
      (plate.bodyBoundsLdu.max[0] - plate.bodyBoundsLdu.min[0]) *
      (plate.bodyBoundsLdu.max[1] - plate.bodyBoundsLdu.min[1]) *
      (plate.bodyBoundsLdu.max[2] - plate.bodyBoundsLdu.min[2]);

    expect(solidPlateBody).toBe(40 * 8 * 80);
    expect(wedge.solidVolumeLdu3).toBeLessThan(solidPlateBody);
  });

  it("measures conservative arc prisms exactly without counting their shared faces twice", () => {
    for (const id of ["builtin:corner-plate-4x4-round", "builtin:corner-plate-5x5-quarter-ring"]) {
      const part = require(id);
      const feature = part.geometry.bodyArc!;
      const height = part.bodyBoundsLdu.max[1] - part.bodyBoundsLdu.min[1];
      const delta =
        ((feature.endAngleDegrees - feature.startAngleDegrees) * Math.PI) /
        180 /
        feature.segmentCount;
      const tangentOuterRadius = feature.outerRadiusLdu / Math.cos(delta / 2);
      const conservativeSectorArea =
        feature.segmentCount *
        0.5 *
        (tangentOuterRadius ** 2 - feature.innerRadiusLdu ** 2) *
        Math.sin(delta);
      const capArea = (feature.capRectanglesLdu ?? []).reduce(
        (total, cap) =>
          total + (cap.maxXZLdu[0] - cap.minXZLdu[0]) * (cap.maxXZLdu[1] - cap.minXZLdu[1]),
        0,
      );
      const studCount = part.connectors.filter(({ kind }) => kind === "stud").length;
      const studVolume = studCount * Math.PI * 6 ** 2 * 4;
      const measuredBodyVolume = partMassProperties(part).solidVolumeLdu3 - studVolume;
      const expectedBodyVolume = (conservativeSectorArea + capArea) * height;
      const exactSectorArea =
        0.5 *
        (feature.outerRadiusLdu ** 2 - feature.innerRadiusLdu ** 2) *
        (((feature.endAngleDegrees - feature.startAngleDegrees) * Math.PI) / 180);
      const exactSourceVolume = (exactSectorArea + capArea) * height;

      expect(measuredBodyVolume).toBeCloseTo(expectedBodyVolume, 7);
      expect(measuredBodyVolume).toBeGreaterThan(exactSourceVolume);
      expect(measuredBodyVolume / exactSourceVolume).toBeLessThan(1.02);
    }
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
