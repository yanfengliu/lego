import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  deriveRealBuildPrefix50Step44SharedOrientationAnchor,
  SharedOrientationAnchorRefusal,
  type SharedOrientationAnchor,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-lattice.ts";
import { REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";

export function deriveRegisteredRealBuildPrefix50Step44SourceAnchor(
  inputs: readonly [Uint8Array, Uint8Array],
): SharedOrientationAnchor {
  const registered: Readonly<{
    status: string;
    failureCommitment: Sha256Digest | null;
    replacementRequirement: string;
    anchorCommitment: Sha256Digest | null;
    latticeFitCommitment: Sha256Digest | null;
    refusalTelemetryCommitment: Sha256Digest;
    refusalTelemetrySummary: Readonly<{
      step42CandidateCount: number;
      step42SolutionCandidateCount: number;
      qualifiedPairCount: number;
      rejections: Readonly<Record<string, number>>;
      accountingComplete: true;
    }>;
  }> = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sharedOrientationAnchor;
  let anchor: SharedOrientationAnchor;
  try {
    anchor = deriveRealBuildPrefix50Step44SharedOrientationAnchor(inputs);
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    const refusalTelemetryCommitment =
      error instanceof SharedOrientationAnchorRefusal ? canonicalDigest(error.telemetry) : null;
    const refusalTelemetrySummary =
      error instanceof SharedOrientationAnchorRefusal
        ? {
            step42CandidateCount: error.telemetry.step42CandidateCount,
            step42SolutionCandidateCount: error.telemetry.step42SolutionCandidateCount,
            qualifiedPairCount: error.telemetry.qualifiedPairCount,
            rejections: error.telemetry.rejections,
            accountingComplete: error.telemetry.accountingComplete,
          }
        : null;
    if (
      registered.status !== "refused-by-corrected-production-masks" ||
      canonicalDigest({ failure }) !== registered.failureCommitment ||
      refusalTelemetryCommitment !== registered.refusalTelemetryCommitment ||
      canonicalDigest(refusalTelemetrySummary) !==
        canonicalDigest(registered.refusalTelemetrySummary)
    )
      throw new TypeError(
        `Corrected Steps-41/42 source masks produced an unregistered orientation-anchor failure: ${failure}; telemetry=${refusalTelemetryCommitment ?? "unavailable"}${error instanceof SharedOrientationAnchorRefusal ? ` ${JSON.stringify(error.telemetry)}` : ""}`,
        { cause: error },
      );
    throw new TypeError(
      `Corrected Steps-41/42 source masks reproduce the registered zero-qualified-pair orientation-anchor refusal; ${registered.replacementRequirement} must replace the obsolete anchor before source qualification.`,
      { cause: error },
    );
  }
  if (
    registered.status !== "qualified" ||
    registered.anchorCommitment === null ||
    registered.latticeFitCommitment === null ||
    anchor.commitment !== registered.anchorCommitment ||
    anchor.latticeFitCommitment !== registered.latticeFitCommitment
  )
    throw new TypeError(
      `Steps-41/42 shared source-only orientation anchor drifted from its registered state: anchor=${anchor.commitment}; lattice=${anchor.latticeFitCommitment}; corroboration=${JSON.stringify(anchor.corroboration)}; pooled=${anchor.pooledCounterevidenceFailure ?? "none"}.`,
    );
  return anchor;
}
