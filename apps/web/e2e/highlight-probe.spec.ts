import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

const OUT =
  "C:/Users/38909/AppData/Local/Temp/claude/C--Users-38909-Documents-github-lego/cf21f97d-d8f1-464b-a7d3-093b8f37be16/scratchpad/pdf";
const ROOT = "C:/Users/38909/Documents/github/lego";

/**
 * Instruction art outlines the parts a step adds. If that outline segments
 * cleanly it localises the per-step delta directly, which is the cheapest
 * possible handle on placement. This measures whether it does.
 */
test("measures how the step highlight segments", async ({ page }) => {
  test.setTimeout(300_000);
  test.skip(!existsSync(`${ROOT}/recipes/6651557.pdf`), "no sample booklet");
  await page.goto("/");
  mkdirSync("output", { recursive: true });
  const scoreboard: unknown[] = [];

  for (const pageNumber of [12, 120, 200]) {
    const result = await page.evaluate(
      async ({ pdfjsUrl, workerUrl, pdfUrl, pageNumber }) => {
        const pdfjs = await import(/* @vite-ignore */ pdfjsUrl);
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const bytes = new Uint8Array(await (await fetch(pdfUrl)).arrayBuffer());
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        const pdfPage = await doc.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: 2 });

        document.querySelectorAll("canvas.probe").forEach((c) => c.remove());
        const canvas = document.createElement("canvas");
        canvas.className = "probe";
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.cssText = "position:fixed;inset:0;z-index:99999";
        document.body.append(canvas);
        const ctx = canvas.getContext("2d")!;
        await pdfPage.render({ canvasContext: ctx, viewport, background: "#ffffff" }).promise;

        const { width, height } = canvas;
        const data = ctx.getImageData(0, 0, width, height).data;

        // The highlight is a saturated yellow: red and green high and close,
        // blue far below both. Page art is grey, black, white, or muted.
        const mask = new Uint8Array(width * height);
        const histogram = new Map<string, number>();
        let marked = 0;
        for (let i = 0; i < width * height; i += 1) {
          const r = data[i * 4]!;
          const g = data[i * 4 + 1]!;
          const b = data[i * 4 + 2]!;
          const isHighlight = r > 150 && g > 130 && b < 110 && Math.abs(r - g) < 70 && r - b > 70;
          if (isHighlight) {
            mask[i] = 1;
            marked += 1;
            const key = `#${[r, g, b].map((c) => (c >> 4).toString(16)).join("")}`;
            histogram.set(key, (histogram.get(key) ?? 0) + 1);
          }
        }

        // Connected components, 4-way, iterative so a long outline cannot blow the stack.
        const labels = new Int32Array(width * height).fill(-1);
        const boxes: { x0: number; y0: number; x1: number; y1: number; size: number }[] = [];
        const stack: number[] = [];
        for (let seed = 0; seed < mask.length; seed += 1) {
          if (mask[seed] !== 1 || labels[seed] !== -1) continue;
          const id = boxes.length;
          const box = {
            x0: width,
            y0: height,
            x1: 0,
            y1: 0,
            size: 0,
          };
          stack.push(seed);
          labels[seed] = id;
          while (stack.length > 0) {
            const at = stack.pop()!;
            const x = at % width;
            const y = (at - x) / width;
            box.x0 = Math.min(box.x0, x);
            box.y0 = Math.min(box.y0, y);
            box.x1 = Math.max(box.x1, x);
            box.y1 = Math.max(box.y1, y);
            box.size += 1;
            for (const next of [
              x > 0 ? at - 1 : -1,
              x < width - 1 ? at + 1 : -1,
              y > 0 ? at - width : -1,
              y < height - 1 ? at + width : -1,
            ]) {
              if (next >= 0 && mask[next] === 1 && labels[next] === -1) {
                labels[next] = id;
                stack.push(next);
              }
            }
          }
          boxes.push(box);
        }

        // Paint the mask so it can be looked at, not just counted.
        const overlay = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < mask.length; i += 1) {
          const keep = mask[i] === 1;
          overlay.data[i * 4] = keep ? 255 : 20;
          overlay.data[i * 4 + 1] = keep ? 0 : 20;
          overlay.data[i * 4 + 2] = keep ? 255 : 20;
          overlay.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(overlay, 0, 0);
        await doc.destroy();

        const significant = boxes.filter((b) => b.size >= 400);
        return {
          width,
          height,
          highlightPixels: marked,
          componentsTotal: boxes.length,
          componentsSignificant: significant.length,
          largest: significant
            .sort((a, b) => b.size - a.size)
            .slice(0, 8)
            .map((b) => ({ size: b.size, w: b.x1 - b.x0, h: b.y1 - b.y0 })),
          colours: [...histogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
        };
      },
      {
        pdfjsUrl: `/@fs/${ROOT}/node_modules/pdfjs-dist/build/pdf.mjs`,
        workerUrl: `/@fs/${ROOT}/node_modules/pdfjs-dist/build/pdf.worker.mjs`,
        pdfUrl: `/@fs/${ROOT}/recipes/6651557.pdf`,
        pageNumber,
      },
    );
    scoreboard.push({ pageNumber, ...result });
    await page.locator("canvas.probe").screenshot({ path: `${OUT}/mask-${pageNumber}.png` });
    expect(result.highlightPixels).toBeGreaterThan(0);
  }
  writeFileSync("output/highlight-score.json", JSON.stringify(scoreboard, null, 1));
});
