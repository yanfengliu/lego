import { canonicalStringify, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";
import { types as nodeTypes } from "node:util";

import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";

const ARRAY_IS_ARRAY = Array.isArray;
const IS_PROXY = nodeTypes.isProxy;
const ARRAY_PROTOTYPE = Array.prototype;
const CLAMPED_ARRAY_PROTOTYPE = Uint8ClampedArray.prototype;
const GET_OWN_PROPERTY_DESCRIPTORS = Object.getOwnPropertyDescriptors;
const GET_PROTOTYPE_OF = Object.getPrototypeOf;
const NUMBER_IS_FINITE = Number.isFinite;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const OBJECT_PROTOTYPE = Object.prototype;
const OWN_KEYS = Reflect.ownKeys;
const REFLECT_APPLY = Reflect.apply;
const TYPED_ARRAY_PROTOTYPE = GET_PROTOTYPE_OF(Uint8Array.prototype) as object;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")!.get!;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)!.get!;
const TYPED_ARRAY_TAG = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)!.get!;
const UINT8_ARRAY = Uint8Array;
const UINT8_ARRAY_PROTOTYPE = Uint8Array.prototype;
const UINT8_ARRAY_SET = Uint8Array.prototype.set;
const JSON_PARSE = JSON.parse;
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });
const TEXT_DECODER_DECODE = TextDecoder.prototype.decode;
const TEXT_ENCODER = new TextEncoder();
const TEXT_ENCODER_ENCODE = TextEncoder.prototype.encode;
const STRING_CHAR_CODE_AT = String.prototype.charCodeAt;
const SHARED_BYTE_LENGTH =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;

export const sourceEvidenceDigest = (bytes: Uint8Array): Sha256Digest =>
  `sha256:${sha256Hex(bytes)}`;

export function sourceEvidenceExactRecord(
  value: unknown,
  keys: readonly string[],
  path: string,
): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${path} must be one plain data record.`);
  }
  if (IS_PROXY(value)) throw new TypeError(`${path} may not be a Proxy.`);
  if (ARRAY_IS_ARRAY(value)) throw new TypeError(`${path} must be one plain data record.`);
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = REFLECT_APPLY(GET_PROTOTYPE_OF, Object, [value]) as object | null;
    descriptors = REFLECT_APPLY(GET_OWN_PROPERTY_DESCRIPTORS, Object, [
      value,
    ]) as unknown as PropertyDescriptorMap;
  } catch {
    throw new TypeError(`${path} refused non-invoking descriptor inspection.`);
  }
  if (prototype !== OBJECT_PROTOTYPE && prototype !== null) {
    throw new TypeError(`${path} must use Object.prototype or null.`);
  }
  const observed = REFLECT_APPLY(OWN_KEYS, Reflect, [descriptors]) as PropertyKey[];
  if (observed.length !== keys.length) {
    throw new TypeError(`${path} must contain exactly the declared data keys.`);
  }
  for (let observedIndex = 0; observedIndex < observed.length; observedIndex += 1) {
    const observedKey = observed[observedIndex];
    let found = false;
    if (typeof observedKey === "string") {
      for (let expectedIndex = 0; expectedIndex < keys.length; expectedIndex += 1) {
        if (observedKey === keys[expectedIndex]) {
          found = true;
          break;
        }
      }
    }
    if (!found) throw new TypeError(`${path} must contain exactly the declared data keys.`);
  }
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(`${path}.${key} must be one enumerable own data property.`);
    }
    result[key] = descriptor.value;
  }
  return intrinsicRealBuildFreeze(result);
}

export function sourceEvidenceDenseArray(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
): readonly unknown[] {
  if (value !== null && typeof value === "object" && IS_PROXY(value)) {
    throw new TypeError(`${path} may not be a Proxy.`);
  }
  if (!ARRAY_IS_ARRAY(value)) throw new TypeError(`${path} must be one Array.`);
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = REFLECT_APPLY(GET_PROTOTYPE_OF, Object, [value]) as object | null;
    descriptors = REFLECT_APPLY(GET_OWN_PROPERTY_DESCRIPTORS, Object, [
      value,
    ]) as unknown as PropertyDescriptorMap;
  } catch {
    throw new TypeError(`${path} refused non-invoking descriptor inspection.`);
  }
  if (prototype !== ARRAY_PROTOTYPE) throw new TypeError(`${path} must use Array.prototype.`);
  const length = descriptors.length?.value;
  if (
    typeof length !== "number" ||
    !NUMBER_IS_SAFE_INTEGER(length) ||
    length < minimum ||
    length > maximum
  ) {
    throw new RangeError(`${path} must contain ${minimum} through ${maximum} dense rows.`);
  }
  const keys = REFLECT_APPLY(OWN_KEYS, Reflect, [descriptors]) as PropertyKey[];
  if (keys.length !== length + 1) {
    throw new TypeError(`${path} must be dense and contain no extra keys.`);
  }
  const result = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(`${path}[${index}] must be one enumerable own data element.`);
    }
    result[index] = descriptor.value;
  }
  return intrinsicRealBuildFreeze(result);
}

export function sourceEvidenceDigestValue(value: unknown, path: string): Sha256Digest {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be one lowercase sha256:<64 hex> digest.`);
  }
  return value as Sha256Digest;
}

