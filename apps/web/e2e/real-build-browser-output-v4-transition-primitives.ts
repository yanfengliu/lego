import * as nodeUtilTypes from "node:util/types";

const ARRAY_IS_ARRAY = Array.isArray;
const ARRAY_PUSH = Array.prototype.push;
const GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const IS_PROXY = nodeUtilTypes.isProxy;
const REFLECT_APPLY = Reflect.apply;
const SET_ADD = Set.prototype.add;
const SET_HAS = Set.prototype.has;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_HAS = WeakSet.prototype.has;

function proxyFreeObject(value: unknown, path: string): value is object {
  if (value === null || typeof value !== "object" || IS_PROXY(value)) {
    throw new TypeError(`${path} must be a non-Proxy object of stable own data properties.`);
  }
  return true;
}

export function realBuildBrowserOutputV4TransitionData(
  value: unknown,
  key: string,
  path: string,
): unknown {
  proxyFreeObject(value, path);
  if (ARRAY_IS_ARRAY(value)) throw new TypeError(`${path} must be a data object.`);
  const descriptor = GET_OWN_PROPERTY_DESCRIPTOR(value, key);
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${path}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

export function realBuildBrowserOutputV4TransitionArrayLength(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  proxyFreeObject(value, path);
  const length = GET_OWN_PROPERTY_DESCRIPTOR(value, "length")?.value;
  if (
    !ARRAY_IS_ARRAY(value) ||
    !Number.isSafeInteger(length) ||
    (length as number) < minimum ||
    (length as number) > maximum
  ) {
    throw new RangeError(`${path} must contain ${minimum} through ${maximum} dense entries.`);
  }
  return length as number;
}

export function realBuildBrowserOutputV4TransitionArrayEntry(
  value: unknown,
  index: number,
  path: string,
): unknown {
  proxyFreeObject(value, path);
  const descriptor = GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${path}[${index}] must be an enumerable own data property.`);
  }
  return descriptor.value;
}

export function realBuildBrowserOutputV4TransitionDenseArray(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): readonly unknown[] {
  const length = realBuildBrowserOutputV4TransitionArrayLength(value, path, minimum, maximum);
  const retained: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    REFLECT_APPLY(ARRAY_PUSH, retained, [
      realBuildBrowserOutputV4TransitionArrayEntry(value, index, path),
    ]);
  }
  return retained;
}

export function realBuildBrowserOutputV4TransitionWeakSetAdd(
  set: WeakSet<object>,
  value: object,
): void {
  REFLECT_APPLY(WEAK_SET_ADD, set, [value]);
}

export function realBuildBrowserOutputV4TransitionWeakSetHas(
  set: WeakSet<object>,
  value: object,
): boolean {
  return REFLECT_APPLY(WEAK_SET_HAS, set, [value]) as boolean;
}

export function realBuildBrowserOutputV4TransitionSetAdd<T>(set: Set<T>, value: T): void {
  REFLECT_APPLY(SET_ADD, set, [value]);
}

export function realBuildBrowserOutputV4TransitionSetHas<T>(set: Set<T>, value: T): boolean {
  return REFLECT_APPLY(SET_HAS, set, [value]) as boolean;
}
