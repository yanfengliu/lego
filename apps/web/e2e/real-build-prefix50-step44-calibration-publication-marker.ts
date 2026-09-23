import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { canonicalDigest, canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";

import { readContainedBoundedRegularFile } from "./bounded-file-read.ts";
import type { RealBuildPrefix50Step44ClaimedDirectoryIdentity } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { assertWindowsPathsHaveOnlyDefaultDataStreams } from "./windows-alternate-data-streams.ts";

const SCHEMA = "lego.real-build-prefix50-step44-calibration-publication/1" as const;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;

export interface RealBuildPrefix50Step44CalibrationPublicationDescriptor {
  readonly evidenceStatus: "qualified-and-validated" | "calibration-refused" | "heldout-refused";
  readonly persistedCaseCount: 2 | 3;
  readonly proofCommitment: Sha256Digest;
  readonly persistedManifestCommitment: Sha256Digest;
  readonly evidenceTreeCommitment: Sha256Digest;
}

export function assertSameRealBuildPrefix50Step44CalibrationPublicationDescriptor(
  expected: RealBuildPrefix50Step44CalibrationPublicationDescriptor,
  observed: RealBuildPrefix50Step44CalibrationPublicationDescriptor,
): void {
  if (canonicalDigest(expected) !== canonicalDigest(observed))
    throw new TypeError("Calibration publication proof changed during native reservation.");
}

export function readExactRealBuildPrefix50Step44CalibrationPublicationMarkerBytes(
  root: string,
  path: string,
  expected: Buffer,
): void {
  const observed = readContainedBoundedRegularFile(root, basename(path), {
    label: "calibration private publication marker",
    maximumBytes: 16 * 1024,
  });
  if (!observed.equals(expected))
    throw new TypeError("Calibration publication marker bytes changed during native reservation.");
}

export interface RealBuildPrefix50Step44CalibrationPublicationMarker {
  readonly schemaVersion: typeof SCHEMA;
  readonly authority: "none";
  readonly status: "committed";
  readonly finalOutputPathCommitment: Sha256Digest;
  readonly stagingDirectoryDevice: string;
  readonly stagingDirectoryInode: string;
  readonly evidenceStatus: RealBuildPrefix50Step44CalibrationPublicationDescriptor["evidenceStatus"];
  readonly persistedCaseCount: 2 | 3;
  readonly proofCommitment: Sha256Digest;
  readonly persistedManifestCommitment: Sha256Digest;
  readonly evidenceTreeCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

function body(input: {
  readonly finalOutputPath: string;
  readonly stagingIdentity: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
  readonly descriptor: RealBuildPrefix50Step44CalibrationPublicationDescriptor;
}) {
  return Object.freeze({
    schemaVersion: SCHEMA,
    authority: "none" as const,
    status: "committed" as const,
    finalOutputPathCommitment: canonicalDigest({ finalOutputPath: resolve(input.finalOutputPath) }),
    stagingDirectoryDevice: input.stagingIdentity.device,
    stagingDirectoryInode: input.stagingIdentity.inode,
    ...input.descriptor,
  });
}

export function realBuildPrefix50Step44CalibrationPublicationMarkerPath(
  finalOutputPath: string,
): string {
  return `${resolve(finalOutputPath)}.publication.json`;
}

export function createRealBuildPrefix50Step44CalibrationPublicationMarker(input: {
  readonly finalOutputPath: string;
  readonly stagingIdentity: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
  readonly descriptor: RealBuildPrefix50Step44CalibrationPublicationDescriptor;
}): Readonly<{ marker: RealBuildPrefix50Step44CalibrationPublicationMarker; bytes: Buffer }> {
  const markerBody = body(input);
  const marker = Object.freeze({ ...markerBody, commitment: canonicalDigest(markerBody) });
  return Object.freeze({ marker, bytes: Buffer.from(canonicalStringify(marker), "utf8") });
}

function requireDigest(value: unknown, label: string): asserts value is Sha256Digest {
  if (typeof value !== "string" || !DIGEST.test(value))
    throw new TypeError(`Calibration publication marker ${label} must be one SHA-256 digest.`);
}

function parseMarker(bytes: Buffer): RealBuildPrefix50Step44CalibrationPublicationMarker {
  const value = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  const keys = [
    "authority",
    "commitment",
    "evidenceStatus",
    "evidenceTreeCommitment",
    "finalOutputPathCommitment",
    "persistedCaseCount",
    "persistedManifestCommitment",
    "proofCommitment",
    "schemaVersion",
    "stagingDirectoryDevice",
    "stagingDirectoryInode",
    "status",
  ].sort();
  if (
    value === null ||
    Array.isArray(value) ||
    Object.keys(value)
      .sort()
      .some((key, index) => key !== keys[index]) ||
    Object.keys(value).length !== keys.length ||
    value.schemaVersion !== SCHEMA ||
    value.authority !== "none" ||
    value.status !== "committed" ||
    !["qualified-and-validated", "calibration-refused", "heldout-refused"].includes(
      value.evidenceStatus as string,
    ) ||
    (value.persistedCaseCount !== 2 && value.persistedCaseCount !== 3) ||
    typeof value.stagingDirectoryDevice !== "string" ||
    typeof value.stagingDirectoryInode !== "string"
  )
    throw new TypeError("Calibration publication marker has an invalid strict schema.");
  for (const key of [
    "commitment",
    "evidenceTreeCommitment",
    "finalOutputPathCommitment",
    "persistedManifestCommitment",
    "proofCommitment",
  ] as const)
    requireDigest(value[key], key);
  const { commitment, ...markerBody } = value;
  if (
    commitment !== canonicalDigest(markerBody) ||
    canonicalStringify(value) !== bytes.toString("utf8")
  )
    throw new TypeError("Calibration publication marker is not exact canonical committed bytes.");
  return Object.freeze(value) as unknown as RealBuildPrefix50Step44CalibrationPublicationMarker;
}

interface MarkerSnapshot {
  readonly marker: RealBuildPrefix50Step44CalibrationPublicationMarker;
  readonly device: string;
  readonly inode: string;
  readonly size: string;
}

function snapshot(finalOutputPath: string): MarkerSnapshot {
  const finalPath = resolve(finalOutputPath);
  const markerPath = realBuildPrefix50Step44CalibrationPublicationMarkerPath(finalPath);
  const parent = realpathSync.native(dirname(finalPath));
  if (parent !== dirname(finalPath))
    throw new TypeError("Calibration publication marker parent must remain one real directory.");
  const before = lstatSync(markerPath, { bigint: true });
  if (
    before.isSymbolicLink() ||
    !before.isFile() ||
    before.nlink !== 1n ||
    realpathSync.native(markerPath) !== markerPath
  )
    throw new TypeError("Calibration publication marker must remain singly linked and regular.");
  const bytes = readContainedBoundedRegularFile(parent, basename(markerPath), {
    label: "page44 calibration publication marker",
    maximumBytes: 16 * 1024,
  });
  const after = lstatSync(markerPath, { bigint: true });
  assertWindowsPathsHaveOnlyDefaultDataStreams([markerPath], "Calibration publication marker");
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size)
    throw new TypeError("Calibration publication marker changed during its bounded read.");
  return Object.freeze({
    marker: parseMarker(bytes),
    device: before.dev.toString(),
    inode: before.ino.toString(),
    size: before.size.toString(),
  });
}

export function requireRealBuildPrefix50Step44CalibrationPublicationMarker(input: {
  readonly finalOutputPath: string;
  readonly expectedDirectoryIdentity?: Pick<
    RealBuildPrefix50Step44ClaimedDirectoryIdentity,
    "device" | "inode"
  >;
  readonly expectedDescriptor?: RealBuildPrefix50Step44CalibrationPublicationDescriptor;
}): RealBuildPrefix50Step44CalibrationPublicationMarker {
  const finalPath = resolve(input.finalOutputPath);
  const directory = lstatSync(finalPath, { bigint: true });
  const marker = snapshot(finalPath).marker;
  if (
    directory.isSymbolicLink() ||
    !directory.isDirectory() ||
    realpathSync.native(finalPath) !== finalPath ||
    directory.dev.toString() !== marker.stagingDirectoryDevice ||
    directory.ino.toString() !== marker.stagingDirectoryInode
  )
    throw new TypeError(
      "Calibration publication marker did not retain its exact directory identity.",
    );
  const descriptor =
    input.expectedDescriptor ??
    Object.freeze({
      evidenceStatus: marker.evidenceStatus,
      persistedCaseCount: marker.persistedCaseCount,
      proofCommitment: marker.proofCommitment,
      persistedManifestCommitment: marker.persistedManifestCommitment,
      evidenceTreeCommitment: marker.evidenceTreeCommitment,
    });
  const expectedBody = body({
    finalOutputPath: finalPath,
    stagingIdentity: {
      lexicalPath: resolve(input.finalOutputPath),
      realPath: resolve(input.finalOutputPath),
      device: input.expectedDirectoryIdentity?.device ?? marker.stagingDirectoryDevice,
      inode: input.expectedDirectoryIdentity?.inode ?? marker.stagingDirectoryInode,
    },
    descriptor,
  });
  const expected = Object.freeze({ ...expectedBody, commitment: canonicalDigest(expectedBody) });
  if (canonicalStringify(marker) !== canonicalStringify(expected))
    throw new TypeError("Calibration publication marker did not match its exact publication.");
  return marker;
}

export async function withStableRealBuildPrefix50Step44CalibrationPublicationMarker<Result>(
  finalOutputPath: string,
  verify: (marker: RealBuildPrefix50Step44CalibrationPublicationMarker) => Promise<Result>,
): Promise<Result> {
  const before = snapshot(finalOutputPath);
  const result = await verify(before.marker);
  const after = snapshot(finalOutputPath);
  if (canonicalDigest(before) !== canonicalDigest(after))
    throw new TypeError("Calibration publication marker changed during persisted replay.");
  return result;
}
