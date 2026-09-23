import { createHash } from "node:crypto";

import { canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type {
  RealBuildPrefix50Step44BlindDispositionLane,
  RealBuildPrefix50Step44BlindPublicHarnessSuccess,
  RealBuildPrefix50Step44BlindReviewPacket,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_ISOLATION_INSTRUCTION } from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { requireRealBuildPrefix50Step44BlindDispositionLane } from "./real-build-prefix50-subbuild-return-review-blind-lane.ts";
import { requireRealBuildPrefix50Step44BlindReviewPacket } from "./real-build-prefix50-subbuild-return-review-blind-packet.ts";
import { verifyRealBuildPrefix50Step44BlindShortlistPixels } from "./real-build-prefix50-subbuild-return-review-blind-pixels.ts";
import { scanRealBuildPrefix50Step44BlindPublicArtifacts } from "./real-build-prefix50-subbuild-return-review-blind-public-scan.ts";
import {
  readRealBuildPrefix50Step44PublicationComplete,
  requireRealBuildPrefix50Step44PublicationComplete,
  type RealBuildPrefix50Step44PublicationComplete,
} from "./real-build-prefix50-subbuild-return-review-blind-publication-complete.ts";
import { readRealBuildPrefix50Step44BlindPublicHarnessSuccess } from "./real-build-prefix50-subbuild-return-review-blind-success.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { decodeCanonicalRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";

const MAXIMUM_BLIND_PACKET_BYTES = 8 * 1024 * 1024;
const MAXIMUM_DISPOSITION_LANE_BYTES = 4 * 1024 * 1024;
const MAXIMUM_PNG_BYTES = 16 * 1024 * 1024;
const completedRunByPacket = new WeakMap<
  RealBuildPrefix50Step44BlindReviewPacket,
  RealBuildPrefix50Step44CompletedBlindRun
>();
const completedRuns = new WeakSet<object>();

export interface RealBuildPrefix50Step44CompletedBlindRun {
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly publicSuccess: RealBuildPrefix50Step44BlindPublicHarnessSuccess;
  readonly publicationComplete: RealBuildPrefix50Step44PublicationComplete;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function verifyPublicPng(input: {
  publicRoot: string;
  artifactPath: string;
  expectedPngDigest: `sha256:${string}`;
  expectedPixelDigest: `sha256:${string}`;
  expectedWidth: number;
  expectedHeight: number;
  expectedByteLength?: number;
  label: string;
  cache?: Map<string, true>;
}): void {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.publicRoot,
    input.artifactPath,
    MAXIMUM_PNG_BYTES,
    input.label,
  );
  const bytesDigest = sha256(bytes);
  const cacheKey = `${input.expectedPngDigest}:${input.expectedPixelDigest}:${input.expectedWidth}x${input.expectedHeight}`;
  if (
    bytesDigest !== input.expectedPngDigest ||
    (input.expectedByteLength !== undefined && bytes.byteLength !== input.expectedByteLength)
  )
    throw new TypeError(`${input.label} bytes, decoded pixels, or dimensions drifted.`);
  if (input.cache?.has(cacheKey) === true) return;
  const decoded = decodeCanonicalRealBuildPrefix50Step44ReviewPng(
    bytes,
    input.expectedWidth * input.expectedHeight,
    input.label,
  );
  if (
    sha256(decoded.rgba) !== input.expectedPixelDigest ||
    decoded.width !== input.expectedWidth ||
    decoded.height !== input.expectedHeight
  )
    throw new TypeError(`${input.label} bytes, decoded pixels, or dimensions drifted.`);
  input.cache?.set(cacheKey, true);
}

export const realBuildPrefix50Step44BlindIoTestOnly = Object.freeze({
  verifyPublicPng(input: Parameters<typeof verifyPublicPng>[0]): void {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError("Step-44 public PNG verifier injection is available only to tests.");
    verifyPublicPng(input);
  },
});

function parseCanonicalJson(bytes: Uint8Array, label: string): unknown {
  const text = Buffer.from(bytes).toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (canonicalStringify(value) !== text)
    throw new TypeError(`${label} must use exact canonical JSON bytes.`);
  return value;
}

export function readRealBuildPrefix50Step44BlindReviewPacket(
  publicRoot: string,
  artifactFile = "real-build-prefix50-step44-blind-review-packet.json",
): RealBuildPrefix50Step44BlindReviewPacket {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    publicRoot,
    artifactFile,
    MAXIMUM_BLIND_PACKET_BYTES,
    "Step-44 public blind review packet",
  );
  const packet = parseCanonicalJson(
    bytes,
    "Step-44 public blind review packet",
  ) as RealBuildPrefix50Step44BlindReviewPacket;
  requireRealBuildPrefix50Step44BlindReviewPacket(packet);
  const pngCache = new Map<string, true>();
  const instructionBytes = readRealBuildPrefix50Step44ReviewArtifact(
    publicRoot,
    packet.reviewIsolationInstructionFile,
    4_096,
    "Step-44 public review-isolation instruction",
  );
  if (
    Buffer.from(instructionBytes).toString("utf8") !==
      REAL_BUILD_PREFIX50_STEP44_REVIEW_ISOLATION_INSTRUCTION ||
    sha256(instructionBytes) !== packet.reviewIsolationInstructionDigest
  )
    throw new TypeError("Step-44 public review-isolation instruction bytes drifted.");
  verifyPublicPng({
    publicRoot,
    artifactPath: packet.reference.artifactFile,
    expectedPngDigest: packet.reference.pngDigest,
    expectedPixelDigest: packet.reference.pixelDigest,
    expectedWidth: packet.reference.width,
    expectedHeight: packet.reference.height,
    label: "Step-44 public page-45 reference",
    cache: pngCache,
  });
  verifyPublicPng({
    publicRoot,
    artifactPath: packet.fixedCameraBaseline.artifactPath,
    expectedPngDigest: packet.fixedCameraBaseline.pngDigest,
    expectedPixelDigest: packet.fixedCameraBaseline.pixelDigest,
    expectedWidth: packet.fixedCameraBaseline.width,
    expectedHeight: packet.fixedCameraBaseline.height,
    expectedByteLength: packet.fixedCameraBaseline.pngByteLength,
    label: "Step-44 public shared fixed-camera baseline",
    cache: pngCache,
  });
  for (const page of packet.pages) {
    verifyPublicPng({
      publicRoot,
      artifactPath: page.artifactFile,
      expectedPngDigest: page.pngDigest,
      expectedPixelDigest: page.pixelDigest,
      expectedWidth: page.width,
      expectedHeight: page.height,
      label: `Step-44 public blind contact sheet ${page.pageNumber}`,
      cache: pngCache,
    });
    for (const row of page.rows) {
      for (const cell of row.cells)
        verifyPublicPng({
          publicRoot,
          artifactPath: cell.artifactPath,
          expectedPngDigest: cell.sourcePngDigest,
          expectedPixelDigest: cell.sourcePixelDigest,
          expectedWidth: cell.sourceWidth,
          expectedHeight: cell.sourceHeight,
          label: `Step-44 public ${row.blindId} ${cell.canonicalViewName}`,
          cache: pngCache,
        });
      verifyPublicPng({
        publicRoot,
        artifactPath: row.fixedCameraEvidence.deltaArtifactPath,
        expectedPngDigest: row.fixedCameraEvidence.deltaPngDigest,
        expectedPixelDigest: row.fixedCameraEvidence.deltaPixelDigest,
        expectedWidth: row.fixedCameraEvidence.deltaWidth,
        expectedHeight: row.fixedCameraEvidence.deltaHeight,
        label: `Step-44 public ${row.blindId} fixed-camera delta`,
        cache: pngCache,
      });
    }
  }
  verifyRealBuildPrefix50Step44BlindShortlistPixels({
    publicRoot,
    packet,
    blindIds: packet.blindIds,
  });
  scanRealBuildPrefix50Step44BlindPublicArtifacts({
    publicRoot,
    packet,
    packetArtifactFile: artifactFile,
  });
  return packet;
}

