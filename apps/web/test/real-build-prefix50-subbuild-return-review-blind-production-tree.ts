import { createHash } from "node:crypto";
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "../e2e/real-build-prefix50-subbuild-return-contract";
import {
  createRealBuildPrefix50Step44WithheldUnblindingMap,
  type RealBuildPrefix50Step44BlindDispatchPlan,
  type RealBuildPrefix50Step44WithheldUnblindingMap,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind";
import {
  REAL_BUILD_PREFIX50_STEP44_REVIEW_ISOLATION_INSTRUCTION,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  type RealBuildPrefix50Step44BlindPublicHarnessSuccess,
  type RealBuildPrefix50Step44BlindPublicManifest,
  type RealBuildPrefix50Step44BlindReviewPacket,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-contract";
import type { RealBuildPrefix50Step44BlindReviewOutputLayout } from "../e2e/real-build-prefix50-subbuild-return-review-blind-persisted";
import {
  REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE,
  REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-success";
import { deriveRealBuildPrefix50Step44FixedCameraDeltaPixels } from "../e2e/real-build-prefix50-subbuild-return-review-fixed-camera";
import { REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE } from "../e2e/real-build-prefix50-subbuild-return-review-transaction";
import {
  decodeRealBuildPrefix50Step44ReviewPng,
  encodeCanonicalRealBuildPrefix50Step44ReviewPng,
} from "../e2e/real-build-prefix50-subbuild-return-review-png";
import {
  createBlindReviewTestPacket,
  type BlindReviewTestPngMeasurement,
} from "./real-build-prefix50-subbuild-return-review-blind-test-support";

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function digest(label: string): `sha256:${string}` {
  return sha256(Buffer.from(label));
}

function commit<T extends object>(body: T): T & { readonly commitment: `sha256:${string}` } {
  return { ...body, commitment: canonicalDigest(body) };
}

async function directoryIdentity(path: string) {
  const stats = await lstat(path, { bigint: true });
  return {
    lexicalPath: path,
    realPath: await realpath(path),
    device: stats.dev.toString(10),
    inode: stats.ino.toString(10),
  };
}

function solidPng(width: number, height: number, color: string): Buffer {
  if (!/^#[0-9a-f]{6}$/iu.test(color)) throw new TypeError("Test color must be #rrggbb.");
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const rgba = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba[offset] = red;
    rgba[offset + 1] = green;
    rgba[offset + 2] = blue;
    rgba[offset + 3] = 255;
  }
  return encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width, height, rgba });
}

function pngFromRgba(width: number, height: number, rgba: Uint8Array): Buffer {
  return encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width, height, rgba });
}

function measure(bytes: Uint8Array, width: number, height: number): BlindReviewTestPngMeasurement {
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(
    bytes,
    width * height,
    "Step-44 production-path test PNG",
  );
  if (decoded.width !== width || decoded.height !== height)
    throw new Error("Step-44 production-path test PNG dimensions drifted.");
  return { pngDigest: sha256(bytes), pixelDigest: sha256(decoded.rgba) };
}

async function writeInBatches(
  writes: readonly { readonly path: string; readonly bytes: Uint8Array | string }[],
): Promise<void> {
  for (let offset = 0; offset < writes.length; offset += 64)
    await Promise.all(
      writes
        .slice(offset, offset + 64)
        .map(({ path, bytes }) => writeFile(path, bytes, { flag: "wx" })),
    );
}

