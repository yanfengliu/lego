import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ArtifactRefV1 } from "@lego-studio/protocol";
import { afterEach, describe, expect, it } from "vitest";

import {
  openTestRunLedger,
  type AppendRunEventInput,
  type ArtifactResolver,
  type FinalizeRunBundleInput,
  type NativeRunTransition,
  type TestRunLedger,
} from "./run-ledger.ts";

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
  const path = await mkdtemp(join(tmpdir(), "lego-run-finalize-"));
  sandboxes.push(path);
  return path;
}

function artifact(id: string, contents: string): { bytes: Uint8Array; reference: ArtifactRefV1 } {
  const bytes = encoder.encode(contents);
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
  return {
    bytes,
    reference: {
      artifactId: id,
      kind: "bundle",
      mediaType: "application/json",
      sha256: digest,
      byteLength: bytes.byteLength,
      casKey: digest,
    },
  };
}

function run(from: NativeRunTransition["from"], to: string): NativeRunTransition {
  return { subject: "run", subjectId: "finalize-run", from, to } as NativeRunTransition;
}

function append(
  key: string,
  transition: NativeRunTransition,
  artifactRefs: readonly ArtifactRefV1[] = [],
  cancellationGeneration = 0,
): AppendRunEventInput {
  return {
    schemaVersion: "lego.test-run-append/1",
    namespace: "test",
    expectedRunId: "finalize-run",
    actorId: "test-broker",
    idempotencyKey: key,
    cancellationGeneration,
    transition,
    artifactRefs,
  };
}

function finalization(
  ledger: TestRunLedger,
  reference: ArtifactRefV1,
  key = "finalize-bundle",
): FinalizeRunBundleInput {
  const snapshot = ledger.snapshot();
  return {
    schemaVersion: "lego.test-run-finalize/1",
    namespace: "test",
    expectedRunId: "finalize-run",
    expectedEventCount: snapshot.eventCount,
    expectedEventRoot: snapshot.eventRoot,
    append: append(key, run("draining", "exhausted"), [reference]),
  };
}

async function openRunning(artifacts: MemoryArtifacts) {
  const ledger = await openTestRunLedger({
    root: join(await sandbox(), "ledger"),
    namespace: "test",
    expectedRunId: "finalize-run",
    artifactResolver: artifacts,
  });
  await ledger.append(append("created", run(null, "created")));
  await ledger.append(append("queued", run("created", "queued")));
  await ledger.append(append("running", run("queued", "running")));
  return ledger;
}

