const SAFE_ARRAY = Array;
const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_ARRAY_INDEX_OF = Array.prototype.indexOf;
const SAFE_ARRAY_POP = Array.prototype.pop;
const SAFE_ARRAY_PUSH = Array.prototype.push;
const SAFE_DEFINE_PROPERTY = Object.defineProperty;
const SAFE_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_JSON = JSON;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_NUMBER_IS_FINITE = Number.isFinite;
const SAFE_NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const SAFE_OBJECT_CREATE = Object.create;
const SAFE_OBJECT_IS = Object.is;
const SAFE_OBJECT_KEYS = Object.keys;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_TEXT_ENCODER = TextEncoder;
const SAFE_TEXT_ENCODER_ENCODE = TextEncoder.prototype.encode;
const encoder = new SAFE_TEXT_ENCODER();

function apply<T>(fn: (...args: never[]) => T, receiver: unknown, args: unknown[]): T {
  return SAFE_REFLECT_APPLY(fn, receiver, args) as T;
}

function detach(value: unknown, ancestors: object[], depth: number): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!SAFE_NUMBER_IS_FINITE(value))
      throw new TypeError("Safe JSON evidence numbers must be finite.");
    return SAFE_OBJECT_IS(value, -0) ? 0 : value;
  }
  if (typeof value !== "object" || depth > 128) {
    throw new TypeError("Safe JSON evidence must be a bounded JSON value.");
  }
  if (apply<number>(SAFE_ARRAY_INDEX_OF, ancestors, [value]) !== -1) {
    throw new TypeError("Safe JSON evidence cannot contain a cycle.");
  }
  apply<number>(SAFE_ARRAY_PUSH, ancestors, [value]);
  try {
    if (SAFE_ARRAY_IS_ARRAY(value)) {
      const lengthDescriptor = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(value, "length");
      const length = lengthDescriptor?.value;
      if (!SAFE_NUMBER_IS_SAFE_INTEGER(length) || (length as number) < 0) {
        throw new TypeError("Safe JSON evidence arrays must have a bounded dense length.");
      }
      const copy = new SAFE_ARRAY(length as number);
      SAFE_DEFINE_PROPERTY(copy, "toJSON", {
        value: undefined,
        enumerable: false,
        configurable: false,
        writable: false,
      });
      for (let index = 0; index < (length as number); index += 1) {
        const descriptor = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          throw new TypeError("Safe JSON evidence arrays must contain dense own data entries.");
        }
        SAFE_DEFINE_PROPERTY(copy, String(index), {
          value: detach(descriptor.value, ancestors, depth + 1),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      return copy;
    }
    const copy = SAFE_OBJECT_CREATE(null) as Record<string, unknown>;
    const keys = SAFE_OBJECT_KEYS(value);
    const keyCount = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(keys, "length")?.value;
    if (!SAFE_NUMBER_IS_SAFE_INTEGER(keyCount) || (keyCount as number) < 0) {
      throw new TypeError("Safe JSON evidence object keys must have a bounded dense length.");
    }
    for (let index = 0; index < (keyCount as number); index += 1) {
      const keyDescriptor = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(keys, String(index));
      if (
        keyDescriptor === undefined ||
        !("value" in keyDescriptor) ||
        typeof keyDescriptor.value !== "string"
      ) {
        throw new TypeError("Safe JSON evidence object keys must be dense strings.");
      }
      const key = keyDescriptor.value;
      const descriptor = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError("Safe JSON evidence objects must contain enumerable own data fields.");
      }
      SAFE_DEFINE_PROPERTY(copy, key, {
        value: detach(descriptor.value, ancestors, depth + 1),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return copy;
  } finally {
    apply<unknown>(SAFE_ARRAY_POP, ancestors, []);
  }
}

/** Serializes only detached own-data JSON while ignoring later prototype/toJSON poisoning. */
export function stringifyRealBuildSafeJson(value: unknown): string {
  const detached = detach(value, [], 0);
  const serialized = apply<unknown>(SAFE_JSON_STRINGIFY, SAFE_JSON, [detached]);
  if (typeof serialized !== "string") {
    throw new TypeError("Safe JSON evidence did not serialize to one string.");
  }
  return serialized;
}

/** Encodes safe JSON with module-captured native TextEncoder intrinsics. */
export function encodeRealBuildSafeJson(value: unknown): Uint8Array {
  return apply<Uint8Array>(SAFE_TEXT_ENCODER_ENCODE, encoder, [stringifyRealBuildSafeJson(value)]);
}
