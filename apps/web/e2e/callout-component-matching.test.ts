import { describe, expect, it } from "vitest";

import { assertCalloutComponentBoxBound } from "./callout-browser-resource-bounds";
import {
  assignCalloutComponents,
  assignTargetBoxComponents,
  coalesceContainedComponentGroups,
  containedComponentGroups,
  type MatchableComponent,
} from "./callout-component-matching";
import type { CalloutTarget } from "./callout-types";

const component = (left: number, right = left + 20): MatchableComponent => ({
  left,
  top: 10,
  right,
  bottom: 30,
  size: 200,
});

describe("callout source-component matching", () => {
  it("refuses an over-budget source box before any flood traversal", () => {
    expect(() =>
      assertCalloutComponentBoxBound({ left: 0, top: 0, right: 1_999, bottom: 1_999 }),
    ).not.toThrow();
    expect(() =>
      assertCalloutComponentBoxBound({ left: 0, top: 0, right: 2_000, bottom: 1_999 }),
    ).toThrow(/4000000 bounded raster pixels/);
  });

  it("preserves bounded assignment refusal context for every peer", () => {
    const peers: CalloutTarget[] = Array.from({ length: 11 }, (_, index) => ({
      identity: `peer-${index}`,
      pageNumber: 1,
      stepNumber: 1,
      quantity: 1,
      xPt: index,
      yPt: 1,
      heightPt: 8,
      box: { minXPt: 0, minYPt: 0, maxXPt: 10, maxYPt: 10 },
      boxMethod: "vector-smallest",
      evidenceKind: "part-art",
      regionKind: "isolated-component",
    }));
    const result = assignTargetBoxComponents(peers[0]!, peers, [], 100, 8);
    expect(result.failure).toMatchObject({
      reason: "bounds",
      targetCount: 11,
      componentCount: 0,
      componentBounds: [],
    });
    expect(result.failure?.targetAnchors).toHaveLength(11);
    expect([...result.byIdentity.values()]).toEqual(Array(11).fill(null));
  });

  it("refuses the 65th retained component before assignment work", () => {
    expect(
      assignCalloutComponents(
        [{ identity: "target", rasterX: 0, labelTop: 35, maximumHorizontalGap: 64 }],
        Array.from({ length: 65 }, (_, index) => component(index * 2)),
      ),
    ).toEqual({ kind: "unresolved", reason: "bounds" });
  });

  it("matches sibling labels jointly even when component input order is reversed", () => {
    const components = [component(100), component(0)];
    const result = assignCalloutComponents(
      [
        { identity: "left", rasterX: 0, labelTop: 35, maximumHorizontalGap: 64 },
        { identity: "right", rasterX: 100, labelTop: 35, maximumHorizontalGap: 64 },
      ],
      components,
    );
    expect(result.kind).toBe("assigned");
    if (result.kind === "assigned") {
      expect(components[result.byIdentity.get("left")!]?.left).toBe(0);
      expect(components[result.byIdentity.get("right")!]?.left).toBe(100);
    }
  });

  it("prevents a three-label cascade from reusing or shifting components", () => {
    const components = [component(200), component(0), component(100)];
    const result = assignCalloutComponents(
      [0, 100, 200].map((rasterX, index) => ({
        identity: `target-${index}`,
        rasterX,
        labelTop: 35,
        maximumHorizontalGap: 64,
      })),
      components,
    );
    expect(result.kind).toBe("assigned");
    if (result.kind === "assigned") {
      expect(
        [0, 1, 2].map((index) => components[result.byIdentity.get(`target-${index}`)!]?.left),
      ).toEqual([0, 100, 200]);
      expect(new Set(result.byIdentity.values()).size).toBe(3);
    }
  });

  it("coalesces a disconnected detail that has only its containing part's label", () => {
    const anchors = [
      { identity: "left", rasterX: 369, labelTop: 1200, maximumHorizontalGap: 64 },
      { identity: "right", rasterX: 850, labelTop: 1200, maximumHorizontalGap: 64 },
    ];
    const components: MatchableComponent[] = [
      { left: 369, top: 981, right: 622, bottom: 1211, size: 31_481 },
      { left: 849, top: 1054, right: 1081, bottom: 1211, size: 21_135 },
      { left: 369, top: 1091, right: 486, bottom: 1189, size: 1_167 },
    ];
    const groups = containedComponentGroups(anchors, components);
    expect(groups).toEqual([[0, 2], [1]]);

    const coalesced = groups.map((group) => ({
      left: Math.min(...group.map((index) => components[index]!.left)),
      top: Math.min(...group.map((index) => components[index]!.top)),
      right: Math.max(...group.map((index) => components[index]!.right)),
      bottom: Math.max(...group.map((index) => components[index]!.bottom)),
      size: group.reduce((total, index) => total + components[index]!.size, 0),
    }));
    const result = assignCalloutComponents(anchors, coalesced);
    expect(result.kind).toBe("assigned");
    if (result.kind === "assigned") {
      expect(coalesced[result.byIdentity.get("left")!]?.left).toBe(369);
      expect(coalesced[result.byIdentity.get("right")!]?.left).toBe(849);
    }
    const filled = coalesceContainedComponentGroups(
      anchors,
      components.map((entry, index) => ({
        ...entry,
        size: 2,
        filled: new Set([index, index + 10]),
        overflowed: false,
        rawComponentCount: 1,
      })),
    );
    expect(filled).toHaveLength(2);
    expect(filled[0]).toMatchObject({ size: 4, rawComponentCount: 2 });
    expect(filled[1]).toMatchObject({ size: 2, rawComponentCount: 1 });
  });

  it("does not coalesce contained art when its eligible label set differs", () => {
    const anchors = [
      { identity: "left", rasterX: 10, labelTop: 100, maximumHorizontalGap: 64 },
      { identity: "right", rasterX: 140, labelTop: 100, maximumHorizontalGap: 64 },
    ];
    const components: MatchableComponent[] = [
      { left: 0, top: 0, right: 150, bottom: 90, size: 5_000 },
      { left: 0, top: 20, right: 20, bottom: 50, size: 300 },
    ];
    expect(containedComponentGroups(anchors, components)).toEqual([[0], [1]]);
  });

  it("does not coalesce components that are both eligible for multiple labels", () => {
    const anchors = [
      { identity: "left", rasterX: 30, labelTop: 100, maximumHorizontalGap: 64 },
      { identity: "right", rasterX: 120, labelTop: 100, maximumHorizontalGap: 64 },
    ];
    const components: MatchableComponent[] = [
      { left: 0, top: 0, right: 150, bottom: 90, size: 5_000 },
      { left: 20, top: 20, right: 130, bottom: 70, size: 1_000 },
    ];
    expect(containedComponentGroups(anchors, components)).toEqual([[0], [1]]);
  });

  it("preserves the raw 65-component overflow sentinel instead of grouping it away", () => {
    const anchors = [{ identity: "target", rasterX: 0, labelTop: 100, maximumHorizontalGap: 64 }];
    const components = Array.from({ length: 65 }, (_, index) => ({
      left: index,
      top: index,
      right: 200 - index,
      bottom: 200 - index,
      size: 10_000 - index,
    }));
    expect(containedComponentGroups(anchors, components)).toHaveLength(65);
    const filled = components.map((entry, index) => ({
      ...entry,
      filled: new Set([index]),
      overflowed: false,
      rawComponentCount: 1,
    }));
    expect(coalesceContainedComponentGroups(anchors, filled)).toEqual(filled);
  });

  it("allows a label inside legitimate wide art", () => {
    const components = [component(0, 300), component(400, 430)];
    const result = assignCalloutComponents(
      [{ identity: "wide", rasterX: 154, labelTop: 35, maximumHorizontalGap: 64 }],
      components,
    );
    expect(result.kind).toBe("assigned");
    if (result.kind === "assigned")
      expect(components[result.byIdentity.get("wide")!]).toBe(components[0]);
  });

  it("refuses equal-cost ownership instead of resolving it lexically", () => {
    expect(
      assignCalloutComponents(
        [{ identity: "target", rasterX: 50, labelTop: 35, maximumHorizontalGap: 64 }],
        [component(40, 45), component(60, 65)],
      ),
    ).toEqual({ kind: "unresolved", reason: "ambiguous" });
  });

  it("refuses components outside the bounded label gap", () => {
    expect(
      assignCalloutComponents(
        [{ identity: "target", rasterX: 0, labelTop: 35, maximumHorizontalGap: 64 }],
        [component(100)],
      ),
    ).toEqual({ kind: "unresolved", reason: "missing" });
  });
});
