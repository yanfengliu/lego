export type SnapshotReject = (label: string, problem: string, remedy: string) => never;

export interface DenseArraySnapshotOptions {
  readonly exactLength?: number;
  readonly maximumLength: number;
  readonly accepts: (component: unknown) => boolean;
  readonly expectedComponent: string;
}

/** Captures each public array component once from its own data descriptor. */
export function snapshotDenseOwnDataArray(
  value: unknown,
  label: string,
  options: DenseArraySnapshotOptions,
  reject: SnapshotReject,
): readonly unknown[] {
  let prototype: object | null;
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    if (!Array.isArray(value)) {
      return reject(label, "value is not an array", "supply detached inert array data");
    }
    prototype = Object.getPrototypeOf(value) as object | null;
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    return reject(
      label,
      "array identity or length inspection triggered hostile behavior",
      "copy it into an inert plain array first",
    );
  }
  if (prototype !== Array.prototype || !lengthDescriptor || !("value" in lengthDescriptor)) {
    return reject(label, "value is not a plain own-data array", "supply a normal detached array");
  }
  const length = lengthDescriptor.value as unknown;
  if (!Number.isSafeInteger(length) || (length as number) < 0) {
    return reject(label, "array length is invalid", "supply a normal dense array");
  }
  if (
    (options.exactLength !== undefined && length !== options.exactLength) ||
    (length as number) > options.maximumLength
  ) {
    return reject(
      label,
      `array length is outside ${options.exactLength ?? `0..${options.maximumLength}`}`,
      "apply the length cap before validation",
    );
  }

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value as object);
  } catch {
    return reject(
      label,
      "enumerating array keys triggered hostile behavior",
      "copy it into an inert plain array first",
    );
  }
  const expectedKeys = new Set([
    ...Array.from({ length: length as number }, (_, index) => String(index)),
    "length",
  ]);
  if (
    keys.length !== expectedKeys.size ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.has(key))
  ) {
    return reject(
      label,
      "array is sparse or has symbols, hidden fields, or extra properties",
      "supply only dense indexed data",
    );
  }

  const snapshot: unknown[] = [];
  for (let index = 0; index < (length as number); index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      return reject(
        `${label}[${index}]`,
        "component inspection triggered hostile behavior",
        "copy it into an inert own data property first",
      );
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return reject(
        `${label}[${index}]`,
        "component is missing, hidden, or accessor-backed",
        "supply an enumerable own data property",
      );
    }
    if (!options.accepts(descriptor.value)) {
      return reject(
        `${label}[${index}]`,
        `component is not ${options.expectedComponent}`,
        `supply ${options.expectedComponent} data only`,
      );
    }
    snapshot.push(descriptor.value);
  }
  return Object.freeze(snapshot);
}

/** Captures each expected public record field once from its own data descriptor. */
export function snapshotExactOwnDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
  reject: SnapshotReject,
): Readonly<Record<string, unknown>> {
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return reject(label, "value is not a record", "supply detached inert record data");
    }
    prototype = Object.getPrototypeOf(value) as object | null;
    keys = Reflect.ownKeys(value);
  } catch {
    return reject(
      label,
      "record inspection triggered hostile behavior",
      "copy it into an inert plain record first",
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    return reject(
      label,
      "record has a custom prototype, symbol, missing field, or extra field",
      `supply exactly ${expectedKeys.join(" and ")} as own data fields`,
    );
  }

  const snapshot: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return reject(
        `${label}.${key}`,
        "field inspection triggered hostile behavior",
        "copy it into an inert own data property first",
      );
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return reject(
        `${label}.${key}`,
        "field is hidden or accessor-backed",
        "supply an enumerable own data property",
      );
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}
