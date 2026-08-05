import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  writeSync,
} from "node:fs";
import { basename, dirname, isAbsolute, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WINDOWS_EXACT_DELETE = fileURLToPath(
  new URL("./windows-open-file-disposition.ps1", import.meta.url),
);

function inside(root, candidate) {
  const fromRoot = relative(root, candidate);
  return (
    fromRoot === "" ||
    (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !isAbsolute(fromRoot))
  );
}

const comparablePath = (path) =>
  process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);

function identity(stats, label) {
  if (typeof stats.dev !== "bigint" || stats.dev < 0n || stats.ino <= 0n) {
    throw new Error(
      `${label} does not expose a positive comparable inode identity. Refusing a publication whose path replacement could not be detected.`,
    );
  }
  return { dev: stats.dev, ino: stats.ino };
}

function sameIdentity(left, right) {
  return left.ino === right.ino && (left.dev === 0n || right.dev === 0n || left.dev === right.dev);
}

function fileState(stats, label) {
  const fileIdentity = identity(stats, label);
  if (stats.size < 0n || stats.mtimeNs < 0n || stats.ctimeNs < 0n) {
    throw new Error(
      `${label} does not expose comparable size and timestamp metadata. Refusing a publication whose exact file state cannot be checked.`,
    );
  }
  return {
    ...fileIdentity,
    size: stats.size,
    mtimeNs: stats.mtimeNs,
    ctimeNs: stats.ctimeNs,
  };
}

function sameFileState(left, right) {
  return (
    sameIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function samePublishedFile(left, right) {
  return sameIdentity(left, right) && left.size === right.size && left.mtimeNs === right.mtimeNs;
}

/** Reject links in the declared boundary itself; create only ordinary missing directories. */
function ordinaryDirectoryPath(path, { create = false, label }) {
  const absolute = resolve(path);
  const parsed = parse(absolute);
  let current = parsed.root;
  for (const segment of relative(parsed.root, absolute).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    if (!existsSync(current)) {
      if (!create) throw new Error(`${label} ${JSON.stringify(absolute)} does not exist.`);
      mkdirSync(current);
    }
    const stats = lstatSync(current, { bigint: true });
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(
        `${label} ${JSON.stringify(absolute)} crosses linked, junction, or non-directory component ${JSON.stringify(current)}. Use an ordinary directory tree as the containment boundary.`,
      );
    }
    const resolved = realpathSync(current);
    if (comparablePath(resolved) !== comparablePath(current)) {
      throw new Error(
        `${label} ${JSON.stringify(absolute)} resolves component ${JSON.stringify(current)} to ${JSON.stringify(resolved)}. Linked and junction-backed roots are not containment boundaries.`,
      );
    }
  }
  return absolute;
}

function snapshotDirectories(root, parent, label) {
  const snapshots = [];
  let current = root;
  const segments = relative(root, parent).split(sep).filter(Boolean);
  for (const segment of ["", ...segments]) {
    if (segment !== "") current = resolve(current, segment);
    const stats = lstatSync(current, { bigint: true });
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(
        `${label} ancestor ${JSON.stringify(current)} became a link, junction, or non-directory. Retry with an immutable output tree.`,
      );
    }
    snapshots.push({ path: current, ...identity(stats, `${label} ancestor ${current}`) });
  }
  return snapshots;
}

function assertDirectoriesStable(snapshots, rootRealpath, parent, label) {
  for (const expected of snapshots) {
    const stats = lstatSync(expected.path, { bigint: true });
    if (
      !stats.isDirectory() ||
      stats.isSymbolicLink() ||
      !sameIdentity(expected, identity(stats, `${label} ancestor ${expected.path}`))
    ) {
      throw new Error(
        `${label} ancestor ${JSON.stringify(expected.path)} changed identity during publication. No replacement path will be trusted or removed.`,
      );
    }
  }
  const observedRoot = realpathSync(snapshots[0].path);
  const observedParent = realpathSync(parent);
  if (
    comparablePath(observedRoot) !== comparablePath(rootRealpath) ||
    !inside(rootRealpath, observedParent)
  ) {
    throw new Error(
      `${label} root or parent resolved outside its original containment boundary during publication. No replacement path will be trusted or removed.`,
    );
  }
}

