import { createHash } from "node:crypto";
import { appendFile, mkdtemp, readFile, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ArtifactRefV1 } from "@lego-studio/protocol";
import { afterEach, describe, expect, it } from "vitest";

import {
  RunLedgerError,
  openTestRunLedger,
  type AppendRunEventInput,
  type ArtifactResolver,
  type RunState,
  type TestRunLedger,
} from "./run-ledger";

const ZERO_HASH = `sha256:${"0".repeat(64)}` as const;
const encoder = new TextEncoder();
const sandboxes: string[] = [];

async function makeSandbox(): Promise<string> {
  const sandbox = await mkdtemp(join(tmpdir(), "lego-run-ledger-"));
  sandboxes.push(sandbox);
  return sandbox;
}

function hash(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function reference(
  artifactId = "artifact-1",
  contents = "ledger evidence",
): { reference: ArtifactRefV1; bytes: Uint8Array } {
  const bytes = encoder.encode(contents);
  const sha256 = hash(bytes);
  return {
    bytes,
    reference: {
      artifactId,
      kind: "transcript",
      mediaType: "application/json",
      sha256,
      byteLength: bytes.byteLength,
      casKey: sha256,
    },
  };
}

class MemoryArtifactResolver implements ArtifactResolver {
  readonly #objects = new Map<string, Uint8Array>();

  add(ref: ArtifactRefV1, bytes: Uint8Array): void {
    this.#objects.set(ref.casKey, bytes.slice());
  }

  async read(ref: ArtifactRefV1): Promise<Uint8Array> {
    const bytes = this.#objects.get(ref.casKey);
    if (!bytes) throw new Error("missing artifact");
    return bytes.slice();
  }
}

async function expectLedgerError(
  operation: Promise<unknown>,
  code: InstanceType<typeof RunLedgerError>["code"],
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(error).toBeInstanceOf(RunLedgerError);
    expect((error as RunLedgerError).code).toBe(code);
    return;
  }
  throw new Error(`Expected run ledger error ${code}`);
}

function runTransition(from: RunState | null, to: RunState): AppendRunEventInput["transition"] {
  return { subject: "run", subjectId: "run-1", from, to };
}

function input(
  idempotencyKey: string,
  transition: AppendRunEventInput["transition"],
  overrides: Partial<AppendRunEventInput> = {},
): AppendRunEventInput {
  return {
    schemaVersion: "lego.test-run-append/1",
    namespace: "test",
    expectedRunId: "run-1",
    actorId: "test-broker",
    idempotencyKey,
    cancellationGeneration: 0,
    transition,
    artifactRefs: [],
    ...overrides,
  };
}

async function openLedger(
  root: string,
  artifactResolver: ArtifactResolver = new MemoryArtifactResolver(),
  limits?: Parameters<typeof openTestRunLedger>[0]["limits"],
): Promise<TestRunLedger> {
  return openTestRunLedger({
    root,
    namespace: "test",
    expectedRunId: "run-1",
    artifactResolver,
    ...(limits ? { limits } : {}),
  });
}

async function startRunning(ledger: TestRunLedger): Promise<void> {
  await ledger.append(input("run-created", runTransition(null, "created")));
  await ledger.append(input("run-queued", runTransition("created", "queued")));
  await ledger.append(input("run-running", runTransition("queued", "running")));
}

