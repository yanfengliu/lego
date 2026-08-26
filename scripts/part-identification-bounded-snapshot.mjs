import { Buffer } from "node:buffer";
import { types as nodeTypes } from "node:util";

const GET_DESCRIPTORS = Object.getOwnPropertyDescriptors;
const GET_PROTOTYPE = Object.getPrototypeOf;
const OWN_KEYS = Reflect.ownKeys;
const TYPED_ARRAY_PROTOTYPE = GET_PROTOTYPE(Uint8Array.prototype);

function intrinsicTypedArrayGetter(name) {
  const getter = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, name)?.get;
  if (getter === undefined) {
    throw new Error(`This JavaScript runtime has no intrinsic TypedArray ${name} getter.`);
  }
  return getter;
}

const GET_BUFFER = intrinsicTypedArrayGetter("buffer");
const GET_BYTE_LENGTH = intrinsicTypedArrayGetter("byteLength");
const GET_BYTE_OFFSET = intrinsicTypedArrayGetter("byteOffset");

/** Snapshot an exact plain object without invoking caller-owned accessors or Proxy traps. */
export function snapshotExactDataObject(value, label, keys) {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${label} must be one plain data object.`);
  }
  if (nodeTypes.isProxy(value)) {
    throw new TypeError(`${label} may not be a Proxy.`);
  }
  if (Array.isArray(value)) {
    throw new TypeError(`${label} must be one plain data object.`);
  }
  let descriptors;
  let prototype;
  try {
    descriptors = GET_DESCRIPTORS(value);
    prototype = GET_PROTOTYPE(value);
  } catch (error) {
    throw new TypeError(`${label} could not be inspected without invoking hostile traps.`, {
      cause: error,
    });
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must use Object.prototype or a null prototype.`);
  }
  const expected = new Set(keys);
  const actualKeys = OWN_KEYS(descriptors);
  const unexpected = actualKeys.find((key) => typeof key !== "string" || !expected.has(key));
  if (unexpected !== undefined || actualKeys.length !== keys.length) {
    throw new TypeError(`${label} must contain exactly [${keys.join(", ")}].`);
  }
  const snapshot = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${label}.${key} must be one enumerable own data property.`);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function boundedByteView(value, { label, minimumBytes, maximumBytes }) {
  if (nodeTypes.isProxy(value)) {
    throw new TypeError(`${label} may not be a Proxy.`);
  }
  const prototype = value === null || typeof value !== "object" ? null : GET_PROTOTYPE(value);
  if (
    !(value instanceof Uint8Array) ||
    (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype)
  ) {
    throw new TypeError(`${label} must be an ordinary Buffer or Uint8Array.`);
  }
  let backing;
  let byteLength;
  let byteOffset;
  try {
    backing = Reflect.apply(GET_BUFFER, value, []);
    byteLength = Reflect.apply(GET_BYTE_LENGTH, value, []);
    byteOffset = Reflect.apply(GET_BYTE_OFFSET, value, []);
  } catch (error) {
    throw new TypeError(`${label} must have a live intrinsic Uint8Array view.`, { cause: error });
  }
  if (typeof SharedArrayBuffer !== "undefined" && backing instanceof SharedArrayBuffer) {
    throw new TypeError(`${label} may not use SharedArrayBuffer backing.`);
  }
  if (
    !(backing instanceof ArrayBuffer) ||
    typeof byteLength !== "number" ||
    !Number.isSafeInteger(byteLength) ||
    typeof byteOffset !== "number" ||
    !Number.isSafeInteger(byteOffset)
  ) {
    throw new TypeError(`${label} must use one live local ArrayBuffer view.`);
  }
  if (byteLength < minimumBytes || byteLength > maximumBytes) {
    throw new RangeError(
      `${label} has ${byteLength} bytes; expected ${minimumBytes} through ${maximumBytes}.`,
    );
  }
  return { backing, byteLength, byteOffset };
}

/** Snapshot local bytes only after intrinsic view bounds are known. */
export function snapshotBoundedUint8Array(value, bounds) {
  const view = boundedByteView(value, bounds);
  try {
    return Buffer.from(new Uint8Array(view.backing, view.byteOffset, view.byteLength));
  } catch (error) {
    throw new TypeError(`${bounds.label} could not be copied from its bounded ArrayBuffer view.`, {
      cause: error,
    });
  }
}

export function snapshotBoundedString(value, { label, minimumCharacters, maximumCharacters }) {
  if (
    typeof value !== "string" ||
    value.length < minimumCharacters ||
    value.length > maximumCharacters
  ) {
    throw new TypeError(
      `${label} must be a primitive string of ${minimumCharacters} through ${maximumCharacters} characters.`,
    );
  }
  return value;
}
