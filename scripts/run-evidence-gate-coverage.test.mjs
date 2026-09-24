import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import playwrightConfig from "../playwright.config.ts";
import vitestConfig from "../vitest.config.ts";
import { findUnwiredExistenceGates } from "./run-evidence-gate-coverage-scan.mjs";

/**
 * The whole-tree class check for the F1 defect: a test file whose default
 * run depends on whether an ignored path happens to exist on this machine,
 * because its gate checks the path directly instead of going through
 * `LEGO_RUN_EVIDENCE` (`scripts/run-evidence-gate.mjs` /
 * `scripts/run_evidence_gate.py`). See `run-evidence-gate-coverage-scan.mjs`
 * for the scan's own bound.
 *
 * Scope: vitest's own `include` (`vitest.config.ts`) for JS/TS, every
 * `scripts/*_test.py` for Python, and every Playwright spec `playwright
 * .config.ts` itself names (`testDir` + `testMatch`, read from the config
 * rather than copied, for the same reason the JS/TS population is). The
 * vitest include is read without vitest's `exclude`, so the scan also covers
 * the `*.score.test.ts` files that `npm test` leaves out and `npm run
 * test:score` runs. Python covers more than the files `test:python` names,
 * since a file only reachable by another test's import (the three
 * `ldcad_shadow_*` files aggregated into `ldcad_shadow_test.py`) is exercised
 * by the default gate just the same. Playwright's population used to be out
 * of scope (former G3f-3 exclusion, `docs/work/1_booklet-reset/plan.md`);
 * its booklet-gated specs were converted to `apps/web/e2e/run-evidence-gate
 * .ts`'s `skipWithoutRunEvidence` and it is now scanned like any other
 * population.
 */

const THIS_MODULE_PATHS = new Set([
  "scripts/run-evidence-gate-coverage.test.mjs",
  "scripts/run-evidence-gate-coverage-scan.mjs",
]);

/**
 * One documented exception, allowed because its `.skipIf` reads no evidence:
 * it proves only the *absence* contract below a suite that
 * `describeWithRunEvidence` already gates, and its assertion
 * (`expect(published).toBe(false)`) is tautological under that guard, so it
 * can never mask a drifted or missing real check.
 */
const ALLOWED_EXISTENCE_GATES = new Set(["apps/web/test/real-build-transition-bundle.test.ts"]);

function trackedFiles(patterns) {
  const result = spawnSync("git", ["ls-files", "--", ...patterns], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr || result.status}`);
  }
  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * The Playwright spec population is `playwright.config.ts`'s own `testDir` +
 * `testMatch`, read from the config rather than copied, for the same reason
 * as `vitest.config.ts`'s `include` below. `git ls-files`'s `:(glob)` pathspec
 * magic is needed for `testMatch`'s `**` segment, which a plain pathspec
 * would not expand.
 */
function findPlaywrightSpecFiles() {
  const { testDir, testMatch } = playwrightConfig;
  if (typeof testDir !== "string" || testDir.length === 0) {
    throw new TypeError("playwright.config.ts has no non-empty string testDir to scan from.");
  }
  const patterns = Array.isArray(testMatch) ? testMatch : [testMatch];
  if (patterns.length === 0 || patterns.some((pattern) => typeof pattern !== "string")) {
    throw new TypeError(
      "playwright.config.ts testMatch must be one or more glob strings for this scan to read; " +
        "a RegExp testMatch needs this function extended before it can be trusted.",
    );
  }
  const relativeDir = testDir.replace(/^\.\//u, "").replace(/\/$/u, "");
  return trackedFiles(patterns.map((pattern) => `:(glob)${relativeDir}/${pattern}`));
}

/**
 * The JS/TS population is `vitest.config.ts`'s own `test.include`, read from
 * the config rather than copied, so an include root added there cannot fall
 * outside this scan. A copied list drifted once already: the booklet harness
 * added its `tools/` test root to the config while this list still named four
 * roots, so `npm test` ran tests this check never read.
 */
function findEvidenceGateScanTargets() {
  const include = vitestConfig.test?.include ?? [];
  expect(include.length).toBeGreaterThan(0);
  const jsFiles = trackedFiles(include);
  const pythonFiles = trackedFiles(["scripts/*_test.py"]);
  const playwrightFiles = findPlaywrightSpecFiles();
  expect(playwrightFiles.length).toBeGreaterThan(20);
  return [...new Set([...jsFiles, ...pythonFiles, ...playwrightFiles])]
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => !THIS_MODULE_PATHS.has(path));
}

describe("run-evidence-gate whole-tree coverage", () => {
  it("finds no test file gating a describe/it/test or a Python skip on an ignored path's existence, unlisted", () => {
    const targets = findEvidenceGateScanTargets();
    expect(targets.length).toBeGreaterThan(100);

    const violations = targets.flatMap((path) => {
      const text = readFileSync(path, "utf8");
      return findUnwiredExistenceGates(path, text).filter(
        (violation) => !ALLOWED_EXISTENCE_GATES.has(violation.path),
      );
    });

    expect(violations).toEqual([]);
  });

  it("recognizes the documented exception, so an unmaintained allowlist itself goes noticed", () => {
    for (const path of ALLOWED_EXISTENCE_GATES) {
      const text = readFileSync(path, "utf8");
      expect(findUnwiredExistenceGates(path, text).map((v) => v.path)).toContain(path);
    }
  });
});
