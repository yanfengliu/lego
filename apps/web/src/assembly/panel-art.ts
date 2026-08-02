import { dilateMask } from "@lego-studio/rendering";

/**
 * Reading a printed panel's art off the page.
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
 * registration is a measurement with an error bar rather than a given. This
 * module is that measurement. It keys the art off the page, isolates the
 * assembly from the ghost and the page furniture, and searches the scale and
 * translation that best carry the next panel onto this one.
 *
 * Only scale and translation. Two panels drawn with the same axonometric camera
 * differ in the image by exactly a uniform scale and a shift, so a similarity is
 * the whole transform when the cameras agree — and when they do not agree, no
 * similarity repairs it and the alignment quality says so. That is the useful
 * property: a booklet that turned the model over between two steps cannot be
 * registered, and this reports a low agreement rather than a confident wrong
 * answer.
 */

export const PANEL_REGISTRATION_SCHEMA_VERSION = "lego.panel-registration/1" as const;

export class PanelRegistrationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PanelRegistrationError";
  }
}

export interface PanelRaster {
  readonly width: number;
  readonly height: number;
  /** RGBA, row 0 at the top. */
  readonly pixels: Uint8ClampedArray;
}

export interface MaskRaster {
  readonly width: number;
  readonly height: number;
  readonly mask: Uint8Array;
}

export interface PixelBounds {
  readonly minXPx: number;
  readonly minYPx: number;
  readonly maxXPx: number;
  readonly maxYPx: number;
}

export function requireRaster(raster: PanelRaster, label: string): void {
  const needed = raster.width * raster.height * 4;
  if (!Number.isInteger(raster.width) || !Number.isInteger(raster.height)) {
    throw new PanelRegistrationError(
      `The ${label} raster is ${String(raster.width)}x${String(raster.height)}, which is not a whole number of pixels. ` +
        `Crop the panel to integer pixel dimensions before registering it.`,
    );
  }
  if (raster.pixels.length !== needed) {
    throw new PanelRegistrationError(
      `The ${label} raster holds ${raster.pixels.length} bytes but ${raster.width}x${raster.height} RGBA needs ${needed}. ` +
        `Pass the crop's own buffer at the size it was created with.`,
    );
  }
}

export function requireMask(raster: MaskRaster, label: string): void {
  const needed = raster.width * raster.height;
  if (raster.mask.length !== needed) {
    throw new PanelRegistrationError(
      `The ${label} mask holds ${raster.mask.length} bytes but ${raster.width}x${raster.height} needs ${needed}. ` +
        `Build the mask at the raster it describes.`,
    );
  }
}

export interface ArtKeyOptions {
  /** The page colour, as 0xRRGGBB. */
  readonly backgroundHex: number;
  /**
   * Per-channel slack for the page's own antialiasing, on the 0..255 colour
   * scale. Not a distance in pixels — a printed page's grey wanders a few
   * levels and this is how many levels still count as page.
   */
  readonly toleranceLevels?: number;
}

/** Everything that is not the page. */
export function keyPanelArt(raster: PanelRaster, options: ArtKeyOptions): Uint8Array {
  requireRaster(raster, "panel");
  const tolerance = options.toleranceLevels ?? 10;
  const red = (options.backgroundHex >> 16) & 0xff;
  const green = (options.backgroundHex >> 8) & 0xff;
  const blue = options.backgroundHex & 0xff;
  const area = raster.width * raster.height;
  const mask = new Uint8Array(area);
  for (let pixel = 0; pixel < area; pixel += 1) {
    const at = pixel * 4;
    const near =
      Math.abs(raster.pixels[at]! - red) <= tolerance &&
      Math.abs(raster.pixels[at + 1]! - green) <= tolerance &&
      Math.abs(raster.pixels[at + 2]! - blue) <= tolerance;
    if (!near) mask[pixel] = 1;
  }
  return mask;
}

