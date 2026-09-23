import { createHash } from "node:crypto";

import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  createRealBuildPrefix50Step44WithheldUnblindingMap,
  requireRealBuildPrefix50Step44BlindDispatchPlan,
  type RealBuildPrefix50Step44BlindDispatchPlan,
  type RealBuildPrefix50Step44WithheldUnblindingMap,
} from "./real-build-prefix50-subbuild-return-review-blind.ts";
import type {
  RealBuildPrefix50Step44BlindPublicHarnessSuccess,
  RealBuildPrefix50Step44BlindReviewPacket,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import {
  requireRealBuildPrefix50Step44ClaimedDirectoryIdentity,
  requireRealBuildPrefix50Step44ExactWithheldTree,
} from "./real-build-prefix50-subbuild-return-review-blind-filesystem.ts";
import {
  requireRealBuildPrefix50Step44BlindPublicSuccessForPacket,
  requireRealBuildPrefix50Step44PublicationCompleteForPacket,
} from "./real-build-prefix50-subbuild-return-review-blind-io.ts";
import { requireRealBuildPrefix50Step44BlindReviewPacket } from "./real-build-prefix50-subbuild-return-review-blind-packet.ts";
import {
  requireRealBuildPrefix50Step44PublicationComplete,
  type RealBuildPrefix50Step44PublicationComplete,
} from "./real-build-prefix50-subbuild-return-review-blind-publication-complete.ts";
import { requireRealBuildPrefix50Step44PersistedUnblindingMap } from "./real-build-prefix50-subbuild-return-review-blind-unblinding.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import {
  verifyRealBuildPrefix50Step44ContactSheetSources,
  type RealBuildPrefix50Step44BatchCaptureRow,
} from "./real-build-prefix50-subbuild-return-review-contact-sheet-source.ts";
import { requireRealBuildPrefix50Step44VerifiedPersistedCameraAttempt } from "./real-build-prefix50-subbuild-return-review-camera-attempt-persistence.ts";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";

const MAXIMUM_JSON_BYTES = 8 * 1024 * 1024;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const SEED = /^[0-9a-f]{64}$/u;
const verifiedProductionChains = new WeakSet<object>();

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
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

function readCanonical<T>(root: string, file: string, label: string) {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(root, file, MAXIMUM_JSON_BYTES, label);
  const text = Buffer.from(bytes).toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (canonicalStringify(value) !== text) throw new TypeError(`${label} is not canonical JSON.`);
  return { bytes, value: value as T };
}

const CAPTURE_KEYS = [
  "artifactDirectory",
  "batchIndex",
  "blindId",
  "cameraCommitments",
  "candidateKey",
  "captureManifestByteDigest",
  "captureManifestCommitment",
  "captureManifestFile",
  "captureRows",
  "captureSceneCommitment",
  "compactCandidateCommitment",
  "fixedCameraAfterCommitment",
  "fixedCameraBaselineArtifactCommitment",
  "fixedCameraBaselineCommitment",
  "fixedCameraDeltaArtifactCommitment",
  "fixedCameraDeltaCommitment",
  "operationsCommitment",
  "page45CameraReceiptCommitment",
  "renderPacketCommitment",
  "reviewHarnessEnvelopeCommitment",
  "rosterIndex",
  "scene",
  "schemaVersion",
  "selectedDocumentCommitment",
  "selectedDocumentHash",
  "viewPacketCommitment",
] as const;

