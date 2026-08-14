import { isProxy } from "node:util/types";

// Capture every intrinsic used after module initialization. Publication input
// is untrusted, so a caller must not be able to turn a later prototype/static
// monkey-patch into code execution while the snapshot is being taken.
const ARRAY_CONSTRUCTOR = Array;
const ARRAY_IS_ARRAY = Array.isArray;
const ARRAY_PROTOTYPE = Array.prototype;
const BUFFER_BYTE_LENGTH = Buffer.byteLength;
const ERROR_CONSTRUCTOR = Error;
const JSON_STRINGIFY = JSON.stringify;
const NUMBER_IS_FINITE = Number.isFinite;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const OBJECT_CREATE = Object.create;
const OBJECT_DEFINE_PROPERTY = Object.defineProperty;
const OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const OBJECT_HAS_OWN = Object.hasOwn;
const OBJECT_IS = Object.is;
const OBJECT_PROTOTYPE = Object.prototype;
const REFLECT_APPLY = Reflect.apply;
const STRING_CHAR_CODE_AT = String.prototype.charCodeAt;
const STRING_SLICE = String.prototype.slice;
const WEAK_SET_CONSTRUCTOR = WeakSet;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_DELETE = WeakSet.prototype.delete;
const WEAK_SET_HAS = WeakSet.prototype.has;

/**
 * Structural ceilings applied before the detached value can reach
 * `JSON.stringify`. The byte ceiling remains caller-selected, but is itself
 * capped so a mistaken publication limit cannot turn snapshotting into an
 * unbounded allocation.
 */
export const STRICT_JSON_SNAPSHOT_LIMITS = Object.freeze({
  maxBytes: 64 * 1024 * 1024,
  maxDepth: 64,
  maxNodes: 150_000,
  maxProperties: 200_000,
  maxPropertiesPerObject: 20_000,
  maxArrayLength: 2_000,
  maxStringBytes: 8 * 1024 * 1024,
  maxKeyBytes: 64 * 1024,
  maxLabelCharacters: 200,
  maxDiagnosticPathCharacters: 512,
});

interface SnapshotState {
  readonly label: string;
  readonly maximumBytes: number;
  readonly maximumNodes: number;
  readonly active: WeakSet<object>;
  readonly path: (string | number)[];
  nodes: number;
  properties: number;
  encodedBytes: number;
}

function renderedPath(state: SnapshotState): string {
  let result = state.label;
  for (let index = 0; index < state.path.length; index += 1) {
    const segment = state.path[index]!;
    let renderedSegment: string;
    if (typeof segment === "number") {
      renderedSegment = `[${segment}]`;
    } else if (isSimpleIdentifier(segment)) {
      renderedSegment = `.${segment}`;
    } else {
      // Bound the intermediate escaped string as well as the final diagnostic.
      // JSON_STRINGIFY is captured and receives only a primitive string.
      const boundedSegment =
        segment.length > STRICT_JSON_SNAPSHOT_LIMITS.maxDiagnosticPathCharacters
          ? `${stringSlice(segment, 0, STRICT_JSON_SNAPSHOT_LIMITS.maxDiagnosticPathCharacters)}…`
          : segment;
      renderedSegment = `[${JSON_STRINGIFY(boundedSegment)}]`;
    }
    const available = STRICT_JSON_SNAPSHOT_LIMITS.maxDiagnosticPathCharacters - result.length;
    if (renderedSegment.length > available) {
      if (available > 0) {
        result += available === 1 ? "…" : `${stringSlice(renderedSegment, 0, available - 1)}…`;
      }
      break;
    }
    result += renderedSegment;
  }
  return result;
}

function stringCharCodeAt(value: string, index: number): number {
  return REFLECT_APPLY(STRING_CHAR_CODE_AT, value, [index]) as number;
}

function stringSlice(value: string, start: number, end?: number): string {
  return REFLECT_APPLY(STRING_SLICE, value, end === undefined ? [start] : [start, end]) as string;
}

