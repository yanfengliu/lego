import { randomUUID } from "node:crypto";
import {
  existsSync,
  ftruncateSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import {
  assertAncestorSnapshotsStable,
  BoundedFileReadError,
  closeDescriptor,
  comparableFileState,
  comparableIdentity,
  inside,
  preflightContainedPath,
  sameFileState,
  type BoundedFileRaceTestHooks,
  type ComparableFileState,
  type ContainedPathPreflight,
} from "./bounded-file-read";
import { withContainedFileParent } from "./contained-directory";

export interface ContainedAtomicWritePolicy {
  readonly label: string;
  readonly replace?: boolean;
  readonly __testHooks?: Pick<
    BoundedFileRaceTestHooks,
    "afterPreflight" | "afterTemporaryWrite" | "afterRename"
  >;
}

function cleanupContainedFile(input: {
  readonly rootRealpath: string;
  readonly file: ContainedPathPreflight;
  readonly fileState: ComparableFileState | null;
  readonly label: string;
}): Error | null {
  try {
    assertAncestorSnapshotsStable(input.file, `${input.label} cleanup`);
    const cleanupStat = lstatSync(input.file.target, { bigint: true });
    const cleanupRealpath = realpathSync.native(input.file.target);
    if (
      cleanupStat.isSymbolicLink() ||
      !cleanupStat.isFile() ||
      !inside(input.rootRealpath, cleanupRealpath) ||
      (input.fileState !== null &&
        !sameFileState(
          comparableFileState(cleanupStat, `${input.label} cleanup path`),
          input.fileState,
        ))
    ) {
      return new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${input.label} cleanup path is no longer the verified contained file; it was deliberately left untouched.`,
      );
    }
    unlinkSync(input.file.target);
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    return new BoundedFileReadError(
      "WRITE_FAILED",
      `${input.label} could not safely remove its failed file ${input.file.target}; no now-external path was unlinked: ${error instanceof Error ? error.message : String(error)}.`,
      error,
    );
  }
}

/** Writes a fresh same-directory temporary file, verifies containment/identity, then publishes by rename. */
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

  const temporaryName = `.${basename(preflight.target)}.tmp-${randomUUID()}`;
  const temporaryCandidate = relative(
    preflight.root,
    join(dirname(preflight.target), temporaryName),
  );
  const temporaryPreflight = preflightContainedPath(
    preflight.root,
    temporaryCandidate,
    `${policy.label} temporary file`,
  );
  let descriptor: number | null = null;
  let temporaryState: ComparableFileState | null = null;
  let published = false;
  let succeeded = false;
  let failure: Error | null = null;
  try {
    assertAncestorSnapshotsStable(preflight, policy.label);
    descriptor = openSync(temporaryPreflight.target, "wx");
    const buffer = Buffer.from(bytes);
    let offset = 0;
    while (offset < buffer.length) {
      const count = writeSync(descriptor, buffer, offset, buffer.length - offset, offset);
      if (count === 0) {
        throw new BoundedFileReadError(
          "WRITE_FAILED",
          `${policy.label} temporary file stopped after ${offset} of ${buffer.length} bytes.`,
        );
      }
      offset += count;
    }
    fsyncSync(descriptor);
    temporaryState = comparableFileState(
      fstatSync(descriptor, { bigint: true }),
      `${policy.label} temporary descriptor`,
    );
    if (temporaryState.size !== BigInt(buffer.length)) {
      throw new BoundedFileReadError(
        "WRITE_FAILED",
        `${policy.label} temporary descriptor contains ${temporaryState.size} bytes after writing ${buffer.length}.`,
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
    } else {
      // Hard-link publication is same-volume and atomically refuses an existing target. A prior
      // check followed by rename would overwrite a target that appeared in the race window.
      linkSync(temporaryPreflight.target, preflight.target);
      unlinkSync(temporaryPreflight.target);
    }
    published = true;
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
    succeeded = true;
    return preflight.target;
  } catch (error) {
    failure =
      error instanceof Error
        ? error
        : new BoundedFileReadError("WRITE_FAILED", `${policy.label} failed: ${String(error)}.`);
  } finally {
    let cleanupState = temporaryState;
    if (descriptor !== null) {
      if (!succeeded) {
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
    if (!succeeded) {
      const cleanup = cleanupContainedFile({
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
