import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
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
import {
  createContainedDirectoryOwnership,
  assertContainedDirectoryOwnership,
  type ContainedDirectoryIdentity,
} from "./contained-directory-ownership";
import {
  removeContainedDirectoryTreeWithAdapter,
  type ContainedDirectoryRemovalAdapter,
  type ContainedDirectoryRemovalTestHooks,
} from "./contained-directory-removal";
import { normalizeThrownWithoutProbing } from "./non-probing-error";

export type { ContainedDirectoryIdentity } from "./contained-directory-ownership";

const SAFE_RELATIVE_DIRECTORY_PATTERN = /^[A-Za-z0-9._@/-]+$/u;

export interface ContainedDirectoryRaceTestHooks {
  readonly afterPreflight?: () => void;
  readonly afterMutation?: () => void;
  readonly beforeGuardCleanupUnlink?: (guardPath: string) => void;
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

function matchesDirectoryIdentity(
  expected: ContainedDirectoryIdentity,
  actual: ComparableFileState,
): boolean {
  return (
    expected.ino === actual.ino &&
    (expected.dev === 0n || actual.dev === 0n || expected.dev === actual.dev)
  );
}

function combineFailure(primary: unknown, cleanup: unknown, label: string): never {
  const primaryError = normalizeThrownWithoutProbing(
    primary,
    `${label} failed without a readable error.`,
  );
  const cleanupError = normalizeThrownWithoutProbing(
    cleanup,
    `${label} guard cleanup failed without a readable error.`,
  );
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
      `${label} uses a Windows-only cooperative directory-operation guard and is unsupported on ${process.platform}. The guard detects some accidental changes but is not malicious-peer protection.`,
    );
  }
  const guardName = `.lego-contained-guard-${randomUUID()}`;
  const guardCandidate =
    directoryCandidate === null ? guardName : `${directoryCandidate}/${guardName}`;
  const guard = preflightContainedPath(root, guardCandidate, `${label} guard`);
  let descriptor: number | null = null;
  let guardState: ComparableFileState | null = null;
  let result: T | undefined;
  let actionFailed = false;
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
    actionFailed = true;
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
          if (hooks?.beforeGuardCleanupUnlink !== undefined) {
            hooks.beforeGuardCleanupUnlink(guard.target);
            cleanupFailure = new BoundedFileReadError(
              "PATH_POLICY_VIOLATION",
              `${label} retained its guard pathname because a test-only retention seam ran; cooperative test teardown must remove the task-owned root later.`,
            );
          } else {
            unlinkSync(guard.target);
          }
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
  if (actionFailed && cleanupFailure !== null) {
    combineFailure(primaryFailure, cleanupFailure, label);
  }
  if (cleanupFailure !== null) throw cleanupFailure;
  if (actionFailed) throw primaryFailure;
  return result as T;
}

/** Cooperatively creates missing directories and detects some accidental parent changes. */
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

/** Runs an operation under a cooperative guard; callers must exclude concurrent writers. */
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

/** Cooperatively creates one absent directory and records its observed filesystem identity. */
export function createContainedDirectoryExclusive(
  root: string,
  candidate: string,
  label: string,
): ContainedDirectoryIdentity {
  const normalized = normalizeDirectoryCandidate(candidate, label);
  const segments = normalized.split("/");
  const parent = segments.length === 1 ? null : segments.slice(0, -1).join("/");
  if (parent !== null) ensureContainedDirectoryTree(root, parent, `${label} parent`);
  return withDirectoryGuard(root, parent, label, () => {
    const preflight = preflightContainedPath(root, normalized, label);
    if (existsSync(preflight.target)) {
      throw new BoundedFileReadError(
        "WRITE_FAILED",
        `${label} already exists and cannot be created exclusively: ${preflight.target}.`,
      );
    }
    mkdirSync(preflight.target);
    assertAncestorSnapshotsStable(preflight, label);
    return createContainedDirectoryOwnership({
      root,
      directoryCandidate: normalized,
      directoryTarget: preflight.target,
      directoryState: checkedDirectoryState(preflight, label),
      label,
    });
  });
}

/** Runs against one observed directory identity when callers exclude concurrent writers. */
export function withExistingContainedDirectory<T>(
  root: string,
  candidate: string,
  label: string,
  action: (directory: string) => T,
  expectedIdentity?: ContainedDirectoryIdentity,
): T {
  const normalized = normalizeDirectoryCandidate(candidate, label);
  return withDirectoryGuard(root, normalized, label, () => {
    const preflight = preflightContainedPath(root, normalized, label);
    const before = checkedDirectoryState(preflight, label);
    if (expectedIdentity !== undefined && !matchesDirectoryIdentity(expectedIdentity, before)) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${label} is not the exact directory identity supplied by its owner.`,
      );
    }
    if (expectedIdentity !== undefined) {
      assertContainedDirectoryOwnership(root, normalized, expectedIdentity, label);
    }
    const result = action(preflight.target);
    assertAncestorSnapshotsStable(preflight, label);
    if (!sameObjectIdentity(before, checkedDirectoryState(preflight, label))) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${label} changed identity during its cooperative operation.`,
      );
    }
    if (expectedIdentity !== undefined) {
      assertContainedDirectoryOwnership(root, normalized, expectedIdentity, `${label} closure`);
    }
    return result;
  });
}

/** Cooperatively renames a directory and detects some sequential identity changes. */
export function renameContainedDirectoryAtomic(
  root: string,
  sourceCandidate: string,
  targetCandidate: string,
  label: string,
  hooks?: ContainedDirectoryRaceTestHooks,
  expectedIdentity?: ContainedDirectoryIdentity,
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
      if (
        expectedIdentity !== undefined &&
        !matchesDirectoryIdentity(expectedIdentity, sourceState)
      ) {
        throw new BoundedFileReadError(
          "PATH_POLICY_VIOLATION",
          `${label} source is not the exact directory identity supplied by its owner.`,
        );
      }
      if (expectedIdentity !== undefined) {
        assertContainedDirectoryOwnership(root, sourceName, expectedIdentity, `${label} source`);
      }
      if (existsSync(target.target)) {
        throw new BoundedFileReadError(
          "WRITE_FAILED",
          `${label} target already exists and cooperative rename will not replace it: ${target.target}.`,
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
          `${label} target is not the sequentially observed source directory identity.`,
        );
      }
      if (expectedIdentity !== undefined) {
        assertContainedDirectoryOwnership(root, targetName, expectedIdentity, `${label} target`);
      }
      return target.target;
    },
    hooks,
  );
}

/** Runs with a cooperative parent marker; this does not make pathname cleanup race-safe. */
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

const REMOVAL_ADAPTER: ContainedDirectoryRemovalAdapter = Object.freeze({
  normalize: normalizeDirectoryCandidate,
  withGuard: <T>(root: string, candidate: string | null, label: string, action: () => T): T =>
    withDirectoryGuard(root, candidate, label, action),
  checkedDirectoryState,
  sameObjectIdentity,
});

/**
 * Cooperative teardown only: removes a bounded task-owned tree when no concurrent writer or
 * replacement can exist. Evidence publication and failure rollback must not call it.
 */
export function removeContainedDirectoryTree(
  root: string,
  candidate: string,
  label: string,
  hooks?: ContainedDirectoryRemovalTestHooks,
): void {
  removeContainedDirectoryTreeWithAdapter({
    adapter: REMOVAL_ADAPTER,
    root,
    candidate,
    label,
    ...(hooks === undefined ? {} : { hooks }),
  });
}
