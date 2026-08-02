import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { measureExplodedResolution, type ExplodedStepReport } from "./exploded-booklet";
import {
  ASSEMBLY_MODULE_URL,
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
} from "./workspace-module";

const OUT = "output/exploded-resolution";
const WIDTH = 560;
const HEIGHT = 420;

/**
 * Can a step drawn exploded be placed from the *next* step's picture?
 *
 * 19 of the sample booklet's first 50 steps draw the new part offset from where
 * it lands, with red arrows. `scoreStepDelta` compares a candidate's silhouette
 * against that step's yellow highlight, so on those steps it scores every
 * candidate against a shape in the wrong place and rejects the right answer.
 *
 * The answer costs no new art: step N+1 draws the assembly with step N's part
 * already in place, so what differs between panel N and panel N+1 is what step
 * N added. This measures whether that separates the true placement from every
 * other legal one, and by how much, over the whole candidate set — the booklet
 * is `exploded-booklet.ts`, and the score is the app's own `scoreExplodedStep`.
 *
 * The current highlight score runs alongside as the control. If it still ranks
 * the true placement first on an exploded step then the explosion was not
 * simulated and the rest of the numbers mean nothing.
 */
test("resolves an exploded step from the next step's panel", async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto("/");
  mkdirSync(OUT, { recursive: true });

  const result = await page.evaluate(measureExplodedResolution, {
    kernelUrl: BRICK_KERNEL_MODULE_URL,
    renderingUrl: RENDERING_MODULE_URL,
    commandsUrl: MANUAL_COMMANDS_MODULE_URL,
    assemblyUrl: ASSEMBLY_MODULE_URL,
    width: WIDTH,
    height: HEIGHT,
  });

  await page.locator("canvas.probe-exploded").screenshot({ path: `${OUT}/panel-exploded.png` });
  await page.locator("canvas.probe-next").screenshot({ path: `${OUT}/panel-next.png` });
  await page.locator("canvas.probe-emerged").screenshot({ path: `${OUT}/emerged.png` });

  const reports: ExplodedStepReport[] = result.patterns.flatMap((pattern) => pattern.steps);
  // A step with one legal placement separates nothing, so it is measured and
  // reported but never counted for or against a score.
  const contested = reports.filter((step) => step.exploded && !step.degenerate);
  const scoreboard = (metric: string) => {
    const margins = contested.map((step) => step.results[metric]!.margin ?? 0);
    return {
      resolved: contested.filter((step) => step.results[metric]!.uniquelyFirst).length,
      minMargin: margins.length === 0 ? null : Math.min(...margins),
      meanMargin:
        margins.length === 0
          ? null
          : margins.reduce((sum, value) => sum + value, 0) / margins.length,
    };
  };
  const summary = {
    explodedStepsMeasured: contested.length,
    byMetric: Object.fromEntries(result.metrics.map((metric) => [metric, scoreboard(metric)])),
    stepsWithNoEmergence: contested
      .filter((step) => step.emergedPx === 0)
      .map((step) => ({
        stepNumber: step.stepNumber,
        catalogPartId: step.catalogPartId,
        changedPx: step.changedPx,
      })),
    candidatesBeforePrune: contested.reduce((sum, step) => sum + step.distinctCandidates, 0),
    candidatesAfterPrune: contested.reduce((sum, step) => sum + step.survivingDeltaPrune, 0),
    truePlacementKeptByPrune: contested.filter(
      (step) => step.truePlacementSurvivesDeltaPrune === true,
    ).length,
  };
  writeFileSync(`${OUT}/score.json`, JSON.stringify({ summary, ...result }, null, 1));

  for (const step of reports) expect(step.truePlacementEnumerated).toBe(true);
  expect(contested.length).toBeGreaterThan(0);
  // The control. A displaced highlight must actually mislead the current score,
  // or the explosion was not simulated and nothing below is evidence.
  for (const step of contested) {
    expect(
      step.results.highlightScore!.uniquelyFirst,
      `Step ${step.stepNumber} is drawn exploded, yet the highlight score still ranked the true placement uniquely first. ` +
        `The ghost offset ${JSON.stringify(result.ghostOffsetLdu)} did not move the highlight off the landing site, so this run measures an in-place booklet.`,
    ).toBe(false);
  }
  // What the exploded score is for: the true placement, alone at the top, on
  // every exploded step — including the one where nothing emerged and the
  // difference reading has to carry it by itself.
  for (const step of contested) {
    expect(
      step.results.explodedScore!.uniquelyFirst,
      `Step ${step.stepNumber} is drawn exploded and the next panel did not resolve it: the true placement ranked ${step.results.explodedScore!.trueRank} of ${step.distinctCandidates} distinct placements ` +
        `(emerged ${step.emergedPx}px, changed ${step.changedPx}px). See ${OUT}/score.json for what outranked it.`,
    ).toBe(true);
  }
  // A prune that drops the answer is worse than no prune, so it is the true
  // placement's survival that is asserted, not the ratio.
  expect(summary.truePlacementKeptByPrune).toBe(contested.length);
  // Registration is free in a synthetic booklet and is not free in a printed
  // one, so the score is also run against a panel printed two pixels off. Where
  // something emerged that survives; where nothing did and the difference
  // reading is carrying the step alone it does not, which is the boundary of
  // what this signal can be trusted for — asserted rather than assumed.
  for (const step of contested.filter((entry) => entry.emergedPx > 0)) {
    expect(
      step.results.explodedScoreMisregistered!.uniquelyFirst,
      `Step ${step.stepNumber} had ${step.emergedPx}px emerge between the panels, yet ${result.misregistrationPx}px of registration error cost it the top rank ` +
        `(true placement ranked ${step.results.explodedScoreMisregistered!.trueRank} of ${step.distinctCandidates}). ` +
        `Emergence is the registration-tolerant half of the score; if it stops tolerating a couple of pixels, the panels are not being fitted to a common frame.`,
    ).toBe(true);
  }
});
