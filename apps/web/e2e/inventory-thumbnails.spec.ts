import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { ingestInstructionPdf, type PdfDocument } from "../src/instructions/ingest-pdf";
import { extractPartsInventory } from "../src/instructions/parts-inventory";
import { SAMPLE_BOOKLET_PATH, bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";

/**
 * Cuts each inventory thumbnail out of the page it is printed on.
 *
 * This is what makes an image reader measurable. The element id beside every
 * thumbnail comes out of the text layer, so each crop arrives already labelled
 * without anything having looked at a picture — and the labels can be resolved
 * to real part names against a published inventory for the set. That turns
 * "does the reader work" from an impression into a score.
 *
 * A cell's height is read from its own content rather than assumed. The grid
 * row pitch is not the artwork's height: a 4x12 plate is drawn far taller than
 * a 1x1, and a fixed band cuts the top row of studs off the large parts without
 * failing, which is worse than failing.
 */
const OUT = "output/inventory-thumbnails";

test("crops a labelled thumbnail for every inventory element", async ({ page }) => {
  test.setTimeout(600_000);
  test.skip(!hasSampleBooklet, "no sample booklet");
  mkdirSync(OUT, { recursive: true });

  const bytes = readFileSync(SAMPLE_BOOKLET_PATH!);
  const source = await ingestInstructionPdf(
    { name: "6651557.pdf", arrayBuffer: async () => bytes.buffer as ArrayBuffer },
    {
      loadPdf: async () => {
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        return (await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
          .promise) as unknown as PdfDocument;
      },
    },
  );
  const inventory = extractPartsInventory(source);
  expect(inventory.entries.length).toBeGreaterThan(0);

  await page.goto("/");
  let written = 0;

  for (const pageNumber of inventory.pageNumbers) {
    const mine = inventory.entries
      .filter((entry) => entry.pageNumber === pageNumber)
      .map(({ elementId, xPt, yPt }) => ({ elementId, xPt, yPt }));

    const crops = await page.evaluate(
      async ({ pdfjsUrl, workerUrl, pdfUrl, pageNumber, mine }) => {
        const pdfjs = await import(/* @vite-ignore */ pdfjsUrl);
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const data = new Uint8Array(await (await fetch(pdfUrl)).arrayBuffer());
        const doc = await pdfjs.getDocument({ data }).promise;
        const pdfPage = await doc.getPage(pageNumber);
        const scale = 8;
        const viewport = pdfPage.getViewport({ scale });

        document.querySelectorAll("canvas.probe").forEach((node) => node.remove());
        const canvas = document.createElement("canvas");
        canvas.className = "probe";
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        document.body.append(canvas);
        const ctx = canvas.getContext("2d")!;
        await pdfPage.render({ canvasContext: ctx, viewport, background: "#ffffff" }).promise;
        await doc.destroy();

        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const corner = ((4 * canvas.width + (canvas.width - 4)) * 4) | 0;
        const background = [pixels[corner]!, pixels[corner + 1]!, pixels[corner + 2]!];
        const rowHasArt = (y: number, left: number, right: number): boolean => {
          for (let x = left; x < right; x += 1) {
            const at = (y * canvas.width + x) * 4;
            const delta =
              Math.abs(pixels[at]! - background[0]!) +
              Math.abs(pixels[at + 1]! - background[1]!) +
              Math.abs(pixels[at + 2]! - background[2]!);
            if (delta > 28) return true;
          }
          return false;
        };

        // Column pitch decides cell width; the last column runs to the margin.
        const columns = [...new Set(mine.map(({ xPt }) => Math.round(xPt * 10) / 10))].sort(
          (left, right) => left - right,
        );
        const widthFor = (xPt: number): number => {
          const index = columns.findIndex((column) => Math.abs(column - xPt) < 0.6);
          const next = columns[index + 1];
          return next === undefined ? 58 : next - columns[index]!;
        };

        const out: { elementId: string; url: string }[] = [];
        for (const entry of mine) {
          // `yPt` grows upward as pdfjs reports it; the raster grows downward.
          const rasterY = viewport.height / scale - entry.yPt;
          const left = Math.max(0, Math.round((entry.xPt - 3) * scale));
          const right = Math.min(
            canvas.width,
            Math.round((entry.xPt + widthFor(entry.xPt) - 4) * scale),
          );
          const bottom = Math.min(canvas.height, Math.round((rasterY - 8.6) * scale));
          if (right - left < 8 || bottom < 12) continue;

          // Climb until the art stops: a gap of clear rows is the cell's ceiling.
          let top = bottom;
          let clear = 0;
          for (let y = bottom - 1; y >= 0 && clear < Math.round(2.2 * scale); y -= 1) {
            if (rowHasArt(y, left, right)) {
              top = y;
              clear = 0;
            } else {
              clear += 1;
            }
          }
          top = Math.max(0, top - 4);
          const width = right - left;
          const height = bottom - top;
          if (width < 8 || height < 8) continue;

          const cell = document.createElement("canvas");
          cell.width = width;
          cell.height = height;
          cell.getContext("2d")!.drawImage(canvas, left, top, width, height, 0, 0, width, height);
          out.push({ elementId: entry.elementId, url: cell.toDataURL("image/png") });
        }
        return out;
      },
      { ...bookletProbeUrls(), pageNumber, mine },
    );

    for (const { elementId, url } of crops) {
      writeFileSync(`${OUT}/${elementId}.png`, Buffer.from(url.split(",")[1]!, "base64"));
      written += 1;
    }
  }

  writeFileSync(
    `${OUT}/labels.json`,
    JSON.stringify(
      {
        note: "Labels come from the booklet's text layer, not from reading any picture.",
        sourceHash: inventory.sourceHash,
        totalPieces: inventory.totalPieces,
        entries: inventory.entries.map(({ elementId, quantity }) => ({ elementId, quantity })),
      },
      null,
      1,
    ),
  );
  console.log(`wrote ${written} labelled thumbnails for ${inventory.distinctElements} elements`);
  expect(written).toBeGreaterThan(inventory.distinctElements * 0.9);
});
