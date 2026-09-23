import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { relative } from "node:path";

import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import {
  deriveBrickScene,
  instructionViewFrame,
  type OrthographicViewFrame,
  type OrthographicViewParameters,
} from "@lego-studio/rendering";
import type { Page } from "playwright";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  renderRealBuildPrefix50Step44SemanticColorMaskInApp,
  renderRealBuildPrefix50Step44SharedParentInApp,
  seedRealBuildPrefix50Step44SharedParentInApp,
} from "./real-build-prefix50-subbuild-return-review-camera-app.ts";
import { persistRealBuildPrefix50Step44CameraAttempt } from "./real-build-prefix50-subbuild-return-review-camera-attempt-persistence.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
} from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import {
  createRealBuildPrefix50Step43FixedCameraBaselineArtifact,
  createRealBuildPrefix50Step43FixedCameraBaseline,
  type RealBuildPrefix50Step43FixedCameraBaselineArtifact,
  type RealBuildPrefix50Step44FixedCameraPixels,
} from "./real-build-prefix50-subbuild-return-review-fixed-camera.ts";
import {
  loadRealBuildPrefix50Step44RepositoryPage45CameraSource,
  requireRealBuildPrefix50Step44BrandedPage45CameraSource,
  type RealBuildPrefix50Step44BrandedPage45Source,
} from "./real-build-prefix50-subbuild-return-review-camera-source.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-source-commitments.ts";
import {
  searchRealBuildPrefix50Step44ParentCamera,
  type RealBuildPrefix50Step44CameraRenderEvidence,
  type RealBuildPrefix50Step44CameraSearchAttemptEvidence,
} from "./real-build-prefix50-subbuild-return-review-camera-search.ts";
import type { RealBuildPrefix50Step44Page45CameraReceipt } from "./real-build-prefix50-subbuild-return-review-camera-receipt-types.ts";
import {
  deriveRealBuildPrefix50Step44SemanticColorPolicy,
  type RealBuildPrefix50Step44SemanticColorPolicy,
  type RealBuildPrefix50Step44SemanticColorRenderEvidence,
} from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import {
  requireRealBuildPrefix50Step44RealDomainQualificationBinding,
  type RealBuildPrefix50Step44RealDomainQualificationBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { deriveRealBuildPrefix50Step44PreregisteredCameraBranches } from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
import { renderRealBuildPrefix50Step44CameraMask } from "./real-build-prefix50-subbuild-return-review-camera-mask-render.ts";
import { exactParent } from "./real-build-prefix50-subbuild-return-review-camera-parent.ts";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write.ts";
import { issueRealBuildPrefix50Step44LaterSourceReadCapability } from "./real-build-prefix50-step44-later-source-authority.ts";

export type {
  RealBuildPrefix50Step44CameraBranchKey,
  RealBuildPrefix50Step44ParentCameraMeasurement,
} from "./real-build-prefix50-subbuild-return-review-camera-search.ts";
export type { RealBuildPrefix50Step44Page45CameraReceipt } from "./real-build-prefix50-subbuild-return-review-camera-receipt-types.ts";
export { renderRealBuildPrefix50Step44CameraMask } from "./real-build-prefix50-subbuild-return-review-camera-mask-render.ts";
export { exactParent } from "./real-build-prefix50-subbuild-return-review-camera-parent.ts";

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function pngFromRgba(rgba: Uint8Array): Uint8Array {
  return encodeCanonicalRealBuildPrefix50Step44ReviewPng({
    width: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
    height: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
    rgba,
  });
}

export const cameraBranches = deriveRealBuildPrefix50Step44PreregisteredCameraBranches;

async function deriveReceipt(input: {
  source: RealBuildPrefix50Step44BrandedPage45Source;
  reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
  render: (
    parameters: OrthographicViewParameters,
    frame: OrthographicViewFrame,
  ) => Promise<RealBuildPrefix50Step44CameraRenderEvidence>;
  renderSemantic: (
    parameters: OrthographicViewParameters,
    frame: OrthographicViewFrame,
    policy: RealBuildPrefix50Step44SemanticColorPolicy,
  ) => Promise<RealBuildPrefix50Step44SemanticColorRenderEvidence>;
  attemptSink: (
    evidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence,
  ) => Promise<void> | void;
}): Promise<{
  receipt: RealBuildPrefix50Step44Page45CameraReceipt;
  artifactBytes: Readonly<Record<string, Uint8Array>>;
  selectedControlRender: RealBuildPrefix50Step44CameraRenderEvidence;
}> {
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.reviewBatch);
  const realDomainQualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.realDomainQualification,
  );
  if (realDomainQualification.reviewBatchEnvelopeCommitment !== batch.commitment)
    throw new TypeError(
      "Step-44 page-45 camera derivation requires real-domain qualification of the same exact 211-row batch before any render or attempt callback.",
    );
  const source = requireRealBuildPrefix50Step44BrandedPage45CameraSource(input.source);
  const { parentDocument, parentHash, childIds } = exactParent({
    reviewReplayBaseDocument: batch.reviewReplayBaseDocument,
    childPartIds: batch.enumerationReceipt.childPartIds,
    sourceDocumentHash: batch.sourceDocumentHash,
  });
  const scene = deriveBrickScene(parentDocument, { finish: "instruction" });
  const semanticColorPolicy = deriveRealBuildPrefix50Step44SemanticColorPolicy(parentDocument);
  const frame = instructionViewFrame(
    scene.bounds,
    REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
    REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
  );
  scene.dispose();
  const search = await searchRealBuildPrefix50Step44ParentCamera({
    branches: cameraBranches(source.latticeFit.solution),
    expectedPanelFace: source.expectedPanelFace,
    sourceRgba: source.rgba,
    frame,
    parentOnlyTargetMask: source.parentOnlyForegroundMask,
    eligibleMask: source.eligibleMask,
    render: input.render,
    semanticPolicy: semanticColorPolicy,
    renderSemantic: input.renderSemantic,
    attemptSink: input.attemptSink,
  });
  const artifactPixels = {
    page45Crop: source.rgba,
    eligibleParentRegionMask: renderRealBuildPrefix50Step44CameraMask(
      source.eligibleMask,
      "eligible-parent-region",
    ),
    parentOnlyTargetMask: renderRealBuildPrefix50Step44CameraMask(
      source.parentOnlyForegroundMask,
      "parent-only-target",
    ),
    selectedParentControlRender: search.selectedControlRender.rgba,
  };
  const artifactBytes = {
    "real-build-prefix50-step44-page45-camera-source-crop.png": pngFromRgba(
      artifactPixels.page45Crop,
    ),
    "real-build-prefix50-step44-page45-camera-eligible-mask.png": pngFromRgba(
      artifactPixels.eligibleParentRegionMask,
    ),
    "real-build-prefix50-step44-page45-camera-parent-target-mask.png": pngFromRgba(
      artifactPixels.parentOnlyTargetMask,
    ),
    "real-build-prefix50-step44-page45-camera-selected-parent.png":
      search.selectedControlRender.pngBytes,
  };
  const artifactRow = (artifactFile: keyof typeof artifactBytes, pixels: Uint8Array) => {
    const row = {
      artifactFile,
      width: 720 as const,
      height: 470 as const,
      pngDigest: sha256(artifactBytes[artifactFile]),
      pixelDigest: sha256(pixels),
    };
    return deepFreeze({ ...row, commitment: canonicalDigest(row) });
  };
  const instrumentArtifacts = deepFreeze({
    page45Crop: artifactRow(
      "real-build-prefix50-step44-page45-camera-source-crop.png",
      artifactPixels.page45Crop,
    ),
    eligibleParentRegionMask: artifactRow(
      "real-build-prefix50-step44-page45-camera-eligible-mask.png",
      artifactPixels.eligibleParentRegionMask,
    ),
    parentOnlyTargetMask: artifactRow(
      "real-build-prefix50-step44-page45-camera-parent-target-mask.png",
      artifactPixels.parentOnlyTargetMask,
    ),
    selectedParentControlRender: artifactRow(
      "real-build-prefix50-step44-page45-camera-selected-parent.png",
      artifactPixels.selectedParentControlRender,
    ),
  });
  const instrumentArtifactsCommitment = canonicalDigest(instrumentArtifacts);
  const measurementCommitment = canonicalDigest({
    panelFacePrefixEvidenceCommitment: source.panelFacePrefixEvidenceCommitment,
    expectedPanelFace: source.expectedPanelFace,
    parentOnlyRegionCommitment: source.parentOnlyRegion.commitment,
    latticeFit: source.latticeFit,
    branchMeasurementsCommitment: search.branchMeasurementsCommitment,
    cameraSearchAttemptCommitment: search.attempt.commitment,
    geometrySelectionCommitment: search.geometrySelectionCommitment,
    featureCorroborationCommitment: search.featureCorroborationCommitment,
    semanticColorPolicyCommitment: semanticColorPolicy.commitment,
    metricCalibrationCommitment: REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
    selectedCameraCommitment: search.selectedCameraCommitment,
    selectedRendererCameraCommitment: search.selectedRendererCameraCommitment,
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-page45-camera/3" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    sourceKind:
      source.sourcePdfArtifactPath === "recipes/6651557.pdf"
        ? ("repository-runtime" as const)
        : ("synthetic-test" as const),
    sourcePdfArtifactPath: source.sourcePdfArtifactPath,
    sourcePdfDigest: source.sourcePdfDigest,
    rendererVersion: source.rendererVersion,
    sourcePagePngDigest: source.sourcePagePngDigest,
    sourcePageRasterCommitment: source.sourcePageRasterCommitment,
    sourcePagePixelDigest: source.sourcePagePixelDigest,
    panelFacePrefixEvidence: source.panelFacePrefixEvidence,
    panelFacePrefixEvidenceCommitment: source.panelFacePrefixEvidenceCommitment,
    expectedPanelFace: source.expectedPanelFace,
    panelCropCommitment: source.panelCropCommitment,
    panelPixelDigest: source.panelPixelDigest,
    reviewBatchEnvelopeCommitment: batch.commitment,
    returnResultCommitment: batch.returnResultCommitment,
    candidateRosterCommitment: batch.candidateRosterCommitment,
    sourceDocumentHash: batch.sourceDocumentHash,
    reviewReplayBaseDocumentCommitment: batch.reviewReplayBaseDocumentCommitment,
    sharedParentDocumentHash: parentHash,
    sharedParentDocumentCommitment: canonicalDigest(parentDocument),
    excludedChildPartIds: childIds,
    excludedChildPartIdsCommitment: canonicalDigest(childIds),
    dataExclusionPolicy:
      "page45-and-shared-step43-parent-only-no-candidate-no-step45-no-page46" as const,
    parentOnlyRegion: source.parentOnlyRegion,
    latticeFit: source.latticeFit,
    semanticColorPolicy,
    semanticColorPolicyCommitment: semanticColorPolicy.commitment,
    metricCalibration: REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION,
    metricCalibrationCommitment: REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
    branchMeasurements: search.branchMeasurements,
    branchMeasurementsCommitment: search.branchMeasurementsCommitment,
    cameraSearchAttemptCommitment: search.attempt.commitment,
    geometrySelection: search.geometrySelection,
    geometrySelectionCommitment: search.geometrySelectionCommitment,
    featureCorroboration: search.featureCorroboration,
    featureCorroborationCommitment: search.featureCorroborationCommitment,
    selectedBranchKey: search.selectedBranchKey,
    selectedParameters: search.selectedParameters,
    selectedFrame: search.selectedFrame,
    selectedCameraCommitment: search.selectedCameraCommitment,
    selectedRendererCameraCommitment: search.selectedRendererCameraCommitment,
    selectedParentPngDigest: search.selectedParentPngDigest,
    selectedParentPixelDigest: search.selectedParentPixelDigest,
    selectedIntersectionOverUnion: search.selectedIntersectionOverUnion,
    branchWinnerMargin: search.branchWinnerMargin,
    selectedAlignmentPassCount: search.selectedAlignmentPassCount,
    searchThresholds: search.thresholds,
    instrumentArtifacts,
    instrumentArtifactsCommitment,
    measurementCommitment,
  };
  return {
    receipt: deepFreeze({ ...body, commitment: canonicalDigest(body) }),
    artifactBytes,
    selectedControlRender: search.selectedControlRender,
  };
}

