import { expect } from "vitest";
import {
  applyBuildOperations,
  createEmptyBrickDocument,
  validateBrickDocument,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { createPanelCameraLineageContinuityState } from "../e2e/real-build-browser-output-panel-camera";
import { inspectBrowserOutputCanonicalDocument } from "../e2e/real-build-browser-output-transition-continuity";
import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import {
  projectRealBuildPanelCameraFrontierEvidence,
  projectRealBuildPanelCameraResolutionEvidence,
} from "../e2e/real-build-panel-camera-evidence";
import { resolveRealBuildPanelCameraFrontier } from "../e2e/real-build-panel-camera-frontier";
import { resolveRealBuildPanelCameraBranches } from "../e2e/real-build-panel-camera-resolver";
import { stepPrerequisiteFacts, type RealBuildStepReport } from "../e2e/real-build-safety";
import { executeCanonicalTransition } from "../e2e/real-build-contract";
import {
  completeReport,
  DIGEST,
  options,
  transitionPanel,
} from "./real-build-adversarial-fixtures";
import {
  PANEL_CAMERA_TEST_CAMERA,
  panelCameraTestMeasurementContext,
  seededPanelCameraEvidence,
} from "./real-build-panel-camera-evidence.fixture";

export const CONTINUATION_HASH = `sha256:${"c".repeat(64)}` as Sha256Digest;
export const asDigest = (value: string): Sha256Digest => value as Sha256Digest;
export const MEASUREMENT_BOUNDARY = {
  pdfDigest: `sha256:${"a".repeat(64)}`,
  panels: [
    {
      stepNumber: 1,
      pageNumber: 1,
      minXPt: 10,
      maxXPt: 11,
      minYPt: 10,
      maxYPt: 11,
      panelFace: "underside" as const,
    },
    {
      stepNumber: 2,
      pageNumber: 2,
      minXPt: 0,
      maxXPt: 1,
      minYPt: 0,
      maxYPt: 1,
      panelFace: "studs-up" as const,
    },
    {
      stepNumber: 3,
      pageNumber: 3,
      minXPt: 0,
      maxXPt: 1,
      minYPt: 0,
      maxYPt: 1,
      panelFace: "studs-up" as const,
    },
  ],
};
const MEASUREMENT_CONTEXT = {
  ...panelCameraTestMeasurementContext(2),
  cropPt: [0, 1, 0, 1] as const,
};

export const continuationReport = (
  panelCamera: unknown,
  targetDocumentHash: string,
  stepNumber = 2,
) => ({
  ...completeReport(stepNumber),
  camera: PANEL_CAMERA_TEST_CAMERA,
  panelCamera,
  canonicalStepId: null,
  outcome: {
    status: "failed" as const,
    mechanism: "deferred" as const,
    attemptedMechanism: "deferred-lookahead" as const,
    failure: {
      code: "weak-deferred-agreement" as const,
      stage: "scoring" as const,
      stepNumber,
      message: "Fixture retains a complete camera frontier without accepting structure.",
    },
  },
  validation: {
    ...completeReport(stepNumber).validation,
    targetDocumentHash,
  },
});

export function continuityAfterRoot(
  root = seededPanelCameraEvidence(),
  witnesses: Parameters<typeof createPanelCameraLineageContinuityState>[1] = new Map(),
) {
  const state = createPanelCameraLineageContinuityState(
    root.candidates[0]!.documentHash,
    witnesses,
  );
  state.seededRoot = true;
  state.reservedAfter = root.reservation.reservedAfter;
  for (const observation of root.observations) {
    state.eligibleParents.add(observation.lineageId);
    state.seenLineages.add(observation.lineageId);
  }
  return state;
}

export function continuedEvidence(
  parentLineageIds: readonly string[],
  reservedBefore = 8,
  documentHash: Sha256Digest = CONTINUATION_HASH,
  settle = true,
  throughStepNumber = 1,
  registrationPanelStepNumber = 2,
) {
  const ledger = createRealBuildPanelCameraBranchBudgetLedger(8_192);
  if (reservedBefore > 0) expect(ledger.tryReserve(reservedBefore)).toBe(true);
  const builtMask = new Uint8Array([1, 1, 0, 0]);
  return projectRealBuildPanelCameraFrontierEvidence(
    resolveRealBuildPanelCameraFrontier({
      prefixes: parentLineageIds.map((parentLineageId) => ({
        throughStepNumber,
        parentLineageId,
        document: { parts: [{ id: "continued" }] },
        documentHash,
      })),
      registrationPanelStepNumber,
      renderModelMask: ({ hypothesis }) =>
        !settle || (hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0)
          ? builtMask
          : new Uint8Array([1, 0, 0, 0]),
      builtMask,
      excludedMask: null,
      widthPx: 2,
      heightPx: 2,
      ledger,
      hashDocument: () => documentHash,
    }),
    {
      ...panelCameraTestMeasurementContext(registrationPanelStepNumber),
      cropPt: MEASUREMENT_CONTEXT.cropPt,
    },
  );
}

export function executedStep2Transition() {
  const source = createEmptyBrickDocument({
    id: "real-build",
    name: "Real booklet rebuild",
    maxParts: 1_464,
  });
  const executed = executeCanonicalTransition({
    baseDocument: source,
    printedStepNumber: 2,
    transition: "rotation",
    panelEvidenceDigest: DIGEST,
    steps: source.steps,
    applyOperations: (base, operations) => applyBuildOperations(base, operations as never),
    validate: validateBrickDocument,
  });
  if (executed.failure !== null || executed.stepId === null) {
    throw new Error(`Fixture transition failed: ${executed.failure?.message ?? "no step ID"}`);
  }
  const boundary = inspectBrowserOutputCanonicalDocument(JSON.stringify(executed.document), [2]);
  if (boundary.defect !== null) throw new Error(boundary.defect);
  return { source, executed, boundary };
}

export function refusedEvidence(parentLineageIds: readonly string[]) {
  const ledger = createRealBuildPanelCameraBranchBudgetLedger(8);
  expect(ledger.tryReserve(8)).toBe(true);
  return projectRealBuildPanelCameraFrontierEvidence(
    resolveRealBuildPanelCameraFrontier({
      prefixes: parentLineageIds.map((parentLineageId) => ({
        throughStepNumber: 1,
        parentLineageId,
        document: { parts: [{ id: "refused" }] },
        documentHash: CONTINUATION_HASH,
      })),
      registrationPanelStepNumber: 2,
      renderModelMask: () => new Uint8Array(4),
      builtMask: new Uint8Array(4),
      excludedMask: null,
      widthPx: 2,
      heightPx: 2,
      ledger,
      hashDocument: () => CONTINUATION_HASH,
    }),
  );
}

export function wrongDocumentRoot() {
  const document = { parts: [] as readonly unknown[] };
  const documentHash = `sha256:${"0".repeat(64)}` as Sha256Digest;
  return projectRealBuildPanelCameraResolutionEvidence(
    resolveRealBuildPanelCameraBranches({
      prefix: {
        throughStepNumber: 0,
        parentLineageId: null,
        document,
        documentHash,
      },
      registrationPanelStepNumber: 1,
      renderModelMask: () => new Uint8Array(1),
      builtMask: new Uint8Array(1),
      excludedMask: null,
      widthPx: 1,
      heightPx: 1,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(8_192),
      hashDocument: () => documentHash,
    }),
  );
}

export function rootRefusalReport(complete = false): RealBuildStepReport {
  const panel = transitionPanel(1);
  const failure = {
    code: "camera-handedness-unresolved" as const,
    stage: "camera-registration" as const,
    stepNumber: 1,
    message: "All eight root camera lineages remain admissible; scalar placement is refused.",
  };
  return {
    ...completeReport(1),
    calloutPieces: 1,
    expectedAssembledPieces: 1,
    attemptedPieces: complete ? 1 : 0,
    placedPieces: complete ? 1 : 0,
    action: {
      kind: "place-callouts",
      assembledPieces: 1,
      evidenceDigest: panel.action.evidenceDigest,
    },
    canonicalStepId: complete ? "step-1" : null,
    prerequisites: stepPrerequisiteFacts({
      stepNumber: 1,
      actionKind: "place-callouts",
      blockingStep: null,
      coverageFailures: [],
      unresolvedCallouts: [],
      missingDesigns: [],
      calloutPieces: 1,
      expectedAssembledPieces: 1,
      resolvedPieces: 1,
    }),
    outcome: complete
      ? { status: "complete", mechanism: "highlight", failure: null }
      : {
          status: "failed",
          mechanism: "deferred",
          attemptedMechanism: null,
          failure,
        },
    validation: {
      attempted: false,
      targetDocumentHash: null,
      truthSnapshotHash: null,
      validatorSetHash: null,
      documentGloballyValid: null,
      blockingIssues: [],
      failure: null,
    },
    panelCamera: seededPanelCameraEvidence(),
  };
}

export function acceptedRootTransition(targetDocumentHash: string): RealBuildStepReport {
  const root = seededPanelCameraEvidence();
  return {
    ...completeReport(1),
    panelCamera: root,
    validation: {
      ...completeReport(1).validation,
      targetDocumentHash,
    },
  };
}

export function hostileThrownObject(): object {
  const target = Object.create(null) as object;
  const hostile = new Proxy(target, {
    getOwnPropertyDescriptor: () => {
      throw hostile;
    },
    getPrototypeOf: () => {
      throw hostile;
    },
    ownKeys: () => {
      throw hostile;
    },
    get: () => {
      throw hostile;
    },
  });
  return hostile;
}

export function directOptions() {
  const prepared = options(1);
  const panels = [...prepared.panels];
  panels[0] = {
    ...panels[0]!,
    calloutPieces: 1,
    classifiedPhysicalCalloutPieces: 1,
    action: rootRefusalReport().action,
  };
  return { ...prepared, panels };
}
