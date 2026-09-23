import { createHash } from "node:crypto";
import {
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  unlinkSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

import {
  assertAncestorSnapshotsStable,
  BoundedFileReadError,
  comparableFileState,
  inside,
  sameFileState,
  type ComparableFileState,
  type ContainedPathPreflight,
} from "./bounded-file-read";

// Node 24/libuv exposes UV_FS_O_EXLOCK on Windows through the numeric fs flag even though
// node:fs.constants does not name it. It maps to a zero-share CreateFile handle. Exact descriptor
// hashing below remains mandatory because this implementation detail is deliberately fail-closed.
const UV_FS_O_EXLOCK = 0x10000000;

export function openContainedAtomicWritableDescriptor(
  path: string,
  fresh: boolean,
  exclusive: boolean,
): number {
  if (process.platform !== "win32" || !exclusive) return openSync(path, fresh ? "wx+" : "r+");
  const creation = fresh ? constants.O_CREAT | constants.O_EXCL : 0;
  return openSync(path, constants.O_RDWR | creation | UV_FS_O_EXLOCK, 0o600);
}

export function containedAtomicTemporaryCandidate(
  candidate: string,
  bytes: Uint8Array | string,
): string {
  const targetName = basename(candidate);
  const digest = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  return join(dirname(candidate), `.${targetName}.tmp-${digest}`);
}

export function isContainedAtomicWriteTemporaryName(
  name: string,
  finalNames: readonly string[],
): boolean {
  return finalNames.some((finalName) => {
    const prefix = `.${finalName}.tmp-`;
    return name.startsWith(prefix) && /^[0-9a-f]{64}$/u.test(name.slice(prefix.length));
  });
}

export function assertNoConflictingContainedAtomicTemporary(
  candidate: string,
  expectedTemporary: string,
  label: string,
): void {
  const targetName = basename(candidate);
  const expectedName = basename(expectedTemporary);
  const conflict = readdirSync(dirname(candidate)).find(
    (name) => isContainedAtomicWriteTemporaryName(name, [targetName]) && name !== expectedName,
  );
  if (conflict !== undefined)
    throw new BoundedFileReadError(
      "WRITE_FAILED",
      `${label} found a conflicting deterministic temporary file ${conflict}; only ${expectedName} can resume the exact payload.`,
    );
}

export function readExactContainedAtomicDescriptor(
  descriptor: number,
  expected: Buffer,
  label: string,
): ComparableFileState {
  const before = comparableFileState(
    fstatSync(descriptor, { bigint: true }),
    `${label} descriptor before exact content validation`,
  );
  if (before.size !== BigInt(expected.length))
    throw new BoundedFileReadError(
      "WRITE_FAILED",
      `${label} descriptor contains ${before.size} bytes; expected ${expected.length}.`,
    );
  const observed = Buffer.allocUnsafe(expected.length);
  let offset = 0;
  while (offset < observed.length) {
    const count = readSync(descriptor, observed, offset, observed.length - offset, offset);
    if (count === 0) break;
    offset += count;
  }
  const after = comparableFileState(
    fstatSync(descriptor, { bigint: true }),
    `${label} descriptor after exact content validation`,
  );
  const expectedDigest = createHash("sha256").update(expected).digest("hex");
  const observedDigest = createHash("sha256").update(observed.subarray(0, offset)).digest("hex");
  if (
    offset !== expected.length ||
    observedDigest !== expectedDigest ||
    !observed.equals(expected) ||
    !sameFileState(before, after)
  )
    throw new BoundedFileReadError(
      "WRITE_FAILED",
      `${label} exact already-open descriptor bytes changed before publication could succeed.`,
    );
  return after;
}

export function cleanupContainedAtomicPath(input: {
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
        (cleanupStat.ino !== input.fileState.ino ||
          (cleanupStat.dev !== 0n &&
            input.fileState.dev !== 0n &&
            cleanupStat.dev !== input.fileState.dev)))
    )
      return new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${input.label} cleanup path is no longer the verified contained file; it was deliberately left untouched.`,
      );
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
