interface LineageEvidenceInputBudget {
  readonly maximumEntries: number;
  consumedEntries: number;
}

export function describeLineageEvidenceValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    const shown = value.length <= 128 ? value : `${value.slice(0, 125)}...`;
    return `${JSON.stringify(shown)}${value.length <= 128 ? "" : ` (${value.length} characters)`}`;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === undefined) {
    return String(value);
  }
  return `<${typeof value}>`;
}

export function createLineageEvidenceInputBudget(
  maximumEntries: number,
): LineageEvidenceInputBudget {
  if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 0) {
    throw new RangeError(
      `Lineage evidence maximumAttempts must be a non-negative safe integer; received ${describeLineageEvidenceValue(maximumEntries)}.`,
    );
  }
  return { maximumEntries, consumedEntries: 0 };
}

export function exactLineageEvidenceRecord(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  let array: boolean;
  try {
    array = Array.isArray(value);
  } catch {
    throw new TypeError(`${path} has a hostile object identity.`);
  }
  if (value === null || typeof value !== "object" || array) {
    throw new TypeError(
      `${path} must be an object; received ${describeLineageEvidenceValue(value)}.`,
    );
  }
  const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of expectedKeys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      throw new TypeError(`${path}.${key} descriptor could not be safely inspected.`);
    }
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${path}.${key} must be an enumerable own data property.`);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

export function denseLineageEvidenceArray(
  value: unknown,
  path: string,
  budget: LineageEvidenceInputBudget,
): readonly unknown[] {
  let array: boolean;
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    array = Array.isArray(value);
    lengthDescriptor =
      value !== null && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, "length")
        : undefined;
  } catch {
    throw new TypeError(`${path} has a hostile array identity or length.`);
  }
  if (!array || lengthDescriptor === undefined || !("value" in lengthDescriptor)) {
    throw new TypeError(`${path} must be a dense array.`);
  }
  const length = lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new TypeError(`${path}.length must be a non-negative safe integer data property.`);
  }
  if (length > budget.maximumEntries - budget.consumedEntries) {
    throw new RangeError(
      `${path} adds ${length} entries after ${budget.consumedEntries}, exceeding maximumAttempts ${budget.maximumEntries}.`,
    );
  }
  budget.consumedEntries += length;
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value as object, String(index));
    } catch {
      throw new TypeError(`${path}[${index}] descriptor could not be safely inspected.`);
    }
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${path}[${index}] must be an enumerable own data property.`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

export function lineageEvidenceString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256) {
    throw new TypeError(`${path} must be a non-empty string of at most 256 characters.`);
  }
  return value;
}

export function lineageEvidenceInteger(value: unknown, path: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new RangeError(
      `${path} must be a safe integer at least ${minimum}; received ${describeLineageEvidenceValue(value)}.`,
    );
  }
  return value as number;
}

export function lineageEvidenceScore(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${path} must be a finite number from 0 through 1.`);
  }
  return Object.is(value, -0) ? 0 : value;
}

export function freezeLineageEvidence<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freezeLineageEvidence(nested);
  return Object.freeze(value);
}
