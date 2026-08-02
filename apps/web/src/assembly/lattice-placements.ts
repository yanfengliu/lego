import { scoreExplodedStep, type ExplodedStepScore, type StepPanelDelta } from "./exploded-score";

/**
 * Where a printed part could have gone, when the only thing known about it is
 * its printed shape.
 *
 * `enumeratePlacements` answers this properly, from a document and a catalog
 * part: it knows the part's studs and holes and what is already built, and it
 * returns transforms. None of that is available on a real booklet's first fifty
 * steps — the parts a printed set opens with are rarely in the catalog, and
 * before the first step there is no document at all.
 *
 * What the page does supply is the part's silhouette, drawn once at the ghost
 * position and outlined in yellow, and the stud grid it is drawn on. A part
 * moves on that grid: whole pitches along the two ground directions and whole
 * plate heights up. Those three world steps project to three pixel vectors under
 * the fitted camera, so the places the booklet could have drawn the part are the
 * integer combinations of them — the same silhouette, translated.
 *
 * That is a weaker enumeration than the real one and it is honest about which
 * way it is weak. It cannot rotate the part, so a step that turns a piece over
 * is not in the set. And the projection of a three-dimensional lattice into two
 * dimensions collapses depth: up one plate and back some studs can land on the
 * same pixel as staying put, and no picture separates them. Candidates are
 * therefore deduplicated by the pixel offset they round to, and what gets
 * ranked is where the part was drawn rather than where it is — which is all a
 * picture can ever decide. How much the dedupe removes depends on the panel's
 * own scale: at a range of six studs and six plates, the sample booklet's
 * 42px-per-stud panels keep all 2197 world triples as distinct pixels with the
 * two closest 4 to 6 pixels apart, while its 21px-per-stud panels collapse 22
 * of them and the two closest sit 2 pixels apart. So the candidate set is
 * thousands of places, but on a small panel some of them are a pixel or two
 * apart and no picture separates those. That is why a rank is reported next to
 * the distance from the winner to the answer: a rank alone cannot say whether
 * the runner-up was a stud away or a hair.
 */

export const LATTICE_PLACEMENT_SCHEMA_VERSION = "lego.lattice-placement/1" as const;

export class LatticePlacementError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LatticePlacementError";
  }
}

export interface PixelVector {
  readonly xPx: number;
  readonly yPx: number;
}

export interface LatticeTranslationOptions {
  /** One stud pitch along each ground direction, in pixels, from the camera fit. */
  readonly a: PixelVector;
  readonly b: PixelVector;
  /** One plate of height, in pixels. Straight up the page under an upright view. */
  readonly up: PixelVector;
  /** Whole pitches searched either way along each ground direction. */
  readonly studRange: number;
  /** Whole plates searched either way. */
  readonly plateRange: number;
}

export interface LatticeTranslation {
  readonly dxPx: number;
  readonly dyPx: number;
  /** One world triple that produces this pixel offset; others produce it too. */
  readonly studsA: number;
  readonly studsB: number;
  readonly plates: number;
  /** How many world triples in range land on this same pixel offset. */
  readonly aliases: number;
}

/** Every distinct pixel offset a part on this grid could be drawn at. */
export function latticeTranslations(
  options: LatticeTranslationOptions,
): readonly LatticeTranslation[] {
  for (const [label, value] of [
    ["studRange", options.studRange],
    ["plateRange", options.plateRange],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 64) {
      throw new LatticePlacementError(
        `${label} must be a whole number of grid steps between 0 and 64, received ${String(value)}. ` +
          `It is counted in stud pitches and plate heights, not pixels — a pixel radius belongs in the caller's pruning.`,
      );
    }
  }
  const byOffset = new Map<string, { entry: LatticeTranslation; aliases: number }>();
  for (let plates = -options.plateRange; plates <= options.plateRange; plates += 1) {
    for (let studsB = -options.studRange; studsB <= options.studRange; studsB += 1) {
      for (let studsA = -options.studRange; studsA <= options.studRange; studsA += 1) {
        const dxPx = Math.round(
          studsA * options.a.xPx + studsB * options.b.xPx + plates * options.up.xPx,
        );
        const dyPx = Math.round(
          studsA * options.a.yPx + studsB * options.b.yPx + plates * options.up.yPx,
        );
        const key = `${dxPx},${dyPx}`;
        const existing = byOffset.get(key);
        if (existing) {
          existing.aliases += 1;
          continue;
        }
        byOffset.set(key, {
          entry: { dxPx, dyPx, studsA, studsB, plates, aliases: 1 },
          aliases: 1,
        });
      }
    }
  }
  return [...byOffset.values()]
    .map(({ entry, aliases }) => ({ ...entry, aliases }))
    .sort((left, right) => left.dyPx - right.dyPx || left.dxPx - right.dxPx);
}

