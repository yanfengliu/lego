import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  type BigIntStats,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const SAFE_RELATIVE_PATH_PATTERN = /^[A-Za-z0-9._@/-]+$/u;

export type BoundedFileReadErrorCode =
  | "INVALID_BOUND"
  | "PATH_POLICY_VIOLATION"
  | "OPEN_FAILED"
  | "NOT_REGULAR_FILE"
  | "SIZE_OUT_OF_RANGE"
  | "IDENTITY_UNAVAILABLE"
  | "CHANGED_DURING_READ"
  | "CLOSE_FAILED"
  | "WRITE_FAILED";

export class BoundedFileReadError extends Error {
  readonly code: BoundedFileReadErrorCode;

  constructor(code: BoundedFileReadErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "BoundedFileReadError";
    this.code = code;
  }
}

/** Test-only race seams. Production callers must leave these hooks absent. */
export interface BoundedFileRaceTestHooks {
  readonly afterPreflight?: () => void;
  readonly afterRead?: () => void;
  readonly afterTemporaryWrite?: () => void;
  readonly afterRename?: () => void;
}

export interface BoundedFileReadPolicy {
  readonly label: string;
  readonly minimumBytes?: number;
  readonly maximumBytes: number;
  readonly exactBytes?: number;
  readonly __testHooks?: BoundedFileRaceTestHooks;
}

/** @internal Shared with the contained atomic-write boundary. */
export interface ComparableFileState {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly size: bigint;
  readonly mtimeNs: bigint;
  readonly ctimeNs: bigint;
}

interface PathIdentity {
  readonly path: string;
  readonly dev: bigint;
  readonly ino: bigint;
}

/** @internal Shared with the contained atomic-write boundary. */
export interface ContainedPathPreflight {
  readonly root: string;
  readonly rootRealpath: string;
  readonly target: string;
  readonly ancestors: readonly PathIdentity[];
}

/** @internal */
export function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

/** @internal */
export function comparableIdentity(stat: BigIntStats, label: string): PathIdentity {
  if (stat.dev < 0n || stat.ino <= 0n) {
    throw new BoundedFileReadError(
      "IDENTITY_UNAVAILABLE",
      `${label} does not expose a comparable positive inode identity; fail closed because a path replacement cannot be detected on this filesystem.`,
    );
  }
  return { path: label, dev: stat.dev, ino: stat.ino };
}

/** @internal */
export function comparableFileState(stat: BigIntStats, label: string): ComparableFileState {
  comparableIdentity(stat, label);
  if (stat.size < 0n || stat.mtimeNs < 0n || stat.ctimeNs < 0n) {
    throw new BoundedFileReadError(
      "IDENTITY_UNAVAILABLE",
      `${label} does not expose comparable size, modification-time, and change-time metadata; fail closed because a same-size concurrent mutation cannot be detected.`,
    );
  }
  return {
    dev: stat.dev,
    ino: stat.ino,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs,
  };
}

function sameIdentity(left: PathIdentity, right: PathIdentity): boolean {
  return left.ino === right.ino && (left.dev === 0n || right.dev === 0n || left.dev === right.dev);
}

/** @internal */
export function sameFileState(left: ComparableFileState, right: ComparableFileState): boolean {
  return (
    left.ino === right.ino &&
    (left.dev === 0n || right.dev === 0n || left.dev === right.dev) &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function validateRelativeCandidate(candidate: string, label: string): string {
  const normalized = candidate.replaceAll("\\", "/");
  if (
    candidate.length === 0 ||
    isAbsolute(candidate) ||
    !SAFE_RELATIVE_PATH_PATTERN.test(normalized) ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} must be a strict relative path without traversal, dot segments, or special characters; received ${JSON.stringify(candidate)}.`,
    );
  }
  return normalized;
}

function snapshotAncestors(root: string, target: string, label: string): readonly PathIdentity[] {
  const ancestors: PathIdentity[] = [];
  let cursor = root;
  const relativeTarget = relative(root, target);
  const segments = relativeTarget === "" ? [] : relativeTarget.split(sep);
  const ancestorSegments = segments.slice(0, -1);
  for (const segment of ["", ...ancestorSegments]) {
    if (segment !== "") cursor = join(cursor, segment);
    let stat: BigIntStats;
    try {
      stat = lstatSync(cursor, { bigint: true });
    } catch (error) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${label} ancestor ${JSON.stringify(cursor)} could not be inspected before filesystem access: ${error instanceof Error ? error.message : String(error)}.`,
        error,
      );
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${label} ancestor ${JSON.stringify(cursor)} must be a real directory, not a symlink, junction, or non-directory.`,
      );
    }
    const identity = comparableIdentity(stat, `${label} ancestor ${JSON.stringify(cursor)}`);
    ancestors.push({ ...identity, path: cursor });
  }
  return ancestors;
}

/** @internal */
export function preflightContainedPath(
  root: string,
  candidate: string,
  label: string,
): ContainedPathPreflight {
  const normalized = validateRelativeCandidate(candidate, label);
  const resolvedRoot = resolve(root);
  const target = resolve(resolvedRoot, normalized);
  if (!inside(resolvedRoot, target)) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} resolves outside ${resolvedRoot}: ${target}.`,
    );
  }
  const ancestors = snapshotAncestors(resolvedRoot, target, label);
  let rootRealpath: string;
  try {
    rootRealpath = realpathSync.native(resolvedRoot);
  } catch (error) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} root ${JSON.stringify(resolvedRoot)} could not be resolved without links: ${error instanceof Error ? error.message : String(error)}.`,
      error,
    );
  }
  if (!inside(rootRealpath, realpathSync.native(dirname(target)))) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} parent resolves outside the real root ${rootRealpath}: ${dirname(target)}.`,
    );
  }
  return { root: resolvedRoot, rootRealpath, target, ancestors };
}

