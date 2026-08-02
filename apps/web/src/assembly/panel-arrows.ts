/**
 * The displacement a booklet prints when it draws a step exploded.
 *
 * A step drawn exploded puts the new part beside where it lands and inks a red
 * arrow across the gap. That arrow is the booklet telling the reader where the
 * part goes, and it is the only statement of the answer on the page that is not
 * the picture itself — which makes it the one ground truth available for
 * checking a picture-derived placement without begging the question.
 *
 * It is an estimate, not a measurement. An arrow is drawn from clear of the
 * ghost to clear of the landing surface, so its length is the part's travel to
 * within the clearance the artist left, and its tail sits wherever the drawing
 * had room. Half a stud is the right expectation, which is enough to say whether
 * a score peaked in the right place and not enough to certify a stud.
 *
 * Red is the booklet's arrow colour and nothing else on these pages is this red
 * — the art is greys and the highlight is yellow — but the sets themselves have
 * red parts, and a red plate keys exactly the same. Shape is what separates
 * them: an arrow is long and thin with one end fatter than the other, and a
 * plate is neither.
 */

export const PANEL_ARROW_SCHEMA_VERSION = "lego.panel-arrow/1" as const;

export class PanelArrowError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PanelArrowError";
  }
}

export interface ArrowRaster {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

export interface PanelArrow {
  readonly areaPx: number;
  /** The thin end, which is where the part starts. */
  readonly tailXPx: number;
  readonly tailYPx: number;
  /** The fat end, which is the head, and where the part lands. */
  readonly headXPx: number;
  readonly headYPx: number;
  readonly lengthPx: number;
  readonly directionDegrees: number;
  /** Major over minor extent; a shaft with a head is several, a plate is not. */
  readonly elongation: number;
  readonly headWidthPx: number;
  readonly tailWidthPx: number;
}

export interface RejectedRedRegion {
  readonly areaPx: number;
  readonly reason: string;
  readonly centroidXPx: number;
  readonly centroidYPx: number;
}

export interface PanelArrowReading {
  readonly schemaVersion: typeof PANEL_ARROW_SCHEMA_VERSION;
  readonly arrows: readonly PanelArrow[];
  readonly rejected: readonly RejectedRedRegion[];
  readonly redPx: number;
  /**
   * Where the arrows travel, averaged over the largest group that points the
   * same way, or null when no arrow survived at all.
   *
   * A lone surviving arrow is a group of one and is returned, with a spread of
   * zero — which is a true statement about one arrow and not a corroborated
   * one. `agreedArrows` is how many arrows the average is over, and a caller
   * that wants corroboration has to require more than one; a panel that printed
   * two arrows pointing different ways returns the larger group and leaves the
   * other in `arrows`.
   */
  readonly displacementXPx: number | null;
  readonly displacementYPx: number | null;
  /** How far the individual arrows sit from that average. */
  readonly displacementSpreadPx: number | null;
  /** Arrows the average is over. One means uncorroborated, not precise. */
  readonly agreedArrows: number;
}

export interface PanelArrowOptions {
  /** Smallest red blob that can be an arrow, as a share of the panel. Defaults to 8e-5. */
  readonly minAreaFraction?: number;
  /** Largest. Above this it is a red part, not an arrow. Defaults to 6e-3. */
  readonly maxAreaFraction?: number;
  /** Major over minor extent an arrow must reach. Defaults to 2.5. */
  readonly minElongation?: number;
  /**
   * How white the surroundings may be before the blob is taken to be inside a
   * printed box. Sub-assembly boxes are drawn on white and hold arrows of their
   * own, which belong to the sub-build and not to this step. Defaults to 0.6.
   */
  readonly maxWhiteSurroundFraction?: number;
  /** Two arrows agree when their directions are within this. Defaults to 25. */
  readonly agreementDegrees?: number;
  /**
   * Where the arrow has to start from, one byte per pixel.
   *
   * An exploded step's arrow leaves the ghost, and the ghost is what the step's
   * yellow highlight rings — so an arrow whose tail is nowhere near the
   * highlight is not this step's. It matters because this booklet draws whole
   * sub-builds inside a step panel, numbered 1, 2, 3, with arrows of their own
   * that belong to the sub-build: step 47 printed three sub-steps on the open
   * page, and its only arrow was a brick going onto another brick two inches
   * from the model. Without this the reader hands back that arrow as the
   * step's answer.
   */
  readonly originMask?: Uint8Array;
  /** How far the tail may sit from the origin mask. Defaults to 60. */
  readonly originMarginPx?: number;
}

const DEGREES = 180 / Math.PI;

/** Red enough to be the booklet's arrow ink. */
export function isArrowRed(red: number, green: number, blue: number): boolean {
  return red > 150 && green < 90 && blue < 90 && red - green > 80 && red - blue > 80;
}

interface Component {
  readonly pixels: number[];
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function components(mask: Uint8Array, width: number, height: number): Component[] {
  const seen = new Uint8Array(mask.length);
  const found: Component[] = [];
  const stack: number[] = [];
  for (let seed = 0; seed < mask.length; seed += 1) {
    if (mask[seed] !== 1 || seen[seed] === 1) continue;
    const pixels: number[] = [];
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    stack.push(seed);
    seen[seed] = 1;
    while (stack.length > 0) {
      const index = stack.pop()!;
      pixels.push(index);
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
        x > 0 && y > 0 ? index - width - 1 : -1,
        x < width - 1 && y > 0 ? index - width + 1 : -1,
        x > 0 && y < height - 1 ? index + width - 1 : -1,
        x < width - 1 && y < height - 1 ? index + width + 1 : -1,
      ]) {
        if (neighbour < 0 || mask[neighbour] !== 1 || seen[neighbour] === 1) continue;
        seen[neighbour] = 1;
        stack.push(neighbour);
      }
    }
    found.push({ pixels, minX, maxX, minY, maxY });
  }
  return found;
}

