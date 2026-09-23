import {
  type RealBuildPrefix50EligibleMaskRaster,
  type RealBuildPrefix50EligibleMaskSearchOptions,
  type RealBuildPrefix50EligibleMaskSearchRefusal,
  type RealBuildPrefix50EligibleMaskSearchResult,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";
import { proveRealBuildPrefix50LocalSearchContainment } from "./real-build-prefix50-subbuild-return-review-camera-registration-containment.ts";
import { planRealBuildPrefix50CompleteCoarseDomain } from "./real-build-prefix50-subbuild-return-review-camera-registration-domain.ts";
import {
  refineRealBuildPrefix50ExactCameraBasin,
  refineRealBuildPrefix50SampledCameraBasins,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-refinement.ts";
import {
  compareMaskAgreement as compareAgreement,
  maskMoments as moments,
  requireExactBinaryRaster as exactRaster,
  similarityCoordinateKey as coordinateKey,
  similarityTransformFor as transformFor,
  type RealBuildPrefix50SimilaritySearchCoordinate as SearchCoordinate,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-primitives.ts";
import {
  buildRealBuildPrefix50ExactRowSpanIndex,
  maximumRealBuildPrefix50ExactRowSpanCandidatePixelVisits,
  maximumRealBuildPrefix50ExactWarpRunComparisonPixelVisits,
  measureRealBuildPrefix50ExactRowSpanAgreement,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-runs.ts";
import {
  classifyRealBuildPrefix50CachedExactObjectiveTies,
  classifyRealBuildPrefix50CoarseObjectiveTies,
  createRealBuildPrefix50EquivalentRasterClassifier,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-ties.ts";
import {
  cameraSearchBaseDiagnostics,
  finalizeCameraSearchReport,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-report.ts";
import {
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_BEAM_WIDTH as SAMPLE_BEAM_WIDTH,
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_CALLER_SEED as CALLER_SEED,
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_COARSE_CANDIDATES as MAXIMUM_COARSE_CANDIDATES,
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_GRID_AXIS_VALUES as MAXIMUM_GRID_AXIS_VALUES,
  cameraSearchRowOrder as rowOrder,
  canChargeCameraSearchWork as canCharge,
  createCameraSearchWorkLedger,
  normalizedCameraSearchCoordinate as normalizedCoordinate,
  resolveCameraSearchOptions,
  type RealBuildPrefix50CameraSearchCandidate as Candidate,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-support.ts";

export * from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";

export function searchRealBuildPrefix50EligibleMaskSimilarity(input: {
  readonly source: RealBuildPrefix50EligibleMaskRaster;
  readonly target: RealBuildPrefix50EligibleMaskRaster;
  readonly eligibleTarget: RealBuildPrefix50EligibleMaskRaster;
  readonly options?: RealBuildPrefix50EligibleMaskSearchOptions;
}): RealBuildPrefix50EligibleMaskSearchResult {
  const options = resolveCameraSearchOptions(input.options);
  const maximumGridAxisValues = Math.min(options.maximumCandidates, MAXIMUM_GRID_AXIS_VALUES);
  const work = createCameraSearchWorkLedger();
  for (const raster of [input.source, input.target, input.eligibleTarget]) {
    if (!canCharge(work, options, "preprocessing", raster.mask.byteLength))
      throw new RangeError(
        "Eligible-mask raster validation exceeds the preprocessing or total pixel-visit budget.",
      );
    exactRaster(raster, "eligible-mask search raster");
    work.inputValidationPixelVisits += raster.mask.byteLength;
  }
  const { source, target, eligibleTarget: eligible } = input;
  if (
    source.width !== target.width ||
    source.height !== target.height ||
    source.width !== eligible.width ||
    source.height !== eligible.height
  )
    throw new RangeError(
      "Eligible-mask search source, target, and eligibility must share one raster size.",
    );
  const pixels = source.mask.length;
  if (!canCharge(work, options, "preprocessing", pixels * 4))
    throw new RangeError(
      "Eligible-mask moment measurement exceeds the preprocessing or total pixel-visit budget.",
    );
  const sourceMoments = moments(source.mask, source.width);
  const targetMoments = moments(target.mask, target.width);
  const eligibleMoments = moments(eligible.mask, eligible.width);
  const eligibleSourceMoments = moments(source.mask, source.width, eligible.mask);
  work.momentPixelVisits += pixels * 4;
  const counts = [
    sourceMoments.count,
    targetMoments.count,
    eligibleMoments.count,
    eligibleSourceMoments.count,
  ] as const;
  const emptyReportBase = {
    counts,
    options,
    work,
    coarseTranslationStepPx: options.coarseStridePx,
    coarseRelativeScaleStep: options.initialRelativeScaleStep,
    coarseCandidatesExpected: 0,
    coarsePixelVisitUpperBound: 0,
    coarsePreflightPassed: false,
    coarseScaleTranslationDomains: [],
    translationDomainRasterWidth: source.width,
    translationDomainRasterHeight: source.height,
    maximumTieComparisonPixelVisitsPerClassification: 0,
  };
  const emptyReason =
    sourceMoments.count === 0
      ? "empty-source-mask"
      : targetMoments.count === 0
        ? "empty-target-mask"
        : eligibleMoments.count === 0
          ? "empty-eligible-mask"
          : null;
  if (emptyReason !== null)
    return Object.freeze({
      status: "refused",
      reason: emptyReason,
      transform: null,
      diagnostics: cameraSearchBaseDiagnostics(emptyReportBase),
    });
  const domainPlan = planRealBuildPrefix50CompleteCoarseDomain({
    options,
    maximumGridAxisValues,
    width: source.width,
    height: source.height,
    source: sourceMoments,
    target: targetMoments,
  });
  const coarseScaleDomains = domainPlan.domains;
  const publicCoarseScaleDomains = domainPlan.publicDomains;
  const coarseCandidatesExpected = domainPlan.expectedCandidates;
  const domainReportBase = {
    counts,
    options,
    work,
    coarseTranslationStepPx: options.coarseStridePx,
    coarseRelativeScaleStep: options.initialRelativeScaleStep,
    coarseCandidatesExpected,
    coarsePixelVisitUpperBound: 0,
    coarsePreflightPassed: false,
    coarseScaleTranslationDomains: publicCoarseScaleDomains,
    translationDomainRasterWidth: source.width,
    translationDomainRasterHeight: source.height,
    maximumTieComparisonPixelVisitsPerClassification: 0,
  };
  if (!canCharge(work, options, "preprocessing", pixels))
    throw new RangeError(
      "Eligible-mask subset validation exceeds the preprocessing or total pixel-visit budget.",
    );
  for (let index = 0; index < pixels; index += 1)
    if (target.mask[index] === 1 && eligible.mask[index] !== 1)
      throw new TypeError(
        "Eligible-mask search target foreground must be a subset of eligibility.",
      );
  work.inputValidationPixelVisits += pixels;
  const analyticScale =
    eligibleSourceMoments.count === 0
      ? null
      : Math.sqrt(targetMoments.count / eligibleSourceMoments.count);
  const analyticSeed =
    analyticScale === null
      ? null
      : Object.freeze({
          scale: analyticScale,
          offsetXPx: targetMoments.centerX - analyticScale * eligibleSourceMoments.centerX,
          offsetYPx: targetMoments.centerY - analyticScale * eligibleSourceMoments.centerY,
        });
  const analyticCoordinate =
    analyticSeed === null
      ? null
      : normalizedCoordinate({
          deltaX: analyticSeed.offsetXPx,
          deltaY: analyticSeed.offsetYPx,
          relativeScaleDelta: analyticSeed.scale - 1,
        });
  const insideBounds = domainPlan.contains;
  const analyticProposalInsideBounds =
    analyticCoordinate !== null && insideBounds(analyticCoordinate);
  let budgetReason: RealBuildPrefix50EligibleMaskSearchRefusal | null = null;
  const maximumRowSpanIndexConstruction =
    pixels * 3 + sourceMoments.count * 2 + eligibleMoments.count * 2;
  if (!canCharge(work, options, "preprocessing", maximumRowSpanIndexConstruction))
    return Object.freeze({
      status: "refused",
      reason: "pixel-visit-budget-exhausted",
      transform: null,
      diagnostics: cameraSearchBaseDiagnostics(domainReportBase),
    });
  const rowSpanIndex = buildRealBuildPrefix50ExactRowSpanIndex({
    source,
    target,
    eligible,
    maximumScale: 1 + options.relativeScaleRadius,
  });
  work.rowSpanIndexConstructionPixelVisits += rowSpanIndex.constructionPixelVisits;
  let coarsePixelVisitUpperBound: number | null = 0;
  for (const domain of coarseScaleDomains) {
    const perCandidate = maximumRealBuildPrefix50ExactRowSpanCandidatePixelVisits(
      rowSpanIndex,
      domain.scale,
    );
    if (
      coarsePixelVisitUpperBound === null ||
      domain.candidateCount >
        Math.floor((Number.MAX_SAFE_INTEGER - coarsePixelVisitUpperBound) / perCandidate)
    ) {
      coarsePixelVisitUpperBound = null;
      break;
    }
    coarsePixelVisitUpperBound += domain.candidateCount * perCandidate;
  }
  const coarsePreflightPassed =
    coarseCandidatesExpected <= Math.min(options.maximumCandidates, MAXIMUM_COARSE_CANDIDATES) &&
    coarsePixelVisitUpperBound !== null &&
    canCharge(work, options, "sampled-objective", coarsePixelVisitUpperBound);
  const reportBase = {
    ...domainReportBase,
    coarsePixelVisitUpperBound,
    coarsePreflightPassed,
    maximumTieComparisonPixelVisitsPerClassification:
      maximumRealBuildPrefix50ExactWarpRunComparisonPixelVisits(
        rowSpanIndex,
        1 + options.relativeScaleRadius,
      ),
  };
  if (!coarsePreflightPassed) budgetReason = "incomplete-coarse-domain";

  const sampleCache = new Map<string, Candidate>();
  const fullCache = new Map<string, Candidate>();
  let sampledCandidatesTried = 0;
  let fullResolutionCandidatesTried = 0;
  let globalFullBest: Candidate | null = null;
  const globalBestCandidate = (): Candidate | null => globalFullBest;
  const acceptCandidate = (maximumVisits: number, exact: boolean): boolean => {
    if (sampledCandidatesTried + fullResolutionCandidatesTried >= options.maximumCandidates) {
      budgetReason = "candidate-budget-exhausted";
      return false;
    }
    if (exact && fullResolutionCandidatesTried >= options.maximumFullResolutionCandidates) {
      budgetReason = "candidate-budget-exhausted";
      return false;
    }
    if (!canCharge(work, options, exact ? "exact-objective" : "sampled-objective", maximumVisits)) {
      budgetReason = "pixel-visit-budget-exhausted";
      return false;
    }
    return true;
  };
  const tieClassifier = createRealBuildPrefix50EquivalentRasterClassifier({
    chargeComparison(maximumVisits) {
      if (canCharge(work, options, "tie-comparison", maximumVisits)) return true;
      budgetReason = "pixel-visit-budget-exhausted";
      return false;
    },
    recordComparisonVisits(visits) {
      work.tieComparisonPixelVisits += visits;
    },
  });
  const isEquivalentBestRaster = (candidate: Candidate): boolean =>
    tieClassifier.classify(candidate, globalBestCandidate());
  let exactTieClassification = {
    expected: 0,
    classified: 0,
    complete: false,
    equivalentSeeds: [] as readonly Candidate[],
  };
  const reclassifyExactCache = () => {
    exactTieClassification = classifyRealBuildPrefix50CachedExactObjectiveTies({
      candidates: [...fullCache.values()],
      best: globalBestCandidate(),
      classifier: tieClassifier,
      readBudgetReason: () => budgetReason,
    });
    if (globalBestCandidate() !== null && !exactTieClassification.complete && budgetReason === null)
      budgetReason = "incomplete-exact-tie-classification";
    return exactTieClassification;
  };
  const sampleCandidateFor = (coordinate: SearchCoordinate): Candidate | null => {
    const normalized = normalizedCoordinate(coordinate);
    if (!insideBounds(normalized)) return null;
    const key = coordinateKey(normalized);
    const known = sampleCache.get(key);
    if (known !== undefined) return known;
    const transform = transformFor(CALLER_SEED, normalized);
    if (
      !acceptCandidate(
        maximumRealBuildPrefix50ExactRowSpanCandidatePixelVisits(rowSpanIndex, transform.scale),
        false,
      )
    )
      return null;
    const measurement = measureRealBuildPrefix50ExactRowSpanAgreement({
      transform,
      index: rowSpanIndex,
      retainEligibleWarpRuns: false,
    });
    const candidate = { coordinate: normalized, transform, agreement: measurement.agreement };
    sampleCache.set(key, candidate);
    sampledCandidatesTried += 1;
    work.sampledObjectivePixelVisits += measurement.pixelVisits;
    return candidate;
  };
  const fullCandidateFor = (coordinate: SearchCoordinate): Candidate | null => {
    const normalized = normalizedCoordinate(coordinate);
    if (!insideBounds(normalized)) return null;
    const key = coordinateKey(normalized);
    const known = fullCache.get(key);
    if (known !== undefined) return known;
    const transform = transformFor(CALLER_SEED, normalized);
    if (
      !acceptCandidate(
        maximumRealBuildPrefix50ExactRowSpanCandidatePixelVisits(rowSpanIndex, transform.scale),
        true,
      )
    )
      return null;
    const measurement = measureRealBuildPrefix50ExactRowSpanAgreement({
      transform,
      index: rowSpanIndex,
      retainEligibleWarpRuns: true,
    });
    if (measurement.eligibleWarpRuns === null)
      throw new TypeError("Exact camera candidate did not retain its eligible-warp row spans.");
    const candidate = {
      coordinate: normalized,
      transform,
      agreement: measurement.agreement,
      eligibleWarpRuns: measurement.eligibleWarpRuns,
    };
    fullCache.set(key, candidate);
    fullResolutionCandidatesTried += 1;
    work.exactObjectivePixelVisits += measurement.pixelVisits;
    const comparison =
      globalFullBest === null ? 1 : compareAgreement(candidate.agreement, globalFullBest.agreement);
    if (comparison > 0) {
      globalFullBest = candidate;
      tieClassifier.reset(candidate);
      reclassifyExactCache();
    } else if (comparison === 0 && globalFullBest !== null) {
      isEquivalentBestRaster(candidate);
    }
    return candidate;
  };

  const identity = { deltaX: 0, deltaY: 0, relativeScaleDelta: 0 };
  const coarseCandidates: Candidate[] = [];
  let coarseCandidatesEvaluated = 0;
  let coarseDomainComplete = false;
  if (coarsePreflightPassed) {
    coarseDomain: for (const domain of coarseScaleDomains)
      for (const deltaY of domain.yGrid)
        for (const deltaX of domain.xGrid) {
          const candidate = sampleCandidateFor({
            deltaX,
            deltaY,
            relativeScaleDelta: domain.relativeScaleDelta,
          });
          if (candidate === null) break coarseDomain;
          coarseCandidates.push(candidate);
          coarseCandidatesEvaluated += 1;
        }
    coarseDomainComplete = coarseCandidatesEvaluated === coarseCandidatesExpected;
  }
  if (!coarseDomainComplete) budgetReason = "incomplete-coarse-domain";
  const callerInitial = coarseDomainComplete ? sampleCandidateFor(identity) : null;
  const analyticInitial =
    coarseDomainComplete && analyticProposalInsideBounds
      ? sampleCandidateFor(analyticCoordinate!)
      : null;
  const sampledRefinement = refineRealBuildPrefix50SampledCameraBasins({
    coarseCandidates,
    beamWidth: SAMPLE_BEAM_WIDTH,
    identity,
    callerInitial,
    analyticInitial,
    options,
    evaluate: sampleCandidateFor,
    readBudgetReason: () => budgetReason,
  });
  const { hypotheses, callerBasin, analyticBasin, refinementStarts } = sampledRefinement;

  if (budgetReason === null) {
    fullCandidateFor(identity);
    if (analyticProposalInsideBounds) fullCandidateFor(analyticCoordinate!);
    for (const coordinate of hypotheses) fullCandidateFor(coordinate);
  }
  const refineFullBasin = (start: SearchCoordinate | null) =>
    refineRealBuildPrefix50ExactCameraBasin({
      start,
      options,
      evaluate: fullCandidateFor,
      readBudgetReason: () => budgetReason,
      order: rowOrder,
    });
  const callerBasinFinal = refineFullBasin(callerBasin);
  const analyticBasinFinal = refineFullBasin(analyticBasin);

  let coarseTieClassification = {
    expected: 0,
    classified: 0,
    complete: false,
    centerBoundaryHit: false,
    scaleBoundaryHit: false,
    equivalentSeeds: [] as readonly Candidate[],
  };
  const readEquivalentCoarseSeeds = (): readonly Candidate[] => {
    coarseTieClassification = classifyRealBuildPrefix50CoarseObjectiveTies({
      coarseCandidates,
      best: globalBestCandidate(),
      boundaryFor: domainPlan.boundaryFor,
      evaluateExactCandidate: (candidate) => fullCandidateFor(candidate.coordinate),
      classifier: tieClassifier,
      readBudgetReason: () => budgetReason,
    });
    if (
      globalBestCandidate() !== null &&
      !coarseTieClassification.complete &&
      budgetReason === null
    )
      budgetReason = "incomplete-coarse-tie-classification";
    reclassifyExactCache();
    return tieClassifier.equivalentCandidates();
  };

  const containment = proveRealBuildPrefix50LocalSearchContainment({
    options,
    readBestCandidate: globalBestCandidate,
    evaluateExactCandidate: fullCandidateFor,
    isEquivalentBestRaster,
    readEquivalentSeeds: readEquivalentCoarseSeeds,
    boundaryFor: domainPlan.boundaryFor,
    readBudgetReason: () => budgetReason,
  });
  reclassifyExactCache();
  const exactEquivalentBoundaries = exactTieClassification.equivalentSeeds.map((candidate) =>
    domainPlan.boundaryFor(candidate.coordinate),
  );

  return finalizeCameraSearchReport({
    base: reportBase,
    identity,
    publishedCandidate: globalBestCandidate(),
    equivalentExtent: containment.equivalentExtent,
    analyticSeed,
    analyticProposalInsideBounds,
    callerInitial,
    analyticInitial,
    callerBasinFinal,
    analyticBasinFinal,
    effectiveCoarseStridePx: options.coarseStridePx,
    coarseTranslationStepPx: options.coarseStridePx,
    coarseRelativeScaleStep: options.initialRelativeScaleStep,
    coarseCandidatesExpected,
    coarseCandidatesEvaluated,
    coarsePixelVisitUpperBound,
    coarsePreflightPassed,
    coarseDomainComplete,
    coarseScaleTranslationDomains: publicCoarseScaleDomains,
    coarseObjectiveTiesExpected: coarseTieClassification.expected,
    coarseObjectiveTiesClassified: coarseTieClassification.classified,
    coarseObjectiveTieClassificationComplete: coarseTieClassification.complete,
    coarseObjectiveTieTranslationBoundaryHit: coarseTieClassification.centerBoundaryHit,
    coarseObjectiveTieScaleBoundaryHit: coarseTieClassification.scaleBoundaryHit,
    coarseEquivalentRasterSeeds: coarseTieClassification.equivalentSeeds.length,
    exactObjectiveTiesExpected: exactTieClassification.expected,
    exactObjectiveTiesClassified: exactTieClassification.classified,
    exactObjectiveTieClassificationComplete: exactTieClassification.complete,
    exactEquivalentRasterSeeds: exactTieClassification.equivalentSeeds.length,
    exactObjectiveRunComparisonsPerformed: tieClassifier.runComparisonsPerformed(),
    equivalentCenterBoundaryHit:
      containment.centerBoundaryHit ||
      exactEquivalentBoundaries.some((boundary) => boundary.centerBoundaryHit),
    equivalentScaleBoundaryHit:
      containment.scaleBoundaryHit ||
      exactEquivalentBoundaries.some((boundary) => boundary.scaleBoundaryHit),
    refinementStarts,
    sampledCandidatesTried,
    fullResolutionCandidatesTried,
    equivalentRasterTieCount: tieClassifier.equivalentTieCount(),
    localNeighborOptimal: containment.localNeighborOptimal,
    equivalenceComponentComplete: containment.equivalenceComponentComplete,
    equivalenceComponentMembersVisited: containment.equivalenceComponentMembersVisited,
    localFinalCellContainmentComplete:
      coarseTieClassification.complete &&
      exactTieClassification.complete &&
      containment.localNeighborOptimal &&
      containment.equivalenceComponentComplete,
    budgetReason,
    ambiguousBest: tieClassifier.ambiguous(),
  });
}