/** Shrinks a mask by a Chebyshev radius; the inverse of `dilateMask`. */
export function erodeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radiusPx: number,
): Uint8Array {
  if (!Number.isInteger(radiusPx) || radiusPx < 0) {
    throw new PanelRegistrationError(
      `erodeMask radiusPx must be a non-negative integer, received ${String(radiusPx)}.`,
    );
  }
  const inverted = new Uint8Array(mask.length);
  for (let pixel = 0; pixel < mask.length; pixel += 1) inverted[pixel] = mask[pixel] === 1 ? 0 : 1;
  const grown = dilateMask(inverted, width, height, radiusPx);
  const eroded = new Uint8Array(mask.length);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    // The raster edge is outside the mask, so a region running off the frame
    // erodes from that side too. Anything else would grow the assembly's
    // silhouette wherever the crop clipped it.
    eroded[pixel] = mask[pixel] === 1 && grown[pixel] !== 1 ? 1 : 0;
  }
  const margin = radiusPx;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= margin && x < width - margin && y >= margin && y < height - margin) continue;
      eroded[y * width + x] = 0;
    }
  }
  return eroded;
}

export function maskBounds(mask: Uint8Array, width: number, height: number): PixelBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (mask[row + x] !== 1) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minXPx: minX, minYPx: minY, maxXPx: maxX, maxYPx: maxY };
}

export interface AssemblyIsolation {
  /** The built model alone: page furniture, ghost and arrows removed. */
  readonly mask: Uint8Array;
  readonly areaPx: number;
  readonly bounds: PixelBounds | null;
  /** How many separate things the panel drew, before the largest was taken. */
  readonly componentCount: number;
  /** Art the isolation dropped, as a share of everything keyed off the page. */
  readonly droppedFraction: number;
  /**
   * The opening was wide enough to erase every component, so the mask is empty
   * and nothing was isolated. Distinguished from "the panel keyed to nothing"
   * because the cure is different: narrow the radius, do not re-key the page.
   */
  readonly erasedByOpening: boolean;
}

export interface AssemblyIsolationOptions {
  /**
   * How thin a bridge is severed before the components are counted.
   *
   * A printed panel connects the ghost to the assembly with an arrow and rings
   * this step's parts in a two-pixel yellow stroke, so keyed art that is three
   * separate objects can arrive as one blob. Opening cuts every stroke thinner
   * than the radius — and cuts the model too, which is why it defaults to off.
   * Measured on the sample booklet at a 1000px panel width, an opening of 3
   * fragmented the art into over a hundred pieces and left the largest holding
   * a sixth of it; the plain largest component fitted a camera on 32 of the
   * first 40 panels. The ghost does not need severing anyway: it is inside this
   * step's own highlight, and `panelDelta` already discounts that.
   */
  readonly openingRadiusPx?: number;
}

/**
 * The assembly alone, as the largest thing the panel drew.
 *
 * A panel holds more than the model: a callout box, a step number, a progress
 * bar, this step's ghost, and the arrows between them. Taking the largest
 * connected component drops most of it without needing to know where any of it
 * is, which is why it is the first move.
 *
 * It is not the whole move. Anything the booklet joins to the model with a
 * printed leader line is in the same connected region and comes through — on
 * the sample booklet that is the sub-assembly boxes, and a 400 by 170 rectangle
 * of one read as a part that appeared between two panels. Run `keyPrintedBoxes`
 * over the art first; this is what to do with what is left.
 */
export function isolateAssembly(
  art: MaskRaster,
  options: AssemblyIsolationOptions = {},
): AssemblyIsolation {
  requireMask(art, "art");
  const { width, height } = art;
  const radius = options.openingRadiusPx ?? 0;
  const core = radius === 0 ? art.mask : erodeMask(art.mask, width, height, radius);
  const label = new Int32Array(width * height).fill(-1);
  const stack: number[] = [];
  let bestLabel = -1;
  let bestSize = 0;
  let components = 0;
  for (let seed = 0; seed < core.length; seed += 1) {
    if (core[seed] !== 1 || label[seed] !== -1) continue;
    const current = components;
    components += 1;
    let size = 0;
    stack.push(seed);
    label[seed] = current;
    while (stack.length > 0) {
      const index = stack.pop()!;
      size += 1;
      const x = index % width;
      const y = (index - x) / width;
      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || core[neighbour] !== 1 || label[neighbour] !== -1) continue;
        label[neighbour] = current;
        stack.push(neighbour);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = current;
    }
  }

  const largestCore = new Uint8Array(width * height);
  // No component at all means the opening erased the art. Labels are -1
  // everywhere then, and testing `label === bestLabel` would match every pixel
  // and hand back the whole art as the assembly — an opening that removed
  // everything reported as one that removed nothing.
  if (bestLabel >= 0) {
    for (let pixel = 0; pixel < largestCore.length; pixel += 1) {
      if (label[pixel] === bestLabel) largestCore[pixel] = 1;
    }
  }
  // Grown back past the erosion and clipped to the art, so the component keeps
  // its own antialiased edge and gains none of its neighbour's. With no opening
  // there is nothing to grow back, and growing anyway would annex a neighbour.
  const grown = radius === 0 ? largestCore : dilateMask(largestCore, width, height, radius + 1);
  const mask = new Uint8Array(width * height);
  let areaPx = 0;
  let artPx = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (art.mask[pixel] === 1) artPx += 1;
    if (grown[pixel] === 1 && art.mask[pixel] === 1) {
      mask[pixel] = 1;
      areaPx += 1;
    }
  }
  return {
    mask,
    areaPx,
    bounds: maskBounds(mask, width, height),
    componentCount: components,
    droppedFraction: artPx === 0 ? 0 : (artPx - areaPx) / artPx,
    /** The opening left nothing, so there was no assembly to take. */
    erasedByOpening: components === 0 && artPx > 0,
  };
}

