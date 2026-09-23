import { area, contains, expand, intersect, paintRect, union, type Matrix } from "./geometry";
import type { ImagePaint, PageScan, Rect } from "./types";

/**
 * Where each count label's picture is, before any pixel is read.
 *
 * The booklet prints a picture's count directly under the picture's bottom-left
 * corner, so the image paint whose visible rectangle starts just above the label,
 * left-aligned with it, is the label's anchor. When a drawing's rectangle reaches
 * below its own label (a long part drawn diagonally), the label sits inside the
 * rectangle's bottom edge instead, and that is accepted as a second rule.
 */
export interface LabelBox {
  readonly xPt: number;
  readonly yPt: number;
  readonly sizePt: number;
  readonly widthPt: number;
}

export type AnchorRule = "offset" | "contains";

export interface Anchor {
  readonly paint: ImagePaint;
  readonly rule: AnchorRule;
  /** Distance from the label's baseline up to the anchor's visible bottom edge. */
  readonly risePt: number;
}

export interface RegionPlan {
  readonly rect: Rect;
  /** Indices into the page's label list. */
  readonly labels: readonly number[];
  /** Paints to composite, in page order. */
  readonly paints: readonly ImagePaint[];
  /** Label index to the index of its anchor within `paints`. */
  readonly anchors: ReadonlyMap<number, number>;
  readonly rules: ReadonlyMap<number, AnchorRule>;
  /** True when the region is a framed callout box rather than grown from its images. */
  readonly boxed: boolean;
}

export function visibleRect(paint: ImagePaint): Rect | null {
  return paintRect(paint.transform as Matrix, paint.clip);
}

export function glyphRect(label: LabelBox): Rect {
  return {
    x0: label.xPt,
    y0: label.yPt,
    x1: label.xPt + Math.max(label.widthPt, label.sizePt * 0.5),
    y1: label.yPt + label.sizePt * 0.75,
  };
}

/** The anchor paint for one count label, or null when neither rule finds one. */
export function findAnchor(label: LabelBox, paints: readonly ImagePaint[]): Anchor | null {
  return anchorAmong(label, paints, paints.map(visibleRect));
}

/** `findAnchor` over visible rectangles computed once per page rather than once per label. */
function anchorAmong(
  label: LabelBox,
  paints: readonly ImagePaint[],
  rects: readonly (Rect | null)[],
): Anchor | null {
  const size = label.sizePt;
  const offset: { paint: ImagePaint; rise: number; area: number }[] = [];
  const inside: { paint: ImagePaint; rise: number; area: number }[] = [];
  for (const [index, paint] of paints.entries()) {
    const r = rects[index]!;
    if (r === null) continue;
    const rise = r.y0 - label.yPt;
    const a = area(r);
    if (Math.abs(r.x0 - label.xPt) <= 0.8 && rise >= 0.4 * size && rise <= 2.2 * size) {
      offset.push({ paint, rise, area: a });
    } else if (
      label.xPt >= r.x0 - 0.8 &&
      label.xPt <= r.x1 &&
      rise <= 0.5 &&
      rise >= -0.4 * size &&
      a >= 4 * size * size
    ) {
      inside.push({ paint, rise, area: a });
    }
  }
  if (offset.length > 0) {
    const lowest = Math.min(...offset.map(({ rise }) => rise));
    const best = offset
      .filter(({ rise }) => rise <= lowest + 0.1)
      .sort((a, b) => b.area - a.area || a.paint.order - b.paint.order)[0]!;
    return { paint: best.paint, rule: "offset", risePt: best.rise };
  }
  if (inside.length > 0) {
    const best = inside.sort((a, b) => b.area - a.area || a.paint.order - b.paint.order)[0]!;
    return { paint: best.paint, rule: "contains", risePt: best.rise };
  }
  return null;
}

