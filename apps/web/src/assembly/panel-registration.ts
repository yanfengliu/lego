/**
 * The scale and shift that carry one printed panel onto another.
 *
 * `panelDelta` differences step N's picture against step N+1's and reads what
 * emerged as where step N's part went. On a synthetic booklet both panels are
 * rendered with one camera into one raster, so the two agree pixel for pixel by
 * construction and the difference is the step. A printed booklet supplies no
 * such thing: each panel is a separate drawing, laid out in whatever cell of the
 * page it was given, and cropped to its own raster. The model is redrawn at a
 * scale that follows how big it has grown and placed wherever the cell has room.
 *
 * So a real pair has to be registered before it can be differenced, and the
 * registration is a measurement with an error bar rather than a given.
 *
 * Only scale and translation. Two panels drawn with the same axonometric camera
 * differ in the image by exactly a uniform scale and a shift, so a similarity is
 * the whole transform when the cameras agree — and when they do not agree, no
 * similarity repairs it and the alignment quality says so. That is the useful
 * property: a booklet that turned the model over between two steps cannot be
 * registered, and this reports a low agreement rather than a confident wrong
 * answer.
 */
import {
  PANEL_REGISTRATION_SCHEMA_VERSION,
  PanelRegistrationError,
  requireMask,
  requireRaster,
  type MaskRaster,
  type PanelRaster,
} from "./panel-art";

/** `target = scale * source + offset`, in pixels. */
export interface SimilarityTransform {
  readonly scale: number;
  readonly offsetXPx: number;
  readonly offsetYPx: number;
}

function requireTransform(transform: SimilarityTransform): void {
  if (!(transform.scale > 0) || !Number.isFinite(transform.scale)) {
    throw new PanelRegistrationError(
      `A panel transform's scale must be a positive finite number, received ${String(transform.scale)}. ` +
        `It is the ratio of the two panels' pixels per stud, so it is near 1 for two steps drawn at the same zoom and never zero or negative.`,
    );
  }
  if (!Number.isFinite(transform.offsetXPx) || !Number.isFinite(transform.offsetYPx)) {
    throw new PanelRegistrationError(
      `A panel transform's offset must be finite, received (${String(transform.offsetXPx)}, ${String(transform.offsetYPx)}).`,
    );
  }
}

/** Carries a mask from its own raster onto another, nearest-neighbour. */
export function warpMask(
  source: MaskRaster,
  target: { readonly width: number; readonly height: number },
  transform: SimilarityTransform,
): Uint8Array {
  requireMask(source, "warp source");
  requireTransform(transform);
  const out = new Uint8Array(target.width * target.height);
  const inverse = 1 / transform.scale;
  for (let y = 0; y < target.height; y += 1) {
    const sourceY = Math.round((y - transform.offsetYPx) * inverse);
    if (sourceY < 0 || sourceY >= source.height) continue;
    for (let x = 0; x < target.width; x += 1) {
      const sourceX = Math.round((x - transform.offsetXPx) * inverse);
      if (sourceX < 0 || sourceX >= source.width) continue;
      if (source.mask[sourceY * source.width + sourceX] === 1) out[y * target.width + x] = 1;
    }
  }
  return out;
}

/**
 * Carries a panel's art onto another panel's raster, bilinear.
 *
 * The interpolation is the honest cost of registering two printed drawings:
 * resampling a hard edge onto a shifted grid invents intermediate greys along
 * every boundary, and those greys are what a difference threshold has to clear.
 * Anything outside the source lands on the page colour, so a panel that does not
 * cover the whole target frame reads as page there rather than as black.
 */
