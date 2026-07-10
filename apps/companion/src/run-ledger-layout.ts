import { randomUUID } from "node:crypto";
import { mkdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { canonicalJson, sha256 } from "./run-ledger-codec.ts";
import { syncDirectoryBestEffort } from "./run-ledger-durability.ts";
import {
  assertInside,
  assertSafeDirectory,
  linkStats,
  readRegularFile,
  writeSyncedExclusive,
} from "./run-ledger-fs.ts";
import { RUN_LEDGER_POLICY_HASH, RUN_LEDGER_POLICY_VERSION } from "./run-ledger-policy.ts";
import { RunLedgerError, type RunLedgerLimits } from "./run-ledger-types.ts";

const ROOT_MARKER_NAME = ".lego-test-run-ledger-v1";
const ROOT_MARKER_BYTES = Buffer.from("lego.companion.test-run-ledger/1\n", "utf8");
const RUNS_DIRECTORY = "runs";
const BINDING_FILE = "binding.json";
const EVENTS_FILE = "events.jsonl";

export interface LedgerPaths {
  readonly root: string;
  readonly runDirectory: string;
  readonly bindingFile: string;
  readonly eventsFile: string;
}

async function verifyRoot(root: string): Promise<void> {
  await assertSafeDirectory(root, "ROOT_NOT_OWNED");
  const marker = await readRegularFile(join(root, ROOT_MARKER_NAME), ROOT_MARKER_BYTES.byteLength);
  if (!marker.equals(ROOT_MARKER_BYTES)) {
    throw new RunLedgerError("ROOT_NOT_OWNED", "Run-ledger root marker is invalid");
  }
  await assertSafeDirectory(join(root, RUNS_DIRECTORY), "ROOT_NOT_OWNED");
}

export async function initializeRoot(root: string): Promise<void> {
  if (await linkStats(root)) {
    await verifyRoot(root);
    return;
  }
  const parent = dirname(root);
  await assertSafeDirectory(parent, "INVALID_ROOT");
  const staging = join(parent, `.${basename(root)}.${randomUUID()}.init.tmp`);
  let failure: unknown;
  let renamed = false;
  try {
    await mkdir(staging, { mode: 0o700 });
    await writeSyncedExclusive(join(staging, ROOT_MARKER_NAME), ROOT_MARKER_BYTES);
    await mkdir(join(staging, RUNS_DIRECTORY), { mode: 0o700 });
    await rename(staging, root);
    renamed = true;
    await syncDirectoryBestEffort(parent);
  } catch (error) {
    failure = error;
  }
  try {
    await rm(staging, { recursive: true, force: true });
  } catch (cleanupError) {
    throw new RunLedgerError(
      "PERSISTENCE_FAILED",
      "Run-ledger initialization failed and cleanup was incomplete",
      { cause: cleanupError },
    );
  }
  if (failure && (renamed || !(await linkStats(root)))) {
    throw new RunLedgerError("PERSISTENCE_FAILED", "Run-ledger root initialization failed", {
      cause: failure,
    });
  }
  await verifyRoot(root);
}

function bindingBytes(runId: string, limits: RunLedgerLimits): Buffer {
  return Buffer.from(
    `${canonicalJson({
      schemaVersion: "lego.test-run-binding/2",
      namespace: "test",
      runId,
      policyVersion: RUN_LEDGER_POLICY_VERSION,
      policyHash: RUN_LEDGER_POLICY_HASH,
      limits,
    })}\n`,
    "utf8",
  );
}

export async function initializeRun(
  paths: LedgerPaths,
  runId: string,
  limits: RunLedgerLimits,
): Promise<void> {
  const createdRun = (await linkStats(paths.runDirectory)) === null;
  const expectedBinding = bindingBytes(runId, limits);
  if (createdRun) {
    const staging = join(
      dirname(paths.runDirectory),
      `.${basename(paths.runDirectory)}.${randomUUID()}.init.tmp`,
    );
    let failure: unknown;
    let renamed = false;
    try {
      await mkdir(staging, { mode: 0o700 });
      await writeSyncedExclusive(join(staging, BINDING_FILE), expectedBinding);
      await writeSyncedExclusive(join(staging, EVENTS_FILE), new Uint8Array());
      await rename(staging, paths.runDirectory);
      renamed = true;
      await syncDirectoryBestEffort(dirname(paths.runDirectory));
    } catch (error) {
      failure = error;
    }
    try {
      await rm(staging, { recursive: true, force: true });
    } catch (cleanupError) {
      throw new RunLedgerError(
        "PERSISTENCE_FAILED",
        "Run initialization failed and staging cleanup was incomplete",
        { cause: cleanupError },
      );
    }
    if (failure && (renamed || !(await linkStats(paths.runDirectory)))) {
      throw new RunLedgerError("PERSISTENCE_FAILED", "Atomic run initialization failed", {
        cause: failure,
      });
    }
  }
  await assertSafeDirectory(paths.runDirectory, "ROOT_NOT_OWNED");
  if (!(await linkStats(paths.bindingFile)) || !(await linkStats(paths.eventsFile))) {
    throw new RunLedgerError(
      "LEDGER_CORRUPTION",
      "Existing run directory is missing its binding or event stream",
    );
  }
  const actualBinding = await readRegularFile(paths.bindingFile, 64 * 1024);
  if (!actualBinding.equals(expectedBinding)) {
    throw new RunLedgerError(
      "POLICY_MISMATCH",
      "Persisted run policy or limits do not match this opener",
    );
  }
}

export function pathsFor(root: string, runId: string): LedgerPaths {
  const runs = join(root, RUNS_DIRECTORY);
  const runDirectory = join(runs, sha256(runId).slice("sha256:".length));
  assertInside(root, runDirectory);
  return {
    root,
    runDirectory,
    bindingFile: join(runDirectory, BINDING_FILE),
    eventsFile: join(runDirectory, EVENTS_FILE),
  };
}