/** The smallest filled rectangle framing a label: the callout box it is printed in. */
export function framingBox(scan: PageScan, label: LabelBox, maxPageFraction = 0.25): Rect | null {
  const glyph = glyphRect(label);
  const limit = scan.widthPt * scan.heightPt * maxPageFraction;
  let best: Rect | null = null;
  for (const fill of scan.fills) {
    if (!fill.isRectangle || area(fill.bounds) > limit || !contains(fill.bounds, glyph, 1))
      continue;
    if (best === null || area(fill.bounds) < area(best)) best = fill.bounds;
  }
  return best;
}

class UnionFind {
  private readonly parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]!]!;
      i = this.parent[i]!;
    }
    return i;
  }
  join(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

/**
 * Groups a page's labels into regions to composite. Labels in one callout box
 * share the box; unboxed labels (the inventory, bag pages) get their anchor's
 * rectangle plus any image tile touching it, and regions that meet are merged.
 *
 * Work is labels times paints, not labels squared times paints: each paint's
 * rectangle is computed once, and meeting regions are found by a sweep in x.
 */
export function planRegions(
  scan: PageScan,
  labels: readonly LabelBox[],
  options: { readonly useBoxes: boolean },
): RegionPlan[] {
  const rects = scan.paints.map(visibleRect);
  const anchors = labels.map((label) => anchorAmong(label, scan.paints, rects));
  const extents: Rect[] = [];
  const boxed: boolean[] = [];
  labels.forEach((label, index) => {
    const box = options.useBoxes ? framingBox(scan, label) : null;
    const glyph = glyphRect(label);
    const anchor = anchors[index];
    const anchorRect = anchor ? visibleRect(anchor.paint) : null;
    // Without an anchor, look a few label heights above the label for the picture.
    let extent =
      box ??
      (anchorRect
        ? union(anchorRect, glyph)
        : union(glyph, { ...glyph, y1: glyph.y1 + 4 * label.sizePt }));
    if (box === null && anchorRect !== null) {
      // A flattened drawing can continue in tiles that touch its anchor.
      const reach = expand(anchorRect, 0.6);
      const limit = 2 * area(anchorRect);
      for (const r of rects) {
        if (r !== null && area(r) <= limit && intersect(reach, r) !== null)
          extent = union(extent, r);
      }
    }
    extents.push(expand(extent, box ? 0 : 1));
    boxed.push(box !== null);
  });
  const groups = new UnionFind(labels.length);
  // Sweep in x: once a later extent starts right of this one's end, no later one can meet it.
  const byLeft = extents.map((_, i) => i).sort((a, b) => extents[a]!.x0 - extents[b]!.x0 || a - b);
  for (const [position, a] of byLeft.entries()) {
    for (let next = position + 1; next < byLeft.length; next += 1) {
      const b = byLeft[next]!;
      if (extents[b]!.x0 >= extents[a]!.x1) break;
      if (intersect(extents[a]!, extents[b]!) !== null) groups.join(a, b);
    }
  }
  const byRoot = new Map<number, number[]>();
  labels.forEach((_, index) => {
    const root = groups.find(index);
    const members = byRoot.get(root);
    if (members) members.push(index);
    else byRoot.set(root, [index]);
  });
  const plans: RegionPlan[] = [];
  for (const members of byRoot.values()) {
    const rect = members.map((i) => extents[i]!).reduce(union);
    const anchorPaints = new Set(
      members.map((i) => anchors[i]?.paint).filter((p): p is ImagePaint => p !== undefined),
    );
    const paints = scan.paints.filter((paint, index) => {
      if (anchorPaints.has(paint)) return true;
      const r = rects[index]!;
      if (r === null) return false;
      const overlap = intersect(r, rect);
      return overlap !== null && area(overlap) >= 0.8 * area(r);
    });
    const position = new Map(paints.map((paint, index) => [paint, index]));
    const anchorIndex = new Map<number, number>();
    const rules = new Map<number, AnchorRule>();
    for (const i of members) {
      const anchor = anchors[i];
      if (!anchor) continue;
      anchorIndex.set(i, position.get(anchor.paint)!);
      rules.set(i, anchor.rule);
    }
    plans.push({
      rect,
      labels: members,
      paints,
      anchors: anchorIndex,
      rules,
      boxed: members.some((i) => boxed[i]),
    });
  }
  return plans;
}
