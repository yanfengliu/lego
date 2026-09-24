import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEVLOG_BASELINE_DATE,
  DEVLOG_LINE_LIMIT,
  DEVLOG_PATH,
  evaluateDevlogBudget,
  evaluateFileBudget,
  FILE_BUDGETS,
  main,
} from "./check-doc-budgets.mjs";

// Every test below works on synthetic sizes, synthetic devlog text, or a
// throwaway temp directory outside the repository — never on the real
// README.md, docs/START.md, AGENTS.md, or docs/devlog/summary.md.

describe("evaluateFileBudget", () => {
  const budget = () => ({ path: "example.md", limitBytes: 100, reason: "it is a test budget." });

  it("passes a file under its budget", () => {
    expect(evaluateFileBudget({ ...budget(), sizeBytes: 99 })).toEqual([]);
  });

  it("passes a file exactly at its budget", () => {
    expect(evaluateFileBudget({ ...budget(), sizeBytes: 100 })).toEqual([]);
  });

  it("goes red for a file over its budget, naming the file, size, limit, reason, and remedy", () => {
    const failures = evaluateFileBudget({ ...budget(), sizeBytes: 101 });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("example.md");
    expect(failures[0]).toContain("101 bytes");
    expect(failures[0]).toContain("100-byte budget");
    expect(failures[0]).toContain("it is a test budget.");
    expect(failures[0]).toMatch(/do not raise the limit/i);
  });

  it.each(FILE_BUDGETS)("goes red for the real $path budget when one byte over", (real) => {
    const failures = evaluateFileBudget({ ...real, sizeBytes: real.limitBytes + 1 });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(real.path);
    expect(failures[0]).toContain(String(real.limitBytes));
  });
});

describe("evaluateDevlogBudget", () => {
  const line = (date, length) => `- [${date}] ${"x".repeat(Math.max(0, length - 15))}`;

  it("passes when every baseline-or-later entry is within the character limit", () => {
    const text = [
      "# Devlog Summary",
      "",
      "Intro paragraph, not an entry.",
      line(DEVLOG_BASELINE_DATE, DEVLOG_LINE_LIMIT),
    ].join("\n");
    expect(evaluateDevlogBudget(text)).toEqual([]);
  });

  it("goes red for a baseline-dated entry over the character limit, naming the line, size, and limit", () => {
    const overLong = line(DEVLOG_BASELINE_DATE, DEVLOG_LINE_LIMIT + 1);
    const text = ["# Devlog Summary", "", "Intro paragraph.", overLong].join("\n");
    const failures = evaluateDevlogBudget(text);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(`${DEVLOG_PATH}:4`);
    expect(failures[0]).toContain(`${overLong.length} characters`);
    expect(failures[0]).toContain(`${DEVLOG_LINE_LIMIT}-character budget`);
    expect(failures[0]).toMatch(/grandfathered by date/);
  });

  it("goes red for an entry dated after the baseline over the character limit", () => {
    const text = [
      "# Devlog Summary",
      "",
      "Intro.",
      line("2027-01-01", DEVLOG_LINE_LIMIT + 50),
    ].join("\n");
    expect(evaluateDevlogBudget(text)).toHaveLength(1);
  });

  it("grandfathers an over-limit entry dated before the baseline", () => {
    const text = ["# Devlog Summary", "", "Intro.", line("2026-01-01", 4_000)].join("\n");
    expect(evaluateDevlogBudget(text)).toEqual([]);
  });

  it("treats an entry with no parseable leading date as new, not grandfathered", () => {
    const unparseable = `- **no date here** ${"x".repeat(DEVLOG_LINE_LIMIT)}`;
    const text = ["# Devlog Summary", "", "Intro.", unparseable].join("\n");
    expect(evaluateDevlogBudget(text)).toHaveLength(1);
  });

  it("never flags the heading, blank lines, or the intro paragraph, however long", () => {
    const text = [
      "#".repeat(1) + " Devlog Summary " + "x".repeat(500),
      "",
      "Intro paragraph. ".repeat(50),
    ].join("\n");
    expect(evaluateDevlogBudget(text)).toEqual([]);
  });

  it("respects a caller-supplied baseline and limit", () => {
    const custom = line("2020-06-01", 40);
    const text = ["# Devlog Summary", "", "Intro.", custom].join("\n");
    expect(evaluateDevlogBudget(text, { baselineDate: "2020-01-01", lineLimit: 20 })).toHaveLength(
      1,
    );
    expect(evaluateDevlogBudget(text, { baselineDate: "2020-07-01", lineLimit: 20 })).toEqual([]);
  });
});

