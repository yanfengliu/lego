import { createHmac } from "node:crypto";

import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type {
  RealBuildPrefix50Step44WithheldUnblindingMap,
  RealBuildPrefix50Step44WithheldUnblindingRow,
} from "./real-build-prefix50-subbuild-return-review-blind.ts";
import type { RealBuildPrefix50Step44BlindReviewPacket } from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { requireRealBuildPrefix50Step44ClaimedDirectoryIdentity } from "./real-build-prefix50-subbuild-return-review-blind-filesystem.ts";
import {
  requireRealBuildPrefix50Step44PublicationComplete,
  type RealBuildPrefix50Step44PublicationComplete,
} from "./real-build-prefix50-subbuild-return-review-blind-publication-complete.ts";

const MAP_FILE = "real-build-prefix50-step44-unblinding-map.json";
const MAXIMUM_MAP_BYTES = 8 * 1024 * 1024;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
interface PersistedMapProvenance {
  readonly publicationComplete: RealBuildPrefix50Step44PublicationComplete;
  readonly publicationCompleteCommitment: `sha256:${string}`;
  readonly batchCommitment: `sha256:${string}`;
  readonly withheldRoot: string;
}

const mapsReadFromDisk = new WeakMap<object, PersistedMapProvenance>();

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function blindId(index: number): `B${string}` {
  return `B${String(index + 1).padStart(3, "0")}`;
}

function requireSha(value: string, label: string): void {
  if (!SHA256.test(value)) throw new TypeError(`${label} must be one lowercase SHA-256 digest.`);
}

function rank(seed: Uint8Array, candidateCommitment: string): `sha256:${string}` {
  return `sha256:${createHmac("sha256", seed).update(candidateCommitment).digest("hex")}`;
}

function requireRow(
  row: RealBuildPrefix50Step44WithheldUnblindingRow,
  index: number,
  packet: RealBuildPrefix50Step44BlindReviewPacket,
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  seed: Uint8Array,
): void {
  exactKeys(
    row,
    [
      "artifactDirectory",
      "batchIndex",
      "blindId",
      "candidateKey",
      "captureManifestByteDigest",
      "captureManifestCommitment",
      "captureManifestFile",
      "compactCandidateCommitment",
      "commitment",
      "operationsCommitment",
      "rankDigest",
      "reviewHarnessEnvelopeCommitment",
      "rosterIndex",
      "selectedDocumentCommitment",
      "selectedDocumentHash",
      "sourceRowCommitment",
    ],
    `Step-44 withheld map row ${index + 1}`,
  );
  const compact = batch.candidates[row.batchIndex];
  const roster =
    compact === undefined ? undefined : batch.rosterSummary.candidates[compact.rosterIndex];
  const publicRow = packet.pages.flatMap(({ rows }) => rows)[index];
  for (const digest of [
    row.rankDigest,
    row.operationsCommitment,
    row.compactCandidateCommitment,
    row.selectedDocumentHash,
    row.selectedDocumentCommitment,
    row.reviewHarnessEnvelopeCommitment,
    row.captureManifestByteDigest,
    row.captureManifestCommitment,
    row.sourceRowCommitment,
    row.commitment,
  ])
    requireSha(digest, `Step-44 withheld map ${row.blindId} digest`);
  if (
    row.blindId !== blindId(index) ||
    row.artifactDirectory !== row.blindId ||
    !Number.isSafeInteger(row.batchIndex) ||
    row.batchIndex < 0 ||
    row.batchIndex >= 211 ||
    compact === undefined ||
    roster === undefined ||
    publicRow?.blindId !== row.blindId ||
    row.rosterIndex !== compact.rosterIndex ||
    row.candidateKey !== compact.candidateKey ||
    row.operationsCommitment !== compact.operationsCommitment ||
    row.compactCandidateCommitment !== compact.commitment ||
    row.rankDigest !== rank(seed, compact.commitment) ||
    row.selectedDocumentHash !== roster.selectedDocumentHash ||
    row.selectedDocumentCommitment !== roster.selectedDocumentCommitment ||
    row.reviewHarnessEnvelopeCommitment !== roster.reviewHarnessEnvelopeCommitment ||
    row.captureManifestFile.length < 1 ||
    row.captureManifestFile.includes("/") ||
    row.captureManifestFile.includes("\\") ||
    row.commitment !== canonicalDigest(withoutCommitment(row)) ||
    row.sourceRowCommitment !==
      canonicalDigest({
        blindId: row.blindId,
        batchIndex: row.batchIndex,
        captureManifestByteDigest: row.captureManifestByteDigest,
        captureManifestCommitment: row.captureManifestCommitment,
        reviewHarnessEnvelopeCommitment: row.reviewHarnessEnvelopeCommitment,
        candidateKey: row.candidateKey,
        selectedDocumentHash: row.selectedDocumentHash,
        cells: publicRow.cells.map(({ commitment }) => commitment),
        fixedCameraEvidenceCommitment: publicRow.fixedCameraEvidence.commitment,
      })
  )
    throw new TypeError(
      `Step-44 withheld map row ${row.blindId} drifted from batch/public evidence.`,
    );
}

