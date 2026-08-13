import { parseDetachedRealBuildLineageEvidence } from "./real-build-lineage-evidence-parser";
import {
  DEFAULT_REAL_BUILD_LINEAGE_EVIDENCE_MAXIMUM_ATTEMPTS,
  MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_BYTES,
  MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_JSON_DEPTH,
  MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_JSON_NODES,
  type RealBuildLineageEvidence,
} from "./real-build-lineage-evidence-types";

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "length")?.get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const SHARED_BYTE_LENGTH =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;

function snapshotWireBytes(value: unknown, maximumBytes: number): Uint8Array {
  if (
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes < 1 ||
    maximumBytes > MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_BYTES
  ) {
    throw new RangeError(
      `Lineage evidence maximumBytes must be a safe integer from 1 through ${MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_BYTES}.`,
    );
  }
  let length: number;
  let buffer: ArrayBufferLike;
  try {
    if (TYPED_ARRAY_LENGTH === undefined || TYPED_ARRAY_BUFFER === undefined) throw null;
    length = TYPED_ARRAY_LENGTH.call(value) as number;
    buffer = TYPED_ARRAY_BUFFER.call(value) as ArrayBufferLike;
  } catch {
    throw new TypeError(`Lineage evidence wire input must be a genuine Uint8Array.`);
  }
  if (length > maximumBytes) {
    throw new RangeError(
      `Lineage evidence wire input contains ${length} bytes, exceeding maximumBytes ${maximumBytes}; no text was decoded or parsed.`,
    );
  }
  if (SHARED_BYTE_LENGTH !== undefined) {
    let shared = false;
    try {
      SHARED_BYTE_LENGTH.call(buffer);
      shared = true;
    } catch {
      // An ordinary ArrayBuffer is expected to reject the SharedArrayBuffer intrinsic.
    }
    if (shared) {
      throw new TypeError(
        `Lineage evidence wire input must not use concurrently mutable SharedArrayBuffer storage.`,
      );
    }
  }
  const snapshot = new Uint8Array(length);
  try {
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
  } catch {
    throw new TypeError(`Lineage evidence wire bytes changed or detached during bounded copying.`);
  }
  return snapshot;
}

/** Bounds unknown JSON expansion before `JSON.parse` allocates it. */
function requireBoundedWireJsonStructure(text: string): void {
  let depth = 0;
  let nodes = 1;
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
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{" || character === "[") {
      depth += 1;
      nodes += 1;
      if (depth > MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_JSON_DEPTH) {
        throw new RangeError(
          `Lineage evidence wire JSON exceeds depth ${MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_JSON_DEPTH} before parsing; flatten or remove the nested unknown data.`,
        );
      }
    } else if (character === "}" || character === "]") {
      depth -= 1;
    } else if (character === ",") {
      nodes += 1;
    }
    if (nodes > MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_JSON_NODES) {
      throw new RangeError(
        `Lineage evidence wire JSON exceeds ${MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_JSON_NODES} structural values before parsing; remove unknown expansion or split the evidence within its attempt budget.`,
      );
    }
  }
}

/** External trust boundary: only bounded immutable UTF-8 JSON bytes are accepted. */
export function parseRealBuildLineageEvidence(
  value: unknown,
  maximumAttempts = DEFAULT_REAL_BUILD_LINEAGE_EVIDENCE_MAXIMUM_ATTEMPTS,
  maximumBytes = MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_BYTES,
): RealBuildLineageEvidence {
  const bytes = snapshotWireBytes(value, maximumBytes);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError(`Lineage evidence wire input is not well-formed UTF-8.`);
  }
  requireBoundedWireJsonStructure(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError(`Lineage evidence wire input is not valid JSON.`);
  }
  return parseDetachedRealBuildLineageEvidence(parsed, maximumAttempts);
}
