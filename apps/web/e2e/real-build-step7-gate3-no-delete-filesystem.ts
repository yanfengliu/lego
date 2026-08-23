import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  renameSync,
  writeSync,
  type BigIntStats,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { normalizeThrownWithoutProbing } from "./non-probing-error";

/**
 * Retention-only filesystem operations: every failure closes descriptors but deletes no path or
 * bytes. Checks are bounded sequential detection under cooperative exclusivity, not a seal,
 * simultaneous-at-return proof, crash-durability claim, or malicious same-user race defense.
 */

const SAFE_RELATIVE_PATH_PATTERN = /^[A-Za-z0-9._@/-]+$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;
const OWNERSHIP_CREATION_FAILURES = new WeakSet<object>();

export const STEP7_GATE3_OWNER_MARKER = ".lego-step7-gate3-owner";

export type Step7Gate3OwnershipFailureStage =
  "marker-creation" | "marker-write" | "marker-fsync" | "marker-verification";

export type Step7Gate3NoDeleteWriteFailureStage = "after-open" | "after-write" | "after-fsync";

export interface Step7Gate3NoDeleteDirectoryIdentity {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly ownerToken: string;
}

export interface Step7Gate3NoDeleteDirectoryObservation {
  readonly absolutePath: string;
  readonly dev: bigint;
  readonly ino: bigint;
}

export interface Step7Gate3NoDeleteArtifact {
  readonly file: string;
  readonly bytes: number;
  readonly digest: string;
}

interface RootBoundary {
  readonly absolute: string;
  readonly realpath: string;
}

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function normalizeRelative(candidate: string, label: string): string {
  const normalized = candidate.replaceAll("\\", "/");
  if (
    candidate.length === 0 ||
    isAbsolute(candidate) ||
    !SAFE_RELATIVE_PATH_PATTERN.test(normalized) ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new TypeError(
      `${label} must be a strict relative path without traversal, dot segments, or special characters; received ${JSON.stringify(candidate)}.`,
    );
  }
  return normalized;
}

export function normalizeStep7Gate3NoDeleteRelativePath(candidate: string, label: string): string {
  return normalizeRelative(candidate, label);
}

function rootBoundary(root: string, label: string): RootBoundary {
  const absolute = resolve(root);
  const stat = lstatSync(absolute, { bigint: true });
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new TypeError(`${label} root must be a real directory: ${absolute}.`);
  }
  return { absolute, realpath: realpathSync.native(absolute) };
}

function comparableDirectory(stat: BigIntStats, label: string): { dev: bigint; ino: bigint } {
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev < 0n || stat.ino <= 0n) {
    throw new TypeError(`${label} must be a real directory with a comparable filesystem identity.`);
  }
  return { dev: stat.dev, ino: stat.ino };
}

function checkedDirectory(
  boundary: RootBoundary,
  absolutePath: string,
  label: string,
): Step7Gate3NoDeleteDirectoryObservation {
  if (!inside(boundary.absolute, absolutePath)) {
    throw new TypeError(`${label} resolves outside its admitted root.`);
  }
  const identity = comparableDirectory(lstatSync(absolutePath, { bigint: true }), label);
  const observedRealpath = realpathSync.native(absolutePath);
  if (!inside(boundary.realpath, observedRealpath)) {
    throw new TypeError(`${label} resolves outside its real admitted root.`);
  }
  return Object.freeze({ absolutePath, ...identity });
}

function sameIdentity(
  expected: Step7Gate3NoDeleteDirectoryIdentity,
  observed: Step7Gate3NoDeleteDirectoryObservation,
): boolean {
  return (
    expected.ino === observed.ino &&
    (expected.dev === 0n || observed.dev === 0n || expected.dev === observed.dev)
  );
}

/**
 * Cooperative Node-only directory creation with no rollback deletion. It detects substitutions
 * at its sequential checks; it does not prove protection from a malicious same-user OS race.
 */
