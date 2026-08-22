import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_DEPTH,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_VALUES,
} from "./real-build-compiled-placement-lineage-types";

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "length")?.get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const TYPED_ARRAY_TAG = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const SHARED_BYTE_LENGTH =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;

export interface RealBuildCompiledPlacementLineageWireInspection {
  readonly value: unknown;
  readonly bytesDigest: Sha256Digest;
}

function snapshotCompiledLineageBytes(value: unknown, maximumBytes: number): Uint8Array {
  if (
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes < 1 ||
    maximumBytes > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES
  ) {
    throw new RangeError(
      `Compiled lineage maximumBytes must be 1 through ${MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES}.`,
    );
  }
  let length: number;
  let buffer: ArrayBufferLike;
  let tag: string;
  try {
    if (
      TYPED_ARRAY_LENGTH === undefined ||
      TYPED_ARRAY_BUFFER === undefined ||
      TYPED_ARRAY_TAG === undefined
    ) {
      throw null;
    }
    length = TYPED_ARRAY_LENGTH.call(value) as number;
    buffer = TYPED_ARRAY_BUFFER.call(value) as ArrayBufferLike;
    tag = TYPED_ARRAY_TAG.call(value) as string;
  } catch {
    throw new TypeError("Compiled lineage wire input must be a genuine Uint8Array.");
  }
  if (tag !== "Uint8Array") {
    throw new TypeError("Compiled lineage wire input must be a genuine Uint8Array.");
  }
  if (length > maximumBytes) {
    throw new RangeError(
      `Compiled lineage wire input contains ${length} bytes above maximumBytes ${maximumBytes}; no text was decoded or parsed.`,
    );
  }
  if (SHARED_BYTE_LENGTH !== undefined) {
    let shared = false;
    try {
      SHARED_BYTE_LENGTH.call(buffer);
      shared = true;
    } catch {
      // Ordinary ArrayBuffer storage rejects the SharedArrayBuffer intrinsic.
    }
    if (shared) {
      throw new TypeError(
        "Compiled lineage wire input cannot use concurrently mutable SharedArrayBuffer storage.",
      );
    }
  }
  const snapshot = new Uint8Array(length);
  try {
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
  } catch {
    throw new TypeError("Compiled lineage wire bytes changed or detached during bounded copying.");
  }
  return snapshot;
}

/** Conservatively bounds hostile JSON expansion before JSON.parse allocates it. */
function requireBoundedCompiledLineageJson(text: string): void {
  let depth = 0;
  let values = 1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{" || character === "[") {
      depth += 1;
      values += 1;
      if (depth > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_DEPTH) {
        throw new RangeError(
          `Compiled lineage wire JSON exceeds depth ${MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_DEPTH} before parsing.`,
        );
      }
    } else if (character === "}" || character === "]") depth -= 1;
    else if (character === ",") values += 1;
    if (values > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_VALUES) {
      throw new RangeError(
        `Compiled lineage wire JSON exceeds ${MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_VALUES} structural values before parsing.`,
      );
    }
  }
}

/** External trust boundary: snapshots, bounds, decodes, and parses without semantic replay. */
export function inspectRealBuildCompiledPlacementLineageWire(
  value: unknown,
  maximumBytes = MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
): RealBuildCompiledPlacementLineageWireInspection {
  const bytes = snapshotCompiledLineageBytes(value, maximumBytes);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError("Compiled lineage wire input is not well-formed UTF-8.");
  }
  requireBoundedCompiledLineageJson(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError("Compiled lineage wire input is not valid JSON.");
  }
  return Object.freeze({
    value: parsed,
    bytesDigest: `sha256:${sha256Hex(bytes)}` as Sha256Digest,
  });
}
