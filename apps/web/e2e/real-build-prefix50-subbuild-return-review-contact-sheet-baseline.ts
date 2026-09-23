import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type { RealBuildPrefix50Step44BlindFixedCameraBaseline } from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import type { RealBuildPrefix50Step44VerifiedCaptureRow } from "./real-build-prefix50-subbuild-return-review-contact-sheet-source.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";

const PUBLIC_FIXED_CAMERA_BASELINE_ARTIFACT =
  "real-build-prefix50-step43-page45-fixed-camera-baseline.png" as const;

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export async function persistRealBuildPrefix50Step44BlindFixedCameraBaseline(input: {
  readonly publicOutputPath: string;
  readonly withheldOutputPath: string;
  readonly verified: readonly RealBuildPrefix50Step44VerifiedCaptureRow[];
}): Promise<RealBuildPrefix50Step44BlindFixedCameraBaseline> {
  const firstVerified = input.verified[0];
  if (firstVerified === undefined)
    throw new TypeError("Step-44 blind packet cannot omit its shared fixed-camera baseline.");
  const firstAfter = firstVerified.cells.find(
    ({ fixtureKey }) => fixtureKey === "page45MatchedAfter",
  );
  if (firstAfter === undefined)
    throw new TypeError("Step-44 blind packet cannot omit its page45-matched after source.");
  const baselineArtifact = firstVerified.fixedCameraBaselineArtifact;
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.withheldOutputPath,
    baselineArtifact.artifactFile,
    16 * 1024 * 1024,
    "Step-44 shared fixed-camera baseline",
  );
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(
    bytes,
    720 * 470,
    "Step-44 shared fixed-camera baseline",
  );
  const expected = firstVerified.fixedCameraEvidence;
  if (
    decoded.width !== 720 ||
    decoded.height !== 470 ||
    bytes.byteLength !== baselineArtifact.pngByteLength ||
    sha256(bytes) !== baselineArtifact.pngDigest ||
    sha256(decoded.rgba) !== baselineArtifact.pixelDigest ||
    sha256(bytes) !== expected.baselinePngDigest ||
    sha256(decoded.rgba) !== expected.baselinePixelDigest ||
    input.verified.some((row) => {
      const after = row.cells.find(({ fixtureKey }) => fixtureKey === "page45MatchedAfter");
      return (
        after === undefined ||
        after.cameraCommitment !== firstAfter.cameraCommitment ||
        canonicalDigest(row.fixedCameraBaselineArtifact) !== canonicalDigest(baselineArtifact) ||
        row.fixedCameraEvidence.page45CameraReceiptCommitment !==
          expected.page45CameraReceiptCommitment ||
        row.fixedCameraEvidence.fixedCameraBaselineCommitment !==
          expected.fixedCameraBaselineCommitment ||
        row.fixedCameraEvidence.baselinePngDigest !== expected.baselinePngDigest ||
        row.fixedCameraEvidence.baselinePixelDigest !== expected.baselinePixelDigest
      );
    })
  )
    throw new TypeError(
      "Step-44 shared fixed-camera baseline drifted across the exact 211 candidate captures.",
    );
  await writeFile(resolve(input.publicOutputPath, PUBLIC_FIXED_CAMERA_BASELINE_ARTIFACT), bytes, {
    flag: "wx",
  });
  const body: Omit<RealBuildPrefix50Step44BlindFixedCameraBaseline, "commitment"> = {
    schemaVersion: "lego.real-build-prefix50-step43-blind-fixed-camera-baseline/1",
    authority: "none",
    sourceSetId: "6651557",
    scene: "model-only",
    completedPrintedStep: 43,
    artifactPath: PUBLIC_FIXED_CAMERA_BASELINE_ARTIFACT,
    page45CameraReceiptCommitment: expected.page45CameraReceiptCommitment,
    cameraCommitment: firstAfter.cameraCommitment,
    fixedCameraBaselineCommitment: expected.fixedCameraBaselineCommitment,
    fixedCameraBaselineArtifactCommitment: baselineArtifact.commitment,
    width: 720,
    height: 470,
    pngByteLength: bytes.byteLength,
    pngDigest: expected.baselinePngDigest,
    pixelDigest: expected.baselinePixelDigest,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}