export interface SilhouetteRaster {
  readonly width: number;
  readonly height: number;
  /** The part as the booklet drew it, before it was moved. */
  readonly mask: Uint8Array;
}

export interface ScoredTranslation {
  readonly translation: LatticeTranslation;
  readonly score: ExplodedStepScore;
  /** Silhouette pixels that landed inside the frame at this offset. */
  readonly onFramePx: number;
  /** Silhouette pixels touching what was already drawn, which is what holds it up. */
  readonly touchingBuiltPx: number;
}

export interface TranslationSweepOptions {
  /**
   * A part has to touch what is already built. Candidates whose silhouette
   * shares no pixel with the built model, grown by this margin, are not scored
   * — nothing would hold them up, and on a printed panel this is the only form
   * of physics available without the part's identity.
   */
  readonly builtContactMarginPx?: number;
  /** Least of the silhouette that must land on the frame. Defaults to 0.9. */
  readonly minimumOnFrameFraction?: number;
  /** Refuses to run rather than truncate silently. Defaults to 4000. */
  readonly maximumCandidates?: number;
}

export interface TranslationSweep {
  readonly schemaVersion: typeof LATTICE_PLACEMENT_SCHEMA_VERSION;
  readonly scored: readonly ScoredTranslation[];
  readonly offered: number;
  readonly rejectedOffFrame: number;
  readonly rejectedUnsupported: number;
}

/**
 * Scores the printed silhouette at every place the grid could have put it.
 *
 * The prediction handed to `scoreExplodedStep` is the honest one a picture can
 * make and no better: the whole translated silhouette is what the candidate
 * would change, and the part of it that is not already model is what would
 * newly appear. It has no depth, so a candidate that would land behind the
 * built model is predicted to change pixels it would in fact hide behind — a
 * bias in favour of placements out in the open, which is stated here because it
 * cannot be removed without knowing the part.
 */
export function scoreLatticeTranslations(
  silhouette: SilhouetteRaster,
  alreadyBuilt: Uint8Array,
  translations: readonly LatticeTranslation[],
  delta: StepPanelDelta,
  options: TranslationSweepOptions = {},
): TranslationSweep {
  const { width, height } = silhouette;
  const area = width * height;
  if (silhouette.mask.length !== area) {
    throw new LatticePlacementError(
      `The silhouette holds ${silhouette.mask.length} pixels but ${width}x${height} needs ${area}. ` +
        `Take it from the step panel's own highlight at the raster the panel was cropped to.`,
    );
  }
  if (alreadyBuilt.length !== area) {
    throw new LatticePlacementError(
      `The built-model mask holds ${alreadyBuilt.length} pixels but the silhouette raster is ${width}x${height}, needing ${area}. ` +
        `Both come off the same panel crop, so a mismatch means one was built at a different size.`,
    );
  }
  if (delta.width !== width || delta.height !== height) {
    throw new LatticePlacementError(
      `The panel delta is ${delta.width}x${delta.height} and the silhouette raster is ${width}x${height}. ` +
        `Register the next panel onto this panel's own frame, then take the delta there.`,
    );
  }
  const maximum = options.maximumCandidates ?? 4000;
  if (translations.length > maximum) {
    throw new LatticePlacementError(
      `${translations.length} candidate offsets is over the ${maximum} this sweep will score, and each one costs a pass over ${area} pixels. ` +
        `Narrow studRange or plateRange in latticeTranslations, or raise maximumCandidates deliberately.`,
    );
  }
  const marginPx = options.builtContactMarginPx ?? 3;
  const minimumOnFrame = options.minimumOnFrameFraction ?? 0.9;

  const silhouettePixels: number[] = [];
  for (let pixel = 0; pixel < area; pixel += 1) {
    if (silhouette.mask[pixel] === 1) silhouettePixels.push(pixel);
  }
  if (silhouettePixels.length === 0) {
    throw new LatticePlacementError(
      `The printed silhouette is empty, so there is nothing to translate. ` +
        `A step whose yellow highlight never closed encloses no region — score it from the stroke instead, or skip it and say so.`,
    );
  }

  const scored: ScoredTranslation[] = [];
  const newlyVisible = new Uint8Array(area);
  const changed = new Uint8Array(area);
  let rejectedOffFrame = 0;
  let rejectedUnsupported = 0;

  for (const translation of translations) {
    let onFrame = 0;
    let touching = 0;
    const touched: number[] = [];
    for (const pixel of silhouettePixels) {
      const x = (pixel % width) + translation.dxPx;
      if (x < 0 || x >= width) continue;
      const y = Math.floor(pixel / width) + translation.dyPx;
      if (y < 0 || y >= height) continue;
      const target = y * width + x;
      onFrame += 1;
      touched.push(target);
      changed[target] = 1;
      if (alreadyBuilt[target] === 1) touching += 1;
      else newlyVisible[target] = 1;
    }
    const clear = () => {
      for (const target of touched) {
        changed[target] = 0;
        newlyVisible[target] = 0;
      }
    };
    if (onFrame < minimumOnFrame * silhouettePixels.length) {
      rejectedOffFrame += 1;
      clear();
      continue;
    }
    if (touching === 0 && marginPx >= 0) {
      // Contact is tested on the margin only when the silhouette itself misses,
      // so the common case costs nothing.
      let near = false;
      for (const target of touched) {
        const x = target % width;
        const y = (target - x) / width;
        for (let dy = -marginPx; dy <= marginPx && !near; dy += 1) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -marginPx; dx <= marginPx; dx += 1) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            if (alreadyBuilt[ny * width + nx] === 1) {
              near = true;
              break;
            }
          }
        }
        if (near) break;
      }
      if (!near) {
        rejectedUnsupported += 1;
        clear();
        continue;
      }
    }
    scored.push({
      translation,
      score: scoreExplodedStep({ newlyVisibleMask: newlyVisible, changedMask: changed }, delta),
      onFramePx: onFrame,
      touchingBuiltPx: touching,
    });
    clear();
  }

  return {
    schemaVersion: LATTICE_PLACEMENT_SCHEMA_VERSION,
    scored,
    offered: translations.length,
    rejectedOffFrame,
    rejectedUnsupported,
  };
}

