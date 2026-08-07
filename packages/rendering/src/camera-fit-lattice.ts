/**
 * Recovering a printed panel's camera from the grid of studs the panel draws.
 *
 * `camera-fit.ts` fits a camera by rendering geometry we already have and
 * comparing silhouettes. That is the right move at step N of a build we are
 * following, because the model so far is known. It cannot start a real booklet:
 * before step 1 nothing is known, and the parts a printed set opens with are
 * rarely in the catalog.
 *
 * A booklet panel carries its own calibration target anyway. Every stud sits on
 * the same 20 LDU grid, so the two grid directions, printed dozens of times
 * across one picture, fix the camera's orientation and scale without knowing a
 * single part. Under an orthographic axonometric view with the vertical axis
 * upright in the image — which is how instruction art is drawn — one stud pitch
 * along world X and along world Z projects to
 *
 *     a = s * (cos azimuth, sin elevation * sin azimuth)
 *     b = s * (-sin azimuth, sin elevation * cos azimuth)
 *
 * in pixels with y running down, where `s` is pixels per stud pitch. Four
 * measured numbers, three unknowns, so the solve leaves a residual, and that
 * residual separates a grid this projection explains from one it does not — on
 * a real booklet, under 0.008 of a pitch for every panel that reads as studs
 * and over 0.03 for every panel that does not.
 *
 * It is a fit quality, not a proof, and the difference is measured: a rhombic
 * grid that no square grid could project to still reads under 1% of pitch once
 * a change of basis is allowed, and a quarter of random plausible lattices pass
 * the gate. What it does separate on a booklet is a fit that found the grid from
 * one that locked onto the wrong repeat, and the strongest second opinion is
 * `coherence` — the mean autocorrelation of the chosen basis, measured at 0.26
 * on accepted panels against 0.11 on refused ones.
 *
 * There is no strong per-panel proof that the picture is a stud grid at all.
 * Two were tried against the folded cell in `camera-fit-lattice-phase.ts` and
 * both are reported there with what they measured; neither separates an
 * accepted panel from a refused one by much. The evidence that the fit is right
 * is the overlays, the agreement of thirty-two independent panels on four
 * cameras, and the round trip through this package's own camera.
 *
 * What this cannot recover is where the model sits. A grid is the same grid
 * shifted by one pitch, so the fit pins the projection to a lattice phase and
 * no further; the panel's `centerXPx`/`centerYPx` still need one known part.
 * Saying so is the point — a translation invented here would be a fit that
 * lies.
 */

import { STUD_PITCH_LDU } from "@lego-studio/catalog";

import { THREE_UNITS_PER_LDU } from "./coordinates.ts";

const DEGREES = Math.PI / 180;

/**
 * Which face of the assembly a panel is drawn from.
 *
 * This is an input to *rendering*, never to fitting, and the difference is
 * proved rather than asserted. A below-view lattice at azimuth A is the same
 * lattice as an above-view at azimuth -A: the projection gives
 * a(A, -e) = a(-A, e) and b(A, -e) = -b(-A, e), and negating one basis vector
 * spans the same lattice. So a stud grid cannot distinguish the two faces even
 * in principle, and telling the fitter which face to look for changes nothing,
 * because its search over re-basings already reaches the equivalent
 * positive-elevation solution.
 *
 * Measured on the first forty panels of 6651557: fitting every panel a second
 * time as a below-view produced no solution at all on any of them, including
 * the five the booklet's own flip icon and two blind raters agree are drawn
 * from underneath. The face has to be applied when a candidate is rendered —
 * as the sign of the camera's elevation — not when the panel is measured.
 */
export type PanelFace = "studs-up" | "underside";

/**
 * One Three.js world unit is one stud pitch, which is what lets a fitted
 * `pixelsPerUnit` be read as pixels per stud. Derived rather than written down:
 * it holds only while 20 LDU and 0.05 world units per LDU multiply to one, and a
 * hardcoded 1 would go on being 1 after either of them changed.
 */
export const STUD_PITCH_WORLD_UNITS = STUD_PITCH_LDU * THREE_UNITS_PER_LDU;

