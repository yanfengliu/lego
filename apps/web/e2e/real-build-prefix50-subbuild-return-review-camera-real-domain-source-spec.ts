import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import { REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE } from "./real-build-prefix50-step41-panel-face-fixture.ts";
import type { RealBuildPrefix50Step42SourceBranchKey } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-branches.ts";
import { REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-step42-binding.ts";

export type RealBuildPrefix50Step44RealDomainCalibrationPanelStep = 41 | 42;
export type RealBuildPrefix50Step44RealDomainBranchKey = RealBuildPrefix50Step42SourceBranchKey;

export interface RealBuildPrefix50Step44RealDomainSourceCaseSpec {
  readonly panelStep: RealBuildPrefix50Step44RealDomainCalibrationPanelStep;
  readonly splitRole: "calibration";
  readonly crop: {
    readonly x: number;
    readonly y: number;
    readonly width: 720;
    readonly height: 470;
    readonly pngDigest: Sha256Digest;
    readonly pixelDigest: Sha256Digest;
  };
  readonly yellowComponents: readonly Readonly<{
    pixels: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>[];
  readonly exclusions: readonly Readonly<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>[];
  readonly eligiblePixelCount: number;
  readonly eligibleMaskDigest: Sha256Digest;
  readonly parentOnlyForegroundPixelCount: number;
  readonly parentOnlyForegroundMaskDigest: Sha256Digest;
  readonly interiorFeatureSourceCommitment: Sha256Digest;
  readonly sourceFeaturePixelCount: number;
  readonly sourceHogUsedCellCount: number;
  readonly perPanelLatticeFitCommitment?: Sha256Digest;
  readonly perPanelLatticeCounterevidenceCommitment?: Sha256Digest;
  readonly perPanelLatticeResidualFraction?: number;
  readonly perPanelLatticeSupportArtPixels?: number;
  readonly perPanelLatticeSupportSites?: number;
}

const SOURCE_CASES = deepFreeze([
  {
    panelStep: 41,
    splitRole: "calibration",
    crop: {
      x: 120,
      y: 180,
      width: 720,
      height: 470,
      pngDigest: "sha256:70715d9fcff846cc1fadf4a1c2fd00277665645862af556d49f68bde9ab8ac17",
      pixelDigest: "sha256:ade43c2e8a605216af03f0a3aeec6cfc7fa2329516936da2ea3df51f713df1c9",
    },
    yellowComponents: [
      { pixels: 618, minX: 136, minY: 166, maxX: 214, maxY: 225 },
      { pixels: 628, minX: 233, minY: 206, maxX: 312, maxY: 265 },
      { pixels: 648, minX: 365, minY: 259, maxX: 445, maxY: 319 },
      { pixels: 747, minX: 465, minY: 299, maxX: 546, maxY: 360 },
    ],
    exclusions: [
      { minX: 134, minY: 164, maxX: 216, maxY: 227 },
      { minX: 231, minY: 204, maxX: 314, maxY: 267 },
      { minX: 363, minY: 257, maxX: 447, maxY: 321 },
      { minX: 463, minY: 297, maxX: 548, maxY: 362 },
    ],
    eligiblePixelCount: 322504,
    eligibleMaskDigest: "sha256:6ccf7e2de388390fbed7914c7303b658874cd7d45969b9603ad99ecde0480978",
    parentOnlyForegroundPixelCount: 26498,
    parentOnlyForegroundMaskDigest:
      "sha256:9cfcabc1cd58424761271055b60a6e2fa04aae11be684d0accb409f6a83ece07",
    interiorFeatureSourceCommitment:
      "sha256:1a4c12192edaf4e7268d8989080b5036df99146817b0bca6c2d705d13db522d4",
    sourceFeaturePixelCount: 8672,
    sourceHogUsedCellCount: 22,
    perPanelLatticeFitCommitment:
      "sha256:495f162057de12d242a5dbca987fa2e42c2a46bdcf293264e100eb5bf4519982",
    perPanelLatticeCounterevidenceCommitment:
      "sha256:503e583f1fc80ed9b1fb833a3bbe4f613b7e08d6f3d6bfabed85fd6184271d0a",
    perPanelLatticeResidualFraction: 0.029751330365950634,
    perPanelLatticeSupportArtPixels: 26498,
    perPanelLatticeSupportSites: 9,
  },
  {
    panelStep: 42,
    splitRole: "calibration",
    crop: {
      x: 120,
      y: 810,
      width: 720,
      height: 470,
      pngDigest: "sha256:28b11b0f7f2b484b88e525d37514471e2f96dffab6d52314a10b4fd465e7e39a",
      pixelDigest: "sha256:d99e7b1cc959810d9f4d32dfa5eb2d28e2edeeb6ae600e962e15011070fbab1d",
    },
    yellowComponents: [{ pixels: 3538, minX: 128, minY: 134, maxX: 554, maxY: 330 }],
    exclusions: [{ minX: 126, minY: 132, maxX: 556, maxY: 332 }],
    eligiblePixelCount: 315409,
    eligibleMaskDigest: "sha256:faf52f1a43fdacdcb3b01952daf37a636d9dfbe0e7fe4bdf782b66846cdc7231",
    parentOnlyForegroundPixelCount: 22310,
    parentOnlyForegroundMaskDigest:
      "sha256:c204a09f68fe86e30fc0869d1412764c01d67055b8f9e1541db9109fee17c809",
    interiorFeatureSourceCommitment:
      "sha256:b80a8113b668d925c5e522b6d29f54c9a25075ff6c79f16f371e38ff8de5efca",
    sourceFeaturePixelCount: 7850,
    sourceHogUsedCellCount: 14,
    perPanelLatticeFitCommitment:
      "sha256:fd74325ce0030c63e86dc98f63c86e345216e5f09440f4875301e56212c8cd7b",
    perPanelLatticeCounterevidenceCommitment:
      "sha256:a010ed8bfc4d8a91b056f34b2fffe8359d6faf6950715690c47c4a6441f5d020",
    perPanelLatticeResidualFraction: 0.0036950376058233086,
    perPanelLatticeSupportArtPixels: 22310,
    perPanelLatticeSupportSites: 9,
  },
] satisfies readonly RealBuildPrefix50Step44RealDomainSourceCaseSpec[]);

const BOUNDED_CALIBRATION_PANEL_RECEIPT_BODY = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-step41-step42-bounded-panel-receipt/1" as const,
  evidenceSource: "separately-reviewed-exact-bounded-raster-crops" as const,
  page44TextRead: false as const,
  page44CalloutsRead: false as const,
  page44ShapesRead: false as const,
  page44PanelGeometryRead: false as const,
  panelSteps: [
    {
      stepNumber: 41,
      pageNumber: 44,
      cropPixelDigest: SOURCE_CASES[0]!.crop.pixelDigest,
      rotationIconPresent: false,
      panelFace: "studs-up",
    },
    {
      stepNumber: 42,
      pageNumber: 44,
      cropPixelDigest: SOURCE_CASES[1]!.crop.pixelDigest,
      rotationIconPresent: false,
      panelFace: "studs-up",
    },
  ] as const,
});

