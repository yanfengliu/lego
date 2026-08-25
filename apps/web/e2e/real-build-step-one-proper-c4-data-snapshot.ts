import * as nodeUtil from "node:util";

const GET_DESCRIPTORS = Object.getOwnPropertyDescriptors as (
  value: object,
) => PropertyDescriptorMap;
const GET_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const GET_PROTOTYPE = Object.getPrototypeOf;
const OWN_KEYS = Reflect.ownKeys;
const BROWSER_OWNED = new WeakSet<object>();
const IS_BROWSER = typeof window !== "undefined";

function brandBrowserJson(value: unknown): void {
  if (!IS_BROWSER || value === null || typeof value !== "object") return;
  BROWSER_OWNED.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) brandBrowserJson(value[index]);
    return;
  }
  const descriptors = GET_DESCRIPTORS(value);
  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key];
    if (descriptor !== undefined && "value" in descriptor) brandBrowserJson(descriptor.value);
  }
}

/** Parses the only caller-controlled browser envelope before any C4 object inspection. */
export function parseRealBuildStepOneProperC4BrowserJson(
  text: unknown,
  label: string,
  maximumCharacters: number,
): unknown {
  if (
    typeof text !== "string" ||
    !Number.isSafeInteger(maximumCharacters) ||
    maximumCharacters < 1 ||
    text.length > maximumCharacters
  ) {
    throw new RangeError(`${label} must be one bounded JSON string.`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new TypeError(`${label} must be valid JSON.`, { cause });
  }
  brandBrowserJson(value);
  return value;
}

/** Creates a browser-owned ordinary object without inspecting any supplied object value. */
export function createRealBuildStepOneProperC4DataObject(
  ...keyValues: readonly unknown[]
): Readonly<Record<string, unknown>> {
  if (keyValues.length % 2 !== 0) {
    throw new TypeError("Proper-C4 owned object construction requires key/value pairs.");
  }
  const result = Object.create(null) as Record<string, unknown>;
  for (let index = 0; index < keyValues.length; index += 2) {
    const key = keyValues[index];
    if (typeof key !== "string" || Object.hasOwn(result, key)) {
      throw new TypeError("Proper-C4 owned object keys must be unique strings.");
    }
    result[key] = keyValues[index + 1];
  }
  if (IS_BROWSER) BROWSER_OWNED.add(result);
  return result;
}

/** Creates a browser-owned dense array from the callee-created rest-argument array. */
export function createRealBuildStepOneProperC4DataArray(
  ...values: readonly unknown[]
): readonly unknown[] {
  if (IS_BROWSER) BROWSER_OWNED.add(values as unknown as object);
  return values;
}

export function requireRealBuildStepOneProperC4DataContainer(
  value: unknown,
  label: string,
): asserts value is object {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${label} must be one non-Proxy ordinary container.`);
  }
  if (IS_BROWSER) {
    if (!BROWSER_OWNED.has(value)) {
      throw new TypeError(
        `${label} must come from the bounded JSON parser or module-owned C4 constructor in a browser.`,
      );
    }
  } else if (nodeUtil.types.isProxy(value)) {
    throw new TypeError(`${label} may not be a Proxy.`);
  }
}

export function snapshotRealBuildStepOneProperC4DataObject(
  value: unknown,
  label: string,
  keys: readonly string[],
): Readonly<Record<string, unknown>> {
  requireRealBuildStepOneProperC4DataContainer(value, label);
  if (Array.isArray(value)) throw new TypeError(`${label} must be one plain data object.`);
  let descriptors: PropertyDescriptorMap;
  let prototype: object | null;
  try {
    descriptors = GET_DESCRIPTORS(value);
    prototype = GET_PROTOTYPE(value) as object | null;
  } catch (cause) {
    throw new TypeError(`${label} could not be inspected without invoking hostile traps.`, {
      cause,
    });
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must use Object.prototype or a null prototype.`);
  }
  const expected = new Set(keys);
  const actualKeys = OWN_KEYS(descriptors);
  if (
    actualKeys.length !== keys.length ||
    actualKeys.some((key) => typeof key !== "string" || !expected.has(key))
  ) {
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

export function snapshotRealBuildStepOneProperC4DataArray(
  value: unknown,
  label: string,
  maximumLength: number,
): readonly unknown[] {
  requireRealBuildStepOneProperC4DataContainer(value, label);
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
    descriptors = GET_DESCRIPTORS(value);
  } catch (cause) {
    throw new TypeError(`${label} could not be inspected without invoking hostile traps.`, {
      cause,
    });
  }
  if (prototype !== Array.prototype) throw new TypeError(`${label} must use Array.prototype.`);
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maximumLength
  ) {
    throw new RangeError(`${label} must contain at most ${maximumLength} entries.`);
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
