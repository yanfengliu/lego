import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";

import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  readRealBuildPrefix50Step44CompletedBlindRun,
  requireRealBuildPrefix50Step44CompletedBlindRun,
  type RealBuildPrefix50Step44CompletedBlindRun,
} from "./real-build-prefix50-subbuild-return-review-blind-io.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { writeOrResumeRealBuildPrefix50Step44ExactArtifact } from "./real-build-prefix50-subbuild-return-review-source-locked-files.ts";
import {
  reassertRealBuildPrefix50Step44SourceLockCapability,
  requireRealBuildPrefix50Step44LockedInput,
  requireRealBuildPrefix50Step44SourceLockBinding,
  requireRealBuildPrefix50Step44SourceLockCapability,
  requireRealBuildPrefix50Step44SourceLockRepository,
  type RealBuildPrefix50Step44SourceLockBinding,
  type RealBuildPrefix50Step44SourceLockCapability,
} from "./real-build-prefix50-subbuild-return-review-source-lock.ts";

export const REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE =
  "real-build-prefix50-step44-source-locked-production.json" as const;
const MAXIMUM_RECEIPT_BYTES = 64 * 1024;

export interface RealBuildPrefix50Step44SourceLockedProductionReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-source-locked-production/2";
  readonly sourceSetId: "6651557";
  readonly authority: "none";
  readonly reviewBatchEnvelopeCommitment: `sha256:${string}`;
  readonly expectedHarnessInputBytesHash: `sha256:${string}`;
  readonly publicHarnessSuccessCommitment: `sha256:${string}`;
  readonly publicationCompleteCommitment: `sha256:${string}`;
  readonly sourceLock: RealBuildPrefix50Step44SourceLockBinding;
  readonly commitment: `sha256:${string}`;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function parseReceipt(
  reviewRoot: string,
  expected?: Readonly<{ digest: `sha256:${string}`; bytes: number }>,
): RealBuildPrefix50Step44SourceLockedProductionReceipt {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    reviewRoot,
    REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE,
    expected?.bytes ?? MAXIMUM_RECEIPT_BYTES,
    "Step-44 source-locked production receipt",
    expected?.digest,
  );
  if (expected !== undefined && bytes.byteLength !== expected.bytes)
    throw new TypeError("Step-44 locked production receipt byte length drifted.");
  const text = Buffer.from(bytes).toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (canonicalStringify(value) !== text)
    throw new TypeError("Step-44 source-locked production receipt is not canonical JSON.");
  exactKeys(
    value,
    [
      "authority",
      "commitment",
      "expectedHarnessInputBytesHash",
      "publicHarnessSuccessCommitment",
      "publicationCompleteCommitment",
      "reviewBatchEnvelopeCommitment",
      "schemaVersion",
      "sourceLock",
      "sourceSetId",
    ],
    "Step-44 source-locked production receipt",
  );
  const receipt = value as RealBuildPrefix50Step44SourceLockedProductionReceipt;
  requireRealBuildPrefix50Step44SourceLockBinding(receipt.sourceLock);
  const { commitment, ...body } = receipt;
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step44-source-locked-production/2" ||
    receipt.sourceSetId !== "6651557" ||
    receipt.authority !== "none" ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError("Step-44 source-locked production receipt schema or commitment drifted.");
  return deepFreeze(receipt);
}

function exactCompletedRun(input: {
  readonly reviewRoot: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly completedRun?: RealBuildPrefix50Step44CompletedBlindRun;
}): RealBuildPrefix50Step44CompletedBlindRun {
  const completed =
    input.completedRun ??
    readRealBuildPrefix50Step44CompletedBlindRun({
      reviewRoot: input.reviewRoot,
      publicRoot: resolve(input.reviewRoot, "public"),
      withheldRoot: resolve(input.reviewRoot, "withheld"),
      batch: input.batch,
      packetArtifactFile: "real-build-prefix50-step44-blind-review-packet.json",
    });
  requireRealBuildPrefix50Step44CompletedBlindRun(completed);
  return completed;
}

function sameLiveBinding(
  capability: RealBuildPrefix50Step44SourceLockCapability,
  expected: RealBuildPrefix50Step44SourceLockBinding,
): void {
  if (
    canonicalDigest(reassertRealBuildPrefix50Step44SourceLockCapability(capability)) !==
    canonicalDigest(expected)
  )
    throw new TypeError("Step-44 source-lock capability changed before receipt publication.");
}

