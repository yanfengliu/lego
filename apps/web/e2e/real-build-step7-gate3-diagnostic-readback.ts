import { createHash } from "node:crypto";
import { opendirSync } from "node:fs";

import {
  assertStep7Gate3NoDeleteDirectoryOwnership,
  inspectStep7Gate3NoDeleteDirectory,
  readStep7Gate3NoDeleteFile,
  STEP7_GATE3_OWNER_MARKER,
  type Step7Gate3NoDeleteDirectoryIdentity,
  type Step7Gate3NoDeleteDirectoryObservation,
} from "./real-build-step7-gate3-no-delete-filesystem";
import { boundedStringWithoutLivePrototype, nativeErrorOwnData } from "./non-probing-error";
import { snapshotStep7Gate3Json } from "./real-build-step7-gate3-diagnostic-json";

const MAXIMUM_DIRECTORY_ENTRIES = 16;

const digest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export interface Step7Gate3ExpectedReadBackArtifact {
  readonly file: string;
  readonly exactBytes: Buffer;
  readonly digest: string;
}

interface ArtifactReadBackObservation {
  readonly file: string;
  readonly expectedBytes: number;
  readonly expectedDigest: string;
  readonly observedBytes: number | null;
  readonly observedDigest: string | null;
  readonly exactBytesAndDigest: boolean;
  readonly failure: string | null;
}

export interface Step7Gate3BundleReadBack {
  readonly schemaVersion: "lego.step7-gate3-bounded-sequential-read-back/1";
  readonly verification: "bounded-sequential-read-back";
  readonly relativePath: string;
  readonly expectedDirectoryIdentity: { readonly dev: string; readonly ino: string };
  readonly observedDirectoryIdentity: { readonly dev: string; readonly ino: string } | null;
  readonly directoryIdentityVerified: boolean;
  readonly ownerTokenVerified: boolean;
  readonly expectedFiles: readonly string[];
  readonly observedFiles: readonly string[];
  readonly directoryEntriesTruncated: boolean;
  readonly exactFileSetVerified: boolean;
  readonly artifacts: readonly ArtifactReadBackObservation[];
  readonly closureFailure: string | null;
  readonly complete: boolean;
  readonly simultaneousAtReturnProved: false;
  readonly storageSealed: false;
  readonly crashDurabilityProved: false;
}

function boundedFailure(value: unknown): string {
  const native = nativeErrorOwnData(value);
  if (native !== null) {
    return boundedStringWithoutLivePrototype(`${native.name}: ${native.message}`, 2_048);
  }
  if (typeof value === "string") return boundedStringWithoutLivePrototype(value, 2_048);
  return `A thrown ${value === null ? "null" : typeof value} was retained without probing it.`;
}

function sameIdentity(
  expected: Step7Gate3NoDeleteDirectoryIdentity,
  actual: Step7Gate3NoDeleteDirectoryObservation,
): boolean {
  return (
    expected.ino === actual.ino &&
    (expected.dev === 0n || actual.dev === 0n || expected.dev === actual.dev)
  );
}

function readDirectoryNamesBounded(
  directory: string,
  hooks?: {
    readonly beforeRead?: () => void;
    readonly afterClose?: () => void;
  },
): {
  readonly names: string[];
  readonly truncated: boolean;
} {
  const handle = opendirSync(directory);
  const names: string[] = [];
  let truncated = false;
  let failed = false;
  let failure: unknown = null;
  try {
    hooks?.beforeRead?.();
    for (;;) {
      const entry = handle.readSync();
      if (entry === null) break;
      if (names.length === MAXIMUM_DIRECTORY_ENTRIES) {
        truncated = true;
        break;
      }
      names.push(entry.name);
    }
  } catch (error) {
    failed = true;
    failure = error;
  }
  try {
    handle.closeSync();
    hooks?.afterClose?.();
  } catch (error) {
    failure = failed
      ? new AggregateError([failure, error], "Directory enumeration and close both failed.")
      : error;
    failed = true;
  }
  if (failed) throw failure;
  names.sort((left, right) => left.localeCompare(right));
  return { names, truncated };
}

function exactStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function readBackStep7Gate3Bundle(input: {
  readonly root: string;
  readonly relativePath: string;
  readonly expectedIdentity: Step7Gate3NoDeleteDirectoryIdentity;
  readonly artifacts: readonly Step7Gate3ExpectedReadBackArtifact[];
  readonly label: string;
  /** @internal Synchronous directory enumeration fault injection. */
  readonly __testDirectoryHooks?: {
    readonly beforeRead?: () => void;
    readonly afterClose?: () => void;
  };
}): Step7Gate3BundleReadBack {
  const expectedFiles = [STEP7_GATE3_OWNER_MARKER, ...input.artifacts.map(({ file }) => file)].sort(
    (left, right) => left.localeCompare(right),
  );
  let observedDirectoryIdentity: { readonly dev: string; readonly ino: string } | null = null;
  let directoryIdentityVerified = false;
  let ownerTokenVerified = false;
  let observedFiles: string[] = [];
  let directoryEntriesTruncated = false;
  let exactFileSetVerified = false;
  let closureFailure: string | null = null;
  const artifacts: ArtifactReadBackObservation[] = [];

  try {
    const initialState = inspectStep7Gate3NoDeleteDirectory(
      input.root,
      input.relativePath,
      input.label,
    );
    observedDirectoryIdentity = {
      dev: initialState.dev.toString(),
      ino: initialState.ino.toString(),
    };
    directoryIdentityVerified = sameIdentity(input.expectedIdentity, initialState);
    try {
      assertStep7Gate3NoDeleteDirectoryOwnership(
        input.root,
        input.relativePath,
        input.expectedIdentity,
        input.label,
      );
      ownerTokenVerified = true;
    } catch (error) {
      closureFailure = `owner token: ${boundedFailure(error)}`;
    }
    try {
      const enumeration = readDirectoryNamesBounded(
        initialState.absolutePath,
        input.__testDirectoryHooks,
      );
      observedFiles = enumeration.names;
      directoryEntriesTruncated = enumeration.truncated;
      exactFileSetVerified =
        !directoryEntriesTruncated && exactStringArray(observedFiles, expectedFiles);
    } catch (error) {
      closureFailure ??= `directory enumeration: ${boundedFailure(error)}`;
    }
    for (const expected of input.artifacts) {
      try {
        const bytes = readStep7Gate3NoDeleteFile({
          root: input.root,
          candidate: `${input.relativePath}/${expected.file}`,
          label: `${input.label} ${expected.file}`,
          exactBytes: expected.exactBytes.length,
          maximumBytes: expected.exactBytes.length,
          expectedDigest: expected.digest,
        });
        const observedDigest = digest(bytes);
        artifacts.push({
          file: expected.file,
          expectedBytes: expected.exactBytes.length,
          expectedDigest: expected.digest,
          observedBytes: bytes.length,
          observedDigest,
          exactBytesAndDigest:
            bytes.equals(expected.exactBytes) && observedDigest === expected.digest,
          failure: null,
        });
      } catch (error) {
        artifacts.push({
          file: expected.file,
          expectedBytes: expected.exactBytes.length,
          expectedDigest: expected.digest,
          observedBytes: null,
          observedDigest: null,
          exactBytesAndDigest: false,
          failure: boundedFailure(error),
        });
      }
    }
    const finalState = inspectStep7Gate3NoDeleteDirectory(
      input.root,
      input.relativePath,
      `${input.label} closure`,
    );
    if (initialState.ino !== finalState.ino || initialState.dev !== finalState.dev) {
      throw new TypeError(`${input.label} directory identity changed during sequential read-back.`);
    }
  } catch (error) {
    closureFailure ??= boundedFailure(error);
  }

  const complete =
    directoryIdentityVerified &&
    ownerTokenVerified &&
    exactFileSetVerified &&
    artifacts.length === input.artifacts.length &&
    artifacts.every(({ exactBytesAndDigest }) => exactBytesAndDigest) &&
    closureFailure === null;
  return snapshotStep7Gate3Json(
    {
      schemaVersion: "lego.step7-gate3-bounded-sequential-read-back/1" as const,
      verification: "bounded-sequential-read-back" as const,
      relativePath: input.relativePath,
      expectedDirectoryIdentity: {
        dev: input.expectedIdentity.dev.toString(),
        ino: input.expectedIdentity.ino.toString(),
      },
      observedDirectoryIdentity,
      directoryIdentityVerified,
      ownerTokenVerified,
      expectedFiles,
      observedFiles,
      directoryEntriesTruncated,
      exactFileSetVerified,
      artifacts,
      closureFailure,
      complete,
      simultaneousAtReturnProved: false as const,
      storageSealed: false as const,
      crashDurabilityProved: false as const,
    },
    `${input.label} observation`,
  ).value;
}

export function assertCompleteStep7Gate3BundleReadBack(
  observation: Step7Gate3BundleReadBack,
  label: string,
): void {
  if (!observation.complete) {
    throw new TypeError(
      `${label} failed bounded sequential read-back: identity=${observation.directoryIdentityVerified}, ownerToken=${observation.ownerTokenVerified}, fileSet=${observation.exactFileSetVerified}, exactArtifacts=${observation.artifacts.filter(({ exactBytesAndDigest }) => exactBytesAndDigest).length}/${observation.artifacts.length}, closure=${observation.closureFailure ?? "none"}.`,
    );
  }
}
