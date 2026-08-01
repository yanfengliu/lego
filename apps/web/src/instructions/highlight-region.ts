/**
 * Turns a step's printed yellow highlight into a region a render can be scored
 * against.
 *
 * The booklet draws a closed yellow outline around exactly the parts a step
 * adds. That is the cheapest possible handle on a step's delta — it keys out of
 * the page almost noise-free — but it is a stroke, not a fill, and a stroke
 * cannot be compared against a rendered silhouette. So each closed stroke is
 * flooded from outside its own bounding box: whatever the flood cannot reach is
 * enclosed, and enclosed plus stroke is the region the step's new parts occupy.
 *
 * Not every stroke closes, and the reason is not noise. Where a step's new part
 * passes behind something already built, the booklet stops the yellow at the
 * occluding edge and never draws across it — page 12's step 5 outlines a plate
 * on three sides and leaves the fourth to the black edge of the wedge in front
 * of it. Such a contour encloses nothing no matter how the stroke is repaired,
 * so both forms are returned: `mask` holds what closed contours enclose, and
 * `strokeMask` holds the keyed yellow itself, which is always present and is
 * what an open contour can still be scored against.
 */
export const HIGHLIGHT_REGION_SCHEMA_VERSION = "lego.highlight-region/1" as const;

export interface HighlightRegionBounds {
  readonly minXPx: number;
  readonly minYPx: number;
  readonly maxXPx: number;
  readonly maxYPx: number;
}

export interface HighlightRegion {
  readonly bounds: HighlightRegionBounds;
  /** Stroke pixels of this outline. */
  readonly outlinePx: number;
  /** Pixels the flood could not reach, so they are inside the outline. */
  readonly enclosedPx: number;
  /** Stroke plus enclosed: what the step's new parts cover. */
  readonly areaPx: number;
  /** The stroke had a gap, so nothing was enclosed by it. */
  readonly leaked: boolean;
}

export interface HighlightExtraction {
  readonly schemaVersion: typeof HIGHLIGHT_REGION_SCHEMA_VERSION;
  readonly width: number;
  readonly height: number;
  /**
   * One byte per pixel, 1 inside a closed highlight. An open contour
   * contributes nothing here, so a region mask never silently means "the
   * outline, and nothing it was supposed to enclose". Row 0 is the top.
   */
  readonly mask: Uint8Array;
  /**
   * The keyed yellow itself, undilated. Always populated, including for the
   * contours that do not close, which is what makes it the fallback a score can
   * fall back to.
   */
  readonly strokeMask: Uint8Array;
  readonly regions: readonly HighlightRegion[];
  /** Closed contours over all contours, the share of steps the fill serves. */
  readonly closedContourRate: number;
  /** Stroke pixels keyed out of the page, before any were discarded as noise. */
  readonly keyedPx: number;
  readonly discardedComponents: number;
  readonly leakedRegions: number;
}

export interface HighlightKeyOptions {
  /**
   * Smallest stroke, in pixels, that can be a step highlight. Printed pages
   * carry a few stray saturated pixels; at a page scale of 2 the real outlines
   * measured 800 to 3700 pixels, so a few hundred separates them cleanly.
   */
  readonly minimumOutlinePx?: number;
  /**
   * How far the stroke is thickened before the flood, in pixels.
   *
   * A printed outline is one or two pixels wide, and where it crosses the dark
   * grey of the model behind it the antialiased pixels blend out of the key
   * entirely. The stroke is then a ring with holes in it, the flood walks
   * straight through, and a step that highlighted three parts encloses one.
   * Thickening first bridges those holes; the cost is at most this many pixels
   * of over-coverage on a boundary, against regions of tens of thousands.
   */
  readonly closeRadiusPx?: number;
}

const DEFAULT_MINIMUM_OUTLINE_PX = 200;
const DEFAULT_CLOSE_RADIUS_PX = 2;

/** Chebyshev dilation, over a stroke sparse enough to walk directly. */
function dilate(stroke: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return stroke;
  const dilated = new Uint8Array(stroke.length);
  for (let index = 0; index < stroke.length; index += 1) {
    if (stroke[index] !== 1) continue;
    const x = index % width;
    const y = (index - x) / width;
    const minX = Math.max(0, x - radius);
    const maxX = Math.min(width - 1, x + radius);
    const minY = Math.max(0, y - radius);
    const maxY = Math.min(height - 1, y + radius);
    for (let row = minY; row <= maxY; row += 1) {
      dilated.fill(1, row * width + minX, row * width + maxX + 1);
    }
  }
  return dilated;
}

/**
 * The booklet's highlight yellow: red and green both high and close together,
 * blue far below both. Page art is grey, black, white or muted, so this keys
 * essentially noise-free — measured over pages 12, 120 and 200 of the sample
 * booklet, every keyed component was a real step outline.
 */
export function isHighlightPixel(red: number, green: number, blue: number): boolean {
  return red > 150 && green > 130 && blue < 110 && Math.abs(red - green) < 70 && red - blue > 70;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(
      `${label} must be a positive integer, received ${String(value)}. ` +
        `It is the raster the page was rendered at, so it comes from the canvas, not from the PDF's point size.`,
    );
  }
  return value;
}

interface Component {
  readonly pixels: number[];
  readonly bounds: HighlightRegionBounds;
}

