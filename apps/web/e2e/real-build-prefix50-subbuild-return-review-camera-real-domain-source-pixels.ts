import { isHighlightPixel } from "../src/instructions/highlight-region.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
const WIDTH = 720;
const HEIGHT = 470;
const PIXELS = WIDTH * HEIGHT;
const BACKGROUND = [0x89, 0x90, 0x93] as const;
const MINIMUM_CHILD_CONTOUR_PIXELS = 200;
const CHILD_CONTOUR_CLOSE_RADIUS_PX = 2;
const MAXIMUM_CLOSED_CONTOUR_THICKNESS_PX = 4;
type Sha256Digest = `sha256:${string}`;
type PixelPoint = Readonly<{ x: number; y: number }>;
type PixelComponent = readonly number[];
type Flood = Readonly<{ mask: Uint8Array; enclosedMask: Uint8Array; enclosedPixels: number }>;
type SourceCrop = Readonly<{ x: number; y: number; width: 720; height: 470 }>;
// prettier-ignore
type SourceInput = Readonly<{ pageRgba: Uint8Array; pageWidth: number; crop: SourceCrop }>;
const BOUND_KEYS = ["minX", "minY", "maxX", "maxY"] as const;
// prettier-ignore
export interface RealBuildPrefix50Step44RealDomainExclusionBox { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; }
// prettier-ignore
export interface RealBuildPrefix50Step44RealDomainYellowComponent extends RealBuildPrefix50Step44RealDomainExclusionBox { readonly pixels: number; }
type ContourRoute =
  | "closed-flood"
  | "source-sealed-convex-hull"
  | "source-sealed-dilation-closure"
  | "source-sealed-open-remainder";
// prettier-ignore
export interface RealBuildPrefix50Step44RealDomainContourEvidence extends RealBuildPrefix50Step44RealDomainYellowComponent { readonly contourMaskDigest: Sha256Digest; readonly dilatedOutlinePixelCount: number; readonly enclosedPixelCount: number; readonly route: ContourRoute; readonly childExclusionPixelCount: number; readonly childExclusionMaskDigest: Sha256Digest; }
type BoundsSeal = readonly [minX: number, minY: number, maxX: number, maxY: number] | null;
type MaskSeal = readonly [digest: Sha256Digest, pixels: number, bounds: BoundsSeal];
type SealedRoute = Exclude<ContourRoute, "closed-flood">;
// prettier-ignore
type RouteSeal = readonly [source: Sha256Digest, contour: Sha256Digest, route: SealedRoute, result: MaskSeal, remainder?: MaskSeal];
type FinalSeal = readonly [source: Sha256Digest, child: MaskSeal, edge: MaskSeal];
// prettier-ignore
type ClosedRouteInput = Readonly<{ source: Sha256Digest; contourDigest: Sha256Digest; contour: Uint8Array; enclosed: Uint8Array; result: Uint8Array }>;
const STEP41_SOURCE =
  "sha256:ade43c2e8a605216af03f0a3aeec6cfc7fa2329516936da2ea3df51f713df1c9" as const;
const STEP42_SOURCE =
  "sha256:d99e7b1cc959810d9f4d32dfa5eb2d28e2edeeb6ae600e962e15011070fbab1d" as const;
