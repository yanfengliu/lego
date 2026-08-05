import { createHash } from "node:crypto";
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
const SHA256_PIN_PATTERN = /^sha256:[0-9a-f]{64}$/u;

/**
 * What a metadata comparison proves, stated wherever it is the only evidence available.
 *
 * Measured on this checkout (Windows 11, NTFS, Node 24.18.1): 145-158 of 200 same-size rewrites
 * left dev, inode, size, mtimeNs and ctimeNs byte-identical, and 12-15 of 50 pre-open rewrites
 * were returned to the caller with no error at all. A passing metadata comparison is therefore
 * not evidence that the bytes are the intended bytes; only `expectedSha256` is.
 */
const METADATA_ONLY_LIMITATION =
  "This compared device, inode, size, modification time and change time only -- never contents. " +
  "Two cases defeat that comparison and are not fixed by retrying or by using an immutable file: " +
  "a same-size rewrite landing inside one filesystem timestamp tick (about 15.6 ms on NTFS) leaves " +
  "every one of those fields identical, and a rewrite that finished before the baseline was taken " +
  "is invisible to every later comparison. Pin the exact contents through the policy's " +
  "expectedSha256 field to make the returned bytes verifiable.";

export type BoundedFileReadErrorCode =
  | "INVALID_BOUND"
  | "PATH_POLICY_VIOLATION"
  | "OPEN_FAILED"
  | "NOT_REGULAR_FILE"
  | "SIZE_OUT_OF_RANGE"
  | "IDENTITY_UNAVAILABLE"
  | "CONTENT_DIGEST_MISMATCH"
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
  /**
   * `sha256:<64 lowercase hex>` pin over the exact expected contents.
   *
   * This is the only field that proves what was read. Supply it wherever the caller already knows
   * the digest -- a manifest entry, a CAS address, a committed fixture -- because the identity and
   * timestamp comparisons around it cannot distinguish a same-size concurrent rewrite.
   */
  readonly expectedSha256?: string;
  readonly __testHooks?: BoundedFileRaceTestHooks;
}

function sha256Pin(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** Says whether the returned bytes were proven, so a stability rejection cannot imply more. */
function contentEvidenceClause(policy: BoundedFileReadPolicy): string {
  return policy.expectedSha256 === undefined
    ? METADATA_ONLY_LIMITATION
    : `The contents did match the caller's expectedSha256 pin ${policy.expectedSha256}, so this ` +
        "rejection is about the file not holding still, not about the bytes being wrong.";
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
      `${label} does not expose comparable size, modification-time, and change-time metadata; fail closed because not even a differently-sized or differently-timed concurrent mutation could be noticed here.`,
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
  if (policy.expectedSha256 !== undefined && !SHA256_PIN_PATTERN.test(policy.expectedSha256)) {
    throw new BoundedFileReadError(
      "INVALID_BOUND",
      `${policy.label} at ${JSON.stringify(path)} pins an unusable content digest ${JSON.stringify(policy.expectedSha256)}; expectedSha256 must be the literal prefix "sha256:" followed by 64 lowercase hexadecimal characters, or be omitted entirely.`,
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
      `${policy.label} at ${JSON.stringify(path)} did not present the same device, inode, size, modification time, and change time at open as the lstat taken immediately before it, so the path was replaced or written between those two calls. ${contentEvidenceClause(policy)}`,
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
        `${policy.label} at ${JSON.stringify(path)} ended after ${offset} of the ${size} bytes its own descriptor reported at open, so it was truncated while being read. The partial bytes were discarded. ${contentEvidenceClause(policy)}`,
      );
    }
    offset += count;
  }
  assertPinnedContent(bytes, path, policy);
  const trailing = Buffer.allocUnsafe(1);
  const extraBytes = readSync(descriptor, trailing, 0, 1, size);
  policy.__testHooks?.afterRead?.();
  const after = comparableFileState(
    fstatSync(descriptor, { bigint: true }),
    `${policy.label} descriptor for ${JSON.stringify(path)}`,
  );
  if (extraBytes !== 0) {
    throw new BoundedFileReadError(
      "CHANGED_DURING_READ",
      `${policy.label} at ${JSON.stringify(path)} grew past the ${size} bytes its own descriptor reported at open; a further byte was readable at offset ${size} once the bounded read finished. ${contentEvidenceClause(policy)}`,
    );
  }
  if (!sameFileState(after, before)) {
    throw new BoundedFileReadError(
      "CHANGED_DURING_READ",
      `${policy.label} at ${JSON.stringify(path)} did not hold one device, inode, size, modification time, and change time across its own descriptor read; the file was written or replaced while the ${size} bytes were being read. ${contentEvidenceClause(policy)}`,
    );
  }
  return bytes;
}

/**
 * The only check here that inspects contents, and so the only one that can reject bytes the
 * caller never intended. It runs before the identity and timestamp comparisons deliberately:
 * whether those happen to notice a same-size rewrite depends on filesystem clock granularity,
 * and a rejection must not depend on a race the caller cannot control.
 */
function assertPinnedContent(bytes: Buffer, path: string, policy: BoundedFileReadPolicy): void {
  if (policy.expectedSha256 === undefined) return;
  const observed = sha256Pin(bytes);
  if (observed === policy.expectedSha256) return;
  throw new BoundedFileReadError(
    "CONTENT_DIGEST_MISMATCH",
    `${policy.label} at ${JSON.stringify(path)} hashes to ${observed} over the ${bytes.length} bytes read through this descriptor, but the caller pinned ${policy.expectedSha256}. Those bytes were discarded and never returned. Comparing contents is what catches a same-size concurrent rewrite; identical device, inode, size, modification time, and change time cannot distinguish one. Regenerate the file so it matches the pin, or re-pin it to the digest it genuinely has -- dropping expectedSha256 would silently accept whatever bytes this path happened to hold.`,
  );
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

/**
 * Opens, sizes, and reads one regular file without ever allocating beyond the declared bound.
 * The returned bytes are proven only when the policy pins `expectedSha256`.
 */
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

/**
 * Combines containment, link rejection, open, descriptor identity, and post-read verification.
 * Containment and identity bound *which* file was read; only a pinned `expectedSha256` bounds
 * *what* it contained, because a same-size rewrite inside one timestamp tick is metadata-identical.
 */
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
    const drift = [
      preRealpath === postRealpath
        ? null
        : `its real path moved from ${JSON.stringify(preRealpath)} to ${JSON.stringify(postRealpath)}`,
      inside(preflight.rootRealpath, postRealpath)
        ? null
        : `it now resolves outside the real root ${JSON.stringify(preflight.rootRealpath)}`,
      sameFileState(preState, postState)
        ? null
        : "the path's device, inode, size, modification time, or change time differs from the pre-open lstat",
      sameFileState(descriptorState, postState)
        ? null
        : "the open descriptor and the path no longer describe one same file state",
    ].filter((reason): reason is string => reason !== null);
    if (drift.length > 0) {
      throw new BoundedFileReadError(
        "CHANGED_DURING_READ",
        `${policy.label} at ${JSON.stringify(preflight.target)} was not stable around its descriptor read: ${drift.join("; ")}. ${contentEvidenceClause(policy)}`,
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
