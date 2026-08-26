import { createEmptyBrickDocument, createPartInstance } from "@lego-studio/brick-kernel";

import type { InstructionSourceV1 } from "../src/instructions/instruction-source";

import { sha256Digest } from "../e2e/real-build-artifacts";
import { encodeRealBuildActionLedger } from "../e2e/real-build-action-ledger";
import {
  actionEvidenceDigest,
  pieceEvidenceDigest,
  stepPanelEvidenceDigest,
  type LedgerStep,
} from "../e2e/real-build-ledger";
import {
  createFrozenLegacyEmptyBrickDocumentV2,
  validateFrozenLegacyBrickDocumentV2,
} from "../e2e/real-build-artifact-legacy-document-v2";
import type { RealBuildBrowserOutput } from "../e2e/real-build-browser-output";
import {
  BUILDER_GEOMETRY_EXACT_BYTES,
  encodeHighlightRendererCompatibilityInputClosure,
} from "../e2e/real-build-input-files";
import {
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST,
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  REAL_BUILD_PANEL_SOURCE_ROLE,
} from "../e2e/real-build-run-contract";
import { encodeRealBuildRetainedPanelSource } from "../e2e/real-build-replay-panel-source";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import { encodeCanonicalRealBuildJson } from "../e2e/real-build-json-admission";
import {
  assembleTransitionClassificationBundle,
  encodeTransitionClassificationBundle,
} from "../e2e/real-build-transition-classification";
import {
  stepPrerequisiteFacts,
  type RealBuildOptions,
  type RealBuildPanelSpec,
  type RealBuildPieceReport,
  type RealBuildStepReport,
} from "../e2e/real-build-safety";
import { syntheticIdentificationGoldenBytes } from "./real-build-identification-golden";
import {
  REAL_BUILD_TEST_DIGEST,
  completeRealBuildTestOptions,
  realBuildTransitionPanel,
} from "./real-build-test-options";
import {
  observedPanelCameraEvidence,
  seededPanelCameraEvidence,
} from "./real-build-panel-camera-evidence.fixture";
import {
  realBuildLedgerPrefix,
  realBuildLedgerTestFixture,
} from "./real-build-ledger-test-fixture";

const DIGEST = REAL_BUILD_TEST_DIGEST;
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const ACTUAL_TRANSFORMS = [
  { positionLdu: [0, 0, 0] as const, orientationId: "upright-yaw-0" as const },
  { positionLdu: [0, -24, 0] as const, orientationId: "upright-yaw-0" as const },
];
const ledgerFixture = realBuildLedgerTestFixture();
const REPLAY_BRICK_REFS = ["brick-a", "brick-b"] as const;
const OFFICIAL_TRANSFORMS = REPLAY_BRICK_REFS.map((brickRef) => {
  const transform = ledgerFixture.official.bricks[brickRef]?.canonicalTransform ?? null;
  if (transform === null) {
    throw new TypeError(`Replay fixture official Brick ${brickRef} lost its calibrated transform.`);
  }
  return transform;
});

const baseOptions = completeRealBuildTestOptions(1);
const completeOptions = completeRealBuildTestOptions(359);
const sourcePanel = completeOptions.panels[357]!;
if (sourcePanel.action.kind !== "place-callouts") {
  throw new TypeError("The complete fixture must retain its direct-piece panel at step 358.");
}
const movedPieces = sourcePanel.pieces.slice(-2);
if (movedPieces.length !== 2) {
  throw new TypeError("The replay fixture requires two direct pieces for its connected prefix.");
}

