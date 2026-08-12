const DEFAULT_MAXIMUM_CANONICAL_BYTES = 16_777_216;
const DEFAULT_MAXIMUM_NODES = 2_000_000;
const DEFAULT_MAXIMUM_DEPTH = 128;
const DEFAULT_MAXIMUM_ARRAY_LENGTH = 200_000;
const DEFAULT_MAXIMUM_PARTS = 100_000;

interface DataEntry {
  readonly key: string;
  readonly value: unknown;
}

interface ContainerSnapshot {
  readonly kind: "array" | "object";
  readonly entries: readonly DataEntry[];
  readonly length: number | null;
  readonly prototype: object | null;
}

interface DescriptorBudget {
  readonly maximumContainerEntries: number;
  readonly maximumKeyBytes: number;
  remainingEntries: number;
  remainingKeyBytes: number;
}

export interface PanelCameraCanonicalDocumentSnapshot<D> {
  readonly document: D;
  readonly canonical: string;
  readonly canonicalBytes: number;
  readonly nodeCount: number;
  readonly partCount: number;
}

export interface PanelCameraCanonicalDocumentLimits {
  readonly maximumCanonicalBytes?: number;
  readonly maximumNodes?: number;
  readonly maximumDepth?: number;
  readonly maximumArrayLength?: number;
  readonly maximumParts?: number;
}

export class PanelCameraPartLimitError extends RangeError {
  public readonly observed: number;
  public readonly limit: number;

  public constructor(observed: number, limit: number) {
    super(
      `Panel-camera prefix document.parts contains ${observed} entries; the remaining part limit is ${limit}.`,
    );
    this.name = "PanelCameraPartLimitError";
    this.observed = observed;
    this.limit = limit;
  }
}

function safePath(parent: string, key: string): string {
  const suffix = /^[0-9]+$/u.test(key) ? `[${key}]` : `.${key}`;
  const combined = `${parent}${suffix}`;
  return combined.length <= 256 ? combined : `${combined.slice(0, 253)}...`;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function canonicalJsonStringByteLength(value: string): number {
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22 || code === 0x5c) bytes += 2;
    else if (code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d) {
      bytes += 2;
    } else if (code <= 0x1f) bytes += 6;
    else if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = index + 1 < value.length ? value.charCodeAt(index + 1) : -1;
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 6;
    } else if (code >= 0xdc00 && code <= 0xdfff) bytes += 6;
    else bytes += 3;
  }
  return bytes;
}

class BoundedCanonicalBuilder {
  readonly #maximumBytes: number;
  #bytes = 0;
  #current = "";
  readonly #chunks: string[] = [];

  public constructor(maximumBytes: number) {
    this.#maximumBytes = maximumBytes;
  }

  public get byteLength(): number {
    return this.#bytes;
  }

  public get remainingBytes(): number {
    return this.#maximumBytes - this.#bytes;
  }

  public append(value: string, path: string): void {
    const bytes = utf8ByteLength(value);
    if (bytes > this.remainingBytes) {
      throw new RangeError(
        `Panel-camera document canonical JSON exceeds ${this.#maximumBytes} bytes while encoding ${path}; reject it before hashing or rendering.`,
      );
    }
    this.#bytes += bytes;
    this.#current += value;
    if (this.#current.length >= 65_536) {
      this.#chunks.push(this.#current);
      this.#current = "";
    }
  }

  public appendJsonString(value: string, path: string): void {
    const bytes = canonicalJsonStringByteLength(value);
    if (bytes > this.remainingBytes) {
      throw new RangeError(
        `Panel-camera document JSON string ${path} requires ${bytes} encoded bytes with ${this.remainingBytes} remaining; reject it before allocating its escaped representation.`,
      );
    }
    this.append(JSON.stringify(value), path);
  }

  public finish(): string {
    if (this.#current.length > 0) this.#chunks.push(this.#current);
    return this.#chunks.join("");
  }
}

function requireSafeLimit(value: number | undefined, fallback: number, name: string): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < 0) {
    throw new RangeError(
      `Panel-camera document ${name} is ${String(selected)}; required a non-negative safe integer.`,
    );
  }
  return selected;
}

