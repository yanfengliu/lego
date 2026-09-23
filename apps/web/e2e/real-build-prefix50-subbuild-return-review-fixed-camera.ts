import { createHash } from "node:crypto";

import { canonicalDigest, deepFreeze, documentStructuralHash } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import type { RealBuildPrefix50Step44Page45CameraReceipt } from "./real-build-prefix50-subbuild-return-review-camera.ts";
import { realBuildPrefix50SubBuildReturnReviewHarnessEnvelopeCommitment } from "./real-build-prefix50-subbuild-return-review-envelope.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";

const FIXED_CAMERA_WIDTH = 720;
const FIXED_CAMERA_HEIGHT = 470;
const FIXED_CAMERA_RGBA_BYTES = FIXED_CAMERA_WIDTH * FIXED_CAMERA_HEIGHT * 4;
const FIXED_CAMERA_BASELINE_FILE =
  "real-build-prefix50-step44-page45-camera-selected-parent.png" as const;
const FIXED_CAMERA_DELTA_FILE = "real-build-prefix50-step44-page45-fixed-camera-delta.png" as const;

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export interface RealBuildPrefix50Step44FixedCameraFrame {
  readonly schemaVersion: "lego.real-build-prefix50-step44-fixed-camera-frame/2";
  readonly scene: "model-only";
  readonly backgroundHex: 0x899093;
  readonly completedPrintedStep: 43 | 44;
  readonly candidateKey: string | null;
  readonly documentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}` | null;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}` | null;
  readonly page45CameraReceiptCommitment: `sha256:${string}`;
  readonly cameraCommitment: `sha256:${string}`;
  readonly width: 720;
  readonly height: 470;
  readonly pngByteLength: number;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44FixedCameraPixels {
  readonly evidence: RealBuildPrefix50Step44FixedCameraFrame;
  readonly pngBytes: Uint8Array;
  readonly rgba: Uint8Array;
}

export interface RealBuildPrefix50Step43FixedCameraBaselineArtifact {
  readonly schemaVersion: "lego.real-build-prefix50-step43-fixed-camera-baseline-artifact/1";
  readonly authority: "none";
  readonly scene: "model-only";
  readonly artifactFile: typeof FIXED_CAMERA_BASELINE_FILE;
  readonly page45CameraReceiptCommitment: `sha256:${string}`;
  readonly cameraCommitment: `sha256:${string}`;
  readonly baselineFrameCommitment: `sha256:${string}`;
  readonly width: 720;
  readonly height: 470;
  readonly pngByteLength: number;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44FixedCameraDeltaPixels {
  readonly rgba: Uint8Array;
  readonly changedPixelCount: number;
  readonly changedPixelBounds: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
    readonly width: number;
    readonly height: number;
  } | null;
}

