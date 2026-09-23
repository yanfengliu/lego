import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  verifyPersistedRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence,
} from "./real-build-prefix50-step44-panel-face-prefix.ts";
import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import type { RealBuildPrefix50Step44CaptureManifestV3 } from "./real-build-prefix50-subbuild-return-review-artifact-contract.ts";
import type { RealBuildPrefix50Step44CandidateCaptureSummary } from "./real-build-prefix50-subbuild-return-review-capture.ts";
import type { RealBuildPrefix50Step44VerifiedPersistedCameraAttempt } from "./real-build-prefix50-subbuild-return-review-camera-attempt.ts";
import { requireRealBuildPrefix50Step44SharedPersistedCameraAttempt } from "./real-build-prefix50-subbuild-return-review-contact-sheet-camera-attempt.ts";
import { verifyRealBuildPrefix50Step44FixedCameraDeltaArtifact } from "./real-build-prefix50-subbuild-return-review-contact-sheet-delta.ts";
import {
  commitRealBuildPrefix50Step44PanelCrop,
  commitRealBuildPrefix50Step44SourcePageRaster,
} from "./real-build-prefix50-subbuild-return-review-camera-source-commitments.ts";

export { verifyRealBuildPrefix50Step44PersistedParentOnlyRegion } from "./real-build-prefix50-subbuild-return-review-contact-sheet-camera-attempt.ts";

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

type PersistedCameraSourceBinding = Pick<
  RealBuildPrefix50Step44CaptureManifestV3["page45CameraReceipt"],
  | "expectedPanelFace"
  | "panelCropCommitment"
  | "panelFacePrefixEvidence"
  | "panelFacePrefixEvidenceCommitment"
  | "panelPixelDigest"
  | "parentOnlyRegion"
  | "rendererVersion"
  | "sourceKind"
  | "sourcePagePixelDigest"
  | "sourcePagePngDigest"
  | "sourcePageRasterCommitment"
  | "sourcePdfArtifactPath"
  | "sourcePdfDigest"
>;

export function verifyRealBuildPrefix50Step44PersistedCameraSourceBinding(
  receipt: PersistedCameraSourceBinding,
): void {
  const evidence = verifyPersistedRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(
    receipt.panelFacePrefixEvidence,
  );
  const sourcePageRasterCommitment = commitRealBuildPrefix50Step44SourcePageRaster(receipt);
  const panelCropCommitment = commitRealBuildPrefix50Step44PanelCrop({
    sourcePageRasterCommitment: receipt.sourcePageRasterCommitment,
    panelPixelDigest: receipt.panelPixelDigest,
    parentOnlyRegionCommitment: receipt.parentOnlyRegion.commitment,
    panelFacePrefixEvidenceCommitment: receipt.panelFacePrefixEvidenceCommitment,
    expectedPanelFace: receipt.expectedPanelFace,
  });
  if (
    receipt.sourceKind !== "repository-runtime" ||
    receipt.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    receipt.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    evidence.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    evidence.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    receipt.expectedPanelFace !== "studs-up" ||
    receipt.panelFacePrefixEvidenceCommitment !== evidence.commitment ||
    receipt.sourcePageRasterCommitment !== sourcePageRasterCommitment ||
    receipt.panelCropCommitment !== panelCropCommitment
  )
    throw new TypeError(
      "Persisted Step-44 repository camera source did not reproduce its exact PDF face, page-raster, and panel-crop commitments.",
    );
}

