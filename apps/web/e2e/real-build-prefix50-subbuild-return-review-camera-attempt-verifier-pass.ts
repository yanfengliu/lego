import { canonicalDigest } from "@lego-studio/brick-kernel";
import {
  createOrthographicViewCamera,
  type OrthographicViewFrame,
  type OrthographicViewParameters,
} from "@lego-studio/rendering";

import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  independentlyDeriveRealBuildPrefix50Step44CameraCommitment,
  independentlyDeriveRealBuildPrefix50Step44ForegroundMask,
  independentlyDeriveRealBuildPrefix50Step44RegistrationProposal,
  independentlyMeasureRealBuildPrefix50Step44EligibleAgreement,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-primitives.ts";
import type { RealBuildPrefix50Step44CameraMeasurementSemanticContract } from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-setup.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
import { searchRealBuildPrefix50EligibleMaskSimilarity } from "./real-build-prefix50-subbuild-return-review-camera-registration.ts";
import type {
  RealBuildPrefix50Step44CameraAlignmentPass,
  RealBuildPrefix50Step44CameraRegistrationProposal,
  RealBuildPrefix50Step44CameraSearchAttempt,
  RealBuildPrefix50Step44ParentCameraMeasurement,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";

const BEAUTY_RESTORATION_ARTIFACT_FILE =
  "real-build-prefix50-step44-page45-camera-beauty-restoration-control.png";

export interface RealBuildPrefix50Step44DecodedCameraAttemptArtifact {
  readonly pngBytes: Uint8Array;
  readonly rgba: Uint8Array;
}

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

export function deriveRealBuildPrefix50Step44PersistedCameraProposal(
  rgba: Uint8Array,
  parameters: OrthographicViewParameters,
  contract: RealBuildPrefix50Step44CameraMeasurementSemanticContract,
): RealBuildPrefix50Step44CameraRegistrationProposal {
  return independentlyDeriveRealBuildPrefix50Step44RegistrationProposal(
    searchRealBuildPrefix50EligibleMaskSimilarity({
      source: {
        width: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
        height: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
        mask: independentlyDeriveRealBuildPrefix50Step44ForegroundMask(rgba),
      },
      target: {
        width: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
        height: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
        mask: contract.parentOnlyTargetMask,
      },
      eligibleTarget: {
        width: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
        height: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
        mask: contract.eligibleMask,
      },
    }),
    parameters,
  );
}

export function deriveRealBuildPrefix50Step44PersistedCameraAgreement(
  artifact: RealBuildPrefix50Step44DecodedCameraAttemptArtifact,
  contract: RealBuildPrefix50Step44CameraMeasurementSemanticContract,
) {
  return independentlyMeasureRealBuildPrefix50Step44EligibleAgreement({
    renderedForeground: independentlyDeriveRealBuildPrefix50Step44ForegroundMask(artifact.rgba),
    target: contract.parentOnlyTargetMask,
    eligible: contract.eligibleMask,
  });
}

export function requireRealBuildPrefix50Step44PersistedCameraPass(input: {
  readonly actual: PersistedPass;
  readonly branchIndex: number;
  readonly passIndex: number;
  readonly passKind: "seed" | "confirmation" | "rebase";
  readonly parameters: OrthographicViewParameters;
  readonly frame: OrthographicViewFrame;
  readonly artifact: RealBuildPrefix50Step44DecodedCameraAttemptArtifact;
  readonly agreement: ReturnType<typeof deriveRealBuildPrefix50Step44PersistedCameraAgreement>;
  readonly proposal: RealBuildPrefix50Step44CameraRegistrationProposal | null;
  readonly predictedIntersectionOverUnion: number | null;
  readonly incomingDrift: number | null;
  readonly settled: boolean;
}): void {
  const { actual } = input;
  const projectionMatrix = requireMatrix(actual.projectionMatrix, "projection matrix");
  const matrixWorldInverse = requireMatrix(actual.matrixWorldInverse, "inverse-world matrix");
  const independentlyDerivedCamera = createOrthographicViewCamera(input.parameters, input.frame);
  const expectedProjectionMatrix = [...independentlyDerivedCamera.projectionMatrix.elements];
  const expectedMatrixWorldInverse = [...independentlyDerivedCamera.matrixWorldInverse.elements];
  requireSame(projectionMatrix, expectedProjectionMatrix, "projection matrix");
  requireSame(matrixWorldInverse, expectedMatrixWorldInverse, "inverse-world matrix");
  const expectedRendererCameraCommitment = canonicalDigest({
    request: {
      scene: "model-only",
      backgroundHex: REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
      parameters: input.parameters,
      frame: input.frame,
    },
    projectionMatrix: expectedProjectionMatrix,
    matrixWorldInverse: expectedMatrixWorldInverse,
  });
  const solvedParameters = input.proposal?.proposedParameters ?? input.parameters;
  const body = {
    passIndex: input.passIndex,
    passKind: input.passKind,
    artifactFile: artifactFile(input.branchIndex, input.passKind),
    parameters: input.parameters,
    cameraCommitment: independentlyDeriveRealBuildPrefix50Step44CameraCommitment(
      input.parameters,
      input.frame,
    ),
    projectionMatrix: expectedProjectionMatrix,
    matrixWorldInverse: expectedMatrixWorldInverse,
    pngDigest: sha256RealBuildPrefix50Step44ReviewBytes(input.artifact.pngBytes),
    pixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(input.artifact.rgba),
    rendererCameraCommitment: expectedRendererCameraCommitment,
    ...input.agreement,
    registrationProposal: input.proposal,
    predictedIntersectionOverUnion: input.predictedIntersectionOverUnion,
    incomingPredictionActualIntersectionOverUnionDrift: input.incomingDrift,
    solvedParameters,
    solvedCenterDeltaPx: Math.hypot(
      solvedParameters.centerXPx - input.parameters.centerXPx,
      solvedParameters.centerYPx - input.parameters.centerYPx,
    ),
    solvedScaleDeltaFraction:
      Math.abs(solvedParameters.pixelsPerUnit - input.parameters.pixelsPerUnit) /
      input.parameters.pixelsPerUnit,
    settled: input.settled,
  };
  if (actual.commitment !== canonicalDigest(body))
    throw new TypeError(
      `Persisted Step-44 camera branch ${input.branchIndex} ${input.passKind} pass commitment did not reproduce.`,
    );
  requireSame(
    withoutCommitment(actual),
    body,
    `branch ${input.branchIndex} ${input.passKind} pass`,
  );
}

export function verifyRealBuildPrefix50Step44PersistedBeautyControl(input: {
  readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  readonly rows: readonly RealBuildPrefix50Step44ParentCameraMeasurement[];
  readonly artifacts: Readonly<Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>>;
  readonly frame: OrthographicViewFrame;
}): boolean {
  const controlled =
    input.rows.find((row) => row.branchKey === input.attempt.geometrySelection.selectedBranchKey) ??
    input.rows[0];
  if (controlled === undefined)
    throw new TypeError("Persisted Step-44 camera restoration control has no branch to control.");
  const published = controlled.alignmentPasses[controlled.publishedPassIndex] as
    PersistedPass | undefined;
  if (published === undefined)
    throw new TypeError(
      `Persisted Step-44 camera restoration branch ${controlled.branchKey} has no published pass.`,
    );
  const controlArtifact = requireArtifact(input.artifacts, BEAUTY_RESTORATION_ARTIFACT_FILE);
  const publishedArtifact = requireArtifact(input.artifacts, published.artifactFile);
  const camera = createOrthographicViewCamera(controlled.selectedParameters, input.frame);
  const projectionMatrix = [...camera.projectionMatrix.elements];
  const matrixWorldInverse = [...camera.matrixWorldInverse.elements];
  const rendererCameraCommitment = canonicalDigest({
    request: {
      scene: "model-only",
      backgroundHex: REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
      parameters: controlled.selectedParameters,
      frame: input.frame,
    },
    projectionMatrix,
    matrixWorldInverse,
  });
  const byteIdenticalToPublishedRender =
    controlArtifact.pngBytes.byteLength === publishedArtifact.pngBytes.byteLength &&
    controlArtifact.pngBytes.every((value, index) => value === publishedArtifact.pngBytes[index]);
  const body = {
    artifactFile: BEAUTY_RESTORATION_ARTIFACT_FILE,
    controlledBranchKey: controlled.branchKey,
    controlledCameraCommitment: controlled.selectedCameraCommitment,
    pngDigest: sha256RealBuildPrefix50Step44ReviewBytes(controlArtifact.pngBytes),
    pixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(controlArtifact.rgba),
    projectionMatrix,
    matrixWorldInverse,
    rendererCameraCommitment,
    byteIdenticalToPublishedRender,
  };
  requireSame(
    input.attempt.beautyRestorationControl,
    { ...body, commitment: canonicalDigest(body) },
    "beauty restoration control",
  );
  return byteIdenticalToPublishedRender;
}

export function requireRealBuildPrefix50Step44PersistedExactArtifactSet(input: {
  readonly rows: readonly RealBuildPrefix50Step44ParentCameraMeasurement[];
  readonly artifacts: Readonly<Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>>;
}): number {
  const expected = [BEAUTY_RESTORATION_ARTIFACT_FILE];
  for (const row of input.rows) {
    expected.push(...row.alignmentPasses.map((pass) => pass.artifactFile));
    expected.push(semanticArtifactFile(row.branchIndex));
  }
  expected.sort();
  const actual = Object.keys(input.artifacts).sort();
  if (actual.length !== expected.length || actual.some((file, index) => file !== expected[index]))
    throw new TypeError(
      "Persisted Step-44 camera attempt must retain exactly its beauty passes, 16 semantic renders, and one beauty-restoration control.",
    );
  return actual.length;
}
