import {
  canonicalDigest,
  canonicalStringify,
  deepFreeze,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { relative, resolve } from "node:path";

import type {
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import type { RealBuildPrefix50Step44WithheldUnblindingMap } from "./real-build-prefix50-subbuild-return-review-blind.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import {
  type RealBuildPrefix50Step44PersistedPromotionEvidence,
  requireRealBuildPrefix50Step44PersistedPromotionEvidence,
} from "./real-build-prefix50-subbuild-return-review-blind-persisted.ts";
import type { RealBuildPrefix50Step44BlindPromotionReceiptBody } from "./real-build-prefix50-subbuild-return-review-blind-promotion-artifacts.ts";
import {
  type RealBuildPrefix50Step44ProductionCaptureChainVerification,
  requireRealBuildPrefix50Step44ProductionCaptureChain,
} from "./real-build-prefix50-subbuild-return-review-blind-production-chain.ts";
import {
  type RealBuildPrefix50Step44PublicationComplete,
  requireRealBuildPrefix50Step44PublicationComplete,
} from "./real-build-prefix50-subbuild-return-review-blind-publication-complete.ts";
import { requireRealBuildPrefix50Step44PhysicalPage45Verification } from "./real-build-prefix50-subbuild-return-review-blind-provenance.ts";
import { requireRealBuildPrefix50Step44PersistedUnblindingMap } from "./real-build-prefix50-subbuild-return-review-blind-unblinding.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { hydrateRealBuildPrefix50Step44ReviewEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-replay.ts";
import { requireRealBuildPrefix50SubBuildReturnResult } from "./real-build-prefix50-subbuild-return.ts";
import { REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE } from "./real-build-prefix50-subbuild-return-review-source-locked-production.ts";
import {
  reassertRealBuildPrefix50Step44SourceLockCapability,
  requireRealBuildPrefix50Step44SourceLockCapability,
  type RealBuildPrefix50Step44SourceLockCapability,
} from "./real-build-prefix50-subbuild-return-review-source-lock.ts";
import { assertRealBuildPrefix50Step44CompleteLockedInputRoot } from "./real-build-prefix50-subbuild-return-review-source-locked-tree.ts";
import {
  acquireContainedDirectoryLiveGuard,
  isContainedDirectoryLiveGuardName,
  reassertContainedDirectoryLiveGuard,
  releaseContainedDirectoryLiveGuard,
  type ContainedDirectoryLiveGuard,
} from "./contained-directory-live-guard.ts";

export const REAL_BUILD_PREFIX50_STEP44_PROCEDURAL_INDEPENDENCE_STATEMENT =
  "Two distinct lane files and reviewer/session records coexist as procedural independence evidence; no cryptographic reviewer identity or authentication is claimed." as const;

export interface RealBuildPrefix50Step44ProductionPromotionAuthority {
  readonly receiptBody: RealBuildPrefix50Step44BlindPromotionReceiptBody;
  readonly selectedDocument: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope["selectedDocument"];
  readonly selectedEnvelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
}

interface ProductionAuthorityState {
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
  readonly repositoryRoot: string;
  readonly reviewRoot: string;
  readonly lockedRoots: readonly string[];
  readonly promotionRoot: string;
  readonly directoryGuard: ContainedDirectoryLiveGuard;
}

const productionAuthorities = new WeakMap<object, ProductionAuthorityState>();

function repositoryRelative(repositoryRoot: string, path: string, label: string): string {
  const value = relative(resolve(repositoryRoot), resolve(path)).replaceAll("\\", "/");
  if (value.length === 0 || value.startsWith("../"))
    throw new TypeError(`${label} escaped the source-locked repository.`);
  return value;
}

function requireFinalizationScope(input: {
  readonly repositoryRoot: string;
  readonly reviewRoot: string;
  readonly rawInputRoot: string;
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
}): Readonly<{
  binding: ReturnType<typeof requireRealBuildPrefix50Step44SourceLockCapability>;
  roots: readonly string[];
}> {
  const binding = requireRealBuildPrefix50Step44SourceLockCapability(input.capability);
  const expected = [
    binding.batchInput.path,
    repositoryRelative(input.repositoryRoot, input.rawInputRoot, "Step-44 raw review tree"),
    repositoryRelative(
      input.repositoryRoot,
      resolve(input.reviewRoot, "public"),
      "Step-44 captured public tree",
    ),
    repositoryRelative(
      input.repositoryRoot,
      resolve(input.reviewRoot, "withheld"),
      "Step-44 captured withheld tree",
    ),
    repositoryRelative(
      input.repositoryRoot,
      resolve(input.reviewRoot, REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE),
      "Step-44 production receipt",
    ),
  ].sort((left, right) => left.localeCompare(right));
  if (
    binding.operationInputRoots.length !== expected.length ||
    binding.operationInputRoots.some((root, index) => root !== expected[index])
  )
    throw new TypeError(
      "Step-44 promotion authority requires the exact batch, captured public/withheld trees, prior production receipt, and raw reviewer-input tree capability.",
    );
  return { binding, roots: expected };
}

function reassertLockedInputs(input: {
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
  readonly repositoryRoot: string;
  readonly lockedRoots: readonly string[];
}): void {
  reassertRealBuildPrefix50Step44SourceLockCapability(input.capability);
  for (const logicalRoot of input.lockedRoots)
    assertRealBuildPrefix50Step44CompleteLockedInputRoot({
      repositoryRoot: input.repositoryRoot,
      logicalRoot,
      label: `Step-44 promotion input ${logicalRoot}`,
      capability: input.capability,
    });
}

function reassertProductionAuthorityState(state: ProductionAuthorityState): void {
  reassertContainedDirectoryLiveGuard(state.directoryGuard, state.reviewRoot, "promotion");
  reassertLockedInputs(state);
  reassertContainedDirectoryLiveGuard(state.directoryGuard, state.reviewRoot, "promotion");
}

function mintProductionAuthority(input: {
  readonly authority: RealBuildPrefix50Step44ProductionPromotionAuthority;
  readonly state: Omit<ProductionAuthorityState, "directoryGuard" | "promotionRoot" | "reviewRoot">;
  readonly reviewRoot: string;
}): RealBuildPrefix50Step44ProductionPromotionAuthority {
  const authority = deepFreeze(input.authority);
  const directoryGuard = acquireContainedDirectoryLiveGuard(
    input.reviewRoot,
    "promotion",
    "Step-44 production promotion authority",
  );
  const authorityState: ProductionAuthorityState = {
    ...input.state,
    reviewRoot: resolve(input.reviewRoot),
    promotionRoot: resolve(input.reviewRoot, "promotion"),
    directoryGuard,
  };
  try {
    reassertProductionAuthorityState(authorityState);
    productionAuthorities.set(authority, authorityState);
    return authority;
  } catch (error) {
    const releaseFailure = releaseContainedDirectoryLiveGuard(directoryGuard);
    if (releaseFailure !== null)
      throw new AggregateError(
        [error, releaseFailure],
        "Step-44 promotion authority mint and directory-guard cleanup both failed.",
        { cause: error },
      );
    throw new Error(
      error instanceof Error ? error.message : "Step-44 promotion authority mint failed.",
      { cause: error },
    );
  }
}

export function createRealBuildPrefix50Step44ProductionPromotionAuthority(input: {
  readonly result: RealBuildPrefix50SubBuildReturnResult;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly evidence: RealBuildPrefix50Step44PersistedPromotionEvidence;
  readonly map: RealBuildPrefix50Step44WithheldUnblindingMap;
  readonly publicationComplete: RealBuildPrefix50Step44PublicationComplete;
  readonly productionChain: RealBuildPrefix50Step44ProductionCaptureChainVerification;
  readonly repositoryRoot?: string;
  readonly reviewRoot?: string;
  readonly rawInputRoot?: string;
  readonly capability?: RealBuildPrefix50Step44SourceLockCapability;
}): RealBuildPrefix50Step44ProductionPromotionAuthority {
  if (
    input.repositoryRoot === undefined ||
    input.reviewRoot === undefined ||
    input.rawInputRoot === undefined ||
    input.capability === undefined
  )
    throw new TypeError(
      "Step-44 production promotion authority requires the exact live finalization capability and locked input roots.",
    );
  const lockedInput = {
    repositoryRoot: input.repositoryRoot,
    reviewRoot: input.reviewRoot,
    rawInputRoot: input.rawInputRoot,
    capability: input.capability,
  };
  const scope = requireFinalizationScope(lockedInput);
  const sourceLock = scope.binding;
  const lockedState = {
    capability: lockedInput.capability,
    repositoryRoot: lockedInput.repositoryRoot,
    lockedRoots: scope.roots,
  };
  reassertLockedInputs(lockedState);
  const result = requireRealBuildPrefix50SubBuildReturnResult(input.result);
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.batch);
  requireRealBuildPrefix50Step44PersistedPromotionEvidence(input.evidence);
  requireRealBuildPrefix50Step44PhysicalPage45Verification(
    input.evidence.physicalPage45Verification,
  );
  requireRealBuildPrefix50Step44PublicationComplete(input.publicationComplete);
  requireRealBuildPrefix50Step44PersistedUnblindingMap({
    map: input.map,
    publicationComplete: input.publicationComplete,
    batch,
    withheldRoot: input.publicationComplete.publicationDirectories.withheld.lexicalPath,
  });
  requireRealBuildPrefix50Step44ProductionCaptureChain(input.productionChain);
  const closure = input.evidence.closure;
  if (closure.disposition.kind !== "selected-one")
    throw new TypeError("Step-44 refusal closure cannot mint production promotion authority.");
  const selectedBlindId = closure.disposition.blindId;
  const review = input.evidence.outcome.fullResolutionReviews.filter(
    ({ blindId }) => blindId === selectedBlindId,
  );
  const mapRows = input.map.rows.filter(({ blindId }) => blindId === selectedBlindId);
  const mapRow = mapRows[0];
  if (
    review.length !== 1 ||
    review[0]?.survives !== true ||
    review[0].criteria.length !== 6 ||
    review[0].criteria.some(({ outcome }) => outcome !== "same") ||
    mapRows.length !== 1 ||
    mapRow === undefined
  )
    throw new TypeError(
      "Step-44 production authority requires exactly one six-criterion survivor.",
    );
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
    throw new TypeError(
      "Step-44 production authority selected a candidate absent from its roster.",
    );
  const selectedEnvelope = hydrateRealBuildPrefix50Step44ReviewEnvelope(batch, compact);
  if (
    result.commitment !== batch.returnResultCommitment ||
    result.candidateRosterCommitment !== batch.candidateRosterCommitment ||
    result.sourceDocumentHash !== batch.sourceDocumentHash ||
    compact.candidateKey !== mapRow.candidateKey ||
    roster.candidateKey !== mapRow.candidateKey ||
    canonicalDigest(descriptor) !==
      canonicalDigest({
        candidateKey: roster.candidateKey,
        groupDelta: roster.groupDelta,
        crossPorts: roster.crossPorts,
      }) ||
    mapRow.selectedDocumentHash !== documentStructuralHash(candidate.hardValidDocument) ||
    mapRow.selectedDocumentCommitment !== canonicalDigest(candidate.hardValidDocument) ||
    !candidate.validationReport.documentGloballyValid ||
    candidate.validationReport.targetDocumentHash !== mapRow.selectedDocumentHash ||
    selectedEnvelope.commitment !== mapRow.reviewHarnessEnvelopeCommitment ||
    canonicalStringify(selectedEnvelope.selectedDocument) !==
      canonicalStringify(candidate.hardValidDocument) ||
    input.productionChain.publicationCompleteCommitment !== input.publicationComplete.commitment ||
    input.evidence.publicationComplete !== input.publicationComplete ||
    input.evidence.publicationComplete.commitment !== input.publicationComplete.commitment ||
    input.productionChain.withheldUnblindingMapCommitment !== input.map.commitment ||
    input.productionChain.publicHarnessSuccessCommitment !== input.evidence.publicSuccess.commitment
  )
    throw new TypeError(
      "Step-44 production authority does not bind the exact result, batch, map, envelope, and document.",
    );
  const receiptBody: RealBuildPrefix50Step44BlindPromotionReceiptBody = {
    schemaVersion: "lego.real-build-prefix50-step44-blind-return-promotion/3",
    authority: "repository-reviewed-step44",
    reviewStatus: "reviewed",
    selectionAuthority: "blind-page45-closure",
    fixturePromotionAuthority: true,
    sourceSetId: "6651557",
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    page45SourcePolicyCommitment: REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
    physicalPage45VerificationCommitment: input.evidence.physicalPage45Verification.commitment,
    productionCaptureChainCommitment: input.productionChain.commitment,
    publicationCompleteCommitment: input.publicationComplete.commitment,
    finalizationSourceLockCommitment: sourceLock.commitment,
    finalizationOperationInputsCommitment: sourceLock.operationInputsCommitment,
    proceduralIndependenceStatement: REAL_BUILD_PREFIX50_STEP44_PROCEDURAL_INDEPENDENCE_STATEMENT,
    selectedBlindId,
    candidateKey: mapRow.candidateKey,
    blindReviewPacketCommitment: input.evidence.packet.commitment,
    publicHarnessSuccessCommitment: input.evidence.publicSuccess.commitment,
    laneCommitments: closure.laneCommitments,
    fullResolutionOutcomeCommitment: input.evidence.outcome.commitment,
    blindReviewClosureCommitment: closure.commitment,
    publicPixelVerificationCommitment: closure.publicPixelVerificationCommitment,
    withheldUnblindingMapCommitment: input.map.commitment,
    selectedMapRowCommitment: mapRow.commitment,
    reviewBatchEnvelopeCommitment: batch.commitment,
    returnResultCommitment: result.commitment,
    candidateRosterCommitment: result.candidateRosterCommitment,
    candidateKeysCommitment: batch.candidateKeysCommitment,
    returnCandidateCommitment: canonicalDigest(candidate),
    rosterDescriptorCommitment: canonicalDigest(descriptor),
    reviewHarnessEnvelopeCommitment: mapRow.reviewHarnessEnvelopeCommitment,
    compactCandidateCommitment: mapRow.compactCandidateCommitment,
    captureManifestCommitment: mapRow.captureManifestCommitment,
    sourceRowCommitment: mapRow.sourceRowCommitment,
    selectedDocumentHash: mapRow.selectedDocumentHash,
    selectedDocumentCommitment: mapRow.selectedDocumentCommitment,
    allSixCriteriaSame: true,
  };
  return mintProductionAuthority({
    authority: {
      receiptBody,
      selectedDocument: candidate.hardValidDocument,
      selectedEnvelope,
    },
    state: lockedState,
    reviewRoot: lockedInput.reviewRoot,
  });
}

