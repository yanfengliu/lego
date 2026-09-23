import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { writeContainedRegularFileAtomic } from "./contained-atomic-write.ts";
import { type RealBuildPrefix50Step44CameraOnlyRefusalSummary } from "./real-build-prefix50-step44-camera-only-gate-contract.ts";
import {
  assertRealBuildPrefix50Step44CameraOnlyManifestSourceLock,
  type RealBuildPrefix50Step44CameraOnlySourceLockEvidence,
} from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import type { RealBuildPrefix50Step44VerifiedPersistedCameraAttempt } from "./real-build-prefix50-subbuild-return-review-camera-attempt.ts";
import type { RealBuildPrefix50Step44PersistedCameraSemanticSource } from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-setup.ts";
import type { RealBuildPrefix50Step44InteriorFeatureCalibrationReceipt } from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import type { RealBuildPrefix50Step44Page45CameraReceipt } from "./real-build-prefix50-subbuild-return-review-camera-receipt-types.ts";
import type {
  RealBuildPrefix50Step44CameraSearchAttempt,
  RealBuildPrefix50Step44CameraSearchRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import type { RealBuildPrefix50Step44BrandedPage45Source } from "./real-build-prefix50-subbuild-return-review-camera-source.ts";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { foregroundMask } from "./real-build-prefix50-subbuild-return-review-camera-search-primitives.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-source-commitments.ts";
import {
  decodeRealBuildPrefix50Step44ReviewPng,
  encodeCanonicalRealBuildPrefix50Step44ReviewPng,
} from "./real-build-prefix50-subbuild-return-review-png.ts";

const PIXELS =
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH * REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT;
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_CROP_FILE =
  "real-build-prefix50-step44-page45-camera-source-crop.png";
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_ELIGIBLE_MASK_FILE =
  "real-build-prefix50-step44-page45-camera-eligible-mask.png";
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_PARENT_TARGET_MASK_FILE =
  "real-build-prefix50-step44-page45-camera-parent-target-mask.png";
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SELECTED_PARENT_FILE =
  "real-build-prefix50-step44-page45-camera-selected-parent.png";

export {
  assertRealBuildPrefix50Step44CameraOnlyCompleteManifest,
  assertRealBuildPrefix50Step44CameraOnlyRefusalManifest,
  writeRealBuildPrefix50Step44CameraOnlyManifest,
} from "./real-build-prefix50-step44-camera-only-gate-manifest.ts";
export { assertRealBuildPrefix50Step44CameraOnlyOutputTree } from "./real-build-prefix50-step44-camera-only-gate-tree.ts";
import {
  assertRealBuildPrefix50Step44CameraOnlyRefusalManifest,
  writeRealBuildPrefix50Step44CameraOnlyManifest,
} from "./real-build-prefix50-step44-camera-only-gate-manifest.ts";

interface CameraOnlyArtifactBinding {
  readonly artifactFile: string;
  readonly width: number;
  readonly height: number;
  readonly pngDigest: Sha256Digest;
  readonly pixelDigest: Sha256Digest;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44CameraOnlyOverlayBinding {
  readonly sourceRenderFile: string;
  readonly overlayFile: string;
  readonly pngDigest: Sha256Digest;
  readonly pixelDigest: Sha256Digest;
}

export class RealBuildPrefix50Step44CameraOnlyVerifiedRefusalError extends TypeError {
  readonly code = "STEP44_CAMERA_ONLY_VERIFIED_REFUSAL" as const;
  readonly outputPath: string;
  readonly manifestCommitment: Sha256Digest;
  readonly searchAttemptCommitment: Sha256Digest;
  readonly refusalReasons: readonly RealBuildPrefix50Step44CameraSearchRefusal[];

  constructor(input: {
    readonly outputPath: string;
    readonly manifestCommitment: Sha256Digest;
    readonly searchAttemptCommitment: Sha256Digest;
    readonly refusalReasons: readonly RealBuildPrefix50Step44CameraSearchRefusal[];
  }) {
    super(
      `Camera-only Step-44 gate independently verified a refused attempt (${input.refusalReasons.join(
        ", ",
      )}) and retained refusal manifest ${input.manifestCommitment} at ${input.outputPath}.`,
    );
    this.name = "RealBuildPrefix50Step44CameraOnlyVerifiedRefusalError";
    this.outputPath = input.outputPath;
    this.manifestCommitment = input.manifestCommitment;
    this.searchAttemptCommitment = input.searchAttemptCommitment;
    this.refusalReasons = Object.freeze([...input.refusalReasons]);
  }
}

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

export function createRealBuildPrefix50Step44PersistedCameraSemanticSource(
  source: RealBuildPrefix50Step44BrandedPage45Source,
): RealBuildPrefix50Step44PersistedCameraSemanticSource {
  return {
    sourcePdfDigest: source.sourcePdfDigest,
    sourcePageRasterCommitment: source.sourcePageRasterCommitment,
    panelCropCommitment: source.panelCropCommitment,
    panelFacePrefixEvidenceCommitment: source.panelFacePrefixEvidenceCommitment,
    expectedPanelFace: source.expectedPanelFace,
    parentOnlyRegionCommitment: source.parentOnlyRegion.commitment,
    latticeFit: source.latticeFit,
    rgba: source.rgba,
    eligibleMask: source.eligibleMask,
    parentOnlyTargetMask: source.parentOnlyForegroundMask,
  };
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && Buffer.from(left).equals(Buffer.from(right));
}

function requireRaster(value: Uint8Array, expectedBytes: number, label: string): Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength !== expectedBytes)
    throw new RangeError(`${label} must contain exactly ${expectedBytes} bytes.`);
  return new Uint8Array(value);
}

