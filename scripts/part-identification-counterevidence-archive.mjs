import { lstatSync } from "node:fs";
import { extname, join } from "node:path";

import { sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  assertCanonicalRelativePath,
  readContainedFile,
  writeContainedFile,
} from "./part-identification-io.mjs";
import { assertOrdinaryDirectoryPath } from "./part-identification-contained-path.mjs";

function lstatIfPresent(path) {
  try {
    return lstatSync(path, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function boundedBytes(value, maxBytes, label) {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError(`${label} must be a Uint8Array.`);
  }
  const bytes = Buffer.from(value);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError(
      `${label} byte limit must be a positive safe integer; received ${JSON.stringify(maxBytes)}.`,
    );
  }
  if (bytes.length < 1 || bytes.length > maxBytes) {
    throw new TypeError(
      `${label} is ${bytes.length} bytes, outside the required 1..${maxBytes}-byte range.`,
    );
  }
  return bytes;
}

function archiveStem(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 160 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
  ) {
    throw new TypeError(
      `Counterevidence archive stem must contain only lower-case letters, digits, and single hyphens; received ${JSON.stringify(value)}.`,
    );
  }
  return value;
}

function verifiedContainedBytes(root, relativePath, expectedBytes, options) {
  const observed = readContainedFile(root, relativePath, {
    label: options.label,
    pathLabel: options.pathLabel,
    maxBytes: options.maxBytes,
  });
  const expectedDigest = sha256Digest(expectedBytes);
  if (!observed.equals(expectedBytes) || sha256Digest(observed) !== expectedDigest) {
    throw new Error(
      `${options.label} ${join(root, ...relativePath.split("/"))} does not contain its expected ${expectedDigest} bytes; no current artifact was overwritten.`,
    );
  }
  return observed;
}

function writeOrVerifyImmutable(root, relativePath, bytes, options) {
  const path = join(root, ...relativePath.split("/"));
  if (lstatIfPresent(path) === null) {
    writeContainedFile(root, relativePath, bytes, {
      label: options.label,
      pathLabel: options.pathLabel,
      maxBytes: options.maxBytes,
      exclusive: true,
      __testHooks: options.__testHooks,
    });
  }
  const observed = verifiedContainedBytes(root, relativePath, bytes, options);
  return Object.freeze({ bytes: observed.length, digest: sha256Digest(observed), path });
}

/**
 * Preserve a differing current artifact before its reviewed replacement is published.
 *
 * The current file is restricted to one ordinary child of the declared output root;
 * immutable history is written beneath that same root with the full current-byte
 * SHA-256 in its name. The caller still owns publication and must call this first.
 */
export function archiveDifferingCurrentArtifact({
  archiveNameStem,
  currentFile,
  label,
  maxBytes,
  nextBytes,
  outputRoot,
}) {
  const boundedNext = boundedBytes(nextBytes, maxBytes, `${label} replacement`);
  const canonicalCurrent = assertCanonicalRelativePath(currentFile, `${label} current path`);
  if (canonicalCurrent.includes("/")) {
    throw new TypeError(
      `${label} current path must name one file directly beneath its declared output root.`,
    );
  }
  const stem = archiveStem(archiveNameStem);
  const suffix = extname(canonicalCurrent);
  if (!/^\.[a-z0-9]+$/u.test(suffix)) {
    throw new TypeError(
      `${label} current path must have one lower-case alphanumeric file extension; received ${JSON.stringify(canonicalCurrent)}.`,
    );
  }

  if (lstatIfPresent(outputRoot) === null) return null;
  const root = assertOrdinaryDirectoryPath(outputRoot, {
    label: `${label} output root`,
  });
  const currentPath = join(root, canonicalCurrent);
  if (lstatIfPresent(currentPath) === null) return null;
  const currentBytes = readContainedFile(root, canonicalCurrent, {
    label: `${label} current counterevidence`,
    pathLabel: `${label} current counterevidence path`,
    maxBytes,
  });
  if (currentBytes.equals(boundedNext)) return null;

  const digest = sha256Digest(currentBytes);
  const digestHex = digest.slice("sha256:".length);
  if (!/^[a-f0-9]{64}$/u.test(digestHex)) {
    throw new TypeError(`${label} current counterevidence produced malformed digest ${digest}.`);
  }
  const archiveRelativePath = `history/${stem}-stale-${digestHex}${suffix}`;
  const archivePath = join(root, ...archiveRelativePath.split("/"));
  if (lstatIfPresent(archivePath) === null) {
    writeContainedFile(root, archiveRelativePath, currentBytes, {
      label: `${label} immutable counterevidence`,
      pathLabel: `${label} counterevidence archive path`,
      maxBytes,
      exclusive: true,
    });
  }

  const archivedBytes = readContainedFile(root, archiveRelativePath, {
    label: `${label} immutable counterevidence`,
    pathLabel: `${label} counterevidence archive path`,
    maxBytes,
  });
  if (!archivedBytes.equals(currentBytes) || sha256Digest(archivedBytes) !== digest) {
    throw new Error(
      `${label} counterevidence path ${archivePath} exists with bytes other than ${digest}; current evidence was not replaced. Preserve both artifacts under distinct reviewed names before retrying.`,
    );
  }
  const stableCurrentBytes = readContainedFile(root, canonicalCurrent, {
    label: `${label} current counterevidence after archival`,
    pathLabel: `${label} current counterevidence path`,
    maxBytes,
  });
  if (!stableCurrentBytes.equals(currentBytes)) {
    throw new Error(
      `${label} current counterevidence changed while it was archived; current evidence was not replaced. Retry from an immutable output tree.`,
    );
  }
  return Object.freeze({
    archivePath,
    archiveRelativePath,
    bytes: currentBytes.length,
    digest,
  });
}

