import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAX_IMAGE_ARTIFACT_BYTES,
  readContainedFile,
  writeContainedFile,
} from "./part-identification-io.mjs";

const WINDOWS_LOCK_HELPER = fileURLToPath(
  new URL("./windows-lock-exact-files.ps1", import.meta.url),
);
const CARD_ID = /^card-\d{4}$/u;
const SNAPSHOT_PREFIX = "lego-identification-call-";
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function combineFailure(failure, cleanup, message) {
  if (cleanup === null) return failure;
  return failure === null
    ? cleanup
    : new AggregateError(
        [failure, cleanup],
        `${message} Primary failure: ${failure.message} Cleanup failure: ${cleanup.message}`,
      );
}

function exactBytesFor(images, digests, cardId) {
  const bytes = images instanceof Map ? images.get(cardId) : null;
  const expectedDigest = digests instanceof Map ? digests.get(cardId) : digests?.[cardId];
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length < 1 ||
    bytes.length > MAX_IMAGE_ARTIFACT_BYTES ||
    !SHA256.test(expectedDigest ?? "")
  ) {
    throw new Error(
      `Vision call has no bounded manifest-digested replay bytes for ${cardId}. Authenticate the retained card-image bundle and its match-bound manifest before materializing a model input.`,
    );
  }
  const held = Buffer.from(bytes);
  const observedDigest = sha256(held);
  if (observedDigest !== expectedDigest) {
    throw new Error(
      `Vision-call replay bytes for ${cardId} hash to ${observedDigest}, but the exact cards manifest requires ${expectedDigest}. Discard the mutable input and authenticate the retained card-image bundle again.`,
    );
  }
  return held;
}

function assertSafeSnapshotRoot(root) {
  const temporaryRoot = realpathSync(tmpdir());
  const resolved = resolve(root);
  const fromTemporary = relative(temporaryRoot, resolved);
  if (
    basename(resolved).startsWith(SNAPSHOT_PREFIX) &&
    fromTemporary !== "" &&
    !fromTemporary.startsWith(`..${sep}`) &&
    fromTemporary !== ".."
  ) {
    return resolved;
  }
  throw new Error(
    `Refusing to clean unexpected vision-call snapshot root ${JSON.stringify(root)} outside ${JSON.stringify(temporaryRoot)}.`,
  );
}

function verifySnapshot(snapshot) {
  for (const file of snapshot.files) {
    const observed = readContainedFile(snapshot.root, `${file.cardId}.png`, {
      label: `Vision-call snapshot ${file.cardId}`,
      pathLabel: "Vision-call snapshot path",
      maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
    });
    if (!observed.equals(file.bytes)) {
      throw new Error(
        `Vision-call snapshot ${file.cardId} changed after materialization. The model answer is discarded because it is not bound to the retained card bytes.`,
      );
    }
  }
}

function openExactDescriptors(snapshot) {
  const descriptors = [];
  try {
    for (const file of snapshot.files) {
      const descriptor = openSync(file.path, "r");
      descriptors.push(descriptor);
      const stats = fstatSync(descriptor, { bigint: true });
      if (!stats.isFile() || stats.size !== BigInt(file.bytes.length)) {
        throw new Error(
          `Vision-call descriptor for ${file.cardId} is not the expected regular file.`,
        );
      }
      const observed = Buffer.alloc(file.bytes.length);
      let offset = 0;
      while (offset < observed.length) {
        const count = readSync(descriptor, observed, offset, observed.length - offset, offset);
        if (count === 0) break;
        offset += count;
      }
      if (offset !== observed.length || !observed.equals(file.bytes)) {
        throw new Error(
          `Vision-call descriptor for ${file.cardId} does not contain its authenticated retained bytes.`,
        );
      }
    }
    return descriptors;
  } catch (error) {
    for (const descriptor of descriptors) closeSync(descriptor);
    throw error;
  }
}

function powershellExecutable() {
  return resolve(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
}

function startWindowsLocks(snapshot, spawnImpl = spawn) {
  const specification = Buffer.from(
    JSON.stringify({
      root: {
        path: snapshot.root,
        inode: snapshot.rootIdentity.ino.toString(),
        device: snapshot.rootIdentity.dev.toString(),
      },
      files: snapshot.files.map(({ path, digest }) => ({ path, digest })),
    }),
  ).toString("base64");
  return new Promise((resolvePromise, reject) => {
    const child = spawnImpl(
      powershellExecutable(),
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        WINDOWS_LOCK_HELPER,
        "-Specification",
        specification,
      ],
      { windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    let ready = false;
    let releaseStarted = false;
    let prematureFailure = null;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Exact vision-card read locks did not become ready within 15 seconds."));
    }, 15_000);
    const fail = (cause) => {
      if (ready) return;
      clearTimeout(timer);
      reject(cause instanceof Error ? cause : new Error(String(cause)));
    };
    child.on("error", fail);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 128 * 1024) child.kill();
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (!ready && stdout.split(/\r?\n/u).includes("READY")) {
        ready = true;
        clearTimeout(timer);
        resolvePromise({
          child,
          stderr: () => stderr,
          beginRelease: () => {
            releaseStarted = true;
          },
          prematureFailure: () => prematureFailure,
        });
      }
    });
    child.on("close", (code, signal) => {
      if (!ready) {
        fail(
          new Error(
            `Exact vision-card read-lock helper exited ${code} before readiness: ${stderr.trim() || "no diagnostics"}.`,
          ),
        );
      } else if (!releaseStarted) {
        prematureFailure = new Error(
          `Exact vision-card read-lock helper exited ${code}${signal === null ? "" : ` (${signal})`} after readiness but before explicit release. The model result is discarded because its input locks were lost while the callback was live.`,
        );
      }
    });
  });
}

