import type {
  RealBuildPrefix50EligibleMaskSearchDiagnostics,
  RealBuildPrefix50EligibleMaskSearchOptions,
  RealBuildPrefix50EligibleMaskSearchRefusal,
  RealBuildPrefix50EligibleMaskSearchResult,
  RealBuildPrefix50EligibleMaskSimilarityTransform,
  RealBuildPrefix50CoarseScaleTranslationDomain,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";
import type { RealBuildPrefix50SimilaritySearchCoordinate as SearchCoordinate } from "./real-build-prefix50-subbuild-return-review-camera-registration-primitives.ts";
import {
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_COARSE_CANDIDATES,
  cameraSearchDiagnostics as diagnostics,
  type RealBuildPrefix50CameraSearchCandidate as Candidate,
  type RealBuildPrefix50CameraSearchWorkLedger as WorkLedger,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-support.ts";

export interface RealBuildPrefix50EquivalentRasterExtent {
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
  minimumScale: number;
  maximumScale: number;
}

export interface RealBuildPrefix50CameraSearchReportBase {
  readonly counts: readonly [number, number, number, number];
  readonly options: Required<RealBuildPrefix50EligibleMaskSearchOptions>;
  readonly work: WorkLedger;
  readonly coarseTranslationStepPx: number;
  readonly coarseRelativeScaleStep: number;
  readonly coarseCandidatesExpected: number;
  readonly coarsePixelVisitUpperBound: number | null;
  readonly coarsePreflightPassed: boolean;
  readonly coarseScaleTranslationDomains: readonly RealBuildPrefix50CoarseScaleTranslationDomain[];
  readonly translationDomainRasterWidth: number;
  readonly translationDomainRasterHeight: number;
  readonly maximumTieComparisonPixelVisitsPerClassification: number;
}

export function cameraSearchBaseDiagnostics(
  base: RealBuildPrefix50CameraSearchReportBase,
  overrides: Partial<Parameters<typeof diagnostics>[0]> = {},
): RealBuildPrefix50EligibleMaskSearchDiagnostics {
  const { counts, options, work } = base;
  return diagnostics({
    counts,
    analyticSeed: null,
    analyticProposalInsideBounds: false,
    callerSeedEvaluated: false,
    analyticProposalEvaluated: false,
    callerBasinInitialSampledIntersectionOverUnion: 0,
    analyticBasinInitialSampledIntersectionOverUnion: null,
    callerBasinFinalExactTransform: null,
    analyticBasinFinalExactTransform: null,
    callerBasinFinalExactIntersectionOverUnion: null,
    analyticBasinFinalExactIntersectionOverUnion: null,
    basinsComparedAtFullResolution: false,
    equivalenceComponentComplete: false,
    equivalenceComponentMembersVisited: 0,
    localFinalCellContainmentComplete: false,
    translationDomainRasterWidth: base.translationDomainRasterWidth,
    translationDomainRasterHeight: base.translationDomainRasterHeight,
    relativeScaleRadius: options.relativeScaleRadius,
    requestedCoarseStridePx: options.coarseStridePx,
    effectiveCoarseStridePx: options.coarseStridePx,
    coarseTranslationStepPx: base.coarseTranslationStepPx,
    coarseRelativeScaleStep: base.coarseRelativeScaleStep,
    coarseCandidatesExpected: base.coarseCandidatesExpected,
    coarseCandidatesEvaluated: 0,
    coarsePixelVisitUpperBound: base.coarsePixelVisitUpperBound,
    coarsePreflightPassed: base.coarsePreflightPassed,
    coarseDomainComplete: false,
    coarseScaleTranslationDomains: base.coarseScaleTranslationDomains,
    coarseObjectiveTiesExpected: 0,
    coarseObjectiveTiesClassified: 0,
    coarseObjectiveTieClassificationComplete: false,
    coarseObjectiveTieTranslationBoundaryHit: false,
    coarseObjectiveTieScaleBoundaryHit: false,
    coarseEquivalentRasterSeeds: 0,
    exactObjectiveTiesExpected: 0,
    exactObjectiveTiesClassified: 0,
    exactObjectiveTieClassificationComplete: false,
    exactEquivalentRasterSeeds: 0,
    exactObjectiveRunComparisonsPerformed: 0,
    maximumTieComparisonPixelVisitsPerClassification:
      base.maximumTieComparisonPixelVisitsPerClassification,
    refinementStarts: 0,
    finalCenterCellPx: options.finalCenterCellPx,
    finalRelativeScaleCell: options.finalRelativeScaleCell,
    candidatesTried: 0,
    sampledCandidatesTried: 0,
    fullResolutionCandidatesTried: 0,
    work,
    maximumCandidates: options.maximumCandidates,
    maximumCoarseCandidates: REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_COARSE_CANDIDATES,
    maximumSampledPixelVisits: options.maximumSampledPixelVisits,
    maximumFullResolutionCandidates: options.maximumFullResolutionCandidates,
    maximumFullResolutionPixelVisits: options.maximumFullResolutionPixelVisits,
    maximumPreprocessingPixelVisits: options.maximumPreprocessingPixelVisits,
    maximumTotalPixelVisits: options.maximumTotalPixelVisits,
    equivalentRasterTieCount: 0,
    localNeighborOptimal: false,
    centerBoundaryHit: false,
    scaleBoundaryHit: false,
    ...overrides,
  });
}

function intersectionOverUnion(candidate: Candidate | null): number | null {
  if (candidate === null) return null;
  return candidate.agreement.union === 0
    ? 0
    : candidate.agreement.intersection / candidate.agreement.union;
}

export function finalizeCameraSearchReport(input: {
  readonly base: RealBuildPrefix50CameraSearchReportBase;
  readonly identity: SearchCoordinate;
  readonly publishedCandidate: Candidate | null;
  readonly equivalentExtent: RealBuildPrefix50EquivalentRasterExtent | null;
  readonly analyticSeed: RealBuildPrefix50EligibleMaskSimilarityTransform | null;
  readonly analyticProposalInsideBounds: boolean;
  readonly callerInitial: Candidate | null;
  readonly analyticInitial: Candidate | null;
  readonly callerBasinFinal: Candidate | null;
  readonly analyticBasinFinal: Candidate | null;
  readonly effectiveCoarseStridePx: number;
  readonly sampledCandidatesTried: number;
  readonly fullResolutionCandidatesTried: number;
  readonly equivalentRasterTieCount: number;
  readonly localNeighborOptimal: boolean;
  readonly equivalenceComponentComplete: boolean;
  readonly equivalenceComponentMembersVisited: number;
  readonly localFinalCellContainmentComplete: boolean;
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
  readonly equivalentCenterBoundaryHit: boolean;
  readonly equivalentScaleBoundaryHit: boolean;
  readonly refinementStarts: number;
  readonly budgetReason: RealBuildPrefix50EligibleMaskSearchRefusal | null;
  readonly ambiguousBest: boolean;
}): RealBuildPrefix50EligibleMaskSearchResult {
  const { options } = input.base;
  const selected = input.publishedCandidate?.coordinate ?? input.identity;
  const extent = input.equivalentExtent ?? {
    minimumX: selected.deltaX,
    maximumX: selected.deltaX,
    minimumY: selected.deltaY,
    maximumY: selected.deltaY,
    minimumScale: selected.relativeScaleDelta,
    maximumScale: selected.relativeScaleDelta,
  };
  const centerBoundaryHit =
    input.coarseObjectiveTieTranslationBoundaryHit || input.equivalentCenterBoundaryHit;
  const scaleBoundaryHit =
    input.coarseObjectiveTieScaleBoundaryHit ||
    input.equivalentScaleBoundaryHit ||
    extent.minimumScale <= -options.relativeScaleRadius + options.finalRelativeScaleCell ||
    extent.maximumScale >= options.relativeScaleRadius - options.finalRelativeScaleCell;
  const detail = cameraSearchBaseDiagnostics(input.base, {
    analyticSeed: input.analyticSeed,
    analyticProposalInsideBounds: input.analyticProposalInsideBounds,
    callerSeedEvaluated: input.callerInitial !== null,
    analyticProposalEvaluated: input.analyticInitial !== null,
    callerBasinInitialSampledIntersectionOverUnion: intersectionOverUnion(input.callerInitial) ?? 0,
    analyticBasinInitialSampledIntersectionOverUnion: intersectionOverUnion(input.analyticInitial),
    callerBasinFinalExactTransform: input.callerBasinFinal?.transform ?? null,
    analyticBasinFinalExactTransform: input.analyticBasinFinal?.transform ?? null,
    callerBasinFinalExactIntersectionOverUnion: intersectionOverUnion(input.callerBasinFinal),
    analyticBasinFinalExactIntersectionOverUnion: intersectionOverUnion(input.analyticBasinFinal),
    basinsComparedAtFullResolution:
      input.callerBasinFinal !== null && input.analyticBasinFinal !== null,
    effectiveCoarseStridePx: input.effectiveCoarseStridePx,
    candidatesTried: input.sampledCandidatesTried + input.fullResolutionCandidatesTried,
    sampledCandidatesTried: input.sampledCandidatesTried,
    fullResolutionCandidatesTried: input.fullResolutionCandidatesTried,
    equivalentRasterTieCount: input.equivalentRasterTieCount,
    localNeighborOptimal: input.localNeighborOptimal,
    equivalenceComponentComplete: input.equivalenceComponentComplete,
    equivalenceComponentMembersVisited: input.equivalenceComponentMembersVisited,
    localFinalCellContainmentComplete: input.localFinalCellContainmentComplete,
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
    refinementStarts: input.refinementStarts,
    centerBoundaryHit,
    scaleBoundaryHit,
    ...(input.publishedCandidate === null ? {} : { agreement: input.publishedCandidate.agreement }),
  });
  const reason =
    centerBoundaryHit || scaleBoundaryHit
      ? "search-boundary-hit"
      : input.ambiguousBest
        ? "ambiguous-equal-objective-plateau"
        : input.budgetReason;
  if (reason !== null)
    return Object.freeze({
      status: "refused",
      reason,
      transform: input.publishedCandidate?.transform ?? null,
      diagnostics: detail,
    });
  if (input.publishedCandidate === null)
    return Object.freeze({
      status: "refused",
      reason: "candidate-budget-exhausted",
      transform: null,
      diagnostics: detail,
    });
  return Object.freeze({
    status: "locally-contained",
    transform: input.publishedCandidate.transform,
    diagnostics: detail,
  });
}
