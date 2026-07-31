import { expect, test, type Page } from "@playwright/test";

const SHOTS =
  "C:/Users/38909/AppData/Local/Temp/claude/C--Users-38909-Documents-github-lego/cf21f97d-d8f1-464b-a7d3-093b8f37be16/scratchpad/shots";

async function ready(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");
}

async function rename(page: Page, name: string): Promise<void> {
  await page
    .getByRole("button", { name: /Click to rename|^Untitled|copy$/ })
    .first()
    .click();
  const field = page.getByLabel("Project name");
  await field.fill(name);
  await field.press("Enter");
}

test("renames the project by clicking its title", async ({ page }) => {
  await ready(page);
  await rename(page, "Red Tower");
  await expect(page.locator(".project-title")).toHaveText("Red Tower");

  // The new name survives a reload, so the rename was actually saved.
  await page.waitForTimeout(300);
  await ready(page);
  await expect(page.locator(".project-title")).toHaveText("Red Tower");
});

test("abandons a rename on Escape", async ({ page }) => {
  await ready(page);
  const before = await page.locator(".project-title").textContent();
  await page.locator(".project-title").click();
  const field = page.getByLabel("Project name");
  await field.fill("Discarded name");
  await field.press("Escape");
  await expect(page.locator(".project-title")).toHaveText(before!);
});

test("creates, switches, duplicates, and deletes projects", async ({ page }) => {
  await ready(page);
  await rename(page, "First Model");
  await page.waitForTimeout(250);

  // A new project starts empty and does not disturb the first.
  await page.getByRole("button", { name: "Projects ▾" }).click();
  await page.getByRole("menuitem", { name: "New project" }).click();
  await expect.poll(() => page.evaluate(() => window.get_model_snapshot!().partCount)).toBe(0);
  await rename(page, "Second Model");
  await page.waitForTimeout(250);

  // Both projects are listed and switching back restores the first.
  await page.getByRole("button", { name: "Projects ▾" }).click();
  await expect(page.getByRole("menuitem", { name: /First Model/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/07-projects.png` });
  await page.getByRole("menuitem", { name: /First Model/ }).click();
  await expect(page.locator(".project-title")).toHaveText("First Model");

  // Duplicating opens a copy that is a distinct project.
  await page.getByRole("button", { name: "Projects ▾" }).click();
  await page.getByRole("menuitem", { name: "Duplicate this project" }).click();
  await expect(page.locator(".project-title")).toHaveText("First Model copy");
  await page.waitForTimeout(250);

  // Deleting removes it from the list.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Projects ▾" }).click();
  await page.getByRole("button", { name: "Delete Second Model" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Projects ▾" }).click();
  await expect(page.getByRole("menuitem", { name: /Second Model/ })).toHaveCount(0);
});