async function openDraining(artifacts: MemoryArtifacts) {
  const ledger = await openRunning(artifacts);
  await ledger.append(append("draining", run("running", "draining")));
  return ledger;
}

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("checkpointed test-bundle finalization", () => {
  it("atomically anchors the manifest to the exact pre-terminal event prefix", async () => {
    const artifacts = new MemoryArtifacts();
    const manifest = artifact("bundle-manifest", '{"integrity":"unsealed"}');
    artifacts.objects.set(manifest.reference.casKey, manifest.bytes);
    const ledger = await openDraining(artifacts);
    const input = finalization(ledger, manifest.reference);

    const result = await ledger.finalizeBundle(input);

    expect(result.disposition).toBe("committed");
    expect(result.event.event.sequence).toBe(input.expectedEventCount);
    expect(result.event.event.previousEventHash).toBe(input.expectedEventRoot);
    expect(result.event.transition).toEqual(run("draining", "exhausted"));
    expect(result.event.artifactRefs).toEqual([manifest.reference]);
    expect(ledger.snapshot()).toMatchObject({
      runState: "exhausted",
      eventCount: input.expectedEventCount + 1,
      eventRoot: result.event.event.eventHash,
    });
    await ledger.close();
  });

  it("returns the exact terminal event on crash retry and rejects changed bytes under the key", async () => {
    const artifacts = new MemoryArtifacts();
    const first = artifact("bundle-1", '{"bundle":1}');
    const second = artifact("bundle-2", '{"bundle":2}');
    artifacts.objects.set(first.reference.casKey, first.bytes);
    artifacts.objects.set(second.reference.casKey, second.bytes);
    const ledger = await openDraining(artifacts);
    const input = finalization(ledger, first.reference);
    const committed = await ledger.finalizeBundle(input);

    const retried = await ledger.finalizeBundle(input);
    const changed = { ...input, append: { ...input.append, artifactRefs: [second.reference] } };

    expect(retried).toEqual({ disposition: "idempotent", event: committed.event });
    await expect(ledger.finalizeBundle(changed)).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
    await ledger.close();
  });

  it("rejects a stale prefix without reading the manifest or appending a terminal event", async () => {
    const artifacts = new MemoryArtifacts();
    const manifest = artifact("stale-bundle", '{"bundle":"stale"}');
    artifacts.objects.set(manifest.reference.casKey, manifest.bytes);
    const ledger = await openRunning(artifacts);
    const stale = {
      ...finalization(ledger, manifest.reference),
      append: append("stale-finalize", run("draining", "exhausted"), [manifest.reference]),
    };
    await ledger.append(append("draining", run("running", "draining")));
    const before = ledger.snapshot();

    await expect(ledger.finalizeBundle(stale)).rejects.toMatchObject({
      code: "STALE_CHECKPOINT",
    });

    expect(artifacts.readCount).toBe(0);
    expect(ledger.snapshot()).toEqual(before);
    await ledger.close();
  });

  it("serializes cancellation and finalization with exactly one state-changing winner", async () => {
    const artifacts = new MemoryArtifacts();
    const manifest = artifact("race-bundle", '{"bundle":"race"}');
    artifacts.objects.set(manifest.reference.casKey, manifest.bytes);
    const ledger = await openDraining(artifacts);
    const finalize = finalization(ledger, manifest.reference);

    const [cancelResult, finalizeResult] = await Promise.allSettled([
      ledger.append(append("cancel", run("draining", "cancelling"), [], 1)),
      ledger.finalizeBundle(finalize),
    ]);

    expect(cancelResult.status).toBe("fulfilled");
    expect(finalizeResult.status).toBe("rejected");
    if (finalizeResult.status === "rejected") {
      expect(finalizeResult.reason).toMatchObject({ code: "STALE_CHECKPOINT" });
    }
    expect(ledger.snapshot().runState).toBe("cancelling");
    await ledger.append(append("cancelled", run("cancelling", "cancelled"), [], 1));
    await ledger.close();

    const finalizeFirstLedger = await openDraining(artifacts);
    const finalizeFirst = finalization(finalizeFirstLedger, manifest.reference, "finalize-first");
    const [terminalResult, lateCancellation] = await Promise.allSettled([
      finalizeFirstLedger.finalizeBundle(finalizeFirst),
      finalizeFirstLedger.append(append("late-cancel", run("draining", "cancelling"), [], 1)),
    ]);

    expect(terminalResult.status).toBe("fulfilled");
    expect(lateCancellation.status).toBe("rejected");
    expect(finalizeFirstLedger.snapshot().runState).toBe("exhausted");
    await finalizeFirstLedger.close();
  });

  it("rejects non-bundle, multi-artifact, and non-terminal finalization requests", async () => {
    const artifacts = new MemoryArtifacts();
    const manifest = artifact("bundle", "{}");
    artifacts.objects.set(manifest.reference.casKey, manifest.bytes);
    const ledger = await openDraining(artifacts);
    const input = finalization(ledger, manifest.reference);
    const transcript = { ...manifest.reference, kind: "transcript" as const };

    for (const invalid of [
      { ...input, append: { ...input.append, artifactRefs: [transcript] } },
      {
        ...input,
        append: { ...input.append, artifactRefs: [manifest.reference, manifest.reference] },
      },
      { ...input, append: { ...input.append, transition: run("draining", "failed") } },
    ]) {
      await expect(ledger.finalizeBundle(invalid)).rejects.toMatchObject({
        code: "INVALID_RECORD",
      });
    }
    expect(artifacts.readCount).toBe(0);
    expect(ledger.snapshot().runState).toBe("draining");
    await ledger.close();
  });
});
