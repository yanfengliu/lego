export const REAL_BUILD_PANEL_CAMERA_EVIDENCE_SCHEMA_VERSION =
  "lego.real-build-panel-camera-evidence/2" as const;

export const DEFAULT_REAL_BUILD_PANEL_CAMERA_EVIDENCE_MAXIMUM_ENTRIES = 8_192;

export const MAXIMUM_REAL_BUILD_PANEL_CAMERA_EVIDENCE_ENTRIES = 3_200_000;

/**
 * Converts the branch ledger's externally declared work ceiling into the
 * parser's aggregate nested-array ceiling. A fully observed frontier retains
 * fewer than four JSON array entries per reserved branch, while the fixed
 * floor covers the 17 entries in an eight-way step-0 seed.
 */
export function realBuildPanelCameraEvidenceMaximumEntries(branchBudget: number): number {
  if (!Number.isSafeInteger(branchBudget) || branchBudget < 0) {
    throw new RangeError(
      `Panel-camera branch budget must be a non-negative safe integer; received ${String(branchBudget)}.`,
    );
  }
  return Math.max(
    64,
    Math.min(
      MAXIMUM_REAL_BUILD_PANEL_CAMERA_EVIDENCE_ENTRIES,
      branchBudget > MAXIMUM_REAL_BUILD_PANEL_CAMERA_EVIDENCE_ENTRIES / 4
        ? MAXIMUM_REAL_BUILD_PANEL_CAMERA_EVIDENCE_ENTRIES
        : branchBudget * 4,
    ),
  );
}

export type RealBuildPanelCameraEvidenceStatus =
  "seeded" | "observed" | "unresolved" | "failed" | "budget-refused";

export type RealBuildPanelCameraCandidateEvidenceStatus = Exclude<
  RealBuildPanelCameraEvidenceStatus,
  "budget-refused"
>;

export type RealBuildPanelCameraEvidenceHand = "as-fitted" | "x-reflected";
export type RealBuildPanelCameraEvidenceTurn = 0 | 90 | 180 | 270;
export type RealBuildPanelCameraEvidencePair = readonly [number, number];

export interface RealBuildPanelCameraFailureEvidence {
  readonly code:
    | "camera-anchor-failed"
    | "camera-handedness-unresolved"
    | "rendering-error"
    | "resource-budget-exhausted";
  readonly stage: "camera-registration" | "rendering" | "budget";
  readonly stepNumber: number | null;
  readonly message: string;
}

export interface RealBuildPanelCameraAttemptEvidence {
  readonly latticeHand: RealBuildPanelCameraEvidenceHand;
  readonly latticeDeterminant: 1 | -1;
  readonly turnDegrees: RealBuildPanelCameraEvidenceTurn;
  readonly status: "unregistered" | "empty" | "scored";
  readonly silhouetteIou: number | null;
  readonly shiftPx: RealBuildPanelCameraEvidencePair | null;
  readonly centrePx: RealBuildPanelCameraEvidencePair | null;
  /** Digest of the exact binary hypothesis mask; null only when no usable render was returned. */
  readonly renderMaskDigest: string | null;
}

export interface RealBuildPanelCameraMeasurementCameraEvidence {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
  readonly residualPx: number;
  readonly coherence: number;
  readonly centerXPx: number;
  readonly centerYPx: number;
  readonly anchorIou: number | null;
  readonly anchorShiftPx: RealBuildPanelCameraEvidencePair | null;
  readonly anchorTurnDegrees: number | null;
}

export interface RealBuildPanelCameraMeasurementEvidence {
  readonly metric: "binary-silhouette-iou/1";
  readonly pdfDigest: string;
  readonly pageNumber: number;
  readonly cropPt: readonly [number, number, number, number];
  readonly sourcePanelPngDigest: string | null;
  readonly candidateBuildPngDigest: string | null;
  readonly panelFace: "studs-up" | "underside";
  readonly camera: RealBuildPanelCameraMeasurementCameraEvidence;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly builtMaskDigest: string;
  readonly excludedMaskDigest: string | null;
  readonly recomputation: {
    readonly status: "unavailable";
    readonly reason: "exact-mask-bytes-not-retained";
  };
}

export interface RealBuildPanelCameraRegistrationEvidence {
  readonly latticeHand: RealBuildPanelCameraEvidenceHand;
  readonly latticeDeterminant: 1 | -1;
  readonly registrationPanelStepNumber: number;
  readonly turnDegrees: RealBuildPanelCameraEvidenceTurn;
  /** Null only for an explicitly unregistered step-0 angular seed. */
  readonly shiftPx: RealBuildPanelCameraEvidencePair | null;
}

export interface RealBuildPanelCameraObservationEvidence {
  readonly candidateId: string;
  readonly lineageId: string;
  readonly parentLineageId: string | null;
  /** Null only for an explicitly unregistered step-0 angular seed. */
  readonly observationId: string | null;
  readonly registration: RealBuildPanelCameraRegistrationEvidence;
  readonly silhouetteIou: number | null;
}

export interface RealBuildPanelCameraSelectedLineageEvidence {
  readonly parentLineageId: string;
  readonly lineageId: string;
}

export interface RealBuildPanelCameraCandidateEvidence {
  readonly candidateId: string;
  readonly documentHash: string;
  readonly status: RealBuildPanelCameraCandidateEvidenceStatus;
  readonly parentLineageIds: readonly string[];
  readonly attempts: readonly RealBuildPanelCameraAttemptEvidence[];
  readonly observationIds: readonly string[];
  readonly selectedObservationId: string | null;
  readonly selectedLineageIds: readonly RealBuildPanelCameraSelectedLineageEvidence[];
  readonly failure: RealBuildPanelCameraFailureEvidence | null;
}

export interface RealBuildPanelCameraReservationEvidence {
  readonly budget: number;
  readonly reservedBefore: number;
  readonly requested: number;
  readonly reservedAfter: number;
  readonly failure: {
    readonly budget: number;
    readonly reservedBefore: number;
    readonly requested: number;
  } | null;
}

export interface RealBuildPanelCameraEvidence {
  readonly schemaVersion: typeof REAL_BUILD_PANEL_CAMERA_EVIDENCE_SCHEMA_VERSION;
  readonly status: RealBuildPanelCameraEvidenceStatus;
  readonly throughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  /** Null only when no panel measurement ran (root seed, budget refusal, or early anchor failure). */
  readonly measurement: RealBuildPanelCameraMeasurementEvidence | null;
  readonly candidates: readonly RealBuildPanelCameraCandidateEvidence[];
  readonly observations: readonly RealBuildPanelCameraObservationEvidence[];
  readonly reservation: RealBuildPanelCameraReservationEvidence;
  readonly failure: RealBuildPanelCameraFailureEvidence | null;
  readonly physicalFrameDecision: {
    readonly status: "unresolved";
    readonly authorizedTransform: null;
    readonly reason: "panel-camera-silhouette-is-not-physical-transform-authority";
  };
}
