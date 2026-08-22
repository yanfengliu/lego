import { spawn } from "node:child_process";
import {
  closeSync,
  fstatSync,
  lstatSync,
  opendirSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

import { writeContainedFileAtomic } from "./part-identification-contained-write.mjs";
import {
  assertContainedReadBoundaryStable,
  assertOrdinaryDirectoryPath,
  preflightContainedRead,
  sameContainedFileState,
} from "./part-identification-contained-path.mjs";

export const MAX_JSON_ARTIFACT_BYTES = 32 * 1024 * 1024;
export const MAX_IMAGE_ARTIFACT_BYTES = 8 * 1024 * 1024;
export const MAX_DIRECTORY_ENTRIES = 4_096;
export const MAX_CHILD_STDOUT_BYTES = 4 * 1024 * 1024;
export const MAX_CHILD_STDERR_BYTES = 512 * 1024;
export const MAX_NODE_TIMER_MS = 2_147_483_647;
/**
 * How long a bounded child may run before it is terminated.
 *
 * Fifteen minutes was chosen against a six-card vision batch. A single-card
 * call returns in about three, so on a one-card batch the ceiling stops being a
 * bound on work and becomes a bound on a stall: a hung provider call costs the
 * full fifteen minutes before the run learns anything, and the batch it carried
 * is lost with it. Measured overnight, that was two cards answered per pass
 * against a hundred and twenty-six outstanding.
 *
 * So the ceiling is tunable, and the caller who knows its batch size sets it.
 * Cutting a stall short is only useful because progress is persisted per call -
 * a terminated pass keeps every answer it already had, so a shorter ceiling
 * trades a longer tail of retries for far less time spent waiting on calls that
 * were never going to return.
 */
const DEFAULT_CHILD_TIMEOUT_MS = 15 * 60 * 1_000;
export const CHILD_TIMEOUT_MS = (() => {
  const raw = process.env.LEGO_CHILD_TIMEOUT_MS;
  if (raw === undefined) return DEFAULT_CHILD_TIMEOUT_MS;
  if (!/^\d+$/u.test(raw)) {
    throw new Error(
      `LEGO_CHILD_TIMEOUT_MS must be a whole number of milliseconds; received ${JSON.stringify(raw)}.`,
    );
  }
  const parsed = Number(raw);
  if (parsed < 30_000 || parsed > MAX_NODE_TIMER_MS) {
    throw new Error(
      `LEGO_CHILD_TIMEOUT_MS must be between 30000 and ${MAX_NODE_TIMER_MS} ms; received ${parsed}.`,
    );
  }
  return parsed;
})();
const fatalUtf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function display(label, path) {
  return label === undefined ? JSON.stringify(path) : `${label} at ${JSON.stringify(path)}`;
}
export function assertCanonicalRelativePath(value, label = "artifact path") {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    value.includes("\0") ||
    value.includes("\\") ||
    isAbsolute(value)
  ) {
    throw new Error(
      `${label} must be a non-empty canonical forward-slash relative path of at most 512 characters; received ${JSON.stringify(value)}.`,
    );
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(
      `${label} ${JSON.stringify(value)} contains an empty, current-directory, or parent-directory segment. Regenerate the bound artifact with a canonical child path.`,
    );
  }
  return value;
}
export function sameFileIdentity(left, right) {
  const integer = (value) =>
    typeof value === "bigint"
      ? value >= 0n
        ? value
        : null
      : typeof value === "number" && Number.isInteger(value) && value >= 0
        ? BigInt(value)
        : null;
  const leftInode = integer(left.ino);
  const rightInode = integer(right.ino);
  const leftDevice = integer(left.dev);
  const rightDevice = integer(right.dev);
  return (
    leftInode !== null &&
    rightInode !== null &&
    leftDevice !== null &&
    rightDevice !== null &&
    leftInode > 0n &&
    leftInode === rightInode &&
    (leftDevice === 0n || rightDevice === 0n || leftDevice === rightDevice)
  );
}
function comparableIdentity(stats) {
  const integer = (value) =>
    typeof value === "bigint" ? value >= 0n : Number.isInteger(value) && value >= 0;
  return integer(stats.dev) && integer(stats.ino) && stats.ino !== 0 && stats.ino !== 0n;
}

