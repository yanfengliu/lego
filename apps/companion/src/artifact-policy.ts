import { createHash } from "node:crypto";

import { validateArtifactRefV1, type ArtifactRefV1 } from "@lego-studio/protocol";

export const HASH_PREFIX = "sha256:";
export const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/;
const MEBIBYTE = 1024 * 1024;
const DEFAULT_MAX_ARTIFACT_BYTE_LENGTH = 64 * MEBIBYTE;
const DEFAULT_MAX_IN_FLIGHT_BYTE_LENGTH = 128 * MEBIBYTE;
const DEFAULT_MAX_CONCURRENT_OPERATIONS = 8;
const DEFAULT_MAX_QUEUED_OPERATIONS = 32;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const UINT8_ARRAY_SET = Uint8Array.prototype.set;

function typedArrayByteLengthGetter(): (this: Uint8Array) => number {
  const getter = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength")?.get;
  if (!getter) {
    throw new Error("The supported Node runtime must expose the intrinsic typed-array byte length");
  }
  return getter as (this: Uint8Array) => number;
}

const TYPED_ARRAY_BYTE_LENGTH_GETTER = typedArrayByteLengthGetter();

const ARTIFACT_KINDS = Object.freeze([
  "input",
  "program",
  "patch",
  "document",
  "validation",
  "render",
  "critique",
  "metrics",
  "transcript",
  "source",
  "bundle",
  "report",
  "export",
] as const satisfies readonly ArtifactRefV1["kind"][]);

export const ARTIFACT_POLICY = Object.freeze({
  maxByteLength: DEFAULT_MAX_ARTIFACT_BYTE_LENGTH,
  maxInFlightByteLength: DEFAULT_MAX_IN_FLIGHT_BYTE_LENGTH,
  maxConcurrentOperations: DEFAULT_MAX_CONCURRENT_OPERATIONS,
  maxQueuedOperations: DEFAULT_MAX_QUEUED_OPERATIONS,
  maxIdentifierLength: 128,
  minMediaTypeLength: 3,
  maxMediaTypeLength: 128,
  kinds: ARTIFACT_KINDS,
});

export type ArtifactStoreErrorCode =
  | "INVALID_ROOT"
  | "ROOT_NOT_OWNED"
  | "INVALID_METADATA"
  | "ARTIFACT_TOO_LARGE"
  | "ARTIFACT_MISSING"
  | "ARTIFACT_INTEGRITY"
  | "UNSAFE_PATH"
  | "STORE_BUSY"
  | "FINALIZATION_FAILED";

export class ArtifactStoreError extends Error {
  readonly code: ArtifactStoreErrorCode;

  constructor(code: ArtifactStoreErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ArtifactStoreError";
    this.code = code;
  }
}

export interface ArtifactStoreOptions {
  readonly root: string;
  readonly maxByteLength?: number;
  readonly maxInFlightByteLength?: number;
  readonly maxConcurrentOperations?: number;
  readonly maxQueuedOperations?: number;
}

export interface PutArtifactInput {
  readonly artifactId: string;
  readonly kind: ArtifactRefV1["kind"];
  readonly mediaType: string;
  readonly bytes: Uint8Array;
}

export interface ArtifactStore {
  put(input: PutArtifactInput): Promise<ArtifactRefV1>;
  read(reference: ArtifactRefV1): Promise<Uint8Array>;
}

export interface NormalizedPut {
  readonly artifactId: string;
  readonly kind: ArtifactRefV1["kind"];
  readonly mediaType: string;
  readonly bytes: Buffer;
  readonly sha256: `sha256:${string}`;
}

export interface PreparedPut {
  readonly artifactId: string;
  readonly kind: ArtifactRefV1["kind"];
  readonly mediaType: string;
  readonly sourceBytes: Uint8Array;
  readonly byteLength: number;
  readonly sha256: `sha256:${string}`;
}

function exactDataRecord(value: unknown, expectedKeys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ArtifactStoreError("INVALID_METADATA", "Artifact metadata must be a plain object");
  }
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    throw new ArtifactStoreError("INVALID_METADATA", "Artifact metadata cannot be inspected", {
      cause: error,
    });
  }
  if (prototype !== Object.prototype) {
    throw new ArtifactStoreError("INVALID_METADATA", "Artifact metadata must be a plain object");
  }
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new ArtifactStoreError("INVALID_METADATA", "Artifact metadata contains symbol keys");
  }
  const keys = (ownKeys as string[]).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new ArtifactStoreError(
      "INVALID_METADATA",
      "Artifact metadata has unknown or missing fields",
    );
  }
  if (keys.some((key) => !("value" in descriptors[key]!))) {
    throw new ArtifactStoreError("INVALID_METADATA", "Artifact metadata cannot contain accessors");
  }
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of keys) snapshot[key] = descriptors[key]!.value;
  return snapshot;
}

