import { describe, expect, it } from "vitest";

import { derivePanelRasterEvidence } from "./real-build-panel-raster";

const PAGE = { width: 100, height: 100 } as HTMLCanvasElement;
const OPTIONS = {
  renderScale: 1,
  panelWidth: 100,
  workFactor: 2,
  proximityMarginPx: 1,
} as const;

describe("real-build panel crop containment", () => {
  it.each([
    ["left", { minXPt: -1, maxXPt: 9, minYPt: 10, maxYPt: 20 }],
    ["right", { minXPt: 91, maxXPt: 101, minYPt: 10, maxYPt: 20 }],
    ["top", { minXPt: 10, maxXPt: 20, minYPt: 91, maxYPt: 101 }],
    ["bottom", { minXPt: 10, maxXPt: 20, minYPt: -1, maxYPt: 9 }],
  ])("rejects a crop beyond the page %s edge before canvas creation", (_edge, bounds) => {
    let created = 0;
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: () => {
          created += 1;
          throw new Error("canvas must not be created");
        },
      },
    });
    try {
      expect(() =>
        derivePanelRasterEvidence({
          pageCanvas: PAGE,
          spec: {
            stepNumber: 17,
            pageNumber: 1,
            panelFace: null,
            ...bounds,
            calloutBoxes: [],
          } as never,
          options: OPTIONS,
          modules: { assembly: {}, lattice: {} } as never,
        }),
      ).toThrowError(
        /Real-build panel 17 source rectangle .* must lie entirely within rendered page \[width=100, height=100\] before canvas allocation/u,
      );
      expect(created).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  });
});