/**
 * Publish without ever replacing an existing current pathname.
 *
 * There is no portable rename-if-and-only-if-target-still-has-this-inode primitive
 * in Node. An absent current path is therefore created exclusively, an identical
 * current path is reused, and a differing current path is retained while both its
 * counterevidence and the verified replacement candidate are written immutably.
 * This closes absent-to-late-create and present-to-late-change overwrite races by
 * refusing to perform the overwrite at all.
 */
export function publishContainedArtifactWithoutOverwrite({
  archiveNameStem,
  currentFile,
  label,
  maxBytes,
  nextBytes,
  outputRoot,
  __testHooks,
}) {
  const boundedNext = boundedBytes(nextBytes, maxBytes, `${label} verified publication`);
  const canonicalCurrent = assertCanonicalRelativePath(currentFile, `${label} current path`);
  if (canonicalCurrent.includes("/")) {
    throw new TypeError(
      `${label} current path must name one file directly beneath its declared output root.`,
    );
  }
  const stem = archiveStem(archiveNameStem);
  const suffix = extname(canonicalCurrent);
  if (!/^\.[a-z0-9]+$/u.test(suffix)) {
    throw new TypeError(
      `${label} current path must have one lower-case alphanumeric file extension; received ${JSON.stringify(canonicalCurrent)}.`,
    );
  }
  const digest = sha256Digest(boundedNext);
  const digestHex = digest.slice("sha256:".length);
  const currentRootState = lstatIfPresent(outputRoot);
  if (currentRootState === null) {
    writeContainedFile(outputRoot, canonicalCurrent, boundedNext, {
      label: `${label} current artifact`,
      pathLabel: `${label} current artifact path`,
      maxBytes,
      exclusive: true,
      __testHooks: __testHooks?.currentWrite,
    });
    const root = assertOrdinaryDirectoryPath(outputRoot, {
      label: `${label} output root`,
    });
    verifiedContainedBytes(root, canonicalCurrent, boundedNext, {
      label: `${label} current artifact`,
      pathLabel: `${label} current artifact path`,
      maxBytes,
    });
    return Object.freeze({
      archive: null,
      bytes: boundedNext.length,
      candidate: null,
      currentPath: join(root, canonicalCurrent),
      digest,
      state: "published-current",
    });
  }

  const root = assertOrdinaryDirectoryPath(outputRoot, {
    label: `${label} output root`,
  });
  const currentPath = join(root, canonicalCurrent);
  if (lstatIfPresent(currentPath) === null) {
    writeContainedFile(root, canonicalCurrent, boundedNext, {
      label: `${label} current artifact`,
      pathLabel: `${label} current artifact path`,
      maxBytes,
      exclusive: true,
      __testHooks: __testHooks?.currentWrite,
    });
    verifiedContainedBytes(root, canonicalCurrent, boundedNext, {
      label: `${label} current artifact`,
      pathLabel: `${label} current artifact path`,
      maxBytes,
    });
    return Object.freeze({
      archive: null,
      bytes: boundedNext.length,
      candidate: null,
      currentPath,
      digest,
      state: "published-current",
    });
  }

  const currentBytes = readContainedFile(root, canonicalCurrent, {
    label: `${label} current artifact`,
    pathLabel: `${label} current artifact path`,
    maxBytes,
  });
  if (currentBytes.equals(boundedNext)) {
    verifiedContainedBytes(root, canonicalCurrent, boundedNext, {
      label: `${label} current artifact`,
      pathLabel: `${label} current artifact path`,
      maxBytes,
    });
    return Object.freeze({
      archive: null,
      bytes: boundedNext.length,
      candidate: null,
      currentPath,
      digest,
      state: "current-identical",
    });
  }

  const currentDigest = sha256Digest(currentBytes);
  const archive = archiveDifferingCurrentArtifact({
    archiveNameStem: stem,
    currentFile: canonicalCurrent,
    label,
    maxBytes,
    nextBytes: boundedNext,
    outputRoot: root,
  });
  if (archive === null || archive.digest !== currentDigest) {
    throw new Error(
      `${label} current artifact changed between observation and archival; no current artifact was overwritten.`,
    );
  }
  __testHooks?.afterArchive?.({ archive, currentPath });
  const stableBeforeCandidate = readContainedFile(root, canonicalCurrent, {
    label: `${label} current artifact before candidate publication`,
    pathLabel: `${label} current artifact path`,
    maxBytes,
  });
  if (!stableBeforeCandidate.equals(currentBytes)) {
    throw new Error(
      `${label} current artifact changed after archival; no current artifact was overwritten.`,
    );
  }

  const candidateRelativePath = `${stem}-candidate-${digestHex}${suffix}`;
  const candidate = writeOrVerifyImmutable(root, candidateRelativePath, boundedNext, {
    label: `${label} verified replacement candidate`,
    pathLabel: `${label} replacement candidate path`,
    maxBytes,
    __testHooks: __testHooks?.candidateWrite,
  });
  const stableAfterCandidate = readContainedFile(root, canonicalCurrent, {
    label: `${label} current artifact after candidate publication`,
    pathLabel: `${label} current artifact path`,
    maxBytes,
  });
  if (!stableAfterCandidate.equals(currentBytes)) {
    throw new Error(
      `${label} current artifact changed while its candidate was published; no current artifact was overwritten.`,
    );
  }
  return Object.freeze({
    archive,
    bytes: boundedNext.length,
    candidate: Object.freeze({
      ...candidate,
      relativePath: candidateRelativePath,
    }),
    currentPath,
    digest,
    state: "review-required",
  });
}
