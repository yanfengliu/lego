/**
 * A binary region and the moments a camera fit and a step score are computed
 * from.
 *
 * Deliberately a plain typed array with no Three.js or DOM in sight: the same
 * type describes a render of our own model and a crop of a booklet page, and
 * the comparison between them is the point. Interior detail is not kept here —
 * that is what makes it a silhouette, and why a silhouette can never tell a
 * jumper plate from a 1x2 plate on its own.
 */
export interface Silhouette {
  readonly width: number;
  readonly height: number;
  /** One byte per pixel, 1 inside the region. Row 0 is the top. */
  readonly mask: Uint8Array;
  readonly area: number;
  /** Pixel centroid, or null when the region is empty. */
  readonly centroidXPx: number | null;
  readonly centroidYPx: number | null;
  /** Inclusive pixel bounds, or null when the region is empty. */
  readonly bounds: {
    readonly minXPx: number;
    readonly minYPx: number;
    readonly maxXPx: number;
    readonly maxYPx: number;
  } | null;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer, received ${String(value)}`);
  }
  return value;
}

export function silhouetteFromMask(mask: Uint8Array, width: number, height: number): Silhouette {
  requirePositiveInteger(width, "width");
  requirePositiveInteger(height, "height");
  if (mask.length !== width * height) {
    throw new RangeError(
      `Mask holds ${mask.length} pixels but ${width}x${height} needs ${width * height}. ` +
        `One byte per pixel, not one per channel — pass an RGBA buffer to silhouetteFromPixels instead.`,
    );
  }

  let area = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (mask[row + x] !== 1) continue;
      area += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return {
    width,
    height,
    mask,
    area,
    centroidXPx: area === 0 ? null : sumX / area,
    centroidYPx: area === 0 ? null : sumY / area,
    bounds: area === 0 ? null : { minXPx: minX, minYPx: minY, maxXPx: maxX, maxYPx: maxY },
  };
}

export interface BackgroundKeyOptions {
  /** The page or render background to subtract, as 0xRRGGBB. */
  readonly backgroundHex: number;
  /**
   * Per-channel distance below which a pixel counts as background. Zero is
   * right for our own renders, which land on the exact background byte; a page
   * raster needs a few counts of slack for its antialiasing.
   */
  readonly tolerance?: number;
}

/**
 * Everything that is not the background. Our instruction renders land on the
 * exact background byte, so the default tolerance of 0 keeps the region exact;
 * a booklet crop needs a little slack for the page's own antialiasing.
 */
export function silhouetteFromPixels(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  { backgroundHex, tolerance = 0 }: BackgroundKeyOptions,
): Silhouette {
  requirePositiveInteger(width, "width");
  requirePositiveInteger(height, "height");
  if (pixels.length !== width * height * 4) {
    throw new RangeError(
      `Pixel buffer holds ${pixels.length} bytes but ${width}x${height} RGBA needs ${width * height * 4}. ` +
        `The width and height must be the ones the renderer was created with, not the ones the camera was fitted to.`,
    );
  }
  if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) {
    throw new RangeError(`tolerance must be an integer in 0..255, received ${String(tolerance)}`);
  }

  const backgroundRed = (backgroundHex >> 16) & 0xff;
  const backgroundGreen = (backgroundHex >> 8) & 0xff;
  const backgroundBlue = backgroundHex & 0xff;
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const isBackground =
      Math.abs(pixels[offset]! - backgroundRed) <= tolerance &&
      Math.abs(pixels[offset + 1]! - backgroundGreen) <= tolerance &&
      Math.abs(pixels[offset + 2]! - backgroundBlue) <= tolerance;
    if (!isBackground) mask[index] = 1;
  }
  return silhouetteFromMask(mask, width, height);
}

export interface SilhouetteOverlap {
  readonly intersection: number;
  readonly union: number;
  /** Intersection over union: 1 when the regions coincide, 0 when disjoint. */
  readonly iou: number;
}

export function overlap(left: Silhouette, right: Silhouette): SilhouetteOverlap {
  if (left.width !== right.width || left.height !== right.height) {
    throw new RangeError(
      `Silhouettes must share a raster to be compared: left is ${left.width}x${left.height}, right is ${right.width}x${right.height}. ` +
        `Render both through the same frame — an instruction render and a page crop only line up when they were sized alike.`,
    );
  }
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.mask.length; index += 1) {
    const inLeft = left.mask[index] === 1;
    const inRight = right.mask[index] === 1;
    if (inLeft && inRight) intersection += 1;
    if (inLeft || inRight) union += 1;
  }
  return { intersection, union, iou: union === 0 ? 0 : intersection / union };
}

/** Clears every pixel of `mask` inside an inclusive pixel box. */
export function clearRegion(
  mask: Uint8Array,
  width: number,
  height: number,
  box: { minXPx: number; minYPx: number; maxXPx: number; maxYPx: number },
): void {
  const minX = Math.max(0, Math.floor(box.minXPx));
  const maxX = Math.min(width - 1, Math.ceil(box.maxXPx));
  const minY = Math.max(0, Math.floor(box.minYPx));
  const maxY = Math.min(height - 1, Math.ceil(box.maxYPx));
  for (let y = minY; y <= maxY; y += 1) {
    mask.fill(0, y * width + minX, y * width + maxX + 1);
  }
}

function requireNonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(
      `${label} must be a non-negative integer, received ${String(value)}. ` +
        `It is a distance in pixels of the raster being compared, so it scales with the render size, not with the model.`,
    );
  }
  return value;
}

/**
 * Grows a mask by a Chebyshev radius. Used to turn an exact comparison into a
 * tolerant one: two boundaries that agree to within a pixel or two are the same
 * boundary, and demanding they coincide exactly measures the rasteriser rather
 * than the placement.
 */
export function dilateMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  requireNonNegativeInteger(radius, "radius");
  if (mask.length !== width * height) {
    throw new RangeError(
      `Mask holds ${mask.length} pixels but ${width}x${height} needs ${width * height}.`,
    );
  }
  if (radius === 0) return mask.slice();
  const dilated = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const x = index % width;
    const y = (index - x) / width;
    const minX = Math.max(0, x - radius);
    const maxX = Math.min(width - 1, x + radius);
    for (let row = Math.max(0, y - radius); row <= Math.min(height - 1, y + radius); row += 1) {
      dilated.fill(1, row * width + minX, row * width + maxX + 1);
    }
  }
  return dilated;
}

/**
 * The pixels of a mask that touch something outside it, which is the line a
 * booklet would ink. The raster edge counts as outside, so a region running off
 * the frame still has a boundary there rather than silently losing one side.
 */
export function maskBoundary(mask: Uint8Array, width: number, height: number): Uint8Array {
  if (mask.length !== width * height) {
    throw new RangeError(
      `Mask holds ${mask.length} pixels but ${width}x${height} needs ${width * height}.`,
    );
  }
  const boundary = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] !== 1) continue;
      const outside =
        x === 0 ||
        x === width - 1 ||
        y === 0 ||
        y === height - 1 ||
        mask[index - 1] !== 1 ||
        mask[index + 1] !== 1 ||
        mask[index - width] !== 1 ||
        mask[index + width] !== 1;
      if (outside) boundary[index] = 1;
    }
  }
  return boundary;
}

/** How much of `subject` lies within `radius` pixels of `reference`. */
export function coverage(
  subject: Uint8Array,
  reference: Uint8Array,
  width: number,
  height: number,
  radius: number,
): number {
  const reach = dilateMask(reference, width, height, radius);
  let total = 0;
  let covered = 0;
  for (let index = 0; index < subject.length; index += 1) {
    if (subject[index] !== 1) continue;
    total += 1;
    if (reach[index] === 1) covered += 1;
  }
  return total === 0 ? 0 : covered / total;
}
