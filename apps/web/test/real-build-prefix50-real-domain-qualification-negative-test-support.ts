import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";

/**
 * Structural negative only. Production qualification checks must reject this object because it is
 * deliberately absent from the verifier-owned runtime brand set.
 */
export function createUnbrandedRealDomainQualificationForNegativeTest(
  reviewBatchEnvelopeCommitment: Sha256Digest,
): RealBuildPrefix50Step44RealDomainQualificationBinding {
  const digest = (label: string) =>
    canonicalDigest({ unbrandedNegativeQualification: label, reviewBatchEnvelopeCommitment });
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-real-domain-qualification-binding/1" as const,
    qualificationOutputRealPathCommitment: digest("output"),
    reviewBatchEnvelopeCommitment,
    sourceLockCommitment: digest("source-lock"),
    calibrationSessionCommitment: digest("calibration-session"),
    calibrationReceiptCommitment: digest("calibration-receipt"),
    heldOutReceiptCommitment: digest("heldout-receipt"),
    persistedManifestCommitment: digest("manifest"),
    qualificationProofCommitment: digest("proof"),
    popplerToolchainCommitment: digest("poppler-toolchain"),
  };
  return Object.freeze({ ...body, commitment: canonicalDigest(body) });
}