function sameContentMetadata(left, right) {
  return (
    left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs
  );
}

function readOpenFile(path, label, maxBytes, expectedResolvedPath = null, boundary = null) {
  let descriptor;
  try {
    if (boundary !== null) assertContainedReadBoundaryStable(boundary, label);
    const pathBefore = lstatSync(path, { bigint: true });
    if (!pathBefore.isFile() || pathBefore.isSymbolicLink()) {
      throw new Error(`${display(label, path)} is not an ordinary regular file.`);
    }
    if (!comparableIdentity(pathBefore)) {
      throw new Error(
        `${display(label, path)} does not expose a positive inode identity before opening. Refusing to read when path replacement cannot be detected.`,
      );
    }
    if (boundary !== null && !sameContainedFileState(pathBefore, boundary.candidateState)) {
      throw new Error(
        `${display(label, path)} changed identity or content metadata after containment preflight. Retry from an immutable retained artifact.`,
      );
    }
    descriptor = openSync(path, "r");
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile()) {
      throw new Error(`${display(label, path)} is not a regular file.`);
    }
    if (!comparableIdentity(before)) {
      throw new Error(
        `${display(label, path)} opened without a positive inode identity. Refusing metadata-only identity fallback.`,
      );
    }
    if (before.size > BigInt(maxBytes)) {
      throw new Error(
        `${display(label, path)} is ${before.size} bytes, above the ${maxBytes}-byte input limit. Reduce or regenerate the artifact before retrying.`,
      );
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(path, { bigint: true });
    const resolvedAfter = realpathSync(path);
    if (boundary !== null) assertContainedReadBoundaryStable(boundary, label);
    if (
      bytes.length > maxBytes ||
      !sameContentMetadata(before, after) ||
      BigInt(bytes.length) !== after.size ||
      pathAfter.isSymbolicLink() ||
      !pathAfter.isFile() ||
      !comparableIdentity(after) ||
      !comparableIdentity(pathAfter) ||
      !sameFileIdentity(before, pathBefore) ||
      !sameContentMetadata(before, pathBefore) ||
      !sameFileIdentity(before, after) ||
      !sameFileIdentity(before, pathAfter) ||
      !sameContentMetadata(after, pathAfter) ||
      (expectedResolvedPath !== null && resolvedAfter !== expectedResolvedPath)
    ) {
      throw new Error(
        `${display(label, path)} changed identity, content metadata, or size while it was read, or exceeded the ${maxBytes}-byte input limit. Retry from an immutable retained artifact.`,
      );
    }
    return bytes;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function readBoundedFile(path, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_JSON_ARTIFACT_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error(
      `File byte limit must be a positive safe integer; received ${JSON.stringify(maxBytes)}.`,
    );
  }
  return readOpenFile(path, options.label, maxBytes);
}

export function readContainedFile(root, relativePath, options = {}) {
  const canonical = assertCanonicalRelativePath(relativePath, options.pathLabel);
  const boundary = preflightContainedRead(root, canonical, options);
  options.__testHooks?.afterPreflight?.();
  return readOpenFile(
    boundary.candidate,
    options.label,
    options.maxBytes ?? MAX_IMAGE_ARTIFACT_BYTES,
    boundary.resolved,
    boundary,
  );
}

export function boundedDirectoryFiles(root, options = {}) {
  const limit = options.maxEntries ?? MAX_DIRECTORY_ENTRIES;
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error(
      `Directory entry limit must be a positive safe integer; received ${JSON.stringify(limit)}.`,
    );
  }
  const rootPath = assertOrdinaryDirectoryPath(root, {
    label: options.label ?? "Input directory",
  });
  const files = [];
  let entries = 0;
  const directory = opendirSync(rootPath);
  try {
    for (;;) {
      const entry = directory.readSync();
      if (entry === null) break;
      entries += 1;
      if (entries > limit) {
        throw new Error(
          `${options.label ?? "Input directory"} ${JSON.stringify(root)} contains more than ${limit} entries, above the ${limit}-entry limit. Narrow or regenerate the retained gallery.`,
        );
      }
      if (entry.isSymbolicLink()) {
        throw new Error(
          `${options.label ?? "Input directory"} ${JSON.stringify(root)} contains linked entry ${JSON.stringify(entry.name)}; retained inputs must be regular files beneath their declared root.`,
        );
      }
      if (entry.isFile()) files[files.length] = entry.name;
    }
  } finally {
    directory.closeSync();
  }
  return files;
}

