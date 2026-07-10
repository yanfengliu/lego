import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";

import type { ArtifactRefV1 } from "@lego-studio/protocol";

import {
  appendStoredEvent,
  openLedgerFiles,
  type LedgerFileIdentity,
  type LedgerPaths,
} from "./run-ledger-file.ts";
import {
  applyStoredEvent,
  createStoredEvent,
  snapshotState,
  type MutableRunLedgerState,
} from "./run-ledger-state.ts";
import {
  RunLedgerError,
  type AppendRunEventInput,
  type AppendRunEventResult,
  type ArtifactResolver,
  type RunLedgerLimits,
  type RunLedgerSnapshot,
  type StoredNativeRunEvent,
  type TestRunLedger,
  type TestRunLedgerOptions,
} from "./run-ledger-types.ts";
import {
  assertIdentifier,
  canonicalJson,
  normalizeAppendInput,
  requestDigest,
} from "./run-ledger-codec.ts";
import {
  assertEventArtifactLimits,
  assertRunArtifactAdmission,
  recoveredArtifactRefs,
} from "./run-ledger-artifact-index.ts";

const MEBIBYTE = 1024 * 1024;
const UINT8_ARRAY_SET = Uint8Array.prototype.set;

export const RUN_LEDGER_LIMITS: RunLedgerLimits = Object.freeze({
  maxEvents: 100_000,
  maxProviderAttempts: 64,
  maxCandidates: 16,
  maxArtifactRefsPerEvent: 256,
  maxReferencedBytesPerEvent: 64 * MEBIBYTE,
  maxArtifactRefsPerRun: 10_000,
  maxReferencedBytesPerRun: 1024 * MEBIBYTE,
  maxPendingAppends: 32,
  maxPendingAppendBytes: 8 * MEBIBYTE,
  maxRecordBytes: 256 * 1024,
  maxLedgerBytes: 128 * MEBIBYTE,
});

const HARD_LIMITS: RunLedgerLimits = Object.freeze({
  maxEvents: 1_000_000,
  maxProviderAttempts: 64,
  maxCandidates: 16,
  maxArtifactRefsPerEvent: 256,
  maxReferencedBytesPerEvent: 64 * MEBIBYTE,
  maxArtifactRefsPerRun: 10_000,
  maxReferencedBytesPerRun: 1024 * MEBIBYTE,
  maxPendingAppends: 1024,
  maxPendingAppendBytes: 64 * MEBIBYTE,
  maxRecordBytes: MEBIBYTE,
  maxLedgerBytes: 256 * MEBIBYTE,
});

const LIMIT_KEYS = Object.freeze(Object.keys(RUN_LEDGER_LIMITS) as (keyof RunLedgerLimits)[]);
const ACTIVE_LEDGER_KEYS = new Set<string>();

interface NormalizedOptions {
  readonly root: string;
  readonly runId: string;
  readonly artifactResolver: ArtifactResolver;
  readonly limits: RunLedgerLimits;
}

function normalizeLimits(value: unknown): RunLedgerLimits {
  if (value === undefined) return RUN_LEDGER_LIMITS;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger limits must be a plain object");
  }
  let descriptors: PropertyDescriptorMap;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error("not plain");
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger limits must be a plain object", {
      cause: error,
    });
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string" || !LIMIT_KEYS.includes(key as never))) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger limits contain an unknown field");
  }
  if (Object.values(descriptors).some((descriptor) => !("value" in descriptor))) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger limits cannot contain accessors");
  }
  const supplied = value as Partial<Record<keyof RunLedgerLimits, unknown>>;
  const normalized = Object.fromEntries(
    LIMIT_KEYS.map((key) => [
      key,
      Object.prototype.hasOwnProperty.call(supplied, key) ? supplied[key] : RUN_LEDGER_LIMITS[key],
    ]),
  ) as unknown as RunLedgerLimits;
  for (const key of LIMIT_KEYS) {
    const limit = normalized[key];
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > HARD_LIMITS[key]) {
      throw new RunLedgerError("INVALID_ROOT", `${key} is outside run-ledger policy`);
    }
  }
  if (normalized.maxLedgerBytes < normalized.maxRecordBytes) {
    throw new RunLedgerError("INVALID_ROOT", "Ledger byte cap must cover one complete record");
  }
  return Object.freeze(normalized);
}