// Exact calibration seals are intentionally table-shaped and one record per line.
// prettier-ignore
const SEALED_ROUTES: readonly RouteSeal[] = [
  [STEP41_SOURCE, "sha256:931ee11cb74842d4f98caa091a1390e005e2073ff29d1f9df51184c55fd6d004", "source-sealed-convex-hull", ["sha256:a35e697af98f07522fafb04e39ef7ee2669a21660e814ee6fb015ffd94fcecd2", 3823, [134, 164, 216, 227]]],
  [STEP41_SOURCE, "sha256:dcafcba40ae36ad8b80f3648b7edb34e79e701fc571743d9ec9e3c1e50ac16c5", "source-sealed-convex-hull", ["sha256:3cc311cc6a23ea2c7ebcd042007f22e10f1d72555f6a8bc4804be280625d36c3", 3883, [231, 204, 314, 267]]],
  [STEP41_SOURCE, "sha256:1961fbb930ad4afdb85abffed444d94a26c12fa7bf7f34e0452997e8f33d7c49", "source-sealed-convex-hull", ["sha256:e6776c952d9831efc392095781d71b7548caf3f2544df146d6fa6a90a8fb6b05", 4015, [363, 257, 447, 321]]],
  [STEP42_SOURCE, "sha256:f75c11f616c29ba852c567917958c280ec9c097cdaed853ab5d2fe24fc0b208d", "source-sealed-open-remainder", ["sha256:9412e658821d7d176efd0567f8fcb2b0f7889e7e554d205be4e17995273c8acb", 22391, [126, 132, 556, 332]], ["sha256:0258ec91195e859be496dc869c1626bee2e4ef2fc47f16f4d620a1763d48f9d3", 10, [153, 134, 460, 254]]],
];
// prettier-ignore
const PINNED_FINAL_MASKS: readonly FinalSeal[] = [
  [STEP41_SOURCE, ["sha256:0b8f32de293630db3761dda3496795331b867bd2f43e1950046af169f9f61ffd", 15896, [134, 164, 548, 362]], ["sha256:49cb81064db1f07ba6a242e0e3b76b239803fe32c379228ba7bd3a23d46e01ad", 0, null]],
  [STEP42_SOURCE, ["sha256:9412e658821d7d176efd0567f8fcb2b0f7889e7e554d205be4e17995273c8acb", 22391, [126, 132, 556, 332]], ["sha256:8edabcf513158714f6ad7f8a47c7afa2fd6bea4da7857cca4a2a730768711b67", 600, [0, 0, 297, 3]]],
];
const count = (mask: Uint8Array): number => mask.reduce((total, value) => total + value, 0);
function boundsForPixels(pixels: readonly number[]): RealBuildPrefix50Step44RealDomainExclusionBox {
  if (pixels.length === 0)
    throw new TypeError("Real-domain mask bounds require at least one pixel.");
  let minX = WIDTH,
    minY = HEIGHT,
    maxX = -1,
    maxY = -1;
  for (const pixel of pixels) {
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}
function pixelsForMask(mask: Uint8Array): number[] {
  const pixels: number[] = [];
  for (let index = 0; index < mask.length; index += 1) if (mask[index] === 1) pixels.push(index);
  return pixels;
}
function dilateChebyshev(mask: Uint8Array, radius: number): Uint8Array {
  const result = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const x = index % WIDTH;
    const y = Math.floor(index / WIDTH);
    for (let row = Math.max(0, y - radius); row <= Math.min(HEIGHT - 1, y + radius); row += 1)
      result.fill(
        1,
        row * WIDTH + Math.max(0, x - radius),
        row * WIDTH + Math.min(WIDTH - 1, x + radius) + 1,
      );
  }
  return result;
}
function connectedComponents(mask: Uint8Array, connectivity: 4 | 8): PixelComponent[] {
  const seen = new Uint8Array(mask.length);
  const components: PixelComponent[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || seen[start] === 1) continue;
    const queue = [start];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]!;
      const x = index % WIDTH;
      const y = Math.floor(index / WIDTH);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if ((dx === 0 && dy === 0) || (connectivity === 4 && dx !== 0 && dy !== 0)) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= WIDTH || nextY >= HEIGHT) continue;
          const next = nextY * WIDTH + nextX;
          if (mask[next] === 1 && seen[next] === 0) {
            seen[next] = 1;
            queue.push(next);
          }
        }
      }
    }
    components.push(queue);
  }
  return components;
}
function keyedMask(rgba: Uint8Array): Uint8Array {
  const result = new Uint8Array(PIXELS);
  for (let index = 0, offset = 0; index < PIXELS; index += 1, offset += 4)
    if (isHighlightPixel(rgba[offset]!, rgba[offset + 1]!, rgba[offset + 2]!)) result[index] = 1;
  return result;
}
function componentKeyedMask(component: PixelComponent, keyed: Uint8Array): Uint8Array {
  const result = new Uint8Array(PIXELS);
  for (const pixel of component) if (keyed[pixel] === 1) result[pixel] = 1;
  return result;
}
function fillEnclosed(component: PixelComponent): Flood {
  const bounds = boundsForPixels(component);
  const x0 = Math.max(0, bounds.minX - 1);
  const y0 = Math.max(0, bounds.minY - 1);
  const x1 = Math.min(WIDTH - 1, bounds.maxX + 1);
  const y1 = Math.min(HEIGHT - 1, bounds.maxY + 1);
  const boxWidth = x1 - x0 + 1;
  const boxHeight = y1 - y0 + 1;
  const stroke = new Uint8Array(boxWidth * boxHeight);
  for (const pixel of component) {
    const x = (pixel % WIDTH) - x0;
    const y = Math.floor(pixel / WIDTH) - y0;
    stroke[y * boxWidth + x] = 1;
  }
  const reached = new Uint8Array(stroke.length);
  const queue: number[] = [];
  const push = (index: number): void => {
    if (stroke[index] === 1 || reached[index] === 1) return;
    reached[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < boxWidth; x += 1) {
    push(x);
    push((boxHeight - 1) * boxWidth + x);
  }
  for (let y = 0; y < boxHeight; y += 1) {
    push(y * boxWidth);
    push(y * boxWidth + boxWidth - 1);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const at = queue[cursor]!;
    const x = at % boxWidth;
    const y = Math.floor(at / boxWidth);
    if (x > 0) push(at - 1);
    if (x < boxWidth - 1) push(at + 1);
    if (y > 0) push(at - boxWidth);
    if (y < boxHeight - 1) push(at + boxWidth);
  }
  const mask = new Uint8Array(PIXELS);
  const enclosedMask = new Uint8Array(PIXELS);
  let enclosedPixels = 0;
  for (let y = 0; y < boxHeight; y += 1) {
    for (let x = 0; x < boxWidth; x += 1) {
      const local = y * boxWidth + x;
      if (stroke[local] === 1 || reached[local] === 1) continue;
      enclosedPixels += 1;
      const global = (y + y0) * WIDTH + x + x0;
      mask[global] = 1;
      enclosedMask[global] = 1;
    }
  }
  for (const pixel of component) mask[pixel] = 1;
  return { mask, enclosedMask, enclosedPixels };
}
function cross(origin: PixelPoint, left: PixelPoint, right: PixelPoint): number {
  return (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
}
function hullHalf(points: readonly PixelPoint[]): PixelPoint[] {
  const half: PixelPoint[] = [];
  for (const point of points) {
    while (half.length >= 2 && cross(half.at(-2)!, half.at(-1)!, point) <= 0) half.pop();
    half.push(point);
  }
  return half.slice(0, -1);
}

function convexHull(points: readonly PixelPoint[]): readonly PixelPoint[] {
  const unique: PixelPoint[] = [];
  for (const point of [...points].sort((left, right) => left.x - right.x || left.y - right.y))
    if (unique.at(-1)?.x !== point.x || unique.at(-1)?.y !== point.y) unique.push(point);
  return [...hullHalf(unique), ...hullHalf([...unique].reverse())];
}

function fillConvexHull(points: readonly PixelPoint[]): Uint8Array {
  const hull = convexHull(points);
  if (hull.length < 3)
    throw new TypeError("Real-domain certified convex contour has no two-dimensional interior.");
  const bounds = {
    minX: Math.min(...hull.map(({ x }) => x)),
    minY: Math.min(...hull.map(({ y }) => y)),
    maxX: Math.max(...hull.map(({ x }) => x)),
    maxY: Math.max(...hull.map(({ y }) => y)),
  };
  const result = new Uint8Array(PIXELS);
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
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
      if (inside) result[y * WIDTH + x] = 1;
    }
  }
  return result;
}

