import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type {
  RealBuildSourceParityCalibrationCapturePngReference,
  RealBuildSourceParityCalibrationCaptureRoleDescriptor,
  RealBuildSourceParityCalibrationCaptureRole,
} from "./real-build-observation-source-parity-calibration-capture-types";
import type {
  RealBuildSourceParityProvenanceRole,
  RealBuildSourceParitySourceSnapshot,
} from "./real-build-observation-source-parity-types";

export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SCHEMA =
  "lego.real-build-observation-source-parity-calibration-publication/1" as const;
export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_EXECUTION_IDENTITY_SCHEMA =
  "lego.real-build-observation-source-parity-calibration-execution-identity/1" as const;
export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH =
  "output/playwright/real-build-source-calibration/summary.json" as const;

export const MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_FULL_MANIFEST_BYTES = 4 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_BYTES =
  4 * 1024 * 1024;

export interface RealBuildSourceParityCalibrationPublishedFile {
  readonly file: string;
  readonly byteLength: number;
  readonly digest: Sha256Digest;
}

export interface RealBuildSourceParityCalibrationPublishedRole extends RealBuildSourceParityCalibrationCaptureRoleDescriptor {
  readonly file: string;
}

export interface RealBuildSourceParityCalibrationPublishedPng extends RealBuildSourceParityCalibrationCapturePngReference {
  readonly stepNumber: number;
  readonly scale: "high" | "work";
  readonly file: string;
}

export interface RealBuildSourceParityCalibrationPublishedProvenance {
  readonly role: string;
  readonly byteLength: number;
  readonly digest: Sha256Digest;
  readonly file: string;
}

export interface RealBuildSourceParityCalibrationPublicationSummary {
  readonly schemaVersion: typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SCHEMA;
  readonly authority: {
    readonly status: "absent";
    readonly authorized: false;
    readonly reason: "pending-human-review/1";
  };
  readonly reviewState: "pending-unreviewed";
  readonly executionIdentityDigest: Sha256Digest;
  readonly runDirectory: string;
  readonly captureManifest: RealBuildSourceParityCalibrationPublishedFile;
  readonly fullPreparedPanelsManifest: RealBuildSourceParityCalibrationPublishedFile;
  readonly sourceSnapshot: RealBuildSourceParitySourceSnapshot;
  readonly roles: readonly RealBuildSourceParityCalibrationPublishedRole[];
  readonly pngs: readonly RealBuildSourceParityCalibrationPublishedPng[];
  readonly provenance: readonly RealBuildSourceParityCalibrationPublishedProvenance[];
}

export interface RealBuildSourceParityCalibrationPublicationInput {
  readonly repoRoot: string;
  /** Current parser-branded artifact, inert attachments, or transient browser capture. */
  readonly capture: unknown;
  readonly fullPreparedPanelsManifestBytes: Uint8Array;
  readonly sourceSnapshot: RealBuildSourceParitySourceSnapshot;
  readonly provenance: readonly RealBuildSourceParityProvenanceRole[];
}

export interface RealBuildSourceParityCalibrationPublicationArtifact {
  readonly summary: RealBuildSourceParityCalibrationPublicationSummary;
  readonly executionIdentityDigest: Sha256Digest;
  readonly summaryPath: typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH;
  readSummaryBytes(): Uint8Array;
  readCaptureManifestBytes(): Uint8Array;
  readFullPreparedPanelsManifestBytes(): Uint8Array;
  readRole(role: RealBuildSourceParityCalibrationCaptureRole): Uint8Array;
  readPng(stepNumber: number, scale: "high" | "work"): Uint8Array;
  readProvenance(role: string): Uint8Array;
}
