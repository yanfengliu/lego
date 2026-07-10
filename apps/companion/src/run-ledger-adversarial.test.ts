import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { appendFile, link, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { ArtifactRefV1 } from "@lego-studio/protocol";
import { afterEach, describe, expect, it } from "vitest";

import { canonicalJson } from "./run-ledger-codec.ts";
import {
  CANDIDATE_TRANSITIONS,
  RUN_LEDGER_POLICY_HASH,
  RUN_RECOVERY_TARGET,
  RUN_TRANSITIONS,
} from "./run-ledger-policy.ts";
import {
  RunLedgerError,
  openTestRunLedger,
  type AppendRunEventInput,
  type ArtifactResolver,
  type NativeRunTransition,
  type RunLedgerLimits,
  type TestRunLedger,
} from "./run-ledger.ts";

const executeFile = promisify(execFile);
const encoder = new TextEncoder();
const sandboxes: string[] = [];

class MemoryArtifacts implements ArtifactResolver {
  readonly objects = new Map<string, Uint8Array>();
  readCount = 0;

  async read(reference: ArtifactRefV1): Promise<Uint8Array> {
    this.readCount += 1;
    const bytes = this.objects.get(reference.casKey);
    if (!bytes) throw new Error("missing");
    return bytes;
  }
}

async function sandbox(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "lego-run-ledger-adversarial-"));
  sandboxes.push(path);
  return path;
}

function artifact(id = "artifact-1", contents = "evidence") {
  const bytes = encoder.encode(contents);
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
  return {
    bytes,
    reference: {
      artifactId: id,
      kind: "transcript",
      mediaType: "application/json",
      sha256: digest,
      byteLength: bytes.byteLength,
      casKey: digest,
    } satisfies ArtifactRefV1,
  };
}

function request(
  key: string,
  transition: NativeRunTransition,
  artifactRefs: readonly ArtifactRefV1[] = [],
  cancellationGeneration = 0,
): AppendRunEventInput {
  return {
    schemaVersion: "lego.test-run-append/1",
    namespace: "test",
    expectedRunId: "run-1",
    actorId: "test-broker",
    idempotencyKey: key,
    cancellationGeneration,
    transition,
    artifactRefs,
  };
}

function run(from: NativeRunTransition["from"], to: string): NativeRunTransition {
  return { subject: "run", subjectId: "run-1", from, to } as NativeRunTransition;
}

function candidate(from: NativeRunTransition["from"], to: string): NativeRunTransition {
  return { subject: "candidate", subjectId: "candidate-1", from, to } as NativeRunTransition;
}