export function readRealBuildPrefix50Step44WithheldUnblindingMap(input: {
  readonly withheldRoot: string;
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly publicationComplete: RealBuildPrefix50Step44PublicationComplete;
  readonly artifactFile?: string;
}): RealBuildPrefix50Step44WithheldUnblindingMap {
  requireRealBuildPrefix50Step44PublicationComplete(input.publicationComplete);
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.batch);
  requireRealBuildPrefix50Step44ClaimedDirectoryIdentity(
    input.publicationComplete.publicationDirectories.withheld,
    input.withheldRoot,
    "Step-44 withheld map root",
  );
  if (
    input.publicationComplete.reviewBatchEnvelopeCommitment !== batch.commitment ||
    input.publicationComplete.candidateRosterCommitment !== batch.candidateRosterCommitment ||
    input.publicationComplete.candidateKeysCommitment !== batch.candidateKeysCommitment
  )
    throw new TypeError("Step-44 withheld map COMPLETE receipt belongs to another review batch.");
  const artifactFile = input.artifactFile ?? MAP_FILE;
  if (artifactFile !== MAP_FILE)
    throw new TypeError("Step-44 promotion accepts only the canonical withheld map filename.");
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.withheldRoot,
    artifactFile,
    MAXIMUM_MAP_BYTES,
    "Step-44 withheld unblinding map",
  );
  const text = Buffer.from(bytes).toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (canonicalStringify(value) !== text)
    throw new TypeError("Step-44 withheld unblinding map is not canonical JSON.");
  const map = value as RealBuildPrefix50Step44WithheldUnblindingMap;
  exactKeys(
    map,
    [
      "authority",
      "blindingSeedHex",
      "candidateCount",
      "candidateKeysCommitment",
      "candidateRosterCommitment",
      "commitment",
      "dispatchPlanCommitment",
      "publicDuringReview",
      "publicPacketCoreCommitment",
      "returnResultCommitment",
      "reviewBatchEnvelopeCommitment",
      "rows",
      "schemaVersion",
      "sourceSetId",
    ],
    "Step-44 withheld unblinding map",
  );
  const seed = Buffer.from(map.blindingSeedHex, "hex");
  for (const digest of [
    map.dispatchPlanCommitment,
    map.reviewBatchEnvelopeCommitment,
    map.returnResultCommitment,
    map.candidateRosterCommitment,
    map.candidateKeysCommitment,
    map.publicPacketCoreCommitment,
    map.commitment,
  ])
    requireSha(digest, "Step-44 withheld map digest");
  if (
    map.schemaVersion !== "lego.real-build-prefix50-step44-withheld-unblinding-map/1" ||
    map.authority !== "none" ||
    map.publicDuringReview !== false ||
    map.sourceSetId !== "6651557" ||
    map.candidateCount !== 211 ||
    map.rows.length !== 211 ||
    seed.byteLength !== 32 ||
    seed.toString("hex") !== map.blindingSeedHex ||
    map.commitment !== canonicalDigest(withoutCommitment(map)) ||
    map.commitment !== input.packet.withheldUnblindingMapCommitment ||
    map.publicPacketCoreCommitment !== input.packet.publicPacketCoreCommitment ||
    map.reviewBatchEnvelopeCommitment !== batch.commitment ||
    map.returnResultCommitment !== batch.returnResultCommitment ||
    map.candidateRosterCommitment !== batch.candidateRosterCommitment ||
    map.candidateKeysCommitment !== batch.candidateKeysCommitment ||
    new Set(map.rows.map(({ batchIndex }) => batchIndex)).size !== 211 ||
    new Set(map.rows.map(({ candidateKey }) => candidateKey)).size !== 211
  )
    throw new TypeError("Step-44 withheld map header drifted from packet or exact review batch.");
  for (const [index, row] of map.rows.entries()) requireRow(row, index, input.packet, batch, seed);
  const frozen = deepFreeze(map);
  mapsReadFromDisk.set(
    frozen,
    deepFreeze({
      publicationComplete: input.publicationComplete,
      publicationCompleteCommitment: input.publicationComplete.commitment,
      batchCommitment: batch.commitment,
      withheldRoot: input.withheldRoot,
    }),
  );
  return frozen;
}

export function requireRealBuildPrefix50Step44PersistedUnblindingMap(input: {
  readonly map: RealBuildPrefix50Step44WithheldUnblindingMap;
  readonly publicationComplete: RealBuildPrefix50Step44PublicationComplete;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly withheldRoot: string;
}): void {
  const provenance = mapsReadFromDisk.get(input.map);
  if (provenance === undefined)
    throw new TypeError("Step-44 promotion requires a runtime-branded withheld map disk read.");
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.batch);
  requireRealBuildPrefix50Step44PublicationComplete(input.publicationComplete);
  requireRealBuildPrefix50Step44ClaimedDirectoryIdentity(
    input.publicationComplete.publicationDirectories.withheld,
    input.withheldRoot,
    "Step-44 persisted map withheld root",
  );
  if (
    provenance.publicationComplete !== input.publicationComplete ||
    provenance.publicationCompleteCommitment !== input.publicationComplete.commitment ||
    provenance.batchCommitment !== batch.commitment ||
    provenance.withheldRoot !== input.withheldRoot
  )
    throw new TypeError(
      "Step-44 persisted map belongs to another exact COMPLETE receipt, batch, or withheld root.",
    );
}
