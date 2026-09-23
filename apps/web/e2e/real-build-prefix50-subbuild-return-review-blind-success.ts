import { createHash } from "node:crypto";
import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type {
  RealBuildPrefix50Step44BlindPublicHarnessSuccess,
  RealBuildPrefix50Step44BlindPublicManifest,
  RealBuildPrefix50Step44BlindReviewPacket,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";

export const REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE =
  "real-build-prefix50-step44-public-batch-manifest.json" as const;
export const REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE =
  "real-build-prefix50-step44-public-harness-success.json" as const;
const MAXIMUM_JSON_BYTES = 8 * 1024 * 1024;

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function parseCanonical<T>(bytes: Uint8Array, label: string): T {
  const text = Buffer.from(bytes).toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (canonicalStringify(value) !== text) throw new TypeError(`${label} is not canonical JSON.`);
  return value as T;
}

export function readRealBuildPrefix50Step44BlindPublicHarnessSuccess(input: {
  readonly publicRoot: string;
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly packetArtifactFile: string;
}): RealBuildPrefix50Step44BlindPublicHarnessSuccess {
  if (input.packetArtifactFile !== "real-build-prefix50-step44-blind-review-packet.json")
    throw new TypeError("Step-44 public success accepts only the canonical packet filename.");
  const packetBytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.publicRoot,
    input.packetArtifactFile,
    MAXIMUM_JSON_BYTES,
    "Step-44 success-bound blind packet",
  );
  const manifestBytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.publicRoot,
    REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE,
    MAXIMUM_JSON_BYTES,
    "Step-44 blind public manifest",
  );
  const manifest = parseCanonical<RealBuildPrefix50Step44BlindPublicManifest>(
    manifestBytes,
    "Step-44 blind public manifest",
  );
  exactKeys(
    manifest,
    [
      "authority",
      "blindIds",
      "blindReviewPacketByteDigest",
      "blindReviewPacketCommitment",
      "blindReviewPacketFile",
      "candidateCount",
      "commitment",
      "contactSheetPageCommitments",
      "fixturePromotionAuthority",
      "page45SourcePolicyCommitment",
      "referenceArtifactFile",
      "referenceCommitment",
      "reviewIsolationInstructionDigest",
      "reviewIsolationInstructionFile",
      "schemaVersion",
      "selectionAuthority",
      "sourcePdfArtifactPath",
      "sourcePdfDigest",
      "sourceSetId",
      "withheldUnblindingMapCommitment",
    ],
    "Step-44 blind public manifest",
  );
  if (
    manifest.schemaVersion !== "lego.real-build-prefix50-step44-public-blind-batch/1" ||
    manifest.authority !== "none" ||
    manifest.selectionAuthority !== false ||
    manifest.fixturePromotionAuthority !== false ||
    manifest.sourceSetId !== "6651557" ||
    manifest.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    manifest.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    manifest.page45SourcePolicyCommitment !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT ||
    manifest.candidateCount !== 211 ||
    manifest.blindIds.length !== input.packet.blindIds.length ||
    manifest.blindIds.some((id, index) => id !== input.packet.blindIds[index]) ||
    manifest.reviewIsolationInstructionFile !== input.packet.reviewIsolationInstructionFile ||
    manifest.reviewIsolationInstructionDigest !== input.packet.reviewIsolationInstructionDigest ||
    manifest.referenceArtifactFile !== input.packet.reference.artifactFile ||
    manifest.referenceCommitment !== input.packet.reference.commitment ||
    manifest.blindReviewPacketFile !== input.packetArtifactFile ||
    manifest.blindReviewPacketByteDigest !== sha256(packetBytes) ||
    manifest.blindReviewPacketCommitment !== input.packet.commitment ||
    manifest.withheldUnblindingMapCommitment !== input.packet.withheldUnblindingMapCommitment ||
    manifest.contactSheetPageCommitments.length !== input.packet.pages.length ||
    manifest.contactSheetPageCommitments.some(
      (commitment, index) => commitment !== input.packet.pages[index]!.commitment,
    ) ||
    manifest.commitment !== canonicalDigest(withoutCommitment(manifest))
  )
    throw new TypeError("Step-44 blind public manifest drifted from its exact public packet.");
  const successBytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.publicRoot,
    REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE,
    MAXIMUM_JSON_BYTES,
    "Step-44 blind public harness success",
  );
  const success = parseCanonical<RealBuildPrefix50Step44BlindPublicHarnessSuccess>(
    successBytes,
    "Step-44 blind public harness success",
  );
  exactKeys(
    success,
    [
      "authority",
      "blindReviewPacketByteDigest",
      "blindReviewPacketCommitment",
      "blindReviewPacketFile",
      "candidateCount",
      "capturedCandidateCount",
      "cleanup",
      "commitment",
      "fixturePromotionAuthority",
      "page45SourcePolicyCommitment",
      "publicManifestByteDigest",
      "publicManifestCommitment",
      "publicManifestFile",
      "schemaVersion",
      "selectionAuthority",
      "sourcePdfArtifactPath",
      "sourcePdfDigest",
      "sourceSetId",
      "status",
      "withheldManifestByteDigest",
      "withheldManifestCommitment",
      "withheldManifestFile",
    ],
    "Step-44 blind public harness success",
  );
  exactKeys(
    success.cleanup,
    ["browserClosed", "browserProcessTreeClosed", "serverClosed"],
    "Step-44 blind public harness success cleanup",
  );
  if (
    success.schemaVersion !== "lego.real-build-prefix50-step44-public-harness-success/1" ||
    success.authority !== "none" ||
    success.status !== "complete" ||
    success.selectionAuthority !== false ||
    success.fixturePromotionAuthority !== false ||
    success.sourceSetId !== "6651557" ||
    success.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    success.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    success.page45SourcePolicyCommitment !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT ||
    success.candidateCount !== 211 ||
    success.capturedCandidateCount !== 211 ||
    success.publicManifestFile !== REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE ||
    success.publicManifestByteDigest !== sha256(manifestBytes) ||
    success.publicManifestCommitment !== manifest.commitment ||
    success.withheldManifestFile !==
      "real-build-prefix50-step44-withheld-batch-capture-manifest.json" ||
    !/^sha256:[0-9a-f]{64}$/u.test(success.withheldManifestByteDigest) ||
    !/^sha256:[0-9a-f]{64}$/u.test(success.withheldManifestCommitment) ||
    success.blindReviewPacketFile !== input.packetArtifactFile ||
    success.blindReviewPacketByteDigest !== sha256(packetBytes) ||
    success.blindReviewPacketCommitment !== input.packet.commitment ||
    success.cleanup.browserClosed !== true ||
    success.cleanup.browserProcessTreeClosed !== true ||
    success.cleanup.serverClosed !== true ||
    success.commitment !== canonicalDigest(withoutCommitment(success))
  )
    throw new TypeError(
      "Step-44 public evidence lacks its exact post-cleanup 211-capture success receipt.",
    );
  return deepFreeze(success);
}
