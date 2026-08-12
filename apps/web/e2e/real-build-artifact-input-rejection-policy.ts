interface CurrentArtifactReplayBoundary {
  readonly replayLevel: "downstream-only" | "metadata-only";
  readonly earliestBoundary: "browser-output" | "input-rejection";
}

/**
 * Metadata-only closures retain no typed, digest-bound witness from which Node can reproduce the
 * preparation, coverage, preflight, or renderer-compatibility refusal. Until such evidence exists,
 * neither writing nor verifying an artifact manifest may turn a caller-authored failure into a claim.
 */
export function assertCurrentArtifactReplayBoundaryVerifiable(
  boundary: CurrentArtifactReplayBoundary,
  operation: "publish" | "verify",
): void {
  if (boundary.replayLevel === "metadata-only" || boundary.earliestBoundary === "input-rejection") {
    throw new TypeError(
      `Current artifact ${operation} refuses metadata-only input rejection: the replay closure retains ` +
        `no typed digest-bound rejection evidence from which Node can reproduce the exact refusal and score.`,
    );
  }
}
