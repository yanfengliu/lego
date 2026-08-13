import { Buffer } from "node:buffer";
import { types as nodeTypes } from "node:util";

import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";
import { canonicalStringify } from "@lego-studio/brick-kernel";

import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";

const MAXIMUM_CAPTURE_JSON_DEPTH = 32;
const MAXIMUM_CAPTURE_JSON_VALUES = 250_000;

export const captureDigest = (bytes: Uint8Array): Sha256Digest => `sha256:${sha256Hex(bytes)}`;

/** Describes hostile leaves without invoking proxy traps, accessors, or custom coercion. */
export function describeCaptureValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value.slice(0, 80));
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "undefined") {
    return String(value);
  }
  if (typeof value === "bigint") return `${value}n`;
  return `a ${typeof value}`;
}

export function snapshotCaptureBytes(
  value: unknown,
  maximumBytes: number,
  path: string,
): Uint8Array {
  return snapshotHostileUint8Array(value, {
    maximumBytes,
    typeError: `${path} must be one exact intrinsic Uint8Array.`,
    oversizeError: (length) => `${path} has ${length} bytes; expected at most ${maximumBytes}.`,
    sharedError: `${path} must not use SharedArrayBuffer storage.`,
    copyError: `${path} bytes could not be copied from live storage.`,
  });
}

export function parseCanonicalCaptureJson(
  bytesValue: unknown,
  maximumBytes: number,
  path: string,
): { readonly bytes: Uint8Array; readonly value: unknown } {
  const bytes = snapshotCaptureBytes(bytesValue, maximumBytes, path);
  if (bytes.length < 2) throw new RangeError(`${path} must contain at least 2 bytes.`);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError(`${path} must be fatal UTF-8 JSON without replacement characters.`);
  }
  const roundTrip = new TextEncoder().encode(text);
  if (!equalCaptureBytes(roundTrip, bytes)) {
    throw new TypeError(`${path} must round-trip as exact UTF-8 without a byte-order mark.`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError(`${path} must be one complete JSON value.`);
  }
  const pending: { readonly value: unknown; readonly depth: number }[] = [{ value, depth: 0 }];
  let visited = 0;
  while (pending.length > 0) {
    const current = pending.pop()!;
    visited += 1;
    if (visited > MAXIMUM_CAPTURE_JSON_VALUES || current.depth > MAXIMUM_CAPTURE_JSON_DEPTH) {
      throw new RangeError(
        `${path} exceeds ${MAXIMUM_CAPTURE_JSON_VALUES} JSON values or depth ${MAXIMUM_CAPTURE_JSON_DEPTH}.`,
      );
    }
    if (current.value === null || typeof current.value !== "object") continue;
    if (Array.isArray(current.value)) {
      for (let index = 0; index < current.value.length; index += 1) {
        if (!Object.hasOwn(current.value, index)) {
          throw new TypeError(`${path} contains a sparse JSON array at index ${index}.`);
        }
        pending.push({ value: current.value[index], depth: current.depth + 1 });
      }
      continue;
    }
    if (Object.getPrototypeOf(current.value) !== Object.prototype) {
      throw new TypeError(`${path} contains a non-plain JSON object.`);
    }
    for (const nested of Object.values(current.value as Record<string, unknown>)) {
      pending.push({ value: nested, depth: current.depth + 1 });
    }
  }
  if (canonicalStringify(value) !== text) {
    throw new TypeError(`${path} must use exact canonical JSON bytes.`);
  }
  return { bytes, value };
}

export function exactCaptureRecord(
  value: unknown,
  expectedKeys: readonly string[],
  path: string,
): Readonly<Record<string, unknown>> {
  if (
    value === null ||
    typeof value !== "object" ||
    nodeTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${path} must be a non-proxy plain data record.`);
  }
  let prototype: object | null;
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  } catch {
    throw new TypeError(`${path} refused non-invoking descriptor inspection.`);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must use Object.prototype or null.`);
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) {
    throw new TypeError(`${path} must not contain symbol keys.`);
  }
  const actual = (keys as string[]).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(
      `${path} keys observed [${actual.join(", ")}]; expected [${expected.join(", ")}].`,
    );
  }
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(`${path}.${key} must be one enumerable data property, not an accessor.`);
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

export function denseCaptureArray(
  value: unknown,
  expectedLength: number,
  path: string,
): readonly unknown[] {
  return boundedDenseCaptureArray(value, expectedLength, expectedLength, path);
}

export function boundedDenseCaptureArray(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
  path: string,
): readonly unknown[] {
  if (!Array.isArray(value) || nodeTypes.isProxy(value)) {
    throw new TypeError(`${path} must be one non-proxy Array.`);
  }
  let prototype: object | null;
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  } catch {
    throw new TypeError(`${path} refused non-invoking descriptor inspection.`);
  }
  if (prototype !== Array.prototype) {
    throw new TypeError(`${path} must use the intrinsic Array prototype.`);
  }
  const lengthDescriptor = descriptors.length;
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < minimumLength ||
    lengthDescriptor.value > maximumLength
  ) {
    throw new RangeError(
      `${path}.length observed ${describeCaptureValue(lengthDescriptor?.value)}; expected ${minimumLength} through ${maximumLength}.`,
    );
  }
  const length = lengthDescriptor.value;
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== length + 1 ||
    keys.some(
      (key) =>
        typeof key !== "string" ||
        (key !== "length" && (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= length)),
    )
  ) {
    throw new TypeError(`${path} must be dense, accessor-free, and contain no extra keys.`);
  }
  const snapshot = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(`${path}[${index}] must be one enumerable data element.`);
    }
    snapshot[index] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

export function captureInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new RangeError(
      `${path} observed ${describeCaptureValue(value)}; expected a safe integer from ${minimum} through ${maximum}.`,
    );
  }
  return value;
}

export function captureFinite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(
      `${path} observed ${describeCaptureValue(value)}; expected one finite number.`,
    );
  }
  return value;
}

export function requireCaptureDigest(value: unknown, path: string): Sha256Digest {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be one lowercase sha256:<64 hex> digest.`);
  }
  return value as Sha256Digest;
}

export function decodeCaptureBase64(
  value: unknown,
  expectedBytes: number,
  maximumBytes: number,
  path: string,
): Uint8Array {
  if (expectedBytes < 1 || expectedBytes > maximumBytes) {
    throw new RangeError(
      `${path} descriptor declares ${expectedBytes} bytes; expected 1 through ${maximumBytes} before transport access.`,
    );
  }
  const maximumCharacters = Math.ceil(maximumBytes / 3) * 4;
  if (
    typeof value !== "string" ||
    value.length > maximumCharacters ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
  ) {
    throw new TypeError(`${path} must be bounded canonical base64.`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== expectedBytes) {
    throw new RangeError(
      `${path} decodes to ${bytes.length} bytes; descriptor requires ${expectedBytes}.`,
    );
  }
  if (bytes.toString("base64") !== value) {
    throw new TypeError(`${path} is not the canonical base64 spelling of its decoded bytes.`);
  }
  return new Uint8Array(bytes);
}

export function decodeCapturePngDataUrl(
  value: unknown,
  expectedBytes: number,
  maximumBytes: number,
  path: string,
): Uint8Array {
  const prefix = "data:image/png;base64,";
  if (typeof value !== "string" || !value.startsWith(prefix)) {
    throw new TypeError(`${path} must be one canonical PNG base64 data URL.`);
  }
  return decodeCaptureBase64(value.slice(prefix.length), expectedBytes, maximumBytes, path);
}

export function equalCaptureBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
