/**
 * What a gallery crop has to be able to say about itself.
 *
 * A crop is evidence, and evidence that cannot report its own defects is worse
 * than no evidence: it arrives looking exactly like a good one. The callout
 * gallery already learned this — every callout record carries the masks it
 * applied, what contaminated it, how much quantity-glyph ink it removed, and
 * how far the art sits from the crop's edge. The inventory gallery published
 * only an element id and a quantity, so two bad crops sat in it undetected:
 * `302028` held its neighbour's plate as well as its own, and `383228` had its
 * right end cut off. Neither picture said anything was wrong.
 *
 * This is the shared half. The pixel work is duplicated in the two galleries
 * because Playwright serialises those functions into the page and they cannot
 * import anything, but the decision about what counts as contaminated lives
 * here once, is unit-tested, and is the same for both.
 *
 * Every code below can actually fire. A check that no input can trip reports
 * green forever, which is how ten checks in this repository quietly stopped
 * checking; `gallery-crop-contract.test.ts` fires each one deliberately.
 */
export const GALLERY_CROP_CONTRACT_VERSION = "lego.gallery-crop-contract/1" as const;

export type GalleryMaskKind = "all-pdf-text" | "quantity-label";

export interface PixelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Distance from the art to each edge of the rectangle it was published in. */
export type PixelClearance = PixelBounds;

export interface GalleryCropMeasurement {
  /** Pixels of the selected connected component kept in the published image. */
  readonly foregroundPixels: number;
  /** Size of that component across the whole page, before the crop rectangle. */
  readonly componentPixels: number;
  /**
   * Ink inside the crop rectangle that belongs to another component and that
   * no other cell claimed.
   *
   * Ink claimed by a neighbouring cell is not a defect: the gallery decided it
   * belongs to that cell, the isolation painted it out, and the picture is
   * right. Unclaimed ink is the dangerous kind, because the most likely reason
   * a large blob sits inside this rectangle and belongs to nobody is that it is
   * the other half of this very part, drawn detached.
   */
  readonly unclaimedRivalPixels: number;
  readonly rivalComponentCount: number;
  /** Ink inside this cell's own Nx box; zero means the label was never located. */
  readonly quantityGlyphInkPixels: number;
  /** Ink suppressed because it lies inside any PDF text box. */
  readonly sourceTextGlyphPixels: number;
  /** Selection cost of the component taken; lower is nearer this cell's label. */
  readonly selectedScore: number;
  /** Cost of the best component this label did not get, or null when it was alone. */
  readonly runnerUpScore: number | null;
  /** The component reaches the raster edge, so the part may continue off-page. */
  readonly touchesPageBoundary: boolean;
  readonly boundaryClearancePx: PixelClearance;
  readonly floodBudgetExhausted: boolean;
}

export interface GalleryCropPolicy {
  readonly minimumForegroundPixels: number;
  readonly minimumBoundaryClearancePx: number;
  /** Rival ink allowed in the crop rectangle, as a share of the component itself. */
  readonly maximumRivalPixelShare: number;
  /** How much worse the runner-up must be before the selection is called settled. */
  readonly minimumSelectionMargin: number;
}

/**
 * Deliberately not derived from any measurement these thresholds judge. A limit
 * read out of the thing it limits cannot see that the thing is wrong.
 */
export const GALLERY_CROP_POLICY: GalleryCropPolicy = Object.freeze({
  minimumForegroundPixels: 64,
  minimumBoundaryClearancePx: 1,
  maximumRivalPixelShare: 0.2,
  minimumSelectionMargin: 1,
});

export type GalleryContaminationCode =
  | "empty-foreground"
  | "touches-page-boundary"
  | "insufficient-boundary-clearance"
  | "quantity-label-not-located"
  | "unclaimed-rival-ink"
  | "ambiguous-component-selection"
  | "flood-budget-exhausted";

/**
 * Names every defect a crop carries, in a stable order.
 *
 * It returns all of them rather than the first, because a crop that both took
 * the wrong component and ran off the page has two things wrong with it and
 * fixing one leaves it broken.
 */
