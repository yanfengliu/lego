import { describe, expect, it } from "vitest";

import {
  searchRealBuildPrefix50EligibleMaskSimilarity,
  type RealBuildPrefix50EligibleMaskRaster,
  type RealBuildPrefix50EligibleMaskSearchOptions,
  type RealBuildPrefix50EligibleMaskSimilarityTransform,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration";
import {
  materializeExactEligibleWarp,
  measureExactEligibleAgreement,
  measureSourceForegroundIndices,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration-pyramid.ts";
import {
  buildRealBuildPrefix50ExactRowSpanIndex,
  compareRealBuildPrefix50ExactWarpRuns,
  measureRealBuildPrefix50ExactRowSpanAgreement,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration-runs.ts";

const WIDTH = 96;
const HEIGHT = 72;
const SEARCH = {
  relativeScaleRadius: 0.3,
  initialCenterStepPx: 4,
  initialRelativeScaleStep: 0.04,
  finalCenterCellPx: 0.1,
  finalRelativeScaleCell: 0.0005,
  coarseStridePx: 4,
  maximumCandidates: 32_768,
} satisfies RealBuildPrefix50EligibleMaskSearchOptions;

function raster(width = WIDTH, height = HEIGHT): RealBuildPrefix50EligibleMaskRaster {
  return { width, height, mask: new Uint8Array(width * height) };
}

function fill(
  target: RealBuildPrefix50EligibleMaskRaster,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  for (let row = y; row < y + height; row += 1)
    for (let column = x; column < x + width; column += 1)
      if (row >= 0 && row < target.height && column >= 0 && column < target.width)
        target.mask[row * target.width + column] = 1;
}

function allEligible(width = WIDTH, height = HEIGHT): RealBuildPrefix50EligibleMaskRaster {
  return { width, height, mask: new Uint8Array(width * height).fill(1) };
}

function eligibleWithBox(
  input: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  rasterWidth = WIDTH,
  rasterHeight = HEIGHT,
): RealBuildPrefix50EligibleMaskRaster {
  const eligible = allEligible(rasterWidth, rasterHeight);
  for (let y = input.y; y < input.y + input.height; y += 1)
    for (let x = input.x; x < input.x + input.width; x += 1)
      eligible.mask[y * eligible.width + x] = 0;
  return eligible;
}

function asymmetricSource(): RealBuildPrefix50EligibleMaskRaster {
  const source = raster();
  fill(source, 8, 12, 34, 9);
  fill(source, 8, 21, 8, 25);
  fill(source, 28, 30, 17, 7);
  fill(source, 57, 45, 11, 15);
  fill(source, 69, 53, 13, 6);
  return source;
}

function warpThenApplyEligibility(
  source: RealBuildPrefix50EligibleMaskRaster,
  eligible: RealBuildPrefix50EligibleMaskRaster,
  transform: RealBuildPrefix50EligibleMaskSimilarityTransform,
): RealBuildPrefix50EligibleMaskRaster {
  const target = raster(source.width, source.height);
  const inverse = 1 / transform.scale;
  for (let y = 0; y < target.height; y += 1) {
    for (let x = 0; x < target.width; x += 1) {
      const at = y * target.width + x;
      if (eligible.mask[at] !== 1) continue;
      const sourceX = Math.round((x - transform.offsetXPx) * inverse);
      const sourceY = Math.round((y - transform.offsetYPx) * inverse);
      if (
        sourceX >= 0 &&
        sourceX < source.width &&
        sourceY >= 0 &&
        sourceY < source.height &&
        source.mask[sourceY * source.width + sourceX] === 1
      )
        target.mask[at] = 1;
    }
  }
  return target;
}

function expectResolution(
  result: ReturnType<typeof searchRealBuildPrefix50EligibleMaskSimilarity>,
) {
  expect(result.status, JSON.stringify(result)).toBe("locally-contained");
  expect(result.diagnostics).toMatchObject({
    objectiveScope: "complete-coarse-domain-plus-local-final-cell-containment",
    workAccountingScope: "conservative-raster-pixel-visits",
    coarseDomainComplete: true,
    coarseObjectiveTieClassificationComplete: true,
    exactObjectiveTieClassificationComplete: true,
    localNeighborOptimal: true,
    equivalenceComponentComplete: true,
    localFinalCellContainmentComplete: true,
    centerBoundaryHit: false,
    scaleBoundaryHit: false,
  });
  expect(result.diagnostics.finalCenterCellPx).toBeLessThanOrEqual(0.1);
  expect(result.diagnostics.finalRelativeScaleCell).toBeLessThanOrEqual(0.0005);
}

describe("eligible-mask direct-objective camera registration", () => {
  it("reproduces the previous per-pixel objective and exact eligible warp byte-for-byte", () => {
    const source = asymmetricSource();
    const eligible = eligibleWithBox({ x: 27, y: 15, width: 38, height: 31 });
    const target = warpThenApplyEligibility(source, eligible, {
      scale: 0.92,
      offsetXPx: -7,
      offsetYPx: 8,
    });
    const foreground = measureSourceForegroundIndices(source).indices;
    const index = buildRealBuildPrefix50ExactRowSpanIndex({
      source,
      target,
      eligible,
      maximumScale: 1.3,
    });
    for (const transform of [
      { scale: 0.76, offsetXPx: -19.7, offsetYPx: 13.2 },
      { scale: 0.92, offsetXPx: -7, offsetYPx: 8 },
      { scale: 1, offsetXPx: 0, offsetYPx: 0 },
      { scale: 1.19, offsetXPx: 17.4, offsetYPx: -11.8 },
    ]) {
      const previous = measureExactEligibleAgreement({
        transform,
        source,
        target,
        eligible,
        sourceForeground: foreground,
        targetForegroundCount: target.mask.reduce((count, value) => count + value, 0),
      });
      const measured = measureRealBuildPrefix50ExactRowSpanAgreement({
        transform,
        index,
        retainEligibleWarpRuns: true,
      });
      expect(measured.agreement).toEqual(previous.agreement);
      const previousWarp = materializeExactEligibleWarp({
        transform,
        source,
        eligible,
        sourceForeground: foreground,
      }).mask;
      const rowSpanWarp = new Uint8Array(WIDTH * HEIGHT);
      for (let run = 0; run < measured.eligibleWarpRuns!.length; run += 3) {
        const y = measured.eligibleWarpRuns![run]!;
        for (
          let x = measured.eligibleWarpRuns![run + 1]!;
          x < measured.eligibleWarpRuns![run + 2]!;
          x += 1
        )
          rowSpanWarp[y * WIDTH + x] = 1;
      }
      expect(rowSpanWarp).toEqual(previousWarp);
    }
    let state = 7;
    for (let sample = 0; sample < 100; sample += 1) {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      const scale = 0.7 + (state / 4_294_967_296) * 0.6;
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      const offsetXPx = -30 + (state / 4_294_967_296) * 60;
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      const offsetYPx = -25 + (state / 4_294_967_296) * 50;
      const transform = { scale, offsetXPx, offsetYPx };
      const previous = measureExactEligibleAgreement({
        transform,
        source,
        target,
        eligible,
        sourceForeground: foreground,
        targetForegroundCount: target.mask.reduce((count, value) => count + value, 0),
      });
      const measured = measureRealBuildPrefix50ExactRowSpanAgreement({
        transform,
        index,
        retainEligibleWarpRuns: false,
      });
      expect(measured.agreement).toEqual(previous.agreement);
    }
  });

  it("charges offscreen source pixels instead of rewarding a cropped false positive", () => {
    const source = raster(12, 5);
    fill(source, 0, 1, 2, 2);
    fill(source, 10, 1, 2, 2);
    const target = raster(12, 5);
    fill(target, 0, 1, 2, 2);
    const index = buildRealBuildPrefix50ExactRowSpanIndex({
      source,
      target,
      eligible: allEligible(12, 5),
      maximumScale: 1,
    });
    const measured = measureRealBuildPrefix50ExactRowSpanAgreement({
      transform: { scale: 1, offsetXPx: -10, offsetYPx: 0 },
      index,
      retainEligibleWarpRuns: false,
    }).agreement;
    const visibleOnlyUnion =
      measured.warpedEligible +
      target.mask.reduce((count, value) => count + value, 0) -
      measured.intersection;
    expect(measured.intersection / visibleOnlyUnion).toBe(1);
    expect(measured).toMatchObject({
      intersection: 4,
      union: 8,
      warpedEligible: 4,
      warpedInRaster: 4,
      warpedUnclipped: 8,
    });
    expect(measured.intersection / measured.union).toBe(0.5);
  });

  it("classifies every coarse optimum and refuses an equivalent raster at the lower scale wall", () => {
    const source = raster(90, 1);
    const target = raster(90, 1);
    const eligible = raster(90, 1);
    for (const x of [10, 42, 20, 84]) source.mask[x] = 1;
    for (const x of [10, 42]) {
      target.mask[x] = 1;
      eligible.mask[x] = 1;
    }
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
    const lowerWall = measureRealBuildPrefix50ExactRowSpanAgreement({
      transform: { scale: 0.5, offsetXPx: 0, offsetYPx: 0 },
      index,
      retainEligibleWarpRuns: true,
    });
    expect(identity.agreement).toEqual({
      intersection: 2,
      union: 2,
      warpedEligible: 2,
      warpedInRaster: 4,
      warpedUnclipped: 4,
    });
    expect(lowerWall.agreement).toEqual(identity.agreement);
    expect(Array.from(identity.eligibleWarpRuns!)).toEqual([0, 10, 11, 0, 42, 43]);
    expect(
      compareRealBuildPrefix50ExactWarpRuns(
        identity.eligibleWarpRuns!,
        lowerWall.eligibleWarpRuns!,
      ),
    ).toMatchObject({ equal: true });

    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target,
      eligibleTarget: eligible,
    });
    expect(result).toMatchObject({
      status: "refused",
      reason: "search-boundary-hit",
      diagnostics: {
        coarseDomainComplete: true,
        coarseObjectiveTiesExpected: 4,
        coarseObjectiveTiesClassified: 4,
        coarseObjectiveTieClassificationComplete: true,
        coarseObjectiveTieScaleBoundaryHit: true,
        coarseEquivalentRasterSeeds: 4,
        exactObjectiveTieClassificationComplete: true,
        scaleBoundaryHit: true,
        localFinalCellContainmentComplete: false,
      },
    });
    expect(result.diagnostics.coarseObjectiveTiesClassified).toBe(
      result.diagnostics.coarseObjectiveTiesExpected,
    );
  });

  it("keeps caller and analytic basins independent through exact comparison", () => {
    const source = raster();
    fill(source, 8, 10, 38, 1);
    fill(source, 8, 11, 1, 31);
    fill(source, 30, 18, 2, 24);
    fill(source, 47, 27, 27, 2);
    fill(source, 70, 29, 2, 25);
    fill(source, 55, 52, 17, 2);
    const eligible = eligibleWithBox({ x: 34, y: 20, width: 28, height: 26 });
    const target = warpThenApplyEligibility(source, eligible, {
      scale: 1.06,
      offsetXPx: -8,
      offsetYPx: 8,
    });
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target,
      eligibleTarget: eligible,
      options: { ...SEARCH, coarseStridePx: 8 },
    });
    expectResolution(result);
    const measured = result.diagnostics;
    expect(measured.basinsComparedAtFullResolution).toBe(true);
    expect(measured.analyticBasinInitialSampledIntersectionOverUnion).not.toBeNull();
    expect(measured.callerBasinFinalExactIntersectionOverUnion).not.toBeNull();
    expect(measured.analyticBasinFinalExactIntersectionOverUnion).not.toBeNull();
    expect(measured.analyticBasinFinalExactIntersectionOverUnion!).toBeGreaterThan(
      measured.callerBasinFinalExactIntersectionOverUnion!,
    );
    expect(measured.analyticBasinFinalExactTransform).not.toEqual(
      measured.callerBasinFinalExactTransform,
    );
  });
  it("recovers clipped shared geometry around a central child exclusion", () => {
    const source = asymmetricSource();
    const eligible = eligibleWithBox({ x: 27, y: 15, width: 38, height: 31 });
    const truth = { scale: 0.92, offsetXPx: -7, offsetYPx: 8 };
    const target = warpThenApplyEligibility(source, eligible, truth);
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target,
      eligibleTarget: eligible,
      options: SEARCH,
    });
    expectResolution(result);
    expect(
      result.diagnostics.predictedIntersectionOverUnion,
      JSON.stringify(result),
    ).toBeGreaterThan(0.98);
    if (result.status !== "locally-contained") throw new Error(result.reason);
    expect(result.transform.scale).toBeCloseTo(truth.scale, 2);
    expect(result.transform.offsetXPx).toBeCloseTo(truth.offsetXPx, 0);
    expect(result.transform.offsetYPx).toBeCloseTo(truth.offsetYPx, 0);
  });

  it("applies eligibility after warping and refuses an unbounded exact component", () => {
    const source = raster();
    fill(source, 28, 20, 7, 3);
    fill(source, 28, 23, 3, 8);
    fill(source, 33, 27, 5, 4);
    const eligible = eligibleWithBox({ x: 25, y: 17, width: 14, height: 15 });
    const truth = { scale: 1, offsetXPx: 13, offsetYPx: 4 };
    const target = warpThenApplyEligibility(source, eligible, truth);
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target,
      eligibleTarget: eligible,
      options: SEARCH,
    });
    expect(result, JSON.stringify(result)).toMatchObject({
      status: "refused",
      reason: "candidate-budget-exhausted",
      diagnostics: {
        equivalenceComponentComplete: false,
        localNeighborOptimal: false,
      },
    });
    expect(result.diagnostics.eligibleSourceSeedPixels).toBe(0);
    expect(result.diagnostics.analyticSeed).toBeNull();
    expect(result.diagnostics.predictedIntersectionOverUnion).toBeGreaterThan(0.98);
  });

  it("recovers held-out translations and scales without changing the final cells", () => {
    const source = asymmetricSource();
    const eligible = eligibleWithBox({ x: 31, y: 17, width: 29, height: 25 });
    for (const truth of [
      { scale: 0.91, offsetXPx: -9, offsetYPx: 6 },
      { scale: 1.08, offsetXPx: 8, offsetYPx: -5 },
      { scale: 0.97, offsetXPx: 11, offsetYPx: 9 },
    ]) {
      const result = searchRealBuildPrefix50EligibleMaskSimilarity({
        source,
        target: warpThenApplyEligibility(source, eligible, truth),
        eligibleTarget: eligible,
        options: SEARCH,
      });
      expectResolution(result);
      expect(
        result.diagnostics.predictedIntersectionOverUnion,
        JSON.stringify({ truth, result }),
      ).toBeGreaterThan(0.94);
    }
  });

  it("completes the preregistered overlap domain for the 360x120 LCG clipping adversary", () => {
    const width = 360;
    const height = 120;
    const shift = 210;
    const source = raster(width, height);
    const target = raster(width, height);
    const eligible = allEligible(width, height);
    let state = 1;
    const random = (): number => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state / 4_294_967_296;
    };
    const targetShape: [number, number][] = [];
    for (let y = 0; y < 18; y += 1)
      for (let x = 0; x < 18; x += 1) if (random() < 0.22) targetShape.push([x, y]);
    for (const [x, y] of targetShape) {
      source.mask[(35 + y) * width + 5 + x] = 1;
      target.mask[(35 + y) * width + 5 + x + shift] = 1;
    }
    for (let y = 0; y < 30; y += 1)
      for (let x = 0; x < 30; x += 1)
        if (random() < 0.32) source.mask[(25 + y) * width + 295 + x] = 1;

    const exactIndex = buildRealBuildPrefix50ExactRowSpanIndex({
      source,
      target,
      eligible,
      maximumScale: 1.5,
    });
    const known = measureRealBuildPrefix50ExactRowSpanAgreement({
      transform: { scale: 1, offsetXPx: shift, offsetYPx: 0 },
      index: exactIndex,
      retainEligibleWarpRuns: false,
    }).agreement;
    const knownVisibleOnlyUnion = known.warpedEligible + targetShape.length - known.intersection;
    expect(known.intersection / knownVisibleOnlyUnion).toBe(1);
    expect(known.warpedUnclipped - known.warpedInRaster).toBeGreaterThan(0);
    expect(known.intersection / known.union).toBeLessThan(1);

    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target,
      eligibleTarget: eligible,
    });
    expect(result.diagnostics).toMatchObject({
      coarseTranslationStepPx: 16,
      coarseRelativeScaleStep: 0.04,
      coarseDomainComplete: true,
      coarsePreflightPassed: true,
    });
    expect(result.diagnostics.coarseCandidatesExpected).toBeGreaterThan(0);
    expect(result.diagnostics.coarseCandidatesEvaluated).toBe(
      result.diagnostics.coarseCandidatesExpected,
    );
    expect(result.diagnostics.refinementStarts).toBeGreaterThan(0);
    expect(result.diagnostics.predictedIntersectionOverUnion).toBeLessThan(1);
    expect(result.diagnostics.predictedOffscreenPenaltyPixels).toBeGreaterThanOrEqual(0);

    const controlSource = raster(width, height);
    const controlTarget = raster(width, height);
    for (const [x, y] of targetShape) {
      controlSource.mask[(35 + y) * width + 5 + x] = 1;
      controlTarget.mask[(35 + y) * width + 5 + x + shift] = 1;
    }
    const control = searchRealBuildPrefix50EligibleMaskSimilarity({
      source: controlSource,
      target: controlTarget,
      eligibleTarget: eligible,
    });
    expectResolution(control);
    expect(control.diagnostics.predictedIntersectionOverUnion).toBe(1);
    if (control.status !== "locally-contained") throw new Error(control.reason);
    expect(control.transform.offsetXPx).toBeCloseTo(shift, 1);
  }, 30_000);
});
