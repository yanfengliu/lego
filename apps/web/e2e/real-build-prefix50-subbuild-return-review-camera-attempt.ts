import { createHash } from "node:crypto";
import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import { independentlyDeriveRealBuildPrefix50Step44SemanticBlueCyanMask } from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-primitives.ts";
import type { RealBuildPrefix50Step44CameraSearchAttemptEvidence } from "./real-build-prefix50-subbuild-return-review-camera-search.ts";
import {
  deriveRealBuildPrefix50Step44InteriorFeatureCalibration,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
} from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PRESENT_TARGET_COLOR_IDS,
} from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";
import { REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX } from "./real-build-prefix50-subbuild-return-review-camera-source.ts";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";

export interface RealBuildPrefix50Step44CameraAttemptContext {
  readonly sourcePdfDigest: Sha256Digest;
  readonly sourcePageRasterCommitment: Sha256Digest;
  readonly panelCropCommitment: Sha256Digest;
  readonly panelFacePrefixEvidenceCommitment: Sha256Digest;
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly parentOnlyRegionCommitment: Sha256Digest;
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly returnResultCommitment: Sha256Digest;
  readonly candidateRosterCommitment: Sha256Digest;
  readonly sourceDocumentHash: Sha256Digest;
  readonly sharedParentDocumentHash: Sha256Digest;
  readonly sharedParentDocumentCommitment: Sha256Digest;
  readonly semanticColorPolicyCommitment: Sha256Digest;
  readonly metricCalibrationCommitment: Sha256Digest;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}

export interface RealBuildPrefix50Step44PersistedCameraAttemptReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-persisted-camera-attempt/1";
  readonly authority: "none";
  readonly dataExclusionPolicy: "page45-and-shared-step43-parent-only-no-candidate-no-step45-no-page46";
  readonly context: RealBuildPrefix50Step44CameraAttemptContext;
  readonly contextCommitment: Sha256Digest;
  readonly searchAttemptCommitment: Sha256Digest;
  readonly searchAttempt: RealBuildPrefix50Step44CameraSearchAttemptEvidence["attempt"];
  readonly actualRenderArtifactFiles: readonly string[];
  readonly actualRenderArtifactsCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44VerifiedPersistedCameraAttempt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-verified-persisted-camera-attempt/1";
  readonly authority: "none";
  readonly outputRealPathCommitment: Sha256Digest;
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly cameraReceiptCommitment: Sha256Digest | null;
  readonly searchAttemptCommitment: Sha256Digest;
  readonly contextCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function semanticArtifactFile(branchIndex: number): string {
  return `real-build-prefix50-step44-page45-camera-branch-${branchIndex
    .toString()
    .padStart(2, "0")}-semantic-blue-cyan.png`;
}

function beautyArtifactFile(
  branchIndex: number,
  passKind: "seed" | "confirmation" | "rebase",
): string {
  return `real-build-prefix50-step44-page45-camera-branch-${branchIndex
    .toString()
    .padStart(2, "0")}-${passKind}.png`;
}

const BEAUTY_RESTORATION_ARTIFACT_FILE =
  "real-build-prefix50-step44-page45-camera-beauty-restoration-control.png";
const EXPECTED_METRIC_CALIBRATION_COMMITMENT =
  "sha256:6cb2af38155611540f4820cb424a0416fdb1a59b93a769e31a09beaa4ec4027d" as const;

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return canonicalDigest(left) === canonicalDigest(right);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

