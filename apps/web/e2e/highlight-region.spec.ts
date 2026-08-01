import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";

const OUT = "output/highlight-region";
const PAGES = [12, 24, 40, 60, 80, 100, 120, 140, 160, 180, 200, 214];
const HIGHLIGHT_REGION_MODULE_URL: string = "/src/instructions/highlight-region.ts";

/**
 * The step highlight is the closed-loop score's target, so what matters is not
 * that the yellow keys out — that was already measured — but that each stroke
 * encloses a region a render can be scored against.
 *
 * This drives the real extractor over real pages and paints the filled region
 * over the page art, because an area alone cannot say whether the fill landed
 * on the parts the step adds or bled across the page.
 */
test("fills the region each step's highlight encloses", async ({ page }) => {
  test.setTimeout(300_000);
  test.skip(!hasSampleBooklet, "no sample booklet");
  await page.goto("/");
  mkdirSync(OUT, { recursive: true });
  const scoreboard: unknown[] = [];

  for (const pageNumber of PAGES) {
    const result = await page.evaluate(
      async ({ pdfjsUrl, workerUrl, pdfUrl, moduleUrl, pageNumber }) => {
        const { extractHighlightRegions } = await import(/* @vite-ignore */ moduleUrl);
        const pdfjs = await import(/* @vite-ignore */ pdfjsUrl);
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const bytes = new Uint8Array(await (await fetch(pdfUrl)).arrayBuffer());
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        const pdfPage = await doc.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: 2 });

        document.querySelectorAll("canvas.probe").forEach((canvas) => canvas.remove());
        const canvas = document.createElement("canvas");
        canvas.className = "probe";
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.cssText = "position:fixed;inset:0;z-index:99999";
        document.body.append(canvas);
        const context = canvas.getContext("2d")!;
        await pdfPage.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;

        const { width, height } = canvas;
        const image = context.getImageData(0, 0, width, height);
        const extraction = extractHighlightRegions(image.data, width, height);

        // Tint what was enclosed, over the page art rather than instead of it,
        // so the fill can be checked against the parts it claims to cover.
        for (let index = 0; index < width * height; index += 1) {
          if (extraction.mask[index] !== 1) continue;
          image.data[index * 4] = Math.min(255, image.data[index * 4]! * 0.35 + 200);
          image.data[index * 4 + 1] = image.data[index * 4 + 1]! * 0.35;
          image.data[index * 4 + 2] = image.data[index * 4 + 2]! * 0.35 + 120;
        }
        context.putImageData(image, 0, 0);
        await doc.destroy();

        const filled = extraction.mask.reduce((total: number, value: number) => total + value, 0);
        return {
          pageNumber,
          width,
          height,
          keyedPx: extraction.keyedPx,
          regions: extraction.regions.length,
          leakedRegions: extraction.leakedRegions,
          discardedComponents: extraction.discardedComponents,
          filledPx: filled,
          filledShareOfPage: filled / (width * height),
          closedContourRate: extraction.closedContourRate,
          strokePx: extraction.strokeMask.reduce(
            (total: number, value: number) => total + value,
            0,
          ),
          largest: extraction.regions
            .slice(0, 6)
            .map((region: { areaPx: number; outlinePx: number; enclosedPx: number }) => ({
              areaPx: region.areaPx,
              outlinePx: region.outlinePx,
              enclosedPx: region.enclosedPx,
            })),
        };
      },
      { ...bookletProbeUrls(), moduleUrl: HIGHLIGHT_REGION_MODULE_URL, pageNumber },
    );

    scoreboard.push(result);
    await page.locator("canvas.probe").screenshot({ path: `${OUT}/page-${pageNumber}.png` });
  }

  // Every page is measured before anything is asserted: a probe that stops at
  // the first bad page reports one number and hides four.
  writeFileSync(`${OUT}/score.json`, JSON.stringify(scoreboard, null, 1));

  const pages = scoreboard as {
    pageNumber: number;
    regions: number;
    leakedRegions: number;
    filledShareOfPage: number;
  }[];
  const contours = pages.reduce((total, entry) => total + entry.regions, 0);
  const openContours = pages.reduce((total, entry) => total + entry.leakedRegions, 0);
  writeFileSync(
    `${OUT}/score.json`,
    JSON.stringify(
      { contours, openContours, closedContourRate: 1 - openContours / contours, pages: scoreboard },
      null,
      1,
    ).replace('"openContours"', '"openContours"'),
  );

  expect(pages.filter((entry) => entry.regions === 0)).toEqual([]);
  // Every page must yield a highlight, and the fill must stay inside it: a fill
  // covering a quarter of the page escaped its outline, whatever the count says.
  for (const entry of pages) expect(entry.filledShareOfPage).toBeLessThan(0.25);
  // Measured at 19 of 36 contours closed over these twelve pages. The rest are
  // steps whose new parts pass behind something already built, where the
  // booklet stops the yellow at the occluding edge and never draws across it;
  // those are scored against the stroke rather than an enclosed area. This
  // guards the extractor, not the booklet: a drop here means closed contours
  // stopped closing, which is a regression in the fill.
  expect(1 - openContours / contours).toBeGreaterThan(0.45);
  // Every page still yields printed yellow, whether or not it encloses.
  for (const entry of pages) expect(entry.regions).toBeGreaterThan(0);
});
