import { link, mkdir, mkdtemp, rename, rm, unlink, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts")
      >();
    const synthetic =
      await import("./real-build-prefix50-subbuild-return-review-camera-real-domain-synthetic-source-sequence-test-support.ts");
    return {
      ...actual,
      requireRealBuildPrefix50Step44RealDomainSourceCase: (
        value: Parameters<typeof actual.requireRealBuildPrefix50Step44RealDomainSourceCase>[0],
      ) =>
        synthetic.isSyntheticPersistedQualificationSourceCase(value)
          ? value
          : actual.requireRealBuildPrefix50Step44RealDomainSourceCase(value),
      readRealBuildPrefix50Step44RealDomainSourceCasePixels: (
        value: Parameters<typeof actual.readRealBuildPrefix50Step44RealDomainSourceCasePixels>[0],
      ) =>
        synthetic.isSyntheticPersistedQualificationSourceCase(value)
          ? synthetic.readSyntheticPersistedQualificationSourceCasePixels(value)
          : actual.readRealBuildPrefix50Step44RealDomainSourceCasePixels(value),
    };
  },
);

vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts")
      >();
    const synthetic =
      await import("./real-build-prefix50-subbuild-return-review-camera-real-domain-synthetic-source-sequence-test-support.ts");
    return {
      ...actual,
      requireRealBuildPrefix50Step44RealDomainPredecessorCase: (
        value: Parameters<typeof actual.requireRealBuildPrefix50Step44RealDomainPredecessorCase>[0],
      ) =>
        synthetic.isSyntheticPersistedQualificationPredecessorCase(value)
          ? value
          : actual.requireRealBuildPrefix50Step44RealDomainPredecessorCase(value),
    };
  },
);

