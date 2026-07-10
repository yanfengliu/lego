import { constants } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { RunLedgerError, type RunLedgerErrorCode } from "./run-ledger-types.ts";

const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;

export function filesystemCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

export async function linkStats(path: string): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  try {
    return await lstat(path);
  } catch (error) {
    if (filesystemCode(error) === "ENOENT") return null;
    throw error;
  }
}

export function assertInside(root: string, candidate: string): void {
  const relation = relative(root, candidate);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) return;
  throw new RunLedgerError("UNSAFE_PATH", "Derived run-ledger path escaped its owned root");
}

export async function assertSafeDirectory(
  path: string,
  missingCode: Extract<RunLedgerErrorCode, "INVALID_ROOT" | "ROOT_NOT_OWNED">,
): Promise<void> {
  const stats = await linkStats(path);
  if (!stats) throw new RunLedgerError(missingCode, `Required directory is missing: ${path}`);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new RunLedgerError("UNSAFE_PATH", `Expected a real directory: ${path}`);
  }
  if (resolve(await realpath(path)) !== resolve(path)) {
    throw new RunLedgerError("UNSAFE_PATH", `Directory traverses a symbolic link: ${path}`);
  }
}

export async function openNoFollow(
  path: string,
  flags: number,
  mode?: number,
): Promise<FileHandle> {
  try {
    return await open(path, flags | NO_FOLLOW, mode);
  } catch (error) {
    if (filesystemCode(error) === "ELOOP") {
      throw new RunLedgerError("UNSAFE_PATH", `Refused symbolic-link file: ${path}`, {
        cause: error,
      });
    }
    throw error;
  }
}

export async function writeAll(handle: FileHandle, bytes: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const { bytesWritten } = await handle.write(bytes, offset, bytes.byteLength - offset, null);
    if (bytesWritten === 0) throw new Error("Run-ledger write made no progress");
    offset += bytesWritten;
  }
}

export async function writeSyncedExclusive(path: string, bytes: Uint8Array): Promise<void> {
  const handle = await openNoFollow(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600,
  );
  try {
    await writeAll(handle, bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function readRegularFile(path: string, maxBytes: number): Promise<Buffer> {
  const stats = await linkStats(path);
  if (!stats || !stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) {
    throw new RunLedgerError("LEDGER_CORRUPTION", `Required ledger file is invalid: ${path}`);
  }
  if (stats.size > maxBytes) {
    throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Ledger file exceeds its byte cap");
  }
  const handle = await openNoFollow(path, constants.O_RDONLY);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1 || opened.size !== stats.size) {
      throw new RunLedgerError("LEDGER_CORRUPTION", "Ledger file changed during recovery");
    }
    const bytes = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (bytesRead === 0) {
        throw new RunLedgerError("LEDGER_CORRUPTION", "Ledger file was truncated during recovery");
      }
      offset += bytesRead;
    }
    const extra = Buffer.allocUnsafe(1);
    if ((await handle.read(extra, 0, 1, offset)).bytesRead !== 0) {
      throw new RunLedgerError("LEDGER_CORRUPTION", "Ledger file grew during recovery");
    }
    return bytes;
  } finally {
    await handle.close();
  }
}
