import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ingestInstructionPdf } from "./ingest-pdf";
import type { PdfDocument } from "./ingest-pdf";
import { checkInventoryConsistency, extractPartsInventory } from "./parts-inventory";

/**
 * Scores the inventory parse against the real booklet.
 *
 * The declared piece count is the one number here that comes from outside the
 * document, so agreeing with it is the strongest check this parse can be put
 * to: the booklet's own pages are the only input, and the total has to land on
 * a figure printed nowhere in them.
 *
 * A scoreboard, not a gate — it asserts the harness ran, and records the number.
 */
const SAMPLE = "recipes/6651557.pdf";
const SCOREBOARD = "output/inventory-score.json";
/** LEGO 21066 "New York City – The Big Apple", as the set declares it. */
const DECLARED_PIECE_COUNT = 1465;

/** The sample is uncommitted and a worktree keeps it in the checkout it was cut from. */
function findSample(): string | null {
  let directory = process.cwd();
  for (let depth = 0; depth < 12; depth += 1) {
    const candidate = resolve(directory, SAMPLE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

async function loadSampleDocument(path: string): Promise<PdfDocument> {
  const data = new Uint8Array(readFileSync(path));
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return (await getDocument({ data, isEvalSupported: false }).promise) as unknown as PdfDocument;
}

describe("parts inventory scoreboard", () => {
  it("scores the real booklet's parts inventory against the declared piece count", async () => {
    mkdirSync("output", { recursive: true });
    const path = findSample();
    if (!path) {
      writeFileSync(SCOREBOARD, JSON.stringify({ skipped: `no sample at ${SAMPLE}` }, null, 1));
      return;
    }

    const source = await ingestInstructionPdf(
      { name: "6651557.pdf", arrayBuffer: async () => readFileSync(path).buffer as ArrayBuffer },
      { loadPdf: async () => await loadSampleDocument(path) },
    );
    const inventory = extractPartsInventory(source);
    const consistency = checkInventoryConsistency(inventory, DECLARED_PIECE_COUNT);

    writeFileSync(
      SCOREBOARD,
      JSON.stringify(
        {
          inventoryPages: inventory.pageNumbers,
          distinctElements: consistency.distinctElements,
          totalPieces: consistency.totalPieces,
          declaredPieceCount: DECLARED_PIECE_COUNT,
          pieceCountMatches: consistency.pieceCountMatches,
          pairedFraction: Math.round(consistency.pairedFraction * 1000) / 1000,
          findings: consistency.findings,
          sampleEntries: inventory.entries.slice(0, 5),
        },
        null,
        1,
      ),
    );

    expect(inventory.pageNumbers.length).toBeGreaterThan(0);
  }, 300_000);
});
