import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import {
  buildStudTextureField,
  fitStudLattice,
  foldUnitCell,
  foldedStudShape,
  latticeSiteResiduals,
  type PixelBoxPx,
} from "@lego-studio/rendering";

import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  commitRealBuildPrefix50Step44PanelCrop,
  commitRealBuildPrefix50Step44SourcePageRaster,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_X,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_Y,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_WIDTH,
  verifyRealBuildPrefix50Step44RepositoryPage45ExactSourceControl,
  verifyRealBuildPrefix50Step44MutableSourceBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-source-commitments.ts";
import {
  deriveRealBuildPrefix50Step44YellowChildMask,
  type RealBuildPrefix50Step44YellowChildMaskEvidence,
} from "./real-build-prefix50-subbuild-return-review-camera-source-mask.ts";
import { rerenderRealBuildPrefix50Step44PdfPage } from "./real-build-prefix50-subbuild-return-review-pdf.ts";
import type { RealBuildPrefix50Step44LaterSourceReadCapability } from "./real-build-prefix50-step44-later-source-authority.ts";
import {
  createRealBuildPrefix50Step44SyntheticPanelFacePrefixEvidenceForTest,
  deriveRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  requireRealBuildPrefix50Step44PanelFacePrefixEvidenceForSource,
  type RealBuildPrefix50Step44PanelFacePrefixEvidence,
} from "./real-build-prefix50-step44-panel-face-prefix.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS,
  type RealBuildPrefix50Step44TypedLatticeFit,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";

export const REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX =
  REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX;
export {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS,
  type RealBuildPrefix50Step44CameraLatticeThresholds,
  type RealBuildPrefix50Step44TypedLatticeFit,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
const sourceBrands = new WeakSet<object>();

export interface RealBuildPrefix50Step44ParentOnlyRegion extends RealBuildPrefix50Step44YellowChildMaskEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-step44-parent-only-region/2";
  readonly annotationExclusionBounds: PixelBoxPx;
  readonly eligiblePixelCount: number;
  readonly parentOnlyForegroundPixelCount: number;
  readonly eligibleMaskDigest: `sha256:${string}`;
  readonly parentOnlyForegroundMaskDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BrandedPage45Source {
  readonly sourcePdfArtifactPath: "recipes/6651557.pdf" | "synthetic-test-source.pdf";
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly rendererVersion: string;
  readonly sourcePagePngDigest: `sha256:${string}`;
  readonly sourcePagePixelDigest: `sha256:${string}`;
  readonly sourcePageRasterCommitment: `sha256:${string}`;
  readonly panelFacePrefixEvidence: RealBuildPrefix50Step44PanelFacePrefixEvidence;
  readonly panelFacePrefixEvidenceCommitment: `sha256:${string}`;
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly panelPixelDigest: `sha256:${string}`;
  readonly panelCropCommitment: `sha256:${string}`;
  readonly parentOnlyRegion: RealBuildPrefix50Step44ParentOnlyRegion;
  readonly latticeFit: RealBuildPrefix50Step44TypedLatticeFit;
  readonly rgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly parentOnlyForegroundMask: Uint8Array;
  readonly highlightedChildExclusionMask: Uint8Array;
  readonly highlightMask: Uint8Array;
  readonly filledHighlightMask: Uint8Array;
}

function foregroundMask(rgba: Uint8Array): Uint8Array {
  const red = (REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX >> 16) & 0xff;
  const green = (REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX >> 8) & 0xff;
  const blue = REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX & 0xff;
  const mask = new Uint8Array(rgba.length / 4);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    if (
      rgba[offset + 3] !== 0 &&
      Math.max(
        Math.abs(rgba[offset]! - red),
        Math.abs(rgba[offset + 1]! - green),
        Math.abs(rgba[offset + 2]! - blue),
      ) > 10
    )
      mask[index] = 1;
  }
  return mask;
}

