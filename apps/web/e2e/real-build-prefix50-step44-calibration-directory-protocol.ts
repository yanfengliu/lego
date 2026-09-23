import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { readExactRealBuildPrefix50Step44CalibrationPublicationMarkerBytes } from "./real-build-prefix50-step44-calibration-publication-marker.ts";
import {
  nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine,
  waitForRealBuildPrefix50Step44CalibrationDirectoryHelper,
} from "./real-build-prefix50-step44-calibration-directory-process.ts";
import type {
  RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  RealBuildPrefix50Step44CalibrationDirectoryTransactionState,
} from "./real-build-prefix50-step44-calibration-directory-state.ts";
import { captureRealBuildPrefix50Step44ClaimedDirectoryIdentity } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { assertWindowsPathsHaveOnlyDefaultDataStreams } from "./windows-alternate-data-streams.ts";

type TransactionState = RealBuildPrefix50Step44CalibrationDirectoryTransactionState;

export async function acceptRealBuildPrefix50Step44RetainedCalibrationDirectory(
  state: TransactionState,
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  expectedPrefix: "ROLLED_BACK" | "RETAINED",
): Promise<string> {
  const line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
  const match = new RegExp(`^${expectedPrefix}\\t([^\\t]+)\\t([^\\t]+)$`, "u").exec(line);
  if (match === null)
    throw new Error(`Calibration directory helper returned ${JSON.stringify(line)}.`);
  const root = dirname(transaction.finalOutputPath);
  const retainedOutputPath = resolve(root, match[1]!);
  const retainedMarkerPath = resolve(root, match[2]!);
  const identity = await captureRealBuildPrefix50Step44ClaimedDirectoryIdentity(
    retainedOutputPath,
    root,
  );
  if (
    identity.device !== state.stagingIdentity.device ||
    identity.inode !== state.stagingIdentity.inode ||
    state.markerBytes === undefined
  )
    throw new Error("Calibration rollback did not retain the exact held publication identities.");
  const marker = lstatSync(retainedMarkerPath, { bigint: true });
  if (
    marker.isSymbolicLink() ||
    !marker.isFile() ||
    marker.nlink !== 1n ||
    realpathSync.native(retainedMarkerPath) !== retainedMarkerPath
  )
    throw new Error("Calibration rollback did not retain its exact ordinary marker.");
  readExactRealBuildPrefix50Step44CalibrationPublicationMarkerBytes(
    root,
    retainedMarkerPath,
    state.markerBytes,
  );
  state.retainedOutputPath = retainedOutputPath;
  state.retainedMarkerPath = retainedMarkerPath;
  state.child.stdin!.end("RELEASE\n");
  await waitForRealBuildPrefix50Step44CalibrationDirectoryHelper(state);
  state.phase = "closed";
  return retainedOutputPath;
}

export async function releaseRealBuildPrefix50Step44ForeignCalibrationGuard(
  state: TransactionState,
): Promise<void> {
  state.child.stdin!.end("RELEASE_FOREIGN\n");
  const line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
  if (line !== "FOREIGN_RELEASED")
    throw new Error(`Calibration directory helper returned ${JSON.stringify(line)}.`);
  await waitForRealBuildPrefix50Step44CalibrationDirectoryHelper(state);
  state.phase = "closed";
}

interface GuardRosterEntry {
  readonly relativePath: string;
  readonly kind: "file" | "directory";
  readonly device: string;
  readonly inode: string;
  readonly size?: string;
}

function exactRosterEntry(root: string, path: string, depth: number): GuardRosterEntry[] {
  const before = lstatSync(path, { bigint: true });
  if (
    before.isSymbolicLink() ||
    before.dev < 0n ||
    before.ino <= 0n ||
    realpathSync.native(path) !== path
  )
    throw new TypeError(`Calibration guard roster entry is linked or unstable: ${path}.`);
  const relativePath = relative(root, path);
  if (before.isDirectory()) {
    if (depth > 1)
      throw new TypeError("Calibration guard roster exceeds its exact flat case-tree depth.");
    const children = readdirSync(path).sort((left, right) => left.localeCompare(right));
    const entry = Object.freeze({
      relativePath,
      kind: "directory" as const,
      device: before.dev.toString(),
      inode: before.ino.toString(),
    });
    return [
      entry,
      ...children.flatMap((name) => exactRosterEntry(root, resolve(path, name), depth + 1)),
    ];
  }
  if (!before.isFile() || before.nlink !== 1n)
    throw new TypeError(`Calibration guard roster entry is not singly linked: ${path}.`);
  return [
    Object.freeze({
      relativePath,
      kind: "file" as const,
      device: before.dev.toString(),
      inode: before.ino.toString(),
      size: before.size.toString(),
    }),
  ];
}

function markerRosterEntry(transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction) {
  const root = dirname(transaction.finalOutputPath);
  const path = transaction.finalPublicationMarkerPath;
  const state = lstatSync(path, { bigint: true });
  if (
    state.isSymbolicLink() ||
    !state.isFile() ||
    state.nlink !== 1n ||
    realpathSync.native(path) !== path
  )
    throw new TypeError("Calibration publication marker cannot enter the native guard roster.");
  return Object.freeze({
    relativePath: relative(root, path),
    kind: "file" as const,
    device: state.dev.toString(),
    inode: state.ino.toString(),
    size: state.size.toString(),
  });
}

function guardRoster(transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction) {
  const root = dirname(transaction.finalOutputPath);
  const roster = Object.freeze([
    ...exactRosterEntry(root, transaction.finalOutputPath, 0),
    markerRosterEntry(transaction),
  ]);
  if (roster.length < 2 || roster.length > 512)
    throw new RangeError("Calibration guard roster count is outside its 2..512 bound.");
  assertWindowsPathsHaveOnlyDefaultDataStreams(
    roster.map((entry) => resolve(root, entry.relativePath)),
    "Calibration native guard roster",
  );
  return roster;
}

export function captureRealBuildPrefix50Step44CalibrationTreeRosterCommitment(
  outputPath: string,
): Sha256Digest {
  const path = resolve(outputPath);
  const parent = dirname(path);
  const roster = exactRosterEntry(parent, path, 0).map((entry) =>
    Object.freeze({
      ...entry,
      relativePath: relative(path, resolve(parent, entry.relativePath)) || ".",
    }),
  );
  assertWindowsPathsHaveOnlyDefaultDataStreams(
    roster.map((entry) => (entry.relativePath === "." ? path : resolve(path, entry.relativePath))),
    "Calibration prepared tree roster",
  );
  return canonicalDigest(roster);
}

export function captureRealBuildPrefix50Step44CalibrationGuardRosterCommitment(
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
): Sha256Digest {
  return canonicalDigest(guardRoster(transaction));
}

export async function lockRealBuildPrefix50Step44CalibrationGuardRoster(
  state: TransactionState,
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
): Promise<Sha256Digest> {
  const roster = guardRoster(transaction);
  state.child.stdin!.write(
    `LOCK\t${Buffer.from(JSON.stringify(roster), "utf8").toString("base64")}\n`,
  );
  const line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
  if (line !== "LOCKED")
    throw new Error(`Calibration directory helper returned ${JSON.stringify(line)}.`);
  return canonicalDigest(roster);
}

export async function reassertRealBuildPrefix50Step44CalibrationNativeGuardActive(
  state: TransactionState,
): Promise<void> {
  state.child.stdin!.write("REASSERT\n");
  const line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
  if (line !== "ACTIVE")
    throw new TypeError(
      "Calibration qualification requires an active native TxF transaction and held exact roster.",
    );
}
