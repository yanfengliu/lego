import type { Sha256Digest } from "@lego-studio/brick-kernel";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;

export function realBuildBrowserOutputV4Record(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be a detached JSON object.`);
  }
  return value as Record<string, unknown>;
}

export function realBuildBrowserOutputV4Exact(
  value: unknown,
  path: string,
  keys: readonly string[],
): Record<string, unknown> {
  const row = realBuildBrowserOutputV4Record(value, path);
  const actual = Object.keys(row);
  if (actual.length !== keys.length || !keys.every((key) => Object.hasOwn(row, key))) {
    throw new TypeError(`${path} must have exact keys ${keys.join(", ")}.`);
  }
  return row;
}

export function realBuildBrowserOutputV4Digest(value: unknown, path: string): Sha256Digest {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new TypeError(`${path} must be one exact lowercase sha256 digest.`);
  }
  return value as Sha256Digest;
}

export function realBuildBrowserOutputV4Integer(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RangeError(`${path} must be a safe integer from ${minimum} through ${maximum}.`);
  }
  return value as number;
}

export function realBuildBrowserOutputV4DenseArray(
  value: unknown,
  path: string,
  maximum: number,
): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new RangeError(`${path} must be a dense array of at most ${maximum} entries.`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, String(index))) {
      throw new TypeError(`${path} is sparse at index ${index}.`);
    }
  }
  return value;
}