export function requireRealBuildPrefix50Step44ProductionPromotionAuthority(
  value: RealBuildPrefix50Step44ProductionPromotionAuthority,
  capability: RealBuildPrefix50Step44SourceLockCapability,
): void {
  requireRealBuildPrefix50Step44SourceLockCapability(capability);
  if (productionAuthorities.get(value)?.capability !== capability)
    throw new TypeError(
      "Step-44 artifact publication requires production authority branded for this exact live source-lock capability.",
    );
}

export function reassertRealBuildPrefix50Step44ProductionPromotionAuthority(
  value: RealBuildPrefix50Step44ProductionPromotionAuthority,
  capability: RealBuildPrefix50Step44SourceLockCapability,
  promotionRoot: string,
): void {
  requireRealBuildPrefix50Step44ProductionPromotionAuthority(value, capability);
  const state = productionAuthorities.get(value);
  if (state === undefined)
    throw new TypeError("Step-44 production promotion authority state is unavailable.");
  if (
    resolve(promotionRoot).toLocaleLowerCase("en-US") !==
    state.promotionRoot.toLocaleLowerCase("en-US")
  )
    throw new TypeError(
      `Step-44 production promotion authority belongs to ${state.promotionRoot}, not ${resolve(promotionRoot)}.`,
    );
  reassertProductionAuthorityState(state);
}

export function isRealBuildPrefix50Step44ProductionPromotionAuthorityGuardName(
  value: RealBuildPrefix50Step44ProductionPromotionAuthority,
  capability: RealBuildPrefix50Step44SourceLockCapability,
  name: string,
): boolean {
  requireRealBuildPrefix50Step44ProductionPromotionAuthority(value, capability);
  const state = productionAuthorities.get(value);
  if (state === undefined)
    throw new TypeError("Step-44 production promotion authority state is unavailable.");
  return isContainedDirectoryLiveGuardName(state.directoryGuard, name);
}

export function releaseRealBuildPrefix50Step44ProductionPromotionAuthority(
  value: RealBuildPrefix50Step44ProductionPromotionAuthority,
  capability: RealBuildPrefix50Step44SourceLockCapability,
): Error | null {
  requireRealBuildPrefix50Step44ProductionPromotionAuthority(value, capability);
  const state = productionAuthorities.get(value);
  if (state === undefined)
    return new TypeError("Step-44 production promotion authority state is unavailable.");
  return releaseContainedDirectoryLiveGuard(state.directoryGuard);
}
