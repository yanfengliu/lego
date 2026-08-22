import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildCompiledPlacementTransitionEvidence } from "../e2e/real-build-compiled-placement-lineage-types";
import type { RealBuildBrowserCameraEvidenceRow } from "../e2e/real-build-browser-output-v4-camera-evidence-types";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import type {
  RealBuildPanelSpec,
  RealBuildStepReport,
  StepFailure,
} from "../e2e/real-build-safety";

export function selectedReaderCompletedReport(input: {
  readonly panel: RealBuildPanelSpec;
  readonly transition: RealBuildCompiledPlacementTransitionEvidence;
  readonly parentDocumentHash: Sha256Digest;
  readonly cameraRow: RealBuildBrowserCameraEvidenceRow;
}): RealBuildStepReport {
  const witness = input.transition.pieces[0];
  if (witness === undefined || input.transition.pieces.length !== 1) {
    throw new TypeError("Selected reader report fixture requires exactly one compiler witness.");
  }
  const placeholder: StepFailure = {
    code: "camera-handedness-unresolved",
    stage: "camera-registration",
    stepNumber: 1,
    message: "Replaced by selected compiled evidence.",
  };
  return {
    ...unexecutedStepReport(input.panel, placeholder, { documentParts: 0, elapsedMs: 0 }),
    attemptedPieces: 1,
    placedPieces: 1,
    canonicalStepId: input.transition.receipt.canonicalStepId,
    outcome: { status: "complete", mechanism: "compiled-observation", failure: null },
    validation: { ...input.transition.receipt.validation, attempted: true, failure: null },
    fit: {
      azimuthDegrees: input.cameraRow.fittedCamera.azimuthDegrees,
      elevationDegrees: input.cameraRow.fittedCamera.elevationDegrees,
      pixelsPerUnit: input.cameraRow.fittedCamera.pixelsPerUnit,
      residualPx: input.cameraRow.fittedCamera.residualPx,
      coherence: input.cameraRow.fittedCamera.coherence,
      failure: null,
    },
    camera: {
      ...input.cameraRow.fittedCamera,
      anchorIou:
        input.cameraRow.preparedPanel.measure === "iou" ? input.cameraRow.registration.score : null,
      anchorShiftPx: input.cameraRow.registration.shiftPx,
      anchorTurnDegrees: input.cameraRow.lattice.turnDegrees,
    },
    pieces: [
      {
        catalogPartId: witness.catalogPartId,
        blind: {
          comparisonPrefixHash: input.parentDocumentHash,
          distinctCandidates: 0,
          feasible: false,
          rendered: 0,
          bestScore: null,
          runnerUpScore: null,
          agreesWithHighlight: null,
          refusal: "exact-browser-output-v4-roles-own-compiled-search-evidence",
          elapsedMs: 0,
        },
        enumerated: 0,
        afterProximity: 0,
        rendered: 0,
        bestScore: null,
        runnerUpScore: null,
        placed: true,
        positionLdu: witness.transform.positionLdu,
        orientationId: witness.transform.orientationId,
        failure: null,
      },
    ],
    documentParts: 1,
  };
}
