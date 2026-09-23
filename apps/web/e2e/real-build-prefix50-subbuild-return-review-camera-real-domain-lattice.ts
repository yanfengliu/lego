import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";
import {
  buildStudTextureField,
  fitStudLattice,
  foldUnitCell,
  foldedStudShape,
  latticeSiteResiduals,
  type LatticeCandidate,
  type StudTextureField,
} from "@lego-studio/rendering";

import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS,
  type RealBuildPrefix50Step44TypedLatticeFit,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";

const WIDTH = 720;
const HEIGHT = 470;
const BACKGROUND = [0x89, 0x90, 0x93] as const;

export interface SharedOrientationAnchor {
  readonly schemaVersion: "lego.real-build-prefix50-page44-shared-orientation-anchor/1";
  readonly authority:
    | "pooled-steps41-42-source-only-lattice-field"
    | "step42-printable-candidate-with-step41-direction-corroboration";
  readonly calibrationPanelSteps: readonly [41, 42];
  readonly pageCeiling: 44;
  readonly sourceFieldCommitments: readonly [Sha256Digest, Sha256Digest];
  readonly pooledFieldCommitment: Sha256Digest;
  readonly selectedPanelStep: 41 | 42 | null;
  readonly corroboratingPanelStep: 41 | 42 | null;
  readonly corroboration: {
    readonly maximumAzimuthDifferenceDegrees: number;
    readonly maximumElevationDifferenceDegrees: number;
    readonly observedAzimuthDifferenceDegrees: number;
    readonly observedElevationDifferenceDegrees: number;
    readonly samePhysicalHand: true;
    readonly combinedArtPixels: number;
    readonly combinedSupportSites: number;
  } | null;
  readonly pooledCounterevidenceFailure: string | null;
  readonly latticeFit: RealBuildPrefix50Step44TypedLatticeFit;
  readonly latticeFitCommitment: Sha256Digest;
  readonly qualified: true;
  readonly thresholdsChanged: false;
  readonly commitment: Sha256Digest;
}

export interface SharedOrientationAnchorRefusalTelemetry {
  readonly schemaVersion: "lego.real-build-prefix50-page44-orientation-anchor-refusal/1";
  readonly pooledQualified: false;
  readonly pooledFailure: string;
  readonly step42CandidateCount: number;
  readonly step42SolutionCandidateCount: number;
  readonly qualifiedPairCount: number;
  readonly rejections: Readonly<{
    noSolution: number;
    residual: number;
    oppositePhysicalHand: number;
    azimuth: number;
    elevation: number;
  }>;
  readonly accountingComplete: true;
}

export class SharedOrientationAnchorRefusal extends TypeError {
  public readonly telemetry: SharedOrientationAnchorRefusalTelemetry;

  public constructor(message: string, telemetry: SharedOrientationAnchorRefusalTelemetry) {
    super(message);
    this.name = "SharedOrientationAnchorRefusal";
    this.telemetry = deepFreeze(telemetry);
  }
}

function buildField(rgba: Uint8Array): StudTextureField {
  return buildStudTextureField(rgba, WIDTH, HEIGHT, {
    backgroundHex: REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
    backgroundTolerance: 10,
    highPassRadiusPx: 14,
    maxSamples: 18_000,
  });
}

function diagnosticFromField(field: StudTextureField): {
  readonly latticeFit: RealBuildPrefix50Step44TypedLatticeFit;
  readonly qualified: boolean;
  readonly failure: string | null;
} {
  const thresholds = REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS;
  const fit = fitStudLattice(field, {
    minOffsetPx: 8,
    maxOffsetPx: 100,
    maxResidualFraction: thresholds.maximumResidualFraction,
  });
  const fold = fit.basis === null ? null : foldUnitCell(field, fit.basis, 32);
  const phase = fold === null ? null : foldedStudShape(fold);
  const residuals =
    fit.basis === null || phase === null ? null : latticeSiteResiduals(field, fit.basis, phase);
  if (
    fit.basis === null ||
    fit.solution === null ||
    phase === null ||
    residuals === null ||
    field.bounds === null
  )
    throw new TypeError(
      `Real-domain source has no bounded diagnostic camera seed: ${fit.failure ?? "missing basis, phase, or residual controls"}.`,
    );
  const residualFraction = fit.solution.residualPx / fit.solution.pixelsPerUnit;
  const qualified =
    field.artArea >= thresholds.minimumArtPixels &&
    fit.peaks.length >= thresholds.minimumPeakCount &&
    fit.candidates.length >= thresholds.minimumCandidateCount &&
    fit.coherence >= thresholds.minimumCoherence &&
    residualFraction <= thresholds.maximumResidualFraction &&
    residuals.sites >= thresholds.minimumResidualSites &&
    residuals.hitRate >= thresholds.minimumResidualHitRate &&
    residuals.inkOverAntiPhase >= thresholds.minimumInkOverAntiPhase;
  const latticeFit = deepFreeze({
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
        ({ rejectedBecause }) => rejectedBecause === null,
      ).length,
    },
    thresholds,
  });
  return {
    latticeFit,
    qualified,
    failure: qualified
      ? null
      : (fit.failure ?? "frozen lattice coherence, residual, site, or phase control failed"),
  };
}

