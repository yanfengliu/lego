import { existsSync, lstatSync, realpathSync, renameSync } from "node:fs";
import { dirname } from "node:path";

import {
  assertAncestorSnapshotsStable,
  BoundedFileReadError,
  comparableFileState,
  inside,
  preflightContainedPath,
  type ComparableFileState,
  type ContainedPathPreflight,
} from "./bounded-file-read";
import {
  assertContainedDirectoryOwnership,
  type ContainedDirectoryIdentity,
} from "./contained-directory-ownership";

function sameIdentity(expected: ContainedDirectoryIdentity, actual: ComparableFileState): boolean {
  return (
    expected.ino === actual.ino &&
    (expected.dev === 0n || actual.dev === 0n || expected.dev === actual.dev)
  );
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

/**
 * Cooperatively commits a preverified directory with rename as the final path operation.
 *
 * Successful return means only that the native same-parent rename returned. This path-based helper
 * neither makes rename identity-conditional nor proves protection from a malicious same-user race.
 */
export function commitContainedDirectoryRenameAtomic(input: {
  readonly root: string;
  readonly sourceCandidate: string;
  readonly targetCandidate: string;
  readonly expectedIdentity: ContainedDirectoryIdentity;
  readonly label: string;
  /** @internal Runs after the last source check and immediately before the native rename. */
  readonly __testBeforeRename?: () => void;
}): string {
  if (process.platform !== "win32") {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${input.label} requires Windows same-parent directory rename semantics; this path-based implementation fails closed on ${process.platform}.`,
    );
  }
  const source = preflightContainedPath(input.root, input.sourceCandidate, `${input.label} source`);
  const target = preflightContainedPath(input.root, input.targetCandidate, `${input.label} target`);
  if (dirname(source.target) !== dirname(target.target)) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${input.label} requires source and target to have the exact same parent directory.`,
    );
  }
  if (!sameIdentity(input.expectedIdentity, checkedDirectoryState(source, input.label))) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${input.label} source is not the exact retained directory identity supplied by its owner.`,
    );
  }
  assertContainedDirectoryOwnership(
    input.root,
    input.sourceCandidate,
    input.expectedIdentity,
    `${input.label} source`,
  );
  if (existsSync(target.target)) {
    throw new BoundedFileReadError(
      "WRITE_FAILED",
      `${input.label} target already exists and cooperative rename will not replace it: ${target.target}.`,
    );
  }
  assertAncestorSnapshotsStable(source, `${input.label} source final commit`);
  assertAncestorSnapshotsStable(target, `${input.label} target final commit`);
  if (!sameIdentity(input.expectedIdentity, checkedDirectoryState(source, input.label))) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${input.label} source identity changed immediately before its final rename.`,
    );
  }
  input.__testBeforeRename?.();
  renameSync(source.target, target.target);
  return target.target;
}
