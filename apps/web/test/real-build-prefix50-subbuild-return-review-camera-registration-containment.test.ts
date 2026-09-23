import { describe, expect, it } from "vitest";

import {
  searchRealBuildPrefix50EligibleMaskSimilarity,
  type RealBuildPrefix50EligibleMaskRaster,
  type RealBuildPrefix50EligibleMaskSearchOptions,
  type RealBuildPrefix50EligibleMaskSearchResult,
  type RealBuildPrefix50EligibleMaskSimilarityTransform,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration";
import { createRealBuildPrefix50EquivalentRasterClassifier } from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration-ties";

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
  input: { x: number; y: number; width: number; height: number },
  rasterWidth: number,
  rasterHeight: number,
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
  for (let y = 0; y < target.height; y += 1)
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
  return target;
}

function expectResolution(result: RealBuildPrefix50EligibleMaskSearchResult): void {
  expect(result, JSON.stringify(result)).toMatchObject({
    status: "locally-contained",
    diagnostics: {
      coarseDomainComplete: true,
      coarseObjectiveTieClassificationComplete: true,
      exactObjectiveTieClassificationComplete: true,
      localFinalCellContainmentComplete: true,
      centerBoundaryHit: false,
      scaleBoundaryHit: false,
    },
  });
}

