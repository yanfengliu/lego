import { constants } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { resolve } from "node:path";

import { validateRunEventV1, type RunEventV1 } from "@lego-studio/protocol";

import {
  applyStoredEvent,
  computeStoredEventHash,
  createLedgerState,
  type MutableRunLedgerState,
} from "./run-ledger-state.ts";
import {
  EMPTY_EVENT_HASH,
  RunLedgerError,
  type DiagnosticReason,
  type RunLedgerLimits,
  type StoredNativeRunEvent,
} from "./run-ledger-types.ts";
import { canonicalJson, normalizeAppendInput, transitionLabel } from "./run-ledger-codec.ts";
import { acquireRunWriterLease, type RunWriterLease } from "./run-ledger-lock.ts";
import { linkStats, openNoFollow, writeAll } from "./run-ledger-fs.ts";
import { initializeRoot, initializeRun, pathsFor, type LedgerPaths } from "./run-ledger-layout.ts";

export type { LedgerPaths } from "./run-ledger-layout.ts";

export interface LoadedLedger {
  readonly paths: LedgerPaths;
  readonly state: MutableRunLedgerState;
  readonly fileByteLength: number;
  readonly fileIdentity: LedgerFileIdentity;
  readonly writerLease: RunWriterLease;
}

export interface LedgerFileIdentity {
  readonly dev: number;
  readonly ino: number;
}

function assertFileIdentity(
  stats: Awaited<ReturnType<FileHandle["stat"]>>,
  identity: LedgerFileIdentity,
  byteLength: number,
): void {
  if (
    !stats.isFile() ||
    stats.nlink !== 1 ||
    stats.dev !== identity.dev ||
    stats.ino !== identity.ino ||
    stats.size !== byteLength
  ) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Run event stream identity changed");
  }
}

function exactRecord(value: unknown, allowedKeys: readonly string[], label: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RunLedgerError("LEDGER_CORRUPTION", `${label} is not an object`);
  }
  const keys = Object.keys(value).sort();
  const allowed = [...allowedKeys].sort();
  if (keys.length !== allowed.length || keys.some((key, index) => key !== allowed[index])) {
    throw new RunLedgerError("LEDGER_CORRUPTION", `${label} has unknown or missing fields`);
  }
  return value as Record<string, unknown>;
}

function parseStoredEvent(line: string, runId: string): StoredNativeRunEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Ledger record is not valid JSON", {
      cause: error,
    });
  }
  const baseKeys = [
    "schemaVersion",
    "namespace",
    "cancellationGeneration",
    "diagnostic",
    "requestDigest",
    "transition",
    "artifactRefs",
    "event",
  ];
  const parsedRecord = parsed as Record<string, unknown>;
  const hasReason =
    typeof parsed === "object" && parsed !== null && "diagnosticReason" in parsedRecord;
  const record = exactRecord(
    parsed,
    hasReason ? [...baseKeys, "diagnosticReason"] : baseKeys,
    "Native run event",
  );
  if (
    record.schemaVersion !== "lego.test-native-run-event/1" ||
    record.namespace !== "test" ||
    typeof record.diagnostic !== "boolean" ||
    typeof record.requestDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(record.requestDigest)
  ) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Native event header is invalid");
  }
  const eventRecord = exactRecord(
    record.event,
    [
      "schemaVersion",
      "runId",
      "sequence",
      "previousEventHash",
      "actorId",
      "transition",
      "idempotencyKey",
      "artifactHashes",
      "eventHash",
    ],
    "RunEventV1",
  );
  if (!validateRunEventV1(eventRecord) || eventRecord.runId !== runId) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Embedded RunEventV1 is invalid");
  }
  const normalizedInput = normalizeAppendInput({
    schemaVersion: "lego.test-run-append/1",
    namespace: "test",
    expectedRunId: runId,
    actorId: eventRecord.actorId,
    idempotencyKey: eventRecord.idempotencyKey,
    cancellationGeneration: record.cancellationGeneration,
    transition: record.transition,
    artifactRefs: record.artifactRefs,
  });
  const reason = record.diagnosticReason;
  if (
    (record.diagnostic &&
      reason !== "stale-cancellation-generation" &&
      reason !== "run-terminal" &&
      reason !== "subject-terminal") ||
    (!record.diagnostic && reason !== undefined)
  ) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Event diagnostic reason is invalid");
  }
  const stored = {
    schemaVersion: "lego.test-native-run-event/1",
    namespace: "test",
    cancellationGeneration: normalizedInput.cancellationGeneration,
    diagnostic: record.diagnostic,
    ...(reason ? { diagnosticReason: reason as DiagnosticReason } : {}),
    requestDigest: record.requestDigest as `sha256:${string}`,
    transition: normalizedInput.transition,
    artifactRefs: normalizedInput.artifactRefs,
    event: Object.freeze({
      ...eventRecord,
      artifactHashes: Object.freeze([...(eventRecord.artifactHashes as string[])]),
    }) as unknown as RunEventV1,
  } as const satisfies StoredNativeRunEvent;
  if (eventRecord.transition !== transitionLabel(stored.transition)) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Embedded transition label is inconsistent");
  }
  if (
    canonicalJson(eventRecord.artifactHashes) !==
    canonicalJson(stored.artifactRefs.map(({ sha256: digest }) => digest))
  ) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Embedded artifact hashes are inconsistent");
  }
  if (computeStoredEventHash(stored) !== stored.event.eventHash || canonicalJson(stored) !== line) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Event hash or canonical bytes are inconsistent");
  }
  return Object.freeze(stored);
}