export function warpRaster(
  source: PanelRaster,
  target: { readonly width: number; readonly height: number },
  transform: SimilarityTransform,
  backgroundHex: number,
): Uint8ClampedArray {
  requireRaster(source, "warp source");
  requireTransform(transform);
  const out = new Uint8ClampedArray(target.width * target.height * 4);
  const red = (backgroundHex >> 16) & 0xff;
  const green = (backgroundHex >> 8) & 0xff;
  const blue = backgroundHex & 0xff;
  for (let pixel = 0; pixel < target.width * target.height; pixel += 1) {
    out[pixel * 4] = red;
    out[pixel * 4 + 1] = green;
    out[pixel * 4 + 2] = blue;
    out[pixel * 4 + 3] = 255;
  }
  const inverse = 1 / transform.scale;
  for (let y = 0; y < target.height; y += 1) {
    const sourceY = (y - transform.offsetYPx) * inverse;
    const y0 = Math.floor(sourceY);
    const fy = sourceY - y0;
    if (y0 < 0 || y0 + 1 >= source.height) continue;
    for (let x = 0; x < target.width; x += 1) {
      const sourceX = (x - transform.offsetXPx) * inverse;
      const x0 = Math.floor(sourceX);
      const fx = sourceX - x0;
      if (x0 < 0 || x0 + 1 >= source.width) continue;
      const topLeft = (y0 * source.width + x0) * 4;
      const topRight = topLeft + 4;
      const bottomLeft = topLeft + source.width * 4;
      const bottomRight = bottomLeft + 4;
      const at = (y * target.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const top =
          source.pixels[topLeft + channel]! * (1 - fx) + source.pixels[topRight + channel]! * fx;
        const bottom =
          source.pixels[bottomLeft + channel]! * (1 - fx) +
          source.pixels[bottomRight + channel]! * fx;
        out[at + channel] = top * (1 - fy) + bottom * fy;
      }
      out[at + 3] = 255;
    }
  }
  return out;
}

export interface PanelAlignmentOptions {
  /**
   * The scale the two panels' fitted cameras imply, as
   * `pixelsPerUnit(current) / pixelsPerUnit(next)`. The search starts here and
   * reports how far it had to move, which is the lattice fit's own error.
   */
  readonly scaleGuess: number;
  /** Fractional half-width of the scale search. Defaults to 0.06. */
  readonly scaleSpan?: number;
  /** Scale samples across that span. Defaults to 13. */
  readonly scaleSteps?: number;
  /** Downsampling for the coarse pass. Defaults to 4. */
  readonly coarseStridePx?: number;
  /** Translation half-width of the coarse search around aligned centroids. Defaults to 160. */
  readonly searchRadiusPx?: number;
}

export interface PanelAlignment {
  readonly schemaVersion: typeof PANEL_REGISTRATION_SCHEMA_VERSION;
  readonly transform: SimilarityTransform;
  /** Agreement of the two assembly masks at the transform found. */
  readonly iou: number;
  /** Agreement at the lattice's own scale with the centroids simply superposed. */
  readonly iouAtCentroids: number;
  /** Agreement with no transform at all, which is what an unregistered pair gets. */
  readonly iouUnregistered: number;
  /** How far the best scale sits from the lattice's, as a fraction. */
  readonly scaleCorrectionFraction: number;
  /**
   * The scale that won sat on the edge of the range searched, so it is where
   * the search ran out rather than where the objective turned over.
   *
   * It happens for a reason. Region agreement is biased in scale — the model
   * grows between the panels, so shrinking the next one raises the overlap —
   * and left to itself the search walks to the wall. A caller that measured the
   * scale from the camera fit passes one step and never sees this; a caller
   * that had to search it must not read the answer as a measurement.
   */
  readonly scaleAtSearchBoundary: boolean;
  /** How far the assembly had to be moved, over and above matching centroids. */
  readonly centroidCorrectionPx: number;
  /** Distance between the two panels' assembly centroids before any transform. */
  readonly rawCentroidGapPx: number;
  readonly candidatesTried: number;
}

interface SparseMask {
  readonly xs: Int32Array;
  readonly ys: Int32Array;
  readonly count: number;
}

