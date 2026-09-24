import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * A byte or character ceiling on a handful of docs that get read whole, on
 * every session or by every tool, so a slow drift in any one of them is a
 * standing cost rather than a one-time read.
 *
 * README.md grew from 4 KB (2026-07-10) to 25.6 KB (2026-08-29) because one
 * section gained a paragraph on almost every campaign commit; nothing ever
 * measured the file, so nothing caught it. This gate is that measurement.
 *
 * Bound: this checks exactly the items below — three whole-file byte
 * ceilings (`FILE_BUDGETS`) and one per-line character ceiling on every
 * entry line of `docs/devlog/summary.md` (`evaluateDevlogBudget`). It says
 * nothing about any other file's size, and nothing about whether these
 * files' *content* is accurate — only length.
 *
 * Run directly (`node scripts/check-doc-budgets.mjs`), via
 * `npm run docs:budget`, or as a step of `npm run verify`.
 */

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * README.md is the project's front door: meant to be read in one sitting.
 * docs/START.md is read in full at the start of every agent session, so its
 * cost is paid constantly, not once.
 * AGENTS.md is read by both Claude Code and Codex; Codex silently truncates
 * a project doc past 32 KiB (32,768 bytes) — no error, just a truncated file
 * — so its budget keeps a margin under that hard, silent ceiling.
 */
export const FILE_BUDGETS = [
  {
    path: "README.md",
    limitBytes: 6_000,
    reason: "it is the project's front door and is meant to be read in one sitting, not scrolled.",
  },
  {
    path: "docs/START.md",
    limitBytes: 10_000,
    reason:
      "it is read in full at the start of every agent session, so its cost is paid constantly.",
  },
  {
    path: "AGENTS.md",
    limitBytes: 30_000,
    reason:
      "Codex silently truncates a project doc past 32 KiB (32,768 bytes) with no error, so this " +
      "keeps a margin under that hard, silent ceiling.",
  },
];

/**
 * `docs/devlog/summary.md` is a growing, newest-first log. Every entry line
 * (one behaviour-changing session per line, linked to its full history in
 * `docs/devlog/detailed/`) is checked, with no exemption by date: from
 * 2026-07-09 (the earliest entry) through 2026-09-23, 76 of the file's 118
 * lines ran past this limit, the longest at 4,763 characters, because the
 * line restated content its own linked detailed entry already carried in
 * full. Trimmed 2026-09-23 to the index form this gate now enforces
 * unconditionally; older entries were grandfathered by date until that trim
 * landed, never before or after.
 */
export const DEVLOG_PATH = "docs/devlog/summary.md";
export const DEVLOG_LINE_LIMIT = 300;

/** Pure: does an already-measured byte size fit its budget? Returns 0 or 1 failure message. */
export function evaluateFileBudget({ path, sizeBytes, limitBytes, reason }) {
  if (sizeBytes <= limitBytes) return [];
  return [
    `${path} is ${sizeBytes} bytes, over its ${limitBytes}-byte budget by ${sizeBytes - limitBytes} ` +
      `bytes. Budget exists because ${reason} Trim prose, move detail into a linked doc, or delete ` +
      `stale content — do not raise the limit to make this pass.`,
  ];
}

/**
 * Pure: given the devlog's raw text, finds entry lines longer than
 * `lineLimit` characters. Non-entry lines (the heading, the intro paragraph,
 * blanks) are never checked. No line is exempt by date.
 */
export function evaluateDevlogBudget(
  text,
  { path = DEVLOG_PATH, lineLimit = DEVLOG_LINE_LIMIT } = {},
) {
  const failures = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.startsWith("- ")) return;
    if (line.length <= lineLimit) return;
    failures.push(
      `${path}:${index + 1} is ${line.length} characters, over the ${lineLimit}-character budget. ` +
        `Budget exists so the devlog stays a scannable index, not a second copy of the detailed ` +
        `history. Shorten the line to its densest form and move detail into docs/devlog/detailed/.`,
    );
  });
  return failures;
}

/** Real I/O against `repoRoot`: measures every budgeted file and reports pass/fail. */
export function main({ repoRoot = REPO_ROOT } = {}) {
  const failures = [];
  for (const budget of FILE_BUDGETS) {
    try {
      const sizeBytes = statSync(resolve(repoRoot, budget.path)).size;
      failures.push(...evaluateFileBudget({ ...budget, sizeBytes }));
    } catch {
      failures.push(
        `${budget.path}: expected but missing. Restore it, or update FILE_BUDGETS in ` +
          `scripts/check-doc-budgets.mjs if it moved.`,
      );
    }
  }

  try {
    const text = readFileSync(resolve(repoRoot, DEVLOG_PATH), "utf8");
    failures.push(...evaluateDevlogBudget(text));
  } catch {
    failures.push(`${DEVLOG_PATH}: expected but missing.`);
  }

  if (failures.length > 0) {
    console.error(
      `Doc budget check failed (${failures.length}):\n\n` +
        failures.map((failure) => `- ${failure}`).join("\n\n"),
    );
    return { exitCode: 1, failures };
  }
  console.log(
    `Doc budget check passed: ${FILE_BUDGETS.map((budget) => budget.path).join(", ")} within budget; ` +
      `every ${DEVLOG_PATH} entry is within ${DEVLOG_LINE_LIMIT} characters.`,
  );
  return { exitCode: 0, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main().exitCode;
}