function replayLines(text: string, runId: string, limits: RunLedgerLimits): MutableRunLedgerState {
  const state = createLedgerState(runId);
  if (text === "") return state;
  const lines = text.split("\n");
  if (lines.at(-1) !== "") {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Recovery prefix is not newline terminated");
  }
  lines.pop();
  if (lines.some((line) => line.length === 0)) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Ledger contains a blank record");
  }
  for (const line of lines) {
    if (Buffer.byteLength(line, "utf8") + 1 > limits.maxRecordBytes) {
      throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Ledger record exceeds its byte cap");
    }
    if (state.events.length >= limits.maxEvents) {
      throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Ledger event count exceeds its cap");
    }
    const event = parseStoredEvent(line, runId);
    const expectedSequence = state.events.length;
    const expectedPrevious = state.events.at(-1)?.event.eventHash ?? EMPTY_EVENT_HASH;
    if (
      event.event.sequence !== expectedSequence ||
      event.event.previousEventHash !== expectedPrevious
    ) {
      throw new RunLedgerError("LEDGER_CORRUPTION", "Event sequence or hash link is inconsistent");
    }
    try {
      applyStoredEvent(state, event, limits);
    } catch (error) {
      if (error instanceof RunLedgerError && error.code === "LEDGER_CORRUPTION") throw error;
      throw new RunLedgerError("LEDGER_CORRUPTION", "Event violates the replayed state machine", {
        cause: error,
      });
    }
  }
  return state;
}

