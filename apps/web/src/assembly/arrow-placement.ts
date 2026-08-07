/**
 * Turning the arrow a booklet prints into a placement.
 *
 * The step's yellow highlight says what the part is and which way round it is
 * drawn. The red arrow says where it goes. Between them that is a placement,
 * except for one thing the picture cannot supply: depth.
 *
 * A pixel displacement is two numbers and a brick moves on three axes, so
 * inverting the projection is underdetermined. The integer grid cuts the
 * solution line down to a handful of points, and how many depends entirely on
 * one number that is easy to get wrong.
 *
 * A plate of height projects to about a third of a stud on this booklet's
 * cameras — 0.322 to 0.330 across the panels that fitted one. So a tolerance
 * wider than that cannot tell one height from the next, and the family always
 * contains its own neighbours: at a third of a stud the arrows of the sample
 * booklet admit 12 to 18 triples apiece. At 0.15 of a stud — under half a plate,
 * and still three times the corrected arrow's own scatter — the same arrows
 * admit 2 to 4. The tolerance is the whole design, which is why it defaults
 * below the height quantum and says so.
 *
 * Even at 2 to 4 the arrow does not place a part. It reduces the search from
 * the couple of thousand offsets a blind sweep of the grid would try to a
 * shortlist, and hands that to the thing that can tell them apart: whether the
 * part would be held up and whether it would pass through something. The
 * picture proposes, the domain disposes.
 *
 * **The arrow measures its direction, not its length.** That was assumed for a
 * while and it is false, on the panel the assumption was written for. Printed
 * step 2 of `recipes/6651557.pdf` draws two arrows into one part: their
 * directions agree to 0.14 degrees, and their lengths disagree by 3.00 work
 * pixels on a 33.50px vector — 1.50px of scatter along the axis against 0.03px
 * across it, so the same pair of arrows states the direction about fifty times
 * more precisely than the travel. And the travel they state is short: the
 * placement the booklet draws is 46.17px away, 38% further than the ink.
 *
 * The reason is visible in where the ink stops. Both tails sit *inside* the
 * step's own highlight region and both heads sit *inside* the already-built art
 * (`measureArrowClearances` returns 0 to each on that panel), so the arrow is
 * not inked from clear of one body to clear of the other — it is drawn from the
 * part to the model, and it stops at the model's visible surface because the
 * seat it is heading for is *behind* that surface. An arrow cannot draw the
 * occluded remainder of its own travel, and an exploded step is exploded
 * precisely because the seat is hidden.
 *
 * So the arrow gives a line and a floor: the part travels along the arrow's
 * axis, at least as far as the arrow is inked. What bounds it above is also on
 * the panel rather than in a constant — the part cannot pass clean through the
 * model it is joining, so the material point that starts at the tail ends no
 * further along than the far side of the already-built art.
 */

import { dilateMask } from "@lego-studio/rendering";

import { distanceToMask } from "./panel-difference";
import type { PixelVector } from "./lattice-placements";

export const ARROW_PLACEMENT_SCHEMA_VERSION = "lego.arrow-placement/1" as const;

/** One plate of height, in LDU. */
export const PLATE_HEIGHT_LDU = 8 as const;
/** One stud pitch, in LDU. */
export const STUD_PITCH_LDU = 20 as const;

export class ArrowPlacementError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ArrowPlacementError";
  }
}

export interface PanelProjection {
  /** One stud pitch along world X, in pixels. */
  readonly a: PixelVector;
  /** One stud pitch along world Z, in pixels. */
  readonly b: PixelVector;
  /** One plate of height, in pixels. Straight up the page under an upright view. */
  readonly up: PixelVector;
  /** Pixels per stud pitch, for reporting an error in the unit that matters. */
  readonly pixelsPerStud: number;
}

export interface DisplacementCandidate {
  readonly studsA: number;
  readonly studsB: number;
  /** Plates upward. Positive is up the page, which is negative LDU y. */
  readonly plates: number;
  readonly lduX: number;
  readonly lduY: number;
  readonly lduZ: number;
  /** How far along the arrow's own axis this triple carries the part, in pixels. */
  readonly travelPx: number;
  /** How far its projection sits off the arrow's line, in pixels. */
  readonly offLinePx: number;
  readonly offLineStuds: number;
}

