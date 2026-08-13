import { Buffer } from "node:buffer";
import { types as nodeTypes } from "node:util";

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;

function intrinsicTypedArrayGetter(
  name: "buffer" | "byteLength" | "byteOffset",
): (this: Uint8Array) => unknown {
  const getter = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, name)?.get;
  if (getter === undefined) {
    throw new Error(`This JavaScript runtime has no intrinsic TypedArray ${name} getter.`);
  }
  return getter as (this: Uint8Array) => unknown;
}

const GET_BUFFER = intrinsicTypedArrayGetter("buffer");
const GET_BYTE_LENGTH = intrinsicTypedArrayGetter("byteLength");
const GET_BYTE_OFFSET = intrinsicTypedArrayGetter("byteOffset");

/** Snapshots local bytes without consulting shadowable typed-array instance properties. */
export function snapshotBoundedUint8Array(
  value: unknown,
  input: {
    readonly label: string;
    readonly minimumBytes: number;
    readonly maximumBytes: number;
  },
): Buffer {
  if (nodeTypes.isProxy(value)) {
    throw new TypeError(`${input.label} may not be a Proxy.`);
  }
  const prototype =
    value === null || typeof value !== "object" ? null : Object.getPrototypeOf(value);
  if (
    !(value instanceof Uint8Array) ||
    (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype)
  ) {
    throw new TypeError(`${input.label} must be an ordinary Buffer or Uint8Array.`);
  }
  let backing: unknown;
  let byteLength: unknown;
  let byteOffset: unknown;
  try {
    backing = Reflect.apply(GET_BUFFER, value, []);
    byteLength = Reflect.apply(GET_BYTE_LENGTH, value, []);
    byteOffset = Reflect.apply(GET_BYTE_OFFSET, value, []);
  } catch (error) {
    throw new TypeError(`${input.label} must have a live intrinsic Uint8Array view.`, {
      cause: error,
    });
  }
  if (typeof SharedArrayBuffer !== "undefined" && backing instanceof SharedArrayBuffer) {
    throw new TypeError(`${input.label} may not use SharedArrayBuffer backing.`);
  }
  if (
    !(backing instanceof ArrayBuffer) ||
    typeof byteLength !== "number" ||
    !Number.isSafeInteger(byteLength) ||
    typeof byteOffset !== "number" ||
    !Number.isSafeInteger(byteOffset)
  ) {
    throw new TypeError(`${input.label} must use one live local ArrayBuffer view.`);
  }
  if (byteLength < input.minimumBytes || byteLength > input.maximumBytes) {
    throw new RangeError(
      `${input.label} has ${byteLength} bytes; expected ${input.minimumBytes} through ${input.maximumBytes}.`,
    );
  }
  try {
    return Buffer.from(new Uint8Array(backing, byteOffset, byteLength));
  } catch (error) {
    throw new TypeError(`${input.label} could not be copied from its bounded ArrayBuffer view.`, {
      cause: error,
    });
  }
}
