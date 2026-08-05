import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

interface PreparedTarget {
  readonly absolutePath: string;
  readonly repositoryRelativePath: string;
}

export interface HighlightRendererCompatibilityArtifactInput {
  readonly repoRoot: string;
  readonly renderCasesPath: string;
  readonly compatibilityPath: string;
  readonly renderCasesBytes: Uint8Array;
  readonly compatibilityBytes: Uint8Array;
  /** Internal fault-injection seam; production callers omit it. */
  readonly testHooks?: {
    readonly beforeCompatibilityCommit?: () => void;
    readonly afterCompatibilityCommit?: () => void;
    readonly beforeCleanupPath?: (path: string) => void;
  };
}

const pathKey = (path: string): string =>
  process.platform === "win32" ? path.toLocaleLowerCase("en-US") : path;

const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });

function isStrictDescendant(root: string, target: string): boolean {
  const child = relative(root, target);
  return child.length > 0 && !isAbsolute(child) && child !== ".." && !child.startsWith(`..${sep}`);
}

function git(repoRoot: string, args: readonly string[]) {
  return spawnSync(
    "git",
    ["-c", `safe.directory=${repoRoot.replaceAll("\\", "/")}`, "-C", repoRoot, ...args],
    { encoding: "utf8", windowsHide: true },
  );
}

function assertIgnoredAndUntracked(repoRoot: string, repositoryRelativePath: string): void {
  const check = git(repoRoot, [
    "check-ignore",
    "--quiet",
    "--no-index",
    "--",
    repositoryRelativePath,
  ]);
  if (check.status !== 0) {
    const detail = [check.error?.message, check.stderr.trim()].filter(Boolean).join("; ");
    throw new TypeError(
      `Highlight renderer-compatibility target ${repositoryRelativePath} must be confirmed ignored by Git; ` +
        `git check-ignore exited ${String(check.status)}${detail.length > 0 ? ` (${detail})` : ""}.`,
    );
  }
  const tracked = git(repoRoot, ["ls-files", "--cached", "-z", "--", repositoryRelativePath]);
  if (tracked.status !== 0) {
    const detail = [tracked.error?.message, tracked.stderr.trim()].filter(Boolean).join("; ");
    throw new TypeError(
      `Highlight renderer-compatibility target ${repositoryRelativePath} could not be checked against Git's ` +
        `tracked index; git ls-files exited ${String(tracked.status)}${detail.length > 0 ? ` (${detail})` : ""}.`,
    );
  }
  if (tracked.stdout.length > 0) {
    throw new TypeError(
      `Highlight renderer-compatibility target ${repositoryRelativePath} is tracked by Git. Task-run evidence ` +
        `must remain ignored and untracked; choose a fresh output path instead of overwriting a repository input.`,
    );
  }
}

function ensureRealDirectoryChain(outputRoot: string, parent: string): void {
  let cursor = outputRoot;
  const child = relative(outputRoot, parent);
  for (const component of child.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, component);
    if (!existsSync(cursor)) mkdirSync(cursor);
    const stat = lstatSync(cursor);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new TypeError(
        `Highlight renderer-compatibility output directory ${cursor} must be a real directory, not a symlink or non-directory.`,
      );
    }
  }
}

