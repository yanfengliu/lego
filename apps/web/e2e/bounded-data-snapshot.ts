import { types as nodeTypes } from "node:util";

const GET_DESCRIPTORS = Object.getOwnPropertyDescriptors as (
  value: object,
) => PropertyDescriptorMap;
const GET_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const GET_PROTOTYPE = Object.getPrototypeOf;
const OWN_KEYS = Reflect.ownKeys;

/** Snapshots an exact plain object without invoking any caller-owned accessor. */
export function snapshotExactDataObject(
  value: unknown,
  label: string,
  keys: readonly string[],
): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${label} must be one plain data object.`);
  }
  if (nodeTypes.isProxy(value)) {
    throw new TypeError(`${label} may not be a Proxy.`);
  }
  if (Array.isArray(value)) {
    throw new TypeError(`${label} must be one plain data object.`);
  }
  let descriptors: PropertyDescriptorMap;
  let prototype: object | null;
  try {
    descriptors = GET_DESCRIPTORS(value);
    prototype = GET_PROTOTYPE(value) as object | null;
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
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${label}.${key} must be one enumerable own data property.`);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

/** Snapshots a bounded ordinary dense array without consulting its iterator or methods. */
export function snapshotDenseDataArray(
  value: unknown,
  label: string,
  maximumLength: number,
): readonly unknown[] {
  if (value === null || typeof value !== "object" || nodeTypes.isProxy(value)) {
    throw new TypeError(`${label} must be one non-Proxy ordinary dense array.`);
  }
  let descriptors: PropertyDescriptorMap;
  let prototype: object | null;
  let length: unknown;
  try {
    if (!Array.isArray(value)) throw new TypeError(`${label} is not an array.`);
    prototype = GET_PROTOTYPE(value) as object | null;
    const lengthDescriptor = GET_DESCRIPTOR(value, "length");
    length =
      lengthDescriptor !== undefined && "value" in lengthDescriptor
        ? lengthDescriptor.value
        : undefined;
  } catch (error) {
    throw new TypeError(`${label} could not be inspected without invoking hostile traps.`, {
      cause: error,
    });
  }
  if (prototype !== Array.prototype) {
    throw new TypeError(`${label} must use Array.prototype.`);
  }
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maximumLength
  ) {
    throw new RangeError(`${label} must contain at most ${maximumLength} entries.`);
  }
  try {
    descriptors = GET_DESCRIPTORS(value);
  } catch (error) {
    throw new TypeError(`${label} could not be snapshotted without invoking hostile traps.`, {
      cause: error,
    });
  }
  const actualKeys = OWN_KEYS(descriptors);
  if (actualKeys.length !== length + 1 || actualKeys.some((key) => typeof key !== "string")) {
    throw new TypeError(`${label} must contain only length and dense numeric indices.`);
  }
  const snapshot = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${label}[${index}] must be one enumerable own data property.`);
    }
    snapshot[index] = descriptor.value;
  }
  return snapshot;
}