async function openLedger(
  root: string,
  artifacts: ArtifactResolver = new MemoryArtifacts(),
  limits?: Partial<RunLedgerLimits>,
): Promise<TestRunLedger> {
  return openTestRunLedger({
    root,
    namespace: "test",
    expectedRunId: "run-1",
    artifactResolver: artifacts,
    ...(limits ? { limits } : {}),
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

async function startRunning(ledger: TestRunLedger): Promise<void> {
  await ledger.append(request("created", run(null, "created")));
  await ledger.append(request("queued", run("created", "queued")));
  await ledger.append(request("running", run("queued", "running")));
}

function runDirectory(root: string): string {
  return join(root, "runs", createHash("sha256").update("run-1").digest("hex"));
}

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("native run ledger adversarial contracts", () => {
  it("binds candidate recovery to its durable checkpoint across reopen", async () => {
    const root = join(await sandbox(), "ledger");
    let ledger = await openLedger(root);
    await startRunning(ledger);
    await ledger.append(request("candidate", candidate(null, "received")));
    await ledger.append(request("run-persistence", run("running", "persistenceFailed")));
    await ledger.append(
      request("candidate-persistence", candidate("received", "persistenceFailed")),
    );
    expect(ledger.snapshot()).toMatchObject({
      runRecoveryCheckpoint: "running",
      runRecoveryCancellationGeneration: 0,
      candidates: [
        { id: "candidate-1", state: "persistenceFailed", recoveryCheckpoint: "received" },
      ],
    });
    await ledger.close();

    ledger = await openLedger(root);
    expect(ledger.snapshot().candidates[0]).toMatchObject({
      state: "persistenceFailed",
      recoveryCheckpoint: "received",
    });
    await ledger.append(request("run-recovered", run("persistenceFailed", "running")));
    await expectCode(
      ledger.append(request("exploit-ranked", candidate("persistenceFailed", "ranked"))),
      "INVALID_TRANSITION",
    );
    await expectCode(
      ledger.append(request("exploit-presented", candidate("persistenceFailed", "presented"))),
      "INVALID_TRANSITION",
    );
    await ledger.append(request("candidate-recovered", candidate("persistenceFailed", "received")));
    expect(ledger.snapshot().candidates).toEqual([{ id: "candidate-1", state: "received" }]);
    await ledger.close();
  });

  it("maps run recovery to the recorded resume stage and preserves cancellation generation", async () => {
    const createdRoot = join(await sandbox(), "created-ledger");
    const created = await openLedger(createdRoot);
    await created.append(request("created", run(null, "created")));
    await created.append(request("persist", run("created", "persistenceFailed")));
    await expectCode(
      created.append(request("skip", run("persistenceFailed", "running"))),
      "INVALID_TRANSITION",
    );
    await created.append(request("resume", run("persistenceFailed", "queued")));
    await created.close();

    const drainingRoot = join(await sandbox(), "draining-ledger");
    const draining = await openLedger(drainingRoot);
    await startRunning(draining);
    await draining.append(request("draining", run("running", "draining")));
    await draining.append(request("persist", run("draining", "persistenceFailed")));
    await expectCode(
      draining.append(request("backtrack", run("persistenceFailed", "running"))),
      "INVALID_TRANSITION",
    );
    await draining.append(request("resume", run("persistenceFailed", "draining")));
    await draining.close();

    const root = join(await sandbox(), "ledger");
    const ledger = await openLedger(root);
    await startRunning(ledger);
    await ledger.append(request("cancel", run("running", "cancelling"), [], 1));
    await ledger.append(
      request("persist-cancelling", run("cancelling", "persistenceFailed"), [], 1),
    );
    await expectCode(
      ledger.append(request("wrong-generation", run("persistenceFailed", "cancelling"), [], 2)),
      "INVALID_CANCELLATION_GENERATION",
    );
    await ledger.append(
      request("resume-cancelling", run("persistenceFailed", "cancelling"), [], 1),
    );
    expect(ledger.snapshot()).toMatchObject({
      runState: "cancelling",
      cancellationGeneration: 1,
      runRecoveryCheckpoint: null,
    });
    await ledger.close();
  });

  it("retains late provider output after terminal attempt as diagnostic evidence", async () => {
    const root = join(await sandbox(), "ledger");
    const stored = artifact();
    const artifacts = new MemoryArtifacts();
    artifacts.objects.set(stored.reference.casKey, stored.bytes);
    const ledger = await openLedger(root, artifacts);
    await startRunning(ledger);
    await ledger.append(
      request("attempt-created", {
        subject: "providerAttempt",
        subjectId: "attempt-1",
        from: null,
        to: "created",
      }),
    );
    await ledger.append(
      request("attempt-running", {
        subject: "providerAttempt",
        subjectId: "attempt-1",
        from: "created",
        to: "running",
      }),
    );
    await ledger.append(
      request("attempt-timeout", {
        subject: "providerAttempt",
        subjectId: "attempt-1",
        from: "running",
        to: "timedOut",
      }),
    );
    const late = await ledger.append(
      request(
        "late-success",
        {
          subject: "providerAttempt",
          subjectId: "attempt-1",
          from: "running",
          to: "succeeded",
        },
        [stored.reference],
      ),
    );
    expect(late).toMatchObject({
      disposition: "diagnostic",
      event: { diagnosticReason: "subject-terminal" },
    });
    expect(ledger.snapshot().providerAttempts).toEqual([{ id: "attempt-1", state: "timedOut" }]);
    expect(artifacts.readCount).toBe(1);
    await ledger.close();
  });

  it("caps pending calls before hostile normalization while one resolver is blocked", async () => {
    const root = join(await sandbox(), "ledger");
    const stored = artifact();
    let release!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => (started = resolve));
    const releasePromise = new Promise<void>((resolve) => (release = resolve));
    const artifacts: ArtifactResolver = {
      async read() {
        started();
        await releasePromise;
        return stored.bytes;
      },
    };
    const ledger = await openLedger(root, artifacts, { maxPendingAppends: 2 });
    const first = ledger.append(request("created", run(null, "created"), [stored.reference]));
    await startedPromise;
    const second = ledger.append(request("queued", run("created", "queued")));
    let getterReads = 0;
    const hostile = request("hostile", run("queued", "running")) as unknown as Record<
      string,
      unknown
    >;
    Object.defineProperty(hostile, "artifactRefs", {
      enumerable: true,
      get() {
        getterReads += 1;
        return [];
      },
    });
    const rejected = await Promise.allSettled(
      Array.from({ length: 5001 }, () => ledger.append(hostile as unknown as AppendRunEventInput)),
    );
    expect(rejected.every((result) => result.status === "rejected")).toBe(true);
    expect(getterReads).toBe(0);
    release();
    await Promise.all([first, second]);
    await ledger.close();
  });

  it("caps detached pending bytes independently from pending call count", async () => {
    const root = join(await sandbox(), "ledger");
    const append = request("created", run(null, "created"));
    const byteLength = Buffer.byteLength(canonicalJson(append), "utf8");
    const ledger = await openLedger(root, new MemoryArtifacts(), {
      maxPendingAppendBytes: byteLength - 1,
    });
    await expectCode(ledger.append(append), "LEDGER_LIMIT_EXCEEDED");
    expect(ledger.snapshot().eventCount).toBe(0);
    await ledger.close();
  });

  it("pins normalized limits and rejects policy reinterpretation on reopen", async () => {
    const root = join(await sandbox(), "ledger");
    const limits = { maxEvents: 3 };
    let ledger = await openLedger(root, new MemoryArtifacts(), limits);
    await ledger.append(request("created", run(null, "created")));
    await ledger.close();
    await expectCode(openLedger(root), "POLICY_MISMATCH");

    ledger = await openLedger(root, new MemoryArtifacts(), limits);
    await ledger.append(request("queued", run("created", "queued")));
    await ledger.append(request("running", run("queued", "running")));
    await expectCode(
      ledger.append(request("draining", run("running", "draining"))),
      "LEDGER_LIMIT_EXCEEDED",
    );
    await ledger.close();
  });

  it("enforces per-event artifact caps again during replay", async () => {
    const root = join(await sandbox(), "ledger");
    const first = artifact("artifact-1", "one");
    const second = artifact("artifact-2", "two");
    const artifacts = new MemoryArtifacts();
    artifacts.objects.set(first.reference.casKey, first.bytes);
    artifacts.objects.set(second.reference.casKey, second.bytes);
    const ledger = await openLedger(root, artifacts);
    await ledger.append(
      request("created", run(null, "created"), [first.reference, second.reference]),
    );
    await ledger.close();

    const bindingPath = join(runDirectory(root), "binding.json");
    const binding = JSON.parse(await readFile(bindingPath, "utf8")) as {
      limits: Record<string, number>;
    };
    binding.limits.maxArtifactRefsPerEvent = 1;
    await writeFile(bindingPath, `${canonicalJson(binding)}\n`);
    await expectCode(
      openLedger(root, artifacts, { maxArtifactRefsPerEvent: 1 }),
      "LEDGER_CORRUPTION",
    );
  });

  it("rejects huge or shared resolver output from a tiny reference before hashing it", async () => {
    const root = join(await sandbox(), "ledger");
    const stored = artifact();
    const ledger = await openLedger(root, {
      async read() {
        return new Uint8Array(1024 * 1024);
      },
    });
    await expectCode(
      ledger.append(request("created", run(null, "created"), [stored.reference])),
      "ARTIFACT_UNRESOLVED",
    );
    expect(ledger.snapshot().eventCount).toBe(0);
    await ledger.close();

    const sharedRoot = join(await sandbox(), "shared-ledger");
    const shared = new Uint8Array(new SharedArrayBuffer(stored.bytes.byteLength));
    shared.set(stored.bytes);
    const sharedLedger = await openLedger(sharedRoot, {
      async read() {
        return shared;
      },
    });
    await expectCode(
      sharedLedger.append(request("created", run(null, "created"), [stored.reference])),
      "ARTIFACT_UNRESOLVED",
    );
    await sharedLedger.close();
  });

  it("uses a cross-process writer lease and treats partial lock owners as bounded busy", async () => {
    const root = join(await sandbox(), "ledger");
    const ledger = await openLedger(root);
    const moduleUrl = new URL("./run-ledger.ts", import.meta.url).href;
    const childScript = `
      import { openTestRunLedger } from ${JSON.stringify(moduleUrl)};
      try {
        const ledger = await openTestRunLedger({root:${JSON.stringify(root)},namespace:"test",expectedRunId:"run-1",artifactResolver:{async read(){throw new Error("unused")}}});
        await ledger.close();
        console.log("OPENED");
      } catch (error) { console.log(error.code ?? "UNKNOWN"); }
    `;
    const blocked = await executeFile(process.execPath, [
      "--input-type=module",
      "--eval",
      childScript,
    ]);
    expect(blocked.stdout.trim()).toBe("LEDGER_BUSY");
    await ledger.close();
    const opened = await executeFile(process.execPath, [
      "--input-type=module",
      "--eval",
      childScript,
    ]);
    expect(opened.stdout.trim()).toBe("OPENED");

    const lockPath = join(runDirectory(root), ".writer.lock");
    await writeFile(lockPath, "{");
    await expectCode(openLedger(root), "LEDGER_BUSY");
    await writeFile(
      lockPath,
      `${canonicalJson({
        schemaVersion: "lego.test-run-writer-lock/1",
        pid: 2_147_483_647,
        processStartedAtMs: 1,
        token: "00000000-0000-4000-8000-000000000000",
      })}\n`,
    );
    const staleAttempts = await Promise.all([
      executeFile(process.execPath, ["--input-type=module", "--eval", childScript]),
      executeFile(process.execPath, ["--input-type=module", "--eval", childScript]),
    ]);
    expect(staleAttempts.map(({ stdout }) => stdout.trim())).toEqual([
      "LEDGER_BUSY",
      "LEDGER_BUSY",
    ]);
  });

  it("single-flights concurrent close calls before releasing the writer lease", async () => {
    const root = join(await sandbox(), "ledger");
    const ledger = await openLedger(root);
    const first = ledger.close();
    const second = ledger.close();
    expect(first).toBe(second);
    await Promise.all([first, second]);
    const reopened = await openLedger(root);
    await reopened.close();
  });

  it("fails closed on a hard-link swap instead of truncating an external file", async () => {
    const root = join(await sandbox(), "ledger");
    const ledger = await openLedger(root);
    await ledger.append(request("created", run(null, "created")));
    await ledger.append(request("queued", run("created", "queued")));
    await ledger.close();
    const events = join(runDirectory(root), "events.jsonl");
    await appendFile(events, "{partial");
    const external = join(await sandbox(), "external-events");
    await writeFile(external, "do not truncate");
    await rm(events);
    await link(external, events);
    await expectCode(openLedger(root), "LEDGER_CORRUPTION");
    expect(await readFile(external, "utf8")).toBe("do not truncate");
  });

  it("pins and deeply freezes all runtime transition and recovery policy", () => {
    expect(RUN_LEDGER_POLICY_HASH).toBe(
      "sha256:0e916301181b987507b53761ef6d3cfd3faad3ab05286c2c834d5a9f6601070c",
    );
    expect(Object.isFrozen(RUN_TRANSITIONS)).toBe(true);
    expect(Object.isFrozen(RUN_TRANSITIONS.created)).toBe(true);
    expect(Object.isFrozen(CANDIDATE_TRANSITIONS.persistenceFailed)).toBe(true);
    expect(Object.isFrozen(RUN_RECOVERY_TARGET)).toBe(true);
    expect(() => (RUN_TRANSITIONS.created as string[]).push("running")).toThrow();
  });
});
