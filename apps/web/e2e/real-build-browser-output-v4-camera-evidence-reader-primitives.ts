import type { Sha256Digest } from "@lego-studio/brick-kernel";
import { isProxy } from "node:util/types";

import {
  inspectHostileUint8ArrayLength,
  snapshotHostileUint8Array,
} from "./real-build-hostile-uint8array";
import { digestRealBuildBrowserCameraEvidenceBytes } from "./real-build-browser-output-v4-camera-evidence-digest";
import {
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES,
  REAL_BUILD_BROWSER_CAMERA_EVIDENCE_SCHEMA_VERSION,
  type RealBuildBrowserCameraEvidenceBytes,
} from "./real-build-browser-output-v4-camera-evidence-types";

const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_JSON = JSON;
const SAFE_JSON_PARSE = JSON.parse;
const SAFE_OBJECT_KEYS = Object.keys;
const SAFE_OBJECT_HAS_OWN = Object.hasOwn;
const SAFE_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype) as object,
  "buffer",
)?.get;
const decoder = new TextDecoder("utf-8", { fatal: true });
const SAFE_TEXT_DECODE = TextDecoder.prototype.decode;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
export const SOURCE_PATTERN = /^compiled-observation-source:sha256:[0-9a-f]{64}$/u;
export const CAMERA_PATTERN = /^compiled-observation-camera:sha256:[0-9a-f]{64}$/u;
export const EVIDENCE_PATTERN = /^browser-camera-evidence:sha256:[0-9a-f]{64}$/u;

export function exact(
  value: unknown,
  path: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || SAFE_ARRAY_IS_ARRAY(value))
    throw new TypeError(`${path} must be an object with exact keys ${keys.join(", ")}.`);
  const actual = SAFE_OBJECT_KEYS(value);
  if (actual.length !== keys.length)
    throw new TypeError(`${path} must have exact keys ${keys.join(", ")}.`);
  for (const key of keys)
    if (!SAFE_OBJECT_HAS_OWN(value, key))
      throw new TypeError(`${path} must have exact keys ${keys.join(", ")}.`);
  return value as Record<string, unknown>;
}

