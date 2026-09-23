import { writeFileSync } from "node:fs";

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
  // Each placement opens a step for the non-exact final-membership preview.
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
  const modelOnlyCaptures = await page.evaluate(() =>
    window.capture_model_views!({ scene: "model-only" }),
  );
  expect(Object.keys(modelOnlyCaptures).sort()).toEqual(Object.keys(captures).sort());
  expect(modelOnlyCaptures.isometric).not.toBe(captures.isometric);
  await expect.poll(() => page.evaluate(() => window.capture_model_views!())).toEqual(captures);

  expect(consoleErrors).toEqual([]);
});

test("previews build membership without claiming an exact operation trace", async ({
  page,
}, testInfo) => {
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
  const startObservation = await page.evaluate(() => JSON.parse(window.render_app_to_text!()));
  expect(startObservation.document.parts).toHaveLength(2);
  expect(startObservation.playback).toMatchObject({
    mode: "membership-preview",
    exact: false,
    traceCommitment: null,
    position: 0,
    terminalPosition: 2,
    stepId: null,
    stepName: "Empty base",
    addedPartCount: 0,
    blockingCodes: [],
    buildable: true,
    connected: true,
  });
  expect(startObservation.playback.previewDocumentHash).not.toBe(startObservation.documentHash);
  expect(startObservation.renderer.viewPacket.documentHash).toBe(
    startObservation.playback.previewDocumentHash,
  );
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.locator(".playback-readout")).toContainText("1 parts");
  await expect(page.locator(".playback-verdict")).toHaveText("preview");
  await expect(page.locator(".playback-verdict")).toHaveAttribute(
    "title",
    "Final-membership preview only; no exact operation replay trace is attached",
  );
  const stepOneObservation = await page.evaluate(() => JSON.parse(window.render_app_to_text!()));
  expect(stepOneObservation.playback).toMatchObject({
    mode: "membership-preview",
    exact: false,
    traceCommitment: null,
    position: 1,
    terminalPosition: 2,
    addedPartCount: 1,
    blockingCodes: [],
    buildable: true,
    connected: true,
  });
  expect(stepOneObservation.playback.validation.targetDocumentHash).toBe(
    stepOneObservation.playback.previewDocumentHash,
  );
  expect(stepOneObservation.renderer.viewPacket.documentHash).toBe(
    stepOneObservation.playback.previewDocumentHash,
  );
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.locator(".playback-readout")).toContainText("2 parts");

  // Bound: both desktop sizes, including a short window. Check every control,
  // readout, verdict, and footer against its containing row and the viewport.
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const bar = document.querySelector(".playback-bar")!.getBoundingClientRect();
          const footer = document.querySelector(".viewport-footer")!.getBoundingClientRect();
          const controls = [...document.querySelectorAll(".playback-bar > *")];
          const visibleContents = [
            ...document.querySelectorAll(
              ".playback-bar button, .playback-bar input, .playback-readout strong, .playback-readout small, .playback-verdict, .viewport-footer > *",
            ),
          ];
          return (
            controls.every((control) => {
              const rect = control.getBoundingClientRect();
              return (
                rect.width > 0 &&
                rect.height > 0 &&
                rect.left >= bar.left &&
                rect.right <= bar.right &&
                rect.top >= bar.top &&
                rect.bottom <= bar.bottom
              );
            }) &&
            visibleContents.every((element) => {
              const rect = element.getBoundingClientRect();
              if (rect.width <= 0 || rect.height <= 0) return false;
              const container = element
                .closest(".playback-bar, .viewport-footer")!
                .getBoundingClientRect();
              if (
                rect.left < container.left ||
                rect.right > container.right ||
                rect.top < container.top ||
                rect.bottom > container.bottom
              )
                return false;
              if (element instanceof HTMLInputElement) return true;
              const range = document.createRange();
              range.selectNodeContents(element);
              return [...range.getClientRects()].every(
                (text) =>
                  text.width > 0 &&
                  text.height > 0 &&
                  text.left >= rect.left &&
                  text.right <= rect.right &&
                  text.top >= rect.top &&
                  text.bottom <= rect.bottom,
              );
            }) &&
            bar.left >= 0 &&
            bar.right <= innerWidth &&
            bar.top >= 0 &&
            bar.bottom <= footer.top &&
            footer.bottom <= innerHeight
          );
        }),
      )
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`playback-${size.width}x${size.height}.png`),
    });
  }
  const captures = await page.evaluate(() => window.capture_model_views!({ scene: "model-only" }));
  for (const [name, png] of Object.entries(captures)) {
    writeFileSync(
      testInfo.outputPath(`playback-model-${name}.png`),
      Buffer.from(png.split(",")[1]!, "base64"),
    );
  }
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
