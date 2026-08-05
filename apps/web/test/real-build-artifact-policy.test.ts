import { describe, expect, it } from "vitest";

import {
  MAXIMUM_REAL_BUILD_PRINTED_STEPS,
  MAXIMUM_RETAINED_ARTIFACTS,
  validateRealBuildArtifactFilePlan,
} from "../e2e/real-build-artifacts";
import {
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
  servedResponseChunkName,
} from "../e2e/real-build-served-response-policy";

describe("real-build retained artifact live-shape policy", () => {
  it("admits every panel/build capture at 359 steps and refuses one extra artifact", () => {
    const exactLiveShape = [
      ...Array.from({ length: MAXIMUM_REAL_BUILD_PRINTED_STEPS }, (_, index) => {
        const tag = String(index + 1).padStart(3, "0");
        return [`step-${tag}-panel.png`, `step-${tag}-build.png`];
      }).flat(),
      ...Array.from({ length: 4 }, (_, index) => servedResponseChunkName(index)),
      REAL_BUILD_SERVED_RESPONSE_MANIFEST,
      "document.json",
      "score.json",
    ];

    expect(exactLiveShape).toHaveLength(MAXIMUM_RETAINED_ARTIFACTS);
    expect(validateRealBuildArtifactFilePlan(exactLiveShape)).toHaveLength(
      MAXIMUM_RETAINED_ARTIFACTS,
    );
    expect(() =>
      validateRealBuildArtifactFilePlan([...exactLiveShape, "step-360-panel.png"]),
    ).toThrow(/359-step live-shape maximum/u);
  });
});
