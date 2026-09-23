import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  type BigIntStats,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";

const MAXIMUM_PACKAGE_JSON_BYTES = 1024 * 1024;
const MAXIMUM_LEDGER_FILE_BYTES = 4 * 1024 * 1024;

export type RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver = (boundary: string) => void;

export interface RealBuildPrefix50Step44LaterSourceRepositoryIdentity {
  readonly realPath: string;
  readonly device: string;
  readonly inode: string;
  readonly packageJsonDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44LaterSourceLedgerPaths {
  readonly namespaceCommitment: `sha256:${string}`;
  readonly stateParent: string;
  readonly marker: string;
  readonly ledgerDirectory: string;
  readonly key: string;
  readonly state: string;
  readonly transactionLock: string;
}

interface FileIdentity {
  readonly device: bigint;
  readonly inode: bigint;
  readonly size: bigint;
  readonly modifiedNanoseconds: bigint;
  readonly changedNanoseconds: bigint;
  readonly links: bigint;
}

function sha256(bytes: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function identity(stats: BigIntStats): FileIdentity {
  return {
    device: stats.dev,
    inode: stats.ino,
    size: stats.size,
    modifiedNanoseconds: stats.mtimeNs,
    changedNanoseconds: stats.ctimeNs,
    links: stats.nlink,
  };
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return (
    left.device === right.device &&
    left.inode === right.inode &&
    left.size === right.size &&
    left.modifiedNanoseconds === right.modifiedNanoseconds &&
    left.changedNanoseconds === right.changedNanoseconds &&
    left.links === right.links
  );
}

function sameCanonicalPath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US")
    : left === right;
}

function requireContained(root: string, candidate: string, label: string): void {
  const local = relative(root, candidate);
  if (local.length === 0 || local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local))
    throw new TypeError(`${label} escaped its canonical repository.`);
}

function requirePosixOwnerMode(stats: BigIntStats, mode: number, label: string): void {
  if (process.platform === "win32") return;
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (
    uid === undefined ||
    gid === undefined ||
    stats.uid !== BigInt(uid) ||
    stats.gid !== BigInt(gid) ||
    Number(stats.mode & 0o777n) !== mode
  )
    throw new TypeError(
      `${label} must be descriptor-owned by the current POSIX UID/GID with mode ${mode.toString(8)}.`,
    );
}

function requireDirectory(path: string, exactMode: boolean, label: string): BigIntStats {
  const requested = resolve(path);
  const link = lstatSync(requested, { bigint: true });
  if (
    link.isSymbolicLink() ||
    !link.isDirectory() ||
    !sameCanonicalPath(realpathSync.native(requested), requested)
  )
    throw new TypeError(`${label} must be one canonical non-link directory.`);
  const descriptor = openSync(requested, process.platform === "win32" ? "r+" : "r");
  try {
    const stats = fstatSync(descriptor, { bigint: true });
    if (!stats.isDirectory() || stats.dev !== link.dev || stats.ino !== link.ino)
      throw new TypeError(`${label} descriptor identity changed.`);
    if (exactMode) requirePosixOwnerMode(stats, 0o700, label);
    return stats;
  } finally {
    closeSync(descriptor);
  }
}

function fsyncDirectory(
  path: string,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
  boundary: string,
  exactMode = false,
): void {
  const expected = requireDirectory(path, exactMode, boundary);
  const descriptor = openSync(path, process.platform === "win32" ? "r+" : "r");
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isDirectory() || before.dev !== expected.dev || before.ino !== expected.ino)
      throw new TypeError(`${boundary} directory descriptor changed before fsync.`);
    fsyncSync(descriptor);
    observer(boundary);
    const after = fstatSync(descriptor, { bigint: true });
    if (!after.isDirectory() || after.dev !== before.dev || after.ino !== before.ino)
      throw new TypeError(`${boundary} directory descriptor changed during fsync.`);
  } finally {
    closeSync(descriptor);
  }
}

