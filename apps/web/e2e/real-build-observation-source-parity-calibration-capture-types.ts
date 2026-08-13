import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildObservationSourceStageMaskReference } from "./real-build-observation-source-stage-trace-types";

export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA =
  "lego.real-build-observation-source-parity-calibration-browser-capture/1" as const;
export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_SCHEMA =
  "lego.real-build-observation-source-parity-calibration-capture/1" as const;

export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES = Object.freeze([
  "calibration-high-rgba8",
  "calibration-work-rgba8",
  "calibration-stage-manifest-json",
  "calibration-stage-packed-msb",
  "calibration-w-packed-msb",
] as const);

export type RealBuildSourceParityCalibrationCaptureRole =
  (typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES)[number];

export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS = Object.freeze({
  "calibration-high-rgba8": "rgba8-clamped/1",
  "calibration-work-rgba8": "rgba8-clamped/1",
  "calibration-stage-manifest-json": "utf8-canonical-json/1",
  "calibration-stage-packed-msb": "packed-binary-mask-msb/1",
  "calibration-w-packed-msb": "packed-binary-mask-msb/1",
} as const);

export type RealBuildSourceParityCalibrationCaptureRoleEncoding =
  (typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS)[RealBuildSourceParityCalibrationCaptureRole];

export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY = Object.freeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "pending-human-review/1" as const,
});

export const MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_MANIFEST_BYTES = 4 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_HIGH_RGBA_BYTES =
  5 * 4 * 4_194_304;
export const MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_WORK_RGBA_BYTES =
  5 * 4 * 1_048_576;
export const MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_MANIFEST_BYTES =
  4 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_BYTES = 32 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_W_BYTES =
  5 * Math.ceil(1_048_576 / 8);
export const MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES = 128 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_BYTES = 384 * 1024 * 1024;

export interface RealBuildSourceParityCalibrationCaptureRoleDescriptor {
  readonly role: RealBuildSourceParityCalibrationCaptureRole;
  readonly contentEncoding: RealBuildSourceParityCalibrationCaptureRoleEncoding;
  readonly byteLength: number;
  readonly digest: Sha256Digest;
}

/** Browser-only transport. Base64 is decoded and discarded before retention. */
export interface RealBuildSourceParityCalibrationCaptureWireRole extends RealBuildSourceParityCalibrationCaptureRoleDescriptor {
  readonly transportEncoding: "base64/1";
  readonly base64: string;
}

export interface RealBuildSourceParityCalibrationCaptureByteReference {
  readonly role: RealBuildSourceParityCalibrationCaptureRole;
  readonly offset: number;
  readonly byteLength: number;
  readonly digest: Sha256Digest;
}

export interface RealBuildSourceParityCalibrationCapturePackedMaskReference extends RealBuildSourceParityCalibrationCaptureByteReference {
  readonly contentEncoding: "packed-binary-mask-msb/1";
  readonly width: number;
  readonly height: number;
  readonly pixelCount: number;
  readonly lowPaddingBits: number;
  readonly unpackedDigest: Sha256Digest;
}

export interface RealBuildSourceParityCalibrationCapturePngReference {
  readonly mediaType: "image/png";
  readonly byteLength: number;
  readonly digest: Sha256Digest;
  readonly width: number;
  readonly height: number;
  readonly rgbaDigest: Sha256Digest;
}

export interface RealBuildSourceParityCalibrationCaptureWirePng extends RealBuildSourceParityCalibrationCapturePngReference {
  readonly transportEncoding: "data-url-base64/1";
  readonly dataUrl: string;
}

export interface RealBuildSourceParityCalibrationPairwiseMaskBinding {
  readonly left: "P" | "D";
  readonly right: "D" | "W";
  readonly differingPixels: number;
  readonly intersectionPixels: number;
  readonly unionPixels: number;
  readonly iou: number;
  readonly xorDigest: Sha256Digest;
}

