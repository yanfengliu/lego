import { invert, paintRect, type Matrix } from "./geometry";
import type { DecodedImage, ImagePaint, Rect } from "./types";

/**
 * Re-rasterizes a small page region from its image paints alone.
 *
 * The booklet's PDF was flattened: where two part drawings overlap, the exporter
 * split them into tiles and painted composite tiles over the overlap, so one part
 * can arrive as several images and one image can hold two parts. Compositing the
 * region's images in paint order recovers what the page shows — without the text
 * and vector strokes, which are drawn separately — and records which paint was
 * the last to cover each pixel, so a pixel can be traced back to its drawing.
 */
export interface RegionRaster {
  readonly width: number;
  readonly height: number;
  /** Page point of the raster's left edge and top edge (y up). */
  readonly left: number;
  readonly top: number;
  readonly pxPerPt: number;
  readonly rgb: Uint8Array;
  /** Index into the composited paint list of the last paint covering each pixel, or -1. */
  readonly paintIndex: Int32Array;
  /** Background colour of each composited paint, estimated from its image border. */
  readonly background: readonly (readonly [number, number, number])[];
}

export const MAX_REGION_PIXELS = 4_000_000;

/** Pixel (column, row) centre to page coordinates. */
export function pixelCentre(raster: RegionRaster, column: number, row: number): [number, number] {
  return [raster.left + (column + 0.5) / raster.pxPerPt, raster.top - (row + 0.5) / raster.pxPerPt];
}

/** Page rectangle to the raster's pixel span (half-open, clamped). */
export function pixelSpan(
  raster: RegionRaster,
  r: Rect,
): { c0: number; c1: number; r0: number; r1: number } {
  const s = raster.pxPerPt;
  return {
    c0: Math.max(0, Math.floor((r.x0 - raster.left) * s)),
    c1: Math.min(raster.width, Math.ceil((r.x1 - raster.left) * s)),
    r0: Math.max(0, Math.floor((raster.top - r.y1) * s)),
    r1: Math.min(raster.height, Math.ceil((raster.top - r.y0) * s)),
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  return values[values.length >> 1]!;
}

/** Median colour of an image's outermost ring of pixels, and how much of the ring agrees with it. */
export function borderBackground(
  image: DecodedImage,
  tolerance: number,
): {
  colour: [number, number, number];
  agreement: number;
} {
  const { width, height, rgb } = image;
  const ring: number[] = [];
  for (let x = 0; x < width; x += 1) ring.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y += 1) ring.push(y * width, y * width + width - 1);
  const channels = [0, 1, 2].map((c) => median(ring.map((p) => rgb[p * 3 + c]!)));
  const colour: [number, number, number] = [channels[0]!, channels[1]!, channels[2]!];
  let agree = 0;
  for (const p of ring) {
    const d = Math.max(
      Math.abs(rgb[p * 3]! - colour[0]),
      Math.abs(rgb[p * 3 + 1]! - colour[1]),
      Math.abs(rgb[p * 3 + 2]! - colour[2]),
    );
    if (d <= tolerance) agree += 1;
  }
  return { colour, agreement: ring.length === 0 ? 0 : agree / ring.length };
}

/**
 * Paints `paints` (already in page order) into a raster of `region` at `pxPerPt`.
 * Each image is sampled bilinearly, averaged over its footprint when it is being
 * shrunk, and cut to its clip.
 */
