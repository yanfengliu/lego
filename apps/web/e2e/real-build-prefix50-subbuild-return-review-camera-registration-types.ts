export interface RealBuildPrefix50EligibleMaskRaster {
  readonly width: number;
  readonly height: number;
  readonly mask: Uint8Array;
}

export interface RealBuildPrefix50EligibleMaskSimilarityTransform {
  readonly scale: number;
  readonly offsetXPx: number;
  readonly offsetYPx: number;
}

export interface RealBuildPrefix50EligibleMaskSearchThresholds {
  readonly maximumFinalCenterCellPx: 0.1;
  readonly maximumFinalRelativeScaleCell: 0.0005;
}

export const REAL_BUILD_PREFIX50_ELIGIBLE_MASK_SEARCH_THRESHOLDS = Object.freeze({
  maximumFinalCenterCellPx: 0.1,
  maximumFinalRelativeScaleCell: 0.0005,
} satisfies RealBuildPrefix50EligibleMaskSearchThresholds);

export interface RealBuildPrefix50EligibleMaskSearchOptions {
  readonly relativeScaleRadius?: number;
  readonly initialCenterStepPx?: number;
  readonly initialRelativeScaleStep?: number;
  readonly finalCenterCellPx?: number;
  readonly finalRelativeScaleCell?: number;
  readonly coarseStridePx?: number;
  readonly maximumCandidates?: number;
  readonly maximumSampledPixelVisits?: number;
  readonly maximumFullResolutionCandidates?: number;
  readonly maximumFullResolutionPixelVisits?: number;
  readonly maximumPreprocessingPixelVisits?: number;
  readonly maximumTotalPixelVisits?: number;
}

export interface RealBuildPrefix50CoarseScaleTranslationDomain {
  readonly relativeScaleDelta: number;
  readonly scale: number;
  readonly minimumOffsetXPx: number;
  readonly maximumOffsetXPx: number;
  readonly minimumOffsetYPx: number;
  readonly maximumOffsetYPx: number;
  readonly xCandidates: number;
  readonly yCandidates: number;
  readonly candidateCount: number;
}

export type RealBuildPrefix50EligibleMaskSearchRefusal =
  | "empty-source-mask"
  | "empty-target-mask"
  | "empty-eligible-mask"
  | "incomplete-coarse-domain"
  | "incomplete-coarse-tie-classification"
  | "incomplete-exact-tie-classification"
  | "candidate-budget-exhausted"
  | "pixel-visit-budget-exhausted"
  | "search-boundary-hit"
  | "ambiguous-equal-objective-plateau";