/** How much of a ring just outside a box is printed white. */
function whiteSurround(raster: ArrowRaster, component: Component, marginPx: number): number {
  let white = 0;
  let counted = 0;
  const minX = Math.max(0, component.minX - marginPx);
  const maxX = Math.min(raster.width - 1, component.maxX + marginPx);
  const minY = Math.max(0, component.minY - marginPx);
  const maxY = Math.min(raster.height - 1, component.maxY + marginPx);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const insideBox =
        x > component.minX && x < component.maxX && y > component.minY && y < component.maxY;
      if (insideBox) continue;
      const at = (y * raster.width + x) * 4;
      counted += 1;
      if (
        raster.pixels[at]! >= 244 &&
        raster.pixels[at + 1]! >= 244 &&
        raster.pixels[at + 2]! >= 244
      ) {
        white += 1;
      }
    }
  }
  return counted === 0 ? 0 : white / counted;
}

/**
 * The arrows a panel prints, and why every other red blob was not one.
 *
 * The rejections are returned rather than dropped: a step whose arrow was
 * refused for being too round is a different problem from a step that printed no
 * red at all, and a caller deciding whether it has a ground truth needs to be
 * able to tell them apart.
 */
export function readDisplacementArrows(
  raster: ArrowRaster,
  options: PanelArrowOptions = {},
): PanelArrowReading {
  const needed = raster.width * raster.height * 4;
  if (raster.pixels.length !== needed) {
    throw new PanelArrowError(
      `The arrow raster holds ${raster.pixels.length} bytes but ${raster.width}x${raster.height} RGBA needs ${needed}. ` +
        `Read the arrows from the panel crop's own buffer at the size it was created with.`,
    );
  }
  const area = raster.width * raster.height;
  const minArea = Math.max(24, (options.minAreaFraction ?? 8e-5) * area);
  const maxArea = (options.maxAreaFraction ?? 6e-3) * area;
  const minElongation = options.minElongation ?? 2.5;
  const maxWhite = options.maxWhiteSurroundFraction ?? 0.6;
  const agreement = options.agreementDegrees ?? 25;
  const originMargin = options.originMarginPx ?? 60;
  // A mask with nothing in it is not a constraint, it is an absence of one.
  // Steps 1 and 38 of the sample booklet close no highlight contour — the first
  // step of a build has nothing already there to ring — and testing their
  // arrows against an empty origin rejected two 500px arrows apiece as
  // belonging to a sub-build that does not exist.
  let originHasPixels = false;
  if (options.originMask !== undefined) {
    for (let pixel = 0; pixel < options.originMask.length; pixel += 1) {
      if (options.originMask[pixel] === 1) {
        originHasPixels = true;
        break;
      }
    }
  }
  const origin = originHasPixels ? options.originMask : undefined;
  if (options.originMask !== undefined && options.originMask.length !== area) {
    throw new PanelArrowError(
      `The origin mask holds ${options.originMask.length} pixels but the panel is ${raster.width}x${raster.height}, needing ${area}. ` +
        `It is this step's highlight at the panel's own raster, which is where an exploded step's arrow starts.`,
    );
  }

  const red = new Uint8Array(area);
  let redPx = 0;
  for (let pixel = 0; pixel < area; pixel += 1) {
    const at = pixel * 4;
    if (!isArrowRed(raster.pixels[at]!, raster.pixels[at + 1]!, raster.pixels[at + 2]!)) continue;
    red[pixel] = 1;
    redPx += 1;
  }

  const arrows: PanelArrow[] = [];
  const rejected: RejectedRedRegion[] = [];
  for (const component of components(red, raster.width, raster.height)) {
    const count = component.pixels.length;
    let sumX = 0;
    let sumY = 0;
    for (const index of component.pixels) {
      sumX += index % raster.width;
      sumY += Math.floor(index / raster.width);
    }
    const centroidX = sumX / count;
    const centroidY = sumY / count;
    const reject = (reason: string) =>
      rejected.push({ areaPx: count, reason, centroidXPx: centroidX, centroidYPx: centroidY });
    if (count < minArea) {
      reject(`${count}px of red is under the ${Math.round(minArea)}px an arrow needs at this size`);
      continue;
    }
    if (count > maxArea) {
      reject(
        `${count}px of red is over the ${Math.round(maxArea)}px cap, so it is a red part rather than an arrow`,
      );
      continue;
    }

    let xx = 0;
    let yy = 0;
    let xy = 0;
    for (const index of component.pixels) {
      const dx = (index % raster.width) - centroidX;
      const dy = Math.floor(index / raster.width) - centroidY;
      xx += dx * dx;
      yy += dy * dy;
      xy += dx * dy;
    }
    xx /= count;
    yy /= count;
    xy /= count;
    const trace = xx + yy;
    const determinant = xx * yy - xy * xy;
    const root = Math.sqrt(Math.max(0, (trace * trace) / 4 - determinant));
    const major = trace / 2 + root;
    const minor = Math.max(1e-9, trace / 2 - root);
    const elongation = Math.sqrt(major / minor);
    if (elongation < minElongation) {
      reject(
        `red blob of ${count}px is ${elongation.toFixed(2)} times longer than it is wide, under the ${minElongation} an arrow shaft reaches`,
      );
      continue;
    }
    const white = whiteSurround(raster, component, 8);
    if (white > maxWhite) {
      reject(
        `red blob of ${count}px sits on ${(white * 100).toFixed(0)}% white, so it is inside a printed sub-assembly box and belongs to that build`,
      );
      continue;
    }

    // Principal axis, as the eigenvector of the larger eigenvalue.
    const axisX = Math.abs(xy) > 1e-9 ? major - yy : xx >= yy ? 1 : 0;
    const axisY = Math.abs(xy) > 1e-9 ? xy : xx >= yy ? 0 : 1;
    const axisLength = Math.hypot(axisX, axisY) || 1;
    const ux = axisX / axisLength;
    const uy = axisY / axisLength;

    let minT = Number.POSITIVE_INFINITY;
    let maxT = Number.NEGATIVE_INFINITY;
    for (const index of component.pixels) {
      const dx = (index % raster.width) - centroidX;
      const dy = Math.floor(index / raster.width) - centroidY;
      const t = dx * ux + dy * uy;
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }
    const length = maxT - minT;
    // The head is the fat end. Measured as the spread across the axis over the
    // outer quarter at each end, which is what tells an arrowhead from a shaft
    // without having to find the triangle.
    const widthNear = (from: number, to: number): number => {
      let sum = 0;
      let counted = 0;
      for (const index of component.pixels) {
        const dx = (index % raster.width) - centroidX;
        const dy = Math.floor(index / raster.width) - centroidY;
        const t = dx * ux + dy * uy;
        if (t < from || t > to) continue;
        sum += Math.abs(dx * -uy + dy * ux);
        counted += 1;
      }
      return counted === 0 ? 0 : sum / counted;
    };
    const quarter = length / 4;
    const lowWidth = widthNear(minT, minT + quarter);
    const highWidth = widthNear(maxT - quarter, maxT);
    const headAtHigh = highWidth >= lowWidth;
    const headT = headAtHigh ? maxT : minT;
    const tailT = headAtHigh ? minT : maxT;
    const tailX = centroidX + tailT * ux;
    const tailY = centroidY + tailT * uy;
    if (origin !== undefined) {
      let near = false;
      const fromX = Math.max(0, Math.round(tailX) - originMargin);
      const toX = Math.min(raster.width - 1, Math.round(tailX) + originMargin);
      const fromY = Math.max(0, Math.round(tailY) - originMargin);
      const toY = Math.min(raster.height - 1, Math.round(tailY) + originMargin);
      for (let y = fromY; y <= toY && !near; y += 1) {
        for (let x = fromX; x <= toX; x += 1) {
          if (origin[y * raster.width + x] === 1) {
            near = true;
            break;
          }
        }
      }
      if (!near) {
        reject(
          `arrow of ${count}px starts at (${Math.round(tailX)}, ${Math.round(tailY)}), over ${originMargin}px from anything this step highlighted, so it belongs to a sub-build drawn in the same panel rather than to this step`,
        );
        continue;
      }
    }
    arrows.push({
      areaPx: count,
      tailXPx: tailX,
      tailYPx: tailY,
      headXPx: centroidX + headT * ux,
      headYPx: centroidY + headT * uy,
      lengthPx: length,
      directionDegrees: Math.atan2((headT - tailT) * uy, (headT - tailT) * ux) * DEGREES,
      elongation,
      headWidthPx: headAtHigh ? highWidth : lowWidth,
      tailWidthPx: headAtHigh ? lowWidth : highWidth,
    });
  }

  // The consensus is taken over the largest group of arrows pointing the same
  // way. A panel with two arrows onto one part has two statements of one
  // displacement; a panel with arrows onto two parts has two displacements, and
  // averaging across them would invent a third that is neither.
  let bestGroup: PanelArrow[] = [];
  for (const anchor of arrows) {
    const group = arrows.filter((arrow) => {
      let gap = Math.abs(arrow.directionDegrees - anchor.directionDegrees);
      if (gap > 180) gap = 360 - gap;
      return gap <= agreement;
    });
    if (group.length > bestGroup.length) bestGroup = group;
  }
  const displacementX =
    bestGroup.length === 0
      ? null
      : bestGroup.reduce((sum, arrow) => sum + (arrow.headXPx - arrow.tailXPx), 0) /
        bestGroup.length;
  const displacementY =
    bestGroup.length === 0
      ? null
      : bestGroup.reduce((sum, arrow) => sum + (arrow.headYPx - arrow.tailYPx), 0) /
        bestGroup.length;
  const spread =
    displacementX === null || displacementY === null
      ? null
      : Math.sqrt(
          bestGroup.reduce(
            (sum, arrow) =>
              sum +
              (arrow.headXPx - arrow.tailXPx - displacementX) ** 2 +
              (arrow.headYPx - arrow.tailYPx - displacementY) ** 2,
            0,
          ) / bestGroup.length,
        );

  return {
    schemaVersion: PANEL_ARROW_SCHEMA_VERSION,
    arrows,
    rejected,
    redPx,
    displacementXPx: displacementX,
    displacementYPx: displacementY,
    displacementSpreadPx: spread,
    agreedArrows: bestGroup.length,
  };
}
