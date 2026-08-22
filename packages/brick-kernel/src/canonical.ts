import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_ARRAY_JOIN = Array.prototype.join;
const SAFE_ARRAY_PUSH = Array.prototype.push;
const SAFE_ARRAY_SORT = Array.prototype.sort;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_NUMBER_IS_FINITE = Number.isFinite;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_HAS_OWN = Object.hasOwn;
const SAFE_OBJECT_IS = Object.is;
const SAFE_OBJECT_KEYS = Object.keys;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_REFLECT_GET = Reflect.get;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_SET = Set;
const SAFE_SET_ADD = Set.prototype.add;
const SAFE_SET_DELETE = Set.prototype.delete;
const SAFE_SET_HAS = Set.prototype.has;
const SAFE_WEAK_SET = WeakSet;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;

function apply<T>(fn: (...args: never[]) => T, receiver: unknown, args: unknown[]): T {
  return SAFE_REFLECT_APPLY(fn, receiver, args) as T;
}

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
  const prototype = SAFE_OBJECT_GET_PROTOTYPE_OF(value) as object | null;
  if (prototype !== SAFE_OBJECT_PROTOTYPE && prototype !== null) {
    throw new CanonicalizationError("Expected a plain JSON object", path);
  }
}

function encodeCanonical(value: unknown, path: string, ancestors: Set<object>): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
    case "string":
      return SAFE_JSON_STRINGIFY(value);
    case "number": {
      if (!SAFE_NUMBER_IS_FINITE(value)) {
        throw new CanonicalizationError("Expected a finite JSON number", path);
      }
      return SAFE_JSON_STRINGIFY(SAFE_OBJECT_IS(value, -0) ? 0 : value);
    }
    case "object": {
      if (apply<boolean>(SAFE_SET_HAS, ancestors, [value])) {
        throw new CanonicalizationError("Circular references are not canonical JSON", path);
      }

      apply<Set<object>>(SAFE_SET_ADD, ancestors, [value]);
      try {
        if (SAFE_ARRAY_IS_ARRAY(value)) {
          const encodedItems: string[] = [];
          for (let index = 0; index < value.length; index += 1) {
            if (!SAFE_OBJECT_HAS_OWN(value, index)) {
              throw new CanonicalizationError(
                "Sparse arrays are not canonical JSON",
                `${path}[${index}]`,
              );
            }
            apply<number>(SAFE_ARRAY_PUSH, encodedItems, [
              encodeCanonical(value[index], `${path}[${index}]`, ancestors),
            ]);
          }
          return `[${apply<string>(SAFE_ARRAY_JOIN, encodedItems, [","])}]`;
        }

        assertPlainObject(value, path);
        const record = value as Record<string, unknown>;
        const keys = SAFE_OBJECT_KEYS(record);
        apply<string[]>(SAFE_ARRAY_SORT, keys, [
          (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0),
        ]);
        const members: string[] = [];
        for (let index = 0; index < keys.length; index += 1) {
          const key = keys[index]!;
          const encodedKey = SAFE_JSON_STRINGIFY(key);
          const encodedValue = encodeCanonical(record[key], `${path}.${key}`, ancestors);
          apply<number>(SAFE_ARRAY_PUSH, members, [`${encodedKey}:${encodedValue}`]);
        }
        return `{${apply<string>(SAFE_ARRAY_JOIN, members, [","])}}`;
      } finally {
        apply<boolean>(SAFE_SET_DELETE, ancestors, [value]);
      }
    }
    default:
      throw new CanonicalizationError(`Unsupported JSON value type ${typeof value}`, path);
  }
}

export function canonicalStringify(value: unknown): string {
  return encodeCanonical(value, "$", new SAFE_SET());
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
  if (apply<boolean>(SAFE_WEAK_SET_HAS, seen, [value])) return;
  apply<WeakSet<object>>(SAFE_WEAK_SET_ADD, seen, [value]);
  const properties = SAFE_REFLECT_OWN_KEYS(value);
  for (let index = 0; index < properties.length; index += 1) {
    freezeRecursively(SAFE_REFLECT_GET(value, properties[index]!), seen);
  }
  SAFE_OBJECT_FREEZE(value);
}

/** Deeply freezes a trusted artifact after all schema checks and derivation complete. */
export function deepFreeze<T>(value: T): T {
  freezeRecursively(value, new SAFE_WEAK_SET());
  return value;
}