function normalizeOptions(options: TestRunLedgerOptions): NormalizedOptions {
  if (typeof options !== "object" || options === null) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger options must be provided");
  }
  let descriptors: PropertyDescriptorMap;
  try {
    if (Object.getPrototypeOf(options) !== Object.prototype) {
      throw new Error("not plain");
    }
    descriptors = Object.getOwnPropertyDescriptors(options);
  } catch (error) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger options must be a plain object", {
      cause: error,
    });
  }
  const allowedKeys = new Set(["root", "namespace", "expectedRunId", "artifactResolver", "limits"]);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string" || !allowedKeys.has(key)) ||
    Object.values(descriptors).some((descriptor) => !("value" in descriptor))
  ) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger options have unknown or unsafe fields");
  }
  for (const required of ["root", "namespace", "expectedRunId", "artifactResolver"]) {
    if (!Object.prototype.hasOwnProperty.call(descriptors, required)) {
      throw new RunLedgerError("INVALID_ROOT", `Run-ledger option is missing: ${required}`);
    }
  }
  if (options.namespace !== "test") {
    throw new RunLedgerError(
      "INVALID_NAMESPACE",
      "This unreleased ledger implementation is restricted to the test namespace",
    );
  }
  if (
    typeof options.root !== "string" ||
    options.root.includes("\0") ||
    !isAbsolute(options.root)
  ) {
    throw new RunLedgerError("INVALID_ROOT", "Run-ledger root must be an explicit absolute path");
  }
  assertIdentifier(options.expectedRunId, "Expected run ID");
  if (
    typeof options.artifactResolver !== "object" ||
    options.artifactResolver === null ||
    typeof options.artifactResolver.read !== "function"
  ) {
    throw new RunLedgerError("INVALID_ROOT", "An artifact-store resolver interface is required");
  }
  return {
    root: options.root,
    runId: options.expectedRunId,
    artifactResolver: options.artifactResolver,
    limits: normalizeLimits(options.limits),
  };
}

function intrinsicByteLength(bytes: Uint8Array): number {
  try {
    const length = Reflect.get(
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!,
      "get",
    ) as (this: Uint8Array) => number;
    return Reflect.apply(length, bytes, []) as number;
  } catch (error) {
    throw new RunLedgerError("ARTIFACT_UNRESOLVED", "Artifact resolver returned invalid bytes", {
      cause: error,
    });
  }
}

async function verifyArtifactReferences(
  artifactResolver: ArtifactResolver,
  references: readonly ArtifactRefV1[],
  limits: RunLedgerLimits,
  scope: "event" | "run",
): Promise<void> {
  const maxReferences =
    scope === "event" ? limits.maxArtifactRefsPerEvent : limits.maxArtifactRefsPerRun;
  const maxBytes =
    scope === "event" ? limits.maxReferencedBytesPerEvent : limits.maxReferencedBytesPerRun;
  if (references.length > maxReferences) {
    throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Event has too many artifact references");
  }
  const totalBytes = references.reduce((sum, { byteLength }) => sum + byteLength, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes > maxBytes) {
    throw new RunLedgerError(
      "LEDGER_LIMIT_EXCEEDED",
      "Event artifact references exceed their byte budget",
    );
  }
  for (const reference of references) {
    let resolved: Uint8Array;
    try {
      resolved = await artifactResolver.read(reference);
    } catch (error) {
      throw new RunLedgerError(
        "ARTIFACT_UNRESOLVED",
        `Artifact reference could not be resolved: ${reference.artifactId}`,
        { cause: error },
      );
    }
    if (!(resolved instanceof Uint8Array)) {
      throw new RunLedgerError("ARTIFACT_UNRESOLVED", "Artifact resolver returned invalid bytes");
    }
    if (typeof SharedArrayBuffer !== "undefined" && resolved.buffer instanceof SharedArrayBuffer) {
      throw new RunLedgerError(
        "ARTIFACT_UNRESOLVED",
        "Shared artifact bytes are outside local CAS policy",
      );
    }
    const byteLength = intrinsicByteLength(resolved);
    if (byteLength !== reference.byteLength || byteLength > maxBytes) {
      throw new RunLedgerError(
        "ARTIFACT_UNRESOLVED",
        `Resolved artifact size violates its reference: ${reference.artifactId}`,
      );
    }
    const snapshot = Buffer.alloc(byteLength);
    try {
      Reflect.apply(UINT8_ARRAY_SET, snapshot, [resolved]);
    } catch (error) {
      throw new RunLedgerError("ARTIFACT_UNRESOLVED", "Artifact bytes could not be snapshotted", {
        cause: error,
      });
    }
    if (intrinsicByteLength(resolved) !== byteLength) {
      throw new RunLedgerError("ARTIFACT_UNRESOLVED", "Artifact bytes changed during snapshot");
    }
    let actualHash: string;
    try {
      actualHash = `sha256:${createHash("sha256").update(snapshot).digest("hex")}`;
    } catch (error) {
      throw new RunLedgerError("ARTIFACT_UNRESOLVED", "Artifact bytes could not be hashed", {
        cause: error,
      });
    }
    if (actualHash !== reference.sha256) {
      throw new RunLedgerError(
        "ARTIFACT_UNRESOLVED",
        `Resolved artifact does not match its reference: ${reference.artifactId}`,
      );
    }
  }
}