export async function writeBlindProductionPublicEnvelope(input: {
  readonly publicRoot: string;
  readonly withheldRoot: string;
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly plan: RealBuildPrefix50Step44BlindDispatchPlan;
  readonly map: RealBuildPrefix50Step44WithheldUnblindingMap;
}): Promise<{
  readonly packetBytes: string;
  readonly manifest: RealBuildPrefix50Step44BlindPublicManifest;
  readonly manifestBytes: string;
  readonly success: RealBuildPrefix50Step44BlindPublicHarnessSuccess;
  readonly successBytes: string;
}> {
  const { publicRoot, withheldRoot, packet, batch, plan, map } = input;
  const packetBytes = canonicalStringify(packet);
  const manifestBody = {
    schemaVersion: "lego.real-build-prefix50-step44-public-blind-batch/1" as const,
    authority: "none" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    page45SourcePolicyCommitment: packet.page45SourcePolicyCommitment,
    candidateCount: 211 as const,
    blindIds: packet.blindIds,
    reviewIsolationInstructionFile: packet.reviewIsolationInstructionFile,
    reviewIsolationInstructionDigest: packet.reviewIsolationInstructionDigest,
    referenceArtifactFile: packet.reference.artifactFile,
    referenceCommitment: packet.reference.commitment,
    blindReviewPacketFile: "real-build-prefix50-step44-blind-review-packet.json" as const,
    blindReviewPacketByteDigest: sha256(Buffer.from(packetBytes)),
    blindReviewPacketCommitment: packet.commitment,
    withheldUnblindingMapCommitment: packet.withheldUnblindingMapCommitment,
    contactSheetPageCommitments: packet.pages.map(({ commitment }) => commitment),
  };
  const manifest = commit(manifestBody);
  const manifestBytes = canonicalStringify(manifest);
  const planBytes = canonicalStringify(plan);
  const mapBytes = canonicalStringify(map);
  const withheldManifestBody = {
    schemaVersion: "lego.real-build-prefix50-step44-withheld-batch-capture/1" as const,
    authority: "none" as const,
    publicDuringReview: false as const,
    sourceSetId: "6651557" as const,
    expectedHarnessInputBytesHash: digest("synthetic-harness-input"),
    reviewBatchEnvelopeCommitment: batch.commitment,
    candidateRosterCommitment: batch.candidateRosterCommitment,
    candidateKeysCommitment: batch.candidateKeysCommitment,
    dispatchPlanFile: "real-build-prefix50-step44-blind-dispatch-plan.json" as const,
    dispatchPlanByteDigest: sha256(Buffer.from(planBytes)),
    dispatchPlanCommitment: plan.commitment,
    captures: [] as const,
    publicManifest: {
      artifactFile: REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE,
      byteDigest: sha256(Buffer.from(manifestBytes)),
      commitment: manifest.commitment,
    },
    publicPacketCoreCommitment: packet.publicPacketCoreCommitment,
    publicPacketCommitment: packet.commitment,
    withheldUnblindingMapFile: "real-build-prefix50-step44-unblinding-map.json" as const,
    withheldUnblindingMapByteDigest: sha256(Buffer.from(mapBytes)),
    withheldUnblindingMapCommitment: map.commitment,
  };
  const withheldManifest = commit(withheldManifestBody);
  const withheldManifestBytes = canonicalStringify(withheldManifest);
  const successBody = {
    schemaVersion: "lego.real-build-prefix50-step44-public-harness-success/1" as const,
    authority: "none" as const,
    status: "complete" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    page45SourcePolicyCommitment: packet.page45SourcePolicyCommitment,
    candidateCount: 211 as const,
    capturedCandidateCount: 211 as const,
    publicManifestFile: REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE,
    publicManifestByteDigest: sha256(Buffer.from(manifestBytes)),
    publicManifestCommitment: manifest.commitment,
    withheldManifestFile:
      "real-build-prefix50-step44-withheld-batch-capture-manifest.json" as const,
    withheldManifestByteDigest: sha256(Buffer.from(withheldManifestBytes)),
    withheldManifestCommitment: withheldManifest.commitment,
    blindReviewPacketFile: "real-build-prefix50-step44-blind-review-packet.json" as const,
    blindReviewPacketByteDigest: sha256(Buffer.from(packetBytes)),
    blindReviewPacketCommitment: packet.commitment,
    cleanup: {
      browserClosed: true as const,
      browserProcessTreeClosed: true as const,
      serverClosed: true as const,
    },
  };
  const success = commit(successBody);
  const successBytes = canonicalStringify(success);
  const publicationDirectories = {
    run: await directoryIdentity(dirname(publicRoot)),
    public: await directoryIdentity(publicRoot),
    withheld: await directoryIdentity(withheldRoot),
  };
  const complete = commit({
    schemaVersion: "lego.real-build-prefix50-step44-publication-complete/2" as const,
    authority: "none" as const,
    status: "complete" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    page45SourcePolicyCommitment: packet.page45SourcePolicyCommitment,
    expectedHarnessInputBytesHash: withheldManifest.expectedHarnessInputBytesHash,
    reviewBatchEnvelopeCommitment: batch.commitment,
    candidateRosterCommitment: batch.candidateRosterCommitment,
    candidateKeysCommitment: batch.candidateKeysCommitment,
    candidateCount: 211 as const,
    capturedCandidateCount: 211 as const,
    publicDirectory: "public" as const,
    withheldDirectory: "withheld" as const,
    publicationDirectories,
    publicManifestFile: REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE,
    publicManifestByteDigest: sha256(Buffer.from(manifestBytes)),
    publicManifestCommitment: manifest.commitment,
    withheldManifestFile:
      "real-build-prefix50-step44-withheld-batch-capture-manifest.json" as const,
    withheldManifestByteDigest: sha256(Buffer.from(withheldManifestBytes)),
    withheldManifestCommitment: withheldManifest.commitment,
    publicSuccessFile: REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE,
    publicSuccessByteDigest: sha256(Buffer.from(successBytes)),
    publicSuccessCommitment: success.commitment,
    cleanup: success.cleanup,
  });
  await Promise.all([
    writeFile(
      resolve(publicRoot, "real-build-prefix50-step44-blind-review-packet.json"),
      packetBytes,
    ),
    writeFile(resolve(publicRoot, REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE), manifestBytes),
    writeFile(resolve(publicRoot, REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE), successBytes),
    writeFile(
      resolve(withheldRoot, "real-build-prefix50-step44-withheld-batch-capture-manifest.json"),
      withheldManifestBytes,
    ),
    writeFile(
      resolve(withheldRoot, "real-build-prefix50-step44-blind-dispatch-plan.json"),
      planBytes,
    ),
    writeFile(resolve(withheldRoot, "real-build-prefix50-step44-unblinding-map.json"), mapBytes),
  ]);
  await writeFile(
    resolve(dirname(publicRoot), REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE),
    canonicalStringify(complete),
  );
  return { packetBytes, manifest, manifestBytes, success, successBytes };
}

