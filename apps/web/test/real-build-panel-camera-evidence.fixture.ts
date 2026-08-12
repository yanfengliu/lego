import {
  createEmptyBrickDocument,
  documentStructuralHash,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import {
  realBuildPanelCameraCaptureDigest,
  projectRealBuildPanelCameraResolutionEvidence,
  type RealBuildPanelCameraEvidence,
  type RealBuildPanelCameraEvidenceMeasurementContext,
} from "../e2e/real-build-panel-camera-evidence";
import { resolveRealBuildPanelCameraBranches } from "../e2e/real-build-panel-camera-resolver";

export const PANEL_CAMERA_TEST_PNG = "data:image/png;base64,iVBORw0KGgo=";
export const PANEL_CAMERA_TEST_CAMERA = Object.freeze({
  azimuthDegrees: 35,
  elevationDegrees: 25,
  pixelsPerUnit: 2,
  residualPx: 0.1,
  coherence: 0.9,
  centerXPx: 1,
  centerYPx: 1,
  anchorIou: 0.8,
  anchorShiftPx: [0, 0] as const,
  anchorTurnDegrees: 0,
});

export function panelCameraTestMeasurementContext(
  pageNumber: number,
  captures = false,
): RealBuildPanelCameraEvidenceMeasurementContext {
  return {
    pdfDigest: `sha256:${"a".repeat(64)}`,
    pageNumber,
    cropPt: [0, 100, 0, 100],
    sourcePanelPngDigest: captures
      ? realBuildPanelCameraCaptureDigest(PANEL_CAMERA_TEST_PNG)
      : null,
    candidateBuildPngDigest: captures
      ? realBuildPanelCameraCaptureDigest(PANEL_CAMERA_TEST_PNG)
      : null,
    panelFace: "studs-up",
    camera: PANEL_CAMERA_TEST_CAMERA,
  };
}

/** A coherent selected later-panel lineage for browser-boundary fixtures. */
export function observedPanelCameraEvidence(
  stepNumber: number,
  budget = 8_192,
  expectedDocumentHash?: Sha256Digest,
): RealBuildPanelCameraEvidence {
  const document = { parts: [{ id: `part-${stepNumber}` }] };
  const documentHash =
    expectedDocumentHash ?? (`sha256:${stepNumber.toString(16).padStart(64, "0")}` as Sha256Digest);
  const builtMask = new Uint8Array([1, 1, 0, 0]);
  const weakerMask = new Uint8Array([1, 0, 0, 0]);
  return projectRealBuildPanelCameraResolutionEvidence(
    resolveRealBuildPanelCameraBranches({
      prefix: {
        throughStepNumber: stepNumber,
        parentLineageId: `fixture-parent-${stepNumber}`,
        document,
        documentHash,
      },
      registrationPanelStepNumber: stepNumber + 1,
      renderModelMask: ({ hypothesis }) =>
        hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? builtMask
          : weakerMask,
      builtMask,
      excludedMask: null,
      widthPx: 2,
      heightPx: 2,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(budget),
      hashDocument: () => documentHash,
    }),
    panelCameraTestMeasurementContext(stepNumber + 1),
  );
}

export function seededPanelCameraEvidence(budget = 8_192): RealBuildPanelCameraEvidence {
  const document = createEmptyBrickDocument({
    id: "real-build",
    name: "Real booklet rebuild",
    maxParts: 1_464,
  });
  const documentHash = documentStructuralHash(document) as Sha256Digest;
  return projectRealBuildPanelCameraResolutionEvidence(
    resolveRealBuildPanelCameraBranches({
      prefix: {
        throughStepNumber: 0,
        parentLineageId: null,
        document,
        documentHash,
      },
      registrationPanelStepNumber: 1,
      renderModelMask: () => {
        throw new Error("An empty root must not render a scalar camera.");
      },
      builtMask: new Uint8Array(1),
      excludedMask: null,
      widthPx: 1,
      heightPx: 1,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(budget),
      hashDocument: () => documentHash,
    }),
  );
}
