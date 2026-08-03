import { describe, expect, it } from "vitest";

import { parseRequestedPages, selectStepPages } from "./callout-analysis";
import { evaluateRecoveryBenchmark, fixtureAccepts } from "./callout-benchmark";
import { CALLOUT_RECOVERY_FIXTURE, SEMANTIC_CALLOUTS } from "./callout-recovery-fixture";
import type { BrowserCrop, BrowserResult, RecoveryFixtureCase } from "./callout-types";

function crop(
  fixture: RecoveryFixtureCase,
  semantic: boolean,
  overrides: Partial<BrowserCrop> = {},
): BrowserCrop {
  const evidenceKind = semantic ? fixture.evidenceKind : "part-art";
  return {
    url: "data:image/png;base64,AA==",
    widthPx: fixture.minimumWidthPx,
    heightPx: fixture.minimumHeightPx,
    strategy: semantic ? "semantic-action-region" : "ranked-component",
    evidenceKind,
    regionKind: semantic ? fixture.regionKind : "isolated-component",
    masksApplied: semantic ? ["quantity-label"] : ["all-pdf-text"],
    contamination: [],
    foregroundPixels: fixture.minimumForegroundPixels,
    sourceTextGlyphPixels: 0,
    sourceQuantityGlyphPixels: semantic ? 10 : 0,
    textGlyphOverlapPixels: 0,
    quantityGlyphOverlapPixels: 0,
    quantityGlyphPixelsMasked: semantic ? 10 : 0,
    cropRectPx: {
      left: 0,
      top: 0,
      right: fixture.minimumWidthPx - 1,
      bottom: fixture.minimumHeightPx - 1,
    },
    boundaryClearancePx: {
      left: fixture.minimumBoundaryClearancePx,
      top: fixture.minimumBoundaryClearancePx,
      right: fixture.minimumBoundaryClearancePx,
      bottom: fixture.minimumBoundaryClearancePx,
    },
    ...overrides,
  };
}

describe("callout recovery fixture", () => {
  it("pins 19 unique failures and all three semantic evidence regions", () => {
    expect(CALLOUT_RECOVERY_FIXTURE.cases).toHaveLength(19);
    expect(new Set(CALLOUT_RECOVERY_FIXTURE.cases.map(({ identity }) => identity)).size).toBe(19);
    expect(
      SEMANTIC_CALLOUTS.map(({ identity, evidenceKind, regionKind }) => ({
        identity,
        evidenceKind,
        regionKind,
      })),
    ).toEqual([
      {
        identity: "p209|q2|x650.759|y397.824",
        evidenceKind: "assembly-action",
        regionKind: "vector-box-full",
      },
      {
        identity: "p33|q4|x274.854|y340.077",
        evidenceKind: "subassembly-repeat",
        regionKind: "vector-box-full",
      },
      {
        identity: "p96|q2|x685.147|y70.803",
        evidenceKind: "assembly-action",
        regionKind: "panel-neighbor-action",
      },
    ]);
  });

  it("rejects numeral-only part art for a semantic action", () => {
    const fixture = CALLOUT_RECOVERY_FIXTURE.cases.find(({ identity }) =>
      identity.startsWith("p33|"),
    )!;
    expect(
      fixtureAccepts(
        crop(fixture, false, {
          widthPx: 31,
          heightPx: 72,
          foregroundPixels: 469,
          sourceTextGlyphPixels: 469,
        }),
        fixture,
      ),
    ).toBe(false);
  });

  it("rejects an otherwise large action whose required foreground reaches a crop edge", () => {
    const fixture = CALLOUT_RECOVERY_FIXTURE.cases.find(({ identity }) =>
      identity.startsWith("p96|q2|x685.147"),
    )!;
    expect(
      fixtureAccepts(
        crop(fixture, true, {
          boundaryClearancePx: { left: 40, top: 0, right: 40, bottom: 0 },
        }),
        fixture,
      ),
    ).toBe(false);
  });

  it("computes a strict evidence-aware winner instead of declaring one", () => {
    const results: BrowserResult[] = CALLOUT_RECOVERY_FIXTURE.cases.map((fixture) => {
      const physical = crop(fixture, false);
      return {
        identity: fixture.identity,
        targetEvidenceKind: fixture.evidenceKind,
        legacy: null,
        adaptive: { ...physical, strategy: "adaptive-seed" },
        ranked: physical,
        action: fixture.evidenceKind === "part-art" ? null : crop(fixture, true),
      };
    });
    const benchmark = evaluateRecoveryBenchmark(CALLOUT_RECOVERY_FIXTURE.sourceHash, results);
    expect(benchmark.winner).toBe("evidence-aware");
    expect(benchmark.winningMargin).toBeGreaterThan(0);
    expect(benchmark.scores.find(({ strategy }) => strategy === "evidence-aware")?.valid).toBe(19);
    expect(benchmark.scores.find(({ strategy }) => strategy === "ranked-component")?.valid).toBe(
      16,
    );
  });
});

describe("callout page selection", () => {
  it("rejects empty, malformed, duplicate, and non-step subsets", () => {
    expect(() => parseRequestedPages("")).toThrow(/empty/);
    expect(() => parseRequestedPages("11,nope")).toThrow(/invalid/);
    expect(() => parseRequestedPages("11,11")).toThrow(/repeats/);
    expect(() => selectStepPages([11, 12], [1], 8)).toThrow(/non-step/);
    expect(() => selectStepPages([], undefined, 8)).toThrow(/no step pages/);
  });

  it("uses 0 only as the explicit full-booklet limit", () => {
    expect(selectStepPages([11, 12, 13], undefined, 0)).toEqual([11, 12, 13]);
    expect(selectStepPages([11, 12, 13], undefined, 2)).toEqual([11, 12]);
    expect(() => selectStepPages([11], undefined, -1)).toThrow(/use 0 for full/);
  });
});
