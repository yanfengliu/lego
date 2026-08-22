import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildDocumentCandidateId } from "./real-build-candidate-lineage-identity";
import type {
  RealBuildCompiledObservationCameraId,
  RealBuildCompiledObservationMaskReference,
  RealBuildCompiledObservationSourceId,
} from "./real-build-compiled-observation-closure-types";

export const REAL_BUILD_BROWSER_CAMERA_EVIDENCE_SCHEMA_VERSION =
  "lego.real-build-browser-output-v4-camera-evidence/1" as const;
export const MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES = 64 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES = 128 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROWS = 8_192;

export interface RealBuildBrowserCameraEvidenceChild {
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
  readonly canonicalBytesDigest: Sha256Digest;
  readonly canonicalByteLength: number;
}

export interface RealBuildBrowserCameraEvidenceCrop {
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
}

export interface RealBuildBrowserCameraEvidencePreparedPanel {
  readonly preparedRunInputDigest: Sha256Digest;
  readonly preparedStepIdentity: Sha256Digest;
  readonly provisionalStepIdentity: Sha256Digest;
  readonly observationMode: "own-panel" | "lookahead";
  readonly compiledThroughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  readonly pageNumber: number;
  readonly panelDigest: Sha256Digest;
  readonly cropDigest: Sha256Digest;
  readonly sourceDescriptorDigest: Sha256Digest;
  readonly exclusionDescriptorDigest: Sha256Digest;
  readonly crop: RealBuildBrowserCameraEvidenceCrop;
  readonly face: "studs-up" | "underside";
  readonly measure: "iou" | "containment";
}

export interface RealBuildBrowserCameraEvidenceFittedCamera {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
  readonly residualPx: number;
  readonly coherence: number;
  readonly centerXPx: number;
  readonly centerYPx: number;
}

export interface RealBuildBrowserCameraEvidenceLattice {
  readonly hand: "as-fitted" | "x-reflected";
  readonly determinant: 1 | -1;
  readonly turnDegrees: 0 | 90 | 180 | 270;
}

export interface RealBuildBrowserCameraEvidenceRendererInputs {
  readonly renderer: "three-webgl";
  readonly rendererVersion: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly pixelRatio: 1;
  readonly backgroundRgba: readonly [number, number, number, number];
  readonly colorSpace: "srgb";
  readonly antialias: boolean;
  readonly alpha: true;
  readonly preserveDrawingBuffer: true;
  readonly cameraProjection: "perspective";
  readonly viewMatrix: readonly number[];
  readonly projectionMatrix: readonly number[];
  readonly cameraNear: number;
  readonly cameraFar: number;
  readonly sceneSnapshotDigest: Sha256Digest;
}

export interface RealBuildBrowserCameraEvidenceRenderReference {
  readonly role: "d4-child-render-rgba-bytes";
  readonly offset: number;
  readonly bytes: number;
  readonly digest: Sha256Digest;
  readonly encoding: "rgba8-top-left-row-major/1";
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface RealBuildBrowserCameraEvidenceRegistration {
  readonly shiftPx: readonly [number, number];
  readonly score: number;
  readonly sourcePixels: number;
  readonly intersectionPixels: number;
  readonly denominatorPixels: number;
}

export interface RealBuildBrowserCameraEvidenceRow {
  readonly evidenceId: `browser-camera-evidence:sha256:${string}`;
  readonly sourceId: RealBuildCompiledObservationSourceId;
  readonly cameraId: RealBuildCompiledObservationCameraId;
  readonly child: RealBuildBrowserCameraEvidenceChild;
  readonly preparedPanel: RealBuildBrowserCameraEvidencePreparedPanel;
  readonly fittedCamera: RealBuildBrowserCameraEvidenceFittedCamera;
  readonly fittedCameraDigest: Sha256Digest;
  readonly lattice: RealBuildBrowserCameraEvidenceLattice;
  readonly d4CameraRecipeDigest: Sha256Digest;
  readonly rendererInputs: RealBuildBrowserCameraEvidenceRendererInputs;
  readonly rendererSnapshotDigest: Sha256Digest;
  readonly render: RealBuildBrowserCameraEvidenceRenderReference;
  readonly maskExtraction: "rgba-alpha-nonzero/1";
  /** Global camera-mask-role base for the closure-local mask references below. */
  readonly maskRoleBaseOffset: number;
  readonly sourceMask: RealBuildCompiledObservationMaskReference;
  readonly excludedMask: RealBuildCompiledObservationMaskReference;
  readonly candidateMask: RealBuildCompiledObservationMaskReference;
  readonly registration: RealBuildBrowserCameraEvidenceRegistration;
}

export interface RealBuildBrowserCameraEvidenceManifest {
  readonly schemaVersion: typeof REAL_BUILD_BROWSER_CAMERA_EVIDENCE_SCHEMA_VERSION;
  readonly renderRole: {
    readonly role: "d4-child-render-rgba-bytes";
    readonly bytes: number;
    readonly digest: Sha256Digest;
  };
  readonly maskRole: {
    readonly role: "branch-observation-bytes";
    readonly bytes: number;
    readonly digest: Sha256Digest;
  };
  readonly rows: readonly RealBuildBrowserCameraEvidenceRow[];
  readonly provisionalAuthority: Readonly<{ status: "absent"; authorized: false }>;
  readonly sourceExecutionProvenanceAuthority: Readonly<{
    status: "absent";
    authorized: false;
  }>;
  readonly physicalAuthority: Readonly<{ status: "absent"; authorized: false }>;
  readonly placementAuthority: Readonly<{ status: "absent"; authorized: false }>;
  readonly completionAuthority: Readonly<{ status: "absent"; authorized: false }>;
}

export interface RealBuildBrowserCameraEvidenceInput {
  readonly sourceId: RealBuildCompiledObservationSourceId;
  readonly cameraId: RealBuildCompiledObservationCameraId;
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
  readonly canonicalDocumentBytes: Uint8Array;
  readonly preparedPanel: RealBuildBrowserCameraEvidencePreparedPanel;
  readonly fittedCamera: RealBuildBrowserCameraEvidenceFittedCamera;
  readonly lattice: RealBuildBrowserCameraEvidenceLattice;
  readonly rendererInputs: RealBuildBrowserCameraEvidenceRendererInputs;
  readonly renderRgba: Uint8Array;
  readonly sourceMask: Uint8Array;
  readonly excludedMask: Uint8Array;
  readonly candidateMask: Uint8Array;
}

export interface RealBuildBrowserCameraEvidenceBytes {
  readonly manifestBytes: Uint8Array;
  readonly renderRoleBytes: Uint8Array;
  readonly maskRoleBytes: Uint8Array;
}

export interface RealBuildBrowserCameraEvidenceInspection {
  readonly manifest: RealBuildBrowserCameraEvidenceManifest;
  readonly reproducible: true;
  readonly provenanceAuthority: "absent";
  readonly provisionalAuthority: "absent";
  readonly sourceExecutionProvenanceAuthority: "absent";
  readonly physicalAuthority: "absent";
  readonly placementAuthority: "absent";
  readonly completionAuthority: "absent";
}
