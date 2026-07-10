import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export type CanonicalJsonPrimitive = boolean | number | string | null;
export type CanonicalJsonValue =
  | CanonicalJsonPrimitive
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

export class CanonicalizationError extends TypeError {
  public readonly path: string;

  public constructor(message: string, path: string) {
    super(`${message} at ${path}`);
    this.name = "CanonicalizationError";
    this.path = path;
  }
}

function assertPlainObject(value: object, path: string): void {
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new CanonicalizationError("Expected a plain JSON object", path);
  }
}

function encodeCanonical(value: unknown, path: string, ancestors: ReadonlySet<object>): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
    case "string":
      return JSON.stringify(value);
    case "number": {
      if (!Number.isFinite(value)) {
        throw new CanonicalizationError("Expected a finite JSON number", path);
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    }
    case "object": {
      if (ancestors.has(value)) {
        throw new CanonicalizationError("Circular references are not canonical JSON", path);
      }

      const nextAncestors = new Set(ancestors);
      nextAncestors.add(value);

      if (Array.isArray(value)) {
        const encodedItems: string[] = [];
        for (let index = 0; index < value.length; index += 1) {
          if (!Object.hasOwn(value, index)) {
            throw new CanonicalizationError(
              "Sparse arrays are not canonical JSON",
              `${path}[${index}]`,
            );
          }
          encodedItems.push(encodeCanonical(value[index], `${path}[${index}]`, nextAncestors));
        }
        return `[${encodedItems.join(",")}]`;
      }

      assertPlainObject(value, path);
      const record = value as Record<string, unknown>;
      const members = Object.keys(record)
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
        .map((key) => {
          const encodedKey = JSON.stringify(key);
          const encodedValue = encodeCanonical(record[key], `${path}.${key}`, nextAncestors);
          return `${encodedKey}:${encodedValue}`;
        });
      return `{${members.join(",")}}`;
    }
    default:
      throw new CanonicalizationError(`Unsupported JSON value type ${typeof value}`, path);
  }
}

export function canonicalStringify(value: unknown): string {
  return encodeCanonical(value, "$", new Set());
}

export function sha256Hex(value: string | Uint8Array): string {
  return bytesToHex(sha256(typeof value === "string" ? utf8ToBytes(value) : value));
}

export function canonicalSha256(value: unknown): string {
  return sha256Hex(canonicalStringify(value));
}

export type Sha256Digest = `sha256:${string}`;

export function canonicalDigest(value: unknown): Sha256Digest {
  return `sha256:${canonicalSha256(value)}`;
}

function freezeRecursively(value: unknown, seen: WeakSet<object>): void {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const property of Reflect.ownKeys(value)) {
    freezeRecursively(Reflect.get(value, property), seen);
  }
  Object.freeze(value);
}

/** Deeply freezes a trusted artifact after all schema checks and derivation complete. */
export function deepFreeze<T>(value: T): T {
  freezeRecursively(value, new WeakSet());
  return value;
}