const replayPdfBytes = new TextEncoder().encode("synthetic-booklet");
const replayPdfDigest = sha256Digest(replayPdfBytes);
const replayCallouts = [
  {
    identity: "p2|q1|x0.200|y0.200",
    file: "runs/000000000000000000000001/p2-q1-x0d200-y0d200.png",
    pageNumber: 2,
    stepNumber: 1,
    quantity: 1,
    xPt: 0.2,
    yPt: 0.2,
    heightPt: 0.1,
    boxMethod: "vector-smallest",
    box: { minXPt: 0.1, maxXPt: 0.3, minYPt: 0.1, maxYPt: 0.3 },
    evidenceKind: "part-art",
    sha256: sha256Digest("replay-crop-a"),
  },
  {
    identity: "p2|q1|x0.700|y0.700",
    file: "runs/000000000000000000000001/p2-q1-x0d700-y0d700.png",
    pageNumber: 2,
    stepNumber: 1,
    quantity: 1,
    xPt: 0.7,
    yPt: 0.7,
    heightPt: 0.1,
    boxMethod: "vector-smallest",
    box: { minXPt: 0.6, maxXPt: 0.8, minYPt: 0.6, maxYPt: 0.8 },
    evidenceKind: "part-art",
    sha256: sha256Digest("replay-crop-b"),
  },
] as const;

export const replayInstructionSource: InstructionSourceV1 = {
  schemaVersion: "lego.instruction-source/1",
  contentHash: replayPdfDigest,
  fileName: "synthetic-booklet.pdf",
  byteLength: replayPdfBytes.byteLength,
  pageCount: 360,
  pages: Array.from({ length: 360 }, (_, index) => {
    const pageNumber = index + 1;
    const stepNumber = index;
    const quantityElements =
      stepNumber === 1
        ? [
            { text: "1x", heightPt: 0.1, xPt: 0.2, yPt: 0.2 },
            { text: "1x", heightPt: 0.1, xPt: 0.7, yPt: 0.7 },
          ]
        : [];
    return {
      pageNumber,
      widthPt: 1,
      heightPt: 1,
      text:
        stepNumber === 0
          ? ""
          : [String(stepNumber), ...quantityElements.map(({ text }) => text)].join(" "),
      textElements:
        stepNumber === 0
          ? []
          : [{ text: String(stepNumber), heightPt: 10, xPt: 0.5, yPt: 0.5 }, ...quantityElements],
      textTruncated: false,
    };
  }),
  provenance: { origin: "user-supplied", ingestedBy: "lego-studio:pdf-ingest/1" },
};
export const replayPanelSourceBytes = encodeRealBuildRetainedPanelSource({
  pdfBytes: replayPdfBytes,
  source: replayInstructionSource,
  requestedLastStep: 1,
  pageShapes: [2, 3, 4].map((pageNumber) => ({ pageNumber, shapes: [] })),
});
export const replayPanelSourceDigest = sha256Digest(replayPanelSourceBytes);

export const replayManifestBytes = encodeCanonicalRealBuildJson(
  {
    schemaVersion: "lego.callout-thumbnails/6",
    sourceHash: replayPdfDigest,
    pageSelection: "full booklet",
    pagesCropped: 1,
    calloutCount: replayCallouts.length,
    accounting: {
      rawNxIdentityCount: 2,
      rawNxQuantityTotal: 2,
      physicalPartArtIdentityCount: 2,
      physicalPartArtQuantityTotal: 2,
      semanticIdentityCount: 0,
      semanticQuantityTotal: 0,
    },
    failures: [],
    callouts: replayCallouts,
  },
  "pretty-one-space-line",
);
const replayManifestDigest = sha256Digest(replayManifestBytes);

const transitionClassificationsBytes = encodeTransitionClassificationBundle(
  assembleTransitionClassificationBundle({
    pdfDigest: replayPdfDigest,
    classifierId: "synthetic-replay-transition-fixture",
    printedStepCount: 359,
    unclassifiedSteps: [],
    entries: [ledgerFixture.transitionClassificationsByStep[3]!],
  }),
);