export interface TravelFamilyOptions {
  /** Whole pitches searched either way along each ground direction. Defaults to 8. */
  readonly studRange?: number;
  /** Whole plates searched either way. Defaults to 12. */
  readonly plateRange?: number;
  /**
   * How far a triple's projection may sit off the arrow's *line*, in stud
   * pitches. Defaults to 0.15.
   *
   * Across the axis is where the arrow is accurate: panel 2's two arrows scatter
   * 0.03px there against 1.50px along it. The default is nonetheless kept at the
   * value the length tolerance used, because two arrows are too few to calibrate
   * a tighter one — and it makes no difference on that panel, where 0.10 and
   * 0.15 admit exactly the same 22 triples. The nearest off-line class beyond
   * the arrow's own is at 0.066 of a stud, so the setting has room either way.
   */
  readonly toleranceStuds?: number;
  /** Refuses rather than truncating. Defaults to 200. */
  readonly maximumFamily?: number;
}

/**
 * Every whole-grid displacement that runs along the arrow, as far as it can have.
 *
 * The window is `[|arrow|, ceilingPx]` and both ends are measurements rather than
 * settings. The floor is the ink: the arrow is drawn from the part to the model,
 * so the part travels at least the length that was drawn. The ceiling comes from
 * `measureArrowTravelCeiling`, which is where the model the part is joining stops
 * — travel beyond that carries the part clean through it.
 *
 * Sorted off-line first and then by travel, closest first — but the caller must
 * not read that order as a ranking of correctness. It is a ranking of pixel
 * agreement, and on a projection this degenerate several triples agree to within
 * the measurement. The order is there so that ties can be broken deterministically
 * after physics has had its say, not before.
 */
export function arrowTravelFamily(
  projection: PanelProjection,
  displacementPx: PixelVector,
  ceilingPx: number,
  options: TravelFamilyOptions = {},
): readonly DisplacementCandidate[] {
  const studRange = options.studRange ?? 8;
  const plateRange = options.plateRange ?? 12;
  const toleranceStuds = options.toleranceStuds ?? 0.15;
  const maximumFamily = options.maximumFamily ?? 200;
  for (const [label, value] of [
    ["studRange", studRange],
    ["plateRange", plateRange],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 64) {
      throw new ArrowPlacementError(
        `${label} must be a whole number of grid steps between 0 and 64, received ${String(value)}. ` +
          `It counts stud pitches and plate heights, not pixels or LDU.`,
      );
    }
  }
  if (!(projection.pixelsPerStud > 0)) {
    throw new ArrowPlacementError(
      `The projection needs a positive pixelsPerStud, received ${String(projection.pixelsPerStud)}. ` +
        `It is the camera fit's own pixelsPerUnit, and it is what turns a pixel error into a stud error.`,
    );
  }
  if (!(toleranceStuds >= 0)) {
    throw new ArrowPlacementError(
      `toleranceStuds must be non-negative, received ${String(toleranceStuds)}. ` +
        `It is how far a triple's projection may sit off the arrow's line, and two arrows onto one part agree in direction to about a hundredth of a stud.`,
    );
  }
  const drawnPx = Math.hypot(displacementPx.xPx, displacementPx.yPx);
  if (!(drawnPx > 0)) {
    throw new ArrowPlacementError(
      `An arrow of zero length states no direction, so there is no line to search along. ` +
        `The reader returns a displacement only when at least one arrow survived; a zero here means the caller built the vector itself.`,
    );
  }

  const alongX = displacementPx.xPx / drawnPx;
  const alongY = displacementPx.yPx / drawnPx;
  const tolerancePx = toleranceStuds * projection.pixelsPerStud;
  const found: DisplacementCandidate[] = [];
  for (let plates = -plateRange; plates <= plateRange; plates += 1) {
    for (let studsB = -studRange; studsB <= studRange; studsB += 1) {
      for (let studsA = -studRange; studsA <= studRange; studsA += 1) {
        const xPx =
          studsA * projection.a.xPx + studsB * projection.b.xPx + plates * projection.up.xPx;
        const yPx =
          studsA * projection.a.yPx + studsB * projection.b.yPx + plates * projection.up.yPx;
        const travelPx = xPx * alongX + yPx * alongY;
        if (travelPx < drawnPx || travelPx > ceilingPx) continue;
        const offLinePx = Math.abs(xPx * -alongY + yPx * alongX);
        if (offLinePx > tolerancePx) continue;
        found.push({
          studsA,
          studsB,
          plates,
          lduX: studsA * STUD_PITCH_LDU,
          // The document's y runs down, so a plate up the page is a plate down
          // the axis. Getting this backwards drops parts through the model and
          // the validator then refuses every candidate, which reads as "the
          // arrow found nothing" rather than as a sign error.
          lduY: -plates * PLATE_HEIGHT_LDU,
          lduZ: studsB * STUD_PITCH_LDU,
          travelPx,
          offLinePx,
          offLineStuds: offLinePx / projection.pixelsPerStud,
        });
      }
    }
  }
  if (found.length > maximumFamily) {
    throw new ArrowPlacementError(
      `The arrow admits ${found.length} whole-grid displacements within ${toleranceStuds} of a stud of its line and ${ceilingPx.toFixed(1)}px of travel, over the ${maximumFamily} this will return. ` +
        `Either the tolerance is far wider than the arrow's own direction accuracy, the ceiling reaches past the model the part is joining, or the ranges are wider than the part could have travelled.`,
    );
  }
  return found.sort(
    (left, right) => left.offLinePx - right.offLinePx || left.travelPx - right.travelPx,
  );
}

