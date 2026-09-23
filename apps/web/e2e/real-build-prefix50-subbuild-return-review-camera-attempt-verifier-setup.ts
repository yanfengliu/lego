import {
  canonicalDigest,
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";
import {
  deriveBrickScene,
  instructionViewFrame,
  type AxonometricSolution,
  type OrthographicViewFrame,
  type OrthographicViewParameters,
} from "@lego-studio/rendering";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import type { RealBuildPrefix50Step44CameraAttemptContext } from "./real-build-prefix50-subbuild-return-review-camera-attempt.ts";
import { REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import type { RealBuildPrefix50Step44CameraBranchKey } from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import type { RealBuildPrefix50Step44Page45CameraReceipt } from "./real-build-prefix50-subbuild-return-review-camera-receipt-types.ts";
import {
  deriveRealBuildPrefix50Step44SemanticColorPolicy,
  type RealBuildPrefix50SemanticColorPolicy,
} from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";
import { independentlyDeriveRealBuildPrefix50Step44LatticeFit } from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-lattice.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
  type RealBuildPrefix50Step44TypedLatticeFit,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
import {
  requireRealBuildPrefix50Step44RealDomainQualificationBinding,
  type RealBuildPrefix50Step44RealDomainQualificationBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";

export interface RealBuildPrefix50Step44PersistedCameraSemanticSource {
  readonly sourcePdfDigest: Sha256Digest;
  readonly sourcePageRasterCommitment: Sha256Digest;
  readonly panelCropCommitment: Sha256Digest;
  readonly panelFacePrefixEvidenceCommitment: Sha256Digest;
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly parentOnlyRegionCommitment: Sha256Digest;
  readonly latticeFit: RealBuildPrefix50Step44TypedLatticeFit;
  readonly rgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly parentOnlyTargetMask: Uint8Array;
}

export interface RealBuildPrefix50Step44ExpectedCameraBranch {
  readonly branchIndex: number;
  readonly branchKey: RealBuildPrefix50Step44CameraBranchKey;
  readonly parameters: OrthographicViewParameters;
}

export interface RealBuildPrefix50Step44PersistedCameraSemanticContract {
  readonly context: RealBuildPrefix50Step44CameraAttemptContext;
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly frame: OrthographicViewFrame;
  readonly branches: readonly RealBuildPrefix50Step44ExpectedCameraBranch[];
  readonly sourceRgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly parentOnlyTargetMask: Uint8Array;
  readonly semanticColorPolicy: RealBuildPrefix50SemanticColorPolicy;
}

export type RealBuildPrefix50Step44CameraMeasurementSemanticContract = Omit<
  RealBuildPrefix50Step44PersistedCameraSemanticContract,
  "context"
> &
  Readonly<{
    context: Pick<RealBuildPrefix50Step44CameraAttemptContext, "metricCalibrationCommitment"> &
      Partial<
        Omit<
          RealBuildPrefix50Step44CameraAttemptContext,
          "metricCalibrationCommitment" | "realDomainQualification"
        >
      >;
  }>;

type DerivedRealBuildPrefix50Step44CameraMeasurementSemanticContract = Omit<
  RealBuildPrefix50Step44PersistedCameraSemanticContract,
  "context"
> &
  Readonly<{
    context: Omit<RealBuildPrefix50Step44CameraAttemptContext, "realDomainQualification">;
  }>;

export function persistedCameraSemanticSourceFromReceipt(input: {
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly rgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly parentOnlyTargetMask: Uint8Array;
}): RealBuildPrefix50Step44PersistedCameraSemanticSource {
  const { receipt } = input;
  return {
    sourcePdfDigest: receipt.sourcePdfDigest,
    sourcePageRasterCommitment: receipt.sourcePageRasterCommitment,
    panelCropCommitment: receipt.panelCropCommitment,
    panelFacePrefixEvidenceCommitment: receipt.panelFacePrefixEvidenceCommitment,
    expectedPanelFace: receipt.expectedPanelFace,
    parentOnlyRegionCommitment: receipt.parentOnlyRegion.commitment,
    latticeFit: receipt.latticeFit,
    rgba: input.rgba,
    eligibleMask: input.eligibleMask,
    parentOnlyTargetMask: input.parentOnlyTargetMask,
  };
}

function restrictToParent(document: BrickDocumentV1, childIds: ReadonlySet<string>) {
  const keep = ({ id }: { readonly id: string }) => !childIds.has(id);
  return deepFreeze({
    ...document,
    parts: document.parts.filter(keep),
    connections: document.connections.filter(
      ({ a, b }) => !childIds.has(a.partId) && !childIds.has(b.partId),
    ),
    submodels: document.submodels.map((row) => ({
      ...row,
      partIds: row.partIds.filter((id) => !childIds.has(id)),
    })),
    steps: document.steps.map((row) => ({
      ...row,
      partIds: row.partIds.filter((id) => !childIds.has(id)),
    })),
    semanticRegions: document.semanticRegions.map((row) => ({
      ...row,
      partIds: row.partIds.filter((id) => !childIds.has(id)),
    })),
  });
}

function exactParent(batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope): {
  readonly document: BrickDocumentV1;
  readonly hash: Sha256Digest;
  readonly commitment: Sha256Digest;
} {
  const childIds = batch.enumerationReceipt.childPartIds;
  const document = restrictToParent(batch.reviewReplayBaseDocument, new Set(childIds));
  const hash = documentStructuralHash(document);
  const validation = validateBrickDocument(document);
  if (
    childIds.length !== 23 ||
    document.parts.length !== 257 ||
    document.steps.length !== 43 ||
    !validation.documentGloballyValid ||
    validation.targetDocumentHash !== hash
  )
    throw new TypeError(
      "Persisted Step-44 camera verification could not independently recover the exact hard-valid 257-part shared parent.",
    );
  return { document, hash, commitment: canonicalDigest(document) };
}

export function independentlyDeriveRealBuildPrefix50Step44ExpectedCameraBranches(
  solution: AxonometricSolution,
): readonly RealBuildPrefix50Step44ExpectedCameraBranch[] {
  const branches: RealBuildPrefix50Step44ExpectedCameraBranch[] = [];
  for (const face of ["studs-up", "underside"] as const)
    for (const hand of ["as-fitted", "x-reflected"] as const)
      for (const turn of [0, 1, 2, 3] as const) {
        const faceSign = face === "studs-up" ? 1 : -1;
        const handSign = hand === "as-fitted" ? 1 : -1;
        const parameters = {
          azimuthDegrees:
            faceSign * solution.azimuthDegrees + handSign * turn * 90 + (handSign < 0 ? 180 : 0),
          elevationDegrees: faceSign * solution.elevationDegrees,
          pixelsPerUnit: solution.pixelsPerUnit,
          upSign: (faceSign * handSign) as 1 | -1,
          centerXPx: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH / 2,
          centerYPx: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT / 2,
        };
        if ((face === "studs-up") !== parameters.elevationDegrees > 0)
          throw new TypeError(
            `Persisted Step-44 branch ${face}/${hand}/${turn} does not expose its labelled physical face.`,
          );
        branches.push({
          branchIndex: branches.length,
          branchKey: `face:${face}/hand:${hand}/turn:${turn}`,
          parameters: deepFreeze(parameters),
        });
      }
  if (
    branches.length !== 16 ||
    new Set(branches.map(({ branchKey }) => branchKey)).size !== 16 ||
    new Set(branches.map(({ parameters }) => canonicalDigest(parameters))).size !== 16
  )
    throw new TypeError(
      "Persisted Step-44 verifier must independently derive 16 unique face/hand/turn branches.",
    );
  return deepFreeze(branches);
}

export function deriveRealBuildPrefix50Step44CameraMeasurementSemanticContract(input: {
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly source: RealBuildPrefix50Step44PersistedCameraSemanticSource;
}): DerivedRealBuildPrefix50Step44CameraMeasurementSemanticContract {
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.reviewBatch);
  const latticeFit = independentlyDeriveRealBuildPrefix50Step44LatticeFit(input.source.rgba);
  if (canonicalDigest(latticeFit) !== canonicalDigest(input.source.latticeFit))
    throw new TypeError(
      "Persisted Step-44 camera lattice fit did not independently reproduce from the exact decoded page-45 crop pixels.",
    );
  const parent = exactParent(batch);
  const semanticColorPolicy = deriveRealBuildPrefix50Step44SemanticColorPolicy(parent.document);
  const scene = deriveBrickScene(parent.document, { finish: "instruction" });
  const frame = instructionViewFrame(
    scene.bounds,
    REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
    REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  );
  scene.dispose();
  const context = deepFreeze({
    sourcePdfDigest: input.source.sourcePdfDigest,
    sourcePageRasterCommitment: input.source.sourcePageRasterCommitment,
    panelCropCommitment: input.source.panelCropCommitment,
    panelFacePrefixEvidenceCommitment: input.source.panelFacePrefixEvidenceCommitment,
    expectedPanelFace: input.source.expectedPanelFace,
    parentOnlyRegionCommitment: input.source.parentOnlyRegionCommitment,
    reviewBatchEnvelopeCommitment: batch.commitment,
    returnResultCommitment: batch.returnResultCommitment,
    candidateRosterCommitment: batch.candidateRosterCommitment,
    sourceDocumentHash: batch.sourceDocumentHash,
    sharedParentDocumentHash: parent.hash,
    sharedParentDocumentCommitment: parent.commitment,
    semanticColorPolicyCommitment: semanticColorPolicy.commitment,
    metricCalibrationCommitment: REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
  });
  return Object.freeze({
    context,
    expectedPanelFace: input.source.expectedPanelFace,
    frame: deepFreeze(frame),
    branches: independentlyDeriveRealBuildPrefix50Step44ExpectedCameraBranches(latticeFit.solution),
    sourceRgba: new Uint8Array(input.source.rgba),
    eligibleMask: new Uint8Array(input.source.eligibleMask),
    parentOnlyTargetMask: new Uint8Array(input.source.parentOnlyTargetMask),
    semanticColorPolicy,
  });
}

export function deriveRealBuildPrefix50Step44PersistedCameraSemanticContract(input: {
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly source: RealBuildPrefix50Step44PersistedCameraSemanticSource;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}): RealBuildPrefix50Step44PersistedCameraSemanticContract {
  const measurement = deriveRealBuildPrefix50Step44CameraMeasurementSemanticContract(input);
  const qualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.realDomainQualification,
  );
  if (
    measurement.context.reviewBatchEnvelopeCommitment === undefined ||
    qualification.reviewBatchEnvelopeCommitment !==
      measurement.context.reviewBatchEnvelopeCommitment
  )
    throw new TypeError(
      "Persisted Step-44 camera verification requires real-domain qualification of the same exact 211-row batch.",
    );
  return Object.freeze({
    ...measurement,
    context: deepFreeze({ ...measurement.context, realDomainQualification: qualification }),
  });
}
