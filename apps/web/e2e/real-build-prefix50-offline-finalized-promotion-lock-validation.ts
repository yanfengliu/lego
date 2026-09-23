import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";

import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  promotionBodyWithoutCommitment,
  requireExactPromotionKeys,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifact-io.ts";
import type { RealBuildPrefix50Step44PersistedPromotionEvidence } from "./real-build-prefix50-subbuild-return-review-blind-persisted.ts";
import {
  requireRealBuildPrefix50Step44FinalizationOperationInputs,
  type RealBuildPrefix50Step44FinalizationReceipt,
} from "./real-build-prefix50-subbuild-return-review-finalization-receipt.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_RAW_FULL_RESOLUTION_FILE,
  REAL_BUILD_PREFIX50_STEP44_RAW_LANE_A_FILE,
  REAL_BUILD_PREFIX50_STEP44_RAW_LANE_B_FILE,
} from "./real-build-prefix50-subbuild-return-review-source-locked-decision.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE,
  type RealBuildPrefix50Step44SourceLockedProductionReceipt,
} from "./real-build-prefix50-subbuild-return-review-source-locked-production.ts";
import { requireRealBuildPrefix50Step44SourceLockBinding } from "./real-build-prefix50-subbuild-return-review-source-lock.ts";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const FINALIZATION_KEYS = [
  "blindReviewClosureCommitment",
  "commitment",
  "finalizationOperationInputs",
  "finalizationSourceLock",
  "fullResolutionOutcomeCommitment",
  "laneCommitments",
  "productionReceiptCommitment",
  "promotionReceiptCommitment",
  "schemaVersion",
  "sourceSetId",
  "status",
] as const;

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function requireRealBuildPrefix50OfflineFinalization(input: {
  readonly receipt: RealBuildPrefix50Step44FinalizationReceipt;
  readonly repositoryRoot: string;
  readonly reviewRoot: string;
}): RealBuildPrefix50Step44FinalizationReceipt {
  const { receipt } = input;
  requireExactPromotionKeys(receipt, FINALIZATION_KEYS, "Offline Step-44 finalization receipt");
  const sourceLock = requireRealBuildPrefix50Step44SourceLockBinding(
    receipt.finalizationSourceLock,
  );
  const operationInputs = requireRealBuildPrefix50Step44FinalizationOperationInputs(
    sourceLock,
    receipt.finalizationOperationInputs,
  );
  const repositoryRoot = resolve(input.repositoryRoot);
  const reviewRoot = resolve(input.reviewRoot);
  const reviewRelative = relative(repositoryRoot, reviewRoot).replaceAll("\\", "/");
  if (reviewRelative.length === 0 || reviewRelative.startsWith("../") || isAbsolute(reviewRelative))
    throw new TypeError("Offline Step-44 finalization review root escaped its repository.");
  const fixedRoots = [
    sourceLock.batchInput.path,
    `${reviewRelative}/public`,
    `${reviewRelative}/withheld`,
    `${reviewRelative}/${REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE}`,
  ];
  const rawRoots = sourceLock.operationInputRoots.filter((root) => !fixedRoots.includes(root));
  if (
    sourceLock.operationInputRoots.length !== 5 ||
    fixedRoots.some((root) => !sourceLock.operationInputRoots.includes(root)) ||
    rawRoots.length !== 1
  )
    throw new TypeError(
      "Offline Step-44 finalization must bind exactly the compact batch, raw review inputs, captured public/withheld trees, and prior production receipt.",
    );
  const rawRoot = rawRoots[0]!;
  const expectedRawPaths = [
    `${rawRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_FULL_RESOLUTION_FILE}`,
    `${rawRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_LANE_A_FILE}`,
    `${rawRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_LANE_B_FILE}`,
  ].sort();
  const observedRawPaths = operationInputs
    .filter(({ path }) => path === rawRoot || path.startsWith(`${rawRoot}/`))
    .map(({ path }) => path)
    .sort();
  if (
    observedRawPaths.length !== expectedRawPaths.length ||
    observedRawPaths.some((path, index) => path !== expectedRawPaths[index])
  )
    throw new TypeError(
      "Offline Step-44 finalization raw review-input root must contain its exact three committed rows.",
    );
  const { commitment, ...body } = receipt;
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step44-source-locked-finalization/3" ||
    receipt.sourceSetId !== "6651557" ||
    receipt.status !== "promoted" ||
    receipt.promotionReceiptCommitment === null ||
    !Array.isArray(receipt.laneCommitments) ||
    receipt.laneCommitments.length !== 2 ||
    [
      receipt.productionReceiptCommitment,
      ...receipt.laneCommitments,
      receipt.fullResolutionOutcomeCommitment,
      receipt.blindReviewClosureCommitment,
      receipt.promotionReceiptCommitment,
      commitment,
    ].some((digest) => !DIGEST.test(digest)) ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError(
      "Offline Step-44 selector requires a canonical promoted finalization receipt v3.",
    );
  return receipt;
}