export interface ArbitratedPlacement {
  readonly candidate: DisplacementCandidate;
  readonly positionLdu: readonly [number, number, number];
  readonly accepted: boolean;
  /** What the domain said when it refused. Empty when it accepted. */
  readonly refusal: string;
}

export interface ArrowArbitration {
  readonly schemaVersion: typeof ARROW_PLACEMENT_SCHEMA_VERSION;
  readonly attempts: readonly ArbitratedPlacement[];
  readonly offered: number;
  readonly accepted: number;
  /**
   * One candidate survived, so the picture and the domain between them named a
   * placement and nothing had to be guessed.
   */
  readonly unique: boolean;
  /** The accepted candidate closest to the arrow, or null when none survived. */
  readonly best: ArbitratedPlacement | null;
}

/**
 * Asks the domain which of the arrow's candidates could actually be built.
 *
 * The arbiter arrives as a callback rather than an import, the way the search
 * driver takes its dependencies, so this stays free of the command layer and
 * the catalog: the caller passes whatever refuses an unsupported or colliding
 * placement, and this counts what survives.
 *
 * `unique` is the number worth watching. The arrow's job is not to be right on
 * its own — it is to cut the search down to something physics can settle — and
 * a run where physics is left with one answer is a step that placed itself.
 */
export function arbitrateArrowCandidates(
  candidates: readonly DisplacementCandidate[],
  fromPositionLdu: readonly [number, number, number],
  tryPlace: (positionLdu: readonly [number, number, number]) => string | null,
): ArrowArbitration {
  const attempts = candidates.map((candidate) => {
    const positionLdu = [
      fromPositionLdu[0] + candidate.lduX,
      fromPositionLdu[1] + candidate.lduY,
      fromPositionLdu[2] + candidate.lduZ,
    ] as const;
    const refusal = tryPlace(positionLdu);
    return {
      candidate,
      positionLdu,
      accepted: refusal === null,
      refusal: refusal ?? "",
    } satisfies ArbitratedPlacement;
  });
  const survivors = attempts.filter((attempt) => attempt.accepted);
  return {
    schemaVersion: ARROW_PLACEMENT_SCHEMA_VERSION,
    attempts,
    offered: attempts.length,
    accepted: survivors.length,
    unique: survivors.length === 1,
    best: survivors[0] ?? null,
  };
}

/**
 * The projection to invert an arrow that was read off a downsampled raster.
 *
 * A camera fit is measured on one raster and an arrow is often read on another.
 * The run fits the stud lattice on the full-resolution panel crop and then reads
 * the arrows off the same crop downsampled by `workFactor`, so a displacement in
 * work pixels inverted through the full-resolution projection reports exactly
 * `workFactor` times too little travel. The renderer already divides — every
 * candidate is rendered at `pixelsPerUnit / workFactor` — and the arrow path is
 * the one place that did not, which halved every arrow-derived displacement in
 * the repository.
 *
 * It is stated as its own function rather than as a division at the call site
 * because the two rasters are the whole content of the mistake: the caller has
 * to name which raster its pixels were measured on, and cannot express that by
 * passing a fit alone.
 */
export function panelProjectionForWorkRaster(
  fit: {
    readonly azimuthDegrees: number;
    readonly elevationDegrees: number;
    readonly pixelsPerUnit: number;
  },
  workFactor: number,
): PanelProjection {
  if (!Number.isInteger(workFactor) || workFactor < 1) {
    throw new ArrowPlacementError(
      `workFactor must be a whole downsampling factor of at least 1, received ${String(workFactor)}. ` +
        `It is how many full-resolution pixels one measured pixel spans, so a fractional or zero factor describes no raster.`,
    );
  }
  return panelProjectionFromFit({ ...fit, pixelsPerUnit: fit.pixelsPerUnit / workFactor });
}