export function writeContainedFile(root, relativePath, bytes, options = {}) {
  const canonical = assertCanonicalRelativePath(relativePath, options.pathLabel ?? "output path");
  const payload = Buffer.from(bytes);
  const maxBytes = options.maxBytes ?? MAX_JSON_ARTIFACT_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error(
      `Output byte limit must be a positive safe integer; received ${JSON.stringify(maxBytes)}.`,
    );
  }
  if (payload.length > maxBytes) {
    throw new Error(
      `${options.label ?? "Output"} is ${payload.length} bytes, above the ${maxBytes}-byte publication limit.`,
    );
  }
  writeContainedFileAtomic(root, canonical, payload, options);
}

const WINDOWS_BOUNDED_CHILD = fileURLToPath(
  new URL("./windows-bounded-child.ps1", import.meta.url),
);

function terminateOwnedProcessTree(child, signal, nativeSpawn, windowsJobWrapped) {
  if (!nativeSpawn) {
    child.kill(signal);
    return;
  }
  if (!Number.isInteger(child.pid) || child.pid < 1) {
    child.kill(signal);
    return;
  }
  if (process.platform === "win32") {
    if (!windowsJobWrapped) {
      throw new Error("Native Windows children must be launched in the kill-on-close Job Object.");
    }
    child.kill(signal);
    return;
  }
  process.kill(-child.pid, signal);
}

function decodeChildOutput(chunks, stream, label) {
  try {
    return fatalUtf8.decode(Buffer.concat(chunks));
  } catch (cause) {
    throw new Error(
      `${label} emitted malformed UTF-8 on ${stream}; output bytes cannot be lossily changed before JSON parsing or diagnostics. Fix the child to emit UTF-8 and retry.`,
      { cause },
    );
  }
}

