import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";
import { MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION } from "./real-build-farther-origin-source-manifest";

type FartherOriginPolicyOptions = Pick<
  RealBuildOptions,
  | "inputDigests"
  | "minimumDeferredAgreement"
  | "minimumDeferredAgreementMargin"
  | "renderScale"
  | "panelWidth"
  | "workFactor"
  | "deferredNarrowingRenderBudget"
  | "fartherPanelMaximumReachSteps"
  | "fartherPanelRenderBudget"
  | "measuredFartherOriginSourceAttestation"
>;

const MEASURED_INPUT_DIGESTS = Object.freeze({
  pdf: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
  calloutManifest: "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
  coverage: "sha256:0ed8fb0225057ba6d36ae00f45d37921a0b590ff6de42fa96774545d62a4c3c6",
  officialModel: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
  actionLedger: "sha256:e88688b23310b9ae16039c57f0ffbf2c5cbf36385e81af6e4824ac9faf64a377",
  highlightCalibration: "sha256:f18939b8b9b98123868c437561113f81c44142b4004aa206dfaf7d4b954ffadf",
  builderCalibration: "sha256:da326b44897eec7d0a3a7049c0d06cb8ae8c0fbcbcda2e3f7423d7017abd241b",
  builderGeometry: "sha256:da8260f77540db459bd745d75ebb072d1b08d357d1628569a06c58d6aed77c55",
  transitionClassifications:
    "sha256:80efaa9573d3611e820f9a5108fe89f48e22139164fa7f56c297aa13350670ab",
});

const MEASURED_ACTION_DIGESTS = Object.freeze([
  "sha256:26498eb4d1aa0a904308a4a5a77daf2b9b0733620779b644b882046a634f9a27",
  "sha256:8f0f7752fe2e6b9e775daf9676dcc8b0451c1fc9baec6f9a190ff0da5502c712",
  "sha256:b4b7111b985114d65fa1234f40e56536b96cf42f30cad8fd0653cb2a8c34438a",
]);

const MEASURED_ORIGIN_IDS = Object.freeze([
  "step-005:sha256:2a70e4720046a4437c623546b4e78b8df9922e62846686db84ae1cd0003ab1b8",
  "step-005:sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93",
]);

export const MEASURED_FARTHER_ORIGIN_CANDIDATES = Object.freeze([
  {
    candidateId: MEASURED_ORIGIN_IDS[0]!,
    documentHash: MEASURED_ORIGIN_IDS[0]!.slice("step-005:".length),
    lookaheadAgreement: 0.6006833844906468,
    pieces: [
      {
        catalogPartId: "builtin:plate-2x4",
        colorId: "builtin:green",
        transform: { positionLdu: [60, 8, 0], orientationId: "upright-yaw-270" },
      },
      {
        catalogPartId: "builtin:plate-2x14",
        colorId: "builtin:black",
        transform: { positionLdu: [160, -8, 40], orientationId: "upright-yaw-270" },
      },
    ],
  },
  {
    candidateId: MEASURED_ORIGIN_IDS[1]!,
    documentHash: MEASURED_ORIGIN_IDS[1]!.slice("step-005:".length),
    lookaheadAgreement: 0.7635021804763502,
    pieces: [
      {
        catalogPartId: "builtin:plate-2x4",
        colorId: "builtin:green",
        transform: { positionLdu: [60, 8, 0], orientationId: "upright-yaw-270" },
      },
      {
        catalogPartId: "builtin:plate-2x14",
        colorId: "builtin:black",
        transform: { positionLdu: [160, 8, 100], orientationId: "upright-yaw-270" },
      },
    ],
  },
] as const);