function requireMaskSeal(mask: Uint8Array, seal: MaskSeal, label: string): void {
  const pixels = pixelsForMask(mask);
  const bounds = pixels.length === 0 ? null : boundsForPixels(pixels);
  const sealedBounds = seal[2];
  if (
    pixels.length !== seal[1] ||
    sha256RealBuildPrefix50Step44ReviewBytes(mask) !== seal[0] ||
    (bounds === null) !== (sealedBounds === null) ||
    (bounds !== null &&
      sealedBounds !== null &&
      !BOUND_KEYS.every((key, index) => bounds[key] === sealedBounds[index]))
  )
    throw new TypeError(`${label} did not reproduce its exact sealed full mask.`);
}

function requireRouteSeal(
  source: Sha256Digest,
  contour: Sha256Digest,
  route: SealedRoute,
  result: Uint8Array,
): void {
  const seal = SEALED_ROUTES.find(
    (candidate) => candidate[0] === source && candidate[1] === contour && candidate[2] === route,
  );
  if (seal === undefined)
    throw new TypeError(
      route === "source-sealed-dilation-closure"
        ? `Dilation-created closure ${contour} requires a module-owned sealed route.`
        : `Open yellow contour ${contour} has no module-owned sealed route.`,
    );
  requireMaskSeal(result, seal[3], `Real-domain ${route} ${contour}`);
}

