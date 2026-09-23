import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  ftruncateSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  readSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { relative } from "node:path";

import {
  assertAncestorSnapshotsStable,
  BoundedFileReadError,
  closeDescriptor,
  comparableFileState,
  comparableIdentity,
  inside,
  preflightContainedPath,
  readContainedBoundedRegularFile,
  sameFileState,
  type BoundedFileRaceTestHooks,
  type ComparableFileState,
} from "./bounded-file-read";
import {
  assertNoConflictingContainedAtomicTemporary,
  cleanupContainedAtomicPath,
  containedAtomicTemporaryCandidate,
  openContainedAtomicWritableDescriptor,
  readExactContainedAtomicDescriptor,
} from "./contained-atomic-write-support";
import { withContainedFileParent } from "./contained-directory";

export { isContainedAtomicWriteTemporaryName } from "./contained-atomic-write-support";

export interface ContainedAtomicWritePolicy {
  readonly label: string;
  readonly replace?: boolean;
  /** Revalidates external authority after the complete temporary payload is durable. */
  readonly beforePublish?: () => void;
  /** Revalidates external authority while failure can still remove the published identity. */
  readonly afterPublish?: () => void;
  readonly __testHooks?: Pick<
    BoundedFileRaceTestHooks,
    "afterPreflight" | "afterTemporaryWrite" | "afterRename"
  > & {
    readonly beforeTemporaryUnlink?: () => void;
    readonly afterFinalDescriptorCloseBeforeTemporaryUnlink?: () => void;
    readonly beforeFinalDescriptorDigest?: () => void;
  };
}

