import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";

import {
  canonicalDigest,
  canonicalStringify,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { validateBrickDocumentV1, type BrickDocumentV1 } from "@lego-studio/protocol";

import type {
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import type { RealBuildPrefix50Step44WithheldUnblindingMap } from "./real-build-prefix50-subbuild-return-review-blind.ts";
import {
  promotionBodyWithoutCommitment,
  REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
  requireExactPromotionKeys,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifact-io.ts";
import type { RealBuildPrefix50Step44BlindPromotionReceipt } from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifacts.ts";
import { REAL_BUILD_PREFIX50_STEP44_PROCEDURAL_INDEPENDENCE_STATEMENT } from "./real-build-prefix50-subbuild-return-review-blind-promotion-authority.ts";
import type {
  RealBuildPrefix50Step44BlindReviewOutputLayout,
  RealBuildPrefix50Step44PersistedPromotionEvidence,
} from "./real-build-prefix50-subbuild-return-review-blind-persisted.ts";
import type { RealBuildPrefix50Step44ProductionCaptureChainVerification } from "./real-build-prefix50-subbuild-return-review-blind-production-chain.ts";
import { hydrateRealBuildPrefix50Step44ReviewEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-replay.ts";
import type { RealBuildPrefix50Step44FinalizationReceipt } from "./real-build-prefix50-subbuild-return-review-finalization-receipt.ts";

export {
  requireRealBuildPrefix50OfflineFinalization,
  requireRealBuildPrefix50OfflineProductionReceipt,
} from "./real-build-prefix50-offline-finalized-promotion-lock-validation.ts";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
export const REAL_BUILD_PREFIX50_OFFLINE_PROMOTION_FILES = [
  REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE,
  REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE,
] as const;

const RECEIPT_KEYS = [
  "allSixCriteriaSame",
  "authority",
  "blindReviewClosureCommitment",
  "blindReviewPacketCommitment",
  "candidateKey",
  "candidateKeysCommitment",
  "candidateRosterCommitment",
  "captureManifestCommitment",
  "commitment",
  "compactCandidateCommitment",
  "finalizationOperationInputsCommitment",
  "finalizationSourceLockCommitment",
  "fixturePromotionAuthority",
  "fullResolutionOutcomeCommitment",
  "laneCommitments",
  "page45SourcePolicyCommitment",
  "physicalPage45VerificationCommitment",
  "proceduralIndependenceStatement",
  "productionCaptureChainCommitment",
  "publicationCompleteCommitment",
  "publicHarnessSuccessCommitment",
  "publicPixelVerificationCommitment",
  "returnCandidateCommitment",
  "returnResultCommitment",
  "reviewBatchEnvelopeCommitment",
  "reviewHarnessEnvelopeCommitment",
  "reviewStatus",
  "rosterDescriptorCommitment",
  "schemaVersion",
  "selectedBlindId",
  "selectedDocumentArtifactByteDigest",
  "selectedDocumentArtifactFile",
  "selectedDocumentCommitment",
  "selectedDocumentHash",
  "selectedEnvelopeArtifactByteDigest",
  "selectedEnvelopeArtifactFile",
  "selectedEnvelopeCommitment",
  "selectedMapRowCommitment",
  "selectionAuthority",
  "sourcePdfArtifactPath",
  "sourcePdfDigest",
  "sourceRowCommitment",
  "sourceSetId",
  "withheldUnblindingMapCommitment",
] as const;
const ENVELOPE_KEYS = [
  "authority",
  "candidateKey",
  "candidateRosterCommitment",
  "childSubBuildWindowCommitment",
  "commitment",
  "detachedStateCommitment",
  "projectionCommitment",
  "returnResultCommitment",
  "schemaVersion",
  "selectedDocument",
  "selectedDocumentCommitment",
  "selectedDocumentHash",
  "sourceDocumentHash",
  "sourceMemberRowsCommitment",
  "sourceSetId",
  "step42_43RepairCommitment",
  "step43PredecessorCommitment",
] as const;

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function requireRealBuildPrefix50OfflinePromotionLayout(
  repositoryRootValue: string,
  layout: RealBuildPrefix50Step44BlindReviewOutputLayout,
): string {
  const repositoryRoot = resolve(repositoryRootValue);
  const reviewRoot = resolve(layout.reviewRoot);
  const reviewRelative = relative(repositoryRoot, reviewRoot);
  if (reviewRelative.length === 0 || reviewRelative.startsWith("..") || isAbsolute(reviewRelative))
    throw new TypeError("Offline Step-44 finalized promotion must remain inside its repository.");
  const expected = {
    publicRoot: resolve(reviewRoot, "public"),
    laneARoot: resolve(reviewRoot, "lane-a"),
    laneBRoot: resolve(reviewRoot, "lane-b"),
    fullResolutionRoot: resolve(reviewRoot, "full-resolution"),
    closureRoot: resolve(reviewRoot, "closure"),
    promotionRoot: resolve(reviewRoot, "promotion"),
  };
  for (const [key, path] of Object.entries(expected))
    if (resolve(layout[key as keyof typeof expected]) !== path)
      throw new TypeError(`Offline Step-44 finalized promotion ${key} drifted from reviewRoot.`);
  return reviewRoot;
}

export function requireRealBuildPrefix50ExactOfflinePromotionFiles(
  root: string,
  actual: readonly string[],
): void {
  const wanted = [...REAL_BUILD_PREFIX50_OFFLINE_PROMOTION_FILES].sort();
  const observed = [...actual].sort();
  if (observed.length !== wanted.length || observed.some((file, index) => file !== wanted[index]))
    throw new TypeError(
      `Offline Step-44 promotion output must contain exactly ${wanted.join(", ")}.`,
    );
  if (resolve(root) === resolve("."))
    throw new TypeError("Offline Step-44 promotion output cannot be the repository root.");
}

function requirePromotionReceiptShape(receipt: RealBuildPrefix50Step44BlindPromotionReceipt): void {
  requireExactPromotionKeys(receipt, RECEIPT_KEYS, "Offline Step-44 promotion receipt");
  const digests = [
    receipt.physicalPage45VerificationCommitment,
    receipt.productionCaptureChainCommitment,
    receipt.publicationCompleteCommitment,
    receipt.finalizationSourceLockCommitment,
    receipt.finalizationOperationInputsCommitment,
    receipt.blindReviewPacketCommitment,
    receipt.publicHarnessSuccessCommitment,
    ...receipt.laneCommitments,
    receipt.fullResolutionOutcomeCommitment,
    receipt.blindReviewClosureCommitment,
    receipt.publicPixelVerificationCommitment,
    receipt.withheldUnblindingMapCommitment,
    receipt.selectedMapRowCommitment,
    receipt.reviewBatchEnvelopeCommitment,
    receipt.returnResultCommitment,
    receipt.candidateRosterCommitment,
    receipt.candidateKeysCommitment,
    receipt.returnCandidateCommitment,
    receipt.rosterDescriptorCommitment,
    receipt.reviewHarnessEnvelopeCommitment,
    receipt.compactCandidateCommitment,
    receipt.captureManifestCommitment,
    receipt.sourceRowCommitment,
    receipt.selectedDocumentHash,
    receipt.selectedDocumentCommitment,
    receipt.selectedDocumentArtifactByteDigest,
    receipt.selectedEnvelopeArtifactByteDigest,
    receipt.selectedEnvelopeCommitment,
    receipt.commitment,
  ];
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step44-blind-return-promotion/3" ||
    receipt.authority !== "repository-reviewed-step44" ||
    receipt.reviewStatus !== "reviewed" ||
    receipt.selectionAuthority !== "blind-page45-closure" ||
    receipt.fixturePromotionAuthority !== true ||
    receipt.sourceSetId !== "6651557" ||
    receipt.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    receipt.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    receipt.page45SourcePolicyCommitment !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT ||
    receipt.proceduralIndependenceStatement !==
      REAL_BUILD_PREFIX50_STEP44_PROCEDURAL_INDEPENDENCE_STATEMENT ||
    receipt.selectedDocumentArtifactFile !== REAL_BUILD_PREFIX50_STEP44_SELECTED_DOCUMENT_FILE ||
    receipt.selectedEnvelopeArtifactFile !== REAL_BUILD_PREFIX50_STEP44_SELECTED_ENVELOPE_FILE ||
    !Array.isArray(receipt.laneCommitments) ||
    receipt.laneCommitments.length !== 2 ||
    digests.some((digest) => !DIGEST.test(digest)) ||
    receipt.allSixCriteriaSame !== true ||
    receipt.commitment !== canonicalDigest(promotionBodyWithoutCommitment(receipt))
  )
    throw new TypeError("Offline Step-44 promotion receipt schema or commitment drifted.");
}

export function requireRealBuildPrefix50OfflinePromotionChain(input: {
  readonly receipt: RealBuildPrefix50Step44BlindPromotionReceipt;
  readonly documentBytes: Uint8Array;
  readonly selectedDocument: BrickDocumentV1;
  readonly envelopeBytes: Uint8Array;
  readonly selectedEnvelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
  readonly evidence: RealBuildPrefix50Step44PersistedPromotionEvidence;
  readonly map: RealBuildPrefix50Step44WithheldUnblindingMap;
  readonly productionChain: RealBuildPrefix50Step44ProductionCaptureChainVerification;
  readonly finalization: RealBuildPrefix50Step44FinalizationReceipt;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly result: RealBuildPrefix50SubBuildReturnResult;
}): void {
  const {
    receipt,
    evidence,
    map,
    productionChain,
    finalization,
    batch,
    result,
    selectedDocument,
    selectedEnvelope,
  } = input;
  requirePromotionReceiptShape(receipt);
  requireExactPromotionKeys(selectedEnvelope, ENVELOPE_KEYS, "Offline Step-44 selected envelope");
  if (evidence.closure.disposition.kind !== "selected-one")
    throw new TypeError("Offline Step-44 selector refuses a non-selected closure.");
  const selectedBlindId = evidence.closure.disposition.blindId;
  const reviewRows = evidence.outcome.fullResolutionReviews.filter(
    ({ blindId }) => blindId === selectedBlindId,
  );
  const mapRows = map.rows.filter(({ blindId }) => blindId === selectedBlindId);
  const mapRow = mapRows[0];
  if (
    reviewRows.length !== 1 ||
    reviewRows[0]?.survives !== true ||
    reviewRows[0].criteria.length !== 6 ||
    reviewRows[0].criteria.some(({ outcome }) => outcome !== "same") ||
    mapRows.length !== 1 ||
    mapRow === undefined
  )
    throw new TypeError("Offline Step-44 selector requires one six-criterion survivor.");
  const compact = batch.candidates[mapRow.batchIndex];
  const roster = batch.rosterSummary.candidates[mapRow.rosterIndex];
  const descriptor = result.candidateRoster.find(
    ({ candidateKey }) => candidateKey === mapRow.candidateKey,
  );
  const candidate = result.enumeration.candidates.find(
    ({ candidateKey }) => candidateKey === mapRow.candidateKey,
  );
  if (
    compact === undefined ||
    roster === undefined ||
    descriptor === undefined ||
    candidate === undefined
  )
    throw new TypeError("Offline Step-44 selected candidate is absent from its exact roster.");
  const expectedEnvelope = hydrateRealBuildPrefix50Step44ReviewEnvelope(batch, compact);
  const checks = [
    validateBrickDocumentV1(selectedDocument),
    documentStructuralHash(selectedDocument) === receipt.selectedDocumentHash,
    canonicalDigest(selectedDocument) === receipt.selectedDocumentCommitment,
    receipt.selectedDocumentArtifactByteDigest === sha256(input.documentBytes),
    receipt.selectedEnvelopeArtifactByteDigest === sha256(input.envelopeBytes),
    receipt.selectedEnvelopeCommitment === selectedEnvelope.commitment,
    selectedEnvelope.commitment ===
      canonicalDigest(promotionBodyWithoutCommitment(selectedEnvelope)),
    canonicalStringify(selectedEnvelope) === canonicalStringify(expectedEnvelope),
    canonicalStringify(selectedEnvelope.selectedDocument) === canonicalStringify(selectedDocument),
    canonicalStringify(candidate.hardValidDocument) === canonicalStringify(selectedDocument),
    candidate.validationReport.documentGloballyValid,
    candidate.validationReport.targetDocumentHash === receipt.selectedDocumentHash,
    receipt.selectedBlindId === selectedBlindId,
    receipt.candidateKey === mapRow.candidateKey,
    receipt.blindReviewPacketCommitment === evidence.packet.commitment,
    receipt.publicHarnessSuccessCommitment === evidence.publicSuccess.commitment,
    receipt.laneCommitments[0] === evidence.lanes[0].commitment,
    receipt.laneCommitments[1] === evidence.lanes[1].commitment,
    receipt.fullResolutionOutcomeCommitment === evidence.outcome.commitment,
    receipt.blindReviewClosureCommitment === evidence.closure.commitment,
    receipt.publicPixelVerificationCommitment ===
      evidence.closure.publicPixelVerificationCommitment,
    receipt.physicalPage45VerificationCommitment === evidence.physicalPage45Verification.commitment,
    receipt.productionCaptureChainCommitment === productionChain.commitment,
    receipt.publicationCompleteCommitment === evidence.publicationComplete.commitment,
    receipt.withheldUnblindingMapCommitment === map.commitment,
    receipt.selectedMapRowCommitment === mapRow.commitment,
    receipt.reviewBatchEnvelopeCommitment === batch.commitment,
    receipt.returnResultCommitment === result.commitment,
    receipt.candidateRosterCommitment === result.candidateRosterCommitment,
    receipt.candidateKeysCommitment === batch.candidateKeysCommitment,
    receipt.returnCandidateCommitment === canonicalDigest(candidate),
    receipt.rosterDescriptorCommitment === canonicalDigest(descriptor),
    receipt.reviewHarnessEnvelopeCommitment === mapRow.reviewHarnessEnvelopeCommitment,
    receipt.compactCandidateCommitment === mapRow.compactCandidateCommitment,
    receipt.captureManifestCommitment === mapRow.captureManifestCommitment,
    receipt.sourceRowCommitment === mapRow.sourceRowCommitment,
    receipt.selectedDocumentHash === mapRow.selectedDocumentHash,
    receipt.selectedDocumentCommitment === mapRow.selectedDocumentCommitment,
    result.commitment === batch.returnResultCommitment,
    result.candidateRosterCommitment === batch.candidateRosterCommitment,
    result.sourceDocumentHash === batch.sourceDocumentHash,
    compact.candidateKey === mapRow.candidateKey,
    roster.candidateKey === mapRow.candidateKey,
    canonicalDigest(descriptor) ===
      canonicalDigest({
        candidateKey: roster.candidateKey,
        groupDelta: roster.groupDelta,
        crossPorts: roster.crossPorts,
      }),
    finalization.promotionReceiptCommitment === receipt.commitment,
    finalization.laneCommitments[0] === evidence.lanes[0].commitment,
    finalization.laneCommitments[1] === evidence.lanes[1].commitment,
    finalization.fullResolutionOutcomeCommitment === evidence.outcome.commitment,
    finalization.blindReviewClosureCommitment === evidence.closure.commitment,
    receipt.finalizationSourceLockCommitment === finalization.finalizationSourceLock.commitment,
    receipt.finalizationOperationInputsCommitment ===
      finalization.finalizationSourceLock.operationInputsCommitment,
  ];
  const failedCheck = checks.findIndex((check) => !check);
  if (failedCheck !== -1)
    throw new TypeError(
      `Offline Step-44 promotion drifted from its exact finalization, closure, map, batch, or document at commitment check ${failedCheck + 1}.`,
    );
}
