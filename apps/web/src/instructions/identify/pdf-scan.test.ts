import { describe, expect, it } from "vitest";

import { FAKE_OPS } from "./__fixtures__/synthetic-booklet";
import { IDENTIFY_LIMITS } from "./limits";
import {
  assertPdfBytes,
  decodeImage,
  isRectanglePath,
  loadPdfjs,
  openPdf,
  scanPage,
  textRunsOf,
  toRgb,
  type PdfjsLike,
  type PdfjsPageLike,
} from "./pdf-scan";

/**
 * A one-page PDF painting two images: "Big" declares 5000x5000 pixels but carries
 * three bytes, "Small" is 2x2. Built here, byte by byte, so no booklet is needed.
 */
function twoImagePdf(): Uint8Array {
  const encoder = new TextEncoder();
  const small = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
  const content = "q 100 0 0 100 0 0 cm /Big Do Q q 50 0 0 50 100 100 cm /Small Do Q";
  const image = (w: number, h: number, length: number): string =>
    `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${length} >>\nstream\n`;
  const objects: (string | Uint8Array)[][] = [
    ["<< /Type /Catalog /Pages 2 0 R >>"],
    ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /XObject << /Big 4 0 R /Small 5 0 R >> >> /Contents 6 0 R >>",
    ],
    [image(5000, 5000, 3), "abc", "\nendstream"],
    [image(2, 2, small.length), small, "\nendstream"],
    [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`],
  ];
  const chunks: Uint8Array[] = [];
  let length = 0;
  const add = (part: string | Uint8Array): void => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  add("%PDF-1.4\n");
  const offsets: number[] = [];
  objects.forEach((parts, i) => {
    offsets.push(length);
    add(`${i + 1} 0 obj\n`);
    parts.forEach(add);
    add("\nendobj\n");
  });
  const xref = length;
  const entries = offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  add(
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}

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

  it("refuses a page painting more images, or filling more paths, than a booklet page does", async () => {
    const paints = IDENTIFY_LIMITS.maxImagePaintsPerPage + 1;
    await expect(
      scanPage(
        pdfjs,
        page(
          Array.from({ length: paints }, () => FAKE_OPS.paintImageXObject),
          Array.from({ length: paints }, () => ["img", 1, 1]),
        ),
        8,
      ),
    ).rejects.toThrow(
      `Page 8 paints more than ${IDENTIFY_LIMITS.maxImagePaintsPerPage} images (the limit for one page, by operator ${paints - 1}); a booklet page paints a few hundred at most. Pass an instruction booklet.`,
    );
    const fills = IDENTIFY_LIMITS.maxFilledPathsPerPage + 1;
    await expect(
      scanPage(
        pdfjs,
        page(
          Array.from({ length: fills }, () => FAKE_OPS.constructPath),
          Array.from({ length: fills }, () => [FAKE_OPS.fill, [RECTANGLE], [10, 20, 110, 70]]),
        ),
        9,
      ),
    ).rejects.toThrow(
      `Page 9 fills more than ${IDENTIFY_LIMITS.maxFilledPathsPerPage} paths (the limit for one page, by operator ${fills - 1}); a booklet page fills a few hundred at most. Pass an instruction booklet.`,
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

  it("says an image over the pixel limit is too large, from its declared size, before reading its pixels", async () => {
    const limit = IDENTIFY_LIMITS.maxImagePixels;
    const huge = { width: limit, height: 2, kind: 2, data: new Uint8Array(3) };
    await expect(decodeImage(page([], [], { big: huge }), "big", 6)).rejects.toThrow(
      `Page 6 image "big" is too large: ${limit}x2 is ${limit * 2} pixels, over the ${limit}-pixel limit for one image. A booklet's pictures are far smaller; pass an instruction booklet.`,
    );
  });

  it("says an image whose size is missing or not a pixel count has no readable size", async () => {
    const broken = { width: 0, height: "tall", kind: 2, data: new Uint8Array(3) };
    await expect(decodeImage(page([], [], { odd: broken }), "odd", 4)).rejects.toThrow(
      'Page 4 image "odd" has no readable size: width 0, height tall, where each must be a whole number of pixels from 1. The image stream is malformed.',
    );
  });
});

describe("pdf.js, the real one", () => {
  it("drops an image whose declared size is over the limit before decoding it", async () => {
    const real = await loadPdfjs();
    const document = await openPdf(real, twoImagePdf());
    try {
      const onlyPage = await document.getPage(1);
      const scan = await scanPage(real, onlyPage, 1);
      // Without maxImageSize pdf.js decodes "Big" into 5000x5000 pixels from its three bytes.
      expect(scan.paints).toHaveLength(1);
      const image = await decodeImage(onlyPage, scan.paints[0]!.imageKey, 1);
      expect([image.width, image.height]).toEqual([2, 2]);
    } finally {
      await document.destroy();
    }
  });
});

describe("openPdf", () => {
  it("opens with evaluation, font faces and platform decoders off, and the image size capped", async () => {
    let source: Record<string, unknown> = {};
    const recording: PdfjsLike = {
      ...pdfjs,
      getDocument: (options) => {
        source = options;
        return {
          promise: Promise.resolve({
            numPages: 1,
            getPage: () => Promise.reject(new Error("unused")),
            destroy: async () => {},
          }),
        };
      },
    };
    await openPdf(recording, new Uint8Array([1, 2]));
    expect(source).toMatchObject({
      isEvalSupported: false,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      disableFontFace: true,
      maxImageSize: IDENTIFY_LIMITS.maxImagePixels,
    });
    expect(source["data"]).toEqual(new Uint8Array([1, 2]));
  });

  it("refuses more pages than a booklet has, and releases the document", async () => {
    let destroyed = 0;
    const many: PdfjsLike = {
      ...pdfjs,
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: IDENTIFY_LIMITS.maxPages + 1,
          getPage: () => Promise.reject(new Error("unused")),
          destroy: async () => {
            destroyed += 1;
          },
        }),
      }),
    };
    await expect(openPdf(many, new Uint8Array([1]))).rejects.toThrow(
      `The PDF has ${IDENTIFY_LIMITS.maxPages + 1} pages; identification reads at most ${IDENTIFY_LIMITS.maxPages}. Pass a single instruction booklet.`,
    );
    expect(destroyed).toBe(1);
  });

  it("refuses bytes over the size limit without opening them", async () => {
    await expect(openPdf(pdfjs, oversized())).rejects.toThrow(
      `limit is ${IDENTIFY_LIMITS.maxBytes} bytes`,
    );
  });

  it("refuses anything but a byte array, naming what arrived", () => {
    expect(() => assertPdfBytes("booklet.pdf")).toThrow(
      "identifyBooklet received string where the PDF's bytes belong; pass a Uint8Array of the booklet.",
    );
    expect(() => assertPdfBytes(null)).toThrow(/received null where/);
  });
});

/** A byte array reporting one byte over the limit without allocating it. */
function oversized(): Uint8Array {
  class Oversized extends Uint8Array {
    override get byteLength(): number {
      return IDENTIFY_LIMITS.maxBytes + 1;
    }
  }
  return new Oversized(1);
}