describe("eligible-mask camera registration containment", () => {
  it("does not let translation and scale erase asymmetric reflection or 180-degree controls", () => {
    const source = asymmetricSource();
    const reflected = raster();
    const rotated = raster();
    for (let y = 0; y < HEIGHT; y += 1)
      for (let x = 0; x < WIDTH; x += 1) {
        reflected.mask[y * WIDTH + (WIDTH - 1 - x)] = source.mask[y * WIDTH + x]!;
        rotated.mask[(HEIGHT - 1 - y) * WIDTH + (WIDTH - 1 - x)] = source.mask[y * WIDTH + x]!;
      }
    const eligible = allEligible();
    const target = warpThenApplyEligibility(source, eligible, {
      scale: 0.94,
      offsetXPx: 7,
      offsetYPx: -5,
    });
    const results = [source, reflected, rotated].map((candidate) =>
      searchRealBuildPrefix50EligibleMaskSimilarity({
        source: candidate,
        target,
        eligibleTarget: eligible,
        options: { ...SEARCH, maximumCandidates: 32_768 },
      }),
    );
    expectResolution(results[0]!);
    const scores = results.map((result) => result.diagnostics.predictedIntersectionOverUnion);
    expect(scores[0]).toBeGreaterThan(scores[1]! + 0.1);
    expect(scores[0]).toBeGreaterThan(scores[2]! + 0.1);
  });

  it("refuses empty evidence and malformed non-finite search inputs", () => {
    const empty = raster();
    const source = asymmetricSource();
    const eligible = allEligible();
    expect(
      searchRealBuildPrefix50EligibleMaskSimilarity({
        source: empty,
        target: source,
        eligibleTarget: eligible,
      }),
    ).toMatchObject({ status: "refused", reason: "empty-source-mask" });
    expect(
      searchRealBuildPrefix50EligibleMaskSimilarity({
        source,
        target: empty,
        eligibleTarget: eligible,
      }),
    ).toMatchObject({ status: "refused", reason: "empty-target-mask" });
    expect(
      searchRealBuildPrefix50EligibleMaskSimilarity({
        source,
        target: source,
        eligibleTarget: empty,
      }),
    ).toMatchObject({ status: "refused", reason: "empty-eligible-mask" });
    expect(() =>
      searchRealBuildPrefix50EligibleMaskSimilarity({
        source,
        target: source,
        eligibleTarget: eligible,
        options: { relativeScaleRadius: Number.POSITIVE_INFINITY },
      }),
    ).toThrow(/relativeScaleRadius must be finite/u);
  });

  it("refuses distinct plateaus and deterministically bounds identical-raster traversal", () => {
    const source = raster(48, 32);
    source.mask[16 * source.width + 24] = 1;
    const target = raster(48, 32);
    target.mask[16 * target.width + 20] = 1;
    target.mask[16 * target.width + 28] = 1;
    const eligible = allEligible(48, 32);
    const plateau = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target,
      eligibleTarget: eligible,
      options: {
        ...SEARCH,
        relativeScaleRadius: 0.2,
        initialCenterStepPx: 4,
        initialRelativeScaleStep: 0.1,
      },
    });
    expect(plateau, JSON.stringify(plateau)).toMatchObject({
      status: "refused",
      reason: "search-boundary-hit",
      diagnostics: { coarseObjectiveTieScaleBoundaryHit: true, scaleBoundaryHit: true },
    });

    const block = raster(48, 32);
    fill(block, 13, 9, 19, 11);
    const exactInput = { source: block, target: block, eligibleTarget: eligible, options: SEARCH };
    const first = searchRealBuildPrefix50EligibleMaskSimilarity(exactInput);
    expect(first).toEqual(searchRealBuildPrefix50EligibleMaskSimilarity(exactInput));
    expectResolution(first);
    expect(first.diagnostics.equivalentRasterTieCount).toBeGreaterThan(0);
  });

  it("refuses when any equivalent best raster reaches the scale wall", () => {
    const block = raster(32, 24);
    fill(block, 9, 7, 12, 9);
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source: block,
      target: block,
      eligibleTarget: allEligible(32, 24),
      options: {
        relativeScaleRadius: 0.001,
        initialCenterStepPx: 0.1,
        initialRelativeScaleStep: 0.0005,
        finalCenterCellPx: 0.1,
        finalRelativeScaleCell: 0.0005,
        coarseStridePx: 2,
        maximumCandidates: 8_192,
        maximumFullResolutionCandidates: 8_192,
      },
    });
    expect(result, JSON.stringify(result)).toMatchObject({
      status: "refused",
      reason: "search-boundary-hit",
      diagnostics: { equivalentRasterTieCount: expect.any(Number) },
    });
    expect(result.diagnostics.equivalentRasterTieCount).toBeGreaterThan(0);
    expect(result.diagnostics.centerBoundaryHit || result.diagnostics.scaleBoundaryHit).toBe(true);
  });

  it("fails closed while traversing the connected component with scale-wall optima", () => {
    const block = raster(32, 24);
    fill(block, 0, 0, 2, 2);
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source: block,
      target: block,
      eligibleTarget: allEligible(32, 24),
      options: {
        relativeScaleRadius: 0.05,
        initialCenterStepPx: 0.25,
        initialRelativeScaleStep: 0.05,
        finalCenterCellPx: 0.1,
        finalRelativeScaleCell: 0.0005,
        coarseStridePx: 4,
        maximumCandidates: 8_192,
        maximumFullResolutionCandidates: 8_192,
      },
    });
    expect(result, JSON.stringify(result)).toMatchObject({
      status: "refused",
      reason: "search-boundary-hit",
      diagnostics: {
        objectiveScope: "complete-coarse-domain-plus-local-final-cell-containment",
        coarseObjectiveTieScaleBoundaryHit: true,
        scaleBoundaryHit: true,
        equivalenceComponentComplete: false,
        localNeighborOptimal: false,
      },
    });
    expect(result.diagnostics.equivalenceComponentMembersVisited).toBeGreaterThan(1);
  });

  it("compares canonical row spans without million-pixel tie materialization", () => {
    const source = raster(1_000, 1_000);
    source.mask[500 * source.width + 500] = 1;
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target: source,
      eligibleTarget: allEligible(1_000, 1_000),
      options: {
        relativeScaleRadius: 0.001,
        initialCenterStepPx: 0.1,
        initialRelativeScaleStep: 0.0005,
        finalCenterCellPx: 0.1,
        finalRelativeScaleCell: 0.0005,
        coarseStridePx: 2,
        maximumCandidates: 1_024,
        maximumFullResolutionPixelVisits: 3_500_000,
        maximumTotalPixelVisits: 30_000_000,
      },
    });
    expect(result, JSON.stringify(result)).toMatchObject({
      status: "refused",
      reason: "search-boundary-hit",
    });
    const { diagnostics: measured } = result;
    expect(measured.candidateEvaluationMethod).toBe("full-resolution-row-span-prefix-sum");
    expect(measured.tieRasterizationPixelVisits).toBe(0);
    expect(measured.maximumTieComparisonPixelVisitsPerClassification).toBe(6);
    expect(measured.exactObjectiveRunComparisonsPerformed).toBeGreaterThanOrEqual(
      measured.exactObjectiveTiesClassified - 1,
    );
    expect(measured.tieComparisonPixelVisits).toBe(
      measured.exactObjectiveRunComparisonsPerformed * 3,
    );
    expect(measured.tieComparisonPixelVisits).toBeLessThanOrEqual(
      measured.exactObjectiveRunComparisonsPerformed *
        measured.maximumTieComparisonPixelVisitsPerClassification,
    );
    expect(measured.preprocessingPixelVisits).toBe(
      measured.inputValidationPixelVisits +
        measured.momentPixelVisits +
        measured.sourceForegroundPixelVisits +
        measured.pyramidConstructionPixelVisits +
        measured.rowSpanIndexConstructionPixelVisits,
    );
    expect(measured.fullResolutionPixelVisits).toBe(
      measured.exactObjectivePixelVisits +
        measured.tieRasterizationPixelVisits +
        measured.tieComparisonPixelVisits,
    );
    expect(measured.totalPixelVisits).toBe(
      measured.preprocessingPixelVisits +
        measured.sampledPixelVisits +
        measured.fullResolutionPixelVisits,
    );
    expect(measured.fullResolutionPixelVisits).toBeLessThanOrEqual(
      measured.maximumFullResolutionPixelVisits,
    );
    expect(measured.totalPixelVisits).toBeLessThanOrEqual(measured.maximumTotalPixelVisits);
  });

  it("charges each additional exact-equivalent retained row-span seed", () => {
    let chargedVisits = 0;
    let recordedVisits = 0;
    const classifier = createRealBuildPrefix50EquivalentRasterClassifier({
      chargeComparison(maximumVisits) {
        chargedVisits += maximumVisits;
        return true;
      },
      recordComparisonVisits(visits) {
        recordedVisits += visits;
      },
    });
    const candidate = (deltaX: number) => ({
      coordinate: { deltaX, deltaY: 0, relativeScaleDelta: 0 },
      transform: { scale: 1, offsetXPx: deltaX, offsetYPx: 0 },
      agreement: {
        intersection: 1,
        union: 1,
        warpedEligible: 1,
        warpedInRaster: 1,
        warpedUnclipped: 1,
      },
      eligibleWarpRuns: Int32Array.from([0, 500, 501]),
    });
    const best = candidate(0);
    classifier.reset(best);

    expect(classifier.classify(candidate(0.1), best)).toBe(true);
    expect(classifier.equivalentCandidates()).toHaveLength(2);
    expect(classifier.runComparisonsPerformed()).toBe(1);
    expect({ chargedVisits, recordedVisits }).toEqual({ chargedVisits: 3, recordedVisits: 3 });

    expect(classifier.classify(candidate(0.2), best)).toBe(true);
    expect(classifier.equivalentCandidates()).toHaveLength(3);
    expect(classifier.runComparisonsPerformed()).toBe(2);
    expect({ chargedVisits, recordedVisits }).toEqual({ chargedVisits: 6, recordedVisits: 6 });
  });

  it("refuses an optimum that reaches the bounded scale wall", () => {
    const source = asymmetricSource();
    const eligible = allEligible();
    const target = warpThenApplyEligibility(source, eligible, {
      scale: 1.15,
      offsetXPx: 0,
      offsetYPx: 0,
    });
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target,
      eligibleTarget: eligible,
      options: {
        ...SEARCH,
        initialCenterStepPx: 1,
        relativeScaleRadius: 0.04,
        initialRelativeScaleStep: 0.02,
      },
    });
    expect(result).toMatchObject({
      status: "refused",
      reason: "search-boundary-hit",
      diagnostics: { scaleBoundaryHit: true },
    });
  });

  it("bounds and records containment-proof work on a 720x470 page raster", () => {
    const source = raster(720, 470);
    fill(source, 48, 72, 272, 34);
    fill(source, 48, 106, 46, 205);
    fill(source, 238, 174, 168, 43);
    fill(source, 495, 247, 87, 112);
    fill(source, 581, 322, 92, 38);
    const eligible = eligibleWithBox(
      { x: 215, y: 126, width: 286, height: 216 },
      source.width,
      source.height,
    );
    for (let x = 0; x < source.width; x += 1)
      for (let y = 0; y < 28; y += 1) eligible.mask[y * source.width + x] = 0;
    const target = warpThenApplyEligibility(source, eligible, {
      scale: 0.96,
      offsetXPx: -18,
      offsetYPx: 14,
    });
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target,
      eligibleTarget: eligible,
      options: {
        maximumCandidates: 100_000,
        maximumSampledPixelVisits: 2_000_000_000,
        maximumFullResolutionCandidates: 512,
        maximumFullResolutionPixelVisits: 75_000_000,
        maximumPreprocessingPixelVisits: 16_000_000,
        maximumTotalPixelVisits: 2_175_000_000,
      },
    });
    expectResolution(result);
    const measured = result.diagnostics;
    expect(measured.candidateEvaluationMethod).toBe("full-resolution-row-span-prefix-sum");
    expect(measured.coarseCandidatesExpected).toBe(80_880);
    expect(measured.coarseCandidatesEvaluated).toBe(80_880);
    expect(measured.coarsePreflightPassed).toBe(true);
    expect(measured.coarsePixelVisitUpperBound).not.toBeNull();
    expect(measured.coarsePixelVisitUpperBound!).toBeLessThanOrEqual(2_000_000_000);
    expect(measured.coarseDomainComplete).toBe(true);
    expect(measured.sampledCandidatesTried).toBeLessThan(90_000);
    expect(measured.predictedIntersectionOverUnion).toBeGreaterThan(0.98);
    expect(measured.fullResolutionCandidatesTried).toBeLessThanOrEqual(512);
    expect(measured.sampledPixelVisits).toBeLessThanOrEqual(2_000_000_000);
    expect(measured.fullResolutionPixelVisits).toBeLessThanOrEqual(75_000_000);
    expect(measured.preprocessingPixelVisits).toBeLessThanOrEqual(16_000_000);
    expect(measured.totalPixelVisits).toBeLessThanOrEqual(2_175_000_000);
    expect(measured.tieComparisonPixelVisits).toBeGreaterThan(0);
    expect(measured.preprocessingPixelVisits).toBe(
      measured.inputValidationPixelVisits +
        measured.momentPixelVisits +
        measured.sourceForegroundPixelVisits +
        measured.pyramidConstructionPixelVisits +
        measured.rowSpanIndexConstructionPixelVisits,
    );
    expect(measured.fullResolutionPixelVisits).toBe(
      measured.exactObjectivePixelVisits +
        measured.tieRasterizationPixelVisits +
        measured.tieComparisonPixelVisits,
    );
    expect(measured.totalPixelVisits).toBe(
      measured.preprocessingPixelVisits +
        measured.sampledPixelVisits +
        measured.fullResolutionPixelVisits,
    );
    expect(measured.candidatesTried).toBe(
      measured.sampledCandidatesTried + measured.fullResolutionCandidatesTried,
    );
  }, 30_000);
});
