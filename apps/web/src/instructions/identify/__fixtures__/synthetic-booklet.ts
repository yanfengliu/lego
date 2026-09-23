import type { PdfjsDocumentLike, PdfjsLike, PdfjsPageLike } from "../pdf-scan";
import type { Rect } from "../types";

/**
 * A synthetic booklet served through a stand-in for pdf.js.
 *
 * Every picture is drawn here from a shape, a size and a colour, so the tests
 * exercise the whole identification path — text layer, operator list, image
 * decoding, compositing, matching and assignment — without a byte of a real
 * booklet. The layout follows the conventions identification relies on: a count
 * label under its picture's bottom-left corner, callouts framed by a filled box
 * with the step number under it, and an inventory page of count-over-id cells.
 */
export const FAKE_OPS = Object.freeze({
  save: 10,
  restore: 11,
  transform: 12,
  clip: 13,
  eoClip: 14,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  paintImageXObject: 85,
  constructPath: 91,
});

export type Rgb = readonly [number, number, number];

export interface PartShape {
  readonly kind: "rect" | "disc" | "ell" | "wedge";
  readonly widthPt: number;
  readonly heightPt: number;
  readonly rgb: Rgb;
  /** The left-right mirror image of the shape: a part's right-handed twin. */
  readonly mirrored?: boolean;
}

export interface SyntheticImage {
  readonly width: number;
  readonly height: number;
  readonly kind: 2;
  readonly data: Uint8ClampedArray;
}

/** White margin around every drawn part, in points at inventory scale. */
export const MARGIN_PT = 2;

function inside(shape: PartShape, px: number, y: number): boolean {
  const { widthPt: w, heightPt: h } = shape;
  const x = shape.mirrored ? w - px : px;
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  if (shape.kind === "disc")
    return ((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2 <= 1;
  if (shape.kind === "ell") return !(x >= w / 2 && y < h / 2);
  if (shape.kind === "wedge") return y >= h * (1 - x / w);
  return true;
}

/** A part drawn on white: a lighter top band and a dark outline give it some shading. */
export function drawPart(shape: PartShape, pxPerPt = 6): SyntheticImage {
  const width = Math.round((shape.widthPt + 2 * MARGIN_PT) * pxPerPt);
  const height = Math.round((shape.heightPt + 2 * MARGIN_PT) * pxPerPt);
  const data = new Uint8ClampedArray(width * height * 3).fill(255);
  const edge = 0.5;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const x = (column + 0.5) / pxPerPt - MARGIN_PT;
      const y = (row + 0.5) / pxPerPt - MARGIN_PT;
      if (!inside(shape, x, y)) continue;
      const outline = [
        [-edge, 0],
        [edge, 0],
        [0, -edge],
        [0, edge],
      ].some(([dx, dy]) => !inside(shape, x + dx!, y + dy!));
      const shade = outline ? 0.45 : y < shape.heightPt * 0.3 ? 1.2 : 1;
      const p = (row * width + column) * 3;
      for (let c = 0; c < 3; c += 1) data[p + c] = Math.min(255, Math.round(shape.rgb[c]! * shade));
    }
  }
  return { width, height, kind: 2, data };
}

export interface SyntheticText {
  readonly str: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly width?: number;
}

export interface SyntheticPaint {
  readonly key: string;
  /** Bottom-left corner and size of the painted image square, in points. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly clip?: Rect;
  /** Paint the image mirrored left to right, in the same rectangle. */
  readonly mirror?: boolean;
}

export interface SyntheticPage {
  readonly width: number;
  readonly height: number;
  readonly texts: readonly SyntheticText[];
  readonly paints: readonly SyntheticPaint[];
  /** Filled rectangles, drawn before the images. */
  readonly boxes: readonly Rect[];
  readonly images: ReadonlyMap<string, SyntheticImage>;
}

function rectanglePath(r: Rect): number[] {
  return [0, r.x0, r.y0, 1, r.x1, r.y0, 1, r.x1, r.y1, 1, r.x0, r.y1, 3];
}

function operatorList(page: SyntheticPage): { fnArray: number[]; argsArray: unknown[] } {
  const fnArray: number[] = [];
  const argsArray: unknown[] = [];
  const op = (fn: number, args: unknown): void => {
    fnArray.push(fn);
    argsArray.push(args);
  };
  for (const box of page.boxes) {
    op(FAKE_OPS.constructPath, [
      FAKE_OPS.fill,
      [rectanglePath(box)],
      [box.x0, box.y0, box.x1, box.y1],
    ]);
  }
  for (const paint of page.paints) {
    op(FAKE_OPS.save, null);
    if (paint.clip) {
      const c = paint.clip;
      op(FAKE_OPS.clip, null);
      op(FAKE_OPS.constructPath, [0, [rectanglePath(c)], [c.x0, c.y0, c.x1, c.y1]]);
    }
    op(
      FAKE_OPS.transform,
      paint.mirror
        ? [-paint.w, 0, 0, paint.h, paint.x + paint.w, paint.y]
        : [paint.w, 0, 0, paint.h, paint.x, paint.y],
    );
    op(FAKE_OPS.paintImageXObject, [paint.key, 1, 1]);
    op(FAKE_OPS.restore, null);
  }
  return { fnArray, argsArray };
}

