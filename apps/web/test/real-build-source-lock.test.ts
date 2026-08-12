import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  captureRealBuildSourceBundle,
  materializeRealBuildSourceMirror,
  sourceDriftFailures,
} from "../e2e/real-build-replay-files";
import {
  acquireRealBuildSourceLock,
  REAL_BUILD_SOURCE_LOCK_SCRIPT,
} from "../e2e/real-build-source-lock";

describe.runIf(process.platform === "win32")("real-build immutable source lock", () => {
  let temporaryRoot: string | null = null;

  afterEach(() => {
    if (temporaryRoot !== null) rmSync(temporaryRoot, { recursive: true, force: true });
    temporaryRoot = null;
  });

  it("holds original and generated alias bytes against write, delete, and root rename", async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), "lego-real-build-lock-"));
    const repoRoot = join(temporaryRoot, "repo");
    const runRoot = join(temporaryRoot, "run");
    const sourcePath = "packages/demo/src/index.ts";
    mkdirSync(join(repoRoot, "packages", "demo", "src"), { recursive: true });
    mkdirSync(runRoot);
    writeFileSync(join(repoRoot, sourcePath), "export const value = 1;\n");
    const helperBytes = readFileSync(join(process.cwd(), REAL_BUILD_SOURCE_LOCK_SCRIPT));
    const mirror = materializeRealBuildSourceMirror({
      directory: runRoot,
      repoRoot,
      sourceFiles: [sourcePath],
      fixedInputs: [{ path: REAL_BUILD_SOURCE_LOCK_SCRIPT, bytes: helperBytes }],
    });
    const aliasPath = "node_modules/@lego-studio/demo/src/index.ts";
    expect(mirror.files.map(({ path }) => path)).toEqual([
      aliasPath,
      sourcePath,
      REAL_BUILD_SOURCE_LOCK_SCRIPT,
    ]);
    const alias = join(mirror.root, aliasPath);
    const displaced = join(temporaryRoot, "displaced-source-snapshot");
    const displacedAlias = join(temporaryRoot, "displaced-alias.ts");
    const aliasPackage = join(mirror.root, "node_modules", "@lego-studio", "demo");
    const displacedAliasPackage = join(temporaryRoot, "displaced-alias-package");
    const lock = await acquireRealBuildSourceLock(mirror);
    try {
      lock.assertHeld();
      expect(readFileSync(alias, "utf8")).toBe("export const value = 1;\n");
      expect(() => writeFileSync(alias, "export const value = 999;\n")).toThrow();
      expect(() => renameSync(alias, displacedAlias)).toThrow();
      expect(() => renameSync(aliasPackage, displacedAliasPackage)).toThrow();
      expect(() => renameSync(mirror.root, displaced)).toThrow();
      lock.assertHeld();
    } finally {
      await lock.release();
    }
    writeFileSync(alias, "export const value = 999;\n");
    const drift = sourceDriftFailures(
      mirror.files,
      captureRealBuildSourceBundle(
        mirror.root,
        mirror.files.map(({ path }) => path),
      ),
    );
    expect(drift).toEqual([expect.stringContaining(aliasPath)]);
  }, 15_000);

  it("refuses a helper whose bytes changed after the authenticated mirror snapshot", async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), "lego-real-build-helper-lock-"));
    const repoRoot = join(temporaryRoot, "repo");
    const runRoot = join(temporaryRoot, "run");
    mkdirSync(repoRoot);
    mkdirSync(runRoot);
    const helperBytes = readFileSync(join(process.cwd(), REAL_BUILD_SOURCE_LOCK_SCRIPT));
    const mirror = materializeRealBuildSourceMirror({
      directory: runRoot,
      repoRoot,
      sourceFiles: [],
      fixedInputs: [{ path: REAL_BUILD_SOURCE_LOCK_SCRIPT, bytes: helperBytes }],
    });
    writeFileSync(join(mirror.root, REAL_BUILD_SOURCE_LOCK_SCRIPT), "Write-Output 'swapped'\n");
    await expect(acquireRealBuildSourceLock(mirror)).rejects.toThrow(
      /helper (?:length|digest) differs/u,
    );
  });
});
