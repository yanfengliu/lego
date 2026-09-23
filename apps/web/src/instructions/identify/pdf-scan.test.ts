import { describe, expect, it } from "vitest";

import { FAKE_OPS } from "./__fixtures__/synthetic-booklet";
import {
  decodeImage,
  isRectanglePath,
  openPdf,
  scanPage,
  SCAN_LIMITS,
  textRunsOf,
  toRgb,
  type PdfjsLike,
  type PdfjsPageLike,
} from "./pdf-scan";

const BOUNDS = { x0: 10, y0: 20, x1: 110, y1: 70 };
const RECTANGLE = [0, 10, 20, 1, 110, 20, 1, 110, 70, 1, 10, 70, 3];

function emptyStore(): PdfjsPageLike["objs"] {
  return { has: () => false, get: () => null };
}

function page(
  fnArray: number[],
  argsArray: unknown[],
  objects: Record<string, unknown> = {},
): PdfjsPageLike {
  return {
    getViewport: () => ({ width: 600, height: 800 }),
    getOperatorList: async () => ({ fnArray, argsArray }),
    getTextContent: async () => ({
      items: [{ str: " 2x ", transform: [8, 0, 0, 8, 30, 40], width: 9 }],
    }),
    objs: {
      has: (id: string) => id in objects,
      get: (id: string) => objects[id] ?? null,
    },
    commonObjs: emptyStore(),
    cleanup: () => {},
  };
}

const pdfjs: PdfjsLike = {
  version: "test",
  OPS: FAKE_OPS,
  getDocument: () => ({ promise: Promise.reject(new Error("unused")) }),
};

describe("isRectanglePath", () => {
  it("accepts one closed axis-aligned rectangle and nothing else", () => {
    expect(isRectanglePath([RECTANGLE], BOUNDS)).toBe(true);
    expect(isRectanglePath([RECTANGLE, RECTANGLE], BOUNDS)).toBe(false);
    expect(isRectanglePath([[0, 10, 20, 2, 1, 2, 3, 4, 110, 70, 3]], BOUNDS)).toBe(false);
    expect(isRectanglePath([[0, 10, 20, 1, 60, 45, 1, 110, 70, 1, 10, 70, 3]], BOUNDS)).toBe(false);
    expect(isRectanglePath("not a path", BOUNDS)).toBe(false);
  });
});

describe("textRunsOf", () => {
  it("keeps trimmed, positioned runs and skips blanks and malformed transforms", () => {
    const runs = textRunsOf([
      { str: " 3x ", transform: [0, 8, -8, 0, 12, 34], width: 10 },
      { str: "   ", transform: [8, 0, 0, 8, 0, 0] },
      { str: "1x", transform: [8, 0, 0] },
      { str: "1x", transform: [8, 0, 0, 8, Number.NaN, 0] },
      null,
      "text",
    ]);
    expect(runs).toEqual([{ text: "3x", xPt: 12, yPt: 34, sizePt: 8, widthPt: 10 }]);
  });
});

describe("scanPage", () => {
  it("records each image paint with the transform and clip in force, and the filled rectangles", async () => {
    const ops: [number, unknown][] = [
      [FAKE_OPS.constructPath, [FAKE_OPS.fill, [RECTANGLE], [10, 20, 110, 70]]],
      [FAKE_OPS.save, null],
      [FAKE_OPS.transform, [2, 0, 0, 2, 5, 5]],
      [FAKE_OPS.clip, null],
      [FAKE_OPS.constructPath, [0, [RECTANGLE], [10, 20, 110, 70]]],
      [FAKE_OPS.transform, [10, 0, 0, 20, 1, 1]],
      [FAKE_OPS.paintImageXObject, ["img_a", 1, 1]],
      [FAKE_OPS.restore, null],
      [FAKE_OPS.paintImageXObject, ["img_b", 1, 1]],
    ];
    const scan = await scanPage(
      pdfjs,
      page(
        ops.map(([fn]) => fn),
        ops.map(([, args]) => args),
      ),
      4,
    );
    expect(scan.fills).toEqual([{ bounds: BOUNDS, isRectangle: true }]);
    expect(scan.paints).toEqual([
      {
        imageKey: "img_a",
        order: 0,
        transform: [20, 0, 0, 40, 7, 7],
        clip: { x0: 25, y0: 45, x1: 225, y1: 145 },
      },
      { imageKey: "img_b", order: 1, transform: [1, 0, 0, 1, 0, 0], clip: null },
    ]);
    expect(scan.texts).toEqual([{ text: "2x", xPt: 30, yPt: 40, sizePt: 8, widthPt: 9 }]);
  });

  it("names the page and operator when the content stream restores without a save", async () => {
    await expect(
      scanPage(
        pdfjs,
        page([FAKE_OPS.save, FAKE_OPS.restore, FAKE_OPS.restore], [null, null, null]),
        7,
      ),
    ).rejects.toThrow(
      "Page 7 restores graphics state at operator 2 without a matching save; the PDF content stream is malformed.",
    );
  });

  it("refuses a transform that is not six finite numbers", async () => {
    await expect(
      scanPage(pdfjs, page([FAKE_OPS.transform], [[1, 0, 0, Number.POSITIVE_INFINITY, 0, 0]]), 3),
    ).rejects.toThrow("Page 3 has a transform at operator 0 without six finite numbers.");
  });

  it("refuses an operator list whose arguments do not line up with its operators", async () => {
    await expect(scanPage(pdfjs, page([FAKE_OPS.save], []), 5)).rejects.toThrow(
      /Page 5 has 1 drawing operators.*mismatched argument list/,
    );
  });
});

