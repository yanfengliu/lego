import { canonicalDigest } from "@lego-studio/brick-kernel";

import type {
  RealBuildPrefix50SubBuildReturnCompactReviewCandidate,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt,
  RealBuildPrefix50SubBuildReturnReviewRosterSummary,
} from "./real-build-prefix50-subbuild-return-contract.ts";

export const REAL_BUILD_PREFIX50_STEP44_MAXIMUM_REVIEW_CANDIDATES = 512;
export const REAL_BUILD_PREFIX50_STEP44_REVIEW_CANDIDATE_COUNT = 211;

export function realBuildPrefix50SubBuildReturnReviewBatchEnvelopeCommitment(
  envelope: Omit<RealBuildPrefix50SubBuildReturnReviewBatchEnvelope, "commitment">,
): `sha256:${string}` {
  return canonicalDigest(envelope);
}

export function realBuildPrefix50SubBuildReturnReviewRosterSummaryCommitment(
  summary: Omit<RealBuildPrefix50SubBuildReturnReviewRosterSummary, "commitment">,
): `sha256:${string}` {
  return canonicalDigest(summary);
}

export function realBuildPrefix50SubBuildReturnReviewEnumerationReceiptCommitment(
  receipt: Omit<RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt, "commitment">,
): `sha256:${string}` {
  return canonicalDigest(receipt);
}

export function realBuildPrefix50SubBuildReturnCompactReviewCandidateCommitment(
  candidate: Omit<RealBuildPrefix50SubBuildReturnCompactReviewCandidate, "commitment">,
): `sha256:${string}` {
  return canonicalDigest(candidate);
}
