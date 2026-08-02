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

export interface ArrowClearance {
  /** Gap between the arrow's tail and the ghost's own outline, in pixels. */
  readonly tailToGhostPx: number | null;
  /** Gap between its head and the model already there, in pixels. */
  readonly headToBuiltPx: number | null;
}

/**
 * The arrow's vector with the clearance it was drawn with added back.
 *
 * An arrow is inked from clear of the ghost to clear of the landing surface, so
 * tail-to-head is shorter than the part's travel by the two gaps. Measured on
 * the sample booklet that shortfall is 0.00 to 0.47 of a stud, median 0.22 —
 * small, always in the same direction, and readable off the same pixels as the
 * arrow, which is what makes it a correction rather than an error.
 *
 * A missing gap is treated as zero rather than guessed. That under-corrects,
 * which leaves the answer where it already was; inventing a clearance would move
 * it somewhere nobody measured.
 */
export function correctArrowForClearance(
  displacement: PixelVector,
  clearance: ArrowClearance,
): PixelVector {
  const length = Math.hypot(displacement.xPx, displacement.yPx);
  if (!(length > 0)) {
    throw new ArrowPlacementError(
      `An arrow of zero length has no direction to extend along, so its clearance cannot be added back. ` +
        `The reader returns a displacement only when at least one arrow survived; a zero here means the caller built the vector itself.`,
    );
  }
  const added = (clearance.tailToGhostPx ?? 0) + (clearance.headToBuiltPx ?? 0);
  const scale = (length + added) / length;
  return { xPx: displacement.xPx * scale, yPx: displacement.yPx * scale };
}

export interface DisplacementCandidate {
  readonly studsA: number;
  readonly studsB: number;
  /** Plates upward. Positive is up the page, which is negative LDU y. */
  readonly plates: number;
  readonly lduX: number;
  readonly lduY: number;
  readonly lduZ: number;
  readonly errorPx: number;
  readonly errorStuds: number;
}

export interface DisplacementFamilyOptions {
  /** Whole pitches searched either way along each ground direction. Defaults to 8. */
  readonly studRange?: number;
  /** Whole plates searched either way. Defaults to 12. */
  readonly plateRange?: number;
  /**
   * How far a triple's projection may sit from the arrow, in stud pitches.
   * Defaults to 0.15.
   *
   * The default is chosen against the height quantum, not against the arrow. A
   * plate projects to about a third of a stud, so anything at or above that
   * admits the neighbouring height by construction and the family stops meaning
   * anything. Below half a plate it separates heights; the corrected arrow's own
   * scatter is around 0.05, so 0.15 leaves three times the measurement's error
   * and still resolves the grid.
   */
  readonly toleranceStuds?: number;
  /** Refuses rather than truncating. Defaults to 200. */
  readonly maximumFamily?: number;
}

/**
 * Every whole-grid displacement whose projection matches the arrow.
 *
 * Sorted by how far its projection sits from the arrow, closest first — but the
 * caller must not read that order as a ranking of correctness. It is a ranking
 * of pixel agreement, and on a projection this degenerate several triples agree
 * to within the measurement. The order is there so that ties can be broken
 * deterministically after physics has had its say, not before.
 */
export function arrowDisplacementFamily(
  projection: PanelProjection,
  displacementPx: PixelVector,
  options: DisplacementFamilyOptions = {},
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
        `It is how far a candidate's projection may sit from the arrow, and the arrow itself is good to about a fifth of a stud once its clearance is corrected.`,
    );
  }

  const tolerancePx = toleranceStuds * projection.pixelsPerStud;
  const found: DisplacementCandidate[] = [];
  for (let plates = -plateRange; plates <= plateRange; plates += 1) {
    for (let studsB = -studRange; studsB <= studRange; studsB += 1) {
      for (let studsA = -studRange; studsA <= studRange; studsA += 1) {
        const errorX =
          studsA * projection.a.xPx +
          studsB * projection.b.xPx +
          plates * projection.up.xPx -
          displacementPx.xPx;
        const errorY =
          studsA * projection.a.yPx +
          studsB * projection.b.yPx +
          plates * projection.up.yPx -
          displacementPx.yPx;
        const errorPx = Math.hypot(errorX, errorY);
        if (errorPx > tolerancePx) continue;
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
          errorPx,
          errorStuds: errorPx / projection.pixelsPerStud,
        });
      }
    }
  }
  if (found.length > maximumFamily) {
    throw new ArrowPlacementError(
      `The arrow admits ${found.length} whole-grid displacements within ${toleranceStuds} of a stud, over the ${maximumFamily} this will return. ` +
        `Either the tolerance is far wider than the arrow's own accuracy of about a fifth of a stud, or the ranges are wider than the part could have travelled.`,
    );
  }
  return found.sort((left, right) => left.errorPx - right.errorPx);
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

export interface MeasuredClearance extends ArrowClearance {
  readonly lengthPx: number;
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
 * How much clearance the artist left at each end of each arrow.
 *
 * Both gaps come off the same pixels as the arrow, which is what makes the
 * shortfall a correction rather than an error bar. A gap that falls outside the
 * panel, or is measured against a mask with nothing in it, comes back null
 * rather than as a number, because "no ghost outline to measure from" and "the
 * arrow starts exactly on the outline" are different facts and a zero would say
 * the second when the first is true.
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

/** The mean of the clearances that measured both ends, in stud pitches. */
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