export async function writeRealBuildPrefix50Step44SourceLockedProductionReceipt(input: {
  readonly repositoryRoot: string;
  readonly reviewRoot: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
}): Promise<RealBuildPrefix50Step44SourceLockedProductionReceipt> {
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.batch);
  const sourceLock = requireRealBuildPrefix50Step44SourceLockCapability(input.capability);
  requireRealBuildPrefix50Step44SourceLockRepository(input.capability, input.repositoryRoot);
  const reviewPath = relative(resolve(input.repositoryRoot), resolve(input.reviewRoot));
  if (reviewPath.length === 0 || reviewPath.startsWith(".."))
    throw new TypeError(
      "Step-44 production review root must be contained in its locked repository.",
    );
  const completed = exactCompletedRun({ reviewRoot: input.reviewRoot, batch });
  if (
    sourceLock.operationInputRoots.length !== 1 ||
    sourceLock.operationInputFileCount !== 1 ||
    sourceLock.batchInput.digest !== completed.publicationComplete.expectedHarnessInputBytesHash
  )
    throw new TypeError(
      "Step-44 capture capability must bind only the externally pinned compact batch bytes.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-source-locked-production/2" as const,
    sourceSetId: "6651557" as const,
    authority: "none" as const,
    reviewBatchEnvelopeCommitment: batch.commitment,
    expectedHarnessInputBytesHash: completed.publicationComplete.expectedHarnessInputBytesHash,
    publicHarnessSuccessCommitment: completed.publicSuccess.commitment,
    publicationCompleteCommitment: completed.publicationComplete.commitment,
    sourceLock,
  };
  const receipt = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  const receiptBytes = Buffer.from(canonicalStringify(receipt));
  sameLiveBinding(input.capability, sourceLock);
  writeOrResumeRealBuildPrefix50Step44ExactArtifact(
    {
      root: input.reviewRoot,
      path: REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE,
      bytes: receiptBytes,
      label: "Step-44 source-locked production receipt",
    },
    {
      beforePublish: () => sameLiveBinding(input.capability, sourceLock),
      afterPublish: () => sameLiveBinding(input.capability, sourceLock),
    },
  );
  sameLiveBinding(input.capability, sourceLock);
  return parseReceipt(input.reviewRoot, {
    digest: `sha256:${createHash("sha256").update(receiptBytes).digest("hex")}`,
    bytes: receiptBytes.byteLength,
  });
}

export function readRealBuildPrefix50Step44SourceLockedProductionReceipt(input: {
  readonly repositoryRoot: string;
  readonly reviewRoot: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
  readonly completedRun?: RealBuildPrefix50Step44CompletedBlindRun;
}): RealBuildPrefix50Step44SourceLockedProductionReceipt {
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.batch);
  const currentSourceLock = requireRealBuildPrefix50Step44SourceLockCapability(input.capability);
  requireRealBuildPrefix50Step44SourceLockRepository(input.capability, input.repositoryRoot);
  const receiptPath = relative(
    resolve(input.repositoryRoot),
    resolve(input.reviewRoot, REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE),
  ).replaceAll("\\", "/");
  const lockedReceipt = requireRealBuildPrefix50Step44LockedInput(input.capability, receiptPath);
  const receipt = parseReceipt(input.reviewRoot, lockedReceipt);
  const completed = exactCompletedRun({
    reviewRoot: input.reviewRoot,
    batch,
    ...(input.completedRun === undefined ? {} : { completedRun: input.completedRun }),
  });
  if (
    receipt.reviewBatchEnvelopeCommitment !== batch.commitment ||
    receipt.expectedHarnessInputBytesHash !==
      completed.publicationComplete.expectedHarnessInputBytesHash ||
    receipt.publicHarnessSuccessCommitment !== completed.publicSuccess.commitment ||
    receipt.publicationCompleteCommitment !== completed.publicationComplete.commitment ||
    receipt.sourceLock.operationInputFileCount !== 1 ||
    receipt.sourceLock.batchInput.digest !==
      completed.publicationComplete.expectedHarnessInputBytesHash ||
    currentSourceLock.batchInput.digest !==
      completed.publicationComplete.expectedHarnessInputBytesHash ||
    receipt.sourceLock.stableSourceCommitment !== currentSourceLock.stableSourceCommitment ||
    receipt.sourceLock.sourceRootsPolicyDigest !== currentSourceLock.sourceRootsPolicyDigest
  )
    throw new TypeError(
      "Step-44 production receipt does not bind this locked tree, completed run, batch, and source roster.",
    );
  return receipt;
}
