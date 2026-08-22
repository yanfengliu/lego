import { describe, expect, it } from "vitest";

import {
  axisAlignedStudIntersectsVerticalPrism,
  axisAlignedStudsIntersect,
  type AxisAlignedStudBounds,
} from "./axis-stud-collision.ts";

const body = {
  min: [-5, -5, -5],
  max: [5, 5, 5],
  sectionXZ: [
    [-5, -5],
    [5, -5],
    [5, 5],
    [-5, 5],
  ],
} as const;

function stud(
  axis: "x" | "y" | "z",
  center: readonly [number, number, number],
  radiusLdu = 6,
  heightLdu = 4,
): AxisAlignedStudBounds {
  const axisIndex = "xyz".indexOf(axis);
  const half = [radiusLdu, radiusLdu, radiusLdu];
  half[axisIndex] = heightLdu / 2;
  return {
    axis,
    center,
    radiusLdu,
    min: center.map((value, index) => value - half[index]!) as [number, number, number],
    max: center.map((value, index) => value + half[index]!) as [number, number, number],
  };
}

describe("axis-aligned stud collision predicates", () => {
  it.each([
    ["x", [-7, 0, 0], [-6.9, 0, 0]],
    ["z", [0, 0, -7], [0, 0, -6.9]],
  ] as const)(
    "treats an %s-axis stud's axial tangency as clear and overlap as collision",
    (axis, tangent, overlap) => {
      expect(axisAlignedStudIntersectsVerticalPrism(stud(axis, tangent), body)).toBe(false);
      expect(axisAlignedStudIntersectsVerticalPrism(stud(axis, overlap), body)).toBe(true);
    },
  );

  it.each(["x", "z"] as const)("uses exact radial tangency for an %s-axis stud", (axis) => {
    expect(axisAlignedStudIntersectsVerticalPrism(stud(axis, [0, 11, 0]), body)).toBe(false);
    expect(axisAlignedStudIntersectsVerticalPrism(stud(axis, [0, 10.9, 0]), body)).toBe(true);
  });

  it("handles parallel same-axis stud overlap, radial tangency, and axial tangency", () => {
    const origin = stud("z", [0, 0, 0]);
    expect(axisAlignedStudsIntersect(origin, stud("z", [11.9, 0, 1]))).toBe(true);
    expect(axisAlignedStudsIntersect(origin, stud("z", [12, 0, 1]))).toBe(false);
    expect(axisAlignedStudsIntersect(origin, stud("z", [0, 0, 4]))).toBe(false);
  });

  it("resolves perpendicular finite cylinders beyond their overlapping AABBs", () => {
    expect(axisAlignedStudsIntersect(stud("z", [0, 0, 0]), stud("x", [0, 0, 0]))).toBe(true);
    expect(axisAlignedStudsIntersect(stud("z", [0, 0, 0]), stud("x", [0, 12, 0]))).toBe(false);
    expect(axisAlignedStudsIntersect(stud("z", [0, 0, 0]), stud("y", [10, 7, 0]))).toBe(false);
    expect(axisAlignedStudsIntersect(stud("z", [0, 0, 0]), stud("y", [9, 7, 0]))).toBe(true);
  });
});
