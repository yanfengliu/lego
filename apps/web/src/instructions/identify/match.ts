import type { Picture } from "./pictures";
import type { Candidate } from "./types";

/**
 * Compares a callout picture with inventory thumbnails at one fixed scale.
 *
 * Both are rasterized onto the same grid in inventory points — a callout drawn
 * 1.334 times larger is sampled 1.334 times more coarsely — so the booklet's own
 * scale does the size discrimination: a 1x6 plate cannot pass for a 1x4 because
 * their masks cannot overlap well at a fixed scale. Masks are aligned by centroid
 * and a small shift search; the appearance term (luminance correlation where the
 * masks agree) separates a plate from a tile of the same outline, and the colour
 * term separates the same shape in two colours.
 */
export interface Features {
  readonly width: number;
  readonly height: number;
  readonly mask: Uint8Array;
  readonly luma: Float32Array;
  readonly meanRgb: readonly [number, number, number];
  readonly area: number;
  readonly cx: number;
  readonly cy: number;
}

export interface ScoreWeights {
  readonly alignSearchPx: number;
  readonly appearanceWeight: number;
  readonly colourWeight: number;
}

export interface PairScore {
  readonly score: number;
  readonly iou: number;
  readonly ncc: number;
  readonly colourDistance: number;
}

export function featuresOf(picture: Picture): Features | null {
  const { width, height, mask, rgb } = picture;
  let area = 0;
  let sx = 0;
  let sy = 0;
  const sum = [0, 0, 0];
  const luma = new Float32Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    luma[p] = 0.299 * rgb[p * 3]! + 0.587 * rgb[p * 3 + 1]! + 0.114 * rgb[p * 3 + 2]!;
    if (!mask[p]) continue;
    area += 1;
    sx += p % width;
    sy += Math.floor(p / width);
    sum[0]! += rgb[p * 3]!;
    sum[1]! += rgb[p * 3 + 1]!;
    sum[2]! += rgb[p * 3 + 2]!;
  }
  if (area === 0) return null;
  return {
    width,
    height,
    mask,
    luma,
    meanRgb: [sum[0]! / area, sum[1]! / area, sum[2]! / area],
    area,
    cx: sx / area + 0.5,
    cy: sy / area + 0.5,
  };
}

/** Ink pixels shared by `a` and `b` when `b`'s pixel (x, y) sits on `a`'s (x + dx, y + dy). */
export function overlap(a: Features, b: Features, dx: number, dy: number): number {
  const x0 = Math.max(0, dx);
  const x1 = Math.min(a.width, b.width + dx);
  const y0 = Math.max(0, dy);
  const y1 = Math.min(a.height, b.height + dy);
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    const ra = y * a.width;
    const rb = (y - dy) * b.width - dx;
    for (let x = x0; x < x1; x += 1) n += a.mask[ra + x]! & b.mask[rb + x]!;
  }
  return n;
}

function iouAt(a: Features, b: Features, dx: number, dy: number): number {
  const shared = overlap(a, b, dx, dy);
  return shared / (a.area + b.area - shared);
}

/** Luminance correlation over the pixels both masks cover. */
function correlation(a: Features, b: Features, dx: number, dy: number): number {
  const x0 = Math.max(0, dx);
  const x1 = Math.min(a.width, b.width + dx);
  const y0 = Math.max(0, dy);
  const y1 = Math.min(a.height, b.height + dy);
  let n = 0;
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  for (let y = y0; y < y1; y += 1) {
    const ra = y * a.width;
    const rb = (y - dy) * b.width - dx;
    for (let x = x0; x < x1; x += 1) {
      if (!(a.mask[ra + x]! & b.mask[rb + x]!)) continue;
      const la = a.luma[ra + x]!;
      const lb = b.luma[rb + x]!;
      n += 1;
      sa += la;
      sb += lb;
      saa += la * la;
      sbb += lb * lb;
      sab += la * lb;
    }
  }
  if (n < 8) return 0;
  const va = saa - (sa * sa) / n;
  const vb = sbb - (sb * sb) / n;
  if (va <= 1e-6 * n || vb <= 1e-6 * n) return 0;
  return (sab - (sa * sb) / n) / Math.sqrt(va * vb);
}

export function colourDistance(a: Features, b: Features): number {
  return Math.hypot(
    a.meanRgb[0] - b.meanRgb[0],
    a.meanRgb[1] - b.meanRgb[1],
    a.meanRgb[2] - b.meanRgb[2],
  );
}

function centroidShift(a: Features, b: Features): [number, number] {
  return [Math.round(a.cx - b.cx), Math.round(a.cy - b.cy)];
}

/** Full comparison: best shift within the search window, then appearance and colour there. */
export function comparePictures(a: Features, b: Features, weights: ScoreWeights): PairScore {
  const [cx, cy] = centroidShift(a, b);
  let bestIou = -1;
  let bestDx = cx;
  let bestDy = cy;
  const s = weights.alignSearchPx;
  for (let dy = cy - s; dy <= cy + s; dy += 1) {
    for (let dx = cx - s; dx <= cx + s; dx += 1) {
      const iou = iouAt(a, b, dx, dy);
      // A tie keeps the shift found first in this fixed scan, so equal overlaps resolve the same way every run.
      if (iou > bestIou + 1e-12) {
        bestIou = iou;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  const ncc = correlation(a, b, bestDx, bestDy);
  const colour = colourDistance(a, b);
  return {
    score: bestIou + weights.appearanceWeight * ncc - weights.colourWeight * colour,
    iou: bestIou,
    ncc,
    colourDistance: colour,
  };
}

export interface Reference {
  readonly elementId: string;
  readonly features: Features;
}

/**
 * Ranks every reference for one picture. References far off in size are scored
 * only by a cheap centroid-aligned overlap unless too few are left; the closest
 * `refine` of them get the full comparison.
 */
export function rankReferences(
  picture: Features,
  references: readonly Reference[],
  weights: ScoreWeights,
  keep: number,
  refine = 16,
): Candidate[] {
  const sized = references.map((ref) => ({
    ref,
    misfit:
      Math.abs(Math.log(picture.width / ref.features.width)) +
      Math.abs(Math.log(picture.height / ref.features.height)),
  }));
  let pool = sized.filter(({ misfit }) => misfit <= 0.7);
  if (pool.length < Math.max(keep, refine))
    pool = [...sized].sort((a, b) => a.misfit - b.misfit).slice(0, Math.max(keep, refine) * 2);
  const coarse = pool
    .map(({ ref }) => {
      const [dx, dy] = centroidShift(picture, ref.features);
      return {
        ref,
        rough:
          iouAt(picture, ref.features, dx, dy) -
          weights.colourWeight * colourDistance(picture, ref.features),
      };
    })
    .sort((a, b) => b.rough - a.rough || a.ref.elementId.localeCompare(b.ref.elementId))
    .slice(0, Math.max(refine, keep));
  return coarse
    .map(({ ref }) => {
      const scored = comparePictures(picture, ref.features, weights);
      return { elementId: ref.elementId, score: round(scored.score), iou: round(scored.iou) };
    })
    .sort((a, b) => b.score - a.score || a.elementId.localeCompare(b.elementId))
    .slice(0, keep);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
