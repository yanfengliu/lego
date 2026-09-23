import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";
import { resolve } from "node:path";

import { readContainedBoundedRegularFile } from "./bounded-file-read.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-poppler-toolchain.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
  requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  type RealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  type RealBuildPrefix50Step44CameraOnlySourceLockEvidence,
} from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "./real-build-prefix50-step44-panel-face-prefix.ts";
import type {
  RealBuildPrefix50Step44RealDomainCalibrationReceipt,
  RealBuildPrefix50Step44RealDomainHeldOutReceipt,
  RealBuildPrefix50Step44RealDomainObservation,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import { requireRealBuildPrefix50Step44RealDomainOutputChild } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-evidence.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { realBuildPrefix50SubBuildReturnBrands } from "./real-build-prefix50-subbuild-return-brands.ts";
import type {
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import type {
  PersistedGateManifest,
  RealBuildPrefix50Step44VerifiedRealDomainQualification,
  RealBuildPrefix50Step44RealDomainQualificationBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { withStableRealBuildPrefix50Step44RealDomainGateOutputTree } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-tree.ts";
import { verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-case.ts";
import { prepareRealBuildPrefix50Step44RealDomainPredecessorSequence } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import { assertRealBuildPrefix50Step44RealDomainBatch } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts";
import { REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-preregistration.ts";
import { reproduceRealBuildPrefix50Step42SourceGeometryAuthority } from "./real-build-prefix50-step42-source-geometry-reproduction.ts";
import {
  consumeRealBuildPrefix50Step44CalibrationSessionForHeldOut,
  requireRealBuildPrefix50Step44RealDomainCalibrationSession,
  requireRealBuildPrefix50Step44RealDomainHeldOutPair,
  replayPersistedRealBuildPrefix50Step44RealDomainCalibrationSession,
  type RealBuildPrefix50Step44RealDomainCalibrationSession,
  type RealBuildPrefix50Step44RealDomainHeldOutPair,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";
import { prepareRealBuildPrefix50Step44RealDomainSourceSequence } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import {
  prospectiveRealBuildPrefix50Step44CalibrationFinalPath,
  type RealBuildPrefix50Step44CalibrationDirectoryTransaction,
} from "./real-build-prefix50-step44-calibration-directory-transaction.ts";

const GATE_MANIFEST_FILE = "real-domain-camera-gate.json";
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} did not contain its exact persisted schema.`);
}

function requireSourceLock(sourceLock: RealBuildPrefix50Step44CameraOnlySourceLockEvidence): void {
  exactKeys(
    sourceLock,
    [
      "bootstrapSourceManifestDigest",
      "commitment",
      "lockedByteCount",
      "lockedFileCount",
      "lockManifestDigest",
      "schemaVersion",
      "sourcePdf",
    ],
    "Persisted real-domain source lock",
  );
  exactKeys(sourceLock.sourcePdf, ["artifactPath", "byteDigest", "bytes"], "Source PDF lock");
  if (
    sourceLock.schemaVersion !== "lego.real-build-prefix50-step44-camera-only-source-lock/1" ||
    !SHA256.test(sourceLock.bootstrapSourceManifestDigest) ||
    !SHA256.test(sourceLock.lockManifestDigest) ||
    !Number.isSafeInteger(sourceLock.lockedFileCount) ||
    sourceLock.lockedFileCount < 1 ||
    !Number.isSafeInteger(sourceLock.lockedByteCount) ||
    sourceLock.lockedByteCount < REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES ||
    sourceLock.sourcePdf.artifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    sourceLock.sourcePdf.byteDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    sourceLock.sourcePdf.bytes !== REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES ||
    sourceLock.commitment !== canonicalDigest(withoutCommitment(sourceLock))
  )
    throw new TypeError(
      "Persisted real-domain source lock did not retain its exact live PDF binding.",
    );
}

function requireObservation(
  observation: RealBuildPrefix50Step44RealDomainObservation,
  panelStep: 41 | 42 | 43,
): void {
  const { observationCommitment, ...body } = observation;
  if (observation.panelStep !== panelStep || observationCommitment !== canonicalDigest(body))
    throw new TypeError(`Persisted real-domain Step-${panelStep} observation drifted.`);
}

function requireCalibration(receipt: RealBuildPrefix50Step44RealDomainCalibrationReceipt): void {
  exactKeys(
    receipt,
    [
      "calibrationPanelSteps",
      "commitment",
      "failuresByPanelStep",
      "observations",
      "preregistrationCommitment",
      "schemaVersion",
      "status",
      "thresholdsChanged",
    ],
    "Persisted real-domain calibration receipt",
  );
  const { commitment, ...body } = receipt;
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step44-real-domain-calibration-receipt/1" ||
    receipt.preregistrationCommitment !==
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION.commitment ||
    canonicalDigest(receipt.calibrationPanelSteps) !== canonicalDigest([41, 42]) ||
    receipt.observations.length !== 2 ||
    receipt.failuresByPanelStep.length !== 2 ||
    receipt.failuresByPanelStep.some(
      ({ panelStep, failures }, index) => panelStep !== index + 41 || failures.length !== 0,
    ) ||
    receipt.status !== "qualified-for-heldout" ||
    receipt.thresholdsChanged !== false ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError("Persisted real-domain calibration was not exact qualified Steps 41/42.");
  requireObservation(receipt.observations[0]!, 41);
  requireObservation(receipt.observations[1]!, 42);
}

function requireHeldOut(
  receipt: RealBuildPrefix50Step44RealDomainHeldOutReceipt,
  calibration: RealBuildPrefix50Step44RealDomainCalibrationReceipt,
  sessionCommitment: Sha256Digest,
): void {
  exactKeys(
    receipt,
    [
      "calibrationReceiptCommitment",
      "calibrationSessionCommitment",
      "commitment",
      "failures",
      "heldOutPanelStep",
      "observation",
      "preregistrationCommitment",
      "schemaVersion",
      "status",
      "thresholdsChanged",
    ],
    "Persisted real-domain held-out receipt",
  );
  const { commitment, ...body } = receipt;
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step44-real-domain-heldout-receipt/1" ||
    receipt.preregistrationCommitment !==
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION.commitment ||
    receipt.calibrationReceiptCommitment !== calibration.commitment ||
    receipt.calibrationSessionCommitment !== sessionCommitment ||
    receipt.heldOutPanelStep !== 43 ||
    receipt.failures.length !== 0 ||
    receipt.status !== "validated" ||
    receipt.thresholdsChanged !== false ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError("Persisted real-domain Step-43 holdout was not exactly validated.");
  requireObservation(receipt.observation, 43);
}

function requireManifest(
  manifest: PersistedGateManifest,
  expectedBatchCommitment: Sha256Digest,
): void {
  exactKeys(
    manifest,
    [
      "authority",
      "calibrationReceipt",
      "calibrationSessionCommitment",
      "caseProofCommitments",
      "cleanup",
      "commitment",
      "heldOutReceipt",
      "reviewBatchEnvelopeCommitment",
      "schemaVersion",
      "sourceLock",
      "status",
      "thresholdsChanged",
    ],
    "Persisted real-domain qualification manifest",
  );
  exactKeys(
    manifest.cleanup,
    ["browserClosed", "browserProcessTreeClosed", "serverClosed"],
    "Persisted real-domain cleanup receipt",
  );
  if (
    manifest.schemaVersion !== "lego.real-build-prefix50-real-domain-camera-gate/1" ||
    manifest.authority !== "none" ||
    manifest.status !== "qualified-and-validated" ||
    manifest.reviewBatchEnvelopeCommitment !== expectedBatchCommitment ||
    manifest.caseProofCommitments.length !== 3 ||
    manifest.thresholdsChanged !== false ||
    manifest.cleanup.browserClosed !== true ||
    manifest.cleanup.browserProcessTreeClosed !== true ||
    manifest.cleanup.serverClosed !== true ||
    manifest.commitment !== canonicalDigest(withoutCommitment(manifest))
  )
    throw new TypeError("Persisted real-domain qualification manifest is incomplete or refused.");
}

export async function verifyPersistedRealBuildPrefix50Step44RealDomainQualificationFromLiveSession(
  input: Readonly<{
    qualificationOutputPath: string;
    calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
    heldOutPair: RealBuildPrefix50Step44RealDomainHeldOutPair;
    publicationTransaction?: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
  }>,
): Promise<
  Readonly<{
    outputPath: string;
    manifest: PersistedGateManifest;
    proof: RealBuildPrefix50Step44VerifiedRealDomainQualification;
  }>
> {
  const state = requireRealBuildPrefix50Step44RealDomainCalibrationSession(
    input.calibrationSession,
  );
  const heldOutPair = requireRealBuildPrefix50Step44RealDomainHeldOutPair(
    input.heldOutPair,
    input.calibrationSession,
  );
  const outputPath = await requireRealBuildPrefix50Step44RealDomainOutputChild(
    input.qualificationOutputPath,
  );
  const proofOutputPath =
    input.publicationTransaction === undefined
      ? outputPath
      : prospectiveRealBuildPrefix50Step44CalibrationFinalPath(
          input.publicationTransaction,
          outputPath,
        );
  return withStableRealBuildPrefix50Step44RealDomainGateOutputTree(
    { outputPath, persistedCaseCount: 3 },
    async () => {
      const manifestBytes = readContainedBoundedRegularFile(outputPath, GATE_MANIFEST_FILE, {
        label: "live real-domain qualification authority manifest",
        maximumBytes: 64 * 1024 * 1024,
      });
      const manifest = JSON.parse(manifestBytes.toString("utf8")) as PersistedGateManifest;
      requireManifest(manifest, state.reviewBatch.commitment);
      requireSourceLock(manifest.sourceLock);
      requireCalibration(manifest.calibrationReceipt);
      requireHeldOut(
        manifest.heldOutReceipt,
        manifest.calibrationReceipt,
        input.calibrationSession.commitment,
      );
      if (
        canonicalDigest(manifest.sourceLock) !== canonicalDigest(state.sourceLock.evidence) ||
        manifest.calibrationSessionCommitment !== input.calibrationSession.commitment ||
        manifest.calibrationReceipt.commitment !== state.calibrationReceipt.commitment
      )
        throw new TypeError(
          "Live real-domain qualification manifest drifted from its exact opaque calibration session.",
        );
      const cases = [
        verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline({
          outputPath,
          panelStep: 41,
          sourceCase: state.sourceSequence.calibrationCases[0],
          predecessorCase: state.predecessorSequence.calibrationCases[0],
          observation: manifest.calibrationReceipt.observations[0]!,
          ...(input.publicationTransaction === undefined
            ? {}
            : { publicationTransaction: input.publicationTransaction }),
        }),
        verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline({
          outputPath,
          panelStep: 42,
          sourceCase: state.sourceSequence.calibrationCases[1],
          predecessorCase: state.predecessorSequence.calibrationCases[1],
          observation: manifest.calibrationReceipt.observations[1]!,
          ...(input.publicationTransaction === undefined
            ? {}
            : { publicationTransaction: input.publicationTransaction }),
        }),
        verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline({
          outputPath,
          panelStep: 43,
          sourceCase: heldOutPair.sourceCase,
          predecessorCase: heldOutPair.predecessorCase,
          observation: manifest.heldOutReceipt.observation,
          ...(input.publicationTransaction === undefined
            ? {}
            : { publicationTransaction: input.publicationTransaction }),
        }),
      ] as const;
      if (
        cases.some(
          ({ proofCommitment, pageRasterCommitment, sharedOrientationAnchorCommitment }, index) =>
            proofCommitment !== manifest.caseProofCommitments[index] ||
            pageRasterCommitment !== input.calibrationSession.pageRasterCommitment ||
            sharedOrientationAnchorCommitment !==
              input.calibrationSession.sharedOrientationAnchorCommitment,
        )
      )
        throw new TypeError(
          "Live real-domain qualification case proofs did not reproduce from persisted bytes.",
        );
      readContainedBoundedRegularFile(outputPath, GATE_MANIFEST_FILE, {
        label: "final live real-domain qualification authority manifest reread",
        maximumBytes: 64 * 1024 * 1024,
        exactBytes: manifestBytes.byteLength,
        expectedSha256: sha256RealBuildPrefix50Step44ReviewBytes(manifestBytes),
      });
      const proofBody = {
        schemaVersion: "lego.real-build-prefix50-verified-real-domain-qualification/1" as const,
        outputRealPathCommitment: canonicalDigest({ realPath: proofOutputPath }),
        reviewBatchEnvelopeCommitment: state.reviewBatch.commitment,
        sourceLockCommitment: state.sourceLock.evidence.commitment,
        calibrationSessionCommitment: input.calibrationSession.commitment,
        calibrationReceiptCommitment: manifest.calibrationReceipt.commitment,
        heldOutReceiptCommitment: manifest.heldOutReceipt.commitment,
        persistedManifestCommitment: manifest.commitment,
      };
      return Object.freeze({
        outputPath,
        manifest,
        proof: Object.freeze({ ...proofBody, commitment: canonicalDigest(proofBody) }),
      });
    },
  );
}

export interface RealBuildPrefix50Step44OfflineRealDomainQualificationVerification {
  readonly outputPath: string;
  readonly binding: RealBuildPrefix50Step44RealDomainQualificationBinding;
}

export async function verifyPersistedRealBuildPrefix50Step44RealDomainQualificationOffline(input: {
  readonly qualificationOutputPath: string;
  readonly repositoryRoot: string;
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly returnResult: RealBuildPrefix50SubBuildReturnResult;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
}): Promise<RealBuildPrefix50Step44OfflineRealDomainQualificationVerification> {
  const sourceLock = requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock(input.sourceLock);
  const repositoryRoot = resolve(input.repositoryRoot);
  if (resolve(sourceLock.runtimeIdentity.repoRoot) !== repositoryRoot)
    throw new TypeError(
      "Persisted real-domain qualification must replay under its current live repository source lock.",
    );
  const returnResult =
    realBuildPrefix50SubBuildReturnBrands.requireRealBuildPrefix50SubBuildReturnResult(
      input.returnResult,
    );
  const reviewBatch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.reviewBatch);
  assertRealBuildPrefix50Step44RealDomainBatch(reviewBatch);
  if (reviewBatch.returnResultCommitment !== returnResult.commitment)
    throw new TypeError(
      "Persisted real-domain qualification mixed its runtime-branded return result and exact 211 batch.",
    );
  const outputPath = await requireRealBuildPrefix50Step44RealDomainOutputChild(
    input.qualificationOutputPath,
  );
  const manifestBytes = readContainedBoundedRegularFile(outputPath, GATE_MANIFEST_FILE, {
    label: "persisted real-domain qualification authority manifest",
    maximumBytes: 64 * 1024 * 1024,
  });
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as PersistedGateManifest;
  requireManifest(manifest, reviewBatch.commitment);
  requireSourceLock(manifest.sourceLock);
  if (canonicalDigest(manifest.sourceLock) !== canonicalDigest(sourceLock.evidence))
    throw new TypeError(
      "Persisted real-domain source lock did not match the current opaque live lock.",
    );
  requireCalibration(manifest.calibrationReceipt);
  const { sourceGeometryAdmission } =
    await reproduceRealBuildPrefix50Step42SourceGeometryAuthority();
  const [sourceSequence, predecessorSequence] = await Promise.all([
    prepareRealBuildPrefix50Step44RealDomainSourceSequence({
      repositoryRoot,
      sourceLock,
      sourceGeometryAdmission,
    }),
    Promise.resolve(prepareRealBuildPrefix50Step44RealDomainPredecessorSequence(reviewBatch)),
  ]);
  const calibrationCases = [0, 1].map((index) =>
    verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline({
      outputPath,
      panelStep: (index + 41) as 41 | 42,
      sourceCase: sourceSequence.calibrationCases[index]!,
      predecessorCase: predecessorSequence.calibrationCases[index]!,
      observation: manifest.calibrationReceipt.observations[index]!,
    }),
  ) as [
    ReturnType<typeof verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline>,
    ReturnType<typeof verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline>,
  ];
  const session = await replayPersistedRealBuildPrefix50Step44RealDomainCalibrationSession({
    sourceLock,
    sourceSequence,
    predecessorSequence,
    reviewBatch,
    calibrationReceipt: manifest.calibrationReceipt,
    calibrationCaseProofs: calibrationCases,
  });
  if (session.commitment !== manifest.calibrationSessionCommitment)
    throw new TypeError("Persisted real-domain calibration session did not reproduce.");
  const heldOutPair = await consumeRealBuildPrefix50Step44CalibrationSessionForHeldOut(session);
  const heldOutCase = verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline({
    outputPath,
    panelStep: 43,
    sourceCase: heldOutPair.sourceCase,
    predecessorCase: heldOutPair.predecessorCase,
    observation: manifest.heldOutReceipt.observation,
  });
  requireHeldOut(manifest.heldOutReceipt, manifest.calibrationReceipt, session.commitment);
  const cases = [...calibrationCases, heldOutCase] as const;
  const observations = [
    manifest.calibrationReceipt.observations[0]!,
    manifest.calibrationReceipt.observations[1]!,
    manifest.heldOutReceipt.observation,
  ] as const;
  if (
    cases.some(
      ({ proofCommitment, pageRasterCommitment, sharedOrientationAnchorCommitment }, index) =>
        proofCommitment !== manifest.caseProofCommitments[index] ||
        pageRasterCommitment !== cases[0]!.pageRasterCommitment ||
        sharedOrientationAnchorCommitment !== cases[0]!.sharedOrientationAnchorCommitment,
    ) ||
    observations.some(
      (observation) =>
        observation.sourceLockCommitment !== sourceLock.evidence.commitment ||
        observation.pageRasterCommitment !== cases[0]!.pageRasterCommitment ||
        observation.sourceSharedOrientationAnchorCommitment !==
          cases[0]!.sharedOrientationAnchorCommitment,
    )
  )
    throw new TypeError(
      "Persisted real-domain cases drifted from one shared source/session chain.",
    );
  readContainedBoundedRegularFile(outputPath, GATE_MANIFEST_FILE, {
    label: "final persisted real-domain qualification authority manifest reread",
    maximumBytes: 64 * 1024 * 1024,
    exactBytes: manifestBytes.byteLength,
    expectedSha256: sha256RealBuildPrefix50Step44ReviewBytes(manifestBytes),
  });
  const proofBody = {
    schemaVersion: "lego.real-build-prefix50-verified-real-domain-qualification/1" as const,
    outputRealPathCommitment: canonicalDigest({ realPath: outputPath }),
    reviewBatchEnvelopeCommitment: reviewBatch.commitment,
    sourceLockCommitment: sourceLock.evidence.commitment,
    calibrationSessionCommitment: session.commitment,
    calibrationReceiptCommitment: manifest.calibrationReceipt.commitment,
    heldOutReceiptCommitment: manifest.heldOutReceipt.commitment,
    persistedManifestCommitment: manifest.commitment,
  };
  const proofCommitment = canonicalDigest(proofBody);
  const bindingBody = {
    schemaVersion: "lego.real-build-prefix50-step44-real-domain-qualification-binding/1" as const,
    qualificationOutputRealPathCommitment: proofBody.outputRealPathCommitment,
    reviewBatchEnvelopeCommitment: proofBody.reviewBatchEnvelopeCommitment,
    sourceLockCommitment: proofBody.sourceLockCommitment,
    calibrationSessionCommitment: proofBody.calibrationSessionCommitment,
    calibrationReceiptCommitment: proofBody.calibrationReceiptCommitment,
    heldOutReceiptCommitment: proofBody.heldOutReceiptCommitment,
    persistedManifestCommitment: proofBody.persistedManifestCommitment,
    qualificationProofCommitment: proofCommitment,
    popplerToolchainCommitment: REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT,
  };
  return Object.freeze({
    outputPath,
    binding: Object.freeze({ ...bindingBody, commitment: canonicalDigest(bindingBody) }),
  });
}
