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

/** Snapshots only an intrinsic-branded, non-shared Uint8Array without consulting wrappers. */
export function snapshotHostileUint8Array(
  value: unknown,
  input: {
    readonly maximumBytes: number;
    readonly typeError: string;
    readonly oversizeError: (length: number) => string;
    readonly sharedError: string;
    readonly copyError: string;
  },
): Uint8Array {
  let length: number;
  let buffer: ArrayBufferLike;
  try {
    if (
      TYPED_ARRAY_LENGTH === undefined ||
      TYPED_ARRAY_BUFFER === undefined ||
      TYPED_ARRAY_TAG === undefined ||
      TYPED_ARRAY_TAG.call(value) !== "Uint8Array"
    ) {
      throw null;
    }
    length = TYPED_ARRAY_LENGTH.call(value) as number;
    buffer = TYPED_ARRAY_BUFFER.call(value) as ArrayBufferLike;
  } catch {
    throw new TypeError(input.typeError);
  }
  if (length > input.maximumBytes) {
    throw new RangeError(input.oversizeError(length));
  }
  if (SHARED_BYTE_LENGTH !== undefined) {
    let shared = false;
    try {
      SHARED_BYTE_LENGTH.call(buffer);
      shared = true;
    } catch {
      // The SharedArrayBuffer intrinsic rejects ordinary ArrayBuffer storage.
    }
    if (shared) throw new TypeError(input.sharedError);
  }
  const snapshot = new Uint8Array(length);
  try {
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
  } catch {
    throw new TypeError(input.copyError);
  }
  return snapshot;
}