export function adjudicateGalleryCrop(
  measurement: GalleryCropMeasurement,
  policy: GalleryCropPolicy = GALLERY_CROP_POLICY,
): readonly GalleryContaminationCode[] {
  const contamination: GalleryContaminationCode[] = [];
  if (measurement.foregroundPixels < policy.minimumForegroundPixels) {
    contamination.push("empty-foreground");
  }
  if (measurement.touchesPageBoundary) contamination.push("touches-page-boundary");
  const clearance = Math.min(
    measurement.boundaryClearancePx.left,
    measurement.boundaryClearancePx.top,
    measurement.boundaryClearancePx.right,
    measurement.boundaryClearancePx.bottom,
  );
  if (clearance < policy.minimumBoundaryClearancePx) {
    contamination.push("insufficient-boundary-clearance");
  }
  // Every cell prints an Nx above its element id, so finding no ink in that box
  // means the label was never located — and an unlocated label is exactly how
  // "2x" ended up inside a part picture.
  if (measurement.quantityGlyphInkPixels <= 0) contamination.push("quantity-label-not-located");
  if (
    measurement.componentPixels > 0 &&
    measurement.unclaimedRivalPixels > measurement.componentPixels * policy.maximumRivalPixelShare
  ) {
    contamination.push("unclaimed-rival-ink");
  }
  if (
    measurement.runnerUpScore !== null &&
    measurement.runnerUpScore - measurement.selectedScore < policy.minimumSelectionMargin
  ) {
    contamination.push("ambiguous-component-selection");
  }
  if (measurement.floodBudgetExhausted) contamination.push("flood-budget-exhausted");
  return contamination;
}

/**
 * Cost of giving one label one component: how far the art sits from the label
 * that names it.
 *
 * Vertical distance counts for more than horizontal because the booklet stacks
 * a cell as picture, then quantity, then element id — so the picture a label
 * names is the one directly above it, and a neighbouring column's art can be
 * horizontally nearer without being the right answer.
 */
export function galleryComponentScore(input: {
  readonly labelXPx: number;
  readonly labelTopPx: number;
  readonly componentLeftPx: number;
  readonly componentRightPx: number;
  readonly componentBottomPx: number;
}): number {
  const horizontalGap =
    input.labelXPx < input.componentLeftPx
      ? input.componentLeftPx - input.labelXPx
      : input.labelXPx > input.componentRightPx
        ? input.labelXPx - input.componentRightPx
        : 0;
  const verticalGap = Math.max(0, input.labelTopPx - input.componentBottomPx);
  const centreBias =
    Math.abs((input.componentLeftPx + input.componentRightPx) / 2 - input.labelXPx) * 0.1;
  return verticalGap * 1.5 + horizontalGap + centreBias;
}

export interface GalleryAssignmentPair {
  readonly labelIndex: number;
  readonly componentIndex: number;
  readonly score: number;
}

export interface GalleryAssignment {
  readonly byLabel: ReadonlyMap<
    number,
    { readonly componentIndex: number; readonly score: number }
  >;
  /**
   * Best score each label could have had from any component other than the one
   * it took. Negative margin against the selection means this cell wanted a
   * component that went to a nearer cell, which is the gallery constraint
   * biting and worth seeing rather than smoothing away.
   */
  readonly runnerUpByLabel: ReadonlyMap<number, number>;
}

/**
 * Assigns components to labels once, over the whole page.
 *
 * Matching a gallery one entry at a time discards the thing that makes it a
 * gallery: a component belongs to exactly one cell, so taking it has to cost
 * every other cell. Choosing per label is what let `302028` and `383228` both
 * lay claim to one long green plate — the first because the plate overflowed
 * into its rectangle, the second because the plate was its own.
 *
 * Greedy over globally sorted pairs, with ties broken on indices so the result
 * does not depend on input order.
 */
export function assignGalleryComponents(
  pairs: readonly GalleryAssignmentPair[],
): GalleryAssignment {
  const ordered = [...pairs].sort(
    (left, right) =>
      left.score - right.score ||
      left.labelIndex - right.labelIndex ||
      left.componentIndex - right.componentIndex,
  );
  const byLabel = new Map<number, { componentIndex: number; score: number }>();
  const takenComponents = new Set<number>();
  for (const pair of ordered) {
    if (byLabel.has(pair.labelIndex) || takenComponents.has(pair.componentIndex)) continue;
    byLabel.set(pair.labelIndex, { componentIndex: pair.componentIndex, score: pair.score });
    takenComponents.add(pair.componentIndex);
  }
  const runnerUpByLabel = new Map<number, number>();
  for (const pair of ordered) {
    const selected = byLabel.get(pair.labelIndex);
    if (selected === undefined || pair.componentIndex === selected.componentIndex) continue;
    if (!runnerUpByLabel.has(pair.labelIndex)) runnerUpByLabel.set(pair.labelIndex, pair.score);
  }
  return { byLabel, runnerUpByLabel };
}
