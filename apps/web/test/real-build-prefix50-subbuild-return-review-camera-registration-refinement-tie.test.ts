import { describe, expect, it } from "vitest";

import { searchRealBuildPrefix50EligibleMaskSimilarity } from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration.ts";
import {
  buildRealBuildPrefix50ExactRowSpanIndex,
  compareRealBuildPrefix50ExactWarpRuns,
  measureRealBuildPrefix50ExactRowSpanAgreement,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration-runs.ts";

function mask(runs: readonly (readonly [number, number])[]) {
  const raster = { width: 120, height: 1, mask: new Uint8Array(120) };
  for (const [start, stop] of runs) for (let x = start; x < stop; x += 1) raster.mask[x] = 1;
  return raster;
}

describe("eligible-mask refinement-only equivalent components", () => {
  it("refuses an exact-equivalent refinement seed at the lower scale wall", () => {
    const targetRuns = [
      [20, 24],
      [52, 56],
    ] as const;
    const source = mask([...targetRuns, [38, 46], [102, 110]]);
    const target = mask(targetRuns);
    const eligible = mask(targetRuns);
    const index = buildRealBuildPrefix50ExactRowSpanIndex({
      source,
      target,
      eligible,
      maximumScale: 1.5,
    });
    const identity = measureRealBuildPrefix50ExactRowSpanAgreement({
      transform: { scale: 1, offsetXPx: 0, offsetYPx: 0 },
      index,
      retainEligibleWarpRuns: true,
    });
    const refinementWall = measureRealBuildPrefix50ExactRowSpanAgreement({
      transform: { scale: 0.5, offsetXPx: 1, offsetYPx: 0 },
      index,
      retainEligibleWarpRuns: true,
    });
    expect(identity.agreement).toMatchObject({ intersection: 8, union: 8 });
    expect(refinementWall.agreement).toMatchObject({ intersection: 8, union: 8 });
    expect(identity.agreement.warpedUnclipped - identity.agreement.warpedInRaster).toBe(0);
    expect(refinementWall.agreement.warpedUnclipped - refinementWall.agreement.warpedInRaster).toBe(
      0,
    );
    expect(Array.from(identity.eligibleWarpRuns!)).toEqual([0, 20, 24, 0, 52, 56]);
    expect(
      compareRealBuildPrefix50ExactWarpRuns(
        identity.eligibleWarpRuns!,
        refinementWall.eligibleWarpRuns!,
      ),
    ).toMatchObject({ equal: true });

    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target,
      eligibleTarget: eligible,
    });
    expect(result, JSON.stringify(result)).toMatchObject({
      status: "refused",
      reason: "search-boundary-hit",
      diagnostics: {
        coarseDomainComplete: true,
        coarseObjectiveTiesExpected: 2,
        coarseObjectiveTiesClassified: 2,
        coarseObjectiveTieClassificationComplete: true,
        coarseObjectiveTieScaleBoundaryHit: false,
        coarseEquivalentRasterSeeds: 2,
        exactObjectiveTieClassificationComplete: true,
        scaleBoundaryHit: true,
        localFinalCellContainmentComplete: false,
      },
    });
    expect(result.diagnostics.exactObjectiveTiesExpected).toBeGreaterThan(2);
    expect(result.diagnostics.exactObjectiveTiesClassified).toBe(
      result.diagnostics.exactObjectiveTiesExpected,
    );
    expect(result.diagnostics.exactEquivalentRasterSeeds).toBeGreaterThan(2);
  });
});