function createMap(input: {
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly plan: RealBuildPrefix50Step44BlindDispatchPlan;
}): RealBuildPrefix50Step44WithheldUnblindingMap {
  const publicRows = input.packet.pages.flatMap(({ rows }) => rows);
  const captures = input.plan.assignments.map(({ blindId, batchIndex }, index) => {
    const compact = input.batch.candidates[batchIndex]!;
    const roster = input.batch.rosterSummary.candidates[compact.rosterIndex]!;
    const captureManifestByteDigest = digest(`${blindId}-manifest-bytes`);
    const captureManifestCommitment = digest(`${blindId}-manifest`);
    const publicRow = publicRows[index]!;
    const sourceRowCommitment = canonicalDigest({
      blindId,
      batchIndex,
      captureManifestByteDigest,
      captureManifestCommitment,
      reviewHarnessEnvelopeCommitment: roster.reviewHarnessEnvelopeCommitment,
      candidateKey: compact.candidateKey,
      selectedDocumentHash: roster.selectedDocumentHash,
      cells: publicRow.cells.map(({ commitment }) => commitment),
      fixedCameraEvidenceCommitment: publicRow.fixedCameraEvidence.commitment,
    });
    return {
      blindId,
      batchIndex,
      artifactDirectory: blindId,
      rosterIndex: compact.rosterIndex,
      candidateKey: compact.candidateKey,
      operationsCommitment: compact.operationsCommitment,
      compactCandidateCommitment: compact.commitment,
      selectedDocumentHash: roster.selectedDocumentHash,
      selectedDocumentCommitment: roster.selectedDocumentCommitment,
      reviewHarnessEnvelopeCommitment: roster.reviewHarnessEnvelopeCommitment,
      captureManifestFile: "capture-manifest.json",
      captureManifestByteDigest,
      captureManifestCommitment,
      sourceRowCommitment,
    };
  });
  return createRealBuildPrefix50Step44WithheldUnblindingMap({
    batch: input.batch,
    plan: input.plan,
    captures,
    publicPacketCoreCommitment: input.packet.publicPacketCoreCommitment,
  });
}

