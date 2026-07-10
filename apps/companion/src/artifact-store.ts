import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm, type FileHandle } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import type { ArtifactRefV1 } from "@lego-studio/protocol";

import { ArtifactAdmission, type AdmissionLimits } from "./artifact-admission.ts";
import {
  ARTIFACT_POLICY,
  ArtifactStoreError,
  HASH_PATTERN,
  HASH_PREFIX,
  materializePut,
  normalizeReference,
  preparePut,
  referenceFor,
  type ArtifactStore,
  type ArtifactStoreErrorCode,
  type ArtifactStoreOptions,
  type PutArtifactInput,
} from "./artifact-policy.ts";

const STORE_MARKER_NAME = ".lego-artifact-store-v1";
const STORE_MARKER_BYTES = Buffer.from("lego.companion.artifact-store/1\n", "utf8");
const OBJECTS_DIRECTORY_NAME = "objects";
const PAYLOAD_NAME = "payload";
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;

type RenamePath = (from: string, to: string) => Promise<void>;

function filesystemCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

function samePath(left: string, right: string): boolean {
  return relative(left, right) === "" && relative(right, left) === "";
}

function assertInside(root: string, candidate: string): void {
  const relation = relative(root, candidate);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) return;
  throw new ArtifactStoreError("UNSAFE_PATH", "Derived artifact path escaped the owned root");
}

async function linkStats(path: string): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  try {
    return await lstat(path);
  } catch (error) {
    if (filesystemCode(error) === "ENOENT") return null;
    throw error;
  }
}

async function assertSafeDirectory(
  path: string,
  missingCode: ArtifactStoreErrorCode,
): Promise<void> {
  const stats = await linkStats(path);
  if (!stats) throw new ArtifactStoreError(missingCode, `Required directory is missing: ${path}`);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new ArtifactStoreError("UNSAFE_PATH", `Expected a real directory: ${path}`);
  }
  const canonical = await realpath(path);
  if (!samePath(resolve(path), resolve(canonical))) {
    throw new ArtifactStoreError("UNSAFE_PATH", `Directory traverses a symbolic link: ${path}`);
  }
}

async function openNoFollow(path: string, flags: number, mode?: number): Promise<FileHandle> {
  try {
    return await open(path, flags | NO_FOLLOW, mode);
  } catch (error) {
    if (filesystemCode(error) === "ELOOP") {
      throw new ArtifactStoreError("UNSAFE_PATH", `Refused symbolic-link file: ${path}`, {
        cause: error,
      });
    }
    throw error;
  }
}