class FileTestRunLedger implements TestRunLedger {
  readonly namespace = "test" as const;
  readonly runId: string;
  readonly #paths: LedgerPaths;
  readonly #artifactResolver: ArtifactResolver;
  readonly #limits: RunLedgerLimits;
  readonly #state: MutableRunLedgerState;
  #fileByteLength: number;
  readonly #fileIdentity: LedgerFileIdentity;
  #tail: Promise<void> = Promise.resolve();
  #accepting = true;
  #poisoned = false;
  #writerReleased = false;
  #closePromise: Promise<void> | null = null;
  #pendingAppends = 0;
  #pendingAppendBytes = 0;
  readonly #releaseWriter: () => Promise<void>;

  constructor(
    paths: LedgerPaths,
    artifactResolver: ArtifactResolver,
    limits: RunLedgerLimits,
    state: MutableRunLedgerState,
    fileByteLength: number,
    fileIdentity: LedgerFileIdentity,
    releaseWriter: () => Promise<void>,
  ) {
    this.runId = state.runId;
    this.#paths = paths;
    this.#artifactResolver = artifactResolver;
    this.#limits = limits;
    this.#state = state;
    this.#fileByteLength = fileByteLength;
    this.#fileIdentity = fileIdentity;
    this.#releaseWriter = releaseWriter;
  }

