/**
 * What the real-panel probe measures, as types.
 *
 * They live apart from the probe because the probe is one function that
 * `page.evaluate` serialises, and a serialised function may not close over an
 * import. Types are erased before that happens, so these are the one part of it
 * that can be a normal module — which keeps the driver itself under the size a
 * file in this repo is allowed to be.
 */
export interface PanelSpec {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
  readonly calloutBoxes: readonly {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  }[];
}

export interface RealPanelRunOptions {
  readonly pdfjsUrl: string;
  readonly workerUrl: string;
  readonly pdfUrl: string;
  readonly latticeUrl: string;
  readonly renderingUrl: string;
  readonly assemblyUrl: string;
  readonly renderScale: number;
  readonly panelWidth: number;
  readonly specs: readonly PanelSpec[];
}

export interface PanelSummary {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly pxPerPoint: number;
  readonly artPx: number;
  readonly assemblyPx: number;
  readonly assemblyComponents: number;
  readonly assemblyDroppedFraction: number;
  readonly highlightRegions: number;
  readonly highlightEnclosedPx: number;
  readonly fit: {
    readonly azimuthDegrees: number;
    readonly elevationDegrees: number;
    readonly pixelsPerUnit: number;
    readonly pointsPerStud: number;
    readonly residualPx: number;
  } | null;
  readonly fitFailure: string | null;
}

export interface PairReport {
  readonly fromStep: number;
  readonly toStep: number;
  readonly failure: string | null;
  /** Both cameras fitted, so the camera delta below is a measurement. */
  readonly bothFitted: boolean;
  readonly azimuthDeltaDegrees: number | null;
  readonly elevationDeltaDegrees: number | null;
  readonly pointsPerStudDeltaFraction: number | null;
  /** What the lattice says the next panel must be scaled by to land on this one. */
  readonly latticeScaleRatio: number | null;
  readonly alignment: {
    readonly scale: number;
    readonly offsetXPx: number;
    readonly offsetYPx: number;
    readonly iou: number;
    readonly iouAtCentroids: number;
    readonly iouUnregistered: number;
    readonly scaleCorrectionFraction: number;
    readonly centroidCorrectionPx: number;
    readonly rawCentroidGapPx: number;
  } | null;
  /**
   * The shift in the booklet's own unit. Two panels of the same drawing at the
   * same zoom would need none; this is how far the printed model actually moved
   * between the two pages, which is the registration a synthetic booklet gets
   * for free.
   */
  readonly shiftPt: number | null;
  readonly scaleRatioEmpirical: number | null;
  /** "measured" when both cameras fitted and the scale was held, "searched" otherwise. */
  readonly scaleSource: "measured" | "searched";
  /** A searched scale that stopped at the wall of its range is not a measurement. */
  readonly scaleAtSearchBoundary: boolean;
  /**
   * Share of this panel's model that the next panel's warped frame does not
   * cover at all. Those pixels are excluded from the evidence, because a crop
   * that ends is not a part that vanished.
   */
  readonly uncoveredFractionOfCurrent: number | null;
  /** Share of this panel's model the next panel's covers once aligned. The
   * model only grows, so a correct registration covers nearly all of it. */
  readonly coverageOfCurrent: number | null;
  readonly noise: {
    readonly sharedPx: number;
    readonly medianDistance: number;
    readonly p90Distance: number;
    readonly p99Distance: number;
  } | null;
  readonly differenceThresholdPx: number | null;
  /**
   * How far the two drawings' own outlines sit apart once aligned.
   *
   * `medianPx` is null when the median outline pixel found no counterpart
   * inside the search radius — which is a failure to register, not a distance,
   * and must not be read as one.
   */
  readonly boundary: {
    readonly samples: number;
    readonly medianPx: number | null;
    readonly p90Px: number | null;
    readonly matchedFraction: number;
    readonly searchRadiusPx: number;
    /** The same median in stud pitches, which is the unit a placement is wrong in. */
    readonly medianStuds: number | null;
  } | null;
  readonly delta: {
    readonly emergedPx: number;
    readonly changedPx: number;
    /** Emerged over the assembly's own area: how much of the picture "appeared". */
    readonly emergedFractionOfAssembly: number;
    readonly changedFractionOfAssembly: number;
    /** The step's own highlight area, which is roughly what one step adds. */
    readonly highlightEnclosedPx: number;
    readonly emergedOverHighlight: number | null;
  } | null;
  readonly placement: PlacementReport | null;
  readonly overlayPng: string | null;
  readonly placementPng: string | null;
}

export interface PlacementReport {
  /** Why this step could not be scored, when it could not. */
  readonly skipped: string | null;
  readonly arrows: number;
  readonly arrowsRejected: readonly string[];
  readonly arrowDisplacementXPx: number | null;
  readonly arrowDisplacementYPx: number | null;
  readonly arrowSpreadPx: number | null;
  /** Arrows the displacement is averaged over. One is uncorroborated. */
  readonly agreedArrows: number;
  /** How far the arrows' answer was from the nearest candidate before snapping. */
  readonly referenceSnapPx: number | null;
  readonly silhouettePx: number;
  /**
   * How many separate contours the silhouette is.
   *
   * One is a single body, which is what translating it rigidly assumes. More
   * than one is not automatically wrong — step 10 rings two plates that are
   * exploded together and one translation moves both — but it is wrong whenever
   * the step draws some of its parts in place and explodes the others, which
   * this booklet does. Reported rather than refused, because the two cases
   * cannot be told apart from the contour count alone and refusing on it drops
   * the clearest examples along with the bad ones.
   */
  readonly silhouetteRegions: number;
  readonly offeredTranslations: number;
  readonly scoredTranslations: number;
  readonly rejectedOffFrame: number;
  readonly rejectedUnsupported: number;
  readonly ranking: {
    readonly candidates: number;
    readonly bestScore: number;
    readonly referenceScore: number;
    readonly referenceRank: number;
    readonly tiedWithReference: number;
    readonly margin: number;
    readonly bestToReferencePx: number;
    readonly bestToReferenceStuds: number;
    readonly bestDxPx: number;
    readonly bestDyPx: number;
    readonly referenceDxPx: number;
    readonly referenceDyPx: number;
  } | null;
  /** What the arrow-implied placement actually scored, half by half. A zero
   * emergence there means the part landed entirely on top of what was already
   * drawn, so the registration-tolerant half of the score had nothing to say
   * and the difference half was carrying the step alone. */
  readonly referenceEmergenceIou: number | null;
  readonly referenceChangeIou: number | null;
  /** The same ranking for each half of the score on its own. */
  readonly emergenceRank: number | null;
  readonly changeRank: number | null;
  /**
   * The control. Offset zero is "the part is already drawn where it lands",
   * which is what a step that is not exploded looks like. If it wins, either
   * the step was never exploded and the arrows belong to something else, or the
   * score is reading the ghost rather than the landing site.
   */
  readonly zeroOffsetRank: number | null;
  /** How far the arrows say the part travels, in stud pitches. */
  readonly arrowTravelStuds: number | null;
  readonly top: readonly {
    readonly dxPx: number;
    readonly dyPx: number;
    readonly score: number;
    readonly emergenceIou: number | null;
    readonly changeIou: number;
  }[];
}

export interface RealPanelRunResult {
  readonly schemaVersion: string;
  readonly panels: readonly PanelSummary[];
  readonly pairs: readonly PairReport[];
  readonly elapsedMs: number;
}
