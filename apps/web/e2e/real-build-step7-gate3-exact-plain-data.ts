const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_ARRAY_JOIN = Array.prototype.join;
const SAFE_ARRAY_PUSH = Array.prototype.push;
const SAFE_ARRAY_SORT = Array.prototype.sort;
const SAFE_ARRAY_PROTOTYPE = Array.prototype;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_MATH_MAX = Math.max;
const SAFE_MATH_MIN = Math.min;
const SAFE_NUMBER_IS_FINITE = Number.isFinite;
const SAFE_NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_IS = Object.is;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_STRING = String;
const SAFE_STRING_CHAR_CODE_AT = String.prototype.charCodeAt;
const SAFE_STRUCTURED_CLONE = structuredClone;
const SAFE_TEXT_ENCODER_ENCODE = TextEncoder.prototype.encode;
const SAFE_TEXT_ENCODER = new TextEncoder();
const SAFE_TYPE_ERROR = TypeError;
const SAFE_WEAK_SET = WeakSet;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_DELETE = WeakSet.prototype.delete;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;

const MAXIMUM_DEPTH = 64;
const MAXIMUM_VALUES = 1_000_000;
const MAXIMUM_CONTAINER_ENTRIES = 1_000_000;
const MAXIMUM_CANONICAL_CHARACTERS = 64 * 1024 * 1024;
const MAXIMUM_TRANSIENT_JSON_CHARACTERS = 64 * 1024 * 1024;
const MAXIMUM_CANONICAL_UTF8_BYTES = 64 * 1024 * 1024;

// Encoding may retain canonical fragments while joining one equally bounded final string. The
// input and structured clone are separate caller-owned allocations. Each JSON string allocation
// is precharged conservatively; the bounded final string is counted exactly for UTF-8 bytes before
// TextEncoder is allowed to allocate its output.

function apply<T>(fn: (...args: never[]) => T, receiver: unknown, args: unknown[]): T {
  return SAFE_REFLECT_APPLY(fn, receiver, args) as T;
}

interface EncodingState {
  values: number;
  encodedCharacters: number;
  readonly maximumCanonicalCharacters: number;
  readonly maximumTransientJsonCharacters: number;
  readonly maximumCanonicalUtf8Bytes: number;
  readonly ancestors: WeakSet<object>;
  readonly seen: WeakSet<object>;
}

interface ExactPlainDataLimits {
  readonly maximumCanonicalCharacters: number;
  readonly maximumTransientJsonCharacters: number;
  readonly maximumCanonicalUtf8Bytes: number;
  readonly beforeTextEncoderEncode?: () => void;
}

function fail(label: string, path: string, reason: string): never {
  throw new SAFE_TYPE_ERROR(`${label} must be exact finite plain data; ${reason} at ${path}.`);
}

function chargeCharacters(state: EncodingState, count: number, label: string, path: string): void {
  state.encodedCharacters += count;
  if (state.encodedCharacters > state.maximumCanonicalCharacters) {
    fail(
      label,
      path,
      `canonical encoding exceeds ${state.maximumCanonicalCharacters} UTF-16 characters`,
    );
  }
}

function prechargeJsonString(
  value: string,
  state: EncodingState,
  label: string,
  path: string,
  followingCharacters = 0,
): void {
  const worstCaseCharacters = 2 + value.length * 6 + followingCharacters;
  if (state.encodedCharacters + worstCaseCharacters > state.maximumTransientJsonCharacters) {
    fail(
      label,
      path,
      `worst-case JSON string allocation exceeds the ${state.maximumTransientJsonCharacters}-character transient bound`,
    );
  }
}

function dataDescriptor(
  value: object,
  key: PropertyKey,
  label: string,
  path: string,
  enumerable: boolean,
): PropertyDescriptor & { readonly value: unknown } {
  const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    fail(label, path, "accessors or disappearing own properties are forbidden");
  }
  if (descriptor.enumerable !== enumerable) {
    fail(
      label,
      path,
      enumerable ? "non-enumerable keys are forbidden" : "array length is malformed",
    );
  }
  return descriptor as PropertyDescriptor & { readonly value: unknown };
}

