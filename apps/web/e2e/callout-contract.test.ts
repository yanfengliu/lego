import { describe, expect, it } from "vitest";

import { parseRequestedPages, selectStepPages } from "./callout-analysis";
import { evaluateRecoveryBenchmark, fixtureAccepts } from "./callout-benchmark";
import {
  MEASURED_QUANTITY_FACES_PT,
  QUANTITY_LABEL_FACE_CONTRACT,
  assertPublishedQuantityFaces,
  classifyQuantityFace,
} from "./callout-faces";
import {
  CALLOUT_RECOVERY_FIXTURE,
  FULL_BOOKLET_CALLOUT_ACCOUNTING,
  SEMANTIC_CALLOUTS,
} from "./callout-recovery-fixture";
import type { BrowserCrop, BrowserResult, RecoveryFixtureCase } from "./callout-types";
import { OFFICIAL_REAL_BUILD_ACCOUNTING } from "./real-build-contract";
import { FULL_CALLOUT_MANIFEST_EXPECTATION } from "../../../scripts/part-identification-artifacts.mjs";

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
  it("pins 38 unique failures and the exact 22 semantic identities", () => {
    expect(CALLOUT_RECOVERY_FIXTURE.cases).toHaveLength(38);
    expect(new Set(CALLOUT_RECOVERY_FIXTURE.cases.map(({ identity }) => identity)).size).toBe(38);
    expect(
      SEMANTIC_CALLOUTS.map(({ identity }) => identity).sort((left, right) =>
        left.localeCompare(right),
      ),
    ).toEqual([
      "p103|q2|x253.179|y92.215",
      "p109|q2|x723.002|y319.540",
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
      "p59|q2|x124.683|y55.056",
      "p76|q2|x315.636|y170.033",
      "p79|q2|x357.198|y161.718",
      "p85|q2|x662.244|y445.465",
      "p89|q2|x332.007|y431.482",
      "p93|q2|x332.066|y400.171",
      "p96|q2|x125.941|y478.298",
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
      physicalPartArtIdentityCount: 859,
      physicalPartArtQuantityTotal: 1_464,
      semanticIdentityCount: 22,
      semanticQuantityTotal: 48,
      fixedFailureClassSize: 38,
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

  // Regression for the 2026-08-05 set-accounting-mismatch. The callout
  // publication and the real-build contract each pinned their own copy of the
  // same three numbers and drifted 26 pieces apart: the real-build copy stayed
  // on a superseded 870-identity generation (raw 1486, physical 1446) while the
  // publication moved to 881/1512, and the gap was papered over by an 18-piece
  // omittedPhysicalPieces class that no artifact ever enumerated. Either half
  // moving alone now fails here rather than at a build that places nothing.
  it("conserves one callout accounting across the publication and real-build contracts", () => {
    // Third copy: the .mjs producer contract that validates a published
    // manifest. It carries the six published totals but not the fixture size.
    const published = Object.fromEntries(
      Object.entries(FULL_BOOKLET_CALLOUT_ACCOUNTING).filter(
        ([key]) => key !== "fixedFailureClassSize",
      ),
    );
    expect(FULL_CALLOUT_MANIFEST_EXPECTATION.accounting).toEqual(published);
    expect(FULL_BOOKLET_CALLOUT_ACCOUNTING.rawNxQuantityTotal).toBe(
      OFFICIAL_REAL_BUILD_ACCOUNTING.rawCalloutQuantity,
    );
    expect(FULL_BOOKLET_CALLOUT_ACCOUNTING.physicalPartArtQuantityTotal).toBe(
      OFFICIAL_REAL_BUILD_ACCOUNTING.classifiedPhysicalCalloutPieces,
    );
    expect(FULL_BOOKLET_CALLOUT_ACCOUNTING.semanticQuantityTotal).toBe(
      OFFICIAL_REAL_BUILD_ACCOUNTING.semanticMultiplierQuantity,
    );
  });

  it("keeps the assembled model inside the printed inventory", () => {
    const official = OFFICIAL_REAL_BUILD_ACCOUNTING;
    // The printed back matter is ground truth: 1465 pieces, one of them the
    // loose 31510 separator that is never placed. No parse may claim more.
    expect(official.inventoryPieces).toBe(1_465);
    expect(official.assembledTargetPieces + official.looseInventoryPieces).toBe(
      official.inventoryPieces,
    );
    expect(official.classifiedPhysicalCalloutPieces + official.omittedPhysicalPieces).toBe(
      official.assembledTargetPieces,
    );
    expect(official.directCalloutPieces + official.multiBuildCopyPieces).toBe(
      official.assembledTargetPieces,
    );
    expect(official.classifiedPhysicalCalloutPieces + official.semanticMultiplierQuantity).toBe(
      official.rawCalloutQuantity,
    );
    expect(official.classifiedPhysicalCalloutPieces).toBeLessThanOrEqual(
      official.inventoryPieces - official.looseInventoryPieces,
    );
    // An omitted class is the one term with no printed source, so it is the one
    // an over-reading parse could hide behind. It stays zero until some artifact
    // enumerates the pieces, which is what omitted-piece-identity-missing asks for.
    expect(official.omittedPhysicalPieces).toBe(0);
  });

  it("classifies every multiplier-face label as semantic", () => {
    // The booklet sets parts-bin quantities at 8pt and multipliers at 16/24/40pt.
    // These four were read at the multiplier faces but published as part-art,
    // which is what put the physical total 8 pieces above the assembled model.
    const recovered = ["p59|q2|", "p85|q2|", "p96|q2|x125.941", "p109|q2|"];
    for (const prefix of recovered) {
      const entry = CALLOUT_RECOVERY_FIXTURE.cases.find(({ identity }) =>
        identity.startsWith(prefix),
      );
      expect(entry, `${prefix} must stay a preregistered multiplier label`).toBeDefined();
      expect(entry!.evidenceKind).not.toBe("part-art");
      expect(entry!.regionKind).toBe("vector-box-full");
      expect(entry!.requiredMasks).toContain("quantity-label");
    }
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
    expect(benchmark.scores.find(({ strategy }) => strategy === "evidence-aware")?.valid).toBe(38);
    expect(benchmark.scores.find(({ strategy }) => strategy === "ranked-component")?.valid).toBe(
      16,
    );
  });
});

describe("quantity-label type size", () => {
  it("puts its bound in the empty gap between the two measured classes", () => {
    // Re-measured 2026-08-05 over recipes/6651557.pdf: nothing is set between
    // 8pt and 16pt, so the bound has a factor of two of margin on both sides.
    expect(MEASURED_QUANTITY_FACES_PT.partsBin).toBe(QUANTITY_LABEL_FACE_CONTRACT.partsBinPt);
    expect(Math.min(...MEASURED_QUANTITY_FACES_PT.multipliers)).toBe(
      QUANTITY_LABEL_FACE_CONTRACT.multiplierMinPt,
    );
    expect(QUANTITY_LABEL_FACE_CONTRACT.multiplierMinPt).toBeGreaterThan(
      QUANTITY_LABEL_FACE_CONTRACT.partsBinPt + QUANTITY_LABEL_FACE_CONTRACT.partsBinTolerancePt,
    );
    // The tolerance may never reach the 6pt back-matter inventory face, which is
    // a third meaning entirely and must not read as a step parts-bin quantity.
    expect(
      QUANTITY_LABEL_FACE_CONTRACT.partsBinPt - QUANTITY_LABEL_FACE_CONTRACT.partsBinTolerancePt,
    ).toBeGreaterThan(MEASURED_QUANTITY_FACES_PT.backMatterInventory);
  });

  it("classifies both measured classes and refuses every unmeasured face", () => {
    expect(classifyQuantityFace(8)).toBe("parts-bin");
    for (const face of MEASURED_QUANTITY_FACES_PT.multipliers) {
      expect(classifyQuantityFace(face)).toBe("multiplier");
    }
    for (const face of [6, 4, 9.5, 12, 15.99, 0, -8, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(classifyQuantityFace(face), `${face}pt must not be guessed into a class`).toBeNull();
    }
    for (const absent of [undefined, null, "8", "8pt", {}]) {
      expect(classifyQuantityFace(absent)).toBeNull();
    }
  });

  it("names the identity, the observed face, the published class, and the remedy", () => {
    expect(() =>
      assertPublishedQuantityFaces([
        { identity: "p59|q2|x124.683|y55.056", heightPt: 16, evidenceKind: "part-art" },
      ]),
    ).toThrow(
      /p59\|q2\|x124\.683\|y55\.056 at 16pt, published as "part-art".*Preregister the identity/su,
    );
    expect(() =>
      assertPublishedQuantityFaces([
        { identity: "p11|q1|x1.000|y1.000", heightPt: 8, evidenceKind: "subassembly-repeat" },
      ]),
    ).toThrow(/at 8pt, published as "subassembly-repeat".*drops real pieces/su);
    expect(() =>
      assertPublishedQuantityFaces([
        { identity: "p11|q1|x1.000|y1.000", heightPt: 12, evidenceKind: "part-art" },
      ]),
    ).toThrow(/never been measured at.*at 12pt.*widen QUANTITY_LABEL_FACE_CONTRACT/su);
    expect(() =>
      assertPublishedQuantityFaces([
        {
          identity: "p11|q1|x1.000|y1.000",
          heightPt: undefined as unknown as number,
          evidenceKind: "part-art",
        },
      ]),
    ).toThrow(/publish no measured quantity-label type size/u);
  });

  it("agrees with the preregistered fixture on every semantic identity", () => {
    // Two independent sources for one classification. The fixture is a hand-made
    // list of regions and crop predicates; this is the booklet's own type size.
    // Neither derives from the other, which is why both are kept.
    for (const entry of SEMANTIC_CALLOUTS) {
      expect(
        classifyQuantityFace(QUANTITY_LABEL_FACE_CONTRACT.multiplierMinPt),
        entry.identity,
      ).toBe("multiplier");
    }
    expect(
      assertPublishedQuantityFaces(
        SEMANTIC_CALLOUTS.map(({ identity, evidenceKind }) => ({
          identity,
          heightPt: 16,
          evidenceKind,
        })),
      ),
    ).toBeUndefined();
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
