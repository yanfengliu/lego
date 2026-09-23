import { describe, expect, it } from "vitest";

import { searchRealBuildPrefix50EligibleMaskSimilarity } from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration.ts";

function mask(foreground: readonly number[]) {
  return {
    width: 90,
    height: 1,
    mask: Uint8Array.from({ length: 90 }, (_, x) => (foreground.includes(x) ? 1 : 0)),
  };
}

function search(maximumFullResolutionCandidates?: number) {
  return searchRealBuildPrefix50EligibleMaskSimilarity({
    source: mask([10, 42, 20, 84]),
    target: mask([10, 42]),
    eligibleTarget: mask([10, 42]),
    ...(maximumFullResolutionCandidates === undefined
      ? {}
      : { options: { maximumFullResolutionCandidates } }),
  });
}

describe("eligible-mask exact-tie work bounds", () => {
  it("fails closed when a preregistered exact cap cannot classify every cached objective tie", () => {
    const baseline = search();
    const incomplete = search(4_096);
    expect(baseline.diagnostics.exactObjectiveTieClassificationComplete).toBe(true);
    expect(incomplete.diagnostics.exactObjectiveTiesExpected).toBeGreaterThan(
      incomplete.diagnostics.exactObjectiveTiesClassified,
    );
    expect(incomplete).toMatchObject({
      status: "refused",
      diagnostics: {
        coarseDomainComplete: true,
        exactObjectiveTieClassificationComplete: false,
        localFinalCellContainmentComplete: false,
      },
    });
  });
});