export function verifyRealBuildPrefix50Step44CameraAttemptEvidence(
  evidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence,
): readonly string[] {
  const { attempt, renderArtifacts } = evidence;
  const calibration = deriveRealBuildPrefix50Step44InteriorFeatureCalibration();
  if (
    attempt.schemaVersion !== "lego.real-build-prefix50-step44-camera-search-attempt/2" ||
    attempt.maximumRenderCount !== 48 ||
    attempt.semanticRenderCount !== 16 ||
    attempt.restorationControlRenderCount !== 1 ||
    attempt.maximumTotalCaptureCount !== 65 ||
    REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT !==
      EXPECTED_METRIC_CALIBRATION_COMMITMENT ||
    calibration.commitment !== EXPECTED_METRIC_CALIBRATION_COMMITMENT ||
    attempt.metricCalibrationCommitment !== EXPECTED_METRIC_CALIBRATION_COMMITMENT ||
    attempt.featureCorroboration.metricCalibrationCommitment !==
      EXPECTED_METRIC_CALIBRATION_COMMITMENT ||
    attempt.thresholds.minimumBlueCyanF1 !== calibration.derivedThresholds.minimumBlueCyanF1 ||
    attempt.thresholds.minimumExpectedFaceBlueCyanF1Margin !==
      calibration.derivedThresholds.minimumExpectedFaceBlueCyanF1Margin ||
    attempt.featureCorroboration.thresholds.minimumBlueCyanF1 !==
      calibration.derivedThresholds.minimumBlueCyanF1 ||
    attempt.featureCorroboration.thresholds.minimumExpectedFaceBlueCyanF1Margin !==
      calibration.derivedThresholds.minimumExpectedFaceBlueCyanF1Margin ||
    attempt.commitment !== canonicalDigest(withoutCommitment(attempt)) ||
    attempt.geometrySelectionCommitment !== attempt.geometrySelection.commitment ||
    attempt.featureCorroborationCommitment !== attempt.featureCorroboration.commitment ||
    attempt.geometrySelection.commitment !==
      canonicalDigest(withoutCommitment(attempt.geometrySelection)) ||
    attempt.featureCorroboration.commitment !==
      canonicalDigest(withoutCommitment(attempt.featureCorroboration)) ||
    attempt.branchMeasurementsCommitment !== canonicalDigest(attempt.branchMeasurements)
  )
    throw new TypeError("Step-44 camera attempt commitments did not reproduce before persistence.");
  const expectedFiles: string[] = [];
  if (attempt.branchMeasurements.length !== 16)
    throw new TypeError("Step-44 camera attempt must retain exactly 16 ordered branches.");
  for (const [branchIndex, branch] of attempt.branchMeasurements.entries()) {
    if (
      branch.branchIndex !== branchIndex ||
      branch.alignmentPasses.length < 1 ||
      branch.alignmentPasses.length > 3 ||
      branch.publishedPassIndex < 0 ||
      branch.publishedPassIndex >= branch.alignmentPasses.length
    )
      throw new TypeError(
        `Step-44 camera attempt branch ${branchIndex} must retain its stable index, one to three passes, and an in-range published pass.`,
      );
    if (
      branch.commitment !== canonicalDigest(withoutCommitment(branch)) ||
      branch.geometryCommitment !==
        canonicalDigest({
          branchIndex: branch.branchIndex,
          branchKey: branch.branchKey,
          branchFace: branch.branchFace,
          expectedPanelFace: branch.expectedPanelFace,
          geometryEligible: branch.geometryEligible,
          seedParameters: branch.seedParameters,
          frame: branch.frame,
          alignmentMethod: branch.alignmentMethod,
          alignmentPasses: branch.alignmentPasses,
          alignmentPassesCommitment: branch.alignmentPassesCommitment,
          converged: branch.converged,
          publishedPassIndex: branch.publishedPassIndex,
          selectedParameters: branch.selectedParameters,
          selectedCameraCommitment: branch.selectedCameraCommitment,
          selectedRendererCameraCommitment: branch.selectedRendererCameraCommitment,
          selectedPngDigest: branch.selectedPngDigest,
          selectedPixelDigest: branch.selectedPixelDigest,
          selectedIntersectionOverUnion: branch.selectedIntersectionOverUnion,
        }) ||
      branch.alignmentPassesCommitment !== canonicalDigest(branch.alignmentPasses)
    )
      throw new TypeError(
        `Step-44 camera attempt branch ${branch.branchKey} commitments did not reproduce.`,
      );
    for (const [passIndex, pass] of branch.alignmentPasses.entries()) {
      const expectedPassKind = (["seed", "confirmation", "rebase"] as const)[passIndex]!;
      if (
        pass.passIndex !== passIndex ||
        pass.passKind !== expectedPassKind ||
        pass.artifactFile !== beautyArtifactFile(branchIndex, expectedPassKind)
      )
        throw new TypeError(
          `Step-44 camera attempt branch ${branchIndex} pass ${passIndex} must use its canonical kind, index, and artifact path.`,
        );
      const bytes = renderArtifacts[pass.artifactFile];
      const decoded =
        bytes === undefined
          ? null
          : decodeRealBuildPrefix50Step44ReviewPng(
              bytes,
              720 * 470,
              `Step-44 camera attempt render ${pass.artifactFile}`,
            );
      if (
        bytes === undefined ||
        decoded === null ||
        decoded.width !== 720 ||
        decoded.height !== 470 ||
        pass.commitment !== canonicalDigest(withoutCommitment(pass)) ||
        pass.pngDigest !== sha256(bytes) ||
        pass.pixelDigest !== sha256(decoded.rgba)
      )
        throw new TypeError(
          `Step-44 camera attempt render artifact ${pass.artifactFile} did not reproduce its pass binding.`,
        );
      expectedFiles.push(pass.artifactFile);
    }

    const semantic = branch.semanticColorArtifact;
    const semanticFile = semanticArtifactFile(branch.branchIndex);
    const semanticBytes = renderArtifacts[semanticFile];
    const semanticDecoded =
      semanticBytes === undefined
        ? null
        : decodeRealBuildPrefix50Step44ReviewPng(
            semanticBytes,
            720 * 470,
            `Step-44 camera semantic render ${semanticFile}`,
          );
    const semanticMask =
      semanticDecoded === null
        ? null
        : independentlyDeriveRealBuildPrefix50Step44SemanticBlueCyanMask(semanticDecoded.rgba);
    const published = branch.alignmentPasses[branch.publishedPassIndex];
    const semanticBody = {
      artifactFile: semanticFile,
      pngDigest: semanticBytes === undefined ? semantic.pngDigest : sha256(semanticBytes),
      pixelDigest: semanticDecoded === null ? semantic.pixelDigest : sha256(semanticDecoded.rgba),
      semanticBlueCyanMaskDigest:
        semanticMask === null ? semantic.semanticBlueCyanMaskDigest : sha256(semanticMask),
      projectionMatrix: semantic.projectionMatrix,
      matrixWorldInverse: semantic.matrixWorldInverse,
      rendererCameraCommitment: canonicalDigest({
        request: {
          scene: "model-only",
          renderMode: "semantic-color-id-mask",
          targetColorIds: [...REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PRESENT_TARGET_COLOR_IDS],
          backgroundHex: REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX,
          parameters: branch.selectedParameters,
          frame: branch.frame,
        },
        policyCommitment: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT,
        classificationCommitment: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT,
        projectionMatrix: semantic.projectionMatrix,
        matrixWorldInverse: semantic.matrixWorldInverse,
      }),
      policyCommitment: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT,
      classificationCommitment: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT,
    };
    if (
      semanticBytes === undefined ||
      semanticDecoded === null ||
      semanticMask === null ||
      semanticDecoded.width !== 720 ||
      semanticDecoded.height !== 470 ||
      published === undefined ||
      semantic.artifactFile !== semanticFile ||
      semantic.pngDigest !== semanticBody.pngDigest ||
      semantic.pixelDigest !== semanticBody.pixelDigest ||
      semantic.semanticBlueCyanMaskDigest !== semanticBody.semanticBlueCyanMaskDigest ||
      semantic.rendererCameraCommitment !== semanticBody.rendererCameraCommitment ||
      semantic.policyCommitment !== REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT ||
      semantic.classificationCommitment !==
        REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT ||
      !sameNumbers(semantic.projectionMatrix, published.projectionMatrix) ||
      !sameNumbers(semantic.matrixWorldInverse, published.matrixWorldInverse) ||
      semantic.commitment !== canonicalDigest(semanticBody) ||
      canonicalDigest(branch.selectedParameters) !== canonicalDigest(published.parameters) ||
      branch.selectedCameraCommitment !== published.cameraCommitment ||
      branch.selectedRendererCameraCommitment !== published.rendererCameraCommitment ||
      branch.selectedPngDigest !== published.pngDigest ||
      branch.selectedPixelDigest !== published.pixelDigest ||
      branch.selectedIntersectionOverUnion !== published.intersectionOverUnion ||
      branch.interiorFeatureMeasurement.semanticMaskPixelDigest !== sha256(semanticMask) ||
      branch.interiorFeatureMeasurement.semanticPolicyCommitment !==
        REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT
    )
      throw new TypeError(
        `Step-44 camera semantic artifact ${semanticFile} did not reproduce its exact policy, camera, pixels, or branch binding.`,
      );
    expectedFiles.push(semanticFile);
  }

  const control = attempt.beautyRestorationControl;
  const selectedBranch =
    attempt.branchMeasurements.find(
      (branch) => branch.branchKey === attempt.geometrySelection.selectedBranchKey,
    ) ?? attempt.branchMeasurements[0];
  const selectedPass = selectedBranch?.alignmentPasses[selectedBranch.publishedPassIndex];
  const controlBytes = renderArtifacts[BEAUTY_RESTORATION_ARTIFACT_FILE];
  const publishedBytes =
    selectedPass === undefined ? undefined : renderArtifacts[selectedPass.artifactFile];
  const controlDecoded =
    controlBytes === undefined
      ? null
      : decodeRealBuildPrefix50Step44ReviewPng(
          controlBytes,
          720 * 470,
          "Step-44 camera beauty restoration control",
        );
  const controlBody =
    selectedBranch === undefined || selectedPass === undefined || controlDecoded === null
      ? null
      : {
          artifactFile: BEAUTY_RESTORATION_ARTIFACT_FILE,
          controlledBranchKey: selectedBranch.branchKey,
          controlledCameraCommitment: selectedBranch.selectedCameraCommitment,
          pngDigest: sha256(controlBytes!),
          pixelDigest: sha256(controlDecoded.rgba),
          projectionMatrix: control.projectionMatrix,
          matrixWorldInverse: control.matrixWorldInverse,
          rendererCameraCommitment: canonicalDigest({
            request: {
              scene: "model-only",
              backgroundHex: REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX,
              parameters: selectedBranch.selectedParameters,
              frame: selectedBranch.frame,
            },
            projectionMatrix: control.projectionMatrix,
            matrixWorldInverse: control.matrixWorldInverse,
          }),
          byteIdenticalToPublishedRender:
            publishedBytes !== undefined && sameBytes(controlBytes!, publishedBytes),
        };
  if (
    controlBody === null ||
    controlBytes === undefined ||
    publishedBytes === undefined ||
    controlDecoded?.width !== 720 ||
    controlDecoded.height !== 470 ||
    control.artifactFile !== BEAUTY_RESTORATION_ARTIFACT_FILE ||
    control.controlledBranchKey !== controlBody.controlledBranchKey ||
    control.controlledCameraCommitment !== controlBody.controlledCameraCommitment ||
    control.pngDigest !== controlBody.pngDigest ||
    control.pixelDigest !== controlBody.pixelDigest ||
    !sameNumbers(control.projectionMatrix, selectedPass!.projectionMatrix) ||
    !sameNumbers(control.matrixWorldInverse, selectedPass!.matrixWorldInverse) ||
    control.rendererCameraCommitment !== controlBody.rendererCameraCommitment ||
    control.byteIdenticalToPublishedRender !== controlBody.byteIdenticalToPublishedRender ||
    control.commitment !== canonicalDigest(controlBody)
  )
    throw new TypeError(
      "Step-44 camera beauty restoration control did not reproduce its geometry-selected published-render comparison.",
    );
  expectedFiles.push(BEAUTY_RESTORATION_ARTIFACT_FILE);
  const files = Object.keys(renderArtifacts).sort();
  expectedFiles.sort();
  if (
    attempt.renderCount !==
      attempt.branchMeasurements.reduce(
        (count, branch) => count + branch.alignmentPasses.length,
        0,
      ) ||
    attempt.renderCount < 16 ||
    attempt.renderCount > attempt.maximumRenderCount ||
    attempt.totalCaptureCount !== attempt.renderCount + 17 ||
    attempt.totalCaptureCount > attempt.maximumTotalCaptureCount ||
    files.length !== attempt.totalCaptureCount ||
    files.length !== expectedFiles.length ||
    files.some((file, index) => file !== expectedFiles[index])
  )
    throw new TypeError(
      "Step-44 camera attempt must retain exactly every beauty pass, all 16 semantic renders, one restoration control, and no unbound artifact.",
    );
  return Object.freeze(files);
}
