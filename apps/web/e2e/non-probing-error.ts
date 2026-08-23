import { types as nodeTypes } from "node:util";

const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_CREATE = Object.create;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_IS_NATIVE_ERROR = nodeTypes.isNativeError;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_REFLECT_DEFINE_PROPERTY = Reflect.defineProperty;
const SAFE_STRING_SLICE = String.prototype.slice;
const SAFE_NUMBER_IS_NAN = Number.isNaN;
const SAFE_POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
const SAFE_NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;
const SAFE_ERROR_CONSTRUCTOR = Error;

export interface NativeErrorOwnData {
  readonly name: string;
  readonly message: string;
}

/** Bounds a primitive string through module-captured intrinsics only. */
export function boundedStringWithoutLivePrototype(value: string, maximum: number): string {
  return SAFE_REFLECT_APPLY(SAFE_STRING_SLICE, value, [0, maximum]);
}

function ownString(value: Error, key: "name" | "message", fallback: string): string {
  try {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    const ownValue =
      descriptor === undefined
        ? undefined
        : SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(descriptor, "value");
    return ownValue !== undefined && typeof ownValue.value === "string"
      ? boundedStringWithoutLivePrototype(ownValue.value, 2_048)
      : fallback;
  } catch {
    return fallback;
  }
}

export function nativeErrorOwnData(value: unknown): NativeErrorOwnData | null {
  try {
    if (!SAFE_IS_NATIVE_ERROR(value)) return null;
  } catch {
    return null;
  }
  return SAFE_OBJECT_FREEZE({
    name: boundedStringWithoutLivePrototype(ownString(value, "name", "Error"), 128),
    message: ownString(
      value,
      "message",
      "A native error was retained without readable own data properties.",
    ),
  });
}

function primitiveFailureMessage(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return boundedStringWithoutLivePrototype(value, 2_048);
  }
  if (value === undefined) return "A thrown undefined value was retained without probing it.";
  if (value === null) return "A thrown null value was retained without probing it.";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (SAFE_NUMBER_IS_NAN(value)) return "NaN";
    if (value === SAFE_POSITIVE_INFINITY) return "Infinity";
    if (value === SAFE_NEGATIVE_INFINITY) return "-Infinity";
    return `${value}`;
  }
  if (typeof value === "bigint") return "A thrown bigint was retained without probing it.";
  if (typeof value === "symbol") return "A thrown symbol was retained without probing it.";
  return fallback;
}

/** Defines an own Error name without consulting a potentially hostile inherited setter. */
export function defineOwnErrorNameWithoutInheritedSetter(error: Error, name: string): void {
  const descriptor = SAFE_OBJECT_CREATE(null) as PropertyDescriptor;
  descriptor.value = name;
  descriptor.writable = true;
  descriptor.enumerable = false;
  descriptor.configurable = true;
  SAFE_REFLECT_DEFINE_PROPERTY(error, "name", descriptor);
}

/** Normalizes a thrown value without prototype traversal, coercion, or property access. */
export function normalizeThrownWithoutProbing(value: unknown, fallback: string): Error {
  const native = nativeErrorOwnData(value);
  const normalized = new SAFE_ERROR_CONSTRUCTOR(
    native?.message ??
      boundedStringWithoutLivePrototype(primitiveFailureMessage(value, fallback), 2_048),
    { cause: value },
  );
  if (native !== null) defineOwnErrorNameWithoutInheritedSetter(normalized, native.name);
  return normalized;
}
