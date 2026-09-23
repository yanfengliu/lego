import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  blueCyanFeatureMask,
  countExactMask,
  erodeDisk,
  fillExternalContours,
  foregroundMask,
  interiorHogDescriptor,
  interiorHogSimilarity,
  intersectMasks,
  tolerantFeatureAgreement,
  type RealBuildPrefix50Step44InteriorHogDescriptor,
  type RealBuildPrefix50Step44InteriorHogParameters,
} from "./real-build-prefix50-subbuild-return-review-camera-interior-primitives.ts";

const MAXIMUM_PIXELS = 1_000_000;

export interface RealBuildPrefix50Step44InteriorFeatureParameters {
  readonly backgroundHex: 0x899093;
  readonly backgroundTolerance: 10;
  readonly externalContourFillConnectivity: 8;
  readonly eligibleErosionRadiusPx: 3;
  readonly sourceSilhouetteErosionRadiusPx: 6;
  readonly blueCyanHsv: {
    readonly minimumSaturation: 0.2;
    readonly minimumValue: 0.12;
    readonly minimumHueDegrees: 175;
    readonly maximumHueDegreesExclusive: 265;
  };
  readonly tolerantMatchRadiusPx: 4;
  readonly hog: RealBuildPrefix50Step44InteriorHogParameters;
}

export const REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_PARAMETERS = deepFreeze({
  backgroundHex: 0x899093,
  backgroundTolerance: 10,
  externalContourFillConnectivity: 8,
  eligibleErosionRadiusPx: 3,
  sourceSilhouetteErosionRadiusPx: 6,
  blueCyanHsv: {
    minimumSaturation: 0.2,
    minimumValue: 0.12,
    minimumHueDegrees: 175,
    maximumHueDegreesExclusive: 265,
  },
  tolerantMatchRadiusPx: 4,
  hog: {
    columns: 12,
    rows: 8,
    orientationBins: 9,
    maximumMagnitude: 255,
    minimumCellSupportPixels: 64,
    luma: { red: 0.2126, green: 0.7152, blue: 0.0722 },
  },
} satisfies RealBuildPrefix50Step44InteriorFeatureParameters);

export interface RealBuildPrefix50Step44InteriorFeatureSourceEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-step44-interior-feature-source/1";
  readonly authority: "none";
  readonly intendedUse: "diagnostic-and-refusal-evidence-only";
  readonly selectionAuthority: false;
  readonly tieBreakAuthority: false;
  readonly supportDependency: "source-rgba-and-exact-eligible-mask-only";
  readonly width: number;
  readonly height: number;
  readonly sourcePixelDigest: Sha256Digest;
  readonly eligibleMaskDigest: Sha256Digest;
  readonly sourceForegroundMaskDigest: Sha256Digest;
  readonly supportMaskDigest: Sha256Digest;
  readonly sourceBlueCyanFeatureMaskDigest: Sha256Digest;
  readonly eligiblePixelCount: number;
  readonly sourceForegroundPixelCount: number;
  readonly supportPixelCount: number;
  readonly sourceFeaturePixelCount: number;
  readonly sourceHogUsedCellCount: number;
  readonly parameters: RealBuildPrefix50Step44InteriorFeatureParameters;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44InteriorFeatureSource {
  readonly evidence: RealBuildPrefix50Step44InteriorFeatureSourceEvidence;
}

export interface RealBuildPrefix50Step44InteriorFeatureMeasurement {
  readonly schemaVersion: "lego.real-build-prefix50-step44-interior-feature-measurement/2";
  readonly authority: "none";
  readonly intendedUse: "diagnostic-and-refusal-evidence-only";
  readonly selectionAuthority: false;
  readonly tieBreakAuthority: false;
  readonly sourceCommitment: Sha256Digest;
  readonly beautyRenderPixelDigest: Sha256Digest;
  readonly semanticMaskPixelDigest: Sha256Digest;
  readonly semanticPolicyCommitment: Sha256Digest;
  readonly supportPixelCount: number;
  readonly sourceFeaturePixelCount: number;
  readonly renderFeaturePixelCount: number;
  readonly matchedSourceFeaturePixelCount: number;
  readonly matchedRenderFeaturePixelCount: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly hogSimilarity: number;
  readonly hogUsedCellCount: number;
  readonly parameters: RealBuildPrefix50Step44InteriorFeatureParameters;
  readonly commitment: Sha256Digest;
}

interface InteriorFeatureSourcePrivate {
  readonly rgba: Uint8Array;
  readonly support: Uint8Array;
  readonly sourceFeature: Uint8Array;
  readonly sourceHog: RealBuildPrefix50Step44InteriorHogDescriptor;
}

const sources = new WeakMap<
  RealBuildPrefix50Step44InteriorFeatureSource,
  InteriorFeatureSourcePrivate
>();

