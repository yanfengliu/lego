import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";

import {
  assertAncestorSnapshotsStable,
  BoundedFileReadError,
  comparableFileState,
  inside,
  preflightContainedPath,
  sameFileState,
  type ComparableFileState,
  type ContainedPathPreflight,
} from "./bounded-file-read";

const SAFE_RELATIVE_DIRECTORY_PATTERN = /^[A-Za-z0-9._@/-]+$/u;
const MAXIMUM_REMOVAL_ENTRIES = 25_000;

export interface ContainedDirectoryRaceTestHooks {
  readonly afterPreflight?: () => void;
  readonly afterMutation?: () => void;
  readonly beforeGuardCleanupUnlink?: () => void;
}

function normalizeDirectoryCandidate(candidate: string, label: string): string {
  const normalized = candidate.replaceAll("\\", "/");
  if (
    normalized.length === 0 ||
    !SAFE_RELATIVE_DIRECTORY_PATTERN.test(normalized) ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} must be a strict relative directory without traversal, dot segments, or special characters; received ${JSON.stringify(candidate)}.`,
    );
  }
  return normalized;
}

function checkedDirectoryState(
  preflight: ContainedPathPreflight,
  label: string,
): ComparableFileState {
  const stat = lstatSync(preflight.target, { bigint: true });
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} must be a real directory, not a symlink, junction, or non-directory: ${preflight.target}.`,
    );
  }
  const realpath = realpathSync.native(preflight.target);
  if (!inside(preflight.rootRealpath, realpath)) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} resolves outside its real root ${preflight.rootRealpath}: ${realpath}.`,
    );
  }
  return comparableFileState(stat, label);
}

function sameObjectIdentity(left: ComparableFileState, right: ComparableFileState): boolean {
  return left.ino === right.ino && (left.dev === 0n || right.dev === 0n || left.dev === right.dev);
}

function combineFailure(primary: unknown, cleanup: unknown, label: string): never {
  const primaryError = primary instanceof Error ? primary : new Error(String(primary));
  const cleanupError = cleanup instanceof Error ? cleanup : new Error(String(cleanup));
  throw new AggregateError(
    [primaryError, cleanupError],
    `${label} failed and guard cleanup failed.`,
  );
}

function withDirectoryGuard<T>(
  root: string,
  directoryCandidate: string | null,
  label: string,
  action: () => T,
  hooks?: ContainedDirectoryRaceTestHooks,
): T {
  if (process.platform !== "win32") {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} requires Windows directory share-mode pinning; this path-based implementation fails closed on ${process.platform} because POSIX permits displacement around open guard files.`,
    );
  }
  const guardName = `.lego-contained-guard-${randomUUID()}`;
  const guardCandidate =
    directoryCandidate === null ? guardName : `${directoryCandidate}/${guardName}`;
  const guard = preflightContainedPath(root, guardCandidate, `${label} guard`);
  let descriptor: number | null = null;
  let guardState: ComparableFileState | null = null;
  let result: T | undefined;
  let primaryFailure: unknown = null;
  let cleanupFailure: unknown = null;
  try {
    descriptor = openSync(guard.target, "wx");
    guardState = comparableFileState(
      fstatSync(descriptor, { bigint: true }),
      `${label} guard descriptor`,
    );
    assertAncestorSnapshotsStable(guard, `${label} guard`);
    result = action();
    assertAncestorSnapshotsStable(guard, `${label} guard`);
    const pathState = comparableFileState(
      lstatSync(guard.target, { bigint: true }),
      `${label} guard path`,
    );
    if (!sameFileState(pathState, guardState)) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${label} guard identity changed while the directory operation was in progress.`,
      );
    }
  } catch (error) {
    primaryFailure = error;
  } finally {
    try {
      if (guardState !== null) {
        assertAncestorSnapshotsStable(guard, `${label} guard cleanup`);
        const cleanupState = comparableFileState(
          lstatSync(guard.target, { bigint: true }),
          `${label} guard cleanup path`,
        );
        if (!sameFileState(cleanupState, guardState)) {
          cleanupFailure = new BoundedFileReadError(
            "PATH_POLICY_VIOLATION",
            `${label} guard cleanup refused a replaced path.`,
          );
        } else {
          hooks?.beforeGuardCleanupUnlink?.();
          unlinkSync(guard.target);
        }
      }
    } catch (error) {
      cleanupFailure = error;
    } finally {
      if (descriptor !== null) {
        try {
          closeSync(descriptor);
        } catch (error) {
          cleanupFailure =
            cleanupFailure === null
              ? error
              : new AggregateError(
                  [cleanupFailure, error],
                  `${label} guard unlink and descriptor close both failed.`,
                );
        }
      }
    }
  }
  if (primaryFailure !== null && cleanupFailure !== null) {
    combineFailure(primaryFailure, cleanupFailure, label);
  }
  if (cleanupFailure !== null) throw cleanupFailure;
  if (primaryFailure !== null) throw primaryFailure;
  return result as T;
}

/** Creates each missing directory under a guarded, identity-checked parent. */
export function ensureContainedDirectoryTree(
  root: string,
  candidate: string,
  label: string,
  hooks?: ContainedDirectoryRaceTestHooks,
): string {
  const normalized = normalizeDirectoryCandidate(candidate, label);
  const segments = normalized.split("/");
  let current = "";
  for (const segment of segments) {
    const parent = current === "" ? null : current;
    current = current === "" ? segment : `${current}/${segment}`;
    withDirectoryGuard(
      root,
      parent,
      label,
      () => {
        const preflight = preflightContainedPath(root, current, label);
        hooks?.afterPreflight?.();
        if (!existsSync(preflight.target)) mkdirSync(preflight.target);
        hooks?.afterMutation?.();
        assertAncestorSnapshotsStable(preflight, label);
        checkedDirectoryState(preflight, label);
      },
      hooks,
    );
  }
  return dirname(preflightContainedPath(root, `${normalized}/.probe`, label).target);
}

/** Runs an operation while an empty exact-handle guard pins its final parent directory. */
export function withContainedDirectory<T>(
  root: string,
  candidate: string,
  label: string,
  action: (directory: string) => T,
): T {
  const normalized = normalizeDirectoryCandidate(candidate, label);
  const directory = ensureContainedDirectoryTree(root, normalized, label);
  return withDirectoryGuard(root, normalized, label, () => action(directory));
}

/** Renames one direct contained directory and proves the same identity arrived at the target. */
export function renameContainedDirectoryAtomic(
  root: string,
  sourceCandidate: string,
  targetCandidate: string,
  label: string,
  hooks?: ContainedDirectoryRaceTestHooks,
): string {
  const sourceName = normalizeDirectoryCandidate(sourceCandidate, `${label} source`);
  const targetName = normalizeDirectoryCandidate(targetCandidate, `${label} target`);
  return withDirectoryGuard(
    root,
    null,
    label,
    () => {
      const source = preflightContainedPath(root, sourceName, `${label} source`);
      const target = preflightContainedPath(root, targetName, `${label} target`);
      const sourceState = checkedDirectoryState(source, `${label} source`);
      if (existsSync(target.target)) {
        throw new BoundedFileReadError(
          "WRITE_FAILED",
          `${label} target already exists and cannot be atomically published: ${target.target}.`,
        );
      }
      hooks?.afterPreflight?.();
      assertAncestorSnapshotsStable(source, `${label} source`);
      assertAncestorSnapshotsStable(target, `${label} target`);
      renameSync(source.target, target.target);
      hooks?.afterMutation?.();
      assertAncestorSnapshotsStable(target, `${label} target`);
      const targetState = checkedDirectoryState(target, `${label} target`);
      if (!sameObjectIdentity(sourceState, targetState)) {
        throw new BoundedFileReadError(
          "PATH_POLICY_VIOLATION",
          `${label} target is not the verified source directory identity.`,
        );
      }
      return target.target;
    },
    hooks,
  );
}

/** Pins a regular file's existing parent for the full write, cleanup, and return boundary. */
export function withContainedFileParent<T>(
  root: string,
  candidate: string,
  label: string,
  action: () => T,
): T {
  const normalized = candidate.replaceAll("\\", "/");
  preflightContainedPath(root, normalized, label);
  const segments = normalized.split("/");
  const parent = segments.length === 1 ? null : segments.slice(0, -1).join("/");
  return withDirectoryGuard(root, parent, label, action);
}

/** Removes a bounded task-owned tree only after a full no-link walk under a root guard. */
export function removeContainedDirectoryTree(root: string, candidate: string, label: string): void {
  const normalized = normalizeDirectoryCandidate(candidate, label);
  withDirectoryGuard(root, null, label, () => {
    const preflight = preflightContainedPath(root, normalized, label);
    const before = checkedDirectoryState(preflight, label);
    let entries = 0;
    const removeContents = (directoryCandidate: string): void => {
      withDirectoryGuard(root, directoryCandidate, label, () => {
        const directory = preflightContainedPath(root, `${directoryCandidate}/.probe`, label);
        for (const name of readdirSync(dirname(directory.target))) {
          if (name.startsWith(".lego-contained-guard-")) continue;
          entries += 1;
          if (entries > MAXIMUM_REMOVAL_ENTRIES) {
            throw new BoundedFileReadError(
              "SIZE_OUT_OF_RANGE",
              `${label} contains more than ${MAXIMUM_REMOVAL_ENTRIES} entries; bounded cleanup refused it.`,
            );
          }
          const childCandidate = `${directoryCandidate}/${name}`;
          const child = preflightContainedPath(root, childCandidate, label);
          const stat = lstatSync(child.target, { bigint: true });
          const state = comparableFileState(stat, `${label} removal entry ${child.target}`);
          if (stat.isSymbolicLink()) {
            throw new BoundedFileReadError(
              "PATH_POLICY_VIOLATION",
              `${label} removal refused symlink or junction ${child.target}.`,
            );
          }
          assertAncestorSnapshotsStable(child, label);
          if (stat.isDirectory()) {
            removeContents(childCandidate);
            assertAncestorSnapshotsStable(child, label);
            const emptyState = checkedDirectoryState(child, label);
            if (!sameObjectIdentity(state, emptyState)) {
              throw new BoundedFileReadError(
                "PATH_POLICY_VIOLATION",
                `${label} removal directory changed identity before deletion: ${child.target}.`,
              );
            }
            rmdirSync(child.target);
          } else if (stat.isFile()) {
            if (!inside(child.rootRealpath, realpathSync.native(child.target))) {
              throw new BoundedFileReadError(
                "PATH_POLICY_VIOLATION",
                `${label} removal file escaped its real root: ${child.target}.`,
              );
            }
            unlinkSync(child.target);
          } else {
            throw new BoundedFileReadError(
              "PATH_POLICY_VIOLATION",
              `${label} removal refused non-file entry ${child.target}.`,
            );
          }
        }
      });
    };
    removeContents(normalized);
    assertAncestorSnapshotsStable(preflight, label);
    if (!sameObjectIdentity(before, checkedDirectoryState(preflight, label))) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${label} changed identity during its bounded cleanup walk.`,
      );
    }
    rmdirSync(preflight.target);
    assertAncestorSnapshotsStable(preflight, label);
  });
}
