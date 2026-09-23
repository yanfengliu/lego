import type { Sha256Digest } from "@lego-studio/brick-kernel";
import type { OrthographicViewFrame, OrthographicViewParameters } from "@lego-studio/rendering";

import type { RealBuildPrefix50Step44PanelFacePrefixEvidence } from "./real-build-prefix50-step44-panel-face-prefix.ts";
import type {
  RealBuildPrefix50Step44CameraBranchKey,
  RealBuildPrefix50Step44CameraSearchThresholds,
  RealBuildPrefix50Step44FeatureCorroboration,
  RealBuildPrefix50Step44GeometrySelection,
  RealBuildPrefix50Step44ParentCameraMeasurement,
} from "./real-build-prefix50-subbuild-return-review-camera-search.ts";
import type {
  RealBuildPrefix50Step44ParentOnlyRegion,
  RealBuildPrefix50Step44TypedLatticeFit,
} from "./real-build-prefix50-subbuild-return-review-camera-source.ts";
import type { RealBuildPrefix50Step44SemanticColorPolicy } from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";
import type { RealBuildPrefix50Step44InteriorFeatureCalibrationReceipt } from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";

interface CameraArtifactBinding {
  readonly artifactFile: string;
  readonly width: 720;
  readonly height: 470;
  readonly pngDigest: Sha256Digest;
  readonly pixelDigest: Sha256Digest;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44Page45CameraReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-page45-camera/3";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly sourceKind: "repository-runtime" | "synthetic-test";
  readonly sourcePdfArtifactPath: "recipes/6651557.pdf" | "synthetic-test-source.pdf";
  readonly sourcePdfDigest: Sha256Digest;
  readonly rendererVersion: string;
  readonly sourcePagePngDigest: Sha256Digest;
  readonly sourcePageRasterCommitment: Sha256Digest;
  readonly sourcePagePixelDigest: Sha256Digest;
  readonly panelFacePrefixEvidence: RealBuildPrefix50Step44PanelFacePrefixEvidence;
  readonly panelFacePrefixEvidenceCommitment: Sha256Digest;
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly panelCropCommitment: Sha256Digest;
  readonly panelPixelDigest: Sha256Digest;
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly returnResultCommitment: Sha256Digest;
  readonly candidateRosterCommitment: Sha256Digest;
  readonly sourceDocumentHash: Sha256Digest;
  readonly reviewReplayBaseDocumentCommitment: Sha256Digest;
  readonly sharedParentDocumentHash: Sha256Digest;
  readonly sharedParentDocumentCommitment: Sha256Digest;
  readonly excludedChildPartIds: readonly string[];
  readonly excludedChildPartIdsCommitment: Sha256Digest;
  readonly dataExclusionPolicy: "page45-and-shared-step43-parent-only-no-candidate-no-step45-no-page46";
  readonly parentOnlyRegion: RealBuildPrefix50Step44ParentOnlyRegion;
  readonly latticeFit: RealBuildPrefix50Step44TypedLatticeFit;
  readonly semanticColorPolicy: RealBuildPrefix50Step44SemanticColorPolicy;
  readonly semanticColorPolicyCommitment: Sha256Digest;
  readonly metricCalibration: RealBuildPrefix50Step44InteriorFeatureCalibrationReceipt;
  readonly metricCalibrationCommitment: Sha256Digest;
  readonly branchMeasurements: readonly RealBuildPrefix50Step44ParentCameraMeasurement[];
  readonly branchMeasurementsCommitment: Sha256Digest;
  readonly cameraSearchAttemptCommitment: Sha256Digest;
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
  readonly searchThresholds: RealBuildPrefix50Step44CameraSearchThresholds;
  readonly instrumentArtifacts: Readonly<
    Record<
      | "page45Crop"
      | "eligibleParentRegionMask"
      | "parentOnlyTargetMask"
      | "selectedParentControlRender",
      CameraArtifactBinding
    >
  >;
  readonly instrumentArtifactsCommitment: Sha256Digest;
  readonly measurementCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}