export function ensureStep7Gate3NoDeleteDirectoryTree(
  root: string,
  candidate: string,
  label: string,
): string {
  const normalized = normalizeRelative(candidate, label);
  const boundary = rootBoundary(root, label);
  let current = "";
  for (const segment of normalized.split("/")) {
    current = current === "" ? segment : `${current}/${segment}`;
    const target = resolve(boundary.absolute, current);
    if (!inside(boundary.absolute, target)) throw new TypeError(`${label} escaped its root.`);
    if (!existsSync(target)) mkdirSync(target);
    checkedDirectory(boundary, target, `${label} segment ${JSON.stringify(current)}`);
  }
  return resolve(boundary.absolute, normalized);
}

export function inspectStep7Gate3NoDeleteDirectory(
  root: string,
  candidate: string,
  label: string,
): Step7Gate3NoDeleteDirectoryObservation {
  const normalized = normalizeRelative(candidate, label);
  const boundary = rootBoundary(root, label);
  return checkedDirectory(boundary, resolve(boundary.absolute, normalized), label);
}

function containedFileTarget(root: string, candidate: string, label: string): string {
  const normalized = normalizeRelative(candidate, label);
  const boundary = rootBoundary(root, label);
  const target = resolve(boundary.absolute, normalized);
  checkedDirectory(boundary, dirname(target), `${label} parent`);
  return target;
}

function writeExclusiveDescriptor(input: {
  readonly target: string;
  readonly bytes: Buffer;
  readonly label: string;
  readonly failureStage?: Step7Gate3OwnershipFailureStage;
  readonly writeFailureStage?: Step7Gate3NoDeleteWriteFailureStage;
}): void {
  let descriptor: number | null = null;
  let failure: unknown;
  let failed = false;
  try {
    if (input.failureStage === "marker-creation") {
      throw new Error("Injected Gate-3 owner-marker creation failure.");
    }
    descriptor = openSync(input.target, "wx");
    if (input.writeFailureStage === "after-open") {
      throw new Error("Injected Gate-3 no-delete file failure after exclusive open.");
    }
    if (input.failureStage === "marker-write") {
      throw new Error("Injected Gate-3 owner-marker write failure.");
    }
    let offset = 0;
    while (offset < input.bytes.length) {
      const written = writeSync(
        descriptor,
        input.bytes,
        offset,
        input.bytes.length - offset,
        offset,
      );
      if (written <= 0) throw new TypeError(`${input.label} write made no progress.`);
      offset += written;
    }
    if (input.writeFailureStage === "after-write") {
      throw new Error("Injected Gate-3 no-delete file failure after write.");
    }
    if (input.failureStage === "marker-fsync") {
      throw new Error("Injected Gate-3 owner-marker fsync failure.");
    }
    fsyncSync(descriptor);
    if (input.writeFailureStage === "after-fsync") {
      throw new Error("Injected Gate-3 no-delete file failure after fsync.");
    }
    const stat = fstatSync(descriptor, { bigint: true });
    if (!stat.isFile() || stat.size !== BigInt(input.bytes.length)) {
      throw new TypeError(`${input.label} descriptor did not retain the exact written size.`);
    }
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch (error) {
        failure = failed
          ? new AggregateError(
              [
                normalizeThrownWithoutProbing(failure, `${input.label} failed.`),
                normalizeThrownWithoutProbing(error, `${input.label} descriptor close failed.`),
              ],
              `${input.label} and descriptor close both failed; no pathname was deleted.`,
            )
          : error;
        failed = true;
      }
    }
  }
  if (failed) {
    throw normalizeThrownWithoutProbing(
      failure,
      `${input.label} failed without readable error data; no pathname was deleted.`,
    );
  }
}

