import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  validateBrickDocumentV1,
  validateBuildBriefV1,
  validateDeterministicMakerCaptureManifestV1,
  validateDeterministicMakerOutputV1,
  validateScopeCapabilityV1,
  type BrickDocumentV1,
  type BuildBriefV1,
  type ArtifactRefV1,
  type DeterministicMakerCaptureManifestV1,
  type DeterministicMakerOutputV1,
  type ScopeCapabilityV1,
  type TestRunSourceEventV1,
} from "@lego-studio/protocol";

import type { ArtifactStore } from "./artifact-policy.ts";
import { canonicalJson, sha256 } from "./run-ledger-codec.ts";
import type { StoredNativeRunEvent, TestRunLedger } from "./run-ledger-types.ts";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

export interface TestMakerRunRequest {
  readonly jobId: string;
  readonly document: BrickDocumentV1;
  readonly brief: BuildBriefV1;
  readonly scope: ScopeCapabilityV1;
}

export interface TestRunRecorderOptions {
  readonly schemaVersion: "lego.test-run-recorder-options/1";
  readonly namespace: "test";
  readonly runId: string;
  readonly actorId: string;
  readonly requestJson: string;
  readonly artifactStore: ArtifactStore;
  readonly ledger: TestRunLedger;
}

export interface NormalizedRecorderOptions extends TestRunRecorderOptions {
  readonly request: TestMakerRunRequest;
}

export type RecorderInputErrorCode =
  | "INVALID_REQUEST"
  | "RETENTION_NOT_AUTHORIZED"
  | "RETENTION_BUDGET_EXCEEDED"
  | "INVALID_MAKER_OUTPUT"
  | "INVALID_CAPTURE";

export class TestRunRecorderError extends Error {
  readonly code: RecorderInputErrorCode | "INVALID_STATE";

  constructor(code: TestRunRecorderError["code"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TestRunRecorderError";
    this.code = code;
  }
}

function boundedJsonStructure(value: string): boolean {
  let depth = 0;
  let tokens = 0;
  let inString = false;
  let escaped = false;
  let stringLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      else if (++stringLength > 65_536) return false;
      continue;
    }
    if (character === '"') {
      inString = true;
      stringLength = 0;
    } else if (character === "{" || character === "[") {
      depth += 1;
      tokens += 1;
      if (depth > 64) return false;
    } else if (character === "}" || character === "]") {
      depth -= 1;
      tokens += 1;
      if (depth < 0) return false;
    } else if (character === "," || character === ":") {
      tokens += 1;
    }
    if (tokens > 200_000) return false;
  }
  return depth === 0 && !inString;
}

function parseCanonicalJson(
  value: unknown,
  maxBytes: number,
  code: RecorderInputErrorCode,
): unknown {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > maxBytes ||
    !boundedJsonStructure(value)
  ) {
    throw new TestRunRecorderError(code, "Recorder input is not bounded canonical JSON");
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (canonicalJson(parsed) !== value) throw new Error("not canonical");
    return parsed;
  } catch (error) {
    throw new TestRunRecorderError(code, "Recorder input is not bounded canonical JSON", {
      cause: error,
    });
  }
}

function exactRequest(value: unknown): TestMakerRunRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 4 ||
    keys[0] !== "brief" ||
    keys[1] !== "document" ||
    keys[2] !== "jobId" ||
    keys[3] !== "scope"
  ) {
    return null;
  }
  const record = value as Record<string, unknown>;
  return typeof record.jobId === "string" &&
    IDENTIFIER.test(record.jobId) &&
    validateBrickDocumentV1(record.document) &&
    validateBuildBriefV1(record.brief) &&
    validateScopeCapabilityV1(record.scope)
    ? (record as unknown as TestMakerRunRequest)
    : null;
}

export function parseRetainedTestMakerRequest(value: unknown): TestMakerRunRequest {
  const request = exactRequest(parseCanonicalJson(value, MAX_REQUEST_BYTES, "INVALID_REQUEST"));
  if (!request) {
    throw new TestRunRecorderError(
      "INVALID_REQUEST",
      "Test recorder request violates the exact maker input contract",
    );
  }
  const consent = request.brief.consent;
  if (
    consent.retainRunArtifacts !== true ||
    consent.providerTransmission !== "none" ||
    consent.knowledgeUse ||
    consent.benchmarkUse ||
    consent.trainingUse ||
    request.brief.referenceArtifactIds.length !== 0
  ) {
    throw new TestRunRecorderError(
      "RETENTION_NOT_AUTHORIZED",
      "Test recorder requires explicit local-only retention consent with no references or reuse",
    );
  }
  return request;
}