function snapshotContainer(
  value: object,
  path: string,
  maximumArrayLength: number,
  cache: WeakMap<object, ContainerSnapshot>,
  descriptorBudget: DescriptorBudget,
  maximumParts: number | null = null,
): ContainerSnapshot {
  const cached = cache.get(value);
  if (cached !== undefined) return cached;
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
  } catch {
    throw new TypeError(
      `Panel-camera document ${path} did not expose stable plain-data descriptors; accessors and hostile proxies are not accepted.`,
    );
  }
  const array = Array.isArray(value);
  if (
    array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null
  ) {
    throw new TypeError(
      `Panel-camera document ${path} must use ${array ? "Array.prototype" : "Object.prototype or null"}; class instances and unsupported prototypes are not canonical evidence.`,
    );
  }
  let length: number | null = null;
  if (array) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, "length");
    } catch {
      descriptor = undefined;
    }
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !Number.isSafeInteger(descriptor.value)
    ) {
      throw new TypeError(`Panel-camera document array ${path} has no stable data length.`);
    }
    length = descriptor.value as number;
    if (maximumParts !== null && length > maximumParts) {
      throw new PanelCameraPartLimitError(length, maximumParts);
    }
    if (length < 0 || length > maximumArrayLength) {
      throw new RangeError(
        `Panel-camera document array ${path} contains ${length} entries; the limit is ${maximumArrayLength}.`,
      );
    }
  }
  let ownKeys: readonly PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(value);
  } catch {
    throw new TypeError(
      `Panel-camera document ${path} did not expose stable plain-data keys; hostile proxies are not accepted.`,
    );
  }
  const expectedArrayKeys = array ? (length as number) + 1 : null;
  if (expectedArrayKeys !== null && ownKeys.length !== expectedArrayKeys) {
    throw new TypeError(
      `Panel-camera document array ${path} must contain only its dense indices and length; received ${ownKeys.length - 1} indexed or extra properties for length ${length}.`,
    );
  }
  const entryCount = ownKeys.length - (array ? 1 : 0);
  if (
    entryCount > descriptorBudget.maximumContainerEntries ||
    entryCount > descriptorBudget.remainingEntries
  ) {
    throw new RangeError(
      `Panel-camera document ${path} exposes ${entryCount} data entries; one container permits at most ${descriptorBudget.maximumContainerEntries} and ${descriptorBudget.remainingEntries} descriptor entries remain. Reject it before copying or sorting keys.`,
    );
  }
  const stringKeys: string[] = [];
  let keyBytes = 0;
  for (const key of ownKeys) {
    if (typeof key !== "string") {
      throw new TypeError(
        `Panel-camera document ${path} contains a symbol key; required plain JSON data.`,
      );
    }
    if (array && key === "length") continue;
    const encodedBytes = canonicalJsonStringByteLength(key);
    if (encodedBytes > descriptorBudget.maximumKeyBytes - keyBytes) {
      throw new RangeError(
        `Panel-camera document ${path} keys exceed ${descriptorBudget.maximumKeyBytes} encoded bytes; reject them before copying or sorting keys.`,
      );
    }
    keyBytes += encodedBytes;
    stringKeys.push(key);
  }
  if (keyBytes > descriptorBudget.remainingKeyBytes) {
    throw new RangeError(
      `Panel-camera document ${path} keys require ${keyBytes} encoded bytes with ${descriptorBudget.remainingKeyBytes} descriptor-key bytes remaining; reject them before sorting.`,
    );
  }
  descriptorBudget.remainingEntries -= entryCount;
  descriptorBudget.remainingKeyBytes -= keyBytes;
  if (array) {
    const indexedKeys = new Set(stringKeys);
    for (let index = 0; index < (length as number); index += 1) {
      if (!indexedKeys.has(String(index))) {
        throw new TypeError(
          `Panel-camera document array ${path} contains a hole at index ${index}; required dense data.`,
        );
      }
    }
    stringKeys.sort((left, right) => Number(left) - Number(right));
  } else stringKeys.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const entries: DataEntry[] = [];
  for (const key of stringKeys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      descriptor = undefined;
    }
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      throw new TypeError(
        `Panel-camera document ${safePath(path, key)} must be an enumerable own data property; accessors and unstable proxies are not accepted.`,
      );
    }
    entries.push(Object.freeze({ key, value: descriptor.value }));
  }
  const snapshot = Object.freeze({
    kind: array ? ("array" as const) : ("object" as const),
    entries: Object.freeze(entries),
    length,
    prototype,
  });
  cache.set(value, snapshot);
  return snapshot;
}

/** Detaches one canonical JSON document without invoking caller-owned accessors. */
export function snapshotPanelCameraCanonicalDocument<
  D extends { readonly parts: readonly unknown[] },
