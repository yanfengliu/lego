import { createHash } from "node:crypto";

import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS,
  type RealBuildPrefix50Step44CameraSearchAttempt,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-search-types.ts";

export const QUALIFICATION_FIXTURE_WIDTH = 720;
export const QUALIFICATION_FIXTURE_HEIGHT = 470;

export type QualificationFixtureAnchor = Readonly<{
  pooledCounterevidenceFailure: null;
  latticeFit: Readonly<{
    solution: Readonly<{ azimuthDegrees: number; elevationDegrees: number }>;
  }>;
  commitment: Sha256Digest;
}>;

export function qualificationFixtureDigest(label: string): Sha256Digest {
  return canonicalDigest({ persistedQualificationFixture: label });
}

export function sha256QualificationFixtureBytes(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function commitQualificationFixture<T extends object>(
  body: T,
): T & { readonly commitment: Sha256Digest } {
  return Object.freeze({ ...body, commitment: canonicalDigest(body) });
}

export function requireCanonicalQualificationSourceSequence<
  Sequence extends Readonly<object & { commitment: Sha256Digest }>,
>(sequence: Sequence): void {
  const { commitment, ...body } = sequence;
  if (commitment !== canonicalDigest(body))
    throw new TypeError("Genuine real-domain source sequence did not canonically serialize.");
}

export function qualificationFixturePng(
  color: readonly [number, number, number, number],
): Uint8Array {
  const rgba = new Uint8Array(QUALIFICATION_FIXTURE_WIDTH * QUALIFICATION_FIXTURE_HEIGHT * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) rgba.set(color, offset);
  return encodeCanonicalRealBuildPrefix50Step44ReviewPng({
    width: QUALIFICATION_FIXTURE_WIDTH,
    height: QUALIFICATION_FIXTURE_HEIGHT,
    rgba,
  });
}

export function createQualificationAttemptFixture(
  maskDigest: Sha256Digest,
  renderPng: Uint8Array,
): Readonly<{
  attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  artifacts: Readonly<Record<string, Uint8Array>>;
  semanticPolicyCommitment: Sha256Digest;
}> {
  const semanticPolicyCommitment = qualificationFixtureDigest("semantic-policy");
  const artifacts: Record<string, Uint8Array> = {};
  const rows = Array.from({ length: 16 }, (_, index) => {
    const renderFile = `render-${String(index).padStart(2, "0")}.png`;
    const semanticFile = `semantic-${String(index).padStart(2, "0")}.png`;
    artifacts[renderFile] = renderPng;
    artifacts[semanticFile] = renderPng;
    const pass = commitQualificationFixture({
      artifactFile: renderFile,
      incomingPredictionActualIntersectionOverUnionDrift: 0,
      registrationProposal: null,
    });
    const semanticColorArtifact = commitQualificationFixture({
      artifactFile: semanticFile,
      policyCommitment: semanticPolicyCommitment,
    });
    const interiorFeatureMeasurement = commitQualificationFixture({
      f1: 1,
      semanticPolicyCommitment,
    });
    return commitQualificationFixture({
      branchKey:
        index === 0
          ? "face:studs-up/hand:as-fitted/turn:0"
          : `face:fixture/hand:fixture/turn:${index}`,
      alignmentPasses: [pass],
      alignmentPassesCommitment: canonicalDigest([pass]),
      semanticColorArtifact,
      interiorFeatureMeasurement,
    });
  });
  const geometrySelection = commitQualificationFixture({
    selectedBranchKey: "face:studs-up/hand:as-fitted/turn:0",
    selectedIntersectionOverUnion: 1,
    expectedFaceGeometryMargin: 1,
  });
  const featureCorroboration = commitQualificationFixture({
    expectedFaceBlueCyanF1Margin: 1,
  });
  const beautyRestorationControl = commitQualificationFixture({
    artifactFile: "beauty-control.png",
  });
  artifacts[beautyRestorationControl.artifactFile] = renderPng;
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-search-attempt/2" as const,
    expectedPanelFace: "studs-up" as const,
    sourceEligibleMaskDigest: maskDigest,
    parentOnlyTargetMaskDigest: maskDigest,
    thresholds: REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS,
    renderCount: 16,
    maximumRenderCount: 48 as const,
    semanticRenderCount: 16 as const,
    restorationControlRenderCount: 1 as const,
    totalCaptureCount: 33,
    maximumTotalCaptureCount: 65 as const,
    beautyRestorationControl,
    metricCalibrationCommitment: qualificationFixtureDigest("metric-calibration"),
    geometrySelection,
    geometrySelectionCommitment: geometrySelection.commitment,
    featureCorroboration,
    featureCorroborationCommitment: featureCorroboration.commitment,
    branchMeasurements: rows,
    branchMeasurementsCommitment: canonicalDigest(rows),
    status: "resolved" as const,
    refusalReasons: [] as const,
  };
  return Object.freeze({
    attempt: commitQualificationFixture(
      body,
    ) as unknown as RealBuildPrefix50Step44CameraSearchAttempt,
    artifacts: Object.freeze(artifacts),
    semanticPolicyCommitment,
  });
}
