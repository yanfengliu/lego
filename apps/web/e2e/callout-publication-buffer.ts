import { isProxy } from "node:util/types";

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)!.get!;
const UINT8_SET = Uint8Array.prototype.set;
const BUFFER_FROM = Buffer.from;

/** Copies exact Buffer internal-slot bytes without consulting caller length, iteration, or species hooks. */
export function snapshotBoundedBuffer(
  value: unknown,
  label: string,
  maximumBytes: number,
  beforeCopy: (byteLength: number) => void = () => undefined,
): Buffer {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error(`${label} maximum byte count must be one positive safe integer.`);
  }
  if (value === null || typeof value !== "object" || isProxy(value) || !Buffer.isBuffer(value)) {
    throw new Error(`${label} must be one non-Proxy Buffer.`);
  }
  if (Object.getOwnPropertyDescriptor(value, "length") !== undefined) {
    throw new Error(`${label} must not decorate its intrinsic byte length.`);
  }
  const byteLength = Reflect.apply(BYTE_LENGTH_GETTER, value, []) as number;
  if (byteLength < 1 || byteLength > maximumBytes) {
    throw new Error(`${label} must contain 1..${maximumBytes} intrinsic Buffer bytes.`);
  }
  beforeCopy(byteLength);
  const detached = new Uint8Array(byteLength);
  Reflect.apply(UINT8_SET, detached, [value]);
  return Reflect.apply(BUFFER_FROM, Buffer, [detached.buffer, 0, byteLength]) as Buffer;
}
