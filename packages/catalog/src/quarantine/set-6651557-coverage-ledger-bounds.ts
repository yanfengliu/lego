const MAX_SERIALIZED_BYTES = 100_000;
const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 256;
const MAX_OBJECT_KEYS = 32;
const MAX_NODES = 3_000;
const MAX_STRING_BYTES = 256;
const MAX_TOTAL_STRING_BYTES = 50_000;
const MAX_NONNEGATIVE_INTEGER = 100_000_000;
const textEncoder = new TextEncoder();

const base64PayloadLike = /^[A-Za-z0-9+/]{128,}={0,2}$/;

const containsForbiddenTextControl = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f) {
      return true;
    }
  }
  return false;
};

/**
 * Applies resource limits before the ledger's closed semantic schema is checked.
 * This is metadata validation, not catalog admission or source-payload parsing.
 */
export const assertBoundedSet6651557CoverageMetadata = (value: unknown): void => {
  const ancestors = new WeakSet<object>();
  let nodes = 0;
  let totalStringBytes = 0;

  const visit = (candidate: unknown, path: string, depth: number): void => {
    nodes += 1;
    if (nodes > MAX_NODES) {
      throw new Error(`set6651557CoverageLedger exceeds ${MAX_NODES} metadata nodes.`);
    }
    if (depth > MAX_DEPTH) {
      throw new Error(`${path} exceeds the metadata depth limit of ${MAX_DEPTH}.`);
    }

    if (typeof candidate === "string") {
      const stringBytes = textEncoder.encode(candidate).length;
      totalStringBytes += stringBytes;
      if (stringBytes > MAX_STRING_BYTES) {
        throw new Error(
          `${path} exceeds the metadata string limit of ${MAX_STRING_BYTES} UTF-8 bytes.`,
        );
      }
      if (totalStringBytes > MAX_TOTAL_STRING_BYTES) {
        throw new Error(
          `set6651557CoverageLedger exceeds ${MAX_TOTAL_STRING_BYTES} total UTF-8 string bytes.`,
        );
      }
      if (containsForbiddenTextControl(candidate)) {
        throw new Error(`${path} contains a forbidden control character.`);
      }
      if (base64PayloadLike.test(candidate)) {
        throw new Error(`${path} resembles encoded source payload rather than bounded metadata.`);
      }
      return;
    }

    if (typeof candidate === "number") {
      if (
        !Number.isSafeInteger(candidate) ||
        candidate < 0 ||
        candidate > MAX_NONNEGATIVE_INTEGER
      ) {
        throw new Error(
          `${path} must be a safe nonnegative metadata integer no greater than ${MAX_NONNEGATIVE_INTEGER}.`,
        );
      }
      return;
    }

    if (typeof candidate === "boolean") return;
    if (typeof candidate !== "object" || candidate === null) {
      throw new Error(`${path} contains an unsupported metadata scalar.`);
    }
    if (ancestors.has(candidate)) {
      throw new Error(`${path} contains a metadata cycle.`);
    }
    ancestors.add(candidate);

    if (Array.isArray(candidate)) {
      if (candidate.length > MAX_ARRAY_ITEMS) {
        throw new Error(`${path} exceeds the metadata array limit of ${MAX_ARRAY_ITEMS} items.`);
      }
      candidate.forEach((child, index) => visit(child, `${path}[${index}]`, depth + 1));
      ancestors.delete(candidate);
      return;
    }

    const entries = Object.entries(candidate);
    if (entries.length > MAX_OBJECT_KEYS) {
      throw new Error(`${path} exceeds the metadata object limit of ${MAX_OBJECT_KEYS} keys.`);
    }
    for (const [key, child] of entries) {
      visit(child, `${path}.${key}`, depth + 1);
    }
    ancestors.delete(candidate);
  };

  visit(value, "set6651557CoverageLedger", 0);
  const serializedBytes = textEncoder.encode(JSON.stringify(value)).length;
  if (serializedBytes > MAX_SERIALIZED_BYTES) {
    throw new Error(
      `set6651557CoverageLedger exceeds ${MAX_SERIALIZED_BYTES} serialized UTF-8 bytes.`,
    );
  }
};
