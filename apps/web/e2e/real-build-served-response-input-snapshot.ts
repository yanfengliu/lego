import { Buffer } from "node:buffer";
import { types as nodeTypes } from "node:util";

import { snapshotBoundedUint8Array } from "./bounded-uint8-snapshot";
import type { RealBuildSourceSnapshot } from "./real-build-replay-files";
import {
  MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
  MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES,
} from "./real-build-served-response-policy";

const REQUIRED_INPUT_KEYS = [
  "manifestBytes",
  "bodyChunkBytes",
  "expectedManifestDigest",
  "sourceFiles",
] as const;
const OPTIONAL_INPUT_KEYS = [
  "requireRunner",
  "expectedCheckoutRoot",
  "frozenLegacyArtifactManifestV3RunId",
] as const;
const MAXIMUM_SOURCE_FILES = 10_020;

function snapshotDataRecord(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  label: string,
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    nodeTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be a non-proxy plain data record.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must have Object.prototype or null prototype.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  const allowed = new Set([...required, ...optional]);
  if (
    keys.some((key) => typeof key !== "string" || !allowed.has(key)) ||
    required.some((key) => !Object.hasOwn(descriptors, key))
  ) {
    throw new TypeError(
      `${label} must contain required [${required.join(", ")}] and only optional [${optional.join(", ")}].`,
    );
  }
  const snapshot: Record<string, unknown> = {};
  for (const key of keys as string[]) {
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(`${label}.${key} must be an enumerable data property, not an accessor.`);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function snapshotDenseArray(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): unknown[] {
  if (nodeTypes.isProxy(value) || !Array.isArray(value)) {
    throw new TypeError(`${label} must be a non-proxy Array.`);
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError(`${label} must be an ordinary Array with Array.prototype.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < minimum ||
    lengthDescriptor.value > maximum
  ) {
    throw new RangeError(`${label} must contain ${minimum} through ${maximum} entries.`);
  }
  const length = lengthDescriptor.value as number;
  const keys = Reflect.ownKeys(descriptors);
  const expected = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
  if (
    keys.some((key) => typeof key !== "string" || !expected.has(key)) ||
    keys.length !== expected.size
  ) {
    throw new TypeError(`${label} must be dense and contain no symbol or extra properties.`);
  }
  const snapshot = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)]!;
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(
        `${label}[${index}] must be an enumerable data property, not an accessor.`,
      );
    }
    snapshot[index] = descriptor.value;
  }
  return snapshot;
}

export interface SnapshottedServedResponseVerificationInput {
  readonly manifestBytes: Buffer;
  readonly bodyChunkBytes: readonly Buffer[];
  readonly expectedManifestDigest: unknown;
  readonly sourceFiles: readonly RealBuildSourceSnapshot[];
  readonly requireRunner: boolean | undefined;
  readonly expectedCheckoutRoot: string | undefined;
  readonly frozenLegacyArtifactManifestV3RunId: string | undefined;
}

/** Detaches the entire public input before manifest parsing, hashing, or semantic work. */
export function snapshotServedResponseVerificationInput(
  value: unknown,
): SnapshottedServedResponseVerificationInput {
  const outer = snapshotDataRecord(
    value,
    REQUIRED_INPUT_KEYS,
    OPTIONAL_INPUT_KEYS,
    "Served-response verification input",
  );
  const rawChunks = snapshotDenseArray(outer.bodyChunkBytes, 0, 4, "bodyChunkBytes");
  const rawSources = snapshotDenseArray(outer.sourceFiles, 1, MAXIMUM_SOURCE_FILES, "sourceFiles");
  const sourceRecords = rawSources.map((source, index) =>
    snapshotDataRecord(source, ["path", "digest", "bytes"], [], `sourceFiles[${index}]`),
  );
  if (outer.requireRunner !== undefined && typeof outer.requireRunner !== "boolean") {
    throw new TypeError(
      `Served-response requireRunner was ${typeof outer.requireRunner}; expected boolean or absent.`,
    );
  }
  for (const key of ["expectedCheckoutRoot", "frozenLegacyArtifactManifestV3RunId"] as const) {
    if (outer[key] !== undefined && typeof outer[key] !== "string") {
      throw new TypeError(
        `Served-response ${key} was ${typeof outer[key]}; expected string or absent.`,
      );
    }
  }
  const manifestBytes = snapshotBoundedUint8Array(outer.manifestBytes, {
    label: "Served-response manifest",
    minimumBytes: 1,
    maximumBytes: MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES,
  });
  const bodyChunkBytes = rawChunks.map((chunk, index) =>
    snapshotBoundedUint8Array(chunk, {
      label: `Served-response body chunk ${index}`,
      minimumBytes: 1,
      maximumBytes: MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
    }),
  );
  return {
    manifestBytes,
    bodyChunkBytes,
    expectedManifestDigest: outer.expectedManifestDigest,
    sourceFiles: sourceRecords as unknown as readonly RealBuildSourceSnapshot[],
    requireRunner: outer.requireRunner as boolean | undefined,
    expectedCheckoutRoot: outer.expectedCheckoutRoot as string | undefined,
    frozenLegacyArtifactManifestV3RunId: outer.frozenLegacyArtifactManifestV3RunId as
      string | undefined,
  };
}
