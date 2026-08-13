import { canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const MAXIMUM_JSON_DEPTH = 32;
const MAXIMUM_JSON_VALUES = 1_000_000;

function described(value: unknown): string {
  return canonicalStringify(value);
}

export function requireExactStageTraceMatch(
  observed: unknown,
  expected: unknown,
  path: string,
): void {
  const observedJson = described(observed);
  const expectedJson = described(expected);
  if (observedJson !== expectedJson) {
    throw new TypeError(`${path} observed ${observedJson}; expected ${expectedJson}.`);
  }
}

export function requireExactStageTraceUtf8(bytes: Uint8Array, text: string): void {
  const roundTrip = new TextEncoder().encode(text);
  if (roundTrip.length !== bytes.length || roundTrip.some((byte, index) => byte !== bytes[index])) {
    throw new TypeError(
      "Observation source stage manifest observed UTF-8 bytes that do not round-trip byte-for-byte; expected exact UTF-8 without a byte-order mark.",
    );
  }
}

export function exactStageTraceRecord(
  value: unknown,
  path: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${path} must be one ordinary plain JSON object.`);
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record);
  if (actual.length !== keys.length || !keys.every((key) => actual.includes(key))) {
    throw new TypeError(`${path} must contain exactly ${keys.join(", ")}.`);
  }
  return record;
}

export function denseStageTraceArray(
  value: unknown,
  path: string,
  maximum: number,
): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new RangeError(`${path} must be one dense array with at most ${maximum} entries.`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) throw new TypeError(`${path} is sparse at index ${index}.`);
  }
  return value;
}

export function stageTraceInteger(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new RangeError(
      `${path} observed ${described(value)}; expected a safe integer from ${minimum} through ${maximum}.`,
    );
  }
  return value;
}

export function stageTraceDigest(value: unknown, path: string): Sha256Digest {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new TypeError(
      `${path} observed ${described(value)}; expected one lowercase SHA-256 digest.`,
    );
  }
  return value as Sha256Digest;
}

/** Bounds shape/depth before recursive canonicalization sees retained JSON. */
export function requireCanonicalStageTraceJson(value: unknown, text: string): void {
  const pending: { readonly value: unknown; readonly depth: number }[] = [{ value, depth: 0 }];
  let visited = 0;
  while (pending.length > 0) {
    const current = pending.pop()!;
    visited += 1;
    if (visited > MAXIMUM_JSON_VALUES || current.depth > MAXIMUM_JSON_DEPTH) {
      throw new RangeError(
        `Observation source stage manifest exceeds ${MAXIMUM_JSON_VALUES} JSON values or depth ${MAXIMUM_JSON_DEPTH}.`,
      );
    }
    if (current.value === null || typeof current.value !== "object") continue;
    if (Array.isArray(current.value)) {
      denseStageTraceArray(current.value, "stageTrace JSON array", MAXIMUM_JSON_VALUES);
      for (const nested of current.value) pending.push({ value: nested, depth: current.depth + 1 });
      continue;
    }
    if (Object.getPrototypeOf(current.value) !== Object.prototype) {
      throw new TypeError("Observation source stage manifest contains a non-plain JSON object.");
    }
    for (const nested of Object.values(current.value as Record<string, unknown>)) {
      pending.push({ value: nested, depth: current.depth + 1 });
    }
  }
  if (canonicalStringify(value) !== text) {
    throw new TypeError("Observation source stage manifest must use exact canonical JSON bytes.");
  }
}
