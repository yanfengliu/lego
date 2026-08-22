import { createHash } from "node:crypto";
import {
  existsSync,
  closeSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  opendirSync,
  openSync,
  readSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, join, relative, resolve, sep } from "node:path";

import {
  PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
  PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
  PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
  PART_IDENTIFICATION_ENV_ALLOWLIST,
  PART_IDENTIFICATION_PROVIDER_ENV_ALLOWLIST,
} from "./part-identification-transport-contract.mjs";

const own = Function.call.bind(Object.prototype.hasOwnProperty);
const arrayIsArray = Array.isArray;
const createObject = Object.create;
const defineProperty = Object.defineProperty;
const bufferEquals = Function.call.bind(Buffer.prototype.equals);
const stringIncludes = Function.call.bind(String.prototype.includes);
const stringStartsWith = Function.call.bind(String.prototype.startsWith);
const MAX_CLAUDE_BINARY_BYTES = 384 * 1024 * 1024;

export function boundedPartIdentificationEnvironment(source) {
  const env = createObject(null);
  for (let index = 0; index < PART_IDENTIFICATION_ENV_ALLOWLIST.length; index += 1) {
    const key = PART_IDENTIFICATION_ENV_ALLOWLIST[index];
    if (!own(source, key)) continue;
    const value = source[key];
    if (typeof value === "string" && value.length <= 32_768 && !stringIncludes(value, "\0")) {
      defineProperty(env, key, { value, enumerable: true, writable: true });
    }
  }
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
  return env;
}

export function providerPartIdentificationEnvironment(source) {
  const env = createObject(null);
  for (let index = 0; index < PART_IDENTIFICATION_PROVIDER_ENV_ALLOWLIST.length; index += 1) {
    const key = PART_IDENTIFICATION_PROVIDER_ENV_ALLOWLIST[index];
    if (!own(source, key)) continue;
    const value = source[key];
    if (typeof value === "string" && value.length <= 32_768 && !stringIncludes(value, "\0")) {
      defineProperty(env, key, { value, enumerable: true, writable: true });
    }
  }
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
  return env;
}

export function assertPinnedClaudeVersionResult(result) {
  const exactStdout =
    result?.stdout === PART_IDENTIFICATION_CLAUDE_CLI_VERSION ||
    result?.stdout === `${PART_IDENTIFICATION_CLAUDE_CLI_VERSION}\n` ||
    result?.stdout === `${PART_IDENTIFICATION_CLAUDE_CLI_VERSION}\r\n`;
  if (result?.code !== 0 || result.signal !== null || result.stderr !== "" || !exactStdout) {
    throw new Error(
      `Claude CLI version probe must return exactly ${PART_IDENTIFICATION_CLAUDE_CLI_VERSION} with success and empty stderr; observed stdoutBytes=${Buffer.byteLength(result?.stdout ?? "")} and stderrBytes=${Buffer.byteLength(result?.stderr ?? "")}, contents omitted.`,
    );
  }
  return PART_IDENTIFICATION_CLAUDE_CLI_VERSION;
}

export function createPartIdentificationTaskRoot() {
  const root = mkdtempSync(join(tmpdir(), "lego-part-identification-mcp-"));
  const stats = lstatSync(root, { bigint: true });
  if (!stats.isDirectory() || stats.isSymbolicLink() || stats.ino <= 0n) {
    throw new Error("Task-owned Claude root lacks an ordinary comparable directory identity.");
  }
  return { root, identity: { dev: stats.dev, ino: stats.ino } };
}

