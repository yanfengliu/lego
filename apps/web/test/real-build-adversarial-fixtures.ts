import { createEmptyBrickDocument, validateBrickDocument } from "@lego-studio/brick-kernel";

import type { RealBuildBrowserOutput } from "../e2e/real-build-browser-output";
import { stepPrerequisiteFacts, type RealBuildStepReport } from "../e2e/real-build-safety";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import { seededPanelCameraEvidence } from "./real-build-panel-camera-evidence.fixture";
import {
  REAL_BUILD_TEST_DIGEST,
  completeRealBuildTestOptions,
  realBuildTransitionPanel,
} from "./real-build-test-options";

export const DIGEST = REAL_BUILD_TEST_DIGEST;
export const PNG = "data:image/png;base64,iVBORw0KGgo=";
export const transitionPanel = realBuildTransitionPanel;

export const completeReport = (stepNumber: number): RealBuildStepReport => ({
  stepNumber,
  pageNumber: stepNumber,
  panelFace: "studs-up",
  calloutPieces: 0,
  expectedAssembledPieces: 0,
  attemptedPieces: 0,
  placedPieces: 0,
  action: transitionPanel(stepNumber).action,
  actionEvidenceDigest: DIGEST,
  canonicalStepId: `step-${stepNumber}`,
  prerequisites: stepPrerequisiteFacts({
    stepNumber,
    actionKind: "transition",
    blockingStep: null,
    coverageFailures: [],
    unresolvedCallouts: [],
    missingDesigns: [],
    calloutPieces: 0,
    expectedAssembledPieces: 0,
    resolvedPieces: 0,
  }),
  outcome: { status: "complete", mechanism: "instruction-transition", failure: null },
  validation: {
    attempted: true,
    targetDocumentHash: DIGEST,
    truthSnapshotHash: DIGEST,
    validatorSetHash: DIGEST,
    documentGloballyValid: true,
    blockingIssues: [],
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
  panelCamera: null,
  highlight: { regions: 0, closedContourRate: 0, strokePx: 0, boundsPx: null },
  arrows: { kept: 0, redPx: 0, rejected: 0, displacementFamily: 0, displacementFamilyLdu: [] },
  pieces: [],
  jointVisual: null,
  deferral: null,
  farther: null,
  fartherCaptures: [],
  explodedGhost: null,
  documentParts: 0,
  elapsedMs: 1,
  panelPng: null,
  buildPng: null,
});

export const options = completeRealBuildTestOptions;

export const documentJson = (lastStep: number): string => {
  const base = createEmptyBrickDocument({ id: "test", name: "test", maxParts: 1_464 });
  return JSON.stringify({
    ...base,
    steps: Array.from({ length: lastStep }, (_, index) => ({
      id: `step-${index + 1}`,
      index,
      name: `Step ${index + 1} [transition:rotation;panel=${DIGEST}]`,
      partIds: [],
    })),
  });
};

const prefixDocument = (
  document: ReturnType<typeof createEmptyBrickDocument>,
  lastStep: number,
): ReturnType<typeof createEmptyBrickDocument> => {
  const steps = document.steps.filter(({ index }) => index < lastStep);
  const stepIds = new Set(steps.map(({ id }) => id));
  const parts = document.parts.filter(({ stepId }) => stepIds.has(stepId));
  const partIds = new Set(parts.map(({ id }) => id));
  const restrict = <T extends { readonly partIds: readonly string[] }>(entry: T): T => ({
    ...entry,
    partIds: entry.partIds.filter((partId) => partIds.has(partId)),
  });
  return {
    ...document,
    steps,
    parts,
    connections: document.connections.filter(
      ({ a, b }) => partIds.has(a.partId) && partIds.has(b.partId),
    ),
    submodels: document.submodels.map(restrict),
    semanticRegions: document.semanticRegions.map(restrict),
  };
};

export const browserOutput = (
  lastStep: number,
  reports: readonly RealBuildStepReport[] = Array.from({ length: lastStep }, (_, index) =>
    completeReport(index + 1),
  ),
  bytes = documentJson(lastStep),
): RealBuildBrowserOutput => {
  const prepared = options(lastStep);
  let document = JSON.parse(bytes) as ReturnType<typeof createEmptyBrickDocument>;
  const normalizedReports: RealBuildStepReport[] = reports.map((report) =>
    report.outcome.status === "failed"
      ? report
      : {
          ...report,
          validation: (() => {
            const validation = validateBrickDocument(prefixDocument(document, report.stepNumber));
            return {
              attempted: true,
              targetDocumentHash: validation.targetDocumentHash,
              truthSnapshotHash: validation.truthSnapshotHash,
              validatorSetHash: validation.validatorSetHash,
              documentGloballyValid: validation.documentGloballyValid,
              blockingIssues: validation.issues
                .filter(({ severity }) => severity === "blocking")
                .map(({ code, message, path, partIds }) => ({ code, message, path, partIds })),
              failure: null,
            };
          })(),
        },
  );
  if (normalizedReports.length > 0 && normalizedReports[0]!.panelCamera === null) {
    const failure = {
      code: "camera-handedness-unresolved" as const,
      stage: "camera-registration" as const,
      stepNumber: 1,
      message:
        "The current generation retains all eight step-0 camera roots and refuses before scalar transition execution.",
    };
    normalizedReports[0] = unexecutedStepReport(transitionPanel(1), failure, {
      panelCamera: seededPanelCameraEvidence(prepared.panelCameraBranchBudget),
      documentParts: 0,
      elapsedMs: 1,
      reason: failure.message,
    });
    document = createEmptyBrickDocument({
      id: "real-build",
      name: "Real booklet rebuild",
      maxParts: prepared.maxParts,
    });
    for (let index = 1; index < normalizedReports.length; index += 1) {
      const stepNumber = index + 1;
      const panel = prepared.panels.find((candidate) => candidate.stepNumber === stepNumber)!;
      const blockedFailure = {
        code: "blocked-by-prior-step" as const,
        stage: "causality" as const,
        stepNumber,
        causedByStep: 1,
        message: `Printed step ${stepNumber} is causally blocked by unresolved camera root at step 1.`,
      };
      const blockedReport = unexecutedStepReport(panel, blockedFailure, {
        blockingStep: 1,
        documentParts: 0,
        elapsedMs: 0,
        reason: blockedFailure.message,
      });
      normalizedReports[index] = {
        ...blockedReport,
        outcome: {
          status: "failed",
          mechanism: "blocked",
          attemptedMechanism: null,
          failure: blockedFailure,
        },
      };
    }
  }
  return {
    schemaVersion: "lego.real-build-browser-output/3",
    status: "executed",
    reports: normalizedReports,
    documentJson: JSON.stringify(document),
    identityBindings: [],
    fetchedPdfDigest: DIGEST,
    totalElapsedMs: lastStep,
  };
};
