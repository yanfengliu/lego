import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(repositoryRoot, "scripts", "identify-booklet.mjs");
const LABELS = path.join(
  repositoryRoot,
  "scripts",
  "fixtures",
  "part-identification-truth-first50-labels.json",
);
const TRUTH = path.join(
  repositoryRoot,
  "scripts",
  "fixtures",
  "part-identification-truth-first50.json",
);

describe("identify-booklet CLI", () => {
  it("reports skipped (input absent) and succeeds when the booklet is not there", () => {
    const missing = path.join(repositoryRoot, "output", "no-such-dir", "absent-booklet.pdf");
    const run = spawnSync(process.execPath, [CLI], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, LEGO_BOOKLET_PDF: missing },
      timeout: 60_000,
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(
      `identify-booklet: skipped (input absent): no file at ${missing}; set LEGO_BOOKLET_PDF to the booklet.`,
    );
    expect(existsSync(path.dirname(missing))).toBe(false);
  });

  it("binds every truth verdict to a label and keeps each erratum on a verdict it contradicts", () => {
    const truth = JSON.parse(readFileSync(TRUTH, "utf8"));
    const bindings = JSON.parse(readFileSync(LABELS, "utf8"));
    const verdicts = new Map([...truth.verdicts, ...truth.unjudgeable].map((v) => [v.n, v]));
    const bound = new Set(bindings.labels.map((row) => row.n));
    expect([...verdicts.keys()].filter((n) => !bound.has(n))).toEqual([]);
    for (const row of bindings.labels)
      expect(row.judgedCropSha256).toBe(verdicts.get(row.n).judgedCropSha256);
    for (const erratum of bindings.errata) {
      expect(verdicts.get(erratum.n)).toMatchObject({ elementId: erratum.claimed, same: true });
      expect(erratum.correct).not.toBe(erratum.claimed);
      expect(erratum.evidence.length).toBeGreaterThan(0);
    }
  });
});