function sparse(mask: Uint8Array, width: number, height: number, stride: number): SparseMask {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      if (mask[y * width + x] === 1) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  return { xs: Int32Array.from(xs), ys: Int32Array.from(ys), count: xs.length };
}

function centroid(
  mask: Uint8Array,
  width: number,
  height: number,
): { x: number; y: number; count: number } {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      sumX += x;
      sumY += y;
      count += 1;
    }
  }
  return count === 0 ? { x: 0, y: 0, count } : { x: sumX / count, y: sumY / count, count };
}

/**
 * Intersection over union of a sparse source, warped, against a dense target.
 *
 * Counted over distinct target pixels, which is the whole difficulty. Warping
 * down a scale collapses several source pixels onto one target pixel, and
 * counting them once each makes shrinking the source pay: the first version of
 * this scored every pair at the smallest scale it was offered and returned
 * agreements above 100%. The stamp is what makes a pixel count once.
 */
function agreement(
  source: SparseMask,
  target: Uint8Array,
  targetWidth: number,
  targetHeight: number,
  targetCount: number,
  transform: SimilarityTransform,
  stamp: Int32Array,
  generation: number,
): number {
  let intersection = 0;
  let warpedCount = 0;
  for (let index = 0; index < source.count; index += 1) {
    const x = Math.round(source.xs[index]! * transform.scale + transform.offsetXPx);
    if (x < 0 || x >= targetWidth) continue;
    const y = Math.round(source.ys[index]! * transform.scale + transform.offsetYPx);
    if (y < 0 || y >= targetHeight) continue;
    const at = y * targetWidth + x;
    if (stamp[at] === generation) continue;
    stamp[at] = generation;
    warpedCount += 1;
    if (target[at] === 1) intersection += 1;
  }
  const union = warpedCount + targetCount - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * The scale and shift that carry the next panel's assembly onto this one's.
 *
 * Search rather than solve, because the two masks are not the same shape: the
 * next panel draws a part this one does not, and a closed-form fit of moments
 * would be pulled by it. A brute-force maximum of region agreement is dominated
 * by the assembly the two panels share, which is what should decide the answer.
 */
export function alignPanelMasks(
  next: MaskRaster,
  current: MaskRaster,
  options: PanelAlignmentOptions,
): PanelAlignment {
  requireMask(next, "next assembly");
  requireMask(current, "current assembly");
  if (!(options.scaleGuess > 0) || !Number.isFinite(options.scaleGuess)) {
    throw new PanelRegistrationError(
      `alignPanelMasks needs a positive finite scaleGuess, received ${String(options.scaleGuess)}. ` +
        `Pass the ratio of the two panels' fitted pixels per stud; pass 1 when neither camera was fitted.`,
    );
  }
  const scaleSpan = options.scaleSpan ?? 0.06;
  const scaleSteps = options.scaleSteps ?? 13;
  const stride = options.coarseStridePx ?? 4;
  const radius = options.searchRadiusPx ?? 160;
  for (const [label, value, least] of [
    ["scaleSteps", scaleSteps, 1],
    ["coarseStridePx", stride, 1],
    ["searchRadiusPx", radius, 0],
  ] as const) {
    if (!Number.isInteger(value) || value < least) {
      throw new PanelRegistrationError(
        `alignPanelMasks needs ${label} to be a whole number of at least ${least}, received ${String(value)}. ` +
          `A fractional stride makes the coarse raster empty and a negative radius searches no offsets at all, and both come back as a confident alignment at the centroid.`,
      );
    }
  }
  if (!(scaleSpan >= 0) || !Number.isFinite(scaleSpan)) {
    throw new PanelRegistrationError(
      `alignPanelMasks needs a non-negative finite scaleSpan, received ${String(scaleSpan)}. ` +
        `Pass 0 with scaleSteps 1 to hold the scale the camera fit measured.`,
    );
  }

  const nextCentroid = centroid(next.mask, next.width, next.height);
  const currentCentroid = centroid(current.mask, current.width, current.height);
  if (nextCentroid.count === 0 || currentCentroid.count === 0) {
    throw new PanelRegistrationError(
      `alignPanelMasks was handed an empty assembly mask: the step N panel has ${currentCentroid.count} set pixels and the step N+1 panel has ${nextCentroid.count}. ` +
        `A panel whose art keyed to nothing was cropped off the drawing or keyed against the wrong page colour.`,
    );
  }

  let currentCount = 0;
  for (let pixel = 0; pixel < current.mask.length; pixel += 1) {
    if (current.mask[pixel] === 1) currentCount += 1;
  }
  // The coarse pass runs on a genuinely smaller raster rather than on strided
  // samples of the full one. Sampling one raster and counting against another
  // leaves the union scale-dependent, and a search whose denominator moves with
  // the parameter it is searching over finds the edge of its own range.
  const coarseWidth = Math.max(1, Math.ceil(current.width / stride));
  const coarseHeight = Math.max(1, Math.ceil(current.height / stride));
  const coarseTarget = new Uint8Array(coarseWidth * coarseHeight);
  let coarseTargetCount = 0;
  for (let y = 0; y < coarseHeight; y += 1) {
    for (let x = 0; x < coarseWidth; x += 1) {
      const sourceY = Math.min(current.height - 1, y * stride);
      const sourceX = Math.min(current.width - 1, x * stride);
      if (current.mask[sourceY * current.width + sourceX] !== 1) continue;
      coarseTarget[y * coarseWidth + x] = 1;
      coarseTargetCount += 1;
    }
  }
  const coarseSource = sparse(next.mask, next.width, next.height, stride);
  // Source samples are already `stride` apart in the source; dividing their
  // coordinates by `stride` puts them one apart in the coarse target.
  const coarseSourceScaled: SparseMask = {
    xs: Int32Array.from(coarseSource.xs, (value) => Math.round(value / stride)),
    ys: Int32Array.from(coarseSource.ys, (value) => Math.round(value / stride)),
    count: coarseSource.count,
  };
  const coarseStamp = new Int32Array(coarseWidth * coarseHeight).fill(-1);
  const fineStamp = new Int32Array(current.width * current.height).fill(-1);
  let generation = 0;

  const offsetFor = (scale: number, dx: number, dy: number): SimilarityTransform => ({
    scale,
    offsetXPx: currentCentroid.x - scale * nextCentroid.x + dx,
    offsetYPx: currentCentroid.y - scale * nextCentroid.y + dy,
  });
  const coarseAgreement = (transform: SimilarityTransform): number => {
    generation += 1;
    return agreement(
      coarseSourceScaled,
      coarseTarget,
      coarseWidth,
      coarseHeight,
      coarseTargetCount,
      {
        ...transform,
        offsetXPx: transform.offsetXPx / stride,
        offsetYPx: transform.offsetYPx / stride,
      },
      coarseStamp,
      generation,
    );
  };

  let best = offsetFor(options.scaleGuess, 0, 0);
  let bestIou = coarseAgreement(best);
  let tried = 1;
  for (let step = 0; step < scaleSteps; step += 1) {
    const scale =
      scaleSteps === 1
        ? options.scaleGuess
        : options.scaleGuess * (1 - scaleSpan + (2 * scaleSpan * step) / (scaleSteps - 1));
    for (let dy = -radius; dy <= radius; dy += stride) {
      for (let dx = -radius; dx <= radius; dx += stride) {
        const transform = offsetFor(scale, dx, dy);
        const iou = coarseAgreement(transform);
        tried += 1;
        if (iou > bestIou) {
          bestIou = iou;
          best = transform;
        }
      }
    }
  }

  // Refinement at full resolution. The coarse pass samples one pixel in
  // `stride`, which finds the basin; the pixel the answer sits on is decided
  // here, over every set pixel and a scale grid sixteen times finer.
  const fineSource = sparse(next.mask, next.width, next.height, 1);
  const fineAgreement = (transform: SimilarityTransform): number => {
    generation += 1;
    return agreement(
      fineSource,
      current.mask,
      current.width,
      current.height,
      currentCount,
      transform,
      fineStamp,
      generation,
    );
  };
  const scaleStep = scaleSteps === 1 ? 0 : (2 * scaleSpan * options.scaleGuess) / (scaleSteps - 1);
  // Measured here rather than in the coarse pass, so that all three agreements
  // this returns are the same quantity at three transforms. Taken off the
  // coarse raster it read ten points low on a pair the search had aligned
  // exactly, purely as a sampling artefact, and the three sit side by side in
  // the report inviting the comparison.
  const iouAtCentroids = fineAgreement(offsetFor(options.scaleGuess, 0, 0));
  let fineBest = best;
  let fineIou = fineAgreement(best);
  // Two passes, because the two parameters have very different reaches. A shift
  // moves the whole mask together and the coarse grid quantised it to `stride`;
  // a scale error does nothing at the anchor and everything at the far end of
  // the model, so a grid a third of a percent wide leaves three pixels of fringe
  // across a nine-hundred-pixel wing — which reads on the overlay as a red edge
  // facing a green one and is easy to mistake for a shift. The second pass is a
  // sixteenth of a coarse scale step, over half a step either way.
  for (const pass of [
    { scaleIndices: 0, scaleDivisor: 1, offsetRadius: stride },
    // A caller that measured the scale rather than guessing it passes one scale
    // step, and then this pass has nothing to refine — repeating the same scale
    // seventeen times would only cost time.
    { scaleIndices: scaleStep === 0 ? 0 : 8, scaleDivisor: 16, offsetRadius: 2 },
  ]) {
    const anchor = fineBest;
    for (let scaleIndex = -pass.scaleIndices; scaleIndex <= pass.scaleIndices; scaleIndex += 1) {
      const scale = anchor.scale + (scaleIndex * scaleStep) / pass.scaleDivisor;
      if (!(scale > 0)) continue;
      // Re-anchoring on the centroid keeps a scale change from also translating
      // the mask, so the two axes of the search stay independent.
      const anchorX = anchor.offsetXPx + (anchor.scale - scale) * nextCentroid.x;
      const anchorY = anchor.offsetYPx + (anchor.scale - scale) * nextCentroid.y;
      for (let dy = -pass.offsetRadius; dy <= pass.offsetRadius; dy += 1) {
        for (let dx = -pass.offsetRadius; dx <= pass.offsetRadius; dx += 1) {
          const transform = { scale, offsetXPx: anchorX + dx, offsetYPx: anchorY + dy };
          const iou = fineAgreement(transform);
          tried += 1;
          if (iou > fineIou) {
            fineIou = iou;
            fineBest = transform;
          }
        }
      }
    }
  }

  const identity: SimilarityTransform = { scale: 1, offsetXPx: 0, offsetYPx: 0 };
  return {
    schemaVersion: PANEL_REGISTRATION_SCHEMA_VERSION,
    transform: fineBest,
    iou: fineIou,
    iouAtCentroids,
    iouUnregistered: fineAgreement(identity),
    scaleCorrectionFraction: (fineBest.scale - options.scaleGuess) / options.scaleGuess,
    scaleAtSearchBoundary:
      scaleSteps > 1 &&
      Math.abs(Math.abs(fineBest.scale - options.scaleGuess) - scaleSpan * options.scaleGuess) <=
        scaleStep,
    centroidCorrectionPx: Math.hypot(
      fineBest.offsetXPx - (currentCentroid.x - fineBest.scale * nextCentroid.x),
      fineBest.offsetYPx - (currentCentroid.y - fineBest.scale * nextCentroid.y),
    ),
    rawCentroidGapPx: Math.hypot(
      currentCentroid.x - nextCentroid.x,
      currentCentroid.y - nextCentroid.y,
    ),
    candidatesTried: tried,
  };
}
