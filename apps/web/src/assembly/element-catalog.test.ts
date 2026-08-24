import { describe, expect, it } from "vitest";

import {
  catalogDesignNumbers,
  resolveElementColor,
  resolveElementPart,
  summarizeCatalogCoverage,
  type BookletElement,
} from "./element-catalog";

const element = (partNum: string, name: string, colorId: number | string = 0): BookletElement => ({
  elementId: `element-${partNum}`,
  partNum,
  name,
  colorId,
});

describe("resolveElementPart", () => {
  it("resolves a design number the catalog carries verbatim", () => {
    const resolved = resolveElementPart(element("3020", "Plate 2 x 4"));
    expect(resolved).toMatchObject({
      outcome: "exact",
      catalogPartId: "builtin:plate-2x4",
      note: null,
    });
  });

  it("resolves a mould revision the catalog carries under its own letter", () => {
    // The booklet prints 3069b; the catalog's alias is 3069b.dat, so this is exact.
    expect(resolveElementPart(element("3069b", "Tile 1 x 2 with Groove"))).toMatchObject({
      outcome: "exact",
      catalogPartId: "builtin:tile-1x2",
    });
  });

  it("reaches the catalog's revision when the booklet prints the bare design", () => {
    const resolved = resolveElementPart(element("41769", "Wedge Plate 4 x 2 Right"));
    expect(resolved.outcome).toBe("variant");
    expect(resolved.catalogPartId).toBe("builtin:wedge-plate-2x4-right");
    expect(resolved.note).toContain("41769a");
  });

  it("strips a print suffix to reach the undecorated mould", () => {
    const resolved = resolveElementPart(element("4162pr0074", "Tile 1 x 8 with print"));
    expect(resolved.outcome).toBe("variant");
    expect(resolved.catalogPartId).toBe("builtin:tile-1x8");
    expect(resolved.note).toContain("print suffix");
  });

  it("resolves the first six measured booklet additions without substitution", () => {
    const additions = [
      ["91988", "Plate 2 x 14", "builtin:plate-2x14"],
      ["30503", "Wedge Plate 4 x 4 Cut Corner", "builtin:wedge-plate-4x4-cut-corner"],
      ["6106", "Wedge Plate 6 x 6 Cut Corner", "builtin:wedge-plate-6x6-cut-corner"],
      ["54383", "Wedge Plate 3 x 6 Right", "builtin:wedge-plate-3x6-right"],
      ["30565", "Plate Round Corner 4 x 4", "builtin:corner-plate-4x4-round"],
      ["80015", "Plate 5 x 5 Quarter Ring", "builtin:corner-plate-5x5-quarter-ring"],
    ] as const;

    for (const [partNum, name, catalogPartId] of additions) {
      expect(resolveElementPart(element(partNum, name))).toMatchObject({
        outcome: "exact",
        catalogPartId,
        note: null,
      });
    }
  });

  it("refuses a shape the catalog does not have, naming it and the fix", () => {
    const resolved = resolveElementPart({
      elementId: "element-987654",
      partNum: "987654",
      name: "Invented impossible plate",
      colorId: 0,
    });
    expect(resolved.outcome).toBe("absent");
    expect(resolved.catalogPartId).toBeNull();
    expect(resolved.note).toContain("987654");
    expect(resolved.note).toContain("Invented impossible plate");
    expect(resolved.note).toContain("element-987654");
    // The fix names both admission paths, because there are now two.
    expect(resolved.note).toContain("part-blueprints-6651557-measured.ts");
    expect(resolved.note).toContain("part-blueprints.ts");
    expect(resolved.note).toContain("exact LDraw closure");
    expect(resolved.note).toContain("reviewed source-to-catalog frame");
    expect(resolved.note).toContain("connector authority");
    expect(resolved.note).toContain("collision decomposition");
    expect(resolved.note).not.toContain("Builder frame");
    expect(resolved.note).toContain("BUILTIN_CATALOG_VERSION");
  });

  it("never truncates digits to reach a neighbouring part", () => {
    // 3021 is Plate 2 x 3 and is in the catalog; 30219 is not any part here. A
    // resolver that shortened numbers would answer plate-2x3 and be wrong.
    const resolved = resolveElementPart(element("30219", "Not a real design"));
    expect(resolved.catalogPartId).toBeNull();
  });

  it("does not let a print suffix reach a different design", () => {
    const resolved = resolveElementPart(element("9999pr0001", "Invented print"));
    expect(resolved.catalogPartId).toBeNull();
  });

  it("lists design numbers in the spelling the catalog carries", () => {
    const designs = catalogDesignNumbers();
    expect(designs).toContain("3001");
    expect(designs).toContain("3069b");
    expect(designs).toContain("41769a");
    expect(designs).not.toContain("3001.dat");
  });
});

describe("resolveElementColor", () => {
  it("joins a published colour code to the catalog by LDraw code", () => {
    expect(resolveElementColor(0).colorId).toBe("builtin:black");
    expect(resolveElementColor(15).colorId).toBe("builtin:white");
    expect(resolveElementColor("72").colorId).toBe("builtin:dark-bluish-gray");
  });

  it("falls back to black and says so for a code the palette lacks", () => {
    const resolved = resolveElementColor(9999);
    expect(resolved.colorId).toBe("builtin:black");
    expect(resolved.note).toContain("9999");
    expect(resolved.note).toContain("COLOR_DEFINITIONS");
  });
});

describe("summarizeCatalogCoverage", () => {
  const requirement = (stepNumber: number, partNum: string, name: string, quantity = 1) => ({
    stepNumber,
    quantity,
    resolution: resolveElementPart(element(partNum, name)),
  });

  it("counts a step covered only when every one of its parts resolves", () => {
    const coverage = summarizeCatalogCoverage([
      requirement(1, "3020", "Plate 2 x 4"),
      requirement(1, "987654", "Invented impossible plate"),
      requirement(2, "3022", "Plate 2 x 2", 3),
    ]);
    expect(coverage.stepsCovered).toBe(1);
    expect(coverage.stepsTotal).toBe(2);
    expect(coverage.firstCoveredStep).toBe(2);
    expect(coverage.steps[0]!.missing).toEqual([
      "987654 (Invented impossible plate, element element-987654)",
    ]);
  });

  it("reports the covered prefix, which is what a build can actually reach", () => {
    const blockedFirst = summarizeCatalogCoverage([
      requirement(1, "987654", "Invented impossible plate"),
      requirement(2, "3020", "Plate 2 x 4"),
      requirement(3, "3022", "Plate 2 x 2"),
    ]);
    expect(blockedFirst.stepsCovered).toBe(2);
    expect(blockedFirst.coveredPrefixLength).toBe(0);

    const openRun = summarizeCatalogCoverage([
      requirement(1, "3020", "Plate 2 x 4"),
      requirement(2, "3022", "Plate 2 x 2"),
      requirement(3, "987654", "Invented impossible plate"),
    ]);
    expect(openRun.coveredPrefixLength).toBe(2);
  });

  it("ranks the missing designs by the pieces they block", () => {
    const coverage = summarizeCatalogCoverage([
      requirement(1, "987654", "Invented impossible plate", 1),
      requirement(2, "987655", "Invented impossible brick", 4),
      requirement(3, "987655", "Invented impossible brick", 2),
    ]);
    expect(coverage.missingDesigns[0]).toMatchObject({
      partNum: "987655",
      callouts: 2,
      pieces: 6,
      steps: [2, 3],
    });
    expect(coverage.piecesPlaceable).toBe(0);
    expect(coverage.piecesTotal).toBe(7);
  });
});
