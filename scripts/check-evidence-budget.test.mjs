import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  EVIDENCE_LIMIT_BYTES,
  evaluateEvidenceBudget,
  main,
  treeBytes,
} from "./check-evidence-budget.mjs";

// Synthetic sizes and a throwaway temp directory only, never the real output/ or var/.

describe("evaluateEvidenceBudget", () => {
  it("passes a total at the limit", () => {
    expect(evaluateEvidenceBudget(EVIDENCE_LIMIT_BYTES)).toEqual([]);
  });

  it("goes red one byte over the real limit, naming the roots, size, budget and remedy", () => {
    const failures = evaluateEvidenceBudget(EVIDENCE_LIMIT_BYTES + 1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("output/ and var/");
    expect(failures[0]).toContain("256.0 MB budget");
    expect(failures[0]).toMatch(/Delete evidence/);
  });
});

describe("main over a temp checkout", () => {
  let root;
  afterEach(() => root && rmSync(root, { recursive: true, force: true }));

  it("sums nested files under both roots and treats an absent root as empty", () => {
    root = mkdtempSync(join(tmpdir(), "evidence-budget-"));
    mkdirSync(join(root, "output", "runs", "a"), { recursive: true });
    writeFileSync(join(root, "output", "runs", "a", "x.bin"), Buffer.alloc(300));
    writeFileSync(join(root, "output", "y.json"), Buffer.alloc(24));
    expect(treeBytes(join(root, "var"))).toBe(0);
    expect(main({ repoRoot: root })).toEqual({ exitCode: 0, total: 324 });
  });
});