/** @internal */
export function assertAncestorSnapshotsStable(
  preflight: ContainedPathPreflight,
  label: string,
): readonly PathIdentity[] {
  const observed = snapshotAncestors(preflight.root, preflight.target, label);
  if (
    observed.length !== preflight.ancestors.length ||
    observed.some((identity, index) => !sameIdentity(identity, preflight.ancestors[index]!))
  ) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} ancestor identity changed between containment checks; a directory or junction was replaced during access. Retry with an immutable contained path.`,
    );
  }
  const observedRootRealpath = realpathSync.native(preflight.root);
  const observedParentRealpath = realpathSync.native(dirname(preflight.target));
  if (
    observedRootRealpath !== preflight.rootRealpath ||
    !inside(preflight.rootRealpath, observedParentRealpath)
  ) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} root or parent realpath changed during access; retry with an immutable contained path.`,
    );
  }
  return observed;
}

function validatePolicy(path: string, policy: BoundedFileReadPolicy): number {
  const minimumBytes = policy.minimumBytes ?? 1;
  if (
    !Number.isSafeInteger(minimumBytes) ||
    minimumBytes < 0 ||
    !Number.isSafeInteger(policy.maximumBytes) ||
    policy.maximumBytes < minimumBytes ||
    (policy.exactBytes !== undefined &&
      (!Number.isSafeInteger(policy.exactBytes) ||
        policy.exactBytes < minimumBytes ||
        policy.exactBytes > policy.maximumBytes))
  ) {
    throw new BoundedFileReadError(
      "INVALID_BOUND",
      `${policy.label} at ${JSON.stringify(path)} has an invalid read policy; minimum, maximum, and exact byte bounds must be safe non-negative integers in increasing order.`,
    );
  }
  return minimumBytes;
}

function readOpenDescriptor(
  descriptor: number,
  path: string,
  policy: BoundedFileReadPolicy,
  expectedBefore?: ComparableFileState,
): Buffer {
  const minimumBytes = validatePolicy(path, policy);
  const beforeStat = fstatSync(descriptor, { bigint: true });
  if (!beforeStat.isFile()) {
    throw new BoundedFileReadError(
      "NOT_REGULAR_FILE",
      `${policy.label} at ${JSON.stringify(path)} is not a regular file; provide one immutable bounded regular file.`,
    );
  }
  const before = comparableFileState(
    beforeStat,
    `${policy.label} descriptor for ${JSON.stringify(path)}`,
  );
  if (expectedBefore !== undefined && !sameFileState(expectedBefore, before)) {
    throw new BoundedFileReadError(
      "CHANGED_DURING_READ",
      `${policy.label} at ${JSON.stringify(path)} was replaced or mutated between lstat and open; retry with an immutable file.`,
    );
  }
  const size = Number(before.size);
  const exactMismatch = policy.exactBytes !== undefined && size !== policy.exactBytes;
  if (size < minimumBytes || size > policy.maximumBytes || exactMismatch) {
    const requirement =
      policy.exactBytes === undefined
        ? `${minimumBytes}..${policy.maximumBytes} bytes`
        : `exactly ${policy.exactBytes} bytes`;
    throw new BoundedFileReadError(
      "SIZE_OUT_OF_RANGE",
      `${policy.label} at ${JSON.stringify(path)} is ${size} bytes; required ${requirement}. It was rejected before any contents were read; regenerate the bounded file instead of raising the limit.`,
    );
  }

  const bytes = Buffer.allocUnsafe(size);
  let offset = 0;
  while (offset < bytes.length) {
    const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (count === 0) {
      throw new BoundedFileReadError(
        "CHANGED_DURING_READ",
        `${policy.label} at ${JSON.stringify(path)} ended after ${offset} of ${size} bytes; retry with an immutable file.`,
      );
    }
    offset += count;
  }
  const trailing = Buffer.allocUnsafe(1);
  const extraBytes = readSync(descriptor, trailing, 0, 1, size);
  policy.__testHooks?.afterRead?.();
  const after = comparableFileState(
    fstatSync(descriptor, { bigint: true }),
    `${policy.label} descriptor for ${JSON.stringify(path)}`,
  );
  if (extraBytes !== 0 || !sameFileState(after, before)) {
    throw new BoundedFileReadError(
      "CHANGED_DURING_READ",
      `${policy.label} at ${JSON.stringify(path)} changed identity, size, modification time, or change time while being read; retry with an immutable file.`,
    );
  }
  return bytes;
}