const BOUNDED_CALIBRATION_PANEL_RECEIPT = deepFreeze({
  ...BOUNDED_CALIBRATION_PANEL_RECEIPT_BODY,
  commitment: canonicalDigest(BOUNDED_CALIBRATION_PANEL_RECEIPT_BODY),
});

export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-step44-real-domain-source-spec/1" as const,
  authority: "none" as const,
  selectionAuthority: false as const,
  dataExclusionPolicy:
    "physical-page44-source-capped-at-printed-step42-with-later-evidence-held-separate" as const,
  sourceSetId: "6651557" as const,
  sourcePdfArtifactPath: "recipes/6651557.pdf" as const,
  sourcePdfDigest:
    "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const,
  physicalPageNumber: 44 as const,
  densityDpi: 180 as const,
  /** Offline full-page regression fixture only; never a runtime measurement or authority. */
  pageRaster: {
    width: 1914,
    height: 1361,
    pngDigest: "sha256:af7202bff919c7dd6bcaa04a3936e8115c6efc05e241a47fa3239593f141a4bb" as const,
    pixelDigest: "sha256:6e90dbef24f74dc683eace7a5433635cb87ab7d1ef6ad28742d77c38f962f297" as const,
  },
  faceEvidence: {
    vectorPageCeiling: 43 as const,
    firstPrintedStep: 1 as const,
    lastPrintedStep: 42 as const,
    lastVectorParsedPrintedStep: 40 as const,
    boundedCalibrationPanelReceipt: BOUNDED_CALIBRATION_PANEL_RECEIPT,
    earlierPageVectorInputsCommitment:
      "sha256:d426f4b6d31f269d61df0c07c5832c675c6ec00553a5419fe22732e1714581e1" as const,
    earlierPageRowsCommitment:
      "sha256:26e6685c7d6440e7073ac99bb570b6221349f3b21143945fd1a6aaf91692f43d" as const,
    vectorInputsCommitment:
      "sha256:75add44a0a533b7c09ce00e8519718cf75f8cb43a546218a736ffce73ed155a6" as const,
    rowsCommitment:
      "sha256:32c206d1586605fa8abc7b9c593b5075b11aaf9497755e1bd175f6e981e36663" as const,
    panelSteps: [
      { stepNumber: 41, pageNumber: 44, rotationIconPresent: false, panelFace: "studs-up" },
      { stepNumber: 42, pageNumber: 44, rotationIconPresent: false, panelFace: "studs-up" },
    ] as const,
  },
  sourceToPanelFaceQuarterTurn:
    REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE.sourceLongAxisToPanelFaceQuarterTurn,
  sourceTransformFixtureCommitment: canonicalDigest(REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE),
  branchBasis:
    "step42-source-only-unsigned-x-receipt;plus-y-and-production-branch-refused" as const,
  signedAxisReceipt: {
    schemaVersion: "lego.real-build-prefix50-step42-signed-source-axis-requirement/2" as const,
    status: "required-and-unavailable" as const,
    selectionAuthority: false as const,
    panelStep: 42 as const,
    sourceCropPixelDigest:
      "sha256:d99e7b1cc959810d9f4d32dfa5eb2d28e2edeeb6ae600e962e15011070fbab1d" as const,
    sourceGeometryBindingCommitment: REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT,
    darkStudCoreRoi: { minX: 330, maxX: 480, minY: 220, maxY: 290 } as const,
    maximumDarkRgbInclusive: 35 as const,
    exactQualifiedStudCoreCount: 4 as const,
    rawSourceOrder: [
      {
        ordinal: 274,
        officialDesignId: "6636",
        catalogPartId: "builtin:tile-1x6",
        rawPositionLdu: [400, -98, -110],
      },
      {
        ordinal: 276,
        officialDesignId: "3710",
        catalogPartId: "builtin:plate-1x4",
        rawPositionLdu: [300, -98, -110],
      },
      {
        ordinal: 275,
        officialDesignId: "3069",
        catalogPartId: "builtin:tile-1x2",
        rawPositionLdu: [240, -98, -110],
      },
    ] as const,
    measuredPlusDocumentY: null,
    fullRankCameraSeedCommitment: null,
    expectedBranchKey: null,
    step41Control: "unsigned-repeated-equal-identity-additions" as const,
    refusal:
      "four-source-bound-top-to-lower-wall-correspondences-and-fixed-mirror/erasure-controls-are-not-qualified" as const,
  },
  yellowDetector: {
    redGreaterThan: 180,
    greenGreaterThan: 140,
    blueLessThan: 110,
    redMinusGreenLessThan: 100,
    greenMinusBlueGreaterThan: 60,
    connectivity: 4,
    minimumComponentPixels: 5,
    componentPaddingPixels: 20,
  } as const,
  latticeInputPolicy:
    "generic-yellow-exclusions-replaced-by-exact-background-before-frozen-lattice-fit" as const,
  sharedOrientationAnchor: {
    status: "refused-by-corrected-production-masks" as const,
    calibrationPanelSteps: [41, 42] as const,
    primaryRule: "equal-support-pooled-lattice-field" as const,
    fallbackRule:
      "printable-step42-candidate-explained-peaks-coherence-residual-with-step41-direction-and-basis-determinant-hand-corroboration" as const,
    corroborationUncertaintyRule:
      "sum-per-fit-worst-coordinate-bound-from-two-times-rms-residual-over-pitch" as const,
    minimumCombinedArtPixels: 5_000 as const,
    minimumCombinedSupportSites: 12 as const,
    thresholdsChanged: false as const,
    calibrationSourceReceiptCommitment:
      "sha256:4c5da76645d8143f637605bc6ef69115a190a1cb3e99376e8d67c65499f9a712" as const,
    failureCommitment:
      "sha256:f470371921a54fbcc0af9daa0686ce3212f1bb04d9f9f5a24326b440c1ef8683" as const,
    refusalTelemetryCommitment:
      "sha256:26b026d1fb9ea204b510f617bb33d82d2d3ca15eeb25bd09f55ae13192345c33" as const,
    refusalTelemetrySummary: {
      step42CandidateCount: 63,
      step42SolutionCandidateCount: 63,
      qualifiedPairCount: 0,
      rejections: {
        noSolution: 0,
        residual: 50,
        oppositePhysicalHand: 0,
        azimuth: 13,
        elevation: 0,
      },
      accountingComplete: true as const,
    },
    replacementRequirement: "independent-signed-full-rank-camera-receipt" as const,
    anchorCommitment: null,
    latticeFitCommitment: null,
  },
  scaleSeedPolicy:
    "per-panel-source-foreground-to-known-predecessor-projected-bounds-before-frozen-registration" as const,
  cases: SOURCE_CASES,
});