export interface RealBuildPrefix50EligibleMaskSearchDiagnostics {
  readonly objectiveScope: "complete-coarse-domain-plus-local-final-cell-containment";
  readonly workAccountingScope: "conservative-raster-pixel-visits";
  readonly candidateEvaluationMethod: "full-resolution-row-span-prefix-sum";
  readonly sourceForegroundPixels: number;
  readonly targetForegroundPixels: number;
  readonly eligiblePixels: number;
  readonly eligibleSourceSeedPixels: number;
  readonly callerSeed: RealBuildPrefix50EligibleMaskSimilarityTransform;
  readonly analyticSeed: RealBuildPrefix50EligibleMaskSimilarityTransform | null;
  readonly analyticProposalInsideBounds: boolean;
  readonly callerSeedEvaluated: boolean;
  readonly analyticProposalEvaluated: boolean;
  readonly callerBasinInitialSampledIntersectionOverUnion: number;
  readonly analyticBasinInitialSampledIntersectionOverUnion: number | null;
  readonly callerBasinFinalExactTransform: RealBuildPrefix50EligibleMaskSimilarityTransform | null;
  readonly analyticBasinFinalExactTransform: RealBuildPrefix50EligibleMaskSimilarityTransform | null;
  readonly callerBasinFinalExactIntersectionOverUnion: number | null;
  readonly analyticBasinFinalExactIntersectionOverUnion: number | null;
  readonly basinsComparedAtFullResolution: boolean;
  readonly equivalenceComponentComplete: boolean;
  readonly equivalenceComponentMembersVisited: number;
  readonly localFinalCellContainmentComplete: boolean;
  readonly translationDomainAuthority: "source-target-foreground-overlap-complete";
  readonly translationDomainRasterWidth: number;
  readonly translationDomainRasterHeight: number;
  readonly relativeScaleRadius: number;
  readonly requestedCoarseStridePx: number;
  readonly effectiveCoarseStridePx: number;
  readonly coarseTranslationStepPx: number;
  readonly coarseRelativeScaleStep: number;
  readonly coarseCandidatesExpected: number;
  readonly coarseCandidatesEvaluated: number;
  readonly coarsePixelVisitUpperBound: number | null;
  readonly coarsePreflightPassed: boolean;
  readonly coarseDomainComplete: boolean;
  readonly coarseScaleTranslationDomains: readonly RealBuildPrefix50CoarseScaleTranslationDomain[];
  readonly coarseObjectiveTiesExpected: number;
  readonly coarseObjectiveTiesClassified: number;
  readonly coarseObjectiveTieClassificationComplete: boolean;
  readonly coarseObjectiveTieTranslationBoundaryHit: boolean;
  readonly coarseObjectiveTieScaleBoundaryHit: boolean;
  readonly coarseEquivalentRasterSeeds: number;
  readonly exactObjectiveTiesExpected: number;
  readonly exactObjectiveTiesClassified: number;
  readonly exactObjectiveTieClassificationComplete: boolean;
  readonly exactEquivalentRasterSeeds: number;
  readonly exactObjectiveRunComparisonsPerformed: number;
  readonly maximumTieComparisonPixelVisitsPerClassification: number;
  readonly refinementStarts: number;
  readonly finalCenterCellPx: number;
  readonly finalRelativeScaleCell: number;
  readonly candidatesTried: number;
  readonly sampledCandidatesTried: number;
  readonly fullResolutionCandidatesTried: number;
  readonly sampledPixelVisits: number;
  readonly fullResolutionPixelVisits: number;
  readonly inputValidationPixelVisits: number;
  readonly momentPixelVisits: number;
  readonly sourceForegroundPixelVisits: number;
  readonly pyramidConstructionPixelVisits: number;
  readonly rowSpanIndexConstructionPixelVisits: number;
  readonly preprocessingPixelVisits: number;
  readonly exactObjectivePixelVisits: number;
  readonly tieRasterizationPixelVisits: number;
  readonly tieComparisonPixelVisits: number;
  readonly totalPixelVisits: number;
  readonly maximumCandidates: number;
  readonly maximumCoarseCandidates: number;
  readonly maximumSampledPixelVisits: number;
  readonly maximumFullResolutionCandidates: number;
  readonly maximumFullResolutionPixelVisits: number;
  readonly maximumPreprocessingPixelVisits: number;
  readonly maximumTotalPixelVisits: number;
  readonly equivalentRasterTieCount: number;
  readonly localNeighborOptimal: boolean;
  readonly centerBoundaryHit: boolean;
  readonly scaleBoundaryHit: boolean;
  readonly predictedIntersectionPixels: number;
  readonly predictedUnionPixels: number;
  readonly predictedWarpedEligiblePixels: number;
  readonly predictedWarpedInRasterPixels: number;
  readonly predictedWarpedUnclippedPixels: number;
  readonly predictedOffscreenPenaltyPixels: number;
  readonly predictedInRasterCoverage: number;
  readonly predictedIntersectionOverUnion: number;
}

export type RealBuildPrefix50EligibleMaskSearchResult = Readonly<
  | {
      readonly status: "locally-contained";
      readonly transform: RealBuildPrefix50EligibleMaskSimilarityTransform;
      readonly diagnostics: RealBuildPrefix50EligibleMaskSearchDiagnostics;
    }
  | {
      readonly status: "refused";
      readonly reason: RealBuildPrefix50EligibleMaskSearchRefusal;
      readonly transform: RealBuildPrefix50EligibleMaskSimilarityTransform | null;
      readonly diagnostics: RealBuildPrefix50EligibleMaskSearchDiagnostics;
    }
>;