export function deriveRealBuildPrefix50Step44ParentOnlyRegion(rgba: Uint8Array) {
  const yellowChild = deriveRealBuildPrefix50Step44YellowChildMask(rgba);
  const annotationExclusionBounds = {
    minXPx: 0,
    minYPx: 0,
    maxXPx: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH - 1,
    maxYPx: Math.max(0, yellowChild.evidence.highlightBounds.minYPx - 1),
  };
  const eligibleMask = new Uint8Array(yellowChild.highlightMask.length);
  const panelForeground = foregroundMask(rgba);
  const parentOnlyForegroundMask = new Uint8Array(yellowChild.highlightMask.length);
  let eligiblePixelCount = 0;
  let parentOnlyForegroundPixelCount = 0;
  for (let index = 0; index < eligibleMask.length; index += 1) {
    const y = Math.floor(index / REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH);
    if (
      y <= annotationExclusionBounds.maxYPx ||
      yellowChild.highlightedChildExclusionMask[index] === 1
    )
      continue;
    eligibleMask[index] = 1;
    eligiblePixelCount += 1;
    if (panelForeground[index] === 1) {
      parentOnlyForegroundMask[index] = 1;
      parentOnlyForegroundPixelCount += 1;
    }
  }
  if (parentOnlyForegroundPixelCount < 5_000)
    throw new TypeError(
      "Step-44 page-45 parent-only region retained too little shared-parent evidence.",
    );
  const regionBody = {
    schemaVersion: "lego.real-build-prefix50-step44-parent-only-region/2" as const,
    ...yellowChild.evidence,
    annotationExclusionBounds,
    eligiblePixelCount,
    parentOnlyForegroundPixelCount,
    eligibleMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(eligibleMask),
    parentOnlyForegroundMaskDigest:
      sha256RealBuildPrefix50Step44ReviewBytes(parentOnlyForegroundMask),
  };
  return {
    highlightMask: yellowChild.highlightMask,
    filledHighlightMask: yellowChild.filledHighlightMask,
    eligibleMask,
    parentOnlyForegroundMask,
    highlightedChildExclusionMask: yellowChild.highlightedChildExclusionMask,
    evidence: deepFreeze({ ...regionBody, commitment: canonicalDigest(regionBody) }),
  };
}

