// An error message that covers several causes hides the real one. `recoverEvents`
// refuses a run event stream for nine distinct reasons; a single message for all of
// them sends whoever hits one to look at the wrong thing — 46 companion tests once
// failed on a device mismatch while every one of them printed "Ledger file exceeds
// its byte cap". So each refusal names its own condition AND the value observed for
// it, and no two of them read alike. Five of the nine are reachable by damaging a
// closed ledger and are driven below; the other four need a race between the lookup
// and the open. Distinctness is asserted as a set rather than as five separate
// strings, because the defect is two causes sharing one sentence, not any one wording.
//
// The second claim in this file: `lstat` and a handle's `fstat` do not agree on `dev`
// across platforms — Windows has reported 0 from `lstat` and the real device from
// `fstat` for the same untouched file — so the inode is the identity a swap changes
// and the device id is corroborating only. Comparing the device unconditionally
// rejected every recovery on Windows; comparing nothing but the device would accept a
// swap. That divergence is a property of the host, not of this code: on the machine
// this gate was written on both calls report the same non-zero device, so no
// end-to-end recovery can exercise the tolerance. `sameFile` is therefore pinned
// directly, on the stat pairs the two call sites in `run-ledger-file.ts` hand it.

import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { sameFile } from "./run-ledger-file.ts";
import {
  RunLedgerError,
  openTestRunLedger,
  type AppendRunEventInput,
  type NativeRunTransition,
  type RunLedgerLimits,
  type TestRunLedger,
} from "./run-ledger.ts";

const sandboxes: string[] = [];

// Small enough that a few hundred bytes of junk crosses both caps, and pinned into
// the run binding, so every open of one root has to pass the same object.
const LIMITS: Partial<RunLedgerLimits> = Object.freeze({
  maxRecordBytes: 1024,
  maxLedgerBytes: 2048,
});

async function sandbox(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "lego-run-ledger-diagnostics-"));
  sandboxes.push(path);
  return path;
}

function openLedger(root: string): Promise<TestRunLedger> {
  return openTestRunLedger({
    root,
    namespace: "test",
    expectedRunId: "run-1",
    artifactResolver: {
      async read() {
        throw new Error("unused");
      },
    },
    limits: LIMITS,
  });
}

function runDirectory(root: string): string {
  return join(root, "runs", createHash("sha256").update("run-1").digest("hex"));
}

function eventsFile(root: string): string {
  return join(runDirectory(root), "events.jsonl");
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

/** Builds a real one-event ledger, closes it, then hands its path to `damage`. */
async function refusalAfterDamage(damage: (events: string) => Promise<void>): Promise<string> {
  const root = join(await sandbox(), "ledger");
  const ledger = await openLedger(root);
  await ledger.append(request("created", run(null, "created")));
  await ledger.close();
  await damage(eventsFile(root));
  try {
    await (await openLedger(root)).close();
  } catch (error) {
    expect(error).toBeInstanceOf(RunLedgerError);
    return (error as RunLedgerError).message;
  }
  throw new Error("recovery was expected to refuse this event stream");
}

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("run-ledger recovery says which condition refused the stream", () => {
  it("names an extra hard link and how many links it found", async () => {
    const message = await refusalAfterDamage(async (events) => {
      await link(events, `${events}.second-name`);
    });
    expect(message).toContain("2 links");
    expect(message).not.toContain("byte cap");
  });

  it("names what the path holds when it is not a regular file", async () => {
    const message = await refusalAfterDamage(async (events) => {
      await rm(events);
      await mkdir(events);
    });
    expect(message).toContain("is a directory, not a regular file");
    expect(message).not.toContain("byte cap");
  });

  it("names the observed size and the cap when the stream is over its byte cap", async () => {
    const message = await refusalAfterDamage(async (events) => {
      await writeFile(events, `${"x".repeat(4095)}\n`);
    });
    expect(message).toContain("4096 bytes");
    expect(message).toContain("2048-byte cap");
  });

  it("names the truncated record's own length against the record cap", async () => {
    const message = await refusalAfterDamage(async (events) => {
      await writeFile(events, `${"x".repeat(31)}\n${"y".repeat(1200)}`);
    });
    expect(message).toContain("1200 bytes");
    expect(message).toContain("1024-byte record cap");
    // The whole-file cap is 2048 and this file is 1232 bytes, so a message about the
    // file's size would be both wrong and the one this lesson was born from.
    expect(message).not.toContain("2048-byte cap");
  });

  it("names how many bytes carry no terminator when there is no verified prefix", async () => {
    const message = await refusalAfterDamage(async (events) => {
      await writeFile(events, "z".repeat(300));
    });
    expect(message).toContain("300 bytes");
    expect(message).toContain("no record terminator");
  });

  it("gives each of the five conditions a message of its own", async () => {
    const messages = [
      await refusalAfterDamage(async (events) => {
        await link(events, `${events}.second-name`);
      }),
      await refusalAfterDamage(async (events) => {
        await rm(events);
        await mkdir(events);
      }),
      await refusalAfterDamage(async (events) => {
        await writeFile(events, `${"x".repeat(4095)}\n`);
      }),
      await refusalAfterDamage(async (events) => {
        await writeFile(events, `${"x".repeat(31)}\n${"y".repeat(1200)}`);
      }),
      await refusalAfterDamage(async (events) => {
        await writeFile(events, "z".repeat(300));
      }),
    ];
    // Paths differ per sandbox; compare what is left once the path is removed.
    const withoutPaths = messages.map((message) =>
      message.replaceAll(/[A-Za-z]:[^ ]+/gu, "<path>"),
    );
    expect(new Set(withoutPaths).size).toBe(withoutPaths.length);
  });
});

describe("run-ledger file identity is the inode, corroborated by the device", () => {
  // The pair this lesson was measured on: `lstat` said `device 0/39406496742044240`
  // and `fstat` said `3603962542/39406496742044240` for one file nobody had touched.
  // That inode is above `Number.MAX_SAFE_INTEGER`, so it cannot be perturbed by one
  // here and the neighbouring inode below is a representable stand-in.
  const observedDevice = 3603962542;
  const inode = 4503599627370495;
  const otherInode = 4503599627370494;
  const windowsLstat = { dev: 0, ino: inode };
  const windowsFstat = { dev: observedDevice, ino: inode };

  it("holds a file the same when only one side reports a device", () => {
    expect(sameFile(windowsLstat, windowsFstat)).toBe(true);
    expect(sameFile(windowsFstat, windowsLstat)).toBe(true);
  });

  it("refuses a different inode however the devices compare", () => {
    expect(sameFile(windowsLstat, { dev: 0, ino: otherInode })).toBe(false);
    expect(sameFile(windowsFstat, { dev: observedDevice, ino: otherInode })).toBe(false);
    expect(sameFile(windowsLstat, { dev: observedDevice, ino: otherInode })).toBe(false);
  });

  it("still refuses a moved device when both sides report one", () => {
    expect(sameFile(windowsFstat, { dev: observedDevice + 1, ino: inode })).toBe(false);
  });
});