function prepareTargets(input: HighlightRendererCompatibilityArtifactInput): {
  readonly renderCases: PreparedTarget;
  readonly compatibility: PreparedTarget;
} {
  const repoRoot = realpathSync(resolve(input.repoRoot));
  const outputRoot = resolve(repoRoot, "output");
  const configured = [
    ["render cases", input.renderCasesPath],
    ["compatibility summary", input.compatibilityPath],
  ] as const;
  const lexical = configured.map(([label, path]) => {
    if (typeof path !== "string" || path.trim().length === 0 || hasControlCharacter(path)) {
      throw new TypeError(`Highlight renderer-${label} path must be a non-empty filesystem path.`);
    }
    const absolutePath = resolve(repoRoot, path);
    if (!isStrictDescendant(outputRoot, absolutePath) || !absolutePath.endsWith(".json")) {
      throw new TypeError(
        `Highlight renderer-${label} target ${path} must be a .json file strictly below ${outputRoot}.`,
      );
    }
    const repositoryRelativePath = relative(repoRoot, absolutePath).replaceAll("\\", "/");
    assertIgnoredAndUntracked(repoRoot, repositoryRelativePath);
    return { absolutePath, repositoryRelativePath };
  });
  if (pathKey(lexical[0]!.absolutePath) === pathKey(lexical[1]!.absolutePath)) {
    throw new TypeError(
      `Highlight renderer-compatibility render cases and summary need distinct paths; both resolve to ${lexical[0]!.absolutePath}.`,
    );
  }

  mkdirSync(outputRoot, { recursive: true });
  const outputStat = lstatSync(outputRoot);
  if (!outputStat.isDirectory() || outputStat.isSymbolicLink()) {
    throw new TypeError(
      `Highlight renderer-compatibility output root ${outputRoot} must be a real directory, not a symlink or non-directory.`,
    );
  }
  const realOutputRoot = realpathSync(outputRoot);
  for (const target of lexical) {
    const parent = resolve(target.absolutePath, "..");
    ensureRealDirectoryChain(outputRoot, parent);
    if (!isStrictDescendant(realOutputRoot, realpathSync(parent)) && parent !== realOutputRoot) {
      throw new TypeError(
        `Highlight renderer-compatibility target ${target.repositoryRelativePath} resolves outside the real output root.`,
      );
    }
    if (existsSync(target.absolutePath)) {
      const stat = lstatSync(target.absolutePath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new TypeError(
          `Highlight renderer-compatibility target ${target.repositoryRelativePath} must be absent or a regular file, not a symlink or non-file.`,
        );
      }
    }
  }
  return { renderCases: lexical[0]!, compatibility: lexical[1]! };
}

function writeDurableExclusive(path: string, bytes: Uint8Array): void {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const count = writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count <= 0) {
        throw new TypeError(
          `Highlight renderer-compatibility staging write stopped at byte ${offset} of ${bytes.length}.`,
        );
      }
      offset += count;
    }
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function removeIfPresent(path: string): void {
  if (existsSync(path)) rmSync(path, { force: true });
}

interface CleanupFailure {
  readonly path: string;
  readonly error: Error;
}

function cleanupArtifacts(
  paths: readonly string[],
  input: HighlightRendererCompatibilityArtifactInput,
): readonly CleanupFailure[] {
  const failures: CleanupFailure[] = [];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      input.testHooks?.beforeCleanupPath?.(path);
      rmSync(path, { force: true });
    } catch (error) {
      failures.push({
        path,
        error: new Error(
          `Could not remove highlight renderer-compatibility transaction artifact ${path}: ${error instanceof Error ? error.message : String(error)}.`,
          { cause: error },
        ),
      });
    }
  }
  return failures;
}

function rollbackOperation(label: string, operation: () => void, failures: Error[]): void {
  try {
    operation();
  } catch (error) {
    failures.push(
      new Error(
        `Highlight renderer-compatibility rollback could not ${label}: ${error instanceof Error ? error.message : String(error)}.`,
        { cause: error },
      ),
    );
  }
}

/**
 * Replaces the two compatibility artifacts as one synchronous rollback transaction.
 *
 * Both complete byte strings are durably staged before either public path changes. A synchronous failure before
 * cleanup attempts to restore the prior pair. Rollback or cleanup failures are aggregated with exact recovery paths;
 * they never mask the triggering error. This is deliberately not process-crash atomic. The verifier binds both exact
 * roles and rejects a crash-mixed pair, and this writer never describes the pair as independent visual evidence.
 */