function store(images: ReadonlyMap<string, SyntheticImage>): PdfjsPageLike["objs"] {
  return {
    has: (id: string) => images.has(id),
    get: (id: string, callback?: (value: unknown) => void) => {
      const value = images.get(id) ?? null;
      if (callback) callback(value);
      return value;
    },
  };
}

function fakePage(page: SyntheticPage): PdfjsPageLike {
  return {
    getViewport: () => ({ width: page.width, height: page.height }),
    getOperatorList: async () => operatorList(page),
    getTextContent: async () => ({
      items: page.texts.map((t) => ({
        str: t.str,
        transform: [t.size, 0, 0, t.size, t.x, t.y],
        width: t.width ?? t.size * 0.5 * t.str.length,
      })),
    }),
    objs: store(page.images),
    commonObjs: store(new Map()),
    cleanup: () => {},
  };
}

export interface FakePdfjs extends PdfjsLike {
  /** How many documents were destroyed; identification must release what it opens. */
  readonly destroyed: () => number;
  /** The options the last document was opened with. */
  readonly opened: () => Record<string, unknown> | null;
}

export function fakePdfjs(pages: readonly SyntheticPage[]): FakePdfjs {
  let destroyed = 0;
  let opened: Record<string, unknown> | null = null;
  const document: PdfjsDocumentLike = {
    numPages: pages.length,
    getPage: async (pageNumber: number) => {
      const page = pages[pageNumber - 1];
      if (!page) throw new Error(`synthetic booklet has no page ${pageNumber}`);
      return fakePage(page);
    },
    destroy: async () => {
      destroyed += 1;
    },
  };
  return {
    version: "synthetic",
    OPS: FAKE_OPS,
    getDocument: (source) => {
      opened = source;
      return { promise: Promise.resolve(document) };
    },
    destroyed: () => destroyed,
    opened: () => opened,
  };
}

export interface SyntheticPart {
  readonly elementId: string;
  readonly count: number;
  readonly shape: PartShape;
}

/** Eight elements; two share a shape in different colours, and the last is never built. */
export const SYNTHETIC_PARTS: readonly SyntheticPart[] = [
  {
    elementId: "3001001",
    count: 2,
    shape: { kind: "rect", widthPt: 20, heightPt: 10, rgb: [200, 40, 40] },
  },
  {
    elementId: "3001002",
    count: 1,
    shape: { kind: "rect", widthPt: 20, heightPt: 10, rgb: [40, 70, 190] },
  },
  {
    elementId: "3001003",
    count: 1,
    shape: { kind: "rect", widthPt: 30, heightPt: 10, rgb: [200, 40, 40] },
  },
  {
    elementId: "3001004",
    count: 3,
    shape: { kind: "rect", widthPt: 8, heightPt: 24, rgb: [40, 160, 80] },
  },
  {
    elementId: "3001005",
    count: 2,
    shape: { kind: "disc", widthPt: 12, heightPt: 12, rgb: [230, 200, 40] },
  },
  {
    elementId: "3001006",
    count: 1,
    shape: { kind: "ell", widthPt: 16, heightPt: 16, rgb: [50, 50, 50] },
  },
  {
    elementId: "3001007",
    count: 1,
    shape: { kind: "wedge", widthPt: 16, heightPt: 12, rgb: [150, 150, 150] },
  },
  {
    elementId: "3001008",
    count: 1,
    shape: { kind: "rect", widthPt: 18, heightPt: 8, rgb: [240, 130, 40] },
  },
];

/** How a callout's picture is printed, when not as its own part's image, whole and upright. */
export interface DrawnAs {
  /** Paint this part's callout image instead of the callout's own part's. */
  readonly image?: string;
  /** Paint the image mirrored left to right. */
  readonly mirror?: boolean;
  /** Paint the image as two tiles split down the middle, as the booklet's exporter does. */
  readonly split?: boolean;
}

export type SyntheticCallout = readonly [elementId: string, count: number, drawnAs?: DrawnAs];

/** Which parts each step calls out, and how many; page n holds step n. */
export const SYNTHETIC_STEPS: readonly (readonly SyntheticCallout[])[] = [
  [
    ["3001001", 1],
    ["3001002", 1],
    ["3001003", 1],
  ],
  [
    ["3001001", 1],
    ["3001004", 3],
    ["3001005", 2],
    ["3001006", 1],
    ["3001007", 1],
  ],
];