export function parseDeterministicMakerOutput(value: unknown): DeterministicMakerOutputV1 {
  const parsed = parseCanonicalJson(value, MAX_OUTPUT_BYTES, "INVALID_MAKER_OUTPUT");
  if (!validateDeterministicMakerOutputV1(parsed)) {
    throw new TestRunRecorderError(
      "INVALID_MAKER_OUTPUT",
      "Captured maker output violates its authority-free wire contract",
    );
  }
  return parsed as DeterministicMakerOutputV1;
}

export function parseCaptureManifest(value: unknown): DeterministicMakerCaptureManifestV1 {
  const detached = detachCaptureData(value);
  if (!validateDeterministicMakerCaptureManifestV1(detached)) {
    throw new TestRunRecorderError(
      "INVALID_CAPTURE",
      "Capture manifest violates its unsealed replay-checkpoint contract",
    );
  }
  return detached as DeterministicMakerCaptureManifestV1;
}

interface CaptureSnapshotBudget {
  nodes: number;
  stringChars: number;
  readonly ancestors: WeakSet<object>;
}

function snapshotCaptureData(
  value: unknown,
  budget: CaptureSnapshotBudget,
  depth: number,
): unknown {
  budget.nodes += 1;
  if (budget.nodes > 20_000 || depth > 24) throw new Error("capture structure exceeds bounds");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("capture number is not finite");
    return value;
  }
  if (typeof value === "string") {
    budget.stringChars += value.length;
    if (value.length > 8_192 || budget.stringChars > 1_048_576) {
      throw new Error("capture strings exceed bounds");
    }
    return value;
  }
  if (typeof value !== "object" || value === undefined || isProxy(value)) {
    throw new Error("capture contains executable or unsupported data");
  }
  if (budget.ancestors.has(value)) throw new Error("capture contains a cycle");
  budget.ancestors.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (Array.isArray(value)) {
      const lengthDescriptor = descriptors.length;
      const length = lengthDescriptor && "value" in lengthDescriptor ? lengthDescriptor.value : -1;
      const keys = Reflect.ownKeys(descriptors).filter((key) => key !== "length");
      if (
        prototype !== Array.prototype ||
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > 256 ||
        keys.length !== length ||
        keys.some(
          (key, index) =>
            key !== String(index) ||
            !("value" in descriptors[key]!) ||
            descriptors[key]!.enumerable !== true,
        )
      ) {
        throw new Error("capture array is sparse, exotic, or oversized");
      }
      return (keys as string[]).map((key) =>
        snapshotCaptureData(descriptors[key]!.value, budget, depth + 1),
      );
    }
    const keys = Reflect.ownKeys(descriptors);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length > 64 ||
      keys.some(
        (key) =>
          typeof key !== "string" ||
          !("value" in descriptors[key]!) ||
          descriptors[key]!.enumerable !== true,
      )
    ) {
      throw new Error("capture object is exotic, executable, or oversized");
    }
    const copy = Object.create(null) as Record<string, unknown>;
    for (const key of keys as string[]) {
      copy[key] = snapshotCaptureData(descriptors[key]!.value, budget, depth + 1);
    }
    return copy;
  } finally {
    budget.ancestors.delete(value);
  }
}

function detachCaptureData(value: unknown): unknown {
  try {
    return snapshotCaptureData(value, { nodes: 0, stringChars: 0, ancestors: new WeakSet() }, 0);
  } catch (error) {
    throw new TestRunRecorderError(
      "INVALID_CAPTURE",
      "Capture manifest must be bounded descriptor-only data",
      { cause: error },
    );
  }
}

export function assertCaptureBindings(
  requestJson: string,
  request: TestMakerRunRequest,
  outputJson: string,
  output: DeterministicMakerOutputV1,
  capture: DeterministicMakerCaptureManifestV1,
): void {
  if (
    capture.jobId !== request.jobId ||
    capture.requestHash !== sha256(requestJson) ||
    capture.requestByteLength !== Buffer.byteLength(requestJson, "utf8") ||
    capture.capturedProgramsHash !== sha256(outputJson) ||
    capture.capturedProgramsByteLength !== Buffer.byteLength(outputJson, "utf8") ||
    capture.generationVersion !== output.makerVersion
  ) {
    throw new TestRunRecorderError(
      "INVALID_CAPTURE",
      "Capture manifest is not bound to the retained request and maker output bytes",
    );
  }
  if (capture.resultOk && capture.candidates.length !== output.slots.length) {
    throw new TestRunRecorderError(
      "INVALID_CAPTURE",
      "Successful capture checkpoints do not cover every maker output slot",
    );
  }
  for (const candidate of capture.candidates) {
    const slot = output.slots[candidate.attemptIndex];
    if (
      !slot ||
      slot.index !== candidate.attemptIndex ||
      slot.strategyId !== candidate.strategyId
    ) {
      throw new TestRunRecorderError(
        "INVALID_CAPTURE",
        "Capture checkpoint identity does not match its maker output slot",
      );
    }
    if (slot.outcome.kind === "generationFailure") {
      if (
        candidate.status !== "failed" ||
        candidate.failureStage !== "generation" ||
        candidate.failureCode !== slot.outcome.failure.code ||
        candidate.programHash !== null
      ) {
        throw new TestRunRecorderError(
          "INVALID_CAPTURE",
          "Generation failure checkpoint is not bound to the captured failure outcome",
        );
      }
    } else if (
      candidate.failureStage === "generation" ||
      candidate.programHash !== slot.outcome.normalizedProgramHash
    ) {
      throw new TestRunRecorderError(
        "INVALID_CAPTURE",
        "Compiled candidate checkpoint is not bound to the captured program hash",
      );
    }
  }
}