export interface RealBuildPrefix50Step44Page45CameraProductionInput {
  readonly page: Page;
  readonly repositoryRoot: string;
  readonly outputPath: string;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}

type DerivedStep44Camera = Awaited<ReturnType<typeof deriveReceipt>>;

async function persistDerivedCamera(
  outputPath: string,
  derived: DerivedStep44Camera,
  realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding,
): Promise<void> {
  const qualification =
    requireRealBuildPrefix50Step44RealDomainQualificationBinding(realDomainQualification);
  if (qualification.reviewBatchEnvelopeCommitment !== derived.receipt.reviewBatchEnvelopeCommitment)
    throw new TypeError(
      "Step-44 page-45 camera artifact persistence requires qualification of the derived receipt's exact review batch.",
    );
  const [realRoot, realOutput] = await Promise.all([
    realpath(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT),
    realpath(outputPath),
  ]);
  const local = relative(realRoot, realOutput);
  if (local.length === 0 || local.startsWith(".."))
    throw new TypeError("Step-44 camera evidence output must be a real child of its task root.");
  const outputIdentity = await lstat(realOutput, { bigint: true });
  for (const [artifactFile, bytes] of Object.entries(derived.artifactBytes)) {
    const current = await lstat(realOutput, { bigint: true });
    if (
      current.isSymbolicLink() ||
      !current.isDirectory() ||
      current.ino !== outputIdentity.ino ||
      (current.dev !== 0n && outputIdentity.dev !== 0n && current.dev !== outputIdentity.dev)
    )
      throw new TypeError("Step-44 camera evidence output identity changed during publication.");
    writeContainedRegularFileAtomic(realOutput, artifactFile, bytes, {
      label: `Step-44 camera evidence artifact ${artifactFile}`,
    });
  }
}

