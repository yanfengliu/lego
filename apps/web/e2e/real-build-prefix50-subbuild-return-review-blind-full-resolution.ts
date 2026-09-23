import { canonicalStringify } from "@lego-studio/brick-kernel";

import { createRealBuildPrefix50Step44FullResolutionOutcome } from "./real-build-prefix50-subbuild-return-review-blind.ts";
import type {
  RealBuildPrefix50Step44BlindDispositionLane,
  RealBuildPrefix50Step44BlindReviewPacket,
  RealBuildPrefix50Step44FullResolutionOutcome,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";

export function requireRealBuildPrefix50Step44FullResolutionOutcome(
  packet: RealBuildPrefix50Step44BlindReviewPacket,
  lanes: readonly [
    RealBuildPrefix50Step44BlindDispositionLane,
    RealBuildPrefix50Step44BlindDispositionLane,
  ],
  outcome: RealBuildPrefix50Step44FullResolutionOutcome,
): void {
  const rebuilt = createRealBuildPrefix50Step44FullResolutionOutcome({
    packet,
    lanes,
    fullResolutionReviews: outcome.fullResolutionReviews.map((row) => ({
      blindId: row.blindId,
      reviewedCellCommitments: row.reviewedCellCommitments,
      reviewedFixedCameraEvidenceCommitment: row.reviewedFixedCameraEvidenceCommitment,
      criteria: row.criteria.map(({ criterionId, outcome: value, note }) => ({
        criterionId,
        outcome: value,
        note,
      })),
      survives: row.survives,
      note: row.note,
    })),
    disposition: outcome.disposition,
  });
  if (canonicalStringify(rebuilt) !== canonicalStringify(outcome))
    throw new TypeError(
      "Step-44 full-resolution outcome must be the exact canonical page-45-only closure input.",
    );
}