export async function createBlindProductionReviewTree(input: {
  readonly reviewRoot: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly plan: RealBuildPrefix50Step44BlindDispatchPlan;
}): Promise<{
  readonly layout: RealBuildPrefix50Step44BlindReviewOutputLayout;
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly map: RealBuildPrefix50Step44WithheldUnblindingMap;
  readonly successBytes: string;
}> {
  const publicRoot = resolve(input.reviewRoot, "public");
  const withheldRoot = resolve(input.reviewRoot, "withheld");
  const closureRoot = resolve(input.reviewRoot, "closure");
  const promotionRoot = resolve(input.reviewRoot, "promotion");
  await Promise.all([
    mkdir(publicRoot),
    mkdir(withheldRoot),
    mkdir(closureRoot),
    mkdir(promotionRoot),
  ]);
  const baselineBytes = solidPng(720, 470, "#203040");
  const baselineDecoded = decodeRealBuildPrefix50Step44ReviewPng(
    baselineBytes,
    720 * 470,
    "Step-44 production-path baseline",
  );
  const delta = deriveRealBuildPrefix50Step44FixedCameraDeltaPixels(
    baselineDecoded.rgba,
    baselineDecoded.rgba,
  );
  const deltaBytes = pngFromRgba(720, 470, delta.rgba);
  const canonicalBytes = solidPng(640, 480, "#405060");
  const fullSheetBytes = solidPng(1_472, 2_150, "#f0f0f0");
  const finalSheetBytes = solidPng(1_472, 590, "#f0f0f0");
  const instructionBytes = Buffer.from(REAL_BUILD_PREFIX50_STEP44_REVIEW_ISOLATION_INSTRUCTION);
  const preliminary = createBlindReviewTestPacket({
    reviewIsolationInstructionDigest: sha256(instructionBytes),
    reference: measure(baselineBytes, 720, 470),
    baseline: { ...measure(baselineBytes, 720, 470), byteLength: baselineBytes.byteLength },
    after: measure(baselineBytes, 720, 470),
    canonicalView: measure(canonicalBytes, 640, 480),
    delta: {
      ...measure(deltaBytes, 720, 470),
      changedPixelCount: delta.changedPixelCount,
      changedPixelBounds: delta.changedPixelBounds,
    },
    fullContactSheet: measure(fullSheetBytes, 1_472, 2_150),
    finalContactSheet: measure(finalSheetBytes, 1_472, 590),
  });
  const map = createMap({ packet: preliminary, batch: input.batch, plan: input.plan });
  const packetBody = { ...preliminary, withheldUnblindingMapCommitment: map.commitment };
  Reflect.deleteProperty(packetBody, "commitment");
  const packet = commit(packetBody);
  const writes: { path: string; bytes: Uint8Array | string }[] = [
    {
      path: resolve(publicRoot, packet.reviewIsolationInstructionFile),
      bytes: instructionBytes,
    },
    { path: resolve(publicRoot, packet.reference.artifactFile), bytes: baselineBytes },
    { path: resolve(publicRoot, packet.fixedCameraBaseline.artifactPath), bytes: baselineBytes },
  ];
  for (const page of packet.pages) {
    writes.push({
      path: resolve(publicRoot, page.artifactFile),
      bytes: page.pageNumber === 14 ? finalSheetBytes : fullSheetBytes,
    });
    for (const row of page.rows) {
      const rowRoot = resolve(publicRoot, row.blindId);
      await mkdir(rowRoot);
      for (const cell of row.cells)
        writes.push({
          path: resolve(publicRoot, cell.artifactPath),
          bytes: cell.fixtureKey === "page45MatchedAfter" ? baselineBytes : canonicalBytes,
        });
      writes.push({
        path: resolve(publicRoot, row.fixedCameraEvidence.deltaArtifactPath),
        bytes: deltaBytes,
      });
    }
  }
  await writeInBatches(writes);
  const envelope = await writeBlindProductionPublicEnvelope({
    publicRoot,
    withheldRoot,
    packet,
    batch: input.batch,
    plan: input.plan,
    map,
  });
  return {
    layout: {
      reviewRoot: input.reviewRoot,
      publicRoot,
      laneARoot: resolve(input.reviewRoot, "lane-a"),
      laneBRoot: resolve(input.reviewRoot, "lane-b"),
      fullResolutionRoot: resolve(input.reviewRoot, "full-resolution"),
      closureRoot,
      promotionRoot,
    },
    packet,
    map,
    successBytes: envelope.successBytes,
  };
}