async function deriveProductionCamera(input: RealBuildPrefix50Step44Page45CameraProductionInput) {
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.reviewBatch);
  const realDomainQualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.realDomainQualification,
  );
  if (realDomainQualification.reviewBatchEnvelopeCommitment !== batch.commitment)
    throw new TypeError(
      "Step-44 page-45 camera requires real-domain qualification of the same exact 211-row batch.",
    );
  const { parentDocument, parentHash } = exactParent({
    reviewReplayBaseDocument: batch.reviewReplayBaseDocument,
    childPartIds: batch.enumerationReceipt.childPartIds,
    sourceDocumentHash: batch.sourceDocumentHash,
  });
  const semanticColorPolicy = deriveRealBuildPrefix50Step44SemanticColorPolicy(parentDocument);
  const source = await loadRealBuildPrefix50Step44RepositoryPage45CameraSource({
    panelFaceCapability: issueRealBuildPrefix50Step44LaterSourceReadCapability({
      repositoryRoot: input.repositoryRoot,
      qualification: realDomainQualification,
      purpose: "page45-step44-vector",
      physicalPageNumber: 45,
    }),
    rasterCapability: issueRealBuildPrefix50Step44LaterSourceReadCapability({
      repositoryRoot: input.repositoryRoot,
      qualification: realDomainQualification,
      purpose: "page45-camera-raster",
      physicalPageNumber: 45,
    }),
  });
  await seedRealBuildPrefix50Step44SharedParentInApp(input.page, parentDocument);
  const derived = await deriveReceipt({
    source,
    reviewBatch: batch,
    realDomainQualification,
    render: (parameters, frame) =>
      renderRealBuildPrefix50Step44SharedParentInApp(input.page, parameters, frame),
    renderSemantic: (parameters, frame, policy) =>
      renderRealBuildPrefix50Step44SemanticColorMaskInApp(input.page, parameters, frame, policy),
    attemptSink: (evidence) =>
      persistRealBuildPrefix50Step44CameraAttempt({
        outputPath: input.outputPath,
        context: {
          sourcePdfDigest: source.sourcePdfDigest,
          sourcePageRasterCommitment: source.sourcePageRasterCommitment,
          panelCropCommitment: source.panelCropCommitment,
          panelFacePrefixEvidenceCommitment: source.panelFacePrefixEvidenceCommitment,
          expectedPanelFace: source.expectedPanelFace,
          parentOnlyRegionCommitment: source.parentOnlyRegion.commitment,
          reviewBatchEnvelopeCommitment: batch.commitment,
          returnResultCommitment: batch.returnResultCommitment,
          candidateRosterCommitment: batch.candidateRosterCommitment,
          sourceDocumentHash: batch.sourceDocumentHash,
          sharedParentDocumentHash: parentHash,
          sharedParentDocumentCommitment: canonicalDigest(parentDocument),
          semanticColorPolicyCommitment: semanticColorPolicy.commitment,
          metricCalibrationCommitment:
            REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
          realDomainQualification,
        },
        evidence,
      }).then(() => undefined),
  });
  await persistDerivedCamera(input.outputPath, derived, realDomainQualification);
  return derived;
}

