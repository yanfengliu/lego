import { describe, expect, it } from "vitest";

import { singletonContainedComponentGroups } from "./callout-source-replay-coalescing";

const ANCHORS = [
  { key: "left", rasterX: 369, labelTop: 1_200, maximumHorizontalGap: 64 },
  { key: "right", rasterX: 849, labelTop: 1_200, maximumHorizontalGap: 64 },
] as const;

describe("independent source replay containment", () => {
  it("unions only the left singleton-owned inner detail", () => {
    expect(
      singletonContainedComponentGroups(ANCHORS, [
        { left: 369, top: 981, right: 622, bottom: 1_211, size: 31_481 },
        { left: 849, top: 1_054, right: 1_081, bottom: 1_211, size: 21_135 },
        { left: 369, top: 1_091, right: 486, bottom: 1_189, size: 1_167 },
      ]),
    ).toEqual([[0, 2], [1]]);
  });

  it("does not let coalescing conceal the 65th raw component", () => {
    expect(() =>
      singletonContainedComponentGroups(
        ANCHORS,
        Array.from({ length: 65 }, (_, index) => ({
          left: index,
          top: index,
          right: 1_000 - index,
          bottom: 1_000 - index,
          size: 1_000 - index,
        })),
      ),
    ).toThrow(/65 raw components before coalescing.*maximum is 64.*may not hide/u);
  });

  it("leaves a contained component separate when more than one label is eligible", () => {
    expect(
      singletonContainedComponentGroups(
        [
          { key: "left", rasterX: 10, labelTop: 100, maximumHorizontalGap: 200 },
          { key: "right", rasterX: 140, labelTop: 100, maximumHorizontalGap: 200 },
        ],
        [
          { left: 0, top: 0, right: 150, bottom: 90, size: 5_000 },
          { left: 0, top: 20, right: 20, bottom: 50, size: 300 },
        ],
      ),
    ).toEqual([[0], [1]]);
  });
});