export function deriveRealBuildPrefix50Step44RealDomainLatticeDiagnostic(
  rgba: Uint8Array,
): ReturnType<typeof diagnosticFromField> {
  return diagnosticFromField(buildField(rgba));
}

function fieldCommitment(field: StudTextureField): Sha256Digest {
  const bytes = (view: ArrayBufferView) =>
    new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  return canonicalDigest({
    width: field.width,
    height: field.height,
    textureDigest: sha256RealBuildPrefix50Step44ReviewBytes(bytes(field.texture)),
    maskDigest: sha256RealBuildPrefix50Step44ReviewBytes(field.mask),
    sampleXDigest: sha256RealBuildPrefix50Step44ReviewBytes(bytes(field.sampleX)),
    sampleYDigest: sha256RealBuildPrefix50Step44ReviewBytes(bytes(field.sampleY)),
    sampleCount: field.sampleX.length,
    artArea: field.artArea,
    bounds: field.bounds,
  });
}

function pooledField(first: StudTextureField, second: StudTextureField): StudTextureField {
  const gap = 201;
  const secondOffsetY = HEIGHT + gap;
  const pooledHeight = HEIGHT * 2 + gap;
  const texture = new Float32Array(WIDTH * pooledHeight);
  const mask = new Uint8Array(WIDTH * pooledHeight);
  for (let y = 0; y < HEIGHT; y += 1) {
    texture.set(first.texture.subarray(y * WIDTH, (y + 1) * WIDTH), y * WIDTH);
    mask.set(first.mask.subarray(y * WIDTH, (y + 1) * WIDTH), y * WIDTH);
    texture.set(second.texture.subarray(y * WIDTH, (y + 1) * WIDTH), (y + secondOffsetY) * WIDTH);
    mask.set(second.mask.subarray(y * WIDTH, (y + 1) * WIDTH), (y + secondOffsetY) * WIDTH);
  }
  const samplesPerPanel = Math.min(first.sampleX.length, second.sampleX.length);
  const sampleX = new Int32Array(samplesPerPanel * 2);
  const sampleY = new Int32Array(samplesPerPanel * 2);
  for (let index = 0; index < samplesPerPanel; index += 1) {
    const firstIndex = Math.floor((index * first.sampleX.length) / samplesPerPanel);
    const secondIndex = Math.floor((index * second.sampleX.length) / samplesPerPanel);
    sampleX[index] = first.sampleX[firstIndex]!;
    sampleY[index] = first.sampleY[firstIndex]!;
    sampleX[samplesPerPanel + index] = second.sampleX[secondIndex]!;
    sampleY[samplesPerPanel + index] = second.sampleY[secondIndex]! + secondOffsetY;
  }
  if (first.bounds === null || second.bounds === null)
    throw new TypeError("Pooled page-44 orientation anchor requires bounded Steps 41 and 42 art.");
  return {
    width: WIDTH,
    height: pooledHeight,
    texture,
    mask,
    sampleX,
    sampleY,
    artArea: first.artArea + second.artArea,
    bounds: {
      minXPx: Math.min(first.bounds.minXPx, second.bounds.minXPx),
      minYPx: first.bounds.minYPx,
      maxXPx: Math.max(first.bounds.maxXPx, second.bounds.maxXPx),
      maxYPx: second.bounds.maxYPx + secondOffsetY,
    },
  };
}

function candidateFit(
  field: StudTextureField,
  candidate: LatticeCandidate,
  fit: ReturnType<typeof fitStudLattice>,
): RealBuildPrefix50Step44TypedLatticeFit | null {
  if (candidate.solution === null) return null;
  const fold = foldUnitCell(field, candidate.basis, 32);
  if (fold === null) return null;
  const phase = foldedStudShape(fold);
  if (phase === null) return null;
  const residuals = latticeSiteResiduals(field, candidate.basis, phase);
  if (residuals === null || field.bounds === null) return null;
  return deepFreeze({
    basis: candidate.basis,
    solution: candidate.solution,
    coherence: candidate.coherence,
    residualFraction: candidate.solution.residualPx / candidate.solution.pixelsPerUnit,
    phase,
    residuals,
    control: {
      artPixels: field.artArea,
      artBounds: field.bounds,
      peakCount: fit.peaks.length,
      candidateCount: fit.candidates.length,
      explainedCandidateCount: fit.candidates.filter(
        ({ rejectedBecause }) => rejectedBecause === null,
      ).length,
    },
    thresholds: REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS,
  });
}

