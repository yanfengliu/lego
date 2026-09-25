import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

/**
 * The build player's controls, driven through the page on a synthetic
 * committed fixture (FIXTURE_MPD below and fixtures/player/steps.json) and a
 * generated two-page booklet. The player's
 * data requests are answered from the fixture, so this runs on a clean clone.
 *
 * Bound: it checks what the page says and what the scene reports it shows
 * (data-step, data-visible-parts, data-highlighted-parts,
 * data-rendered-page), not the pixels; the real set is looked at by eye and
 * opted into with LEGO_RUN_EVIDENCE=1 (player-real-data.spec.ts).
 */
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/player/${name}`, import.meta.url));

/**
 * Three printed steps of inline boxes, the second adding nothing. It is kept
 * here as text because the BOM's source policy keeps raw LDraw files (.mpd,
 * .ldr, .dat) out of apps/.
 */
const FIXTURE_MPD = [
  "0 FILE fixture.ldr",
  "0 Synthetic fixture: three printed steps, the second adding nothing",
  "0 Name: fixture.ldr",
  "0 Author: lego repository (synthetic e2e fixture)",
  "0 !COLOUR Main_Colour CODE 16 VALUE #7F7F7F EDGE #333333",
  "0 !COLOUR Edge_Colour CODE 24 VALUE #7F7F7F EDGE #333333",
  "0 !COLOUR Blue CODE 1 VALUE #1E5AA8 EDGE #333333",
  "0 !COLOUR Red CODE 4 VALUE #B40000 EDGE #333333",
  "0 !COLOUR Trans_Clear CODE 47 VALUE #FCFCFC EDGE #C3C3C3 ALPHA 128",
  "1 4 0 0 0 1 0 0 0 1 0 0 0 1 box.dat",
  "1 1 60 0 0 1 0 0 0 1 0 0 0 1 box.dat",
  "0 STEP",
  "0 STEP",
  "1 47 30 -24 0 1 0 0 0 1 0 0 0 1 box.dat",
  "0 STEP",
  "",
  "0 FILE box.dat",
  "0 Synthetic box 2 x 2 x 1",
  "0 Name: box.dat",
  "0 !LDRAW_ORG Part",
  "0 BFC NOCERTIFY",
  "4 16 -20 -24 -20 20 -24 -20 20 -24 20 -20 -24 20",
  "4 16 -20 0 -20 -20 0 20 20 0 20 20 0 -20",
  "4 16 -20 0 -20 20 0 -20 20 -24 -20 -20 -24 -20",
  "4 16 -20 0 20 -20 -24 20 20 -24 20 20 0 20",
  "4 16 -20 0 -20 -20 -24 -20 -20 -24 20 -20 0 20",
  "4 16 20 0 -20 20 0 20 20 -24 20 20 -24 -20",
  "2 24 -20 -24 -20 20 -24 -20",
  "2 24 20 -24 -20 20 -24 20",
  "2 24 20 -24 20 -20 -24 20",
  "2 24 -20 -24 20 -20 -24 -20",
  "2 24 -20 0 -20 20 0 -20",
  "2 24 20 0 -20 20 0 20",
  "2 24 20 0 20 -20 0 20",
  "2 24 -20 0 20 -20 0 -20",
  "2 24 -20 0 -20 -20 -24 -20",
  "2 24 20 0 -20 20 -24 -20",
  "2 24 20 0 20 20 -24 20",
  "2 24 -20 0 20 -20 -24 20",
].join("\n");

/** A two-page PDF, each page one filled rectangle, with an exact cross-reference table. */
function twoPagePdf(): Buffer {
  const drawings = ["0.1 0.3 0.8 rg 40 40 160 100 re f", "0.8 0.2 0.1 rg 200 150 160 100 re f"];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Contents 4 0 R >>",
    `<< /Length ${drawings[0]!.length} >>\nstream\n${drawings[0]}\nendstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Contents 6 0 R >>",
    `<< /Length ${drawings[1]!.length} >>\nstream\n${drawings[1]}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const entries = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`);
  return Buffer.from(
    `${body}xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries.join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF\n`,
  );
}

type Answer = { readonly status?: number; readonly type: string; readonly body: string | Buffer };

async function serveFixture(page: Page, overrides: Record<string, Answer> = {}): Promise<void> {
  const answers: Record<string, Answer> = {
    "/player-data/sets.json": {
      type: "application/json",
      body: JSON.stringify({
        version: "lego.player-sets/1",
        sets: [{ id: "fixture", name: "Synthetic fixture" }],
      }),
    },
    "/player-data/fixture/steps.json": { type: "application/json", body: fixture("steps.json") },
    "/player-data/fixture/model.mpd": { type: "text/plain", body: FIXTURE_MPD },
    "/player-data/fixture/booklet.pdf": { type: "application/pdf", body: twoPagePdf() },
    ...overrides,
  };
  await page.route("**/player-data/**", (route) => {
    const answer = answers[new URL(route.request().url()).pathname];
    return route.fulfill(
      answer
        ? { status: answer.status ?? 200, contentType: answer.type, body: answer.body }
        : { status: 404, contentType: "text/plain", body: "not in the fixture" },
    );
  });
}