function encode(
  value: unknown,
  label: string,
  path: string,
  depth: number,
  state: EncodingState,
): string {
  state.values += 1;
  if (state.values > MAXIMUM_VALUES) fail(label, path, `value count exceeds ${MAXIMUM_VALUES}`);
  if (depth > MAXIMUM_DEPTH) fail(label, path, `depth exceeds ${MAXIMUM_DEPTH}`);
  if (value === null) {
    chargeCharacters(state, 4, label, path);
    return "null";
  }
  if (typeof value === "boolean" || typeof value === "string") {
    if (typeof value === "string") prechargeJsonString(value, state, label, path);
    const encoded = SAFE_JSON_STRINGIFY(value);
    chargeCharacters(state, encoded.length, label, path);
    return encoded;
  }
  if (typeof value === "number") {
    if (!SAFE_NUMBER_IS_FINITE(value)) fail(label, path, "non-finite numbers are forbidden");
    const encoded = SAFE_OBJECT_IS(value, -0) ? "-0" : SAFE_JSON_STRINGIFY(value);
    chargeCharacters(state, encoded.length, label, path);
    return encoded;
  }
  if (typeof value !== "object") {
    fail(label, path, `${typeof value} values are forbidden`);
  }
  if (apply<boolean>(SAFE_WEAK_SET_HAS, state.ancestors, [value])) {
    fail(label, path, "cycles are forbidden");
  }
  if (apply<boolean>(SAFE_WEAK_SET_HAS, state.seen, [value])) {
    fail(label, path, "shared object aliases are forbidden");
  }
  apply<WeakSet<object>>(SAFE_WEAK_SET_ADD, state.seen, [value]);
  apply<WeakSet<object>>(SAFE_WEAK_SET_ADD, state.ancestors, [value]);
  try {
    const ownKeys = SAFE_REFLECT_OWN_KEYS(value);
    if (ownKeys.length > MAXIMUM_CONTAINER_ENTRIES + 1) {
      fail(label, path, `container entry count exceeds ${MAXIMUM_CONTAINER_ENTRIES}`);
    }
    if (SAFE_ARRAY_IS_ARRAY(value)) {
      if (SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_ARRAY_PROTOTYPE) {
        fail(label, path, "arrays must use the intrinsic Array prototype");
      }
      const lengthDescriptor = dataDescriptor(value, "length", label, `${path}.length`, false);
      const length = lengthDescriptor.value;
      if (!SAFE_NUMBER_IS_SAFE_INTEGER(length) || (length as number) < 0) {
        fail(label, `${path}.length`, "array length is not a non-negative safe integer");
      }
      if ((length as number) > MAXIMUM_CONTAINER_ENTRIES) {
        fail(label, path, `array length exceeds ${MAXIMUM_CONTAINER_ENTRIES}`);
      }
      if (ownKeys.length !== (length as number) + 1) {
        fail(label, path, "sparse arrays or custom array keys are forbidden");
      }
      const items: string[] = [];
      for (let index = 0; index < (length as number); index += 1) {
        const itemPath = `${path}[${index}]`;
        const descriptor = dataDescriptor(value, SAFE_STRING(index), label, itemPath, true);
        apply<number>(SAFE_ARRAY_PUSH, items, [
          encode(descriptor.value, label, itemPath, depth + 1, state),
        ]);
      }
      chargeCharacters(state, 2 + SAFE_MATH_MAX(0, (length as number) - 1), label, path);
      return `[${apply<string>(SAFE_ARRAY_JOIN, items, [","])}]`;
    }
    if (SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_OBJECT_PROTOTYPE) {
      fail(label, path, "objects must use the intrinsic Object prototype");
    }
    const keys: string[] = [];
    for (let keyIndex = 0; keyIndex < ownKeys.length; keyIndex += 1) {
      const key = ownKeys[keyIndex]!;
      if (typeof key !== "string") fail(label, path, "symbol keys are forbidden");
      apply<number>(SAFE_ARRAY_PUSH, keys, [key]);
    }
    apply<string[]>(SAFE_ARRAY_SORT, keys, [
      (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0),
    ]);
    const members: string[] = [];
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      const key = keys[keyIndex]!;
      prechargeJsonString(key, state, label, path, 1);
      const memberPath = `${path}.${key}`;
      const descriptor = dataDescriptor(value, key, label, memberPath, true);
      const encodedKey = SAFE_JSON_STRINGIFY(key);
      chargeCharacters(state, encodedKey.length + 1, label, memberPath);
      apply<number>(SAFE_ARRAY_PUSH, members, [
        `${encodedKey}:${encode(descriptor.value, label, memberPath, depth + 1, state)}`,
      ]);
    }
    chargeCharacters(state, 2 + SAFE_MATH_MAX(0, keys.length - 1), label, path);
    return `{${apply<string>(SAFE_ARRAY_JOIN, members, [","])}}`;
  } finally {
    apply<boolean>(SAFE_WEAK_SET_DELETE, state.ancestors, [value]);
  }
}