export function auditPartIdentificationTaskRoot(root, identity, expectedFiles) {
  const stats = lstatSync(root, { bigint: true });
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    stats.ino !== identity.ino ||
    stats.dev !== identity.dev
  ) {
    throw new Error("Task-owned Claude root changed identity or stopped being ordinary.");
  }
  if (!arrayIsArray(expectedFiles)) {
    throw new Error("Task-owned Claude root audit requires an exact array of prewritten files.");
  }
  const entries = [];
  const directory = opendirSync(root);
  try {
    for (;;) {
      const entry = directory.readSync();
      if (entry === null) break;
      if (entries.length >= expectedFiles.length) {
        throw new Error(
          `Task-owned Claude root contains more than ${expectedFiles.length} entries; a persistent child-created entry refuses the call.`,
        );
      }
      entries[entries.length] = entry;
    }
  } finally {
    directory.closeSync();
  }
  if (entries.length !== expectedFiles.length) {
    throw new Error(
      `Task-owned Claude root contains ${entries.length} entries, but exactly ${expectedFiles.length} prewritten files are allowed; a missing or persistent child-created entry refuses the call.`,
    );
  }
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    let expected;
    for (let expectedIndex = 0; expectedIndex < expectedFiles.length; expectedIndex += 1) {
      if (expectedFiles[expectedIndex]?.name === entry.name) {
        expected = expectedFiles[expectedIndex].bytes;
      }
    }
    if (!entry.isFile() || entry.isSymbolicLink() || expected === undefined) {
      throw new Error("Task-owned Claude root contains an unexpected, linked, or non-file entry.");
    }
    const path = join(root, entry.name);
    const before = lstatSync(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.size !== BigInt(expected.length)) {
      throw new Error(
        `Task-owned Claude transport file ${JSON.stringify(entry.name)} changed type or size during the call.`,
      );
    }
    const descriptor = openSync(path, "r");
    let observed;
    try {
      const opened = fstatSync(descriptor, { bigint: true });
      if (
        !opened.isFile() ||
        opened.dev !== before.dev ||
        opened.ino !== before.ino ||
        opened.size !== before.size
      ) {
        throw new Error(
          `Task-owned Claude transport file ${JSON.stringify(entry.name)} changed identity before its bounded read.`,
        );
      }
      observed = Buffer.allocUnsafe(expected.length);
      let offset = 0;
      while (offset < observed.length) {
        const count = readSync(descriptor, observed, offset, observed.length - offset, offset);
        if (count === 0) break;
        offset += count;
      }
      const extra = Buffer.allocUnsafe(1);
      const extraBytes = readSync(descriptor, extra, 0, 1, observed.length);
      const after = fstatSync(descriptor, { bigint: true });
      const pathAfter = lstatSync(path, { bigint: true });
      if (
        offset !== observed.length ||
        extraBytes !== 0 ||
        after.dev !== opened.dev ||
        after.ino !== opened.ino ||
        after.size !== opened.size ||
        after.mtimeNs !== opened.mtimeNs ||
        after.ctimeNs !== opened.ctimeNs ||
        pathAfter.isSymbolicLink() ||
        !pathAfter.isFile() ||
        pathAfter.dev !== after.dev ||
        pathAfter.ino !== after.ino ||
        pathAfter.size !== after.size ||
        pathAfter.mtimeNs !== after.mtimeNs ||
        pathAfter.ctimeNs !== after.ctimeNs
      ) {
        throw new Error(
          `Task-owned Claude transport file ${JSON.stringify(entry.name)} changed identity or size during its bounded read.`,
        );
      }
    } finally {
      closeSync(descriptor);
    }
    if (!bufferEquals(observed, expected)) {
      throw new Error(
        `Task-owned Claude transport file ${JSON.stringify(entry.name)} changed during the call.`,
      );
    }
  }
}

export function cleanupPartIdentificationTaskRoot(root, identity) {
  const temporaryRoot = resolve(tmpdir());
  const target = resolve(root);
  const fromTemporary = relative(temporaryRoot, target);
  const stats = lstatSync(target, { bigint: true });
  if (
    !stringStartsWith(basename(target), "lego-part-identification-mcp-") ||
    fromTemporary === "" ||
    fromTemporary === ".." ||
    stringStartsWith(fromTemporary, `..${sep}`) ||
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    stats.ino !== identity.ino ||
    stats.dev !== identity.dev
  ) {
    throw new Error(
      `Refusing to clean a replaced or non-task Claude root ${JSON.stringify(target)}.`,
    );
  }
  rmSync(target, { recursive: true, force: true });
  if (existsSync(target)) throw new Error("Task-owned Claude root still exists after cleanup.");
}