function overlayPixels(input: {
  readonly sourceRgba: Uint8Array;
  readonly renderRgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly targetMask: Uint8Array;
}): Uint8Array {
  const source = requireRaster(input.sourceRgba, PIXELS * 4, "Camera-only source RGBA");
  const render = foregroundMask(
    requireRaster(input.renderRgba, PIXELS * 4, "Camera-only render RGBA"),
  );
  const eligible = requireRaster(input.eligibleMask, PIXELS, "Camera-only eligible mask");
  const target = requireRaster(input.targetMask, PIXELS, "Camera-only target mask");
  const rgba = new Uint8Array(PIXELS * 4);
  for (let index = 0; index < PIXELS; index += 1) {
    const offset = index * 4;
    let color: readonly [number, number, number];
    if (eligible[index] !== 1) {
      color = [
        Math.round(source[offset]! * 0.28),
        Math.round(source[offset + 1]! * 0.28),
        Math.round(source[offset + 2]! * 0.28),
      ];
    } else if (target[index] === 1 && render[index] === 1) color = [0x2b, 0xde, 0x73];
    else if (target[index] === 1) color = [0xff, 0x30, 0xd8];
    else if (render[index] === 1) color = [0x20, 0xd2, 0xff];
    else color = [0x24, 0x27, 0x26];
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = 0xff;
  }
  return rgba;
}

function maskArtifactPixels(
  maskInput: Uint8Array,
  allowed: readonly [number, number, number],
): Uint8Array {
  const mask = requireRaster(maskInput, PIXELS, "Camera-only persisted mask source");
  const rgba = new Uint8Array(PIXELS * 4);
  for (let index = 0; index < PIXELS; index += 1) {
    if (mask[index] !== 0 && mask[index] !== 1)
      throw new TypeError("Camera-only persisted mask source must be exact binary pixels.");
    const offset = index * 4;
    const color = mask[index] === 1 ? allowed : ([0x28, 0x2b, 0x29] as const);
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = 0xff;
  }
  return rgba;
}

