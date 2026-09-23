import { canonicalDigest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";

export function realBuildPrefix50SubBuildReturnReviewHarnessEnvelopeCommitment(
  envelope: Omit<RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope, "commitment">,
): `sha256:${string}` {
  return canonicalDigest(envelope);
}
