import type {
  RealBuildPrefix50EligibleMaskSearchOptions,
  RealBuildPrefix50EligibleMaskSearchDiagnostics,
  RealBuildPrefix50EligibleMaskSimilarityTransform,
  RealBuildPrefix50CoarseScaleTranslationDomain,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";
import { REAL_BUILD_PREFIX50_ELIGIBLE_MASK_SEARCH_THRESHOLDS } from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";
import {
  boundedSearchGrid,
  compareMaskAgreement as compareAgreement,
  quantizedSearchValue as quantized,
  requirePositiveFinite,
  type RealBuildPrefix50MaskAgreement as Agreement,
  type RealBuildPrefix50SimilaritySearchCoordinate as SearchCoordinate,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-primitives.ts";
import { maximumRealBuildPrefix50ExactRowSpanCandidatePixelVisitsForRaster } from "./real-build-prefix50-subbuild-return-review-camera-registration-runs.ts";

export interface RealBuildPrefix50CameraSearchCandidate {
  readonly coordinate: SearchCoordinate;
  readonly transform: RealBuildPrefix50EligibleMaskSimilarityTransform;
  readonly agreement: Agreement;
  readonly eligibleWarpRuns?: Int32Array;
}

export interface RealBuildPrefix50CameraSearchWorkLedger {
  inputValidationPixelVisits: number;
  momentPixelVisits: number;
  sourceForegroundPixelVisits: number;
  pyramidConstructionPixelVisits: number;
  rowSpanIndexConstructionPixelVisits: number;
  sampledObjectivePixelVisits: number;
  exactObjectivePixelVisits: number;
  tieRasterizationPixelVisits: number;
  tieComparisonPixelVisits: number;
}

export type RealBuildPrefix50CameraSearchWorkCategory =
  | "preprocessing"
  | "sampled-objective"
  | "exact-objective"
  | "tie-rasterization"
  | "tie-comparison";

export function createCameraSearchWorkLedger(): RealBuildPrefix50CameraSearchWorkLedger {
  return {
    inputValidationPixelVisits: 0,
    momentPixelVisits: 0,
    sourceForegroundPixelVisits: 0,
    pyramidConstructionPixelVisits: 0,
    rowSpanIndexConstructionPixelVisits: 0,
    sampledObjectivePixelVisits: 0,
    exactObjectivePixelVisits: 0,
    tieRasterizationPixelVisits: 0,
    tieComparisonPixelVisits: 0,
  };
}

export function cameraSearchPreprocessingPixelVisits(
  work: RealBuildPrefix50CameraSearchWorkLedger,
): number {
  return (
    work.inputValidationPixelVisits +
    work.momentPixelVisits +
    work.sourceForegroundPixelVisits +
    work.pyramidConstructionPixelVisits +
    work.rowSpanIndexConstructionPixelVisits
  );
}

export function cameraSearchFullResolutionPixelVisits(
  work: RealBuildPrefix50CameraSearchWorkLedger,
): number {
  return (
    work.exactObjectivePixelVisits +
    work.tieRasterizationPixelVisits +
    work.tieComparisonPixelVisits
  );
}

export function cameraSearchTotalPixelVisits(
  work: RealBuildPrefix50CameraSearchWorkLedger,
): number {
  return (
    cameraSearchPreprocessingPixelVisits(work) +
    work.sampledObjectivePixelVisits +
    cameraSearchFullResolutionPixelVisits(work)
  );
}

export function canChargeCameraSearchWork(
  work: RealBuildPrefix50CameraSearchWorkLedger,
  options: Required<RealBuildPrefix50EligibleMaskSearchOptions>,
  category: RealBuildPrefix50CameraSearchWorkCategory,
  maximumAdditionalPixelVisits: number,
): boolean {
  if (!Number.isSafeInteger(maximumAdditionalPixelVisits) || maximumAdditionalPixelVisits < 0)
    return false;
  const within = (current: number, limit: number) =>
    current <= limit - maximumAdditionalPixelVisits;
  if (!within(cameraSearchTotalPixelVisits(work), options.maximumTotalPixelVisits)) return false;
  if (
    category === "preprocessing" &&
    !within(cameraSearchPreprocessingPixelVisits(work), options.maximumPreprocessingPixelVisits)
  )
    return false;
  if (
    category === "sampled-objective" &&
    !within(work.sampledObjectivePixelVisits, options.maximumSampledPixelVisits)
  )
    return false;
  if (
    category !== "preprocessing" &&
    category !== "sampled-objective" &&
    !within(cameraSearchFullResolutionPixelVisits(work), options.maximumFullResolutionPixelVisits)
  )
    return false;
  return true;
}

export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_CALLER_SEED = Object.freeze({
  scale: 1,
  offsetXPx: 0,
  offsetYPx: 0,
});

export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_BEAM_WIDTH = 4;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_EXACT_STARTS = 2;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_GRID_AXIS_VALUES = 4_097;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_FULL_RESOLUTION_CANDIDATES = 16_384;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_RASTER_WIDTH = 720;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_RASTER_HEIGHT = 470;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_COARSE_STRIDE_PX = 16;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_RELATIVE_SCALE_RADIUS = 0.5;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_RELATIVE_SCALE_STEP = 0.04;

/** A foreground-overlap interval is no wider than (rasterSpan - 1) + scale * rasterSpan; a step-aligned lattice contributes at most floor(width / step) + 1 values and its two exact endpoints contribute at most two more. */
export function maximumRealBuildPrefix50CompleteCoarseCandidatesForRaster(input: {
  readonly width: number;
  readonly height: number;
  readonly translationStepPx: number;
  readonly relativeScaleRadius: number;
  readonly relativeScaleStep: number;
}): number {
  const scaleGrid = boundedSearchGrid(
    input.relativeScaleRadius,
    input.relativeScaleStep,
    REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_GRID_AXIS_VALUES,
    "raster-derived relative-scale ceiling",
  );
  let total = 0;
  for (const relativeScaleDelta of scaleGrid) {
    const scale = 1 + relativeScaleDelta;
    const xValues =
      Math.floor((input.width - 1 + scale * input.width) / input.translationStepPx) + 3;
    const yValues =
      Math.floor((input.height - 1 + scale * input.height) / input.translationStepPx) + 3;
    const candidates = xValues * yValues;
    if (!Number.isSafeInteger(candidates) || total > Number.MAX_SAFE_INTEGER - candidates)
      throw new RangeError("Raster-derived complete coarse candidate ceiling is not safe.");
    total += candidates;
  }
  return total;
}

export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_COARSE_CANDIDATES =
  maximumRealBuildPrefix50CompleteCoarseCandidatesForRaster({
    width: REAL_BUILD_PREFIX50_CAMERA_SEARCH_RASTER_WIDTH,
    height: REAL_BUILD_PREFIX50_CAMERA_SEARCH_RASTER_HEIGHT,
    translationStepPx: REAL_BUILD_PREFIX50_CAMERA_SEARCH_COARSE_STRIDE_PX,
    relativeScaleRadius: REAL_BUILD_PREFIX50_CAMERA_SEARCH_RELATIVE_SCALE_RADIUS,
    relativeScaleStep: REAL_BUILD_PREFIX50_CAMERA_SEARCH_RELATIVE_SCALE_STEP,
  });
const MAXIMUM_SAMPLED_REFINEMENT_CANDIDATES =
  1 + 8 * (REAL_BUILD_PREFIX50_CAMERA_SEARCH_BEAM_WIDTH + 2) * 27;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_CANDIDATES =
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_COARSE_CANDIDATES +
  MAXIMUM_SAMPLED_REFINEMENT_CANDIDATES +
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_FULL_RESOLUTION_CANDIDATES;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_ROW_SPAN_CANDIDATE_PIXEL_VISITS =
  maximumRealBuildPrefix50ExactRowSpanCandidatePixelVisitsForRaster({
    width: REAL_BUILD_PREFIX50_CAMERA_SEARCH_RASTER_WIDTH,
    height: REAL_BUILD_PREFIX50_CAMERA_SEARCH_RASTER_HEIGHT,
    maximumScale: 1 + REAL_BUILD_PREFIX50_CAMERA_SEARCH_RELATIVE_SCALE_RADIUS,
  });
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_SAMPLED_PIXEL_VISITS =
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_ROW_SPAN_CANDIDATE_PIXEL_VISITS *
  (REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_COARSE_CANDIDATES +
    MAXIMUM_SAMPLED_REFINEMENT_CANDIDATES);
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_FULL_RESOLUTION_PIXEL_VISITS =
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_ROW_SPAN_CANDIDATE_PIXEL_VISITS *
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_FULL_RESOLUTION_CANDIDATES;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_PREPROCESSING_PIXEL_VISITS = 25_000_000;
export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_TOTAL_PIXEL_VISITS =
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_SAMPLED_PIXEL_VISITS +
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_FULL_RESOLUTION_PIXEL_VISITS +
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_PREPROCESSING_PIXEL_VISITS;

export const REAL_BUILD_PREFIX50_CAMERA_SEARCH_DEFAULTS = Object.freeze({
  relativeScaleRadius: REAL_BUILD_PREFIX50_CAMERA_SEARCH_RELATIVE_SCALE_RADIUS,
  initialCenterStepPx: 16,
  initialRelativeScaleStep: REAL_BUILD_PREFIX50_CAMERA_SEARCH_RELATIVE_SCALE_STEP,
  finalCenterCellPx: 0.1,
  finalRelativeScaleCell: 0.0005,
  coarseStridePx: REAL_BUILD_PREFIX50_CAMERA_SEARCH_COARSE_STRIDE_PX,
  maximumCandidates: REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_CANDIDATES,
  maximumSampledPixelVisits: REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_SAMPLED_PIXEL_VISITS,
  maximumFullResolutionCandidates:
    REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_FULL_RESOLUTION_CANDIDATES,
  maximumFullResolutionPixelVisits: 150_000_000,
  maximumPreprocessingPixelVisits:
    REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_PREPROCESSING_PIXEL_VISITS,
  maximumTotalPixelVisits:
    REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_SAMPLED_PIXEL_VISITS + 175_000_000,
});

export function resolveCameraSearchOptions(
  input?: RealBuildPrefix50EligibleMaskSearchOptions,
): Required<RealBuildPrefix50EligibleMaskSearchOptions> {
  const options = { ...REAL_BUILD_PREFIX50_CAMERA_SEARCH_DEFAULTS, ...input };
  const relativeScaleRadius = requirePositiveFinite(
    options.relativeScaleRadius,
    "relativeScaleRadius",
  );
  const initialCenterStepPx = requirePositiveFinite(
    options.initialCenterStepPx,
    "initialCenterStepPx",
  );
  const initialRelativeScaleStep = requirePositiveFinite(
    options.initialRelativeScaleStep,
    "initialRelativeScaleStep",
  );
  const finalCenterCellPx = requirePositiveFinite(options.finalCenterCellPx, "finalCenterCellPx");
  const finalRelativeScaleCell = requirePositiveFinite(
    options.finalRelativeScaleCell,
    "finalRelativeScaleCell",
  );
  const integerOptions = [
    [options.coarseStridePx, "coarseStridePx"],
    [options.maximumCandidates, "maximumCandidates"],
    [options.maximumSampledPixelVisits, "maximumSampledPixelVisits"],
    [options.maximumFullResolutionCandidates, "maximumFullResolutionCandidates"],
    [options.maximumFullResolutionPixelVisits, "maximumFullResolutionPixelVisits"],
    [options.maximumPreprocessingPixelVisits, "maximumPreprocessingPixelVisits"],
    [options.maximumTotalPixelVisits, "maximumTotalPixelVisits"],
  ] as const;
  for (const [value, name] of integerOptions)
    if (!Number.isSafeInteger(value) || value < 1)
      throw new RangeError(`${name} must be a positive safe integer.`);
  if (
    relativeScaleRadius >= 1 ||
    initialRelativeScaleStep > relativeScaleRadius ||
    finalCenterCellPx >
      REAL_BUILD_PREFIX50_ELIGIBLE_MASK_SEARCH_THRESHOLDS.maximumFinalCenterCellPx ||
    finalRelativeScaleCell >
      REAL_BUILD_PREFIX50_ELIGIBLE_MASK_SEARCH_THRESHOLDS.maximumFinalRelativeScaleCell ||
    initialCenterStepPx < finalCenterCellPx ||
    initialRelativeScaleStep < finalRelativeScaleCell ||
    options.maximumCandidates < 27 ||
    options.maximumFullResolutionCandidates < 27 ||
    options.maximumCandidates > REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_CANDIDATES ||
    options.maximumFullResolutionCandidates >
      REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_FULL_RESOLUTION_CANDIDATES ||
    options.maximumSampledPixelVisits >
      REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_SAMPLED_PIXEL_VISITS ||
    options.maximumFullResolutionPixelVisits >
      REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_FULL_RESOLUTION_PIXEL_VISITS ||
    options.maximumPreprocessingPixelVisits >
      REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_PREPROCESSING_PIXEL_VISITS ||
    options.maximumTotalPixelVisits > REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_TOTAL_PIXEL_VISITS
  )
    throw new RangeError(
      `Eligible-mask search bounds, steps, final cells, and budgets must be nested, no weaker than the 0.1px/0.0005 convergence contract, and within the implementation caps of ${REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_CANDIDATES} total and ${REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_FULL_RESOLUTION_CANDIDATES} full-resolution candidates.`,
    );
  return options;
}

export function cameraSearchRowOrder(
  left: RealBuildPrefix50CameraSearchCandidate,
  right: RealBuildPrefix50CameraSearchCandidate,
): number {
  const agreement = compareAgreement(left.agreement, right.agreement);
  if (agreement !== 0) return agreement > 0 ? -1 : 1;
  return (
    left.coordinate.relativeScaleDelta - right.coordinate.relativeScaleDelta ||
    left.coordinate.deltaY - right.coordinate.deltaY ||
    left.coordinate.deltaX - right.coordinate.deltaX
  );
}

export function normalizedCameraSearchCoordinate(coordinate: SearchCoordinate): SearchCoordinate {
  return {
    deltaX: quantized(coordinate.deltaX),
    deltaY: quantized(coordinate.deltaY),
    relativeScaleDelta: quantized(coordinate.relativeScaleDelta),
  };
}

export function snappedCameraSearchCoordinate(
  coordinate: SearchCoordinate,
  centerCellPx: number,
  relativeScaleCell: number,
): SearchCoordinate {
  return normalizedCameraSearchCoordinate({
    deltaX: Math.round(coordinate.deltaX / centerCellPx) * centerCellPx,
    deltaY: Math.round(coordinate.deltaY / centerCellPx) * centerCellPx,
    relativeScaleDelta:
      Math.round(coordinate.relativeScaleDelta / relativeScaleCell) * relativeScaleCell,
  });
}

export function diverseCameraSearchRows(
  candidates: readonly RealBuildPrefix50CameraSearchCandidate[],
  limit: number,
): RealBuildPrefix50CameraSearchCandidate[] {
  const selected: RealBuildPrefix50CameraSearchCandidate[] = [];
  for (const candidate of [...candidates].sort(cameraSearchRowOrder)) {
    if (
      selected.some(
        (known) =>
          Math.abs(candidate.coordinate.deltaX - known.coordinate.deltaX) < 1 &&
          Math.abs(candidate.coordinate.deltaY - known.coordinate.deltaY) < 1 &&
          Math.abs(candidate.coordinate.relativeScaleDelta - known.coordinate.relativeScaleDelta) <
            0.004,
      )
    )
      continue;
    selected.push(candidate);
    if (selected.length === limit) break;
  }
  return selected;
}

export function cameraSearchDiagnostics(input: {
  counts: readonly [number, number, number, number];
  analyticSeed: RealBuildPrefix50EligibleMaskSimilarityTransform | null;
  analyticProposalInsideBounds: boolean;
  callerSeedEvaluated: boolean;
  analyticProposalEvaluated: boolean;
  callerBasinInitialSampledIntersectionOverUnion: number;
  analyticBasinInitialSampledIntersectionOverUnion: number | null;
  callerBasinFinalExactTransform: RealBuildPrefix50EligibleMaskSimilarityTransform | null;
  analyticBasinFinalExactTransform: RealBuildPrefix50EligibleMaskSimilarityTransform | null;
  callerBasinFinalExactIntersectionOverUnion: number | null;
  analyticBasinFinalExactIntersectionOverUnion: number | null;
  basinsComparedAtFullResolution: boolean;
  equivalenceComponentComplete: boolean;
  equivalenceComponentMembersVisited: number;
  localFinalCellContainmentComplete: boolean;
  translationDomainRasterWidth: number;
  translationDomainRasterHeight: number;
  relativeScaleRadius: number;
  requestedCoarseStridePx: number;
  effectiveCoarseStridePx: number;
  coarseTranslationStepPx: number;
  coarseRelativeScaleStep: number;
  coarseCandidatesExpected: number;
  coarseCandidatesEvaluated: number;
  coarsePixelVisitUpperBound: number | null;
  coarsePreflightPassed: boolean;
  coarseDomainComplete: boolean;
  coarseScaleTranslationDomains: readonly RealBuildPrefix50CoarseScaleTranslationDomain[];
  coarseObjectiveTiesExpected: number;
  coarseObjectiveTiesClassified: number;
  coarseObjectiveTieClassificationComplete: boolean;
  coarseObjectiveTieTranslationBoundaryHit: boolean;
  coarseObjectiveTieScaleBoundaryHit: boolean;
  coarseEquivalentRasterSeeds: number;
  exactObjectiveTiesExpected: number;
  exactObjectiveTiesClassified: number;
  exactObjectiveTieClassificationComplete: boolean;
  exactEquivalentRasterSeeds: number;
  exactObjectiveRunComparisonsPerformed: number;
  maximumTieComparisonPixelVisitsPerClassification: number;
  refinementStarts: number;
  finalCenterCellPx: number;
  finalRelativeScaleCell: number;
  candidatesTried: number;
  sampledCandidatesTried: number;
  fullResolutionCandidatesTried: number;
  work: RealBuildPrefix50CameraSearchWorkLedger;
  maximumCandidates: number;
  maximumCoarseCandidates: number;
  maximumSampledPixelVisits: number;
  maximumFullResolutionCandidates: number;
  maximumFullResolutionPixelVisits: number;
  maximumPreprocessingPixelVisits: number;
  maximumTotalPixelVisits: number;
  equivalentRasterTieCount: number;
  localNeighborOptimal: boolean;
  centerBoundaryHit: boolean;
  scaleBoundaryHit: boolean;
  agreement?: Agreement;
}): RealBuildPrefix50EligibleMaskSearchDiagnostics {
  const agreement = input.agreement ?? {
    intersection: 0,
    union: 0,
    warpedEligible: 0,
    warpedInRaster: 0,
    warpedUnclipped: 0,
  };
  return Object.freeze({
    objectiveScope: "complete-coarse-domain-plus-local-final-cell-containment" as const,
    workAccountingScope: "conservative-raster-pixel-visits" as const,
    candidateEvaluationMethod: "full-resolution-row-span-prefix-sum" as const,
    sourceForegroundPixels: input.counts[0],
    targetForegroundPixels: input.counts[1],
    eligiblePixels: input.counts[2],
    eligibleSourceSeedPixels: input.counts[3],
    callerSeed: REAL_BUILD_PREFIX50_CAMERA_SEARCH_CALLER_SEED,
    analyticSeed: input.analyticSeed,
    analyticProposalInsideBounds: input.analyticProposalInsideBounds,
    callerSeedEvaluated: input.callerSeedEvaluated,
    analyticProposalEvaluated: input.analyticProposalEvaluated,
    callerBasinInitialSampledIntersectionOverUnion:
      input.callerBasinInitialSampledIntersectionOverUnion,
    analyticBasinInitialSampledIntersectionOverUnion:
      input.analyticBasinInitialSampledIntersectionOverUnion,
    callerBasinFinalExactTransform: input.callerBasinFinalExactTransform,
    analyticBasinFinalExactTransform: input.analyticBasinFinalExactTransform,
    callerBasinFinalExactIntersectionOverUnion: input.callerBasinFinalExactIntersectionOverUnion,
    analyticBasinFinalExactIntersectionOverUnion:
      input.analyticBasinFinalExactIntersectionOverUnion,
    basinsComparedAtFullResolution: input.basinsComparedAtFullResolution,
    equivalenceComponentComplete: input.equivalenceComponentComplete,
    equivalenceComponentMembersVisited: input.equivalenceComponentMembersVisited,
    localFinalCellContainmentComplete: input.localFinalCellContainmentComplete,
    translationDomainAuthority: "source-target-foreground-overlap-complete" as const,
    translationDomainRasterWidth: input.translationDomainRasterWidth,
    translationDomainRasterHeight: input.translationDomainRasterHeight,
    relativeScaleRadius: input.relativeScaleRadius,
    requestedCoarseStridePx: input.requestedCoarseStridePx,
    effectiveCoarseStridePx: input.effectiveCoarseStridePx,
    coarseTranslationStepPx: input.coarseTranslationStepPx,
    coarseRelativeScaleStep: input.coarseRelativeScaleStep,
    coarseCandidatesExpected: input.coarseCandidatesExpected,
    coarseCandidatesEvaluated: input.coarseCandidatesEvaluated,
    coarsePixelVisitUpperBound: input.coarsePixelVisitUpperBound,
    coarsePreflightPassed: input.coarsePreflightPassed,
    coarseDomainComplete: input.coarseDomainComplete,
    coarseScaleTranslationDomains: input.coarseScaleTranslationDomains,
    coarseObjectiveTiesExpected: input.coarseObjectiveTiesExpected,
    coarseObjectiveTiesClassified: input.coarseObjectiveTiesClassified,
    coarseObjectiveTieClassificationComplete: input.coarseObjectiveTieClassificationComplete,
    coarseObjectiveTieTranslationBoundaryHit: input.coarseObjectiveTieTranslationBoundaryHit,
    coarseObjectiveTieScaleBoundaryHit: input.coarseObjectiveTieScaleBoundaryHit,
    coarseEquivalentRasterSeeds: input.coarseEquivalentRasterSeeds,
    exactObjectiveTiesExpected: input.exactObjectiveTiesExpected,
    exactObjectiveTiesClassified: input.exactObjectiveTiesClassified,
    exactObjectiveTieClassificationComplete: input.exactObjectiveTieClassificationComplete,
    exactEquivalentRasterSeeds: input.exactEquivalentRasterSeeds,
    exactObjectiveRunComparisonsPerformed: input.exactObjectiveRunComparisonsPerformed,
    maximumTieComparisonPixelVisitsPerClassification:
      input.maximumTieComparisonPixelVisitsPerClassification,
    refinementStarts: input.refinementStarts,
    finalCenterCellPx: input.finalCenterCellPx,
    finalRelativeScaleCell: input.finalRelativeScaleCell,
    candidatesTried: input.candidatesTried,
    sampledCandidatesTried: input.sampledCandidatesTried,
    fullResolutionCandidatesTried: input.fullResolutionCandidatesTried,
    sampledPixelVisits: input.work.sampledObjectivePixelVisits,
    fullResolutionPixelVisits: cameraSearchFullResolutionPixelVisits(input.work),
    inputValidationPixelVisits: input.work.inputValidationPixelVisits,
    momentPixelVisits: input.work.momentPixelVisits,
    sourceForegroundPixelVisits: input.work.sourceForegroundPixelVisits,
    pyramidConstructionPixelVisits: input.work.pyramidConstructionPixelVisits,
    rowSpanIndexConstructionPixelVisits: input.work.rowSpanIndexConstructionPixelVisits,
    preprocessingPixelVisits: cameraSearchPreprocessingPixelVisits(input.work),
    exactObjectivePixelVisits: input.work.exactObjectivePixelVisits,
    tieRasterizationPixelVisits: input.work.tieRasterizationPixelVisits,
    tieComparisonPixelVisits: input.work.tieComparisonPixelVisits,
    totalPixelVisits: cameraSearchTotalPixelVisits(input.work),
    maximumCandidates: input.maximumCandidates,
    maximumCoarseCandidates: input.maximumCoarseCandidates,
    maximumSampledPixelVisits: input.maximumSampledPixelVisits,
    maximumFullResolutionCandidates: input.maximumFullResolutionCandidates,
    maximumFullResolutionPixelVisits: input.maximumFullResolutionPixelVisits,
    maximumPreprocessingPixelVisits: input.maximumPreprocessingPixelVisits,
    maximumTotalPixelVisits: input.maximumTotalPixelVisits,
    equivalentRasterTieCount: input.equivalentRasterTieCount,
    localNeighborOptimal: input.localNeighborOptimal,
    centerBoundaryHit: input.centerBoundaryHit,
    scaleBoundaryHit: input.scaleBoundaryHit,
    predictedIntersectionPixels: agreement.intersection,
    predictedUnionPixels: agreement.union,
    predictedWarpedEligiblePixels: agreement.warpedEligible,
    predictedWarpedInRasterPixels: agreement.warpedInRaster,
    predictedWarpedUnclippedPixels: agreement.warpedUnclipped,
    predictedOffscreenPenaltyPixels: agreement.warpedUnclipped - agreement.warpedInRaster,
    predictedInRasterCoverage:
      agreement.warpedUnclipped === 0 ? 0 : agreement.warpedInRaster / agreement.warpedUnclipped,
    predictedIntersectionOverUnion:
      agreement.union === 0 ? 0 : agreement.intersection / agreement.union,
  });
}
