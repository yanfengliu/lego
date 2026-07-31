import { expect, test } from "@playwright/test";

const SHOTS =
  "C:/Users/38909/AppData/Local/Temp/claude/C--Users-38909-Documents-github-lego/cf21f97d-d8f1-464b-a7d3-093b8f37be16/scratchpad/shots";

test("reads a real set instruction PDF within its bounds", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");

  await page.setInputFiles('input[accept=".pdf,application/pdf"]', "recipes/6651557.pdf");

  const notice = page.locator(".command-error--notice", { hasText: "Read 6651557.pdf" });
  await expect(notice).toBeVisible({ timeout: 150_000 });
  const text = (await notice.textContent()) ?? "";

  expect(text).toMatch(/\d+ pages/);
  expect(text).toMatch(/sha256:[0-9a-f]+/);
  await page.screenshot({ path: `${SHOTS}/08-instructions.png` });
  expect(errors).toEqual([]);
});