function exactOptions(value: unknown): TestRunRecorderOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TestRunRecorderError("INVALID_STATE", "Recorder options must be a plain object");
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const expected = [
    "actorId",
    "artifactStore",
    "ledger",
    "namespace",
    "requestJson",
    "runId",
    "schemaVersion",
  ];
  const actual = Reflect.ownKeys(descriptors);
  if (
    prototype !== Object.prototype ||
    actual.some((key) => typeof key !== "string") ||
    actual.length !== expected.length ||
    (actual as string[]).sort().some((key, index) => key !== expected[index]) ||
    Object.values(descriptors).some((descriptor) => !("value" in descriptor))
  ) {
    throw new TestRunRecorderError(
      "INVALID_STATE",
      "Recorder options contain unknown, missing, or executable fields",
    );
  }
  return value as TestRunRecorderOptions;
}

export function normalizeRecorderOptions(value: unknown): NormalizedRecorderOptions {
  const options = exactOptions(value);
  const request = parseRetainedTestMakerRequest(options.requestJson);
  if (
    options.schemaVersion !== "lego.test-run-recorder-options/1" ||
    options.namespace !== "test" ||
    !IDENTIFIER.test(options.runId) ||
    !IDENTIFIER.test(options.actorId) ||
    typeof options.artifactStore?.put !== "function" ||
    typeof options.artifactStore?.read !== "function" ||
    options.ledger?.namespace !== "test" ||
    options.ledger?.runId !== options.runId ||
    typeof options.ledger.append !== "function" ||
    typeof options.ledger.finalizeBundle !== "function" ||
    typeof options.ledger.events !== "function" ||
    typeof options.ledger.snapshot !== "function"
  ) {
    throw new TestRunRecorderError(
      "INVALID_STATE",
      "Recorder capabilities and namespace must be bound to one explicit test run",
    );
  }
  return { ...options, request };
}

export function derivedRecorderId(label: string, runId: string): string {
  const digest = createHash("sha256").update(runId, "utf8").digest("hex").slice(0, 32);
  return `${label}-${digest}`;
}

export function recorderArtifactReference(
  artifactId: string,
  kind: ArtifactRefV1["kind"],
  json: string,
): ArtifactRefV1 {
  const digest = sha256(json);
  return {
    artifactId,
    kind,
    mediaType: "application/json",
    sha256: digest,
    byteLength: Buffer.byteLength(json, "utf8"),
    casKey: digest,
  };
}

export function sameArtifactReference(left: ArtifactRefV1, right: ArtifactRefV1): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

export function assertRecorderRetentionBudget(
  request: TestMakerRunRequest,
  references: readonly ArtifactRefV1[],
): void {
  const unique = new Map<string, number>();
  for (const reference of references) unique.set(reference.sha256, reference.byteLength);
  const retainedBytes = [...unique.values()].reduce((sum, byteLength) => sum + byteLength, 0);
  if (retainedBytes > request.brief.budgets.maxStoredBytes) {
    throw new TestRunRecorderError(
      "RETENTION_BUDGET_EXCEEDED",
      `Recorder artifacts need ${retainedBytes} bytes but the brief allows ${request.brief.budgets.maxStoredBytes}`,
    );
  }
}

export function recorderSourceEvent(stored: StoredNativeRunEvent): TestRunSourceEventV1 {
  if (stored.diagnostic) {
    throw new TestRunRecorderError(
      "INVALID_STATE",
      "Diagnostic events cannot source retained test bundle roles",
    );
  }
  return {
    sequence: stored.event.sequence,
    eventHash: stored.event.eventHash,
    transition: stored.event.transition,
    cancellationGeneration: stored.cancellationGeneration,
  };
}
