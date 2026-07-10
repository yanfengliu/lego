import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import { validateArtifactRefV1, type ArtifactRefV1 } from "@lego-studio/protocol";

import {
  RunLedgerError,
  type AppendRunEventInput,
  type CandidateState,
  type CandidateTransition,
  type NativeRunTransition,
  type ProviderAttemptState,
  type ProviderAttemptTransition,
  type RunState,
  type RunTransition,
} from "./run-ledger-types.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
export const APPEND_SNAPSHOT_POLICY = Object.freeze({
  maxDepth: 8,
  maxNodes: 4096,
  maxArrayLength: 256,
  maxObjectProperties: 32,
  maxStringLength: 8192,
  maxTotalStringLength: 512 * 1024,
});
const RUN_STATES = new Set<RunState>([
  "created",
  "queued",
  "running",
  "draining",
  "cancelling",
  "cancelled",
  "succeeded",
  "failed",
  "exhausted",
  "persistenceFailed",
]);
const PROVIDER_ATTEMPT_STATES = new Set<ProviderAttemptState>([
  "created",
  "running",
  "succeeded",
  "failed",
  "timedOut",
  "cancelled",
]);
const CANDIDATE_STATES = new Set<CandidateState>([
  "received",
  "compiled",
  "hardInvalid",
  "diagnosticRendered",
  "diagnosticReviewed",
  "hardValid",
  "rendered",
  "critiqued",
  "ranked",
  "persistenceFailed",
  "presented",
  "compileRejected",
  "archived",
  "cancelled",
  "processingFailed",
]);