function intrinsicByteLength(bytes: Uint8Array): number {
  try {
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, bytes, []) as unknown;
    if (!Number.isSafeInteger(byteLength) || (byteLength as number) < 0) {
      throw new TypeError("Typed-array byte length is invalid");
    }
    return byteLength as number;
  } catch (error) {
    throw new ArtifactStoreError("INVALID_METADATA", "Artifact bytes cannot be inspected", {
      cause: error,
    });
  }
}

function contentHash(bytes: Uint8Array): `sha256:${string}` {
  return `${HASH_PREFIX}${createHash("sha256").update(bytes).digest("hex")}`;
}

export function preparePut(value: unknown, maxByteLength: number): PreparedPut {
  const record = exactDataRecord(value, ["artifactId", "kind", "mediaType", "bytes"]);
  const bytes = record.bytes;
  if (
    typeof record.artifactId !== "string" ||
    record.artifactId.length > ARTIFACT_POLICY.maxIdentifierLength ||
    !IDENTIFIER_PATTERN.test(record.artifactId) ||
    !ARTIFACT_KINDS.includes(record.kind as ArtifactRefV1["kind"]) ||
    typeof record.mediaType !== "string" ||
    record.mediaType.length < ARTIFACT_POLICY.minMediaTypeLength ||
    record.mediaType.length > ARTIFACT_POLICY.maxMediaTypeLength ||
    !MEDIA_TYPE_PATTERN.test(record.mediaType) ||
    !ArrayBuffer.isView(bytes) ||
    !(bytes instanceof Uint8Array)
  ) {
    throw new ArtifactStoreError(
      "INVALID_METADATA",
      "Artifact input violates ArtifactRefV1 policy",
    );
  }
  const byteLength = intrinsicByteLength(bytes);
  if (byteLength > maxByteLength) {
    throw new ArtifactStoreError("ARTIFACT_TOO_LARGE", "Artifact exceeds the configured byte cap");
  }
  return Object.freeze({
    artifactId: record.artifactId,
    kind: record.kind as ArtifactRefV1["kind"],
    mediaType: record.mediaType,
    sourceBytes: bytes,
    byteLength,
    sha256: contentHash(bytes),
  });
}

export function materializePut(input: PreparedPut): NormalizedPut {
  if (intrinsicByteLength(input.sourceBytes) !== input.byteLength) {
    throw new ArtifactStoreError("INVALID_METADATA", "Artifact bytes changed size before copying");
  }
  const bytes = Buffer.alloc(input.byteLength);
  try {
    Reflect.apply(UINT8_ARRAY_SET, bytes, [input.sourceBytes]);
  } catch (error) {
    throw new ArtifactStoreError("INVALID_METADATA", "Artifact bytes could not be copied", {
      cause: error,
    });
  }
  if (intrinsicByteLength(input.sourceBytes) !== input.byteLength) {
    throw new ArtifactStoreError("INVALID_METADATA", "Artifact bytes changed size while copying");
  }
  const sha256 = contentHash(bytes);
  if (sha256 !== input.sha256) {
    throw new ArtifactStoreError("INVALID_METADATA", "Artifact bytes changed while queued");
  }
  return {
    artifactId: input.artifactId,
    kind: input.kind,
    mediaType: input.mediaType,
    bytes,
    sha256,
  };
}

export function normalizePut(value: unknown, maxByteLength: number): NormalizedPut {
  return materializePut(preparePut(value, maxByteLength));
}

export function normalizeReference(value: unknown, maxByteLength: number): ArtifactRefV1 {
  const record = exactDataRecord(value, [
    "artifactId",
    "kind",
    "mediaType",
    "sha256",
    "byteLength",
    "casKey",
  ]);
  const snapshot = {
    artifactId: record.artifactId,
    kind: record.kind,
    mediaType: record.mediaType,
    sha256: record.sha256,
    byteLength: record.byteLength,
    casKey: record.casKey,
  };
  if (!validateArtifactRefV1(snapshot)) {
    throw new ArtifactStoreError(
      "INVALID_METADATA",
      "Artifact reference violates ArtifactRefV1 policy",
    );
  }
  if (snapshot.byteLength > maxByteLength) {
    throw new ArtifactStoreError(
      "ARTIFACT_TOO_LARGE",
      "Artifact reference exceeds the store byte cap",
    );
  }
  return Object.freeze(snapshot);
}

export function referenceFor(input: NormalizedPut): ArtifactRefV1 {
  return normalizeReference(
    {
      artifactId: input.artifactId,
      kind: input.kind,
      mediaType: input.mediaType,
      sha256: input.sha256,
      byteLength: input.bytes.byteLength,
      casKey: input.sha256,
    },
    ARTIFACT_POLICY.maxByteLength,
  );
}
