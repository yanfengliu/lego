import { test, expect } from "@playwright/test";

import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";

/**
 * Rasterises booklet pages so they can actually be looked at. Reading a page
 * from its operator list is not the same as seeing it: the brick art in this
 * booklet is raster, and an operator-level reader sees only the page furniture
 * drawn around it.
 */

const OUT = "output/pdf-pages";

test("renders booklet pages as a reader sees them", async ({ page }) => {
  test.setTimeout(300_000);
  // The sample booklet is not committed; without it there is nothing to render.
  test.skip(!hasSampleBooklet, "no sample booklet");
  page.on("pageerror", (e) => console.log("PAGEERROR " + e.message));
  await page.goto("/");

  const pageNumbers = [1, 12, 40, 120, 200];
  for (const pageNumber of pageNumbers) {
    const ok = await page.evaluate(
      async ({ pdfjsUrl, workerUrl, pdfUrl, pageNumber }) => {
        const pdfjs = await import(/* @vite-ignore */ pdfjsUrl);
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const bytes = new Uint8Array(await (await fetch(pdfUrl)).arrayBuffer());
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        const pdfPage = await doc.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: 1.6 });

        document.querySelectorAll("canvas.probe").forEach((c) => c.remove());
        const canvas = document.createElement("canvas");
        canvas.className = "probe";
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fff";
        document.body.append(canvas);
        await pdfPage.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
          background: "#ffffff",
        }).promise;
        await doc.destroy();
        return true;
      },
      {
        ...bookletProbeUrls(),
        pageNumber,
      },
    );
    expect(ok).toBe(true);
    await page.locator("canvas.probe").screenshot({ path: `${OUT}/page-${pageNumber}.png` });
  }
});