interface WithheldManifest {
  readonly schemaVersion: "lego.real-build-prefix50-step44-withheld-batch-capture/1";
  readonly authority: "none";
  readonly publicDuringReview: false;
  readonly sourceSetId: "6651557";
  readonly expectedHarnessInputBytesHash: `sha256:${string}`;
  readonly reviewBatchEnvelopeCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly candidateKeysCommitment: `sha256:${string}`;
  readonly dispatchPlanFile: string;
  readonly dispatchPlanByteDigest: `sha256:${string}`;
  readonly dispatchPlanCommitment: `sha256:${string}`;
  readonly captures: readonly RealBuildPrefix50Step44BatchCaptureRow[];
  readonly publicManifest: Readonly<{
    readonly artifactFile: string;
    readonly byteDigest: `sha256:${string}`;
    readonly commitment: `sha256:${string}`;
  }>;
  readonly publicPacketCoreCommitment: `sha256:${string}`;
  readonly publicPacketCommitment: `sha256:${string}`;
  readonly withheldUnblindingMapFile: string;
  readonly withheldUnblindingMapByteDigest: `sha256:${string}`;
  readonly withheldUnblindingMapCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44ProductionCaptureChainVerification {
  readonly schemaVersion: "lego.real-build-prefix50-step44-production-capture-chain/2";
  readonly sourceSetId: "6651557";
  readonly publicHarnessSuccessCommitment: `sha256:${string}`;
  readonly publicationCompleteCommitment: `sha256:${string}`;
  readonly withheldManifestByteDigest: `sha256:${string}`;
  readonly withheldManifestCommitment: `sha256:${string}`;
  readonly dispatchPlanCommitment: `sha256:${string}`;
  readonly withheldUnblindingMapCommitment: `sha256:${string}`;
  readonly captureManifestCount: 211;
  readonly captureManifestChainCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

function validatePlan(
  plan: RealBuildPrefix50Step44BlindDispatchPlan,
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
): void {
  exactKeys(
    plan,
    [
      "assignments",
      "authority",
      "blindingSeedHex",
      "candidateCount",
      "commitment",
      "reviewBatchEnvelopeCommitment",
      "schemaVersion",
    ],
    "Step-44 production dispatch plan",
  );
  for (const [index, assignment] of plan.assignments.entries()) {
    exactKeys(
      assignment,
      ["batchIndex", "blindId", "rankDigest"],
      `Step-44 production dispatch assignment ${index + 1}`,
    );
    if (
      assignment.blindId !== `B${String(index + 1).padStart(3, "0")}` ||
      !Number.isSafeInteger(assignment.batchIndex) ||
      assignment.batchIndex < 0 ||
      assignment.batchIndex >= 211 ||
      !SHA256.test(assignment.rankDigest)
    )
      throw new TypeError(`Step-44 production dispatch assignment ${index + 1} is invalid.`);
  }
  if (
    plan.schemaVersion !== "lego.real-build-prefix50-step44-blind-dispatch-plan/1" ||
    plan.authority !== "none" ||
    plan.reviewBatchEnvelopeCommitment !== batch.commitment ||
    plan.candidateCount !== 211 ||
    plan.assignments.length !== 211 ||
    new Set(plan.assignments.map(({ batchIndex }) => batchIndex)).size !== 211 ||
    !SEED.test(plan.blindingSeedHex) ||
    plan.commitment !== canonicalDigest(withoutCommitment(plan))
  )
    throw new TypeError("Step-44 production dispatch plan schema or batch binding drifted.");
}

export async function verifyRealBuildPrefix50Step44ProductionCaptureChain(input: {
  readonly publicRoot: string;
  readonly withheldRoot: string;
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly success: RealBuildPrefix50Step44BlindPublicHarnessSuccess;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly map: RealBuildPrefix50Step44WithheldUnblindingMap;
  readonly publicationComplete: RealBuildPrefix50Step44PublicationComplete;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}): Promise<RealBuildPrefix50Step44ProductionCaptureChainVerification> {
  requireRealBuildPrefix50Step44PublicationComplete(input.publicationComplete);
  requireRealBuildPrefix50Step44BlindReviewPacket(input.packet);
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.batch);
  requireRealBuildPrefix50Step44PersistedUnblindingMap({
    map: input.map,
    publicationComplete: input.publicationComplete,
    batch,
    withheldRoot: input.withheldRoot,
  });
  const success = requireRealBuildPrefix50Step44BlindPublicSuccessForPacket(input.packet);
  const completed = requireRealBuildPrefix50Step44PublicationCompleteForPacket(input.packet);
  if (
    canonicalStringify(success) !== canonicalStringify(input.success) ||
    completed !== input.publicationComplete ||
    completed.commitment !== input.publicationComplete.commitment
  )
    throw new TypeError(
      "Step-44 production success/COMPLETE is not the packet's exact completed-run receipt.",
    );
  for (const [key, path] of [
    ["run", input.publicationComplete.publicationDirectories.run.lexicalPath],
    ["public", input.publicRoot],
    ["withheld", input.withheldRoot],
  ] as const)
    requireRealBuildPrefix50Step44ClaimedDirectoryIdentity(
      input.publicationComplete.publicationDirectories[key],
      path,
      `Step-44 production ${key} root`,
    );
  const manifestRead = readCanonical<WithheldManifest>(
    input.withheldRoot,
    input.success.withheldManifestFile,
    "Step-44 production withheld capture manifest",
  );
  const manifest = manifestRead.value;
  exactKeys(
    manifest,
    [
      "authority",
      "candidateKeysCommitment",
      "candidateRosterCommitment",
      "captures",
      "commitment",
      "dispatchPlanByteDigest",
      "dispatchPlanCommitment",
      "dispatchPlanFile",
      "expectedHarnessInputBytesHash",
      "publicDuringReview",
      "publicManifest",
      "publicPacketCommitment",
      "publicPacketCoreCommitment",
      "reviewBatchEnvelopeCommitment",
      "schemaVersion",
      "sourceSetId",
      "withheldUnblindingMapByteDigest",
      "withheldUnblindingMapCommitment",
      "withheldUnblindingMapFile",
    ],
    "Step-44 production withheld capture manifest",
  );
  exactKeys(
    manifest.publicManifest,
    ["artifactFile", "byteDigest", "commitment"],
    "Step-44 withheld public-manifest receipt",
  );
  if (
    manifest.schemaVersion !== "lego.real-build-prefix50-step44-withheld-batch-capture/1" ||
    manifest.authority !== "none" ||
    manifest.publicDuringReview !== false ||
    manifest.sourceSetId !== "6651557" ||
    manifest.expectedHarnessInputBytesHash !==
      input.publicationComplete.expectedHarnessInputBytesHash ||
    manifest.reviewBatchEnvelopeCommitment !== batch.commitment ||
    manifest.candidateRosterCommitment !== batch.candidateRosterCommitment ||
    manifest.candidateKeysCommitment !== batch.candidateKeysCommitment ||
    manifest.publicPacketCommitment !== input.packet.commitment ||
    manifest.publicPacketCoreCommitment !== input.packet.publicPacketCoreCommitment ||
    manifest.publicManifest.artifactFile !== input.success.publicManifestFile ||
    manifest.publicManifest.byteDigest !== input.success.publicManifestByteDigest ||
    manifest.publicManifest.commitment !== input.success.publicManifestCommitment ||
    sha256(manifestRead.bytes) !== input.success.withheldManifestByteDigest ||
    manifest.commitment !== input.success.withheldManifestCommitment ||
    manifest.commitment !== input.publicationComplete.withheldManifestCommitment ||
    manifest.commitment !== canonicalDigest(withoutCommitment(manifest)) ||
    manifest.captures.length !== 211
  )
    throw new TypeError("Step-44 production withheld 211-capture manifest drifted.");
  const planRead = readCanonical<RealBuildPrefix50Step44BlindDispatchPlan>(
    input.withheldRoot,
    manifest.dispatchPlanFile,
    "Step-44 production dispatch plan",
  );
  if (
    manifest.dispatchPlanFile !== "real-build-prefix50-step44-blind-dispatch-plan.json" ||
    sha256(planRead.bytes) !== manifest.dispatchPlanByteDigest ||
    planRead.value.commitment !== manifest.dispatchPlanCommitment ||
    input.map.dispatchPlanCommitment !== manifest.dispatchPlanCommitment
  )
    throw new TypeError("Step-44 production dispatch-plan receipt drifted.");
  validatePlan(planRead.value, batch);
  requireRealBuildPrefix50Step44BlindDispatchPlan(planRead.value, batch);
  const captures = manifest.captures.map((capture, index) => {
    exactKeys(capture, CAPTURE_KEYS, `Step-44 production capture summary ${index + 1}`);
    if (
      capture.schemaVersion !== "lego.real-build-prefix50-step44-candidate-capture-summary/3" ||
      capture.scene !== "model-only"
    )
      throw new TypeError(`Step-44 production capture summary ${index + 1} drifted.`);
    return capture;
  });
  const verifiedSources = await verifyRealBuildPrefix50Step44ContactSheetSources({
    outputPath: input.withheldRoot,
    batch,
    plan: planRead.value,
    captures,
    expectedInputBytesHash: manifest.expectedHarnessInputBytesHash,
    realDomainQualification: input.realDomainQualification,
    page45Reference: input.packet.reference,
  });
  const persistedCameraAttempt = requireRealBuildPrefix50Step44VerifiedPersistedCameraAttempt({
    proof: verifiedSources.verifiedCameraAttempt,
    outputPath: input.withheldRoot,
    reviewBatchEnvelopeCommitment: batch.commitment,
    cameraReceiptCommitment: verifiedSources.verifiedCameraAttempt.cameraReceiptCommitment,
    searchAttemptCommitment: verifiedSources.verifiedCameraAttempt.searchAttemptCommitment,
  });
  requireRealBuildPrefix50Step44ExactWithheldTree({
    withheldRoot: input.withheldRoot,
    captures,
    cameraAttemptArtifactFiles: persistedCameraAttempt.actualRenderArtifactFiles,
  });
  const verified = verifiedSources.rows;
  const publicRows = input.packet.pages.flatMap(({ rows }) => rows);
  for (const [index, row] of verified.entries()) {
    const { sourceRowCommitment, ...summary } = row.binding;
    if (
      canonicalStringify(summary) !== canonicalStringify(captures[index]) ||
      sourceRowCommitment !== input.map.rows[index]?.sourceRowCommitment ||
      canonicalStringify(row.cells) !== canonicalStringify(publicRows[index]?.cells) ||
      canonicalStringify(row.fixedCameraEvidence) !==
        canonicalStringify(publicRows[index]?.fixedCameraEvidence)
    )
      throw new TypeError(`Step-44 production public/withheld source row ${index + 1} drifted.`);
  }
  const expectedMap = createRealBuildPrefix50Step44WithheldUnblindingMap({
    batch,
    plan: planRead.value,
    captures: verified.map(({ binding }) => binding),
    publicPacketCoreCommitment: input.packet.publicPacketCoreCommitment,
  });
  const mapRead = readCanonical<RealBuildPrefix50Step44WithheldUnblindingMap>(
    input.withheldRoot,
    manifest.withheldUnblindingMapFile,
    "Step-44 production withheld map chain",
  );
  if (
    manifest.withheldUnblindingMapFile !== "real-build-prefix50-step44-unblinding-map.json" ||
    sha256(mapRead.bytes) !== manifest.withheldUnblindingMapByteDigest ||
    manifest.withheldUnblindingMapCommitment !== input.map.commitment ||
    canonicalStringify(expectedMap) !== canonicalStringify(mapRead.value) ||
    canonicalStringify(mapRead.value) !== canonicalStringify(input.map)
  )
    throw new TypeError("Step-44 production withheld map formulas or bytes drifted.");
  const chainRows = verified.map(({ binding, cells, fixedCameraEvidence }) => ({
    binding,
    cellCommitments: cells.map(({ commitment }) => commitment),
    fixedCameraEvidenceCommitment: fixedCameraEvidence.commitment,
  }));
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-production-capture-chain/2" as const,
    sourceSetId: "6651557" as const,
    publicHarnessSuccessCommitment: input.success.commitment,
    publicationCompleteCommitment: input.publicationComplete.commitment,
    withheldManifestByteDigest: input.success.withheldManifestByteDigest,
    withheldManifestCommitment: input.success.withheldManifestCommitment,
    dispatchPlanCommitment: planRead.value.commitment,
    withheldUnblindingMapCommitment: input.map.commitment,
    captureManifestCount: 211 as const,
    captureManifestChainCommitment: canonicalDigest(chainRows),
  };
  const result = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  verifiedProductionChains.add(result);
  return result;
}

export function requireRealBuildPrefix50Step44ProductionCaptureChain(
  value: RealBuildPrefix50Step44ProductionCaptureChainVerification,
): void {
  if (!verifiedProductionChains.has(value))
    throw new TypeError(
      "Step-44 promotion requires a runtime-branded exact production capture-manifest chain.",
    );
}