function isSimpleIdentifier(value: string): boolean {
  if (value.length === 0) return false;
  const first = stringCharCodeAt(value, 0);
  const firstAccepted =
    (first >= 0x41 && first <= 0x5a) ||
    (first >= 0x61 && first <= 0x7a) ||
    first === 0x24 ||
    first === 0x5f;
  if (!firstAccepted) return false;
  for (let index = 1; index < value.length; index += 1) {
    const codeUnit = stringCharCodeAt(value, index);
    if (!(
      (codeUnit >= 0x41 && codeUnit <= 0x5a) ||
      (codeUnit >= 0x61 && codeUnit <= 0x7a) ||
      (codeUnit >= 0x30 && codeUnit <= 0x39) ||
      codeUnit === 0x24 ||
      codeUnit === 0x5f
    )) {
      return false;
    }
  }
  return true;
}

function fail(state: SnapshotState, detail: string): never {
  throw new ERROR_CONSTRUCTOR(`${renderedPath(state)} ${detail}`);
}

function atPath<T>(state: SnapshotState, segment: string | number, operation: () => T): T {
  const previousLength = state.path.length;
  state.path[previousLength] = segment;
  try {
    return operation();
  } finally {
    state.path.length = previousLength;
  }
}

function addEncodedBytes(state: SnapshotState, bytes: number): void {
  const next = state.encodedBytes + bytes;
  if (!NUMBER_IS_SAFE_INTEGER(next) || next > state.maximumBytes) {
    fail(state, `strict JSON snapshot exceeds its ${state.maximumBytes}-byte UTF-8 ceiling.`);
  }
  state.encodedBytes = next;
}

function countNode(state: SnapshotState): void {
  state.nodes += 1;
  if (state.nodes > state.maximumNodes) {
    fail(state, `strict JSON snapshot exceeds ${state.maximumNodes} nodes.`);
  }
}

function countProperties(state: SnapshotState, count: number): void {
  const next = state.properties + count;
  if (!NUMBER_IS_SAFE_INTEGER(next) || next > STRICT_JSON_SNAPSHOT_LIMITS.maxProperties) {
    fail(
      state,
      `strict JSON snapshot exceeds ${STRICT_JSON_SNAPSHOT_LIMITS.maxProperties} properties.`,
    );
  }
  state.properties = next;
}

function encodedStringBytes(value: string): number {
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = stringCharCodeAt(value, index);
    if (codeUnit === 0x22 || codeUnit === 0x5c) {
      bytes += 2;
    } else if (
      codeUnit === 0x08 ||
      codeUnit === 0x09 ||
      codeUnit === 0x0a ||
      codeUnit === 0x0c ||
      codeUnit === 0x0d
    ) {
      bytes += 2;
    } else if (codeUnit <= 0x1f) {
      bytes += 6;
    } else if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = stringCharCodeAt(value, index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 6;
      }
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      bytes += 6;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function assertBoundedString(value: string, state: SnapshotState, kind: "key" | "value"): void {
  const maximum =
    kind === "key"
      ? STRICT_JSON_SNAPSHOT_LIMITS.maxKeyBytes
      : STRICT_JSON_SNAPSHOT_LIMITS.maxStringBytes;
  // UTF-8 never needs fewer bytes than a JavaScript string has UTF-16 code
  // units. Refuse this cheap lower bound before Buffer.byteLength scans an
  // arbitrarily large hostile string.
  if (value.length > maximum) {
    fail(state, `strict JSON ${kind} exceeds its ${maximum}-byte UTF-8 ceiling.`);
  }
  const bytes = BUFFER_BYTE_LENGTH(value);
  if (bytes > maximum) {
    fail(state, `strict JSON ${kind} exceeds its ${maximum}-byte UTF-8 ceiling.`);
  }
}

function snapshotPrimitive(value: unknown, state: SnapshotState): null | boolean | number | string {
  if (value === null) {
    addEncodedBytes(state, 4);
    return null;
  }
  if (typeof value === "boolean") {
    addEncodedBytes(state, value ? 4 : 5);
    return value;
  }
  if (typeof value === "number") {
    if (!NUMBER_IS_FINITE(value)) {
      fail(state, "strict JSON snapshot contains a non-finite number.");
    }
    const normalized = OBJECT_IS(value, -0) ? 0 : value;
    addEncodedBytes(state, `${normalized}`.length);
    return normalized;
  }
  if (typeof value === "string") {
    assertBoundedString(value, state, "value");
    addEncodedBytes(state, encodedStringBytes(value));
    return value;
  }
  fail(
    state,
    `strict JSON snapshot contains unsupported ${typeof value}; only JSON primitives, plain objects, and dense arrays are accepted.`,
  );
}

function assertDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  state: SnapshotState,
  requireEnumerable: boolean,
): asserts descriptor is PropertyDescriptor & { readonly value: unknown } {
  if (descriptor === undefined || !("value" in descriptor)) {
    fail(state, "strict JSON snapshot contains an accessor or unstable property.");
  }
  if (requireEnumerable && descriptor.enumerable !== true) {
    fail(state, "strict JSON object contains a non-enumerable property.");
  }
}

