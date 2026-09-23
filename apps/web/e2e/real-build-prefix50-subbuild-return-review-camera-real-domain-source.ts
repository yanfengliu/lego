import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_PREFIX50_STEP44_BOUNDED_CALIBRATION_SOURCE_SPEC_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC,
  type RealBuildPrefix50Step44RealDomainBranchKey,
  type RealBuildPrefix50Step44RealDomainSourceCaseSpec,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";
import { deriveRealBuildPrefix50Step44InteriorFeatureSource } from "./real-build-prefix50-subbuild-return-review-camera-interior.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { rerenderRealBuildPrefix50Step44CalibrationSourceCrops } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster.ts";
import { deriveRealBuildPrefix50Step44CalibrationRasterCommitment } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster-commitment.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import { type RealBuildPrefix50Step44TypedLatticeFit } from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
import {
  deriveRealBuildPrefix50Step44RealDomainLatticeDiagnostic,
  realBuildPrefix50Step44LatticeInputRgba,
  type SharedOrientationAnchor,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-lattice.ts";
import { deriveRegisteredRealBuildPrefix50Step44SourceAnchor } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-anchor.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
} from "./real-build-prefix50-source-pdf-pins.ts";
import { type RealBuildPrefix50Step44CameraOnlyLiveSourceLock } from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import type { RealBuildPrefix50Step42SourceGeometryAdmission } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-step42-admission.ts";
import { requireRealBuildPrefix50Step44RealDomainSourceLock } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-lock.ts";
import {
  type RealBuildPrefix50Step44RealDomainExclusionBox,
  type RealBuildPrefix50Step44RealDomainYellowComponent,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-pixels.ts";
import { deriveRealBuildPrefix50Step44RealDomainSourceCropPixels } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-crop-pixels.ts";
import {
  readRealBuildPrefix50Step44RealDomainSourcePixelVault,
  sealRealBuildPrefix50Step44RealDomainSourcePixels,
  type RealBuildPrefix50Step44RealDomainSourcePixelVault,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-bytes.ts";
import { requireRealBuildPrefix50Step44PreUnlockSourceReceipt } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-preunlock-receipt.ts";
import {
  deriveRealBuildPrefix50Step44SourceSequenceCommitment,
  requireRealBuildPrefix50Step44SourceSequenceStructure,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-sequence.ts";
import {
  requireRealBuildPrefix50Step44HeldOutUnlockCapability,
  type RealBuildPrefix50Step44HeldOutUnlockCapability,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";

const WIDTH = 720;
const HEIGHT = 470;
const sourceCaseBrands = new WeakSet<object>();
const sourceSequenceBrands = new WeakSet<object>();
const sourceSequencePrivates = new WeakMap<
  object,
  Readonly<{
    repositoryRoot: string;
    sourcePdfArtifactPath: string;
    sourcePdfDigest: Sha256Digest;
    calibrationRasterCommitment: Sha256Digest;
    sourceLockCommitment: Sha256Digest;
    calibrationCasesCommitment: Sha256Digest;
    calibrationCaseIdentities: readonly [object, object];
    sharedOrientationAnchorCommitment: Sha256Digest;
  }>
>();
const sourceCasePixels = new WeakMap<object, RealBuildPrefix50Step44RealDomainSourcePixelVault>();

type PanelStep = 41 | 42 | 43;

export interface RealBuildPrefix50Step44RealDomainPrivateSourceCaseSpec extends Omit<
  RealBuildPrefix50Step44RealDomainSourceCaseSpec,
  "panelStep" | "splitRole"
> {
  readonly panelStep: PanelStep;
  readonly splitRole: "calibration" | "held-out-validation";
}

type SourceCaseSpec = RealBuildPrefix50Step44RealDomainPrivateSourceCaseSpec;

export interface RealBuildPrefix50Step44RealDomainSourceCase {
  readonly schemaVersion: "lego.real-build-prefix50-step44-real-domain-source-case/1";
  readonly authority: "repository-pdf-raster-and-vector";
  readonly panelStep: PanelStep;
  readonly splitRole: "calibration" | "held-out-validation";
  readonly sourceLockCommitment: Sha256Digest;
  /** Legacy field name: binds the bounded Step-41/42 spec, excluding full-page raster data. */
  readonly sourceSpecCommitment: Sha256Digest;
  /** Legacy field name: commits schema `bounded-calibration-crop-set/1`, never a full page. */
  readonly pageRasterCommitment: Sha256Digest;
  readonly sourceCaseCommitment: Sha256Digest;
  readonly expectedBranchKey: RealBuildPrefix50Step44RealDomainBranchKey;
  readonly crop: SourceCaseSpec["crop"];
  readonly yellowComponents: readonly RealBuildPrefix50Step44RealDomainYellowComponent[];
  readonly exclusions: readonly RealBuildPrefix50Step44RealDomainExclusionBox[];
  readonly rgbaDigest: Sha256Digest;
  readonly eligibleMaskDigest: Sha256Digest;
  readonly eligiblePixelCount: number;
  readonly parentOnlyForegroundMaskDigest: Sha256Digest;
  readonly parentOnlyForegroundPixelCount: number;
  readonly rgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly parentOnlyForegroundMask: Uint8Array;
  readonly interiorFeatureSourceCommitment: Sha256Digest;
  readonly latticeFit: RealBuildPrefix50Step44TypedLatticeFit;
  readonly latticeFitQualified: boolean;
  readonly latticeFitFailure: string | null;
  readonly latticeFitCommitment: Sha256Digest;
  /** Full source-only authority and retained failed fits; never contains Step 43. */
  readonly sharedOrientationAnchor: SharedOrientationAnchor | null;
  readonly sharedOrientationAnchorCommitment: Sha256Digest;
  readonly perPanelLatticeCounterevidence: {
    readonly latticeFitCommitment: Sha256Digest;
    readonly qualified: boolean;
    readonly failure: string | null;
    readonly residualFraction: number;
    readonly supportArtPixels: number;
    readonly supportSites: number;
    readonly commitment: Sha256Digest;
  };
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44RealDomainSourceSequence {
  readonly calibrationCases: readonly [
    RealBuildPrefix50Step44RealDomainSourceCase,
    RealBuildPrefix50Step44RealDomainSourceCase,
  ];
  readonly sourceLockCommitment: Sha256Digest;
  /** Legacy field name: commits actual bounded Step-41/42 crop measurements only. */
  readonly pageRasterCommitment: Sha256Digest;
  readonly sharedOrientationAnchorCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

function mintSourceCase(input: {
  readonly spec: SourceCaseSpec;
  readonly cropRgba: Uint8Array;
  readonly calibrationRasterCommitment: Sha256Digest;
  readonly sourceLockCommitment: Sha256Digest;
  readonly expectedBranchKey: RealBuildPrefix50Step44RealDomainBranchKey;
  readonly sharedOrientationAnchor?: SharedOrientationAnchor;
  readonly brand?: boolean;
}): RealBuildPrefix50Step44RealDomainSourceCase {
  const { rgba, yellowComponents, exclusions, eligibleMask, parentOnlyForegroundMask } =
    deriveRealBuildPrefix50Step44RealDomainSourceCropPixels(input.cropRgba);
  const pngBytes = encodeCanonicalRealBuildPrefix50Step44ReviewPng({
    width: WIDTH,
    height: HEIGHT,
    rgba,
  });
  const interior = deriveRealBuildPrefix50Step44InteriorFeatureSource({
    width: WIDTH,
    height: HEIGHT,
    sourceRgba: rgba,
    eligibleMask,
  });
  const observed = {
    cropPngDigest: sha256RealBuildPrefix50Step44ReviewBytes(pngBytes),
    cropPixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(rgba),
    yellowComponents,
    exclusions,
    eligiblePixelCount: eligibleMask.reduce((total, value) => total + value, 0),
    eligibleMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(eligibleMask),
    parentOnlyForegroundPixelCount: parentOnlyForegroundMask.reduce(
      (total, value) => total + value,
      0,
    ),
    parentOnlyForegroundMaskDigest:
      sha256RealBuildPrefix50Step44ReviewBytes(parentOnlyForegroundMask),
    interiorFeatureSourceCommitment: interior.evidence.commitment,
    sourceFeaturePixelCount: interior.evidence.sourceFeaturePixelCount,
    sourceHogUsedCellCount: interior.evidence.sourceHogUsedCellCount,
  };
  const expected = {
    cropPngDigest: input.spec.crop.pngDigest,
    cropPixelDigest: input.spec.crop.pixelDigest,
    yellowComponents: input.spec.yellowComponents,
    exclusions: input.spec.exclusions,
    eligiblePixelCount: input.spec.eligiblePixelCount,
    eligibleMaskDigest: input.spec.eligibleMaskDigest,
    parentOnlyForegroundPixelCount: input.spec.parentOnlyForegroundPixelCount,
    parentOnlyForegroundMaskDigest: input.spec.parentOnlyForegroundMaskDigest,
    interiorFeatureSourceCommitment: input.spec.interiorFeatureSourceCommitment,
    sourceFeaturePixelCount: input.spec.sourceFeaturePixelCount,
    sourceHogUsedCellCount: input.spec.sourceHogUsedCellCount,
  };
  if (canonicalDigest(observed) !== canonicalDigest(expected))
    throw new TypeError(
      `Real-domain panel ${input.spec.panelStep} did not reproduce its exact generic yellow exclusion and feature source.`,
    );
  const sourceCaseCommitment = canonicalDigest({
    sourceSpecCommitment: REAL_BUILD_PREFIX50_STEP44_BOUNDED_CALIBRATION_SOURCE_SPEC_COMMITMENT,
    sourceCase: input.spec,
  });
  const perPanelLattice = deriveRealBuildPrefix50Step44RealDomainLatticeDiagnostic(
    realBuildPrefix50Step44LatticeInputRgba(rgba, eligibleMask),
  );
  const authoritativeLattice =
    input.sharedOrientationAnchor === undefined
      ? perPanelLattice
      : {
          latticeFit: input.sharedOrientationAnchor.latticeFit,
          qualified: true,
          failure: null,
        };
  const latticeFitCommitment = canonicalDigest(authoritativeLattice.latticeFit);
  const perPanelBody = {
    latticeFitCommitment: canonicalDigest(perPanelLattice.latticeFit),
    qualified: perPanelLattice.qualified,
    failure: perPanelLattice.failure,
    residualFraction: perPanelLattice.latticeFit.residualFraction,
    supportArtPixels: perPanelLattice.latticeFit.control.artPixels,
    supportSites: perPanelLattice.latticeFit.residuals.sites,
  };
  const perPanelLatticeCounterevidence = deepFreeze({
    ...perPanelBody,
    commitment: canonicalDigest(perPanelBody),
  });
  if (
    input.spec.perPanelLatticeFitCommitment !== undefined &&
    (perPanelBody.latticeFitCommitment !== input.spec.perPanelLatticeFitCommitment ||
      perPanelLatticeCounterevidence.commitment !==
        input.spec.perPanelLatticeCounterevidenceCommitment ||
      perPanelBody.residualFraction !== input.spec.perPanelLatticeResidualFraction ||
      perPanelBody.supportArtPixels !== input.spec.perPanelLatticeSupportArtPixels ||
      perPanelBody.supportSites !== input.spec.perPanelLatticeSupportSites)
  )
    throw new TypeError(
      `Real-domain panel ${input.spec.panelStep} per-panel lattice counterevidence drifted from its exact source-only controls.`,
    );
  const privatePixels = Object.freeze({
    rgba: new Uint8Array(rgba),
    eligibleMask: new Uint8Array(eligibleMask),
    parentOnlyForegroundMask: new Uint8Array(parentOnlyForegroundMask),
  });
  const rgbaDigest = sha256RealBuildPrefix50Step44ReviewBytes(privatePixels.rgba);
  const eligibleMaskDigest = sha256RealBuildPrefix50Step44ReviewBytes(privatePixels.eligibleMask);
  const parentOnlyForegroundMaskDigest = sha256RealBuildPrefix50Step44ReviewBytes(
    privatePixels.parentOnlyForegroundMask,
  );
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-real-domain-source-case/1" as const,
    authority: "repository-pdf-raster-and-vector" as const,
    panelStep: input.spec.panelStep,
    splitRole: input.spec.splitRole,
    sourceLockCommitment: input.sourceLockCommitment,
    sourceSpecCommitment: REAL_BUILD_PREFIX50_STEP44_BOUNDED_CALIBRATION_SOURCE_SPEC_COMMITMENT,
    pageRasterCommitment: input.calibrationRasterCommitment,
    sourceCaseCommitment,
    expectedBranchKey: input.expectedBranchKey,
    crop: input.spec.crop,
    yellowComponents,
    exclusions,
    rgbaDigest,
    eligibleMaskDigest,
    eligiblePixelCount: input.spec.eligiblePixelCount,
    parentOnlyForegroundMaskDigest,
    parentOnlyForegroundPixelCount: input.spec.parentOnlyForegroundPixelCount,
    interiorFeatureSourceCommitment: interior.evidence.commitment,
    latticeFit: authoritativeLattice.latticeFit,
    latticeFitQualified: authoritativeLattice.qualified,
    latticeFitFailure: authoritativeLattice.failure,
    latticeFitCommitment,
    sharedOrientationAnchor: input.sharedOrientationAnchor ?? null,
    sharedOrientationAnchorCommitment:
      input.sharedOrientationAnchor?.commitment ??
      canonicalDigest({ status: "unanchored-source-draft" }),
    perPanelLatticeCounterevidence,
  };
  const commitment = canonicalDigest(body);
  const result: RealBuildPrefix50Step44RealDomainSourceCase = Object.freeze({
    ...body,
    commitment,
    get rgba() {
      return new Uint8Array(privatePixels.rgba);
    },
    get eligibleMask() {
      return new Uint8Array(privatePixels.eligibleMask);
    },
    get parentOnlyForegroundMask() {
      return new Uint8Array(privatePixels.parentOnlyForegroundMask);
    },
  });
  if (input.brand === true) {
    sourceCaseBrands.add(result);
    sourceCasePixels.set(result, sealRealBuildPrefix50Step44RealDomainSourcePixels(privatePixels));
  }
  return result;
}

export async function prepareRealBuildPrefix50Step44RealDomainSourceSequence(input: {
  readonly repositoryRoot: string;
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly sourceGeometryAdmission: RealBuildPrefix50Step42SourceGeometryAdmission;
}): Promise<RealBuildPrefix50Step44RealDomainSourceSequence> {
  const sourceLockCommitment = requireRealBuildPrefix50Step44RealDomainSourceLock(input);
  const preUnlockReceipt = requireRealBuildPrefix50Step44PreUnlockSourceReceipt(
    input.sourceGeometryAdmission,
  );
  const calibrationRasters = await rerenderRealBuildPrefix50Step44CalibrationSourceCrops({
    repositoryRoot: input.repositoryRoot,
  });
  const calibrationRasterCommitment = deriveRealBuildPrefix50Step44CalibrationRasterCommitment({
    sourceLockCommitment,
    rasters: calibrationRasters,
  });
  const calibrationDrafts = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases.map(
    (spec, index) =>
      mintSourceCase({
        spec,
        cropRgba: calibrationRasters[index]!.rgba,
        calibrationRasterCommitment,
        sourceLockCommitment,
        expectedBranchKey: preUnlockReceipt.expectedBranchKey,
      }),
  );
  const orientationAnchor = deriveRegisteredRealBuildPrefix50Step44SourceAnchor([
    realBuildPrefix50Step44LatticeInputRgba(
      calibrationDrafts[0]!.rgba,
      calibrationDrafts[0]!.eligibleMask,
    ),
    realBuildPrefix50Step44LatticeInputRgba(
      calibrationDrafts[1]!.rgba,
      calibrationDrafts[1]!.eligibleMask,
    ),
  ]);
  const calibrationCases = Object.freeze(
    REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases.map((spec, index) =>
      mintSourceCase({
        spec,
        cropRgba: calibrationRasters[index]!.rgba,
        calibrationRasterCommitment,
        sourceLockCommitment,
        expectedBranchKey: preUnlockReceipt.expectedBranchKey,
        sharedOrientationAnchor: orientationAnchor,
        brand: true,
      }),
    ),
  ) as unknown as RealBuildPrefix50Step44RealDomainSourceSequence["calibrationCases"];
  const sequenceBody = {
    calibrationCases,
    sourceLockCommitment,
    pageRasterCommitment: calibrationRasterCommitment,
    sharedOrientationAnchorCommitment: orientationAnchor.commitment,
  };
  const sequence: RealBuildPrefix50Step44RealDomainSourceSequence = Object.freeze({
    ...sequenceBody,
    commitment: deriveRealBuildPrefix50Step44SourceSequenceCommitment(sequenceBody),
  });
  sourceSequenceBrands.add(sequence);
  sourceSequencePrivates.set(
    sequence,
    Object.freeze({
      repositoryRoot: input.repositoryRoot,
      sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
      sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
      calibrationRasterCommitment,
      sourceLockCommitment,
      calibrationCasesCommitment: canonicalDigest(
        calibrationCases.map(({ commitment }) => commitment),
      ),
      calibrationCaseIdentities: calibrationCases,
      sharedOrientationAnchorCommitment: orientationAnchor.commitment,
    }),
  );
  return sequence;
}

export function requireRealBuildPrefix50Step44RealDomainSourceCase(
  value: RealBuildPrefix50Step44RealDomainSourceCase,
): RealBuildPrefix50Step44RealDomainSourceCase {
  const vault = sourceCasePixels.get(value);
  if (!sourceCaseBrands.has(value) || vault === undefined)
    throw new TypeError("Real-domain camera source case lacks its live PDF raster/vector brand.");
  const pixels = readRealBuildPrefix50Step44RealDomainSourcePixelVault(vault);
  const eligiblePixelCount = pixels.eligibleMask.reduce((total, bit) => total + bit, 0);
  const parentOnlyForegroundPixelCount = pixels.parentOnlyForegroundMask.reduce(
    (total, bit) => total + bit,
    0,
  );
  const commitment = value.commitment;
  const body = { ...value } as Record<string, unknown>;
  for (const key of ["commitment", "rgba", "eligibleMask", "parentOnlyForegroundMask"])
    Reflect.deleteProperty(body, key);
  if (
    pixels.eligibleMask.some((bit) => bit !== 0 && bit !== 1) ||
    pixels.parentOnlyForegroundMask.some((bit) => bit !== 0 && bit !== 1) ||
    value.rgbaDigest !== sha256RealBuildPrefix50Step44ReviewBytes(pixels.rgba) ||
    value.eligibleMaskDigest !== sha256RealBuildPrefix50Step44ReviewBytes(pixels.eligibleMask) ||
    value.parentOnlyForegroundMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(pixels.parentOnlyForegroundMask) ||
    value.eligiblePixelCount !== eligiblePixelCount ||
    value.parentOnlyForegroundPixelCount !== parentOnlyForegroundPixelCount ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError(
      `Real-domain panel ${value.panelStep} source bytes or exact eligible/target mask digests and counts changed after branding.`,
    );
  return value;
}

export function readRealBuildPrefix50Step44RealDomainSourceCasePixels(
  value: RealBuildPrefix50Step44RealDomainSourceCase,
): Readonly<{
  rgba: Uint8Array;
  eligibleMask: Uint8Array;
  parentOnlyForegroundMask: Uint8Array;
}> {
  requireRealBuildPrefix50Step44RealDomainSourceCase(value);
  return readRealBuildPrefix50Step44RealDomainSourcePixelVault(sourceCasePixels.get(value)!);
}

export function requireRealBuildPrefix50Step44RealDomainSourceSequence(
  value: RealBuildPrefix50Step44RealDomainSourceSequence,
): RealBuildPrefix50Step44RealDomainSourceSequence {
  const state = sourceSequencePrivates.get(value);
  if (!sourceSequenceBrands.has(value) || state === undefined)
    throw new TypeError("Real-domain camera source sequence lacks its strict holdout brand.");
  const calibrationCases = value.calibrationCases;
  const verifiedCases = calibrationCases.map((sourceCase) =>
    requireRealBuildPrefix50Step44RealDomainSourceCase(sourceCase),
  );
  requireRealBuildPrefix50Step44SourceSequenceStructure({ value, state, verifiedCases });
  return value;
}

export async function materializeRealBuildPrefix50Step44HeldOutSourceCase(input: {
  readonly capability: RealBuildPrefix50Step44HeldOutUnlockCapability;
  readonly sourceSequence: RealBuildPrefix50Step44RealDomainSourceSequence;
}): Promise<RealBuildPrefix50Step44RealDomainSourceCase> {
  const capability = requireRealBuildPrefix50Step44HeldOutUnlockCapability(input.capability);
  const sequence = requireRealBuildPrefix50Step44RealDomainSourceSequence(input.sourceSequence);
  const state = sourceSequencePrivates.get(sequence);
  const calibrationCases = sequence.calibrationCases.map((sourceCase) =>
    requireRealBuildPrefix50Step44RealDomainSourceCase(sourceCase),
  );
  const sharedOrientationAnchor = calibrationCases[0]?.sharedOrientationAnchor;
  const expectedBranchKey = calibrationCases[0]?.expectedBranchKey;
  if (
    state === undefined ||
    capability.sourceSequenceCommitment !== sequence.commitment ||
    state.repositoryRoot.length === 0 ||
    state.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    state.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    state.sourceLockCommitment !== sequence.sourceLockCommitment ||
    state.calibrationRasterCommitment !== sequence.pageRasterCommitment ||
    state.calibrationCasesCommitment !==
      canonicalDigest(calibrationCases.map(({ commitment }) => commitment)) ||
    state.sharedOrientationAnchorCommitment !== sequence.sharedOrientationAnchorCommitment ||
    sharedOrientationAnchor === null ||
    sharedOrientationAnchor === undefined ||
    sharedOrientationAnchor.commitment !== state.sharedOrientationAnchorCommitment ||
    calibrationCases[1]?.sharedOrientationAnchorCommitment !==
      state.sharedOrientationAnchorCommitment ||
    expectedBranchKey === undefined ||
    calibrationCases[1]?.expectedBranchKey !== expectedBranchKey
  )
    throw new TypeError(
      "Step-43 source must be materialized from the exact source sequence consumed by its calibration session.",
    );
  const heldOut =
    await import("./real-build-prefix50-subbuild-return-review-camera-real-domain-heldout-raster.ts");
  const spec = heldOut.REAL_BUILD_PREFIX50_STEP44_HELD_OUT_SOURCE_CASE;
  const rendered = await heldOut.rerenderRealBuildPrefix50Step44HeldOutSourceCrop({
    repositoryRoot: state.repositoryRoot,
    sourcePdfArtifactPath: state.sourcePdfArtifactPath,
    sourcePdfDigest: state.sourcePdfDigest,
    maximumSourceBytes: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
    densityDpi: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.densityDpi,
    capability,
  });
  if (
    rendered.width !== spec.crop.width ||
    rendered.height !== spec.crop.height ||
    rendered.pixelDigest !== spec.crop.pixelDigest
  )
    throw new TypeError("Post-unlock Step-43 crop did not reproduce its exact sealed pixels.");
  return mintSourceCase({
    spec,
    cropRgba: rendered.rgba,
    calibrationRasterCommitment: state.calibrationRasterCommitment,
    sourceLockCommitment: state.sourceLockCommitment,
    expectedBranchKey,
    sharedOrientationAnchor,
    brand: true,
  });
}
