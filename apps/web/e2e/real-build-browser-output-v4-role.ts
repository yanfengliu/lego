import { createHash } from "node:crypto";

import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
} from "./real-build-compiled-observation-closure-types";
import { MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES } from "./real-build-compiled-placement-lineage-types";
import {
  REAL_BUILD_BROWSER_BRANCH_EVIDENCE_SCHEMA_VERSION,
  type RealBuildBrowserBranchEvidenceV1,
  type RealBuildBrowserBranchObservationReference,
  type RealBuildBrowserBranchRoleDescriptor,
  type RealBuildBrowserBranchRoleName,
  type RealBuildBrowserBranchStepEvidenceIndex,
  type RealBuildBrowserCompiledBranchJsonReference,
} from "./real-build-browser-output-v4-types";

export const MAXIMUM_REAL_BUILD_BROWSER_BRANCH_INDEX_BYTES = 8 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES = 512 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL = 512 * 1024 * 1024;

const MAXIMUM_BRANCH_INDEX_JSON_DEPTH = 64;
const MAXIMUM_BRANCH_INDEX_JSON_VALUES = 32_768;
const MAXIMUM_BRANCH_STEPS = 359;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "length")?.get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const TYPED_ARRAY_TAG = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const SHARED_BYTE_LENGTH =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;

interface InspectedBytes {
  readonly value: unknown;
  readonly length: number;
  readonly buffer: ArrayBufferLike;
}

function sha256(value: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(value).digest("hex")}` as Sha256Digest;
}

function inspectGenuineBytes(value: unknown, label: string): InspectedBytes {
  let length: number;
  let buffer: ArrayBufferLike;
  let tag: string;
  try {
    if (
      TYPED_ARRAY_LENGTH === undefined ||
      TYPED_ARRAY_BUFFER === undefined ||
      TYPED_ARRAY_TAG === undefined
    ) {
      throw null;
    }
    length = TYPED_ARRAY_LENGTH.call(value) as number;
    buffer = TYPED_ARRAY_BUFFER.call(value) as ArrayBufferLike;
    tag = TYPED_ARRAY_TAG.call(value) as string;
  } catch {
    throw new TypeError(`${label} must be a genuine Uint8Array.`);
  }
  if (tag !== "Uint8Array") throw new TypeError(`${label} must be a genuine Uint8Array.`);
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new TypeError(`${label} must expose a stable non-negative safe byte length.`);
  }
  if (SHARED_BYTE_LENGTH !== undefined) {
    let shared = false;
    try {
      SHARED_BYTE_LENGTH.call(buffer);
      shared = true;
    } catch {
      // Ordinary ArrayBuffer storage rejects the SharedArrayBuffer intrinsic.
    }
    if (shared) {
      throw new TypeError(`${label} cannot use concurrently mutable SharedArrayBuffer storage.`);
    }
  }
  return { value, length, buffer };
}

function copyInspectedBytes(input: InspectedBytes, label: string): Uint8Array {
  const snapshot = new Uint8Array(input.length);
  try {
    Uint8Array.prototype.set.call(snapshot, input.value as Uint8Array);
  } catch {
    throw new TypeError(`${label} changed or detached during bounded copying.`);
  }
  return snapshot;
}

function snapshotBoundedBytes(value: unknown, maximum: number, label: string): Uint8Array {
  const inspected = inspectGenuineBytes(value, label);
  if (inspected.length > maximum) {
    throw new RangeError(`${label} contains ${inspected.length} bytes; maximum is ${maximum}.`);
  }
  return copyInspectedBytes(inspected, label);
}

function requireBoundedJson(text: string): void {
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
      if (depth > MAXIMUM_BRANCH_INDEX_JSON_DEPTH) {
        throw new RangeError(
          `Browser branch-evidence JSON exceeds depth ${MAXIMUM_BRANCH_INDEX_JSON_DEPTH} before parsing.`,
        );
      }
    } else if (character === "}" || character === "]") depth -= 1;
    else if (character === ",") values += 1;
    if (values > MAXIMUM_BRANCH_INDEX_JSON_VALUES) {
      throw new RangeError(
        `Browser branch-evidence JSON exceeds ${MAXIMUM_BRANCH_INDEX_JSON_VALUES} structural values before parsing.`,
      );
    }
  }
}

function exactRecord(
  value: unknown,
  path: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object with exact keys ${keys.join(", ")}.`);
  }
  const actual = Object.keys(value);
  if (actual.length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) {
    throw new TypeError(`${path} must have exact keys ${keys.join(", ")}.`);
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RangeError(`${path} must be a safe integer from ${minimum} through ${maximum}.`);
  }
  return Object.is(value, -0) ? 0 : (value as number);
}