function executableNames() {
  return process.platform === "win32" ? ["claude.exe"] : ["claude"];
}

function binaryState(stats) {
  return {
    dev: stats.dev,
    ino: stats.ino,
    size: stats.size,
    mtimeNs: stats.mtimeNs,
    ctimeNs: stats.ctimeNs,
  };
}

function sameBinaryState(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function hashDescriptor(descriptor, byteLength) {
  const hash = createHash("sha256");
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  let offset = 0;
  while (offset < byteLength) {
    const count = readSync(
      descriptor,
      chunk,
      0,
      Math.min(chunk.length, byteLength - offset),
      offset,
    );
    if (count < 1) throw new Error(`Claude binary stopped after ${offset} of ${byteLength} bytes.`);
    hash.update(chunk.subarray(0, count));
    offset += count;
  }
  return `sha256:${hash.digest("hex")}`;
}

export function assertClaudeBinaryStable(binary) {
  const descriptorState = binaryState(fstatSync(binary.descriptor, { bigint: true }));
  const pathStats = lstatSync(binary.path, { bigint: true });
  const pathState = binaryState(pathStats);
  if (
    !pathStats.isFile() ||
    pathStats.isSymbolicLink() ||
    !sameBinaryState(binary.identity, descriptorState) ||
    !sameBinaryState(binary.identity, pathState)
  ) {
    throw new Error(
      "Pinned Claude binary changed identity or content metadata around provider launch.",
    );
  }
}

export function closeClaudeBinary(binary) {
  closeSync(binary.descriptor);
}

export function resolveClaudeBinary(environment) {
  const pathValue = environment.PATH;
  if (typeof pathValue !== "string" || pathValue.length === 0) {
    throw new Error("Strict Claude transport requires an allowlisted PATH to resolve one binary.");
  }
  const directories = pathValue.split(delimiter);
  const names = executableNames();
  if (directories.length > 512) throw new Error("Claude PATH contains more than 512 entries.");
  for (let directoryIndex = 0; directoryIndex < directories.length; directoryIndex += 1) {
    const directory = directories[directoryIndex];
    if (directory.length === 0 || directory.length > 32_768) continue;
    for (let nameIndex = 0; nameIndex < names.length; nameIndex += 1) {
      const candidate = resolve(directory, names[nameIndex]);
      if (!existsSync(candidate)) continue;
      const candidateStats = lstatSync(candidate, { bigint: true });
      if (!candidateStats.isFile() || candidateStats.isSymbolicLink()) continue;
      const target = realpathSync(candidate);
      if (resolve(target).toLowerCase() !== resolve(candidate).toLowerCase()) continue;
      const stats = lstatSync(candidate, { bigint: true });
      if (
        !stats.isFile() ||
        stats.isSymbolicLink() ||
        stats.size > BigInt(MAX_CLAUDE_BINARY_BYTES)
      ) {
        continue;
      }
      let descriptor;
      let retained = false;
      try {
        descriptor = openSync(candidate, "r");
        const before = fstatSync(descriptor, { bigint: true });
        const identity = binaryState(before);
        if (!before.isFile() || !sameBinaryState(identity, binaryState(stats))) continue;
        const byteLength = Number(before.size);
        const digest = hashDescriptor(descriptor, byteLength);
        const after = fstatSync(descriptor, { bigint: true });
        const pathAfter = lstatSync(candidate, { bigint: true });
        if (
          !sameBinaryState(identity, binaryState(after)) ||
          !sameBinaryState(identity, binaryState(pathAfter)) ||
          byteLength !== PART_IDENTIFICATION_CLAUDE_BINARY_BYTES ||
          digest !== PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST
        ) {
          continue;
        }
        retained = true;
        return {
          path: candidate,
          descriptor,
          identity,
          evidence: { byteLength, digest },
        };
      } finally {
        if (!retained && descriptor !== undefined) closeSync(descriptor);
      }
    }
  }
  throw new Error(
    "Could not resolve one ordinary bounded Claude binary from the allowlisted PATH.",
  );
}
