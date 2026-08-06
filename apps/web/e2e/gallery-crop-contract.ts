/**
 * What an inventory crop has to be able to say about itself.
 *
 * A crop is evidence, and evidence that cannot report its own defects is worse
 * than no evidence: it arrives looking exactly like a good one. The inventory
 * gallery published only an element id and a quantity, so two bad crops sat in
 * it undetected — `302028` held its neighbour's plate as well as its own, and
 * `383228` had its right end cut off — and both ranked far down the retrieval
 * they feed.
 *
 * This is written so the callout gallery can move onto it, and it has not moved
 * yet: `callout-browser-crops.ts` still builds its own untyped contamination
 * list. Two things have to reconcile before the move is real, because the same
 * field name means different things on the two sides today — the ink threshold
 * is 28 here against 30 there, and `boundaryClearancePx` is the measured extent
 * of the art there against the crop padding here. Until then this is the
 * inventory gallery's contract and describing it as shared would be a claim
 * about files that do not import it.
 *
 * Every code below can fire on the inventory pipeline, and that is a stronger
 * statement than it looks: the first version of this file carried three that
 * could not, because the crop rectangle is the component's own bounds plus a
 * constant pad, so "the art reaches the rectangle's edge" and "the art reaches
 * the page's edge" were arithmetically one condition, and the flood budget the
 * third code named does not exist in a whole-page labelling. A check no input
 * can trip reports green forever. `adjudicateGalleryCrop` therefore reads only
 * measurements the pipeline can vary, and `summariseCodeReachability` publishes
 * how close each one came, so a check that has gone inert is visible in the
 * evidence rather than indistinguishable from a clean run.
 */
export const GALLERY_CROP_CONTRACT_VERSION = "lego.gallery-crop-contract/2" as const;

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
  /** Ink of the largest other component inside the crop rectangle that no cell was awarded. */
  readonly largestUnclaimedRivalPixels: number;
  /**
   * The same blob as printed area, in square points, which is the only form of
   * it that means anything across render scales. A share alone cannot judge
   * this: a twentieth of the gallery's smallest part is 120 pixels of
   * antialiasing, and a twentieth of its largest is bigger than most whole
   * parts in it.
   */
  readonly largestUnclaimedRivalAreaPt2: number;
  /**
   * Unclaimed rival components that are themselves big enough to have been a
   * part picture. A crumb of antialiasing is not evidence of anything; a blob
   * over the gallery's own part-picture threshold, sitting inside this
   * rectangle and belonging to no cell, is either this part's detached half or
   * page furniture that the assignment did not recognise.
   */
  readonly unclaimedRivalComponentsAboveThreshold: number;
  /** Ink inside this cell's own Nx box; zero means the pairing was not reproduced. */
  readonly quantityGlyphInkPixels: number;
  /** Selection cost of the component taken; lower is nearer this cell's label. */
  readonly selectedScore: number;
  /**
   * Cost of the best component this label did not get **and that no other label
   * took either**. Being outbid by a nearer cell is the gallery constraint
   * working, not ambiguity, so it is published separately and does not count
   * against the crop; ambiguity is two free candidates the score cannot
   * separate. Null when nothing else was free.
   */
  readonly freeRunnerUpScore: number | null;
  /** The component reaches the raster edge, so the part may continue off-page. */
  readonly touchesPageBoundary: boolean;
}

export interface GalleryCropPolicy {
  readonly minimumForegroundPixels: number;
  /** Largest unclaimed rival blob allowed, as a share of the component itself. */
  readonly maximumUnclaimedRivalShare: number;
  /**
   * Printed area a rival must cover before its share is worth judging at all.
   * Below this there is nothing a reader could recognise as part of a brick, so
   * a share over it is arithmetic about specks.
   */
  readonly minimumRivalAreaPt2: number;
  /** How much worse a free runner-up must be before the selection is settled. */
  readonly minimumSelectionMargin: number;
}

/**
 * Deliberately not derived from any measurement these thresholds judge. A limit
 * read out of the thing it limits cannot see that the thing is wrong.
 *
 * `minimumForegroundPixels` is not the gallery's part-picture threshold and
 * must not be set from it: the gallery decides what may enter the candidate
 * pool, and this decides what may be published, so tying them would make this
 * check unable to see that the pool's threshold is wrong.
 */
export const GALLERY_CROP_POLICY: GalleryCropPolicy = Object.freeze({
  minimumForegroundPixels: 400,
  maximumUnclaimedRivalShare: 0.05,
  // Four square points. A brick drawing's smallest recognisable feature is a
  // stud, and a stud prints larger than this in every cell of this inventory,
  // so anything under it is a fragment of an edge rather than a piece of a part.
  minimumRivalAreaPt2: 4,
  minimumSelectionMargin: 8,
});

