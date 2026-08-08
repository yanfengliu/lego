/**
 * Reading an exploded printed step against the ghost it draws.
 *
 * A step highlight normally rings the part where it seats, and `scoreStepDelta`
 * compares a candidate's seated silhouette against it. On an exploded step that
 * is the wrong comparison, and measurably so: printed step 2 of
 * `recipes/6651557.pdf` draws the new wedge floating below the assembly with two
 * arrows pointing up into it, so its 527px closed contour outlines the *ghost*.
 * The placement the booklet actually draws, scored where it seats, reaches a
 * region IoU of 0.000155 — it is almost entirely hidden behind what step 1 built
 * — and the best-scoring seated candidate is simply whichever wrong seat happens
 * to overlap the ghost region most.
 *
 * So the candidate to compare is the part where it is *drawn*, which is the seat
 * minus the arrow's travel. `arbitrateArrowCandidates` fixes that sign: it
 * builds a seat as `from + displacement`, so a family member is ghost-to-seat and
 * a ghost is `seat - displacement`.
 *
 * Three things about the comparison are not obvious and all three were measured.
 *
 * **The ghost is drawn clear of the assembly, so it is predicted unoccluded.**
 * The booklet floats it where the reader can see the whole part, so the mask to
 * compare is the step's own parts rendered alone rather than the candidate
 * prefix. A ghost predicted this way that nevertheless lands on top of the
 * already-built art is a ghost the booklet would have drawn occluded, and the
 * prediction is then a lie; on panel 2 the drawn ghost overlaps the built art by
 * 0 to 8 pixels of about 2795, so the honest cases cost nothing.
 *
 * **The printed contour is the silhouette offset outward, so the right answer is
 * wholly inside it.** Dilating the drawn ghost's silhouette and comparing it to
 * the printed region on panel 2 gives IoU 0.5817 undilated, 0.7597 at radius 3,
 * a peak of 0.8153 at radius 5 and 0.8052 at radius 6 — the yellow is drawn
 * about five work pixels clear of the part all the way round. A correctly placed
 * ghost therefore has *no* pixel outside the printed region, and that is the test
 * used here. It needs no threshold: a wholly contained ghost scores exactly
 * `|ghost| / |region|`, which is this panel's own ceiling, and anything spilling
 * outside scores strictly less.
 *
 * That ceiling is why a global bar cannot serve. On panel 2 it is about
 * 2795/4749 = 0.5883, so the run's 0.45 whole-step bar is 76% of everything
 * achievable here, while on a synthetic panel — whose highlight *is* the
 * silhouette — the same 0.45 is under half of a ceiling near 1.0. The same
 * number asks two different questions.
 *
 * **The region is the whole ranking key; the stroke term is not usable here.**
 * `scoreStepDelta` blends region IoU with a stroke F1 because a seated part's
 * contour often fails to close. A ghost is drawn clear, so its contour always
 * closes and the region term is always available — and the stroke term is
 * actively wrong, because the yellow sits about five work pixels outside the
 * part and a three-pixel tolerance cannot bridge that, so it scores the artist's
 * offset rather than the placement.
 *
 * The inversion that follows is a number rather than a claim. On printed panel 2
 * the placement the booklet draws scores region IoU 0.5887555 with *no* pixel
 * outside the contour, stroke F1 0.5684824, and blends to 0.5806463; a candidate
 * spilling 46 pixels outside scores region IoU 0.5728884, stroke F1 0.6326254,
 * and blends to 0.5967832. `scoreStepDelta`'s blend therefore puts the spilling
 * ghost first and the region term puts the contained one first. Nothing on this
 * road reads the blend: `decideExplodedGhostPlacement` below sorts on
 * `regionIou`, and `real-build-exploded-step.ts` picks a seat's family member by
 * containment. Both choices are held by `real-build-exploded-step.test.ts`,
 * whose synthetic panel now carries a stroke drawn outward the way the booklet
 * draws one — on it the contained ghost's stroke F1 is 0, so swapping either key
 * for the blend fails loudly instead of silently placing a spilling ghost.
 *
 * And containment does not name a seat on its own. Every candidate seat sits on
 * the same 20/8 lattice, so `{seat - displacement}` reaches the same pictures
 * from different seats, and a ghost free to sit anywhere on the grid is exactly
 * blind to the seat. What this can answer is whether *one* candidate explains the
 * drawing: when more than one ghost is wholly contained the picture does not
 * distinguish them, and the caller is told that rather than handed a winner.
 */

