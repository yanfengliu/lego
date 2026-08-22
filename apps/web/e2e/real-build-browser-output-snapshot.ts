const MAXIMUM_BROWSER_OUTPUT_DEPTH = 128;
const MAXIMUM_BROWSER_OUTPUT_NODES = 2_000_000;
const MAXIMUM_BROWSER_OUTPUT_ARRAY_LENGTH = 800_000;
const MAXIMUM_BROWSER_OUTPUT_OBJECT_KEYS = 128;
const MAXIMUM_BROWSER_OUTPUT_KEY_CODE_UNITS = 256;
const MAXIMUM_BROWSER_OUTPUT_KEY_CODE_UNITS_TOTAL = 4 * 1024 * 1024;
const MAXIMUM_BROWSER_OUTPUT_SERIALIZED_BYTES = 64 * 1024 * 1024;

interface DataEntry {
  readonly key: string;
  readonly value: unknown;
}

interface ContainerSnapshot {
  readonly kind: "array" | "object";
  readonly entries: readonly DataEntry[];
}

interface SnapshotBudget {
  nodes: number;
  keyCodeUnits: number;
  serializedBytes: number;
}

const SNAPSHOT_DEFECTS = new WeakMap<object, string>();
const NODE_IS_PROXY = nodeUtilTypes.isProxy;

function rejectSnapshot(defect: string): never {
  const marker = Object.freeze({});
  SNAPSHOT_DEFECTS.set(marker, defect);
  throw marker;
}

function spendSerializedBytes(budget: SnapshotBudget, bytes: number): void {
  budget.serializedBytes += bytes;
  if (budget.serializedBytes > MAXIMUM_BROWSER_OUTPUT_SERIALIZED_BYTES) {
    rejectSnapshot(
      `Browser-output serialized JSON exceeds ${MAXIMUM_BROWSER_OUTPUT_SERIALIZED_BYTES} bytes.`,
    );
  }
}

function spendJsonStringBytes(budget: SnapshotBudget, value: string): void {
  spendSerializedBytes(budget, 2);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22 || code === 0x5c) spendSerializedBytes(budget, 2);
    else if (code <= 0x1f)
      spendSerializedBytes(
        budget,
        code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d ? 2 : 6,
      );
    else if (code <= 0x7f) spendSerializedBytes(budget, 1);
    else if (code <= 0x7ff) spendSerializedBytes(budget, 2);
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = index + 1 < value.length ? value.charCodeAt(index + 1) : -1;
      if (next >= 0xdc00 && next <= 0xdfff) {
        spendSerializedBytes(budget, 4);
        index += 1;
      } else spendSerializedBytes(budget, 6);
    } else if (code >= 0xdc00 && code <= 0xdfff) spendSerializedBytes(budget, 6);
    else spendSerializedBytes(budget, 3);
  }
}

export type BrowserOutputSnapshot =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly defect: string };

export function describeDetachedBrowserValue(value: unknown): string {
  if (typeof value === "string") {
    const preview = value.length <= 96 ? value : `${value.slice(0, 93)}...`;
    return `${JSON.stringify(preview)}${value.length <= 96 ? "" : ` (${value.length} characters)`}`;
  }
  return value === null ? "null" : typeof value;
}

const boundDefect = (value: string | null): string | null =>
  value === null || value.length <= 4_096 ? value : `${value.slice(0, 4_093)}...`;

export function boundBrowserOutputReading(reading: {
  readonly envelopeDefect: string | null;
  readonly reportDefects: readonly (string | null)[];
  readonly reproductionDefect: string | null;
}) {
  return {
    envelopeDefect: boundDefect(reading.envelopeDefect),
    reportDefects: reading.reportDefects.map(boundDefect),
    reproductionDefect: boundDefect(reading.reproductionDefect),
  };
}

function boundedPath(parent: string, key: string): string {
  const child = /^(?:0|[1-9][0-9]*)$/u.test(key) ? `${parent}[${key}]` : `${parent}.${key}`;
  return child.length <= 256 ? child : `${child.slice(0, 253)}...`;
}

function arrayLimit(path: string, maximumReports: number, maximumBindings: number): number {
  if (path === "$.reports") return maximumReports;
  if (path === "$.identityBindings") return maximumBindings;
  return MAXIMUM_BROWSER_OUTPUT_ARRAY_LENGTH;
}

