import { IDENTITY, intersect, multiply, transformRect, type Matrix } from "./geometry";
import { IDENTIFY_LIMITS } from "./limits";
import type { DecodedImage, FillPath, ImagePaint, PageScan, Rect, TextRun } from "./types";

/**
 * Reads what identification needs out of a PDF with pdf.js, the rasterizer of
 * record: every page's positioned text, every image paint with the transform and
 * clip in force when it ran, the filled rectangles that frame callouts, and on
 * request the decoded pixels of an image.
 *
 * The pdf.js surface used here is declared narrowly so a test can stand in a fake
 * and so a pdf.js upgrade that changes it fails loudly in one place.
 */
export interface PdfjsLike {
  readonly version: string;
  readonly OPS: Readonly<Record<string, number>>;
  getDocument(source: Record<string, unknown>): { readonly promise: Promise<PdfjsDocumentLike> };
}

export interface PdfjsDocumentLike {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfjsPageLike>;
  destroy(): Promise<void>;
}

interface ObjectStore {
  has(id: string): boolean;
  get(id: string, callback?: (value: unknown) => void): unknown;
}

export interface PdfjsPageLike {
  getViewport(options: { scale: number }): { readonly width: number; readonly height: number };
  getOperatorList(): Promise<{
    readonly fnArray: ArrayLike<number>;
    readonly argsArray: ArrayLike<unknown>;
  }>;
  getTextContent(): Promise<{ readonly items: readonly unknown[] }>;
  readonly objs: ObjectStore;
  readonly commonObjs: ObjectStore;
  cleanup(): void;
}

/** Loads the pdf.js build that runs under Node as well as in a browser. */
export async function loadPdfjs(): Promise<PdfjsLike> {
  const module: unknown = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return module as PdfjsLike;
}

/** Refuses bytes that are not a PDF-sized buffer, before anything reads, hashes or parses them. */
export function assertPdfBytes(bytes: unknown): asserts bytes is Uint8Array {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(
      `identifyBooklet received ${bytes === null ? "null" : typeof bytes} where the PDF's bytes belong; pass a Uint8Array of the booklet.`,
    );
  }
  if (bytes.byteLength === 0) {
    throw new Error("identifyBooklet received an empty PDF; pass the booklet's bytes.");
  }
  if (bytes.byteLength > IDENTIFY_LIMITS.maxBytes) {
    throw new Error(
      `identifyBooklet received a ${bytes.byteLength}-byte PDF; the limit is ${IDENTIFY_LIMITS.maxBytes} bytes. Pass a single instruction booklet.`,
    );
  }
}

export async function openPdf(pdfjs: PdfjsLike, bytes: Uint8Array): Promise<PdfjsDocumentLike> {
  assertPdfBytes(bytes);
  const document = await pdfjs.getDocument({
    // pdf.js transfers the buffer to its worker; hand it a copy so the caller's bytes survive.
    data: Uint8Array.from(bytes),
    isEvalSupported: false,
    // Raw pixel arrays rather than ImageBitmaps or platform decoders, so Node and browsers agree.
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    disableFontFace: true,
    // pdf.js reads an image's declared width and height and drops it, undecoded, when
    // their product is over this; its callout is then flagged as having no picture.
    maxImageSize: IDENTIFY_LIMITS.maxImagePixels,
  }).promise;
  if (document.numPages > IDENTIFY_LIMITS.maxPages) {
    await document.destroy();
    throw new Error(
      `The PDF has ${document.numPages} pages; identification reads at most ${IDENTIFY_LIMITS.maxPages}. Pass a single instruction booklet.`,
    );
  }
  return document;
}

function finiteNumbers(value: unknown, count: number): number[] | null {
  if (value === null || typeof value !== "object" || !("length" in value)) return null;
  const numbers = Array.from(value as ArrayLike<unknown>);
  if (
    numbers.length < count ||
    numbers.slice(0, count).some((v) => typeof v !== "number" || !Number.isFinite(v))
  ) {
    return null;
  }
  return numbers.slice(0, count) as number[];
}

/** Arity of each pdf.js path drawing op (moveTo, lineTo, curveTo, closePath, quadratic). */
const DRAW_ARITY: readonly number[] = [2, 2, 6, 0, 4];

