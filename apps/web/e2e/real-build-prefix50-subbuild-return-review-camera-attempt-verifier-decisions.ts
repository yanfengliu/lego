import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  deriveRealBuildPrefix50Step44InteriorFeatureCalibration,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
} from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS,
  type RealBuildPrefix50Step44CameraSearchAttempt,
  type RealBuildPrefix50Step44CameraSearchRefusal,
  type RealBuildPrefix50Step44ParentCameraMeasurement,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import { requireStableCameraMeasurementRoster } from "./real-build-prefix50-subbuild-return-review-camera-search-primitives.ts";

const THRESHOLDS = REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS;
const EXPECTED_METRIC_CALIBRATION_COMMITMENT =
  "sha256:6cb2af38155611540f4820cb424a0416fdb1a59b93a769e31a09beaa4ec4027d" as const;

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function requireSame(actual: unknown, expected: unknown, label: string): void {
  if (canonicalDigest(actual) !== canonicalDigest(expected))
    throw new TypeError(`Persisted Step-44 camera ${label} did not independently reproduce.`);
}

function byGeometry(
  rows: readonly RealBuildPrefix50Step44ParentCameraMeasurement[],
): readonly RealBuildPrefix50Step44ParentCameraMeasurement[] {
  return [...rows].sort((left, right) =>
    right.selectedIntersectionOverUnion === left.selectedIntersectionOverUnion
      ? left.branchIndex - right.branchIndex
      : right.selectedIntersectionOverUnion - left.selectedIntersectionOverUnion,
  );
}

function hasIndependentlyComparableRegistration(
  row: RealBuildPrefix50Step44ParentCameraMeasurement,
): boolean {
  const proposal = row.alignmentPasses[0]?.registrationProposal;
  return (
    row.converged &&
    row.publishedPassIndex > 0 &&
    proposal?.status === "locally-contained" &&
    proposal.diagnostics.coarseDomainComplete &&
    proposal.diagnostics.coarseObjectiveTieClassificationComplete &&
    proposal.diagnostics.exactObjectiveTieClassificationComplete &&
    proposal.diagnostics.localFinalCellContainmentComplete &&
    row.alignmentPasses[row.publishedPassIndex]?.settled === true
  );
}

function expectedDecisions(
  rows: readonly RealBuildPrefix50Step44ParentCameraMeasurement[],
  expectedPanelFace: "studs-up" | "underside",
) {
  requireStableCameraMeasurementRoster(rows, expectedPanelFace);
  const expectedRows = rows.filter((row) => row.branchFace === expectedPanelFace);
  const registrationComplete = expectedRows.every(hasIndependentlyComparableRegistration);
  const selected = registrationComplete
    ? byGeometry(expectedRows.filter(hasIndependentlyComparableRegistration))[0]
    : undefined;
  const otherExpected =
    selected === undefined
      ? undefined
      : byGeometry(expectedRows.filter((row) => row.branchKey !== selected.branchKey))[0];
  const unexpected = rows.filter((row) => row.branchFace !== expectedPanelFace);
  const strongestUnexpectedFaceIntersectionOverUnion = Math.max(
    0,
    ...unexpected.map((row) => row.selectedIntersectionOverUnion),
  );
  const geometryMargin =
    selected === undefined || otherExpected === undefined
      ? null
      : selected.selectedIntersectionOverUnion - otherExpected.selectedIntersectionOverUnion;
  const geometryBody = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-geometry-selection/1" as const,
    authority: "eligible-silhouette-iou-only" as const,
    expectedPanelFace,
    stableBranchOrder: rows.map((row) => row.branchKey),
    eligibleGeometryCommitments: expectedRows.map((row) => row.geometryCommitment),
    counterevidenceGeometryCommitments: unexpected.map((row) => row.geometryCommitment),
    selectedBranchKey: selected?.branchKey ?? null,
    selectedIntersectionOverUnion: selected?.selectedIntersectionOverUnion ?? null,
    strongestOtherExpectedFaceBranchKey: otherExpected?.branchKey ?? null,
    strongestOtherExpectedFaceIntersectionOverUnion:
      otherExpected?.selectedIntersectionOverUnion ?? null,
    strongestUnexpectedFaceIntersectionOverUnion,
    expectedFaceGeometryMargin: geometryMargin,
    thresholds: {
      minimumParentOnlyIntersectionOverUnion: THRESHOLDS.minimumParentOnlyIntersectionOverUnion,
      minimumBranchWinnerMargin: THRESHOLDS.minimumBranchWinnerMargin,
    },
    passed:
      selected !== undefined &&
      registrationComplete &&
      otherExpected !== undefined &&
      selected.selectedIntersectionOverUnion >= THRESHOLDS.minimumParentOnlyIntersectionOverUnion &&
      geometryMargin! >= THRESHOLDS.minimumBranchWinnerMargin,
  };
  const geometry = { ...geometryBody, commitment: canonicalDigest(geometryBody) };
  const selectedF1 = selected?.interiorFeatureMeasurement.f1 ?? null;
  const otherExpectedComparable =
    otherExpected !== undefined && hasIndependentlyComparableRegistration(otherExpected);
  const otherExpectedF1 = otherExpectedComparable
    ? otherExpected.interiorFeatureMeasurement.f1
    : null;
  const strongestUnexpectedFaceBlueCyanF1 = Math.max(
    0,
    ...unexpected.map((row) => row.interiorFeatureMeasurement.f1),
  );
  const featureMargin =
    selectedF1 === null || otherExpectedF1 === null ? null : selectedF1 - otherExpectedF1;
  return {
    geometry,
    selectedF1,
    otherExpectedBranchKey: otherExpected?.branchKey ?? null,
    otherExpectedComparable,
    otherExpectedF1,
    strongestUnexpectedFaceBlueCyanF1,
    featureMargin,
  };
}

