import type { Sha256Digest } from "@lego-studio/brick-kernel";
import type { OrthographicViewFrame, OrthographicViewParameters } from "@lego-studio/rendering";

import {
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
} from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import type { RealBuildPrefix50Step44InteriorFeatureMeasurement } from "./real-build-prefix50-subbuild-return-review-camera-interior.ts";
import type {
  RealBuildPrefix50EligibleMaskSearchDiagnostics,
  RealBuildPrefix50EligibleMaskSearchRefusal,
  RealBuildPrefix50EligibleMaskSimilarityTransform,
} from "./real-build-prefix50-subbuild-return-review-camera-registration.ts";

export interface RealBuildPrefix50Step44CameraSearchThresholds {
  readonly minimumParentOnlyIntersectionOverUnion: 0.9;
  readonly minimumBranchWinnerMargin: 0.015;
  readonly maximumPredictionActualIntersectionOverUnionDrift: 0.02;
  readonly minimumBlueCyanF1: number;
  readonly minimumExpectedFaceBlueCyanF1Margin: number;
  readonly maximumAlignmentPasses: 3;
}

export const REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS = Object.freeze({
  minimumParentOnlyIntersectionOverUnion: 0.9,
  minimumBranchWinnerMargin: 0.015,
  maximumPredictionActualIntersectionOverUnionDrift: 0.02,
  minimumBlueCyanF1:
    REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION.derivedThresholds.minimumBlueCyanF1,
  minimumExpectedFaceBlueCyanF1Margin:
    REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION.derivedThresholds
      .minimumExpectedFaceBlueCyanF1Margin,
  maximumAlignmentPasses: 3,
} satisfies RealBuildPrefix50Step44CameraSearchThresholds);

export type RealBuildPrefix50Step44CameraBranchKey =
  `face:${"studs-up" | "underside"}/hand:${"as-fitted" | "x-reflected"}/turn:${0 | 1 | 2 | 3}`;

