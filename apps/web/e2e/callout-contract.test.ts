import { describe, expect, it } from "vitest";

import { parseRequestedPages, selectStepPages } from "./callout-analysis";
import { evaluateRecoveryBenchmark, fixtureAccepts } from "./callout-benchmark";
import {
  CALLOUT_RECOVERY_FIXTURE,
  FULL_BOOKLET_CALLOUT_ACCOUNTING,
  SEMANTIC_CALLOUTS,
} from "./callout-recovery-fixture";
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
  it("pins 34 unique failures and the exact 18 semantic identities", () => {
    expect(CALLOUT_RECOVERY_FIXTURE.cases).toHaveLength(34);
    expect(new Set(CALLOUT_RECOVERY_FIXTURE.cases.map(({ identity }) => identity)).size).toBe(34);
    expect(
      SEMANTIC_CALLOUTS.map(({ identity }) => identity).sort((left, right) =>
        left.localeCompare(right),
      ),
    ).toEqual([
      "p103|q2|x253.179|y92.215",
      "p111|q4|x725.103|y415.705",
      "p147|q2|x532.191|y440.120",
      "p173|q2|x330.444|y327.720",
      "p182|q2|x333.883|y418.464",
      "p187|q2|x268.113|y339.249",
      "p199|q2|x315.163|y148.519",
      "p209|q2|x650.759|y397.824",
      "p213|q2|x112.849|y272.876",
      "p216|q2|x353.685|y318.273",
      "p32|q2|x511.589|y390.747",
      "p33|q4|x274.854|y340.077",
      "p76|q2|x315.636|y170.033",
      "p79|q2|x357.198|y161.718",
      "p89|q2|x332.007|y431.482",
      "p93|q2|x332.066|y400.171",
      "p96|q2|x685.147|y70.803",
      "p99|q2|x267.940|y62.979",
    ]);
  });

  it("pins the visually audited subassembly predicates independently of runtime crops", () => {
    const auditedIdentities = new Set([
      "p32|q2|x511.589|y390.747",
      "p76|q2|x315.636|y170.033",
      "p79|q2|x357.198|y161.718",
      "p89|q2|x332.007|y431.482",
      "p93|q2|x332.066|y400.171",
      "p99|q2|x267.940|y62.979",
      "p103|q2|x253.179|y92.215",
      "p111|q4|x725.103|y415.705",
      "p147|q2|x532.191|y440.120",
      "p173|q2|x330.444|y327.720",
      "p182|q2|x333.883|y418.464",
      "p187|q2|x268.113|y339.249",
      "p199|q2|x315.163|y148.519",
      "p213|q2|x112.849|y272.876",
      "p216|q2|x353.685|y318.273",
    ]);
    expect(
      CALLOUT_RECOVERY_FIXTURE.cases
        .filter(({ identity }) => auditedIdentities.has(identity))
        .map(
          ({
            identity,
            evidenceKind,
            regionKind,
            requiredMasks,
            minimumWidthPx,
            minimumHeightPx,
            minimumForegroundPixels,
            minimumBoundaryClearancePx,
          }) => ({
            identity,
            evidenceKind,
            regionKind,
            requiredMasks,
            minimumWidthPx,
            minimumHeightPx,
            minimumForegroundPixels,
            minimumBoundaryClearancePx,
          }),
        )
        .sort((left, right) => left.identity.localeCompare(right.identity)),
    ).toEqual(
      [
        ["p32|q2|x511.589|y390.747", 250, 400],
        ["p76|q2|x315.636|y170.033", 650, 400],
        ["p79|q2|x357.198|y161.718", 750, 300],
        ["p89|q2|x332.007|y431.482", 450, 250],
        ["p93|q2|x332.066|y400.171", 450, 250],
        ["p99|q2|x267.940|y62.979", 450, 250],
        ["p103|q2|x253.179|y92.215", 450, 250],
        ["p111|q4|x725.103|y415.705", 850, 500],
        ["p147|q2|x532.191|y440.120", 350, 300],
        ["p173|q2|x330.444|y327.720", 1_100, 450],
        ["p182|q2|x333.883|y418.464", 750, 350],
        ["p187|q2|x268.113|y339.249", 800, 350],
        ["p199|q2|x315.163|y148.519", 250, 400],
        ["p213|q2|x112.849|y272.876", 250, 500],
        ["p216|q2|x353.685|y318.273", 1_550, 350],
      ]
        .map(([identity, minimumWidthPx, minimumHeightPx]) => ({
          identity,
          evidenceKind: "subassembly-repeat",
          regionKind: "vector-box-full",
          requiredMasks: ["quantity-label"],
          minimumWidthPx,
          minimumHeightPx,
          minimumForegroundPixels: 10_000,
          minimumBoundaryClearancePx: 16,
        }))
        .sort((left, right) => String(left.identity).localeCompare(String(right.identity))),
    );
  });

  it("pins the fresh full-booklet publication accounting", () => {
    expect(FULL_BOOKLET_CALLOUT_ACCOUNTING).toEqual({
      rawNxIdentityCount: 881,
      rawNxQuantityTotal: 1_512,
      physicalPartArtIdentityCount: 863,
      physicalPartArtQuantityTotal: 1_472,
      semanticIdentityCount: 18,
      semanticQuantityTotal: 40,
      fixedFailureClassSize: 34,
    });
    expect(SEMANTIC_CALLOUTS).toHaveLength(FULL_BOOKLET_CALLOUT_ACCOUNTING.semanticIdentityCount);
    expect(
      SEMANTIC_CALLOUTS.reduce((total, { identity }) => {
        const match = /^p\d+\|q(\d+)\|/.exec(identity);
        expect(match).not.toBeNull();
        return total + Number(match![1]);
      }, 0),
    ).toBe(FULL_BOOKLET_CALLOUT_ACCOUNTING.semanticQuantityTotal);
    expect(
      FULL_BOOKLET_CALLOUT_ACCOUNTING.rawNxIdentityCount -
        FULL_BOOKLET_CALLOUT_ACCOUNTING.semanticIdentityCount,
    ).toBe(FULL_BOOKLET_CALLOUT_ACCOUNTING.physicalPartArtIdentityCount);
    expect(
      FULL_BOOKLET_CALLOUT_ACCOUNTING.rawNxQuantityTotal -
        FULL_BOOKLET_CALLOUT_ACCOUNTING.semanticQuantityTotal,
    ).toBe(FULL_BOOKLET_CALLOUT_ACCOUNTING.physicalPartArtQuantityTotal);
    expect(CALLOUT_RECOVERY_FIXTURE.cases).toHaveLength(
      FULL_BOOKLET_CALLOUT_ACCOUNTING.fixedFailureClassSize,
    );
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
    expect(benchmark.scores.find(({ strategy }) => strategy === "evidence-aware")?.valid).toBe(34);
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