const rawRoleBytesWithoutCoverageOrActionLedger = {
  ...Object.fromEntries(
    Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST).map((role) => [
      role,
      new TextEncoder().encode(`retained-${role}`),
    ]),
  ),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.pdf]: replayPdfBytes,
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.officialModel]: ledgerFixture.officialModelBytes,
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.builderCalibration]: ledgerFixture.builderCalibrationBytes,
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.highlightCalibration]:
    encodeHighlightRendererCompatibilityInputClosure(Buffer.from("{}"), Buffer.from("{}")),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.builderGeometry]: Buffer.alloc(BUILDER_GEOMETRY_EXACT_BYTES),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.calloutManifest]: replayManifestBytes,
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.transitionClassifications]: transitionClassificationsBytes,
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features]:
    syntheticIdentificationGoldenBytes("features"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match]: syntheticIdentificationGoldenBytes("match"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances]:
    syntheticIdentificationGoldenBytes("distances"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements]:
    syntheticIdentificationGoldenBytes("elementResolution"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged]:
    syntheticIdentificationGoldenBytes("pairJudged"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound]: encodeCanonicalRealBuildJson({
    schemaVersion: "lego.part-identification-source-art-rebound/1",
    syntheticReplayFixture: true,
    authority: {
      sourceExecution: "absent",
      preparedRun: "absent",
      physicalFrame: "absent",
      placement: "absent",
      completion: "absent",
    },
  }),
} as Readonly<Record<string, Uint8Array>>;

const rawRoleDigest = (role: string): string =>
  sha256Digest(rawRoleBytesWithoutCoverageOrActionLedger[role]!);
export const replayCoverageBytes = encodeCanonicalRealBuildJson(
  {
    schemaVersion: "lego.real-build-catalog-coverage/3",
    inputDigests: {
      pdf: replayPdfDigest,
      calloutManifest: replayManifestDigest,
      features: rawRoleDigest(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features),
      match: rawRoleDigest(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match),
      distances: rawRoleDigest(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances),
      elementResolution: rawRoleDigest(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements),
      pairJudged: rawRoleDigest(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged),
      sourceArtRebound: rawRoleDigest(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound),
    },
    what: "Synthetic two-piece replay coverage used to exercise retained semantic bindings.",
    identification: { source: "deterministic", model: null, assignment: "nearest" },
    lastStep: 1,
    calloutsConsidered: 2,
    calloutsUnidentified: 0,
    coverage: {
      schemaVersion: "lego.element-catalog/1",
      steps: [
        {
          stepNumber: 1,
          pieces: 2,
          placeablePieces: 2,
          covered: true,
          parts: [
            {
              catalogPartId: "builtin:brick-1x1",
              colorId: "builtin:black",
              quantity: 1,
              outcome: "exact",
            },
            {
              catalogPartId: "builtin:brick-1x1",
              colorId: "builtin:red",
              quantity: 1,
              outcome: "exact",
            },
          ],
          missing: [],
        },
      ],
      stepsCovered: 1,
      stepsTotal: 1,
      firstCoveredStep: 1,
      coveredPrefixLength: 1,
      piecesPlaceable: 2,
      piecesTotal: 2,
      missingDesigns: [],
    },
    byCallout: Object.fromEntries(
      replayCallouts.map((callout, index) => [
        callout.identity,
        {
          identity: callout.identity,
          file: callout.file,
          pageNumber: callout.pageNumber,
          stepNumber: callout.stepNumber,
          quantity: callout.quantity,
          cropDigest: callout.sha256,
          inputDigest: replayManifestDigest,
          elementId: "300501",
          identificationConfidence: "vision-kept",
          resolution: {
            schemaVersion: "lego.element-catalog/1",
            elementId: "300501",
            partNum: "3005",
            name: "Brick 1 x 1",
            colorId: index === 0 ? "builtin:black" : "builtin:red",
            outcome: "exact",
            catalogPartId: "builtin:brick-1x1",
            note: null,
          },
          unidentifiedBecause: null,
        },
      ]),
    ),
  },
  "pretty-one-space-line",
);

const rawRoleBytesWithoutActionLedger = {
  ...rawRoleBytesWithoutCoverageOrActionLedger,
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.coverage]: replayCoverageBytes,
} as Readonly<Record<string, Uint8Array>>;

