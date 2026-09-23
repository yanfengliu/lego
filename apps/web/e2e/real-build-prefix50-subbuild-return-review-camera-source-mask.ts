import type { PixelBoxPx } from "@lego-studio/rendering";

import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-source-commitments.ts";

const MINIMUM_PRIMARY_COMPONENT_PIXELS = 64;
const MINIMUM_PRIMARY_COMPONENT_WIDTH_PX = 180;
const MINIMUM_PRIMARY_COMPONENT_HEIGHT_PX = 60;
const MINIMUM_CONTOUR_FRAGMENT_PIXELS = 16;
const MAXIMUM_CONTOUR_FRAGMENT_THICKNESS_PX = 8;
const MAXIMUM_CONTOUR_FRAGMENT_TO_PRIMARY_RATIO_DENOMINATOR = 16;
const CHILD_EXCLUSION_DILATION_RADIUS_PX = 1;

interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

interface YellowComponent {
  readonly points: readonly PixelPoint[];
  readonly bounds: PixelBoxPx;
}

export interface RealBuildPrefix50Step44YellowChildMaskEvidence {
  readonly strategy: "yellow-highlight-convex-hull-plus-one-pixel-chebyshev-dilation-and-pre-highlight-annotation-band";
  readonly highlightThreshold: {
    readonly redGreaterThan: 180;
    readonly greenGreaterThan: 140;
    readonly blueLessThan: 110;
    readonly redGreenDeltaLessThan: 100;
    readonly greenBlueDeltaGreaterThan: 60;
  };
  readonly componentSelection: {
    readonly connectivity: 8;
    readonly strategy: "unique-spanning-component-plus-contained-thin-fragments";
    readonly minimumFragmentPixels: 16;
    readonly maximumFragmentThicknessPx: 8;
    readonly maximumFragmentToPrimaryPixelRatioDenominator: 16;
  };
  readonly fillStrategy: "integer-pixel-center-convex-hull-inclusive";
  readonly childExclusionDilation: {
    readonly metric: "chebyshev";
    readonly radiusPx: 1;
  };
  readonly thresholdHighlightPixelCount: number;
  readonly highlightComponentCount: number;
  readonly selectedHighlightComponentCount: number;
  readonly ignoredHighlightPixelCount: number;
  readonly primaryHighlightComponentPixelCount: number;
  readonly primaryHighlightComponentMaskDigest: `sha256:${string}`;
  readonly highlightPixelCount: number;
  readonly highlightBounds: PixelBoxPx;
  readonly highlightMaskDigest: `sha256:${string}`;
  readonly filledHighlightPixelCount: number;
  readonly filledHighlightMaskDigest: `sha256:${string}`;
  readonly highlightedChildExclusionPixelCount: number;
  readonly highlightedChildExclusionBounds: PixelBoxPx;
  readonly highlightedChildExclusionMaskDigest: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44YellowChildMaskDerivation {
  readonly evidence: RealBuildPrefix50Step44YellowChildMaskEvidence;
  readonly highlightMask: Uint8Array;
  readonly filledHighlightMask: Uint8Array;
  readonly highlightedChildExclusionMask: Uint8Array;
}

function maskBounds(mask: Uint8Array): PixelBoxPx | null {
  let minXPx = REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH;
  let minYPx = REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT;
  let maxXPx = -1;
  let maxYPx = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const x = index % REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH;
    const y = Math.floor(index / REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH);
    minXPx = Math.min(minXPx, x);
    minYPx = Math.min(minYPx, y);
    maxXPx = Math.max(maxXPx, x);
    maxYPx = Math.max(maxYPx, y);
  }
  return maxXPx < 0 ? null : { minXPx, minYPx, maxXPx, maxYPx };
}

function thresholdYellow(rgba: Uint8Array): Uint8Array {
  const result = new Uint8Array(rgba.length / 4);
  for (let index = 0; index < result.length; index += 1) {
    const offset = index * 4;
    const red = rgba[offset]!;
    const green = rgba[offset + 1]!;
    const blue = rgba[offset + 2]!;
    if (red > 180 && green > 140 && blue < 110 && red - green < 100 && green - blue > 60)
      result[index] = 1;
  }
  return result;
}