/** Writes or adopts a same-directory temporary, verifies it, then atomically publishes it. */
function writeContainedRegularFileAtomicGuarded(
  root: string,
  candidate: string,
  bytes: Uint8Array | string,
  policy: ContainedAtomicWritePolicy,
): string {
  const preflight = preflightContainedPath(root, candidate, policy.label);
  const targetExisted = existsSync(preflight.target);
  if (targetExisted) {
    const targetStat = lstatSync(preflight.target, { bigint: true });
    comparableIdentity(targetStat, `${policy.label} existing target`);
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${policy.label} existing target must be a real regular file: ${preflight.target}.`,
      );
    }
    if (policy.replace !== true) {
      throw new BoundedFileReadError(
        "WRITE_FAILED",
        `${policy.label} target already exists and replacement was not authorized: ${preflight.target}.`,
      );
    }
  }
  policy.__testHooks?.afterPreflight?.();

  const buffer = Buffer.from(bytes);
  const temporaryTarget = containedAtomicTemporaryCandidate(preflight.target, buffer);
  assertNoConflictingContainedAtomicTemporary(preflight.target, temporaryTarget, policy.label);
  const temporaryCandidate = relative(preflight.root, temporaryTarget);
  const temporaryPreflight = preflightContainedPath(
    preflight.root,
    temporaryCandidate,
    `${policy.label} temporary file`,
  );
  let descriptor: number | null = null;
  let temporaryState: ComparableFileState | null = null;
  let temporaryPresent = false;
  let published = false;
  let succeeded = false;
  let ownsTemporary = false;
  let failure: Error | null = null;
  try {
    assertAncestorSnapshotsStable(preflight, policy.label);
    try {
      descriptor = openContainedAtomicWritableDescriptor(
        temporaryPreflight.target,
        true,
        policy.replace !== true,
      );
      ownsTemporary = true;
      temporaryPresent = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const staleLstat = lstatSync(temporaryPreflight.target, { bigint: true });
      if (staleLstat.isSymbolicLink() || !staleLstat.isFile())
        throw new BoundedFileReadError(
          "PATH_POLICY_VIOLATION",
          `${policy.label} deterministic temporary path is a symlink, junction, or non-file.`,
        );
      const staleState = comparableFileState(staleLstat, `${policy.label} stale temporary path`);
      descriptor = openContainedAtomicWritableDescriptor(
        temporaryPreflight.target,
        false,
        policy.replace !== true,
      );
      temporaryPresent = true;
      const openedState = comparableFileState(
        fstatSync(descriptor, { bigint: true }),
        `${policy.label} stale temporary descriptor`,
      );
      if (!sameFileState(staleState, openedState) || Number(openedState.size) !== buffer.length)
        throw new BoundedFileReadError(
          "WRITE_FAILED",
          `${policy.label} stale deterministic temporary conflicts with the expected payload.`,
        );
      const observed = Buffer.allocUnsafe(buffer.length);
      let observedOffset = 0;
      while (observedOffset < observed.length) {
        const count = readSync(
          descriptor,
          observed,
          observedOffset,
          observed.length - observedOffset,
          observedOffset,
        );
        if (count === 0) break;
        observedOffset += count;
      }
      const observedAfter = comparableFileState(
        fstatSync(descriptor, { bigint: true }),
        `${policy.label} stale temporary descriptor after read`,
      );
      if (
        observedOffset !== observed.length ||
        !observed.equals(buffer) ||
        !sameFileState(openedState, observedAfter)
      )
        throw new BoundedFileReadError(
          "WRITE_FAILED",
          `${policy.label} stale deterministic temporary conflicts with the exact expected bytes.`,
        );
      temporaryState = observedAfter;
    }
    if (ownsTemporary) {
      let offset = 0;
      while (offset < buffer.length) {
        const count = writeSync(descriptor, buffer, offset, buffer.length - offset, offset);
        if (count === 0)
          throw new BoundedFileReadError(
            "WRITE_FAILED",
            `${policy.label} temporary file stopped after ${offset} of ${buffer.length} bytes.`,
          );
        offset += count;
      }
      fsyncSync(descriptor);
      temporaryState = comparableFileState(
        fstatSync(descriptor, { bigint: true }),
        `${policy.label} temporary descriptor`,
      );
    }
    if (temporaryState === null || temporaryState.size !== BigInt(buffer.length)) {
      throw new BoundedFileReadError(
        "WRITE_FAILED",
        `${policy.label} temporary descriptor does not contain the expected ${buffer.length} bytes.`,
      );
    }
    policy.__testHooks?.afterTemporaryWrite?.();

    assertAncestorSnapshotsStable(preflight, policy.label);
    const temporaryLstat = lstatSync(temporaryPreflight.target, { bigint: true });
    const temporaryRealpath = realpathSync.native(temporaryPreflight.target);
    if (
      temporaryLstat.isSymbolicLink() ||
      !temporaryLstat.isFile() ||
      !inside(preflight.rootRealpath, temporaryRealpath) ||
      !sameFileState(
        comparableFileState(temporaryLstat, `${policy.label} temporary path`),
        temporaryState,
      )
    ) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${policy.label} temporary file was redirected or replaced before publication.`,
      );
    }
    policy.beforePublish?.();
    if (policy.replace !== true && existsSync(preflight.target)) {
      throw new BoundedFileReadError(
        "WRITE_FAILED",
        `${policy.label} target appeared concurrently and replacement was not authorized: ${preflight.target}.`,
      );
    }
    if (existsSync(preflight.target)) {
      const targetStat = lstatSync(preflight.target, { bigint: true });
      if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
        throw new BoundedFileReadError(
          "PATH_POLICY_VIOLATION",
          `${policy.label} target became a symlink, junction, or non-file before publication.`,
        );
      }
    }
    if (policy.replace === true) {
      renameSync(temporaryPreflight.target, preflight.target);
      temporaryPresent = false;
      published = true;
    } else {
      // Hard-link publication is same-volume and atomically refuses an existing target. A prior
      // check followed by rename would overwrite a target that appeared in the race window.
      linkSync(temporaryPreflight.target, preflight.target);
      published = true;
      policy.__testHooks?.beforeTemporaryUnlink?.();
      if (process.platform !== "win32") {
        unlinkSync(temporaryPreflight.target);
        temporaryPresent = false;
      }
    }
    policy.afterPublish?.();
    const publishedDescriptorState = comparableFileState(
      fstatSync(descriptor, { bigint: true }),
      `${policy.label} published descriptor before post-rename checks`,
    );
    policy.__testHooks?.afterRename?.();
    assertAncestorSnapshotsStable(preflight, policy.label);
    const publishedStat = lstatSync(preflight.target, { bigint: true });
    const publishedRealpath = realpathSync.native(preflight.target);
    const publishedPathState = comparableFileState(publishedStat, `${policy.label} published path`);
    const publishedDescriptorStateAfter = comparableFileState(
      fstatSync(descriptor, { bigint: true }),
      `${policy.label} published descriptor after post-rename checks`,
    );
    if (
      publishedStat.isSymbolicLink() ||
      !publishedStat.isFile() ||
      !inside(preflight.rootRealpath, publishedRealpath) ||
      !sameFileState(publishedDescriptorState, publishedDescriptorStateAfter) ||
      !sameFileState(publishedDescriptorStateAfter, publishedPathState)
    ) {
      throw new BoundedFileReadError(
        "WRITE_FAILED",
        `${policy.label} published path does not retain the verified temporary-file identity and metadata.`,
      );
    }
    policy.__testHooks?.beforeFinalDescriptorDigest?.();
    let contentValidatedState = readExactContainedAtomicDescriptor(
      descriptor,
      buffer,
      `${policy.label} published final`,
    );
    assertAncestorSnapshotsStable(preflight, `${policy.label} final content validation`);
    const finalPathStat = lstatSync(preflight.target, { bigint: true });
    const finalPathRealpath = realpathSync.native(preflight.target);
    const finalPathState = comparableFileState(
      finalPathStat,
      `${policy.label} final path after exact content validation`,
    );
    if (
      finalPathStat.isSymbolicLink() ||
      !finalPathStat.isFile() ||
      !inside(preflight.rootRealpath, finalPathRealpath) ||
      !sameFileState(contentValidatedState, finalPathState)
    )
      throw new BoundedFileReadError(
        "WRITE_FAILED",
        `${policy.label} final path changed identity or metadata around exact descriptor validation.`,
      );
    if (temporaryPresent && policy.replace !== true) {
      closeSync(descriptor);
      descriptor = null;
      policy.__testHooks?.afterFinalDescriptorCloseBeforeTemporaryUnlink?.();
      unlinkSync(temporaryPreflight.target);
      temporaryPresent = false;
      descriptor = openContainedAtomicWritableDescriptor(preflight.target, false, true);
      policy.__testHooks?.beforeFinalDescriptorDigest?.();
      const reopenedState = readExactContainedAtomicDescriptor(
        descriptor,
        buffer,
        `${policy.label} reopened final`,
      );
      if (
        reopenedState.ino !== contentValidatedState.ino ||
        (reopenedState.dev !== 0n &&
          contentValidatedState.dev !== 0n &&
          reopenedState.dev !== contentValidatedState.dev)
      )
        throw new BoundedFileReadError(
          "WRITE_FAILED",
          `${policy.label} final identity changed while its deterministic temporary name was removed.`,
        );
      contentValidatedState = reopenedState;
      assertAncestorSnapshotsStable(preflight, `${policy.label} reopened final validation`);
      const reopenedPathRealpath = realpathSync.native(preflight.target);
      const reopenedPathStat = lstatSync(preflight.target, { bigint: true });
      const reopenedPathState = comparableFileState(
        reopenedPathStat,
        `${policy.label} reopened final path`,
      );
      if (
        reopenedPathStat.isSymbolicLink() ||
        !reopenedPathStat.isFile() ||
        !inside(preflight.rootRealpath, reopenedPathRealpath) ||
        !sameFileState(contentValidatedState, reopenedPathState)
      )
        throw new BoundedFileReadError(
          "WRITE_FAILED",
          `${policy.label} reopened final path does not retain its exact validated descriptor identity.`,
        );
    }
    succeeded = true;
    return preflight.target;
  } catch (error) {
    failure =
      error instanceof Error
        ? error
        : new BoundedFileReadError("WRITE_FAILED", `${policy.label} failed: ${String(error)}.`);
  } finally {
    let cleanupState = temporaryState;
    let preserveTemporary = false;
    if (!succeeded && published && temporaryPresent && policy.replace !== true) {
      const rollback = cleanupContainedAtomicPath({
        rootRealpath: preflight.rootRealpath,
        file: preflight,
        fileState: temporaryState,
        label: `${policy.label} incomplete hard-link publication`,
      });
      preserveTemporary = true;
      if (rollback === null) published = false;
      else
        failure =
          failure === null
            ? rollback
            : new AggregateError(
                [failure, rollback],
                `${policy.label} failed and could not roll back its incomplete final hard link.`,
              );
    }
    if (descriptor !== null) {
      if (!succeeded && !preserveTemporary && (ownsTemporary || published)) {
        try {
          // Keep this exact descriptor open through publication checks. On Windows it prevents a
          // containing directory from being renamed; on filesystems that permit displacement it
          // still lets us erase the rejected payload through the opened file identity.
          ftruncateSync(descriptor, 0);
          fsyncSync(descriptor);
          cleanupState = comparableFileState(
            fstatSync(descriptor, { bigint: true }),
            `${policy.label} scrubbed failed descriptor`,
          );
        } catch (error) {
          const scrubFailure = new BoundedFileReadError(
            "WRITE_FAILED",
            `${policy.label} could not erase rejected task bytes through its exact open descriptor: ${error instanceof Error ? error.message : String(error)}.`,
            error,
          );
          failure =
            failure === null
              ? scrubFailure
              : new AggregateError(
                  [failure, scrubFailure],
                  `${policy.label} failed and exact-handle payload cleanup also failed.`,
                );
        }
      }
      failure = closeDescriptor(
        descriptor,
        published ? preflight.target : temporaryPreflight.target,
        { label: policy.label, maximumBytes: Number.MAX_SAFE_INTEGER, minimumBytes: 0 },
        failure,
      );
    }
    if (!succeeded && !preserveTemporary && (ownsTemporary || published)) {
      const cleanup = cleanupContainedAtomicPath({
        rootRealpath: preflight.rootRealpath,
        file: published ? preflight : temporaryPreflight,
        fileState: cleanupState,
        label: policy.label,
      });
      if (cleanup !== null) {
        failure =
          failure === null
            ? cleanup
            : new AggregateError(
                [failure, cleanup],
                `${policy.label} failed (${failure.message}) and cleanup also failed (${cleanup.message}).`,
              );
      }
    }
  }
  throw (
    failure ?? new BoundedFileReadError("WRITE_FAILED", `${policy.label} failed without a result.`)
  );
}

