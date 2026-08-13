import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  packRealBuildCompiledBinaryMaskMsb,
  unpackRealBuildCompiledBinaryMaskMsb,
} from "./real-build-compiled-observation-registration";
import { snapshotObservationSourceCandidateMask } from "./real-build-observation-source-raster-candidate-input";

export const MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_MASK_PIXELS = 1_048_576;
const MAXIMUM_PACKED_BYTES = Math.ceil(MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_MASK_PIXELS / 8);
const MAXIMUM_BASE64_LENGTH = Math.ceil(MAXIMUM_PACKED_BYTES / 3) * 4;

/** Immutable, compact MSB-first transport; `unpackedDigest` names the logical 0/1 mask. */
export interface RealBuildObservationSourceRasterCandidateMask {
  readonly encoding: "packed-msb-base64/1";
  readonly pixelCount: number;
  readonly byteLength: number;
  readonly lowPaddingBits: number;
  readonly base64: string;
  readonly packedDigest: Sha256Digest;
  readonly unpackedDigest: Sha256Digest;
}

const rawDigest = (bytes: Uint8Array): Sha256Digest => `sha256:${sha256Hex(bytes)}`;

function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length))),
    );
  }
  return btoa(chunks.join(""));
}

const CANDIDATE_MASK_KEYS = [
  "base64",
  "byteLength",
  "encoding",
  "lowPaddingBits",
  "packedDigest",
  "pixelCount",
  "unpackedDigest",
] as const;
const CREATED_CANDIDATE_MASKS = new WeakSet<object>();

function snapshotCandidateMaskFields(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(
      "Observation source candidate mask must be one exact frozen ordinary data object, not a proxy or array.",
    );
  }
  // There is no browser intrinsic equivalent of Node's `util.types.isProxy` for
  // plain records. Restrict decoding to descriptors this module created: a
  // pass-through Proxy or detached lookalike misses the brand without traps.
  if (!CREATED_CANDIDATE_MASKS.has(value)) {
    throw new TypeError(
      "Observation source candidate mask must be an exact descriptor created by the current candidate module, not a proxy or detached lookalike.",
    );
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch {
    throw new TypeError("Observation source candidate mask prototype refused safe inspection.");
  }
  if (prototype !== Object.prototype) {
    throw new TypeError(
      "Observation source candidate mask must use Object.prototype so inherited state cannot alter decoding.",
    );
  }
  let descriptors: PropertyDescriptorMap;
  let frozen: boolean;
  try {
    frozen = Object.isFrozen(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new TypeError("Observation source candidate mask fields refused safe inspection.");
  }
  if (!frozen) {
    throw new TypeError("Observation source candidate mask object must be frozen before decoding.");
  }
  const ownKeys = Reflect.ownKeys(descriptors);
  if (
    ownKeys.length !== CANDIDATE_MASK_KEYS.length ||
    ownKeys.some(
      (key) =>
        typeof key !== "string" ||
        !CANDIDATE_MASK_KEYS.includes(key as (typeof CANDIDATE_MASK_KEYS)[number]),
    )
  ) {
    throw new TypeError(
      "Observation source candidate mask must contain exactly its seven packed-MSB protocol fields and no symbol or hidden fields.",
    );
  }
  const fields: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of CANDIDATE_MASK_KEYS) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      descriptor.configurable ||
      descriptor.writable ||
      !("value" in descriptor)
    ) {
      throw new TypeError(
        `Observation source candidate mask.${key} must be one frozen enumerable own data field.`,
      );
    }
    fields[key] = descriptor.value;
  }
  return Object.freeze(fields);
}

export function createRealBuildObservationSourceRasterCandidateMask(
  mask: unknown,
  width: number,
  height: number,
): RealBuildObservationSourceRasterCandidateMask {
  const pixelCount = width * height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    !Number.isSafeInteger(pixelCount) ||
    pixelCount > MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_MASK_PIXELS
  ) {
    throw new RangeError(
      `Observation source candidate mask dimensions ${String(width)}x${String(height)} must cover 1 through ${MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_MASK_PIXELS} pixels.`,
    );
  }
  const snapshot = snapshotObservationSourceCandidateMask(mask, pixelCount);
  const packed = packRealBuildCompiledBinaryMaskMsb(snapshot, width, height);
  const descriptor = Object.freeze({
    encoding: "packed-msb-base64/1",
    pixelCount,
    byteLength: packed.length,
    lowPaddingBits: (8 - (pixelCount & 7)) & 7,
    base64: bytesToBase64(packed),
    packedDigest: rawDigest(packed),
    unpackedDigest: rawDigest(snapshot),
  });
  CREATED_CANDIDATE_MASKS.add(descriptor);
  return descriptor;
}

/** Validates an immutable descriptor and returns fresh mutable unpacked storage on every call. */
export function unpackRealBuildObservationSourceRasterCandidateMask(value: unknown): Uint8Array {
  const fields = snapshotCandidateMaskFields(value);
  const encoding = fields.encoding;
  const pixelCount = fields.pixelCount;
  const byteLength = fields.byteLength;
  const lowPaddingBits = fields.lowPaddingBits;
  const base64 = fields.base64;
  const packedDigest = fields.packedDigest;
  const unpackedDigest = fields.unpackedDigest;
  if (encoding !== "packed-msb-base64/1") {
    throw new TypeError("Observation source candidate mask.encoding must be packed-msb-base64/1.");
  }
  if (
    typeof pixelCount !== "number" ||
    !Number.isSafeInteger(pixelCount) ||
    pixelCount < 1 ||
    pixelCount > MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_MASK_PIXELS
  ) {
    throw new RangeError(
      `Observation source candidate mask.pixelCount must be 1 through ${MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_MASK_PIXELS}.`,
    );
  }
  const expectedByteLength = Math.ceil(pixelCount / 8);
  const expectedLowPaddingBits = (8 - (pixelCount & 7)) & 7;
  if (byteLength !== expectedByteLength || lowPaddingBits !== expectedLowPaddingBits) {
    throw new RangeError(
      `Observation source candidate mask requires ${expectedByteLength} packed bytes and ${expectedLowPaddingBits} low padding bits for ${pixelCount} pixels.`,
    );
  }
  if (
    typeof base64 !== "string" ||
    base64.length > MAXIMUM_BASE64_LENGTH ||
    base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(base64)
  ) {
    throw new TypeError(
      "Observation source candidate mask.base64 must be bounded canonical base64.",
    );
  }
  if (
    typeof packedDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(packedDigest) ||
    typeof unpackedDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(unpackedDigest)
  ) {
    throw new TypeError(
      "Observation source candidate mask digests must be exact lowercase SHA-256 digests.",
    );
  }
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new TypeError("Observation source candidate mask.base64 is not valid base64.");
  }
  const packed = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) packed[index] = binary.charCodeAt(index);
  if (
    packed.length !== byteLength ||
    bytesToBase64(packed) !== base64 ||
    rawDigest(packed) !== packedDigest
  ) {
    throw new TypeError(
      "Observation source candidate mask does not reproduce its canonical base64, byte length, and packed digest.",
    );
  }
  const unpacked = unpackRealBuildCompiledBinaryMaskMsb(packed, pixelCount, 1);
  if (rawDigest(unpacked) !== unpackedDigest) {
    throw new TypeError(
      "Observation source candidate mask unpacked bytes do not reproduce its logical mask digest.",
    );
  }
  return unpacked;
}