function connectedComponents(mask: Uint8Array): readonly YellowComponent[] {
  const width = REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH;
  const height = REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT;
  const seen = new Uint8Array(mask.length);
  const components: YellowComponent[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || seen[start] === 1) continue;
    const queue = [start];
    const points: PixelPoint[] = [];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]!;
      const x = index % width;
      const y = Math.floor(index / width);
      points.push({ x, y });
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (mask[next] === 1 && seen[next] === 0) {
            seen[next] = 1;
            queue.push(next);
          }
        }
      }
    }
    const componentMask = new Uint8Array(mask.length);
    for (const point of points) componentMask[point.y * width + point.x] = 1;
    components.push({ points, bounds: maskBounds(componentMask)! });
  }
  return components.sort((left, right) => {
    if (left.points.length !== right.points.length) return right.points.length - left.points.length;
    const leftArea =
      (left.bounds.maxXPx - left.bounds.minXPx + 1) * (left.bounds.maxYPx - left.bounds.minYPx + 1);
    const rightArea =
      (right.bounds.maxXPx - right.bounds.minXPx + 1) *
      (right.bounds.maxYPx - right.bounds.minYPx + 1);
    if (leftArea !== rightArea) return rightArea - leftArea;
    if (left.bounds.minYPx !== right.bounds.minYPx) return left.bounds.minYPx - right.bounds.minYPx;
    return left.bounds.minXPx - right.bounds.minXPx;
  });
}

function containedBy(inner: PixelBoxPx, outer: PixelBoxPx): boolean {
  return (
    inner.minXPx >= outer.minXPx &&
    inner.minYPx >= outer.minYPx &&
    inner.maxXPx <= outer.maxXPx &&
    inner.maxYPx <= outer.maxYPx
  );
}

function isContourFragment(component: YellowComponent, primary: YellowComponent): boolean {
  const width = component.bounds.maxXPx - component.bounds.minXPx + 1;
  const height = component.bounds.maxYPx - component.bounds.minYPx + 1;
  return (
    containedBy(component.bounds, primary.bounds) &&
    component.points.length >= MINIMUM_CONTOUR_FRAGMENT_PIXELS &&
    component.points.length * MAXIMUM_CONTOUR_FRAGMENT_TO_PRIMARY_RATIO_DENOMINATOR <=
      primary.points.length &&
    Math.min(width, height) <= MAXIMUM_CONTOUR_FRAGMENT_THICKNESS_PX
  );
}

function isSpanningComponent(component: YellowComponent): boolean {
  return (
    component.points.length >= MINIMUM_PRIMARY_COMPONENT_PIXELS &&
    component.bounds.maxXPx - component.bounds.minXPx + 1 >= MINIMUM_PRIMARY_COMPONENT_WIDTH_PX &&
    component.bounds.maxYPx - component.bounds.minYPx + 1 >= MINIMUM_PRIMARY_COMPONENT_HEIGHT_PX
  );
}

function cross(origin: PixelPoint, left: PixelPoint, right: PixelPoint): number {
  return (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
}

function convexHull(points: readonly PixelPoint[]): readonly PixelPoint[] {
  const ordered = [...points].sort((left, right) => left.x - right.x || left.y - right.y);
  const unique = ordered.filter(
    (point, index) =>
      index === 0 || point.x !== ordered[index - 1]!.x || point.y !== ordered[index - 1]!.y,
  );
  const lower: PixelPoint[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: PixelPoint[] = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function fillConvexHull(points: readonly PixelPoint[], pixelCount: number): Uint8Array {
  const hull = convexHull(points);
  if (hull.length < 3)
    throw new TypeError("Step-44 yellow child contour cannot form a filled two-dimensional hull.");
  const result = new Uint8Array(pixelCount);
  const xs = hull.map((point) => point.x);
  const ys = hull.map((point) => point.y);
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1) {
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1) {
      let sign = 0;
      let inside = true;
      for (let edge = 0; edge < hull.length; edge += 1) {
        const value = cross(hull[edge]!, hull[(edge + 1) % hull.length]!, { x, y });
        if (value === 0) continue;
        const nextSign = Math.sign(value);
        if (sign === 0) sign = nextSign;
        else if (sign !== nextSign) {
          inside = false;
          break;
        }
      }
      if (inside) result[y * REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH + x] = 1;
    }
  }
  return result;
}

function dilateChebyshevOne(mask: Uint8Array): Uint8Array {
  const width = REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH;
  const height = REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT;
  const result = new Uint8Array(mask);
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    for (
      let dy = -CHILD_EXCLUSION_DILATION_RADIUS_PX;
      dy <= CHILD_EXCLUSION_DILATION_RADIUS_PX;
      dy += 1
    ) {
      for (
        let dx = -CHILD_EXCLUSION_DILATION_RADIUS_PX;
        dx <= CHILD_EXCLUSION_DILATION_RADIUS_PX;
        dx += 1
      ) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX >= 0 && nextY >= 0 && nextX < width && nextY < height)
          result[nextY * width + nextX] = 1;
      }
    }
  }
  return result;
}

