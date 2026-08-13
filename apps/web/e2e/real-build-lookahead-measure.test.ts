import { describe, expect, it } from "vitest";

import { classifyRealBuildLookaheadMeasure } from "./real-build-lookahead-measure";

describe("the deferred lookahead measure classifier", () => {
  it("uses containment for present highlight evidence with no non-stroke fill", () => {
    const classified = classifyRealBuildLookaheadMeasure({
      mask: new Uint8Array([0, 0, 0, 0]),
      strokeMask: new Uint8Array([1, 1, 0, 0]),
      regions: [{ leaked: true }],
      keyedPx: 2,
    });

    expect(classified).toMatchObject({
      measure: "containment",
      hasHighlightEvidence: true,
      keyedPx: 2,
      regionCount: 1,
      strokePx: 2,
      fillPx: 0,
    });
  });

  it("uses IoU when a closed highlight has non-stroke fill", () => {
    const classified = classifyRealBuildLookaheadMeasure({
      mask: new Uint8Array([1, 1, 1, 0]),
      strokeMask: new Uint8Array([1, 0, 1, 0]),
      regions: [{ leaked: false }],
      keyedPx: 2,
    });

    expect(classified).toMatchObject({
      measure: "iou",
      hasHighlightEvidence: true,
      strokePx: 2,
      fillPx: 1,
    });
  });

  it("uses IoU without traversing masks when highlight evidence is absent", () => {
    const refusingMask = new Proxy(new Uint8Array(0), {
      get() {
        throw new Error("absent evidence must not inspect masks");
      },
    });
    const classified = classifyRealBuildLookaheadMeasure({
      mask: refusingMask,
      strokeMask: refusingMask,
      regions: [],
      keyedPx: 0,
    });

    expect(classified).toMatchObject({
      measure: "iou",
      hasHighlightEvidence: false,
      strokePx: null,
      fillPx: null,
    });
  });
});