/** The projection a fitted panel camera implies, in the form the inversion needs. */
export function panelProjectionFromFit(fit: {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
}): PanelProjection {
  const azimuth = (fit.azimuthDegrees * Math.PI) / 180;
  const elevation = (fit.elevationDegrees * Math.PI) / 180;
  const scale = fit.pixelsPerUnit;
  return {
    a: { xPx: scale * Math.cos(azimuth), yPx: scale * Math.sin(elevation) * Math.sin(azimuth) },
    b: { xPx: -scale * Math.sin(azimuth), yPx: scale * Math.sin(elevation) * Math.cos(azimuth) },
    // One plate of the twenty-LDU pitch, straight up the page.
    up: { xPx: 0, yPx: (-scale * Math.cos(elevation) * PLATE_HEIGHT_LDU) / STUD_PITCH_LDU },
    pixelsPerStud: scale,
  };
}

export interface MeasuredClearance {
  /** Distance from the arrow's tail to the ghost's own outline, in pixels. */
  readonly tailToGhostPx: number | null;
  /** Distance from its head to the model already there, in pixels. */
  readonly headToBuiltPx: number | null;
  readonly lengthPx: number;
}

export interface ArrowTravelCeiling {
  /** The arrows' mean tail, projected onto the arrow's own axis. */
  readonly tailAlongPx: number;
  /** How far the model the part is joining reaches along that axis. */
  readonly modelFarAlongPx: number;
  /** The two, differenced: the furthest the part can have travelled. */
  readonly ceilingPx: number;
}

/**
 * The furthest along its own axis the part can have travelled.
 *
 * The arrow's tail lies on the ghost — `readDisplacementArrows` only keeps an
 * arrow whose tail is within its origin margin of what the step highlighted — so
 * the material point that starts there ends up somewhere on or in the model the
 * arrow points at. Beyond the far side of that model it has passed clean through
 * it, which is not a placement any build sequence reaches.
 *
 * That makes the ceiling a measurement of the panel rather than a setting. On
 * printed step 2 of the sample booklet it is 80.50px against a drawn arrow of
 * 33.50px and a true travel of 46.17px, and the answer stays the single drawn
 * placement anywhere from 43px to about 105px of ceiling — so it is not a bound
 * the answer sits on the edge of.
 *
 * Returns a ceiling below the drawn length when the two disagree, rather than
 * clamping: an empty family then says the panel's own arrow and its own art do
 * not describe the same travel, which is a fact about the panel worth surfacing.
 */
export function measureArrowTravelCeiling(
  arrows: readonly { readonly tailXPx: number; readonly tailYPx: number }[],
  displacementPx: PixelVector,
  alreadyBuilt: { readonly width: number; readonly height: number; readonly mask: Uint8Array },
): ArrowTravelCeiling {
  const drawnPx = Math.hypot(displacementPx.xPx, displacementPx.yPx);
  if (!(drawnPx > 0)) {
    throw new ArrowPlacementError(
      `An arrow of zero length states no axis, so nothing can be projected onto it. ` +
        `The reader returns a displacement only when at least one arrow survived; a zero here means the caller built the vector itself.`,
    );
  }
  if (arrows.length === 0) {
    throw new ArrowPlacementError(
      `A travel ceiling is measured from where the arrows start, and none were given. ` +
        `The displacement is a consensus over arrows that were kept, so the same arrows are available to the caller.`,
    );
  }
  if (alreadyBuilt.mask.length !== alreadyBuilt.width * alreadyBuilt.height) {
    throw new ArrowPlacementError(
      `The already-built mask holds ${alreadyBuilt.mask.length} pixels against the ${alreadyBuilt.width}x${alreadyBuilt.height} raster it claims. ` +
        `It comes off the same panel raster as the arrows; a mismatch means one of them was extracted at another size.`,
    );
  }
  const alongX = displacementPx.xPx / drawnPx;
  const alongY = displacementPx.yPx / drawnPx;
  const tailAlongPx =
    arrows.reduce((sum, arrow) => sum + arrow.tailXPx * alongX + arrow.tailYPx * alongY, 0) /
    arrows.length;
  let modelFarAlongPx = Number.NEGATIVE_INFINITY;
  for (let pixel = 0; pixel < alreadyBuilt.mask.length; pixel += 1) {
    if (alreadyBuilt.mask[pixel] !== 1) continue;
    const along =
      (pixel % alreadyBuilt.width) * alongX + Math.floor(pixel / alreadyBuilt.width) * alongY;
    if (along > modelFarAlongPx) modelFarAlongPx = along;
  }
  return {
    tailAlongPx,
    modelFarAlongPx,
    ceilingPx: modelFarAlongPx - tailAlongPx,
  };
}

