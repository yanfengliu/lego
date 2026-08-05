const MAXIMUM_JSON_DEPTH = 32;
const MAXIMUM_JSON_NODES = 4_096;

interface CopyState {
  readonly seen: WeakSet<object>;
  nodes: number;
  worstCaseBytes: number;
}

function consumeWorstCase(
  state: CopyState,
  bytes: number,
  maximumBytes: number,
  label: string,
): void {
  state.worstCaseBytes += bytes;
  if (state.worstCaseBytes > maximumBytes) {
    throw new TypeError(
      `${label} exceeds its ${maximumBytes}-byte serialized bound before JSON encoding. Reduce the bounded environment instead of raising the limit.`,
    );
  }
}

function copyJsonValue(
  value: unknown,
  depth: number,
  state: CopyState,
  maximumBytes: number,
  label: string,
): unknown {
  if (depth > MAXIMUM_JSON_DEPTH) {
    throw new TypeError(`${label} exceeds the ${MAXIMUM_JSON_DEPTH}-level JSON depth bound.`);
  }
  if (value === null) {
    consumeWorstCase(state, 4, maximumBytes, label);
    return null;
  }
  if (typeof value === "string") {
    consumeWorstCase(state, value.length * 6 + 2, maximumBytes, label);
    return value;
  }
  if (typeof value === "boolean") {
    consumeWorstCase(state, 5, maximumBytes, label);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${label} contains a non-finite number.`);
    consumeWorstCase(state, 32, maximumBytes, label);
    return value;
  }
  if (typeof value !== "object") {
    throw new TypeError(`${label} contains a non-JSON ${typeof value} value.`);
  }
  if (state.seen.has(value)) throw new TypeError(`${label} contains a JSON cycle.`);
  state.seen.add(value);
  state.nodes += 1;
  if (state.nodes > MAXIMUM_JSON_NODES) {
    throw new TypeError(`${label} exceeds the ${MAXIMUM_JSON_NODES}-node JSON work bound.`);
  }
  consumeWorstCase(state, 2, maximumBytes, label);
  if (Array.isArray(value)) {
    if (value.length > MAXIMUM_JSON_NODES - state.nodes) {
      throw new TypeError(`${label} array exceeds the remaining bounded JSON work.`);
    }
    const copied = new Array<unknown>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      consumeWorstCase(state, 1, maximumBytes, label);
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined) continue;
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new TypeError(`${label} array index ${index} may not be an accessor.`);
      }
      copied[index] = copyJsonValue(descriptor.value, depth + 1, state, maximumBytes, label);
    }
    return copied;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must contain only plain JSON objects.`);
  }
  const copied = Object.create(null) as Record<string, unknown>;
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    state.nodes += 1;
    if (state.nodes > MAXIMUM_JSON_NODES) {
      throw new TypeError(`${label} exceeds the ${MAXIMUM_JSON_NODES}-node JSON work bound.`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || descriptor.get !== undefined || descriptor.set !== undefined) {
      throw new TypeError(`${label} property ${JSON.stringify(key)} may not be an accessor.`);
    }
    consumeWorstCase(state, key.length * 6 + 4, maximumBytes, label);
    Object.defineProperty(copied, key, {
      value: copyJsonValue(descriptor.value, depth + 1, state, maximumBytes, label),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return copied;
}

/** Copies and encodes bounded plain JSON without first stringifying an unbounded object graph. */
export function encodeBoundedJson(value: unknown, maximumBytes: number, label: string): Buffer {
  const bounded = copyJsonValue(
    value,
    0,
    { seen: new WeakSet(), nodes: 0, worstCaseBytes: 0 },
    maximumBytes,
    label,
  );
  const bytes = Buffer.from(JSON.stringify(bounded));
  if (bytes.length > maximumBytes) {
    throw new TypeError(`${label} encoded to ${bytes.length} bytes; maximum is ${maximumBytes}.`);
  }
  return bytes;
}