/** Canonical projection source: retained prepared-options sha256:e8ce9dbe...ca84985. */
export const MEASURED_FARTHER_ORIGIN_PANEL_SPECS: readonly RealBuildPanelSpec[] = [
  {
    stepNumber: 5,
    pageNumber: 12,
    panelFace: "studs-up",
    minXPt: 0,
    maxXPt: 376.92911,
    minYPt: 0,
    maxYPt: 544.252,
    calloutBoxes: [
      {
        minXPt: 14.67296028137207,
        minYPt: 445.3301086425781,
        maxXPt: 166.7439727783203,
        maxYPt: 529.5789794921875,
      },
      {
        minXPt: 14.67296028137207,
        minYPt: 445.3301086425781,
        maxXPt: 166.7439727783203,
        maxYPt: 529.5789794921875,
      },
    ],
    mappedCalloutKeys: ["p12|q1|x108.829|y453.870", "p12|q1|x26.748|y453.870"],
    pieces: [
      {
        identityKey: "479c0207-fe42-447a-a66e-83584812bc95",
        designId: "3020",
        materialId: "28",
        catalogPartId: "builtin:plate-2x4",
        colorId: "builtin:green",
        calloutKey: "p12|q1|x108.829|y453.870",
        identificationConfidence: "vision-kept",
        cropDigest: "sha256:0daea2b9a2bb822470f01c3bdc6468f341e1c55c148f1c0749d4821dce7be489",
        identificationInputDigest:
          "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
        expectedTransform: {
          positionLdu: [-60, 8, 0],
          orientationId: "upright-yaw-90",
        },
      },
      {
        identityKey: "b7a1a69c-a44c-47d3-af53-28eefe51acb2",
        designId: "91988",
        materialId: "26",
        catalogPartId: "builtin:plate-2x14",
        colorId: "builtin:black",
        calloutKey: "p12|q1|x26.748|y453.870",
        identificationConfidence: "pair-judged-same",
        cropDigest: "sha256:87335cb83ac1487063f32d86fcc07867e419cd59a5e251dc678cb97457a36136",
        identificationInputDigest:
          "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
        expectedTransform: {
          positionLdu: [-160, 8, 100],
          orientationId: "upright-yaw-270",
        },
      },
    ],
    omittedPieces: [],
    calloutPieces: 2,
    classifiedPhysicalCalloutPieces: 2,
    semanticMultiplierQuantity: 0,
    omittedPhysicalPieces: 0,
    action: {
      kind: "place-callouts",
      assembledPieces: 2,
      evidenceDigest: "sha256:26498eb4d1aa0a904308a4a5a77daf2b9b0733620779b644b882046a634f9a27",
    },
    coverageFailures: [],
    missingDesigns: [],
    unresolvedCallouts: [],
  },
  {
    stepNumber: 6,
    pageNumber: 12,
    panelFace: "studs-up",
    minXPt: 376.92911,
    maxXPt: 765.354,
    minYPt: 0,
    maxYPt: 544.252,
    calloutBoxes: [
      {
        minXPt: 387.42901611328125,
        minYPt: 416.6230773925781,
        maxXPt: 539.5,
        maxYPt: 529.5789794921875,
      },
      {
        minXPt: 387.42901611328125,
        minYPt: 416.6230773925781,
        maxXPt: 539.5,
        maxYPt: 529.5789794921875,
      },
      {
        minXPt: 387.42901611328125,
        minYPt: 416.6230773925781,
        maxXPt: 539.5,
        maxYPt: 529.5789794921875,
      },
      {
        minXPt: 387.42901611328125,
        minYPt: 416.6230773925781,
        maxXPt: 539.5,
        maxYPt: 529.5789794921875,
      },
    ],
    mappedCalloutKeys: [
      "p12|q1|x395.433|y425.162",
      "p12|q1|x425.416|y425.162",
      "p12|q1|x425.416|y470.671",
      "p12|q1|x469.096|y425.162",
    ],
    pieces: [
      {
        identityKey: "a7e00a29-4511-4201-95ac-62a28eb718af",
        designId: "54383",
        materialId: "26",
        catalogPartId: "builtin:wedge-plate-3x6-right",
        colorId: "builtin:black",
        calloutKey: "p12|q1|x395.433|y425.162",
        identificationConfidence: "pair-judged-same",
        cropDigest: "sha256:2691ad02ad3ffe248b0892e023a9699fe871face95c3f63f297441d1cc81ac48",
        identificationInputDigest:
          "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
        expectedTransform: {
          positionLdu: [-60, 0, -90],
          orientationId: "upright-yaw-270",
        },
      },
      {
        identityKey: "26a880ea-c73f-465e-9583-1aa85f66839b",
        designId: "60479",
        materialId: "26",
        catalogPartId: "builtin:plate-1x12",
        colorId: "builtin:black",
        calloutKey: "p12|q1|x425.416|y425.162",
        identificationConfidence: "pair-judged-same",
        cropDigest: "sha256:dadd6b470a7f42857f03eca35619571d8bab169657d350bd74673270b46eded3",
        identificationInputDigest:
          "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
        expectedTransform: {
          positionLdu: [-120, 0, -10],
          orientationId: "upright-yaw-90",
        },
      },
      {
        identityKey: "c705501f-a4f3-4f4e-a6b1-a7282431e78d",
        designId: "3032",
        materialId: "26",
        catalogPartId: "builtin:plate-4x6",
        colorId: "builtin:black",
        calloutKey: "p12|q1|x425.416|y470.671",
        identificationConfidence: "pair-judged-same",
        cropDigest: "sha256:d1e80c354073d10c5204c0339e513d4c85ea8d2ec04977d7749849147e31d714",
        identificationInputDigest:
          "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
        expectedTransform: {
          positionLdu: [-80, 0, 60],
          orientationId: "upright-yaw-180",
        },
      },
      {
        identityKey: "fecc1111-d8e7-4f4f-92d0-8fad2beba6fa",
        designId: "3795",
        materialId: "26",
        catalogPartId: "builtin:plate-2x6",
        colorId: "builtin:black",
        calloutKey: "p12|q1|x469.096|y425.162",
        identificationConfidence: "pair-judged-same",
        cropDigest: "sha256:cc19c9e49156d55011c93b5ba6ad4ca680e3d8cd65b265832779c17e06a52d51",
        identificationInputDigest:
          "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
        expectedTransform: {
          positionLdu: [-60, 0, -40],
          orientationId: "upright-yaw-90",
        },
      },
    ],
    omittedPieces: [],
    calloutPieces: 4,
    classifiedPhysicalCalloutPieces: 4,
    semanticMultiplierQuantity: 0,
    omittedPhysicalPieces: 0,
    action: {
      kind: "place-callouts",
      assembledPieces: 4,
      evidenceDigest: "sha256:8f0f7752fe2e6b9e775daf9676dcc8b0451c1fc9baec6f9a190ff0da5502c712",
    },
    coverageFailures: [],
    missingDesigns: [],
    unresolvedCallouts: [],
  },
  {
    stepNumber: 7,
    pageNumber: 13,
    panelFace: "underside",
    minXPt: 0,
    maxXPt: 396.7717,
    minYPt: 0,
    maxYPt: 544.252,
    calloutBoxes: [
      {
        minXPt: 34.5159912109375,
        minYPt: 425.85009765625,
        maxXPt: 186.58697509765625,
        maxYPt: 529.5789794921875,
      },
      {
        minXPt: 34.5159912109375,
        minYPt: 425.85009765625,
        maxXPt: 186.58697509765625,
        maxYPt: 529.5789794921875,
      },
      {
        minXPt: 34.5159912109375,
        minYPt: 425.85009765625,
        maxXPt: 186.58697509765625,
        maxYPt: 529.5789794921875,
      },
      {
        minXPt: 34.5159912109375,
        minYPt: 425.85009765625,
        maxXPt: 186.58697509765625,
        maxYPt: 529.5789794921875,
      },
    ],
    mappedCalloutKeys: [
      "p13|q1|x139.831|y434.390",
      "p13|q1|x44.551|y434.390",
      "p13|q1|x83.311|y434.390",
      "p13|q1|x83.311|y473.550",
    ],
    pieces: [
      {
        identityKey: "a821a439-4d97-4d45-9f2d-09658b49df3f",
        designId: "51739",
        materialId: "26",
        catalogPartId: "builtin:wedge-plate-2x4-wing",
        colorId: "builtin:black",
        calloutKey: "p13|q1|x139.831|y434.390",
        identificationConfidence: "pair-judged-same",
        cropDigest: "sha256:9f4dcbe1b52fdc637ed2895b868974958ebebf46aa05efd616e9d6a8827ff8cb",
        identificationInputDigest:
          "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
        expectedTransform: {
          positionLdu: [-40, 8, -60],
          orientationId: "upright-yaw-180",
        },
      },
      {
        identityKey: "cbfc6933-0dbb-4a0e-95da-d263e1f257e0",
        designId: "54383",
        materialId: "26",
        catalogPartId: "builtin:wedge-plate-3x6-right",
        colorId: "builtin:black",
        calloutKey: "p13|q1|x44.551|y434.390",
        identificationConfidence: "pair-judged-same",
        cropDigest: "sha256:78b5855c6d1d3cc34765f1f872381ed6143d119ba731eae6b90de7ef8ef8e977",
        identificationInputDigest:
          "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
        expectedTransform: {
          positionLdu: [-120, 8, -110],
          orientationId: "upright-yaw-270",
        },
      },
      {
        identityKey: "ee5dafb5-02a9-49df-99df-0e1d60ae9206",
        designId: "3020",
        materialId: "28",
        catalogPartId: "builtin:plate-2x4",
        colorId: "builtin:green",
        calloutKey: "p13|q1|x83.311|y434.390",
        identificationConfidence: "vision-kept",
        cropDigest: "sha256:332cd40cc27c96b54d0853b57038c6407ed7347a5a7d317863c4641e00dd418e",
        identificationInputDigest:
          "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
        expectedTransform: {
          positionLdu: [-180, 8, 0],
          orientationId: "upright-yaw-90",
        },
      },
      {
        identityKey: "994a7f6f-8227-4ff4-9dc6-a3f412e35a91",
        designId: "3034",
        materialId: "23",
        catalogPartId: "builtin:plate-2x8",
        colorId: "builtin:blue",
        calloutKey: "p13|q1|x83.311|y473.550",
        identificationConfidence: "pair-judged-same",
        cropDigest: "sha256:e018edbc8443a2b4932079dbdb5e63a81beb2c4ed3fa7e7e22c2a91e5efbe513",
        identificationInputDigest:
          "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
        expectedTransform: {
          positionLdu: [-120, 8, 0],
          orientationId: "upright-yaw-180",
        },
      },
    ],
    omittedPieces: [],
    calloutPieces: 4,
    classifiedPhysicalCalloutPieces: 4,
    semanticMultiplierQuantity: 0,
    omittedPhysicalPieces: 0,
    action: {
      kind: "place-callouts",
      assembledPieces: 4,
      evidenceDigest: "sha256:b4b7111b985114d65fa1234f40e56536b96cf42f30cad8fd0653cb2a8c34438a",
    },
    coverageFailures: [],
    missingDesigns: [],
    unresolvedCallouts: [],
  },
];