export interface ClearanceMasks {
  readonly width: number;
  readonly height: number;
  /** This step's own highlight stroke, which rings the ghost the arrow leaves. */
  readonly ghostStrokeMask: Uint8Array;
  /** The model that was already there, which is what the arrow points at. */
  readonly alreadyBuiltMask: Uint8Array;
}

/**
 * The model that was already there: this panel's assembly, with what this step
 * highlighted taken out of it.
 *
 * The arrow's head points at the surface the part lands on, and that surface
 * belongs to the previous steps. Leaving this step's own parts in would let the
 * head measure zero against the very thing it is travelling towards.
 */
export function alreadyBuiltMask(
  assemblyMask: Uint8Array,
  highlightMask: Uint8Array,
  highlightStrokeMask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const claimed = dilateMask(highlightStrokeMask, width, height, 3);
  const built = new Uint8Array(width * height);
  for (let pixel = 0; pixel < built.length; pixel += 1) {
    if (assemblyMask[pixel] === 1 && claimed[pixel] !== 1 && highlightMask[pixel] !== 1) {
      built[pixel] = 1;
    }
  }
  return built;
}

/**
 * How far each arrow's ends sit from the ghost's outline and from the model.
 *
 * This was written as "the clearance the artist left", on the assumption that an
 * arrow is inked from clear of one body to clear of the other and that adding
 * both gaps back recovers the travel. Panel 2 of the sample booklet refutes it:
 * both tails lie *inside* the printed highlight region and both heads *inside*
 * the already-built art, so both numbers come back 0 to the region and 0 to the
 * art, and the 4.33px each tail reports to the highlight *stroke* is the
 * distance from a point inside the yellow band out to it — not a gap in front of
 * the part. Adding it to the arrow lengthened a vector that was already 38%
 * short. Nothing builds a travel out of these any more; they are published as a
 * census of where the ink actually falls.
 *
 * A gap that falls outside the panel, or is measured against a mask with nothing
 * in it, comes back null rather than as a number, because "no ghost outline to
 * measure from" and "the arrow starts exactly on the outline" are different
 * facts and a zero would say the second when the first is true.
 */
export function measureArrowClearances(
  arrows: readonly {
    readonly tailXPx: number;
    readonly tailYPx: number;
    readonly headXPx: number;
    readonly headYPx: number;
    readonly lengthPx: number;
  }[],
  masks: ClearanceMasks,
): readonly MeasuredClearance[] {
  const toGhost = distanceToMask(masks.ghostStrokeMask, masks.width, masks.height);
  const toBuilt = distanceToMask(masks.alreadyBuiltMask, masks.width, masks.height);
  const sample = (field: Float64Array, x: number, y: number): number | null => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || px >= masks.width || py < 0 || py >= masks.height) return null;
    const value = field[py * masks.width + px]!;
    return Number.isFinite(value) ? value : null;
  };
  return arrows.map((arrow) => ({
    tailToGhostPx: sample(toGhost, arrow.tailXPx, arrow.tailYPx),
    headToBuiltPx: sample(toBuilt, arrow.headXPx, arrow.headYPx),
    lengthPx: arrow.lengthPx,
  }));
}

/**
 * The mean of the gaps that measured both ends, in stud pitches.
 *
 * A census figure, not a correction: see `measureArrowClearances` for why these
 * gaps are not the arrow's shortfall.
 */
export function arrowShortfallStuds(
  clearances: readonly MeasuredClearance[],
  pixelsPerStud: number,
): number | null {
  const both = clearances.filter(
    (entry) => entry.tailToGhostPx !== null && entry.headToBuiltPx !== null,
  );
  if (both.length === 0 || !(pixelsPerStud > 0)) return null;
  const total = both.reduce((sum, entry) => sum + entry.tailToGhostPx! + entry.headToBuiltPx!, 0);
  return total / both.length / pixelsPerStud;
}
