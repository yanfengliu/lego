import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

import { TRUSTED_WINDOWS_POWERSHELL } from "./part-identification-windows-trust.mjs";

const arrayIsArray = Array.isArray;
const arrayJoin = Function.call.bind(Array.prototype.join);
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const jsonStringify = JSON.stringify;

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
const WINDOWS_BOUNDED_CHILD = fileURLToPath(
  new URL("./windows-bounded-child.ps1", import.meta.url),
);
const EXACT_EXECUTABLE_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const MAX_EXACT_EXECUTABLE_BYTES = 384 * 1024 * 1024;

function normalizedExactExecutablePin(input) {
  if (input === undefined) return null;
  if (input === null || typeof input !== "object") {
    throw new Error("Exact executable pin must be an object with own data properties.");
  }
  const byteLengthProperty = getOwnPropertyDescriptor(input, "byteLength");
  const digestProperty = getOwnPropertyDescriptor(input, "digest");
  const byteLength = byteLengthProperty?.value;
  const digest = digestProperty?.value;
  if (
    byteLengthProperty?.get !== undefined ||
    byteLengthProperty?.set !== undefined ||
    digestProperty?.get !== undefined ||
    digestProperty?.set !== undefined ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 1 ||
    byteLength > MAX_EXACT_EXECUTABLE_BYTES ||
    typeof digest !== "string" ||
    !EXACT_EXECUTABLE_DIGEST.test(digest)
  ) {
    throw new Error(
      `Exact executable pin requires own data properties containing a 1..${MAX_EXACT_EXECUTABLE_BYTES}-byte length and lowercase SHA-256 digest.`,
    );
  }
  return Object.freeze({ byteLength, digest });
}

function serializeWindowsLaunchRequest(command, args, pin, testDelayMs) {
  const encodedArguments = new Array(args.length);
  for (let index = 0; index < args.length; index += 1) {
    encodedArguments[index] = jsonStringify(args[index]);
  }
  const exactPin =
    pin === null
      ? ""
      : `,"exactExecutablePin":{"byteLength":${pin.byteLength},"digest":${jsonStringify(pin.digest)}}`;
  const testDelay = testDelayMs === 0 ? "" : `,"testPostVerificationDelayMs":${testDelayMs}`;
  return `{"command":${jsonStringify(command)},"arguments":[${arrayJoin(encodedArguments, ",")}]${exactPin}${testDelay}}`;
}

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
  const heldArguments = arrayIsArray(args) && args.length <= 256 ? new Array(args.length) : null;
  let argumentBytes = 0;
  if (heldArguments !== null) {
    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index];
      if (typeof argument !== "string" || argument.length > 1_000_000 || argument.includes("\0")) {
        argumentBytes = Number.POSITIVE_INFINITY;
        break;
      }
      heldArguments[index] = argument;
      argumentBytes += Buffer.byteLength(argument);
      if (argumentBytes > 4 * 1024 * 1024) break;
    }
  }
  if (heldArguments === null || argumentBytes > 4 * 1024 * 1024) {
    return Promise.reject(
      new Error(
        `${label} requires at most 256 NUL-free string arguments, at most 1000000 characters each and 4194304 UTF-8 bytes total.`,
      ),
    );
  }
  let exactExecutablePin;
  try {
    exactExecutablePin = normalizedExactExecutablePin(options.exactExecutablePin);
  } catch (cause) {
    return Promise.reject(cause);
  }
  const pinReadyHook = options.__testHooks?.onPinnedExecutableReady;
  const testPostVerificationDelayMs = options.__testHooks?.postVerificationDelayMs ?? 0;
  if (
    (pinReadyHook !== undefined || testPostVerificationDelayMs !== 0) &&
    (exactExecutablePin === null ||
      typeof pinReadyHook !== "function" ||
      !Number.isSafeInteger(testPostVerificationDelayMs) ||
      testPostVerificationDelayMs < 1 ||
      testPostVerificationDelayMs > 5_000)
  ) {
    return Promise.reject(
      new Error(
        "Pinned-executable test synchronization requires an exact pin, one callback, and a 1..5000 ms post-verification delay.",
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
    if (exactExecutablePin !== null && !windowsJobWrapped) {
      reject(
        new Error(
          "Exact executable pins require the native Windows Job Object launcher; injected or non-Windows spawn paths cannot publish that evidence.",
        ),
      );
      return;
    }
    try {
      const executable = windowsJobWrapped ? TRUSTED_WINDOWS_POWERSHELL : command;
      const childArgs = windowsJobWrapped
        ? [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            WINDOWS_BOUNDED_CHILD,
            ...(exactExecutablePin === null
              ? []
              : [
                  "-RequireExactPin",
                  "-ExactByteLength",
                  `${exactExecutablePin.byteLength}`,
                  "-ExactDigest",
                  exactExecutablePin.digest,
                ]),
          ]
        : heldArguments;
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
      child.stdin.end(
        serializeWindowsLaunchRequest(
          command,
          heldArguments,
          exactExecutablePin,
          testPostVerificationDelayMs,
        ),
      );
    }
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const exactHeader =
      exactExecutablePin === null
        ? null
        : Buffer.from(
            `LEGO_EXACT_EXECUTABLE_V1 ${exactExecutablePin.byteLength} ${exactExecutablePin.digest}\r\n`,
            "utf8",
          );
    let exactHeaderProbe = Buffer.alloc(0);
    let exactHeaderSeen = false;
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
      if (stderrBytes > maxStderrBytes + (exactHeader?.length ?? 0)) {
        terminate(
          new Error(
            `${label} exceeded its ${maxStderrBytes}-byte stderr limit and was terminated.`,
          ),
        );
        return;
      }
      stderr.push(bytes);
      if (
        exactHeader !== null &&
        !exactHeaderSeen &&
        exactHeaderProbe.length < exactHeader.length
      ) {
        const combinedProbe = Buffer.concat([exactHeaderProbe, bytes]);
        exactHeaderProbe =
          combinedProbe.length <= exactHeader.length
            ? combinedProbe
            : Buffer.from(combinedProbe.buffer, combinedProbe.byteOffset, exactHeader.length);
        if (
          exactHeaderProbe.length >= exactHeader.length &&
          Buffer.compare(exactHeaderProbe, exactHeader) === 0
        ) {
          exactHeaderSeen = true;
          if (pinReadyHook !== undefined) {
            try {
              pinReadyHook();
            } catch (cause) {
              terminate(
                new Error(
                  `${label} pinned-executable test synchronization failed: ${cause instanceof Error ? cause.message : String(cause)}.`,
                  { cause },
                ),
              );
            }
          }
        }
      }
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
        const heldStderr = Buffer.concat(stderr);
        if (exactHeader !== null && !exactHeaderSeen) {
          reject(
            new Error(
              `${label} did not emit its exact-executable launch receipt; no child result is trusted (launcher stderrBytes=${heldStderr.length}, contents omitted).`,
            ),
          );
          return;
        }
        const childStderr =
          exactHeader === null
            ? heldStderr
            : Buffer.from(
                heldStderr.buffer,
                heldStderr.byteOffset + exactHeader.length,
                heldStderr.length - exactHeader.length,
              );
        resolvePromise({
          code,
          signal,
          stdout: decodeChildOutput(stdout, "stdout", label),
          stderr: decodeChildOutput([childStderr], "stderr", label),
          ...(exactExecutablePin === null ? {} : { executableEvidence: exactExecutablePin }),
        });
      } catch (cause) {
        reject(cause);
      }
    });
  });
}