export interface PixelBoxPx {
  readonly minXPx: number;
  readonly minYPx: number;
  readonly maxXPx: number;
  readonly maxYPx: number;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer, received ${String(value)}`);
  }
  return value;
}

export interface StudTextureOptions {
  /** Page colour to key out, as 0xRRGGBB. */
  readonly backgroundHex: number;
  /** Per-channel slack for the page's antialiasing. Defaults to 8. */
  readonly backgroundTolerance?: number;
  /**
   * Radius of the local mean that is subtracted. It must be larger than a drawn
   * stud, so a stud survives, and smaller than a couple of pitches, so a plate's
   * own colour does not. Defaults to 16, sized for a panel about 1500px wide.
   */
  readonly highPassRadiusPx?: number;
  /** Regions to drop, such as the callout box, whose art has its own camera. */
  readonly excludeBoxes?: readonly PixelBoxPx[];
  /**
   * One byte per pixel, 1 where the caller has already decided the art is. A
   * printed panel keys more than the model — the callout box, the step number,
   * the progress bar — and the cheapest way to keep only the assembly is to
   * hand in its own connected region rather than a box around it.
   */
  readonly includeMask?: Uint8Array;
  /** Cap on correlated pixels; the grid is measured, not the whole raster. */
  readonly maxSamples?: number;
}

export interface StudTextureField {
  readonly width: number;
  readonly height: number;
  /** Local contrast over the art, scaled to unit variance then clamped to +-4; zero elsewhere. */
  readonly texture: Float32Array;
  readonly mask: Uint8Array;
  readonly sampleX: Int32Array;
  readonly sampleY: Int32Array;
  readonly artArea: number;
  readonly bounds: PixelBoxPx | null;
}

function summedArea(values: Float32Array, width: number, height: number): Float64Array {
  const table = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += values[y * width + x]!;
      table[(y + 1) * (width + 1) + x + 1] = table[y * (width + 1) + x + 1]! + rowSum;
    }
  }
  return table;
}

function boxMean(
  table: Float64Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): number {
  const minX = Math.max(0, x - radius);
  const minY = Math.max(0, y - radius);
  const maxX = Math.min(width - 1, x + radius);
  const maxY = Math.min(height - 1, y + radius);
  const stride = width + 1;
  const total =
    table[(maxY + 1) * stride + maxX + 1]! -
    table[minY * stride + maxX + 1]! -
    table[(maxY + 1) * stride + minX]! +
    table[minY * stride + minX]!;
  return total / ((maxX - minX + 1) * (maxY - minY + 1));
}

/**
 * The local-contrast image the grid is measured in, plus the pixels worth
 * correlating. Flat fill carries no grid, so subtracting a local mean throws
 * away the plate colours and keeps the stud rings and the printed edges.
 */
export function buildStudTextureField(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: StudTextureOptions,
): StudTextureField {
  requirePositiveInteger(width, "width");
  requirePositiveInteger(height, "height");
  if (pixels.length !== width * height * 4) {
    throw new RangeError(
      `Pixel buffer holds ${pixels.length} bytes but ${width}x${height} RGBA needs ${width * height * 4}. ` +
        `Pass the raster the panel was cropped to, not the page it came from.`,
    );
  }
  const tolerance = options.backgroundTolerance ?? 8;
  const radius = options.highPassRadiusPx ?? 16;
  const maxSamples = options.maxSamples ?? 25_000;
  if (!Number.isInteger(radius) || radius < 2) {
    throw new RangeError(
      `highPassRadiusPx must be an integer of at least 2, received ${String(radius)}. ` +
        `It is a radius in pixels of this raster: it has to exceed a drawn stud and stay under two stud pitches.`,
    );
  }

  const includeMask = options.includeMask;
  if (includeMask !== undefined && includeMask.length !== width * height) {
    throw new RangeError(
      `includeMask holds ${includeMask.length} pixels but ${width}x${height} needs ${width * height}. ` +
        `One byte per pixel, in the same raster as the pixels it selects from.`,
    );
  }

  const backgroundRed = (options.backgroundHex >> 16) & 0xff;
  const backgroundGreen = (options.backgroundHex >> 8) & 0xff;
  const backgroundBlue = options.backgroundHex & 0xff;

  const luminance = new Float32Array(width * height);
  const mask = new Uint8Array(width * height);
  let artArea = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    luminance[index] = 0.299 * red + 0.587 * green + 0.114 * blue;
    if (includeMask !== undefined && includeMask[index] !== 1) continue;
    const isBackground =
      Math.abs(red - backgroundRed) <= tolerance &&
      Math.abs(green - backgroundGreen) <= tolerance &&
      Math.abs(blue - backgroundBlue) <= tolerance;
    if (isBackground) continue;
    mask[index] = 1;
  }
  for (const box of options.excludeBoxes ?? []) {
    const boxMinX = Math.max(0, Math.floor(box.minXPx));
    const boxMaxX = Math.min(width - 1, Math.ceil(box.maxXPx));
    const boxMinY = Math.max(0, Math.floor(box.minYPx));
    const boxMaxY = Math.min(height - 1, Math.ceil(box.maxYPx));
    for (let y = boxMinY; y <= boxMaxY; y += 1) {
      mask.fill(0, y * width + boxMinX, y * width + boxMaxX + 1);
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      artArea += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const table = summedArea(luminance, width, height);
  const texture = new Float32Array(width * height);
  let sum = 0;
  let sumSquares = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] !== 1) continue;
      const value = luminance[index]! - boxMean(table, width, height, x, y, radius);
      texture[index] = value;
      sum += value;
      sumSquares += value * value;
    }
  }
  const mean = artArea === 0 ? 0 : sum / artArea;
  const variance = artArea === 0 ? 0 : sumSquares / artArea - mean * mean;
  const deviation = variance > 0 ? Math.sqrt(variance) : 1;
  for (let index = 0; index < texture.length; index += 1) {
    if (mask[index] !== 1) {
      texture[index] = 0;
      continue;
    }
    // Clamped so a page of white body text cannot outvote a hundred studs.
    texture[index] = Math.max(-4, Math.min(4, (texture[index]! - mean) / deviation));
  }

  const stride = Math.max(1, Math.ceil(Math.sqrt(artArea / Math.max(1, maxSamples))));
  const sampleX: number[] = [];
  const sampleY: number[] = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      if (mask[y * width + x] === 1) {
        sampleX.push(x);
        sampleY.push(y);
      }
    }
  }

  return {
    width,
    height,
    texture,
    mask,
    sampleX: Int32Array.from(sampleX),
    sampleY: Int32Array.from(sampleY),
    artArea,
    bounds: artArea === 0 ? null : { minXPx: minX, minYPx: minY, maxXPx: maxX, maxYPx: maxY },
  };
}

/**
 * Autocorrelation of the texture at one integer pixel offset.
 *
 * Normalised over the pairs that actually overlap, not over their count. A plain
 * mean is biased towards long offsets: they drop the pixels near the art's
 * boundary, whose neighbour falls off the model, and what is left is the busy
 * interior. Ranked that way a picture's strongest repeat is `4a`, and the grid
 * step it is built from never makes the shortlist.
 */
export function correlateAtOffset(field: StudTextureField, dx: number, dy: number): number {
  const { width, height, texture, mask, sampleX, sampleY } = field;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  for (let index = 0; index < sampleX.length; index += 1) {
    const x = sampleX[index]! + dx;
    const y = sampleY[index]! + dy;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const other = y * width + x;
    if (mask[other] !== 1) continue;
    const here = texture[sampleY[index]! * width + sampleX[index]!]!;
    const there = texture[other]!;
    sumXY += here * there;
    sumXX += here * here;
    sumYY += there * there;
  }
  return sumXX > 0 && sumYY > 0 ? sumXY / Math.sqrt(sumXX * sumYY) : 0;
}

/** The same, sampled bilinearly, so a lattice vector can be refined below a pixel. */
export function correlateAtSubpixelOffset(field: StudTextureField, dx: number, dy: number): number {
  const { width, height, texture, mask, sampleX, sampleY } = field;
  const baseX = Math.floor(dx);
  const baseY = Math.floor(dy);
  const fractionX = dx - baseX;
  const fractionY = dy - baseY;
  const w00 = (1 - fractionX) * (1 - fractionY);
  const w10 = fractionX * (1 - fractionY);
  const w01 = (1 - fractionX) * fractionY;
  const w11 = fractionX * fractionY;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  for (let index = 0; index < sampleX.length; index += 1) {
    const x = sampleX[index]! + baseX;
    const y = sampleY[index]! + baseY;
    if (x < 0 || x + 1 >= width || y < 0 || y + 1 >= height) continue;
    const corner = y * width + x;
    const cover =
      w00 * mask[corner]! +
      w10 * mask[corner + 1]! +
      w01 * mask[corner + width]! +
      w11 * mask[corner + width + 1]!;
    if (cover < 0.999) continue;
    const there =
      w00 * texture[corner]! +
      w10 * texture[corner + 1]! +
      w01 * texture[corner + width]! +
      w11 * texture[corner + width + 1]!;
    const here = texture[sampleY[index]! * width + sampleX[index]!]!;
    sumXY += here * there;
    sumXX += here * here;
    sumYY += there * there;
  }
  return sumXX > 0 && sumYY > 0 ? sumXY / Math.sqrt(sumXX * sumYY) : 0;
}

export interface LatticeVectorPx {
  readonly xPx: number;
  readonly yPx: number;
}

export interface LatticeBasisPx {
  /** One stud pitch along one grid direction; points right and down. */
  readonly a: LatticeVectorPx;
  /** One stud pitch along the other; points left and down. */
  readonly b: LatticeVectorPx;
}

export interface LatticePeak {
  readonly vector: LatticeVectorPx;
  readonly score: number;
}

export interface AxonometricSolution {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  /** Pixels per Three.js world unit, which is pixels per stud pitch. */
  readonly pixelsPerUnit: number;
  /**
   * RMS pixels between the measured basis and the closest basis any
   * orthographic axonometric view of a square grid could print. Small means the
   * panel really is drawn that way; large means it is not, and the angles below
   * are then a fitted number rather than a measurement.
   */
  readonly residualPx: number;
}

/**
 * Solves azimuth, elevation and scale from a measured pair of grid vectors.
 *
 * Four measurements, three unknowns, so the solve is least squares and the
 * leftover is meaningful. Returns null when the pair demands a `sin elevation`
 * outside (0, 1], which is what a badly mis-paired basis yields. That is a guard
 * on this function and not a filter the fitter leans on: `fitStudLattice` reaches
 * every pair through `reduceToAxonometricBasis`, which re-bases a mis-paired
 * lattice to the one it spans and solves that instead.
 *
 * A `sin elevation` a little over one is taken as noise on a near-flat-on view
 * and clamped, but the residual is measured against the clamped value, so a
 * basis no camera could print reports the mismatch rather than a perfect fit.
 */
export function solveAxonometricFromLattice(
  basis: LatticeBasisPx,
  { face = "studs-up" }: { readonly face?: PanelFace } = {},
): AxonometricSolution | null {
  // The projection is a = s(cos az, sin elev sin az), b = s(-sin az, sin elev
  // cos az), so a camera below the model differs from one above it only in the
  // sign of `sin elev` — that is, in the sign of both y components. Mirroring
  // the measured basis therefore turns the below-view problem into the
  // above-view one this solver already handles, and the elevation is negated on
  // the way back out. Nothing else about the fit changes: the azimuth, the
  // scale and the residual are all measured against the mirrored basis.
  const mirror = face === "underside" ? -1 : 1;
  const ax = basis.a.xPx;
  const ay = basis.a.yPx * mirror;
  const bx = basis.b.xPx;
  const by = basis.b.yPx * mirror;
  if (![ax, ay, bx, by].every((value) => Number.isFinite(value))) return null;
  // u = s cos azimuth, w = s sin azimuth, k = sin elevation.
  let u = ax;
  let w = -bx;
  if (u * u + w * w <= 0) return null;
  // Block coordinate descent on the normal equations. The objective is a
  // Rayleigh quotient in k whose stationary equation has roots of product -1, so
  // there is one positive root and the iteration cannot settle on the other; the
  // starting k is overwritten on the first pass and is not a seed.
  let k = 0;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    k = (w * ay + u * by) / (u * u + w * w);
    const scale = 1 + k * k;
    u = (ax + k * by) / scale;
    w = (k * ay - bx) / scale;
  }
  if (!Number.isFinite(k) || !Number.isFinite(u) || !Number.isFinite(w)) return null;
  // After mirroring, k is always the above-view root. A negative k here means
  // the basis does not describe the requested face at all, which is exactly the
  // signal that says a panel was drawn from the other side.
  if (k <= 0.02 || k > 1.02) return null;
  const pixelsPerUnit = Math.hypot(u, w);
  if (!(pixelsPerUnit > 0)) return null;
  // Clamped before the residual, not after: 90 degrees is the steepest view
  // there is, so a basis demanding more has to report the difference rather than
  // a perfect fit to a view nothing can print.
  const sine = Math.min(1, k);
  const residualPx = Math.sqrt(
    ((u - ax) ** 2 + (-w - bx) ** 2 + (sine * w - ay) ** 2 + (sine * u - by) ** 2) / 4,
  );
  return {
    azimuthDegrees: Math.atan2(w, u) / DEGREES,
    elevationDegrees: (mirror * Math.asin(sine)) / DEGREES,
    pixelsPerUnit,
    residualPx,
  };
}

/** Projects one stud pitch along world X and world Z back into pixels. */
export function latticeBasisFromAxonometric(
  solution: Pick<AxonometricSolution, "azimuthDegrees" | "elevationDegrees" | "pixelsPerUnit">,
): LatticeBasisPx {
  const azimuth = solution.azimuthDegrees * DEGREES;
  const elevation = solution.elevationDegrees * DEGREES;
  const scale = solution.pixelsPerUnit;
  const sine = Math.sin(elevation);
  return {
    a: { xPx: scale * Math.cos(azimuth), yPx: scale * sine * Math.sin(azimuth) },
    b: { xPx: -scale * Math.sin(azimuth), yPx: scale * sine * Math.cos(azimuth) },
  };
}

export interface StudLatticeOptions {
  /** Shortest offset the search will accept as a grid vector. Defaults to 7. */
  readonly minOffsetPx?: number;
  /** Longest. Defaults to 60. */
  readonly maxOffsetPx?: number;
  /** Autocorrelation peaks kept for basis selection. Defaults to 16. */
  readonly peakCount?: number;
  /** Sub-pixel refinement of the chosen basis. Defaults to true. */
  readonly refine?: boolean;
  /**
   * How far the measured grid may sit from any axonometric projection before
   * the fit is refused, as a fraction of one stud pitch. Defaults to 0.02,
   * which is where the gap is: over the first forty steps of a real booklet
   * every panel that reads as a stud grid landed under 0.008 and every panel
   * that did not — a step drawn from underneath, one whose art is a handful of
   * tiles — landed over 0.03, with nothing in between.
   */
  readonly maxResidualFraction?: number;
}

export interface LatticeCandidate {
  readonly basis: LatticeBasisPx;
  readonly solution: AxonometricSolution | null;
  /** Autocorrelation peaks this basis explains as integer combinations. */
  readonly explainedPeaks: number;
  /** Unit cell area in square pixels; every finer lattice explains the same peaks. */
  readonly cellAreaPx: number;
  readonly coherence: number;
  readonly rejectedBecause: string | null;
}

export interface StudLatticeFit {
  readonly basis: LatticeBasisPx | null;
  readonly solution: AxonometricSolution | null;
  /** Mean autocorrelation of the chosen basis over the harmonic offsets, refined or not. */
  readonly coherence: number;
  readonly peaks: readonly LatticePeak[];
  readonly candidates: readonly LatticeCandidate[];
  readonly failure: string | null;
}

/** Offsets whose autocorrelation a candidate basis has to explain. */
const HARMONICS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
  [2, 0],
  [0, 2],
  [2, 1],
  [1, 2],
  [2, 2],
  [3, 0],
  [0, 3],
];

function harmonicScore(field: StudTextureField, basis: LatticeBasisPx): number {
  let total = 0;
  for (const [m, n] of HARMONICS) {
    total += correlateAtSubpixelOffset(
      field,
      m * basis.a.xPx + n * basis.b.xPx,
      m * basis.a.yPx + n * basis.b.yPx,
    );
  }
  return total / HARMONICS.length;
}

/**
 * The strongest repeats in the picture, as pixel offsets. Only the lower half
 * plane is searched: an autocorrelation is symmetric, and both grid directions
 * run away from the viewer's eye, which is downwards in an upright projection.
 */
export function studLatticePeaks(
  field: StudTextureField,
  minOffsetPx: number,
  maxOffsetPx: number,
  peakCount: number,
): readonly LatticePeak[] {
  const span = 2 * maxOffsetPx + 1;
  const map = new Float32Array(span * (maxOffsetPx + 1));
  for (let dy = 0; dy <= maxOffsetPx; dy += 1) {
    for (let dx = -maxOffsetPx; dx <= maxOffsetPx; dx += 1) {
      if (dy === 0 && dx <= 0) continue;
      if (Math.hypot(dx, dy) < minOffsetPx) continue;
      map[dy * span + dx + maxOffsetPx] = correlateAtOffset(field, dx, dy);
    }
  }
  const peaks: LatticePeak[] = [];
  for (let dy = 0; dy <= maxOffsetPx; dy += 1) {
    for (let dx = -maxOffsetPx; dx <= maxOffsetPx; dx += 1) {
      const score = map[dy * span + dx + maxOffsetPx]!;
      if (score <= 0) continue;
      let isPeak = true;
      for (let ny = dy - 2; ny <= dy + 2 && isPeak; ny += 1) {
        for (let nx = dx - 2; nx <= dx + 2; nx += 1) {
          if (nx === dx && ny === dy) continue;
          if (ny < 0 || ny > maxOffsetPx || nx < -maxOffsetPx || nx > maxOffsetPx) continue;
          if (map[ny * span + nx + maxOffsetPx]! > score) {
            isPeak = false;
            break;
          }
        }
      }
      if (isPeak) peaks.push({ vector: { xPx: dx, yPx: dy }, score });
    }
  }
  return peaks.sort((left, right) => right.score - left.score).slice(0, peakCount);
}

function canonicalPair(first: LatticeVectorPx, second: LatticeVectorPx): LatticeBasisPx | null {
  const rightward = first.xPx >= 0 ? first : { xPx: -first.xPx, yPx: -first.yPx };
  const other = second.xPx <= 0 ? second : { xPx: -second.xPx, yPx: -second.yPx };
  if (rightward.yPx < 0 || other.yPx < 0) return null;
  const determinant = rightward.xPx * other.yPx - rightward.yPx * other.xPx;
  if (Math.abs(determinant) < 1) return null;
  return { a: rightward, b: other };
}

/**
 * The pair of grid steps that best explains a lattice, out of every pair that
 * spans it.
 *
 * Autocorrelation hands back some primitive basis of the grid, not the one the
 * camera stepped in: `a - b` and `b` span exactly the same lattice as `a` and
 * `b`, and either can be the pair whose peaks happen to be strongest. Every
 * alternative is one small unimodular change of basis away, so enumerate them
 * and let the residual choose.
 *
 * Bounded by length, and that bound is load bearing. Allowed to reach for long
 * combinations, the search finds a low-residual reading of almost any lattice —
 * measured at 1% of pitch on a rhombic grid that no square grid could project
 * to. So anything much longer than the picture's own shortest repeat is not the
 * grid step, whatever it solves to.
 *
 * The bound has a precondition and it is exact. At an azimuth on an axis the
 * longer grid vector is `1 / sin elevation` times the shortest repeat, so 2.6
 * admits every azimuth only while the elevation is at least 22.62 degrees. Below
 * that the true basis is out of reach at some azimuths and the panel is refused
 * rather than mis-fitted: 12% of azimuths at 22 degrees, 36% at 15, all of them
 * at 5. Instruction art is drawn near 35, where the worst ratio is 1.74.
 */
const MAX_BASIS_OVER_SHORTEST_REPEAT = 2.6;
/** Elevation below which the length bound can put the true basis out of reach. */
const MIN_RELIABLE_ELEVATION_DEGREES = Math.asin(1 / MAX_BASIS_OVER_SHORTEST_REPEAT) / DEGREES;

export function reduceToAxonometricBasis(
  basis: LatticeBasisPx,
): { readonly basis: LatticeBasisPx; readonly solution: AxonometricSolution } | null {
  let shortest = Infinity;
  for (let m = -2; m <= 2; m += 1) {
    for (let n = -2; n <= 2; n += 1) {
      if (m === 0 && n === 0) continue;
      shortest = Math.min(
        shortest,
        Math.hypot(m * basis.a.xPx + n * basis.b.xPx, m * basis.a.yPx + n * basis.b.yPx),
      );
    }
  }
  const longestAllowed = shortest * MAX_BASIS_OVER_SHORTEST_REPEAT;
  let best: { basis: LatticeBasisPx; solution: AxonometricSolution } | null = null;
  for (let m11 = -3; m11 <= 3; m11 += 1) {
    for (let m12 = -3; m12 <= 3; m12 += 1) {
      for (let m21 = -3; m21 <= 3; m21 += 1) {
        for (let m22 = -3; m22 <= 3; m22 += 1) {
          if (Math.abs(m11 * m22 - m12 * m21) !== 1) continue;
          const first = {
            xPx: m11 * basis.a.xPx + m12 * basis.b.xPx,
            yPx: m11 * basis.a.yPx + m12 * basis.b.yPx,
          };
          const second = {
            xPx: m21 * basis.a.xPx + m22 * basis.b.xPx,
            yPx: m21 * basis.a.yPx + m22 * basis.b.yPx,
          };
          if (Math.hypot(first.xPx, first.yPx) > longestAllowed) continue;
          if (Math.hypot(second.xPx, second.yPx) > longestAllowed) continue;
          const pair = canonicalPair(first, second);
          if (pair === null) continue;
          const solution = solveAxonometricFromLattice(pair);
          if (solution === null) continue;
          if (best === null || solution.residualPx < best.solution.residualPx) {
            best = { basis: pair, solution };
          }
        }
      }
    }
  }
  return best;
}

function countExplained(basis: LatticeBasisPx, peaks: readonly LatticePeak[]): number {
  const determinant = basis.a.xPx * basis.b.yPx - basis.a.yPx * basis.b.xPx;
  let explained = 0;
  for (const peak of peaks) {
    const m = (peak.vector.xPx * basis.b.yPx - peak.vector.yPx * basis.b.xPx) / determinant;
    const n = (basis.a.xPx * peak.vector.yPx - basis.a.yPx * peak.vector.xPx) / determinant;
    if (Math.abs(m - Math.round(m)) < 0.16 && Math.abs(n - Math.round(n)) < 0.16) explained += 1;
  }
  return explained;
}

function refineBasis(field: StudTextureField, seed: LatticeBasisPx): LatticeBasisPx {
  let best = seed;
  let bestScore = harmonicScore(field, best);
  let step = 0.6;
  for (let pass = 0; pass < 9; pass += 1) {
    let improved = false;
    for (let component = 0; component < 4; component += 1) {
      for (const direction of [step, -step]) {
        const trial: LatticeBasisPx = {
          a: {
            xPx: best.a.xPx + (component === 0 ? direction : 0),
            yPx: best.a.yPx + (component === 1 ? direction : 0),
          },
          b: {
            xPx: best.b.xPx + (component === 2 ? direction : 0),
            yPx: best.b.yPx + (component === 3 ? direction : 0),
          },
        };
        // Bounded to the peak it came from: refinement sharpens a basis, it
        // does not get to wander to a different one.
        const drift = Math.max(
          Math.abs(trial.a.xPx - seed.a.xPx),
          Math.abs(trial.a.yPx - seed.a.yPx),
          Math.abs(trial.b.xPx - seed.b.xPx),
          Math.abs(trial.b.yPx - seed.b.yPx),
        );
        if (drift > 2.5) continue;
        const score = harmonicScore(field, trial);
        if (score > bestScore) {
          best = trial;
          bestScore = score;
          improved = true;
        }
      }
    }
    if (!improved) step *= 0.55;
  }
  return best;
}

/**
 * The grid a panel draws, and the camera that would print it.
 *
 * Peaks alone are ambiguous: below about 35 degrees of elevation the shortest
 * repeat in the picture is `a + b` rather than `b`, and that pair spans the same
 * lattice. The axonometric solve is what separates them — a non-primitive or
 * mis-paired basis demands a `sin elevation` above one and is rejected outright.
 */
export function fitStudLattice(
  field: StudTextureField,
  options: StudLatticeOptions = {},
): StudLatticeFit {
  const minOffsetPx = options.minOffsetPx ?? 7;
  const maxOffsetPx = options.maxOffsetPx ?? 60;
  const peakCount = options.peakCount ?? 16;
  const maxResidualFraction = options.maxResidualFraction ?? 0.02;
  if (field.sampleX.length < 200) {
    return {
      basis: null,
      solution: null,
      coherence: 0,
      peaks: [],
      candidates: [],
      failure:
        `Only ${field.sampleX.length} art pixels were sampled out of a ${field.width}x${field.height} raster, which is too few to measure a repeat. ` +
        `Either the crop holds no model art, or the background key removed it — a printed page needs a tolerance above 0, and the page grey is not white.`,
    };
  }

  const peaks = studLatticePeaks(field, minOffsetPx, maxOffsetPx, peakCount);
  if (peaks.length < 2) {
    return {
      basis: null,
      solution: null,
      coherence: 0,
      peaks,
      candidates: [],
      failure:
        `The autocorrelation had ${peaks.length} peak(s) between ${minOffsetPx}px and ${maxOffsetPx}px, and a grid needs two independent ones. ` +
        `Either the panel draws too few studs, or the stud pitch falls outside that window — raise maxOffsetPx for a larger crop, lower minOffsetPx for a smaller one.`,
    };
  }

  const candidates: LatticeCandidate[] = [];
  for (let first = 0; first < peaks.length; first += 1) {
    for (let second = first + 1; second < peaks.length; second += 1) {
      const spanning = canonicalPair(peaks[first]!.vector, peaks[second]!.vector);
      if (spanning === null) continue;
      const explainedPeaks = countExplained(spanning, peaks);
      // The peaks give some primitive basis; the camera's own pair of grid
      // steps is a change of basis away, and only it solves cleanly.
      const reduced = reduceToAxonometricBasis(spanning);
      candidates.push({
        basis: reduced?.basis ?? spanning,
        solution: reduced?.solution ?? null,
        explainedPeaks,
        cellAreaPx: Math.abs(spanning.a.xPx * spanning.b.yPx - spanning.a.yPx * spanning.b.xPx),
        coherence: (peaks[first]!.score + peaks[second]!.score) / 2,
        rejectedBecause:
          reduced === null
            ? "no upright axonometric view of a square grid prints this lattice, under any change of basis"
            : null,
      });
    }
  }

  const viable = candidates.filter((candidate) => candidate.solution !== null);
  if (viable.length === 0) {
    const shortest = peaks
      .slice(0, 4)
      .map(({ vector }) => `(${vector.xPx},${vector.yPx})`)
      .join(" ");
    return {
      basis: null,
      solution: null,
      coherence: 0,
      peaks,
      candidates,
      failure:
        `${candidates.length} peak pairs were tried and no change of basis makes any of them an upright axonometric projection of a stud grid; the strongest repeats were ${shortest}. ` +
        `That is what a perspective panel, a rolled camera, or a repeat that is not the stud grid looks like. It is also what a view flatter than ${MIN_RELIABLE_ELEVATION_DEGREES.toFixed(1)} degrees looks like, because the change-of-basis search is bounded to ${MAX_BASIS_OVER_SHORTEST_REPEAT} times the shortest repeat and the true grid step exceeds that below it. ` +
        `Inspect the peaks before trusting any angle from this panel; raising maxResidualFraction is not the lever.`,
    };
  }

  // Explained peaks first: a lattice that misses half the repeats is the wrong
  // lattice however well its own vectors solve. Then the coarsest such lattice,
  // because every finer one explains those peaks too and would halve the pitch.
  // The axonometric residual settles what is left, and it is the measurement.
  viable.sort((left, right) => {
    if (right.explainedPeaks !== left.explainedPeaks) {
      return right.explainedPeaks - left.explainedPeaks;
    }
    if (Math.abs(right.cellAreaPx - left.cellAreaPx) > 1) {
      return right.cellAreaPx - left.cellAreaPx;
    }
    return left.solution!.residualPx - right.solution!.residualPx;
  });

  const chosen = viable[0]!;
  const refined = options.refine === false ? chosen.basis : refineBasis(field, chosen.basis);
  const settled = reduceToAxonometricBasis(refined);
  const basis = settled?.basis ?? refined;
  const solution = settled?.solution ?? chosen.solution;
  if (solution === null) {
    return {
      basis: null,
      solution: null,
      coherence: harmonicScore(field, basis),
      peaks,
      candidates: viable,
      failure: `Refining the chosen grid pushed it off every axonometric projection; the basis before refinement was a=(${chosen.basis.a.xPx}, ${chosen.basis.a.yPx}), b=(${chosen.basis.b.xPx}, ${chosen.basis.b.yPx}).`,
    };
  }
  if (solution.residualPx > maxResidualFraction * solution.pixelsPerUnit) {
    return {
      basis,
      solution,
      coherence: harmonicScore(field, basis),
      peaks,
      candidates: viable,
      failure:
        `The measured grid is ${solution.residualPx.toFixed(2)}px from the closest upright axonometric projection, which is more than ${maxResidualFraction} of the ${solution.pixelsPerUnit.toFixed(2)}px stud pitch it implies. ` +
        `The azimuth ${solution.azimuthDegrees.toFixed(1)} and elevation ${solution.elevationDegrees.toFixed(1)} are what least squares returned, not a measurement of this panel. Raising maxResidualFraction does not make them true; a panel that fails this is drawn some other way, or the repeat that was measured is not the stud grid.`,
    };
  }
  return {
    basis,
    solution,
    coherence: harmonicScore(field, basis),
    peaks,
    candidates: viable,
    failure: null,
  };
}