import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
  type RealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  type RealBuildPrefix50Step44CameraOnlySourceLockEvidence,
} from "../e2e/real-build-prefix50-step44-camera-only-source-lock.ts";
import type {
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "../e2e/real-build-prefix50-subbuild-return-contract.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "../e2e/real-build-prefix50-step44-panel-face-prefix.ts";
import type {
  RealBuildPrefix50Step44RealDomainCalibrationReceipt,
  RealBuildPrefix50Step44RealDomainHeldOutReceipt,
  RealBuildPrefix50Step44RealDomainObservation,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import {
  assertRealBuildPrefix50Step44RealDomainGateOutputTree,
  readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification,
  requireRealBuildPrefix50Step44RealDomainQualificationBinding,
  type PersistedGateManifest,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-preregistration.ts";
import { verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-case.ts";
import type { RealBuildPrefix50Step44CameraSearchAttempt } from "../e2e/real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "../e2e/real-build-prefix50-subbuild-return-review-harness-input.ts";
import { writeCallerAuthoredCalibrationPublicationMarker } from "./real-build-prefix50-step44-calibration-publication-marker-test-support.ts";
import {
  commitQualificationFixture as committed,
  createQualificationAttemptFixture,
  QUALIFICATION_FIXTURE_HEIGHT as HEIGHT,
  QUALIFICATION_FIXTURE_WIDTH as WIDTH,
  qualificationFixtureDigest as digest,
  qualificationFixturePng as png,
  requireCanonicalQualificationSourceSequence,
  sha256QualificationFixtureBytes as sha256,
  type QualificationFixtureAnchor as FixtureAnchor,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification-support.ts";
import {
  createSyntheticPersistedQualificationPredecessorCase,
  createSyntheticPersistedQualificationSourceSequence,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-synthetic-source-sequence-test-support.ts";

const BATCH = `sha256:${"b".repeat(64)}` as const;

function observationFixture(input: {
  panelStep: 41 | 42 | 43;
  sourceLockCommitment: Sha256Digest;
  pageRasterCommitment: Sha256Digest;
  sourceCaseCommitment: Sha256Digest;
  predecessorCaseCommitment: Sha256Digest;
  anchor: FixtureAnchor;
  counter: ReturnType<typeof committed>;
  attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  renderBindings: readonly { artifactFile: string; byteLength: number; pngDigest: Sha256Digest }[];
  semanticPolicyCommitment: Sha256Digest;
}): RealBuildPrefix50Step44RealDomainObservation {
  const registrationReceiptsCommitment = canonicalDigest(
    input.attempt.branchMeasurements.map(({ branchKey, alignmentPasses }) => ({
      branchKey,
      passes: alignmentPasses.map(({ commitment, registrationProposal }) => ({
        passCommitment: commitment,
        registrationProposalCommitment: registrationProposal?.commitment ?? null,
      })),
    })),
  );
  const body = {
    panelStep: input.panelStep,
    predecessorCaseCommitment: input.predecessorCaseCommitment,
    sourceCaseCommitment: input.sourceCaseCommitment,
    sourceLockCommitment: input.sourceLockCommitment,
    pageRasterCommitment: input.pageRasterCommitment,
    semanticPolicyCommitment: input.semanticPolicyCommitment,
    liveSearchAttemptCommitment: input.attempt.commitment,
    renderArtifactRosterCommitment: canonicalDigest(input.renderBindings),
    registrationReceiptsCommitment,
    sourceSharedOrientationAnchorCommitment: input.anchor.commitment,
    sourcePerPanelLatticeCounterevidenceCommitment: input.counter.commitment,
    sourcePooledLatticeCounterevidenceFailure: null,
    sourceLatticeFitCommitment: canonicalDigest(input.anchor.latticeFit),
    sourceLatticeFitQualified: true,
    sourceLatticeFitFailure: null,
    expectedBranchKey: "face:studs-up/hand:as-fitted/turn:0" as const,
    selectedBranchKey: "face:studs-up/hand:as-fitted/turn:0",
    parentOnlyIntersectionOverUnion: 1,
    expectedBranchGeometryMargin: 1,
    maximumObservedPredictionActualIntersectionOverUnionDrift: 0,
    blueCyanF1: 1,
    expectedBranchBlueCyanF1Margin: 1,
  };
  return Object.freeze({ ...body, observationCommitment: canonicalDigest(body) });
}

async function writeCase(input: {
  output: string;
  panelStep: 41 | 42 | 43;
  sourceLockCommitment: Sha256Digest;
  pageRasterCommitment: Sha256Digest;
  anchor: FixtureAnchor;
  sourcePng: Uint8Array;
  eligibleMaskPng: Uint8Array;
  targetMaskPng: Uint8Array;
  maskDigest: Sha256Digest;
}) {
  const directory = resolve(input.output, `step-${input.panelStep}`);
  await mkdir(directory);
  const { attempt, artifacts, semanticPolicyCommitment } = createQualificationAttemptFixture(
    input.maskDigest,
    input.sourcePng,
  );
  const artifactBytes: Record<string, Uint8Array> = {
    ...artifacts,
    "source-crop.png": input.sourcePng,
    "eligible-mask.png": input.eligibleMaskPng,
    "parent-target-mask.png": input.targetMaskPng,
  };
  const artifactFiles = Object.keys(artifactBytes).sort();
  const artifactBindings = artifactFiles.map((artifactFile) => ({
    artifactFile,
    byteLength: artifactBytes[artifactFile]!.byteLength,
    pngDigest: sha256(artifactBytes[artifactFile]!),
  }));
  const renderBindings = artifactBindings.filter(
    ({ artifactFile }) =>
      !["source-crop.png", "eligible-mask.png", "parent-target-mask.png"].includes(artifactFile),
  );
  const counter = committed({ panelStep: input.panelStep, retainedFailure: null });
  const sourceCaseCommitment = digest(`source-case-${input.panelStep}`);
  const predecessorCaseCommitment = digest(`predecessor-${input.panelStep}`);
  const observation = observationFixture({
    panelStep: input.panelStep,
    sourceLockCommitment: input.sourceLockCommitment,
    pageRasterCommitment: input.pageRasterCommitment,
    sourceCaseCommitment,
    predecessorCaseCommitment,
    anchor: input.anchor,
    counter,
    attempt,
    renderBindings,
    semanticPolicyCommitment,
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-real-domain-camera-case/1" as const,
    authority: "none" as const,
    panelStep: input.panelStep,
    splitRole: input.panelStep === 43 ? ("held-out-validation" as const) : ("calibration" as const),
    sourceLockCommitment: input.sourceLockCommitment,
    pageRasterCommitment: input.pageRasterCommitment,
    sourceCaseCommitment,
    sharedOrientationAnchor: input.anchor,
    perPanelLatticeCounterevidence: counter,
    predecessorCaseCommitment,
    activeChildDocumentHash: digest(`document-hash-${input.panelStep}`),
    activeChildDocumentCommitment: digest(`document-${input.panelStep}`),
    semanticPolicyCommitment,
    observationCommitment: observation.observationCommitment,
    runtimeStateCommitment: digest(`runtime-${input.panelStep}`),
    independentReplayCommitment: digest(`replay-${input.panelStep}`),
    searchAttemptCommitment: attempt.commitment,
    searchAttempt: attempt,
    artifactFiles,
    artifactBindings,
    artifactBindingsCommitment: canonicalDigest(artifactBindings),
  };
  const manifest = committed(body);
  for (const [file, bytes] of Object.entries(artifactBytes))
    await writeFile(resolve(directory, file), bytes);
  await writeFile(
    resolve(directory, "real-domain-camera-case.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const proofBody = {
    schemaVersion: "lego.real-build-prefix50-verified-real-domain-camera-case/1" as const,
    panelStep: input.panelStep,
    outputRealPathCommitment: canonicalDigest({ realPath: realpathSync(directory) }),
    caseManifestCommitment: manifest.commitment,
    observationCommitment: observation.observationCommitment,
    searchAttemptCommitment: attempt.commitment,
  };
  return { observation, proofCommitment: canonicalDigest(proofBody) };
}

async function createQualifiedTree(input?: {
  readonly sourceLock?: RealBuildPrefix50Step44CameraOnlySourceLockEvidence;
  readonly reviewBatchEnvelopeCommitment?: Sha256Digest;
}): Promise<{ output: string; manifest: PersistedGateManifest }> {
  await mkdir(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, { recursive: true });
  const output = await mkdtemp(
    resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, "unit-qualified-"),
  );
  await writeFile(resolve(output, "real-domain-camera-static-app.log"), "closed\n");
  const sourceLockBody = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-only-source-lock/1" as const,
    bootstrapSourceManifestDigest: digest("bootstrap"),
    lockManifestDigest: digest("lock-manifest"),
    lockedFileCount: 1,
    lockedByteCount: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
    sourcePdf: {
      artifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
      byteDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
      bytes: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
    },
  };
  const sourceLock =
    input?.sourceLock ??
    (committed(sourceLockBody) as RealBuildPrefix50Step44CameraOnlySourceLockEvidence);
  const reviewBatchEnvelopeCommitment = input?.reviewBatchEnvelopeCommitment ?? BATCH;
  const pageRasterCommitment = digest("page-raster");
  const anchor: FixtureAnchor = committed({
    pooledCounterevidenceFailure: null,
    latticeFit: { solution: { azimuthDegrees: 1, elevationDegrees: 2 } },
  });
  const mask = new Uint8Array(WIDTH * HEIGHT).fill(1);
  const maskDigest = sha256(mask);
  const cases = [];
  for (const panelStep of [41, 42, 43] as const)
    cases.push(
      await writeCase({
        output,
        panelStep,
        sourceLockCommitment: sourceLock.commitment,
        pageRasterCommitment,
        anchor,
        sourcePng: png([0x89, 0x90, 0x93, 0xff]),
        eligibleMaskPng: png([0xe8, 0xee, 0xe9, 0xff]),
        targetMaskPng: png([0xff, 0x30, 0xd8, 0xff]),
        maskDigest,
      }),
    );
  const calibrationBody = {
    schemaVersion: "lego.real-build-prefix50-step44-real-domain-calibration-receipt/1" as const,
    preregistrationCommitment: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION.commitment,
    calibrationPanelSteps: [41, 42] as const,
    observations: [cases[0]!.observation, cases[1]!.observation],
    failuresByPanelStep: [
      { panelStep: 41 as const, failures: [] },
      { panelStep: 42 as const, failures: [] },
    ],
    status: "qualified-for-heldout" as const,
    thresholdsChanged: false as const,
  };
  const calibrationReceipt = committed(
    calibrationBody,
  ) as RealBuildPrefix50Step44RealDomainCalibrationReceipt;
  const sessionBody = {
    schemaVersion: "lego.real-build-prefix50-real-domain-calibration-session/1" as const,
    status: "qualified-for-heldout" as const,
    sourceLockCommitment: sourceLock.commitment,
    pageRasterCommitment,
    sharedOrientationAnchorCommitment: anchor.commitment,
    reviewBatchEnvelopeCommitment,
    orderedCalibrationObservationCommitment: canonicalDigest(calibrationReceipt.observations),
    calibrationReceiptCommitment: calibrationReceipt.commitment,
  };
  const calibrationSessionCommitment = canonicalDigest(sessionBody);
  const heldOutBody = {
    schemaVersion: "lego.real-build-prefix50-step44-real-domain-heldout-receipt/1" as const,
    preregistrationCommitment: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION.commitment,
    calibrationReceiptCommitment: calibrationReceipt.commitment,
    calibrationSessionCommitment,
    heldOutPanelStep: 43 as const,
    observation: cases[2]!.observation,
    failures: [] as const,
    status: "validated" as const,
    thresholdsChanged: false as const,
  };
  const heldOutReceipt = committed(heldOutBody) as RealBuildPrefix50Step44RealDomainHeldOutReceipt;
  const gateBody = {
    schemaVersion: "lego.real-build-prefix50-real-domain-camera-gate/1" as const,
    authority: "none" as const,
    status: "qualified-and-validated" as const,
    reviewBatchEnvelopeCommitment,
    sourceLock,
    calibrationSessionCommitment,
    calibrationReceipt,
    heldOutReceipt,
    caseProofCommitments: cases.map(({ proofCommitment }) => proofCommitment) as [
      Sha256Digest,
      Sha256Digest,
      Sha256Digest,
    ],
    thresholdsChanged: false as const,
    cleanup: { browserClosed: true, browserProcessTreeClosed: true, serverClosed: true },
  };
  const manifest = committed(gateBody) as PersistedGateManifest;
  await writeFile(
    resolve(output, "real-domain-camera-gate.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return { output, manifest };
}

describe("persisted real-domain qualification replay", () => {
  it("rejects hardlinks, nested entries, post-enumeration injection, and case-directory swaps", async () => {
    const { output } = await createQualifiedTree();
    const manifestAlias = `${output}-manifest-hardlink`;
    const pngAlias = `${output}-png-hardlink`;
    const swappedCase = `${output}-swapped-step-41`;
    try {
      await link(resolve(output, "real-domain-camera-gate.json"), manifestAlias);
      await expect(
        assertRealBuildPrefix50Step44RealDomainGateOutputTree({
          outputPath: output,
          persistedCaseCount: 3,
        }),
      ).rejects.toThrow(/singly linked/u);
      await unlink(manifestAlias);

      await link(resolve(output, "step-41", "source-crop.png"), pngAlias);
      await expect(
        assertRealBuildPrefix50Step44RealDomainGateOutputTree({
          outputPath: output,
          persistedCaseCount: 3,
        }),
      ).rejects.toThrow(/linked, nested, or non-regular/u);
      await unlink(pngAlias);

      const nested = resolve(output, "step-41", "nested");
      await mkdir(nested);
      await expect(
        assertRealBuildPrefix50Step44RealDomainGateOutputTree({
          outputPath: output,
          persistedCaseCount: 3,
        }),
      ).rejects.toThrow(/linked, nested, or non-regular/u);
      await rm(nested, { recursive: true });

      const injected = resolve(output, "step-41", "post-enumeration-injection.png");
      await expect(
        assertRealBuildPrefix50Step44RealDomainGateOutputTree({
          outputPath: output,
          persistedCaseCount: 3,
          __testHooks: { afterEnumeration: () => writeFile(injected, Uint8Array.of(1)) },
        }),
      ).rejects.toThrow(/changed during verification/u);
      await unlink(injected);

      const step41 = resolve(output, "step-41");
      await expect(
        assertRealBuildPrefix50Step44RealDomainGateOutputTree({
          outputPath: output,
          persistedCaseCount: 3,
          __testHooks: {
            afterEnumeration: async () => {
              await rename(step41, swappedCase);
              await mkdir(step41);
            },
          },
        }),
      ).rejects.toThrow(/changed during verification/u);
      await rm(step41, { recursive: true });
      await rename(swappedCase, step41);
    } finally {
      await rm(manifestAlias, { force: true });
      await rm(pngAlias, { force: true });
      await rm(swappedCase, { recursive: true, force: true });
      await rm(output, { recursive: true, force: true });
    }
  });

  it("rejects a caller-authored tree and marker without genuine runtime authorities", async () => {
    const { output, manifest } = await createQualifiedTree();
    try {
      await writeCallerAuthoredCalibrationPublicationMarker(output, manifest.commitment);
      const forgedSourceLock = Object.freeze({
        evidence: Object.freeze({}),
        runtimeIdentity: Object.freeze({ repoRoot: resolve("."), helperPid: 1 }),
      }) as unknown as RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
      await expect(
        readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification({
          qualificationOutputPath: output,
          repositoryRoot: resolve("."),
          sourceLock: forgedSourceLock,
          returnResult: Object.freeze({}) as RealBuildPrefix50SubBuildReturnResult,
          reviewBatch: Object.freeze({}) as RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
        }),
      ).rejects.toThrow("opaque capability minted from this process's running bootstrap helper");
      expect(() =>
        requireRealBuildPrefix50Step44RealDomainQualificationBinding(Object.freeze({}) as never),
      ).toThrow("runtime-branded persisted Steps-41/42-qualified");
    } finally {
      await rm(`${output}.publication.json`, { force: true });
      await rm(output, { recursive: true, force: true });
    }
  });

  it("rejects a synthetic forged tree at the narrow persisted source/case verifier", async () => {
    const { output, manifest } = await createQualifiedTree();
    const sourceSequence = createSyntheticPersistedQualificationSourceSequence(
      manifest.sourceLock.commitment,
    );
    const sourceCase = sourceSequence.calibrationCases[0]!;
    const predecessorCase = createSyntheticPersistedQualificationPredecessorCase(41);
    try {
      expect(() => requireCanonicalQualificationSourceSequence(sourceSequence)).not.toThrow();
      expect(manifest.sourceLock.commitment).toBe(sourceCase.sourceLockCommitment);
      expect(manifest.calibrationReceipt.observations[0]!.pageRasterCommitment).toBe(
        sourceCase.pageRasterCommitment,
      );
      expect(manifest.calibrationReceipt.observations[0]!.sourceCaseCommitment).not.toBe(
        sourceCase.sourceCaseCommitment,
      );
      expect(() =>
        verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline({
          outputPath: realpathSync(output),
          panelStep: 41,
          sourceCase,
          predecessorCase,
          observation: manifest.calibrationReceipt.observations[0]!,
        }),
      ).toThrow("Persisted real-domain case manifest or exact roster drifted");
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });
});
