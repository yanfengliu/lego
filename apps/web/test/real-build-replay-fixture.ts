import {
  createEmptyBrickDocument,
  createPartInstance,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";

import { sha256Digest } from "../e2e/real-build-artifacts";
import type { RealBuildBrowserOutput } from "../e2e/real-build-browser-output";
import {
  BUILDER_GEOMETRY_EXACT_BYTES,
  encodeHighlightRendererCompatibilityInputClosure,
} from "../e2e/real-build-input-files";
import {
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST,
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
} from "../e2e/real-build-run-contract";
import { unexecutedStepReport } from "../e2e/real-build-contract";
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

const DIGEST = REAL_BUILD_TEST_DIGEST;
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const ACTUAL_TRANSFORMS = [
  { positionLdu: [0, 0, 0] as const, orientationId: "upright-yaw-0" as const },
  { positionLdu: [0, -24, 0] as const, orientationId: "upright-yaw-0" as const },
];
const OFFICIAL_TRANSFORMS = [
  ACTUAL_TRANSFORMS[0],
  { positionLdu: [0, 24, 0] as const, orientationId: "upright-yaw-0" as const },
];

const sharedOpaqueRoleBytes = new TextEncoder().encode("shared-opaque-role-bytes");
export const replayRawRoleBytes = {
  ...Object.fromEntries(
    Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST).map((role) => [
      role,
      new TextEncoder().encode(`retained-${role}`),
    ]),
  ),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.pdf]: new TextEncoder().encode("synthetic-booklet"),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.officialModel]: sharedOpaqueRoleBytes,
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.actionLedger]: sharedOpaqueRoleBytes,
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.highlightCalibration]:
    encodeHighlightRendererCompatibilityInputClosure(Buffer.from("{}"), Buffer.from("{}")),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.builderGeometry]: Buffer.alloc(BUILDER_GEOMETRY_EXACT_BYTES),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.calloutManifest]: syntheticIdentificationGoldenBytes("manifest"),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.coverage]: syntheticIdentificationGoldenBytes("coverage"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features]:
    syntheticIdentificationGoldenBytes("features"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match]: syntheticIdentificationGoldenBytes("match"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances]:
    syntheticIdentificationGoldenBytes("distances"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements]:
    syntheticIdentificationGoldenBytes("elementResolution"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged]:
    syntheticIdentificationGoldenBytes("pairJudged"),
} as Readonly<Record<string, Uint8Array>>;

export const replayInputDigests = Object.fromEntries(
  Object.entries(REAL_BUILD_INPUT_ROLE_BY_DIGEST).map(([inputKey, role]) => [
    inputKey,
    sha256Digest(replayRawRoleBytes[role]!),
  ]),
) as unknown as ReturnType<typeof completeRealBuildTestOptions>["inputDigests"];

const baseOptions = completeRealBuildTestOptions(1);
const sourcePanel = baseOptions.panels[357]!;
if (sourcePanel.action.kind !== "place-callouts") {
  throw new TypeError("The complete fixture must retain its direct-piece panel at step 358.");
}
const movedPieces = sourcePanel.pieces.slice(-2);
if (movedPieces.length !== 2) {
  throw new TypeError("The replay fixture requires two direct pieces for its connected prefix.");
}
const replayPieces = movedPieces.map((piece, index) => ({
  ...piece,
  ...(index === 1 ? { colorId: "builtin:red" } : {}),
  expectedTransform: OFFICIAL_TRANSFORMS[index]!,
}));
const panel: RealBuildPanelSpec = {
  ...realBuildTransitionPanel(1),
  action: { kind: "place-callouts", assembledPieces: 2, evidenceDigest: DIGEST },
  pieces: replayPieces,
  calloutPieces: 2,
  classifiedPhysicalCalloutPieces: 2,
  mappedCalloutKeys: replayPieces.map(({ calloutKey }) => calloutKey),
};
const rebalancedSourcePanel: RealBuildPanelSpec = {
  ...sourcePanel,
  pieces: sourcePanel.pieces.slice(0, -2),
  mappedCalloutKeys: sourcePanel.mappedCalloutKeys.slice(0, -2),
  calloutPieces: sourcePanel.calloutPieces - 2,
  classifiedPhysicalCalloutPieces: sourcePanel.classifiedPhysicalCalloutPieces - 2,
  action: { ...sourcePanel.action, assembledPieces: sourcePanel.action.assembledPieces - 2 },
};

export const replayOptions: RealBuildOptions = {
  ...baseOptions,
  inputDigests: replayInputDigests,
  highlightCalibrationDigest: replayInputDigests.highlightCalibration,
  panels: baseOptions.panels.map((candidate) => {
    if (candidate.stepNumber === 1) return panel;
    if (candidate.stepNumber === 358) return rebalancedSourcePanel;
    return candidate;
  }),
  coverageByCallout: {
    ...baseOptions.coverageByCallout,
    ...Object.fromEntries(
      replayPieces.map((piece) => [
        piece.calloutKey,
        {
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
  const base = createEmptyBrickDocument({ id: "replay", name: "replay", maxParts: 1_464 });
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
  const validation = validateBrickDocument(document);
  const report: RealBuildStepReport = {
    stepNumber: 1,
    pageNumber: panel.pageNumber,
    panelFace: panel.panelFace,
    calloutPieces: 2,
    expectedAssembledPieces: 2,
    attemptedPieces: 2,
    placedPieces: 2,
    action: panel.action,
    actionEvidenceDigest: DIGEST,
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