export interface TranslationRanking {
  readonly candidates: number;
  readonly bestScore: number;
  readonly bestDxPx: number;
  readonly bestDyPx: number;
  /** Where the reference says the part went, and how the score treated it. */
  readonly referenceDxPx: number;
  readonly referenceDyPx: number;
  readonly referenceScore: number;
  /** Distinct offsets that outscored the reference. Zero is a first place. */
  readonly referenceRank: number;
  readonly tiedWithReference: number;
  readonly margin: number;
  /**
   * How far the top-scoring offset sits from the candidate the reference was
   * snapped to, in pixels.
   */
  readonly bestToReferencePx: number;
  /** The same, in stud pitches, which is the unit a placement is wrong in. */
  readonly bestToReferenceStuds: number;
  /**
   * How far the reference itself was from the nearest candidate before it was
   * snapped. Nothing bounds this: a reference far off the lattice is snapped
   * silently, and every number above would then describe a placement nobody
   * proposed. Read the rank only when this is small against a stud.
   */
  readonly referenceSnapPx: number;
}

/**
 * Ranks the sweep against a placement established some other way.
 *
 * The reference is matched to the nearest candidate offset rather than assumed
 * to be one: an arrow read off the page lands between grid positions, and
 * demanding that the score rank a placement that is not in its own candidate set
 * would measure the rounding.
 */
export function rankAgainstReference(
  sweep: TranslationSweep,
  reference: PixelVector,
  pixelsPerStud: number,
): TranslationRanking | null {
  if (sweep.scored.length === 0) return null;
  if (!(pixelsPerStud > 0)) {
    throw new LatticePlacementError(
      `rankAgainstReference needs a positive pixelsPerStud to report a distance in studs, received ${String(pixelsPerStud)}. ` +
        `Pass the camera fit's pixelsPerUnit for this panel.`,
    );
  }
  let nearest = sweep.scored[0]!;
  let nearestDistance = Number.POSITIVE_INFINITY;
  let best = sweep.scored[0]!;
  for (const entry of sweep.scored) {
    const distance = Math.hypot(
      entry.translation.dxPx - reference.xPx,
      entry.translation.dyPx - reference.yPx,
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = entry;
    }
    if (entry.score.score > best.score.score) best = entry;
  }
  const referenceScore = nearest.score.score;
  const beaten = sweep.scored.filter((entry) => entry.score.score > referenceScore + 1e-9).length;
  const tied = sweep.scored.filter(
    (entry) => entry !== nearest && Math.abs(entry.score.score - referenceScore) <= 1e-9,
  ).length;
  const bestWrong = sweep.scored
    .filter((entry) => entry !== nearest)
    .reduce((highest, entry) => Math.max(highest, entry.score.score), Number.NEGATIVE_INFINITY);
  const gap = Math.hypot(
    best.translation.dxPx - nearest.translation.dxPx,
    best.translation.dyPx - nearest.translation.dyPx,
  );
  return {
    candidates: sweep.scored.length,
    bestScore: best.score.score,
    bestDxPx: best.translation.dxPx,
    bestDyPx: best.translation.dyPx,
    referenceDxPx: nearest.translation.dxPx,
    referenceDyPx: nearest.translation.dyPx,
    referenceScore,
    referenceRank: beaten,
    tiedWithReference: tied,
    margin: Number.isFinite(bestWrong) ? referenceScore - bestWrong : referenceScore,
    bestToReferencePx: gap,
    bestToReferenceStuds: gap / pixelsPerStud,
    referenceSnapPx: nearestDistance,
  };
}
