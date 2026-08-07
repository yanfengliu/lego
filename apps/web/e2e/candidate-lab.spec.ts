import { writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  BLOCKED_FRACTION_CEILING,
  FRAME_BUDGET_MS,
  SINGLE_STALL_CEILING_MS,
  summarizeResponsiveness,
  type ResponsivenessObservation,
} from "./responsiveness";

/** The probe's timer period. Short enough to see a blocked frame, long enough not to be the load. */
const PROBE_PERIOD_MS = 10;

declare global {
  interface Window {
    __candidateLabResponsiveness?: {
      readonly interval: number;
      readonly observer: PerformanceObserver;
      readonly startedAt: number;
      readonly gapsMs: number[];
      readonly longTasksMs: number[];
    };
  }
}

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
  await page.evaluate((periodMs) => {
    const gapsMs: number[] = [];
    const longTasksMs: number[] = [];
    // `longtask` entries time the task itself, so unlike a timer gap they do not
    // count wall time in which the main thread was idle but the whole renderer
    // was descheduled by a busy machine.
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasksMs.push(entry.duration);
    });
    observer.observe({ entryTypes: ["longtask"] });
    let previous = performance.now();
    const interval = window.setInterval(() => {
      const current = performance.now();
      gapsMs.push(current - previous);
      previous = current;
    }, periodMs);
    window.__candidateLabResponsiveness = {
      interval,
      observer,
      startedAt: performance.now(),
      gapsMs,
      longTasksMs,
    };
  }, PROBE_PERIOD_MS);

  await page.getByLabel("Candidate lab prompt").fill("Build an 18-piece red and yellow staircase");
  await page.getByRole("button", { name: "Generate 4 candidates" }).click();
  await expect(page.getByText("4 attempts")).toBeVisible();
  const probed = await page.evaluate((periodMs): ResponsivenessObservation => {
    const probe = window.__candidateLabResponsiveness;
    if (probe === undefined) throw new Error("Responsiveness probe was never installed.");
    window.clearInterval(probe.interval);
    // The observer's callback is queued, so the last long tasks of the run are
    // still pending records at this point; dropping them would drop the worst.
    for (const entry of probe.observer.takeRecords()) probe.longTasksMs.push(entry.duration);
    probe.observer.disconnect();
    delete window.__candidateLabResponsiveness;
    return {
      gapsMs: probe.gapsMs,
      longTasksMs: probe.longTasksMs,
      observedMs: performance.now() - probe.startedAt,
      periodMs,
    };
  }, PROBE_PERIOD_MS);
  const responsiveness = summarizeResponsiveness(probed);
  // The raw samples travel with the summary so a later recalibration has the
  // distribution to work from without re-instrumenting the probe first.
  const responsivenessPath = testInfo.outputPath("candidate-lab-responsiveness.json");
  await writeFile(
    responsivenessPath,
    `${JSON.stringify({ ...responsiveness, observation: probed })}\n`,
  );
  const measured =
    `${responsiveness.blockedMs.toFixed(1)}ms over a ${FRAME_BUDGET_MS}ms frame budget across ` +
    `${responsiveness.sampleCount} samples of a ${responsiveness.observedMs.toFixed(1)}ms generation ` +
    `(worst single gap ${responsiveness.gapMs.maximum.toFixed(1)}ms, ` +
    `${responsiveness.longTaskCount} long task${responsiveness.longTaskCount === 1 ? "" : "s"}). ` +
    `Full distribution: ${responsivenessPath}`;
  expect(
    responsiveness.blockedFraction,
    `The editor was over the frame budget for ${(responsiveness.blockedFraction * 100).toFixed(1)}% of ` +
      `candidate generation, over the ${(BLOCKED_FRACTION_CEILING * 100).toFixed(0)}% ceiling: ${measured}. ` +
      `A busy machine does not reach this - the ceiling is 1.30x the worst of 121 calibration runs ` +
      `from idle to 4x oversubscribed - so suspect main-thread work that belongs in the maker or ` +
      `verifier worker. See apps/web/e2e/responsiveness.ts for where the ceiling came from.`,
  ).toBeLessThan(BLOCKED_FRACTION_CEILING);
  expect(
    responsiveness.gapMs.maximum,
    `The main thread froze for ${responsiveness.gapMs.maximum.toFixed(1)}ms in one stretch, over the ` +
      `${SINGLE_STALL_CEILING_MS}ms ceiling: ${measured}. That is 2.7x the worst gap seen under load ` +
      `during calibration, so it is a real freeze rather than scheduling noise.`,
  ).toBeLessThan(SINGLE_STALL_CEILING_MS);
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
