export function readLineageAdapterDataProperty(
  input: unknown,
  key: string,
  label: string,
  optional = false,
): unknown {
  if (input === null || typeof input !== "object") {
    throw new TypeError(`${label} must be an in-process data object.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(input, key);
  } catch {
    throw new TypeError(`${label}.${key} descriptor could not be safely inspected.`);
  }
  if (descriptor === undefined && optional) return undefined;
  if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
    throw new TypeError(`${label}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

export function snapshotLineageAdapterDenseArray(
  value: unknown,
  label: string,
  maximumLength: number,
): readonly unknown[] {
  let isArray: boolean;
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    isArray = Array.isArray(value);
    lengthDescriptor =
      value !== null && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, "length")
        : undefined;
  } catch {
    throw new TypeError(`${label} identity or length could not be safely inspected.`);
  }
  const length = lengthDescriptor?.value;
  if (!isArray || !Number.isSafeInteger(length) || length < 0 || length > maximumLength) {
    throw new RangeError(
      `${label} must be a dense data array with at most ${maximumLength} entries.`,
    );
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value as object, String(index));
    } catch {
      throw new TypeError(`${label}[${index}] descriptor could not be safely inspected.`);
    }
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${label}[${index}] must be an enumerable own data property.`);
    }
    snapshot.push(descriptor.value);
  }
  return Object.freeze(snapshot);
}
