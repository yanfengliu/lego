import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, rename, rm, type FileHandle } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJson } from "./run-ledger-codec.ts";
import { filesystemCode, linkStats, openNoFollow } from "./run-ledger-fs.ts";
import { RunLedgerError } from "./run-ledger-types.ts";

const LOCK_FILE = ".writer.lock";
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const MAX_LOCK_BYTES = 1024;

export interface RunWriterLease {
  release(): Promise<void>;
}

async function writeAll(handle: FileHandle, bytes: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const result = await handle.write(bytes, offset, bytes.byteLength - offset, null);
    if (result.bytesWritten === 0) throw new Error("Writer-lock write made no progress");
    offset += result.bytesWritten;
  }
}

function ownerBytes(token: string): Buffer {
  return Buffer.from(
    `${canonicalJson({
      schemaVersion: "lego.test-run-writer-lock/1",
      pid: process.pid,
      processStartedAtMs: Math.floor(Date.now() - process.uptime() * 1000),
      token,
    })}\n`,
    "utf8",
  );
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return filesystemCode(error) !== "ESRCH";
  }
}

async function staleOwnerPid(lockPath: string): Promise<number | null | undefined> {
  const linkedStats = await linkStats(lockPath);
  if (!linkedStats) return undefined;
  if (linkedStats.isSymbolicLink() || !linkedStats.isFile() || linkedStats.nlink !== 1) {
    throw new RunLedgerError("LEDGER_CORRUPTION", "Writer lock is not a regular owned file");
  }
  let handle: FileHandle;
  try {
    handle = await openNoFollow(lockPath, constants.O_RDONLY);
  } catch (error) {
    if (filesystemCode(error) === "ENOENT") return undefined;
    throw new RunLedgerError("LEDGER_BUSY", "Writer lock cannot be inspected safely", {
      cause: error,
    });
  }
  let bytes: Buffer;
  try {
    const stats = await handle.stat();
    if (
      !stats.isFile() ||
      stats.nlink !== 1 ||
      stats.dev !== linkedStats.dev ||
      stats.ino !== linkedStats.ino ||
      stats.size > MAX_LOCK_BYTES
    ) {
      throw new RunLedgerError("LEDGER_CORRUPTION", "Writer lock is not a bounded regular file");
    }
    if (stats.size === 0) return null;
    bytes = Buffer.alloc(stats.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const result = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (result.bytesRead === 0) return null;
      offset += result.bytesRead;
    }
  } finally {
    await handle.close();
  }
  const text = bytes.toString("utf8");
  let owner: unknown;
  try {
    owner = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof owner !== "object" || owner === null || Array.isArray(owner)) return null;
  const record = owner as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.join("\0") !== "pid\0processStartedAtMs\0schemaVersion\0token" ||
    record.schemaVersion !== "lego.test-run-writer-lock/1" ||
    !Number.isSafeInteger(record.pid) ||
    (record.pid as number) < 1 ||
    !Number.isSafeInteger(record.processStartedAtMs) ||
    (record.processStartedAtMs as number) < 1 ||
    typeof record.token !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.token) ||
    canonicalJson(record) + "\n" !== text
  ) {
    return null;
  }
  const pid = record.pid as number;
  return processIsAlive(pid) ? pid : -pid;
}

function shortDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

export async function acquireRunWriterLease(runDirectory: string): Promise<RunWriterLease> {
  const lockPath = join(runDirectory, LOCK_FILE);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const token = randomUUID();
    let handle: FileHandle;
    try {
      handle = await open(
        lockPath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | NO_FOLLOW,
        0o600,
      );
    } catch (error) {
      if (filesystemCode(error) !== "EEXIST") {
        throw new RunLedgerError("PERSISTENCE_FAILED", "Could not create writer lock", {
          cause: error,
        });
      }
      const ownerPid = await staleOwnerPid(lockPath);
      if (ownerPid === undefined) continue;
      if (ownerPid === null) {
        await shortDelay();
        continue;
      }
      if (ownerPid > 0) {
        throw new RunLedgerError("LEDGER_BUSY", `Run ledger is owned by process ${ownerPid}`);
      }
      throw new RunLedgerError(
        "LEDGER_BUSY",
        "A stale writer lock requires explicit local recovery",
      );
    }

    try {
      await writeAll(handle, ownerBytes(token));
      await handle.sync();
    } catch (error) {
      await handle.close().catch(() => undefined);
      await rm(lockPath, { force: true }).catch(() => undefined);
      throw new RunLedgerError("PERSISTENCE_FAILED", "Could not persist writer lock", {
        cause: error,
      });
    }
    let released = false;
    let handleClosed = false;
    const releasedPath = `${lockPath}.released.${token}`;
    let lockRenamed = false;
    return {
      async release() {
        if (released) return;
        if (!handleClosed) {
          await handle.close();
          handleClosed = true;
        }
        try {
          if (!lockRenamed) {
            await rename(lockPath, releasedPath);
            lockRenamed = true;
          }
          await rm(releasedPath, { force: true });
          released = true;
        } catch (error) {
          throw new RunLedgerError("PERSISTENCE_FAILED", "Could not release writer lock", {
            cause: error,
          });
        }
      },
    };
  }
  throw new RunLedgerError("LEDGER_BUSY", "Writer lock admission did not settle");
}