export function assertRealBuildPrefix50Step44CameraOnlyPersistedArtifactPixels(input: {
  readonly literalArtifactFile: string;
  readonly artifact: CameraOnlyArtifactBinding;
  readonly pngBytes: Uint8Array;
  readonly decodedRgba: Uint8Array;
  readonly expectedRgba: Uint8Array;
}): void {
  const decoded = requireRaster(input.decodedRgba, PIXELS * 4, "Camera-only decoded artifact");
  const expected = requireRaster(input.expectedRgba, PIXELS * 4, "Camera-only expected artifact");
  if (
    input.artifact.artifactFile !== input.literalArtifactFile ||
    input.artifact.width !== REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH ||
    input.artifact.height !== REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT ||
    input.artifact.commitment !== canonicalDigest(withoutCommitment(input.artifact)) ||
    input.artifact.pngDigest !== sha256(input.pngBytes) ||
    input.artifact.pixelDigest !== sha256(decoded) ||
    !sameBytes(decoded, expected)
  )
    throw new TypeError(
      `Camera-only Step-44 persisted artifact ${input.literalArtifactFile} did not reproduce its literal file, row, digest, and exact expected pixels.`,
    );
}

async function readDecodedArtifact(outputPath: string, artifactFile: string) {
  const pngBytes = await readFile(resolve(outputPath, artifactFile));
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(
    pngBytes,
    PIXELS,
    `Camera-only Step-44 persisted artifact ${artifactFile}`,
  );
  if (
    decoded.width !== REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH ||
    decoded.height !== REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT
  )
    throw new TypeError(`Camera-only Step-44 persisted artifact ${artifactFile} is not 720x470.`);
  return { pngBytes, rgba: decoded.rgba };
}

export async function assertRealBuildPrefix50Step44CameraOnlyInstrumentArtifacts(input: {
  readonly outputPath: string;
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly sourceRgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly targetMask: Uint8Array;
}): Promise<void> {
  if (
    input.receipt.instrumentArtifactsCommitment !==
    canonicalDigest(input.receipt.instrumentArtifacts)
  )
    throw new TypeError(
      "Camera-only Step-44 instrument artifact rows drifted from their aggregate commitment.",
    );
  const expected = {
    page45Crop: requireRaster(input.sourceRgba, PIXELS * 4, "Camera-only live source crop"),
    eligibleParentRegionMask: maskArtifactPixels(input.eligibleMask, [0xe8, 0xee, 0xe9]),
    parentOnlyTargetMask: maskArtifactPixels(input.targetMask, [0xff, 0x30, 0xd8]),
  } as const;
  const literals = {
    page45Crop: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_CROP_FILE,
    eligibleParentRegionMask: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_ELIGIBLE_MASK_FILE,
    parentOnlyTargetMask: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_PARENT_TARGET_MASK_FILE,
  } as const;
  for (const role of Object.keys(expected) as (keyof typeof expected)[]) {
    const literalArtifactFile = literals[role];
    const decoded = await readDecodedArtifact(input.outputPath, literalArtifactFile);
    assertRealBuildPrefix50Step44CameraOnlyPersistedArtifactPixels({
      literalArtifactFile,
      artifact: input.receipt.instrumentArtifacts[role],
      pngBytes: decoded.pngBytes,
      decodedRgba: decoded.rgba,
      expectedRgba: expected[role],
    });
  }
  if (
    input.receipt.panelPixelDigest !== sha256(expected.page45Crop) ||
    input.receipt.parentOnlyRegion.eligibleMaskDigest !== sha256(input.eligibleMask) ||
    input.receipt.parentOnlyRegion.parentOnlyForegroundMaskDigest !== sha256(input.targetMask)
  )
    throw new TypeError(
      "Camera-only Step-44 live source crop or exact binary masks drifted from the receipt digests.",
    );
}

function overlayFileFor(renderFile: string): string {
  if (!renderFile.endsWith(".png"))
    throw new TypeError(`Camera-only render artifact is not a PNG: ${renderFile}.`);
  return `${renderFile.slice(0, -4)}-overlay.png`;
}

