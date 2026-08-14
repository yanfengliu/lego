import { describe, expect, it } from "vitest";

import { inspectRealBuildManifestRows } from "./real-build-manifest-consumption";

const row = (identity: string) => ({
  identity,
  file: `runs/000000000000000000000000/${identity}.png`,
  pageNumber: 1,
  stepNumber: 1,
  quantity: 1,
  physicalQuantity: 1,
  semanticMultiplierQuantity: 0,
  xPt: 1,
  yPt: 1,
  heightPt: 8,
  box: { minXPt: 0, minYPt: 0, maxXPt: 2, maxYPt: 2 },
  boxMethod: "vector-neighbor-cell",
  sha256: `sha256:${"0".repeat(64)}`,
  byteLength: 1,
  widthPx: 1,
  heightPx: 1,
  foregroundPixels: 1,
  evidenceKind: "part-art",
  regionKind: "isolated-component",
  cropStrategy: "ranked-component",
  cropRectPx: { left: 0, top: 0, right: 0, bottom: 0 },
  masksApplied: ["all-pdf-text"],
  contamination: [],
  sourceTextGlyphPixels: 0,
  sourceQuantityGlyphPixels: 0,
  textGlyphPixelsMasked: 0,
  quantityGlyphPixelsMasked: 0,
  textGlyphOverlapPixels: 0,
  quantityGlyphOverlapPixels: 0,
  boundaryClearancePx: { left: 0, top: 0, right: 0, bottom: 0 },
  sourceComponent: {
    rasterScale: 8,
    boundsPx: { left: 0, top: 0, right: 0, bottom: 0 },
    foregroundPixels: 1,
    rawComponentCount: 1,
    absoluteForegroundSha256: `sha256:${"1".repeat(64)}`,
  },
});

describe("real-build manifest consumption", () => {
  it("withholds structurally valid rows until the exact identification closure succeeds", () => {
    const callouts = [row("p1|q1|x1.000|y1.000")];
    expect(inspectRealBuildManifestRows(callouts, 1, false)).toMatchObject({
      rawCount: 1,
      structurallyClosed: true,
      trusted: [],
    });
    expect(inspectRealBuildManifestRows(callouts, 1, true).trusted).toEqual(callouts);
  });

  it("withholds duplicate or untyped rows even when the caller claims closure success", () => {
    const duplicate = row("p1|q1|x1.000|y1.000");
    expect(inspectRealBuildManifestRows([duplicate, duplicate], 2, true).trusted).toEqual([]);
    expect(inspectRealBuildManifestRows([duplicate, null], 2, true).trusted).toEqual([]);
  });
});
