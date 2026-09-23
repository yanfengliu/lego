import { realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_DEFAULT_OUTPUT_NAME,
  requireRealBuildPrefix50Step44CameraOnlyOutputName,
} from "./real-build-prefix50-step44-camera-only-gate-input.ts";
import {
  assertRealBuildPrefix50Step44CameraOnlyManifestSourceLock,
  assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock,
  captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
} from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import { readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import {
  realBuildPrefix50Step44BrowserLifecycleError,
  runRealBuildPrefix50Step44BrowserLifecycle,
} from "./real-build-prefix50-subbuild-return-review-browser-lifecycle.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  assertRealBuildPrefix50Step44ClaimedDirectoryIdentity,
  claimRealBuildPrefix50Step44ReviewOutputPublication,
  prepareRealBuildPrefix50Step44ReviewOutputPublication,
} from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_BYTES_HASH,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH,
} from "./real-build-prefix50-step44-review-batch-pin.ts";
import { rederiveRealBuildPrefix50Step44PinnedProductionMaterials } from "./real-build-prefix50-step44-runtime-materials.ts";
import { issueRealBuildPrefix50Step44LaterSourceReadCapability } from "./real-build-prefix50-step44-later-source-authority.ts";

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TypeError(message);
}

function cameraOnlyOutputPath(outputName: string): string {
  const outputPath = resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, outputName);
  if (dirname(outputPath) !== REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT)
    throw new TypeError("Camera-only Step-44 output escaped the direct task-root child boundary.");
  return outputPath;
}

function requireCameraOnlySourceLock(repositoryRoot: string) {
  return captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock(repositoryRoot);
}

