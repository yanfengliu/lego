import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ArtifactRefV1 } from "@lego-studio/protocol";
import { afterEach, describe, expect, it } from "vitest";

import {
  RunLedgerError,
  openTestRunLedger,
  type AppendRunEventInput,
  type ArtifactResolver,
  type NativeRunTransition,
  type TestRunLedger,
} from "./run-ledger";

const encoder = new TextEncoder();
const sandboxes: string[] = [];

class MemoryArtifacts implements ArtifactResolver {
  readonly objects = new Map<string, Uint8Array>();
  readCount = 0;

  async read(reference: ArtifactRefV1): Promise<Uint8Array> {
    this.readCount += 1;
    const bytes = this.objects.get(reference.casKey);
    if (!bytes) throw new Error("missing");
    return bytes.slice();
  }
}

async function sandbox(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "lego-run-ledger-hardening-"));
  sandboxes.push(path);
  return path;
}

function artifact(
  artifactId = "artifact-1",
  contents = "durable artifact",
): { reference: ArtifactRefV1; bytes: Uint8Array } {
  const bytes = encoder.encode(contents);
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
  return {
    bytes,
    reference: {
      artifactId,
      kind: "transcript",
      mediaType: "application/json",
      sha256: digest,
      byteLength: bytes.byteLength,
      casKey: digest,
    },
  };
}

function appendInput(
  idempotencyKey: string,
  transition: NativeRunTransition,
  artifactRefs: readonly ArtifactRefV1[] = [],
): AppendRunEventInput {
  return {
    schemaVersion: "lego.test-run-append/1",
    namespace: "test",
    expectedRunId: "run-1",
    actorId: "test-broker",
    idempotencyKey,
    cancellationGeneration: 0,
    transition,
    artifactRefs,
  };
}

function run(from: NativeRunTransition["from"], to: string): NativeRunTransition {
  return { subject: "run", subjectId: "run-1", from, to } as NativeRunTransition;
}

async function openLedger(
  root: string,
  artifacts: ArtifactResolver = new MemoryArtifacts(),
): Promise<TestRunLedger> {
  return openTestRunLedger({
    root,
    namespace: "test",
    expectedRunId: "run-1",
    artifactResolver: artifacts,
  });
}