function snapshotContainer(
  source: object,
  path: string,
  maximumReports: number,
  maximumBindings: number,
  budget: SnapshotBudget,
  cache: WeakMap<object, ContainerSnapshot>,
): ContainerSnapshot {
  const cached = cache.get(source);
  if (cached !== undefined) return cached;

  let isArray: boolean;
  try {
    isArray = Array.isArray(source);
  } catch {
    rejectSnapshot(`${path} does not expose a stable array identity.`);
  }

  let length = 0;
  if (isArray) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(source, "length");
    } catch {
      rejectSnapshot(`${path} does not expose a stable array length.`);
    }
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !Number.isSafeInteger(descriptor.value) ||
      descriptor.value < 0
    ) {
      rejectSnapshot(`${path} does not have a non-negative safe data length.`);
    }
    length = descriptor.value as number;
    const maximum = arrayLimit(path, maximumReports, maximumBindings);
    if (length > maximum) {
      rejectSnapshot(`${path} contains ${length} entries; the boundary permits ${maximum}.`);
    }
  }

  let ownKeys: readonly PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(source);
  } catch {
    rejectSnapshot(`${path} does not expose stable own keys.`);
  }
  if (isArray && ownKeys.length !== length + 1) {
    rejectSnapshot(`${path} must be a dense array with no extra properties.`);
  }
  if (!isArray && ownKeys.length > MAXIMUM_BROWSER_OUTPUT_OBJECT_KEYS) {
    rejectSnapshot(
      `${path} exposes ${ownKeys.length} own keys; the boundary permits ${MAXIMUM_BROWSER_OUTPUT_OBJECT_KEYS}.`,
    );
  }

  const entries: DataEntry[] = isArray ? new Array<DataEntry>(length) : [];
  for (const propertyKey of ownKeys) {
    if (typeof propertyKey !== "string") {
      rejectSnapshot(`${path} contains a symbol key; browser evidence must be JSON data.`);
    }
    if (isArray && propertyKey === "length") continue;
    if (propertyKey.length > MAXIMUM_BROWSER_OUTPUT_KEY_CODE_UNITS) {
      rejectSnapshot(
        `${path} contains a key longer than ${MAXIMUM_BROWSER_OUTPUT_KEY_CODE_UNITS} code units.`,
      );
    }
    budget.keyCodeUnits += propertyKey.length;
    if (budget.keyCodeUnits > MAXIMUM_BROWSER_OUTPUT_KEY_CODE_UNITS_TOTAL) {
      rejectSnapshot(
        `Browser-output keys exceed ${MAXIMUM_BROWSER_OUTPUT_KEY_CODE_UNITS_TOTAL} code units.`,
      );
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(source, propertyKey);
    } catch {
      rejectSnapshot(`${boundedPath(path, propertyKey)} has no stable property descriptor.`);
    }
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      rejectSnapshot(`${boundedPath(path, propertyKey)} must be an enumerable own data property.`);
    }
    const entry = Object.freeze({ key: propertyKey, value: descriptor.value });
    if (isArray) {
      const index = Number(propertyKey);
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= length ||
        String(index) !== propertyKey
      ) {
        rejectSnapshot(`${path} must contain only canonical dense array indices.`);
      }
      entries[index] = entry;
    } else {
      entries.push(entry);
    }
  }
  if (isArray) {
    for (let index = 0; index < entries.length; index += 1) {
      if (entries[index] === undefined) {
        rejectSnapshot(`${path} contains an array hole at index ${index}.`);
      }
    }
  } else {
    entries.sort(({ key: left }, { key: right }) => (left < right ? -1 : left > right ? 1 : 0));
  }
  const snapshot = Object.freeze({
    kind: isArray ? ("array" as const) : ("object" as const),
    entries: Object.freeze(entries),
  });
  cache.set(source, snapshot);
  return snapshot;
}

function spendContainerSerialization(container: ContainerSnapshot, budget: SnapshotBudget): void {
  spendSerializedBytes(budget, 2 + Math.max(0, container.entries.length - 1));
  if (container.kind === "array") return;
  for (const { key } of container.entries) {
    spendJsonStringBytes(budget, key);
    spendSerializedBytes(budget, 1);
  }
}

/**
 * Detaches current browser evidence through descriptors only. Caller-owned getters,
 * coercion hooks and toJSON functions are never read or invoked.
 */
