import { createHash } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type { RealBuildPrefix50Step44BlindPublicHarnessSuccess } from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE } from "./real-build-prefix50-subbuild-return-review-transaction.ts";
import type { RealBuildPrefix50Step44PublicationDirectories } from "./real-build-prefix50-subbuild-return-review-transaction.ts";

export { REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE };

const PUBLIC_MANIFEST_FILE = "real-build-prefix50-step44-public-batch-manifest.json" as const;
const WITHHELD_MANIFEST_FILE =
  "real-build-prefix50-step44-withheld-batch-capture-manifest.json" as const;
const PUBLIC_SUCCESS_FILE = "real-build-prefix50-step44-public-harness-success.json" as const;
const MAXIMUM_JSON_BYTES = 8 * 1024 * 1024;
const publicationCompleteReads = new WeakSet<object>();

interface CommittedArtifact {
  readonly commitment: `sha256:${string}`;
  readonly expectedHarnessInputBytesHash?: `sha256:${string}`;
  readonly reviewBatchEnvelopeCommitment?: `sha256:${string}`;
  readonly candidateRosterCommitment?: `sha256:${string}`;
  readonly candidateKeysCommitment?: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44PublicationComplete {
  readonly schemaVersion: "lego.real-build-prefix50-step44-publication-complete/2";
  readonly authority: "none";
  readonly status: "complete";
  readonly selectionAuthority: false;
  readonly fixturePromotionAuthority: false;
  readonly sourceSetId: "6651557";
  readonly sourcePdfArtifactPath: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH;
  readonly sourcePdfDigest: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST;
  readonly page45SourcePolicyCommitment: `sha256:${string}`;
  readonly expectedHarnessInputBytesHash: `sha256:${string}`;
  readonly reviewBatchEnvelopeCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly candidateKeysCommitment: `sha256:${string}`;
  readonly candidateCount: 211;
  readonly capturedCandidateCount: 211;
  readonly publicDirectory: "public";
  readonly withheldDirectory: "withheld";
  readonly publicationDirectories: RealBuildPrefix50Step44PublicationDirectories;
  readonly publicManifestFile: typeof PUBLIC_MANIFEST_FILE;
  readonly publicManifestByteDigest: `sha256:${string}`;
  readonly publicManifestCommitment: `sha256:${string}`;
  readonly withheldManifestFile: typeof WITHHELD_MANIFEST_FILE;
  readonly withheldManifestByteDigest: `sha256:${string}`;
  readonly withheldManifestCommitment: `sha256:${string}`;
  readonly publicSuccessFile: typeof PUBLIC_SUCCESS_FILE;
  readonly publicSuccessByteDigest: `sha256:${string}`;
  readonly publicSuccessCommitment: `sha256:${string}`;
  readonly cleanup: Readonly<{
    readonly browserClosed: true;
    readonly browserProcessTreeClosed: true;
    readonly serverClosed: true;
  }>;
  readonly commitment: `sha256:${string}`;
}

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

function readCanonical<T>(
  root: string,
  file: string,
  label: string,
): {
  readonly bytes: Uint8Array;
  readonly value: T;
} {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(root, file, MAXIMUM_JSON_BYTES, label);
  const text = Buffer.from(bytes).toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (canonicalStringify(value) !== text) throw new TypeError(`${label} is not canonical JSON.`);
  return { bytes, value: value as T };
}

function requirePublicationLayout(input: {
  readonly reviewRoot: string;
  readonly publicRoot: string;
  readonly withheldRoot: string;
}): void {
  const reviewRoot = realpathSync(resolve(input.reviewRoot));
  const publicRoot = realpathSync(resolve(input.publicRoot));
  const withheldRoot = realpathSync(resolve(input.withheldRoot));
  if (
    dirname(publicRoot) !== reviewRoot ||
    basename(publicRoot) !== "public" ||
    dirname(withheldRoot) !== reviewRoot ||
    basename(withheldRoot) !== "withheld" ||
    publicRoot === withheldRoot
  )
    throw new TypeError(
      "Step-44 COMPLETE receipt requires its exact mkdir-claimed review root with public/ and withheld/ siblings.",
    );
}

function requireDirectoryIdentity(
  identity: RealBuildPrefix50Step44PublicationDirectories[keyof RealBuildPrefix50Step44PublicationDirectories],
  expectedPath: string,
  label: string,
): void {
  exactKeys(identity, ["device", "inode", "lexicalPath", "realPath"], label);
  const lexicalPath = resolve(expectedPath);
  const before = lstatSync(lexicalPath, { bigint: true });
  const realPath = realpathSync(lexicalPath);
  const after = lstatSync(lexicalPath, { bigint: true });
  if (
    identity.lexicalPath !== lexicalPath ||
    identity.realPath !== lexicalPath ||
    realPath !== lexicalPath ||
    !/^[0-9]+$/u.test(identity.device) ||
    !/^[0-9]+$/u.test(identity.inode) ||
    !before.isDirectory() ||
    before.isSymbolicLink() ||
    !after.isDirectory() ||
    after.isSymbolicLink() ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    identity.device !== before.dev.toString(10) ||
    identity.inode !== before.ino.toString(10)
  )
    throw new TypeError(`${label} changed identity or is a link/alias.`);
}

export function readRealBuildPrefix50Step44PublicationComplete(input: {
  readonly reviewRoot: string;
  readonly publicRoot: string;
  readonly withheldRoot: string;
  readonly success: RealBuildPrefix50Step44BlindPublicHarnessSuccess;
  readonly batch?: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
}): RealBuildPrefix50Step44PublicationComplete {
  requirePublicationLayout(input);
  const markerRead = readCanonical<RealBuildPrefix50Step44PublicationComplete>(
    input.reviewRoot,
    REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE,
    "Step-44 root publication COMPLETE receipt",
  );
  const marker = markerRead.value;
  exactKeys(
    marker,
    [
      "authority",
      "candidateCount",
      "candidateKeysCommitment",
      "candidateRosterCommitment",
      "capturedCandidateCount",
      "cleanup",
      "commitment",
      "expectedHarnessInputBytesHash",
      "fixturePromotionAuthority",
      "page45SourcePolicyCommitment",
      "publicDirectory",
      "publicationDirectories",
      "publicManifestByteDigest",
      "publicManifestCommitment",
      "publicManifestFile",
      "publicSuccessByteDigest",
      "publicSuccessCommitment",
      "publicSuccessFile",
      "reviewBatchEnvelopeCommitment",
      "schemaVersion",
      "selectionAuthority",
      "sourcePdfArtifactPath",
      "sourcePdfDigest",
      "sourceSetId",
      "status",
      "withheldDirectory",
      "withheldManifestByteDigest",
      "withheldManifestCommitment",
      "withheldManifestFile",
    ],
    "Step-44 root publication COMPLETE receipt",
  );
  exactKeys(
    marker.cleanup,
    ["browserClosed", "browserProcessTreeClosed", "serverClosed"],
    "Step-44 root publication COMPLETE cleanup",
  );
  exactKeys(
    marker.publicationDirectories,
    ["public", "run", "withheld"],
    "Step-44 root publication COMPLETE directories",
  );
  requireDirectoryIdentity(
    marker.publicationDirectories.run,
    input.reviewRoot,
    "Step-44 COMPLETE run directory",
  );
  requireDirectoryIdentity(
    marker.publicationDirectories.public,
    input.publicRoot,
    "Step-44 COMPLETE public directory",
  );
  requireDirectoryIdentity(
    marker.publicationDirectories.withheld,
    input.withheldRoot,
    "Step-44 COMPLETE withheld directory",
  );
  const publicManifestRead = readCanonical<CommittedArtifact>(
    input.publicRoot,
    marker.publicManifestFile,
    "Step-44 COMPLETE-bound public manifest",
  );
  const withheldManifestRead = readCanonical<CommittedArtifact>(
    input.withheldRoot,
    marker.withheldManifestFile,
    "Step-44 COMPLETE-bound withheld manifest",
  );
  const publicSuccessRead = readCanonical<RealBuildPrefix50Step44BlindPublicHarnessSuccess>(
    input.publicRoot,
    marker.publicSuccessFile,
    "Step-44 COMPLETE-bound public success",
  );
  if (
    marker.schemaVersion !== "lego.real-build-prefix50-step44-publication-complete/2" ||
    marker.authority !== "none" ||
    marker.status !== "complete" ||
    marker.selectionAuthority !== false ||
    marker.fixturePromotionAuthority !== false ||
    marker.sourceSetId !== "6651557" ||
    marker.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    marker.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    marker.page45SourcePolicyCommitment !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT ||
    !/^sha256:[0-9a-f]{64}$/u.test(marker.expectedHarnessInputBytesHash) ||
    marker.candidateCount !== 211 ||
    marker.capturedCandidateCount !== 211 ||
    marker.publicDirectory !== "public" ||
    marker.withheldDirectory !== "withheld" ||
    marker.publicManifestFile !== PUBLIC_MANIFEST_FILE ||
    marker.withheldManifestFile !== WITHHELD_MANIFEST_FILE ||
    marker.publicSuccessFile !== PUBLIC_SUCCESS_FILE ||
    marker.cleanup.browserClosed !== true ||
    marker.cleanup.browserProcessTreeClosed !== true ||
    marker.cleanup.serverClosed !== true ||
    marker.commitment !== canonicalDigest(withoutCommitment(marker)) ||
    marker.publicManifestByteDigest !== sha256(publicManifestRead.bytes) ||
    marker.publicManifestCommitment !== publicManifestRead.value.commitment ||
    marker.withheldManifestByteDigest !== sha256(withheldManifestRead.bytes) ||
    marker.withheldManifestCommitment !== withheldManifestRead.value.commitment ||
    marker.publicSuccessByteDigest !== sha256(publicSuccessRead.bytes) ||
    marker.publicSuccessCommitment !== publicSuccessRead.value.commitment ||
    canonicalStringify(publicSuccessRead.value) !== canonicalStringify(input.success) ||
    marker.publicManifestByteDigest !== input.success.publicManifestByteDigest ||
    marker.publicManifestCommitment !== input.success.publicManifestCommitment ||
    marker.withheldManifestByteDigest !== input.success.withheldManifestByteDigest ||
    marker.withheldManifestCommitment !== input.success.withheldManifestCommitment ||
    marker.publicSuccessCommitment !== input.success.commitment ||
    marker.expectedHarnessInputBytesHash !==
      withheldManifestRead.value.expectedHarnessInputBytesHash ||
    marker.reviewBatchEnvelopeCommitment !==
      withheldManifestRead.value.reviewBatchEnvelopeCommitment ||
    marker.candidateRosterCommitment !== withheldManifestRead.value.candidateRosterCommitment ||
    marker.candidateKeysCommitment !== withheldManifestRead.value.candidateKeysCommitment ||
    (input.batch !== undefined &&
      (marker.reviewBatchEnvelopeCommitment !== input.batch.commitment ||
        marker.candidateRosterCommitment !== input.batch.candidateRosterCommitment ||
        marker.candidateKeysCommitment !== input.batch.candidateKeysCommitment))
  )
    throw new TypeError(
      "Step-44 promotion requires the exact root COMPLETE receipt binding public success and both production manifests.",
    );
  const frozen = deepFreeze(marker);
  publicationCompleteReads.add(frozen);
  return frozen;
}

export function requireRealBuildPrefix50Step44PublicationComplete(
  value: RealBuildPrefix50Step44PublicationComplete,
): void {
  if (!publicationCompleteReads.has(value))
    throw new TypeError("Step-44 promotion requires a runtime-branded root COMPLETE receipt read.");
}
