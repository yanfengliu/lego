import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { checkBookletConsistency, extractBookletStructure } from "./booklet-structure";
import { ingestInstructionPdf, type PdfDocument } from "./ingest-pdf";
import { deriveStepPanels, summarizePanels } from "./step-panels";

const SAMPLE = "recipes/6651557.pdf";
const SCOREBOARD = "output/panels-score.json";

describe("step panel scoreboard", () => {
  it("scores panel recovery against the real booklet", async () => {
    mkdirSync("output", { recursive: true });
    let data: Uint8Array;
    try {
      data = new Uint8Array(readFileSync(SAMPLE));
    } catch {
      writeFileSync(SCOREBOARD, JSON.stringify({ skipped: `no sample at ${SAMPLE}` }, null, 1));
      return;
    }
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = (await getDocument({ data, isEvalSupported: false })
      .promise) as unknown as PdfDocument;
    const source = await ingestInstructionPdf(
      { name: "6651557.pdf", arrayBuffer: async () => readFileSync(SAMPLE).buffer as ArrayBuffer },
      { loadPdf: async () => document },
    );

    const structure = extractBookletStructure(source);
    const consistency = checkBookletConsistency(structure);
    // The structure pass already chose the size steps are set in; reuse it.
    const heights = source.pages.flatMap((page) =>
      page.textElements
        .filter(({ text }) => /^\d{1,4}$/.test(text))
        .map(({ heightPt }) => Math.round(heightPt * 10) / 10),
    );
    const stepNumberHeightPt = [...new Set(heights)]
      .map((height) => ({
        height,
        count: heights.filter((value) => value === height).length,
      }))
      .sort(
        (a, b) =>
          Math.abs(a.count - consistency.stepCount) - Math.abs(b.count - consistency.stepCount),
      )[0]!.height;

    const panels = deriveStepPanels(source, { stepNumberHeightPt });
    const summary = summarizePanels(panels);
    const stepsFromStructure = new Set(structure.steps.map(({ stepNumber }) => stepNumber));
    const stepsFromPanels = new Set(panels.map(({ stepNumber }) => stepNumber));
    const missing = [...stepsFromStructure].filter((step) => !stepsFromPanels.has(step));

    writeFileSync(
      SCOREBOARD,
      JSON.stringify(
        {
          stepNumberHeightPt,
          stepsFromStructure: stepsFromStructure.size,
          panelsDerived: summary.panelCount,
          stepsWithoutPanel: missing.length,
          stepsWithoutPanelSample: missing.slice(0, 10),
          panelsPerPage: summary.panelsPerPage,
          totalQuantityPieces: summary.totalQuantityPieces,
          structureQuantityPieces: structure.totalCalloutPieces,
          panelsWithoutQuantities: summary.panelsWithoutQuantities.length,
        },
        null,
        1,
      ),
    );
    expect(summary.panelCount).toBeGreaterThan(0);
  }, 300_000);
});
