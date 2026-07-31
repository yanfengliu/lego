import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { checkBookletConsistency, extractBookletStructure } from "./booklet-structure";
import { ingestInstructionPdf } from "./ingest-pdf";
import type { PdfDocument } from "./ingest-pdf";

/**
 * Scores the booklet parse against a real instruction PDF and writes the result
 * where iteration can read it. The sample is not committed, so this reports a
 * skip rather than failing when it is absent.
 *
 * This is a scoreboard, not a gate: it asserts only that the harness ran. The
 * numbers it records are what the parse is driven against.
 */
const SAMPLE = "recipes/6651557.pdf";
// Artifact roots are ignored; scores are evidence for iteration, not source.
const SCOREBOARD = "output/booklet-score.json";

async function loadSampleDocument(): Promise<PdfDocument | null> {
  let data: Uint8Array;
  try {
    data = new Uint8Array(readFileSync(SAMPLE));
  } catch {
    return null;
  }
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return (await getDocument({ data, isEvalSupported: false }).promise) as unknown as PdfDocument;
}

describe("booklet parse scoreboard", () => {
  it("scores the real booklet's step scaffolding", async () => {
    mkdirSync("output", { recursive: true });
    const document = await loadSampleDocument();
    if (!document) {
      writeFileSync(SCOREBOARD, JSON.stringify({ skipped: `no sample at ${SAMPLE}` }, null, 1));
      return;
    }

    const source = await ingestInstructionPdf(
      { name: "6651557.pdf", arrayBuffer: async () => readFileSync(SAMPLE).buffer as ArrayBuffer },
      { loadPdf: async () => document },
    );
    const structure = extractBookletStructure(source);
    const consistency = checkBookletConsistency(structure);

    writeFileSync(
      SCOREBOARD,
      JSON.stringify(
        {
          pageCount: structure.pageCount,
          stepsRecovered: consistency.stepCount,
          highestStep: consistency.highestStep,
          sequenceCoverage: Math.round(consistency.sequenceCoverage * 1000) / 1000,
          sequenceContiguous: consistency.sequenceContiguous,
          totalCalloutPieces: consistency.totalCalloutPieces,
          findings: consistency.findings,
          sampleUnclassified: structure.pages
            .flatMap((page) => page.other)
            .filter((token, index, all) => all.indexOf(token) === index)
            .slice(0, 20),
        },
        null,
        1,
      ),
    );

    expect(structure.pageCount).toBeGreaterThan(0);
  }, 300_000);
});