function cleanupExactOpenFile({ path, expectedState, label }) {
  if (expectedState === null) return null;
  if (process.platform !== "win32") {
    return new Error(
      `${label} erased its rejected bytes through the exact open descriptor, but this platform has no configured exact-handle deletion primitive. The zero-byte file was deliberately retained at ${JSON.stringify(path)} instead of path-unlinking a possible replacement.`,
    );
  }
  const executable = resolve(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const result = spawnSync(
    executable,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      WINDOWS_EXACT_DELETE,
      "-Path",
      path,
      "-Inode",
      expectedState.ino.toString(),
      "-Device",
      expectedState.dev.toString(),
      "-ExpectedSize",
      expectedState.size.toString(),
    ],
    { encoding: "utf8", timeout: 15_000, windowsHide: true, maxBuffer: 128 * 1024 },
  );
  if (result.status === 0 && result.error === undefined) return null;
  const detail =
    result.error?.message ?? result.stderr?.trim() ?? `PowerShell exited ${result.status}`;
  return new Error(
    `${label} could not remove its rejected file through an identity-checked Windows handle: ${detail}. The exact descriptor was still scrubbed; no path-based unlink was attempted.`,
    result.error === undefined ? undefined : { cause: result.error },
  );
}

function combineFailure(failure, cleanup, message) {
  if (cleanup === null) return failure;
  return failure === null
    ? cleanup
    : new AggregateError(
        [failure, cleanup],
        `${message} Primary failure: ${failure.message} Cleanup failure: ${cleanup.message}`,
      );
}

/**
 * Publish through one held file identity. Failed publication scrubs that exact
 * descriptor and, on Windows, marks the identity-checked file handle itself
 * for deletion before the publisher descriptor closes.
 */
