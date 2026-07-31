import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { scoreColorCoverage } from "./catalog-color-match";
import { extractPageShapes, type OperatorList } from "./page-shapes";

/** Measures what the vector art is made of, before any reader is built on it. */
const SAMPLE = "recipes/6651557.pdf";
const SCOREBOARD = "output/shapes-score.json";

describe("page shape scoreboard", () => {
  it("scores the real booklet's fills against the catalog palette", async () => {
    mkdirSync("output", { recursive: true });
    let data: Uint8Array;
    try {
      data = new Uint8Array(readFileSync(SAMPLE));
    } catch {
      writeFileSync(SCOREBOARD, JSON.stringify({ skipped: `no sample at ${SAMPLE}` }, null, 1));
      return;
    }

    const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await getDocument({ data, isEvalSupported: false }).promise;
    const codes = {
      setFillRGBColor: OPS.setFillRGBColor,
      constructPath: OPS.constructPath,
      fill: OPS.fill,
      eoFill: OPS.eoFill,
      fillStroke: OPS.fillStroke,
      save: OPS.save,
      restore: OPS.restore,
      transform: OPS.transform,
    };

    const fills: string[] = [];
    let totalShapes = 0;
    const perPage: { page: number; shapes: number }[] = [];
    // A spread of build pages, avoiding the cover and the legal pages.
    for (const pageNumber of [12, 40, 80, 120, 160, 200]) {
      const page = await document.getPage(pageNumber);
      const operators = (await page.getOperatorList()) as unknown as OperatorList;
      const shapes = extractPageShapes(operators, codes);
      totalShapes += shapes.length;
      perPage.push({ page: pageNumber, shapes: shapes.length });
      for (const shape of shapes) fills.push(shape.fillHex);
      page.cleanup();
    }
    await document.destroy();

    const coverage = scoreColorCoverage(fills);
    writeFileSync(
      SCOREBOARD,
      JSON.stringify(
        {
          totalShapes,
          perPage,
          distinctFills: coverage.distinctFills,
          matched: coverage.matched,
          matchedFraction: Math.round(coverage.matchedFraction * 1000) / 1000,
          unmatchedSample: coverage.unmatched.slice(0, 12).map(({ fillHex, nearest }) => ({
            fillHex,
            nearest: nearest?.displayName ?? null,
            distance: Math.round(nearest?.distance ?? 0),
          })),
        },
        null,
        1,
      ),
    );
    expect(totalShapes).toBeGreaterThan(0);
  }, 300_000);
});
