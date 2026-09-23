import { canonicalDigest, deepFreeze, documentStructuralHash } from "@lego-studio/brick-kernel";

import type {
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
  RealBuildPrefix50SubBuildReturnReviewRosterSummary,
} from "./real-build-prefix50-subbuild-return-contract";
import {
  REAL_BUILD_PREFIX50_STEP44_MAXIMUM_REVIEW_CANDIDATES,
  realBuildPrefix50SubBuildReturnReviewRosterSummaryCommitment,
} from "./real-build-prefix50-subbuild-return-review-batch";
import { constructRealBuildPrefix50Step44CompactReviewBatch } from "./real-build-prefix50-subbuild-return-review-batch-replay";
import { realBuildPrefix50SubBuildReturnReviewHarnessEnvelopeCommitment } from "./real-build-prefix50-subbuild-return-review-envelope";

const CANDIDATE_KEY = /^[0-9a-f]{64}$/u;

export function constructRealBuildPrefix50ReviewHarnessEnvelope(
  result: RealBuildPrefix50SubBuildReturnResult,
  candidateKey: string,
): RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope {
  const candidates = result.enumeration.candidates.filter(
    (candidate) => candidate.candidateKey === candidateKey,
  );
  const descriptors = result.candidateRoster.filter(
    (descriptor) => descriptor.candidateKey === candidateKey,
  );
  const candidate = candidates[0];
  const descriptor = descriptors[0];
  if (
    result.candidateRoster.length === 0 ||
    result.candidateRoster.length !== result.enumeration.candidates.length ||
    result.enumeration.counts.accepted !== result.enumeration.candidates.length ||
    candidates.length !== 1 ||
    descriptors.length !== 1 ||
    candidate === undefined ||
    descriptor === undefined ||
    candidate.candidateKey !== descriptor.candidateKey ||
    !CANDIDATE_KEY.test(candidate.candidateKey) ||
    !candidate.validationReport.documentGloballyValid
  )
    throw new TypeError(
      "Prefix-50 Step 44 review envelope requires one exact candidate from a complete hard-valid return roster.",
    );
  const selectedDocumentHash = documentStructuralHash(candidate.hardValidDocument);
  if (candidate.validationReport.targetDocumentHash !== selectedDocumentHash)
    throw new TypeError(
      "Prefix-50 Step 44 review envelope candidate validation does not bind its exact returned document.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-subbuild-return-review-harness-input/2" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    returnResultCommitment: result.commitment,
    candidateRosterCommitment: result.candidateRosterCommitment,
    projectionCommitment: result.projectionCommitment,
    childSubBuildWindowCommitment: result.childSubBuildWindowCommitment,
    sourceMemberRowsCommitment: result.sourceMemberRowsCommitment,
    detachedStateCommitment: result.detachedStateCommitment,
    step42_43RepairCommitment: result.step42_43RepairCommitment,
    step43PredecessorCommitment: result.step43PredecessorCommitment,
    sourceDocumentHash: result.sourceDocumentHash,
    candidateKey: candidate.candidateKey,
    selectedDocumentHash,
    selectedDocumentCommitment: canonicalDigest(candidate.hardValidDocument),
    selectedDocument: candidate.hardValidDocument,
  };
  return deepFreeze({
    ...body,
    commitment: realBuildPrefix50SubBuildReturnReviewHarnessEnvelopeCommitment(body),
  });
}

export function constructRealBuildPrefix50ReviewRosterMaterials(
  result: RealBuildPrefix50SubBuildReturnResult,
): {
  rosterSummary: RealBuildPrefix50SubBuildReturnReviewRosterSummary;
  envelopes: readonly RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope[];
} {
  const candidateKeys = result.candidateRoster.map(({ candidateKey }) => candidateKey);
  if (
    candidateKeys.length === 0 ||
    candidateKeys.length > REAL_BUILD_PREFIX50_STEP44_MAXIMUM_REVIEW_CANDIDATES ||
    candidateKeys.length !== result.enumeration.candidates.length ||
    candidateKeys.length !== result.enumeration.counts.accepted ||
    new Set(candidateKeys).size !== candidateKeys.length
  )
    throw new TypeError(
      "Prefix-50 Step 44 review batch requires the complete, unique, bounded hard-valid candidate roster.",
    );
  const envelopes = candidateKeys.map((candidateKey) =>
    constructRealBuildPrefix50ReviewHarnessEnvelope(result, candidateKey),
  );
  const body = {
    schemaVersion: "lego.real-build-prefix50-subbuild-return-review-roster/1" as const,
    authority: "none" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    returnResultCommitment: result.commitment,
    candidateRosterCommitment: result.candidateRosterCommitment,
    sourceDocumentHash: result.sourceDocumentHash,
    enumerationComplete: true as const,
    candidateCount: envelopes.length,
    candidates: result.candidateRoster.map((descriptor, rosterIndex) => {
      const envelope = envelopes[rosterIndex]!;
      return {
        ...descriptor,
        rosterIndex,
        selectedDocumentHash: envelope.selectedDocumentHash,
        selectedDocumentCommitment: envelope.selectedDocumentCommitment,
        reviewHarnessEnvelopeCommitment: envelope.commitment,
      };
    }),
  };
  const rosterSummary = deepFreeze({
    ...body,
    commitment: realBuildPrefix50SubBuildReturnReviewRosterSummaryCommitment(body),
  });
  return { rosterSummary, envelopes };
}

function constructReviewBatchEnvelopeFromMaterials(
  result: RealBuildPrefix50SubBuildReturnResult,
  materials: ReturnType<typeof constructRealBuildPrefix50ReviewRosterMaterials>,
): RealBuildPrefix50SubBuildReturnReviewBatchEnvelope {
  const envelopeByCandidateKey = new Map(
    materials.envelopes.map((envelope) => [envelope.candidateKey, envelope] as const),
  );
  if (envelopeByCandidateKey.size !== materials.envelopes.length)
    throw new TypeError("Prefix-50 Step 44 review materials contain duplicate candidate keys.");
  return constructRealBuildPrefix50Step44CompactReviewBatch({
    result,
    rosterSummary: materials.rosterSummary,
    envelopeForCandidateKey: (candidateKey) => {
      const envelope = envelopeByCandidateKey.get(candidateKey);
      if (envelope === undefined)
        throw new TypeError(`Prefix-50 Step 44 review materials omit candidate ${candidateKey}.`);
      return envelope;
    },
  });
}

export function constructRealBuildPrefix50ReviewExportMaterials(
  result: RealBuildPrefix50SubBuildReturnResult,
) {
  const materials = constructRealBuildPrefix50ReviewRosterMaterials(result);
  return deepFreeze({
    result,
    rosterSummary: materials.rosterSummary,
    reviewBatch: constructReviewBatchEnvelopeFromMaterials(result, materials),
  });
}
