import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";

import {
  assertAncestorSnapshotsStable,
  BoundedFileReadError,
  comparableFileState,
  inside,
  preflightContainedPath,
  type ComparableFileState,
  type ContainedPathPreflight,
} from "./bounded-file-read";

const MAXIMUM_REMOVAL_ENTRIES = 25_000;
const QUARANTINE_PREFIX = ".lego-contained-remove-";

export interface ContainedDirectoryRemovalTestHooks {
  readonly beforeQuarantinedEntryDelete?: (entry: {
    readonly originalName: string;
    readonly quarantinedPath: string;
  }) => void;
}

export interface ContainedDirectoryRemovalAdapter {
  readonly normalize: (candidate: string, label: string) => string;
  readonly withGuard: <T>(
    root: string,
    directoryCandidate: string | null,
    label: string,
    action: () => T,
  ) => T;
  readonly checkedDirectoryState: (
    preflight: ContainedPathPreflight,
    label: string,
  ) => ComparableFileState;
  readonly sameObjectIdentity: (left: ComparableFileState, right: ComparableFileState) => boolean;
}

function checkedEntryState(
  preflight: ContainedPathPreflight,
  label: string,
): { readonly state: ComparableFileState; readonly directory: boolean } {
  const stat = lstatSync(preflight.target, { bigint: true });
  if (stat.isSymbolicLink()) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} refused symlink or junction ${preflight.target}.`,
    );
  }
  if (!stat.isDirectory() && !stat.isFile()) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} refused non-file entry ${preflight.target}.`,
    );
  }
  if (!inside(preflight.rootRealpath, realpathSync.native(preflight.target))) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} entry escaped its real root: ${preflight.target}.`,
    );
  }
  return Object.freeze({
    state: comparableFileState(stat, `${label} entry ${preflight.target}`),
    directory: stat.isDirectory(),
  });
}

function assertSameEntry(
  adapter: ContainedDirectoryRemovalAdapter,
  expected: ComparableFileState,
  preflight: ContainedPathPreflight,
  label: string,
): { readonly state: ComparableFileState; readonly directory: boolean } {
  const observed = checkedEntryState(preflight, label);
  if (!adapter.sameObjectIdentity(expected, observed.state)) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} quarantined entry changed identity before deletion: ${preflight.target}.`,
    );
  }
  return observed;
}

/**
 * Cooperative teardown only. The caller must own the whole root and exclude concurrent writers;
 * identity observations do not make pathname deletion conditional or adversarially race-safe.
 * Evidence publication and failure rollback must never call this.
 */
export function removeContainedDirectoryTreeWithAdapter(input: {
  readonly adapter: ContainedDirectoryRemovalAdapter;
  readonly root: string;
  readonly candidate: string;
  readonly label: string;
  readonly hooks?: ContainedDirectoryRemovalTestHooks;
}): void {
  const { adapter, root, label, hooks } = input;
  const normalized = adapter.normalize(input.candidate, label);
  adapter.withGuard(root, null, label, () => {
    const preflight = preflightContainedPath(root, normalized, label);
    const before = adapter.checkedDirectoryState(preflight, label);
    let entries = 0;

    const removeEntry = (directoryCandidate: string, name: string): void => {
      entries += 1;
      if (entries > MAXIMUM_REMOVAL_ENTRIES) {
        throw new BoundedFileReadError(
          "SIZE_OUT_OF_RANGE",
          `${label} contains more than ${MAXIMUM_REMOVAL_ENTRIES} entries; cooperative cleanup refused it.`,
        );
      }
      const childCandidate = `${directoryCandidate}/${name}`;
      const child = preflightContainedPath(root, childCandidate, label);
      const original = checkedEntryState(child, `${label} removal`);
      const quarantineCandidate = `${directoryCandidate}/${QUARANTINE_PREFIX}${randomUUID()}`;
      const quarantine = preflightContainedPath(root, quarantineCandidate, label);
      if (existsSync(quarantine.target)) {
        throw new BoundedFileReadError(
          "WRITE_FAILED",
          `${label} generated a quarantine path that already exists: ${quarantine.target}.`,
        );
      }
      assertAncestorSnapshotsStable(child, label);
      assertAncestorSnapshotsStable(quarantine, label);
      renameSync(child.target, quarantine.target);
      assertSameEntry(adapter, original.state, quarantine, `${label} immediate quarantine`);
      hooks?.beforeQuarantinedEntryDelete?.({
        originalName: name,
        quarantinedPath: quarantine.target,
      });
      if (hooks?.beforeQuarantinedEntryDelete !== undefined) {
        throw new BoundedFileReadError(
          "PATH_POLICY_VIOLATION",
          `${label} retained its quarantined entry because a test-only retention seam ran; cooperative test teardown must remove the task-owned root later.`,
        );
      }
      const beforeDelete = assertSameEntry(
        adapter,
        original.state,
        quarantine,
        `${label} pre-delete quarantine`,
      );
      if (beforeDelete.directory) {
        removeContents(quarantineCandidate, original.state);
        assertSameEntry(adapter, original.state, quarantine, `${label} empty-directory quarantine`);
        rmdirSync(quarantine.target);
      } else {
        assertSameEntry(adapter, original.state, quarantine, `${label} final-file quarantine`);
        unlinkSync(quarantine.target);
      }
    };

    const removeContents = (
      directoryCandidate: string,
      expectedDirectoryState: ComparableFileState,
    ): void => {
      adapter.withGuard(root, directoryCandidate, label, () => {
        const directory = preflightContainedPath(root, directoryCandidate, label);
        if (
          !adapter.sameObjectIdentity(
            expectedDirectoryState,
            adapter.checkedDirectoryState(directory, label),
          )
        ) {
          throw new BoundedFileReadError(
            "PATH_POLICY_VIOLATION",
            `${label} refused to walk a replacement directory at ${directory.target}.`,
          );
        }
        const names = readdirSync(directory.target);
        for (let nameIndex = 0; nameIndex < names.length; nameIndex += 1) {
          const name = names[nameIndex]!;
          if (name.startsWith(".lego-contained-guard-")) continue;
          removeEntry(directoryCandidate, name);
        }
        if (
          !adapter.sameObjectIdentity(
            expectedDirectoryState,
            adapter.checkedDirectoryState(directory, label),
          )
        ) {
          throw new BoundedFileReadError(
            "PATH_POLICY_VIOLATION",
            `${label} directory changed identity during cooperative cleanup: ${directory.target}.`,
          );
        }
      });
    };

    removeContents(normalized, before);
    assertAncestorSnapshotsStable(preflight, label);
    if (!adapter.sameObjectIdentity(before, adapter.checkedDirectoryState(preflight, label))) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${label} changed identity during cooperative cleanup.`,
      );
    }
    rmdirSync(preflight.target);
    assertAncestorSnapshotsStable(preflight, label);
  });
}
