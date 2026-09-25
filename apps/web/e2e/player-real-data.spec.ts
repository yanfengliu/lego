import { expect, test } from "@playwright/test";

import { skipWithoutRunEvidence } from "./run-evidence-gate";

/**
 * The build player on the real set: the player data `npm run booklet` wrote to
 * output/booklet/player/21066/ and the booklet at recipes/6651557.pdf, both
 * served by this checkout's dev server. Opt in with LEGO_RUN_EVIDENCE=1;
 * opted in, missing data fails by name (the page says to run npm start).
 *
 * The expected pages are read off the booklet itself, not taken from
 * steps.json: step 1 is printed on page 11, steps 31 and 32 on pages 35 and
 * 36, step 44 on page 45 and step 359 on page 219.
 *
 * Bound: it checks what the page and the scene report, not the pixels.
 */
test("plays the real 21066 build beside its booklet pages", async ({ page }) => {
  skipWithoutRunEvidence(
    test,
    "reads the generated 21066 player data and the booklet PDF, which a clean clone lacks",
  );
  test.setTimeout(300_000);
  await page.goto("/");
  const label = page.locator(".step-label");
  const view = page.locator(".model-view");
  const panel = page.locator(".page-panel");
  const steps = (await (await page.request.get("/player-data/21066/steps.json")).json()) as {
    set: { partCount: number };
  };

  await expect(label).toHaveText(/^Step 1 \/ 359 · page 11 · \+\d+ parts?$/u, { timeout: 120_000 });
  await expect(view).toHaveAttribute("data-step", "1", { timeout: 120_000 });
  await expect(panel).toHaveAttribute("data-rendered-page", "11", { timeout: 120_000 });

  await label.click();
  await page.keyboard.press("End");
  await expect(label).toHaveText(/^Step 359 \/ 359 · page 219 · /u);
  await expect(view).toHaveAttribute("data-visible-parts", String(steps.set.partCount));
  await expect(panel).toHaveAttribute("data-rendered-page", "219", { timeout: 60_000 });

  await page.keyboard.press("Home");
  await expect(view).toHaveAttribute("data-step", "1");
  let current = 1;
  for (const [step, bookletPage] of [
    [31, 35],
    [32, 36],
    [44, 45],
  ] as const) {
    for (; current < step; current += 1) await page.keyboard.press("ArrowRight");
    await expect(view).toHaveAttribute("data-step", String(step));
    await expect(label).toHaveText(new RegExp(`^Step ${step} / 359 · page ${bookletPage} · `, "u"));
    await expect(panel).toHaveAttribute("data-rendered-page", String(bookletPage), {
      timeout: 60_000,
    });
  }
  await page.keyboard.press("ArrowLeft");
  await expect(view).toHaveAttribute("data-step", "43");
});
