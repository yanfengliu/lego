import { BRICK_HEIGHT_LDU, PLATE_HEIGHT_LDU } from "@lego-studio/catalog";
import { createPartInstance } from "@lego-studio/brick-kernel";
import { THREE_UNITS_PER_LDU, lduToThreeVector } from "@lego-studio/rendering";
import { describe, expect, it } from "vitest";

import { GROUND_UNDERSIDE_LDU } from "../placement";
import { GROUND_PLANE_THREE_Y, resolveDropSupport, threePointToLdu } from "./drop-target";

const brick = createPartInstance({
  id: "brick",
  catalogPartId: "builtin:brick-2x2",
  transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
});
const plate = createPartInstance({
  id: "plate",
  catalogPartId: "builtin:plate-2x2",
  transform: { positionLdu: [40, 8, 0], orientationId: "upright-yaw-0" },
});

describe("threePointToLdu", () => {
  it("inverts the renderer's LDU to scene conversion", () => {
    for (const source of [
      [0, 0, 0],
      [20, -24, -60],
      [-140, 96, 40],
    ] as const) {
      const roundTripped = threePointToLdu(lduToThreeVector([...source]));
      expect(roundTripped[0]).toBeCloseTo(source[0], 9);
      expect(roundTripped[1]).toBeCloseTo(source[1], 9);
      expect(roundTripped[2]).toBeCloseTo(source[2], 9);
    }
  });

  it("flips the vertical axis, because the document is -Y up", () => {
    expect(threePointToLdu({ x: 0, y: 1, z: 0 })[1]).toBe(-1 / THREE_UNITS_PER_LDU);
  });
});

describe("resolveDropSupport", () => {
  it("falls through to the build plate when the ray hits nothing", () => {
    expect(resolveDropSupport(null, [brick])).toEqual({
      supportUndersideLdu: GROUND_UNDERSIDE_LDU,
      supportPartId: null,
    });
  });

  it("seats a drop on the top surface of the part it landed on", () => {
    expect(resolveDropSupport("brick", [brick, plate])).toEqual({
      supportUndersideLdu: -BRICK_HEIGHT_LDU / 2,
      supportPartId: "brick",
    });
  });

  it("uses each part's own height, not a fixed step", () => {
    expect(resolveDropSupport("plate", [brick, plate])).toEqual({
      supportUndersideLdu: 8 - PLATE_HEIGHT_LDU / 2,
      supportPartId: "plate",
    });
  });

  it("falls back to the plate when the hit part is not in the document", () => {
    expect(resolveDropSupport("ghost-part", [brick])).toEqual({
      supportUndersideLdu: GROUND_UNDERSIDE_LDU,
      supportPartId: null,
    });
  });

  it("puts the plate plane below the document origin in scene units", () => {
    expect(GROUND_PLANE_THREE_Y).toBeLessThan(0);
    expect(GROUND_PLANE_THREE_Y).toBe(-GROUND_UNDERSIDE_LDU * THREE_UNITS_PER_LDU);
  });
});
