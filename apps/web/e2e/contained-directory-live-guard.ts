import { randomUUID } from "node:crypto";
import { closeSync, fstatSync, fsyncSync, lstatSync, realpathSync, writeSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

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
  cleanupContainedAtomicPath,
  openContainedAtomicWritableDescriptor,
  readExactContainedAtomicDescriptor,
} from "./contained-atomic-write-support";

export interface ContainedDirectoryLiveGuard {
  readonly canonicalDirectory: string;
}

interface LiveGuardState {
  readonly root: string;
  readonly directoryCandidate: string;
  readonly directoryTarget: string;
  readonly directoryRealpath: string;
  readonly directoryState: ComparableFileState;
  readonly guard: ContainedPathPreflight;
  readonly guardName: string;
  readonly guardState: ComparableFileState;
  readonly tokenBytes: Buffer;
  readonly label: string;
  descriptor: number | null;
  released: boolean;
}

const liveGuards = new WeakMap<object, LiveGuardState>();

function sameIdentity(left: ComparableFileState, right: ComparableFileState): boolean {
  return left.ino === right.ino && (left.dev === 0n || right.dev === 0n || left.dev === right.dev);
}

function requireState(guard: ContainedDirectoryLiveGuard): LiveGuardState {
  const state = liveGuards.get(guard);
  if (state === undefined || state.released || state.descriptor === null)
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      "Contained directory publication requires its exact live, unreleased directory guard.",
    );
  return state;
}

function reassertState(state: LiveGuardState): void {
  if (state.descriptor === null)
    throw new BoundedFileReadError("CLOSE_FAILED", `${state.label} guard is already closed.`);
  const currentGuard = preflightContainedPath(
    state.root,
    `${state.directoryCandidate}/${state.guardName}`,
    state.label,
  );
  assertAncestorSnapshotsStable(currentGuard, state.label);
  const directoryStat = lstatSync(state.directoryTarget, { bigint: true });
  const directoryState = comparableFileState(directoryStat, `${state.label} directory`);
  const directoryRealpath = realpathSync.native(state.directoryTarget);
  if (
    directoryStat.isSymbolicLink() ||
    !directoryStat.isDirectory() ||
    directoryRealpath !== state.directoryRealpath ||
    !sameIdentity(directoryState, state.directoryState) ||
    currentGuard.target !== state.guard.target
  )
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${state.label} directory path no longer names its minted canonical device/inode identity.`,
    );
  const descriptorState = readExactContainedAtomicDescriptor(
    state.descriptor,
    state.tokenBytes,
    `${state.label} live guard`,
  );
  const guardStat = lstatSync(state.guard.target, { bigint: true });
  const guardRealpath = realpathSync.native(state.guard.target);
  const guardPathState = comparableFileState(guardStat, `${state.label} guard path`);
  if (
    guardStat.isSymbolicLink() ||
    !guardStat.isFile() ||
    !inside(state.guard.rootRealpath, guardRealpath) ||
    !sameFileState(descriptorState, guardPathState) ||
    !sameIdentity(guardPathState, state.guardState)
  )
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${state.label} live guard path no longer retains its exact open file identity.`,
    );
}

export function acquireContainedDirectoryLiveGuard(
  root: string,
  directoryCandidate: string,
  label: string,
): ContainedDirectoryLiveGuard {
  const guardName = `.lego-contained-live-guard-${randomUUID()}`;
  const guard = preflightContainedPath(root, `${directoryCandidate}/${guardName}`, label);
  const directoryTarget = dirname(guard.target);
  const directoryStat = lstatSync(directoryTarget, { bigint: true });
  const directoryState = comparableFileState(directoryStat, `${label} directory`);
  const directoryRealpath = realpathSync.native(directoryTarget);
  if (
    directoryStat.isSymbolicLink() ||
    !directoryStat.isDirectory() ||
    directoryRealpath.toLocaleLowerCase("en-US") !==
      resolve(directoryTarget).toLocaleLowerCase("en-US")
  )
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} must be one canonical real directory, not a symlink, junction, or alias.`,
    );
  const tokenBytes = Buffer.from(randomUUID());
  let descriptor: number | null = null;
  try {
    descriptor = openContainedAtomicWritableDescriptor(guard.target, true, true);
    let offset = 0;
    while (offset < tokenBytes.length) {
      const count = writeSync(descriptor, tokenBytes, offset, tokenBytes.length - offset, offset);
      if (count <= 0) throw new Error(`${label} guard write made no progress.`);
      offset += count;
    }
    fsyncSync(descriptor);
    const guardState = comparableFileState(
      fstatSync(descriptor, { bigint: true }),
      `${label} guard descriptor`,
    );
    const value = Object.freeze({ canonicalDirectory: directoryRealpath });
    const state: LiveGuardState = {
      root: resolve(root),
      directoryCandidate,
      directoryTarget,
      directoryRealpath,
      directoryState,
      guard,
      guardName,
      guardState,
      tokenBytes,
      label,
      descriptor,
      released: false,
    };
    liveGuards.set(value, state);
    reassertState(state);
    return value;
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    try {
      const state = comparableFileState(lstatSync(guard.target, { bigint: true }), label);
      cleanupContainedAtomicPath({
        rootRealpath: guard.rootRealpath,
        file: guard,
        fileState: state,
        label,
      });
    } catch {
      // A replaced path is deliberately retained rather than removed by name.
    }
    throw error;
  }
}

export function reassertContainedDirectoryLiveGuard(
  guard: ContainedDirectoryLiveGuard,
  root: string,
  directoryCandidate: string,
): void {
  const state = requireState(guard);
  if (
    resolve(root).toLocaleLowerCase("en-US") !== state.root.toLocaleLowerCase("en-US") ||
    directoryCandidate.replaceAll("\\", "/") !== state.directoryCandidate.replaceAll("\\", "/")
  )
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${state.label} guard was presented for another root or directory path.`,
    );
  reassertState(state);
}

export function isContainedDirectoryLiveGuardName(
  guard: ContainedDirectoryLiveGuard,
  name: string,
): boolean {
  return basename(requireState(guard).guard.target) === name;
}

export function releaseContainedDirectoryLiveGuard(
  guard: ContainedDirectoryLiveGuard,
): Error | null {
  const state = liveGuards.get(guard);
  if (state === undefined || state.released) return null;
  let failure: Error | null = null;
  try {
    reassertState(state);
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  }
  if (state.descriptor !== null) {
    try {
      closeSync(state.descriptor);
    } catch (error) {
      failure = failure ?? (error instanceof Error ? error : new Error(String(error)));
    }
    state.descriptor = null;
  }
  if (failure === null) {
    failure = cleanupContainedAtomicPath({
      rootRealpath: state.guard.rootRealpath,
      file: state.guard,
      fileState: state.guardState,
      label: state.label,
    });
  }
  state.released = true;
  return failure;
}
