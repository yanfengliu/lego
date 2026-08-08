import { expect, test, type Page } from "@playwright/test";

/** Picks a palette part by its visible name, the way a builder chooses a brick. */
async function armPart(page: Page, name: string): Promise<void> {
  await page
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .first()
    .click();
}

async function partCount(page: Page): Promise<number> {
  return page.evaluate(() => window.get_model_snapshot!().partCount);
}

async function clickAt(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  // The ghost resolves on pointer move, so let it settle before committing.
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.mouse.up();
}

test("builds a model by clicking the palette and the viewport", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Reset scene" }).click();
  await expect.poll(() => partCount(page)).toBe(0);

  const box = (await page.locator("canvas.brick-canvas").boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // Clicking a part arms it; clicking the model places it. No dragging.
  await armPart(page, "Brick 2 x 4");
  await clickAt(page, centre.x, centre.y + 60);
  await expect.poll(() => partCount(page)).toBe(1);

  // The tool stays armed, so a second brick lands on the first.
  await clickAt(page, centre.x, centre.y + 20);
  await expect.poll(() => partCount(page)).toBe(2);

  // A different colour and a studless tile to finish.
  await page.getByRole("button", { name: /All \d+ colors/ }).click();
  await page.getByLabel("Yellow", { exact: true }).click();
  await armPart(page, "Tile 2 x 4");
  await clickAt(page, centre.x, centre.y - 10);
  await expect.poll(() => partCount(page)).toBe(3);

  const observation = await page.evaluate(() => JSON.parse(window.render_app_to_text!()));
  expect(observation.validation.documentGloballyValid).toBe(true);
  expect(
    observation.document.parts.map((part: { catalogPartId: string }) => part.catalogPartId),
  ).toContain("builtin:tile-2x4");
  expect(
    observation.document.parts.some(
      (part: { colorId: string }) => part.colorId === "builtin:yellow",
    ),
  ).toBe(true);
  // Every placement opened its own step, so the build is replayable.
  expect(observation.document.steps).toHaveLength(3);

  // The canonical capture hook, checked against a real built model rather than
  // an empty scene. This repository's whole verification story rests on looking
  // at what it renders, and `capture_model_views()` is the one door to those
  // pictures — a hook that quietly returned four views would leave every caller
  // still passing while three viewpoints went unlooked at. The names are spelt
  // out rather than imported from `CANONICAL_VIEW_NAMES` on purpose: importing
  // the list would make dropping a view from the constant invisible here.
  // Source of truth: `packages/rendering/src/cameras.ts`.
  const captures = await page.evaluate(() => window.capture_model_views!());
  expect(Object.keys(captures).sort()).toEqual([
    "back",
    "front",
    "isometric",
    "left",
    "right",
    "top",
    "underside",
  ]);
  expect(Object.values(captures).every((value) => value.startsWith("data:image/png"))).toBe(true);

  expect(consoleErrors).toEqual([]);
});

test("steps through the build it just made", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Reset scene" }).click();
  await expect.poll(() => partCount(page)).toBe(0);

  const box = (await page.locator("canvas.brick-canvas").boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await armPart(page, "Brick 2 x 4");
  await clickAt(page, centre.x, centre.y + 60);
  await clickAt(page, centre.x, centre.y + 20);
  await expect.poll(() => partCount(page)).toBe(2);

  await page.getByRole("button", { name: /Build/ }).click();
  const scrubber = page.locator(".playback-scrubber input");
  await expect(scrubber).toHaveAttribute("max", "2");

  // The base state holds nothing, and each step adds exactly one part.
  await expect(page.locator(".playback-readout")).toContainText("0 parts");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.locator(".playback-readout")).toContainText("1 parts");
  await expect(page.locator(".playback-verdict")).toHaveText("verified");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.locator(".playback-readout")).toContainText("2 parts");
});

test("never leaves a brick floating, wherever the user clicks", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Reset scene" }).click();
  await expect.poll(() => partCount(page)).toBe(0);

  const box = (await page.locator("canvas.brick-canvas").boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await armPart(page, "Brick 2 x 2");

  // Clicking all over the viewport, including empty sky above the model, must
  // never produce a part with nothing under it.
  const spots: readonly (readonly [number, number])[] = [
    [0, 80],
    [-120, 40],
    [140, 90],
    [0, -220],
    [-200, -160],
  ];
  for (const [dx, dy] of spots) {
    await clickAt(page, centre.x + dx, centre.y + dy);
  }

  const observation = await page.evaluate(() => JSON.parse(window.render_app_to_text!()));
  const parts: { transform: { positionLdu: [number, number, number] } }[] =
    observation.document.parts;
  expect(parts.length).toBeGreaterThan(0);

  // Every placed brick rests on the plate or on another brick: no part sits
  // above the plate without a connection holding it.
  const connectedPartIds = new Set(
    observation.document.connections.flatMap(
      ({ a, b }: { a: { partId: string }; b: { partId: string } }) => [a.partId, b.partId],
    ),
  );
  for (const part of observation.document.parts) {
    const restsOnPlate = part.transform.positionLdu[1] === 0;
    expect(restsOnPlate || connectedPartIds.has(part.id)).toBe(true);
  }
});