test("plays, pauses and steps through a build with its buttons, scrubber and keys", async ({
  page,
}) => {
  await serveFixture(page);
  await page.goto("/");
  const label = page.locator(".step-label");
  const view = page.locator(".model-view");
  const panel = page.locator(".page-panel");
  const button = (name: string) => page.getByRole("button", { name, exact: true });
  const expectStep = async (text: string, visible: number) => {
    await expect(label).toHaveText(text);
    await expect(view).toHaveAttribute("data-visible-parts", String(visible));
  };

  // It starts at step 1 with step 1's parts shown and glowing, beside step 1's page.
  await expectStep("Step 1 / 3 · page 1 · +2 parts", 2);
  await expect(view).toHaveAttribute("data-highlighted-parts", "2");
  await expect(panel).toHaveAttribute("data-rendered-page", "1");
  await expect(page).toHaveTitle("Synthetic fixture · build player");
  // The glow fades after a moment.
  await expect(view).toHaveAttribute("data-highlighted-parts", "0", { timeout: 5_000 });

  await button("Next step").click();
  await expectStep("Step 2 / 3 · page 1 · +0 parts", 2);
  await button("Next step").click();
  await expectStep("Step 3 / 3 · page 2 · +1 part", 3);
  await expect(view).toHaveAttribute("data-highlighted-parts", "1");
  await expect(panel).toHaveAttribute("data-rendered-page", "2");
  await button("Next step").click();
  await expectStep("Step 3 / 3 · page 2 · +1 part", 3);
  await button("Previous step").click();
  await expectStep("Step 2 / 3 · page 1 · +0 parts", 2);
  await button("First step").click();
  await expectStep("Step 1 / 3 · page 1 · +2 parts", 2);
  await button("Last step").click();
  await expectStep("Step 3 / 3 · page 2 · +1 part", 3);

  // The scrubber: its own arrow keys, and a click at its left end.
  const scrubber = page.getByRole("slider", { name: "Step" });
  await scrubber.focus();
  await page.keyboard.press("ArrowLeft");
  await expectStep("Step 2 / 3 · page 1 · +0 parts", 2);
  const box = (await scrubber.boundingBox())!;
  await scrubber.click({ position: { x: 2, y: box.height / 2 } });
  await expectStep("Step 1 / 3 · page 1 · +2 parts", 2);

  // The player's keys, from the page: End, Home, and the arrows.
  await label.click();
  await page.keyboard.press("End");
  await expectStep("Step 3 / 3 · page 2 · +1 part", 3);
  await page.keyboard.press("Home");
  await expectStep("Step 1 / 3 · page 1 · +2 parts", 2);
  await page.keyboard.press("ArrowRight");
  await expectStep("Step 2 / 3 · page 1 · +0 parts", 2);
  await page.keyboard.press("ArrowLeft");
  await expectStep("Step 1 / 3 · page 1 · +2 parts", 2);

  // Play at 4x (0.375 s a step) runs to the last step and stops there.
  await page.getByRole("combobox").selectOption("4");
  await label.click();
  await page.keyboard.press("Space");
  await expect(button("Pause")).toBeVisible();
  await expectStep("Step 3 / 3 · page 2 · +1 part", 3);
  await expect(button("Play")).toBeVisible();

  // Space pauses while a button has focus. (Headless Chromium does not turn a
  // dispatched Space into that button's click, so the preventDefault that stops
  // a real one is not proven here.)
  await button("First step").click();
  await button("Play").click();
  await expect(button("Pause")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(button("Play")).toBeVisible();
  const paused = await label.textContent();
  await page.waitForTimeout(1_000);
  await expect(label).toHaveText(paused!);

  // Reset view leaves the step alone.
  await button("Reset view").click();
  await expect(view).toHaveAttribute("data-step", /^[123]$/u);
  await expect(label).toHaveText(paused!);
});

test("says plainly when the player data or the booklet is missing", async ({ page }) => {
  await serveFixture(page, {
    "/player-data/fixture/booklet.pdf": {
      status: 404,
      type: "text/plain",
      body: "booklet PDF not found at recipes/fixture.pdf; put the set's instruction booklet there.",
    },
  });
  await page.goto("/");
  // The model still plays without its booklet.
  await expect(page.locator(".step-label")).toHaveText("Step 1 / 3 · page 1 · +2 parts");
  await expect(page.locator(".page-panel")).toContainText(
    "booklet PDF not found at recipes/fixture.pdf",
  );

  const bare = await page.context().newPage();
  await serveFixture(bare, {
    "/player-data/fixture/steps.json": {
      status: 404,
      type: "text/plain",
      body: "Player data missing: output/booklet/player/fixture/steps.json does not exist; run npm start.",
    },
  });
  await bare.goto("/");
  await expect(bare.locator(".player-message")).toContainText(
    "Player data missing: run npm start.",
  );
  await expect(bare.locator(".player-message")).toContainText("steps.json does not exist");
});
