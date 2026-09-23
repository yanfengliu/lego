import { readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type {
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  readCanonicalPromotionArtifact,
  REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifact-io.ts";
import type { RealBuildPrefix50Step44BlindPromotionReceipt } from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifacts.ts";
import {
  type RealBuildPrefix50Step44BlindReviewOutputLayout,
  readRealBuildPrefix50Step44PersistedPromotionEvidence,
  requireRealBuildPrefix50Step44PersistedPromotionEvidence,
} from "./real-build-prefix50-subbuild-return-review-blind-persisted.ts";
import {
  requireRealBuildPrefix50Step44ProductionCaptureChain,
  verifyRealBuildPrefix50Step44ProductionCaptureChain,
} from "./real-build-prefix50-subbuild-return-review-blind-production-chain.ts";
import { readRealBuildPrefix50Step44WithheldUnblindingMap } from "./real-build-prefix50-subbuild-return-review-blind-unblinding.ts";
import {
  readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification,
  requireRealBuildPrefix50Step44RealDomainQualificationBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock } from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { readRealBuildPrefix50Step44FinalizationReceipt } from "./real-build-prefix50-subbuild-return-review-finalization-receipt.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE,
  type RealBuildPrefix50Step44SourceLockedProductionReceipt,
} from "./real-build-prefix50-subbuild-return-review-source-locked-production.ts";
import { requireRealBuildPrefix50ExactKeys } from "./real-build-prefix50-subbuild-return-validation-primitives.ts";
import {
  requireRealBuildPrefix50ExactOfflinePromotionFiles,
  requireRealBuildPrefix50OfflineFinalization,
  requireRealBuildPrefix50OfflineProductionReceipt,
  requireRealBuildPrefix50OfflinePromotionChain,
  requireRealBuildPrefix50OfflinePromotionLayout,
} from "./real-build-prefix50-offline-finalized-promotion-validation.ts";

export interface RealBuildPrefix50OfflineFinalizedPromotionInput {
  readonly repositoryRoot: string;
  readonly reviewLayout: RealBuildPrefix50Step44BlindReviewOutputLayout;
  readonly qualificationOutputPath: string;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly returnResult: RealBuildPrefix50SubBuildReturnResult;
}

export interface RealBuildPrefix50OfflineFinalizedPromotionSelection {
  readonly schemaVersion: "lego.real-build-prefix50-offline-finalized-promotion-selection/1";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly realDomainQualificationCommitment: `sha256:${string}`;
  readonly finalizationReceiptCommitment: `sha256:${string}`;
  readonly promotionReceiptCommitment: `sha256:${string}`;
  readonly blindReviewClosureCommitment: `sha256:${string}`;
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly promotionReceipt: RealBuildPrefix50Step44BlindPromotionReceipt;
  readonly selectedEnvelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
  readonly selectedDocument: BrickDocumentV1;
  readonly commitment: `sha256:${string}`;
}

interface SelectorDependencies {
  readonly readFinalization: typeof readRealBuildPrefix50Step44FinalizationReceipt;
  readonly readEvidence: typeof readRealBuildPrefix50Step44PersistedPromotionEvidence;
  readonly requireEvidence: typeof requireRealBuildPrefix50Step44PersistedPromotionEvidence;
  readonly readMap: typeof readRealBuildPrefix50Step44WithheldUnblindingMap;
  readonly captureSourceLock: typeof captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly reopenQualification: typeof readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification;
  readonly verifyProductionChain: typeof verifyRealBuildPrefix50Step44ProductionCaptureChain;
  readonly requireProductionChain: typeof requireRealBuildPrefix50Step44ProductionCaptureChain;
  readonly readArtifact: typeof readCanonicalPromotionArtifact;
  readonly readPromotionFiles: (root: string) => readonly string[];
}

const selections = new WeakSet<object>();

function requireQualificationOutputPath(
  repositoryRoot: string,
  reviewRoot: string,
  value: string,
): string {
  const outputPath = resolve(value);
  const pathRelative = relative(repositoryRoot, outputPath);
  if (
    pathRelative.length === 0 ||
    pathRelative.startsWith("..") ||
    outputPath !== `${reviewRoot}.page44-real-domain-calibration`
  )
    throw new TypeError(
      "Offline Step-44 replay requires the exact persisted calibration sibling for its review root.",
    );
  return outputPath;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

async function readWithDependencies(
  input: RealBuildPrefix50OfflineFinalizedPromotionInput,
  dependencies: SelectorDependencies,
): Promise<RealBuildPrefix50OfflineFinalizedPromotionSelection> {
  requireRealBuildPrefix50ExactKeys(
    input,
    ["qualificationOutputPath", "repositoryRoot", "returnResult", "reviewBatch", "reviewLayout"],
    "Offline Step-44 finalized promotion input",
  );
  const repositoryRoot = resolve(input.repositoryRoot);
  const reviewRoot = requireRealBuildPrefix50OfflinePromotionLayout(
    repositoryRoot,
    input.reviewLayout,
  );
  const qualificationOutputPath = requireQualificationOutputPath(
    repositoryRoot,
    reviewRoot,
    input.qualificationOutputPath,
  );
  const reviewBatch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.reviewBatch);
  const finalization = requireRealBuildPrefix50OfflineFinalization({
    receipt: dependencies.readFinalization(reviewRoot),
    repositoryRoot,
    reviewRoot,
  });
  const sourceLock = dependencies.captureSourceLock(repositoryRoot);
  const realDomainQualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    await dependencies.reopenQualification({
      qualificationOutputPath,
      repositoryRoot,
      sourceLock,
      returnResult: input.returnResult,
      reviewBatch,
    }),
  );
  const evidence = await dependencies.readEvidence(
    input.reviewLayout,
    repositoryRoot,
    reviewBatch,
    realDomainQualification,
  );
  dependencies.requireEvidence(evidence);
  const withheldRoot = resolve(reviewRoot, "withheld");
  const map = dependencies.readMap({
    withheldRoot,
    packet: evidence.packet,
    batch: reviewBatch,
    publicationComplete: evidence.publicationComplete,
  });
  const productionChain = await dependencies.verifyProductionChain({
    publicRoot: input.reviewLayout.publicRoot,
    withheldRoot,
    packet: evidence.packet,
    success: evidence.publicSuccess,
    batch: reviewBatch,
    map,
    publicationComplete: evidence.publicationComplete,
    realDomainQualification,
  });
  dependencies.requireProductionChain(productionChain);
  requireRealBuildPrefix50ExactOfflinePromotionFiles(
    input.reviewLayout.promotionRoot,
    dependencies.readPromotionFiles(input.reviewLayout.promotionRoot),
  );
  const promotion = dependencies.readArtifact<RealBuildPrefix50Step44BlindPromotionReceipt>(
    input.reviewLayout.promotionRoot,
    REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
    "Offline Step-44 promotion receipt",
  );
  const document = dependencies.readArtifact<BrickDocumentV1>(
    input.reviewLayout.promotionRoot,
    REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
    "Offline Step-44 selected document",
  );
  const envelope = dependencies.readArtifact<RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope>(
    input.reviewLayout.promotionRoot,
    REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
    "Offline Step-44 selected envelope",
  );
  const production =
    dependencies.readArtifact<RealBuildPrefix50Step44SourceLockedProductionReceipt>(
      reviewRoot,
      REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE,
      "Offline Step-44 source-locked production receipt",
    );
  requireRealBuildPrefix50OfflineProductionReceipt({
    receipt: production.value,
    finalization,
    evidence,
    batch: reviewBatch,
    productionReceiptBytes: production.bytes,
    repositoryRoot,
    reviewRoot,
  });
  requireRealBuildPrefix50OfflinePromotionChain({
    receipt: promotion.value,
    documentBytes: document.bytes,
    selectedDocument: document.value,
    envelopeBytes: envelope.bytes,
    selectedEnvelope: envelope.value,
    evidence,
    map,
    productionChain,
    finalization,
    batch: reviewBatch,
    result: input.returnResult,
  });
  const finalizationAfter = dependencies.readFinalization(reviewRoot);
  const promotionAfter = dependencies.readArtifact<RealBuildPrefix50Step44BlindPromotionReceipt>(
    input.reviewLayout.promotionRoot,
    REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
    "Offline Step-44 promotion receipt re-read",
  );
  const documentAfter = dependencies.readArtifact<BrickDocumentV1>(
    input.reviewLayout.promotionRoot,
    REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
    "Offline Step-44 selected document re-read",
  );
  const envelopeAfter =
    dependencies.readArtifact<RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope>(
      input.reviewLayout.promotionRoot,
      REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
      "Offline Step-44 selected envelope re-read",
    );
  requireRealBuildPrefix50ExactOfflinePromotionFiles(
    input.reviewLayout.promotionRoot,
    dependencies.readPromotionFiles(input.reviewLayout.promotionRoot),
  );
  if (
    canonicalStringify(finalizationAfter) !== canonicalStringify(finalization) ||
    !sameBytes(promotionAfter.bytes, promotion.bytes) ||
    !sameBytes(documentAfter.bytes, document.bytes) ||
    !sameBytes(envelopeAfter.bytes, envelope.bytes)
  )
    throw new TypeError("Offline Step-44 finalized promotion changed during selection.");
  const body = {
    schemaVersion: "lego.real-build-prefix50-offline-finalized-promotion-selection/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    realDomainQualificationCommitment: realDomainQualification.commitment,
    finalizationReceiptCommitment: finalization.commitment,
    promotionReceiptCommitment: promotion.value.commitment,
    blindReviewClosureCommitment: evidence.closure.commitment,
    returnResultCommitment: input.returnResult.commitment,
    candidateKey: promotion.value.candidateKey,
    selectedDocumentHash: promotion.value.selectedDocumentHash,
    promotionReceipt: promotion.value,
    selectedEnvelope: envelope.value,
    selectedDocument: document.value,
  };
  const selection = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  selections.add(selection);
  return selection;
}