describe("toRgb", () => {
  it("reads RGB, RGBA and 1-bit grey pixels", () => {
    expect(toRgb(2, 1, 1, new Uint8Array([1, 2, 3]), "x")).toEqual({
      rgb: new Uint8Array([1, 2, 3]),
      alpha: null,
    });
    expect(toRgb(3, 1, 1, new Uint8Array([1, 2, 3, 4]), "x")).toEqual({
      rgb: new Uint8Array([1, 2, 3]),
      alpha: new Uint8Array([4]),
    });
    expect(Array.from(toRgb(1, 2, 1, new Uint8Array([0b1000_0000]), "x").rgb)).toEqual([
      255, 255, 255, 0, 0, 0,
    ]);
  });

  it("names the image and the kinds it can read when it meets another", () => {
    expect(() => toRgb(9, 2, 2, new Uint8Array(16), 'Page 3 image "img_a"')).toThrow(
      'Page 3 image "img_a" decoded to pdf.js image kind 9 with 16 bytes for 2x2 pixels; only 1-bit grey, RGB and RGBA are readable.',
    );
  });
});

describe("decodeImage", () => {
  it("returns the pixels with a content address that ignores the image's name", async () => {
    const image = { width: 1, height: 1, kind: 2, data: new Uint8ClampedArray([9, 8, 7]) };
    const a = await decodeImage(page([], [], { img_a: image, img_b: image }), "img_a", 1);
    const b = await decodeImage(page([], [], { img_a: image, img_b: image }), "img_b", 1);
    expect(a.rgb).toEqual(new Uint8Array([9, 8, 7]));
    expect(a.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(b.digest).toBe(a.digest);
  });

  it("refuses an image with no readable size or one over the pixel limit", async () => {
    const huge = { width: SCAN_LIMITS.maxImagePixels, height: 2, kind: 2, data: new Uint8Array(3) };
    await expect(decodeImage(page([], [], { big: huge }), "big", 6)).rejects.toThrow(
      `Page 6 image "big" has no readable size (width ${SCAN_LIMITS.maxImagePixels}, height 2; at most ${SCAN_LIMITS.maxImagePixels} pixels).`,
    );
  });
});

describe("openPdf", () => {
  it("refuses more pages than a booklet has, and releases the document", async () => {
    let destroyed = 0;
    const many: PdfjsLike = {
      ...pdfjs,
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: SCAN_LIMITS.maxPages + 1,
          getPage: () => Promise.reject(new Error("unused")),
          destroy: async () => {
            destroyed += 1;
          },
        }),
      }),
    };
    await expect(openPdf(many, new Uint8Array([1]))).rejects.toThrow(
      `The PDF has ${SCAN_LIMITS.maxPages + 1} pages; identification reads at most ${SCAN_LIMITS.maxPages}. Pass a single instruction booklet.`,
    );
    expect(destroyed).toBe(1);
  });

  it("refuses bytes over the size limit without opening them", async () => {
    const oversized = { byteLength: SCAN_LIMITS.maxBytes + 1 } as unknown as Uint8Array;
    await expect(openPdf(pdfjs, oversized)).rejects.toThrow(
      `limit is ${SCAN_LIMITS.maxBytes} bytes`,
    );
  });
});
