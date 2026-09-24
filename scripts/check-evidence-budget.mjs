import { lstatSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * A byte ceiling on the ignored run-evidence roots, `output/` and `var/`.
 * They reached about 42 GB by 2026-09-23 (the owner deleted all but 2.8 MB)
 * because nothing measured them: they are ignored, so no diff showed growth.
 *
 * Bound: this measures only the checkout it runs in (a worktree has its own
 * `output/`), follows no symlink or junction, and says nothing about which
 * files are still needed — only the total. It runs when invoked
 * (`npm run evidence:budget`); it is not part of `npm run verify`, whose
 * clean-checkout runs would always pass it.
 */
export const EVIDENCE_ROOTS = ["output", "var"];
export const EVIDENCE_LIMIT_BYTES = 256 * 1024 * 1024;

/** Real I/O: total bytes of regular files under `path`; 0 when it is absent. */
export function treeBytes(path) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return 0;
  }
  if (stat.isSymbolicLink()) return 0;
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(path).reduce((sum, name) => sum + treeBytes(join(path, name)), 0);
}

/** Pure: 0 or 1 failure message for a measured total. */
export function evaluateEvidenceBudget(totalBytes, limitBytes = EVIDENCE_LIMIT_BYTES) {
  if (totalBytes <= limitBytes) return [];
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
  return [
    `Run evidence under ${EVIDENCE_ROOTS.join("/ and ")}/ is ${mb(totalBytes)} MB, over its ` +
      `${mb(limitBytes)} MB budget. Delete evidence no active task, unresolved issue or handoff ` +
      `needs (fleet canon R23); keep the inputs \`npm run booklet\` reads by default.`,
  ];
}

export function main({ repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..") } = {}) {
  const total = EVIDENCE_ROOTS.reduce((sum, root) => sum + treeBytes(resolve(repoRoot, root)), 0);
  const failures = evaluateEvidenceBudget(total);
  if (failures.length > 0) console.error(failures[0]);
  else console.log(`Evidence budget check passed: ${total} bytes under output/ and var/.`);
  return { exitCode: failures.length > 0 ? 1 : 0, total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main().exitCode;
}
