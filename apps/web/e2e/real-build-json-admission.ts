import { canonicalStringify } from "@lego-studio/brick-kernel";

import { parseStrictJsonBytes } from "../../../scripts/part-identification-strict-json.mjs";

export type RealBuildCanonicalJsonEncoding = "compact" | "pretty-one-space-line";

const TextEncoderIntrinsic = globalThis.TextEncoder;
const Uint8ArrayIntrinsic = globalThis.Uint8Array;
const textEncoder = new TextEncoderIntrinsic();
const encodeUtf8 = Function.call.bind(TextEncoderIntrinsic.prototype.encode, textEncoder);
const copyBytes = (bytes: Uint8Array): Uint8Array => new Uint8ArrayIntrinsic(bytes);

function canonicalJsonText(value: unknown, encoding: RealBuildCanonicalJsonEncoding): string {
  const compact = canonicalStringify(value);
  if (encoding === "compact") return compact;
  return `${JSON.stringify(JSON.parse(compact), null, 1)}\n`;
}

/** Returns a detached plain-JSON clone whose insertion order is canonical at every object. */
export function canonicalRealBuildJsonClone<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

/** Encodes one bounded current JSON role with a unique deterministic byte representation. */
export function encodeCanonicalRealBuildJson(
  value: unknown,
  encoding: RealBuildCanonicalJsonEncoding = "compact",
): Uint8Array {
  return encodeUtf8(canonicalJsonText(value, encoding)) as Uint8Array;
}

/** Parses exact UTF-8 finite JSON while rejecting duplicate object members. */
export function parseDuplicateFreeRealBuildJson<T>(bytes: Uint8Array, label: string): T {
  try {
    return parseStrictJsonBytes(bytes) as T;
  } catch (error) {
    throw new TypeError(
      `${label} must be duplicate-free finite UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
}

/** Rejects alternate whitespace, member ordering, escaping, and numeric spellings. */
export function assertCanonicalRealBuildJsonBytes(
  bytes: Uint8Array,
  value: unknown,
  label: string,
  encoding: RealBuildCanonicalJsonEncoding = "compact",
): void {
  const expected = encodeCanonicalRealBuildJson(value, encoding);
  const actual = copyBytes(bytes);
  let equal = expected.byteLength === actual.byteLength;
  for (let index = 0; equal && index < expected.byteLength; index += 1) {
    equal = expected[index] === actual[index];
  }
  if (!equal) {
    throw new TypeError(
      `${label} is not the exact canonical ${encoding} encoding; regenerate the current role instead of preserving an alternate JSON spelling.`,
    );
  }
}

/** Combines duplicate-free parsing with the unique current byte encoding check. */
export function parseCanonicalRealBuildJson<T>(
  bytes: Uint8Array,
  label: string,
  encoding: RealBuildCanonicalJsonEncoding = "compact",
): T {
  const parsed = parseDuplicateFreeRealBuildJson<T>(bytes, label);
  assertCanonicalRealBuildJsonBytes(bytes, parsed, label, encoding);
  return parsed;
}