const MEASURED_FARTHER_ORIGIN_K_SCORES = Object.freeze([
  Object.freeze({ candidateId: MEASURED_ORIGIN_IDS[0]!, agreement: 0.81657223796034 }),
  Object.freeze({ candidateId: MEASURED_ORIGIN_IDS[1]!, agreement: 0.9367520589707421 }),
]);

const MEASURED_FARTHER_ORIGIN_K_DECISION = Object.freeze({
  originCandidateId: MEASURED_ORIGIN_IDS[1]!,
  rejectedCandidateId: MEASURED_ORIGIN_IDS[0]!,
  revealingStepNumber: 7,
});

const actionDigest = (spec: RealBuildPanelSpec): string | null => spec.action.evidenceDigest;

const canonicalPanelSpec = (spec: RealBuildPanelSpec): RealBuildPanelSpec => ({
  stepNumber: spec.stepNumber,
  pageNumber: spec.pageNumber,
  panelFace: spec.panelFace,
  minXPt: spec.minXPt,
  maxXPt: spec.maxXPt,
  minYPt: spec.minYPt,
  maxYPt: spec.maxYPt,
  calloutBoxes: spec.calloutBoxes.map(({ minXPt, maxXPt, minYPt, maxYPt }) => ({
    minXPt,
    maxXPt,
    minYPt,
    maxYPt,
  })),
  mappedCalloutKeys: [...spec.mappedCalloutKeys],
  action: structuredClone(spec.action),
  pieces: structuredClone(spec.pieces),
  omittedPieces: structuredClone(spec.omittedPieces),
  calloutPieces: spec.calloutPieces,
  classifiedPhysicalCalloutPieces: spec.classifiedPhysicalCalloutPieces,
  semanticMultiplierQuantity: spec.semanticMultiplierQuantity,
  omittedPhysicalPieces: spec.omittedPhysicalPieces,
  coverageFailures: structuredClone(spec.coverageFailures),
  missingDesigns: [...spec.missingDesigns],
  unresolvedCallouts: [...spec.unresolvedCallouts],
});