  append(value: AppendRunEventInput): Promise<AppendRunEventResult> {
    if (!this.#accepting) {
      return Promise.reject(new RunLedgerError("LEDGER_CLOSED", "Run ledger is closed"));
    }
    if (this.#pendingAppends >= this.#limits.maxPendingAppends) {
      return Promise.reject(
        new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Pending append admission is full"),
      );
    }
    this.#pendingAppends += 1;
    let input: AppendRunEventInput;
    let queuedBytes: number;
    try {
      input = normalizeAppendInput(value);
      queuedBytes = Buffer.byteLength(canonicalJson(input), "utf8");
    } catch (error) {
      this.#pendingAppends -= 1;
      return Promise.reject(error);
    }
    if (this.#pendingAppendBytes + queuedBytes > this.#limits.maxPendingAppendBytes) {
      this.#pendingAppends -= 1;
      return Promise.reject(
        new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Pending append admission is full"),
      );
    }
    this.#pendingAppendBytes += queuedBytes;
    const operation = this.#tail.then(() => this.#appendOne(input));
    const admitted = operation.finally(() => {
      this.#pendingAppends -= 1;
      this.#pendingAppendBytes -= queuedBytes;
    });
    this.#tail = admitted.then(
      () => undefined,
      () => undefined,
    );
    return admitted;
  }

  events(): readonly StoredNativeRunEvent[] {
    return Object.freeze([...this.#state.events]);
  }

  snapshot(): RunLedgerSnapshot {
    return snapshotState(this.#state);
  }

  close(): Promise<void> {
    if (this.#closePromise) return this.#closePromise;
    this.#accepting = false;
    const attempt = (async () => {
      await this.#tail;
      if (!this.#writerReleased) {
        await this.#releaseWriter();
        this.#writerReleased = true;
      }
    })();
    this.#closePromise = attempt;
    void attempt.catch(() => {
      if (this.#closePromise === attempt) this.#closePromise = null;
    });
    return attempt;
  }

  async #appendOne(input: AppendRunEventInput): Promise<AppendRunEventResult> {
    if (this.#poisoned) {
      throw new RunLedgerError(
        "LEDGER_CLOSED",
        "Run ledger requires reopen and recovery after a persistence failure",
      );
    }
    if (input.expectedRunId !== this.runId) {
      throw new RunLedgerError("EXPECTED_RUN_MISMATCH", "Append is bound to another run");
    }
    const digest = requestDigest(input);
    const previous = this.#state.idempotency.get(input.idempotencyKey);
    if (previous) {
      if (previous.digest !== digest) {
        throw new RunLedgerError(
          "IDEMPOTENCY_CONFLICT",
          "Idempotency key was already bound to another request",
        );
      }
      return Object.freeze({ disposition: "idempotent", event: previous.event });
    }
    if (this.#state.events.length >= this.#limits.maxEvents) {
      throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Run event limit reached");
    }
    const event = createStoredEvent(this.#state, input, this.#limits);
    assertEventArtifactLimits(input.artifactRefs, this.#limits);
    assertRunArtifactAdmission(this.#state, input.artifactRefs, this.#limits);
    await verifyArtifactReferences(
      this.#artifactResolver,
      input.artifactRefs,
      this.#limits,
      "event",
    );
    try {
      this.#fileByteLength = await appendStoredEvent(
        this.#paths,
        event,
        this.#fileByteLength,
        this.#fileIdentity,
        this.#limits,
      );
    } catch (error) {
      if (
        error instanceof RunLedgerError &&
        (error.code === "PERSISTENCE_FAILED" ||
          error.code === "LEDGER_CORRUPTION" ||
          error.code === "UNSAFE_PATH")
      ) {
        this.#poisoned = true;
      }
      throw error;
    }
    applyStoredEvent(this.#state, event, this.#limits);
    return Object.freeze({
      disposition: event.diagnostic ? "diagnostic" : "committed",
      event,
    });
  }
}

export async function openTestRunLedger(options: TestRunLedgerOptions): Promise<TestRunLedger> {
  const normalized = normalizeOptions(options);
  const resolvedRoot = resolve(normalized.root);
  const writerRoot = process.platform === "win32" ? resolvedRoot.toLowerCase() : resolvedRoot;
  const writerKey = `${writerRoot}\u0000${normalized.runId}`;
  if (ACTIVE_LEDGER_KEYS.has(writerKey)) {
    throw new RunLedgerError("LEDGER_BUSY", "Run ledger already has an active process writer");
  }
  ACTIVE_LEDGER_KEYS.add(writerKey);
  let loaded: Awaited<ReturnType<typeof openLedgerFiles>> | undefined;
  try {
    loaded = await openLedgerFiles(normalized.root, normalized.runId, normalized.limits);
    const recoveredReferences = recoveredArtifactRefs(loaded.state);
    await verifyArtifactReferences(
      normalized.artifactResolver,
      recoveredReferences,
      normalized.limits,
      "run",
    );
    return new FileTestRunLedger(
      loaded.paths,
      normalized.artifactResolver,
      normalized.limits,
      loaded.state,
      loaded.fileByteLength,
      loaded.fileIdentity,
      async () => {
        await loaded!.writerLease.release();
        ACTIVE_LEDGER_KEYS.delete(writerKey);
      },
    );
  } catch (error) {
    if (loaded) await loaded.writerLease.release();
    ACTIVE_LEDGER_KEYS.delete(writerKey);
    if (error instanceof RunLedgerError) throw error;
    throw new RunLedgerError("PERSISTENCE_FAILED", "Could not open the native run ledger", {
      cause: error,
    });
  }
}

export {
  RunLedgerError,
  TEST_RUN_NAMESPACE,
  type AppendRunEventInput,
  type AppendRunEventResult,
  type ArtifactResolver,
  type CandidateState,
  type DiagnosticReason,
  type NativeRunTransition,
  type ProviderAttemptState,
  type RunLedgerErrorCode,
  type RunLedgerLimits,
  type RunLedgerSnapshot,
  type RunState,
  type StoredNativeRunEvent,
  type TestRunLedger,
  type TestRunLedgerOptions,
} from "./run-ledger-types.ts";