export async function createRealBuildPrefix50Step44CameraOnlyOverlays(input: {
  readonly outputPath: string;
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly sourceRgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly targetMask: Uint8Array;
}): Promise<readonly RealBuildPrefix50Step44CameraOnlyOverlayBinding[]> {
  const bindings: RealBuildPrefix50Step44CameraOnlyOverlayBinding[] = [];
  for (const branch of input.receipt.branchMeasurements)
    for (const pass of branch.alignmentPasses) {
      const renderBytes = await readFile(resolve(input.outputPath, pass.artifactFile));
      const decoded = decodeRealBuildPrefix50Step44ReviewPng(
        renderBytes,
        PIXELS,
        `Camera-only Step-44 render ${pass.artifactFile}`,
      );
      if (
        decoded.width !== REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH ||
        decoded.height !== REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT ||
        sha256(renderBytes) !== pass.pngDigest ||
        sha256(decoded.rgba) !== pass.pixelDigest
      )
        throw new TypeError(
          `Camera-only Step-44 render ${pass.artifactFile} drifted before overlay creation.`,
        );
      const rgba = overlayPixels({
        sourceRgba: input.sourceRgba,
        renderRgba: decoded.rgba,
        eligibleMask: input.eligibleMask,
        targetMask: input.targetMask,
      });
      const bytes = encodeCanonicalRealBuildPrefix50Step44ReviewPng({
        width: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
        height: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
        rgba,
      });
      const overlayFile = overlayFileFor(pass.artifactFile);
      writeContainedRegularFileAtomic(input.outputPath, overlayFile, bytes, {
        label: `camera-only Step-44 overlay ${overlayFile}`,
      });
      bindings.push({
        sourceRenderFile: pass.artifactFile,
        overlayFile,
        pngDigest: sha256(bytes),
        pixelDigest: sha256(rgba),
      });
    }
  return Object.freeze(bindings.map((binding) => Object.freeze(binding)));
}

export async function assertRealBuildPrefix50Step44SelectedCameraPngIdentity(input: {
  readonly outputPath: string;
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
}): Promise<Readonly<{ selectedArtifactFile: string; selectedPassArtifactFile: string }>> {
  const selected = input.receipt.branchMeasurements.find(
    ({ branchKey }) => branchKey === input.receipt.selectedBranchKey,
  );
  if (selected === undefined)
    throw new TypeError("Camera-only Step-44 selected branch row is absent.");
  const selectedPass = selected.alignmentPasses[selected.publishedPassIndex];
  if (selectedPass === undefined)
    throw new TypeError("Camera-only Step-44 published pass index is out of range.");
  const selectedArtifactFile = REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SELECTED_PARENT_FILE;
  const [stableBytes, passBytes, stableDecoded, passDecoded] = await Promise.all([
    readFile(
      resolve(input.outputPath, REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SELECTED_PARENT_FILE),
    ),
    readFile(resolve(input.outputPath, selectedPass.artifactFile)),
    readDecodedArtifact(
      input.outputPath,
      REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SELECTED_PARENT_FILE,
    ),
    readDecodedArtifact(input.outputPath, selectedPass.artifactFile),
  ]);
  assertRealBuildPrefix50Step44CameraOnlyPersistedArtifactPixels({
    literalArtifactFile: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SELECTED_PARENT_FILE,
    artifact: input.receipt.instrumentArtifacts.selectedParentControlRender,
    pngBytes: stableDecoded.pngBytes,
    decodedRgba: stableDecoded.rgba,
    expectedRgba: passDecoded.rgba,
  });
  if (
    !stableBytes.equals(passBytes) ||
    sha256(stableBytes) !== input.receipt.selectedParentPngDigest ||
    sha256(stableDecoded.rgba) !== input.receipt.selectedParentPixelDigest ||
    sha256(passBytes) !== selectedPass.pngDigest ||
    sha256(passDecoded.rgba) !== selectedPass.pixelDigest
  )
    throw new TypeError(
      "Camera-only Step-44 selected stable PNG is not byte-identical to its geometry-selected branch pass.",
    );
  return Object.freeze({
    selectedArtifactFile,
    selectedPassArtifactFile: selectedPass.artifactFile,
  });
}

