import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

const ROOT = "C:/Users/38909/Documents/github/lego";

/**
 * A highlight outline shows the added parts' stud bumps as scallops along its
 * upper edge. The scallop period is the stud pitch in pixels, and once that is
 * known a region's extent converts to studs — which is what turns a highlight
 * from "the delta is here" into "the delta is this many studs across".
 */
test("measures stud pitch from highlight scallops", async ({ page }) => {
  test.setTimeout(300_000);
  test.skip(!existsSync(`${ROOT}/recipes/6651557.pdf`), "no sample booklet");
  await page.goto("/");
  mkdirSync("output", { recursive: true });
  const scoreboard: unknown[] = [];

  for (const pageNumber of [12, 40, 120, 200]) {
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
        document.body.append(canvas);
        const ctx = canvas.getContext("2d")!;
        await pdfPage.render({ canvasContext: ctx, viewport, background: "#ffffff" }).promise;
        const { width, height } = canvas;
        const data = ctx.getImageData(0, 0, width, height).data;
        await doc.destroy();

        const mask = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i += 1) {
          const r = data[i * 4]!;
          const g = data[i * 4 + 1]!;
          const b = data[i * 4 + 2]!;
          if (r > 150 && g > 130 && b < 110 && Math.abs(r - g) < 70 && r - b > 70) mask[i] = 1;
        }

        // Topmost highlighted pixel per column: the silhouette's upper edge.
        const top: number[] = [];
        const columns: number[] = [];
        for (let x = 0; x < width; x += 1) {
          for (let y = 0; y < height; y += 1) {
            if (mask[y * width + x] === 1) {
              columns.push(x);
              top.push(y);
              break;
            }
          }
        }
        if (top.length < 40) return { pageNumber, columns: top.length, pitchPx: null };

        // Detrend: the edge runs on an isometric diagonal, so remove the slope
        // and leave only the scallop ripple.
        const n = top.length;
        const meanX = columns.reduce((s, v) => s + v, 0) / n;
        const meanY = top.reduce((s, v) => s + v, 0) / n;
        let num = 0;
        let den = 0;
        for (let i = 0; i < n; i += 1) {
          num += (columns[i]! - meanX) * (top[i]! - meanY);
          den += (columns[i]! - meanX) ** 2;
        }
        const slope = den === 0 ? 0 : num / den;
        const ripple = top.map((y, i) => y - (meanY + slope * (columns[i]! - meanX)));

        // Autocorrelation peak over plausible stud pitches.
        let best = { lag: 0, score: -Infinity };
        const scores: { lag: number; score: number }[] = [];
        for (let lag = 6; lag <= 60; lag += 1) {
          let sum = 0;
          let count = 0;
          for (let i = 0; i + lag < n; i += 1) {
            sum += ripple[i]! * ripple[i + lag]!;
            count += 1;
          }
          if (count < 20) continue;
          const score = sum / count;
          scores.push({ lag, score: Math.round(score * 100) / 100 });
          if (score > best.score) best = { lag, score };
        }

        // A real period shows as a peak with lower scores on either side. Scores
        // that only fall as the lag grows are the tail of a trend this detrend
        // failed to remove, so there is no scallop period to report.
        const ordered = [...scores].sort((left, right) => left.lag - right.lag);
        const monotonic = ordered.every(
          (entry, index) => index === 0 || entry.score <= ordered[index - 1]!.score,
        );
        return {
          pageNumber,
          columns: top.length,
          pitchPx: monotonic ? null : best.lag,
          rejected: monotonic
            ? "autocorrelation decays monotonically, so the profile still carries a trend and no scallop period is recoverable this way"
            : null,
          peakScore: Math.round(best.score * 100) / 100,
          topScores: scores.sort((left, right) => right.score - left.score).slice(0, 5),
        };
      },
      {
        pdfjsUrl: `/@fs/${ROOT}/node_modules/pdfjs-dist/build/pdf.mjs`,
        workerUrl: `/@fs/${ROOT}/node_modules/pdfjs-dist/build/pdf.worker.mjs`,
        pdfUrl: `/@fs/${ROOT}/recipes/6651557.pdf`,
        pageNumber,
      },
    );
    scoreboard.push(result);
  }

  writeFileSync("output/stud-pitch.json", JSON.stringify(scoreboard, null, 1));
  expect(scoreboard.length).toBeGreaterThan(0);
});