export function writeContainedFileAtomic(root, canonicalPath, bytes, options = {}) {
  const payload = Buffer.from(bytes);
  const label = options.label ?? "Output";
  const rootPath = ordinaryDirectoryPath(root, {
    create: true,
    label: options.rootLabel ?? "Declared output root",
  });
  const rootRealpath = realpathSync(rootPath);
  const candidate = resolve(rootPath, ...canonicalPath.split("/"));
  if (!inside(rootRealpath, candidate)) {
    throw new Error(
      `${options.pathLabel ?? "output path"} ${JSON.stringify(canonicalPath)} escapes declared root ${JSON.stringify(rootRealpath)}.`,
    );
  }
  const parent = ordinaryDirectoryPath(dirname(candidate), {
    create: true,
    label: `${label} parent`,
  });
  const parentRealpath = realpathSync(parent);
  if (!inside(rootRealpath, parentRealpath)) {
    throw new Error(
      `${label} parent ${JSON.stringify(parent)} resolves outside declared root ${JSON.stringify(rootRealpath)}.`,
    );
  }
  const snapshots = snapshotDirectories(rootPath, parent, label);
  if (existsSync(candidate)) {
    const target = lstatSync(candidate, { bigint: true });
    if (!target.isFile() || target.isSymbolicLink()) {
      throw new Error(
        `${label} target ${JSON.stringify(candidate)} is not an ordinary file beneath the declared root.`,
      );
    }
  }
  options.__testHooks?.afterPreflight?.();

  const temporary = resolve(
    parent,
    `.${basename(candidate)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`,
  );
  let descriptor = null;
  let temporaryState = null;
  let published = false;
  let succeeded = false;
  let failure = null;
  try {
    assertDirectoriesStable(snapshots, rootRealpath, parent, label);
    descriptor = openSync(temporary, "wx", 0o600);
    let offset = 0;
    while (offset < payload.length) {
      const written = writeSync(descriptor, payload, offset, payload.length - offset, offset);
      if (written === 0) {
        throw new Error(`${label} stopped after ${offset} of ${payload.length} bytes.`);
      }
      offset += written;
    }
    fsyncSync(descriptor);
    temporaryState = fileState(fstatSync(descriptor, { bigint: true }), `${label} descriptor`);
    if (temporaryState.size !== BigInt(payload.length)) {
      throw new Error(
        `${label} descriptor contains ${temporaryState.size} bytes after writing ${payload.length}.`,
      );
    }
    options.__testHooks?.afterTemporaryWrite?.();

    assertDirectoriesStable(snapshots, rootRealpath, parent, label);
    const temporaryPathState = fileState(
      lstatSync(temporary, { bigint: true }),
      `${label} temporary path`,
    );
    if (!sameFileState(temporaryState, temporaryPathState)) {
      throw new Error(`${label} temporary path was replaced or changed before publication.`);
    }
    if (existsSync(candidate)) {
      const target = lstatSync(candidate, { bigint: true });
      if (!target.isFile() || target.isSymbolicLink()) {
        throw new Error(`${label} target became a link or non-file before publication.`);
      }
    }
    renameSync(temporary, candidate);
    published = true;
    options.__testHooks?.afterRename?.();

    assertDirectoriesStable(snapshots, rootRealpath, parent, label);
    const publishedStats = lstatSync(candidate, { bigint: true });
    const publishedRealpath = realpathSync(candidate);
    if (
      !publishedStats.isFile() ||
      publishedStats.isSymbolicLink() ||
      !inside(rootRealpath, publishedRealpath) ||
      !samePublishedFile(temporaryState, fileState(publishedStats, `${label} published path`))
    ) {
      throw new Error(
        `${label} published path does not retain the verified temporary-file identity, bytes, and metadata.`,
      );
    }
    succeeded = true;
  } catch (error) {
    failure = error instanceof Error ? error : new Error(`${label} failed: ${String(error)}.`);
  } finally {
    let cleanupState = temporaryState;
    if (descriptor !== null) {
      if (!succeeded) {
        try {
          ftruncateSync(descriptor, 0);
          fsyncSync(descriptor);
          cleanupState = fileState(
            fstatSync(descriptor, { bigint: true }),
            `${label} scrubbed descriptor`,
          );
        } catch (error) {
          failure = combineFailure(
            failure,
            new Error(
              `${label} could not erase rejected task bytes through its exact open descriptor: ${error instanceof Error ? error.message : String(error)}.`,
              { cause: error },
            ),
            `${label} failed and exact-handle payload cleanup also failed.`,
          );
        }
      }
      if (!succeeded) {
        try {
          options.__testHooks?.beforeExactCleanup?.({
            path: published ? candidate : temporary,
            published,
          });
        } catch (error) {
          failure = combineFailure(
            failure,
            new Error(
              `Test cleanup hook failed: ${error instanceof Error ? error.message : String(error)}.`,
              { cause: error },
            ),
            `${label} failed and its test cleanup hook also failed.`,
          );
        }
        failure = combineFailure(
          failure,
          cleanupExactOpenFile({
            path: published ? candidate : temporary,
            expectedState: cleanupState,
            label,
          }),
          `${label} failed and its rejected exact file handle could not be removed safely.`,
        );
      }
      try {
        closeSync(descriptor);
      } catch (error) {
        failure = combineFailure(
          failure,
          new Error(
            `${label} could not close its exact publication descriptor: ${error instanceof Error ? error.message : String(error)}.`,
            { cause: error },
          ),
          `${label} failed and its exact descriptor could not close.`,
        );
      }
    }
  }
  if (failure !== null) throw failure;
  if (!succeeded) throw new Error(`${label} failed without a publication result.`);
}
