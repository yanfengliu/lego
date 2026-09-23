import { describe, expect, it } from "vitest";

import { verifyRealBuildPrefix50Step44CameraAttemptDecisionSemantics } from "../e2e/real-build-prefix50-subbuild-return-review-camera-attempt-verifier-decisions.ts";
import { deriveRealBuildPrefix50Step44GeometrySelection } from "../e2e/real-build-prefix50-subbuild-return-review-camera-search-decisions.ts";
import {
  branchFace,
  stableBranchKeys,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-search-primitives.ts";

const ROSTER_ERROR = /exact stable 16-row branch roster and eight expected-face rows/u;

describe("Step-44 camera decision roster authority", () => {
  it("locally rejects the two-row roster that vacuous every checks accepted", () => {
    const twoRows = stableBranchKeys()
      .slice(0, 2)
      .map((branchKey, branchIndex) => ({
        branchIndex,
        branchKey,
        branchFace: branchFace(branchKey),
      }));
    expect(() =>
      deriveRealBuildPrefix50Step44GeometrySelection(twoRows as never, "studs-up"),
    ).toThrow(ROSTER_ERROR);
    expect(() =>
      verifyRealBuildPrefix50Step44CameraAttemptDecisionSemantics({
        attempt: {} as never,
        rows: twoRows as never,
        expectedPanelFace: "studs-up",
        featureSourceCommitment: `sha256:${"0".repeat(64)}`,
        sourceEligibleMaskDigest: `sha256:${"1".repeat(64)}`,
        parentOnlyTargetMaskDigest: `sha256:${"2".repeat(64)}`,
        artifactCount: 0,
        beautyRestorationPassed: true,
      }),
    ).toThrow(ROSTER_ERROR);
  });

  it("rejects a 16-row roster whose persisted face does not follow its stable key", () => {
    const rows = stableBranchKeys().map((branchKey, branchIndex) => ({
      branchIndex,
      branchKey,
      branchFace: branchIndex === 0 ? ("underside" as const) : branchFace(branchKey),
    }));
    expect(() => deriveRealBuildPrefix50Step44GeometrySelection(rows as never, "studs-up")).toThrow(
      ROSTER_ERROR,
    );
  });
});