export function verifyRealBuildPrefix50Step44ContactSheetCameraBindings(input: {
  readonly outputPath: string;
  readonly blindId: `B${string}`;
  readonly artifactDirectory: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly capture: RealBuildPrefix50Step44CandidateCaptureSummary;
  readonly manifest: RealBuildPrefix50Step44CaptureManifestV3;
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly verifiedSharedCameraAttempt: RealBuildPrefix50Step44VerifiedPersistedCameraAttempt;
  readonly page45Reference: Readonly<{
    readonly rendererVersion: string;
    readonly sourcePdfDigest: `sha256:${string}`;
    readonly sourcePagePngDigest: `sha256:${string}`;
    readonly sourcePagePixelDigest: `sha256:${string}`;
    readonly pixelDigest: `sha256:${string}`;
  }>;
}): void {
  const { batch, capture, manifest: v3 } = input;
  exactKeys(
    v3.page45CameraReceipt,
    [
      "authority",
      "branchMeasurements",
      "branchMeasurementsCommitment",
      "branchWinnerMargin",
      "cameraSearchAttemptCommitment",
      "candidateRosterCommitment",
      "commitment",
      "dataExclusionPolicy",
      "excludedChildPartIds",
      "excludedChildPartIdsCommitment",
      "expectedPanelFace",
      "featureCorroboration",
      "featureCorroborationCommitment",
      "geometrySelection",
      "geometrySelectionCommitment",
      "instrumentArtifacts",
      "instrumentArtifactsCommitment",
      "latticeFit",
      "measurementCommitment",
      "panelCropCommitment",
      "panelFacePrefixEvidence",
      "panelFacePrefixEvidenceCommitment",
      "panelPixelDigest",
      "parentOnlyRegion",
      "rendererVersion",
      "returnResultCommitment",
      "reviewBatchEnvelopeCommitment",
      "reviewReplayBaseDocumentCommitment",
      "schemaVersion",
      "searchThresholds",
      "selectedBranchKey",
      "selectedCameraCommitment",
      "selectedFrame",
      "selectedIntersectionOverUnion",
      "selectedAlignmentPassCount",
      "selectedParameters",
      "selectedParentPixelDigest",
      "selectedParentPngDigest",
      "selectedRendererCameraCommitment",
      "sharedParentDocumentCommitment",
      "sharedParentDocumentHash",
      "sourceDocumentHash",
      "sourceKind",
      "sourcePagePixelDigest",
      "sourcePagePngDigest",
      "sourcePageRasterCommitment",
      "sourcePdfArtifactPath",
      "sourcePdfDigest",
      "sourceSetId",
    ],
    `Step-44 ${input.blindId} page-45 camera receipt`,
  );
  exactKeys(
    v3.fixedCameraAfter,
    [
      "cameraCommitment",
      "candidateKey",
      "commitment",
      "completedPrintedStep",
      "documentHash",
      "height",
      "page45CameraReceiptCommitment",
      "pixelDigest",
      "pngByteLength",
      "pngDigest",
      "reviewHarnessEnvelopeCommitment",
      "scene",
      "schemaVersion",
      "selectedDocumentCommitment",
      "width",
    ],
    `Step-44 ${input.blindId} fixed-camera after`,
  );
  exactKeys(
    v3.fixedCameraDelta,
    [
      "afterCommitment",
      "afterPixelDigest",
      "afterPngDigest",
      "authority",
      "baselineCommitment",
      "baselinePixelDigest",
      "baselinePngDigest",
      "cameraCommitment",
      "candidateKey",
      "changedPixelBounds",
      "changedPixelCount",
      "commitment",
      "page45CameraReceiptCommitment",
      "reviewHarnessEnvelopeCommitment",
      "scene",
      "schemaVersion",
      "selectedDocumentCommitment",
      "selectedDocumentHash",
    ],
    `Step-44 ${input.blindId} fixed-camera delta`,
  );
  const persistedCameraAttempt = requireRealBuildPrefix50Step44SharedPersistedCameraAttempt({
    proof: input.verifiedSharedCameraAttempt,
    outputPath: input.outputPath,
    batch,
    receipt: v3.page45CameraReceipt,
  });
  verifyRealBuildPrefix50Step44FixedCameraDeltaArtifact({
    outputPath: input.outputPath,
    artifactDirectory: input.artifactDirectory,
    blindId: input.blindId,
    artifact: v3.fixedCameraDeltaArtifact,
    candidateKey: input.candidateKey,
    selectedDocumentHash: input.selectedDocumentHash,
    selectedDocumentCommitment: input.selectedDocumentCommitment,
    reviewHarnessEnvelopeCommitment: input.reviewHarnessEnvelopeCommitment,
    page45CameraReceiptCommitment: v3.page45CameraReceiptCommitment,
    cameraCommitment: v3.fixedCameraAfter.cameraCommitment,
    baselineCommitment: v3.fixedCameraBaselineCommitment,
    afterCommitment: v3.fixedCameraAfter.commitment,
    deltaCommitment: v3.fixedCameraDelta.commitment,
    summaryCommitment: capture.fixedCameraDeltaArtifactCommitment,
  });
  verifyRealBuildPrefix50Step44PersistedCameraSourceBinding(v3.page45CameraReceipt);
  if (
    capture.schemaVersion !== "lego.real-build-prefix50-step44-candidate-capture-summary/3" ||
    capture.scene !== "model-only" ||
    v3.captureScene !== "model-only" ||
    v3.captureSceneCommitment !==
      canonicalDigest({
        scene: "model-only",
        canonicalCapturePolicyHash: v3.canonicalCapturePolicyHash,
        viewPacketCommitment: v3.viewPacketCommitment,
        capturesCommitment: canonicalDigest(v3.captures),
      }) ||
    capture.captureSceneCommitment !== v3.captureSceneCommitment ||
    v3.page45CameraReceipt.commitment !==
      canonicalDigest(withoutCommitment(v3.page45CameraReceipt)) ||
    v3.page45CameraReceipt.dataExclusionPolicy !==
      "page45-and-shared-step43-parent-only-no-candidate-no-step45-no-page46" ||
    v3.page45CameraReceipt.sourcePdfDigest !== input.page45Reference.sourcePdfDigest ||
    v3.page45CameraReceipt.rendererVersion !== input.page45Reference.rendererVersion ||
    v3.page45CameraReceipt.sourcePagePngDigest !== input.page45Reference.sourcePagePngDigest ||
    v3.page45CameraReceipt.sourcePagePixelDigest !== input.page45Reference.sourcePagePixelDigest ||
    v3.page45CameraReceipt.panelPixelDigest !== input.page45Reference.pixelDigest ||
    v3.page45CameraReceipt.sourceDocumentHash !== batch.sourceDocumentHash ||
    v3.page45CameraReceipt.reviewBatchEnvelopeCommitment !== batch.commitment ||
    v3.page45CameraReceipt.returnResultCommitment !== batch.returnResultCommitment ||
    v3.page45CameraReceipt.candidateRosterCommitment !== batch.candidateRosterCommitment ||
    v3.page45CameraReceipt.reviewReplayBaseDocumentCommitment !==
      batch.reviewReplayBaseDocumentCommitment ||
    v3.page45CameraReceipt.excludedChildPartIds.length !==
      batch.enumerationReceipt.childPartIds.length ||
    v3.page45CameraReceipt.excludedChildPartIds.some(
      (id, index) => id !== batch.enumerationReceipt.childPartIds[index],
    ) ||
    v3.page45CameraReceipt.excludedChildPartIdsCommitment !==
      canonicalDigest(v3.page45CameraReceipt.excludedChildPartIds) ||
    v3.page45CameraReceipt.branchMeasurementsCommitment !==
      canonicalDigest(v3.page45CameraReceipt.branchMeasurements) ||
    v3.page45CameraReceipt.geometrySelectionCommitment !==
      v3.page45CameraReceipt.geometrySelection.commitment ||
    v3.page45CameraReceipt.geometrySelection.commitment !==
      canonicalDigest(withoutCommitment(v3.page45CameraReceipt.geometrySelection)) ||
    v3.page45CameraReceipt.featureCorroborationCommitment !==
      v3.page45CameraReceipt.featureCorroboration.commitment ||
    v3.page45CameraReceipt.featureCorroboration.commitment !==
      canonicalDigest(withoutCommitment(v3.page45CameraReceipt.featureCorroboration)) ||
    v3.page45CameraReceipt.geometrySelection.selectedBranchKey !==
      v3.page45CameraReceipt.selectedBranchKey ||
    v3.page45CameraReceipt.featureCorroboration.selectedBranchKey !==
      v3.page45CameraReceipt.selectedBranchKey ||
    !v3.page45CameraReceipt.geometrySelection.passed ||
    !v3.page45CameraReceipt.featureCorroboration.passed ||
    persistedCameraAttempt.searchAttempt.status !== "resolved" ||
    persistedCameraAttempt.searchAttempt.branchMeasurementsCommitment !==
      v3.page45CameraReceipt.branchMeasurementsCommitment ||
    persistedCameraAttempt.searchAttempt.geometrySelectionCommitment !==
      v3.page45CameraReceipt.geometrySelectionCommitment ||
    persistedCameraAttempt.searchAttempt.featureCorroborationCommitment !==
      v3.page45CameraReceipt.featureCorroborationCommitment ||
    persistedCameraAttempt.context.sourcePdfDigest !== v3.page45CameraReceipt.sourcePdfDigest ||
    persistedCameraAttempt.context.sourcePageRasterCommitment !==
      v3.page45CameraReceipt.sourcePageRasterCommitment ||
    persistedCameraAttempt.context.panelCropCommitment !==
      v3.page45CameraReceipt.panelCropCommitment ||
    persistedCameraAttempt.context.panelFacePrefixEvidenceCommitment !==
      v3.page45CameraReceipt.panelFacePrefixEvidenceCommitment ||
    persistedCameraAttempt.context.expectedPanelFace !== v3.page45CameraReceipt.expectedPanelFace ||
    persistedCameraAttempt.context.parentOnlyRegionCommitment !==
      v3.page45CameraReceipt.parentOnlyRegion.commitment ||
    persistedCameraAttempt.context.reviewBatchEnvelopeCommitment !== batch.commitment ||
    persistedCameraAttempt.context.returnResultCommitment !== batch.returnResultCommitment ||
    persistedCameraAttempt.context.candidateRosterCommitment !== batch.candidateRosterCommitment ||
    persistedCameraAttempt.context.sourceDocumentHash !== batch.sourceDocumentHash ||
    persistedCameraAttempt.context.sharedParentDocumentHash !==
      v3.page45CameraReceipt.sharedParentDocumentHash ||
    persistedCameraAttempt.context.sharedParentDocumentCommitment !==
      v3.page45CameraReceipt.sharedParentDocumentCommitment ||
    v3.page45CameraReceipt.instrumentArtifactsCommitment !==
      canonicalDigest(v3.page45CameraReceipt.instrumentArtifacts) ||
    v3.page45CameraReceipt.measurementCommitment !==
      canonicalDigest({
        panelFacePrefixEvidenceCommitment: v3.page45CameraReceipt.panelFacePrefixEvidenceCommitment,
        expectedPanelFace: v3.page45CameraReceipt.expectedPanelFace,
        parentOnlyRegionCommitment: v3.page45CameraReceipt.parentOnlyRegion.commitment,
        latticeFit: v3.page45CameraReceipt.latticeFit,
        branchMeasurementsCommitment: v3.page45CameraReceipt.branchMeasurementsCommitment,
        cameraSearchAttemptCommitment: v3.page45CameraReceipt.cameraSearchAttemptCommitment,
        geometrySelectionCommitment: v3.page45CameraReceipt.geometrySelectionCommitment,
        featureCorroborationCommitment: v3.page45CameraReceipt.featureCorroborationCommitment,
        selectedCameraCommitment: v3.page45CameraReceipt.selectedCameraCommitment,
        selectedRendererCameraCommitment: v3.page45CameraReceipt.selectedRendererCameraCommitment,
      }) ||
    v3.page45CameraReceipt.instrumentArtifacts.page45Crop.pixelDigest !==
      input.page45Reference.pixelDigest ||
    v3.page45CameraReceiptCommitment !== v3.page45CameraReceipt.commitment ||
    capture.page45CameraReceiptCommitment !== v3.page45CameraReceiptCommitment ||
    capture.fixedCameraBaselineCommitment !== v3.fixedCameraBaselineCommitment ||
    v3.fixedCameraAfter.commitment !== canonicalDigest(withoutCommitment(v3.fixedCameraAfter)) ||
    v3.fixedCameraAfter.completedPrintedStep !== 44 ||
    v3.fixedCameraAfter.candidateKey !== input.candidateKey ||
    v3.fixedCameraAfter.documentHash !== input.selectedDocumentHash ||
    v3.fixedCameraAfter.selectedDocumentCommitment !== input.selectedDocumentCommitment ||
    v3.fixedCameraAfter.reviewHarnessEnvelopeCommitment !== input.reviewHarnessEnvelopeCommitment ||
    v3.fixedCameraAfter.page45CameraReceiptCommitment !== v3.page45CameraReceiptCommitment ||
    v3.fixedCameraAfter.cameraCommitment !== v3.page45CameraReceipt.selectedCameraCommitment ||
    capture.fixedCameraAfterCommitment !== v3.fixedCameraAfter.commitment ||
    v3.fixedCameraDelta.commitment !== canonicalDigest(withoutCommitment(v3.fixedCameraDelta)) ||
    v3.fixedCameraDelta.candidateKey !== input.candidateKey ||
    v3.fixedCameraDelta.selectedDocumentHash !== input.selectedDocumentHash ||
    v3.fixedCameraDelta.selectedDocumentCommitment !== input.selectedDocumentCommitment ||
    v3.fixedCameraDelta.reviewHarnessEnvelopeCommitment !== input.reviewHarnessEnvelopeCommitment ||
    v3.fixedCameraDelta.page45CameraReceiptCommitment !== v3.page45CameraReceiptCommitment ||
    v3.fixedCameraDelta.cameraCommitment !== v3.fixedCameraAfter.cameraCommitment ||
    v3.fixedCameraDelta.baselineCommitment !== v3.fixedCameraBaselineCommitment ||
    v3.fixedCameraDelta.afterCommitment !== v3.fixedCameraAfter.commitment ||
    v3.fixedCameraDelta.afterPngDigest !== v3.fixedCameraAfter.pngDigest ||
    v3.fixedCameraDelta.afterPixelDigest !== v3.fixedCameraAfter.pixelDigest ||
    v3.fixedCameraDelta.baselinePngDigest !== v3.page45CameraReceipt.selectedParentPngDigest ||
    v3.fixedCameraDelta.baselinePixelDigest !== v3.page45CameraReceipt.selectedParentPixelDigest ||
    capture.fixedCameraDeltaCommitment !== v3.fixedCameraDelta.commitment ||
    canonicalDigest(capture.captureRows) !== canonicalDigest(v3.captures)
  )
    throw new TypeError(
      `Step-44 ${input.blindId} page-45 camera, model-only scene, after frame, or fixed-camera delta drifted.`,
    );
}
