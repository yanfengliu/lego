import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import {
  extractBookletStructure,
  selectStepNumberHeight,
  withoutPrintedPageNumbers,
} from "../src/instructions/booklet-structure";
import { ingestInstructionPdf, type PdfDocument } from "../src/instructions/ingest-pdf";
import { extractPageShapes, type OperatorList } from "../src/instructions/page-shapes";
import { extractPartsInventory } from "../src/instructions/parts-inventory";
import { deriveStepPanels } from "../src/instructions/step-panels";
import { SAMPLE_BOOKLET_PATH, bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";

/**
 * Cuts the part thumbnail out of every step callout.
 *
 * A step prints, for each part it adds, a small picture of that part with its
 * quantity beside it — the same drawing convention the back-of-book inventory
 * uses, at a different size. So the same content-sized cell crop works, and the
 * result is a per-step parts list to match against the inventory gallery.
 *
 * Unlike the inventory these cells are not on a fixed grid, so a cell's width is
 * bounded by its neighbours in the same row and its height read from its own
 * content. Nothing here identifies a part; it only cuts out the picture and
 * records which step printed it.
 */
const OUT = "output/callout-thumbnails";
/**
 * Cropping the whole booklet takes minutes, which is too slow for a gate that
 * runs on every commit, so a few pages are cropped by default and the full pass
 * is opt-in: `CALLOUT_PAGE_LIMIT=0 npx playwright test ...`.
 */
const PAGE_LIMIT = Number(process.env.CALLOUT_PAGE_LIMIT ?? "8");

test("crops the part thumbnail from every step callout", async ({ page }) => {
  test.setTimeout(3_000_000);
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

  const structure = extractBookletStructure(source);
  const sightings = source.pages.flatMap((p) =>
    p.textElements
      .filter(({ text }) => /^\d{1,4}$/.test(text))
      .map(({ text, heightPt }) => ({
        value: Number(text),
        pageNumber: p.pageNumber,
        heightPt: Math.round(heightPt * 10) / 10,
      })),
  );
  const stepNumberHeightPt = selectStepNumberHeight(sightings);
  expect(stepNumberHeightPt).not.toBeNull();
  const panels = deriveStepPanels(source, { stepNumberHeightPt: stepNumberHeightPt! });
  expect(withoutPrintedPageNumbers(sightings).length).toBeGreaterThan(0);

  // The inventory prints quantities too; those cells are not step callouts.
  const inventoryPages = new Set(extractPartsInventory(source).pageNumbers);
  const stepPages = [...new Set(panels.map(({ pageNumber }) => pageNumber))]
    .filter((pageNumber) => !inventoryPages.has(pageNumber))
    .sort((left, right) => left - right);
  const pages = PAGE_LIMIT > 0 ? stepPages.slice(0, PAGE_LIMIT) : stepPages;

  // Callout boxes bound the search. Without them a flood started under a label
  // escapes into the main assembly art, and every label near that art returns
  // the same slab: 216 of 926 crops came back byte-identical before this.
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const shapeDoc = await getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
  }).promise;
  const shapeCodes = {
    setFillRGBColor: OPS.setFillRGBColor,
    constructPath: OPS.constructPath,
    fill: OPS.fill,
    eoFill: OPS.eoFill,
    fillStroke: OPS.fillStroke,
    save: OPS.save,
    restore: OPS.restore,
    transform: OPS.transform,
  };

  let withoutBox = 0;
  const manifest: {
    file: string;
    pageNumber: number;
    stepNumber: number | null;
    quantity: number;
  }[] = [];
  await page.goto("/");

  for (const pageNumber of pages) {
    const sourcePage = source.pages.find((p) => p.pageNumber === pageNumber)!;
    const quantities = sourcePage.textElements
      .map((element) => ({ element, match: /^(\d{1,3})x$/.exec(element.text) }))
      .filter(({ match }) => match !== null)
      .map(({ element, match }) => ({
        quantity: Number(match![1]),
        xPt: element.xPt,
        yPt: element.yPt,
      }));
    // The text layer draws a label's glyph run more than once at the very same
    // spot - six "4x" at one point on page 111 - and each repeat would become
    // its own callout for the same picture, inflating both the callout count
    // and the pieces they add up to.
    const seenAt = new Set<string>();
    const distinct = quantities.filter(({ quantity, xPt, yPt }) => {
      const key = `${quantity}@${xPt.toFixed(1)},${yPt.toFixed(1)}`;
      if (seenAt.has(key)) return false;
      seenAt.add(key);
      return true;
    });
    if (distinct.length === 0) continue;

    // The smallest filled shape a label sits in is its callout box; the page
    // background is a filled shape too, so page-sized ones are not boxes.
    const shapePage = await shapeDoc.getPage(pageNumber);
    const shapeViewport = shapePage.getViewport({ scale: 1 });
    const pageArea = shapeViewport.width * shapeViewport.height;
    const boxes = extractPageShapes(
      (await shapePage.getOperatorList()) as unknown as OperatorList,
      shapeCodes,
    ).filter(({ bounds }) => {
      const width = bounds.maxXPt - bounds.minXPt;
      const height = bounds.maxYPt - bounds.minYPt;
      return width > 25 && height > 25 && width * height < pageArea * 0.5;
    });

    const boxed = distinct
      .map((entry) => {
        const containing = boxes
          .filter(
            ({ bounds }) =>
              entry.xPt >= bounds.minXPt &&
              entry.xPt <= bounds.maxXPt &&
              entry.yPt >= bounds.minYPt &&
              entry.yPt <= bounds.maxYPt,
          )
          .sort(
            (left, right) =>
              (left.bounds.maxXPt - left.bounds.minXPt) *
                (left.bounds.maxYPt - left.bounds.minYPt) -
              (right.bounds.maxXPt - right.bounds.minXPt) *
                (right.bounds.maxYPt - right.bounds.minYPt),
          );
        return { ...entry, box: containing[0]?.bounds ?? null };
      })
      .filter((entry) => {
        if (entry.box === null) withoutBox += 1;
        return entry.box !== null;
      });
    if (boxed.length === 0) continue;

    const crops = await page.evaluate(
      async ({ pdfjsUrl, workerUrl, pdfUrl, pageNumber, quantities }) => {
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
        // Callout boxes are drawn on a pale panel; sample it inside the box, not
        // at the page margin, by taking the most common colour just above a label.
        const colourAt = (x: number, y: number): [number, number, number] => {
          const at = (y * canvas.width + x) * 4;
          return [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!];
        };
        const differs = (
          x: number,
          y: number,
          background: readonly [number, number, number],
        ): boolean => {
          const [r, g, b] = colourAt(x, y);
          return (
            Math.abs(r - background[0]) +
              Math.abs(g - background[1]) +
              Math.abs(b - background[2]) >
            30
          );
        };

        /**
         * The part drawn above a label, as one connected blob of non-background
         * pixels. A window around the label is the wrong shape — the art sits
         * above and to the right of it, and a long part reaches into the next
         * cell's window — so the blob's own extent is taken instead.
         */
        const floodFrom = (
          seedX: number,
          seedY: number,
          background: readonly [number, number, number],
          budget: number,
          limit: { left: number; top: number; right: number; bottom: number },
        ): {
          left: number;
          top: number;
          right: number;
          bottom: number;
          size: number;
          filled: Set<number>;
        } | null => {
          const seen = new Set<number>();
          const filled = new Set<number>();
          const stack = [seedY * canvas.width + seedX];
          let left = seedX;
          let right = seedX;
          let top = seedY;
          let bottom = seedY;
          let size = 0;
          while (stack.length > 0 && size < budget) {
            const at = stack.pop()!;
            if (seen.has(at)) continue;
            seen.add(at);
            const x = at % canvas.width;
            const y = (at - x) / canvas.width;
            if (x < limit.left || x > limit.right || y < limit.top || y > limit.bottom) continue;
            if (!differs(x, y, background)) continue;
            filled.add(at);
            size += 1;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
            if (x > 0) stack.push(at - 1);
            if (x < canvas.width - 1) stack.push(at + 1);
            if (y > 0) stack.push(at - canvas.width);
            if (y < canvas.height - 1) stack.push(at + canvas.width);
          }
          return size === 0 ? null : { left, top, right, bottom, size, filled };
        };

        const out: { index: number; url: string; quantity: number; xPt: number; yPt: number }[] =
          [];
        let index = 0;
        for (const entry of quantities) {
          if (entry.box === null) continue;
          // pdfjs y grows upward; the raster grows downward.
          const rasterY = viewport.height / scale - entry.yPt;
          // Start above the label's own glyphs, or the flood latches onto "1x".
          const labelTop = Math.round((rasterY - 9) * scale);
          const rasterX = Math.round(entry.xPt * scale);
          if (labelTop < 8) continue;
          if (labelTop < 8) continue;

          // Climb from just above the label to the first pixel of the artwork.
          let blob: ReturnType<typeof floodFrom> = null;
          const MIN_PART_PIXELS = 90 * scale * scale;
          // The part is inside the label's own callout box, never outside it.
          const pageHeightPt = viewport.height / scale;
          const box = {
            left: Math.max(0, Math.round(entry.box.minXPt * scale)),
            right: Math.min(canvas.width - 1, Math.round(entry.box.maxXPt * scale)),
            top: Math.max(0, Math.round((pageHeightPt - entry.box.maxYPt) * scale)),
            bottom: Math.min(
              canvas.height - 1,
              Math.round((pageHeightPt - entry.box.minYPt) * scale),
            ),
          };
          // The box's own most common colour is its background. Sampling a single
          // pixel beside the label instead took whatever sat there - and on a
          // dark callout box that is not the box's fill, so every pixel inside
          // "differs" and the flood swallows the whole box.
          const tally = new Map<string, number>();
          const stepX = Math.max(1, Math.floor((box.right - box.left) / 60));
          const stepY = Math.max(1, Math.floor((box.bottom - box.top) / 60));
          for (let y = box.top; y <= box.bottom; y += stepY) {
            for (let x = box.left; x <= box.right; x += stepX) {
              const [r, g, b] = colourAt(x, y);
              const key = `${r >> 3},${g >> 3},${b >> 3}`;
              tally.set(key, (tally.get(key) ?? 0) + 1);
            }
          }
          let commonest = "";
          let seenMost = 0;
          for (const [key, count] of tally) {
            if (count > seenMost) {
              seenMost = count;
              commonest = key;
            }
          }
          const background = commonest.split(",").map((channel) => (Number(channel) << 3) + 4) as [
            number,
            number,
            number,
          ];

          const spanRight = Math.min(box.right, rasterX + Math.round(96 * scale));
          const spanLeft = Math.max(box.left, rasterX - Math.round(10 * scale));
          for (
            let y = labelTop;
            y >= Math.max(box.top, labelTop - Math.round(52 * scale));
            y -= 1
          ) {
            for (let x = spanLeft; x <= spanRight; x += 1) {
              if (!differs(x, y, background)) continue;
              const found = floodFrom(x, y, background, 4_000_000, box);
              // A callout box's rule encloses a large area with very few pixels;
              // a drawn part fills a good share of its own bounding box.
              const area = found
                ? (found.right - found.left + 1) * (found.bottom - found.top + 1)
                : 0;
              const isOutline = found !== null && found.size / area < 0.12;
              if (found && !isOutline && found.size > MIN_PART_PIXELS) {
                blob = found;
                break;
              }
            }
            if (blob) break;
          }
          if (!blob) continue;

          const pad = Math.round(0.6 * scale);
          const left = Math.max(0, blob.left - pad);
          const top = Math.max(0, blob.top - pad);
          const width = Math.min(canvas.width - left, blob.right - blob.left + 2 * pad);
          const height = Math.min(canvas.height - top, blob.bottom - blob.top + 2 * pad);
          if (width < 16 || height < 16) continue;

          // Paint the blob alone. A part drawn on a diagonal has a bounding box
          // wide enough to contain the next part in the row, and cropping that
          // box hands the reader two parts and asks about one.
          const cell = document.createElement("canvas");
          cell.width = width;
          cell.height = height;
          const cellCtx = cell.getContext("2d")!;
          const image = cellCtx.createImageData(width, height);
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              const from = ((top + y) * canvas.width + (left + x)) * 4;
              const to = (y * width + x) * 4;
              const inBlob = blob.filled.has((top + y) * canvas.width + (left + x));
              image.data[to] = inBlob ? pixels[from]! : background[0];
              image.data[to + 1] = inBlob ? pixels[from + 1]! : background[1];
              image.data[to + 2] = inBlob ? pixels[from + 2]! : background[2];
              image.data[to + 3] = 255;
            }
          }
          cellCtx.putImageData(image, 0, 0);
          out.push({
            index: index++,
            url: cell.toDataURL("image/png"),
            quantity: entry.quantity,
            xPt: entry.xPt,
            yPt: entry.yPt,
          });
        }
        return out;
      },
      { ...bookletProbeUrls(), pageNumber, quantities: boxed },
    );

    for (const crop of crops) {
      const file = `p${pageNumber}-c${crop.index}.png`;
      writeFileSync(`${OUT}/${file}`, Buffer.from(crop.url.split(",")[1]!, "base64"));
      // A callout belongs to the step whose panel band it is printed in.
      const panel = panels.find(
        (candidate) =>
          candidate.pageNumber === pageNumber &&
          crop.xPt >= candidate.bounds.minXPt &&
          crop.xPt < candidate.bounds.maxXPt,
      );
      manifest.push({
        file,
        pageNumber,
        stepNumber: panel?.stepNumber ?? null,
        quantity: crop.quantity,
      });
    }
  }

  // A page-limited run must not overwrite a full pass's manifest: the gate runs
  // this spec with the default limit, and doing so silently truncated the
  // record of a completed full pass to the handful of pages the gate cropped.
  const manifestFile = PAGE_LIMIT > 0 ? "manifest.partial.json" : "manifest.json";
  writeFileSync(
    `${OUT}/${manifestFile}`,
    JSON.stringify(
      {
        note: "One crop per step callout. Quantities and step assignment come from the text layer.",
        pageLimit: PAGE_LIMIT === 0 ? "full booklet" : PAGE_LIMIT,
        quantitiesOutsideAnyCallout: withoutBox,
        sourceHash: structure.sourceHash,
        pagesCropped: pages.length,
        calloutCount: manifest.length,
        piecesCalledOut: manifest.reduce((total, { quantity }) => total + quantity, 0),
        callouts: manifest,
      },
      null,
      1,
    ),
  );
  console.log(
    `cropped ${manifest.length} callouts over ${pages.length} pages, ` +
      `${manifest.reduce((t, { quantity }) => t + quantity, 0)} pieces, ` +
      `${manifest.filter(({ stepNumber }) => stepNumber === null).length} unassigned to a step, ` +
      `${withoutBox} quantities outside any callout box`,
  );
  expect(manifest.length).toBeGreaterThan(0);
});