export interface Downsampled {
  readonly width: number;
  readonly height: number;
}

function downsampledSize(width: number, height: number, factor: number): Downsampled {
  if (!Number.isInteger(factor) || factor < 1) {
    throw new PanelRegistrationError(
      `A downsample factor must be a whole number of pixels per sample, received ${String(factor)}. ` +
        `Pass 1 to keep the raster as it is.`,
    );
  }
  return {
    width: Math.max(1, Math.ceil(width / factor)),
    height: Math.max(1, Math.ceil(height / factor)),
  };
}

/**
 * Point-samples a mask onto a coarser raster.
 *
 * Point rather than area: a candidate sweep compares regions, and an area
 * average would turn a hard mask into a grey one that has to be thresholded
 * again. What is lost is sub-sample position, which is why the caller has to
 * know that its candidates are further apart than the factor.
 */
export function downsampleMask(source: MaskRaster, factor: number): MaskRaster {
  requireMask(source, "downsample source");
  const size = downsampledSize(source.width, source.height, factor);
  const mask = new Uint8Array(size.width * size.height);
  for (let y = 0; y < size.height; y += 1) {
    const sourceY = Math.min(source.height - 1, y * factor);
    for (let x = 0; x < size.width; x += 1) {
      const sourceX = Math.min(source.width - 1, x * factor);
      mask[y * size.width + x] = source.mask[sourceY * source.width + sourceX]!;
    }
  }
  return { width: size.width, height: size.height, mask };
}

/** The same, for colour. Point-sampled for the same reason. */
export function downsampleRaster(source: PanelRaster, factor: number): PanelRaster {
  requireRaster(source, "downsample source");
  const size = downsampledSize(source.width, source.height, factor);
  const pixels = new Uint8ClampedArray(size.width * size.height * 4);
  for (let y = 0; y < size.height; y += 1) {
    const sourceY = Math.min(source.height - 1, y * factor);
    for (let x = 0; x < size.width; x += 1) {
      const sourceX = Math.min(source.width - 1, x * factor);
      const from = (sourceY * source.width + sourceX) * 4;
      const at = (y * size.width + x) * 4;
      pixels[at] = source.pixels[from]!;
      pixels[at + 1] = source.pixels[from + 1]!;
      pixels[at + 2] = source.pixels[from + 2]!;
      pixels[at + 3] = 255;
    }
  }
  return { width: size.width, height: size.height, pixels };
}

export interface PrintedBoxOptions {
  /** How near-white a pixel must be to be box fill. Defaults to 246. */
  readonly whiteLevel?: number;
  /** Smallest white region that is furniture rather than a highlight. Defaults to 400. */
  readonly minimumAreaPx?: number;
  /** How far past the fill the mask reaches, to take the box's ink. Defaults to 6. */
  readonly marginPx?: number;
}

/**
 * The white the booklet prints its furniture on.
 *
 * A step panel is not only the model. It carries the callout box listing the
 * step's parts, sometimes a sub-assembly box showing a sub-build, the step
 * number, and a progress bar — all drawn on white, where the page is grey and
 * the model is not. Every one of them has to go before the art is read, and the
 * PDF's own callout list does not cover the sub-assembly boxes.
 *
 * They cannot be left to the largest-component isolation either. A sub-assembly
 * box is joined to the model by a printed leader line, so the two are one
 * connected region: on step 14 of the sample booklet the box came through as
 * part of the assembly and a 400x170 rectangle of it read as a part that
 * appeared between the panels.
 *
 * The returned mask is bounding boxes rather than the white itself, because
 * what has to go is everything the box contains — the thumbnails inside it are
 * drawn under their own camera and are not this panel's model.
 */