export type GalleryContaminationCode =
  | "empty-foreground"
  | "touches-page-boundary"
  | "quantity-label-pairing-not-reproduced"
  | "unclaimed-rival-ink"
  | "ambiguous-component-selection";

/** Which measurement each code reads, and which way the comparison runs. */
export const GALLERY_CODE_MEASUREMENTS: Readonly<
  Record<GalleryContaminationCode, { readonly field: string; readonly fires: "below" | "above" }>
> = Object.freeze({
  "empty-foreground": { field: "foregroundPixels", fires: "below" },
  "touches-page-boundary": { field: "touchesPageBoundary", fires: "above" },
  "quantity-label-pairing-not-reproduced": { field: "quantityGlyphInkPixels", fires: "below" },
  "unclaimed-rival-ink": { field: "largestUnclaimedRivalPixels", fires: "above" },
  "ambiguous-component-selection": { field: "freeRunnerUpScore", fires: "below" },
});

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
  // Every cell prints an Nx above its element id, and the inventory reader
  // already paired the two out of the ingest text layer. Finding no ink where
  // pdf.js says that Nx is drawn means the two readings disagree about where
  // this cell is, which is the state a crop must not be published from.
  if (measurement.quantityGlyphInkPixels <= 0) {
    contamination.push("quantity-label-pairing-not-reproduced");
  }
  if (
    measurement.foregroundPixels > 0 &&
    (measurement.unclaimedRivalComponentsAboveThreshold > 0 ||
      (measurement.largestUnclaimedRivalAreaPt2 >= policy.minimumRivalAreaPt2 &&
        measurement.largestUnclaimedRivalPixels >
          measurement.foregroundPixels * policy.maximumUnclaimedRivalShare))
  ) {
    contamination.push("unclaimed-rival-ink");
  }
  if (
    measurement.freeRunnerUpScore !== null &&
    measurement.freeRunnerUpScore - measurement.selectedScore < policy.minimumSelectionMargin
  ) {
    contamination.push("ambiguous-component-selection");
  }
  return contamination;
}

export interface CodeReachability {
  readonly code: GalleryContaminationCode;
  readonly field: string;
  /** The observed value nearest to firing, across every crop measured. */
  readonly closestObserved: number | null;
  readonly threshold: number | null;
  readonly fired: number;
}

/**
 * How close every check came to firing, across a whole gallery.
 *
 * Published because "no crop was contaminated" and "no crop could have been"
 * read identically in a manifest, and the second is the failure this file
 * exists to prevent. A code whose closest observation sits orders of magnitude
 * from its threshold is a check to re-derive, not a clean bill of health.
 */
export function summariseCodeReachability(
  measurements: readonly GalleryCropMeasurement[],
  policy: GalleryCropPolicy = GALLERY_CROP_POLICY,
): readonly CodeReachability[] {
  const fired = new Map<GalleryContaminationCode, number>();
  for (const measurement of measurements) {
    for (const code of adjudicateGalleryCrop(measurement, policy)) {
      fired.set(code, (fired.get(code) ?? 0) + 1);
    }
  }
  const nearest = (values: readonly number[], direction: "below" | "above"): number | null => {
    if (values.length === 0) return null;
    return direction === "below" ? Math.min(...values) : Math.max(...values);
  };
  // Only rivals that clear the printed-area floor, because a share reported
  // from a blob the floor already rejected is a closest-approach the check
  // could not actually have made — the whole point of this summary is that the
  // number means what it says.
  const shares = measurements
    .filter(
      ({ foregroundPixels, largestUnclaimedRivalAreaPt2 }) =>
        foregroundPixels > 0 && largestUnclaimedRivalAreaPt2 >= policy.minimumRivalAreaPt2,
    )
    .map(
      ({ largestUnclaimedRivalPixels, foregroundPixels }) =>
        Math.round((largestUnclaimedRivalPixels / foregroundPixels) * 10_000) / 10_000,
    );
  const margins = measurements
    .filter(({ freeRunnerUpScore }) => freeRunnerUpScore !== null)
    .map(
      ({ freeRunnerUpScore, selectedScore }) =>
        Math.round((freeRunnerUpScore! - selectedScore) * 100) / 100,
    );
  const observed: Record<GalleryContaminationCode, { value: number | null; threshold: number }> = {
    "empty-foreground": {
      value: nearest(
        measurements.map(({ foregroundPixels }) => foregroundPixels),
        "below",
      ),
      threshold: policy.minimumForegroundPixels,
    },
    "touches-page-boundary": {
      value: nearest(
        measurements.map(({ touchesPageBoundary }) => (touchesPageBoundary ? 1 : 0)),
        "above",
      ),
      threshold: 1,
    },
    "quantity-label-pairing-not-reproduced": {
      value: nearest(
        measurements.map(({ quantityGlyphInkPixels }) => quantityGlyphInkPixels),
        "below",
      ),
      threshold: 1,
    },
    "unclaimed-rival-ink": {
      value: nearest(shares, "above"),
      threshold: policy.maximumUnclaimedRivalShare,
    },
    "ambiguous-component-selection": {
      value: nearest(margins, "below"),
      threshold: policy.minimumSelectionMargin,
    },
  };
  return (Object.keys(GALLERY_CODE_MEASUREMENTS) as GalleryContaminationCode[]).map((code) => ({
    code,
    field: GALLERY_CODE_MEASUREMENTS[code].field,
    closestObserved: observed[code].value,
    threshold: observed[code].threshold,
    fired: fired.get(code) ?? 0,
  }));
}