async function expectCode(
  operation: Promise<unknown>,
  code: RunLedgerError["code"],
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(error).toBeInstanceOf(RunLedgerError);
    expect((error as RunLedgerError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("native run ledger hardening", () => {
  it("holds one in-process writer and releases it on idempotent close", async () => {
    const root = join(await sandbox(), "ledger");
    const first = await openLedger(root);
    await expectCode(openLedger(root), "LEDGER_BUSY");
    await first.close();
    await first.close();
    const reopened = await openLedger(root);
    await reopened.close();
  });

  it("fails closed instead of recreating a missing event stream in an existing run", async () => {
    const root = join(await sandbox(), "ledger");
    const ledger = await openLedger(root);
    await ledger.close();
    const digest = createHash("sha256").update("run-1").digest("hex");
    await rm(join(root, "runs", digest, "events.jsonl"));
    await expectCode(openLedger(root), "LEDGER_CORRUPTION");
  });

  it("poisons the active writer when its durable event stream disappears", async () => {
    const root = join(await sandbox(), "ledger");
    const ledger = await openLedger(root);
    await ledger.append(appendInput("created", run(null, "created")));
    const digest = createHash("sha256").update("run-1").digest("hex");
    await rm(join(root, "runs", digest, "events.jsonl"));
    await expectCode(
      ledger.append(appendInput("queued", run("created", "queued"))),
      "PERSISTENCE_FAILED",
    );
    await expectCode(
      ledger.append(appendInput("queued-retry", run("created", "queued"))),
      "LEDGER_CLOSED",
    );
    await ledger.close();
  });

  it("re-resolves retained artifact references before recovered state is exposed", async () => {
    const root = join(await sandbox(), "ledger");
    const stored = artifact();
    const artifacts = new MemoryArtifacts();
    artifacts.objects.set(stored.reference.casKey, stored.bytes);
    const ledger = await openLedger(root, artifacts);
    await ledger.append(appendInput("created", run(null, "created"), [stored.reference]));
    await ledger.close();

    await expectCode(openLedger(root, new MemoryArtifacts()), "ARTIFACT_UNRESOLVED");
    const recovered = await openLedger(root, artifacts);
    expect(recovered.snapshot()).toMatchObject({ runState: "created", eventCount: 1 });
    await recovered.close();
  });

  it("applies per-event and per-run artifact bounds independently across recovery", async () => {
    const root = join(await sandbox(), "ledger");
    const first = artifact("artifact-1", "first");
    const second = artifact("artifact-2", "second");
    const conflicting = artifact("artifact-1", "conflicting");
    const artifacts = new MemoryArtifacts();
    for (const stored of [first, second, conflicting]) {
      artifacts.objects.set(stored.reference.casKey, stored.bytes);
    }
    const options = {
      root,
      namespace: "test" as const,
      expectedRunId: "run-1",
      artifactResolver: artifacts,
      limits: { maxArtifactRefsPerEvent: 1, maxArtifactRefsPerRun: 2 },
    };
    const ledger = await openTestRunLedger(options);
    await ledger.append(appendInput("created", run(null, "created"), [first.reference]));
    await ledger.append(appendInput("queued", run("created", "queued"), [second.reference]));
    await expectCode(
      ledger.append(appendInput("conflict", run("queued", "running"), [conflicting.reference])),
      "INVALID_RECORD",
    );
    await ledger.close();

    const recovered = await openTestRunLedger(options);
    expect(recovered.snapshot().eventCount).toBe(2);
    await recovered.close();
  });

  it("returns deeply immutable events so callers cannot desynchronize durable bytes", async () => {
    const root = join(await sandbox(), "ledger");
    const ledger = await openLedger(root);
    const result = await ledger.append(appendInput("created", run(null, "created")));
    expect(Object.isFrozen(result.event)).toBe(true);
    expect(Object.isFrozen(result.event.event)).toBe(true);
    expect(Object.isFrozen(result.event.event.artifactHashes)).toBe(true);
    expect(() =>
      (result.event.event.artifactHashes as unknown as string[]).push("sha256:bad"),
    ).toThrow();
    await ledger.close();
    const reopened = await openLedger(root);
    expect(reopened.snapshot().eventCount).toBe(1);
    await reopened.close();
  });

  it("rejects getters, cycles, and oversized arrays before copying or resolver I/O", async () => {
    const root = join(await sandbox(), "ledger");
    const stored = artifact();
    const artifacts = new MemoryArtifacts();
    artifacts.objects.set(stored.reference.casKey, stored.bytes);
    const ledger = await openLedger(root, artifacts);
    let getterReads = 0;
    const hostile = appendInput("getter", run(null, "created")) as unknown as Record<
      string,
      unknown
    >;
    Object.defineProperty(hostile, "artifactRefs", {
      enumerable: true,
      get() {
        getterReads += 1;
        return [stored.reference];
      },
    });
    await expectCode(ledger.append(hostile as unknown as AppendRunEventInput), "INVALID_RECORD");
    expect(getterReads).toBe(0);

    const oversized = appendInput(
      "oversized",
      run(null, "created"),
      new Array<ArtifactRefV1>(257).fill(stored.reference),
    );
    await expectCode(ledger.append(oversized), "INVALID_RECORD");
    const cyclic = appendInput("cyclic", run(null, "created")) as unknown as {
      artifactRefs: unknown[];
    };
    cyclic.artifactRefs.push(cyclic.artifactRefs);
    await expectCode(ledger.append(cyclic as unknown as AppendRunEventInput), "INVALID_RECORD");
    expect(artifacts.readCount).toBe(0);
    await ledger.close();
  });

  it("validates transitions before artifact I/O and coordinates candidate persistence failure", async () => {
    const root = join(await sandbox(), "ledger");
    const stored = artifact();
    const artifacts = new MemoryArtifacts();
    artifacts.objects.set(stored.reference.casKey, stored.bytes);
    const ledger = await openLedger(root, artifacts);
    await ledger.append(appendInput("created", run(null, "created")));
    await expectCode(
      ledger.append(appendInput("invalid-skip", run("created", "running"), [stored.reference])),
      "INVALID_TRANSITION",
    );
    expect(artifacts.readCount).toBe(0);

    await ledger.append(appendInput("queued", run("created", "queued")));
    await ledger.append(appendInput("running", run("queued", "running")));
    await ledger.append(
      appendInput("candidate-received", {
        subject: "candidate",
        subjectId: "candidate-1",
        from: null,
        to: "received",
      }),
    );
    await expectCode(
      ledger.append(
        appendInput("candidate-persistence-too-soon", {
          subject: "candidate",
          subjectId: "candidate-1",
          from: "received",
          to: "persistenceFailed",
        }),
      ),
      "INVALID_TRANSITION",
    );
    await ledger.append(appendInput("run-persistence-failed", run("running", "persistenceFailed")));
    await expectCode(
      ledger.append(
        appendInput("candidate-progress-blocked", {
          subject: "candidate",
          subjectId: "candidate-1",
          from: "received",
          to: "compiled",
        }),
      ),
      "INVALID_TRANSITION",
    );
    await ledger.append(
      appendInput("candidate-persistence-failed", {
        subject: "candidate",
        subjectId: "candidate-1",
        from: "received",
        to: "persistenceFailed",
      }),
    );
    await expectCode(
      ledger.append(
        appendInput("candidate-recovery-blocked", {
          subject: "candidate",
          subjectId: "candidate-1",
          from: "persistenceFailed",
          to: "received",
        }),
      ),
      "INVALID_TRANSITION",
    );
    await ledger.append(appendInput("run-recovered", run("persistenceFailed", "running")));
    await ledger.append(
      appendInput("candidate-recovered", {
        subject: "candidate",
        subjectId: "candidate-1",
        from: "persistenceFailed",
        to: "received",
      }),
    );
    expect(ledger.snapshot()).toMatchObject({
      runState: "running",
      candidates: [{ id: "candidate-1", state: "received" }],
    });
    await ledger.close();
  });

  it("requires a presented candidate before a draining run can succeed", async () => {
    const emptyRoot = join(await sandbox(), "empty-ledger");
    const empty = await openLedger(emptyRoot);
    await empty.append(appendInput("created", run(null, "created")));
    await empty.append(appendInput("queued", run("created", "queued")));
    await empty.append(appendInput("running", run("queued", "running")));
    await empty.append(appendInput("draining", run("running", "draining")));
    await expectCode(
      empty.append(appendInput("invalid-success", run("draining", "succeeded"))),
      "INVALID_TRANSITION",
    );
    await empty.close();

    const root = join(await sandbox(), "ledger");
    const ledger = await openLedger(root);
    await ledger.append(appendInput("created", run(null, "created")));
    await ledger.append(appendInput("queued", run("created", "queued")));
    await ledger.append(appendInput("running", run("queued", "running")));
    const candidateStates = [
      [null, "received"],
      ["received", "compiled"],
      ["compiled", "hardValid"],
      ["hardValid", "rendered"],
      ["rendered", "critiqued"],
      ["critiqued", "ranked"],
      ["ranked", "presented"],
    ] as const;
    for (const [index, [from, to]] of candidateStates.entries()) {
      await ledger.append(
        appendInput(`candidate-${index}`, {
          subject: "candidate",
          subjectId: "candidate-1",
          from,
          to,
        }),
      );
    }
    await ledger.append(appendInput("draining", run("running", "draining")));
    await ledger.append(appendInput("succeeded", run("draining", "succeeded")));
    expect(ledger.snapshot().runState).toBe("succeeded");
    await ledger.close();
  });

  it("rejects unknown option fields, null limits, and partial unowned run directories", async () => {
    const root = join(await sandbox(), "ledger");
    await expectCode(
      openTestRunLedger({
        root,
        namespace: "test",
        expectedRunId: "run-1",
        artifactResolver: new MemoryArtifacts(),
        unexpected: true,
      } as never),
      "INVALID_ROOT",
    );
    await expectCode(
      openTestRunLedger({
        root,
        namespace: "test",
        expectedRunId: "run-1",
        artifactResolver: new MemoryArtifacts(),
        limits: { maxEvents: null },
      } as never),
      "INVALID_ROOT",
    );

    const initialized = await openLedger(root);
    await initialized.close();
    const digest = createHash("sha256").update("run-2").digest("hex");
    const partial = join(root, "runs", digest);
    await mkdir(partial);
    await expectCode(
      openTestRunLedger({
        root,
        namespace: "test",
        expectedRunId: "run-2",
        artifactResolver: new MemoryArtifacts(),
      }),
      "LEDGER_CORRUPTION",
    );
  });
});