function latticeHand(basis: LatticeCandidate["basis"]): -1 | 1 {
  const determinant = basis.a.xPx * basis.b.yPx - basis.a.yPx * basis.b.xPx;
  if (!Number.isFinite(determinant) || determinant === 0)
    throw new TypeError("Source-only orientation basis has no finite physical hand.");
  return determinant < 0 ? -1 : 1;
}

function azimuthDifference(left: number, right: number): number {
  const normalized = Math.abs((((left - right) % 90) + 90) % 90);
  return Math.min(normalized, 90 - normalized);
}

function orientationUncertainty(solution: {
  readonly elevationDegrees: number;
  readonly residualPx: number;
  readonly pixelsPerUnit: number;
}): { readonly azimuthDegrees: number; readonly elevationDegrees: number } {
  const degrees = 180 / Math.PI;
  const fraction = Math.min(1, (2 * solution.residualPx) / solution.pixelsPerUnit);
  const azimuthDegrees = Math.asin(fraction) * degrees;
  const sine = Math.sin(solution.elevationDegrees / degrees);
  const lower = Math.asin(Math.max(-1, sine - fraction)) * degrees;
  const upper = Math.asin(Math.min(1, sine + fraction)) * degrees;
  return {
    azimuthDegrees,
    elevationDegrees: Math.max(
      Math.abs(solution.elevationDegrees - lower),
      Math.abs(upper - solution.elevationDegrees),
    ),
  };
}