export function number(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${path} must be finite.`);
  return Object.is(value, -0) ? 0 : value;
}

export function integer(
  value: unknown,
  path: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum)
    throw new RangeError(`${path} must be a safe integer from ${minimum} through ${maximum}.`);
  return value as number;
}

export function digest(value: unknown, path: string): Sha256Digest {
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value))
    throw new TypeError(`${path} must be an exact lowercase SHA-256 digest.`);
  return value as Sha256Digest;
}

export function identifier(value: unknown, pattern: RegExp, path: string): string {
  if (typeof value !== "string" || !pattern.test(value)) throw new TypeError(`${path} is invalid.`);
  return value;
}

export function snapshot(
  value: unknown,
  maximumBytes: number,
  path: string,
  buffers: WeakSet<object>,
): Uint8Array {
  let buffer: object;
  try {
    if (SAFE_TYPED_ARRAY_BUFFER === undefined) throw null;
    buffer = SAFE_REFLECT_APPLY(SAFE_TYPED_ARRAY_BUFFER, value, []) as object;
  } catch {
    throw new TypeError(`${path} must be a genuine Uint8Array.`);
  }
  if (buffers.has(buffer)) throw new TypeError(`${path} aliases another evidence role.`);
  buffers.add(buffer);
  return snapshotHostileUint8Array(value, {
    maximumBytes,
    typeError: `${path} must be a genuine Uint8Array.`,
    oversizeError: (length) => `${path} contains ${length} bytes; maximum is ${maximumBytes}.`,
    sharedError: `${path} cannot use SharedArrayBuffer storage.`,
    copyError: `${path} changed or detached during copying.`,
  });
}

export function boundaryField(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object" || isProxy(value) || SAFE_ARRAY_IS_ARRAY(value))
    throw new TypeError("Camera evidence input must be a non-Proxy own-data record.");
  const descriptor = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
  if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable)
    throw new TypeError(`Camera evidence input.${key} must be an enumerable own data field.`);
  return descriptor.value;
}

export function measuredLength(value: unknown, maximumBytes: number, path: string): number {
  return inspectHostileUint8ArrayLength(value, {
    maximumBytes,
    typeError: `${path} must be a genuine Uint8Array.`,
    oversizeError: (length) => `${path} contains ${length} bytes; maximum is ${maximumBytes}.`,
    sharedError: `${path} cannot use SharedArrayBuffer storage.`,
  });
}

export function boundedJson(text: string): void {
  let depth = 0;
  let values = 1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{" || character === "[") {
      depth += 1;
      values += 1;
      if (depth > 64) throw new RangeError("Camera evidence JSON exceeds depth 64 before parsing.");
    } else if (character === ",") {
      values += 1;
      if (values > 1_000_000)
        throw new RangeError("Camera evidence JSON has too many values before parsing.");
    }
  }
}

export function role(value: unknown, path: string, expected: string, maximum: number) {
  const row = exact(value, path, ["role", "bytes", "digest"]);
  if (row.role !== expected) throw new TypeError(`${path}.role must be ${expected}.`);
  return {
    role: expected,
    bytes: integer(row.bytes, `${path}.bytes`, 0, maximum),
    digest: digest(row.digest, `${path}.digest`),
  };
}

export function parseRealBuildBrowserCameraEvidenceInput(
  input: RealBuildBrowserCameraEvidenceBytes,
) {
  const manifestValue = boundaryField(input, "manifestBytes");
  const renderValue = boundaryField(input, "renderRoleBytes");
  const maskValue = boundaryField(input, "maskRoleBytes");
  const totalBytes =
    measuredLength(
      manifestValue,
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES,
      "Camera evidence manifest",
    ) +
    measuredLength(
      renderValue,
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
      "Camera render role",
    ) +
    measuredLength(
      maskValue,
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
      "Camera mask role",
    );
  if (totalBytes > MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES)
    throw new RangeError(
      `Camera evidence contains ${totalBytes} bytes; aggregate maximum is ${MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES}.`,
    );
  const buffers = new WeakSet<object>();
  const manifestBytes = snapshot(
    manifestValue,
    MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES,
    "Camera evidence manifest",
    buffers,
  );
  const renderBytes = snapshot(
    renderValue,
    MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
    "Camera render role",
    buffers,
  );
  const maskBytes = snapshot(
    maskValue,
    MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
    "Camera mask role",
    buffers,
  );
  let text: string;
  try {
    text = SAFE_REFLECT_APPLY(SAFE_TEXT_DECODE, decoder, [manifestBytes]) as string;
  } catch {
    throw new TypeError("Camera evidence manifest must be fatal-valid UTF-8.");
  }
  boundedJson(text);
  let parsed: unknown;
  try {
    parsed = SAFE_REFLECT_APPLY(SAFE_JSON_PARSE, SAFE_JSON, [text]);
  } catch {
    throw new TypeError("Camera evidence manifest must be valid JSON.");
  }
  const root = exact(parsed, "manifest", [
    "schemaVersion",
    "renderRole",
    "maskRole",
    "rows",
    "provisionalAuthority",
    "sourceExecutionProvenanceAuthority",
    "physicalAuthority",
    "placementAuthority",
    "completionAuthority",
  ]);
  if (root.schemaVersion !== REAL_BUILD_BROWSER_CAMERA_EVIDENCE_SCHEMA_VERSION)
    throw new TypeError("Camera evidence schemaVersion is invalid.");
  const renderRole = role(
    root.renderRole,
    "manifest.renderRole",
    "d4-child-render-rgba-bytes",
    MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
  );
  const maskRole = role(
    root.maskRole,
    "manifest.maskRole",
    "branch-observation-bytes",
    MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
  );
  if (
    renderRole.bytes !== renderBytes.length ||
    renderRole.digest !== digestRealBuildBrowserCameraEvidenceBytes(renderBytes)
  )
    throw new TypeError("Camera render role length or digest is invalid.");
  if (
    maskRole.bytes !== maskBytes.length ||
    maskRole.digest !== digestRealBuildBrowserCameraEvidenceBytes(maskBytes)
  )
    throw new TypeError("Camera mask role length or digest is invalid.");
  return { root, renderBytes, maskBytes, renderRole, maskRole };
}