export async function deriveRealBuildPrefix50Step44Page45CameraReceipt(
  input: RealBuildPrefix50Step44Page45CameraProductionInput,
): Promise<RealBuildPrefix50Step44Page45CameraReceipt> {
  if (arguments.length !== 1)
    throw new TypeError("Step-44 production camera receipt accepts only its closed runtime input.");
  return (await deriveProductionCamera(input)).receipt;
}

export interface RealBuildPrefix50Step44Page45CameraInstrument {
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
  readonly fixedCameraBaseline: RealBuildPrefix50Step44FixedCameraPixels;
  readonly fixedCameraBaselineArtifact: RealBuildPrefix50Step43FixedCameraBaselineArtifact;
}

function instrumentFromDerived(
  derived: DerivedStep44Camera,
  realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding,
): RealBuildPrefix50Step44Page45CameraInstrument {
  const qualification =
    requireRealBuildPrefix50Step44RealDomainQualificationBinding(realDomainQualification);
  if (qualification.reviewBatchEnvelopeCommitment !== derived.receipt.reviewBatchEnvelopeCommitment)
    throw new TypeError(
      "Step-44 page-45 camera instrument requires qualification of the derived receipt's exact review batch.",
    );
  const fixedCameraBaseline = createRealBuildPrefix50Step43FixedCameraBaseline({
    receipt: derived.receipt,
    cameraCommitment: derived.receipt.selectedCameraCommitment,
    pngBytes: derived.selectedControlRender.pngBytes,
    rgba: derived.selectedControlRender.rgba,
    width: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
    height: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
  });
  if (
    fixedCameraBaseline.evidence.pngDigest !== derived.receipt.selectedParentPngDigest ||
    fixedCameraBaseline.evidence.pixelDigest !== derived.receipt.selectedParentPixelDigest
  )
    throw new TypeError("Step-43 fixed-camera baseline drifted from the selected parent control.");
  const fixedCameraBaselineArtifact = createRealBuildPrefix50Step43FixedCameraBaselineArtifact({
    receipt: derived.receipt,
    baseline: fixedCameraBaseline,
  });
  return Object.freeze({
    receipt: derived.receipt,
    realDomainQualification,
    fixedCameraBaseline,
    fixedCameraBaselineArtifact,
  });
}

export async function deriveRealBuildPrefix50Step44Page45CameraInstrument(
  input: RealBuildPrefix50Step44Page45CameraProductionInput,
): Promise<RealBuildPrefix50Step44Page45CameraInstrument> {
  if (arguments.length !== 1)
    throw new TypeError(
      "Step-44 production camera instrument accepts only its closed runtime input.",
    );
  const derived = await deriveProductionCamera(input);
  return instrumentFromDerived(derived, input.realDomainQualification);
}
