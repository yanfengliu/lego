import { describe, expect, it } from "vitest";

import { assertCalloutComponentOwnership } from "./callout-component-ownership.mjs";

const digest = (character) => `sha256:${character.repeat(64)}`;
const physical = (identity, cropRectPx, boundaryClearancePx, componentDigest = digest("a")) => {
  const boundsPx = {
    left: cropRectPx.left + boundaryClearancePx.left,
    top: cropRectPx.top + boundaryClearancePx.top,
    right: cropRectPx.right - boundaryClearancePx.right,
    bottom: cropRectPx.bottom - boundaryClearancePx.bottom,
  };
  const foregroundPixels = Math.min(
    12_615,
    (boundsPx.right - boundsPx.left + 1) * (boundsPx.bottom - boundsPx.top + 1),
  );
  return {
    identity,
    pageNumber: 22,
    evidenceKind: "part-art",
    regionKind: "isolated-component",
    cropStrategy: "ranked-component",
    foregroundPixels,
    widthPx: cropRectPx.right - cropRectPx.left + 1,
    heightPx: cropRectPx.bottom - cropRectPx.top + 1,
    cropRectPx,
    boundaryClearancePx,
    sourceComponent: {
      rasterScale: 8,
      boundsPx,
      foregroundPixels,
      rawComponentCount: 1,
      absoluteForegroundSha256: componentDigest,
    },
  };
};

describe("callout source-component ownership", () => {
  it("rejects the retained step-18 reuse despite differing padding and digests", () => {
    const q1 = physical(
      "p22|q1|x57.695|y495.055",
      { left: 456, top: 209, right: 650, bottom: 338 },
      { left: 5, top: 5, right: 5, bottom: 11 },
      digest("a"),
    );
    const q2 = physical(
      "p22|q2|x109.082|y495.055",
      { left: 456, top: 209, right: 650, bottom: 332 },
      { left: 5, top: 5, right: 5, bottom: 5 },
      digest("b"),
    );
    expect(() => assertCalloutComponentOwnership([q1, q2])).toThrow(
      /same absolute source component-group bounds/,
    );
  });

  it("rejects duplicate foreground digests even when declared bounds differ", () => {
    const first = physical(
      "first",
      { left: 0, top: 0, right: 9, bottom: 9 },
      { left: 0, top: 0, right: 0, bottom: 0 },
    );
    const second = physical(
      "second",
      { left: 20, top: 0, right: 29, bottom: 9 },
      { left: 0, top: 0, right: 0, bottom: 0 },
    );
    expect(() => assertCalloutComponentOwnership([first, second])).toThrow(
      /same absolute source component-group digest/,
    );
  });

  it("requires semantic regions to carry no physical component identity", () => {
    const entry = {
      ...physical(
        "semantic",
        { left: 0, top: 0, right: 9, bottom: 9 },
        { left: 0, top: 0, right: 0, bottom: 0 },
      ),
      evidenceKind: "assembly-action",
      regionKind: "vector-box-full",
      cropStrategy: "semantic-action-region",
    };
    expect(() => assertCalloutComponentOwnership([entry])).toThrow(/sourceComponent null/);
  });

  it("rejects legacy-selected physical components at the publication boundary", () => {
    const entry = {
      ...physical(
        "legacy",
        { left: 0, top: 0, right: 9, bottom: 9 },
        { left: 0, top: 0, right: 0, bottom: 0 },
      ),
      cropStrategy: "legacy-seed",
    };
    expect(() => assertCalloutComponentOwnership([entry])).toThrow(/ranked-component/);
  });

  it("rejects an unbounded raw-component group", () => {
    const measured = physical(
      "unbounded-group",
      { left: 0, top: 0, right: 9, bottom: 9 },
      { left: 0, top: 0, right: 0, bottom: 0 },
    );
    const entry = {
      ...measured,
      sourceComponent: { ...measured.sourceComponent, rawComponentCount: 65 },
    };
    expect(() => assertCalloutComponentOwnership([entry])).toThrow(/1\.\.64 raw members/);
  });

  it("rejects more raw components than foreground pixels", () => {
    const measured = physical(
      "component-count-exceeds-pixels",
      { left: 0, top: 0, right: 1, bottom: 0 },
      { left: 0, top: 0, right: 0, bottom: 0 },
    );
    const entry = {
      ...measured,
      foregroundPixels: 1,
      sourceComponent: {
        ...measured.sourceComponent,
        foregroundPixels: 1,
        rawComponentCount: 2,
      },
    };
    expect(() => assertCalloutComponentOwnership([entry])).toThrow(
      /raw members no greater than its foreground pixels/,
    );
  });

  it("allows one foreground pixel only in a 1x1 tight bounds box", () => {
    const oneByOne = physical(
      "one-pixel-component",
      { left: 4, top: 5, right: 4, bottom: 5 },
      { left: 0, top: 0, right: 0, bottom: 0 },
    );
    oneByOne.foregroundPixels = 1;
    oneByOne.sourceComponent.foregroundPixels = 1;
    expect(assertCalloutComponentOwnership([oneByOne])).toEqual([oneByOne]);

    const nonTight = physical(
      "one-pixel-non-tight-component",
      { left: 4, top: 5, right: 5, bottom: 5 },
      { left: 0, top: 0, right: 0, bottom: 0 },
    );
    nonTight.foregroundPixels = 1;
    nonTight.sourceComponent.foregroundPixels = 1;
    expect(() => assertCalloutComponentOwnership([nonTight])).toThrow(/one pixel requires 1x1/);
  });

  it("does not let an ambient array toJSON hook forge exact component keys", () => {
    const measured = physical(
      "extra-key",
      { left: 0, top: 0, right: 9, bottom: 9 },
      { left: 0, top: 0, right: 0, bottom: 0 },
    );
    const entry = {
      ...measured,
      sourceComponent: { ...measured.sourceComponent, attackerSemantic: true },
    };
    let calls = 0;
    try {
      Object.defineProperty(Array.prototype, "toJSON", {
        configurable: true,
        value: () => {
          calls += 1;
          return [];
        },
      });
      expect(() => assertCalloutComponentOwnership([entry])).toThrow(/source group/u);
    } finally {
      delete Array.prototype.toJSON;
    }
    expect(calls).toBe(0);
  });
});