export function writeHighlightRendererCompatibilityArtifacts(
  input: HighlightRendererCompatibilityArtifactInput,
): void {
  if (input.renderCasesBytes.length === 0 || input.compatibilityBytes.length === 0) {
    throw new TypeError(
      `Highlight renderer-compatibility artifacts must both be non-empty; received ${input.renderCasesBytes.length} and ${input.compatibilityBytes.length} bytes.`,
    );
  }
  const targets = prepareTargets(input);
  const tag = `${process.pid}-${randomBytes(8).toString("hex")}`;
  const rawTemp = `${targets.renderCases.absolutePath}.tmp-${tag}`;
  const summaryTemp = `${targets.compatibility.absolutePath}.tmp-${tag}`;
  const rawBackup = `${targets.renderCases.absolutePath}.bak-${tag}`;
  const summaryBackup = `${targets.compatibility.absolutePath}.bak-${tag}`;
  let rawBackedUp = false;
  let summaryBackedUp = false;
  let rawCommitted = false;
  let summaryCommitted = false;
  const transactionArtifacts = [rawTemp, summaryTemp, rawBackup, summaryBackup] as const;
  try {
    writeDurableExclusive(rawTemp, input.renderCasesBytes);
    writeDurableExclusive(summaryTemp, input.compatibilityBytes);
    if (existsSync(targets.renderCases.absolutePath)) {
      renameSync(targets.renderCases.absolutePath, rawBackup);
      rawBackedUp = true;
    }
    if (existsSync(targets.compatibility.absolutePath)) {
      renameSync(targets.compatibility.absolutePath, summaryBackup);
      summaryBackedUp = true;
    }
    renameSync(rawTemp, targets.renderCases.absolutePath);
    rawCommitted = true;
    input.testHooks?.beforeCompatibilityCommit?.();
    renameSync(summaryTemp, targets.compatibility.absolutePath);
    summaryCommitted = true;
    if (
      !Buffer.from(readFileSync(targets.renderCases.absolutePath)).equals(
        Buffer.from(input.renderCasesBytes),
      ) ||
      !Buffer.from(readFileSync(targets.compatibility.absolutePath)).equals(
        Buffer.from(input.compatibilityBytes),
      )
    ) {
      throw new TypeError(
        "Highlight renderer-compatibility artifact transaction produced different bytes than the staged pair.",
      );
    }
    input.testHooks?.afterCompatibilityCommit?.();
  } catch (error) {
    const rollbackFailures: Error[] = [];
    rollbackOperation(
      `remove the replacement render cases at ${targets.renderCases.absolutePath}`,
      () => rawCommitted && removeIfPresent(targets.renderCases.absolutePath),
      rollbackFailures,
    );
    rollbackOperation(
      `remove the replacement compatibility summary at ${targets.compatibility.absolutePath}`,
      () => summaryCommitted && removeIfPresent(targets.compatibility.absolutePath),
      rollbackFailures,
    );
    rollbackOperation(
      `restore the prior render cases from ${rawBackup}`,
      () => rawBackedUp && renameSync(rawBackup, targets.renderCases.absolutePath),
      rollbackFailures,
    );
    rollbackOperation(
      `restore the prior compatibility summary from ${summaryBackup}`,
      () => summaryBackedUp && renameSync(summaryBackup, targets.compatibility.absolutePath),
      rollbackFailures,
    );
    if (rollbackFailures.length > 0) {
      throw new AggregateError(
        [error, ...rollbackFailures],
        `Highlight renderer-compatibility update failed and could not fully restore its prior pair. Public state is ` +
          `unknown; preserve and inspect recovery paths [${transactionArtifacts.join(", ")}].`,
        { cause: error },
      );
    }
    const cleanupFailures = cleanupArtifacts(transactionArtifacts, input);
    if (cleanupFailures.length > 0) {
      throw new AggregateError(
        [error, ...cleanupFailures.map(({ error: cleanupError }) => cleanupError)],
        `Highlight renderer-compatibility update failed, the prior public pair was restored, but cleanup also ` +
          `failed at [${cleanupFailures.map(({ path }) => path).join(", ")}].`,
        { cause: error },
      );
    }
    throw error;
  }
  const cleanupFailures = cleanupArtifacts(transactionArtifacts, input);
  if (cleanupFailures.length > 0) {
    throw new AggregateError(
      cleanupFailures.map(({ error }) => error),
      `Highlight renderer-compatibility public pair is committed and byte-verified, but transaction cleanup failed ` +
        `at [${cleanupFailures.map(({ path }) => path).join(", ")}]. The public pair is consistent; remove only ` +
        `the named transaction artifacts after inspection.`,
      { cause: cleanupFailures[0]!.error },
    );
  }
}