export function readStep7Gate3NoDeleteFile(input: {
  readonly root: string;
  readonly candidate: string;
  readonly label: string;
  readonly exactBytes: number;
  readonly maximumBytes: number;
  readonly expectedDigest: string;
}): Buffer {
  if (
    !Number.isSafeInteger(input.exactBytes) ||
    input.exactBytes < 0 ||
    !Number.isSafeInteger(input.maximumBytes) ||
    input.maximumBytes < input.exactBytes ||
    !SHA256_PATTERN.test(input.expectedDigest)
  ) {
    throw new TypeError(`${input.label} has invalid exact read-back bounds or digest.`);
  }
  const target = containedFileTarget(input.root, input.candidate, input.label);
  const pathStat = lstatSync(target, { bigint: true });
  if (pathStat.isSymbolicLink() || !pathStat.isFile()) {
    throw new TypeError(`${input.label} must be a real regular file.`);
  }
  let descriptor: number | null = null;
  let result: Buffer | null = null;
  let failure: unknown;
  let failed = false;
  try {
    descriptor = openSync(target, "r");
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.size !== BigInt(input.exactBytes)) {
      throw new TypeError(`${input.label} does not have exactly ${input.exactBytes} bytes.`);
    }
    const bytes = Buffer.allocUnsafe(input.exactBytes);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count <= 0) throw new TypeError(`${input.label} ended during exact read-back.`);
      offset += count;
    }
    if (readSync(descriptor, Buffer.allocUnsafe(1), 0, 1, input.exactBytes) !== 0) {
      throw new TypeError(`${input.label} grew during exact read-back.`);
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    ) {
      throw new TypeError(`${input.label} changed during its descriptor read-back.`);
    }
    const observedDigest = digest(bytes);
    if (observedDigest !== input.expectedDigest) {
      throw new TypeError(
        `${input.label} hashes to ${observedDigest}; expected ${input.expectedDigest}.`,
      );
    }
    result = bytes;
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch (error) {
        failure = failed
          ? new AggregateError(
              [
                normalizeThrownWithoutProbing(failure, `${input.label} read-back failed.`),
                normalizeThrownWithoutProbing(
                  error,
                  `${input.label} read descriptor close failed.`,
                ),
              ],
              `${input.label} read-back and descriptor close both failed.`,
            )
          : error;
        failed = true;
      }
    }
  }
  if (failed || result === null) {
    throw normalizeThrownWithoutProbing(failure, `${input.label} exact read-back failed.`);
  }
  return result;
}

export function writeStep7Gate3NoDeleteFile(input: {
  readonly root: string;
  readonly directoryRelative: string;
  readonly file: string;
  readonly label: string;
  readonly bytes: Buffer;
  readonly maximumBytes: number;
  readonly __testFailureStage?: Step7Gate3NoDeleteWriteFailureStage;
}): Step7Gate3NoDeleteArtifact {
  if (input.file.includes("/") || input.file.includes("\\")) {
    throw new TypeError(`${input.label} file must be one strict basename.`);
  }
  const bytes = Buffer.from(input.bytes);
  if (!Number.isSafeInteger(input.maximumBytes) || bytes.length > input.maximumBytes) {
    throw new RangeError(`${input.label} exceeds its exact byte bound.`);
  }
  const expectedDigest = digest(bytes);
  const candidate = `${normalizeRelative(input.directoryRelative, input.label)}/${normalizeRelative(input.file, input.label)}`;
  const target = containedFileTarget(input.root, candidate, input.label);
  writeExclusiveDescriptor({
    target,
    bytes,
    label: input.label,
    ...(input.__testFailureStage === undefined
      ? {}
      : { writeFailureStage: input.__testFailureStage }),
  });
  const readBack = readStep7Gate3NoDeleteFile({
    root: input.root,
    candidate,
    label: `${input.label} read-back`,
    exactBytes: bytes.length,
    maximumBytes: input.maximumBytes,
    expectedDigest,
  });
  if (!readBack.equals(bytes)) throw new TypeError(`${input.label} exact bytes changed.`);
  return Object.freeze({ file: input.file, bytes: bytes.length, digest: expectedDigest });
}

function isWeakKey(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

export function isStep7Gate3OwnershipCreationFailure(value: unknown): boolean {
  return (
    isWeakKey(value) && SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, OWNERSHIP_CREATION_FAILURES, [value])
  );
}

