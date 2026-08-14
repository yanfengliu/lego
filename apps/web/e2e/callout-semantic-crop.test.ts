import { afterEach, describe, expect, it, vi } from "vitest";

import { renderSemanticCrop } from "./callout-semantic-crop";
import type { CalloutTarget } from "./callout-types";

afterEach(() => vi.unstubAllGlobals());

describe("semantic callout crop evidence", () => {
  it("does not count nontext part art inside the quantity rectangle as a glyph", async () => {
    const canvas = { width: 20, height: 20 } as HTMLCanvasElement;
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: "" }),
        toBlob: (callback: BlobCallback) =>
          callback(new Blob([new Uint8Array([0])], { type: "image/png" })),
      }),
    });
    const pixels = new Uint8ClampedArray(20 * 20 * 4).fill(255);
    const mark = (x: number, y: number): void => {
      const offset = (y * 20 + x) * 4;
      pixels[offset] = 0;
      pixels[offset + 1] = 0;
      pixels[offset + 2] = 0;
    };
    mark(6, 6);
    mark(12, 12);
    const target: CalloutTarget = {
      identity: "p1|q2|x1.000|y1.000",
      pageNumber: 1,
      stepNumber: 1,
      quantity: 2,
      xPt: 1,
      yPt: 1,
      heightPt: 16,
      box: { minXPt: 0, minYPt: 0, maxXPt: 19, maxYPt: 19 },
      boxMethod: "vector-smallest",
      evidenceKind: "assembly-action",
      regionKind: "vector-box-full",
    };
    const crop = await renderSemanticCrop({
      target,
      box: { left: 0, top: 0, right: 19, bottom: 19 },
      background: [255, 255, 255],
      quantityMask: { left: 5, top: 5, right: 10, bottom: 10 },
      scale: 1,
      canvas,
      pixels,
      textPixels: new Uint8Array(20 * 20),
    });
    expect(crop).toMatchObject({
      sourceQuantityGlyphPixels: 0,
      quantityGlyphPixelsMasked: 0,
      foregroundPixels: 1,
      contamination: ["quantity-mask-empty"],
    });
  });
});
