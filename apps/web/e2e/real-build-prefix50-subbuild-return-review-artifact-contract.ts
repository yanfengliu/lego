import type { CanonicalViewPacket } from "@lego-studio/rendering";

import type { RealBuildPrefix50Step44Page45CameraReceipt } from "./real-build-prefix50-subbuild-return-review-camera.ts";
import type {
  RealBuildPrefix50Step43FixedCameraBaselineArtifact,
  RealBuildPrefix50Step44FixedCameraDelta,
  RealBuildPrefix50Step44FixedCameraDeltaArtifact,
  RealBuildPrefix50Step44FixedCameraFrame,
} from "./real-build-prefix50-subbuild-return-review-fixed-camera.ts";
import type { RealBuildPrefix50Step44LaterSourceReadCapability } from "./real-build-prefix50-step44-later-source-authority.ts";

export interface RealBuildPrefix50Step44CaptureManifestRow {
  readonly scene?: "model-only";
  readonly view: string;
  readonly canonicalViewName: string;
  readonly artifactFile: string;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly width: number;
  readonly height: number;
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly cameraCommitment: `sha256:${string}`;
  readonly reviewOutcome: null;
  readonly reviewNote: null;
}

export interface RealBuildPrefix50Step44CaptureRenderPacket {
  readonly schemaVersion: "lego.real-build-prefix50-step44-render-packet/1";
  readonly authority: "none";
  readonly documentHash: `sha256:${string}`;
  readonly validationReport: unknown;
  readonly validationReportCommitment: `sha256:${string}`;
  readonly rendererSnapshot: unknown;
  readonly rendererSnapshotCommitment: `sha256:${string}`;
  readonly capturePolicyHash: `sha256:${string}`;
  readonly viewPacketCommitment: `sha256:${string}`;
  readonly capturesCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44CaptureManifest {
  readonly schemaVersion: "lego.real-build-prefix50-subbuild-return-review-capture/2";
  readonly authority: "none";
  readonly selectionAuthority: false;
  readonly fixturePromotionAuthority: false;
  readonly sourceSetId: "6651557";
  readonly inputBytesHash: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly projectionCommitment: `sha256:${string}`;
  readonly childSubBuildWindowCommitment: `sha256:${string}`;
  readonly sourceMemberRowsCommitment: `sha256:${string}`;
  readonly detachedStateCommitment: `sha256:${string}`;
  readonly step42_43RepairCommitment: `sha256:${string}`;
  readonly step43PredecessorCommitment: `sha256:${string}`;
  readonly sourceDocumentHash: `sha256:${string}`;
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly partCount: 280;
  readonly buildStepCount: 43;
  readonly canonicalCapturePolicy: "lego.canonical-capture/1";
  readonly canonicalCapturePolicyHash: `sha256:${string}`;
  readonly browserVersion: string;
  readonly userAgent: string;
  readonly viewPacket: CanonicalViewPacket;
  readonly viewPacketCommitment: `sha256:${string}`;
  readonly renderPacket: RealBuildPrefix50Step44CaptureRenderPacket;
  readonly renderPacketCommitment: `sha256:${string}`;
  readonly captures: Record<string, RealBuildPrefix50Step44CaptureManifestRow>;
  readonly reviewStatus: "unreviewed";
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44CaptureManifestV3 extends Omit<
  RealBuildPrefix50Step44CaptureManifest,
  "schemaVersion"
> {
  readonly schemaVersion: "lego.real-build-prefix50-subbuild-return-review-capture/3";
  readonly captureScene: "model-only";
  readonly captureSceneCommitment: `sha256:${string}`;
  readonly page45CameraReceipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly page45CameraReceiptCommitment: `sha256:${string}`;
  readonly fixedCameraBaselineCommitment: `sha256:${string}`;
  readonly fixedCameraBaselineArtifact: RealBuildPrefix50Step43FixedCameraBaselineArtifact;
  readonly fixedCameraAfter: RealBuildPrefix50Step44FixedCameraFrame;
  readonly fixedCameraDelta: RealBuildPrefix50Step44FixedCameraDelta;
  readonly fixedCameraDeltaArtifact: RealBuildPrefix50Step44FixedCameraDeltaArtifact;
}

export interface RealBuildPrefix50Step44ArtifactVerification {
  readonly schemaVersion: "lego.real-build-prefix50-step44-artifact-verification/1";
  readonly authority: "none";
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly physicalPageRerenderCommitment: `sha256:${string}`;
  readonly sourcePageRasterCommitment: `sha256:${string}`;
  readonly panelCropCommitment: `sha256:${string}`;
  readonly captureManifestByteDigest: `sha256:${string}`;
  readonly captureManifestCommitment: `sha256:${string}`;
  readonly viewPacketCommitment: `sha256:${string}`;
  readonly renderPacketCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly step42_43RepairCommitment: `sha256:${string}`;
  readonly step43PredecessorCommitment: `sha256:${string}`;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly renderCommitments: Readonly<Record<string, `sha256:${string}`>>;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44ArtifactVerificationOptions {
  readonly repositoryRoot?: string;
  readonly allowTestArtifactPaths?: boolean;
  readonly testSourcePdfArtifactPath?: string;
  readonly laterSourceReadCapability?: RealBuildPrefix50Step44LaterSourceReadCapability;
}