export interface RealBuildSourceParityCalibrationCapturePanel {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
  readonly calloutBoxes: readonly {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  }[];
  readonly panelEvidenceDigest: Sha256Digest;
  readonly highWidth: number;
  readonly highHeight: number;
  readonly highPixelCount: number;
  readonly workWidth: number;
  readonly workHeight: number;
  readonly workPixelCount: number;
  readonly workFactor: 2;
  readonly highRgba: RealBuildSourceParityCalibrationCaptureByteReference;
  readonly workRgba: RealBuildSourceParityCalibrationCaptureByteReference;
  readonly stageTracePanelIndex: number;
  readonly pMask: RealBuildObservationSourceStageMaskReference;
  readonly dMask: RealBuildObservationSourceStageMaskReference;
  readonly wMask: RealBuildSourceParityCalibrationCapturePackedMaskReference;
  readonly candidatePolicyDigest: Sha256Digest;
  readonly candidateDerivationDigest: Sha256Digest;
  readonly pairwisePdw: readonly [
    RealBuildSourceParityCalibrationPairwiseMaskBinding,
    RealBuildSourceParityCalibrationPairwiseMaskBinding,
    RealBuildSourceParityCalibrationPairwiseMaskBinding,
  ];
  readonly highPng: RealBuildSourceParityCalibrationCapturePngReference;
  readonly workPng: RealBuildSourceParityCalibrationCapturePngReference;
}

export interface RealBuildSourceParityCalibrationCaptureWirePanel extends Omit<
  RealBuildSourceParityCalibrationCapturePanel,
  "highPng" | "workPng"
> {
  readonly highPng: RealBuildSourceParityCalibrationCaptureWirePng;
  readonly workPng: RealBuildSourceParityCalibrationCaptureWirePng;
}

export interface RealBuildSourceParityCalibrationCaptureManifest {
  readonly schemaVersion: typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_SCHEMA;
  readonly authority: typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY;
  readonly reviewState: "pending-unreviewed";
  readonly pdfDigest: Sha256Digest;
  readonly pdfBytes: number;
  readonly fullPreparedPanelsDigest: Sha256Digest;
  readonly calibrationPreparedPanelsDigest: Sha256Digest;
  readonly calibrationDigest: Sha256Digest;
  /** Exact canonical transient browser wire before base64 and data URLs were discarded. */
  readonly browserCaptureDigest: Sha256Digest;
  readonly browserCaptureBytes: number;
  readonly roles: readonly RealBuildSourceParityCalibrationCaptureRoleDescriptor[];
  readonly panels: readonly RealBuildSourceParityCalibrationCapturePanel[];
}

export interface RealBuildSourceParityCalibrationBrowserCaptureWire {
  readonly schemaVersion: typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA;
  readonly authority: typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY;
  readonly reviewState: "pending-unreviewed";
  readonly pdfDigest: Sha256Digest;
  readonly pdfBytes: number;
  readonly fullPreparedPanelsDigest: Sha256Digest;
  readonly calibrationPreparedPanelsDigest: Sha256Digest;
  readonly calibrationDigest: Sha256Digest;
  readonly roles: readonly RealBuildSourceParityCalibrationCaptureWireRole[];
  readonly panels: readonly RealBuildSourceParityCalibrationCaptureWirePanel[];
}

export interface RealBuildSourceParityCalibrationCaptureFinalizationInput {
  readonly browserCapture: RealBuildSourceParityCalibrationBrowserCaptureWire;
}

export interface RealBuildSourceParityCalibrationCaptureArtifact {
  readonly manifest: RealBuildSourceParityCalibrationCaptureManifest;
  readonly manifestDigest: Sha256Digest;
  readManifestBytes(): Uint8Array;
  readRole(role: RealBuildSourceParityCalibrationCaptureRole): Uint8Array;
  readPng(stepNumber: number, scale: "high" | "work"): Uint8Array;
}

export interface RealBuildSourceParityCalibrationCaptureAttachments {
  readonly manifestBytes: Uint8Array;
  readonly roles: readonly {
    readonly role: RealBuildSourceParityCalibrationCaptureRole;
    readonly bytes: Uint8Array;
  }[];
  readonly pngs: readonly {
    readonly stepNumber: number;
    readonly scale: "high" | "work";
    readonly bytes: Uint8Array;
  }[];
}