async function recoverEvents(
  paths: LedgerPaths,
  runId: string,
  limits: RunLedgerLimits,
): Promise<{
  state: MutableRunLedgerState;
  byteLength: number;
  identity: LedgerFileIdentity;
}> {
  const linkedStats = await linkStats(paths.eventsFile);
  if (
    !linkedStats ||
    linkedStats.isSymbolicLink() ||
    !linkedStats.isFile() ||
    linkedStats.nlink !== 1
  ) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Run event stream is not a regular file");
  }
  const handle = await openNoFollow(paths.eventsFile, constants.O_RDWR);
  try {
    const stats = await handle.stat();
    const identity = { dev: stats.dev, ino: stats.ino };
    if (
      !stats.isFile() ||
      stats.nlink !== 1 ||
      stats.dev !== linkedStats.dev ||
      stats.ino !== linkedStats.ino ||
      stats.size > limits.maxLedgerBytes
    ) {
      throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Ledger file exceeds its byte cap");
    }
    const bytes = Buffer.alloc(stats.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (bytesRead === 0) {
        throw new RunLedgerError("LEDGER_CORRUPTION", "Ledger changed during recovery");
      }
      offset += bytesRead;
    }
    const extra = Buffer.allocUnsafe(1);
    if ((await handle.read(extra, 0, 1, offset)).bytesRead !== 0) {
      throw new RunLedgerError("LEDGER_CORRUPTION", "Ledger grew during recovery");
    }
    if (bytes.byteLength === 0) {
      assertFileIdentity(await handle.stat(), identity, 0);
      return { state: createLedgerState(runId), byteLength: 0, identity };
    }
    if (bytes.at(-1) === 0x0a) {
      const state = replayLines(bytes.toString("utf8"), runId, limits);
      assertFileIdentity(await handle.stat(), identity, bytes.byteLength);
      return {
        state,
        byteLength: bytes.byteLength,
        identity,
      };
    }
    const finalNewline = bytes.lastIndexOf(0x0a);
    if (finalNewline < 0) {
      throw new RunLedgerError(
        "LEDGER_CORRUPTION",
        "An unterminated ledger without a verified prefix cannot be recovered",
      );
    }
    if (bytes.byteLength - finalNewline - 1 > limits.maxRecordBytes) {
      throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Truncated record exceeds its byte cap");
    }
    const retainedBytes = bytes.subarray(0, finalNewline + 1);
    const state = replayLines(retainedBytes.toString("utf8"), runId, limits);
    assertFileIdentity(await handle.stat(), identity, bytes.byteLength);
    await handle.truncate(retainedBytes.byteLength);
    await handle.sync();
    assertFileIdentity(await handle.stat(), identity, retainedBytes.byteLength);
    return { state, byteLength: retainedBytes.byteLength, identity };
  } finally {
    await handle.close();
  }
}

export async function openLedgerFiles(
  root: string,
  runId: string,
  limits: RunLedgerLimits,
): Promise<LoadedLedger> {
  const normalizedRoot = resolve(root);
  await initializeRoot(normalizedRoot);
  const paths = pathsFor(normalizedRoot, runId);
  await initializeRun(paths, runId, limits);
  const writerLease = await acquireRunWriterLease(paths.runDirectory);
  try {
    const recovered = await recoverEvents(paths, runId, limits);
    return {
      paths,
      state: recovered.state,
      fileByteLength: recovered.byteLength,
      fileIdentity: recovered.identity,
      writerLease,
    };
  } catch (error) {
    await writerLease.release();
    throw error;
  }
}

export async function appendStoredEvent(
  paths: LedgerPaths,
  event: StoredNativeRunEvent,
  expectedFileBytes: number,
  expectedIdentity: LedgerFileIdentity,
  limits: RunLedgerLimits,
): Promise<number> {
  const line = Buffer.from(`${canonicalJson(event)}\n`, "utf8");
  if (line.byteLength > limits.maxRecordBytes) {
    throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Ledger record exceeds its byte cap");
  }
  if (expectedFileBytes + line.byteLength > limits.maxLedgerBytes) {
    throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Ledger file exceeds its byte cap");
  }
  let handle: FileHandle;
  try {
    handle = await openNoFollow(paths.eventsFile, constants.O_WRONLY | constants.O_APPEND);
  } catch (error) {
    if (error instanceof RunLedgerError) throw error;
    throw new RunLedgerError("PERSISTENCE_FAILED", "Could not open the run event stream", {
      cause: error,
    });
  }
  let persistenceFailure: unknown;
  try {
    const stats = await handle.stat();
    assertFileIdentity(stats, expectedIdentity, expectedFileBytes);
    await writeAll(handle, line);
    await handle.sync();
    assertFileIdentity(await handle.stat(), expectedIdentity, expectedFileBytes + line.byteLength);
  } catch (error) {
    persistenceFailure = error;
  } finally {
    try {
      await handle.close();
    } catch (closeError) {
      persistenceFailure ??= closeError;
    }
  }
  if (persistenceFailure) {
    if (persistenceFailure instanceof RunLedgerError) throw persistenceFailure;
    throw new RunLedgerError("PERSISTENCE_FAILED", "Could not durably append run event", {
      cause: persistenceFailure,
    });
  }
  return expectedFileBytes + line.byteLength;
}