/** Four-connected components of the keyed stroke, found iteratively. */
function findComponents(stroke: Uint8Array, width: number, height: number): Component[] {
  const labels = new Int32Array(stroke.length).fill(-1);
  const components: Component[] = [];
  const stack: number[] = [];

  for (let seed = 0; seed < stroke.length; seed += 1) {
    if (stroke[seed] !== 1 || labels[seed] !== -1) continue;
    const id = components.length;
    const pixels: number[] = [];
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    stack.push(seed);
    labels[seed] = id;
    while (stack.length > 0) {
      const at = stack.pop()!;
      const x = at % width;
      const y = (at - x) / width;
      pixels.push(at);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const next of [
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
        y > 0 ? at - width : -1,
        y < height - 1 ? at + width : -1,
      ]) {
        if (next >= 0 && stroke[next] === 1 && labels[next] === -1) {
          labels[next] = id;
          stack.push(next);
        }
      }
    }
    components.push({
      pixels,
      bounds: { minXPx: minX, minYPx: minY, maxXPx: maxX, maxYPx: maxY },
    });
  }

  return components;
}

/**
 * Marks everything one closed stroke encloses. The flood starts on a one-pixel
 * skirt around the stroke's own bounding box, so a stroke that touches the edge
 * of the page is still floodable from outside itself, and returns how many
 * pixels it could not reach.
 */
function fillEnclosed(
  component: Component,
  mask: Uint8Array,
  width: number,
  height: number,
): number {
  const { minXPx, minYPx, maxXPx, maxYPx } = component.bounds;
  const x0 = Math.max(0, minXPx - 1);
  const y0 = Math.max(0, minYPx - 1);
  const x1 = Math.min(width - 1, maxXPx + 1);
  const y1 = Math.min(height - 1, maxYPx + 1);
  const boxWidth = x1 - x0 + 1;
  const boxHeight = y1 - y0 + 1;

  const stroke = new Uint8Array(boxWidth * boxHeight);
  for (const pixel of component.pixels) {
    const x = (pixel % width) - x0;
    const y = (pixel - (pixel % width)) / width - y0;
    stroke[y * boxWidth + x] = 1;
  }

  const reached = new Uint8Array(boxWidth * boxHeight);
  const stack: number[] = [];
  const push = (index: number): void => {
    if (stroke[index] === 1 || reached[index] === 1) return;
    reached[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < boxWidth; x += 1) {
    push(x);
    push((boxHeight - 1) * boxWidth + x);
  }
  for (let y = 0; y < boxHeight; y += 1) {
    push(y * boxWidth);
    push(y * boxWidth + boxWidth - 1);
  }
  while (stack.length > 0) {
    const at = stack.pop()!;
    const x = at % boxWidth;
    const y = (at - x) / boxWidth;
    if (x > 0) push(at - 1);
    if (x < boxWidth - 1) push(at + 1);
    if (y > 0) push(at - boxWidth);
    if (y < boxHeight - 1) push(at + boxWidth);
  }

  let enclosed = 0;
  for (let y = 0; y < boxHeight; y += 1) {
    for (let x = 0; x < boxWidth; x += 1) {
      const index = y * boxWidth + x;
      if (stroke[index] === 1 || reached[index] === 1) continue;
      enclosed += 1;
      mask[(y + y0) * width + (x + x0)] = 1;
    }
  }
  for (const pixel of component.pixels) mask[pixel] = 1;
  return enclosed;
}

export function extractHighlightRegions(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: HighlightKeyOptions = {},
): HighlightExtraction {
  requirePositiveInteger(width, "width");
  requirePositiveInteger(height, "height");
  if (pixels.length !== width * height * 4) {
    throw new RangeError(
      `Pixel buffer holds ${pixels.length} bytes but ${width}x${height} RGBA needs ${width * height * 4}. ` +
        `Pass the page raster at the scale it was rendered, not the PDF viewport's own dimensions.`,
    );
  }
  const minimumOutlinePx = options.minimumOutlinePx ?? DEFAULT_MINIMUM_OUTLINE_PX;
  const closeRadiusPx = options.closeRadiusPx ?? DEFAULT_CLOSE_RADIUS_PX;
  if (!Number.isInteger(closeRadiusPx) || closeRadiusPx < 0) {
    throw new RangeError(
      `closeRadiusPx must be a non-negative integer, received ${String(closeRadiusPx)}. ` +
        `It is how many pixels the printed stroke is thickened to bridge its own antialiasing gaps; 0 disables closing.`,
    );
  }

  const keyed = new Uint8Array(width * height);
  let keyedPx = 0;
  for (let index = 0; index < keyed.length; index += 1) {
    const offset = index * 4;
    if (!isHighlightPixel(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!)) continue;
    keyed[index] = 1;
    keyedPx += 1;
  }

  const stroke = dilate(keyed, width, height, closeRadiusPx);
  const components = findComponents(stroke, width, height);
  const significant = components.filter((component) => component.pixels.length >= minimumOutlinePx);
  const mask = new Uint8Array(width * height);
  const regions: HighlightRegion[] = [];
  for (const component of significant) {
    const candidateMask = new Uint8Array(width * height);
    const enclosedPx = fillEnclosed(component, candidateMask, width, height);
    // An open contour contributes nothing: its stroke alone is not a region,
    // and merging it in would make the mask look like a very thin part.
    if (enclosedPx > 0) {
      for (let index = 0; index < mask.length; index += 1) {
        if (candidateMask[index] === 1) mask[index] = 1;
      }
    }
    regions.push({
      bounds: component.bounds,
      outlinePx: component.pixels.length,
      enclosedPx,
      areaPx: component.pixels.length + enclosedPx,
      leaked: enclosedPx === 0,
    });
  }
  regions.sort((left, right) => right.areaPx - left.areaPx);
  const leakedRegions = regions.filter((region) => region.leaked).length;

  return {
    schemaVersion: HIGHLIGHT_REGION_SCHEMA_VERSION,
    width,
    height,
    mask,
    strokeMask: keyed,
    regions,
    keyedPx,
    discardedComponents: components.length - significant.length,
    leakedRegions,
    closedContourRate: regions.length === 0 ? 0 : 1 - leakedRegions / regions.length,
  };
}