export function verifyRealBuildPrefix50Step44CameraAttemptDecisionSemantics(input: {
  readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  readonly rows: readonly RealBuildPrefix50Step44ParentCameraMeasurement[];
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly featureSourceCommitment: Sha256Digest;
  readonly sourceEligibleMaskDigest: Sha256Digest;
  readonly parentOnlyTargetMaskDigest: Sha256Digest;
  readonly artifactCount: number;
  readonly beautyRestorationPassed: boolean;
}): void {
  const calibration = deriveRealBuildPrefix50Step44InteriorFeatureCalibration();
  if (
    REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT !==
      EXPECTED_METRIC_CALIBRATION_COMMITMENT ||
    calibration.commitment !== EXPECTED_METRIC_CALIBRATION_COMMITMENT ||
    canonicalDigest(calibration.derivedThresholds) !==
      canonicalDigest({
        minimumBlueCyanF1: THRESHOLDS.minimumBlueCyanF1,
        minimumExpectedFaceBlueCyanF1Margin: THRESHOLDS.minimumExpectedFaceBlueCyanF1Margin,
      })
  )
    throw new TypeError(
      "Persisted Step-44 camera metric-v2 calibration or its derived thresholds did not independently reproduce.",
    );
  const decisions = expectedDecisions(input.rows, input.expectedPanelFace);
  requireSame(input.attempt.geometrySelection, decisions.geometry, "geometry selection");
  const featureBody = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-feature-corroboration/2" as const,
    authority: "refusal-only" as const,
    selectionAuthority: false as const,
    tieBreakAuthority: false as const,
    retryAuthority: false as const,
    hogAuthority: "diagnostic-only" as const,
    metricCalibrationCommitment: calibration.commitment,
    sourceCommitment: input.featureSourceCommitment,
    geometrySelectionCommitment: decisions.geometry.commitment,
    branchMeasurementCommitments: input.rows.map(
      (row) => row.interiorFeatureMeasurement.commitment,
    ),
    selectedBranchKey: decisions.geometry.selectedBranchKey,
    selectedBlueCyanF1: decisions.selectedF1,
    geometryRunnerUpBranchKey: decisions.otherExpectedBranchKey,
    geometryRunnerUpFeatureComparable: decisions.otherExpectedComparable,
    geometryRunnerUpBlueCyanF1: decisions.otherExpectedF1,
    strongestUnexpectedFaceBlueCyanF1: decisions.strongestUnexpectedFaceBlueCyanF1,
    expectedFaceBlueCyanF1Margin: decisions.featureMargin,
    thresholds: {
      minimumBlueCyanF1: THRESHOLDS.minimumBlueCyanF1,
      minimumExpectedFaceBlueCyanF1Margin: THRESHOLDS.minimumExpectedFaceBlueCyanF1Margin,
    },
    passed:
      decisions.geometry.passed &&
      decisions.selectedF1 !== null &&
      decisions.otherExpectedF1 !== null &&
      decisions.selectedF1 >= THRESHOLDS.minimumBlueCyanF1 &&
      decisions.featureMargin! >= THRESHOLDS.minimumExpectedFaceBlueCyanF1Margin,
  };
  const feature = { ...featureBody, commitment: canonicalDigest(featureBody) };
  requireSame(input.attempt.featureCorroboration, feature, "feature corroboration");
  const refusalReasons: RealBuildPrefix50Step44CameraSearchRefusal[] = [];
  const expectedRows = input.rows.filter((row) => row.branchFace === input.expectedPanelFace);
  if (!expectedRows.every(hasIndependentlyComparableRegistration))
    refusalReasons.push("incomplete-branch-registration");
  if (decisions.geometry.selectedBranchKey === null)
    refusalReasons.push("no-converged-expected-face-branch");
  else {
    if (
      decisions.geometry.selectedIntersectionOverUnion! <
      THRESHOLDS.minimumParentOnlyIntersectionOverUnion
    )
      refusalReasons.push("minimum-parent-iou-not-met");
    if (decisions.geometry.strongestOtherExpectedFaceIntersectionOverUnion === null)
      refusalReasons.push("no-other-expected-face-geometry-runner");
    else if (decisions.geometry.expectedFaceGeometryMargin! < THRESHOLDS.minimumBranchWinnerMargin)
      refusalReasons.push("expected-face-geometry-margin-not-met");
    if (feature.selectedBlueCyanF1! < THRESHOLDS.minimumBlueCyanF1)
      refusalReasons.push("blue-cyan-f1-floor-not-met");
    if (feature.geometryRunnerUpBlueCyanF1 === null)
      refusalReasons.push("no-other-expected-face-feature-runner");
    else if (feature.expectedFaceBlueCyanF1Margin! < THRESHOLDS.minimumExpectedFaceBlueCyanF1Margin)
      refusalReasons.push("expected-face-blue-cyan-margin-not-met");
  }
  if (!input.beautyRestorationPassed) refusalReasons.push("beauty-restoration-control-failed");
  const renderCount = input.rows.reduce((count, row) => count + row.alignmentPasses.length, 0);
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-search-attempt/2" as const,
    expectedPanelFace: input.expectedPanelFace,
    sourceEligibleMaskDigest: input.sourceEligibleMaskDigest,
    parentOnlyTargetMaskDigest: input.parentOnlyTargetMaskDigest,
    thresholds: THRESHOLDS,
    renderCount,
    maximumRenderCount: 48 as const,
    semanticRenderCount: 16 as const,
    restorationControlRenderCount: 1 as const,
    totalCaptureCount: input.artifactCount,
    maximumTotalCaptureCount: 65 as const,
    beautyRestorationControl: input.attempt.beautyRestorationControl,
    metricCalibrationCommitment: calibration.commitment,
    geometrySelection: decisions.geometry,
    geometrySelectionCommitment: decisions.geometry.commitment,
    featureCorroboration: feature,
    featureCorroborationCommitment: feature.commitment,
    branchMeasurements: input.rows,
    branchMeasurementsCommitment: canonicalDigest(input.rows),
    status: refusalReasons.length === 0 ? ("resolved" as const) : ("refused" as const),
    refusalReasons,
  };
  if (input.attempt.commitment !== canonicalDigest(body))
    throw new TypeError("Persisted Step-44 camera attempt semantic commitment did not reproduce.");
  requireSame(withoutCommitment(input.attempt), body, "attempt decision and refusal result");
}