const PRODUCTION_DEPENDENCIES: SelectorDependencies = {
  readFinalization: readRealBuildPrefix50Step44FinalizationReceipt,
  readEvidence: readRealBuildPrefix50Step44PersistedPromotionEvidence,
  requireEvidence: requireRealBuildPrefix50Step44PersistedPromotionEvidence,
  readMap: readRealBuildPrefix50Step44WithheldUnblindingMap,
  captureSourceLock: captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  reopenQualification: readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification,
  verifyProductionChain: verifyRealBuildPrefix50Step44ProductionCaptureChain,
  requireProductionChain: requireRealBuildPrefix50Step44ProductionCaptureChain,
  readArtifact: readCanonicalPromotionArtifact,
  readPromotionFiles: (root) => readdirSync(root),
};

export function readRealBuildPrefix50OfflineFinalizedPromotion(
  input: RealBuildPrefix50OfflineFinalizedPromotionInput,
): Promise<RealBuildPrefix50OfflineFinalizedPromotionSelection> {
  return readWithDependencies(input, PRODUCTION_DEPENDENCIES);
}

export function requireRealBuildPrefix50OfflineFinalizedPromotion(
  value: unknown,
  result: RealBuildPrefix50SubBuildReturnResult,
): RealBuildPrefix50OfflineFinalizedPromotionSelection {
  if (
    value === null ||
    typeof value !== "object" ||
    !selections.has(value) ||
    (value as RealBuildPrefix50OfflineFinalizedPromotionSelection).returnResultCommitment !==
      result.commitment
  )
    throw new TypeError(
      "Step-44 offline selection requires the exact runtime-branded finalized promotion read for this result.",
    );
  return value as RealBuildPrefix50OfflineFinalizedPromotionSelection;
}

export interface RealBuildPrefix50OfflineFinalizedPromotionSelectorTestHooks {
  readonly readWithDependencies: typeof readWithDependencies;
}

export const realBuildPrefix50OfflineFinalizedPromotionSelectorTestOnly: Readonly<
  Partial<RealBuildPrefix50OfflineFinalizedPromotionSelectorTestHooks>
> =
  typeof process !== "undefined" && process.env.NODE_ENV === "test"
    ? Object.freeze({ readWithDependencies })
    : Object.freeze({});