describe("main, against temp copies (never the real docs)", () => {
  let tempRoot;

  afterEach(() => {
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  });

  function writeFixture({ readmeBytes, startBytes, agentsBytes, devlogText }) {
    tempRoot = mkdtempSync(join(tmpdir(), "lego-doc-budgets-test-"));
    mkdirSync(join(tempRoot, "docs", "devlog"), { recursive: true });
    writeFileSync(join(tempRoot, "README.md"), "x".repeat(readmeBytes));
    writeFileSync(join(tempRoot, "docs", "START.md"), "x".repeat(startBytes));
    writeFileSync(join(tempRoot, "AGENTS.md"), "x".repeat(agentsBytes));
    writeFileSync(join(tempRoot, "docs", "devlog", "summary.md"), devlogText);
    return tempRoot;
  }

  const withinBudgetDevlog = [
    "# Devlog Summary",
    "",
    "Intro.",
    `- [${DEVLOG_BASELINE_DATE}] fine`,
  ].join("\n");

  it("goes red end-to-end when every real budget is exceeded via a temp copy", () => {
    const overLongLine = `- [${DEVLOG_BASELINE_DATE}] ${"x".repeat(DEVLOG_LINE_LIMIT)}`;
    const repoRoot = writeFixture({
      readmeBytes: FILE_BUDGETS[0].limitBytes + 1,
      startBytes: FILE_BUDGETS[1].limitBytes + 1,
      agentsBytes: FILE_BUDGETS[2].limitBytes + 1,
      devlogText: ["# Devlog Summary", "", "Intro.", overLongLine].join("\n"),
    });
    const result = main({ repoRoot });
    expect(result.exitCode).toBe(1);
    expect(result.failures).toHaveLength(4);
    expect(result.failures.some((f) => f.includes("README.md"))).toBe(true);
    expect(result.failures.some((f) => f.includes("START.md"))).toBe(true);
    expect(result.failures.some((f) => f.includes("AGENTS.md"))).toBe(true);
    expect(result.failures.some((f) => f.includes(DEVLOG_PATH))).toBe(true);
  });

  it("passes end-to-end via a temp copy when every real budget is met", () => {
    const repoRoot = writeFixture({
      readmeBytes: FILE_BUDGETS[0].limitBytes,
      startBytes: FILE_BUDGETS[1].limitBytes,
      agentsBytes: FILE_BUDGETS[2].limitBytes,
      devlogText: withinBudgetDevlog,
    });
    const result = main({ repoRoot });
    expect(result.exitCode).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it("reports a missing budgeted file by name instead of throwing", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "lego-doc-budgets-test-"));
    mkdirSync(join(tempRoot, "docs", "devlog"), { recursive: true });
    // README.md, docs/START.md, and AGENTS.md are all left absent on purpose.
    writeFileSync(join(tempRoot, "docs", "devlog", "summary.md"), withinBudgetDevlog);
    const result = main({ repoRoot: tempRoot });
    expect(result.exitCode).toBe(1);
    expect(result.failures.some((f) => f.includes("README.md") && f.includes("missing"))).toBe(
      true,
    );
  });
});

describe("main, against the real repository", () => {
  it("currently passes its own gate", () => {
    // This is the one assertion here that touches real files, and it is
    // read-only: it proves the docs this task just edited actually fit the
    // budgets it just introduced, the same way `npm run docs:budget` would.
    const result = main();
    expect(result.failures).toEqual([]);
    expect(result.exitCode).toBe(0);
  });
});
