import { deepFreeze } from "@lego-studio/brick-kernel";
import {
  buildStudTextureField,
  fitStudLattice,
  foldUnitCell,
  foldedStudShape,
  latticeSiteResiduals,
} from "@lego-studio/rendering";

import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
  type RealBuildPrefix50Step44TypedLatticeFit,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";

export function independentlyDeriveRealBuildPrefix50Step44LatticeFit(
  rgba: Uint8Array,
): RealBuildPrefix50Step44TypedLatticeFit {
  const thresholds = REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS;
  const field = buildStudTextureField(
    rgba,
    REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
    REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
    {
      backgroundHex: REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
      backgroundTolerance: 10,
      highPassRadiusPx: 14,
      maxSamples: 18_000,
    },
  );
  const fit = fitStudLattice(field, {
    minOffsetPx: 8,
    maxOffsetPx: 100,
    maxResidualFraction: thresholds.maximumResidualFraction,
  });
  const fold = fit.basis === null ? null : foldUnitCell(field, fit.basis, 32);
  const phase = fold === null ? null : foldedStudShape(fold);
  const residuals =
    fit.basis === null || phase === null ? null : latticeSiteResiduals(field, fit.basis, phase);
  const residualFraction =
    fit.solution === null
      ? Number.POSITIVE_INFINITY
      : fit.solution.residualPx / fit.solution.pixelsPerUnit;
  if (
    fit.basis === null ||
    fit.solution === null ||
    phase === null ||
    residuals === null ||
    field.bounds === null ||
    field.artArea < thresholds.minimumArtPixels ||
    fit.peaks.length < thresholds.minimumPeakCount ||
    fit.candidates.length < thresholds.minimumCandidateCount ||
    fit.coherence < thresholds.minimumCoherence ||
    residualFraction > thresholds.maximumResidualFraction ||
    residuals.sites < thresholds.minimumResidualSites ||
    residuals.hitRate < thresholds.minimumResidualHitRate ||
    residuals.inkOverAntiPhase < thresholds.minimumInkOverAntiPhase
  )
    throw new TypeError(
      `Persisted Step-44 page-45 lattice fit/control thresholds failed: ${fit.failure ?? "insufficient coherence or phase control"}.`,
    );
  return deepFreeze({
    basis: fit.basis,
    solution: fit.solution,
    coherence: fit.coherence,
    residualFraction,
    phase,
    residuals,
    control: {
      artPixels: field.artArea,
      artBounds: field.bounds,
      peakCount: fit.peaks.length,
      candidateCount: fit.candidates.length,
      explainedCandidateCount: fit.candidates.filter(
        (candidate) => candidate.rejectedBecause === null,
      ).length,
    },
    thresholds,
  });
}
