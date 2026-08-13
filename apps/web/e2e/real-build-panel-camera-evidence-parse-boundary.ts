interface EvidenceInputBudget {
  readonly maximumEntries: number;
  consumedEntries: number;
}

const keyName = (key: PropertyKey): string => {
  if (typeof key === "symbol") return "<symbol key>";
  if (typeof key === "number") return String(key);
  const preview = key.length <= 128 ? key : `${key.slice(0, 125)}...`;
  return `${JSON.stringify(preview)}${key.length <= 128 ? "" : ` (${key.length} characters)`}`;
};

export function describeEvidenceValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return typeof value === "number" && !Number.isFinite(value) ? String(value) : String(value);
  }
  if (typeof value === "string") {
    const preview = value.length <= 256 ? value : `${value.slice(0, 253)}...`;
    return `${JSON.stringify(preview)}${value.length <= 256 ? "" : ` (${value.length} characters)`}`;
  }
  if (typeof value === "bigint" || typeof value === "symbol") return String(value);
  if (typeof value === "function") return "<function>";
  try {
    if (Array.isArray(value)) {
      const length = Object.getOwnPropertyDescriptor(value, "length");
      return `<array length=${String(length?.value ?? "unknown")}>`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return "<non-plain object>";
    const keys = Reflect.ownKeys(value);
    if (keys.length > 16 || keys.some((key) => typeof key !== "string")) {
      return `<object keys=${keys.length}>`;
    }
    return `<object keys=${keys.map(keyName).join(",")}>`;
  } catch {
    return "<hostile object>";
  }
}

export function createEvidenceInputBudget(maximumEntries: number): EvidenceInputBudget {
  if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 0) {
    throw new RangeError(
      `Panel-camera evidence maximumEntries must be a non-negative safe integer; received ${describeEvidenceValue(maximumEntries)}.`,
    );
  }
  return { maximumEntries, consumedEntries: 0 };
}

export function exactEvidenceRecord(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object; received ${describeEvidenceValue(value)}.`);
  }
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    throw new TypeError(`${path} keys could not be inspected; the thrown value was discarded.`);
  }
  const missing = expectedKeys.find((key) => !keys.includes(key));
  if (missing !== undefined) {
    throw new TypeError(
      `${path} is missing ${JSON.stringify(missing)}; required exactly ${expectedKeys.join(", ")}.`,
    );
  }
  const unexpected = keys.find((key) => typeof key !== "string" || !expectedKeys.includes(key));
  if (unexpected !== undefined) {
    throw new TypeError(
      `${path} has unexpected key ${keyName(unexpected)}; allowed exactly ${expectedKeys.join(", ")}.`,
    );
  }
  const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(
        `${path}.${key} must be an own data property; accessors are not accepted.`,
      );
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

export function denseEvidenceArray(
  value: unknown,
  path: string,
  budget: EvidenceInputBudget,
): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array; received ${describeEvidenceValue(value)}.`);
  }
  const length = value.length;
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new TypeError(`${path}.length must be a non-negative safe integer.`);
  }
  if (length > budget.maximumEntries - budget.consumedEntries) {
    throw new RangeError(
      `${path} adds ${length} entries after ${budget.consumedEntries}, exceeding maximumEntries ${budget.maximumEntries}; pass a larger explicit maximum only for an independently bounded artifact.`,
    );
  }
  const keys = Reflect.ownKeys(value);
  const unexpected = keys.find((key) => {
    if (key === "length") return false;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/u.test(key)) return true;
    return Number(key) >= length;
  });
  if (unexpected !== undefined) {
    throw new TypeError(`${path} has unexpected array key ${keyName(unexpected)}.`);
  }
  const snapshot: unknown[] = [];
  budget.consumedEntries += length;
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) {
      throw new TypeError(`${path}[${index}] is missing; required a dense array.`);
    }
    if (!("value" in descriptor)) {
      throw new TypeError(
        `${path}[${index}] must be an own data property; accessors are not accepted.`,
      );
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

export function evidenceString(value: unknown, path: string, maximumLength: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximumLength) {
    throw new TypeError(
      `${path} must be a non-empty string of at most ${maximumLength} characters; received ${describeEvidenceValue(value)}.`,
    );
  }
  return value;
}

export function evidenceSafeInteger(value: unknown, path: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new RangeError(
      `${path} must be a safe integer at least ${minimum}; received ${describeEvidenceValue(value)}.`,
    );
  }
  return value as number;
}

export function evidenceUnitInterval(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(
      `${path} must be a finite number from 0 through 1; received ${describeEvidenceValue(value)}.`,
    );
  }
  return value === 0 ? 0 : value;
}

export function evidenceIntegerPair(value: unknown, path: string): readonly [number, number] {
  const privateBudget = createEvidenceInputBudget(2);
  const values = denseEvidenceArray(value, path, privateBudget);
  if (values.length !== 2) {
    throw new RangeError(
      `${path} must contain exactly two safe integers; received ${values.length}.`,
    );
  }
  return Object.freeze([
    evidenceSafeIntegerMagnitude(values[0], `${path}[0]`),
    evidenceSafeIntegerMagnitude(values[1], `${path}[1]`),
  ] as [number, number]);
}

export function evidenceFinitePair(value: unknown, path: string): readonly [number, number] {
  const privateBudget = createEvidenceInputBudget(2);
  const values = denseEvidenceArray(value, path, privateBudget);
  if (values.length !== 2) {
    throw new RangeError(
      `${path} must contain exactly two finite numbers; received ${values.length}.`,
    );
  }
  return Object.freeze([
    evidenceFiniteNumber(values[0], `${path}[0]`),
    evidenceFiniteNumber(values[1], `${path}[1]`),
  ] as [number, number]);
}

export function evidenceFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${path} must be finite; received ${describeEvidenceValue(value)}.`);
  }
  return value === 0 ? 0 : value;
}

function evidenceSafeIntegerMagnitude(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(
      `${path} must be a safe integer; received ${describeEvidenceValue(value)}.`,
    );
  }
  return value === 0 ? 0 : (value as number);
}

export function freezeEvidence<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const nested of Object.values(value)) freezeEvidence(nested);
  return Object.freeze(value);
}