export function createRealBuildPrefix50Step44CameraOnlyBranchRows(
  attempt: RealBuildPrefix50Step44CameraSearchAttempt,
) {
  return attempt.branchMeasurements.map((row) => ({
    branchIndex: row.branchIndex,
    branchKey: row.branchKey,
    expectedFaceEligible: row.geometryEligible,
    converged: row.converged,
    publishedPassIndex: row.publishedPassIndex,
    selectedIntersectionOverUnion: row.selectedIntersectionOverUnion,
    blueCyanF1: row.interiorFeatureMeasurement.f1,
    hogSimilarity: row.interiorFeatureMeasurement.hogSimilarity,
    passes: row.alignmentPasses.map((pass) => ({
      passIndex: pass.passIndex,
      passKind: pass.passKind,
      artifactFile: pass.artifactFile,
      intersectionOverUnion: pass.intersectionOverUnion,
      proposalStatus: pass.registrationProposal?.status ?? null,
      settled: pass.settled,
    })),
  }));
}

export async function writeAndAssertRealBuildPrefix50Step44CameraOnlyRefusalManifest(input: {
  readonly outputPath: string;
  readonly outputDirectory: string;
  readonly batchInput: Readonly<Record<string, unknown>>;
  readonly source: Readonly<Record<string, unknown>>;
  readonly sharedParent: Readonly<Record<string, unknown>>;
  readonly refusal: RealBuildPrefix50Step44CameraOnlyRefusalSummary;
  readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  readonly metricCalibration: RealBuildPrefix50Step44InteriorFeatureCalibrationReceipt;
  readonly persistedSemanticProof: RealBuildPrefix50Step44VerifiedPersistedCameraAttempt;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlySourceLockEvidence;
  readonly cleanup: {
    readonly browserClosed: boolean;
    readonly browserProcessTreeClosed: boolean;
    readonly serverClosed: boolean;
  };
}): Promise<Readonly<Record<string, unknown>> & { readonly commitment: Sha256Digest }> {
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-only-gate-manifest/2" as const,
    authority: "none" as const,
    status: "refused" as const,
    promotionAuthority: false as const,
    dataExclusionPolicy:
      "page45-and-shared-step43-parent-only-no-candidate-no-step45-no-page46" as const,
    outputDirectory: input.outputDirectory,
    input: input.batchInput,
    source: input.source,
    sharedParent: input.sharedParent,
    refusal: input.refusal,
    thresholds: input.attempt.thresholds,
    metricCalibration: input.metricCalibration,
    metricCalibrationCommitment: input.metricCalibration.commitment,
    geometrySelectionCommitment: input.attempt.geometrySelectionCommitment,
    featureCorroborationCommitment: input.attempt.featureCorroborationCommitment,
    cameraReceiptCommitment: null,
    persistedSemanticProof: input.persistedSemanticProof,
    realDomainQualification: input.realDomainQualification,
    sourceLock: input.sourceLock,
    branchRows: createRealBuildPrefix50Step44CameraOnlyBranchRows(input.attempt),
    overlays: [] as const,
    cleanup: input.cleanup,
  };
  const manifest = Object.freeze({ ...body, commitment: canonicalDigest(body) });
  assertRealBuildPrefix50Step44CameraOnlyManifestSourceLock({
    manifest,
    expectedSourceLock: input.sourceLock,
  });
  await writeRealBuildPrefix50Step44CameraOnlyManifest({
    outputPath: input.outputPath,
    manifest,
  });
  await assertRealBuildPrefix50Step44CameraOnlyRefusalManifest({
    outputPath: input.outputPath,
    expectedManifest: manifest,
  });
  return manifest;
}