export function readRealBuildPrefix50Step44CompletedBlindRun(input: {
  readonly reviewRoot: string;
  readonly publicRoot: string;
  readonly withheldRoot: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly packetArtifactFile?: string;
}): RealBuildPrefix50Step44CompletedBlindRun {
  const packetArtifactFile =
    input.packetArtifactFile ?? "real-build-prefix50-step44-blind-review-packet.json";
  const packet = deepFreeze(
    readRealBuildPrefix50Step44BlindReviewPacket(input.publicRoot, packetArtifactFile),
  );
  const publicSuccess = readRealBuildPrefix50Step44BlindPublicHarnessSuccess({
    publicRoot: input.publicRoot,
    packet,
    packetArtifactFile,
  });
  const publicationComplete = readRealBuildPrefix50Step44PublicationComplete({
    reviewRoot: input.reviewRoot,
    publicRoot: input.publicRoot,
    withheldRoot: input.withheldRoot,
    success: publicSuccess,
    batch: input.batch,
  });
  requireRealBuildPrefix50Step44PublicationComplete(publicationComplete);
  const run = deepFreeze({ packet, publicSuccess, publicationComplete });
  completedRuns.add(run);
  completedRunByPacket.set(packet, run);
  return run;
}

export function requireRealBuildPrefix50Step44CompletedBlindRun(
  value: RealBuildPrefix50Step44CompletedBlindRun,
): void {
  if (!completedRuns.has(value))
    throw new TypeError(
      "Step-44 review requires a runtime-branded run completed by its exact root COMPLETE receipt.",
    );
}

export function requireRealBuildPrefix50Step44BlindPublicSuccessForPacket(
  packet: RealBuildPrefix50Step44BlindReviewPacket,
): RealBuildPrefix50Step44BlindPublicHarnessSuccess {
  const run = completedRunByPacket.get(packet);
  if (run === undefined || !completedRuns.has(run))
    throw new TypeError(
      "Step-44 closure requires a packet runtime-branded by its exact root COMPLETE reader.",
    );
  return run.publicSuccess;
}

export function requireRealBuildPrefix50Step44PublicationCompleteForPacket(
  packet: RealBuildPrefix50Step44BlindReviewPacket,
): RealBuildPrefix50Step44PublicationComplete {
  const run = completedRunByPacket.get(packet);
  if (run === undefined || !completedRuns.has(run))
    throw new TypeError("Step-44 packet has no matching runtime-branded COMPLETE run.");
  return run.publicationComplete;
}

export function readRealBuildPrefix50Step44BlindDispositionLane(
  publicRoot: string,
  packet: RealBuildPrefix50Step44BlindReviewPacket,
  expectedLane: "lane-a" | "lane-b",
  artifactFile = `real-build-prefix50-step44-${expectedLane}-disposition.json`,
): RealBuildPrefix50Step44BlindDispositionLane {
  requireRealBuildPrefix50Step44BlindReviewPacket(packet);
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    publicRoot,
    artifactFile,
    MAXIMUM_DISPOSITION_LANE_BYTES,
    `Step-44 ${expectedLane} disposition`,
  );
  const lane = parseCanonicalJson(
    bytes,
    `Step-44 ${expectedLane} disposition`,
  ) as RealBuildPrefix50Step44BlindDispositionLane;
  requireRealBuildPrefix50Step44BlindDispositionLane(lane, packet, expectedLane);
  return lane;
}
