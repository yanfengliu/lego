import { describe, expect, it } from "vitest";

import {
  calloutLabels,
  dedupeRuns,
  inventoryLabels,
  inventoryPages,
  stepNumbers,
} from "./text-tokens";
import type { PageScan, TextRun } from "./types";

function run(text: string, xPt: number, yPt: number, sizePt: number): TextRun {
  return { text, xPt, yPt, sizePt, widthPt: sizePt * 0.5 * text.length };
}

function page(pageNumber: number, texts: readonly TextRun[]): PageScan {
  return { pageNumber, widthPt: 600, heightPt: 800, texts, paints: [], fills: [] };
}

describe("dedupeRuns", () => {
  it("drops a label the booklet overprinted at the same spot, and counts it", () => {
    const { runs, duplicates } = dedupeRuns([
      run("1x", 10, 20, 8),
      run("1x", 10.01, 20.02, 8),
      run("1x", 40, 20, 8),
    ]);
    expect(runs.map((r) => r.xPt)).toEqual([10, 40]);
    expect(duplicates).toBe(1);
  });
});

describe("inventory text", () => {
  const ids = Array.from({ length: 8 }, (_, i) => String(3001001 + i));

  it("finds the pages that print at least eight element ids", () => {
    const inventory = page(
      9,
      ids.map((id, i) => run(id, 40 + 60 * i, 100, 6)),
    );
    const build = page(
      2,
      ids.slice(0, 3).map((id, i) => run(id, 40 + 60 * i, 100, 6)),
    );
    expect(inventoryPages([build, inventory])).toEqual([9]);
  });

  it("pairs each element id with the count printed just above it in the same column", () => {
    const scan = page(9, [
      run("2x", 40, 107, 7),
      run("3001001", 40.3, 100, 6),
      run("1x", 100, 108, 7),
      run("3001002", 100, 100, 6),
      // A count too high above its id belongs to another cell.
      run("5x", 160, 130, 7),
      run("3001003", 160, 100, 6),
    ]);
    const { labels, unpairedIds } = inventoryLabels(scan);
    expect(labels.map((l) => [l.elementId, l.count, l.xPt])).toEqual([
      ["3001001", 2, 40],
      ["3001002", 1, 100],
    ]);
    expect(unpairedIds).toEqual(["3001003"]);
  });

  it("spends a count once even when two ids sit under it", () => {
    const scan = page(9, [
      run("4x", 40, 107, 7),
      run("3001001", 40, 100, 6),
      run("3001002", 40, 99.5, 6),
    ]);
    const { labels, unpairedIds } = inventoryLabels(scan);
    expect(labels).toHaveLength(1);
    expect(unpairedIds).toHaveLength(1);
  });
});

describe("calloutLabels", () => {
  it("keeps the most common label size and counts the rest as sub-assembly multipliers", () => {
    const scans = [
      page(1, [run("1x", 10, 10, 8), run("2x", 50, 10, 8), run("2x", 300, 300, 16)]),
      page(2, [run("3x", 10, 10, 8), run("10", 60, 10, 8), run("x", 90, 10, 8)]),
      page(3, [run("6x", 10, 10, 7), run("6x", 10, 10, 7)]),
    ];
    const result = calloutLabels(scans, new Set([3]));
    expect(result.sizePt).toBe(8);
    expect(result.labels.map((l) => [l.page, l.count])).toEqual([
      [1, 1],
      [1, 2],
      [2, 3],
    ]);
    expect(result.otherSizes).toBe(1);
    expect(result.duplicates).toBe(0);
  });

  it("reports no size when no page prints a count", () => {
    expect(calloutLabels([page(1, [run("7", 10, 10, 8)])], new Set())).toEqual({
      labels: [],
      sizePt: null,
      duplicates: 0,
      otherSizes: 0,
    });
  });
});

describe("stepNumbers", () => {
  it("takes the size whose integers run 1..N, after dropping each page's own number", () => {
    const scans = [
      page(1, [
        run("1", 580, 20, 6),
        run("1", 40, 400, 20),
        run("2", 300, 400, 20),
        run("12", 90, 90, 9),
      ]),
      page(2, [run("2", 580, 20, 6), run("3", 40, 400, 20), run("40", 70, 70, 9)]),
    ];
    const steps = stepNumbers(scans);
    expect(steps.map((s) => [s.page, s.step])).toEqual([
      [1, 1],
      [1, 2],
      [2, 3],
    ]);
    expect(new Set(steps.map((s) => s.sizePt))).toEqual(new Set([20]));
  });

  it("finds no steps when no size starts at 1", () => {
    expect(stepNumbers([page(1, [run("1", 580, 20, 6), run("5", 40, 400, 20)])])).toEqual([]);
  });
});