/**
 * Cost of giving one label one component: how far the art sits from the label
 * that names it.
 *
 * Vertical distance counts for more than horizontal because the booklet stacks
 * a cell as picture, then quantity, then element id — so the picture a label
 * names is the one directly above it, and a neighbouring column's art can be
 * horizontally nearer without being the right answer.
 *
 * `labelXPx` is the centre of the element id as printed, not its left edge.
 * Measuring a left edge against a component's centre biases every score by half
 * the width of the id string in one direction, which on a denser inventory
 * could walk a whole column one cell sideways with every margin still positive.
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

export interface GalleryLabelAssignment {
  readonly componentIndex: number;
  readonly score: number;
  /**
   * Best score this label could have had from a component no cell took. Null
   * when every other candidate went to someone.
   */
  readonly freeRunnerUpScore: number | null;
  /**
   * Set when this label's own best candidate went to a nearer cell, carrying
   * the score it would have had. That is the constraint working, so it is
   * reported rather than counted against the crop — but it is reported, because
   * a gallery where it never happens is a gallery whose constraint did nothing.
   */
  readonly outbidScore: number | null;
}

export interface GalleryAssignment {
  readonly byLabel: ReadonlyMap<number, GalleryLabelAssignment>;
  /** Components no label was awarded, which is where page furniture shows up. */
  readonly unclaimedComponents: readonly number[];
}

/**
 * Assigns components to labels once, over the whole page.
 *
 * A component belongs to exactly one cell, so taking it has to cost every other
 * cell. On the sample booklet this constraint never binds — every label's own
 * best candidate is free when it is served, so the result equals per-label
 * argmax — and that is worth stating plainly rather than letting the commit
 * imply the constraint is what fixed anything. What fixed `302028` and `383228`
 * was labelling the page into components at all. The constraint is here so that
 * a denser inventory cannot quietly hand one plate to two cells, and
 * `outbidScore` is published so the first time it does bind is visible.
 *
 * Greedy over globally sorted pairs, with ties broken on indices so the result
 * does not depend on input order.
 */
export function assignGalleryComponents(
  pairs: readonly GalleryAssignmentPair[],
  allComponentIndices: readonly number[] = [],
): GalleryAssignment {
  const ordered = [...pairs].sort(
    (left, right) =>
      left.score - right.score ||
      left.labelIndex - right.labelIndex ||
      left.componentIndex - right.componentIndex,
  );
  const chosen = new Map<number, { componentIndex: number; score: number }>();
  const takenComponents = new Set<number>();
  for (const pair of ordered) {
    if (chosen.has(pair.labelIndex) || takenComponents.has(pair.componentIndex)) continue;
    chosen.set(pair.labelIndex, { componentIndex: pair.componentIndex, score: pair.score });
    takenComponents.add(pair.componentIndex);
  }

  const byLabel = new Map<number, GalleryLabelAssignment>();
  for (const [labelIndex, selection] of chosen) {
    let freeRunnerUpScore: number | null = null;
    let outbidScore: number | null = null;
    for (const pair of ordered) {
      if (pair.labelIndex !== labelIndex || pair.componentIndex === selection.componentIndex) {
        continue;
      }
      if (pair.score < selection.score && outbidScore === null) outbidScore = pair.score;
      if (!takenComponents.has(pair.componentIndex) && freeRunnerUpScore === null) {
        freeRunnerUpScore = pair.score;
      }
    }
    byLabel.set(labelIndex, { ...selection, freeRunnerUpScore, outbidScore });
  }
  return {
    byLabel,
    unclaimedComponents: allComponentIndices.filter((index) => !takenComponents.has(index)),
  };
}