export interface RealBuildPrefix50Step44CameraRenderEvidence {
  readonly pngBytes: Uint8Array;
  readonly rgba: Uint8Array;
  readonly pngDigest: Sha256Digest;
  readonly pixelDigest: Sha256Digest;
  readonly projectionMatrix: readonly number[];
  readonly matrixWorldInverse: readonly number[];
  readonly rendererCameraCommitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44CameraRegistrationProposal {
  readonly status: "locally-contained" | "refused";
  readonly transform: RealBuildPrefix50EligibleMaskSimilarityTransform | null;
  readonly refusalReason: RealBuildPrefix50EligibleMaskSearchRefusal | null;
  readonly diagnostics: RealBuildPrefix50EligibleMaskSearchDiagnostics;
  readonly proposedParameters: OrthographicViewParameters | null;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44CameraAlignmentPass {
  readonly passIndex: number;
  readonly passKind: "seed" | "confirmation" | "rebase";
  readonly artifactFile: string;
  readonly parameters: OrthographicViewParameters;
  readonly cameraCommitment: Sha256Digest;
  readonly pngDigest: Sha256Digest;
  readonly pixelDigest: Sha256Digest;
  readonly projectionMatrix: readonly number[];
  readonly matrixWorldInverse: readonly number[];
  readonly rendererCameraCommitment: Sha256Digest;
  readonly panelForegroundPixels: number;
  readonly parentForegroundPixels: number;
  readonly intersectionPixels: number;
  readonly unionPixels: number;
  readonly intersectionOverUnion: number;
  readonly registrationProposal: RealBuildPrefix50Step44CameraRegistrationProposal | null;
  readonly predictedIntersectionOverUnion: number | null;
  readonly incomingPredictionActualIntersectionOverUnionDrift: number | null;
  readonly solvedParameters: OrthographicViewParameters;
  readonly solvedCenterDeltaPx: number;
  readonly solvedScaleDeltaFraction: number;
  readonly settled: boolean;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44SemanticColorArtifactBinding {
  readonly artifactFile: string;
  readonly pngDigest: Sha256Digest;
  readonly pixelDigest: Sha256Digest;
  readonly semanticBlueCyanMaskDigest: Sha256Digest;
  readonly projectionMatrix: readonly number[];
  readonly matrixWorldInverse: readonly number[];
  readonly rendererCameraCommitment: Sha256Digest;
  readonly policyCommitment: Sha256Digest;
  readonly classificationCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44BeautyRestorationControl {
  readonly artifactFile: string;
  readonly controlledBranchKey: RealBuildPrefix50Step44CameraBranchKey;
  readonly controlledCameraCommitment: Sha256Digest;
  readonly pngDigest: Sha256Digest;
  readonly pixelDigest: Sha256Digest;
  readonly projectionMatrix: readonly number[];
  readonly matrixWorldInverse: readonly number[];
  readonly rendererCameraCommitment: Sha256Digest;
  readonly byteIdenticalToPublishedRender: boolean;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44ParentCameraMeasurement {
  readonly branchIndex: number;
  readonly branchKey: RealBuildPrefix50Step44CameraBranchKey;
  readonly branchFace: "studs-up" | "underside";
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly geometryEligible: boolean;
  readonly seedParameters: OrthographicViewParameters;
  readonly frame: OrthographicViewFrame;
  readonly alignmentMethod: "coverage-preserving-direct-eligible-silhouette-registration";
  readonly alignmentPasses: readonly RealBuildPrefix50Step44CameraAlignmentPass[];
  readonly alignmentPassesCommitment: Sha256Digest;
  readonly converged: boolean;
  readonly publishedPassIndex: number;
  readonly selectedParameters: OrthographicViewParameters;
  readonly selectedCameraCommitment: Sha256Digest;
  readonly selectedRendererCameraCommitment: Sha256Digest;
  readonly selectedPngDigest: Sha256Digest;
  readonly selectedPixelDigest: Sha256Digest;
  readonly selectedIntersectionOverUnion: number;
  readonly geometryCommitment: Sha256Digest;
  readonly semanticColorArtifact: RealBuildPrefix50Step44SemanticColorArtifactBinding;
  readonly interiorFeatureMeasurement: RealBuildPrefix50Step44InteriorFeatureMeasurement;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44GeometrySelection {
  readonly schemaVersion: "lego.real-build-prefix50-step44-camera-geometry-selection/1";
  readonly authority: "eligible-silhouette-iou-only";
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly stableBranchOrder: readonly RealBuildPrefix50Step44CameraBranchKey[];
  readonly eligibleGeometryCommitments: readonly Sha256Digest[];
  readonly counterevidenceGeometryCommitments: readonly Sha256Digest[];
  readonly selectedBranchKey: RealBuildPrefix50Step44CameraBranchKey | null;
  readonly selectedIntersectionOverUnion: number | null;
  readonly strongestOtherExpectedFaceBranchKey: RealBuildPrefix50Step44CameraBranchKey | null;
  readonly strongestOtherExpectedFaceIntersectionOverUnion: number | null;
  readonly strongestUnexpectedFaceIntersectionOverUnion: number;
  readonly expectedFaceGeometryMargin: number | null;
  readonly thresholds: Pick<
    RealBuildPrefix50Step44CameraSearchThresholds,
    "minimumBranchWinnerMargin" | "minimumParentOnlyIntersectionOverUnion"
  >;
  readonly passed: boolean;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44FeatureCorroboration {
  readonly schemaVersion: "lego.real-build-prefix50-step44-camera-feature-corroboration/2";
  readonly authority: "refusal-only";
  readonly selectionAuthority: false;
  readonly tieBreakAuthority: false;
  readonly retryAuthority: false;
  readonly hogAuthority: "diagnostic-only";
  readonly metricCalibrationCommitment: typeof REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT;
  readonly sourceCommitment: Sha256Digest;
  readonly geometrySelectionCommitment: Sha256Digest;
  readonly branchMeasurementCommitments: readonly Sha256Digest[];
  readonly selectedBranchKey: RealBuildPrefix50Step44CameraBranchKey | null;
  readonly selectedBlueCyanF1: number | null;
  readonly geometryRunnerUpBranchKey: RealBuildPrefix50Step44CameraBranchKey | null;
  readonly geometryRunnerUpFeatureComparable: boolean;
  readonly geometryRunnerUpBlueCyanF1: number | null;
  readonly strongestUnexpectedFaceBlueCyanF1: number;
  readonly expectedFaceBlueCyanF1Margin: number | null;
  readonly thresholds: Pick<
    RealBuildPrefix50Step44CameraSearchThresholds,
    "minimumBlueCyanF1" | "minimumExpectedFaceBlueCyanF1Margin"
  >;
  readonly passed: boolean;
  readonly commitment: Sha256Digest;
}

export type RealBuildPrefix50Step44CameraSearchRefusal =
  | "incomplete-branch-registration"
  | "no-converged-expected-face-branch"
  | "no-other-expected-face-geometry-runner"
  | "no-other-expected-face-feature-runner"
  | "minimum-parent-iou-not-met"
  | "expected-face-geometry-margin-not-met"
  | "blue-cyan-f1-floor-not-met"
  | "expected-face-blue-cyan-margin-not-met"
  | "beauty-restoration-control-failed";

export interface RealBuildPrefix50Step44CameraSearchAttempt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-camera-search-attempt/2";
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly sourceEligibleMaskDigest: Sha256Digest;
  readonly parentOnlyTargetMaskDigest: Sha256Digest;
  readonly thresholds: RealBuildPrefix50Step44CameraSearchThresholds;
  readonly renderCount: number;
  readonly maximumRenderCount: 48;
  readonly semanticRenderCount: 16;
  readonly restorationControlRenderCount: 1;
  readonly totalCaptureCount: number;
  readonly maximumTotalCaptureCount: 65;
  readonly beautyRestorationControl: RealBuildPrefix50Step44BeautyRestorationControl;
  readonly metricCalibrationCommitment: typeof REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT;
  readonly geometrySelection: RealBuildPrefix50Step44GeometrySelection;
  readonly geometrySelectionCommitment: Sha256Digest;
  readonly featureCorroboration: RealBuildPrefix50Step44FeatureCorroboration;
  readonly featureCorroborationCommitment: Sha256Digest;
  readonly branchMeasurements: readonly RealBuildPrefix50Step44ParentCameraMeasurement[];
  readonly branchMeasurementsCommitment: Sha256Digest;
  readonly status: "resolved" | "refused";
  readonly refusalReasons: readonly RealBuildPrefix50Step44CameraSearchRefusal[];
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44CameraSearchAttemptEvidence {
  readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  readonly renderArtifacts: Readonly<Record<string, Uint8Array>>;
}

export interface RealBuildPrefix50Step44CameraSearchResult {
  readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  readonly branchMeasurements: readonly RealBuildPrefix50Step44ParentCameraMeasurement[];
  readonly branchMeasurementsCommitment: Sha256Digest;
  readonly geometrySelection: RealBuildPrefix50Step44GeometrySelection;
  readonly geometrySelectionCommitment: Sha256Digest;
  readonly featureCorroboration: RealBuildPrefix50Step44FeatureCorroboration;
  readonly featureCorroborationCommitment: Sha256Digest;
  readonly selectedBranchKey: RealBuildPrefix50Step44CameraBranchKey;
  readonly selectedParameters: OrthographicViewParameters;
  readonly selectedFrame: OrthographicViewFrame;
  readonly selectedCameraCommitment: Sha256Digest;
  readonly selectedRendererCameraCommitment: Sha256Digest;
  readonly selectedParentPngDigest: Sha256Digest;
  readonly selectedParentPixelDigest: Sha256Digest;
  readonly selectedIntersectionOverUnion: number;
  readonly branchWinnerMargin: number;
  readonly selectedAlignmentPassCount: number;
  readonly thresholds: RealBuildPrefix50Step44CameraSearchThresholds;
  readonly selectedControlRender: RealBuildPrefix50Step44CameraRenderEvidence;
}