export function compositeRegion(
  region: Rect,
  pxPerPt: number,
  paints: readonly ImagePaint[],
  images: ReadonlyMap<string, DecodedImage>,
  backgroundTolerance: number,
): RegionRaster {
  const width = Math.max(1, Math.ceil((region.x1 - region.x0) * pxPerPt));
  const height = Math.max(1, Math.ceil((region.y1 - region.y0) * pxPerPt));
  if (width * height > MAX_REGION_PIXELS) {
    throw new Error(
      `A callout region of ${(region.x1 - region.x0).toFixed(1)}x${(region.y1 - region.y0).toFixed(1)}pt needs ${width * height} pixels at ${pxPerPt.toFixed(2)} px/pt, over the ${MAX_REGION_PIXELS} limit; lower gridPxPerPt.`,
    );
  }
  const raster = {
    width,
    height,
    left: region.x0,
    top: region.y1,
    pxPerPt,
    rgb: new Uint8Array(width * height * 3),
    paintIndex: new Int32Array(width * height).fill(-1),
    background: [] as [number, number, number][],
  };
  const borders = paints.map((paint) => {
    const image = images.get(paint.imageKey);
    return image ? borderBackground(image, backgroundTolerance) : null;
  });
  const agreed = borders.filter((b) => b !== null && b.agreement >= 0.6).map((b) => b!.colour);
  const fallback: [number, number, number] =
    agreed.length > 0
      ? ([0, 1, 2].map((c) => median(agreed.map((col) => col[c]!))) as [number, number, number])
      : [0, 0, 0];
  paints.forEach((paint, index) => {
    const image = images.get(paint.imageKey);
    const border = borders[index];
    raster.background.push(border && border.agreement >= 0.6 ? border.colour : fallback);
    if (image) paintImage(raster, index, paint, image);
  });
  return raster;
}

function paintImage(
  raster: {
    width: number;
    height: number;
    left: number;
    top: number;
    pxPerPt: number;
    rgb: Uint8Array;
    paintIndex: Int32Array;
  },
  index: number,
  paint: ImagePaint,
  image: DecodedImage,
): void {
  const visible = paintRect(paint.transform as Matrix, paint.clip);
  const inverse = invert(paint.transform as Matrix);
  if (visible === null || inverse === null) return;
  const span = pixelSpan(raster as RegionRaster, visible);
  const s = raster.pxPerPt;
  // Source pixels per destination pixel along each axis, to decide on footprint averaging.
  const sx = Math.abs(image.width / (Math.hypot(paint.transform[0], paint.transform[1]) * s));
  const sy = Math.abs(image.height / (Math.hypot(paint.transform[2], paint.transform[3]) * s));
  const taps = Math.min(4, Math.max(1, Math.ceil(Math.max(sx, sy) - 0.25)));
  const { width: W, height: H, rgb, alpha } = image;
  const sample = [0, 0, 0, 0];
  for (let row = span.r0; row < span.r1; row += 1) {
    for (let column = span.c0; column < span.c1; column += 1) {
      sample[0] = sample[1] = sample[2] = sample[3] = 0;
      let hits = 0;
      for (let ty = 0; ty < taps; ty += 1) {
        for (let tx = 0; tx < taps; tx += 1) {
          const x = raster.left + (column + (tx + 0.5) / taps) / s;
          const y = raster.top - (row + (ty + 0.5) / taps) / s;
          if (x < visible.x0 || x > visible.x1 || y < visible.y0 || y > visible.y1) continue;
          const u = inverse[0] * x + inverse[2] * y + inverse[4];
          const v = inverse[1] * x + inverse[3] * y + inverse[5];
          if (u < 0 || u > 1 || v < 0 || v > 1) continue;
          const fx = Math.min(W - 1, Math.max(0, u * W - 0.5));
          const fy = Math.min(H - 1, Math.max(0, (1 - v) * H - 0.5));
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          const x1 = Math.min(W - 1, x0 + 1);
          const y1 = Math.min(H - 1, y0 + 1);
          const ax = fx - x0;
          const ay = fy - y0;
          const w00 = (1 - ax) * (1 - ay);
          const w10 = ax * (1 - ay);
          const w01 = (1 - ax) * ay;
          const w11 = ax * ay;
          const p00 = y0 * W + x0;
          const p10 = y0 * W + x1;
          const p01 = y1 * W + x0;
          const p11 = y1 * W + x1;
          for (let c = 0; c < 3; c += 1) {
            sample[c]! +=
              w00 * rgb[p00 * 3 + c]! +
              w10 * rgb[p10 * 3 + c]! +
              w01 * rgb[p01 * 3 + c]! +
              w11 * rgb[p11 * 3 + c]!;
          }
          sample[3]! += alpha
            ? w00 * alpha[p00]! + w10 * alpha[p10]! + w01 * alpha[p01]! + w11 * alpha[p11]!
            : 255;
          hits += 1;
        }
      }
      if (hits === 0) continue;
      const coverage = (hits / (taps * taps)) * (sample[3]! / hits / 255);
      if (coverage < 0.5) continue;
      const p = row * raster.width + column;
      const a = sample[3]! / hits / 255;
      for (let c = 0; c < 3; c += 1) {
        const src = sample[c]! / hits;
        raster.rgb[p * 3 + c] = Math.round(a * src + (1 - a) * raster.rgb[p * 3 + c]!);
      }
      raster.paintIndex[p] = index;
    }
  }
}

