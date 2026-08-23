import {
  closeSync,
  fstatSync,
  lstatSync,
  opendirSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute } from "node:path";

import { writeContainedFileAtomic } from "./part-identification-contained-write.mjs";
import {
  assertContainedReadBoundaryStable,
  assertOrdinaryDirectoryPath,
  preflightContainedRead,
  sameContainedFileState,
} from "./part-identification-contained-path.mjs";

export {
  CHILD_TIMEOUT_MS,
  MAX_CHILD_STDERR_BYTES,
  MAX_CHILD_STDOUT_BYTES,
  MAX_NODE_TIMER_MS,
  runBoundedChild,
} from "./part-identification-bounded-child.mjs";

export const MAX_JSON_ARTIFACT_BYTES = 32 * 1024 * 1024;
export const MAX_IMAGE_ARTIFACT_BYTES = 8 * 1024 * 1024;
export const MAX_DIRECTORY_ENTRIES = 4_096;
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