function createDirectory(
  path: string,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
  label: string,
  exactMode: boolean,
): void {
  try {
    mkdirSync(path, { mode: exactMode ? 0o700 : 0o755 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (exactMode && process.platform !== "win32") chmodSync(path, 0o700);
  requireDirectory(path, exactMode, label);
  fsyncDirectory(dirname(path), observer, `${label}:parent-directory-fsync`);
}

function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function ensureRepositoryStateParent(
  identity: RealBuildPrefix50Step44LaterSourceRepositoryIdentity,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
): string {
  const variableRoot = join(identity.realPath, "var");
  const stateParent = join(variableRoot, "state");
  for (const [path, label] of [
    [variableRoot, "later-source var root"],
    [stateParent, "later-source state root"],
  ] as const) {
    if (!pathExists(path)) createDirectory(path, observer, label, false);
    requireDirectory(path, false, label);
    requireContained(identity.realPath, path, label);
  }
  return stateParent;
}

export function captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity(
  repositoryRoot: string,
): RealBuildPrefix50Step44LaterSourceRepositoryIdentity {
  const requested = resolve(repositoryRoot);
  const before = lstatSync(requested, { bigint: true });
  const realPath = realpathSync.native(requested);
  const after = lstatSync(requested, { bigint: true });
  if (
    before.isSymbolicLink() ||
    !before.isDirectory() ||
    !sameCanonicalPath(realPath, requested) ||
    after.isSymbolicLink() ||
    !after.isDirectory() ||
    before.dev !== after.dev ||
    before.ino !== after.ino
  )
    throw new TypeError("Later-source ledger requires one stable canonical repository root.");
  const packagePath = join(realPath, "package.json");
  requireContained(realPath, packagePath, "later-source repository identity package.json");
  const packageLink = lstatSync(packagePath, { bigint: true });
  if (
    packageLink.isSymbolicLink() ||
    !packageLink.isFile() ||
    !sameCanonicalPath(realpathSync.native(packagePath), packagePath)
  )
    throw new TypeError("Later-source repository package.json must be one canonical file.");
  const descriptor = openSync(packagePath, constants.O_RDONLY);
  let packageJsonDigest: `sha256:${string}`;
  try {
    const packageBefore = fstatSync(descriptor, { bigint: true });
    if (
      !packageBefore.isFile() ||
      packageBefore.nlink !== 1n ||
      packageBefore.size < 1n ||
      packageBefore.size > BigInt(MAXIMUM_PACKAGE_JSON_BYTES)
    )
      throw new TypeError("Later-source repository package.json is not one bounded file.");
    const bytes = readFileSync(descriptor);
    const packageAfter = fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(identity(packageBefore), identity(packageAfter)))
      throw new TypeError("Later-source repository package.json changed while hashing.");
    packageJsonDigest = sha256(bytes);
  } finally {
    closeSync(descriptor);
  }
  const body = {
    realPath,
    device: before.dev.toString(10),
    inode: before.ino.toString(10),
    packageJsonDigest,
  };
  return Object.freeze({ ...body, commitment: canonicalDigest(body) });
}

export function realBuildPrefix50Step44LaterSourceLedgerPaths(
  identity: RealBuildPrefix50Step44LaterSourceRepositoryIdentity,
  qualificationCommitment: `sha256:${string}`,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
): RealBuildPrefix50Step44LaterSourceLedgerPaths {
  if (!/^sha256:[0-9a-f]{64}$/u.test(qualificationCommitment))
    throw new TypeError("Later-source ledger qualification commitment is invalid.");
  const stateParent = ensureRepositoryStateParent(identity, observer);
  const namespaceCommitment = canonicalDigest({
    repositoryIdentityCommitment: identity.commitment,
    qualificationCommitment,
  });
  // The full, mutable repository identity is authenticated inside the ledger. The
  // on-disk name is qualification-stable so package.json drift cannot select a new
  // empty namespace and reopen an already issued qualification.
  const namespaceKey = sha256(
    `lego-step44-later-source-ledger-v2\0${qualificationCommitment}`,
  ).slice("sha256:".length);
  const ledgerDirectory = join(stateParent, `step44-later-source-ledger-v2-${namespaceKey}`);
  return Object.freeze({
    namespaceCommitment,
    stateParent,
    marker: join(stateParent, `step44-later-source-ledger-v2-${namespaceKey}.anchor`),
    ledgerDirectory,
    key: join(ledgerDirectory, "key.sealed.json"),
    state: join(ledgerDirectory, "state.sealed.json"),
    transactionLock: join(ledgerDirectory, "transaction.lock"),
  });
}

export function createRealBuildPrefix50Step44LaterSourceLedgerDirectory(
  paths: RealBuildPrefix50Step44LaterSourceLedgerPaths,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
): void {
  createRealBuildPrefix50Step44LaterSourceSecureDirectory(paths.ledgerDirectory, observer);
}

export function createRealBuildPrefix50Step44LaterSourceSecureDirectory(
  path: string,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
): void {
  createDirectory(path, observer, "later-source ledger directory", true);
}

export function readRealBuildPrefix50Step44LaterSourceLedgerFile(
  path: string,
  label: string,
): Buffer {
  const requested = resolve(path);
  const link = lstatSync(requested, { bigint: true });
  if (
    link.isSymbolicLink() ||
    !link.isFile() ||
    !sameCanonicalPath(realpathSync.native(requested), requested)
  )
    throw new TypeError(`${label} must be one canonical non-link file.`);
  const descriptor = openSync(path, constants.O_RDONLY);
  try {
    const beforeStats = fstatSync(descriptor, { bigint: true });
    const before = identity(beforeStats);
    if (
      !beforeStats.isFile() ||
      before.links !== 1n ||
      before.size < 1n ||
      before.size > BigInt(MAXIMUM_LEDGER_FILE_BYTES)
    )
      throw new TypeError(`${label} is not one bounded single-name file.`);
    if (beforeStats.dev !== link.dev || beforeStats.ino !== link.ino)
      throw new TypeError(`${label} descriptor identity changed before read.`);
    requirePosixOwnerMode(beforeStats, 0o600, label);
    const bytes = readFileSync(descriptor);
    const after = identity(fstatSync(descriptor, { bigint: true }));
    if (!sameIdentity(before, after) || BigInt(bytes.length) !== after.size)
      throw new TypeError(`${label} changed during descriptor-time read.`);
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function writeFreshFile(
  path: string,
  bytes: Uint8Array,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
  boundary: string,
): void {
  const descriptor = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, 0o600);
  try {
    if (process.platform !== "win32") fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, bytes);
    const stats = fstatSync(descriptor, { bigint: true });
    if (!stats.isFile() || stats.nlink !== 1n || stats.size !== BigInt(bytes.byteLength))
      throw new TypeError(`${boundary} did not create one exact file.`);
    requirePosixOwnerMode(stats, 0o600, boundary);
    fsyncSync(descriptor);
    observer(`${boundary}:file-fsync`);
  } finally {
    closeSync(descriptor);
  }
}

export function writeRealBuildPrefix50Step44LaterSourceLedgerFileAtomic(input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver;
  readonly boundary: string;
  readonly replace: boolean;
  readonly exactParentMode?: boolean;
}): void {
  requireDirectory(dirname(input.path), input.exactParentMode ?? true, `${input.boundary} parent`);
  const temporary = `${input.path}.tmp-${sha256(input.bytes).slice("sha256:".length)}`;
  writeFreshFile(temporary, input.bytes, input.observer, `${input.boundary}:temporary`);
  if (input.replace) {
    renameSync(temporary, input.path);
    input.observer(`${input.boundary}:rename`);
  } else {
    linkSync(temporary, input.path);
    input.observer(`${input.boundary}:link`);
    unlinkSync(temporary);
    input.observer(`${input.boundary}:temporary-unlink`);
  }
  fsyncDirectory(
    dirname(input.path),
    input.observer,
    `${input.boundary}:directory-fsync`,
    input.exactParentMode ?? true,
  );
  const reopened = readRealBuildPrefix50Step44LaterSourceLedgerFile(input.path, input.boundary);
  if (!reopened.equals(Buffer.from(input.bytes)))
    throw new TypeError(`${input.boundary} did not reopen as its exact bytes.`);
}

export function createRealBuildPrefix50Step44LaterSourceTransactionLock(input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver;
}): void {
  writeFreshFile(input.path, input.bytes, input.observer, "later-source transaction-lock");
  fsyncDirectory(
    dirname(input.path),
    input.observer,
    "later-source transaction-lock:directory-fsync",
    true,
  );
}

export function removeRealBuildPrefix50Step44LaterSourceTransactionLock(input: {
  readonly path: string;
  readonly observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver;
}): void {
  unlinkSync(input.path);
  input.observer("later-source transaction-lock:unlink");
  fsyncDirectory(
    dirname(input.path),
    input.observer,
    "later-source transaction-lock:unlink-directory-fsync",
    true,
  );
}

export function realBuildPrefix50Step44LaterSourceLedgerPathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw new TypeError("Later-source ledger path availability could not be inspected.", {
      // Raw filesystem errors carry repository coordinates and are intentionally withheld.
      // eslint-disable-next-line preserve-caught-error
      cause: new Error("Underlying later-source path details were withheld."),
    });
  }
}

export function requireRealBuildPrefix50Step44LaterSourceLedgerDirectory(path: string): void {
  requireDirectory(path, true, "later-source ledger directory");
}
