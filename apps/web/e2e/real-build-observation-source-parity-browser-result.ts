import { Buffer } from "node:buffer";
import { types as nodeTypes } from "node:util";

import { canonicalStringify } from "@lego-studio/brick-kernel";

import { sha256Digest } from "./real-build-artifacts";
import { REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES } from "./real-build-observation-source-parity-contract";
import type { RealBuildSourceParityBrowserResult } from "./real-build-observation-source-parity-types";

export { REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES } from "./real-build-observation-source-parity-contract";
const MAXIMUM_BROWSER_RESULT_DEPTH = 32;
const MAXIMUM_BROWSER_RESULT_VALUES = 250_000;
const MAXIMUM_BROWSER_RESULT_ARRAY_ITEMS = 16_384;
const MAXIMUM_BROWSER_RESULT_RECORD_FIELDS = 64;

type SnapshotContainer = unknown[] | Record<string, unknown>;

interface SnapshotTarget {
  readonly container: SnapshotContainer;
  readonly key: string | number;
}

interface AncestorLink {
  readonly value: object;
  readonly parent: AncestorLink | null;
}

interface PendingValue {
  readonly value: unknown;
  readonly depth: number;
  readonly location: string;
  readonly target: SnapshotTarget;
  readonly ancestors: AncestorLink | null;
}

function boundedJsonStringBytes(value: string, remaining: number): number | null {
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22 || code === 0x5c) bytes += 2;
    else if (code <= 0x1f) {
      bytes +=
        code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d ? 2 : 6;
    } else if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const low = index + 1 < value.length ? value.charCodeAt(index + 1) : -1;
      if (low >= 0xdc00 && low <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 6;
    } else if (code >= 0xdc00 && code <= 0xdfff) bytes += 6;
    else bytes += 3;
    if (bytes > remaining) return null;
  }
  return bytes;
}

function hasAncestor(ancestors: AncestorLink | null, value: object): boolean {
  for (let link = ancestors; link !== null; link = link.parent) {
    if (link.value === value) return true;
  }
  return false;
}

function fieldLocation(parent: string, key: string, position: number): string {
  const boundedKey = key.length <= 48 ? key : `${key.slice(0, 45)}...`;
  return `${parent}.${boundedKey || `<field-${position}>`}`;
}

