import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import { ASSEMBLY_MODULE_URL } from "./workspace-module";
import { readSampleBooklet, sampleBookletCallouts, sampleBookletPanels } from "./booklet-fixture";

/**
 * What the first fifty printed steps actually contain.
 *
 * Everything downstream — which parts to add to the catalog, whether a step's
 * highlight is usable as a target, how many pieces a step places — depends on
 * reading this off the real booklet rather than assuming it. So this cuts the
 * fifty step panels out of the PDF, extracts each one's highlight, cuts out the
 * callout pictures that say what the step adds, and writes the lot to `output/`
 * to be looked at.
 *
 * It identifies nothing. It is the input the loop needs, measured.
 */
const OUT = "output/first-fifty";
const LAST_STEP = 50;
/** Enough to read a stud from a callout thumbnail; the panel is saved smaller. */
const RENDER_SCALE = 4;
const PANEL_WIDTH = 700;

test("reads the first fifty steps off the booklet", async ({ page }) => {
  test.setTimeout(1_800_000);
  test.skip(!hasSampleBooklet, "no sample booklet");
  mkdirSync(OUT, { recursive: true });

  const { bytes, source } = await readSampleBooklet();
  // Which pages hold the first fifty steps does not depend on how a page is
  // cut, so a cheap pass finds them and the callout boxes then sharpen the cut.
  const pages = [
    ...new Set(
      sampleBookletPanels(source)
        .filter((panel) => panel.stepNumber >= 1 && panel.stepNumber <= LAST_STEP)
        .map((panel) => panel.pageNumber),
    ),
  ].sort((a, b) => a - b);
  const callouts = await sampleBookletCallouts(bytes, source, pages);
  const boxesByPage = new Map(
    pages.map((pageNumber) => [
      pageNumber,
      callouts.filter((callout) => callout.pageNumber === pageNumber).map(({ box }) => box),
    ]),
  );
  const panels = sampleBookletPanels(source, boxesByPage).filter(
    (panel) => panel.stepNumber >= 1 && panel.stepNumber <= LAST_STEP,
  );
  expect(panels.length).toBeGreaterThan(0);

  await page.goto("/");
  interface StepEntry {
    stepNumber: number;
    pageNumber: number;
    width: number;
    height: number;
    regionCount: number;
    exploded: boolean;
    arrowPx: number;
    regions: unknown[];
    callouts: { quantity: number; index: number }[];
  }
  const manifest: StepEntry[] = [];

  for (const pageNumber of pages) {
    const pagePanels = panels.filter((panel) => panel.pageNumber === pageNumber);
    const pageCallouts = callouts.filter((callout) => callout.pageNumber === pageNumber);

    const result = await page.evaluate(
      async ({ pdfjsUrl, workerUrl, pdfUrl, assemblyUrl, pageNumber, scale, panelWidth, spec }) => {
        const pdfjs = await import(/* @vite-ignore */ pdfjsUrl);
        const assembly = await import(/* @vite-ignore */ assemblyUrl);
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const data = new Uint8Array(await (await fetch(pdfUrl)).arrayBuffer());
        const doc = await pdfjs.getDocument({ data }).promise;
        const pdfPage = await doc.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale });

        document.querySelectorAll("canvas.probe").forEach((node) => node.remove());
        const canvas = document.createElement("canvas");
        canvas.className = "probe";
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        // The booklet's page is a mid grey; rendering onto white would put a
        // white border round every crop and change what the keyer sees.
        await pdfPage.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
        await doc.destroy();

        // PDF points are bottom-left origin; canvas pixels are top-left.
        const toPx = (pt: number) => pt * scale;
        const crop = (x: number, y: number, w: number, h: number, outWidth: number) => {
          const out = document.createElement("canvas");
          const ratio = outWidth / w;
          out.width = Math.max(1, Math.round(outWidth));
          out.height = Math.max(1, Math.round(h * ratio));
          const outContext = out.getContext("2d")!;
          outContext.imageSmoothingEnabled = true;
          outContext.drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
          return out;
        };

        const panelReports = spec.panels.map((panel) => {
          const x = toPx(panel.minXPt);
          const w = toPx(panel.maxXPt - panel.minXPt);
          const y = canvas.height - toPx(panel.maxYPt);
          const h = toPx(panel.maxYPt - panel.minYPt);
          const out = crop(x, y, w, h, panelWidth);
          const outContext = out.getContext("2d", { willReadFrequently: true })!;
          const image = outContext.getImageData(0, 0, out.width, out.height);
          const highlight = assembly.extractHighlightRegions(image.data, out.width, out.height, {
            minimumOutlinePx: 40,
          });
          // A red arrow means the step is drawn exploded: the highlighted part
          // is displaced from where it ends up, so its silhouette says which
          // part and which way round, but not where. Nothing else on the page
          // is this red — the art is greys, the highlight is yellow.
          let arrowPx = 0;
          for (let index = 0; index < out.width * out.height; index += 1) {
            const r = image.data[index * 4]!;
            const g = image.data[index * 4 + 1]!;
            const b = image.data[index * 4 + 2]!;
            if (r > 150 && g < 90 && b < 90 && r - g > 80 && r - b > 80) arrowPx += 1;
          }
          return {
            arrowPx,
            stepNumber: panel.stepNumber,
            panelPng: out.toDataURL("image/png"),
            width: out.width,
            height: out.height,
            regions: highlight.regions.map(
              (region: {
                areaPx: number;
                outlinePx: number;
                enclosedPx: number;
                leaked: boolean;
                bounds: { minX: number; minY: number; maxX: number; maxY: number };
              }) => ({
                areaPx: region.areaPx,
                outlinePx: region.outlinePx,
                enclosedPx: region.enclosedPx,
                leaked: region.leaked,
                bounds: region.bounds,
              }),
            ),
          };
        });

        const calloutReports = spec.callouts.map((callout, index) => {
          const x = toPx(callout.minXPt);
          const y = canvas.height - toPx(callout.maxYPt);
          const w = toPx(callout.maxXPt - callout.minXPt);
          const h = toPx(callout.maxYPt - callout.minYPt);
          const out = crop(x, y, w, h, Math.min(320, Math.round(w)));
          return {
            index,
            stepNumber: callout.stepNumber,
            quantity: callout.quantity,
            png: out.toDataURL("image/png"),
          };
        });

        return { panels: panelReports, callouts: calloutReports };
      },
      {
        ...bookletProbeUrls(),
        assemblyUrl: ASSEMBLY_MODULE_URL,
        pageNumber,
        scale: RENDER_SCALE,
        panelWidth: PANEL_WIDTH,
        spec: {
          panels: pagePanels.map((panel) => ({
            stepNumber: panel.stepNumber,
            minXPt: panel.bounds.minXPt,
            maxXPt: panel.bounds.maxXPt,
            minYPt: panel.bounds.minYPt,
            maxYPt: panel.bounds.maxYPt,
          })),
          callouts: pageCallouts.map((callout) => ({
            stepNumber: callout.stepNumber,
            quantity: callout.quantity,
            minXPt: callout.box.minXPt,
            maxXPt: callout.box.maxXPt,
            minYPt: callout.box.minYPt,
            maxYPt: callout.box.maxYPt,
          })),
        },
      },
    );

    const write = (file: string, dataUrl: string) =>
      writeFileSync(`${OUT}/${file}`, Buffer.from(dataUrl.split(",")[1]!, "base64"));

    for (const panel of result.panels) {
      write(`panel-${String(panel.stepNumber).padStart(3, "0")}.png`, panel.panelPng);
    }
    for (const callout of result.callouts) {
      const step =
        callout.stepNumber === null ? "none" : String(callout.stepNumber).padStart(3, "0");
      write(`callout-${step}-${callout.index}-${callout.quantity}x.png`, callout.png);
    }

    for (const panel of result.panels) {
      manifest.push({
        stepNumber: panel.stepNumber,
        pageNumber,
        width: panel.width,
        height: panel.height,
        regionCount: panel.regions.length,
        // 60px of arrow survives antialiasing without catching stray red.
        exploded: panel.arrowPx >= 60,
        arrowPx: panel.arrowPx,
        regions: panel.regions,
        callouts: result.callouts
          .filter((callout) => callout.stepNumber === panel.stepNumber)
          .map((callout) => ({ quantity: callout.quantity, index: callout.index })),
      });
    }
  }

  const withRegion = manifest.filter((entry) => entry.regionCount > 0);
  const pieces = manifest.reduce(
    (total, entry) => total + entry.callouts.reduce((sum, callout) => sum + callout.quantity, 0),
    0,
  );
  const score = {
    lastStep: LAST_STEP,
    stepsFound: manifest.length,
    pages,
    stepsWithHighlight: withRegion.length,
    stepsWithoutHighlight: manifest
      .filter((entry) => entry.regionCount === 0)
      .map((entry) => entry.stepNumber),
    calloutPieces: pieces,
    stepsExploded: manifest.filter((entry) => entry.exploded).length,
    explodedSteps: manifest.filter((entry) => entry.exploded).map((entry) => entry.stepNumber),
    steps: manifest,
  };
  writeFileSync(`${OUT}/score.json`, JSON.stringify(score, null, 1));
  console.log(
    `steps ${manifest.length}/${LAST_STEP} on pages ${pages[0]}-${pages[pages.length - 1]}; ` +
      `${withRegion.length} with a highlight; ` +
      `${manifest.filter((entry) => entry.exploded).length} drawn exploded; ` +
      `${pieces} callout pieces`,
  );
  expect(manifest.length).toBeGreaterThan(0);
});