export interface RealBuildPrefix50Step44FixedCameraDelta {
  readonly schemaVersion: "lego.real-build-prefix50-step43-to-44-fixed-camera-delta/1";
  readonly authority: "none";
  readonly scene: "model-only";
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly page45CameraReceiptCommitment: `sha256:${string}`;
  readonly cameraCommitment: `sha256:${string}`;
  readonly baselineCommitment: `sha256:${string}`;
  readonly afterCommitment: `sha256:${string}`;
  readonly baselinePngDigest: `sha256:${string}`;
  readonly baselinePixelDigest: `sha256:${string}`;
  readonly afterPngDigest: `sha256:${string}`;
  readonly afterPixelDigest: `sha256:${string}`;
  readonly changedPixelCount: number;
  readonly changedPixelBounds: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
    readonly width: number;
    readonly height: number;
  } | null;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44FixedCameraDeltaArtifact {
  readonly schemaVersion: "lego.real-build-prefix50-step43-to-44-fixed-camera-delta-artifact/1";
  readonly authority: "none";
  readonly scene: "model-only";
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly page45CameraReceiptCommitment: `sha256:${string}`;
  readonly cameraCommitment: `sha256:${string}`;
  readonly baselineCommitment: `sha256:${string}`;
  readonly afterCommitment: `sha256:${string}`;
  readonly deltaCommitment: `sha256:${string}`;
  readonly artifactFile: string;
  readonly width: 720;
  readonly height: 470;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

function requirePixels(input: {
  pngBytes: Uint8Array;
  rgba: Uint8Array;
  width: number;
  height: number;
  cameraCommitment: `sha256:${string}`;
  receipt: RealBuildPrefix50Step44Page45CameraReceipt;
}): void {
  if (
    input.width !== FIXED_CAMERA_WIDTH ||
    input.height !== FIXED_CAMERA_HEIGHT ||
    input.rgba.byteLength !== FIXED_CAMERA_RGBA_BYTES ||
    input.pngBytes.byteLength < 1 ||
    input.pngBytes.byteLength > 16 * 1024 * 1024 ||
    input.cameraCommitment !== input.receipt.selectedCameraCommitment
  )
    throw new TypeError(
      "Step-44 fixed-camera frame is unbounded or drifted from its exact camera.",
    );
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

export function deriveRealBuildPrefix50Step44FixedCameraDeltaPixels(
  baselineRgba: Uint8Array,
  afterRgba: Uint8Array,
): RealBuildPrefix50Step44FixedCameraDeltaPixels {
  if (
    baselineRgba.byteLength !== FIXED_CAMERA_RGBA_BYTES ||
    afterRgba.byteLength !== FIXED_CAMERA_RGBA_BYTES
  )
    throw new TypeError("Step-43/44 fixed-camera delta pixels must be exact 720x470 RGBA frames.");
  const rgba = new Uint8Array(FIXED_CAMERA_RGBA_BYTES);
  let changedPixelCount = 0;
  let minX = FIXED_CAMERA_WIDTH;
  let minY = FIXED_CAMERA_HEIGHT;
  let maxX = -1;
  let maxY = -1;
  for (let pixel = 0; pixel < FIXED_CAMERA_WIDTH * FIXED_CAMERA_HEIGHT; pixel += 1) {
    const offset = pixel * 4;
    const changed =
      baselineRgba[offset] !== afterRgba[offset] ||
      baselineRgba[offset + 1] !== afterRgba[offset + 1] ||
      baselineRgba[offset + 2] !== afterRgba[offset + 2] ||
      baselineRgba[offset + 3] !== afterRgba[offset + 3];
    rgba[offset] = changed ? 0xff : 0x35;
    rgba[offset + 1] = changed ? 0x30 : 0x39;
    rgba[offset + 2] = changed ? 0xd8 : 0x37;
    rgba[offset + 3] = 0xff;
    if (!changed) continue;
    changedPixelCount += 1;
    const x = pixel % FIXED_CAMERA_WIDTH;
    const y = Math.floor(pixel / FIXED_CAMERA_WIDTH);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    rgba,
    changedPixelCount,
    changedPixelBounds:
      changedPixelCount === 0
        ? null
        : { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

function frame(
  input: Parameters<typeof requirePixels>[0] & {
    completedPrintedStep: 43 | 44;
    candidateKey: string | null;
    documentHash: `sha256:${string}`;
    selectedDocumentCommitment: `sha256:${string}` | null;
    reviewHarnessEnvelopeCommitment: `sha256:${string}` | null;
  },
): RealBuildPrefix50Step44FixedCameraPixels {
  requirePixels(input);
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-fixed-camera-frame/2" as const,
    scene: "model-only" as const,
    backgroundHex: 0x899093 as const,
    completedPrintedStep: input.completedPrintedStep,
    candidateKey: input.candidateKey,
    documentHash: input.documentHash,
    selectedDocumentCommitment: input.selectedDocumentCommitment,
    reviewHarnessEnvelopeCommitment: input.reviewHarnessEnvelopeCommitment,
    page45CameraReceiptCommitment: input.receipt.commitment,
    cameraCommitment: input.cameraCommitment,
    width: 720 as const,
    height: 470 as const,
    pngByteLength: input.pngBytes.byteLength,
    pngDigest: sha256(input.pngBytes),
    pixelDigest: sha256(input.rgba),
  };
  return {
    evidence: deepFreeze({ ...body, commitment: canonicalDigest(body) }),
    pngBytes: input.pngBytes,
    rgba: input.rgba,
  };
}

export function createRealBuildPrefix50Step43FixedCameraBaseline(input: {
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly cameraCommitment: `sha256:${string}`;
  readonly pngBytes: Uint8Array;
  readonly rgba: Uint8Array;
  readonly width: number;
  readonly height: number;
}): RealBuildPrefix50Step44FixedCameraPixels {
  return frame({
    ...input,
    completedPrintedStep: 43,
    candidateKey: null,
    documentHash: input.receipt.sharedParentDocumentHash,
    selectedDocumentCommitment: null,
    reviewHarnessEnvelopeCommitment: null,
  });
}

export function createRealBuildPrefix50Step43FixedCameraBaselineArtifact(input: {
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly baseline: RealBuildPrefix50Step44FixedCameraPixels;
}): RealBuildPrefix50Step43FixedCameraBaselineArtifact {
  const { receipt, baseline } = input;
  const retained = receipt.instrumentArtifacts.selectedParentControlRender;
  if (
    retained.artifactFile !== FIXED_CAMERA_BASELINE_FILE ||
    retained.width !== FIXED_CAMERA_WIDTH ||
    retained.height !== FIXED_CAMERA_HEIGHT ||
    baseline.evidence.completedPrintedStep !== 43 ||
    baseline.evidence.candidateKey !== null ||
    baseline.evidence.page45CameraReceiptCommitment !== receipt.commitment ||
    baseline.evidence.cameraCommitment !== receipt.selectedCameraCommitment ||
    baseline.evidence.width !== retained.width ||
    baseline.evidence.height !== retained.height ||
    baseline.evidence.pngByteLength !== baseline.pngBytes.byteLength ||
    baseline.evidence.pngDigest !== retained.pngDigest ||
    baseline.evidence.pixelDigest !== retained.pixelDigest ||
    baseline.evidence.pngDigest !== receipt.selectedParentPngDigest ||
    baseline.evidence.pixelDigest !== receipt.selectedParentPixelDigest ||
    sha256(baseline.pngBytes) !== baseline.evidence.pngDigest ||
    sha256(baseline.rgba) !== baseline.evidence.pixelDigest
  )
    throw new TypeError(
      "Step-43 fixed-camera baseline artifact must bind the persisted selected-parent bytes and frame.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-step43-fixed-camera-baseline-artifact/1" as const,
    authority: "none" as const,
    scene: "model-only" as const,
    artifactFile: FIXED_CAMERA_BASELINE_FILE,
    page45CameraReceiptCommitment: receipt.commitment,
    cameraCommitment: receipt.selectedCameraCommitment,
    baselineFrameCommitment: baseline.evidence.commitment,
    width: FIXED_CAMERA_WIDTH as 720,
    height: FIXED_CAMERA_HEIGHT as 470,
    pngByteLength: baseline.pngBytes.byteLength,
    pngDigest: baseline.evidence.pngDigest,
    pixelDigest: baseline.evidence.pixelDigest,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function createRealBuildPrefix50Step44FixedCameraAfter(input: {
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly envelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
  readonly cameraCommitment: `sha256:${string}`;
  readonly pngBytes: Uint8Array;
  readonly rgba: Uint8Array;
  readonly width: number;
  readonly height: number;
}): RealBuildPrefix50Step44FixedCameraPixels {
  const body = { ...input.envelope } as typeof input.envelope & { commitment?: unknown };
  Reflect.deleteProperty(body, "commitment");
  if (
    !/^[0-9a-f]{64}$/u.test(input.envelope.candidateKey) ||
    input.envelope.commitment !==
      realBuildPrefix50SubBuildReturnReviewHarnessEnvelopeCommitment(body) ||
    input.envelope.returnResultCommitment !== input.receipt.returnResultCommitment ||
    input.envelope.candidateRosterCommitment !== input.receipt.candidateRosterCommitment ||
    input.envelope.sourceDocumentHash !== input.receipt.sourceDocumentHash ||
    input.envelope.selectedDocumentHash !==
      documentStructuralHash(input.envelope.selectedDocument) ||
    input.envelope.selectedDocumentCommitment !== canonicalDigest(input.envelope.selectedDocument)
  )
    throw new TypeError(
      "Step-44 fixed-camera after frame requires an exact receipt-bound roster envelope and document.",
    );
  return frame({
    ...input,
    completedPrintedStep: 44,
    candidateKey: input.envelope.candidateKey,
    documentHash: input.envelope.selectedDocumentHash,
    selectedDocumentCommitment: input.envelope.selectedDocumentCommitment,
    reviewHarnessEnvelopeCommitment: input.envelope.commitment,
  });
}

export function compareRealBuildPrefix50Step43To44FixedCamera(
  baseline: RealBuildPrefix50Step44FixedCameraPixels,
  after: RealBuildPrefix50Step44FixedCameraPixels,
): RealBuildPrefix50Step44FixedCameraDelta {
  if (
    baseline.evidence.completedPrintedStep !== 43 ||
    baseline.evidence.candidateKey !== null ||
    baseline.evidence.selectedDocumentCommitment !== null ||
    baseline.evidence.reviewHarnessEnvelopeCommitment !== null ||
    after.evidence.completedPrintedStep !== 44 ||
    after.evidence.candidateKey === null ||
    after.evidence.selectedDocumentCommitment === null ||
    after.evidence.reviewHarnessEnvelopeCommitment === null ||
    baseline.evidence.page45CameraReceiptCommitment !==
      after.evidence.page45CameraReceiptCommitment ||
    baseline.evidence.cameraCommitment !== after.evidence.cameraCommitment ||
    baseline.rgba.byteLength !== after.rgba.byteLength
  )
    throw new TypeError("Step-43/44 fixed-camera delta requires one shared exact camera.");
  const measured = deriveRealBuildPrefix50Step44FixedCameraDeltaPixels(baseline.rgba, after.rgba);
  const body = {
    schemaVersion: "lego.real-build-prefix50-step43-to-44-fixed-camera-delta/1" as const,
    authority: "none" as const,
    scene: "model-only" as const,
    candidateKey: after.evidence.candidateKey,
    selectedDocumentHash: after.evidence.documentHash,
    selectedDocumentCommitment: after.evidence.selectedDocumentCommitment,
    reviewHarnessEnvelopeCommitment: after.evidence.reviewHarnessEnvelopeCommitment,
    page45CameraReceiptCommitment: after.evidence.page45CameraReceiptCommitment,
    cameraCommitment: after.evidence.cameraCommitment,
    baselineCommitment: baseline.evidence.commitment,
    afterCommitment: after.evidence.commitment,
    baselinePngDigest: baseline.evidence.pngDigest,
    baselinePixelDigest: baseline.evidence.pixelDigest,
    afterPngDigest: after.evidence.pngDigest,
    afterPixelDigest: after.evidence.pixelDigest,
    changedPixelCount: measured.changedPixelCount,
    changedPixelBounds: measured.changedPixelBounds,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function createRealBuildPrefix50Step44FixedCameraDeltaArtifact(input: {
  readonly delta: RealBuildPrefix50Step44FixedCameraDelta;
  readonly baseline: RealBuildPrefix50Step44FixedCameraPixels;
  readonly after: RealBuildPrefix50Step44FixedCameraPixels;
  readonly artifactFile: string;
  readonly pngBytes: Uint8Array;
}): RealBuildPrefix50Step44FixedCameraDeltaArtifact {
  if (
    input.artifactFile !== FIXED_CAMERA_DELTA_FILE ||
    input.pngBytes.byteLength < 1 ||
    input.pngBytes.byteLength > 16 * 1024 * 1024
  )
    throw new TypeError("Step-44 fixed-camera delta artifact must be one exact bounded PNG.");
  const recomputedDelta = compareRealBuildPrefix50Step43To44FixedCamera(
    input.baseline,
    input.after,
  );
  const recomputedPixels = deriveRealBuildPrefix50Step44FixedCameraDeltaPixels(
    input.baseline.rgba,
    input.after.rgba,
  );
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(
    input.pngBytes,
    FIXED_CAMERA_WIDTH * FIXED_CAMERA_HEIGHT,
    "Step-44 fixed-camera delta artifact",
  );
  if (
    input.delta.commitment !== recomputedDelta.commitment ||
    decoded.width !== FIXED_CAMERA_WIDTH ||
    decoded.height !== FIXED_CAMERA_HEIGHT ||
    !sameBytes(decoded.rgba, recomputedPixels.rgba)
  )
    throw new TypeError(
      "Step-44 fixed-camera delta artifact pixels must be derived from its exact baseline and after frames.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-step43-to-44-fixed-camera-delta-artifact/1" as const,
    authority: "none" as const,
    scene: "model-only" as const,
    candidateKey: input.delta.candidateKey,
    selectedDocumentHash: input.delta.selectedDocumentHash,
    selectedDocumentCommitment: input.delta.selectedDocumentCommitment,
    reviewHarnessEnvelopeCommitment: input.delta.reviewHarnessEnvelopeCommitment,
    page45CameraReceiptCommitment: input.delta.page45CameraReceiptCommitment,
    cameraCommitment: input.delta.cameraCommitment,
    baselineCommitment: input.delta.baselineCommitment,
    afterCommitment: input.delta.afterCommitment,
    deltaCommitment: input.delta.commitment,
    artifactFile: input.artifactFile,
    width: FIXED_CAMERA_WIDTH as 720,
    height: FIXED_CAMERA_HEIGHT as 470,
    pngDigest: sha256(input.pngBytes),
    pixelDigest: sha256(recomputedPixels.rgba),
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}