const exactPanelSpec = (spec: RealBuildPanelSpec, measuredIndex: number): boolean =>
  JSON.stringify(canonicalPanelSpec(spec)) ===
  JSON.stringify(canonicalPanelSpec(MEASURED_FARTHER_ORIGIN_PANEL_SPECS[measuredIndex]!));

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Pins the measured K output as well as the inputs that authorized scoring it. */
export function measuredFartherOriginKReportIneligibility(input: {
  readonly kPanel: Record<string, unknown> | undefined;
  readonly decision: unknown;
}): string | null {
  if (input.kPanel === undefined) return null;
  if (input.decision === null) return null;
  const expectedBest = MEASURED_FARTHER_ORIGIN_K_SCORES[1]!.agreement;
  const expectedMargin = expectedBest - MEASURED_FARTHER_ORIGIN_K_SCORES[0]!.agreement;
  if (
    JSON.stringify(input.kPanel.scores) !== JSON.stringify(MEASURED_FARTHER_ORIGIN_K_SCORES) ||
    input.kPanel.bestAgreement !== expectedBest ||
    input.kPanel.familyMargin !== expectedMargin
  ) {
    return "K scores or family margin differ from the measured origin observation";
  }
  const decision = record(input.decision);
  return decision !== null &&
    decision.originCandidateId === MEASURED_FARTHER_ORIGIN_K_DECISION.originCandidateId &&
    decision.revealingStepNumber === MEASURED_FARTHER_ORIGIN_K_DECISION.revealingStepNumber &&
    JSON.stringify(decision.survivingCandidateIds) ===
      JSON.stringify([MEASURED_FARTHER_ORIGIN_K_DECISION.originCandidateId]) &&
    JSON.stringify(decision.rejectedCandidateIds) ===
      JSON.stringify([MEASURED_FARTHER_ORIGIN_K_DECISION.rejectedCandidateId])
    ? null
    : "K decision differs from the measured origin selection";
}

