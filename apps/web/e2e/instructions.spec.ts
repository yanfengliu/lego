import { expect, test } from "@playwright/test";

import { SAMPLE_BOOKLET_PATH, hasSampleBooklet } from "./sample-booklet";

const SHOTS = "output/shots";

test("reads a real set instruction PDF within its bounds", async ({ page }) => {
  test.setTimeout(180_000);
  // The sample booklet is not committed, so this can only run where it is present.
  test.skip(!hasSampleBooklet, "no sample booklet");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");

  await page.setInputFiles('input[accept=".pdf,application/pdf"]', SAMPLE_BOOKLET_PATH!);

  const notice = page.locator(".command-error--notice", { hasText: "Read 6651557.pdf" });
  await expect(notice).toBeVisible({ timeout: 150_000 });
  const text = (await notice.textContent()) ?? "";

  expect(text).toMatch(/\d+ pages/);
  expect(text).toMatch(/sha256:[0-9a-f]+/);
  await page.screenshot({ path: `${SHOTS}/08-instructions.png` });
  expect(errors).toEqual([]);
});
