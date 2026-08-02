/**
 * What is left over once two printed panels have been aligned.
 *
 * Registration is never exact on a printed pair, and the two things that decide
 * whether a difference can be read as a placement are here: how far the two
 * drawings' own edges sit apart after the best transform, and how far apart
 * their pixels are where neither panel drew anything new. The first is the
 * misregistration in the unit the exploded score was stress-tested in; the
 * second is the floor a difference threshold has to clear.
 */
import { PanelRegistrationError, requireMask, requireRaster, type PanelRaster } from "./panel-art";

export interface BoundaryOffset {
  /** Boundary pixels of the first mask that were measured. */
  readonly samples: number;
  /**
   * Median distance to the other outline, or null when the median falls past
   * the search radius.
   *
   * Null rather than the radius, because a saturated bucket is not a distance:
   * "no counterpart anywhere within twelve pixels" and "thirteen pixels away"
   * would otherwise print the same number, and on this booklet's badly
   * registered pairs that number was being read as a measurement.
   */
  readonly medianPx: number | null;
  readonly p90Px: number | null;
  /** Share that found the other boundary at all within the search radius. */
  readonly matchedFraction: number;
  readonly searchRadiusPx: number;
}

/**
 * How far apart two aligned drawings actually are, in pixels of edge.
 *
 * This is the registration error in the unit the exploded score cares about.
 * The synthetic booklet's score was measured against a deliberate two-pixel
 * misregistration; this says what a printed pair's is once the best scale and
 * shift have been applied. The median is the statistic because the next panel
 * legitimately draws a part this one does not, and that part's whole outline is
 * unmatched — a mean would be reporting the new part.
 *
 * Chamfer rather than exact Euclidean: the two-pass 3-4 mask is within about 2%
 * over the few pixels that matter here, and an exact transform costs a sort.
 */
export function boundaryOffset(
  from: Uint8Array,
  to: Uint8Array,
  width: number,
  height: number,
  searchRadiusPx = 12,
): BoundaryOffset {
  requireMask({ width, height, mask: from }, "boundary source");
  requireMask({ width, height, mask: to }, "boundary target");
  if (!Number.isInteger(searchRadiusPx) || searchRadiusPx < 1) {
    throw new PanelRegistrationError(
      `boundaryOffset needs a whole search radius of at least one pixel, received ${String(searchRadiusPx)}. ` +
        `It bounds how far an outline may be from its counterpart before the pair is reported as unmatched rather than as far apart.`,
    );
  }
  const far = 1 << 20;
  const distance = new Int32Array(width * height).fill(far);
  for (let pixel = 0; pixel < to.length; pixel += 1) if (to[pixel] === 1) distance[pixel] = 0;
  const relax = (at: number, from_: number, cost: number): void => {
    const candidate = distance[from_]! + cost;
    if (candidate < distance[at]!) distance[at] = candidate;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      if (x > 0) relax(at, at - 1, 3);
      if (y > 0) relax(at, at - width, 3);
      if (x > 0 && y > 0) relax(at, at - width - 1, 4);
      if (x < width - 1 && y > 0) relax(at, at - width + 1, 4);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const at = y * width + x;
      if (x < width - 1) relax(at, at + 1, 3);
      if (y < height - 1) relax(at, at + width, 3);
      if (x < width - 1 && y < height - 1) relax(at, at + width + 1, 4);
      if (x > 0 && y < height - 1) relax(at, at + width - 1, 4);
    }
  }
  const histogram = new Int32Array(searchRadiusPx + 2);
  let samples = 0;
  let matched = 0;
  for (let pixel = 0; pixel < from.length; pixel += 1) {
    if (from[pixel] !== 1) continue;
    samples += 1;
    const px = distance[pixel]! / 3;
    if (px <= searchRadiusPx) {
      matched += 1;
      histogram[Math.round(px)]! += 1;
    } else {
      histogram[searchRadiusPx + 1]! += 1;
    }
  }
  const quantile = (fraction: number): number | null => {
    if (samples === 0) return null;
    let seen = 0;
    for (let value = 0; value < histogram.length; value += 1) {
      seen += histogram[value]!;
      if (seen >= fraction * samples) return value > searchRadiusPx ? null : value;
    }
    return null;
  };
  return {
    samples,
    medianPx: quantile(0.5),
    p90Px: quantile(0.9),
    matchedFraction: samples === 0 ? 0 : matched / samples,
    searchRadiusPx,
  };
}

/**
 * The noise floor of an aligned pair, as the difference two panels show where
 * neither drew anything new.
 *
 * `panelDelta` needs a threshold that separates a placement from the resampling
 * fringe, and on a printed pair that threshold is a property of the pair rather
 * than a constant. It is measured here on the pixels both panels agree are
 * model: whatever difference the bulk of those show is what a placement has to
 * beat.
 */
export interface DifferenceNoise {
  /** Pixels both panels drew model on, which is where the noise was measured. */
  readonly sharedPx: number;
  readonly medianDistance: number;
  readonly p90Distance: number;
  readonly p99Distance: number;
}

export function measureDifferenceNoise(
  current: PanelRaster,
  warpedNext: PanelRaster,
  sharedMask: Uint8Array,
): DifferenceNoise {
  requireRaster(current, "current panel");
  requireRaster(warpedNext, "warped next panel");
  if (current.width !== warpedNext.width || current.height !== warpedNext.height) {
    throw new PanelRegistrationError(
      `Difference noise needs one raster: step N is ${current.width}x${current.height} and the warped step N+1 is ${warpedNext.width}x${warpedNext.height}. ` +
        `Warp the next panel onto this panel's own frame first.`,
    );
  }
  requireMask({ width: current.width, height: current.height, mask: sharedMask }, "shared");
  const histogram = new Int32Array(766);
  let sharedPx = 0;
  for (let pixel = 0; pixel < sharedMask.length; pixel += 1) {
    if (sharedMask[pixel] !== 1) continue;
    const at = pixel * 4;
    const distance =
      Math.abs(current.pixels[at]! - warpedNext.pixels[at]!) +
      Math.abs(current.pixels[at + 1]! - warpedNext.pixels[at + 1]!) +
      Math.abs(current.pixels[at + 2]! - warpedNext.pixels[at + 2]!);
    histogram[Math.min(765, distance)]! += 1;
    sharedPx += 1;
  }
  const quantile = (fraction: number): number => {
    if (sharedPx === 0) return 0;
    let seen = 0;
    const wanted = fraction * sharedPx;
    for (let value = 0; value < histogram.length; value += 1) {
      seen += histogram[value]!;
      if (seen >= wanted) return value;
    }
    return histogram.length - 1;
  };
  return {
    sharedPx,
    medianDistance: quantile(0.5),
    p90Distance: quantile(0.9),
    p99Distance: quantile(0.99),
  };
}