/** True when a packed pdf.js path is one axis-aligned rectangle. */
export function isRectanglePath(packed: unknown, bounds: Rect): boolean {
  if (!Array.isArray(packed) || packed.length !== 1) return false;
  const segment: unknown = packed[0];
  if (segment === null || typeof segment !== "object" || !("length" in segment)) return false;
  const raw = Array.from(segment as ArrayLike<unknown>);
  if (raw.length > 64 || raw.some((v) => typeof v !== "number" || !Number.isFinite(v)))
    return false;
  const all = raw as number[];
  const corners = new Set<string>();
  let moves = 0;
  for (let i = 0; i < all.length;) {
    const op = all[i++]!;
    const arity = DRAW_ARITY[op];
    if (arity === undefined || op === 2 || op === 4) return false;
    if (op === 0) moves += 1;
    if (arity === 2) {
      const x = all[i]!;
      const y = all[i + 1]!;
      const onX = Math.abs(x - bounds.x0) < 0.01 || Math.abs(x - bounds.x1) < 0.01;
      const onY = Math.abs(y - bounds.y0) < 0.01 || Math.abs(y - bounds.y1) < 0.01;
      if (!onX || !onY) return false;
      corners.add(
        `${Math.abs(x - bounds.x0) < 0.01 ? 0 : 1}${Math.abs(y - bounds.y0) < 0.01 ? 0 : 1}`,
      );
    }
    i += arity;
  }
  return moves === 1 && corners.size === 4;
}

export function textRunsOf(items: readonly unknown[]): TextRun[] {
  const runs: TextRun[] = [];
  for (const item of items) {
    if (item === null || typeof item !== "object") continue;
    const { str, transform, width } = item as {
      str?: unknown;
      transform?: unknown;
      width?: unknown;
    };
    if (typeof str !== "string" || str.trim() === "") continue;
    const m = finiteNumbers(transform, 6);
    if (m === null) continue;
    runs.push({
      text: str.trim(),
      xPt: m[4]!,
      yPt: m[5]!,
      sizePt: Math.hypot(m[2]!, m[3]!),
      widthPt: typeof width === "number" && Number.isFinite(width) ? width : 0,
    });
  }
  return runs;
}

/** Walks one page's operator list and text layer into a scan. */
export async function scanPage(
  pdfjs: PdfjsLike,
  page: PdfjsPageLike,
  pageNumber: number,
): Promise<PageScan> {
  const viewport = page.getViewport({ scale: 1 });
  const [operators, text] = await Promise.all([page.getOperatorList(), page.getTextContent()]);
  const count = operators.fnArray.length;
  if (count > IDENTIFY_LIMITS.maxOperatorsPerPage || operators.argsArray.length !== count) {
    throw new Error(
      `Page ${pageNumber} has ${count} drawing operators (limit ${IDENTIFY_LIMITS.maxOperatorsPerPage}) or a mismatched argument list; the PDF is not a readable instruction booklet.`,
    );
  }
  const OPS = pdfjs.OPS;
  const fillOps = new Set(
    ["fill", "eoFill", "fillStroke", "eoFillStroke", "closeFillStroke", "closeEOFillStroke"]
      .map((name) => OPS[name])
      .filter((value): value is number => value !== undefined),
  );
  const clipOps = new Set(
    [OPS.clip, OPS.eoClip].filter((value): value is number => value !== undefined),
  );
  let ctm: Matrix = IDENTITY;
  let clip: Rect | null = null;
  let pendingClip = false;
  const stack: { ctm: Matrix; clip: Rect | null }[] = [];
  const paints: ImagePaint[] = [];
  const fills: FillPath[] = [];
  const EMPTY: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  for (let index = 0; index < count; index += 1) {
    const fn = operators.fnArray[index]!;
    const args = operators.argsArray[index] as unknown;
    if (fn === OPS.save) {
      stack.push({ ctm, clip });
    } else if (fn === OPS.restore) {
      const saved = stack.pop();
      if (saved === undefined) {
        throw new Error(
          `Page ${pageNumber} restores graphics state at operator ${index} without a matching save; the PDF content stream is malformed.`,
        );
      }
      ({ ctm, clip } = saved);
    } else if (fn === OPS.transform) {
      const m = finiteNumbers(args, 6);
      if (m === null) {
        throw new Error(
          `Page ${pageNumber} has a transform at operator ${index} without six finite numbers.`,
        );
      }
      ctm = multiply(ctm, m as unknown as Matrix);
    } else if (clipOps.has(fn)) {
      pendingClip = true;
    } else if (fn === OPS.constructPath) {
      const parts = Array.isArray(args) ? (args as unknown[]) : [];
      const minMax = finiteNumbers(parts[2], 4);
      if (minMax === null) {
        pendingClip = false;
        continue;
      }
      const local = { x0: minMax[0]!, y0: minMax[1]!, x1: minMax[2]!, y1: minMax[3]! };
      const bounds = transformRect(ctm, local);
      if (pendingClip) {
        clip = clip === null ? bounds : (intersect(clip, bounds) ?? EMPTY);
        pendingClip = false;
      }
      if (typeof parts[0] === "number" && fillOps.has(parts[0])) {
        if (fills.length === IDENTIFY_LIMITS.maxFilledPathsPerPage) {
          throw new Error(
            `Page ${pageNumber} fills more than ${IDENTIFY_LIMITS.maxFilledPathsPerPage} paths (the limit for one page, by operator ${index}); a booklet page fills a few hundred at most. Pass an instruction booklet.`,
          );
        }
        fills.push({ bounds, isRectangle: isRectanglePath(parts[1], local) });
      }
    } else if (fn === OPS.paintImageXObject) {
      const key = Array.isArray(args) ? (args as unknown[])[0] : undefined;
      if (typeof key !== "string" || key.length === 0 || key.length > 256) continue;
      if (paints.length === IDENTIFY_LIMITS.maxImagePaintsPerPage) {
        throw new Error(
          `Page ${pageNumber} paints more than ${IDENTIFY_LIMITS.maxImagePaintsPerPage} images (the limit for one page, by operator ${index}); a booklet page paints a few hundred at most. Pass an instruction booklet.`,
        );
      }
      paints.push({ imageKey: key, order: paints.length, transform: ctm, clip });
    }
  }
  return {
    pageNumber,
    widthPt: viewport.width,
    heightPt: viewport.height,
    texts: textRunsOf(text.items),
    paints,
    fills,
  };
}