export function keyPrintedBoxes(raster: PanelRaster, options: PrintedBoxOptions = {}): Uint8Array {
  requireRaster(raster, "printed-box source");
  const { width, height } = raster;
  const level = options.whiteLevel ?? 246;
  const minimumAreaPx = options.minimumAreaPx ?? 400;
  const marginPx = options.marginPx ?? 6;
  const area = width * height;
  const white = new Uint8Array(area);
  for (let pixel = 0; pixel < area; pixel += 1) {
    const at = pixel * 4;
    if (
      raster.pixels[at]! >= level &&
      raster.pixels[at + 1]! >= level &&
      raster.pixels[at + 2]! >= level
    ) {
      white[pixel] = 1;
    }
  }

  const mask = new Uint8Array(area);
  const seen = new Uint8Array(area);
  const stack: number[] = [];
  for (let seed = 0; seed < area; seed += 1) {
    if (white[seed] !== 1 || seen[seed] === 1) continue;
    let size = 0;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    stack.push(seed);
    seen[seed] = 1;
    while (stack.length > 0) {
      const index = stack.pop()!;
      size += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const neighbour of [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ]) {
        if (neighbour < 0 || white[neighbour] !== 1 || seen[neighbour] === 1) continue;
        seen[neighbour] = 1;
        stack.push(neighbour);
      }
    }
    if (size < minimumAreaPx) continue;
    const fromX = Math.max(0, minX - marginPx);
    const toX = Math.min(width - 1, maxX + marginPx);
    for (let y = Math.max(0, minY - marginPx); y <= Math.min(height - 1, maxY + marginPx); y += 1) {
      mask.fill(1, y * width + fromX, y * width + toX + 1);
    }
  }
  return mask;
}

export interface PdfPointBox {
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
}

export interface PanelCrop {
  readonly width: number;
  readonly height: number;
  /** Page scale the PDF was rasterised at. */
  readonly renderScale: number;
  /** Where the crop starts in page pixels. */
  readonly sourceXPx: number;
  readonly sourceYPx: number;
  /** Crop pixels per page pixel. */
  readonly ratio: number;
  /** The page's own height in pixels, because PDF points count from the bottom. */
  readonly pageHeightPx: number;
  /** How far past each box the mask reaches, for its ink. Defaults to 4. */
  readonly marginPx?: number;
}

/**
 * Clears boxes given in PDF points out of a mask taken from a crop of that page.
 *
 * Two coordinate systems meet here and they disagree about which way is up: PDF
 * points count from the bottom of the page and canvas pixels from the top, so
 * the box's top edge is derived from its *maximum* y. Getting that backwards
 * masks a mirrored rectangle somewhere else on the panel, which looks like a
 * hole in the model rather than like a coordinate bug.
 */
export function clearPdfBoxes(
  mask: Uint8Array,
  crop: PanelCrop,
  boxes: readonly PdfPointBox[],
): void {
  requireMask({ width: crop.width, height: crop.height, mask }, "callout-box target");
  const margin = crop.marginPx ?? 4;
  for (const box of boxes) {
    const minX = Math.max(
      0,
      Math.floor((box.minXPt * crop.renderScale - crop.sourceXPx) * crop.ratio) - margin,
    );
    const maxX = Math.min(
      crop.width - 1,
      Math.ceil((box.maxXPt * crop.renderScale - crop.sourceXPx) * crop.ratio) + margin,
    );
    const minY = Math.max(
      0,
      Math.floor(
        (crop.pageHeightPx - box.maxYPt * crop.renderScale - crop.sourceYPx) * crop.ratio,
      ) - margin,
    );
    const maxY = Math.min(
      crop.height - 1,
      Math.ceil((crop.pageHeightPx - box.minYPt * crop.renderScale - crop.sourceYPx) * crop.ratio) +
        margin,
    );
    if (maxX < minX) continue;
    for (let y = minY; y <= maxY; y += 1) {
      mask.fill(0, y * crop.width + minX, y * crop.width + maxX + 1);
    }
  }
}
