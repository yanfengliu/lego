import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

/**
 * Renders every part whose solid is a union of boxes and writes the picture out
 * to be looked at.
 *
 * A part that renders as an anonymous box is not done: a Technic brick was
 * rejected for exactly that, because its hole is a connector and not geometry,
 * so it was pixel-identical to a plain 1x2. An arch, a slope and a corner plate
 * all claim a shape, and the only way to know they have one is to drive the
 * real app, place the part, and look at the canvas and the palette tile.
 *
 * The assertions here are the machine-checkable half: the part places, the
 * document stays valid, and the silhouette differs from the plain box of the
 * same footprint by a real margin. The other half is the file in `output/`.
 */
const OUT = "output/compound-parts";

/** Every compound part, with the plain part its shape must not be mistaken for. */
const CASES = [
  { name: "Arch 1 x 4", partId: "builtin:arch-1x4", plain: "Brick 1 x 4" },
  { name: "Arch 1 x 6", partId: "builtin:arch-1x6", plain: "Brick 1 x 6" },
  { name: "Curved slope 1 x 2", partId: "builtin:curved-slope-1x2", plain: "Plate 1 x 2" },
  { name: "Curved slope 1 x 3", partId: "builtin:curved-slope-1x3", plain: "Brick 1 x 3" },
  { name: "Curved slope 1 x 4", partId: "builtin:curved-slope-1x4", plain: "Brick 1 x 4" },
  { name: "Cheese slope 1 x 1", partId: "builtin:cheese-slope-1x1", plain: "Plate 1 x 1" },
  { name: "Cheese slope 2 x 1", partId: "builtin:cheese-slope-2x1", plain: "Plate 1 x 2" },
  { name: "Corner plate 2 x 2", partId: "builtin:corner-plate-2x2", plain: "Plate 2 x 2" },
] as const;

async function resetScene(page: Page): Promise<void> {
  // Registered once by the caller: a per-reset `page.once` leaves an unfired
  // handler behind whenever the scene is already empty, and the next reset then
  // has two handlers racing to accept one dialog.
  await page.getByRole("button", { name: "Reset scene" }).click();
  await expect.poll(() => page.evaluate(() => window.get_model_snapshot!().partCount)).toBe(0);
}

async function placeOne(page: Page, name: string): Promise<void> {
  await page
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .first()
    .click();
  const box = (await page.locator("canvas.brick-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40);
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.get_model_snapshot!().partCount)).toBe(1);
}

/** The fraction of pixels where two same-size captures disagree. */
function differingFraction(left: Buffer, right: Buffer): number {
  const length = Math.min(left.length, right.length);
  let differing = 0;
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) differing += 1;
  }
  return differing / length;
}

test("every compound part draws its own shape, not the box it sits in", async ({ page }) => {
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  page.on("dialog", (dialog) => void dialog.accept());

  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");

  for (const { name, partId, plain } of CASES) {
    await resetScene(page);
    await placeOne(page, name);

    const observation = await page.evaluate(() => JSON.parse(window.render_app_to_text!()));
    expect(
      observation.document.parts.map((part: { catalogPartId: string }) => part.catalogPartId),
    ).toEqual([partId]);
    expect(observation.validation.documentGloballyValid).toBe(true);

    const captures = await page.evaluate(() => window.capture_model_views!());
    const shaped: Record<string, Buffer> = {};
    for (const view of ["isometric", "front", "left"] as const) {
      const dataUrl = captures[view]!;
      const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
      shaped[view] = bytes;
      writeFileSync(`${OUT}/${partId.replace("builtin:", "")}-${view}.png`, bytes);
    }

    // The same viewpoint over the plain part of the same footprint. A shape
    // that matched it pixel for pixel would be the anonymous box again.
    await resetScene(page);
    await placeOne(page, plain);
    const plainCaptures = await page.evaluate(() => window.capture_model_views!());
    const plainIso = plainCaptures.isometric!;
    const plainBytes = Buffer.from(plainIso.slice(plainIso.indexOf(",") + 1), "base64");
    writeFileSync(`${OUT}/${partId.replace("builtin:", "")}-plain-isometric.png`, plainBytes);

    expect(
      differingFraction(shaped.isometric!, plainBytes),
      `${partId} renders the same bytes as ${plain}; a union of boxes that looks like its bounding box has not been drawn`,
    ).toBeGreaterThan(0.02);
  }

  expect(consoleErrors).toEqual([]);
});

test("the palette tile shows the same shape the viewport places", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");

  for (const { name, partId } of CASES) {
    const tile = page.getByRole("button", { name: new RegExp(`^${name}`) }).first();
    await tile.scrollIntoViewIfNeeded();
    await tile.screenshot({ path: `${OUT}/${partId.replace("builtin:", "")}-palette.png` });

    // The preview is drawn from the part's own body boxes, so a compound part
    // must draw more than the one polygon group a plain prism draws.
    const groups = await tile.locator("svg.part-preview > g").count();
    expect(groups, `${partId} palette tile drew ${groups} body boxes`).toBeGreaterThan(1);
  }
});