function count(mask: Uint8Array): number {
  return mask.reduce((total, value) => total + value, 0);
}

export function deriveRealBuildPrefix50Step44YellowChildMask(
  rgba: Uint8Array,
): RealBuildPrefix50Step44YellowChildMaskDerivation {
  const expectedBytes =
    REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH *
    REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT *
    4;
  if (rgba.byteLength !== expectedBytes)
    throw new RangeError("Step-44 yellow child contour requires exact 720x470 RGBA pixels.");
  const thresholdMask = thresholdYellow(rgba);
  const components = connectedComponents(thresholdMask);
  const spanningComponents = components.filter(isSpanningComponent);
  if (spanningComponents.length !== 1)
    throw new TypeError(
      `Step-44 page-45 crop must contain exactly one mechanically detectable spanning yellow child contour; found ${spanningComponents.length}.`,
    );
  const primary = spanningComponents[0]!;
  const selected = [
    primary,
    ...components.slice(1).filter((component) => isContourFragment(component, primary)),
  ];
  const highlightMask = new Uint8Array(thresholdMask.length);
  for (const component of selected)
    for (const point of component.points)
      highlightMask[point.y * REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH + point.x] = 1;
  const filledHighlightMask = fillConvexHull(
    selected.flatMap((component) => component.points),
    thresholdMask.length,
  );
  const highlightedChildExclusionMask = dilateChebyshevOne(filledHighlightMask);
  const primaryMask = new Uint8Array(thresholdMask.length);
  for (const point of primary.points)
    primaryMask[point.y * REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH + point.x] = 1;
  return {
    highlightMask,
    filledHighlightMask,
    highlightedChildExclusionMask,
    evidence: {
      strategy:
        "yellow-highlight-convex-hull-plus-one-pixel-chebyshev-dilation-and-pre-highlight-annotation-band",
      highlightThreshold: {
        redGreaterThan: 180,
        greenGreaterThan: 140,
        blueLessThan: 110,
        redGreenDeltaLessThan: 100,
        greenBlueDeltaGreaterThan: 60,
      },
      componentSelection: {
        connectivity: 8,
        strategy: "unique-spanning-component-plus-contained-thin-fragments",
        minimumFragmentPixels: MINIMUM_CONTOUR_FRAGMENT_PIXELS,
        maximumFragmentThicknessPx: MAXIMUM_CONTOUR_FRAGMENT_THICKNESS_PX,
        maximumFragmentToPrimaryPixelRatioDenominator:
          MAXIMUM_CONTOUR_FRAGMENT_TO_PRIMARY_RATIO_DENOMINATOR,
      },
      fillStrategy: "integer-pixel-center-convex-hull-inclusive",
      childExclusionDilation: {
        metric: "chebyshev",
        radiusPx: CHILD_EXCLUSION_DILATION_RADIUS_PX,
      },
      thresholdHighlightPixelCount: count(thresholdMask),
      highlightComponentCount: components.length,
      selectedHighlightComponentCount: selected.length,
      ignoredHighlightPixelCount: count(thresholdMask) - count(highlightMask),
      primaryHighlightComponentPixelCount: primary.points.length,
      primaryHighlightComponentMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(primaryMask),
      highlightPixelCount: count(highlightMask),
      highlightBounds: maskBounds(highlightMask)!,
      highlightMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(highlightMask),
      filledHighlightPixelCount: count(filledHighlightMask),
      filledHighlightMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(filledHighlightMask),
      highlightedChildExclusionPixelCount: count(highlightedChildExclusionMask),
      highlightedChildExclusionBounds: maskBounds(highlightedChildExclusionMask)!,
      highlightedChildExclusionMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(
        highlightedChildExclusionMask,
      ),
    },
  };
}