/**
 * Ink: pixels that differ from their paint's background by more than
 * `tolerance`, or that no flood from the background can reach through
 * background-coloured pixels. Unpainted pixels are background by definition.
 */
export function foregroundMask(raster: RegionRaster, tolerance: number): Uint8Array {
  const { width, height, rgb, paintIndex, background } = raster;
  const n = width * height;
  const quiet = new Uint8Array(n);
  for (let p = 0; p < n; p += 1) {
    const index = paintIndex[p]!;
    if (index < 0) {
      quiet[p] = 1;
      continue;
    }
    const bg = background[index]!;
    const d = Math.max(
      Math.abs(rgb[p * 3]! - bg[0]),
      Math.abs(rgb[p * 3 + 1]! - bg[1]),
      Math.abs(rgb[p * 3 + 2]! - bg[2]),
    );
    quiet[p] = d <= tolerance ? 1 : 0;
  }
  const reached = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const seed = (p: number): void => {
    if (quiet[p] && !reached[p]) {
      reached[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let p = 0; p < n; p += 1) {
    const column = p % width;
    const row = (p - column) / width;
    if (
      paintIndex[p]! < 0 ||
      column === 0 ||
      row === 0 ||
      column === width - 1 ||
      row === height - 1
    )
      seed(p);
  }
  while (head < tail) {
    const p = queue[head++]!;
    const column = p % width;
    if (column > 0) seed(p - 1);
    if (column < width - 1) seed(p + 1);
    if (p >= width) seed(p - width);
    if (p + width < n) seed(p + width);
  }
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p += 1) mask[p] = reached[p] ? 0 : 1;
  return mask;
}

/** Clears the mask inside page rectangles (count labels drawn as image tiles). */
export function clearRects(raster: RegionRaster, mask: Uint8Array, rects: readonly Rect[]): void {
  for (const r of rects) {
    const span = pixelSpan(raster, r);
    for (let row = span.r0; row < span.r1; row += 1) {
      mask.fill(0, row * raster.width + span.c0, row * raster.width + Math.max(span.c0, span.c1));
    }
  }
}

export interface Components {
  /** Component id per pixel, -1 for background. */
  readonly labels: Int32Array;
  readonly sizes: readonly number[];
}

/** 8-connected components of a mask. */
export function connectedComponents(mask: Uint8Array, width: number, height: number): Components {
  const n = width * height;
  const labels = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const queue = new Int32Array(n);
  for (let start = 0; start < n; start += 1) {
    if (!mask[start] || labels[start]! >= 0) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    labels[start] = id;
    queue[tail++] = start;
    while (head < tail) {
      const p = queue[head++]!;
      const column = p % width;
      const row = (p - column) / width;
      for (let dy = -1; dy <= 1; dy += 1) {
        const r = row + dy;
        if (r < 0 || r >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const c = column + dx;
          if (c < 0 || c >= width) continue;
          const q = r * width + c;
          if (mask[q] && labels[q]! < 0) {
            labels[q] = id;
            queue[tail++] = q;
          }
        }
      }
    }
    sizes.push(tail);
  }
  return { labels, sizes };
}
