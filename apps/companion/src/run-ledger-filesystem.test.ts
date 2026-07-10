import { createHash } from "node:crypto";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  RunLedgerError,
  openTestRunLedger,
  type AppendRunEventInput,
  type NativeRunTransition,
} from "./run-ledger.ts";

const sandboxes: string[] = [];

async function sandbox(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "lego-run-ledger-filesystem-"));
  sandboxes.push(path);
  return path;
}

function request(key: string, transition: NativeRunTransition): AppendRunEventInput {
  return {
    schemaVersion: "lego.test-run-append/1",
    namespace: "test",
    expectedRunId: "run-1",
    actorId: "test-broker",
    idempotencyKey: key,
    cancellationGeneration: 0,
    transition,
    artifactRefs: [],
  };
}

function run(from: NativeRunTransition["from"], to: string): NativeRunTransition {
  return { subject: "run", subjectId: "run-1", from, to } as NativeRunTransition;
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

describe("native run ledger file identity", () => {
  it("rejects and poisons a same-length regular-file replacement before append", async () => {
    const root = join(await sandbox(), "ledger");
    const ledger = await openTestRunLedger({
      root,
      namespace: "test",
      expectedRunId: "run-1",
      artifactResolver: {
        async read() {
          throw new Error("unused");
        },
      },
    });
    await ledger.append(request("created", run(null, "created")));
    const digest = createHash("sha256").update("run-1").digest("hex");
    const events = join(root, "runs", digest, "events.jsonl");
    const replacement = join(root, "runs", digest, "replacement.tmp");
    const original = await readFile(events);
    await writeFile(replacement, original);
    await rm(events);
    await rename(replacement, events);

    await expectCode(
      ledger.append(request("queued", run("created", "queued"))),
      "LEDGER_CORRUPTION",
    );
    await expectCode(
      ledger.append(request("queued-retry", run("created", "queued"))),
      "LEDGER_CLOSED",
    );
    await ledger.close();
  });
});
