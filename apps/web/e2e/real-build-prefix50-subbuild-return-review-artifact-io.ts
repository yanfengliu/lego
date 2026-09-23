import { createHash } from "node:crypto";
import { closeSync, fstatSync, lstatSync, openSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { readContainedBoundedRegularFile } from "./bounded-file-read.ts";
import { runRealBuildPrefix50Step44LaterSourceLedgerClosed } from "./real-build-prefix50-step44-later-source-ledger-errors.ts";
import {
  claimRealBuildPrefix50Step44LaterSourceIssuance as claimRealBuildPrefix50Step44LaterSourceIssuanceInternal,
  type RealBuildPrefix50Step44LaterSourceLedgerClaim,
} from "./real-build-prefix50-step44-later-source-ledger.ts";

export { realBuildPrefix50Step44LaterSourceLedgerArtifacts } from "./real-build-prefix50-step44-later-source-ledger.ts";
export type {
  RealBuildPrefix50Step44LaterSourceDerivedEvidence,
  RealBuildPrefix50Step44LaterSourceLedgerArtifacts,
  RealBuildPrefix50Step44LaterSourceLedgerClaim,
  RealBuildPrefix50Step44LaterSourceLedgerPurpose,
  RealBuildPrefix50Step44LaterSourceTransactionEvidence,
} from "./real-build-prefix50-step44-later-source-ledger.ts";

export function claimRealBuildPrefix50Step44LaterSourceIssuance(input: {
  readonly repositoryRoot: string;
  readonly claim: RealBuildPrefix50Step44LaterSourceLedgerClaim;
}): Readonly<{ namespaceCommitment: `sha256:${string}`; claimCommitment: `sha256:${string}` }> {
  return runRealBuildPrefix50Step44LaterSourceLedgerClosed(() =>
    claimRealBuildPrefix50Step44LaterSourceIssuanceInternal(input),
  );
}

export function resolveRealBuildPrefix50Step44ReviewArtifact(
  repositoryRoot: string,
  logicalPath: string,
  maximumBytes: number,
  label: string,
): { readonly path: string; readonly size: number } {
  if (
    logicalPath.length === 0 ||
    isAbsolute(logicalPath) ||
    logicalPath.includes("\\") ||
    logicalPath.split("/").some((segment) => segment.length === 0 || segment === "..")
  )
    throw new TypeError(`${label} must be one normalized repository-relative path.`);
  const realRoot = realpathSync(resolve(repositoryRoot));
  const unresolved = resolve(realRoot, logicalPath);
  const local = relative(realRoot, unresolved);
  if (local.length === 0 || local.startsWith(".."))
    throw new TypeError(`${label} escapes the repository root.`);
  const linkStats = lstatSync(unresolved);
  if (linkStats.isSymbolicLink()) throw new TypeError(`${label} may not be a symlink.`);
  const path = realpathSync(unresolved);
  const realLocal = relative(realRoot, path);
  if (realLocal.length === 0 || realLocal.startsWith(".."))
    throw new TypeError(`${label} resolves outside the repository root.`);
  const descriptor = openSync(path, "r");
  try {
    const stats = fstatSync(descriptor);
    if (!stats.isFile() || stats.size < 1 || stats.size > maximumBytes)
      throw new RangeError(
        `${label} must be a regular 1..${maximumBytes}-byte file; received ${stats.size}.`,
      );
    return { path, size: stats.size };
  } finally {
    closeSync(descriptor);
  }
}

export function readRealBuildPrefix50Step44ReviewArtifact(
  repositoryRoot: string,
  logicalPath: string,
  maximumBytes: number,
  label: string,
  expectedSha256?: `sha256:${string}`,
): Buffer {
  return readContainedBoundedRegularFile(repositoryRoot, logicalPath, {
    label,
    minimumBytes: 1,
    maximumBytes,
    ...(expectedSha256 === undefined ? {} : { expectedSha256 }),
  });
}

export function hashRealBuildPrefix50Step44ReviewArtifact(
  repositoryRoot: string,
  logicalPath: string,
  maximumBytes: number,
  label: string,
): `sha256:${string}` {
  const bytes = readContainedBoundedRegularFile(repositoryRoot, logicalPath, {
    label,
    minimumBytes: 1,
    maximumBytes,
  });
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function sha256RealBuildPrefix50Step44ReviewBytes(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