export function sourceEvidenceInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
): number {
  if (
    typeof value !== "number" ||
    !NUMBER_IS_SAFE_INTEGER(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new RangeError(`${path} must be a safe integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

export function sourceEvidenceFinite(value: unknown, path: string): number {
  if (typeof value !== "number" || !NUMBER_IS_FINITE(value)) {
    throw new RangeError(`${path} must be one finite number.`);
  }
  return value;
}

function isShared(buffer: ArrayBufferLike): boolean {
  if (SHARED_BYTE_LENGTH === undefined) return false;
  try {
    REFLECT_APPLY(SHARED_BYTE_LENGTH, buffer, []);
    return true;
  } catch {
    return false;
  }
}

export function sourceEvidenceByteView(
  value: unknown,
  allowedTags: readonly ("Uint8Array" | "Uint8ClampedArray")[],
  maximumBytes: number,
  path: string,
): { readonly value: Uint8Array | Uint8ClampedArray; readonly byteLength: number } {
  let tag: unknown;
  let buffer: ArrayBufferLike;
  let byteLength: number;
  let prototype: object | null;
  try {
    tag = REFLECT_APPLY(TYPED_ARRAY_TAG, value, []);
    buffer = REFLECT_APPLY(TYPED_ARRAY_BUFFER, value, []) as ArrayBufferLike;
    byteLength = REFLECT_APPLY(TYPED_ARRAY_BYTE_LENGTH, value, []) as number;
    prototype = REFLECT_APPLY(GET_PROTOTYPE_OF, Object, [value]) as object | null;
  } catch {
    throw new TypeError(`${path} must be one exact intrinsic one-byte typed array.`);
  }
  const expectedPrototype = tag === "Uint8Array" ? UINT8_ARRAY_PROTOTYPE : CLAMPED_ARRAY_PROTOTYPE;
  let allowed = false;
  for (let index = 0; index < allowedTags.length; index += 1) {
    if (tag === allowedTags[index]) {
      allowed = true;
      break;
    }
  }
  if (!allowed || prototype !== expectedPrototype) {
    throw new TypeError(`${path} has the wrong intrinsic typed-array brand or prototype.`);
  }
  if (isShared(buffer)) throw new TypeError(`${path} must not use SharedArrayBuffer storage.`);
  if (!NUMBER_IS_SAFE_INTEGER(byteLength) || byteLength < 0 || byteLength > maximumBytes) {
    throw new RangeError(`${path} has ${String(byteLength)} bytes; maximum is ${maximumBytes}.`);
  }
  return intrinsicRealBuildFreeze({
    value: value as Uint8Array | Uint8ClampedArray,
    byteLength,
  });
}

export function sourceEvidenceCopyBytes(
  value: unknown,
  allowedTags: readonly ("Uint8Array" | "Uint8ClampedArray")[],
  expectedBytes: number,
  maximumBytes: number,
  path: string,
): Uint8Array {
  const inspected = sourceEvidenceByteView(value, allowedTags, maximumBytes, path);
  if (inspected.byteLength !== expectedBytes) {
    throw new RangeError(
      `${path} has ${inspected.byteLength} bytes; exact dimensions require ${expectedBytes}.`,
    );
  }
  const result = new UINT8_ARRAY(expectedBytes);
  try {
    REFLECT_APPLY(UINT8_ARRAY_SET, result, [inspected.value]);
  } catch {
    throw new TypeError(`${path} could not be copied from live private storage.`);
  }
  return result;
}

export function sourceEvidenceConcat(
  pieces: readonly Uint8Array[],
  maximumBytes: number,
  path: string,
): { readonly bytes: Uint8Array; readonly offsets: readonly number[] } {
  let total = 0;
  const offsets: number[] = [];
  for (let index = 0; index < pieces.length; index += 1) {
    offsets[index] = total;
    total += pieces[index]!.byteLength;
    if (!NUMBER_IS_SAFE_INTEGER(total) || total > maximumBytes) {
      throw new RangeError(`${path} exceeds ${maximumBytes} bytes at piece ${index}.`);
    }
  }
  const bytes = new UINT8_ARRAY(total);
  for (let index = 0; index < pieces.length; index += 1) {
    REFLECT_APPLY(UINT8_ARRAY_SET, bytes, [pieces[index]!, offsets[index]!]);
  }
  return intrinsicRealBuildFreeze({ bytes, offsets: intrinsicRealBuildFreeze(offsets) });
}

function preflightJsonText(text: string, path: string): void {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let structures = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = REFLECT_APPLY(STRING_CHAR_CODE_AT, text, [index]) as number;
    if (inString) {
      if (escaped) escaped = false;
      else if (code === 0x5c) escaped = true;
      else if (code === 0x22) inString = false;
      continue;
    }
    if (code === 0x22) inString = true;
    else if (code === 0x7b || code === 0x5b) {
      depth += 1;
      structures += 1;
      if (depth > 32 || structures > 500_000) {
        throw new RangeError(`${path} exceeds bounded JSON depth or structure count.`);
      }
    } else if (code === 0x7d || code === 0x5d) {
      depth -= 1;
      if (depth < 0) throw new TypeError(`${path} has malformed JSON delimiters.`);
    }
  }
  if (depth !== 0 || inString || escaped) throw new TypeError(`${path} has malformed JSON text.`);
}

export function sourceEvidenceParseCanonicalJson(
  value: unknown,
  maximumBytes: number,
  path: string,
): { readonly bytes: Uint8Array; readonly value: unknown } {
  const inspected = sourceEvidenceByteView(value, ["Uint8Array"], maximumBytes, path);
  if (inspected.byteLength < 2) throw new RangeError(`${path} must contain at least two bytes.`);
  const bytes = sourceEvidenceCopyBytes(
    inspected.value,
    ["Uint8Array"],
    inspected.byteLength,
    maximumBytes,
    path,
  );
  let text: string;
  try {
    text = REFLECT_APPLY(TEXT_DECODER_DECODE, TEXT_DECODER, [bytes]) as string;
  } catch {
    throw new TypeError(`${path} must be fatal UTF-8 JSON.`);
  }
  preflightJsonText(text, path);
  let parsed: unknown;
  try {
    parsed = REFLECT_APPLY(JSON_PARSE, JSON, [text]) as unknown;
  } catch {
    throw new TypeError(`${path} must contain one complete JSON value.`);
  }
  if (canonicalStringify(parsed) !== text) {
    throw new TypeError(`${path} must use exact canonical JSON bytes.`);
  }
  return intrinsicRealBuildFreeze({ bytes, value: parsed });
}

export function sourceEvidenceCanonicalBytes(value: unknown): Uint8Array {
  return REFLECT_APPLY(TEXT_ENCODER_ENCODE, TEXT_ENCODER, [
    canonicalStringify(value),
  ]) as Uint8Array;
}

export function sourceEvidenceEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function sourceEvidenceFreshCopy(bytes: Uint8Array): Uint8Array {
  const result = new UINT8_ARRAY(bytes.byteLength);
  REFLECT_APPLY(UINT8_ARRAY_SET, result, [bytes]);
  return result;
}

/** Conservative peak for retained RGBA, stage/candidate masks, component work, and packing. */
export function sourceEvidenceActiveBytes(
  highPixels: number,
  workPixels: number,
  packedMaskBytes: number,
): number {
  return highPixels * 17 + workPixels * 34 + packedMaskBytes;
}
