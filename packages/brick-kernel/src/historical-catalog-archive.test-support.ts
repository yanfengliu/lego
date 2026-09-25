import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { extractTarArchive } from "../../../scripts/tar-archive.mjs";

/**
 * Timeout for a test that calls `partDefinitionsAt`. Archiving and loading a
 * whole historical catalog takes about 4 s alone, and more than vitest's 5 s
 * default when three such tests share the full suite's eight workers.
 */
export const HISTORICAL_CATALOG_TEST_TIMEOUT_MS = 30_000;

/**
 * The catalog `PART_DEFINITIONS` exactly as source commit `commit` emits them,
 * read from a `git archive` of its catalog package extracted under the ignored
 * `output/` root and removed afterwards. Migration tests diff it against the
 * live catalog to prove which parts a truth change reinterpreted.
 */
export async function partDefinitionsAt(
  commit: string,
): Promise<readonly Record<string, unknown>[]> {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const outputRoot = resolve(repositoryRoot, "output");
  mkdirSync(outputRoot, { recursive: true });
  const temporaryRoot = realpathSync(mkdtempSync(join(outputRoot, "migration-catalog-")));
  const relation = relative(realpathSync(outputRoot), temporaryRoot);
  if (relation === "" || relation === ".." || relation.startsWith(`..${sep}`)) {
    throw new Error(`Refusing cleanup outside ignored output root; resolved ${temporaryRoot}.`);
  }
  try {
    const archivePath = join(temporaryRoot, `${commit}.tar`);
    const extractionRoot = join(temporaryRoot, commit);
    mkdirSync(extractionRoot, { recursive: true });
    const args = ["-c", `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`, "archive"];
    args.push("--format=tar", `--output=${archivePath}`, commit, "package.json");
    args.push("packages/catalog/package.json", "packages/catalog/src");
    const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(
        `git archive of ${commit} failed with exit ${result.status}: ${result.stderr}`,
      );
    }
    extractTarArchive(archivePath, extractionRoot);
    const catalogUrl = pathToFileURL(join(extractionRoot, "packages/catalog/src/catalog.ts"));
    const historical = (await import(`${catalogUrl.href}?commit=${commit}`)) as {
      readonly PART_DEFINITIONS?: readonly Record<string, unknown>[];
    };
    if (!Array.isArray(historical.PART_DEFINITIONS)) {
      throw new Error(`${commit} did not export PART_DEFINITIONS from catalog.ts.`);
    }
    return historical.PART_DEFINITIONS;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