async function releaseWindowsLocks(lock) {
  const child = lock.child;
  const prematureFailure = lock.prematureFailure();
  if (prematureFailure !== null) return prematureFailure;
  if (child.exitCode !== null) {
    return new Error(
      `Exact vision-card read-lock helper exited ${child.exitCode} after readiness but before explicit release: ${lock.stderr().trim() || "no diagnostics"}. The model result is discarded because its input locks were lost while the callback was live.`,
    );
  }
  lock.beginRelease();
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      child.kill();
      resolvePromise(
        new Error("Exact vision-card read-lock helper did not close within 5 seconds."),
      );
    }, 5_000);
    child.once("close", (code) => {
      clearTimeout(timer);
      resolvePromise(
        code === 0
          ? null
          : new Error(
              `Exact vision-card read-lock helper exited ${code}: ${lock.stderr().trim() || "no diagnostics"}.`,
            ),
      );
    });
    child.stdin.end();
  });
}

function materializeSnapshot(cardIds, images, digests) {
  if (!(images instanceof Map)) {
    throw new Error(
      "Vision calls require the authenticated card-image replay map, not mutable card paths.",
    );
  }
  const sources = cardIds.map((cardId) => {
    if (!CARD_ID.test(cardId)) throw new Error(`Invalid snapshot card id ${cardId}.`);
    return { cardId, bytes: exactBytesFor(images, digests, cardId) };
  });
  const root = mkdtempSync(join(tmpdir(), SNAPSHOT_PREFIX));
  try {
    const files = sources.map(({ cardId, bytes }) => {
      writeContainedFile(root, `${cardId}.png`, bytes, {
        label: `Vision-call snapshot ${cardId}`,
        pathLabel: "Vision-call snapshot path",
        maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
      });
      return {
        cardId,
        bytes,
        digest: sha256(bytes),
        path: join(root, `${cardId}.png`),
      };
    });
    const rootStats = lstatSync(root, { bigint: true });
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink() || rootStats.ino <= 0n) {
      throw new Error("Vision-call snapshot root lacks an ordinary comparable directory identity.");
    }
    const snapshot = {
      root,
      rootIdentity: { dev: rootStats.dev, ino: rootStats.ino },
      files,
    };
    verifySnapshot(snapshot);
    return snapshot;
  } catch (error) {
    if (process.platform !== "win32") {
      rmSync(assertSafeSnapshotRoot(root), { recursive: true, force: true });
      throw error;
    }
    throw new AggregateError(
      [error],
      `Vision-call snapshot materialization failed. Its unpredictable task directory ${JSON.stringify(root)} was deliberately retained because no exact Windows cleanup lock had been acquired; no replacement path was recursively removed.`,
      { cause: error },
    );
  }
}

export async function withCardCallSnapshot(cardIds, images, digests, callback, options = {}) {
  const snapshot = materializeSnapshot(cardIds, images, digests);
  let descriptors = [];
  let windowsLock = null;
  let failure = null;
  let result;
  try {
    if (process.platform === "win32") {
      windowsLock = await startWindowsLocks(snapshot, options.__testHooks?.lockSpawnImpl);
      verifySnapshot(snapshot);
    } else {
      descriptors = openExactDescriptors(snapshot);
    }
    const promptPaths =
      process.platform === "win32"
        ? snapshot.files.map(({ path }) => path.replaceAll("\\", "/"))
        : descriptors.map((_, index) => `/dev/fd/${index + 3}`);
    result = await callback(promptPaths, descriptors);
    verifySnapshot(snapshot);
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  } finally {
    if (windowsLock !== null) {
      failure = combineFailure(
        failure,
        await releaseWindowsLocks(windowsLock),
        "Vision call failed and its exact Windows card locks also failed to close.",
      );
    }
    for (const descriptor of descriptors) {
      try {
        closeSync(descriptor);
      } catch (cause) {
        failure = combineFailure(
          failure,
          new Error(`Could not close exact vision-card descriptor: ${cause.message}.`, { cause }),
          "Vision call failed and an exact card descriptor also failed to close.",
        );
      }
    }
    if (process.platform === "win32") {
      if (existsSync(snapshot.root)) {
        failure = combineFailure(
          failure,
          new Error(
            `Exact Windows cleanup did not remove vision-call snapshot root ${JSON.stringify(snapshot.root)}. No recursive path deletion was attempted.`,
          ),
          "Vision call failed and its exact task-owned snapshot also failed to close.",
        );
      }
    } else {
      try {
        rmSync(assertSafeSnapshotRoot(snapshot.root), { recursive: true, force: true });
      } catch (cause) {
        failure = combineFailure(
          failure,
          new Error(`Could not remove task-owned vision-call snapshot: ${cause.message}.`, {
            cause,
          }),
          "Vision call failed and its task-owned snapshot also failed to close.",
        );
      }
    }
  }
  if (failure !== null) throw failure;
  return result;
}
