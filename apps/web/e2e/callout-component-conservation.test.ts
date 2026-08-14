import { describe, expect, it } from "vitest";

import { retainDisjointAssignedComponent } from "./callout-component-conservation";

describe("callout page component conservation", () => {
  it("retains disjoint selected groups", () => {
    const first = { identity: "first", filled: new Set([1, 2]) };
    const retained = retainDisjointAssignedComponent([], first);
    expect(
      retainDisjointAssignedComponent(retained, { identity: "second", filled: new Set([3]) }),
    ).toHaveLength(2);
  });

  it("refuses partial group reuse across independently matched boxes", () => {
    const retained = retainDisjointAssignedComponent([], {
      identity: "left-box",
      filled: new Set([10, 11, 12]),
    });
    expect(() =>
      retainDisjointAssignedComponent(retained, {
        identity: "overlapping-box",
        filled: new Set([12, 13]),
      }),
    ).toThrow(/reuse one page-raster foreground pixel/u);
  });
});
