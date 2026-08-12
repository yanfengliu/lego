const MAXIMUM_THROWN_MESSAGE_CHARACTERS = 512;

function boundedThrownString(value: string): string {
  return value.length <= MAXIMUM_THROWN_MESSAGE_CHARACTERS
    ? value
    : `${value.slice(0, MAXIMUM_THROWN_MESSAGE_CHARACTERS - 3)}...`;
}

/**
 * Describes a browser-boundary rejection without invoking caller-owned code.
 *
 * In particular, this never reads `error.message`, coerces an object, walks its
 * prototype, or calls a `toString`/`toJSON` hook. Proxy descriptor traps are
 * contained and string payloads are bounded before they enter retained output.
 */
export function describeBrowserThrown(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return boundedThrownString(value);
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "bigint") return "a thrown bigint";
  if (typeof value === "symbol") return "a thrown symbol";
  if (typeof value !== "object" && typeof value !== "function") return "a thrown value";

  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, "message");
    if (descriptor === undefined) return `a thrown ${typeof value} without an own data message`;
    if (!("value" in descriptor)) return "a thrown object with an accessor message";
    if (typeof descriptor.value === "string") return boundedThrownString(descriptor.value);
    return "a thrown object with a non-string message";
  } catch {
    return "a hostile thrown object whose message descriptor could not be inspected";
  }
}