function closedBoundaryRoute(input: ClosedRouteInput): ContourRoute {
  const support = dilateChebyshev(input.enclosed, MAXIMUM_CLOSED_CONTOUR_THICKNESS_PX);
  const unaccounted = new Uint8Array(PIXELS);
  for (let index = 0; index < PIXELS; index += 1)
    if (input.contour[index] === 1 && support[index] !== 1) unaccounted[index] = 1;
  if (count(unaccounted) === 0) return "closed-flood";
  const seal = SEALED_ROUTES.find(
    (candidate) =>
      candidate[0] === input.source &&
      candidate[1] === input.contourDigest &&
      candidate[2] === "source-sealed-open-remainder",
  );
  if (seal === undefined || seal[4] === undefined)
    throw new TypeError(
      "Real-domain yellow component mixes a closed boundary with an unsealed open branch.",
    );
  requireMaskSeal(unaccounted, seal[4], "Real-domain open contour remainder");
  requireMaskSeal(input.result, seal[3], "Real-domain closed contour with open remainder");
  return "source-sealed-open-remainder";
}

function foregroundMask(rgba: Uint8Array): Uint8Array {
  const result = new Uint8Array(PIXELS);
  for (let index = 0; index < PIXELS; index += 1) {
    const offset = index * 4;
    if (
      rgba[offset + 3] !== 0 &&
      BACKGROUND.some((channel, component) => Math.abs(rgba[offset + component]! - channel) > 10)
    )
      result[index] = 1;
  }
  return result;
}

function pixelTouchesEdge(pixel: number): boolean {
  return (
    pixel < WIDTH || pixel >= PIXELS - WIDTH || pixel % WIDTH === 0 || pixel % WIDTH === WIDTH - 1
  );
}

function classifyEdgeClutter(
  foreground: Uint8Array,
  childExclusion: Uint8Array,
  source: Sha256Digest,
): Uint8Array {
  const remainder = new Uint8Array(PIXELS);
  for (let index = 0; index < PIXELS; index += 1)
    if (foreground[index] === 1 && childExclusion[index] === 0) remainder[index] = 1;
  const edgeComponents = connectedComponents(remainder, 8).filter((pixels) =>
    pixels.some(pixelTouchesEdge),
  );
  const mask = new Uint8Array(PIXELS);
  for (const pixels of edgeComponents) for (const pixel of pixels) mask[pixel] = 1;
  if (count(mask) > 0) {
    const seal = PINNED_FINAL_MASKS.find((candidate) => candidate[0] === source)?.[2];
    if (seal === undefined)
      throw new TypeError("Edge-touching foreground has no module-owned sealed clutter identity.");
    requireMaskSeal(mask, seal, "Real-domain edge clutter");
  }
  return mask;
}