export function runBoundedChild(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? CHILD_TIMEOUT_MS;
  const maxStdoutBytes = options.maxStdoutBytes ?? MAX_CHILD_STDOUT_BYTES;
  const maxStderrBytes = options.maxStderrBytes ?? MAX_CHILD_STDERR_BYTES;
  const label = options.label ?? JSON.stringify(command);
  const inheritFds = options.inheritFds ?? [];
  if (
    typeof command !== "string" ||
    command.trim() === "" ||
    command.length > 32_768 ||
    command.includes("\0")
  ) {
    return Promise.reject(
      new Error(
        `Bounded child command for ${label} must be a non-empty NUL-free string of at most 32768 characters; received ${JSON.stringify(command)}.`,
      ),
    );
  }
  const argumentsValid =
    Array.isArray(args) &&
    args.length <= 256 &&
    args.every(
      (argument) =>
        typeof argument === "string" && argument.length <= 1_000_000 && !argument.includes("\0"),
    ) &&
    args.reduce((total, argument) => total + Buffer.byteLength(argument), 0) <= 4 * 1024 * 1024;
  if (!argumentsValid) {
    return Promise.reject(
      new Error(
        `${label} requires at most 256 NUL-free string arguments, at most 1000000 characters each and 4194304 UTF-8 bytes total.`,
      ),
    );
  }
  if (
    !Array.isArray(inheritFds) ||
    inheritFds.length > 12 ||
    inheritFds.some((descriptor) => !Number.isInteger(descriptor) || descriptor < 0) ||
    (inheritFds.length > 0 && process.platform === "win32")
  ) {
    return Promise.reject(
      new Error(
        `${label} inherited input descriptors require at most 12 non-negative integers on a non-Windows platform.`,
      ),
    );
  }
  for (const [name, value] of [
    ["timeout", timeoutMs],
    ["stdout limit", maxStdoutBytes],
    ["stderr limit", maxStderrBytes],
  ]) {
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      (name === "timeout" && value > MAX_NODE_TIMER_MS)
    ) {
      const requirement =
        name === "timeout"
          ? `a positive safe integer no larger than ${MAX_NODE_TIMER_MS}`
          : "a positive safe integer";
      return Promise.reject(
        new Error(`${label} ${name} must be ${requirement}; received ${JSON.stringify(value)}.`),
      );
    }
  }
  return new Promise((resolvePromise, reject) => {
    let child;
    const nativeSpawn = options.spawnImpl === undefined;
    const windowsJobWrapped = nativeSpawn && process.platform === "win32";
    try {
      const executable = windowsJobWrapped
        ? resolve(
            process.env.SystemRoot ?? "C:\\Windows",
            "System32",
            "WindowsPowerShell",
            "v1.0",
            "powershell.exe",
          )
        : command;
      const childArgs = windowsJobWrapped
        ? [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            WINDOWS_BOUNDED_CHILD,
          ]
        : args;
      child = (options.spawnImpl ?? spawn)(executable, childArgs, {
        cwd: options.cwd,
        env: options.env,
        detached: process.platform !== "win32",
        windowsHide: true,
        shell: false,
        ...(inheritFds.length === 0 ? {} : { stdio: ["pipe", "pipe", "pipe", ...inheritFds] }),
      });
    } catch (cause) {
      reject(
        new Error(
          `Cannot launch ${label}: ${cause instanceof Error ? cause.message : String(cause)}.`,
          { cause },
        ),
      );
      return;
    }
    if (windowsJobWrapped) {
      child.stdin.on("error", () => {
        // A launcher error is reported by its close/error event and captured stderr.
      });
      child.stdin.end(JSON.stringify({ command, arguments: args }));
    }
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let terminationError = null;
    let settled = false;
    let forceTimer = null;
    let settleTimer = null;
    const terminate = (error) => {
      if (terminationError !== null || settled) return;
      terminationError = error;
      try {
        terminateOwnedProcessTree(child, "SIGTERM", nativeSpawn, windowsJobWrapped);
      } catch (cause) {
        terminationError = new Error(
          `${error.message} Exact owned-tree cleanup also failed: ${cause instanceof Error ? cause.message : String(cause)}.`,
          { cause },
        );
        try {
          child.kill("SIGKILL");
        } catch {
          // The close/error handlers still settle the direct process.
        }
      }
      forceTimer = setTimeout(() => {
        try {
          terminateOwnedProcessTree(child, "SIGKILL", nativeSpawn, windowsJobWrapped);
        } catch {
          // The process may already have closed.
        }
        settleTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(terminationError);
        }, 1_000);
        settleTimer.unref?.();
      }, 1_000);
      forceTimer.unref?.();
    };
    const timer = setTimeout(
      () =>
        terminate(
          new Error(`${label} exceeded its ${timeoutMs} ms execution limit and was terminated.`),
        ),
      timeoutMs,
    );
    timer.unref?.();
    child.stdout.on("data", (chunk) => {
      if (terminationError !== null) return;
      const bytes = Buffer.from(chunk);
      stdoutBytes += bytes.length;
      if (stdoutBytes > maxStdoutBytes) {
        terminate(
          new Error(
            `${label} exceeded its ${maxStdoutBytes}-byte stdout limit and was terminated.`,
          ),
        );
        return;
      }
      stdout.push(bytes);
    });
    child.stderr.on("data", (chunk) => {
      if (terminationError !== null) return;
      const bytes = Buffer.from(chunk);
      stderrBytes += bytes.length;
      if (stderrBytes > maxStderrBytes) {
        terminate(
          new Error(
            `${label} exceeded its ${maxStderrBytes}-byte stderr limit and was terminated.`,
          ),
        );
        return;
      }
      stderr.push(bytes);
    });
    child.on("error", (cause) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forceTimer !== null) clearTimeout(forceTimer);
      if (settleTimer !== null) clearTimeout(settleTimer);
      reject(
        terminationError ??
          new Error(
            `Cannot launch ${label}: ${cause instanceof Error ? cause.message : String(cause)}.`,
            {
              cause,
            },
          ),
      );
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forceTimer !== null) clearTimeout(forceTimer);
      if (settleTimer !== null) clearTimeout(settleTimer);
      if (terminationError !== null) {
        reject(terminationError);
        return;
      }
      try {
        resolvePromise({
          code,
          signal,
          stdout: decodeChildOutput(stdout, "stdout", label),
          stderr: decodeChildOutput(stderr, "stderr", label),
        });
      } catch (cause) {
        reject(cause);
      }
    });
  });
}
