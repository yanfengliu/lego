import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { bindVerdicts, cropPosition, labelsFixture } from "./part-identification-truth-labels.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(repositoryRoot, "scripts", "part-identification-truth-labels.mjs");
const fixture = (name) => path.join(repositoryRoot, "scripts", "fixtures", name);
const TRUTH = JSON.parse(readFileSync(fixture("part-identification-truth-first50.json"), "utf8"));
const TRACKED_TEXT = readFileSync(fixture("part-identification-truth-first50-labels.json"), "utf8");
const TRACKED = JSON.parse(TRACKED_TEXT);

/** The crop file a label row names, as the judged run named it. */
function cropName(row) {
  const at = (value) => value.toFixed(3).replace(".", "d");
  return `p${row.page}-q${row.quantity}-x${at(row.xPt)}-y${at(row.yPt)}.png`;
}

/**
 * Bound: crops stood in by name and digest from the tracked rows themselves, so
 * this proves the binder's order and format, not that the real crops still hash
 * the same; running the script against the judged run checks that.
 */
describe("part-identification truth labels", () => {
  const crops = [
    ...TRACKED.labels.map((row) => ({ name: cropName(row), sha256: row.judgedCropSha256 })),
    { name: "p1-q1-x1d000-y1d000.png", sha256: "sha256:unjudged" },
    { name: "manifest.json", sha256: TRACKED.labels[0].judgedCropSha256 },
  ];

  it("rebuilds the tracked fixture byte for byte from crops carrying the judged digests", () => {
    expect(labelsFixture(TRACKED, bindVerdicts(TRUTH, crops))).toBe(
      TRACKED_TEXT.replace(/\r\n/g, "\n"),
    );
  });

  it("reads a crop's label position from its name, and nothing from any other name", () => {
    expect(cropPosition("p11-q1-x43d074-y486d271.png")).toEqual({
      page: 11,
      quantity: 1,
      xPt: 43.074,
      yPt: 486.271,
    });
    expect(cropPosition("manifest.json")).toBeNull();
  });

  it("names the verdicts whose judged crop is missing", () => {
    const lost = TRACKED.labels.find((row) => row.n === 7).judgedCropSha256;
    expect(() =>
      bindVerdicts(
        TRUTH,
        crops.filter((c) => c.sha256 !== lost),
      ),
    ).toThrow(
      /^No crop carries the digest judged for verdict 7 \(1 of 84\); point LEGO_JUDGED_CROPS_DIR at the run whose crops were judged/,
    );
  });

  it("reports skipped (input absent) and writes nothing when the run is not there", () => {
    const missing = path.join(repositoryRoot, "output", "no-such-dir", "absent-run");
    const run = spawnSync(process.execPath, [CLI], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, LEGO_JUDGED_CROPS_DIR: missing },
      timeout: 60_000,
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(
      `part-identification-truth-labels: skipped (input absent): no directory at ${missing}; set LEGO_JUDGED_CROPS_DIR to the judged crop run.`,
    );
    expect(existsSync(path.dirname(missing))).toBe(false);
  });
});
