import { canonicalStringify, sha256Hex } from "@lego-studio/brick-kernel";

import type {
  RealBuildPanelCameraAttemptEvidence,
  RealBuildPanelCameraMeasurementCameraEvidence,
  RealBuildPanelCameraMeasurementEvidence,
  RealBuildPanelCameraRegistrationEvidence,
} from "./real-build-panel-camera-evidence-types";

export interface RealBuildPanelCameraEvidenceMeasurementContext {
  readonly pdfDigest: string;
  readonly pageNumber: number;
  readonly cropPt: readonly [number, number, number, number];
  /** SHA-256 of the exact canonical PNG data URL retained in the report. */
  readonly sourcePanelPngDigest: string | null;
  /** SHA-256 of the exact canonical PNG data URL retained in the report. */
  readonly candidateBuildPngDigest: string | null;
  readonly panelFace: "studs-up" | "underside";
  readonly camera: RealBuildPanelCameraMeasurementCameraEvidence;
}

export interface RealBuildPanelCameraRasterMeasurement {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly builtMaskDigest: string;
  readonly excludedMaskDigest: string | null;
}

export function realBuildPanelCameraCaptureDigest(value: string): string {
  return `sha256:${sha256Hex(value)}`;
}

export function createRealBuildPanelCameraMeasurementEvidence(
  context: RealBuildPanelCameraEvidenceMeasurementContext,
  raster: RealBuildPanelCameraRasterMeasurement,
): RealBuildPanelCameraMeasurementEvidence {
  return {
    metric: "binary-silhouette-iou/1",
    ...context,
    ...raster,
    recomputation: {
      status: "unavailable",
      reason: "exact-mask-bytes-not-retained",
    },
  };
}

/**
 * Identity for an observed row, including every fact that can change its rank.
 * Parent lineage is deliberately excluded so converged parents can share one
 * measured observation and then derive distinct child lineage IDs from it.
 */
export function realBuildPanelCameraCommittedObservationId(input: {
  readonly candidateId: string;
  readonly registration: RealBuildPanelCameraRegistrationEvidence;
  readonly silhouetteIou: number;
  readonly centrePx: readonly [number, number];
  readonly renderMaskDigest: string;
  readonly measurement: RealBuildPanelCameraMeasurementEvidence;
}): string {
  return `panel-camera-observation-v2:${sha256Hex(canonicalStringify(input))}`;
}

export function committedObservationIdForAttempt(input: {
  readonly candidateId: string;
  readonly registrationPanelStepNumber: number;
  readonly attempt: RealBuildPanelCameraAttemptEvidence;
  readonly measurement: RealBuildPanelCameraMeasurementEvidence;
}): string {
  const { attempt } = input;
  if (
    attempt.status !== "scored" ||
    attempt.silhouetteIou === null ||
    attempt.shiftPx === null ||
    attempt.centrePx === null ||
    attempt.renderMaskDigest === null
  ) {
    throw new TypeError(
      "A committed panel-camera observation requires one complete scored attempt.",
    );
  }
  return realBuildPanelCameraCommittedObservationId({
    candidateId: input.candidateId,
    registration: {
      latticeHand: attempt.latticeHand,
      latticeDeterminant: attempt.latticeDeterminant,
      registrationPanelStepNumber: input.registrationPanelStepNumber,
      turnDegrees: attempt.turnDegrees,
      shiftPx: attempt.shiftPx,
    },
    silhouetteIou: attempt.silhouetteIou,
    centrePx: attempt.centrePx,
    renderMaskDigest: attempt.renderMaskDigest,
    measurement: input.measurement,
  });
}

const sameJson = (left: unknown, right: unknown): boolean =>
  canonicalStringify(left) === canonicalStringify(right);

/** Pure cross-field check; current /2 measurements remain non-authorizing. */
export function panelCameraMeasurementDefect(
  measurement: RealBuildPanelCameraMeasurementEvidence | null,
  input: {
    readonly pdfDigest: string;
    readonly panel: {
      readonly pageNumber: number;
      readonly minXPt: number;
      readonly maxXPt: number;
      readonly minYPt: number;
      readonly maxYPt: number;
      readonly panelFace: "studs-up" | "underside" | null;
    };
    readonly report: {
      readonly panelFace?: unknown;
      readonly camera?: unknown;
      readonly panelPng?: unknown;
      readonly buildPng?: unknown;
      readonly outcome?: unknown;
      readonly expectedAssembledPieces?: unknown;
    };
  },
): string | null {
  if (measurement === null) return null;
  const expectedPanelDigest =
    typeof input.report.panelPng === "string"
      ? realBuildPanelCameraCaptureDigest(input.report.panelPng)
      : null;
  const expectedBuildDigest =
    typeof input.report.buildPng === "string"
      ? realBuildPanelCameraCaptureDigest(input.report.buildPng)
      : null;
  const expectedCrop = [
    input.panel.minXPt,
    input.panel.maxXPt,
    input.panel.minYPt,
    input.panel.maxYPt,
  ];
  if (
    measurement.pdfDigest !== input.pdfDigest ||
    measurement.pageNumber !== input.panel.pageNumber ||
    !sameJson(measurement.cropPt, expectedCrop) ||
    measurement.panelFace !== input.panel.panelFace ||
    measurement.panelFace !== input.report.panelFace ||
    measurement.sourcePanelPngDigest !== expectedPanelDigest ||
    measurement.candidateBuildPngDigest !== expectedBuildDigest ||
    !sameJson(measurement.camera, input.report.camera)
  ) {
    return "panel-camera measurement does not reproduce its prepared PDF/page/crop/face or exact retained panel, build, and camera evidence";
  }
  const outcome = input.report.outcome as { readonly status?: unknown } | null | undefined;
  if (
    outcome?.status === "complete" &&
    typeof input.report.expectedAssembledPieces === "number" &&
    input.report.expectedAssembledPieces > 0
  ) {
    return "panel-camera measurement is inspectable only: exact mask bytes and deterministic score recomputation are not retained, so it cannot authorize a completed placement";
  }
  return null;
}