function cropRgba(input: SourceInput): Uint8Array {
  const { pageRgba, pageWidth, crop } = input;
  if (!Number.isSafeInteger(pageWidth) || pageWidth < WIDTH)
    throw new RangeError("Real-domain source page width must be an integer at least 720 pixels.");
  const cropValues = [crop.x, crop.y, crop.width, crop.height];
  if (
    !cropValues.every(Number.isSafeInteger) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width !== WIDTH ||
    crop.height !== HEIGHT
  )
    throw new RangeError("Real-domain source crop must be a non-negative exact 720x470 rectangle.");
  if (pageRgba.byteLength % 4 !== 0)
    throw new RangeError("Real-domain source page must contain exact RGBA bytes.");
  const availablePixels = pageRgba.byteLength / 4;
  const pageHeight = availablePixels / pageWidth;
  if (
    availablePixels % pageWidth !== 0 ||
    !Number.isSafeInteger(pageHeight) ||
    pageHeight < HEIGHT ||
    crop.x > pageWidth - WIDTH ||
    crop.y > pageHeight - HEIGHT
  )
    throw new RangeError("Real-domain source crop exceeds its exact RGBA page raster.");
  const rgba = new Uint8Array(PIXELS * 4);
  for (let row = 0; row < HEIGHT; row += 1) {
    const start = ((crop.y + row) * pageWidth + crop.x) * 4;
    rgba.set(pageRgba.subarray(start, start + WIDTH * 4), row * WIDTH * 4);
  }
  return rgba;
}