const roleDigest = (role: string): string => sha256Digest(rawRoleBytesWithoutActionLedger[role]!);
const replayPieces = movedPieces.map((piece, index) => ({
  ...piece,
  identityKey: REPLAY_BRICK_REFS[index]!,
  colorId: index === 0 ? "builtin:black" : "builtin:red",
  calloutKey: replayCallouts[index]!.identity,
  identificationConfidence: "vision-kept" as const,
  cropDigest: replayCallouts[index]!.sha256,
  identificationInputDigest: replayManifestDigest,
  expectedTransform: OFFICIAL_TRANSFORMS[index]!,
}));
const replayPanelPageNumber = 2;
const replayPanelBounds = { minXPt: 0, maxXPt: 1, minYPt: 0, maxYPt: 1 } as const;
const replayPanelCalloutBoxes = replayCallouts.map(({ box }) => box);
const replayPanelEvidenceDigest = stepPanelEvidenceDigest({
  pdfDigest: replayPdfDigest,
  stepNumber: 1,
  pageNumber: replayPanelPageNumber,
  bounds: replayPanelBounds,
  calloutBoxes: replayPanelCalloutBoxes,
});
const replayLedgerPieces = replayPieces.map((piece) => {
  const withoutEvidence = {
    brickRef: piece.identityKey,
    designId: piece.designId,
    materialId: piece.materialId,
    catalogPartId: piece.catalogPartId,
    colorId: piece.colorId,
    calloutKey: piece.calloutKey,
    identificationConfidence: piece.identificationConfidence,
    cropDigest: piece.cropDigest,
    identificationInputDigest: piece.identificationInputDigest,
    transform: null,
  } as const;
  return {
    ...withoutEvidence,
    evidenceDigest: pieceEvidenceDigest({
      pdfDigest: replayPdfDigest,
      panelEvidenceDigest: replayPanelEvidenceDigest,
      officialModelDigest: roleDigest(REAL_BUILD_INPUT_ROLE_BY_DIGEST.officialModel),
      coverageDigest: roleDigest(REAL_BUILD_INPUT_ROLE_BY_DIGEST.coverage),
      calloutManifestDigest: replayManifestDigest,
      sourceArtReboundDigest: roleDigest(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound),
      builderCalibrationDigest: roleDigest(REAL_BUILD_INPUT_ROLE_BY_DIGEST.builderCalibration),
      stepNumber: 1,
      pageNumber: replayPanelPageNumber,
      piece: withoutEvidence,
    }),
  };
});
const replayLedgerStep: LedgerStep = {
  stepNumber: 1,
  pageNumber: replayPanelPageNumber,
  panelEvidenceDigest: replayPanelEvidenceDigest,
  callouts: replayPieces.map((piece) => ({
    calloutKey: piece.calloutKey,
    physicalBrickRefs: [piece.identityKey],
    semanticMultiplierQuantity: 0,
  })),
  action: {
    kind: "place-callouts",
    pieces: replayLedgerPieces,
    omittedPieces: [],
  },
};
const sourceLedger = ledgerFixture.ledger;
const replayActionLedger = realBuildLedgerPrefix(
  {
    ...sourceLedger,
    pdfDigest: roleDigest(REAL_BUILD_INPUT_ROLE_BY_DIGEST.pdf),
    officialModelDigest: roleDigest(REAL_BUILD_INPUT_ROLE_BY_DIGEST.officialModel),
    coverageDigest: roleDigest(REAL_BUILD_INPUT_ROLE_BY_DIGEST.coverage),
    calloutManifestDigest: roleDigest(REAL_BUILD_INPUT_ROLE_BY_DIGEST.calloutManifest),
    sourceArtReboundDigest: roleDigest(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound),
    builderCalibrationDigest: roleDigest(REAL_BUILD_INPUT_ROLE_BY_DIGEST.builderCalibration),
    transitionClassificationsDigest: roleDigest(
      REAL_BUILD_INPUT_ROLE_BY_DIGEST.transitionClassifications,
    ),
  },
  1,
  [replayLedgerStep],
);
const actionLedgerBytes = encodeRealBuildActionLedger(replayActionLedger);
export const replayRawRoleBytes = {
  ...rawRoleBytesWithoutActionLedger,
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.actionLedger]: actionLedgerBytes,
  [REAL_BUILD_PANEL_SOURCE_ROLE]: replayPanelSourceBytes,
} as Readonly<Record<string, Uint8Array>>;

