const MAXIMUM_THROWN_MESSAGE_CHARACTERS = 512;
const NON_PRIMITIVE_THROWN_FALLBACK = "a thrown non-primitive value";
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_STRING_SLICE = String.prototype.slice;
const SAFE_NUMBER_TO_STRING = Number.prototype.toString;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_ERROR_CONSTRUCTOR = Error;
const SAFE_ERROR_IS_ERROR = (
  SAFE_ERROR_CONSTRUCTOR as ErrorConstructor & {
    readonly isError?: (value: unknown) => boolean;
  }
).isError;

function boundedThrownString(value: string): string {
  return value.length <= MAXIMUM_THROWN_MESSAGE_CHARACTERS
    ? value
    : `${SAFE_REFLECT_APPLY(SAFE_STRING_SLICE, value, [
        0,
        MAXIMUM_THROWN_MESSAGE_CHARACTERS - 3,
      ])}...`;
}

function boundedNativeErrorMessage(value: unknown): string | null {
  if (SAFE_ERROR_IS_ERROR === undefined) return null;
  try {
    if (!SAFE_REFLECT_APPLY(SAFE_ERROR_IS_ERROR, SAFE_ERROR_CONSTRUCTOR, [value])) return null;
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, "message");
    const ownValue =
      descriptor === undefined
        ? undefined
        : SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(descriptor, "value");
    return ownValue !== undefined && typeof ownValue.value === "string"
      ? boundedThrownString(ownValue.value)
      : null;
  } catch {
    return null;
  }
}

/**
 * Describes a browser-boundary rejection without invoking caller-owned code.
 *
 * A brand-checked native Error may contribute only its own data-property string
 * message. Every other non-primitive receives one fixed fallback without
 * coercion or prototype traversal. All inspection uses module-captured intrinsics.
 */
export function describeBrowserThrown(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return boundedThrownString(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return SAFE_REFLECT_APPLY(SAFE_NUMBER_TO_STRING, value, []);
  }
  if (typeof value === "bigint") return "a thrown bigint";
  if (typeof value === "symbol") return "a thrown symbol";
  const nativeErrorMessage = boundedNativeErrorMessage(value);
  if (nativeErrorMessage !== null) return nativeErrorMessage;
  return NON_PRIMITIVE_THROWN_FALLBACK;
}