export const GHOST_PLACEMENT_SCHEMA_VERSION = "lego.exploded-ghost-placement/1" as const;

export interface GhostContainment {
  /** Pixels the ghost covers on this raster. */
  readonly ghostPx: number;
  /** Ghost pixels the printed region also claims. */
  readonly insideRegionPx: number;
  /** Ghost pixels the printed region does not claim — the disagreement. */
  readonly outsideRegionPx: number;
  /** Ghost pixels lying on art the panel had already drawn before this step. */
  readonly overlapsBuiltPx: number;
  /** Region agreement, the quantity `scoreStepDelta` calls `regionIou`. */
  readonly regionIou: number;
  /**
   * What a wholly contained ghost of this size scores against this region.
   *
   * A property of the panel and the part, not of the placement: a ghost inside
   * the region intersects in all of itself and unions to the whole region.
   */
  readonly containmentCeiling: number;
  /** Every ghost pixel is inside the printed region. */
  readonly contained: boolean;
}

export class GhostPlacementError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GhostPlacementError";
  }
}

/** How much of a predicted ghost the printed region claims, and how much it does not. */
export function measureGhostContainment(
  ghostMask: Uint8Array,
  regionMask: Uint8Array,
  builtMask?: Uint8Array,
): GhostContainment {
  if (ghostMask.length !== regionMask.length) {
    throw new GhostPlacementError(
      `A ghost of ${ghostMask.length} pixels cannot be compared against a printed region of ${regionMask.length}. ` +
        `Render the ghost through the camera fitted to this panel, at the panel's own raster size.`,
    );
  }
  if (builtMask !== undefined && builtMask.length !== ghostMask.length) {
    throw new GhostPlacementError(
      `The already-built mask holds ${builtMask.length} pixels against the ghost's ${ghostMask.length}. ` +
        `Both come off the same panel raster; a mismatch means one of them was extracted at another size.`,
    );
  }
  let ghostPx = 0;
  let insideRegionPx = 0;
  let regionPx = 0;
  let overlapsBuiltPx = 0;
  for (let pixel = 0; pixel < ghostMask.length; pixel += 1) {
    const inGhost = ghostMask[pixel] === 1;
    const inRegion = regionMask[pixel] === 1;
    if (inRegion) regionPx += 1;
    if (!inGhost) continue;
    ghostPx += 1;
    if (inRegion) insideRegionPx += 1;
    if (builtMask?.[pixel] === 1) overlapsBuiltPx += 1;
  }
  const union = ghostPx + regionPx - insideRegionPx;
  return {
    ghostPx,
    insideRegionPx,
    outsideRegionPx: ghostPx - insideRegionPx,
    overlapsBuiltPx,
    regionIou: union === 0 ? 0 : insideRegionPx / union,
    containmentCeiling: regionPx === 0 ? 0 : ghostPx / regionPx,
    contained: ghostPx > 0 && ghostPx === insideRegionPx,
  };
}

export interface GhostCandidateScore<T> {
  readonly subject: T;
  readonly containment: GhostContainment;
}

export interface ExplodedGhostDecision<T> {
  readonly schemaVersion: typeof GHOST_PLACEMENT_SCHEMA_VERSION;
  /** Every candidate, best region agreement first. */
  readonly ranked: readonly GhostCandidateScore<T>[];
  readonly best: GhostCandidateScore<T> | null;
  readonly runnerUp: GhostCandidateScore<T> | null;
  /** How many candidates' ghosts lie wholly inside the printed contour. */
  readonly containedCount: number;
  /**
   * The one candidate the drawing explains, or null.
   *
   * Null covers two different facts and the caller has to tell them apart:
   * `containedCount` of 0 is a panel nothing fits, and more than 1 is a panel
   * that fits several. Neither is a placement.
   */
  readonly winner: GhostCandidateScore<T> | null;
}

/** Which candidate, if any, the printed ghost contour explains on its own. */
export function decideExplodedGhostPlacement<T>(
  scores: readonly GhostCandidateScore<T>[],
): ExplodedGhostDecision<T> {
  const ranked = [...scores].sort(
    (left, right) => right.containment.regionIou - left.containment.regionIou,
  );
  const contained = ranked.filter((entry) => entry.containment.contained);
  return {
    schemaVersion: GHOST_PLACEMENT_SCHEMA_VERSION,
    ranked,
    best: ranked[0] ?? null,
    runnerUp: ranked[1] ?? null,
    containedCount: contained.length,
    winner: contained.length === 1 ? contained[0]! : null,
  };
}