export function snapshotCurrentRealBuildBrowserOutput(
  supplied: unknown,
  maximumReports: number,
  maximumBindings: number,
  rejectProxies = false,
): BrowserOutputSnapshot {
  const reports =
    Number.isSafeInteger(maximumReports) && maximumReports >= 0
      ? Math.min(maximumReports, 359)
      : 359;
  const bindings =
    Number.isSafeInteger(maximumBindings) && maximumBindings >= 0
      ? Math.min(maximumBindings, 100_000)
      : 100_000;
  const budget: SnapshotBudget = { nodes: 0, keyCodeUnits: 0, serializedBytes: 0 };
  const cache = new WeakMap<object, ContainerSnapshot>();
  const ancestors = new WeakSet<object>();

  const visit = (value: unknown, path: string, depth: number): unknown => {
    budget.nodes += 1;
    if (budget.nodes > MAXIMUM_BROWSER_OUTPUT_NODES) {
      rejectSnapshot(`Browser-output exceeds ${MAXIMUM_BROWSER_OUTPUT_NODES} data nodes.`);
    }
    if (depth > MAXIMUM_BROWSER_OUTPUT_DEPTH) {
      rejectSnapshot(`${path} exceeds browser-output depth ${MAXIMUM_BROWSER_OUTPUT_DEPTH}.`);
    }
    if (value === null) {
      spendSerializedBytes(budget, 4);
      return value;
    }
    if (typeof value === "boolean") {
      spendSerializedBytes(budget, value ? 4 : 5);
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) rejectSnapshot(`${path} must contain a finite number.`);
      const normalized = Object.is(value, -0) ? 0 : value;
      spendSerializedBytes(budget, String(normalized).length);
      return normalized;
    }
    if (typeof value === "string") {
      spendJsonStringBytes(budget, value);
      return value;
    }
    if (typeof value !== "object") {
      rejectSnapshot(`${path} contains unsupported ${typeof value} data.`);
    }
    if (rejectProxies && NODE_IS_PROXY(value)) {
      rejectSnapshot(`${path} is a Proxy; current browser-output /4 accepts detached data only.`);
    }
    if (ancestors.has(value)) rejectSnapshot(`${path} closes a cyclic object graph.`);
    ancestors.add(value);
    const container = snapshotContainer(value, path, reports, bindings, budget, cache);
    // An alias is expanded again in the detached JSON-shaped clone, so charge its
    // braces, keys, separators, and descendants on every occurrence even though
    // descriptor inspection itself is safely cached.
    spendContainerSerialization(container, budget);
    const clone: unknown[] | Record<string, unknown> =
      container.kind === "array" ? [] : Object.create(null);
    for (const { key, value: child } of container.entries) {
      Object.defineProperty(clone, key, {
        value: visit(child, boundedPath(path, key), depth + 1),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    ancestors.delete(value);
    Object.freeze(clone);
    return clone;
  };

  try {
    return Object.freeze({ ok: true as const, value: visit(supplied, "$", 0) });
  } catch (error) {
    const defect =
      error !== null && (typeof error === "object" || typeof error === "function")
        ? (SNAPSHOT_DEFECTS.get(error as object) ?? "browser-output inspection failed")
        : "browser-output inspection failed";
    return Object.freeze({ ok: false as const, defect: defect.slice(0, 512) });
  }
}

/** Current /4 rejects Node-detectable Proxy wrappers before any user trap is dispatched. */
export function snapshotCurrentRealBuildBrowserOutputV4(
  supplied: unknown,
  maximumReports: number,
  maximumBindings: number,
): BrowserOutputSnapshot {
  return snapshotCurrentRealBuildBrowserOutput(supplied, maximumReports, maximumBindings, true);
}

function detachedJsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return false;
  }
  const leftArray = Array.isArray(left);
  if (leftArray !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index]!;
    const rightKey = rightKeys[index]!;
    if (leftKey !== rightKey) return false;
    if (
      !detachedJsonEqual(
        (left as Record<string, unknown>)[leftKey],
        (right as Record<string, unknown>)[rightKey],
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Exact action/digest binding without JSON.stringify or caller hooks. */
export function boundedBrowserActionMatches(
  left: unknown,
  right: unknown,
  claimedEvidenceDigest: unknown,
): boolean {
  const leftSnapshot = snapshotCurrentRealBuildBrowserOutput(left, 100_000, 100_000);
  if (!leftSnapshot.ok) return false;
  const rightSnapshot = snapshotCurrentRealBuildBrowserOutput(right, 100_000, 100_000);
  if (
    !rightSnapshot.ok ||
    !detachedJsonEqual(leftSnapshot.value, rightSnapshot.value) ||
    leftSnapshot.value === null ||
    rightSnapshot.value === null ||
    typeof leftSnapshot.value !== "object" ||
    typeof rightSnapshot.value !== "object"
  ) {
    return false;
  }
  const leftDigest = (leftSnapshot.value as Record<string, unknown>).evidenceDigest;
  const rightDigest = (rightSnapshot.value as Record<string, unknown>).evidenceDigest;
  return (
    (claimedEvidenceDigest === null ||
      (typeof claimedEvidenceDigest === "string" &&
        /^sha256:[0-9a-f]{64}$/u.test(claimedEvidenceDigest))) &&
    claimedEvidenceDigest === leftDigest &&
    claimedEvidenceDigest === rightDigest
  );
}
import { types as nodeUtilTypes } from "node:util";
