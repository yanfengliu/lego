import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

interface CalibrationCaseIdentity {
  readonly panelStep: number;
  readonly splitRole: string;
  readonly commitment: Sha256Digest;
}

interface SourceSequenceShape {
  readonly calibrationCases: readonly CalibrationCaseIdentity[];
  readonly sourceLockCommitment: Sha256Digest;
  readonly pageRasterCommitment: Sha256Digest;
  readonly sharedOrientationAnchorCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

interface SourceSequencePrivateShape {
  readonly calibrationRasterCommitment: Sha256Digest;
  readonly sourceLockCommitment: Sha256Digest;
  readonly calibrationCasesCommitment: Sha256Digest;
  readonly calibrationCaseIdentities: readonly [object, object];
  readonly sharedOrientationAnchorCommitment: Sha256Digest;
}

export function deriveRealBuildPrefix50Step44SourceSequenceCommitment(
  value: Omit<SourceSequenceShape, "commitment">,
): Sha256Digest {
  return canonicalDigest({
    schemaVersion: "lego.real-build-prefix50-step44-real-domain-source-sequence-commitment/1",
    calibrationCaseCommitments: value.calibrationCases.map(({ commitment }) => commitment),
    sourceLockCommitment: value.sourceLockCommitment,
    pageRasterCommitment: value.pageRasterCommitment,
    sharedOrientationAnchorCommitment: value.sharedOrientationAnchorCommitment,
  });
}

export function requireRealBuildPrefix50Step44SourceSequenceStructure(input: {
  readonly value: SourceSequenceShape;
  readonly state: SourceSequencePrivateShape;
  readonly verifiedCases: readonly CalibrationCaseIdentity[];
}): void {
  const { value, state, verifiedCases } = input;
  if (
    !Object.isFrozen(value) ||
    !Object.isFrozen(value.calibrationCases) ||
    value.calibrationCases.length !== 2 ||
    verifiedCases[0]?.panelStep !== 41 ||
    verifiedCases[0]?.splitRole !== "calibration" ||
    verifiedCases[1]?.panelStep !== 42 ||
    verifiedCases[1]?.splitRole !== "calibration" ||
    state.calibrationCaseIdentities[0] !== value.calibrationCases[0] ||
    state.calibrationCaseIdentities[1] !== value.calibrationCases[1] ||
    state.calibrationCasesCommitment !==
      canonicalDigest(verifiedCases.map(({ commitment }) => commitment)) ||
    state.sourceLockCommitment !== value.sourceLockCommitment ||
    state.calibrationRasterCommitment !== value.pageRasterCommitment ||
    state.sharedOrientationAnchorCommitment !== value.sharedOrientationAnchorCommitment ||
    value.commitment !== deriveRealBuildPrefix50Step44SourceSequenceCommitment(value)
  )
    throw new TypeError("Real-domain camera source sequence changed after strict branding.");
}