export const CALLOUT_SCALE = 1.334;
const PAGE = { width: 600, height: 800 } as const;
const LABEL_SIZE = 8;
const STEP_SIZE = 20;
const PAGE_NUMBER_SIZE = 6;

function partById(elementId: string, parts: readonly SyntheticPart[]): SyntheticPart {
  const part = parts.find((p) => p.elementId === elementId);
  if (!part) throw new Error(`no synthetic part ${elementId}`);
  return part;
}

function paintedSize(shape: PartShape, scale: number): { w: number; h: number } {
  return {
    w: (shape.widthPt + 2 * MARGIN_PT) * scale,
    h: (shape.heightPt + 2 * MARGIN_PT) * scale,
  };
}

/** The left and right halves of an image, as two images. */
function splitImage(image: SyntheticImage): [SyntheticImage, SyntheticImage] {
  const half = Math.floor(image.width / 2);
  const tile = (from: number, to: number): SyntheticImage => {
    const width = to - from;
    const data = new Uint8ClampedArray(width * image.height * 3);
    for (let row = 0; row < image.height; row += 1) {
      const start = (row * image.width + from) * 3;
      data.set(image.data.subarray(start, start + width * 3), row * width * 3);
    }
    return { width, height: image.height, kind: 2, data };
  };
  return [tile(0, half), tile(half, image.width)];
}

/** One build page: a callout box of count labels with pictures above them, the step number under it. */
function stepPage(
  pageNumber: number,
  callouts: readonly SyntheticCallout[],
  parts: readonly SyntheticPart[],
): SyntheticPage {
  const box: Rect = { x0: 50, y0: 500, x1: 60 + 90 * callouts.length, y1: 600 };
  const texts: SyntheticText[] = [
    { str: String(pageNumber), x: 50, y: 470, size: STEP_SIZE },
    { str: String(pageNumber), x: 580, y: 20, size: PAGE_NUMBER_SIZE },
  ];
  const paints: SyntheticPaint[] = [];
  const images = new Map<string, SyntheticImage>();
  callouts.forEach(([elementId, count, drawnAs = {}], i) => {
    const imageOf = drawnAs.image ?? elementId;
    const { shape } = partById(imageOf, parts);
    const x = 60 + 90 * i;
    const y = 510;
    texts.push({ str: `${count}x`, x, y, size: LABEL_SIZE });
    // One XObject per part, so a part called out on two pages is the same drawing.
    const key = `callout_${imageOf}`;
    const image = drawPart(shape);
    const { w, h } = paintedSize(shape, CALLOUT_SCALE);
    if (drawnAs.split) {
      const [left, right] = splitImage(image);
      const leftW = (w * left.width) / image.width;
      images.set(`${key}_left`, left).set(`${key}_right`, right);
      paints.push({ key: `${key}_left`, x, y: y + 6, w: leftW, h });
      paints.push({ key: `${key}_right`, x: x + leftW, y: y + 6, w: w - leftW, h });
    } else {
      images.set(key, image);
      paints.push({ key, x, y: y + 6, w, h, mirror: drawnAs.mirror ?? false });
    }
  });
  return { ...PAGE, texts, paints, boxes: [box], images };
}

/** The inventory: count over element id, thumbnail above the count, four cells a row. */
function inventoryPage(pageNumber: number, parts: readonly SyntheticPart[]): SyntheticPage {
  const texts: SyntheticText[] = [
    { str: String(pageNumber), x: 580, y: 20, size: PAGE_NUMBER_SIZE },
  ];
  const paints: SyntheticPaint[] = [];
  const images = new Map<string, SyntheticImage>();
  parts.forEach((part, i) => {
    const x = 40 + 120 * (i % 4);
    const y = 600 - 90 * Math.floor(i / 4);
    texts.push({ str: `${part.count}x`, x, y, size: 7 });
    texts.push({ str: part.elementId, x, y: y - 7, size: 6, width: 20 });
    const key = `inventory_${part.elementId}`;
    images.set(key, drawPart(part.shape));
    paints.push({ key, x, y: y + 5, ...paintedSize(part.shape, 1) });
  });
  return { ...PAGE, texts, paints, boxes: [], images };
}

export function syntheticBooklet(
  steps: readonly (readonly SyntheticCallout[])[] = SYNTHETIC_STEPS,
  parts: readonly SyntheticPart[] = SYNTHETIC_PARTS,
): SyntheticPage[] {
  const pages = steps.map((callouts, i) => stepPage(i + 1, callouts, parts));
  return [...pages, inventoryPage(pages.length + 1, parts)];
}
