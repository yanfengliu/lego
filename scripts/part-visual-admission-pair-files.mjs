import { closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname } from "node:path";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function identity(stats, label) {
  if (
    typeof stats.dev !== "bigint" ||
    typeof stats.ino !== "bigint" ||
    stats.dev < 0n ||
    stats.ino <= 0n
  ) {
    throw new Error(
      `${label} does not expose a positive comparable inode identity. Refusing access because path replacement could not be detected.`,
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
    throw new Error(`${label} does not expose comparable size and timestamp metadata.`);
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

export function exactFile(path, maximumBytes, label, options = {}) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new RangeError(
      `${label} byte limit must be a positive safe integer; received ${JSON.stringify(maximumBytes)}.`,
    );
  }
  const pathBefore = lstatSync(path, { bigint: true });
  if (pathBefore.isSymbolicLink() || !pathBefore.isFile()) {
    throw new TypeError(`${label} is not an ordinary file: ${path}.`);
  }
  const expected = fileState(pathBefore, `${label} pre-open path`);
  options.__testHooks?.afterPathLstat?.();
  const descriptor = openSync(path, "r");
  try {
    const before = fileState(fstatSync(descriptor, { bigint: true }), `${label} descriptor`);
    if (!sameFileState(expected, before)) {
      throw new Error(
        `${label} changed identity, size, or timestamps between lstat and open: ${path}. Retry from an immutable task-owned directory.`,
      );
    }
    if (before.size < 1n || before.size > BigInt(maximumBytes)) {
      throw new RangeError(
        `${label} opened as ${before.size} bytes; allowed range is 1..${maximumBytes}: ${path}.`,
      );
    }
    const bytes = readFileSync(descriptor);
    options.__testHooks?.afterRead?.();
    const after = fileState(fstatSync(descriptor, { bigint: true }), `${label} descriptor`);
    const pathAfterStats = lstatSync(path, { bigint: true });
    if (pathAfterStats.isSymbolicLink() || !pathAfterStats.isFile()) {
      throw new Error(`${label} path became a link or non-file during its exact read: ${path}.`);
    }
    const pathAfter = fileState(pathAfterStats, `${label} post-read path`);
    if (
      bytes.length > maximumBytes ||
      BigInt(bytes.length) !== after.size ||
      !sameFileState(before, after) ||
      !sameFileState(after, pathAfter)
    ) {
      throw new Error(
        `${label} changed identity, content metadata, or size during its bounded exact read, or exceeded ${maximumBytes} bytes: ${path}.`,
      );
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

export function directoryIdentity(path, label) {
  const stats = lstatSync(path, { bigint: true });
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${label} is not an ordinary directory: ${path}.`);
  }
  return { ...identity(stats, label), realpath: realpathSync(path) };
}

export function assertDirectoryIdentity(path, expected, label, options = {}) {
  const observed = directoryIdentity(path, label);
  if (
    !sameIdentity(observed, expected) ||
    (options.allowRelocation !== true && observed.realpath !== expected.realpath)
  ) {
    const locationRequirement =
      options.allowRelocation === true
        ? "at the verified destination"
        : `at ${JSON.stringify(expected.realpath)}`;
    throw new Error(
      `${label} changed identity or resolution; expected inode ${expected.ino} ${locationRequirement}, observed inode ${observed.ino} at ${JSON.stringify(observed.realpath)}.`,
    );
  }
  return observed;
}

export function publishExpectedDirectory(input) {
  assertDirectoryIdentity(input.staging, input.expectedIdentity, input.label);
  input.__testHooks?.afterPreflight?.();
  input.renameContainedDirectoryAtomic(
    dirname(input.destination),
    basename(input.staging),
    basename(input.destination),
    input.label,
  );
  assertDirectoryIdentity(input.destination, input.expectedIdentity, `${input.label} target`, {
    allowRelocation: true,
  });
}

export function cleanupExpectedDirectory(input) {
  for (const candidate of input.candidates) {
    let observed;
    try {
      observed = directoryIdentity(candidate, `${input.label} candidate`);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (!sameIdentity(observed, input.expectedIdentity)) continue;
    input.__testHooks?.afterIdentityMatch?.(candidate);
    assertDirectoryIdentity(candidate, input.expectedIdentity, `${input.label} candidate`, {
      allowRelocation: true,
    });
    input.removeContainedDirectoryTree(dirname(candidate), basename(candidate), input.label);
    return candidate;
  }
  return null;
}

function requireObject(value, label) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError(`${label} must be a JSON object; received ${JSON.stringify(value)}.`);
  }
  return value;
}

export function verifyCaptureBatch(value, canonicalDigest) {
  const batch = requireObject(value, "Native-pair capture batch");
  if (batch.schemaVersion !== "lego.part-visual-admission-capture-batch/1") {
    throw new TypeError(
      `Native-pair capture batch schemaVersion is ${JSON.stringify(batch.schemaVersion)}; required lego.part-visual-admission-capture-batch/1.`,
    );
  }
  if (typeof batch.batchHash !== "string" || !DIGEST_PATTERN.test(batch.batchHash)) {
    throw new TypeError(
      `Native-pair capture batch batchHash is ${JSON.stringify(batch.batchHash)}; required sha256:<64 lowercase hexadecimal characters>.`,
    );
  }
  const { batchHash, ...base } = batch;
  const expectedHash = canonicalDigest(base);
  if (batchHash !== expectedHash) {
    throw new Error(
      `Native-pair capture batch hashes to ${expectedHash}, but batchHash declares ${batchHash}. Regenerate the immutable capture batch.`,
    );
  }
  if (!Array.isArray(batch.requestedPartIds)) {
    throw new TypeError(
      `Native-pair capture batch requestedPartIds is ${JSON.stringify(batch.requestedPartIds)}; required a non-empty array of at most 64 catalog ids.`,
    );
  }
  if (batch.requestedPartIds.length < 1 || batch.requestedPartIds.length > 64) {
    throw new RangeError(
      `Native-pair capture batch has ${batch.requestedPartIds.length} requestedPartIds; required 1..64.`,
    );
  }
  if (!Array.isArray(batch.packets)) {
    throw new TypeError(
      `Native-pair capture batch packets is ${JSON.stringify(batch.packets)}; required an array aligned with requestedPartIds.`,
    );
  }
  if (batch.packets.length !== batch.requestedPartIds.length) {
    throw new RangeError(
      `Native-pair capture batch has ${batch.requestedPartIds.length} requestedPartIds and ${batch.packets.length} packets; the counts must match exactly.`,
    );
  }
  return { batch, batchHash };
}

export function verifyCaptureEntry(entryValue, index, expectedCatalogPartId, seen) {
  const entry = requireObject(entryValue, `Native-pair capture entry ${index}`);
  if (typeof entry.catalogPartId !== "string") {
    throw new TypeError(
      `Native-pair capture entry ${index} catalogPartId is ${JSON.stringify(entry.catalogPartId)}; required the string ${JSON.stringify(expectedCatalogPartId)}.`,
    );
  }
  if (entry.catalogPartId !== expectedCatalogPartId) {
    throw new Error(
      `Native-pair capture entry ${index} names ${JSON.stringify(entry.catalogPartId)}, but requestedPartIds[${index}] is ${JSON.stringify(expectedCatalogPartId)}.`,
    );
  }
  if (seen.has(entry.catalogPartId)) {
    throw new Error(
      `Native-pair capture entry ${index} duplicates catalogPartId ${JSON.stringify(entry.catalogPartId)}; each requested part needs exactly one packet.`,
    );
  }
  if (
    typeof entry.packetPath !== "string" ||
    !/^runs\/[^/]+\/packet\.json$/u.test(entry.packetPath)
  ) {
    throw new TypeError(
      `Native-pair capture entry ${index} packetPath is ${JSON.stringify(entry.packetPath)}; required runs/<run-id>/packet.json.`,
    );
  }
  if (typeof entry.packetHash !== "string" || !DIGEST_PATTERN.test(entry.packetHash)) {
    throw new TypeError(
      `Native-pair capture entry ${index} packetHash is ${JSON.stringify(entry.packetHash)}; required sha256:<64 lowercase hexadecimal characters>.`,
    );
  }
  seen.add(entry.catalogPartId);
  return entry;
}

export function verifyPacketBinding(packetValue, input) {
  const packet = requireObject(packetValue, `Native-pair packet ${input.catalogPartId}`);
  if (packet.schemaVersion !== "lego.part-visual-admission-packet/1") {
    throw new TypeError(
      `Native-pair packet ${input.catalogPartId} schemaVersion is ${JSON.stringify(packet.schemaVersion)}; required lego.part-visual-admission-packet/1.`,
    );
  }
  if (packet.reviewState !== "pending") {
    throw new Error(
      `Native-pair packet ${input.catalogPartId} reviewState is ${JSON.stringify(packet.reviewState)}; required pending before review publication.`,
    );
  }
  if (packet.packetHash !== input.expectedPacketHash) {
    throw new Error(
      `Native-pair packet ${input.catalogPartId} declares packetHash ${JSON.stringify(packet.packetHash)}, but the capture batch binds ${input.expectedPacketHash}.`,
    );
  }
  const { packetHash, ...base } = packet;
  const expectedHash = input.canonicalDigest(base);
  if (packetHash !== expectedHash) {
    throw new Error(
      `Native-pair packet ${input.catalogPartId} hashes to ${expectedHash}, but declares ${JSON.stringify(packetHash)}.`,
    );
  }
  if (packet.candidate?.catalogId !== input.catalogPartId) {
    throw new Error(
      `Native-pair packet ${input.catalogPartId} candidate catalogId is ${JSON.stringify(packet.candidate?.catalogId)}; it must equal the capture entry catalog id.`,
    );
  }
  if (!Array.isArray(packet.images) || packet.images.length !== input.expectedImageCount) {
    throw new RangeError(
      `Native-pair packet ${input.catalogPartId} has ${Array.isArray(packet.images) ? packet.images.length : JSON.stringify(packet.images)} images; required exactly ${input.expectedImageCount}.`,
    );
  }
  return { packet, packetHash };
}

export function verifyPacketPngBinding(input) {
  for (const [side, image, bytes] of [
    ["source", input.source, input.sourceBytes],
    ["candidate", input.candidate, input.candidateBytes],
  ]) {
    if (image.width !== input.requiredWidth || image.height !== input.requiredHeight) {
      throw new Error(
        `Native-pair ${input.label} ${side} declares ${JSON.stringify(image.width)}x${JSON.stringify(image.height)}; required ${input.requiredWidth}x${input.requiredHeight}.`,
      );
    }
    if (image.bytes !== bytes.length) {
      throw new Error(
        `Native-pair ${input.label} ${side} declares ${JSON.stringify(image.bytes)} PNG bytes, but the retained file has ${bytes.length}.`,
      );
    }
    const observedHash = input.sha256(bytes);
    if (image.sha256 !== observedHash) {
      throw new Error(
        `Native-pair ${input.label} ${side} retained PNG hashes to ${observedHash}, but the packet declares ${JSON.stringify(image.sha256)}.`,
      );
    }
  }
}