export function assertIdentifier(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    !IDENTIFIER_PATTERN.test(value)
  ) {
    throw new RunLedgerError("INVALID_RECORD", `${label} is not a protocol identifier`);
  }
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RunLedgerError("INVALID_RECORD", `${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RunLedgerError("INVALID_RECORD", `${label} must be a plain object`);
  }
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string")) {
    throw new RunLedgerError("INVALID_RECORD", `${label} cannot contain symbol keys`);
  }
  const names = (actual as string[]).sort();
  const expected = [...keys].sort();
  if (names.length !== expected.length || names.some((key, index) => key !== expected[index])) {
    throw new RunLedgerError("INVALID_RECORD", `${label} has unknown or missing fields`);
  }
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if (!("value" in descriptor)) {
      throw new RunLedgerError("INVALID_RECORD", `${label} cannot contain accessors`);
    }
  }
  return value as Record<string, unknown>;
}

interface SnapshotBudget {
  nodes: number;
  stringLength: number;
  readonly ancestors: WeakSet<object>;
}

function snapshotData(value: unknown, budget: SnapshotBudget, depth: number): unknown {
  budget.nodes += 1;
  if (budget.nodes > APPEND_SNAPSHOT_POLICY.maxNodes || depth > APPEND_SNAPSHOT_POLICY.maxDepth) {
    throw new RunLedgerError("INVALID_RECORD", "Append input exceeds its structural bounds");
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RunLedgerError("INVALID_RECORD", "Append input numbers must be finite");
    }
    return value;
  }
  if (typeof value === "string") {
    budget.stringLength += value.length;
    if (
      value.length > APPEND_SNAPSHOT_POLICY.maxStringLength ||
      budget.stringLength > APPEND_SNAPSHOT_POLICY.maxTotalStringLength
    ) {
      throw new RunLedgerError("INVALID_RECORD", "Append input strings exceed their bounds");
    }
    return value;
  }
  if (typeof value !== "object" || value === undefined || isProxy(value)) {
    throw new RunLedgerError("INVALID_RECORD", "Append input must contain only data values");
  }
  if (budget.ancestors.has(value)) {
    throw new RunLedgerError("INVALID_RECORD", "Append input cannot contain cycles");
  }
  budget.ancestors.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value)) {
      const lengthDescriptor = descriptors.length;
      const length = lengthDescriptor && "value" in lengthDescriptor ? lengthDescriptor.value : -1;
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > APPEND_SNAPSHOT_POLICY.maxArrayLength
      ) {
        throw new RunLedgerError("INVALID_RECORD", "Append input array exceeds its bound");
      }
      const keys = Reflect.ownKeys(descriptors).filter((key) => key !== "length");
      if (
        keys.length !== length ||
        keys.some(
          (key, index) =>
            key !== String(index) ||
            !("value" in descriptors[key]!) ||
            descriptors[key]!.enumerable !== true,
        )
      ) {
        throw new RunLedgerError("INVALID_RECORD", "Append input arrays must be dense data");
      }
      return (keys as string[]).map((key) =>
        snapshotData(descriptors[key]!.value, budget, depth + 1),
      );
    }
    if (prototype !== Object.prototype && prototype !== null) {
      throw new RunLedgerError("INVALID_RECORD", "Append input objects must be plain data");
    }
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length > APPEND_SNAPSHOT_POLICY.maxObjectProperties ||
      keys.some(
        (key) =>
          typeof key !== "string" ||
          !("value" in descriptors[key]!) ||
          descriptors[key]!.enumerable !== true,
      )
    ) {
      throw new RunLedgerError("INVALID_RECORD", "Append input objects exceed data-only policy");
    }
    const copy: Record<string, unknown> = {};
    for (const key of keys as string[]) {
      copy[key] = snapshotData(descriptors[key]!.value, budget, depth + 1);
    }
    return copy;
  } finally {
    budget.ancestors.delete(value);
  }
}

function normalizeTransition(value: unknown): NativeRunTransition {
  const record = exactRecord(value, ["subject", "subjectId", "from", "to"], "Transition");
  assertIdentifier(record.subjectId, "Transition subject ID");
  const from = record.from;
  const to = record.to;
  if (record.subject === "run") {
    if ((from !== null && !RUN_STATES.has(from as RunState)) || !RUN_STATES.has(to as RunState)) {
      throw new RunLedgerError("INVALID_RECORD", "Run transition contains an unknown state");
    }
    return Object.freeze({
      subject: "run",
      subjectId: record.subjectId,
      from,
      to,
    }) as RunTransition;
  }
  if (record.subject === "providerAttempt") {
    if (
      (from !== null && !PROVIDER_ATTEMPT_STATES.has(from as ProviderAttemptState)) ||
      !PROVIDER_ATTEMPT_STATES.has(to as ProviderAttemptState)
    ) {
      throw new RunLedgerError(
        "INVALID_RECORD",
        "Provider attempt transition has an unknown state",
      );
    }
    return Object.freeze({
      subject: "providerAttempt",
      subjectId: record.subjectId,
      from,
      to,
    }) as ProviderAttemptTransition;
  }
  if (record.subject === "candidate") {
    if (
      (from !== null && !CANDIDATE_STATES.has(from as CandidateState)) ||
      !CANDIDATE_STATES.has(to as CandidateState)
    ) {
      throw new RunLedgerError("INVALID_RECORD", "Candidate transition contains an unknown state");
    }
    return Object.freeze({
      subject: "candidate",
      subjectId: record.subjectId,
      from,
      to,
    }) as CandidateTransition;
  }
  throw new RunLedgerError("INVALID_RECORD", "Transition subject is unknown");
}

function normalizeArtifactRefs(value: unknown): readonly ArtifactRefV1[] {
  if (!Array.isArray(value)) {
    throw new RunLedgerError("INVALID_RECORD", "Artifact references must be an array");
  }
  const refs = value.map((reference, index) => {
    if (!validateArtifactRefV1(reference)) {
      throw new RunLedgerError(
        "INVALID_RECORD",
        `Artifact reference ${index} violates ArtifactRefV1`,
      );
    }
    return Object.freeze({ ...reference });
  });
  const hashes = refs.map(({ sha256 }) => sha256);
  const ids = refs.map(({ artifactId }) => artifactId);
  if (new Set(hashes).size !== hashes.length || new Set(ids).size !== ids.length) {
    throw new RunLedgerError("INVALID_RECORD", "Artifact references must be unique by ID and hash");
  }
  return Object.freeze(refs);
}

export function normalizeAppendInput(value: unknown): AppendRunEventInput {
  const detached = snapshotData(value, { nodes: 0, stringLength: 0, ancestors: new WeakSet() }, 0);
  const record = exactRecord(
    detached,
    [
      "schemaVersion",
      "namespace",
      "expectedRunId",
      "actorId",
      "idempotencyKey",
      "cancellationGeneration",
      "transition",
      "artifactRefs",
    ],
    "Append input",
  );
  if (record.schemaVersion !== "lego.test-run-append/1" || record.namespace !== "test") {
    throw new RunLedgerError("INVALID_RECORD", "Append input has the wrong schema or namespace");
  }
  assertIdentifier(record.expectedRunId, "Expected run ID");
  assertIdentifier(record.actorId, "Actor ID");
  assertIdentifier(record.idempotencyKey, "Idempotency key");
  if (
    !Number.isSafeInteger(record.cancellationGeneration) ||
    (record.cancellationGeneration as number) < 0 ||
    (record.cancellationGeneration as number) > 2_147_483_647
  ) {
    throw new RunLedgerError("INVALID_RECORD", "Cancellation generation is outside policy");
  }
  return Object.freeze({
    schemaVersion: "lego.test-run-append/1",
    namespace: "test",
    expectedRunId: record.expectedRunId,
    actorId: record.actorId,
    idempotencyKey: record.idempotencyKey,
    cancellationGeneration: record.cancellationGeneration as number,
    transition: normalizeTransition(record.transition),
    artifactRefs: normalizeArtifactRefs(record.artifactRefs),
  });
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RunLedgerError("INVALID_RECORD", "Numbers must be finite");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new RunLedgerError("INVALID_RECORD", "Value cannot be canonically serialized");
}

export function sha256(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function requestDigest(input: AppendRunEventInput): `sha256:${string}` {
  return sha256(canonicalJson(input));
}

export function transitionLabel(transition: NativeRunTransition): string {
  return `${transition.subject}.${transition.from ?? "none"}.${transition.to}`;
}