function boundedBrowserResultSnapshot(value: unknown, maximumBytes: number): unknown {
  const root: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const pending: PendingValue[] = [
    {
      value,
      depth: 0,
      location: "$",
      target: { container: root, key: "value" },
      ancestors: null,
    },
  ];
  let canonicalBytes = 0;
  let inspectedValues = 0;
  const addBytes = (bytes: number, location: string): void => {
    if (bytes > maximumBytes - canonicalBytes) {
      throw new RangeError(
        `Canonical source-parity browser result exceeded ${maximumBytes} bytes while inspecting ${location}; expected a bounded result before canonicalization.`,
      );
    }
    canonicalBytes += bytes;
  };

  while (pending.length > 0) {
    const current = pending.pop()!;
    inspectedValues += 1;
    if (inspectedValues > MAXIMUM_BROWSER_RESULT_VALUES) {
      throw new RangeError(
        `Source-parity browser result contains more than ${MAXIMUM_BROWSER_RESULT_VALUES} JSON values at ${current.location}; expected a bounded result before canonicalization.`,
      );
    }
    if (current.depth > MAXIMUM_BROWSER_RESULT_DEPTH) {
      throw new RangeError(
        `Source-parity browser result depth ${current.depth} at ${current.location} exceeds ${MAXIMUM_BROWSER_RESULT_DEPTH}; expected a shallow browser result before canonicalization.`,
      );
    }

    const assign = (snapshot: unknown): void => {
      if (Array.isArray(current.target.container) && typeof current.target.key === "number") {
        current.target.container[current.target.key] = snapshot;
      } else {
        (current.target.container as Record<string, unknown>)[String(current.target.key)] =
          snapshot;
      }
    };
    if (current.value === null) {
      addBytes(4, current.location);
      assign(null);
      continue;
    }
    if (typeof current.value === "boolean") {
      addBytes(current.value ? 4 : 5, current.location);
      assign(current.value);
      continue;
    }
    if (typeof current.value === "number") {
      if (!Number.isFinite(current.value)) {
        throw new TypeError(
          `Source-parity browser result ${current.location} observed ${String(current.value)}; expected a finite JSON number.`,
        );
      }
      const numberText = JSON.stringify(Object.is(current.value, -0) ? 0 : current.value);
      addBytes(numberText.length, current.location);
      assign(current.value);
      continue;
    }
    if (typeof current.value === "string") {
      const stringBytes = boundedJsonStringBytes(current.value, maximumBytes - canonicalBytes);
      if (stringBytes === null) {
        throw new RangeError(
          `Source-parity browser result string ${current.location} exceeds the remaining ${maximumBytes - canonicalBytes} canonical bytes; expected a bounded string before canonicalization.`,
        );
      }
      addBytes(stringBytes, current.location);
      assign(current.value);
      continue;
    }
    if (typeof current.value !== "object") {
      throw new TypeError(
        `Source-parity browser result ${current.location} observed ${typeof current.value}; expected a JSON value.`,
      );
    }
    if (nodeTypes.isProxy(current.value)) {
      throw new TypeError(
        `Source-parity browser result ${current.location} must be non-proxy data before canonicalization.`,
      );
    }
    if (hasAncestor(current.ancestors, current.value)) {
      throw new TypeError(
        `Source-parity browser result ${current.location} is circular; expected acyclic JSON data.`,
      );
    }
    const nextAncestors: AncestorLink = { value: current.value, parent: current.ancestors };
    const isArray = Array.isArray(current.value);
    const expectedPrototype = isArray ? Array.prototype : Object.prototype;
    const prototype = Object.getPrototypeOf(current.value);
    if (prototype !== expectedPrototype && !(prototype === null && !isArray)) {
      throw new TypeError(
        `Source-parity browser result ${current.location} must have an ordinary JSON ${isArray ? "Array" : "object"} prototype.`,
      );
    }
    if (isArray) {
      const rawLength = (current.value as unknown[]).length;
      if (
        !Number.isSafeInteger(rawLength) ||
        rawLength < 0 ||
        rawLength > MAXIMUM_BROWSER_RESULT_ARRAY_ITEMS
      ) {
        throw new RangeError(
          `Source-parity browser result array ${current.location} length ${String(rawLength)} must be 0 through ${MAXIMUM_BROWSER_RESULT_ARRAY_ITEMS}.`,
        );
      }
      const length = rawLength;
      if (length > MAXIMUM_BROWSER_RESULT_VALUES - inspectedValues - pending.length) {
        throw new RangeError(
          `Source-parity browser result array ${current.location} would exceed ${MAXIMUM_BROWSER_RESULT_VALUES} JSON values; expected a bounded result before canonicalization.`,
        );
      }
      if (length > 0 && current.depth === MAXIMUM_BROWSER_RESULT_DEPTH) {
        throw new RangeError(
          `Source-parity browser result depth ${current.depth + 1} at ${current.location}[0] exceeds ${MAXIMUM_BROWSER_RESULT_DEPTH}; expected a shallow browser result before canonicalization.`,
        );
      }
      const descriptors = Object.getOwnPropertyDescriptors(current.value);
      const ownKeys = Reflect.ownKeys(descriptors);
      const wanted = new Set<string>(["length"]);
      for (let index = 0; index < length; index += 1) wanted.add(String(index));
      if (
        ownKeys.length !== wanted.size ||
        ownKeys.some((key) => typeof key !== "string" || !wanted.has(key)) ||
        [...wanted].some((key) => {
          const descriptor = descriptors[key];
          return (
            descriptor === undefined ||
            !("value" in descriptor) ||
            (key !== "length" && !descriptor.enumerable)
          );
        })
      ) {
        throw new TypeError(
          `Source-parity browser result array ${current.location} must be dense accessor-free data with no symbol, hidden, or extra fields.`,
        );
      }
      addBytes(2 + Math.max(0, length - 1), current.location);
      const snapshot: unknown[] = new Array(length);
      assign(snapshot);
      for (let index = length - 1; index >= 0; index -= 1) {
        pending.push({
          value: descriptors[String(index)]!.value,
          depth: current.depth + 1,
          location: `${current.location}[${index}]`,
          target: { container: snapshot, key: index },
          ancestors: nextAncestors,
        });
      }
      continue;
    }

    const ownKeys = Reflect.ownKeys(current.value);
    if (ownKeys.length > MAXIMUM_BROWSER_RESULT_RECORD_FIELDS) {
      throw new RangeError(
        `Source-parity browser result object ${current.location} has ${ownKeys.length} fields; expected at most ${MAXIMUM_BROWSER_RESULT_RECORD_FIELDS}.`,
      );
    }
    if (ownKeys.length > MAXIMUM_BROWSER_RESULT_VALUES - inspectedValues - pending.length) {
      throw new RangeError(
        `Source-parity browser result object ${current.location} would exceed ${MAXIMUM_BROWSER_RESULT_VALUES} JSON values; expected a bounded result before canonicalization.`,
      );
    }
    if (ownKeys.length > 0 && current.depth === MAXIMUM_BROWSER_RESULT_DEPTH) {
      throw new RangeError(
        `Source-parity browser result depth ${current.depth + 1} at ${current.location} exceeds ${MAXIMUM_BROWSER_RESULT_DEPTH}; expected a shallow browser result before canonicalization.`,
      );
    }
    const descriptors = Object.getOwnPropertyDescriptors(current.value);
    if (
      ownKeys.some((key) => typeof key !== "string") ||
      ownKeys.some((key) => {
        const descriptor = descriptors[key as string];
        return descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable;
      })
    ) {
      throw new TypeError(
        `Source-parity browser result object ${current.location} must contain only enumerable string-keyed data fields, not accessors, symbols, or hidden fields.`,
      );
    }
    const keys = ownKeys as string[];
    addBytes(2 + Math.max(0, keys.length - 1) + keys.length, current.location);
    for (let index = 0; index < keys.length; index += 1) {
      const keyBytes = boundedJsonStringBytes(keys[index]!, maximumBytes - canonicalBytes);
      if (keyBytes === null) {
        throw new RangeError(
          `Source-parity browser result key at ${current.location} exceeds the remaining canonical byte bound.`,
        );
      }
      addBytes(keyBytes, current.location);
    }
    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    assign(snapshot);
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]!;
      pending.push({
        value: descriptors[key]!.value,
        depth: current.depth + 1,
        location: fieldLocation(current.location, key, index),
        target: { container: snapshot, key },
        ancestors: nextAncestors,
      });
    }
  }
  return root.value;
}

export function realBuildSourceParityBrowserResultEvidence(
  result: RealBuildSourceParityBrowserResult,
  maximumCanonicalBytes = REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES,
): { readonly digest: string; readonly bytes: number; readonly canonicalBytes: Buffer } {
  if (
    !Number.isSafeInteger(maximumCanonicalBytes) ||
    maximumCanonicalBytes < 2 ||
    maximumCanonicalBytes > REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES
  ) {
    throw new RangeError(
      `Source-parity canonical byte limit ${String(maximumCanonicalBytes)} must be 2 through ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES}.`,
    );
  }
  const snapshot = boundedBrowserResultSnapshot(result, maximumCanonicalBytes);
  const canonical = canonicalStringify(snapshot);
  const canonicalBytes = Buffer.from(canonical);
  if (canonicalBytes.length < 2 || canonicalBytes.length > maximumCanonicalBytes) {
    throw new RangeError(
      `Canonical source-parity browser result has ${canonicalBytes.length} bytes; expected 2 through ${maximumCanonicalBytes}.`,
    );
  }
  return {
    digest: sha256Digest(canonicalBytes),
    bytes: canonicalBytes.length,
    canonicalBytes,
  };
}
