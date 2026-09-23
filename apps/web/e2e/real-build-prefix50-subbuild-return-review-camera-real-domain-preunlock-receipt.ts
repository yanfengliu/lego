import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_PREFIX50_STEP44_BOUNDED_CALIBRATION_SOURCE_SPEC_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC,
  type RealBuildPrefix50Step44RealDomainBranchKey,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";
import {
  requireRealBuildPrefix50Step42SourceGeometryAdmission,
  type RealBuildPrefix50Step42SourceGeometryAdmission,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-step42-admission.ts";
import { REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-step42-binding.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "./real-build-prefix50-source-pdf-pins.ts";

export const REAL_BUILD_PREFIX50_STEP44_ADMITTED_VECTOR_INPUTS_COMMITMENT =
  "sha256:75add44a0a533b7c09ce00e8519718cf75f8cb43a546218a736ffce73ed155a6" as const;
export const REAL_BUILD_PREFIX50_STEP44_ADMITTED_FACE_ROWS_COMMITMENT =
  "sha256:32c206d1586605fa8abc7b9c593b5075b11aaf9497755e1bd175f6e981e36663" as const;
export const REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_VECTOR_INPUTS_COMMITMENT =
  "sha256:d426f4b6d31f269d61df0c07c5832c675c6ec00553a5419fe22732e1714581e1" as const;
export const REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_FACE_ROWS_COMMITMENT =
  "sha256:26e6685c7d6440e7073ac99bb570b6221349f3b21143945fd1a6aaf91692f43d" as const;
export const REAL_BUILD_PREFIX50_STEP44_ADMITTED_BOUNDED_PANEL_RECEIPT_COMMITMENT =
  "sha256:5bfb85f875496bdebd2d4935594367a7acf92acbb28f094515b7334f343876db" as const;

export interface RealBuildPrefix50Step44PreUnlockSourceReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-pre-unlock-source-receipt/2";
  readonly authority: "admitted-static-step-through-42-receipt";
  readonly sourcePdfArtifactPath: "recipes/6651557.pdf";
  readonly sourcePdfDigest: Sha256Digest;
  readonly boundedCalibrationSpecCommitment: Sha256Digest;
  readonly earlierPageVectorInputsCommitment: Sha256Digest;
  readonly earlierPageFaceRowsCommitment: Sha256Digest;
  readonly boundedCalibrationPanelReceiptCommitment: Sha256Digest;
  readonly vectorInputsCommitment: Sha256Digest;
  readonly faceRowsCommitment: Sha256Digest;
  readonly sourceGeometryBindingCommitment: Sha256Digest;
  readonly sourceGeometrySemanticCommitment: Sha256Digest;
  readonly sourceGeometryVerifierManifestCommitment: Sha256Digest;
  readonly calibrationPanelSteps: readonly [41, 42];
  readonly expectedBranchKey: RealBuildPrefix50Step44RealDomainBranchKey;
  readonly commitment: Sha256Digest;
}

/** Availability only: this cannot mint a source receipt or waive geometry verification. */
export function requireRealBuildPrefix50Step44IndependentCameraBranch(): RealBuildPrefix50Step44RealDomainBranchKey {
  const branch = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.signedAxisReceipt
    .expectedBranchKey as RealBuildPrefix50Step44RealDomainBranchKey | null;
  if (branch === null)
    throw new TypeError(
      "Pre-unlock source receipt refuses until the independent signed branch commitment is available.",
    );
  return branch;
}

export function requireRealBuildPrefix50Step44PreUnlockSourceReceipt(
  sourceGeometryAdmission: RealBuildPrefix50Step42SourceGeometryAdmission,
): RealBuildPrefix50Step44PreUnlockSourceReceipt {
  const sourceGeometryReceipt =
    requireRealBuildPrefix50Step42SourceGeometryAdmission(sourceGeometryAdmission);
  const spec = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC;
  if (
    spec.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    spec.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    spec.physicalPageNumber !== 44 ||
    spec.faceEvidence.vectorPageCeiling !== 43 ||
    spec.faceEvidence.lastVectorParsedPrintedStep !== 40 ||
    spec.faceEvidence.lastPrintedStep !== 42 ||
    spec.faceEvidence.earlierPageVectorInputsCommitment !==
      REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_VECTOR_INPUTS_COMMITMENT ||
    spec.faceEvidence.earlierPageRowsCommitment !==
      REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_FACE_ROWS_COMMITMENT ||
    spec.faceEvidence.boundedCalibrationPanelReceipt.commitment !==
      REAL_BUILD_PREFIX50_STEP44_ADMITTED_BOUNDED_PANEL_RECEIPT_COMMITMENT ||
    spec.faceEvidence.vectorInputsCommitment !==
      REAL_BUILD_PREFIX50_STEP44_ADMITTED_VECTOR_INPUTS_COMMITMENT ||
    spec.faceEvidence.rowsCommitment !== REAL_BUILD_PREFIX50_STEP44_ADMITTED_FACE_ROWS_COMMITMENT ||
    canonicalDigest(spec.faceEvidence.panelSteps.map(({ stepNumber }) => stepNumber)) !==
      canonicalDigest([41, 42]) ||
    canonicalDigest(spec.cases.map(({ panelStep }) => panelStep)) !== canonicalDigest([41, 42]) ||
    spec.signedAxisReceipt.sourceGeometryBindingCommitment !==
      REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT ||
    sourceGeometryReceipt.admittedBindingCommitment !==
      REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT
  )
    throw new TypeError(
      "Pre-unlock source receipt must be the exact admitted static PDF/action/vector commitment through Step 42.",
    );
  const expectedBranchKey = requireRealBuildPrefix50Step44IndependentCameraBranch();
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-pre-unlock-source-receipt/2" as const,
    authority: "admitted-static-step-through-42-receipt" as const,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    boundedCalibrationSpecCommitment:
      REAL_BUILD_PREFIX50_STEP44_BOUNDED_CALIBRATION_SOURCE_SPEC_COMMITMENT,
    earlierPageVectorInputsCommitment:
      REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_VECTOR_INPUTS_COMMITMENT,
    earlierPageFaceRowsCommitment: REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_FACE_ROWS_COMMITMENT,
    boundedCalibrationPanelReceiptCommitment:
      REAL_BUILD_PREFIX50_STEP44_ADMITTED_BOUNDED_PANEL_RECEIPT_COMMITMENT,
    vectorInputsCommitment: REAL_BUILD_PREFIX50_STEP44_ADMITTED_VECTOR_INPUTS_COMMITMENT,
    faceRowsCommitment: REAL_BUILD_PREFIX50_STEP44_ADMITTED_FACE_ROWS_COMMITMENT,
    sourceGeometryBindingCommitment: sourceGeometryReceipt.admittedBindingCommitment,
    sourceGeometrySemanticCommitment: sourceGeometryReceipt.semanticGeometryCommitment,
    sourceGeometryVerifierManifestCommitment: sourceGeometryReceipt.verifierManifestCommitment,
    calibrationPanelSteps: [41, 42] as const,
    expectedBranchKey,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}
