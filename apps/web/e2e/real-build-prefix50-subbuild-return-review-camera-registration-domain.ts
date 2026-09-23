import type {
  RealBuildPrefix50EligibleMaskSearchOptions,
  RealBuildPrefix50CoarseScaleTranslationDomain,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";
import {
  boundedSearchGrid,
  boundedSearchGridValueCount,
  boundedSearchInterval,
  quantizedSearchValue,
  type RealBuildPrefix50MaskMoments,
  type RealBuildPrefix50SimilaritySearchCoordinate,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-primitives.ts";

interface PlannedCoarseScaleTranslationDomain extends RealBuildPrefix50CoarseScaleTranslationDomain {
  readonly xGrid: readonly number[];
  readonly yGrid: readonly number[];
}

export interface RealBuildPrefix50CompleteCoarseDomainPlan {
  readonly domains: readonly PlannedCoarseScaleTranslationDomain[];
  readonly publicDomains: readonly RealBuildPrefix50CoarseScaleTranslationDomain[];
  readonly expectedCandidates: number;
  readonly contains: (coordinate: RealBuildPrefix50SimilaritySearchCoordinate) => boolean;
  readonly boundaryFor: (coordinate: RealBuildPrefix50SimilaritySearchCoordinate) => {
    readonly centerBoundaryHit: boolean;
    readonly scaleBoundaryHit: boolean;
  };
}

interface TranslationBounds {
  readonly minimumOffsetXPx: number;
  readonly maximumOffsetXPx: number;
  readonly minimumOffsetYPx: number;
  readonly maximumOffsetYPx: number;
}

function translationBoundsFor(input: {
  readonly relativeScaleDelta: number;
  readonly width: number;
  readonly height: number;
  readonly source: RealBuildPrefix50MaskMoments;
  readonly target: RealBuildPrefix50MaskMoments;
}): TranslationBounds {
  const scale = 1 + input.relativeScaleDelta;
  const sourceMinimumX = scale * (input.source.minimumX - 0.5);
  const sourceMaximumX = scale * (input.source.maximumX + 0.5);
  const sourceMinimumY = scale * (input.source.minimumY - 0.5);
  const sourceMaximumY = scale * (input.source.maximumY + 0.5);
  return Object.freeze({
    minimumOffsetXPx: quantizedSearchValue(
      Math.max(-sourceMaximumX, input.target.minimumX - sourceMaximumX),
    ),
    maximumOffsetXPx: quantizedSearchValue(
      Math.min(input.width - 1 - sourceMinimumX, input.target.maximumX - sourceMinimumX),
    ),
    minimumOffsetYPx: quantizedSearchValue(
      Math.max(-sourceMaximumY, input.target.minimumY - sourceMaximumY),
    ),
    maximumOffsetYPx: quantizedSearchValue(
      Math.min(input.height - 1 - sourceMinimumY, input.target.maximumY - sourceMinimumY),
    ),
  });
}

export function planRealBuildPrefix50CompleteCoarseDomain(input: {
  readonly options: Required<RealBuildPrefix50EligibleMaskSearchOptions>;
  readonly maximumGridAxisValues: number;
  readonly width: number;
  readonly height: number;
  readonly source: RealBuildPrefix50MaskMoments;
  readonly target: RealBuildPrefix50MaskMoments;
}): RealBuildPrefix50CompleteCoarseDomainPlan {
  const scaleCount = boundedSearchGridValueCount(
    input.options.relativeScaleRadius,
    input.options.initialRelativeScaleStep,
    input.maximumGridAxisValues,
    "relative-scale",
  );
  const scaleGrid = boundedSearchGrid(
    input.options.relativeScaleRadius,
    input.options.initialRelativeScaleStep,
    scaleCount,
    "relative-scale",
  );
  const boundsFor = (relativeScaleDelta: number) =>
    translationBoundsFor({
      relativeScaleDelta,
      width: input.width,
      height: input.height,
      source: input.source,
      target: input.target,
    });
  const domains = scaleGrid.map((relativeScaleDelta) => {
    const scale = 1 + relativeScaleDelta;
    const bounds = boundsFor(relativeScaleDelta);
    const xGrid = boundedSearchInterval(
      bounds.minimumOffsetXPx,
      bounds.maximumOffsetXPx,
      input.options.coarseStridePx,
      input.maximumGridAxisValues,
      `translation-x at scale ${scale}`,
    );
    const yGrid = boundedSearchInterval(
      bounds.minimumOffsetYPx,
      bounds.maximumOffsetYPx,
      input.options.coarseStridePx,
      input.maximumGridAxisValues,
      `translation-y at scale ${scale}`,
    );
    return Object.freeze({
      relativeScaleDelta,
      scale,
      ...bounds,
      xCandidates: xGrid.length,
      yCandidates: yGrid.length,
      candidateCount: xGrid.length * yGrid.length,
      xGrid,
      yGrid,
    });
  });
  const expectedCandidates = domains.reduce((total, domain) => total + domain.candidateCount, 0);
  if (!Number.isSafeInteger(expectedCandidates))
    throw new RangeError("Complete coarse camera-domain candidate count must be a safe integer.");
  const publicDomains = Object.freeze(
    domains.map(({ xGrid, yGrid, ...domain }) => {
      void xGrid;
      void yGrid;
      return Object.freeze(domain);
    }),
  );
  const contains = (coordinate: RealBuildPrefix50SimilaritySearchCoordinate): boolean => {
    if (Math.abs(coordinate.relativeScaleDelta) > input.options.relativeScaleRadius + 1e-12)
      return false;
    const bounds = boundsFor(coordinate.relativeScaleDelta);
    return (
      coordinate.deltaX >= bounds.minimumOffsetXPx - 1e-9 &&
      coordinate.deltaX <= bounds.maximumOffsetXPx + 1e-9 &&
      coordinate.deltaY >= bounds.minimumOffsetYPx - 1e-9 &&
      coordinate.deltaY <= bounds.maximumOffsetYPx + 1e-9
    );
  };
  const boundaryFor = (coordinate: RealBuildPrefix50SimilaritySearchCoordinate) => {
    const bounds = boundsFor(coordinate.relativeScaleDelta);
    return Object.freeze({
      centerBoundaryHit:
        coordinate.deltaX <= bounds.minimumOffsetXPx + input.options.finalCenterCellPx ||
        coordinate.deltaX >= bounds.maximumOffsetXPx - input.options.finalCenterCellPx ||
        coordinate.deltaY <= bounds.minimumOffsetYPx + input.options.finalCenterCellPx ||
        coordinate.deltaY >= bounds.maximumOffsetYPx - input.options.finalCenterCellPx,
      scaleBoundaryHit:
        Math.abs(coordinate.relativeScaleDelta) >=
        input.options.relativeScaleRadius - input.options.finalRelativeScaleCell,
    });
  };
  return Object.freeze({ domains, publicDomains, expectedCandidates, contains, boundaryFor });
}
