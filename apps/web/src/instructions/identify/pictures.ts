import { expand } from "./geometry";
import { IDENTIFY_LIMITS } from "./limits";
import { clearRects, connectedComponents, foregroundMask, type RegionRaster } from "./raster";
import { glyphRect, visibleRect, type LabelBox, type RegionPlan } from "./regions";
import type { CalloutFlag, DecodedImage, Rect } from "./types";

/**
 * Cuts a composited region into one picture per count label.
 *
 * Ink is split into connected components, and each component goes to the label
 * whose anchor image painted most of it. That one rule covers the booklet's
 * flattening artefacts: an overlay tile painted over two drawings decides
 * nothing by itself, a drawing split into several tiles is re-joined through the
 * component it forms, and a component two anchors both paint is cut between
 * them along the ink, nearest anchor first.
 */
export interface Picture {
  readonly bbox: Rect | null;
  /** Crop size in raster pixels. */
  readonly width: number;
  readonly height: number;
  /** 1 where the picture has ink, row-major, top row first. */
  readonly mask: Uint8Array;
  readonly rgb: Uint8Array;
  /**
   * Shared by every callout that prints the same image at the same size and
   * handedness; see `drawingKey`. A composite picture is keyed by its page and
   * label, so no other callout shares it.
   */
  readonly drawing: string | null;
  readonly flags: readonly CalloutFlag[];
}

export interface PictureOptions {
  /** The page the region is on; part of a composite picture's key, and of error messages. */
  readonly pageNumber: number;
  readonly backgroundTolerance: number;
  /** Rise from a label's baseline to its picture, used when no anchor was found. */
  readonly expectedRiseRatio: number;
  /** Components smaller than this many pixels are specks, not ink. */
  readonly minComponentPx: number;
}

/** Share of a component's anchored pixels below which a second anchor is contamination. */
const MINOR_SHARE = 0.15;

function componentRect(
  raster: RegionRaster,
  span: { c0: number; c1: number; r0: number; r1: number },
): Rect {
  const s = raster.pxPerPt;
  return {
    x0: raster.left + span.c0 / s,
    x1: raster.left + span.c1 / s,
    y0: raster.top - span.r1 / s,
    y1: raster.top - span.r0 / s,
  };
}

function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.hypot(dx, dy);
}

/** Pixels of each component, in raster order: component `id` owns `pixels[start[id]]` up to `start[id + 1]`. */
function pixelsByComponent(
  component: Int32Array,
  count: number,
): { start: Int32Array; pixels: Int32Array } {
  const start = new Int32Array(count + 1);
  for (let p = 0; p < component.length; p += 1) {
    const id = component[p]!;
    if (id >= 0) start[id + 1]! += 1;
  }
  for (let id = 0; id < count; id += 1) start[id + 1]! += start[id]!;
  const next = start.slice(0, count);
  const pixels = new Int32Array(start[count]!);
  for (let p = 0; p < component.length; p += 1) {
    const id = component[p]!;
    if (id < 0) continue;
    const slot = next[id]!;
    pixels[slot] = p;
    next[id] = slot + 1;
  }
  return { start, pixels };
}

interface Owned {
  readonly anchorPaint: number;
  count: number;
  clean: boolean;
  readonly span: { c0: number; c1: number; r0: number; r1: number };
  readonly components: Map<number, number>;
}