function deriveLatticeFit(rgba: Uint8Array): RealBuildPrefix50Step44TypedLatticeFit {
  const thresholds = REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS;
  const field = buildStudTextureField(
    rgba,
    REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
    REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
    {
      backgroundHex: REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX,
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
      `Step-44 page-45 lattice fit/control thresholds failed: ${fit.failure ?? "insufficient coherence or phase control"}.`,
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

function brandSource(input: {
  sourcePdfArtifactPath: "recipes/6651557.pdf" | "synthetic-test-source.pdf";
  sourcePdfDigest: `sha256:${string}`;
  rendererVersion: string;
  sourcePagePngDigest: `sha256:${string}`;
  sourcePagePixelDigest: `sha256:${string}`;
  panelFacePrefixEvidence: RealBuildPrefix50Step44PanelFacePrefixEvidence;
  rgba: Uint8Array;
  latticeFit?: RealBuildPrefix50Step44TypedLatticeFit;
}): RealBuildPrefix50Step44BrandedPage45Source {
  const panelFacePrefixEvidence = requireRealBuildPrefix50Step44PanelFacePrefixEvidenceForSource({
    sourcePdfArtifactPath: input.sourcePdfArtifactPath,
    sourcePdfDigest: input.sourcePdfDigest,
    evidence: input.panelFacePrefixEvidence,
  });
  const rgba = new Uint8Array(input.rgba);
  if (
    rgba.byteLength !==
    REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH * REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT * 4
  )
    throw new RangeError("Step-44 page-45 source crop must be exactly 720x470 RGBA.");
  const parentOnly = deriveRealBuildPrefix50Step44ParentOnlyRegion(rgba);
  const sourcePageRasterCommitment = commitRealBuildPrefix50Step44SourcePageRaster({
    rendererVersion: input.rendererVersion,
    sourcePagePngDigest: input.sourcePagePngDigest,
    sourcePagePixelDigest: input.sourcePagePixelDigest,
    panelFacePrefixEvidenceCommitment: panelFacePrefixEvidence.commitment,
    expectedPanelFace: panelFacePrefixEvidence.expectedPanelFace,
  });
  const panelPixelDigest = sha256RealBuildPrefix50Step44ReviewBytes(rgba);
  const panelCropCommitment = commitRealBuildPrefix50Step44PanelCrop({
    sourcePageRasterCommitment,
    panelPixelDigest,
    parentOnlyRegionCommitment: parentOnly.evidence.commitment,
    panelFacePrefixEvidenceCommitment: panelFacePrefixEvidence.commitment,
    expectedPanelFace: panelFacePrefixEvidence.expectedPanelFace,
  });
  const source: RealBuildPrefix50Step44BrandedPage45Source = {
    ...input,
    sourcePageRasterCommitment,
    panelFacePrefixEvidence,
    panelFacePrefixEvidenceCommitment: panelFacePrefixEvidence.commitment,
    expectedPanelFace: panelFacePrefixEvidence.expectedPanelFace,
    panelPixelDigest,
    panelCropCommitment,
    parentOnlyRegion: parentOnly.evidence,
    latticeFit: input.latticeFit ?? deriveLatticeFit(rgba),
    rgba,
    eligibleMask: parentOnly.eligibleMask,
    parentOnlyForegroundMask: parentOnly.parentOnlyForegroundMask,
    highlightedChildExclusionMask: parentOnly.highlightedChildExclusionMask,
    highlightMask: parentOnly.highlightMask,
    filledHighlightMask: parentOnly.filledHighlightMask,
  };
  if (input.sourcePdfArtifactPath === REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH)
    verifyRealBuildPrefix50Step44RepositoryPage45ExactSourceControl(source);
  sourceBrands.add(source);
  return Object.freeze(source);
}

export async function loadRealBuildPrefix50Step44RepositoryPage45CameraSource(
  input: Readonly<{
    panelFaceCapability: RealBuildPrefix50Step44LaterSourceReadCapability;
    rasterCapability: RealBuildPrefix50Step44LaterSourceReadCapability;
  }>,
): Promise<RealBuildPrefix50Step44BrandedPage45Source> {
  const panelFacePrefixEvidence =
    await deriveRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(input.panelFaceCapability);
  const page = await rerenderRealBuildPrefix50Step44PdfPage({
    capability: input.rasterCapability,
    purpose: "page45-camera-raster",
    densityDpi: 180,
    retainDecodedBytes: true,
  });
  if (
    page.width !== REAL_BUILD_PREFIX50_STEP44_PAGE45_WIDTH ||
    page.height !== REAL_BUILD_PREFIX50_STEP44_PAGE45_HEIGHT ||
    page.rgba === undefined
  )
    throw new TypeError("Step-44 camera source must rerender as exact 1914x1361 page-45 pixels.");
  const rgba = new Uint8Array(
    REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH *
      REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT *
      4,
  );
  for (let row = 0; row < REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT; row += 1) {
    const start =
      ((REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_Y + row) * page.width +
        REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_X) *
      4;
    rgba.set(
      page.rgba.subarray(start, start + REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH * 4),
      row * REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH * 4,
    );
  }
  return brandSource({
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    rendererVersion: page.rendererVersion,
    sourcePagePngDigest: page.pngDigest,
    sourcePagePixelDigest: page.pixelDigest,
    panelFacePrefixEvidence,
    rgba,
  });
}

export function requireRealBuildPrefix50Step44BrandedPage45CameraSource(
  value: RealBuildPrefix50Step44BrandedPage45Source,
): RealBuildPrefix50Step44BrandedPage45Source {
  if (!sourceBrands.has(value))
    throw new TypeError("Step-44 camera source must retain exact runtime PDF/raster identity.");
  requireRealBuildPrefix50Step44PanelFacePrefixEvidenceForSource({
    sourcePdfArtifactPath: value.sourcePdfArtifactPath,
    sourcePdfDigest: value.sourcePdfDigest,
    evidence: value.panelFacePrefixEvidence,
  });
  if (
    value.panelFacePrefixEvidenceCommitment !== value.panelFacePrefixEvidence.commitment ||
    value.expectedPanelFace !== value.panelFacePrefixEvidence.expectedPanelFace
  )
    throw new TypeError("Step-44 camera source panel-face binding drifted after branding.");
  verifyRealBuildPrefix50Step44MutableSourceBinding({
    ...value,
    parentOnlyRegionCommitment: value.parentOnlyRegion.commitment,
  });
  return value;
}

export function createRealBuildPrefix50Step44SyntheticPage45CameraSourceForTest(
  rgba: Uint8Array,
  panelFaceRows?: ReadonlyArray<{
    readonly stepNumber: number;
    readonly pageNumber: number;
    readonly rotationIconPresent: boolean;
  }>,
): RealBuildPrefix50Step44BrandedPage45Source {
  if (process.env.NODE_ENV !== "test")
    throw new TypeError("Synthetic Step-44 camera sources are available only to tests.");
  const sourcePdfDigest = sha256RealBuildPrefix50Step44ReviewBytes(rgba);
  return brandSource({
    sourcePdfArtifactPath: "synthetic-test-source.pdf",
    sourcePdfDigest,
    rendererVersion: "synthetic-test-renderer",
    sourcePagePngDigest: sha256RealBuildPrefix50Step44ReviewBytes(rgba),
    sourcePagePixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(rgba),
    panelFacePrefixEvidence: createRealBuildPrefix50Step44SyntheticPanelFacePrefixEvidenceForTest(
      sourcePdfDigest,
      panelFaceRows,
    ),
    rgba,
  });
}

export function createRealBuildPrefix50Step44SyntheticPage45CameraSourceWithLatticeForTest(
  rgba: Uint8Array,
  latticeSource: RealBuildPrefix50Step44BrandedPage45Source,
): RealBuildPrefix50Step44BrandedPage45Source {
  if (process.env.NODE_ENV !== "test" || !sourceBrands.has(latticeSource))
    throw new TypeError(
      "Synthetic Step-44 camera lattice controls require an exact branded test source.",
    );
  const sourcePdfDigest = sha256RealBuildPrefix50Step44ReviewBytes(rgba);
  return brandSource({
    sourcePdfArtifactPath: "synthetic-test-source.pdf",
    sourcePdfDigest,
    rendererVersion: "synthetic-test-renderer-with-branded-lattice",
    sourcePagePngDigest: sha256RealBuildPrefix50Step44ReviewBytes(rgba),
    sourcePagePixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(rgba),
    panelFacePrefixEvidence:
      createRealBuildPrefix50Step44SyntheticPanelFacePrefixEvidenceForTest(sourcePdfDigest),
    rgba,
    latticeFit: latticeSource.latticeFit,
  });
}
