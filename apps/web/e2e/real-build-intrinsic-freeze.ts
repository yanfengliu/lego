/** Captured before any hostile real-build input can replace Object.freeze. */
export const intrinsicRealBuildFreeze: typeof Object.freeze = Object.freeze;

const INTRINSIC_ARRAY_IS_ARRAY = Array.isArray;
const INTRINSIC_ARRAY_ITERATOR = Array.prototype[Symbol.iterator];
const INTRINSIC_DEFINE_PROPERTY = Object.defineProperty;
const INTRINSIC_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const INTRINSIC_OBJECT_KEYS = Object.keys;

/** Gives bounded JSON arrays their captured iterator before replay code can spread them. */
export function stabilizeRealBuildJsonArrayIteration(value: unknown): void {
  const pending: unknown[] = [value];
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const current = pending[cursor];
    if (current === null || typeof current !== "object") continue;
    if (INTRINSIC_ARRAY_IS_ARRAY(current)) {
      INTRINSIC_DEFINE_PROPERTY(current, Symbol.iterator, {
        value: INTRINSIC_ARRAY_ITERATOR,
        enumerable: false,
        configurable: false,
        writable: false,
      });
      const length = INTRINSIC_GET_OWN_PROPERTY_DESCRIPTOR(current, "length")?.value;
      if (!Number.isSafeInteger(length) || (length as number) < 0) {
        throw new TypeError("Real-build parsed JSON array has an invalid dense length.");
      }
      for (let index = 0; index < (length as number); index += 1) {
        const descriptor = INTRINSIC_GET_OWN_PROPERTY_DESCRIPTOR(current, String(index));
        if (descriptor === undefined || !("value" in descriptor)) {
          throw new TypeError("Real-build parsed JSON array must contain dense own data entries.");
        }
        pending[pending.length] = descriptor.value;
      }
      continue;
    }
    const keys = INTRINSIC_OBJECT_KEYS(current);
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]!;
      const descriptor = INTRINSIC_GET_OWN_PROPERTY_DESCRIPTOR(current, key);
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new TypeError("Real-build parsed JSON object must contain own data properties.");
      }
      pending[pending.length] = descriptor.value;
    }
  }
}