/** @internal */
export function closeDescriptor(
  descriptor: number | null,
  path: string,
  policy: BoundedFileReadPolicy,
  failure: Error | null,
): Error | null {
  if (descriptor === null) return failure;
  try {
    closeSync(descriptor);
    return failure;
  } catch (error) {
    const closeFailure = new BoundedFileReadError(
      "CLOSE_FAILED",
      `${policy.label} at ${JSON.stringify(path)} could not close its descriptor: ${error instanceof Error ? error.message : String(error)}. Retry after checking the filesystem.`,
      error,
    );
    return failure === null
      ? closeFailure
      : new AggregateError(
          [failure, closeFailure],
          `${policy.label} at ${JSON.stringify(path)} failed to access and close safely.`,
        );
  }
}

/** Opens, sizes, and reads one regular file without ever allocating beyond the declared bound. */
export function readBoundedRegularFile(path: string, policy: BoundedFileReadPolicy): Buffer {
  let descriptor: number | null = null;
  let result: Buffer | null = null;
  let failure: Error | null = null;
  try {
    descriptor = openSync(path, "r");
    result = readOpenDescriptor(descriptor, path, policy);
  } catch (error) {
    failure =
      error instanceof BoundedFileReadError
        ? error
        : new BoundedFileReadError(
            "OPEN_FAILED",
            `${policy.label} at ${JSON.stringify(path)} could not be safely opened, sized, and read: ${error instanceof Error ? error.message : String(error)}.`,
            error,
          );
  } finally {
    failure = closeDescriptor(descriptor, path, policy, failure);
  }
  if (failure !== null) throw failure;
  if (result === null) {
    throw new BoundedFileReadError(
      "OPEN_FAILED",
      `${policy.label} at ${JSON.stringify(path)} produced no bytes and no filesystem result; retry the bounded read.`,
    );
  }
  return result;
}

/** Combines containment, link rejection, open, descriptor identity, and post-read verification. */
export function readContainedBoundedRegularFile(
  root: string,
  candidate: string,
  policy: BoundedFileReadPolicy,
): Buffer {
  let descriptor: number | null = null;
  let result: Buffer | null = null;
  let failure: Error | null = null;
  let path = candidate;
  try {
    validatePolicy(candidate, policy);
    const preflight = preflightContainedPath(root, candidate, policy.label);
    path = preflight.target;
    const preLstat = lstatSync(preflight.target, { bigint: true });
    if (preLstat.isSymbolicLink() || !preLstat.isFile()) {
      throw new BoundedFileReadError(
        "NOT_REGULAR_FILE",
        `${policy.label} at ${JSON.stringify(preflight.target)} must be a real regular file, not a symlink, junction, or non-file.`,
      );
    }
    const preState = comparableFileState(preLstat, `${policy.label} pre-open path`);
    const preRealpath = realpathSync.native(preflight.target);
    if (!inside(preflight.rootRealpath, preRealpath)) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${policy.label} resolves outside the real root ${preflight.rootRealpath}: ${preRealpath}.`,
      );
    }
    policy.__testHooks?.afterPreflight?.();
    descriptor = openSync(preflight.target, "r");
    result = readOpenDescriptor(descriptor, preflight.target, policy, preState);
    assertAncestorSnapshotsStable(preflight, policy.label);
    const postLstat = lstatSync(preflight.target, { bigint: true });
    if (postLstat.isSymbolicLink() || !postLstat.isFile()) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${policy.label} path became a symlink, junction, or non-file during access: ${preflight.target}.`,
      );
    }
    const postState = comparableFileState(postLstat, `${policy.label} post-read path`);
    const descriptorState = comparableFileState(
      fstatSync(descriptor, { bigint: true }),
      `${policy.label} post-read descriptor`,
    );
    const postRealpath = realpathSync.native(preflight.target);
    if (
      preRealpath !== postRealpath ||
      !inside(preflight.rootRealpath, postRealpath) ||
      !sameFileState(preState, postState) ||
      !sameFileState(descriptorState, postState)
    ) {
      throw new BoundedFileReadError(
        "CHANGED_DURING_READ",
        `${policy.label} path, identity, size, modification time, or change time changed around its descriptor read; retry with an immutable contained file.`,
      );
    }
  } catch (error) {
    failure =
      error instanceof BoundedFileReadError
        ? error
        : new BoundedFileReadError(
            "OPEN_FAILED",
            `${policy.label} at ${JSON.stringify(path)} could not be contained, opened, and read safely: ${error instanceof Error ? error.message : String(error)}.`,
            error,
          );
  } finally {
    failure = closeDescriptor(descriptor, path, policy, failure);
  }
  if (failure !== null) throw failure;
  if (result === null) {
    throw new BoundedFileReadError(
      "OPEN_FAILED",
      `${policy.label} at ${JSON.stringify(path)} produced no bytes and no filesystem result; retry the contained read.`,
    );
  }
  return result;
}