async function resolveObject(
  page: PdfjsPageLike,
  key: string,
  pageNumber: number,
): Promise<unknown> {
  if (page.objs.has(key)) return page.objs.get(key);
  if (page.commonObjs.has(key)) return page.commonObjs.get(key);
  const store = key.startsWith("g_") ? page.commonObjs : page.objs;
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `Page ${pageNumber} image ${JSON.stringify(key)} did not decode within ${IDENTIFY_LIMITS.imageWaitMs} ms; the image stream may be corrupt.`,
          ),
        ),
      IDENTIFY_LIMITS.imageWaitMs,
    );
    store.get(key, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Digest(bytes: Uint8Array): Promise<string> {
  return `sha256:${await sha256Hex(bytes)}`;
}

/** pdf.js image kinds: 1 is 1-bit grey, 2 is RGB, 3 is RGBA. */
export function toRgb(
  kind: number,
  width: number,
  height: number,
  data: Uint8Array | Uint8ClampedArray,
  label: string,
): { rgb: Uint8Array; alpha: Uint8Array | null } {
  const pixels = width * height;
  if (kind === 2 && data.length >= pixels * 3) {
    return { rgb: Uint8Array.from(data.subarray(0, pixels * 3)), alpha: null };
  }
  if (kind === 3 && data.length >= pixels * 4) {
    const rgb = new Uint8Array(pixels * 3);
    const alpha = new Uint8Array(pixels);
    for (let i = 0; i < pixels; i += 1) {
      rgb[i * 3] = data[i * 4]!;
      rgb[i * 3 + 1] = data[i * 4 + 1]!;
      rgb[i * 3 + 2] = data[i * 4 + 2]!;
      alpha[i] = data[i * 4 + 3]!;
    }
    return { rgb, alpha };
  }
  const stride = Math.ceil(width / 8);
  if (kind === 1 && data.length >= stride * height) {
    const rgb = new Uint8Array(pixels * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const on = (data[y * stride + (x >> 3)]! >> (7 - (x & 7))) & 1;
        rgb.fill(on ? 255 : 0, (y * width + x) * 3, (y * width + x) * 3 + 3);
      }
    }
    return { rgb, alpha: null };
  }
  throw new Error(
    `${label} decoded to pdf.js image kind ${kind} with ${data.length} bytes for ${width}x${height} pixels; only 1-bit grey, RGB and RGBA are readable.`,
  );
}

/** Decoded pixels of one image paint's XObject. */
export async function decodeImage(
  page: PdfjsPageLike,
  key: string,
  pageNumber: number,
): Promise<DecodedImage> {
  const label = `Page ${pageNumber} image ${JSON.stringify(key)}`;
  const value = await resolveObject(page, key, pageNumber);
  const { width, height, kind, data } = (value ?? {}) as {
    width?: unknown;
    height?: unknown;
    kind?: unknown;
    data?: unknown;
  };
  // The declared size is read, and checked, before a byte of the pixels is.
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new Error(
      `${label} has no readable size: width ${String(width)}, height ${String(height)}, where each must be a whole number of pixels from 1. The image stream is malformed.`,
    );
  }
  if (width * height > IDENTIFY_LIMITS.maxImagePixels) {
    throw new Error(
      `${label} is too large: ${width}x${height} is ${width * height} pixels, over the ${IDENTIFY_LIMITS.maxImagePixels}-pixel limit for one image. A booklet's pictures are far smaller; pass an instruction booklet.`,
    );
  }
  if (!(data instanceof Uint8Array || data instanceof Uint8ClampedArray)) {
    throw new Error(
      `${label} has no raw pixel array (pdf.js returned ${data === undefined ? "none" : typeof data}); open the PDF with isOffscreenCanvasSupported false.`,
    );
  }
  const { rgb, alpha } = toRgb(typeof kind === "number" ? kind : -1, width, height, data, label);
  let hashed = rgb;
  if (alpha !== null) {
    hashed = new Uint8Array(rgb.length + alpha.length);
    hashed.set(rgb);
    hashed.set(alpha, rgb.length);
  }
  return { width, height, rgb, alpha, digest: await sha256Digest(hashed) };
}
