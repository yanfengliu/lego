import { resolve } from "node:path";

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
import { canonicalJson, normalizeAppendInput, requestDigest } from "./run-ledger-codec.ts";
import {
  assertEventArtifactLimits,
  assertRunArtifactAdmission,
  recoveredArtifactRefs,
} from "./run-ledger-artifact-index.ts";
import { verifyArtifactReferences } from "./run-ledger-artifact-resolver.ts";
import { normalizeRunLedgerOptions } from "./run-ledger-options.ts";

const ACTIVE_LEDGER_KEYS = new Set<string>();

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
  const normalized = normalizeRunLedgerOptions(options);
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
export { RUN_LEDGER_LIMITS } from "./run-ledger-options.ts";
