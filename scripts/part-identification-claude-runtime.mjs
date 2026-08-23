import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  opendirSync,
  openSync,
  readSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveClaudeBinary,
  resolveClaudeBinaryWithPin,
} from "./part-identification-claude-binary.mjs";
import {
  PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
  PART_IDENTIFICATION_ENV_ALLOWLIST,
  PART_IDENTIFICATION_PROVIDER_ENV_ALLOWLIST,
} from "./part-identification-transport-contract.mjs";
import { TRUSTED_WINDOWS_POWERSHELL } from "./part-identification-windows-trust.mjs";

const own = Function.call.bind(Object.prototype.hasOwnProperty);
const arrayIsArray = Array.isArray;
const createObject = Object.create;
const defineProperty = Object.defineProperty;
const bufferEquals = Function.call.bind(Buffer.prototype.equals);
const stringIncludes = Function.call.bind(String.prototype.includes);
const stringStartsWith = Function.call.bind(String.prototype.startsWith);
const arrayJoin = Function.call.bind(Array.prototype.join);
const jsonStringify = JSON.stringify;
const hashPrototype = Object.getPrototypeOf(createHash("sha256"));
const hashUpdate = Function.call.bind(hashPrototype.update);
const hashDigest = Function.call.bind(hashPrototype.digest);
const WINDOWS_EXACT_DIRECTORY_CLEANUP = fileURLToPath(
  new URL("./windows-lock-exact-files.ps1", import.meta.url),
);
const WINDOWS_CLEANUP_WAIT = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

function digestBytes(bytes) {
  const hash = createHash("sha256");
  hashUpdate(hash, bytes);
  return `sha256:${hashDigest(hash, "hex")}`;
}

function windowsCleanupSpecification(root, identity, expectedFiles) {
  const files = new Array(expectedFiles.length);
  for (let index = 0; index < expectedFiles.length; index += 1) {
    const file = expectedFiles[index];
    files[index] =
      `{"name":${jsonStringify(file.name)},"digest":${jsonStringify(digestBytes(file.bytes))}}`;
  }
  return `{"root":{"path":${jsonStringify(root)},"inode":${jsonStringify(identity.ino.toString())},"device":${jsonStringify(identity.dev.toString())}},"files":[${arrayJoin(files, ",")}]}`;
}

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

export function cleanupPartIdentificationTaskRoot(root, identity, expectedFiles = []) {
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
  auditPartIdentificationTaskRoot(target, identity, expectedFiles);
  if (process.platform === "win32") {
    const specification = Buffer.from(
      windowsCleanupSpecification(target, identity, expectedFiles),
      "utf8",
    ).toString("base64");
    const result = spawnSync(
      TRUSTED_WINDOWS_POWERSHELL,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        WINDOWS_EXACT_DIRECTORY_CLEANUP,
        "-Specification",
        specification,
      ],
      {
        encoding: "utf8",
        input: "",
        timeout: 15_000,
        windowsHide: true,
        maxBuffer: 128 * 1024,
      },
    );
    if (result.status !== 0 || result.error !== undefined) {
      const detail =
        result.error?.message ?? (result.stderr.trim() || `PowerShell exited ${result.status}`);
      throw new Error(
        `Task-owned Claude root could not be removed through exact file/directory handles: ${detail}. No recursive path deletion was attempted.`,
        result.error === undefined ? undefined : { cause: result.error },
      );
    }
    const deadline = Date.now() + 2_000;
    while (existsSync(target) && Date.now() < deadline) {
      Atomics.wait(WINDOWS_CLEANUP_WAIT, 0, 0, 10);
    }
    if (existsSync(target)) {
      throw new Error(
        "Task-owned Claude root is still visible after exact-handle cleanup; no replacement path was recursively removed.",
      );
    }
    return;
  }
  rmSync(target, { recursive: true, force: true });
  if (existsSync(target)) throw new Error("Task-owned Claude root still exists after cleanup.");
}

export { resolveClaudeBinary };

export const __testOnly = Object.freeze({
  windowsCleanupSpecification,
  resolveClaudeBinaryWithPin(environment, pin) {
    return resolveClaudeBinaryWithPin(environment, pin);
  },
});