async function writeSyncedFile(path: string, bytes: Uint8Array): Promise<void> {
  const handle = await openNoFollow(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600,
  );
  try {
    let offset = 0;
    while (offset < bytes.byteLength) {
      const { bytesWritten } = await handle.write(bytes, offset, bytes.byteLength - offset, offset);
      if (bytesWritten === 0) throw new Error("Artifact write made no progress");
      offset += bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function verifyMarker(root: string): Promise<void> {
  const marker = join(root, STORE_MARKER_NAME);
  const markerStats = await linkStats(marker);
  if (!markerStats || markerStats.isSymbolicLink() || !markerStats.isFile()) {
    throw new ArtifactStoreError("ROOT_NOT_OWNED", "Artifact root lacks its ownership marker");
  }
  if (markerStats.size !== STORE_MARKER_BYTES.byteLength) {
    throw new ArtifactStoreError("ROOT_NOT_OWNED", "Artifact root marker has invalid bytes");
  }
  const handle = await openNoFollow(marker, constants.O_RDONLY);
  try {
    const bytes = Buffer.alloc(STORE_MARKER_BYTES.byteLength);
    const { bytesRead } = await handle.read(bytes, 0, bytes.byteLength, 0);
    if (bytesRead !== bytes.byteLength || !bytes.equals(STORE_MARKER_BYTES)) {
      throw new ArtifactStoreError("ROOT_NOT_OWNED", "Artifact root marker has invalid bytes");
    }
  } finally {
    await handle.close();
  }
}

async function verifyOwnedRoot(root: string): Promise<void> {
  await assertSafeDirectory(root, "ROOT_NOT_OWNED");
  await verifyMarker(root);
  await assertSafeDirectory(join(root, OBJECTS_DIRECTORY_NAME), "ROOT_NOT_OWNED");
}

async function initializeOwnedRoot(root: string, renamePath: RenamePath): Promise<void> {
  const existing = await linkStats(root);
  if (existing) {
    await verifyOwnedRoot(root);
    return;
  }

  const parent = dirname(root);
  await assertSafeDirectory(parent, "INVALID_ROOT");
  const staging = join(parent, `.${basename(root)}.${randomUUID()}.init.tmp`);
  let failure: unknown;
  try {
    await mkdir(staging, { mode: 0o700 });
    const markerTemp = join(staging, `${STORE_MARKER_NAME}.tmp`);
    await writeSyncedFile(markerTemp, STORE_MARKER_BYTES);
    await renamePath(markerTemp, join(staging, STORE_MARKER_NAME));
    await mkdir(join(staging, OBJECTS_DIRECTORY_NAME), { mode: 0o700 });
    await renamePath(staging, root);
  } catch (error) {
    failure = error;
  }

  try {
    await rm(staging, { recursive: true, force: true });
  } catch (cleanupError) {
    throw new ArtifactStoreError(
      "FINALIZATION_FAILED",
      "Artifact-root initialization failed and staging cleanup was incomplete",
      { cause: cleanupError },
    );
  }
  if (failure && !(await linkStats(root))) {
    throw new ArtifactStoreError("FINALIZATION_FAILED", "Could not initialize artifact root", {
      cause: failure,
    });
  }
  await verifyOwnedRoot(root);
}

class FileArtifactStore implements ArtifactStore {
  readonly #root: string;
  readonly #objects: string;
  readonly #maxByteLength: number;
  readonly #admission: ArtifactAdmission;
  readonly #renamePath: RenamePath;

  constructor(
    root: string,
    maxByteLength: number,
    admissionLimits: AdmissionLimits,
    renamePath: RenamePath,
  ) {
    this.#root = root;
    this.#objects = join(root, OBJECTS_DIRECTORY_NAME);
    this.#maxByteLength = maxByteLength;
    this.#admission = new ArtifactAdmission(admissionLimits);
    this.#renamePath = renamePath;
  }

  async put(value: PutArtifactInput): Promise<ArtifactRefV1> {
    const prepared = preparePut(value, this.#maxByteLength);
    const admission = this.#admission.acquire(prepared.byteLength);
    const release = typeof admission === "function" ? admission : await admission;
    try {
      const input = materializePut(prepared);
      const reference = referenceFor(input);
      await verifyOwnedRoot(this.#root);
      const { finalDirectory, shard } = await this.#pathsForPut(reference.casKey);
      if (await linkStats(finalDirectory)) {
        await this.#verifySameBytes(reference, input.bytes);
        return reference;
      }

      const staging = join(
        shard,
        `.tmp-${reference.sha256.slice(HASH_PREFIX.length)}-${randomUUID()}`,
      );
      assertInside(this.#root, staging);
      let failure: unknown;
      try {
        await mkdir(staging, { mode: 0o700 });
        const temporaryPayload = join(staging, `${PAYLOAD_NAME}.tmp`);
        await writeSyncedFile(temporaryPayload, input.bytes);
        await this.#renamePath(temporaryPayload, join(staging, PAYLOAD_NAME));
        await this.#renamePath(staging, finalDirectory);
      } catch (error) {
        failure = error;
      }

      try {
        await rm(staging, { recursive: true, force: true });
      } catch (cleanupError) {
        throw new ArtifactStoreError(
          "FINALIZATION_FAILED",
          "Artifact finalization failed and staging cleanup was incomplete",
          { cause: cleanupError },
        );
      }
      if (failure && !(await linkStats(finalDirectory))) {
        throw new ArtifactStoreError("FINALIZATION_FAILED", "Atomic artifact finalization failed", {
          cause: failure,
        });
      }
      await this.#verifySameBytes(reference, input.bytes);
      return reference;
    } finally {
      release();
    }
  }

  async read(value: ArtifactRefV1): Promise<Uint8Array> {
    const reference = normalizeReference(value, this.#maxByteLength);
    const admission = this.#admission.acquire(reference.byteLength);
    const release = typeof admission === "function" ? admission : await admission;
    try {
      await verifyOwnedRoot(this.#root);
      const bytes = await this.#readVerified(reference);
      return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    } finally {
      release();
    }
  }

  async #pathsForPut(casKey: string): Promise<{ shard: string; finalDirectory: string }> {
    if (!HASH_PATTERN.test(casKey)) {
      throw new ArtifactStoreError("INVALID_METADATA", "CAS key is not a SHA-256 digest");
    }
    const digest = casKey.slice(HASH_PREFIX.length);
    const shard = join(this.#objects, digest.slice(0, 2));
    assertInside(this.#root, shard);
    if (!(await linkStats(shard))) {
      try {
        await mkdir(shard, { mode: 0o700 });
      } catch (error) {
        if (filesystemCode(error) !== "EEXIST") throw error;
      }
    }
    await assertSafeDirectory(shard, "ROOT_NOT_OWNED");
    const finalDirectory = join(shard, digest);
    assertInside(this.#root, finalDirectory);
    return { shard, finalDirectory };
  }

  #pathsForRead(casKey: string): { shard: string; finalDirectory: string } {
    if (!HASH_PATTERN.test(casKey)) {
      throw new ArtifactStoreError("INVALID_METADATA", "CAS key is not a SHA-256 digest");
    }
    const digest = casKey.slice(HASH_PREFIX.length);
    const shard = join(this.#objects, digest.slice(0, 2));
    const finalDirectory = join(shard, digest);
    assertInside(this.#root, shard);
    assertInside(this.#root, finalDirectory);
    return { shard, finalDirectory };
  }

  async #verifySameBytes(reference: ArtifactRefV1, expected: Uint8Array): Promise<void> {
    const stored = await this.#readVerified(reference);
    if (!stored.equals(expected)) {
      throw new ArtifactStoreError(
        "ARTIFACT_INTEGRITY",
        "Existing CAS object does not contain the submitted bytes",
      );
    }
  }

  async #readVerified(reference: ArtifactRefV1): Promise<Buffer> {
    const { shard, finalDirectory } = this.#pathsForRead(reference.casKey);
    if (!(await linkStats(shard))) {
      throw new ArtifactStoreError("ARTIFACT_MISSING", `Artifact is missing: ${reference.casKey}`);
    }
    await assertSafeDirectory(shard, "ARTIFACT_MISSING");
    if (!(await linkStats(finalDirectory))) {
      throw new ArtifactStoreError("ARTIFACT_MISSING", `Artifact is missing: ${reference.casKey}`);
    }
    await assertSafeDirectory(finalDirectory, "ARTIFACT_MISSING");
    const payload = join(finalDirectory, PAYLOAD_NAME);
    const payloadStats = await linkStats(payload);
    if (!payloadStats) {
      throw new ArtifactStoreError("ARTIFACT_MISSING", `Artifact is missing: ${reference.casKey}`);
    }
    if (payloadStats.isSymbolicLink() || !payloadStats.isFile()) {
      throw new ArtifactStoreError("UNSAFE_PATH", "Artifact payload is not a real file");
    }

    let handle: FileHandle;
    try {
      handle = await openNoFollow(payload, constants.O_RDONLY);
    } catch (error) {
      if (filesystemCode(error) === "ENOENT") {
        throw new ArtifactStoreError(
          "ARTIFACT_MISSING",
          `Artifact is missing: ${reference.casKey}`,
        );
      }
      throw error;
    }
    try {
      const openedStats = await handle.stat();
      if (!openedStats.isFile() || openedStats.size !== reference.byteLength) {
        throw new ArtifactStoreError("ARTIFACT_INTEGRITY", "Artifact byte length is inconsistent");
      }
      const bytes = Buffer.alloc(reference.byteLength);
      const hash = createHash("sha256");
      let offset = 0;
      while (offset < bytes.byteLength) {
        const length = Math.min(64 * 1024, bytes.byteLength - offset);
        const { bytesRead } = await handle.read(bytes, offset, length, offset);
        if (bytesRead === 0) {
          throw new ArtifactStoreError("ARTIFACT_INTEGRITY", "Artifact was truncated during read");
        }
        hash.update(bytes.subarray(offset, offset + bytesRead));
        offset += bytesRead;
      }
      const extra = Buffer.allocUnsafe(1);
      if ((await handle.read(extra, 0, 1, offset)).bytesRead !== 0) {
        throw new ArtifactStoreError("ARTIFACT_INTEGRITY", "Artifact grew beyond its byte bound");
      }
      if ((await handle.stat()).size !== reference.byteLength) {
        throw new ArtifactStoreError("ARTIFACT_INTEGRITY", "Artifact changed during read");
      }
      const actualHash = `${HASH_PREFIX}${hash.digest("hex")}`;
      if (actualHash !== reference.sha256) {
        throw new ArtifactStoreError("ARTIFACT_INTEGRITY", "Artifact content hash is inconsistent");
      }
      return bytes;
    } finally {
      await handle.close();
    }
  }
}

interface NormalizedStoreOptions extends AdmissionLimits {
  readonly root: string;
  readonly maxByteLength: number;
}

function normalizeOptions(options: ArtifactStoreOptions): NormalizedStoreOptions {
  if (typeof options !== "object" || options === null) {
    throw new ArtifactStoreError("INVALID_ROOT", "Artifact root must be an explicit absolute path");
  }
  const root = options.root;
  if (typeof root !== "string" || root.includes("\0") || !isAbsolute(root)) {
    throw new ArtifactStoreError("INVALID_ROOT", "Artifact root must be an explicit absolute path");
  }
  const maxByteLength = options.maxByteLength ?? ARTIFACT_POLICY.maxByteLength;
  if (
    !Number.isSafeInteger(maxByteLength) ||
    maxByteLength < 0 ||
    maxByteLength > ARTIFACT_POLICY.maxByteLength
  ) {
    throw new ArtifactStoreError(
      "INVALID_ROOT",
      "Artifact byte cap is outside ArtifactRefV1 policy",
    );
  }
  const maxInFlightByteLength =
    options.maxInFlightByteLength ?? ARTIFACT_POLICY.maxInFlightByteLength;
  if (
    !Number.isSafeInteger(maxInFlightByteLength) ||
    maxInFlightByteLength < maxByteLength ||
    maxInFlightByteLength > ARTIFACT_POLICY.maxInFlightByteLength
  ) {
    throw new ArtifactStoreError(
      "INVALID_ROOT",
      "Artifact in-flight byte budget must cover one allowed artifact and stay within policy",
    );
  }
  const maxConcurrentOperations =
    options.maxConcurrentOperations ?? ARTIFACT_POLICY.maxConcurrentOperations;
  if (
    !Number.isSafeInteger(maxConcurrentOperations) ||
    maxConcurrentOperations < 1 ||
    maxConcurrentOperations > ARTIFACT_POLICY.maxConcurrentOperations
  ) {
    throw new ArtifactStoreError(
      "INVALID_ROOT",
      "Artifact concurrent-operation limit is outside policy",
    );
  }
  const maxQueuedOperations = options.maxQueuedOperations ?? ARTIFACT_POLICY.maxQueuedOperations;
  if (
    !Number.isSafeInteger(maxQueuedOperations) ||
    maxQueuedOperations < 0 ||
    maxQueuedOperations > ARTIFACT_POLICY.maxQueuedOperations
  ) {
    throw new ArtifactStoreError("INVALID_ROOT", "Artifact queue limit is outside policy");
  }
  return {
    root: resolve(root),
    maxByteLength,
    maxInFlightByteLength,
    maxConcurrentOperations,
    maxQueuedOperations,
  };
}

async function openWithRename(
  options: ArtifactStoreOptions,
  renamePath: RenamePath,
): Promise<ArtifactStore> {
  const normalized = normalizeOptions(options);
  await initializeOwnedRoot(normalized.root, renamePath);
  return new FileArtifactStore(
    normalized.root,
    normalized.maxByteLength,
    {
      maxInFlightByteLength: normalized.maxInFlightByteLength,
      maxConcurrentOperations: normalized.maxConcurrentOperations,
      maxQueuedOperations: normalized.maxQueuedOperations,
    },
    renamePath,
  );
}

export async function openArtifactStore(options: ArtifactStoreOptions): Promise<ArtifactStore> {
  return openWithRename(options, rename);
}

/** @internal Test-only failure injection; intentionally omitted from the package export. */
export async function openArtifactStoreForTesting(
  options: ArtifactStoreOptions,
  renamePath: RenamePath,
): Promise<ArtifactStore> {
  return openWithRename(options, renamePath);
}
