import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";

const SCOREBOARD = "output/stud-pitch.json";
// A spread across the booklet. Only 12, 40, 120, 160 and 200 appear in the
// hand-labelled fixture the estimator was tuned against; the rest are pages it
// has never been shown, and the scale check below is what they are here for.
const PAGES = [12, 24, 40, 56, 80, 96, 120, 144, 160, 176, 200, 216];
/**
 * Two scales, because the check that cannot be fooled is that the measured
 * pitch tracks them: render the same page half again as large and a real
 * scallop period grows by the same factor, while anything read out of raster
 * noise does not. The ratio is deliberately not 2, so that a harmonic lock at
 * one scale cannot pass by coincidence.
 *
 * Both are large. What separates a drawn stud from raster stair-stepping is
 * that the stud moves the edge by more than a pixel, and rendering bigger grows
 * the stud while leaving the stair where it was — so resolution buys recall
 * without the threshold being softened to buy it.
 */
const SCALES = [4, 6] as const;
const SCALE_RATIO = SCALES[1] / SCALES[0];

interface RegionPitch {
  readonly regionIndex: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly outlinePixels: number;
  readonly pitchPx: number | null;
  readonly rejected: string | null;
  readonly rippleRows: number;
  readonly runsUsed: number;
  readonly columnsUsed: number;
  readonly centreX: number;
  readonly pageWidthPx: number;
  /** The region's own width in studs, once a pitch is known. */
  readonly studsAcross: number | null;
}

/**
 * A highlight outline shows the added parts' stud bumps as scallops along its
 * upper edge. The scallop period is the stud pitch in pixels, and once that is
 * known a region's extent converts to studs — which is what turns a highlight
 * from "the delta is here" into "the delta is this many studs across".
 *
 * Steps that add tiles, or parts seen edge-on, have no scallops at all, so a
 * page where nothing is measurable is a correct result rather than a failure.
 * What is reported here is how much of the booklet does carry a pitch, and
 * whether the pitches recovered stand up to being checked.
 */