/**
 * Enables the direct-origin K shortcut only for the exact measured private
 * booklet closure. Candidate IDs embed structural hashes, so a changed search
 * result, source, face, action, threshold or cost policy falls back to the
 * generic constructed-frontier path rather than inheriting this calibration.
 */
export function measuredFartherOriginProbeIneligibility(input: {
  readonly originSpec: RealBuildPanelSpec;
  readonly interveningSpec: RealBuildPanelSpec;
  readonly fartherSpec: RealBuildPanelSpec | null;
  readonly origins: readonly {
    readonly candidateId: string;
    readonly documentHash: string;
    readonly lookaheadAgreement: number;
    readonly pieces: readonly {
      readonly catalogPartId: string;
      readonly colorId: string;
      readonly transform: {
        readonly positionLdu: readonly [number, number, number];
        readonly orientationId: string;
      };
    }[];
  }[];
  readonly options: FartherOriginPolicyOptions;
  /** Frozen generation-specific expectation; producers always omit this and use the current pin. */
  readonly expectedSourceAttestation?: typeof MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION;
}): string | null {
  const { originSpec, interveningSpec, fartherSpec, origins, options } = input;
  const expectedSourceAttestation =
    input.expectedSourceAttestation ?? MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION;
  if (fartherSpec === null) return "no farther panel is available";
  if (
    JSON.stringify(options.measuredFartherOriginSourceAttestation) !==
    JSON.stringify(expectedSourceAttestation)
  ) {
    return (
      `source attestation ${JSON.stringify(options.measuredFartherOriginSourceAttestation)} differs from ` +
      `measured ${JSON.stringify(expectedSourceAttestation)}`
    );
  }
  const identities = origins.map(({ candidateId, documentHash, lookaheadAgreement, pieces }) => ({
    candidateId,
    documentHash,
    lookaheadAgreement,
    pieces,
  }));
  const eligible =
    exactPanelSpec(originSpec, 0) &&
    exactPanelSpec(interveningSpec, 1) &&
    exactPanelSpec(fartherSpec, 2) &&
    actionDigest(originSpec) === MEASURED_ACTION_DIGESTS[0] &&
    actionDigest(interveningSpec) === MEASURED_ACTION_DIGESTS[1] &&
    actionDigest(fartherSpec) === MEASURED_ACTION_DIGESTS[2] &&
    JSON.stringify(options.inputDigests) === JSON.stringify(MEASURED_INPUT_DIGESTS) &&
    options.minimumDeferredAgreement === 0.85 &&
    options.minimumDeferredAgreementMargin === 0.02 &&
    options.renderScale === 6 &&
    options.panelWidth === 1_000 &&
    options.workFactor === 2 &&
    options.deferredNarrowingRenderBudget === 8_192 &&
    options.fartherPanelMaximumReachSteps === 2 &&
    options.fartherPanelRenderBudget === 16 &&
    JSON.stringify(identities) === JSON.stringify(MEASURED_FARTHER_ORIGIN_CANDIDATES) &&
    identities.every(({ candidateId, documentHash }) => candidateId === `step-005:${documentHash}`);
  return eligible
    ? null
    : "source, panels, origin hashes, score thresholds or raster policy differ from the measured step-5/6/7 calibration";
}