function exactUtf8ByteLengthWithinMaximum(value: string, label: string, maximum: number): number {
  let byteLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = apply<number>(SAFE_STRING_CHAR_CODE_AT, value, [index]);
    let encodedLength: number;
    if (codeUnit <= 0x7f) {
      encodedLength = 1;
    } else if (codeUnit <= 0x7ff) {
      encodedLength = 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff && index + 1 < value.length) {
      const nextCodeUnit = apply<number>(SAFE_STRING_CHAR_CODE_AT, value, [index + 1]);
      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
        encodedLength = 4;
        index += 1;
      } else {
        encodedLength = 3;
      }
    } else {
      encodedLength = 3;
    }
    byteLength += encodedLength;
    if (byteLength > maximum) {
      fail(
        label,
        "$",
        `canonical encoding exceeds ${maximum} UTF-8 bytes before TextEncoder allocation`,
      );
    }
  }
  return byteLength;
}

function exactPlainDataBytesWithLimits(
  value: unknown,
  label: string,
  limits: ExactPlainDataLimits,
): string {
  const state: EncodingState = {
    values: 0,
    encodedCharacters: 0,
    maximumCanonicalCharacters: limits.maximumCanonicalCharacters,
    maximumTransientJsonCharacters: limits.maximumTransientJsonCharacters,
    maximumCanonicalUtf8Bytes: limits.maximumCanonicalUtf8Bytes,
    ancestors: new SAFE_WEAK_SET(),
    seen: new SAFE_WEAK_SET(),
  };
  const bytes = encode(value, label, "$", 0, state);
  exactUtf8ByteLengthWithinMaximum(bytes, label, state.maximumCanonicalUtf8Bytes);
  limits.beforeTextEncoderEncode?.();
  apply<Uint8Array>(SAFE_TEXT_ENCODER_ENCODE, SAFE_TEXT_ENCODER, [bytes]);
  return bytes;
}

export function exactPlainDataBytes(value: unknown, label: string): string {
  const maximum = SAFE_MATH_MIN(
    MAXIMUM_CANONICAL_CHARACTERS,
    MAXIMUM_TRANSIENT_JSON_CHARACTERS,
    MAXIMUM_CANONICAL_UTF8_BYTES,
  );
  return exactPlainDataBytesWithLimits(value, label, {
    maximumCanonicalCharacters: maximum,
    maximumTransientJsonCharacters: maximum,
    maximumCanonicalUtf8Bytes: maximum,
  });
}

/** @internal Authority-free small-limit seam for allocation-order regression tests. */
export function exactPlainDataBytesWithTestLimits(
  value: unknown,
  label: string,
  limits: ExactPlainDataLimits,
): string {
  const testedLimits = [
    limits.maximumCanonicalCharacters,
    limits.maximumTransientJsonCharacters,
    limits.maximumCanonicalUtf8Bytes,
  ];
  for (let index = 0; index < testedLimits.length; index += 1) {
    const maximum = testedLimits[index]!;
    if (!SAFE_NUMBER_IS_SAFE_INTEGER(maximum) || maximum < 8) {
      throw new SAFE_TYPE_ERROR(
        "Exact plain-data test limits must be safe integers of at least 8 characters or bytes.",
      );
    }
  }
  return exactPlainDataBytesWithLimits(value, label, limits);
}

function freezeExactPlainData(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    const key = keys[keyIndex]!;
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    if (descriptor !== undefined && "value" in descriptor) freezeExactPlainData(descriptor.value);
  }
  SAFE_OBJECT_FREEZE(value);
}

export function detachExactPlainData<T>(
  value: T,
  label: string,
): { readonly value: T; readonly bytes: string } {
  const bytes = exactPlainDataBytes(value, label);
  const detached = SAFE_STRUCTURED_CLONE(value);
  if (exactPlainDataBytes(detached, `${label} detached clone`) !== bytes) {
    throw new SAFE_TYPE_ERROR(`${label} changed while it was detached.`);
  }
  return SAFE_OBJECT_FREEZE({ value: detached, bytes });
}

export function detachAndFreezeExactPlainData<T>(
  value: T,
  label: string,
): { readonly value: T; readonly bytes: string } {
  const detached = detachExactPlainData(value, label);
  freezeExactPlainData(detached.value);
  return detached;
}