function snapshotArray(value: unknown[], depth: number, state: SnapshotState): unknown[] {
  const length = atPath(state, "length", () => {
    const lengthDescriptor = OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, "length");
    assertDataDescriptor(lengthDescriptor, state, false);
    if (!NUMBER_IS_SAFE_INTEGER(lengthDescriptor.value) || (lengthDescriptor.value as number) < 0) {
      fail(state, "strict JSON array has an invalid length data property.");
    }
    if ((lengthDescriptor.value as number) > STRICT_JSON_SNAPSHOT_LIMITS.maxArrayLength) {
      fail(
        state,
        `strict JSON array length exceeds ${STRICT_JSON_SNAPSHOT_LIMITS.maxArrayLength}.`,
      );
    }
    return lengthDescriptor.value as number;
  });
  if (OBJECT_GET_PROTOTYPE_OF(value) !== ARRAY_PROTOTYPE) {
    fail(state, "strict JSON snapshot accepts only plain arrays.");
  }

  const arrayLength = length;
  countProperties(state, arrayLength);
  addEncodedBytes(state, 1);
  const snapshot = new ARRAY_CONSTRUCTOR<unknown>(arrayLength);
  OBJECT_DEFINE_PROPERTY(snapshot, "toJSON", {
    value: undefined,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  for (let index = 0; index < arrayLength; index += 1) {
    atPath(state, index, () => {
      if (index > 0) addEncodedBytes(state, 1);
      const propertyKey = `${index}`;
      const descriptor = OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, propertyKey);
      if (descriptor === undefined) {
        fail(state, "strict JSON array is sparse at this missing index.");
      }
      assertDataDescriptor(descriptor, state, false);
      OBJECT_DEFINE_PROPERTY(snapshot, propertyKey, {
        value: snapshotValue(descriptor.value, depth + 1, state),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    });
  }
  addEncodedBytes(state, 1);
  return snapshot;
}

function snapshotObject(
  value: Record<PropertyKey, unknown>,
  depth: number,
  state: SnapshotState,
): Record<string, unknown> {
  const prototype = OBJECT_GET_PROTOTYPE_OF(value);
  if (prototype !== OBJECT_PROTOTYPE && prototype !== null) {
    fail(state, "strict JSON snapshot accepts only plain objects.");
  }
  addEncodedBytes(state, 1);

  const snapshot = OBJECT_CREATE(null) as Record<string, unknown>;
  let enumeratedProperties = 0;
  let ownProperties = 0;
  for (const key in value) {
    enumeratedProperties += 1;
    if (enumeratedProperties > STRICT_JSON_SNAPSHOT_LIMITS.maxPropertiesPerObject) {
      fail(
        state,
        `strict JSON object enumeration exceeds ${STRICT_JSON_SNAPSHOT_LIMITS.maxPropertiesPerObject} properties.`,
      );
    }
    if (!OBJECT_HAS_OWN(value, key)) continue;
    assertBoundedString(key, state, "key");
    atPath(state, key, () => {
      const descriptor = OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
      assertDataDescriptor(descriptor, state, true);
      countProperties(state, 1);
      if (ownProperties > 0) addEncodedBytes(state, 1);
      addEncodedBytes(state, encodedStringBytes(key) + 1);
      OBJECT_DEFINE_PROPERTY(snapshot, key, {
        value: snapshotValue(descriptor.value, depth + 1, state),
        enumerable: true,
        configurable: true,
        writable: true,
      });
      ownProperties += 1;
    });
  }
  addEncodedBytes(state, 1);
  return snapshot;
}

function snapshotValue(value: unknown, depth: number, state: SnapshotState): unknown {
  if (depth > STRICT_JSON_SNAPSHOT_LIMITS.maxDepth) {
    fail(state, `strict JSON snapshot exceeds depth ${STRICT_JSON_SNAPSHOT_LIMITS.maxDepth}.`);
  }
  countNode(state);
  if ((typeof value !== "object" || value === null) && typeof value !== "function") {
    return snapshotPrimitive(value, state);
  }
  if (typeof value === "function") {
    return snapshotPrimitive(value, state);
  }
  if (isProxy(value)) {
    fail(state, "strict JSON snapshot rejects Proxy values before reflection.");
  }
  if (REFLECT_APPLY(WEAK_SET_HAS, state.active, [value]) as boolean) {
    fail(state, "strict JSON snapshot contains a cycle.");
  }

  REFLECT_APPLY(WEAK_SET_ADD, state.active, [value]);
  try {
    return ARRAY_IS_ARRAY(value)
      ? snapshotArray(value, depth, state)
      : snapshotObject(value as Record<PropertyKey, unknown>, depth, state);
  } finally {
    REFLECT_APPLY(WEAK_SET_DELETE, state.active, [value]);
  }
}

/**
 * Captures untrusted publication input as detached JSON without consulting any
 * caller code. Proxies are rejected before reflection, property values come
 * only from descriptors, arrays are read by numeric index rather than
 * iteration, and encoded size is counted without serializing the input.
 * JavaScript exposes no incremental own-key primitive, so callers accepting
 * arbitrary in-memory records must first reconstruct an exact known-field
 * shape; otherwise native key enumeration can precede this walk's ceilings.
 */
export function strictBoundedJsonSnapshot<T>(
  value: unknown,
  label: string,
  maximumBytes: number,
): T {
  return strictBoundedJsonSnapshotReport<T>(value, label, maximumBytes).value;
}

export interface StrictJsonSnapshotReport<T> {
  readonly value: T;
  readonly encodedBytes: number;
  readonly nodes: number;
  readonly properties: number;
}

export function strictBoundedJsonSnapshotReport<T>(
  value: unknown,
  label: string,
  maximumBytes: number,
  maximumNodes: number = STRICT_JSON_SNAPSHOT_LIMITS.maxNodes,
): StrictJsonSnapshotReport<T> {
  if (
    typeof label !== "string" ||
    label.length < 1 ||
    label.length > STRICT_JSON_SNAPSHOT_LIMITS.maxLabelCharacters ||
    !isPrintableAscii(label)
  ) {
    throw new ERROR_CONSTRUCTOR(
      `Strict JSON snapshot label must contain 1..${STRICT_JSON_SNAPSHOT_LIMITS.maxLabelCharacters} printable ASCII characters.`,
    );
  }
  if (
    !NUMBER_IS_SAFE_INTEGER(maximumBytes) ||
    maximumBytes < 1 ||
    maximumBytes > STRICT_JSON_SNAPSHOT_LIMITS.maxBytes
  ) {
    throw new ERROR_CONSTRUCTOR(
      `${label} strict JSON byte ceiling must be a safe integer in 1..${STRICT_JSON_SNAPSHOT_LIMITS.maxBytes}.`,
    );
  }
  if (
    !NUMBER_IS_SAFE_INTEGER(maximumNodes) ||
    maximumNodes < 1 ||
    maximumNodes > STRICT_JSON_SNAPSHOT_LIMITS.maxNodes
  ) {
    throw new ERROR_CONSTRUCTOR(
      `${label} strict JSON node ceiling must be a safe integer in 1..${STRICT_JSON_SNAPSHOT_LIMITS.maxNodes}.`,
    );
  }
  const state: SnapshotState = {
    label,
    maximumBytes,
    maximumNodes,
    active: new WEAK_SET_CONSTRUCTOR<object>(),
    path: [],
    nodes: 0,
    properties: 0,
    encodedBytes: 0,
  };
  const snapshot = snapshotValue(value, 0, state) as T;
  return {
    value: snapshot,
    encodedBytes: state.encodedBytes,
    nodes: state.nodes,
    properties: state.properties,
  };
}

function isPrintableAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = stringCharCodeAt(value, index);
    if (codeUnit < 0x20 || codeUnit > 0x7e) return false;
  }
  return true;
}
