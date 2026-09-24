import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { RUN_EVIDENCE_VARIABLE, skipWithoutRunEvidence } from "./run-evidence-gate";

/**
 * The booklet's reference build, imported through the editor's Import button
 * and played one printed step at a time with the playback bar's own controls.
 *
 * Inputs are ignored run evidence that `npm run booklet` writes from LEGO's
 * official model: `output/booklet/reference-build.mpd` (the valid prefix of
 * reference playback, one editor step per printed step) and
 * `output/booklet/status.json`. Nothing here is committed, so the spec runs
 * only with LEGO_RUN_EVIDENCE=1 and then fails by name when an input is missing.
 *
 * What it checks, per printed step, forward and back: the step name and page,
 * the part count and the "+N" the bar shows, against the booklet's own printed
 * callout counts (the read stage, which never sees the answer key), and that
 * every step renders a document of its own (the footer hash changes each step).
 * Bound: counts, labels and document identity only. It cannot tell a right
 * picture from a wrong one, a mirror image included; the pixels were compared
 * with the booklet pages by eye, and that comparison is recorded in the devlog.
 */
const OUT = resolve("output", "booklet");
const MPD = resolve(OUT, "reference-build.mpd");
const STATUS = resolve(OUT, "status.json");

interface ReadRow {
  readonly step: number;
  readonly page: number;
  readonly pieces: number;
}
interface PlaybackRow {
  readonly step: number;
  readonly status: string;
  readonly added: number;
  readonly placedParts: number;
}

function readInputs() {
  for (const path of [MPD, STATUS]) {
    if (!existsSync(path)) {
      throw new Error(
        `${path} is missing: run \`npm run booklet\` (it needs the booklet PDF and the official model) before this spec with ${RUN_EVIDENCE_VARIABLE}=1`,
      );
    }
  }
  const status = JSON.parse(readFileSync(STATUS, "utf8")) as {
    stages: {
      read: { steps?: ReadRow[] };
      playback: { steps?: PlaybackRow[] };
    };
  };
  const read = status.stages.read.steps;
  const playback = status.stages.playback.steps;
  if (!read || !playback) {
    throw new Error(`${STATUS} has no read or playback rows; rerun \`npm run booklet\``);
  }
  const prefix: PlaybackRow[] = [];
  for (const row of playback) {
    if (row.status !== "valid") break;
    prefix.push(row);
  }
  return { read, prefix };
}

test("plays the booklet reference build one printed step at a time", async ({ page }) => {
  skipWithoutRunEvidence(
    test,
    "reads output/booklet/reference-build.mpd and status.json, which npm run booklet writes from the official model",
  );
  test.setTimeout(240_000);
  const { read, prefix } = readInputs();
  expect(prefix.length, "reference playback has no valid printed step").toBeGreaterThan(0);

  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");
  page.on("dialog", (dialog) => void dialog.accept());
  await page.locator('input[type="file"][accept=".ldr,.mpd,text/plain"]').setInputFiles(MPD);
  const total = prefix.at(-1)!.placedParts;
  await expect
    .poll(() => page.evaluate(() => window.get_model_snapshot?.().partCount ?? 0))
    .toBe(total);
  await expect(page.locator(".command-error[role=alert]")).toHaveCount(0);
  await expect(page.getByText(/^REFERENCE BUILD from LEGO's official model/u)).toBeVisible();

  await page.getByRole("button", { name: /Build/ }).click();
  await expect(page.locator(".playback-scrubber input")).toHaveAttribute(
    "max",
    String(prefix.length),
  );
  const readout = page.locator(".playback-readout");
  const footerHash = page.locator(".viewport-footer code");
  await expect(readout).toContainText("0 parts");

  const seen: { readonly readout: string; readonly hash: string }[] = [
    { readout: await readout.innerText(), hash: await footerHash.innerText() },
  ];
  let cumulative = 0;
  for (const [position, row] of prefix.entries()) {
    const printed = read.find(({ step }) => step === row.step);
    expect(printed, `the booklet read has no printed step ${row.step}`).toBeDefined();
    cumulative += printed!.pieces;
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(readout).toContainText(`Printed step ${row.step} (p. ${printed!.page})`);
    await expect(readout).toContainText(
      `${position + 1} / ${prefix.length} · ${cumulative} parts · ${printed!.pieces > 0 ? `+${printed!.pieces}` : "no new parts"}`,
    );
    // The booklet's printed callouts and the answer key's playback agree on every count.
    expect(cumulative, `parts after printed step ${row.step}`).toBe(row.placedParts);
    await expect(page.locator(".playback-verdict")).not.toHaveText("unbuildable");
    await expect(footerHash).not.toHaveText(seen.at(-1)!.hash);
    seen.push({ readout: await readout.innerText(), hash: await footerHash.innerText() });
  }
  expect(new Set(seen.map(({ hash }) => hash)).size).toBe(seen.length);

  // Stepping back shows each earlier state again, unchanged.
  for (let position = prefix.length - 1; position >= 0; position -= 1) {
    await page.getByRole("button", { name: "Previous step" }).click();
    await expect(footerHash).toHaveText(seen[position]!.hash);
    expect(await readout.innerText()).toBe(seen[position]!.readout);
  }
});
