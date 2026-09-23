import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { relative } from "node:path";

import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import { writeContainedRegularFileAtomic } from "./contained-atomic-write.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  verifyRealBuildPrefix50Step44CameraAttemptEvidence,
  type RealBuildPrefix50Step44CameraAttemptContext,
  type RealBuildPrefix50Step44PersistedCameraAttemptReceipt,
  type RealBuildPrefix50Step44VerifiedPersistedCameraAttempt,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt.ts";
import {
  verifyRealBuildPrefix50Step44CameraAttemptSemantics,
  type RealBuildPrefix50Step44DecodedCameraAttemptArtifact,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier.ts";
import {
  deriveRealBuildPrefix50Step44PersistedCameraSemanticContract,
  type RealBuildPrefix50Step44PersistedCameraSemanticSource,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-setup.ts";
import { REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import type { RealBuildPrefix50Step44CameraSearchAttemptEvidence } from "./real-build-prefix50-subbuild-return-review-camera-search.ts";
import {
  requireRealBuildPrefix50Step44RealDomainQualificationBinding,
  type RealBuildPrefix50Step44RealDomainQualificationBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";

const verifiedAttemptReceipts = new WeakMap<
  RealBuildPrefix50Step44VerifiedPersistedCameraAttempt,
  RealBuildPrefix50Step44PersistedCameraAttemptReceipt
>();

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

export function createRealBuildPrefix50Step44PersistedCameraAttemptReceipt(input: {
  readonly context: RealBuildPrefix50Step44CameraAttemptContext;
  readonly evidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence;
}): RealBuildPrefix50Step44PersistedCameraAttemptReceipt {
  const realDomainQualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.context.realDomainQualification,
  );
  if (
    realDomainQualification.reviewBatchEnvelopeCommitment !==
    input.context.reviewBatchEnvelopeCommitment
  )
    throw new TypeError(
      "Step-44 camera attempt persistence requires qualification of the context's exact review batch.",
    );
  const actualRenderArtifactFiles = verifyRealBuildPrefix50Step44CameraAttemptEvidence(
    input.evidence,
  );
  if (
    input.context.metricCalibrationCommitment !==
      REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT ||
    input.context.metricCalibrationCommitment !== input.evidence.attempt.metricCalibrationCommitment
  )
    throw new TypeError(
      "Step-44 camera attempt context must bind the exact fixed metric-v2 calibration commitment.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-persisted-camera-attempt/1" as const,
    authority: "none" as const,
    dataExclusionPolicy:
      "page45-and-shared-step43-parent-only-no-candidate-no-step45-no-page46" as const,
    context: deepFreeze({ ...input.context }),
    contextCommitment: canonicalDigest(input.context),
    searchAttemptCommitment: input.evidence.attempt.commitment,
    searchAttempt: input.evidence.attempt,
    actualRenderArtifactFiles,
    actualRenderArtifactsCommitment: canonicalDigest(
      actualRenderArtifactFiles.map((artifactFile) => ({
        artifactFile,
        pngDigest: sha256(input.evidence.renderArtifacts[artifactFile]!),
      })),
    ),
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export async function persistRealBuildPrefix50Step44CameraAttempt(input: {
  readonly outputPath: string;
  readonly context: RealBuildPrefix50Step44CameraAttemptContext;
  readonly evidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence;
}): Promise<RealBuildPrefix50Step44PersistedCameraAttemptReceipt> {
  const receipt = createRealBuildPrefix50Step44PersistedCameraAttemptReceipt(input);
  const [realRoot, realOutput] = await Promise.all([
    realpath(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT),
    realpath(input.outputPath),
  ]);
  const local = relative(realRoot, realOutput);
  if (local.length === 0 || local.startsWith(".."))
    throw new TypeError(
      "Step-44 camera attempt output must be a real child of its task output root.",
    );
  const outputIdentity = await lstat(realOutput, { bigint: true });
  const requireOutputIdentity = async () => {
    const current = await lstat(realOutput, { bigint: true });
    if (
      current.isSymbolicLink() ||
      !current.isDirectory() ||
      current.ino !== outputIdentity.ino ||
      (current.dev !== 0n && outputIdentity.dev !== 0n && current.dev !== outputIdentity.dev)
    )
      throw new TypeError("Step-44 camera attempt output identity changed during publication.");
  };
  for (const artifactFile of receipt.actualRenderArtifactFiles) {
    await requireOutputIdentity();
    writeContainedRegularFileAtomic(
      realOutput,
      artifactFile,
      input.evidence.renderArtifacts[artifactFile]!,
      { label: `Step-44 camera attempt render ${artifactFile}` },
    );
  }
  await requireOutputIdentity();
  writeContainedRegularFileAtomic(
    realOutput,
    "real-build-prefix50-step44-page45-camera-attempt.json",
    `${JSON.stringify(receipt, null, 2)}\n`,
    { label: "Step-44 camera attempt authority receipt" },
  );
  return receipt;
}

export function verifyPersistedRealBuildPrefix50Step44CameraAttempt(input: {
  readonly outputPath: string;
  readonly expectedSearchAttemptCommitment: Sha256Digest;
  readonly expectedCameraReceiptCommitment: Sha256Digest | null;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly source: RealBuildPrefix50Step44PersistedCameraSemanticSource;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}): RealBuildPrefix50Step44VerifiedPersistedCameraAttempt {
  const artifactFile = "real-build-prefix50-step44-page45-camera-attempt.json";
  const receipt = JSON.parse(
    readRealBuildPrefix50Step44ReviewArtifact(
      input.outputPath,
      artifactFile,
      64 * 1024 * 1024,
      "Step-44 persisted camera attempt receipt",
    ).toString("utf8"),
  ) as RealBuildPrefix50Step44PersistedCameraAttemptReceipt;
  exactKeys(
    receipt,
    [
      "actualRenderArtifactFiles",
      "actualRenderArtifactsCommitment",
      "authority",
      "commitment",
      "context",
      "contextCommitment",
      "dataExclusionPolicy",
      "schemaVersion",
      "searchAttempt",
      "searchAttemptCommitment",
    ],
    "Persisted Step-44 camera attempt receipt",
  );
  exactKeys(
    receipt.context,
    [
      "candidateRosterCommitment",
      "expectedPanelFace",
      "metricCalibrationCommitment",
      "panelCropCommitment",
      "panelFacePrefixEvidenceCommitment",
      "parentOnlyRegionCommitment",
      "realDomainQualification",
      "returnResultCommitment",
      "reviewBatchEnvelopeCommitment",
      "semanticColorPolicyCommitment",
      "sharedParentDocumentCommitment",
      "sharedParentDocumentHash",
      "sourceDocumentHash",
      "sourcePageRasterCommitment",
      "sourcePdfDigest",
    ],
    "Persisted Step-44 camera attempt context",
  );
  exactKeys(
    receipt.context.realDomainQualification,
    [
      "calibrationReceiptCommitment",
      "calibrationSessionCommitment",
      "commitment",
      "heldOutReceiptCommitment",
      "persistedManifestCommitment",
      "qualificationOutputRealPathCommitment",
      "qualificationProofCommitment",
      "reviewBatchEnvelopeCommitment",
      "schemaVersion",
      "sourceLockCommitment",
    ],
    "Persisted Step-44 real-domain qualification binding",
  );
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step44-persisted-camera-attempt/1" ||
    receipt.authority !== "none" ||
    receipt.dataExclusionPolicy !==
      "page45-and-shared-step43-parent-only-no-candidate-no-step45-no-page46" ||
    receipt.commitment !== canonicalDigest(withoutCommitment(receipt)) ||
    receipt.contextCommitment !== canonicalDigest(receipt.context) ||
    receipt.context.metricCalibrationCommitment !==
      REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT ||
    receipt.context.metricCalibrationCommitment !==
      receipt.searchAttempt.metricCalibrationCommitment ||
    receipt.context.realDomainQualification.schemaVersion !==
      "lego.real-build-prefix50-step44-real-domain-qualification-binding/1" ||
    receipt.context.realDomainQualification.commitment !==
      canonicalDigest(withoutCommitment(receipt.context.realDomainQualification)) ||
    (receipt.searchAttempt.status === "refused") !==
      (input.expectedCameraReceiptCommitment === null) ||
    receipt.searchAttemptCommitment !== input.expectedSearchAttemptCommitment ||
    receipt.searchAttemptCommitment !== receipt.searchAttempt.commitment ||
    receipt.actualRenderArtifactsCommitment !==
      canonicalDigest(
        receipt.actualRenderArtifactFiles.map((file) => ({
          artifactFile: file,
          pngDigest: sha256(
            readRealBuildPrefix50Step44ReviewArtifact(
              input.outputPath,
              file,
              16 * 1024 * 1024,
              `Step-44 persisted camera render ${file}`,
            ),
          ),
        })),
      )
  )
    throw new TypeError(
      "Persisted Step-44 camera attempt receipt, context, or actual-render commitment drifted.",
    );
  const renderArtifacts: Record<string, Uint8Array> = {};
  const decodedArtifacts: Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact> = {};
  for (const file of receipt.actualRenderArtifactFiles) {
    const bytes = readRealBuildPrefix50Step44ReviewArtifact(
      input.outputPath,
      file,
      16 * 1024 * 1024,
      `Step-44 persisted camera render ${file}`,
    );
    const decoded = decodeRealBuildPrefix50Step44ReviewPng(
      bytes,
      720 * 470,
      `Step-44 persisted camera render ${file}`,
    );
    renderArtifacts[file] = bytes;
    decodedArtifacts[file] = { pngBytes: bytes, rgba: decoded.rgba };
  }
  verifyRealBuildPrefix50Step44CameraAttemptEvidence({
    attempt: receipt.searchAttempt,
    renderArtifacts,
  });
  const contract = deriveRealBuildPrefix50Step44PersistedCameraSemanticContract({
    reviewBatch: input.reviewBatch,
    source: input.source,
    realDomainQualification: requireRealBuildPrefix50Step44RealDomainQualificationBinding(
      input.realDomainQualification,
    ),
  });
  if (canonicalDigest(receipt.context) !== canonicalDigest(contract.context))
    throw new TypeError(
      "Persisted Step-44 camera attempt context did not reproduce from the exact batch, shared parent, and page-45 source commitments.",
    );
  verifyRealBuildPrefix50Step44CameraAttemptSemantics({
    attempt: receipt.searchAttempt,
    artifacts: decodedArtifacts,
    contract,
  });
  const verifiedReceipt = deepFreeze(receipt);
  const proofBody = {
    schemaVersion: "lego.real-build-prefix50-step44-verified-persisted-camera-attempt/1" as const,
    authority: "none" as const,
    outputRealPathCommitment: canonicalDigest({ realPath: realpathSync(input.outputPath) }),
    reviewBatchEnvelopeCommitment: input.reviewBatch.commitment,
    cameraReceiptCommitment: input.expectedCameraReceiptCommitment,
    searchAttemptCommitment: receipt.searchAttemptCommitment,
    contextCommitment: receipt.contextCommitment,
  };
  const proof = Object.freeze({ ...proofBody, commitment: canonicalDigest(proofBody) });
  verifiedAttemptReceipts.set(proof, verifiedReceipt);
  return proof;
}

export function requireRealBuildPrefix50Step44VerifiedPersistedCameraAttempt(input: {
  readonly proof: RealBuildPrefix50Step44VerifiedPersistedCameraAttempt;
  readonly outputPath: string;
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly cameraReceiptCommitment: Sha256Digest | null;
  readonly searchAttemptCommitment: Sha256Digest;
}): RealBuildPrefix50Step44PersistedCameraAttemptReceipt {
  const receipt = verifiedAttemptReceipts.get(input.proof);
  const expectedBody = {
    schemaVersion: "lego.real-build-prefix50-step44-verified-persisted-camera-attempt/1" as const,
    authority: "none" as const,
    outputRealPathCommitment: canonicalDigest({ realPath: realpathSync(input.outputPath) }),
    reviewBatchEnvelopeCommitment: input.reviewBatchEnvelopeCommitment,
    cameraReceiptCommitment: input.cameraReceiptCommitment,
    searchAttemptCommitment: input.searchAttemptCommitment,
    contextCommitment: input.proof.contextCommitment,
  };
  if (
    receipt === undefined ||
    input.proof.commitment !== canonicalDigest(expectedBody) ||
    receipt.contextCommitment !== input.proof.contextCommitment
  )
    throw new TypeError(
      "Step-44 candidate camera binding requires the exact runtime-branded shared persisted-camera verification proof.",
    );
  return receipt;
}
