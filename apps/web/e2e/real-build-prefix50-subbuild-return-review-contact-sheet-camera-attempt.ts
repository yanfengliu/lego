import { canonicalDigest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { sha256RealBuildPrefix50Step44BlindBytes } from "./real-build-prefix50-subbuild-return-review-blind.ts";
import { renderRealBuildPrefix50Step44CameraMask } from "./real-build-prefix50-subbuild-return-review-camera.ts";
import {
  type RealBuildPrefix50Step44PersistedCameraAttemptReceipt,
  type RealBuildPrefix50Step44VerifiedPersistedCameraAttempt,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt.ts";
import {
  requireRealBuildPrefix50Step44VerifiedPersistedCameraAttempt,
  verifyPersistedRealBuildPrefix50Step44CameraAttempt,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt-persistence.ts";
import { persistedCameraSemanticSourceFromReceipt } from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-setup.ts";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import type { RealBuildPrefix50Step44Page45CameraReceipt } from "./real-build-prefix50-subbuild-return-review-camera-receipt-types.ts";
import {
  deriveRealBuildPrefix50Step44ParentOnlyRegion,
  type RealBuildPrefix50Step44ParentOnlyRegion,
} from "./real-build-prefix50-subbuild-return-review-camera-source.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";

type CameraInstrumentArtifactKey =
  | "page45Crop"
  | "eligibleParentRegionMask"
  | "parentOnlyTargetMask"
  | "selectedParentControlRender";

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

export function verifyRealBuildPrefix50Step44PersistedParentOnlyRegion(input: {
  readonly parentOnlyRegion: RealBuildPrefix50Step44ParentOnlyRegion;
  readonly page45CropRgba: Uint8Array;
  readonly eligibleParentRegionMaskRgba: Uint8Array;
  readonly parentOnlyTargetMaskRgba: Uint8Array;
}): void {
  const derived = deriveRealBuildPrefix50Step44ParentOnlyRegion(input.page45CropRgba);
  exactKeys(
    input.parentOnlyRegion,
    Object.keys(derived.evidence),
    "Persisted Step-44 parent-only region",
  );
  const eligiblePixels = renderRealBuildPrefix50Step44CameraMask(
    derived.eligibleMask,
    "eligible-parent-region",
  );
  const parentOnlyPixels = renderRealBuildPrefix50Step44CameraMask(
    derived.parentOnlyForegroundMask,
    "parent-only-target",
  );
  if (
    input.parentOnlyRegion.commitment !==
      canonicalDigest(withoutCommitment(input.parentOnlyRegion)) ||
    canonicalDigest(input.parentOnlyRegion) !== canonicalDigest(derived.evidence) ||
    sha256RealBuildPrefix50Step44BlindBytes(input.eligibleParentRegionMaskRgba) !==
      sha256RealBuildPrefix50Step44BlindBytes(eligiblePixels) ||
    sha256RealBuildPrefix50Step44BlindBytes(input.parentOnlyTargetMaskRgba) !==
      sha256RealBuildPrefix50Step44BlindBytes(parentOnlyPixels)
  )
    throw new TypeError(
      "Persisted Step-44 parent-only region and mask artifacts must rederive from the exact page-45 crop pixels.",
    );
}

function verifyCameraInstrumentArtifacts(
  outputPath: string,
  blindId: `B${string}`,
  receipt: RealBuildPrefix50Step44Page45CameraReceipt,
): ReadonlyMap<CameraInstrumentArtifactKey, Uint8Array> {
  const expected: Readonly<Record<CameraInstrumentArtifactKey, string>> = {
    page45Crop: "real-build-prefix50-step44-page45-camera-source-crop.png",
    eligibleParentRegionMask: "real-build-prefix50-step44-page45-camera-eligible-mask.png",
    parentOnlyTargetMask: "real-build-prefix50-step44-page45-camera-parent-target-mask.png",
    selectedParentControlRender: "real-build-prefix50-step44-page45-camera-selected-parent.png",
  } as const;
  exactKeys(
    receipt.instrumentArtifacts,
    Object.keys(expected),
    `Step-44 ${blindId} camera artifacts`,
  );
  const decodedPixels = new Map<CameraInstrumentArtifactKey, Uint8Array>();
  for (const key of Object.keys(expected) as CameraInstrumentArtifactKey[]) {
    const artifactFile = expected[key];
    const row = receipt.instrumentArtifacts[key];
    exactKeys(
      row,
      ["artifactFile", "commitment", "height", "pixelDigest", "pngDigest", "width"],
      `Step-44 ${blindId} camera artifact ${key}`,
    );
    const bytes = readRealBuildPrefix50Step44ReviewArtifact(
      outputPath,
      artifactFile,
      16 * 1024 * 1024,
      `Step-44 ${blindId} camera artifact ${key}`,
    );
    const decoded = decodeRealBuildPrefix50Step44ReviewPng(
      bytes,
      720 * 470,
      `Step-44 ${blindId} camera artifact ${key}`,
    );
    if (
      row.artifactFile !== artifactFile ||
      row.width !== 720 ||
      row.height !== 470 ||
      decoded.width !== row.width ||
      decoded.height !== row.height ||
      row.pngDigest !== sha256RealBuildPrefix50Step44BlindBytes(bytes) ||
      row.pixelDigest !== sha256RealBuildPrefix50Step44BlindBytes(decoded.rgba) ||
      row.commitment !== canonicalDigest(withoutCommitment(row))
    )
      throw new TypeError(`Step-44 ${blindId} camera artifact ${key} drifted.`);
    decodedPixels.set(key, new Uint8Array(decoded.rgba));
  }
  return decodedPixels;
}

function requirePixels(
  artifacts: ReadonlyMap<CameraInstrumentArtifactKey, Uint8Array>,
  key: CameraInstrumentArtifactKey,
): Uint8Array {
  const pixels = artifacts.get(key);
  if (pixels === undefined) throw new TypeError(`Step-44 camera artifact ${key} was not decoded.`);
  return pixels;
}

export function verifyRealBuildPrefix50Step44SharedPersistedCameraAttempt(input: {
  readonly outputPath: string;
  readonly blindId: `B${string}`;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}): RealBuildPrefix50Step44VerifiedPersistedCameraAttempt {
  const pixels = verifyCameraInstrumentArtifacts(input.outputPath, input.blindId, input.receipt);
  const page45CropRgba = requirePixels(pixels, "page45Crop");
  const parentOnly = deriveRealBuildPrefix50Step44ParentOnlyRegion(page45CropRgba);
  verifyRealBuildPrefix50Step44PersistedParentOnlyRegion({
    parentOnlyRegion: input.receipt.parentOnlyRegion,
    page45CropRgba,
    eligibleParentRegionMaskRgba: requirePixels(pixels, "eligibleParentRegionMask"),
    parentOnlyTargetMaskRgba: requirePixels(pixels, "parentOnlyTargetMask"),
  });
  const proof = verifyPersistedRealBuildPrefix50Step44CameraAttempt({
    outputPath: input.outputPath,
    expectedSearchAttemptCommitment: input.receipt.cameraSearchAttemptCommitment,
    expectedCameraReceiptCommitment: input.receipt.commitment,
    reviewBatch: input.batch,
    source: persistedCameraSemanticSourceFromReceipt({
      receipt: input.receipt,
      rgba: page45CropRgba,
      eligibleMask: parentOnly.eligibleMask,
      parentOnlyTargetMask: parentOnly.parentOnlyForegroundMask,
    }),
    realDomainQualification: input.realDomainQualification,
  });
  const persisted = requireRealBuildPrefix50Step44VerifiedPersistedCameraAttempt({
    proof,
    outputPath: input.outputPath,
    reviewBatchEnvelopeCommitment: input.batch.commitment,
    cameraReceiptCommitment: input.receipt.commitment,
    searchAttemptCommitment: input.receipt.cameraSearchAttemptCommitment,
  });
  const branch = persisted.searchAttempt.branchMeasurements.find(
    (row) => row.branchKey === input.receipt.selectedBranchKey,
  );
  const pass = branch?.alignmentPasses[branch.publishedPassIndex];
  if (pass === undefined)
    throw new TypeError(`Step-44 ${input.blindId} selected camera attempt pass is absent.`);
  const stableBytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.outputPath,
    input.receipt.instrumentArtifacts.selectedParentControlRender.artifactFile,
    16 * 1024 * 1024,
    `Step-44 ${input.blindId} selected camera instrument render`,
  );
  const attemptBytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.outputPath,
    pass.artifactFile,
    16 * 1024 * 1024,
    `Step-44 ${input.blindId} selected camera attempt render`,
  );
  if (!stableBytes.equals(attemptBytes))
    throw new TypeError(
      `Step-44 ${input.blindId} stable selected camera artifact is not byte-identical to its published branch render.`,
    );
  return proof;
}

export function requireRealBuildPrefix50Step44SharedPersistedCameraAttempt(input: {
  readonly proof: RealBuildPrefix50Step44VerifiedPersistedCameraAttempt;
  readonly outputPath: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
}): RealBuildPrefix50Step44PersistedCameraAttemptReceipt {
  return requireRealBuildPrefix50Step44VerifiedPersistedCameraAttempt({
    proof: input.proof,
    outputPath: input.outputPath,
    reviewBatchEnvelopeCommitment: input.batch.commitment,
    cameraReceiptCommitment: input.receipt.commitment,
    searchAttemptCommitment: input.receipt.cameraSearchAttemptCommitment,
  });
}