function digest(value: unknown, path: string): Sha256Digest {
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${path} must be an exact lowercase sha256 digest.`);
  }
  return value as Sha256Digest;
}

function parseRoleDescriptor<Role extends RealBuildBrowserBranchRoleName>(
  value: unknown,
  path: string,
  expectedRole: Role,
): RealBuildBrowserBranchRoleDescriptor<Role> {
  const row = exactRecord(value, path, ["role", "bytes", "digest"]);
  if (row.role !== expectedRole) throw new TypeError(`${path}.role must be ${expectedRole}.`);
  return Object.freeze({
    role: expectedRole,
    bytes: integer(row.bytes, `${path}.bytes`, 0, MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES),
    digest: digest(row.digest, `${path}.digest`),
  });
}

function parseCompiledReference(
  value: unknown,
  path: string,
  maximumBytes: number,
): RealBuildBrowserCompiledBranchJsonReference {
  const row = exactRecord(value, path, ["role", "offset", "bytes", "digest", "encoding"]);
  if (row.role !== "compiled-branch-evidence-bytes") {
    throw new TypeError(`${path}.role must be compiled-branch-evidence-bytes.`);
  }
  if (row.encoding !== "utf8-json/1") {
    throw new TypeError(`${path}.encoding must be utf8-json/1.`);
  }
  return Object.freeze({
    role: "compiled-branch-evidence-bytes",
    offset: integer(row.offset, `${path}.offset`, 0, MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES),
    bytes: integer(row.bytes, `${path}.bytes`, 1, maximumBytes),
    digest: digest(row.digest, `${path}.digest`),
    encoding: "utf8-json/1",
  });
}

function parseObservationReference(
  value: unknown,
  path: string,
): RealBuildBrowserBranchObservationReference {
  const row = exactRecord(value, path, ["role", "offset", "bytes", "digest", "encoding"]);
  if (row.role !== "branch-observation-bytes") {
    throw new TypeError(`${path}.role must be branch-observation-bytes.`);
  }
  if (row.encoding !== "raw-bytes/1") {
    throw new TypeError(`${path}.encoding must be raw-bytes/1.`);
  }
  return Object.freeze({
    role: "branch-observation-bytes",
    offset: integer(row.offset, `${path}.offset`, 0, MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES),
    bytes: integer(
      row.bytes,
      `${path}.bytes`,
      1,
      MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
    ),
    digest: digest(row.digest, `${path}.digest`),
    encoding: "raw-bytes/1",
  });
}

function parseBranchEvidence(bytes: unknown): RealBuildBrowserBranchEvidenceV1 {
  const snapshot = snapshotBoundedBytes(
    bytes,
    MAXIMUM_REAL_BUILD_BROWSER_BRANCH_INDEX_BYTES,
    "Browser branch-evidence index",
  );
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(snapshot);
  } catch {
    throw new TypeError("Browser branch-evidence index is not well-formed UTF-8.");
  }
  requireBoundedJson(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError("Browser branch-evidence index is not valid JSON.");
  }
  const row = exactRecord(parsed, "branchEvidence", [
    "schemaVersion",
    "compiledBranchRole",
    "observationRole",
    "steps",
  ]);
  if (row.schemaVersion !== REAL_BUILD_BROWSER_BRANCH_EVIDENCE_SCHEMA_VERSION) {
    throw new TypeError(
      `branchEvidence.schemaVersion must be ${REAL_BUILD_BROWSER_BRANCH_EVIDENCE_SCHEMA_VERSION}.`,
    );
  }
  if (!Array.isArray(row.steps) || row.steps.length > MAXIMUM_BRANCH_STEPS) {
    throw new RangeError(
      `branchEvidence.steps must contain 0 through ${MAXIMUM_BRANCH_STEPS} entries.`,
    );
  }
  const steps: RealBuildBrowserBranchStepEvidenceIndex[] = [];
  let previousStep = 0;
  for (let index = 0; index < row.steps.length; index += 1) {
    if (!Object.hasOwn(row.steps, index)) {
      throw new TypeError(`branchEvidence.steps has a hole at index ${index}.`);
    }
    const path = `branchEvidence.steps[${index}]`;
    const step = exactRecord(row.steps[index], path, [
      "stepNumber",
      "compiledLineage",
      "observationClosure",
      "observations",
    ]);
    const stepNumber = integer(step.stepNumber, `${path}.stepNumber`, 1, MAXIMUM_BRANCH_STEPS);
    if (stepNumber <= previousStep) {
      throw new TypeError(`${path}.stepNumber must be strictly greater than ${previousStep}.`);
    }
    const observationClosure =
      step.observationClosure === null
        ? null
        : parseCompiledReference(
            step.observationClosure,
            `${path}.observationClosure`,
            MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
          );
    const observations =
      step.observations === null
        ? null
        : parseObservationReference(step.observations, `${path}.observations`);
    if (observationClosure === null && observations !== null) {
      throw new TypeError(
        `${path}.observations cannot retain bytes without an observationClosure reference.`,
      );
    }
    steps.push(
      Object.freeze({
        stepNumber,
        compiledLineage: parseCompiledReference(
          step.compiledLineage,
          `${path}.compiledLineage`,
          MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
        ),
        observationClosure,
        observations,
      }),
    );
    previousStep = stepNumber;
  }
  const compiledBranchRole = parseRoleDescriptor(
    row.compiledBranchRole,
    "branchEvidence.compiledBranchRole",
    "compiled-branch-evidence-bytes",
  );
  const observationRole = parseRoleDescriptor(
    row.observationRole,
    "branchEvidence.observationRole",
    "branch-observation-bytes",
  );
  if (
    compiledBranchRole.bytes + observationRole.bytes >
    MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL
  ) {
    throw new RangeError(
      `Browser branch-evidence declares ${compiledBranchRole.bytes + observationRole.bytes} role bytes; combined maximum is ${MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL}.`,
    );
  }
  return Object.freeze({
    schemaVersion: REAL_BUILD_BROWSER_BRANCH_EVIDENCE_SCHEMA_VERSION,
    compiledBranchRole,
    observationRole,
    steps: Object.freeze(steps),
  });
}

type BranchReference =
  RealBuildBrowserCompiledBranchJsonReference | RealBuildBrowserBranchObservationReference;

function requireDenseReferences(
  references: readonly BranchReference[],
  descriptor: RealBuildBrowserBranchRoleDescriptor<RealBuildBrowserBranchRoleName>,
): void {
  let cursor = 0;
  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index]!;
    if (reference.offset !== cursor) {
      throw new TypeError(
        `${descriptor.role} reference ${index} starts at ${reference.offset}; ordered dense coverage requires ${cursor}.`,
      );
    }
    cursor += reference.bytes;
    if (!Number.isSafeInteger(cursor) || cursor > descriptor.bytes) {
      throw new RangeError(
        `${descriptor.role} reference ${index} ends at ${cursor}; the role declares ${descriptor.bytes} bytes.`,
      );
    }
  }
  if (cursor !== descriptor.bytes) {
    throw new TypeError(
      `${descriptor.role} references cover ${cursor} bytes; exact dense role coverage requires ${descriptor.bytes}.`,
    );
  }
}

function verifySnapshottedRole(
  inspected: InspectedBytes,
  descriptor: RealBuildBrowserBranchRoleDescriptor<RealBuildBrowserBranchRoleName>,
  references: readonly BranchReference[],
): void {
  const snapshot = copyInspectedBytes(inspected, `Browser ${descriptor.role} role`);
  const observedDigest = sha256(snapshot);
  if (observedDigest !== descriptor.digest) {
    throw new TypeError(
      `Browser ${descriptor.role} role hashes to ${observedDigest}; its descriptor pins ${descriptor.digest}.`,
    );
  }
  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index]!;
    const observed = sha256(
      snapshot.subarray(reference.offset, reference.offset + reference.bytes),
    );
    if (observed !== reference.digest) {
      throw new TypeError(
        `Browser ${descriptor.role} reference ${index} hashes to ${observed}; it pins ${reference.digest}.`,
      );
    }
  }
}

/**
 * Inspects only the bounded /4 role transport. Compiled lineage and observation-closure semantics
 * are intentionally not parsed here, and the returned frozen index grants no placement authority.
 */
export function inspectRealBuildBrowserBranchEvidenceV1(
  branchEvidenceBytes: unknown,
  compiledBranchRoleBytes: unknown,
  observationRoleBytes: unknown,
): RealBuildBrowserBranchEvidenceV1 {
  const evidence = parseBranchEvidence(branchEvidenceBytes);
  const compiled = inspectGenuineBytes(
    compiledBranchRoleBytes,
    "Browser compiled-branch-evidence-bytes role",
  );
  const observations = inspectGenuineBytes(
    observationRoleBytes,
    "Browser branch-observation-bytes role",
  );
  if (
    compiled.length > MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES ||
    observations.length > MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES
  ) {
    throw new RangeError(
      `Browser branch roles contain ${compiled.length} and ${observations.length} bytes; each maximum is ${MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES}.`,
    );
  }
  if (compiled.length + observations.length > MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL) {
    throw new RangeError(
      `Browser branch roles contain ${compiled.length + observations.length} bytes; combined maximum is ${MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL}.`,
    );
  }
  if (compiled.length !== evidence.compiledBranchRole.bytes) {
    throw new TypeError(
      `Browser compiled-branch-evidence-bytes role contains ${compiled.length} bytes; its descriptor declares ${evidence.compiledBranchRole.bytes}.`,
    );
  }
  if (observations.length !== evidence.observationRole.bytes) {
    throw new TypeError(
      `Browser branch-observation-bytes role contains ${observations.length} bytes; its descriptor declares ${evidence.observationRole.bytes}.`,
    );
  }
  const compiledReferences = evidence.steps.flatMap(({ compiledLineage, observationClosure }) =>
    observationClosure === null ? [compiledLineage] : [compiledLineage, observationClosure],
  );
  const observationReferences = evidence.steps.flatMap(({ observations: reference }) =>
    reference === null ? [] : [reference],
  );
  requireDenseReferences(compiledReferences, evidence.compiledBranchRole);
  requireDenseReferences(observationReferences, evidence.observationRole);
  verifySnapshottedRole(compiled, evidence.compiledBranchRole, compiledReferences);
  verifySnapshottedRole(observations, evidence.observationRole, observationReferences);
  return evidence;
}