test("measures stud pitch from highlight scallops", async ({ page }) => {
  test.setTimeout(600_000);
  test.skip(!hasSampleBooklet, "no sample booklet");
  await page.goto("/");
  mkdirSync("output", { recursive: true });

  const perPage: Record<string, unknown>[] = [];

  for (const pageNumber of PAGES) {
    const byScale: Record<number, RegionPitch[]> = {};

    for (const scale of SCALES) {
      byScale[scale] = await page.evaluate(
        async ({ pdfjsUrl, workerUrl, pdfUrl, studPitchUrl, pageNumber, scale }) => {
          // The probe drives the module the app itself would use, not a copy of it.
          const { splitIntoRuns, estimateStudPitch } = await import(
            /* @vite-ignore */ studPitchUrl
          );
          const pdfjs = await import(/* @vite-ignore */ pdfjsUrl);
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          const bytes = new Uint8Array(await (await fetch(pdfUrl)).arrayBuffer());
          const doc = await pdfjs.getDocument({ data: bytes }).promise;
          const pdfPage = await doc.getPage(pageNumber);
          const viewport = pdfPage.getViewport({ scale });

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

          // The highlight is a saturated yellow stroke; page art is grey or black.
          const mask = new Uint8Array(width * height);
          for (let i = 0; i < width * height; i += 1) {
            const r = data[i * 4]!;
            const g = data[i * 4 + 1]!;
            const b = data[i * 4 + 2]!;
            if (r > 150 && g > 130 && b < 110 && Math.abs(r - g) < 70 && r - b > 70) mask[i] = 1;
          }

          // Connected components, iterative so a long outline cannot blow the stack.
          const labels = new Int32Array(width * height).fill(-1);
          const boxes: { x0: number; y0: number; x1: number; y1: number; size: number }[] = [];
          const stack: number[] = [];
          for (let seed = 0; seed < mask.length; seed += 1) {
            if (mask[seed] !== 1 || labels[seed] !== -1) continue;
            const id = boxes.length;
            const box = { x0: width, y0: height, x1: 0, y1: 0, size: 0 };
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

          // One outline per part group; specks are anti-aliasing, not silhouette.
          const regions = boxes
            .map((box, id) => ({ ...box, id }))
            .filter(({ size }) => size >= 100 * scale)
            .sort((left, right) => right.size - left.size)
            .slice(0, 12);

          return regions.map((region, regionIndex) => {
            // Topmost outlined row per column, for this region alone. Taking it
            // across the whole page walks between unrelated outlines.
            const profile: (number | null)[] = [];
            for (let x = region.x0; x <= region.x1; x += 1) {
              let top: number | null = null;
              for (let y = region.y0; y <= region.y1; y += 1) {
                if (labels[y * width + x] === region.id) {
                  top = y;
                  break;
                }
              }
              profile.push(top);
            }

            const runs = splitIntoRuns(profile);
            const estimate = estimateStudPitch(runs);
            const widthPx = region.x1 - region.x0 + 1;
            return {
              regionIndex,
              widthPx,
              heightPx: region.y1 - region.y0 + 1,
              outlinePixels: region.size,
              pitchPx: estimate.pitchPx,
              rejected: estimate.rejected,
              rippleRows: Math.round(estimate.rippleRows * 100) / 100,
              runsUsed: estimate.runsUsed,
              columnsUsed: estimate.columnsUsed,
              centreX: (region.x0 + region.x1) / 2,
              pageWidthPx: width,
              studsAcross:
                estimate.pitchPx === null
                  ? null
                  : Math.round((widthPx / estimate.pitchPx) * 100) / 100,
            };
          });
        },
        {
          ...bookletProbeUrls(),
          studPitchUrl: "/src/instructions/stud-pitch.ts",
          pageNumber,
          scale,
        },
      );
    }

    // The same region, drawn larger, must give a pitch larger by the same factor.
    const small = byScale[SCALES[0]]!;
    const large = byScale[SCALES[1]]!;
    const scaleChecks = small
      .map((region, index) => {
        const counterpart = large[index];
        if (!counterpart || region.pitchPx === null || counterpart.pitchPx === null) return null;
        return {
          regionIndex: index,
          ratio: Math.round((counterpart.pitchPx / region.pitchPx) * 1000) / 1000,
        };
      })
      .filter((entry): entry is { regionIndex: number; ratio: number } => entry !== null);

    // Regions printed in the same panel were drawn at one zoom, so their
    // pitches must agree. Panels sit side by side, so the page midpoint
    // separates them — the same split `deriveStepPanels` makes from the text.
    const panels = new Map<string, number[]>();
    for (const region of large) {
      if (region.pitchPx === null) continue;
      const side = region.centreX < region.pageWidthPx / 2 ? "left" : "right";
      panels.set(side, [...(panels.get(side) ?? []), region.pitchPx]);
    }
    const panelAgreement = [...panels.entries()]
      .filter(([, pitches]) => pitches.length >= 2)
      .map(([side, pitches]) => ({
        side,
        regions: pitches.length,
        spread:
          Math.round(
            ((Math.max(...pitches) - Math.min(...pitches)) /
              (pitches.reduce((sum, pitch) => sum + pitch, 0) / pitches.length)) *
              1000,
          ) / 1000,
      }));

    perPage.push({
      pageNumber,
      regionsFound: large.length,
      regionsMeasured: large.filter(({ pitchPx }) => pitchPx !== null).length,
      regions: large,
      scaleChecks,
      panelAgreement,
      refusals: large
        .filter(({ rejected }) => rejected !== null)
        .map(({ regionIndex, rejected }) => ({ regionIndex, rejected })),
    });
  }

  const allRegions = perPage.flatMap((entry) => entry.regions as RegionPitch[]);
  const measured = allRegions.filter(({ pitchPx }) => pitchPx !== null);
  const ratios = perPage.flatMap((entry) =>
    (entry.scaleChecks as { ratio: number }[]).map(({ ratio }) => ratio),
  );
  const spreads = perPage
    .flatMap((entry) => entry.panelAgreement as { spread: number }[])
    .map(({ spread }) => spread)
    .sort((left, right) => left - right);

  writeFileSync(
    SCOREBOARD,
    JSON.stringify(
      {
        renderScales: SCALES,
        pagesSampled: PAGES.length,
        regionsFound: allRegions.length,
        regionsMeasured: measured.length,
        measuredFraction:
          Math.round((measured.length / Math.max(1, allRegions.length)) * 1000) / 1000,
        // Does the pitch track the render scale? Nothing read out of raster
        // noise survives this, because noise does not grow with resolution.
        scaleRatio: {
          expected: SCALE_RATIO,
          checked: ratios.length,
          within5pct: ratios.filter((ratio) => Math.abs(ratio - SCALE_RATIO) <= 0.05 * SCALE_RATIO)
            .length,
          sample: ratios.slice(0, 12),
        },
        // Do independent outlines in one panel, drawn at one zoom, agree?
        panelAgreement: {
          panelsWithTwoOrMore: spreads.length,
          medianSpread: spreads.length === 0 ? null : spreads[Math.floor(spreads.length / 2)],
          within5pct: spreads.filter((spread) => spread <= 0.05).length,
        },
        perPage,
      },
      null,
      1,
    ),
  );

  // The probe must have had something to look at; what it concluded is the
  // scoreboard's business, not an assertion's.
  expect(allRegions.length).toBeGreaterThan(0);
});