>(
  supplied: unknown,
  suppliedLimits: PanelCameraCanonicalDocumentLimits = {},
): PanelCameraCanonicalDocumentSnapshot<D> {
  const maximumCanonicalBytes = requireSafeLimit(
    suppliedLimits.maximumCanonicalBytes,
    DEFAULT_MAXIMUM_CANONICAL_BYTES,
    "maximumCanonicalBytes",
  );
  const maximumNodes = requireSafeLimit(
    suppliedLimits.maximumNodes,
    DEFAULT_MAXIMUM_NODES,
    "maximumNodes",
  );
  const maximumDepth = requireSafeLimit(
    suppliedLimits.maximumDepth,
    DEFAULT_MAXIMUM_DEPTH,
    "maximumDepth",
  );
  const maximumArrayLength = requireSafeLimit(
    suppliedLimits.maximumArrayLength,
    DEFAULT_MAXIMUM_ARRAY_LENGTH,
    "maximumArrayLength",
  );
  const maximumParts = requireSafeLimit(
    suppliedLimits.maximumParts,
    DEFAULT_MAXIMUM_PARTS,
    "maximumParts",
  );
  if (supplied === null || typeof supplied !== "object" || Array.isArray(supplied)) {
    throw new TypeError(`Panel-camera prefix document must be a plain JSON object.`);
  }
  const containers = new WeakMap<object, ContainerSnapshot>();
  const descriptorBudget: DescriptorBudget = {
    maximumContainerEntries: maximumArrayLength,
    maximumKeyBytes: maximumCanonicalBytes,
    remainingEntries: maximumNodes,
    remainingKeyBytes: maximumCanonicalBytes,
  };
  const root = snapshotContainer(supplied, "$", maximumArrayLength, containers, descriptorBudget);
  const partsEntry = root.entries.find(({ key }) => key === "parts");
  if (
    partsEntry === undefined ||
    partsEntry.value === null ||
    typeof partsEntry.value !== "object"
  ) {
    throw new TypeError(`Panel-camera prefix document.parts must be a dense plain-data array.`);
  }
  const parts = snapshotContainer(
    partsEntry.value as object,
    "$.parts",
    maximumArrayLength,
    containers,
    descriptorBudget,
    maximumParts,
  );
  if (parts.kind !== "array") {
    throw new TypeError(`Panel-camera prefix document.parts must be a dense plain-data array.`);
  }
  const partCount = parts.length as number;
  if (partCount > maximumParts) {
    throw new PanelCameraPartLimitError(partCount, maximumParts);
  }
  const builder = new BoundedCanonicalBuilder(maximumCanonicalBytes);
  const ancestors = new WeakSet<object>();
  let nodeCount = 0;
  const visit = (value: unknown, path: string, depth: number): unknown => {
    nodeCount += 1;
    if (nodeCount > maximumNodes) {
      throw new RangeError(
        `Panel-camera document exceeds ${maximumNodes} canonical value nodes at ${path}; reject it before hashing or rendering.`,
      );
    }
    if (depth > maximumDepth) {
      throw new RangeError(
        `Panel-camera document exceeds canonical depth ${maximumDepth} at ${path}; reject it before hashing or rendering.`,
      );
    }
    if (value === null) {
      builder.append("null", path);
      return null;
    }
    if (typeof value === "boolean") {
      builder.append(value ? "true" : "false", path);
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value))
        throw new TypeError(`Panel-camera document ${path} is not finite.`);
      const normalized = Object.is(value, -0) ? 0 : value;
      builder.append(JSON.stringify(normalized), path);
      return normalized;
    }
    if (typeof value === "string") {
      builder.appendJsonString(value, path);
      return value;
    }
    if (typeof value !== "object") {
      throw new TypeError(`Panel-camera document ${path} has unsupported ${typeof value} data.`);
    }
    if (ancestors.has(value)) {
      throw new TypeError(
        `Panel-camera document contains a cycle at ${path}; canonical JSON is acyclic.`,
      );
    }
    ancestors.add(value);
    const container = snapshotContainer(
      value,
      path,
      maximumArrayLength,
      containers,
      descriptorBudget,
    );
    const clone: unknown[] | Record<string, unknown> =
      container.kind === "array"
        ? []
        : Object.create(container.prototype === null ? null : Object.prototype);
    builder.append(container.kind === "array" ? "[" : "{", path);
    for (let index = 0; index < container.entries.length; index += 1) {
      const { key, value: child } = container.entries[index]!;
      if (index > 0) builder.append(",", path);
      if (container.kind === "object") {
        builder.appendJsonString(key, path);
        builder.append(":", path);
      }
      const detached = visit(child, safePath(path, key), depth + 1);
      Object.defineProperty(clone, key, {
        value: detached,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    builder.append(container.kind === "array" ? "]" : "}", path);
    ancestors.delete(value);
    Object.freeze(clone);
    return clone;
  };
  const document = visit(supplied, "$", 0) as D;
  return Object.freeze({
    document,
    canonical: builder.finish(),
    canonicalBytes: builder.byteLength,
    nodeCount,
    partCount,
  });
}