function deriveSourcePixels(input: SourceInput, requireFinalSeal: boolean) {
  const rgba = cropRgba(input);
  const sourceCropPixelDigest = sha256RealBuildPrefix50Step44ReviewBytes(rgba);
  const keyed = keyedMask(rgba);
  const highlightPixelCount = count(keyed);
  const dilated = dilateChebyshev(keyed, CHILD_CONTOUR_CLOSE_RADIUS_PX);
  const significant = connectedComponents(dilated, 4).filter(
    (pixels) => pixels.length >= MINIMUM_CHILD_CONTOUR_PIXELS,
  );
  if (significant.length === 0)
    throw new TypeError("Real-domain source contains no significant yellow child contour.");
  const childExclusionMask = new Uint8Array(PIXELS);
  const contours: RealBuildPrefix50Step44RealDomainContourEvidence[] = [];
  const exclusions: RealBuildPrefix50Step44RealDomainExclusionBox[] = [];
  let acceptedHighlightPixelCount = 0;
  for (const component of significant) {
    const contourMask = componentKeyedMask(component, keyed);
    const contourPixels = pixelsForMask(contourMask);
    acceptedHighlightPixelCount += contourPixels.length;
    const contourBounds = boundsForPixels(contourPixels);
    const contourMaskDigest = sha256RealBuildPrefix50Step44ReviewBytes(contourMask);
    const rawFlood = fillEnclosed(contourPixels);
    const closedFlood = fillEnclosed(component);
    let routedMask: Uint8Array;
    let route: RealBuildPrefix50Step44RealDomainContourEvidence["route"];
    if (rawFlood.enclosedPixels > 0) {
      routedMask = closedFlood.mask;
      route = closedBoundaryRoute({
        source: sourceCropPixelDigest,
        contourDigest: contourMaskDigest,
        contour: contourMask,
        enclosed: rawFlood.enclosedMask,
        result: routedMask,
      });
    } else if (closedFlood.enclosedPixels > 0) {
      routedMask = closedFlood.mask;
      route = "source-sealed-dilation-closure";
      requireRouteSeal(sourceCropPixelDigest, contourMaskDigest, route, routedMask);
    } else {
      routedMask = dilateChebyshev(
        fillConvexHull(
          contourPixels.map((pixel) => ({ x: pixel % WIDTH, y: Math.floor(pixel / WIDTH) })),
        ),
        CHILD_CONTOUR_CLOSE_RADIUS_PX,
      );
      route = "source-sealed-convex-hull";
      requireRouteSeal(sourceCropPixelDigest, contourMaskDigest, route, routedMask);
    }
    if (contourPixels.some((pixel) => routedMask[pixel] !== 1))
      throw new TypeError("Real-domain route left yellow contour pixels unaccounted.");
    for (let index = 0; index < PIXELS; index += 1) {
      if (routedMask[index] !== 1) continue;
      if (childExclusionMask[index] === 1)
        throw new TypeError(
          "Real-domain routed child contours overlap; refuse ambiguous child ownership.",
        );
      childExclusionMask[index] = 1;
    }
    const routedPixels = pixelsForMask(routedMask);
    exclusions.push(boundsForPixels(routedPixels));
    contours.push({
      pixels: contourPixels.length,
      ...contourBounds,
      contourMaskDigest,
      dilatedOutlinePixelCount: component.length,
      enclosedPixelCount: closedFlood.enclosedPixels,
      route,
      childExclusionPixelCount: routedPixels.length,
      childExclusionMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(routedMask),
    });
  }
  const ignoredHighlightPixelCount = highlightPixelCount - acceptedHighlightPixelCount;
  if (ignoredHighlightPixelCount !== 0)
    throw new TypeError(`Unclassified yellow source pixels: ${ignoredHighlightPixelCount}.`);
  const foreground = foregroundMask(rgba);
  const edgeClutter = classifyEdgeClutter(foreground, childExclusionMask, sourceCropPixelDigest);
  const finalSeal = PINNED_FINAL_MASKS.find((candidate) => candidate[0] === sourceCropPixelDigest);
  if (finalSeal === undefined && requireFinalSeal)
    throw new TypeError("Real-domain source has no module-owned sealed final masks.");
  if (finalSeal !== undefined) {
    requireMaskSeal(childExclusionMask, finalSeal[1], "Real-domain child exclusion");
    requireMaskSeal(edgeClutter, finalSeal[2], "Real-domain edge clutter");
  }
  const eligibleMask = new Uint8Array(PIXELS);
  const parentOnlyForegroundMask = new Uint8Array(PIXELS);
  let childForegroundPixelCount = 0;
  for (let index = 0; index < PIXELS; index += 1) {
    if (childExclusionMask[index] === 1) {
      if (foreground[index] === 1) childForegroundPixelCount += 1;
      continue;
    }
    if (edgeClutter[index] === 1) continue;
    eligibleMask[index] = 1;
    if (foreground[index] === 1) parentOnlyForegroundMask[index] = 1;
  }
  const foregroundPixelCount = count(foreground);
  const edgeClutterPixelCount = count(edgeClutter);
  const parentOnlyForegroundPixelCount = count(parentOnlyForegroundMask);
  if (
    foregroundPixelCount !==
    childForegroundPixelCount + edgeClutterPixelCount + parentOnlyForegroundPixelCount
  )
    throw new TypeError("Real-domain foreground partition is not exact.");
  return {
    rgba,
    // prettier-ignore
    yellowComponents: contours.map(({ pixels, minX, minY, maxX, maxY }) => ({ pixels, minX, minY, maxX, maxY })),
    exclusions,
    contours,
    childExclusionMask,
    edgeClutterMask: edgeClutter,
    eligibleMask,
    parentOnlyForegroundMask,
    accounting: Object.freeze({
      sourceCropPixelDigest,
      highlightPixelCount,
      ignoredHighlightPixelCount,
      childExclusionPixelCount: count(childExclusionMask),
      childExclusionMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(childExclusionMask),
      foregroundPixelCount,
      childForegroundPixelCount,
      edgeClutterPixelCount,
      edgeClutterMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(edgeClutter),
      eligiblePixelCount: count(eligibleMask),
      eligibleMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(eligibleMask),
      parentOnlyForegroundPixelCount,
      parentOnlyForegroundMaskDigest:
        sha256RealBuildPrefix50Step44ReviewBytes(parentOnlyForegroundMask),
    }),
  };
}

export const deriveUnsealedRealBuildPrefix50Step44SourcePixelsForTest = (input: SourceInput) =>
  deriveSourcePixels(input, false);
export const deriveRealBuildPrefix50Step44RealDomainSourcePixels = (input: SourceInput) =>
  deriveSourcePixels(input, true);