export function extractPictures(
  plan: RegionPlan,
  labels: readonly LabelBox[],
  raster: RegionRaster,
  images: ReadonlyMap<string, DecodedImage>,
  options: PictureOptions,
): Map<number, Picture> {
  const { width, height } = raster;
  const mask = foregroundMask(raster, options.backgroundTolerance);
  clearRects(
    raster,
    mask,
    plan.labels.map((i) => expand(glyphRect(labels[i]!), 0.3)),
  );
  const { labels: component, sizes } = connectedComponents(mask, width, height);
  if (sizes.length > IDENTIFY_LIMITS.maxComponentsPerRegion) {
    throw new Error(
      `Page ${options.pageNumber}: the region at (${raster.left.toFixed(1)}, ${(raster.top - height / raster.pxPerPt).toFixed(1)}) breaks into ${sizes.length} separate pieces of ink, over the ${IDENTIFY_LIMITS.maxComponentsPerRegion} one region is read with (the sample booklet's busiest region has 10). The images there are noise or a pattern, not callout pictures; pass an instruction booklet.`,
    );
  }
  const { start, pixels } = pixelsByComponent(component, sizes.length);
  const specks = new Set(sizes.flatMap((size, id) => (size < options.minComponentPx ? [id] : [])));

  // Which label, if any, each composited paint anchors.
  const ownerOfPaint = new Int32Array(plan.paints.length).fill(-1);
  for (const [label, paintIndex] of plan.anchors) {
    if (paintIndex < 0) continue;
    ownerOfPaint[paintIndex] = ownerOfPaint[paintIndex] === -1 ? label : -2;
  }

  const votes = sizes.map(() => new Map<number, number>());
  const spans = sizes.map(() => ({ c0: width, c1: 0, r0: height, r1: 0 }));
  for (let id = 0; id < sizes.length; id += 1) {
    if (specks.has(id)) continue;
    const span = spans[id]!;
    for (let k = start[id]!; k < start[id + 1]!; k += 1) {
      const p = pixels[k]!;
      const column = p % width;
      const row = (p - column) / width;
      span.c0 = Math.min(span.c0, column);
      span.c1 = Math.max(span.c1, column + 1);
      span.r0 = Math.min(span.r0, row);
      span.r1 = Math.max(span.r1, row + 1);
      const paint = raster.paintIndex[p]!;
      const owner = paint >= 0 ? ownerOfPaint[paint]! : -1;
      if (owner >= 0) votes[id]!.set(owner, (votes[id]!.get(owner) ?? 0) + 1);
    }
  }

  const owner = new Int32Array(width * height).fill(-1);
  const componentOwner = new Map<number, number>();
  const split = new Set<number>();
  const orphans: number[] = [];
  sizes.forEach((_, id) => {
    if (specks.has(id)) return;
    const ranked = [...votes[id]!.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const total = ranked.reduce((sum, [, n]) => sum + n, 0);
    if (ranked.length === 0) orphans.push(id);
    else if (ranked.length === 1 || ranked[1]![1] < MINOR_SHARE * total)
      componentOwner.set(id, ranked[0]![0]);
    else {
      const significant = new Set(
        ranked.filter(([, n]) => n >= MINOR_SHARE * total).map(([l]) => l),
      );
      const members = pixels.subarray(start[id]!, start[id + 1]!);
      splitComponent(id, members, significant, component, raster, ownerOfPaint, owner);
      for (const l of significant) split.add(l);
    }
  });

  // Ink no anchor painted: a tile of a nearby anchored drawing, or an unlinked label's picture.
  const anchorRects = new Map<number, Rect>();
  for (const [label, paintIndex] of plan.anchors) {
    const r = paintIndex >= 0 ? visibleRect(plan.paints[paintIndex]!) : null;
    if (r) anchorRects.set(label, r);
  }
  const unlinked = plan.labels.filter((l) => !anchorRects.has(l));
  const remaining: number[] = [];
  for (const id of orphans) {
    const r = componentRect(raster, spans[id]!);
    let best = -1;
    let bestGap = 1.0;
    for (const [label, anchor] of anchorRects) {
      const gap = rectGap(r, anchor);
      if (gap <= bestGap) {
        best = label;
        bestGap = gap;
      }
    }
    if (best >= 0) componentOwner.set(id, best);
    else remaining.push(id);
  }
  for (const label of unlinked) {
    const box = labels[label]!;
    const target = { x: box.xPt, y: box.yPt + options.expectedRiseRatio * box.sizePt };
    let best = -1;
    let bestDistance = 3 * box.sizePt;
    for (const id of remaining) {
      if (componentOwner.has(id)) continue;
      const r = componentRect(raster, spans[id]!);
      const distance = Math.abs(r.x0 - target.x) + Math.abs(r.y0 - target.y);
      if (distance <= bestDistance) {
        best = id;
        bestDistance = distance;
      }
    }
    if (best < 0) continue;
    const chosen = componentRect(raster, spans[best]!);
    const claimed = remaining.filter(
      (id) => !componentOwner.has(id) && rectGap(componentRect(raster, spans[id]!), chosen) <= 1.0,
    );
    for (const id of claimed) componentOwner.set(id, label);
  }

  for (const [id, label] of componentOwner) {
    if (specks.has(id)) continue;
    for (let k = start[id]!; k < start[id + 1]!; k += 1) owner[pixels[k]!] = label;
  }

  // One pass over the raster for every label's pixels, not one pass per label.
  const owned = new Map<number, Owned>();
  for (const label of plan.labels) {
    const anchorPaint = plan.anchors.get(label) ?? -1;
    owned.set(label, {
      anchorPaint,
      count: 0,
      clean: anchorPaint >= 0,
      span: { c0: width, c1: 0, r0: height, r1: 0 },
      components: new Map(),
    });
  }
  for (let p = 0; p < width * height; p += 1) {
    const label = owner[p]!;
    const o = label >= 0 ? owned.get(label) : undefined;
    if (o === undefined) continue;
    o.count += 1;
    const column = p % width;
    const row = (p - column) / width;
    o.span.c0 = Math.min(o.span.c0, column);
    o.span.c1 = Math.max(o.span.c1, column + 1);
    o.span.r0 = Math.min(o.span.r0, row);
    o.span.r1 = Math.max(o.span.r1, row + 1);
    const id = component[p]!;
    o.components.set(id, (o.components.get(id) ?? 0) + 1);
    if (raster.paintIndex[p] !== o.anchorPaint) o.clean = false;
  }

  const pictures = new Map<number, Picture>();
  for (const label of plan.labels) {
    const flags: CalloutFlag[] = [];
    if (plan.rules.get(label) === "contains") flags.push("anchor-contains-label");
    if (!anchorRects.has(label)) flags.push("unlinked-picture");
    if (split.has(label)) flags.push("merged-split");
    const { anchorPaint, count, clean, span, components: ownedComponents } = owned.get(label)!;
    if (count === 0) {
      flags.push("no-picture");
      pictures.set(label, {
        bbox: null,
        width: 0,
        height: 0,
        mask: new Uint8Array(0),
        rgb: new Uint8Array(0),
        drawing: null,
        flags,
      });
      continue;
    }
    if ([...ownedComponents.values()].filter((n) => n >= 0.05 * count).length > 1)
      flags.push("fragments-merged");
    const w = span.c1 - span.c0;
    const h = span.r1 - span.r0;
    const cropMask = new Uint8Array(w * h);
    const cropRgb = new Uint8Array(w * h * 3);
    for (let row = 0; row < h; row += 1) {
      for (let column = 0; column < w; column += 1) {
        const p = (row + span.r0) * width + column + span.c0;
        const q = row * w + column;
        cropRgb[q * 3] = raster.rgb[p * 3]!;
        cropRgb[q * 3 + 1] = raster.rgb[p * 3 + 1]!;
        cropRgb[q * 3 + 2] = raster.rgb[p * 3 + 2]!;
        if (owner[p] === label) cropMask[q] = 1;
      }
    }
    const anchor = anchorPaint >= 0 ? plan.paints[anchorPaint]! : null;
    const digest = anchor ? images.get(anchor.imageKey)?.digest : undefined;
    const drawing =
      clean && anchor && digest
        ? drawingKey(digest, anchor.transform)
        : compositeKey(options.pageNumber, labels[label]!);
    pictures.set(label, {
      bbox: componentRect(raster, span),
      width: w,
      height: h,
      mask: cropMask,
      rgb: cropRgb,
      drawing,
      flags,
    });
  }
  return pictures;
}

/**
 * The key of a picture that one image paints alone: the image's pixels, its printed
 * width x height in points, and whether the paint mirrors it. Rotating a drawing
 * leaves the part it shows unchanged, so rotation is left out and a part printed
 * turned still meets itself. Mirroring a drawing of a left-handed part shows its
 * right-handed twin, a different element, so a mirrored paint gets its own key:
 * without it the two callouts would share one demand and one element.
 */
export function drawingKey(
  digest: string,
  t: readonly [number, number, number, number, number, number],
): string {
  const mirrored = t[0] * t[3] - t[1] * t[2] < 0 ? "/mirrored" : "";
  return `${digest}@${Math.hypot(t[0], t[1]).toFixed(2)}x${Math.hypot(t[2], t[3]).toFixed(2)}${mirrored}`;
}

/** A composite picture belongs to its one callout: its page and label position. */
export function compositeKey(pageNumber: number, label: LabelBox): string {
  return `composite:p${pageNumber}@${label.xPt.toFixed(3)},${label.yPt.toFixed(3)}`;
}

/** Cuts a component between anchors: each ink pixel goes to the nearest anchored pixel along the ink. */
function splitComponent(
  id: number,
  members: Int32Array,
  significant: ReadonlySet<number>,
  component: Int32Array,
  raster: RegionRaster,
  ownerOfPaint: Int32Array,
  owner: Int32Array,
): void {
  const { width, height } = raster;
  const queue: number[] = [];
  for (const p of members) {
    const paint = raster.paintIndex[p]!;
    const label = paint >= 0 ? ownerOfPaint[paint]! : -1;
    if (significant.has(label)) {
      owner[p] = label;
      queue.push(p);
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const p = queue[head]!;
    const column = p % width;
    const row = (p - column) / width;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const r = row + dy;
        const c = column + dx;
        if (r < 0 || r >= height || c < 0 || c >= width) continue;
        const q = r * width + c;
        if (component[q] === id && owner[q] === -1) {
          owner[q] = owner[p]!;
          queue.push(q);
        }
      }
    }
  }
}
