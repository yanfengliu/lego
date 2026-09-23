import { describe, expect, it } from "vitest";

import {
  searchRealBuildPrefix50EligibleMaskSimilarity,
  type RealBuildPrefix50EligibleMaskRaster,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration";
import {
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_CANDIDATES,
  REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_COARSE_CANDIDATES,
  maximumRealBuildPrefix50CompleteCoarseCandidatesForRaster,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration-support.ts";

function raster(width: number, height: number): RealBuildPrefix50EligibleMaskRaster {
  return { width, height, mask: new Uint8Array(width * height) };
}

describe("eligible-mask camera registration grid bounds", () => {
  it("preflights pathological translation and scale grids before enumeration", () => {
    const source = raster(1_000, 1);
    source.mask[0] = 1;
    source.mask[source.width - 1] = 1;
    const eligible = raster(1_000, 1);
    eligible.mask.fill(1);
    expect(() =>
      searchRealBuildPrefix50EligibleMaskSimilarity({
        source,
        target: source,
        eligibleTarget: eligible,
        options: {
          initialCenterStepPx: 1,
          coarseStridePx: 1,
          maximumCandidates: 27,
        },
      }),
    ).toThrow(/translation-x at scale .* interval needs/u);
    const smallSource = raster(16, 12);
    for (let y = 4; y < 7; y += 1)
      for (let x = 5; x < 8; x += 1) smallSource.mask[y * smallSource.width + x] = 1;
    const smallEligible = raster(16, 12);
    smallEligible.mask.fill(1);
    expect(() =>
      searchRealBuildPrefix50EligibleMaskSimilarity({
        source: smallSource,
        target: smallSource,
        eligibleTarget: smallEligible,
        options: {
          initialCenterStepPx: 1,
          relativeScaleRadius: 0.2,
          initialRelativeScaleStep: 1e-15,
          finalRelativeScaleCell: 1e-15,
          maximumCandidates: 27,
        },
      }),
    ).toThrow(/relative-scale grid radius\/step ratio|relative-scale grid needs/u);
  });

  it("refuses before publishing when the complete coarse domain cannot fit its candidate budget", () => {
    const source = raster(16, 12);
    source.mask[6 * source.width + 8] = 1;
    const eligible = raster(16, 12);
    eligible.mask.fill(1);
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target: source,
      eligibleTarget: eligible,
      options: {
        relativeScaleRadius: 0.3,
        initialCenterStepPx: 4,
        initialRelativeScaleStep: 0.04,
        coarseStridePx: 4,
        maximumCandidates: 27,
      },
    });
    expect(result).toMatchObject({
      status: "refused",
      reason: "incomplete-coarse-domain",
      diagnostics: {
        coarseCandidatesEvaluated: 0,
        coarsePreflightPassed: false,
        coarseDomainComplete: false,
        refinementStarts: 0,
      },
    });
    expect(result.diagnostics.coarseCandidatesExpected).toBeGreaterThan(27);
    expect(result.diagnostics.coarseScaleTranslationDomains).toHaveLength(17);
    expect(
      result.diagnostics.coarseScaleTranslationDomains.reduce(
        (count, domain) => count + domain.candidateCount,
        0,
      ),
    ).toBe(result.diagnostics.coarseCandidatesExpected);
    expect(result.diagnostics.translationDomainAuthority).toBe(
      "source-target-foreground-overlap-complete",
    );
  });

  it("refuses before evaluating when the complete coarse row-span work bound exceeds its cap", () => {
    const source = raster(96, 72);
    for (let y = 12; y < 54; y += 1)
      for (let x = 8; x < 80; x += 4) source.mask[y * source.width + x] = 1;
    const eligible = raster(96, 72);
    eligible.mask.fill(1);
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target: source,
      eligibleTarget: eligible,
      options: {
        maximumCandidates: 100_000,
        maximumSampledPixelVisits: 1,
      },
    });
    expect(result).toMatchObject({
      status: "refused",
      reason: "incomplete-coarse-domain",
      diagnostics: {
        coarseCandidatesEvaluated: 0,
        coarsePreflightPassed: false,
        coarseDomainComplete: false,
      },
    });
    expect(result.diagnostics.coarsePixelVisitUpperBound).not.toBeNull();
    expect(result.diagnostics.coarsePixelVisitUpperBound!).toBeGreaterThan(1);
  });

  it("rejects caller budgets above implementation-owned candidate caps", () => {
    const source = raster(16, 12);
    source.mask[6 * source.width + 8] = 1;
    const eligible = raster(16, 12);
    eligible.mask.fill(1);
    expect(() =>
      searchRealBuildPrefix50EligibleMaskSimilarity({
        source,
        target: source,
        eligibleTarget: eligible,
        options: { maximumCandidates: REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_CANDIDATES + 1 },
      }),
    ).toThrow(
      new RegExp(
        `implementation caps of ${REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_CANDIDATES} total`,
        "u",
      ),
    );
    expect(() =>
      searchRealBuildPrefix50EligibleMaskSimilarity({
        source,
        target: source,
        eligibleTarget: eligible,
        options: { maximumFullResolutionCandidates: 16_385 },
      }),
    ).toThrow(/16384 full-resolution candidates/u);
  });

  it("derives a source-independent 720x470 ceiling and completes a control above the old cap", () => {
    expect(
      maximumRealBuildPrefix50CompleteCoarseCandidatesForRaster({
        width: 720,
        height: 470,
        translationStepPx: 16,
        relativeScaleRadius: 0.5,
        relativeScaleStep: 0.04,
      }),
    ).toBe(156_062);
    expect(REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_COARSE_CANDIDATES).toBe(156_062);

    const source = raster(720, 470);
    for (const [x, y] of [
      [0, 0],
      [2, 0],
      [0, 1],
      [719, 7],
      [701, 120],
      [83, 469],
      [84, 468],
      [603, 401],
      [604, 401],
      [603, 402],
    ] as const)
      source.mask[y * source.width + x] = 1;
    const eligible = raster(720, 470);
    eligible.mask.fill(1);
    const result = searchRealBuildPrefix50EligibleMaskSimilarity({
      source,
      target: { width: source.width, height: source.height, mask: source.mask.slice() },
      eligibleTarget: eligible,
    });
    expect(result, JSON.stringify(result)).toMatchObject({
      status: "locally-contained",
      diagnostics: {
        coarsePreflightPassed: true,
        coarseDomainComplete: true,
        localFinalCellContainmentComplete: true,
        predictedIntersectionOverUnion: 1,
      },
    });
    expect(result.diagnostics.coarseCandidatesExpected).toBeGreaterThan(100_000);
    expect(result.diagnostics.coarseCandidatesExpected).toBeLessThanOrEqual(
      REAL_BUILD_PREFIX50_CAMERA_SEARCH_MAXIMUM_COARSE_CANDIDATES,
    );
    expect(result.diagnostics.coarseCandidatesEvaluated).toBe(
      result.diagnostics.coarseCandidatesExpected,
    );
  }, 30_000);
});
