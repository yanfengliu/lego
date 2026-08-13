import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES } from "./real-build-compiled-placement-lineage-types";

export interface RealBuildAtomicCompiledBranchEvidenceWire {
  readonly encoding: "base64";
  readonly byteLength: number;
  readonly digest: Sha256Digest;
  readonly data: string;
}

const MAXIMUM_BASE64_LENGTH = Math.ceil(MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES / 3) * 4;

function ownData(value: object, key: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`Atomic compiled evidence wire.${key} could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`Atomic compiled evidence wire.${key} must be an own data property.`);
  }
  return descriptor.value;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))),
    );
  }
  return btoa(chunks.join(""));
}

export function createRealBuildAtomicCompiledBranchEvidenceWire(
  bytes: Uint8Array,
): RealBuildAtomicCompiledBranchEvidenceWire {
  if (bytes.byteLength > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES) {
    throw new RangeError(
      `Atomic compiled evidence contains ${bytes.byteLength} bytes above ${MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES}.`,
    );
  }
  return Object.freeze({
    encoding: "base64",
    byteLength: bytes.byteLength,
    digest: `sha256:${sha256Hex(bytes)}`,
    data: bytesToBase64(bytes),
  });
}

/** Validates the immutable descriptor and returns new mutable storage on every call. */
export function decodeRealBuildAtomicCompiledBranchEvidenceWire(value: unknown): Uint8Array {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Atomic compiled evidence wire must be an exact data object.");
  }
  let keys: string[];
  try {
    keys = Object.keys(value);
  } catch {
    throw new TypeError("Atomic compiled evidence wire keys could not be inspected safely.");
  }
  if (
    keys.length !== 4 ||
    !["encoding", "byteLength", "digest", "data"].every((key) => keys.includes(key))
  ) {
    throw new TypeError("Atomic compiled evidence wire must contain exactly four protocol fields.");
  }
  if (ownData(value, "encoding") !== "base64") {
    throw new TypeError("Atomic compiled evidence wire.encoding must be base64.");
  }
  const byteLength = ownData(value, "byteLength");
  const digest = ownData(value, "digest");
  const data = ownData(value, "data");
  if (
    !Number.isSafeInteger(byteLength) ||
    (byteLength as number) < 0 ||
    (byteLength as number) > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES
  ) {
    throw new RangeError("Atomic compiled evidence wire.byteLength is outside its exact bound.");
  }
  if (typeof digest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(digest)) {
    throw new TypeError("Atomic compiled evidence wire.digest must be one sha256 digest.");
  }
  if (
    typeof data !== "string" ||
    data.length > MAXIMUM_BASE64_LENGTH ||
    data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(data)
  ) {
    throw new TypeError("Atomic compiled evidence wire.data must be bounded canonical base64.");
  }
  let binary: string;
  try {
    binary = atob(data);
  } catch {
    throw new TypeError("Atomic compiled evidence wire.data is not valid base64.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (
    bytes.byteLength !== byteLength ||
    bytesToBase64(bytes) !== data ||
    `sha256:${sha256Hex(bytes)}` !== digest
  ) {
    throw new TypeError(
      "Atomic compiled evidence wire does not reproduce its canonical base64, length, and digest.",
    );
  }
  return bytes;
}