export function reconcileContainedRegularFileAtomicTemporary(
  root: string,
  candidate: string,
  bytes: Uint8Array | string,
  label: string,
): void {
  const final = preflightContainedPath(root, candidate, label);
  const temporaryTarget = containedAtomicTemporaryCandidate(final.target, bytes);
  assertNoConflictingContainedAtomicTemporary(final.target, temporaryTarget, label);
  const temporaryCandidate = relative(final.root, temporaryTarget);
  const temporary = preflightContainedPath(
    final.root,
    temporaryCandidate,
    `${label} stale temporary`,
  );
  try {
    lstatSync(temporary.target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const buffer = Buffer.from(bytes);
  readContainedBoundedRegularFile(root, temporaryCandidate, {
    label: `${label} stale deterministic temporary`,
    minimumBytes: buffer.length,
    maximumBytes: buffer.length,
    exactBytes: buffer.length,
    expectedSha256: `sha256:${createHash("sha256").update(buffer).digest("hex")}`,
  });
  const state = comparableFileState(
    lstatSync(temporary.target, { bigint: true }),
    `${label} stale deterministic temporary path`,
  );
  const cleanup = cleanupContainedAtomicPath({
    rootRealpath: temporary.rootRealpath,
    file: temporary,
    fileState: state,
    label: `${label} stale deterministic temporary`,
  });
  if (cleanup !== null) throw cleanup;
}

export function writeContainedRegularFileAtomic(
  root: string,
  candidate: string,
  bytes: Uint8Array | string,
  policy: ContainedAtomicWritePolicy,
): string {
  return withContainedFileParent(root, candidate, policy.label, () =>
    writeContainedRegularFileAtomicGuarded(root, candidate, bytes, policy),
  );
}
