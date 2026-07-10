import { constants } from "node:fs";
import { open } from "node:fs/promises";

import { RunLedgerError } from "./run-ledger-types.ts";

const UNSUPPORTED_DIRECTORY_SYNC_CODES = new Set([
  "EACCES",
  "EINVAL",
  "EISDIR",
  "ENOTSUP",
  "EPERM",
]);

function filesystemCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

/** Directory fsync is attempted after atomic rename and may be unavailable on Windows filesystems. */
export async function syncDirectoryBestEffort(path: string): Promise<boolean> {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY);
    await handle.sync();
    return true;
  } catch (error) {
    if (UNSUPPORTED_DIRECTORY_SYNC_CODES.has(filesystemCode(error) ?? "")) return false;
    throw new RunLedgerError("PERSISTENCE_FAILED", "Could not sync the containing directory", {
      cause: error,
    });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