function requireDimensions(width: number, height: number): number {
  if (
    !Number.isSafeInteger(width) ||
    width < 1 ||
    !Number.isSafeInteger(height) ||
    height < 1 ||
    width * height > MAXIMUM_PIXELS
  )
    throw new RangeError(
      `Step-44 interior feature raster must have positive safe-integer dimensions totaling at most ${MAXIMUM_PIXELS} pixels.`,
    );
  return width * height;
}

function requireRgba(rgba: Uint8Array, pixelCount: number, label: string): Uint8Array {
  if (!(rgba instanceof Uint8Array) || rgba.byteLength !== pixelCount * 4)
    throw new RangeError(`${label} must contain exactly four RGBA bytes per raster pixel.`);
  return new Uint8Array(rgba);
}

function requireEligibleMask(mask: Uint8Array, pixelCount: number): Uint8Array {
  if (!(mask instanceof Uint8Array) || mask.byteLength !== pixelCount)
    throw new RangeError(
      "Step-44 interior feature eligible mask must contain exactly one byte per raster pixel.",
    );
  const copy = new Uint8Array(mask);
  for (const value of copy)
    if (value !== 0 && value !== 1)
      throw new TypeError(
        "Step-44 interior feature eligible mask must contain only exact binary values 0 or 1.",
      );
  return copy;
}

function requireSemanticBlueCyanMask(mask: Uint8Array, pixelCount: number): Uint8Array {
  if (!(mask instanceof Uint8Array) || mask.byteLength !== pixelCount)
    throw new RangeError(
      "Step-44 interior feature semantic blue/cyan mask must contain exactly one byte per raster pixel.",
    );
  const copy = new Uint8Array(mask);
  for (const value of copy)
    if (value !== 0 && value !== 1)
      throw new TypeError(
        "Step-44 interior feature semantic blue/cyan mask must contain only exact binary values 0 or 1.",
      );
  return copy;
}

function requireSemanticPolicyCommitment(value: Sha256Digest): Sha256Digest {
  if (!/^sha256:[0-9a-f]{64}$/u.test(value))
    throw new TypeError(
      "Step-44 interior feature semantic policy commitment must be a lowercase sha256 digest.",
    );
  return value;
}

function featureMask(rgba: Uint8Array, support: Uint8Array): Uint8Array {
  const { blueCyanHsv } = REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_PARAMETERS;
  return blueCyanFeatureMask({
    rgba,
    support,
    backgroundHex: REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_PARAMETERS.backgroundHex,
    backgroundTolerance: REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_PARAMETERS.backgroundTolerance,
    ...blueCyanHsv,
  });
}

export function deriveRealBuildPrefix50Step44SemanticBlueCyanMask(
  categoricalRgba: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const pixelCount = requireDimensions(width, height);
  const rgba = requireRgba(categoricalRgba, pixelCount, "Step-44 semantic color-ID RGBA raster");
  return featureMask(rgba, new Uint8Array(pixelCount).fill(1));
}

function requireFiniteUnit(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new TypeError(`${label} must be a finite value in the inclusive range 0..1.`);
  return value;
}

export function deriveRealBuildPrefix50Step44InteriorFeatureSource(input: {
  readonly width: number;
  readonly height: number;
  readonly sourceRgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
}): RealBuildPrefix50Step44InteriorFeatureSource {
  const pixelCount = requireDimensions(input.width, input.height);
  const rgba = requireRgba(input.sourceRgba, pixelCount, "Step-44 interior feature source RGBA");
  const eligibleMask = requireEligibleMask(input.eligibleMask, pixelCount);
  const parameters = REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_PARAMETERS;
  const sourceForeground = foregroundMask(
    rgba,
    parameters.backgroundHex,
    parameters.backgroundTolerance,
  );
  const filledSourceForeground = fillExternalContours(sourceForeground, input.width, input.height);
  const erodedEligible = erodeDisk(
    eligibleMask,
    input.width,
    input.height,
    parameters.eligibleErosionRadiusPx,
  );
  const erodedSourceSilhouette = erodeDisk(
    filledSourceForeground,
    input.width,
    input.height,
    parameters.sourceSilhouetteErosionRadiusPx,
  );
  const support = intersectMasks(erodedEligible, erodedSourceSilhouette);
  const supportPixelCount = countExactMask(support);
  if (supportPixelCount === 0)
    throw new TypeError(
      "Step-44 interior feature source has no support after its fixed eligible and source-silhouette erosions.",
    );
  const sourceFeature = featureMask(rgba, support);
  const sourceFeaturePixelCount = countExactMask(sourceFeature);
  if (sourceFeaturePixelCount === 0)
    throw new TypeError(
      "Step-44 interior feature source has no blue/cyan feature in its source-derived support.",
    );
  const sourceHog = interiorHogDescriptor({
    rgba,
    support,
    width: input.width,
    height: input.height,
    parameters: parameters.hog,
  });
  if (sourceHog.usedCellCount === 0)
    throw new TypeError(
      "Step-44 interior feature source has no nonzero HOG cell with the preregistered minimum support.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-interior-feature-source/1" as const,
    authority: "none" as const,
    intendedUse: "diagnostic-and-refusal-evidence-only" as const,
    selectionAuthority: false as const,
    tieBreakAuthority: false as const,
    supportDependency: "source-rgba-and-exact-eligible-mask-only" as const,
    width: input.width,
    height: input.height,
    sourcePixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(rgba),
    eligibleMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(eligibleMask),
    sourceForegroundMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(sourceForeground),
    supportMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(support),
    sourceBlueCyanFeatureMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(sourceFeature),
    eligiblePixelCount: countExactMask(eligibleMask),
    sourceForegroundPixelCount: countExactMask(sourceForeground),
    supportPixelCount,
    sourceFeaturePixelCount,
    sourceHogUsedCellCount: sourceHog.usedCellCount,
    parameters,
  };
  const source: RealBuildPrefix50Step44InteriorFeatureSource = Object.freeze({
    evidence: deepFreeze({ ...body, commitment: canonicalDigest(body) }),
  });
  sources.set(source, { rgba, support, sourceFeature, sourceHog });
  return source;
}