export const replayIdentificationClosureDigests = {
  source: "deterministic" as const,
  features: sha256Digest(replayRawRoleBytes[REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features]!),
  match: sha256Digest(replayRawRoleBytes[REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match]!),
  distances: sha256Digest(replayRawRoleBytes[REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances]!),
  elements: sha256Digest(replayRawRoleBytes[REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements]!),
  cards: null,
  cardImages: null,
  answers: null,
  pairJudged: sha256Digest(
    replayRawRoleBytes[REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged]!,
  ),
  sourceArtRebound: sha256Digest(
    replayRawRoleBytes[REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound]!,
  ),
};

export const replayInputDigests = Object.fromEntries(
  Object.entries(REAL_BUILD_INPUT_ROLE_BY_DIGEST).map(([inputKey, role]) => [
    inputKey,
    sha256Digest(replayRawRoleBytes[role]!),
  ]),
) as unknown as ReturnType<typeof completeRealBuildTestOptions>["inputDigests"];

const panel: RealBuildPanelSpec = {
  ...realBuildTransitionPanel(1),
  pageNumber: replayPanelPageNumber,
  ...replayPanelBounds,
  calloutBoxes: replayPanelCalloutBoxes,
  action: {
    kind: "place-callouts",
    assembledPieces: 2,
    evidenceDigest: actionEvidenceDigest({
      ledgerDigest: replayInputDigests.actionLedger,
      officialModelDigest: replayInputDigests.officialModel,
      builderCalibrationDigest: replayInputDigests.builderCalibration,
      transitionClassificationsDigest: replayInputDigests.transitionClassifications,
      step: replayLedgerStep,
    }),
  },
  pieces: replayPieces,
  calloutPieces: 2,
  classifiedPhysicalCalloutPieces: 2,
  mappedCalloutKeys: replayPieces.map(({ calloutKey }) => calloutKey),
};
export const replayOptions: RealBuildOptions = {
  ...baseOptions,
  inputDigests: replayInputDigests,
  highlightCalibrationDigest: replayInputDigests.highlightCalibration,
  panels: [panel],
  passivePanels: baseOptions.passivePanels.map((passive) => ({
    ...passive,
    pageNumber: passive.stepNumber + 1,
  })),
  coverageByCallout: {
    ...baseOptions.coverageByCallout,
    ...Object.fromEntries(
      replayPieces.map((piece) => [
        piece.calloutKey,
        {
          identity: piece.calloutKey,
          pageNumber: panel.pageNumber,
          stepNumber: 1,
          quantity: 1,
          identificationConfidence: piece.identificationConfidence,
          cropDigest: piece.cropDigest,
          inputDigest: piece.identificationInputDigest,
        },
      ]),
    ),
  },
  coverageInputBindings: {
    pdf: replayInputDigests.pdf,
    calloutManifest: replayInputDigests.calloutManifest,
  },
};

const pieceReport = (index: number): RealBuildPieceReport => ({
  catalogPartId: replayPieces[index]!.catalogPartId,
  blind: {
    comparisonPrefixHash: DIGEST,
    distinctCandidates: 2,
    feasible: true,
    rendered: 2,
    bestScore: 0.9,
    runnerUpScore: 0.5,
    agreesWithHighlight: true,
    refusal: null,
    elapsedMs: 1,
  },
  enumerated: 2,
  afterProximity: 2,
  rendered: 2,
  bestScore: 0.9,
  runnerUpScore: 0.5,
  placed: true,
  positionLdu: ACTUAL_TRANSFORMS[index]!.positionLdu,
  orientationId: ACTUAL_TRANSFORMS[index]!.orientationId,
  failure: null,
});

