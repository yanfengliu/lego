import { basename } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import { CANONICAL_CAPTURE_POLICY } from "@lego-studio/rendering";

import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type { RealBuildPrefix50Step44FixedCameraDeltaArtifact } from "./real-build-prefix50-subbuild-return-review-fixed-camera.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import { sha256RealBuildPrefix50Step44BlindBytes } from "./real-build-prefix50-subbuild-return-review-blind.ts";

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

export function verifyRealBuildPrefix50Step44FixedCameraDeltaArtifact(input: {
  readonly outputPath: string;
  readonly artifactDirectory: string;
  readonly blindId: `B${string}`;
  readonly artifact: RealBuildPrefix50Step44FixedCameraDeltaArtifact;
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly page45CameraReceiptCommitment: `sha256:${string}`;
  readonly cameraCommitment: `sha256:${string}`;
  readonly baselineCommitment: `sha256:${string}`;
  readonly afterCommitment: `sha256:${string}`;
  readonly deltaCommitment: `sha256:${string}`;
  readonly summaryCommitment: `sha256:${string}`;
}): void {
  const { artifact } = input;
  exactKeys(
    artifact,
    [
      "afterCommitment",
      "artifactFile",
      "authority",
      "baselineCommitment",
      "cameraCommitment",
      "candidateKey",
      "commitment",
      "deltaCommitment",
      "height",
      "page45CameraReceiptCommitment",
      "pixelDigest",
      "pngDigest",
      "reviewHarnessEnvelopeCommitment",
      "scene",
      "schemaVersion",
      "selectedDocumentCommitment",
      "selectedDocumentHash",
      "width",
    ],
    `Step-44 ${input.blindId} fixed-camera delta artifact`,
  );
  if (
    artifact.schemaVersion !==
      "lego.real-build-prefix50-step43-to-44-fixed-camera-delta-artifact/1" ||
    artifact.authority !== "none" ||
    artifact.scene !== "model-only" ||
    artifact.commitment !== canonicalDigest(withoutCommitment(artifact)) ||
    artifact.candidateKey !== input.candidateKey ||
    artifact.selectedDocumentHash !== input.selectedDocumentHash ||
    artifact.selectedDocumentCommitment !== input.selectedDocumentCommitment ||
    artifact.reviewHarnessEnvelopeCommitment !== input.reviewHarnessEnvelopeCommitment ||
    artifact.page45CameraReceiptCommitment !== input.page45CameraReceiptCommitment ||
    artifact.cameraCommitment !== input.cameraCommitment ||
    artifact.baselineCommitment !== input.baselineCommitment ||
    artifact.afterCommitment !== input.afterCommitment ||
    artifact.deltaCommitment !== input.deltaCommitment ||
    artifact.commitment !== input.summaryCommitment ||
    artifact.artifactFile !== "real-build-prefix50-step44-page45-fixed-camera-delta.png" ||
    basename(artifact.artifactFile) !== artifact.artifactFile
  )
    throw new TypeError(`Step-44 ${input.blindId} fixed-camera delta artifact binding drifted.`);
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.outputPath,
    `${input.artifactDirectory}/${artifact.artifactFile}`,
    CANONICAL_CAPTURE_POLICY.maxArtifactBytes,
    `Step-44 ${input.blindId} fixed-camera delta artifact`,
  );
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(
    bytes,
    720 * 470,
    `Step-44 ${input.blindId} fixed-camera delta artifact`,
  );
  if (
    artifact.width !== 720 ||
    artifact.height !== 470 ||
    decoded.width !== artifact.width ||
    decoded.height !== artifact.height ||
    artifact.pngDigest !== sha256RealBuildPrefix50Step44BlindBytes(bytes) ||
    artifact.pixelDigest !== sha256RealBuildPrefix50Step44BlindBytes(decoded.rgba)
  )
    throw new TypeError(
      `Step-44 ${input.blindId} fixed-camera delta artifact bytes, pixels, or dimensions drifted.`,
    );
}
