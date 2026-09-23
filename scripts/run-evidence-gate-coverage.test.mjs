import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

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
 * Scope matches what `npm test` and `npm run test:python` actually read:
 * vitest's own `include` (`vitest.config.ts`) for JS/TS, and every
 * `scripts/*_test.py` for Python — not only the files `test:python`
 * currently names, since a file only reachable by another test's import (the
 * three `ldcad_shadow_*` files aggregated into `ldcad_shadow_test.py`) is
 * exercised by the default gate just the same. Playwright's
 * `apps/web/e2e/*.spec.ts` population is excluded: `git-tracked source in
 * this file's own exclusion list below names it as a separate,
 * intentionally unconverted population, flagged elsewhere for its own pass.
 */

const THIS_MODULE_PATHS = new Set([
  "scripts/run-evidence-gate-coverage.test.mjs",
  "scripts/run-evidence-gate-coverage-scan.mjs",
]);

/**
 * One documented exception: this `.skipIf` reads no evidence itself. It
 * exists to prove the *absence* contract at the bottom of a file whose real
 * evidence-reading suite is already `describeWithRunEvidence`-gated above
 * it, and its own assertion (`expect(published).toBe(false)`) is tautological
 * given the guard, so it can never mask a drifted or missing real check. See
 * `docs/work/` review notes for `apps/web/test/real-build-transition-bundle.
 * test.ts` (F1/F2 follow-up) for the fuller reasoning.
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
  return [...jsFiles, ...pythonFiles]
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
