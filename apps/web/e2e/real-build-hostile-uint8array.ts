const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "length")?.get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const TYPED_ARRAY_TAG = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const SHARED_BYTE_LENGTH =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;
const SAFE_UINT8_ARRAY = Uint8Array;
const SAFE_UINT8_ARRAY_SET = Uint8Array.prototype.set;
const SAFE_REFLECT_APPLY = Reflect.apply;

interface HostileUint8ArrayBounds {
  readonly maximumBytes: number;
  readonly typeError: string;
  readonly oversizeError: (length: number) => string;
  readonly sharedError: string;
}

function inspectHostileUint8Array(
  value: unknown,
  input: HostileUint8ArrayBounds,
): { readonly length: number; readonly buffer: ArrayBufferLike } {
  let length: number;
  let buffer: ArrayBufferLike;
  try {
    if (
      TYPED_ARRAY_LENGTH === undefined ||
      TYPED_ARRAY_BUFFER === undefined ||
      TYPED_ARRAY_TAG === undefined ||
      SAFE_REFLECT_APPLY(TYPED_ARRAY_TAG, value, []) !== "Uint8Array"
    ) {
      throw null;
    }
    length = SAFE_REFLECT_APPLY(TYPED_ARRAY_LENGTH, value, []) as number;
    buffer = SAFE_REFLECT_APPLY(TYPED_ARRAY_BUFFER, value, []) as ArrayBufferLike;
  } catch {
    throw new TypeError(input.typeError);
  }
  if (!Number.isSafeInteger(length) || length < 0) throw new TypeError(input.typeError);
  if (length > input.maximumBytes) {
    throw new RangeError(input.oversizeError(length));
  }
  if (SHARED_BYTE_LENGTH !== undefined) {
    let shared = false;
    try {
      SAFE_REFLECT_APPLY(SHARED_BYTE_LENGTH, buffer, []);
      shared = true;
    } catch {
      // The SharedArrayBuffer intrinsic rejects ordinary ArrayBuffer storage.
    }
    if (shared) throw new TypeError(input.sharedError);
  }
  return { length, buffer };
}

/** Measures a genuine non-shared byte array without allocating or reading any entry. */
export function inspectHostileUint8ArrayLength(
  value: unknown,
  input: HostileUint8ArrayBounds,
): number {
  return inspectHostileUint8Array(value, input).length;
}

/** Snapshots only an intrinsic-branded, non-shared Uint8Array without consulting wrappers. */
export function snapshotHostileUint8Array(
  value: unknown,
  input: HostileUint8ArrayBounds & {
    readonly copyError: string;
  },
): Uint8Array {
  const { length } = inspectHostileUint8Array(value, input);
  const snapshot = new SAFE_UINT8_ARRAY(length);
  try {
    SAFE_REFLECT_APPLY(SAFE_UINT8_ARRAY_SET, snapshot, [value as Uint8Array]);
  } catch {
    throw new TypeError(input.copyError);
  }
  return snapshot;
}

/** Allocates private storage without consulting a potentially poisoned global constructor. */
export function createIntrinsicUint8Array(length: number): Uint8Array {
  return new SAFE_UINT8_ARRAY(length);
}

/** Copies bytes without dynamically resolving a potentially poisoned typed-array method. */
export function setIntrinsicUint8Array(target: Uint8Array, source: Uint8Array, offset = 0): void {
  SAFE_REFLECT_APPLY(SAFE_UINT8_ARRAY_SET, target, [source, offset]);
}
