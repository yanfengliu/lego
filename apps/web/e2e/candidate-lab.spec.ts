import { writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("generates, compares, and previews a local candidate without mutating the project", async ({
  page,
}, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByText("saved locally")).toBeVisible();
  const before = await page.evaluate(() => window.get_model_snapshot!());
  await page.evaluate(() => {
    const samples: number[] = [];
    let previous = performance.now();
    const interval = window.setInterval(() => {
      const current = performance.now();
      samples.push(current - previous);
      previous = current;
    }, 10);
    Object.assign(window, { __candidateLabResponsiveness: { interval, samples } });
  });

  await page.getByLabel("Candidate lab prompt").fill("Build an 18-piece red and yellow staircase");
  await page.getByRole("button", { name: "Generate 4 candidates" }).click();
  await expect(page.getByText("4 attempts")).toBeVisible();
  const maximumEventLoopGap = await page.evaluate(() => {
    const probe = (
      window as unknown as {
        __candidateLabResponsiveness: { interval: number; samples: number[] };
      }
    ).__candidateLabResponsiveness;
    window.clearInterval(probe.interval);
    return Math.max(0, ...probe.samples);
  });
  await writeFile(
    testInfo.outputPath("candidate-lab-responsiveness.json"),
    `${JSON.stringify({ maximumEventLoopGapMs: maximumEventLoopGap })}\n`,
  );
  expect(maximumEventLoopGap).toBeLessThan(200);
  await expect(
    page.getByRole("list", { name: "Candidate attempts" }).getByRole("listitem"),
  ).toHaveCount(4);

  const rankOne = page.getByRole("button", { name: /Preview rank 1 candidate/ });
  await expect(rankOne).toBeVisible();
  await rankOne.click();
  await expect(rankOne).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Unaccepted candidate preview")).toBeVisible();
  await expect(page.getByRole("button", { name: /Accept candidate/ })).toBeDisabled();

  const observation = await page.evaluate(() => JSON.parse(window.render_app_to_text!()));
  expect(observation).toMatchObject({
    schemaVersion: "lego.app-observation/1",
    documentHash: before.structuralHash,
    activeJob: { state: "ready", baseDocumentHash: before.structuralHash },
    candidate: { state: "preview", rank: 1 },
    candidateValidation: { patchValid: true, documentGloballyValid: true },
    overlay: { candidatePreviewVisible: true },
  });
  expect(observation.candidatePopulation).toHaveLength(4);
  expect(observation.candidate.documentHash).not.toBe(before.structuralHash);
  expect(observation.candidateValidation.targetDocumentHash).toBe(
    observation.candidate.documentHash,
  );
  expect(observation.renderer.viewPacket.documentHash).toBe(observation.candidate.documentHash);
  expect(await page.evaluate(() => window.get_model_snapshot!())).toEqual(before);

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
  for (const [name, dataUrl] of Object.entries(captures)) {
    await writeFile(
      testInfo.outputPath(`candidate-${name}.png`),
      Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"),
    );
  }
  await page.screenshot({
    path: testInfo.outputPath("candidate-lab-preview.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByText("Unaccepted candidate preview")).toBeVisible();
  const resized = await page.evaluate(() => JSON.parse(window.render_app_to_text!()));
  expect(resized.renderer.viewPacket.documentHash).toBe(resized.candidate.documentHash);
  expect(runtimeErrors).toEqual([]);
});

test("a manual edit terminates and clears candidate preview state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("saved locally")).toBeVisible();
  await page.getByRole("button", { name: "Generate 4 candidates" }).click();
  const rankOne = page.getByRole("button", { name: /Preview rank 1 candidate/ });
  await rankOne.click();
  await expect(page.getByText("Unaccepted candidate preview")).toBeVisible();

  await page.getByRole("button", { name: "Place at origin" }).click();
  await expect(page.getByRole("list", { name: "Candidate attempts" })).toHaveCount(0);
  await expect(page.getByText("Unaccepted candidate preview")).toHaveCount(0);
  await expect
    .poll(async () => (await page.evaluate(() => window.get_model_snapshot!())).partCount)
    .toBe(1);
  const observation = await page.evaluate(() => JSON.parse(window.render_app_to_text!()));
  expect(observation.activeJob).toBeNull();
  expect(observation.candidatePopulation).toEqual([]);
  expect(observation.candidate).toBeNull();
});
