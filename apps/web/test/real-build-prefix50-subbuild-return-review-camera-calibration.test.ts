import { canonicalDigest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  deriveRealBuildPrefix50Step44InteriorFeatureCalibration,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_EXPECTED_COMMITMENT,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-calibration.ts";

describe("Step-44 semantic metric-v2 preregistration", () => {
  it("reproduces fixed synthetic controls without reading PDF, parent, branches, or v3", () => {
    const first = REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION;
    const second = deriveRealBuildPrefix50Step44InteriorFeatureCalibration();
    const { commitment, ...body } = first;

    expect(second).toEqual(first);
    expect(commitment).toBe(canonicalDigest(body));
    expect(commitment).toBe(
      REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_EXPECTED_COMMITMENT,
    );
    expect(first.controls.map(({ id }) => id)).toEqual([
      "exact-positive",
      "shift-beyond-radius",
      "semantic-flood",
      "gray-negative",
    ]);
    expect(first.controls[0]!.f1).toBe(1);
    expect(first.controls[3]!.f1).toBe(0);
    expect(first.strongestNegativeF1).toBe(
      Math.max(...first.controls.slice(1).map(({ f1 }) => f1)),
    );
    expect(first.derivedThresholds.minimumBlueCyanF1).toBe((1 + first.strongestNegativeF1) / 2);
    expect(first.derivedThresholds.minimumExpectedFaceBlueCyanF1Margin).toBe(
      first.positiveNegativeSeparation / 2,
    );
  });
});
