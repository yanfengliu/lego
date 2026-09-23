import { canonicalDigest } from "@lego-studio/brick-kernel";
import {
  createOrthographicViewCamera,
  type OrthographicViewParameters,
} from "@lego-studio/rendering";

import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  deriveRealBuildPrefix50Step44InteriorFeatureCalibration,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
} from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import {
  deriveRealBuildPrefix50Step44InteriorFeatureSource,
  measureRealBuildPrefix50Step44InteriorFeatures,
} from "./real-build-prefix50-subbuild-return-review-camera-interior.ts";
import {
  independentlyApplyRealBuildPrefix50Step44Registration,
  independentlyDeriveRealBuildPrefix50Step44BranchFace,
  independentlyDeriveRealBuildPrefix50Step44SemanticBlueCyanMask,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-primitives.ts";
import {
  deriveRealBuildPrefix50Step44PersistedCameraAgreement as agreementFor,
  deriveRealBuildPrefix50Step44PersistedCameraProposal as proposalFor,
  requireRealBuildPrefix50Step44PersistedExactArtifactSet as requireExactArtifactSet,
  requireRealBuildPrefix50Step44PersistedCameraPass as requirePass,
  type RealBuildPrefix50Step44DecodedCameraAttemptArtifact,
  verifyRealBuildPrefix50Step44PersistedBeautyControl as verifyBeautyRestorationControl,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-pass.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS,
  type RealBuildPrefix50Step44CameraAlignmentPass,
  type RealBuildPrefix50Step44CameraSearchAttempt,
  type RealBuildPrefix50Step44ParentCameraMeasurement,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
import type {
  RealBuildPrefix50Step44CameraMeasurementSemanticContract,
  RealBuildPrefix50Step44PersistedCameraSemanticContract,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-setup.ts";
import { verifyRealBuildPrefix50Step44CameraAttemptDecisionSemantics } from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-decisions.ts";
import { requireRealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { requireRealBuildPrefix50SemanticColorPolicy } from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";

const WIDTH = REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH;
const HEIGHT = REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT;
const THRESHOLDS = REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS;
const EXPECTED_METRIC_CALIBRATION_COMMITMENT =
  "sha256:6cb2af38155611540f4820cb424a0416fdb1a59b93a769e31a09beaa4ec4027d" as const;

export type { RealBuildPrefix50Step44DecodedCameraAttemptArtifact } from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-pass.ts";

type PersistedPass = RealBuildPrefix50Step44CameraAlignmentPass & {
  readonly projectionMatrix: readonly number[];
  readonly matrixWorldInverse: readonly number[];
};

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function requireSame(actual: unknown, expected: unknown, label: string): void {
  if (canonicalDigest(actual) !== canonicalDigest(expected))
    throw new TypeError(`Persisted Step-44 camera ${label} did not independently reproduce.`);
}

function requireMatrix(value: readonly number[], label: string): readonly number[] {
  if (!Array.isArray(value) || value.length !== 16 || !value.every(Number.isFinite))
    throw new TypeError(
      `Persisted Step-44 camera ${label} must contain exactly 16 finite numbers.`,
    );
  return value;
}

function artifactFile(branchIndex: number, passKind: "seed" | "confirmation" | "rebase"): string {
  return `real-build-prefix50-step44-page45-camera-branch-${branchIndex
    .toString()
    .padStart(2, "0")}-${passKind}.png`;
}

function semanticArtifactFile(branchIndex: number): string {
  return `real-build-prefix50-step44-page45-camera-branch-${branchIndex
    .toString()
    .padStart(2, "0")}-semantic-blue-cyan.png`;
}

function requireArtifact(
  artifacts: Readonly<Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>>,
  file: string,
): RealBuildPrefix50Step44DecodedCameraAttemptArtifact {
  const artifact = artifacts[file];
  if (artifact === undefined)
    throw new TypeError(`Persisted Step-44 camera render artifact ${file} is absent.`);
  return artifact;
}

function verifySemanticArtifact(input: {
  readonly actual: RealBuildPrefix50Step44ParentCameraMeasurement;
  readonly branchIndex: number;
  readonly published: PersistedPass;
  readonly publishedArtifact: RealBuildPrefix50Step44DecodedCameraAttemptArtifact;
  readonly contract: RealBuildPrefix50Step44CameraMeasurementSemanticContract;
  readonly artifacts: Readonly<Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>>;
  readonly featureSource: ReturnType<typeof deriveRealBuildPrefix50Step44InteriorFeatureSource>;
}) {
  const policy = requireRealBuildPrefix50SemanticColorPolicy(input.contract.semanticColorPolicy);
  const file = semanticArtifactFile(input.branchIndex);
  const artifact = requireArtifact(input.artifacts, file);
  const semanticMask = independentlyDeriveRealBuildPrefix50Step44SemanticBlueCyanMask(
    artifact.rgba,
  );
  const projectionMatrix = requireMatrix(
    input.actual.semanticColorArtifact.projectionMatrix,
    "semantic projection matrix",
  );
  const matrixWorldInverse = requireMatrix(
    input.actual.semanticColorArtifact.matrixWorldInverse,
    "semantic inverse-world matrix",
  );
  const camera = createOrthographicViewCamera(
    input.actual.selectedParameters,
    input.contract.frame,
  );
  const expectedProjectionMatrix = [...camera.projectionMatrix.elements];
  const expectedMatrixWorldInverse = [...camera.matrixWorldInverse.elements];
  requireSame(projectionMatrix, expectedProjectionMatrix, "semantic projection matrix");
  requireSame(matrixWorldInverse, expectedMatrixWorldInverse, "semantic inverse-world matrix");
  requireSame(
    projectionMatrix,
    input.published.projectionMatrix,
    `branch ${input.branchIndex} semantic/beauty projection matrices`,
  );
  requireSame(
    matrixWorldInverse,
    input.published.matrixWorldInverse,
    `branch ${input.branchIndex} semantic/beauty inverse-world matrices`,
  );
  const rendererCameraCommitment = canonicalDigest({
    request: {
      scene: "model-only",
      renderMode: "semantic-color-id-mask",
      targetColorIds: [...policy.targetColorIds],
      backgroundHex: REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
      parameters: input.actual.selectedParameters,
      frame: input.contract.frame,
    },
    policyCommitment: policy.commitment,
    classificationCommitment: policy.classificationCommitment,
    projectionMatrix: expectedProjectionMatrix,
    matrixWorldInverse: expectedMatrixWorldInverse,
  });
  const semanticBody = {
    artifactFile: file,
    pngDigest: sha256RealBuildPrefix50Step44ReviewBytes(artifact.pngBytes),
    pixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(artifact.rgba),
    semanticBlueCyanMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(semanticMask),
    projectionMatrix: expectedProjectionMatrix,
    matrixWorldInverse: expectedMatrixWorldInverse,
    rendererCameraCommitment,
    policyCommitment: policy.commitment,
    classificationCommitment: policy.classificationCommitment,
  };
  const expectedSemantic = { ...semanticBody, commitment: canonicalDigest(semanticBody) };
  requireSame(
    input.actual.semanticColorArtifact,
    expectedSemantic,
    `branch ${input.branchIndex} semantic artifact binding`,
  );
  const measurement = measureRealBuildPrefix50Step44InteriorFeatures({
    source: input.featureSource,
    beautyRenderRgba: input.publishedArtifact.rgba,
    semanticBlueCyanMask: semanticMask,
    semanticPolicyCommitment: policy.commitment,
  });
  if (
    measurement.beautyRenderPixelDigest !== input.published.pixelDigest ||
    measurement.semanticMaskPixelDigest !== semanticBody.semanticBlueCyanMaskDigest ||
    measurement.semanticPolicyCommitment !== policy.commitment
  )
    throw new TypeError(
      `Persisted Step-44 camera branch ${input.branchIndex} semantic measurement inputs differ from its published evidence.`,
    );
  requireSame(
    input.actual.interiorFeatureMeasurement,
    measurement,
    `branch ${input.branchIndex} semantic feature measurement`,
  );
  return measurement;
}

function verifyBranch(input: {
  readonly actual: RealBuildPrefix50Step44ParentCameraMeasurement;
  readonly branchIndex: number;
  readonly branchKey: RealBuildPrefix50Step44ParentCameraMeasurement["branchKey"];
  readonly seedParameters: OrthographicViewParameters;
  readonly contract: RealBuildPrefix50Step44CameraMeasurementSemanticContract;
  readonly artifacts: Readonly<Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>>;
  readonly featureSource: ReturnType<typeof deriveRealBuildPrefix50Step44InteriorFeatureSource>;
}): RealBuildPrefix50Step44ParentCameraMeasurement {
  const { actual, contract } = input;
  if (actual.alignmentPasses.length < 1 || actual.alignmentPasses.length > 3)
    throw new TypeError(
      `Persisted Step-44 camera branch ${input.branchIndex} must retain one to three canonical passes.`,
    );
  const seedPass = actual.alignmentPasses[0] as PersistedPass;
  const seedArtifact = requireArtifact(input.artifacts, artifactFile(input.branchIndex, "seed"));
  const seedAgreement = agreementFor(seedArtifact, contract);
  const seedProposal = proposalFor(seedArtifact.rgba, input.seedParameters, contract);
  requirePass({
    actual: seedPass,
    branchIndex: input.branchIndex,
    passIndex: 0,
    passKind: "seed",
    parameters: input.seedParameters,
    frame: contract.frame,
    artifact: seedArtifact,
    agreement: seedAgreement,
    proposal: seedProposal,
    predictedIntersectionOverUnion: seedProposal.diagnostics.predictedIntersectionOverUnion,
    incomingDrift: null,
    settled: false,
  });

  let expectedPassCount = 1;
  let converged = false;
  if (seedProposal.status === "locally-contained") {
    expectedPassCount = 2;
    const confirmationParameters = independentlyApplyRealBuildPrefix50Step44Registration({
      parameters: input.seedParameters,
      transform: seedProposal.transform!,
    });
    const confirmationArtifact = requireArtifact(
      input.artifacts,
      artifactFile(input.branchIndex, "confirmation"),
    );
    const confirmationAgreement = agreementFor(confirmationArtifact, contract);
    const initialDrift = Math.abs(
      seedProposal.diagnostics.predictedIntersectionOverUnion -
        confirmationAgreement.intersectionOverUnion,
    );
    const needsRebase = initialDrift > THRESHOLDS.maximumPredictionActualIntersectionOverUnionDrift;
    const rebaseProposal = needsRebase
      ? proposalFor(confirmationArtifact.rgba, confirmationParameters, contract)
      : null;
    requirePass({
      actual: actual.alignmentPasses[1] as PersistedPass,
      branchIndex: input.branchIndex,
      passIndex: 1,
      passKind: "confirmation",
      parameters: confirmationParameters,
      frame: contract.frame,
      artifact: confirmationArtifact,
      agreement: confirmationAgreement,
      proposal: rebaseProposal,
      predictedIntersectionOverUnion:
        rebaseProposal?.diagnostics.predictedIntersectionOverUnion ?? null,
      incomingDrift: initialDrift,
      settled: !needsRebase,
    });
    converged = !needsRebase;
    if (needsRebase && rebaseProposal?.status === "locally-contained") {
      expectedPassCount = 3;
      const rebaseParameters = independentlyApplyRealBuildPrefix50Step44Registration({
        parameters: confirmationParameters,
        transform: rebaseProposal.transform!,
      });
      const rebaseArtifact = requireArtifact(
        input.artifacts,
        artifactFile(input.branchIndex, "rebase"),
      );
      const rebaseAgreement = agreementFor(rebaseArtifact, contract);
      const rebaseDrift = Math.abs(
        rebaseProposal.diagnostics.predictedIntersectionOverUnion -
          rebaseAgreement.intersectionOverUnion,
      );
      converged = rebaseDrift <= THRESHOLDS.maximumPredictionActualIntersectionOverUnionDrift;
      requirePass({
        actual: actual.alignmentPasses[2] as PersistedPass,
        branchIndex: input.branchIndex,
        passIndex: 2,
        passKind: "rebase",
        parameters: rebaseParameters,
        frame: contract.frame,
        artifact: rebaseArtifact,
        agreement: rebaseAgreement,
        proposal: null,
        predictedIntersectionOverUnion: null,
        incomingDrift: rebaseDrift,
        settled: converged,
      });
    }
  }
  if (actual.alignmentPasses.length !== expectedPassCount)
    throw new TypeError(
      `Persisted Step-44 camera branch ${input.branchIndex} pass sequence is not canonical.`,
    );
  let publishedPassIndex = 0;
  for (let index = 1; index < actual.alignmentPasses.length; index += 1)
    if (
      actual.alignmentPasses[index]!.intersectionOverUnion >
      actual.alignmentPasses[publishedPassIndex]!.intersectionOverUnion
    )
      publishedPassIndex = index;
  const published = actual.alignmentPasses[publishedPassIndex] as PersistedPass;
  const publishedArtifact = requireArtifact(input.artifacts, published.artifactFile);
  const interiorFeatureMeasurement = verifySemanticArtifact({
    actual,
    branchIndex: input.branchIndex,
    published,
    publishedArtifact,
    contract,
    artifacts: input.artifacts,
    featureSource: input.featureSource,
  });
  const branch = independentlyDeriveRealBuildPrefix50Step44BranchFace(input.branchKey);
  const geometryBody = {
    branchIndex: input.branchIndex,
    branchKey: input.branchKey,
    branchFace: branch,
    expectedPanelFace: contract.expectedPanelFace,
    geometryEligible: branch === contract.expectedPanelFace,
    seedParameters: input.seedParameters,
    frame: contract.frame,
    alignmentMethod: "coverage-preserving-direct-eligible-silhouette-registration" as const,
    alignmentPasses: actual.alignmentPasses,
    alignmentPassesCommitment: canonicalDigest(actual.alignmentPasses),
    converged,
    publishedPassIndex,
    selectedParameters: published.parameters,
    selectedCameraCommitment: published.cameraCommitment,
    selectedRendererCameraCommitment: published.rendererCameraCommitment,
    selectedPngDigest: published.pngDigest,
    selectedPixelDigest: published.pixelDigest,
    selectedIntersectionOverUnion: published.intersectionOverUnion,
  };
  const expectedGeometryCommitment = canonicalDigest(geometryBody);
  const body = {
    ...geometryBody,
    geometryCommitment: expectedGeometryCommitment,
    semanticColorArtifact: actual.semanticColorArtifact,
    interiorFeatureMeasurement,
  };
  if (
    actual.alignmentPassesCommitment !== canonicalDigest(actual.alignmentPasses) ||
    actual.geometryCommitment !== expectedGeometryCommitment ||
    actual.commitment !== canonicalDigest(body)
  )
    throw new TypeError(
      `Persisted Step-44 camera branch ${input.branchIndex} semantic commitments did not reproduce.`,
    );
  requireSame(withoutCommitment(actual), body, `branch ${input.branchIndex}`);
  return actual;
}

function verifyCameraMeasurementSemantics(input: {
  readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  readonly artifacts: Readonly<Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>>;
  readonly contract: RealBuildPrefix50Step44CameraMeasurementSemanticContract;
}): void {
  const { attempt, contract } = input;
  const calibration = deriveRealBuildPrefix50Step44InteriorFeatureCalibration();
  if (
    REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT !==
      EXPECTED_METRIC_CALIBRATION_COMMITMENT ||
    calibration.commitment !== EXPECTED_METRIC_CALIBRATION_COMMITMENT ||
    attempt.metricCalibrationCommitment !== calibration.commitment ||
    attempt.featureCorroboration.metricCalibrationCommitment !== calibration.commitment ||
    contract.context.metricCalibrationCommitment !== calibration.commitment ||
    attempt.thresholds.minimumBlueCyanF1 !== calibration.derivedThresholds.minimumBlueCyanF1 ||
    attempt.thresholds.minimumExpectedFaceBlueCyanF1Margin !==
      calibration.derivedThresholds.minimumExpectedFaceBlueCyanF1Margin
  )
    throw new TypeError(
      "Persisted Step-44 camera attempt did not bind the exact independently reproduced metric-v2 calibration and thresholds.",
    );
  requireSame(attempt.thresholds, THRESHOLDS, "fixed thresholds");
  if (
    attempt.branchMeasurements.length !== 16 ||
    contract.branches.length !== 16 ||
    attempt.expectedPanelFace !== contract.expectedPanelFace ||
    attempt.sourceEligibleMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(contract.eligibleMask) ||
    attempt.parentOnlyTargetMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(contract.parentOnlyTargetMask)
  )
    throw new TypeError(
      "Persisted Step-44 camera attempt must contain the exact closed 16-branch expected-face roster.",
    );
  const featureSource = deriveRealBuildPrefix50Step44InteriorFeatureSource({
    width: WIDTH,
    height: HEIGHT,
    sourceRgba: contract.sourceRgba,
    eligibleMask: contract.eligibleMask,
  });
  const rows = attempt.branchMeasurements.map((actual, branchIndex) => {
    const expected = contract.branches[branchIndex]!;
    if (actual.branchIndex !== branchIndex || actual.branchKey !== expected.branchKey)
      throw new TypeError(
        `Persisted Step-44 camera branch ${branchIndex} drifted from the stable branch key/index.`,
      );
    return verifyBranch({
      actual,
      branchIndex,
      branchKey: expected.branchKey,
      seedParameters: expected.parameters,
      contract,
      artifacts: input.artifacts,
      featureSource,
    });
  });
  const beautyRestorationPassed = verifyBeautyRestorationControl({
    attempt,
    rows,
    artifacts: input.artifacts,
    frame: contract.frame,
  });
  const artifactCount = requireExactArtifactSet({ rows, artifacts: input.artifacts });
  verifyRealBuildPrefix50Step44CameraAttemptDecisionSemantics({
    attempt,
    rows,
    expectedPanelFace: contract.expectedPanelFace,
    featureSourceCommitment: featureSource.evidence.commitment,
    sourceEligibleMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(contract.eligibleMask),
    parentOnlyTargetMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(
      contract.parentOnlyTargetMask,
    ),
    artifactCount,
    beautyRestorationPassed,
  });
}

export function verifyRealBuildPrefix50Step44CameraMeasurementSemantics(input: {
  readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  readonly artifacts: Readonly<Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>>;
  readonly contract: RealBuildPrefix50Step44CameraMeasurementSemanticContract;
}): void {
  verifyCameraMeasurementSemantics(input);
}

export function verifyRealBuildPrefix50Step44CameraAttemptSemantics(input: {
  readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  readonly artifacts: Readonly<Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>>;
  readonly contract: RealBuildPrefix50Step44PersistedCameraSemanticContract;
}): void {
  const qualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.contract.context.realDomainQualification,
  );
  if (
    qualification.reviewBatchEnvelopeCommitment !==
    input.contract.context.reviewBatchEnvelopeCommitment
  )
    throw new TypeError(
      "Persisted Step-44 camera semantics require real-domain qualification for the same exact review batch.",
    );
  verifyCameraMeasurementSemantics(input);
}