export function deriveRealBuildPrefix50Step44SharedOrientationAnchor(
  inputs: readonly [Uint8Array, Uint8Array],
): SharedOrientationAnchor {
  const fields = inputs.map(buildField) as [StudTextureField, StudTextureField];
  const options = {
    minOffsetPx: 8,
    maxOffsetPx: 100,
    maxResidualFraction:
      REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS.maximumResidualFraction,
  } as const;
  const pooled = pooledField(fields[0], fields[1]);
  let pooledDiagnostic: ReturnType<typeof diagnosticFromField> | null = null;
  let pooledFailure: string | null = null;
  try {
    pooledDiagnostic = diagnosticFromField(pooled);
    if (!pooledDiagnostic.qualified) pooledFailure = pooledDiagnostic.failure;
  } catch (error) {
    pooledFailure = error instanceof Error ? error.message : String(error);
  }
  let authority: SharedOrientationAnchor["authority"] =
    "pooled-steps41-42-source-only-lattice-field";
  let latticeFit = pooledDiagnostic?.qualified === true ? pooledDiagnostic.latticeFit : null;
  let selectedPanelStep: 41 | 42 | null = null;
  let corroboratingPanelStep: 41 | 42 | null = null;
  let corroboration: SharedOrientationAnchor["corroboration"] = null;
  let refusalTelemetry: SharedOrientationAnchorRefusalTelemetry | null = null;
  if (latticeFit === null) {
    authority = "step42-printable-candidate-with-step41-direction-corroboration";
    const step41 = diagnosticFromField(fields[0]);
    const step42Fit = fitStudLattice(fields[1], options);
    const rejections = {
      noSolution: 0,
      residual: 0,
      oppositePhysicalHand: 0,
      azimuth: 0,
      elevation: 0,
    };
    const candidates = step42Fit.candidates
      .filter((candidate) => {
        if (candidate.solution === null) {
          rejections.noSolution += 1;
          return false;
        }
        const selectedUncertainty = orientationUncertainty(candidate.solution);
        const corroboratingUncertainty = orientationUncertainty(step41.latticeFit.solution);
        if (
          candidate.solution.residualPx / candidate.solution.pixelsPerUnit >
          options.maxResidualFraction
        ) {
          rejections.residual += 1;
          return false;
        }
        if (latticeHand(candidate.basis) !== latticeHand(step41.latticeFit.basis)) {
          rejections.oppositePhysicalHand += 1;
          return false;
        }
        if (
          azimuthDifference(
            candidate.solution.azimuthDegrees,
            step41.latticeFit.solution.azimuthDegrees,
          ) >
          selectedUncertainty.azimuthDegrees + corroboratingUncertainty.azimuthDegrees
        ) {
          rejections.azimuth += 1;
          return false;
        }
        if (
          Math.abs(
            candidate.solution.elevationDegrees - step41.latticeFit.solution.elevationDegrees,
          ) >
          selectedUncertainty.elevationDegrees + corroboratingUncertainty.elevationDegrees
        ) {
          rejections.elevation += 1;
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        if (left.explainsStrongestPeak !== right.explainsStrongestPeak)
          return left.explainsStrongestPeak ? -1 : 1;
        if (right.explainedPeaks !== left.explainedPeaks)
          return right.explainedPeaks - left.explainedPeaks;
        if (right.coherence !== left.coherence) return right.coherence - left.coherence;
        return (
          left.solution!.residualPx / left.solution!.pixelsPerUnit -
          right.solution!.residualPx / right.solution!.pixelsPerUnit
        );
      });
    refusalTelemetry = deepFreeze({
      schemaVersion: "lego.real-build-prefix50-page44-orientation-anchor-refusal/1" as const,
      pooledQualified: false as const,
      pooledFailure: pooledFailure ?? "unqualified",
      step42CandidateCount: step42Fit.candidates.length,
      step42SolutionCandidateCount: step42Fit.candidates.filter(({ solution }) => solution !== null)
        .length,
      qualifiedPairCount: candidates.length,
      rejections,
      accountingComplete: true as const,
    });
    const selected = candidates[0];
    latticeFit = selected === undefined ? null : candidateFit(fields[1], selected, step42Fit);
    if (selected !== undefined && selected.solution !== null && latticeFit !== null) {
      const selectedUncertainty = orientationUncertainty(selected.solution);
      const corroboratingUncertainty = orientationUncertainty(step41.latticeFit.solution);
      const samePhysicalHand = latticeHand(selected.basis) === latticeHand(step41.latticeFit.basis);
      const combinedArtPixels = fields[0].artArea + fields[1].artArea;
      const combinedSupportSites = step41.latticeFit.residuals.sites + latticeFit.residuals.sites;
      if (
        !samePhysicalHand ||
        combinedArtPixels < REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS.minimumArtPixels ||
        combinedSupportSites <
          REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS.minimumResidualSites
      )
        latticeFit = null;
      else {
        selectedPanelStep = 42;
        corroboratingPanelStep = 41;
        corroboration = {
          maximumAzimuthDifferenceDegrees:
            selectedUncertainty.azimuthDegrees + corroboratingUncertainty.azimuthDegrees,
          maximumElevationDifferenceDegrees:
            selectedUncertainty.elevationDegrees + corroboratingUncertainty.elevationDegrees,
          observedAzimuthDifferenceDegrees: azimuthDifference(
            selected.solution.azimuthDegrees,
            step41.latticeFit.solution.azimuthDegrees,
          ),
          observedElevationDifferenceDegrees: Math.abs(
            selected.solution.elevationDegrees - step41.latticeFit.solution.elevationDegrees,
          ),
          samePhysicalHand,
          combinedArtPixels,
          combinedSupportSites,
        };
      }
    }
  }
  if (latticeFit === null) {
    if (refusalTelemetry === null)
      throw new TypeError("Orientation-anchor refusal lost its structured rejection accounting.");
    throw new SharedOrientationAnchorRefusal(
      `Steps-41/42 source-only orientation anchor failed pooled and frozen direction-corroboration rules: pooled=${pooledFailure ?? "unqualified"}.`,
      refusalTelemetry,
    );
  }
  const body = {
    schemaVersion: "lego.real-build-prefix50-page44-shared-orientation-anchor/1" as const,
    authority,
    calibrationPanelSteps: [41, 42] as const,
    pageCeiling: 44 as const,
    sourceFieldCommitments: [fieldCommitment(fields[0]), fieldCommitment(fields[1])] as const,
    pooledFieldCommitment: fieldCommitment(pooled),
    selectedPanelStep,
    corroboratingPanelStep,
    corroboration,
    pooledCounterevidenceFailure: pooledFailure,
    latticeFit,
    latticeFitCommitment: canonicalDigest(latticeFit),
    qualified: true as const,
    thresholdsChanged: false as const,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function realBuildPrefix50Step44LatticeInputRgba(
  rgba: Uint8Array,
  eligibleMask: Uint8Array,
): Uint8Array {
  const latticeRgba = new Uint8Array(rgba);
  for (let index = 0; index < eligibleMask.length; index += 1) {
    if (eligibleMask[index] === 1) continue;
    const offset = index * 4;
    latticeRgba[offset] = BACKGROUND[0];
    latticeRgba[offset + 1] = BACKGROUND[1];
    latticeRgba[offset + 2] = BACKGROUND[2];
    latticeRgba[offset + 3] = 0xff;
  }
  return latticeRgba;
}