export function legacyDiagnosticReplayBrowserOutput(): RealBuildBrowserOutput {
  const base = createFrozenLegacyEmptyBrickDocumentV2({
    id: "replay",
    name: "replay",
    maxParts: 1_464,
  });
  const parts = replayPieces.map((piece, index) =>
    createPartInstance({
      id: `part-${index + 1}`,
      stepId: base.steps[0]!.id,
      catalogPartId: piece.catalogPartId,
      colorId: piece.colorId,
      transform: ACTUAL_TRANSFORMS[index]!,
    }),
  );
  const document = {
    ...base,
    parts,
    connections: [
      {
        id: "connection-1-2",
        kind: "stud-tube" as const,
        a: { partId: parts[0]!.id, portId: "stud:0:0" },
        b: { partId: parts[1]!.id, portId: "undersideClutch:0:0" },
        provenance: { source: "manual" as const },
      },
    ],
    steps: [{ ...base.steps[0]!, name: "Step 1", partIds: parts.map(({ id }) => id) }],
    submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id }) => id) }],
  };
  const validation = validateFrozenLegacyBrickDocumentV2(document);
  const report: RealBuildStepReport = {
    stepNumber: 1,
    pageNumber: panel.pageNumber,
    panelFace: panel.panelFace,
    calloutPieces: 2,
    expectedAssembledPieces: 2,
    attemptedPieces: 2,
    placedPieces: 2,
    action: panel.action,
    actionEvidenceDigest: panel.action.evidenceDigest,
    canonicalStepId: "step-1",
    prerequisites: stepPrerequisiteFacts({
      stepNumber: 1,
      actionKind: "place-callouts",
      blockingStep: null,
      coverageFailures: [],
      unresolvedCallouts: [],
      missingDesigns: [],
      calloutPieces: 2,
      expectedAssembledPieces: 2,
      resolvedPieces: 2,
    }),
    outcome: { status: "complete", mechanism: "deferred-lookahead", failure: null },
    validation: {
      attempted: true,
      targetDocumentHash: validation.targetDocumentHash,
      truthSnapshotHash: validation.truthSnapshotHash,
      validatorSetHash: validation.validatorSetHash,
      documentGloballyValid: validation.documentGloballyValid,
      blockingIssues: validation.issues
        .filter(({ severity }) => severity === "blocking")
        .map(({ code, message, path, partIds }) => ({ code, message, path, partIds })),
      failure: null,
    },
    fit: {
      azimuthDegrees: null,
      elevationDegrees: null,
      pixelsPerUnit: null,
      residualPx: null,
      coherence: 0,
      failure: null,
    },
    camera: null,
    panelCamera: observedPanelCameraEvidence(
      1,
      replayOptions.panelCameraBranchBudget,
      validation.targetDocumentHash as `sha256:${string}`,
    ),
    highlight: { regions: 0, closedContourRate: 0, strokePx: 0, boundsPx: null },
    arrows: { kept: 0, redPx: 0, rejected: 0, displacementFamily: 0, displacementFamilyLdu: [] },
    pieces: [pieceReport(0), pieceReport(1)],
    jointVisual: null,
    deferral: {
      trigger: "unseparated-by-own-panel",
      ownPanelMargin: 0.1,
      ownPanelMinimumMargin: 0.2,
      lookaheadStepNumber: 2,
      reachSteps: 1,
      lookaheadUpSign: 1,
      lookaheadMeasure: "iou",
      lookaheadTurnDegrees: 0,
      lookaheadTurnAnchorIou: 0.8,
      lookaheadTurnMargin: 0.2,
      narrowingRenders: 2,
      offeredPerPiece: [2, 2],
      carriedPerPiece: [2, 2],
      wholeStepCandidates: 2,
      rendered: 2,
      lookaheadBuiltPixels: 100,
      bestAgreement: 0.9,
      runnerUpAgreement: 0.5,
      margin: 0.4,
      minimumMargin: 0.2,
      minimumAgreement: 0.85,
      settled: false,
    },
    farther: {
      origin: {
        evidence: { stepNumber: 1, status: "unseparated", margin: 0.1, minimumMargin: 0.2 },
        candidates: [
          {
            candidateId: "origin-a",
            documentHash: validation.targetDocumentHash,
            pieces: replayPieces.map((piece, index) => ({
              catalogPartId: piece.catalogPartId,
              colorId: piece.colorId,
              transform: ACTUAL_TRANSFORMS[index]!,
            })),
            lookaheadAgreement: 0.9,
            lookaheadShiftPx: [0, 0],
          },
          {
            candidateId: "origin-b",
            documentHash: DIGEST,
            pieces: replayPieces.map((piece, index) => ({
              catalogPartId: piece.catalogPartId,
              colorId: piece.colorId,
              transform: OFFICIAL_TRANSFORMS[index]!,
            })),
            lookaheadAgreement: 0.5,
            lookaheadShiftPx: [0, 0],
          },
        ],
      },
      carries: [],
      panels: [
        {
          stepNumber: 2,
          reachSteps: 1,
          status: "revealing",
          reason: null,
          scores: [
            { candidateId: "origin-a", agreement: 0.9 },
            { candidateId: "origin-b", agreement: 0.5 },
          ],
          bestAgreement: 0.9,
          familyMargin: 0.4,
          descendantMargin: null,
        },
      ],
      budgets: {
        offeredCandidates: 0,
        maximumCandidates: replayOptions.deferredCandidateBudget,
        narrowingRenders: 0,
        maximumNarrowingRenders: replayOptions.deferredNarrowingRenderBudget,
        panelRenders: 2,
        maximumPanelRenders: replayOptions.fartherPanelRenderBudget,
        reachSteps: 1,
        maximumReachSteps: replayOptions.fartherPanelMaximumReachSteps,
        refusedReservation: false,
        failedNarrowingReservation: null,
        candidateRefusedReservation: false,
        failedCandidateReservation: null,
      },
      refusal: null,
      decision: {
        originCandidateId: "origin-a",
        revealingStepNumber: 2,
        survivingCandidateIds: ["origin-a"],
        rejectedCandidateIds: ["origin-b"],
        descendantSettled: true,
      },
    },
    fartherCaptures: [
      { captureId: 0, role: "source-panel", panelStepNumber: 2, candidateId: null, png: PNG },
      {
        captureId: 1,
        role: "candidate-render",
        panelStepNumber: 2,
        candidateId: "origin-a",
        png: PNG,
      },
      {
        captureId: 2,
        role: "candidate-render",
        panelStepNumber: 2,
        candidateId: "origin-b",
        png: PNG,
      },
    ],
    explodedGhost: null,
    documentParts: 2,
    elapsedMs: 1,
    panelPng: null,
    buildPng: null,
  };
  return {
    schemaVersion: "lego.real-build-browser-output/3",
    status: "executed",
    reports: [report],
    documentJson: JSON.stringify(document),
    identityBindings: replayPieces.map((piece, index) => ({
      identityKey: piece.identityKey,
      partId: parts[index]!.id,
      stepNumber: 1,
      designId: piece.designId,
      materialId: piece.materialId,
      catalogPartId: piece.catalogPartId,
      colorId: piece.colorId,
    })),
    fetchedPdfDigest: replayInputDigests.pdf,
    totalElapsedMs: 1,
  };
}

/** Current /3 publication fixture: eight retained roots and no scalar placement authority. */
export function replayBrowserOutput(): RealBuildBrowserOutput {
  const document = createEmptyBrickDocument({ id: "replay", name: "replay", maxParts: 1_464 });
  const failure = {
    code: "camera-handedness-unresolved" as const,
    stage: "camera-registration" as const,
    stepNumber: 1,
    message:
      "Replay fixture retained all eight step-0 panel-camera roots; no scalar lineage was selected, so printed step 1 placed no pieces.",
  };
  return {
    schemaVersion: "lego.real-build-browser-output/3",
    status: "executed",
    reports: [
      unexecutedStepReport(panel, failure, {
        panelCamera: seededPanelCameraEvidence(replayOptions.panelCameraBranchBudget),
        documentParts: 0,
        elapsedMs: 1,
        reason: failure.message,
      }),
    ],
    documentJson: JSON.stringify(document),
    identityBindings: [],
    fetchedPdfDigest: replayInputDigests.pdf,
    totalElapsedMs: 1,
  };
}