export async function runRealBuildPrefix50Step44CameraOnlyGate(input: {
  readonly repositoryRoot: string;
  readonly qualificationOutputPath: string;
  readonly outputName?: string;
}): Promise<Readonly<{ outputPath: string; manifestCommitment: `sha256:${string}` }>> {
  const repositoryRoot = await realpath(input.repositoryRoot);
  requireCondition(
    repositoryRoot === (await realpath(resolve("."))),
    "Camera-only Step-44 gate must run from the exact repository root.",
  );
  const sourceLockBefore = requireCameraOnlySourceLock(repositoryRoot);
  const outputName = requireRealBuildPrefix50Step44CameraOnlyOutputName(
    input.outputName ?? REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_DEFAULT_OUTPUT_NAME,
  );
  const outputPath = cameraOnlyOutputPath(outputName);
  const inputPath = resolve(
    repositoryRoot,
    REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH,
  );
  const materials = await rederiveRealBuildPrefix50Step44PinnedProductionMaterials(repositoryRoot);
  const batch = materials.batch;
  requireCondition(
    batch.candidateCount === 211,
    "Camera-only Step-44 gate requires the fresh runtime-branded exact 211-row review batch.",
  );
  const qualificationOutputPath = await realpath(input.qualificationOutputPath);
  requireCondition(
    dirname(qualificationOutputPath) === REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT &&
      qualificationOutputPath !== outputPath,
    "Camera-only Step-44 gate requires one existing direct-child page44 qualification output distinct from v4.",
  );
  const realDomainQualification =
    await readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification({
      qualificationOutputPath,
      repositoryRoot,
      sourceLock: sourceLockBefore,
      returnResult: materials.result,
      reviewBatch: batch,
    });
  const [
    gateContract,
    gateArtifacts,
    attemptVerifier,
    camera,
    search,
    calibration,
    cameraSource,
    semantic,
    probeSupport,
  ] = await Promise.all([
    import("./real-build-prefix50-step44-camera-only-gate-contract.ts"),
    import("./real-build-prefix50-step44-camera-only-gate-artifacts.ts"),
    import("./real-build-prefix50-subbuild-return-review-camera-attempt-persistence.ts"),
    import("./real-build-prefix50-subbuild-return-review-camera.ts"),
    import("./real-build-prefix50-subbuild-return-review-camera-search.ts"),
    import("./real-build-prefix50-subbuild-return-review-camera-calibration.ts"),
    import("./real-build-prefix50-subbuild-return-review-camera-source.ts"),
    import("./real-build-prefix50-subbuild-return-review-camera-semantic.ts"),
    import("./real-build-prefix50-step44-camera-only-gate-probe.ts"),
  ]);
  const {
    assertRealBuildPrefix50Step44CameraOnlyDecision,
    assertRealBuildPrefix50Step44CameraOnlyRefusedAttempt,
    assertRealBuildPrefix50Step44CameraOnlyVerifiedAttemptBinding,
  } = gateContract;
  const {
    assertRealBuildPrefix50Step44CameraOnlyCompleteManifest,
    assertRealBuildPrefix50Step44CameraOnlyInstrumentArtifacts,
    assertRealBuildPrefix50Step44CameraOnlyOutputTree,
    assertRealBuildPrefix50Step44SelectedCameraPngIdentity,
    createRealBuildPrefix50Step44CameraOnlyBranchRows,
    createRealBuildPrefix50Step44CameraOnlyOverlays,
    createRealBuildPrefix50Step44PersistedCameraSemanticSource,
    RealBuildPrefix50Step44CameraOnlyVerifiedRefusalError,
    writeAndAssertRealBuildPrefix50Step44CameraOnlyRefusalManifest,
    writeRealBuildPrefix50Step44CameraOnlyManifest,
  } = gateArtifacts;
  const {
    requireRealBuildPrefix50Step44VerifiedPersistedCameraAttempt,
    verifyPersistedRealBuildPrefix50Step44CameraAttempt,
  } = attemptVerifier;
  const { deriveRealBuildPrefix50Step44Page45CameraInstrument, exactParent } = camera;
  const { RealBuildPrefix50Step44CameraSearchRefusalError } = search;
  const {
    deriveRealBuildPrefix50Step44InteriorFeatureCalibration,
    REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
  } = calibration;
  const { loadRealBuildPrefix50Step44RepositoryPage45CameraSource } = cameraSource;
  const { deriveRealBuildPrefix50Step44SemanticColorPolicy } = semantic;
  const { captureCameraOnlyRuntimeState, installCameraOnlyProbe, requireCameraOnlyProbe } =
    probeSupport;
  const source = await loadRealBuildPrefix50Step44RepositoryPage45CameraSource({
    panelFaceCapability: issueRealBuildPrefix50Step44LaterSourceReadCapability({
      repositoryRoot,
      qualification: realDomainQualification,
      purpose: "page45-step44-vector",
      physicalPageNumber: 45,
    }),
    rasterCapability: issueRealBuildPrefix50Step44LaterSourceReadCapability({
      repositoryRoot,
      qualification: realDomainQualification,
      purpose: "page45-camera-raster",
      physicalPageNumber: 45,
    }),
  });
  const parent = exactParent({
    reviewReplayBaseDocument: batch.reviewReplayBaseDocument,
    childPartIds: batch.enumerationReceipt.childPartIds,
    sourceDocumentHash: batch.sourceDocumentHash,
  });
  const publication = await prepareRealBuildPrefix50Step44ReviewOutputPublication(outputPath);
  const identity = await claimRealBuildPrefix50Step44ReviewOutputPublication(publication);

  const lifecycle = await runRealBuildPrefix50Step44BrowserLifecycle({
    serverLogPath: resolve(outputPath, "camera-only-static-app.log"),
    execute: async ({ page }) => {
      await installCameraOnlyProbe(page);
      try {
        const instrument = await deriveRealBuildPrefix50Step44Page45CameraInstrument({
          page,
          repositoryRoot,
          outputPath,
          reviewBatch: batch,
          realDomainQualification,
        });
        return {
          status: "complete" as const,
          instrument,
          ...(await captureCameraOnlyRuntimeState(page)),
        };
      } catch (error) {
        if (!(error instanceof RealBuildPrefix50Step44CameraSearchRefusalError)) throw error;
        return {
          status: "refused" as const,
          refusal: {
            attemptCommitment: error.attemptCommitment,
            refusalReasons: error.refusalReasons,
          },
          ...(await captureCameraOnlyRuntimeState(page)),
        };
      }
    },
  });
  if (lifecycle.status === "failed") throw realBuildPrefix50Step44BrowserLifecycleError(lifecycle);
  requireCondition(
    lifecycle.cleanup.browserClosed &&
      lifecycle.cleanup.browserProcessTreeClosed &&
      lifecycle.cleanup.serverClosed,
    "Camera-only Step-44 lifecycle left a task-owned browser or server process running.",
  );
  const sourceLock = assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock({
    before: sourceLockBefore,
    after: requireCameraOnlySourceLock(repositoryRoot),
  });
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(identity);
  const runtime = lifecycle.value;
  requireCondition(
    runtime.snapshot.partCount === 257 &&
      runtime.snapshot.structuralHash === parent.parentHash &&
      runtime.snapshot.documentGloballyValid,
    "Camera-only Step-44 gate did not finish on the exact hard-valid 257-part parent.",
  );
  const semanticColorPolicy = deriveRealBuildPrefix50Step44SemanticColorPolicy(
    parent.parentDocument,
  );
  if (runtime.status === "refused") {
    const persistedProof = verifyPersistedRealBuildPrefix50Step44CameraAttempt({
      outputPath,
      expectedSearchAttemptCommitment: runtime.refusal.attemptCommitment,
      expectedCameraReceiptCommitment: null,
      reviewBatch: batch,
      source: createRealBuildPrefix50Step44PersistedCameraSemanticSource(source),
      realDomainQualification,
    });
    const verifiedAttempt = requireRealBuildPrefix50Step44VerifiedPersistedCameraAttempt({
      proof: persistedProof,
      outputPath,
      reviewBatchEnvelopeCommitment: batch.commitment,
      cameraReceiptCommitment: null,
      searchAttemptCommitment: runtime.refusal.attemptCommitment,
    });
    const refusal = assertRealBuildPrefix50Step44CameraOnlyRefusedAttempt({
      attempt: verifiedAttempt.searchAttempt,
      typedAttemptCommitment: runtime.refusal.attemptCommitment,
      typedRefusalReasons: runtime.refusal.refusalReasons,
    });
    const probe = requireCameraOnlyProbe({
      value: runtime.probe,
      expectedBeautyAlignmentRenderCount: refusal.renderCount,
      semanticTargetColorIds: semanticColorPolicy.targetColorIds,
      parentHash: parent.parentHash,
    });
    const calibration = deriveRealBuildPrefix50Step44InteriorFeatureCalibration();
    requireCondition(
      calibration.commitment === REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
      "Camera-only Step-44 refusal manifest could not reproduce its metric-v2 calibration.",
    );
    const refusalManifest = await writeAndAssertRealBuildPrefix50Step44CameraOnlyRefusalManifest({
      outputPath,
      outputDirectory: outputName,
      batchInput: {
        artifactFile: relative(repositoryRoot, inputPath).replaceAll("\\", "/"),
        byteDigest: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_BYTES_HASH,
        reviewBatchEnvelopeCommitment: batch.commitment,
        sourceCandidateCount: batch.candidateCount,
        renderedCandidateCount: 0,
        candidateRenderCallbackProvided: false,
      },
      source: {
        artifactPath: source.sourcePdfArtifactPath,
        pdfDigest: source.sourcePdfDigest,
        firstPrintedStep: source.panelFacePrefixEvidence.firstPrintedStep,
        lastPrintedStep: source.panelFacePrefixEvidence.lastPrintedStep,
        coveredPageCeiling: source.panelFacePrefixEvidence.coveredPageCeiling,
        page46ReadableBySourceAdapter: false,
        expectedPanelFace: source.expectedPanelFace,
        page45CropArtifactFile: null,
        eligibleMaskArtifactFile: null,
        parentTargetMaskArtifactFile: null,
      },
      sharedParent: {
        partCount: parent.parentDocument.parts.length,
        stepCount: parent.parentDocument.steps.length,
        documentHash: parent.parentHash,
        documentCommitment: canonicalDigest(parent.parentDocument),
        observedRenderCallCount: probe.calls.length,
        observedPartCounts: [257],
      },
      refusal,
      attempt: verifiedAttempt.searchAttempt,
      metricCalibration: calibration,
      persistedSemanticProof: persistedProof,
      realDomainQualification,
      sourceLock,
      cleanup: lifecycle.cleanup,
    });
    await assertRealBuildPrefix50Step44CameraOnlyOutputTree(
      outputPath,
      "refused",
      verifiedAttempt.actualRenderArtifactFiles,
    );
    await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(identity);
    throw new RealBuildPrefix50Step44CameraOnlyVerifiedRefusalError({
      outputPath,
      manifestCommitment: refusalManifest.commitment,
      searchAttemptCommitment: runtime.refusal.attemptCommitment,
      refusalReasons: runtime.refusal.refusalReasons,
    });
  }

  const { receipt } = runtime.instrument;
  const decision = assertRealBuildPrefix50Step44CameraOnlyDecision(receipt);
  const probe = requireCameraOnlyProbe({
    value: runtime.probe,
    expectedBeautyAlignmentRenderCount: decision.renderCount,
    semanticTargetColorIds: semanticColorPolicy.targetColorIds,
    parentHash: parent.parentHash,
  });
  const persistedProof = verifyPersistedRealBuildPrefix50Step44CameraAttempt({
    outputPath,
    expectedSearchAttemptCommitment: receipt.cameraSearchAttemptCommitment,
    expectedCameraReceiptCommitment: receipt.commitment,
    reviewBatch: batch,
    source: createRealBuildPrefix50Step44PersistedCameraSemanticSource(source),
    realDomainQualification,
  });
  const verifiedAttempt = requireRealBuildPrefix50Step44VerifiedPersistedCameraAttempt({
    proof: persistedProof,
    outputPath,
    reviewBatchEnvelopeCommitment: batch.commitment,
    cameraReceiptCommitment: receipt.commitment,
    searchAttemptCommitment: receipt.cameraSearchAttemptCommitment,
  });
  assertRealBuildPrefix50Step44CameraOnlyVerifiedAttemptBinding({
    receipt,
    attempt: verifiedAttempt.searchAttempt,
    expectedRenderCount: decision.renderCount,
    expectedTotalCaptureCount: decision.totalCaptureCount,
  });
  await assertRealBuildPrefix50Step44CameraOnlyInstrumentArtifacts({
    outputPath,
    receipt,
    sourceRgba: source.rgba,
    eligibleMask: source.eligibleMask,
    targetMask: source.parentOnlyForegroundMask,
  });
  const selectedIdentity = await assertRealBuildPrefix50Step44SelectedCameraPngIdentity({
    outputPath,
    receipt,
  });
  const overlays = await createRealBuildPrefix50Step44CameraOnlyOverlays({
    outputPath,
    receipt,
    sourceRgba: source.rgba,
    eligibleMask: source.eligibleMask,
    targetMask: source.parentOnlyForegroundMask,
  });
  const branchRows = createRealBuildPrefix50Step44CameraOnlyBranchRows(
    verifiedAttempt.searchAttempt,
  );
  const manifestBody = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-only-gate-manifest/2" as const,
    authority: "none" as const,
    status: "complete" as const,
    promotionAuthority: false as const,
    dataExclusionPolicy:
      "page45-and-shared-step43-parent-only-no-candidate-no-step45-no-page46" as const,
    outputDirectory: outputName,
    input: {
      artifactFile: relative(repositoryRoot, inputPath).replaceAll("\\", "/"),
      byteDigest: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_BYTES_HASH,
      reviewBatchEnvelopeCommitment: batch.commitment,
      sourceCandidateCount: batch.candidateCount,
      renderedCandidateCount: 0,
      candidateRenderCallbackProvided: false,
    },
    source: {
      artifactPath: source.sourcePdfArtifactPath,
      pdfDigest: source.sourcePdfDigest,
      firstPrintedStep: source.panelFacePrefixEvidence.firstPrintedStep,
      lastPrintedStep: source.panelFacePrefixEvidence.lastPrintedStep,
      coveredPageCeiling: source.panelFacePrefixEvidence.coveredPageCeiling,
      page46ReadableBySourceAdapter: false,
      expectedPanelFace: source.expectedPanelFace,
      page45CropArtifactFile: receipt.instrumentArtifacts.page45Crop.artifactFile,
      eligibleMaskArtifactFile: receipt.instrumentArtifacts.eligibleParentRegionMask.artifactFile,
      parentTargetMaskArtifactFile: receipt.instrumentArtifacts.parentOnlyTargetMask.artifactFile,
    },
    sharedParent: {
      partCount: parent.parentDocument.parts.length,
      stepCount: parent.parentDocument.steps.length,
      documentHash: parent.parentHash,
      documentCommitment: canonicalDigest(parent.parentDocument),
      observedRenderCallCount: probe.calls.length,
      observedPartCounts: [257],
    },
    decision,
    thresholds: receipt.searchThresholds,
    metricCalibration: receipt.metricCalibration,
    metricCalibrationCommitment: receipt.metricCalibrationCommitment,
    geometrySelectionCommitment: receipt.geometrySelectionCommitment,
    featureCorroborationCommitment: receipt.featureCorroborationCommitment,
    cameraReceiptCommitment: receipt.commitment,
    persistedSemanticProof: persistedProof,
    realDomainQualification,
    sourceLock,
    selectedIdentity,
    branchRows,
    overlays,
    cleanup: lifecycle.cleanup,
  };
  const manifest = Object.freeze({
    ...manifestBody,
    commitment: canonicalDigest(manifestBody),
  });
  assertRealBuildPrefix50Step44CameraOnlyManifestSourceLock({
    manifest,
    expectedSourceLock: sourceLock,
  });
  await writeRealBuildPrefix50Step44CameraOnlyManifest({ outputPath, manifest });
  await assertRealBuildPrefix50Step44CameraOnlyCompleteManifest({
    outputPath,
    expectedManifest: manifest,
  });
  await assertRealBuildPrefix50Step44CameraOnlyOutputTree(
    outputPath,
    "complete",
    verifiedAttempt.actualRenderArtifactFiles,
    overlays.map(({ overlayFile }) => overlayFile),
  );
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(identity);
  return Object.freeze({ outputPath, manifestCommitment: manifest.commitment });
}