export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC_COMMITMENT = canonicalDigest(
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC,
);

/** Runtime-safe Step-41/42 calibration spec; deliberately excludes the offline full-page raster. */
export const REAL_BUILD_PREFIX50_STEP44_BOUNDED_CALIBRATION_SOURCE_SPEC_COMMITMENT =
  canonicalDigest({
    schemaVersion: "lego.real-build-prefix50-step44-bounded-calibration-source-spec/1",
    kind: "bounded-step41-step42-calibration-source-spec",
    authority: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.authority,
    selectionAuthority: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.selectionAuthority,
    dataExclusionPolicy: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.dataExclusionPolicy,
    sourceSetId: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourceSetId,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourcePdfArtifactPath,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourcePdfDigest,
    physicalPageNumber: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.physicalPageNumber,
    densityDpi: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.densityDpi,
    faceEvidence: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.faceEvidence,
    sourceToPanelFaceQuarterTurn:
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourceToPanelFaceQuarterTurn,
    sourceTransformFixtureCommitment:
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourceTransformFixtureCommitment,
    branchBasis: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.branchBasis,
    signedAxisReceipt: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.signedAxisReceipt,
    yellowDetector: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.yellowDetector,
    latticeInputPolicy: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.latticeInputPolicy,
    sharedOrientationAnchor:
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sharedOrientationAnchor,
    scaleSeedPolicy: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.scaleSeedPolicy,
    cases: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases,
  });

export function realBuildPrefix50Step44RealDomainSourceCaseCommitment(
  panelStep: RealBuildPrefix50Step44RealDomainCalibrationPanelStep,
): Sha256Digest {
  const sourceCase = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases.find(
    (candidate) => candidate.panelStep === panelStep,
  );
  if (sourceCase === undefined)
    throw new RangeError(`Real-domain source spec has no panel Step ${panelStep}.`);
  return canonicalDigest({
    sourceSpecCommitment: REAL_BUILD_PREFIX50_STEP44_BOUNDED_CALIBRATION_SOURCE_SPEC_COMMITMENT,
    sourceCase,
  });
}