export function requireRealBuildPrefix50Step44InteriorFeatureSource(
  source: RealBuildPrefix50Step44InteriorFeatureSource,
): RealBuildPrefix50Step44InteriorFeatureSource {
  if (!sources.has(source))
    throw new TypeError(
      "Step-44 interior feature measurement requires the exact runtime-branded source derivation.",
    );
  return source;
}

export function measureRealBuildPrefix50Step44InteriorFeatures(input: {
  readonly source: RealBuildPrefix50Step44InteriorFeatureSource;
  readonly beautyRenderRgba: Uint8Array;
  readonly semanticBlueCyanMask: Uint8Array;
  readonly semanticPolicyCommitment: Sha256Digest;
}): RealBuildPrefix50Step44InteriorFeatureMeasurement {
  requireRealBuildPrefix50Step44InteriorFeatureSource(input.source);
  const privateSource = sources.get(input.source)!;
  const { width, height } = input.source.evidence;
  const beautyRenderRgba = requireRgba(
    input.beautyRenderRgba,
    width * height,
    "Step-44 interior feature beauty render RGBA",
  );
  const semanticBlueCyanMask = requireSemanticBlueCyanMask(
    input.semanticBlueCyanMask,
    width * height,
  );
  const semanticPolicyCommitment = requireSemanticPolicyCommitment(input.semanticPolicyCommitment);
  const renderFeature = intersectMasks(semanticBlueCyanMask, privateSource.support);
  const feature = tolerantFeatureAgreement({
    sourceFeature: privateSource.sourceFeature,
    renderFeature,
    support: privateSource.support,
    width,
    height,
    radius: input.source.evidence.parameters.tolerantMatchRadiusPx,
  });
  const renderHog = interiorHogDescriptor({
    rgba: beautyRenderRgba,
    support: privateSource.support,
    width,
    height,
    parameters: input.source.evidence.parameters.hog,
  });
  const hog = interiorHogSimilarity({
    source: privateSource.sourceHog,
    render: renderHog,
    parameters: input.source.evidence.parameters.hog,
  });
  const hogSimilarity = requireFiniteUnit(
    Math.max(0, Math.min(1, hog.similarity)),
    "Step-44 interior HOG similarity",
  );
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-interior-feature-measurement/2" as const,
    authority: "none" as const,
    intendedUse: "diagnostic-and-refusal-evidence-only" as const,
    selectionAuthority: false as const,
    tieBreakAuthority: false as const,
    sourceCommitment: input.source.evidence.commitment,
    beautyRenderPixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(beautyRenderRgba),
    semanticMaskPixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(semanticBlueCyanMask),
    semanticPolicyCommitment,
    supportPixelCount: input.source.evidence.supportPixelCount,
    sourceFeaturePixelCount: input.source.evidence.sourceFeaturePixelCount,
    renderFeaturePixelCount: countExactMask(renderFeature),
    matchedSourceFeaturePixelCount: feature.matchedSourceFeaturePixelCount,
    matchedRenderFeaturePixelCount: feature.matchedRenderFeaturePixelCount,
    precision: requireFiniteUnit(feature.precision, "Step-44 interior feature precision"),
    recall: requireFiniteUnit(feature.recall, "Step-44 interior feature recall"),
    f1: requireFiniteUnit(feature.f1, "Step-44 interior feature F1"),
    hogSimilarity,
    hogUsedCellCount: hog.usedCellCount,
    parameters: input.source.evidence.parameters,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}
