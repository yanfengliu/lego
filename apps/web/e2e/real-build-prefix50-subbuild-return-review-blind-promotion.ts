import { realpathSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";

import { canonicalStringify } from "@lego-studio/brick-kernel";

import type {
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  type RealBuildPrefix50Step44BlindReviewOutputLayout,
  readRealBuildPrefix50Step44PersistedPromotionEvidence,
  requireRealBuildPrefix50Step44PersistedPromotionEvidence,
} from "./real-build-prefix50-subbuild-return-review-blind-persisted.ts";
import {
  type RealBuildPrefix50Step44BlindPromotionReceipt,
  readRealBuildPrefix50Step44PersistedPromotion as readRealBuildPrefix50Step44PersistedPromotionArtifacts,
  requireRealBuildPrefix50Step44PersistedPromotion,
  writeRealBuildPrefix50Step44PromotionArtifacts,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifacts.ts";
import {
  createRealBuildPrefix50Step44ProductionPromotionAuthority,
  type RealBuildPrefix50Step44ProductionPromotionAuthority,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion-authority.ts";
import {
  requireRealBuildPrefix50Step44ProductionCaptureChain,
  verifyRealBuildPrefix50Step44ProductionCaptureChain,
} from "./real-build-prefix50-subbuild-return-review-blind-production-chain.ts";
import { requireRealBuildPrefix50Step44PublicationComplete } from "./real-build-prefix50-subbuild-return-review-blind-publication-complete.ts";
import { requireRealBuildPrefix50Step44PhysicalPage45Verification } from "./real-build-prefix50-subbuild-return-review-blind-provenance.ts";
import {
  readRealBuildPrefix50Step44WithheldUnblindingMap,
  requireRealBuildPrefix50Step44PersistedUnblindingMap,
} from "./real-build-prefix50-subbuild-return-review-blind-unblinding.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { requireRealBuildPrefix50SubBuildReturnResult } from "./real-build-prefix50-subbuild-return.ts";
import { readRealBuildPrefix50Step44SourceLockedProductionReceipt } from "./real-build-prefix50-subbuild-return-review-source-locked-production.ts";
import { deriveRealBuildPrefix50Step44SourceLockedDecision } from "./real-build-prefix50-subbuild-return-review-source-locked-decision.ts";
import {
  reassertRealBuildPrefix50Step44SourceLockCapability,
  requireRealBuildPrefix50Step44SourceLockCapability,
  type RealBuildPrefix50Step44SourceLockCapability,
} from "./real-build-prefix50-subbuild-return-review-source-lock.ts";
import {
  requireRealBuildPrefix50Step44RealDomainQualificationBinding,
  type RealBuildPrefix50Step44RealDomainQualificationBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";

export type { RealBuildPrefix50Step44BlindPromotionReceipt } from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifacts.ts";
export {
  readRealBuildPrefix50Step44PersistedPromotion,
  requireRealBuildPrefix50Step44BlindPromotionReceipt,
  requireRealBuildPrefix50Step44PersistedPromotion,
} from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifacts.ts";

function requireWithheldSibling(
  layout: RealBuildPrefix50Step44BlindReviewOutputLayout,
  withheldRoot: string,
): void {
  const root = realpathSync(layout.reviewRoot);
  const withheld = realpathSync(withheldRoot);
  const promotion = realpathSync(layout.promotionRoot);
  if (
    dirname(withheld) !== root ||
    basename(withheld) !== "withheld" ||
    dirname(promotion) !== root ||
    basename(promotion) !== "promotion"
  )
    throw new TypeError(
      "Step-44 promotion requires the exact withheld/ and promotion/ sibling roots.",
    );
}

function repositoryRelative(repositoryRoot: string, path: string, label: string): string {
  const value = relative(resolve(repositoryRoot), resolve(path)).replaceAll("\\", "/");
  if (value.length === 0 || value.startsWith("../"))
    throw new TypeError(`${label} escaped the source-locked repository.`);
  return value;
}

export interface RealBuildPrefix50Step44BlindPromotionInput {
  readonly layout: RealBuildPrefix50Step44BlindReviewOutputLayout;
  readonly withheldRoot: string;
  readonly rawInputRoot?: string;
  readonly repositoryRoot: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly result: RealBuildPrefix50SubBuildReturnResult;
  readonly capability?: RealBuildPrefix50Step44SourceLockCapability;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}

type SourceLockedBlindPromotionInput = RealBuildPrefix50Step44BlindPromotionInput & {
  readonly rawInputRoot: string;
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
};

function requireSourceLockedPromotionInput(
  input: RealBuildPrefix50Step44BlindPromotionInput,
): asserts input is SourceLockedBlindPromotionInput {
  if (
    input.rawInputRoot === undefined ||
    input.capability === undefined ||
    input.realDomainQualification === undefined
  )
    throw new TypeError(
      "Step-44 promotion requires the opaque live finalization capability, real-domain qualification, and raw reviewer-input tree.",
    );
}

async function deriveRealBuildPrefix50Step44ProductionPromotionAuthority(
  input: RealBuildPrefix50Step44BlindPromotionInput,
): Promise<RealBuildPrefix50Step44ProductionPromotionAuthority> {
  requireSourceLockedPromotionInput(input);
  const qualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.realDomainQualification,
  );
  const result = requireRealBuildPrefix50SubBuildReturnResult(input.result);
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.batch);
  if (qualification.reviewBatchEnvelopeCommitment !== batch.commitment)
    throw new TypeError(
      "Step-44 promotion requires the real-domain qualification for this exact review batch.",
    );
  const evidence = await readRealBuildPrefix50Step44PersistedPromotionEvidence(
    input.layout,
    input.repositoryRoot,
    batch,
    qualification,
  );
  requireRealBuildPrefix50Step44PersistedPromotionEvidence(evidence);
  requireRealBuildPrefix50Step44SourceLockCapability(input.capability);
  reassertRealBuildPrefix50Step44SourceLockCapability(input.capability);
  requireWithheldSibling(input.layout, input.withheldRoot);
  readRealBuildPrefix50Step44SourceLockedProductionReceipt({
    repositoryRoot: input.repositoryRoot,
    reviewRoot: input.layout.reviewRoot,
    batch,
    capability: input.capability,
  });
  const lockedDecision = deriveRealBuildPrefix50Step44SourceLockedDecision({
    repositoryRoot: input.repositoryRoot,
    rawLogicalRoot: repositoryRelative(
      input.repositoryRoot,
      input.rawInputRoot,
      "Step-44 raw reviewer-input tree",
    ),
    packet: evidence.packet,
    capability: input.capability,
  });
  if (
    canonicalStringify(lockedDecision.lanes) !== canonicalStringify(evidence.lanes) ||
    canonicalStringify(lockedDecision.outcome) !== canonicalStringify(evidence.outcome)
  )
    throw new TypeError(
      "Step-44 persisted lanes or outcome drifted from the freshly rederived locked reviewer inputs.",
    );
  requireRealBuildPrefix50Step44PhysicalPage45Verification(evidence.physicalPage45Verification);
  const closure = evidence.closure;
  if (closure.disposition.kind !== "selected-one")
    throw new TypeError("Step-44 refusal closure cannot mint repository-reviewed evidence.");
  const selectedBlindId = closure.disposition.blindId;
  const fullRow = evidence.outcome.fullResolutionReviews.find(
    ({ blindId }) => blindId === selectedBlindId,
  );
  if (
    fullRow === undefined ||
    !fullRow.survives ||
    fullRow.criteria.length !== 6 ||
    fullRow.criteria.some(({ outcome }) => outcome !== "same")
  )
    throw new TypeError("Step-44 promotion requires all six selected criteria to be same.");
  const publicationComplete = evidence.publicationComplete;
  requireRealBuildPrefix50Step44PublicationComplete(publicationComplete);
  const map = readRealBuildPrefix50Step44WithheldUnblindingMap({
    withheldRoot: input.withheldRoot,
    packet: evidence.packet,
    batch,
    publicationComplete,
  });
  requireRealBuildPrefix50Step44PersistedUnblindingMap({
    map,
    publicationComplete,
    batch,
    withheldRoot: input.withheldRoot,
  });
  const productionChain = await verifyRealBuildPrefix50Step44ProductionCaptureChain({
    publicRoot: input.layout.publicRoot,
    withheldRoot: input.withheldRoot,
    packet: evidence.packet,
    success: evidence.publicSuccess,
    batch,
    map,
    publicationComplete,
    realDomainQualification: qualification,
  });
  requireRealBuildPrefix50Step44ProductionCaptureChain(productionChain);
  const authority = createRealBuildPrefix50Step44ProductionPromotionAuthority({
    result,
    batch,
    evidence,
    map,
    publicationComplete,
    productionChain,
    repositoryRoot: input.repositoryRoot,
    reviewRoot: input.layout.reviewRoot,
    rawInputRoot: input.rawInputRoot,
    capability: input.capability,
  });
  reassertRealBuildPrefix50Step44SourceLockCapability(input.capability);
  return authority;
}

export async function createRealBuildPrefix50Step44PersistedBlindPromotion(
  input: RealBuildPrefix50Step44BlindPromotionInput,
) {
  requireSourceLockedPromotionInput(input);
  const authority = await deriveRealBuildPrefix50Step44ProductionPromotionAuthority(input);
  return writeRealBuildPrefix50Step44PromotionArtifacts({
    promotionRoot: input.layout.promotionRoot,
    authority,
    capability: input.capability,
  });
}

/** Reopens an existing write-once promotion after freshly rederiving its full authority. */
export async function reopenRealBuildPrefix50Step44PersistedBlindPromotion(
  input: RealBuildPrefix50Step44BlindPromotionInput,
) {
  requireSourceLockedPromotionInput(input);
  const authority = await deriveRealBuildPrefix50Step44ProductionPromotionAuthority(input);
  return readRealBuildPrefix50Step44PersistedPromotionArtifacts(
    input.layout.promotionRoot,
    authority,
    input.capability,
  );
}

export async function createRealBuildPrefix50Step44BlindPromotionReceipt(
  input: RealBuildPrefix50Step44BlindPromotionInput,
): Promise<RealBuildPrefix50Step44BlindPromotionReceipt> {
  requireSourceLockedPromotionInput(input);
  const persisted = await createRealBuildPrefix50Step44PersistedBlindPromotion(input);
  requireRealBuildPrefix50Step44PersistedPromotion(persisted);
  return persisted.receipt;
}