export function createStep7Gate3NoDeleteStagingDirectory(input: {
  readonly root: string;
  readonly relativePath: string;
  readonly label: string;
  readonly failureStage?: Step7Gate3OwnershipFailureStage;
}): Step7Gate3NoDeleteDirectoryIdentity {
  const normalized = normalizeRelative(input.relativePath, input.label);
  const parent = normalized.split("/").slice(0, -1).join("/");
  if (parent.length === 0) throw new TypeError(`${input.label} requires a contained parent.`);
  ensureStep7Gate3NoDeleteDirectoryTree(input.root, parent, `${input.label} parent`);
  const boundary = rootBoundary(input.root, input.label);
  const target = resolve(boundary.absolute, normalized);
  if (existsSync(target)) throw new TypeError(`${input.label} already exists: ${normalized}.`);
  mkdirSync(target);
  try {
    const created = checkedDirectory(boundary, target, input.label);
    const ownerToken = randomUUID();
    const markerBytes = Buffer.from(ownerToken);
    writeExclusiveDescriptor({
      target: resolve(target, STEP7_GATE3_OWNER_MARKER),
      bytes: markerBytes,
      label: `${input.label} owner marker`,
      ...(input.failureStage === undefined ? {} : { failureStage: input.failureStage }),
    });
    if (input.failureStage === "marker-verification") {
      throw new Error("Injected Gate-3 owner-marker verification failure.");
    }
    const observed = readStep7Gate3NoDeleteFile({
      root: input.root,
      candidate: `${normalized}/${STEP7_GATE3_OWNER_MARKER}`,
      label: `${input.label} owner marker verification`,
      exactBytes: markerBytes.length,
      maximumBytes: markerBytes.length,
      expectedDigest: digest(markerBytes),
    });
    if (!observed.equals(markerBytes)) throw new TypeError(`${input.label} owner token changed.`);
    const closed = checkedDirectory(boundary, target, `${input.label} closure`);
    if (created.dev !== closed.dev || created.ino !== closed.ino) {
      throw new TypeError(`${input.label} directory identity changed during owner creation.`);
    }
    return Object.freeze({ dev: created.dev, ino: created.ino, ownerToken });
  } catch (error) {
    const failure = new Error(
      `${input.label} created ${normalized} but its ownership is unverified; the exact pathname was retained without deletion.`,
      { cause: normalizeThrownWithoutProbing(error, `${input.label} ownership failed.`) },
    );
    SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, OWNERSHIP_CREATION_FAILURES, [failure]);
    throw failure;
  }
}

export function assertStep7Gate3NoDeleteDirectoryOwnership(
  root: string,
  relativePath: string,
  expected: Step7Gate3NoDeleteDirectoryIdentity,
  label: string,
): void {
  const directory = inspectStep7Gate3NoDeleteDirectory(root, relativePath, label);
  if (!sameIdentity(expected, directory)) {
    throw new TypeError(`${label} does not retain the expected directory identity.`);
  }
  const tokenBytes = Buffer.from(expected.ownerToken);
  const observed = readStep7Gate3NoDeleteFile({
    root,
    candidate: `${relativePath}/${STEP7_GATE3_OWNER_MARKER}`,
    label: `${label} owner marker`,
    exactBytes: tokenBytes.length,
    maximumBytes: tokenBytes.length,
    expectedDigest: digest(tokenBytes),
  });
  if (!observed.equals(tokenBytes)) throw new TypeError(`${label} owner token changed.`);
}

/** Same-parent rename plus later caller read-back is detection, not malicious-peer protection. */
export function renameStep7Gate3NoDeleteDirectory(input: {
  readonly root: string;
  readonly sourceRelative: string;
  readonly targetRelative: string;
  readonly expectedIdentity: Step7Gate3NoDeleteDirectoryIdentity;
  readonly label: string;
  readonly beforeRename?: () => void;
}): string {
  const source = normalizeRelative(input.sourceRelative, `${input.label} source`);
  const target = normalizeRelative(input.targetRelative, `${input.label} target`);
  if (dirname(source) !== dirname(target)) {
    throw new TypeError(`${input.label} requires one exact same-parent rename.`);
  }
  const sourceObservation = inspectStep7Gate3NoDeleteDirectory(
    input.root,
    source,
    `${input.label} source`,
  );
  if (!sameIdentity(input.expectedIdentity, sourceObservation)) {
    throw new TypeError(`${input.label} source identity changed before rename.`);
  }
  assertStep7Gate3NoDeleteDirectoryOwnership(
    input.root,
    source,
    input.expectedIdentity,
    `${input.label} source`,
  );
  const targetAbsolute = resolve(rootBoundary(input.root, input.label).absolute, target);
  if (existsSync(targetAbsolute)) throw new TypeError(`${input.label} target already exists.`);
  input.beforeRename?.();
  renameSync(sourceObservation.absolutePath, targetAbsolute);
  return targetAbsolute;
}
