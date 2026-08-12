import { describe, expect, it } from "vitest";

import { MAXIMUM_REAL_BUILD_FARTHER_CAPTURES } from "../e2e/real-build-browser-output";
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
  it("admits every bounded step and farther capture at 359 steps and refuses one extra", () => {
    const exactLiveShape = [
      ...Array.from({ length: MAXIMUM_REAL_BUILD_PRINTED_STEPS }, (_, index) => {
        const tag = String(index + 1).padStart(3, "0");
        const fartherPanel = String(Math.min(index + 2, MAXIMUM_REAL_BUILD_PRINTED_STEPS)).padStart(
          3,
          "0",
        );
        return [
          `step-${tag}-panel.png`,
          `step-${tag}-build.png`,
          ...(index + 1 === MAXIMUM_REAL_BUILD_PRINTED_STEPS
            ? []
            : Array.from(
                { length: MAXIMUM_REAL_BUILD_FARTHER_CAPTURES },
                (_, captureId) =>
                  `step-${tag}-farther-${String(captureId).padStart(2, "0")}-candidate-render-` +
                  `panel-${fartherPanel}.png`,
              )),
        ];
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

  it("refuses a second filename for one farther capture ordinal", () => {
    expect(() =>
      validateRealBuildArtifactFilePlan([
        "step-005-farther-00-source-panel-panel-006.png",
        "step-005-farther-00-candidate-render-panel-006.png",
      ]),
    ).toThrow(/repeats farther capture ordinal 0/u);
  });
});
