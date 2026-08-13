import { randomUUID } from "node:crypto";
import { basename, dirname, relative, resolve } from "node:path";

import { ensureContainedDirectoryTree, removeContainedDirectoryTree } from "./contained-directory";

const TEMPORARY_PREFIX = "lego-source-parity-execution-";
const TEMPORARY_ROOT = "tmp";
const activeExecutionDirectories = new Set<string>();

/** Creates one task-owned mirror beneath Vite's already admitted workspace root. */
export function createRealBuildSourceParityExecutionDirectory(repoRoot: string): string {
  ensureContainedDirectoryTree(repoRoot, TEMPORARY_ROOT, "source-parity temporary root");
  const candidate = `${TEMPORARY_ROOT}/${TEMPORARY_PREFIX}${process.pid}-${randomUUID()}`;
  const directory = ensureContainedDirectoryTree(
    repoRoot,
    candidate,
    "source-parity execution directory",
  );
  activeExecutionDirectories.add(resolve(directory));
  return directory;
}

/** Removes only a direct task-owned mirror child after a bounded no-link walk. */
export function removeRealBuildSourceParityExecutionDirectory(
  repoRoot: string,
  directory: string,
): void {
  const resolvedRoot = resolve(repoRoot);
  const resolved = resolve(directory);
  const relativeDirectory = relative(resolvedRoot, resolved).replaceAll("\\", "/");
  if (
    dirname(resolved) !== resolve(resolvedRoot, TEMPORARY_ROOT) ||
    !basename(resolved).startsWith(TEMPORARY_PREFIX) ||
    relativeDirectory !== `${TEMPORARY_ROOT}/${basename(resolved)}` ||
    !activeExecutionDirectories.has(resolved)
  ) {
    throw new Error(
      `Refusing to remove source-parity directory ${resolved}; expected one process-owned direct ${TEMPORARY_ROOT}/${TEMPORARY_PREFIX}<pid>-<uuid> child created beneath ${resolvedRoot}.`,
    );
  }
  removeContainedDirectoryTree(
    resolvedRoot,
    relativeDirectory,
    "source-parity execution directory",
  );
  activeExecutionDirectories.delete(resolved);
}