export function requireRealBuildPrefix50OfflineProductionReceipt(input: {
  readonly receipt: RealBuildPrefix50Step44SourceLockedProductionReceipt;
  readonly finalization: RealBuildPrefix50Step44FinalizationReceipt;
  readonly evidence: RealBuildPrefix50Step44PersistedPromotionEvidence;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly productionReceiptBytes: Uint8Array;
  readonly repositoryRoot: string;
  readonly reviewRoot: string;
}): void {
  const { receipt, finalization, evidence, batch } = input;
  requireExactPromotionKeys(
    receipt,
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
    "Offline Step-44 source-locked production receipt",
  );
  requireRealBuildPrefix50Step44SourceLockBinding(receipt.sourceLock);
  const productionReceiptPath = relative(
    resolve(input.repositoryRoot),
    resolve(input.reviewRoot, REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE),
  ).replaceAll("\\", "/");
  const productionRows = finalization.finalizationOperationInputs.filter(
    ({ path }) => path === productionReceiptPath,
  );
  const productionRow = productionRows[0];
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step44-source-locked-production/2" ||
    receipt.sourceSetId !== "6651557" ||
    receipt.authority !== "none" ||
    receipt.commitment !== canonicalDigest(promotionBodyWithoutCommitment(receipt)) ||
    receipt.commitment !== finalization.productionReceiptCommitment ||
    receipt.sourceLock.operationInputRoots.length !== 1 ||
    receipt.sourceLock.operationInputRoots[0] !== receipt.sourceLock.batchInput.path ||
    receipt.sourceLock.operationInputFileCount !== 1 ||
    receipt.sourceLock.operationInputByteCount !== receipt.sourceLock.batchInput.bytes ||
    receipt.sourceLock.batchInput.digest !==
      evidence.publicationComplete.expectedHarnessInputBytesHash ||
    receipt.sourceLock.stableSourceCommitment !==
      finalization.finalizationSourceLock.stableSourceCommitment ||
    receipt.sourceLock.sourceRootsPolicyDigest !==
      finalization.finalizationSourceLock.sourceRootsPolicyDigest ||
    canonicalStringify(receipt.sourceLock.batchInput) !==
      canonicalStringify(finalization.finalizationSourceLock.batchInput) ||
    productionRows.length !== 1 ||
    productionRow === undefined ||
    productionRow.digest !== sha256(input.productionReceiptBytes) ||
    productionRow.bytes !== input.productionReceiptBytes.byteLength ||
    receipt.reviewBatchEnvelopeCommitment !== batch.commitment ||
    receipt.expectedHarnessInputBytesHash !==
      evidence.publicationComplete.expectedHarnessInputBytesHash ||
    receipt.publicHarnessSuccessCommitment !== evidence.publicSuccess.commitment ||
    receipt.publicationCompleteCommitment !== evidence.publicationComplete.commitment
  )
    throw new TypeError(
      "Offline Step-44 production receipt drifted from the finalized review closure.",
    );
}
