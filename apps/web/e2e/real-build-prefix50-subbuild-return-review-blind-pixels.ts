import { createHash } from "node:crypto";

import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type {
  RealBuildPrefix50Step44BlindId,
  RealBuildPrefix50Step44BlindReviewPacket,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { deriveRealBuildPrefix50Step44FixedCameraDeltaPixels } from "./real-build-prefix50-subbuild-return-review-fixed-camera.ts";
import { decodeCanonicalRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";

const WIDTH = 720;
const HEIGHT = 470;
const MAXIMUM_PNG_BYTES = 16 * 1024 * 1024;

export interface RealBuildPrefix50Step44BlindPixelVerificationRow {
  readonly blindId: RealBuildPrefix50Step44BlindId;
  readonly baselineCommitment: `sha256:${string}`;
  readonly afterCellCommitment: `sha256:${string}`;
  readonly fixedCameraEvidenceCommitment: `sha256:${string}`;
  readonly recomputedDeltaPixelDigest: `sha256:${string}`;
  readonly changedPixelCount: number;
  readonly changedPixelBounds: Readonly<{
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
    readonly width: number;
    readonly height: number;
  }> | null;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindPixelVerificationReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-blind-pixel-verification/1";
  readonly authority: "none";
  readonly blindReviewPacketCommitment: `sha256:${string}`;
  readonly fixedCameraBaselineCommitment: `sha256:${string}`;
  readonly blindIds: readonly RealBuildPrefix50Step44BlindId[];
  readonly rows: readonly RealBuildPrefix50Step44BlindPixelVerificationRow[];
  readonly commitment: `sha256:${string}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

function rowFor(packet: RealBuildPrefix50Step44BlindReviewPacket, blindId: string) {
  return packet.pages.flatMap(({ rows }) => rows).find((row) => row.blindId === blindId);
}

function readVerifiedPixels(input: {
  readonly publicRoot: string;
  readonly artifactPath: string;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly cache: Map<string, Uint8Array>;
}): Uint8Array {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.publicRoot,
    input.artifactPath,
    MAXIMUM_PNG_BYTES,
    input.label,
  );
  if (sha256(bytes) !== input.pngDigest)
    throw new TypeError(`${input.label} bytes or pixels drifted.`);
  const cacheKey = `${input.pngDigest}:${input.pixelDigest}:${input.width}x${input.height}`;
  const cached = input.cache.get(cacheKey);
  if (cached !== undefined) return cached;
  const decoded = decodeCanonicalRealBuildPrefix50Step44ReviewPng(
    bytes,
    input.width * input.height,
    input.label,
  );
  if (
    decoded.width !== input.width ||
    decoded.height !== input.height ||
    sha256(decoded.rgba) !== input.pixelDigest
  )
    throw new TypeError(`${input.label} decoded pixels or dimensions drifted.`);
  input.cache.set(cacheKey, decoded.rgba);
  return decoded.rgba;
}

export function verifyRealBuildPrefix50Step44BlindShortlistPixels(input: {
  readonly publicRoot: string;
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly blindIds: readonly RealBuildPrefix50Step44BlindId[];
}): RealBuildPrefix50Step44BlindPixelVerificationReceipt {
  if (
    new Set(input.blindIds).size !== input.blindIds.length ||
    input.blindIds.some((id, index) => index > 0 && input.blindIds[index - 1]! >= id)
  )
    throw new TypeError("Step-44 pixel verification requires an exact sorted unique shortlist.");
  const cache = new Map<string, Uint8Array>();
  const baselineRgba = readVerifiedPixels({
    publicRoot: input.publicRoot,
    artifactPath: input.packet.fixedCameraBaseline.artifactPath,
    pngDigest: input.packet.fixedCameraBaseline.pngDigest,
    pixelDigest: input.packet.fixedCameraBaseline.pixelDigest,
    width: WIDTH,
    height: HEIGHT,
    label: "Step-44 public fixed-camera baseline",
    cache,
  });
  const rows = input.blindIds.map((blindId) => {
    const packetRow = rowFor(input.packet, blindId);
    const afterCell = packetRow?.cells.find(
      ({ fixtureKey }) => fixtureKey === "page45MatchedAfter",
    );
    if (packetRow === undefined || afterCell === undefined)
      throw new TypeError(`Step-44 ${blindId} is missing its page45-matched source.`);
    const evidence = packetRow.fixedCameraEvidence;
    if (
      evidence.fixedCameraBaselineCommitment !==
        input.packet.fixedCameraBaseline.fixedCameraBaselineCommitment ||
      evidence.baselinePngDigest !== input.packet.fixedCameraBaseline.pngDigest ||
      evidence.baselinePixelDigest !== input.packet.fixedCameraBaseline.pixelDigest ||
      evidence.afterPngDigest !== afterCell.sourcePngDigest ||
      evidence.afterPixelDigest !== afterCell.sourcePixelDigest ||
      afterCell.cameraCommitment !== input.packet.fixedCameraBaseline.cameraCommitment
    )
      throw new TypeError(`Step-44 ${blindId} baseline/after public bindings drifted.`);
    const afterRgba = readVerifiedPixels({
      publicRoot: input.publicRoot,
      artifactPath: afterCell.artifactPath,
      pngDigest: afterCell.sourcePngDigest,
      pixelDigest: afterCell.sourcePixelDigest,
      width: WIDTH,
      height: HEIGHT,
      label: `Step-44 ${blindId} page45-matched after`,
      cache,
    });
    const deltaRgba = readVerifiedPixels({
      publicRoot: input.publicRoot,
      artifactPath: evidence.deltaArtifactPath,
      pngDigest: evidence.deltaPngDigest,
      pixelDigest: evidence.deltaPixelDigest,
      width: WIDTH,
      height: HEIGHT,
      label: `Step-44 ${blindId} fixed-camera delta`,
      cache,
    });
    const recomputed = deriveRealBuildPrefix50Step44FixedCameraDeltaPixels(baselineRgba, afterRgba);
    if (
      !equalBytes(recomputed.rgba, deltaRgba) ||
      recomputed.changedPixelCount !== evidence.changedPixelCount ||
      canonicalDigest(recomputed.changedPixelBounds) !==
        canonicalDigest(evidence.changedPixelBounds)
    )
      throw new TypeError(
        `Step-44 ${blindId} fixed-camera delta was not recomputed from the committed baseline and after frame.`,
      );
    const body = {
      blindId,
      baselineCommitment: input.packet.fixedCameraBaseline.commitment,
      afterCellCommitment: afterCell.commitment,
      fixedCameraEvidenceCommitment: evidence.commitment,
      recomputedDeltaPixelDigest: sha256(recomputed.rgba),
      changedPixelCount: recomputed.changedPixelCount,
      changedPixelBounds: recomputed.changedPixelBounds,
    };
    return deepFreeze({ ...body, commitment: canonicalDigest(body) });
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-blind-pixel-verification/1" as const,
    authority: "none" as const,
    blindReviewPacketCommitment: input.packet.commitment,
    fixedCameraBaselineCommitment: input.packet.fixedCameraBaseline.commitment,
    blindIds: input.blindIds,
    rows,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export const realBuildPrefix50Step44BlindPixelsTestOnly = Object.freeze({
  recomputeDelta: deriveRealBuildPrefix50Step44FixedCameraDeltaPixels,
});