function eventsPath(root: string, runId = "run-1"): string {
  const digest = createHash("sha256").update(runId).digest("hex");
  return join(root, "runs", digest, "events.jsonl");
}

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("test-namespace native run ledger", () => {
  it("requires the test namespace and binds every append to the expected run", async () => {
    const sandbox = await makeSandbox();
    await expectLedgerError(
      openTestRunLedger({
        root: join(sandbox, "production-rejected"),
        namespace: "production" as "test",
        expectedRunId: "run-1",
        artifactResolver: new MemoryArtifactResolver(),
      }),
      "INVALID_NAMESPACE",
    );

    const ledger = await openLedger(join(sandbox, "ledger"));
    await expectLedgerError(
      ledger.append(input("wrong-run", runTransition(null, "created"), { expectedRunId: "run-2" })),
      "EXPECTED_RUN_MISMATCH",
    );
    const created = await ledger.append(input("run-created", runTransition(null, "created")));

    expect(created.disposition).toBe("committed");
    expect(created.event.event).toMatchObject({
      runId: "run-1",
      sequence: 0,
      previousEventHash: ZERO_HASH,
    });
    expect(ledger.snapshot()).toMatchObject({
      namespace: "test",
      runId: "run-1",
      runState: "created",
      cancellationGeneration: 0,
      eventCount: 1,
    });
  });

  it("enforces the normative run, attempt, and candidate transition tables", async () => {
    const ledger = await openLedger(join(await makeSandbox(), "ledger"));
    await ledger.append(input("run-created", runTransition(null, "created")));
    await expectLedgerError(
      ledger.append(input("skip-queue", runTransition("created", "running"))),
      "INVALID_TRANSITION",
    );
    await ledger.append(input("run-queued", runTransition("created", "queued")));
    await ledger.append(input("run-running", runTransition("queued", "running")));
    await ledger.append(
      input("attempt-created", {
        subject: "providerAttempt",
        subjectId: "attempt-1",
        from: null,
        to: "created",
      }),
    );
    await expectLedgerError(
      ledger.append(
        input("attempt-skipped", {
          subject: "providerAttempt",
          subjectId: "attempt-1",
          from: "created",
          to: "succeeded",
        }),
      ),
      "INVALID_TRANSITION",
    );
    await ledger.append(
      input("candidate-received", {
        subject: "candidate",
        subjectId: "candidate-1",
        from: null,
        to: "received",
      }),
    );
    await expectLedgerError(
      ledger.append(
        input("candidate-skipped", {
          subject: "candidate",
          subjectId: "candidate-1",
          from: "received",
          to: "presented",
        }),
      ),
      "INVALID_TRANSITION",
    );
  });

  it("advances cancellation generations once and records older work as diagnostic only", async () => {
    const ledger = await openLedger(join(await makeSandbox(), "ledger"));
    await startRunning(ledger);
    await ledger.append(
      input("attempt-created", {
        subject: "providerAttempt",
        subjectId: "attempt-1",
        from: null,
        to: "created",
      }),
    );
    await ledger.append(
      input("cancel-run", runTransition("running", "cancelling"), {
        cancellationGeneration: 1,
      }),
    );

    const late = await ledger.append(
      input("late-attempt-start", {
        subject: "providerAttempt",
        subjectId: "attempt-1",
        from: "created",
        to: "running",
      }),
    );
    expect(late.disposition).toBe("diagnostic");
    expect(late.event.diagnosticReason).toBe("stale-cancellation-generation");
    expect(ledger.snapshot().providerAttempts).toEqual([{ id: "attempt-1", state: "created" }]);

    await expectLedgerError(
      ledger.append(
        input(
          "future-generation",
          {
            subject: "providerAttempt",
            subjectId: "attempt-1",
            from: "created",
            to: "cancelled",
          },
          { cancellationGeneration: 2 },
        ),
      ),
      "INVALID_CANCELLATION_GENERATION",
    );
    await ledger.append(
      input(
        "attempt-cancelled",
        {
          subject: "providerAttempt",
          subjectId: "attempt-1",
          from: "created",
          to: "cancelled",
        },
        { cancellationGeneration: 1 },
      ),
    );
    await ledger.append(
      input("run-cancelled", runTransition("cancelling", "cancelled"), {
        cancellationGeneration: 1,
      }),
    );
    expect(ledger.snapshot()).toMatchObject({
      runState: "cancelled",
      cancellationGeneration: 1,
      eventCount: 8,
    });
    await expectLedgerError(
      ledger.append(
        input("future-terminal-cancel", runTransition("running", "cancelling"), {
          cancellationGeneration: 2,
        }),
      ),
      "INVALID_CANCELLATION_GENERATION",
    );
    expect(ledger.snapshot().eventCount).toBe(8);
  });

  it("refuses to terminate a run until all owned work is quiescent", async () => {
    const ledger = await openLedger(join(await makeSandbox(), "ledger"));
    await startRunning(ledger);
    await ledger.append(
      input("attempt-created", {
        subject: "providerAttempt",
        subjectId: "attempt-1",
        from: null,
        to: "created",
      }),
    );
    await ledger.append(
      input("attempt-running", {
        subject: "providerAttempt",
        subjectId: "attempt-1",
        from: "created",
        to: "running",
      }),
    );
    await expectLedgerError(
      ledger.append(input("run-failed-too-soon", runTransition("running", "failed"))),
      "RUN_NOT_QUIESCENT",
    );
    await ledger.append(
      input("attempt-failed", {
        subject: "providerAttempt",
        subjectId: "attempt-1",
        from: "running",
        to: "failed",
      }),
    );
    await ledger.append(input("run-failed", runTransition("running", "failed")));
    expect(ledger.snapshot().runState).toBe("failed");
  });

  it("retains legal events after terminal state as diagnostics without creating work", async () => {
    const ledger = await openLedger(join(await makeSandbox(), "ledger"));
    await ledger.append(input("run-created", runTransition(null, "created")));
    await ledger.append(input("run-failed", runTransition("created", "failed")));

    const result = await ledger.append(
      input("late-candidate", {
        subject: "candidate",
        subjectId: "candidate-late",
        from: null,
        to: "received",
      }),
    );

    expect(result.disposition).toBe("diagnostic");
    expect(result.event.diagnosticReason).toBe("run-terminal");
    expect(ledger.snapshot().candidates).toEqual([]);
  });

  it("returns committed events for exact idempotent retries and rejects key reuse", async () => {
    const ledger = await openLedger(join(await makeSandbox(), "ledger"));
    const request = input("run-created", runTransition(null, "created"));
    const first = await ledger.append(request);
    const retry = await ledger.append(request);

    expect(retry.disposition).toBe("idempotent");
    expect(retry.event).toEqual(first.event);
    expect(ledger.snapshot().eventCount).toBe(1);
    await expectLedgerError(
      ledger.append(input("run-created", runTransition("created", "queued"))),
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("resolves bounded artifact references through the store interface before append", async () => {
    const resolver = new MemoryArtifactResolver();
    const stored = reference();
    resolver.add(stored.reference, stored.bytes);
    const ledger = await openLedger(join(await makeSandbox(), "ledger"), resolver);

    const result = await ledger.append(
      input("run-created", runTransition(null, "created"), {
        artifactRefs: [stored.reference],
      }),
    );
    expect(result.event.event.artifactHashes).toEqual([stored.reference.sha256]);

    const missing = reference("missing", "missing bytes");
    await expectLedgerError(
      ledger.append(
        input("run-queued-missing", runTransition("created", "queued"), {
          artifactRefs: [missing.reference],
        }),
      ),
      "ARTIFACT_UNRESOLVED",
    );
    expect(ledger.snapshot().eventCount).toBe(1);
  });

  it("detects resolver byte mismatches and duplicate content references", async () => {
    const resolver = new MemoryArtifactResolver();
    const stored = reference();
    resolver.add(stored.reference, encoder.encode("wrong evidence!"));
    const ledger = await openLedger(join(await makeSandbox(), "ledger"), resolver);

    await expectLedgerError(
      ledger.append(
        input("mismatch", runTransition(null, "created"), {
          artifactRefs: [stored.reference],
        }),
      ),
      "ARTIFACT_UNRESOLVED",
    );

    const validResolver = new MemoryArtifactResolver();
    validResolver.add(stored.reference, stored.bytes);
    const duplicateLedger = await openLedger(join(await makeSandbox(), "ledger"), validResolver);
    await expectLedgerError(
      duplicateLedger.append(
        input("duplicates", runTransition(null, "created"), {
          artifactRefs: [stored.reference, { ...stored.reference, artifactId: "artifact-2" }],
        }),
      ),
      "INVALID_RECORD",
    );
  });

  it("fsyncs append-only records and reconstructs sequence and hash linkage after reopen", async () => {
    const root = join(await makeSandbox(), "ledger");
    const ledger = await openLedger(root);
    const first = await ledger.append(input("run-created", runTransition(null, "created")));
    const second = await ledger.append(input("run-queued", runTransition("created", "queued")));
    await ledger.close();

    const reopened = await openLedger(root);
    expect(reopened.events()).toHaveLength(2);
    expect(reopened.events()[1]!.event.previousEventHash).toBe(first.event.event.eventHash);
    expect(reopened.events()[1]).toEqual(second.event);
    const third = await reopened.append(input("run-running", runTransition("queued", "running")));
    expect(third.event.event.sequence).toBe(2);
    expect(third.event.event.previousEventHash).toBe(second.event.event.eventHash);
  });

  it("discards only a truncated final record after verifying the retained prefix", async () => {
    const root = join(await makeSandbox(), "ledger");
    const ledger = await openLedger(root);
    await ledger.append(input("run-created", runTransition(null, "created")));
    await ledger.append(input("run-queued", runTransition("created", "queued")));
    await ledger.close();
    await appendFile(eventsPath(root), '{"schemaVersion":"truncated');

    const reopened = await openLedger(root);
    expect(reopened.snapshot()).toMatchObject({ runState: "queued", eventCount: 2 });
    expect((await readFile(eventsPath(root), "utf8")).endsWith("\n")).toBe(true);
    await reopened.append(input("run-running", runTransition("queued", "running")));
    expect(reopened.snapshot().eventCount).toBe(3);
  });

  it("fails closed on canonical-record corruption and on an unverifiable first truncation", async () => {
    const root = join(await makeSandbox(), "ledger");
    const ledger = await openLedger(root);
    await ledger.append(input("run-created", runTransition(null, "created")));
    await ledger.append(input("run-queued", runTransition("created", "queued")));
    await ledger.close();

    const path = eventsPath(root);
    const contents = await readFile(path, "utf8");
    await writeFile(path, contents.replace("test-broker", "evil-broker"));
    await expectLedgerError(openLedger(root), "LEDGER_CORRUPTION");

    const firstRoot = join(await makeSandbox(), "ledger");
    const first = await openLedger(firstRoot);
    await first.close();
    await writeFile(eventsPath(firstRoot), '{"schemaVersion":"truncated');
    await expectLedgerError(openLedger(firstRoot), "LEDGER_CORRUPTION");
  });

  it("bounds event count and serializes concurrent transition requests", async () => {
    const root = join(await makeSandbox(), "ledger");
    const ledger = await openLedger(root, new MemoryArtifactResolver(), { maxEvents: 3 });
    await ledger.append(input("run-created", runTransition(null, "created")));
    const [queued, running] = await Promise.all([
      ledger.append(input("run-queued", runTransition("created", "queued"))),
      ledger.append(input("run-running", runTransition("queued", "running"))),
    ]);
    expect([queued.event.event.sequence, running.event.event.sequence]).toEqual([1, 2]);
    await expectLedgerError(
      ledger.append(input("run-draining", runTransition("running", "draining"))),
      "LEDGER_LIMIT_EXCEEDED",
    );
  });

  it("fails closed when a complete event is truncated without a retained valid prefix", async () => {
    const root = join(await makeSandbox(), "ledger");
    const ledger = await openLedger(root);
    await ledger.append(input("run-created", runTransition(null, "created")));
    await ledger.close();
    const stats = (await readFile(eventsPath(root))).byteLength;
    await truncate(eventsPath(root), Math.max(1, stats - 8));
    await expectLedgerError(openLedger(root), "LEDGER_CORRUPTION");
  });
});
