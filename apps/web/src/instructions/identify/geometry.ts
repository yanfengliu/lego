import type { Rect } from "./types";

/** Small rectangle and affine helpers; PDF user space, y up. */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `m1` then `m2`, in PDF's row-vector convention (as pdf.js `Util.transform`). */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function applyPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function invert(m: Matrix): Matrix | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

/** Bounding box of a rectangle after an affine map. */
export function transformRect(m: Matrix, r: Rect): Rect {
  const corners = [
    applyPoint(m, r.x0, r.y0),
    applyPoint(m, r.x1, r.y0),
    applyPoint(m, r.x0, r.y1),
    applyPoint(m, r.x1, r.y1),
  ];
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export function rect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
}

export function width(r: Rect): number {
  return r.x1 - r.x0;
}

export function height(r: Rect): number {
  return r.y1 - r.y0;
}

export function area(r: Rect): number {
  return Math.max(0, width(r)) * Math.max(0, height(r));
}

export function intersect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x0, b.x0);
  const y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  return x0 < x1 && y0 < y1 ? { x0, y0, x1, y1 } : null;
}

export function union(a: Rect, b: Rect): Rect {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

export function expand(r: Rect, by: number): Rect {
  return { x0: r.x0 - by, y0: r.y0 - by, x1: r.x1 + by, y1: r.y1 + by };
}

export function contains(outer: Rect, inner: Rect, tolerance = 0): boolean {
  return (
    inner.x0 >= outer.x0 - tolerance &&
    inner.y0 >= outer.y0 - tolerance &&
    inner.x1 <= outer.x1 + tolerance &&
    inner.y1 <= outer.y1 + tolerance
  );
}

export function containsPoint(r: Rect, x: number, y: number, tolerance = 0): boolean {
  return (
    x >= r.x0 - tolerance && x <= r.x1 + tolerance && y >= r.y0 - tolerance && y <= r.y1 + tolerance
  );
}

/** Distance from a point to a rectangle, zero inside. */
export function distanceToRect(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dy = Math.max(r.y0 - y, 0, y - r.y1);
  return Math.hypot(dx, dy);
}

/** The visible part of a paint: its image square mapped to the page, cut by its clip. */
export function paintRect(transform: Matrix, clip: Rect | null): Rect | null {
  const placed = transformRect(transform, { x0: 0, y0: 0, x1: 1, y1: 1 });
  return clip === null ? placed : intersect(placed, clip);
}

export function roundRect(r: Rect, digits = 2): Rect {
  const f = 10 ** digits;
  const q = (v: number): number => Math.round(v * f) / f;
  return { x0: q(r.x0), y0: q(r.y0), x1: q(r.x1), y1: q(r.y1) };
}
