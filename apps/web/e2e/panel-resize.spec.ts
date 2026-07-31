import { expect, test } from "@playwright/test";

const SHOTS =
  "C:/Users/38909/AppData/Local/Temp/claude/C--Users-38909-Documents-github-lego/cf21f97d-d8f1-464b-a7d3-093b8f37be16/scratchpad/shots";

test("resizes both side panels by dragging their splitters", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");

  const catalog = page.locator(".catalog-panel");
  const inspector = page.locator(".inspector-panel");
  const before = {
    catalog: (await catalog.boundingBox())!.width,
    inspector: (await inspector.boundingBox())!.width,
  };

  // Widen the catalog by dragging its splitter to the right.
  const left = page.getByRole("separator", { name: "Resize the part catalog" });
  const leftBox = (await left.boundingBox())!;
  await page.mouse.move(leftBox.x + leftBox.width / 2, leftBox.y + 200);
  await page.mouse.down();
  await page.mouse.move(leftBox.x + leftBox.width / 2 + 120, leftBox.y + 200, { steps: 8 });
  await page.mouse.up();

  // Widen the inspector by dragging its splitter to the left.
  const right = page.getByRole("separator", { name: "Resize the inspector" });
  const rightBox = (await right.boundingBox())!;
  await page.mouse.move(rightBox.x + rightBox.width / 2, rightBox.y + 200);
  await page.mouse.down();
  await page.mouse.move(rightBox.x + rightBox.width / 2 - 90, rightBox.y + 200, { steps: 8 });
  await page.mouse.up();

  const after = {
    catalog: (await catalog.boundingBox())!.width,
    inspector: (await inspector.boundingBox())!.width,
  };
  expect(after.catalog).toBeGreaterThan(before.catalog + 100);
  expect(after.inspector).toBeGreaterThan(before.inspector + 70);

  // The viewport must follow the new layout rather than keeping a stale size.
  const canvas = (await page.locator("canvas.brick-canvas").boundingBox())!;
  const workspace = (await page.locator(".workspace").boundingBox())!;
  expect(Math.abs(canvas.width - workspace.width)).toBeLessThan(4);

  await page.screenshot({ path: `${SHOTS}/06-resized.png` });

  // Clamps hold: dragging far past the minimum stops at it.
  await page.mouse.move(rightBox.x + 400, rightBox.y + 200);
  await page.mouse.down();
  await page.mouse.move(rightBox.x + 1600, rightBox.y + 200, { steps: 4 });
  await page.mouse.up();
  expect((await inspector.boundingBox())!.width).toBeGreaterThanOrEqual(239);
});
