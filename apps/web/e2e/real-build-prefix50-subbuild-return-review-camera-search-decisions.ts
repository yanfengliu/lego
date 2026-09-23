import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import { REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS,
  type RealBuildPrefix50Step44CameraSearchRefusal,
  type RealBuildPrefix50Step44FeatureCorroboration,
  type RealBuildPrefix50Step44GeometrySelection,
  type RealBuildPrefix50Step44ParentCameraMeasurement,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import {
  requireStableCameraMeasurementRoster,
  stableBranchKeys,
} from "./real-build-prefix50-subbuild-return-review-camera-search-primitives.ts";

type GeometryBranchMeasurement = Omit<
  RealBuildPrefix50Step44ParentCameraMeasurement,
  "commitment" | "semanticColorArtifact" | "interiorFeatureMeasurement"
>;

const THRESHOLDS = REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS;

function hasComparableRegistration(row: GeometryBranchMeasurement): boolean {
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

export function deriveRealBuildPrefix50Step44GeometrySelection(
  rows: readonly GeometryBranchMeasurement[],
  expectedPanelFace: "studs-up" | "underside",
): RealBuildPrefix50Step44GeometrySelection {
  requireStableCameraMeasurementRoster(rows, expectedPanelFace);
  const expected = rows.filter((row) => row.branchFace === expectedPanelFace);
  const registrationComplete = expected.every(hasComparableRegistration);
  const eligible = rows
    .filter((row) => row.geometryEligible && hasComparableRegistration(row))
    .sort((left, right) =>
      right.selectedIntersectionOverUnion === left.selectedIntersectionOverUnion
        ? left.branchIndex - right.branchIndex
        : right.selectedIntersectionOverUnion - left.selectedIntersectionOverUnion,
    );
  const selected = registrationComplete ? eligible[0] : undefined;
  const unexpected = rows.filter((row) => row.branchFace !== expectedPanelFace);
  const strongestOtherExpectedFace =
    selected === undefined
      ? undefined
      : expected
          .filter((row) => row.branchKey !== selected.branchKey)
          .sort((left, right) =>
            right.selectedIntersectionOverUnion === left.selectedIntersectionOverUnion
              ? left.branchIndex - right.branchIndex
              : right.selectedIntersectionOverUnion - left.selectedIntersectionOverUnion,
          )[0];
  const strongestOtherExpectedFaceIntersectionOverUnion =
    strongestOtherExpectedFace?.selectedIntersectionOverUnion ?? null;
  const strongestUnexpectedFaceIntersectionOverUnion = Math.max(
    0,
    ...unexpected.map((row) => row.selectedIntersectionOverUnion),
  );
  const expectedFaceGeometryMargin =
    selected === undefined || strongestOtherExpectedFaceIntersectionOverUnion === null
      ? null
      : selected.selectedIntersectionOverUnion - strongestOtherExpectedFaceIntersectionOverUnion;
  const passed =
    selected !== undefined &&
    registrationComplete &&
    selected.selectedIntersectionOverUnion >= THRESHOLDS.minimumParentOnlyIntersectionOverUnion &&
    strongestOtherExpectedFaceIntersectionOverUnion !== null &&
    expectedFaceGeometryMargin! >= THRESHOLDS.minimumBranchWinnerMargin;
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-geometry-selection/1" as const,
    authority: "eligible-silhouette-iou-only" as const,
    expectedPanelFace,
    stableBranchOrder: stableBranchKeys(),
    eligibleGeometryCommitments: expected.map((row) => row.geometryCommitment),
    counterevidenceGeometryCommitments: unexpected.map((row) => row.geometryCommitment),
    selectedBranchKey: selected?.branchKey ?? null,
    selectedIntersectionOverUnion: selected?.selectedIntersectionOverUnion ?? null,
    strongestOtherExpectedFaceBranchKey: strongestOtherExpectedFace?.branchKey ?? null,
    strongestOtherExpectedFaceIntersectionOverUnion,
    strongestUnexpectedFaceIntersectionOverUnion,
    expectedFaceGeometryMargin,
    thresholds: {
      minimumParentOnlyIntersectionOverUnion: THRESHOLDS.minimumParentOnlyIntersectionOverUnion,
      minimumBranchWinnerMargin: THRESHOLDS.minimumBranchWinnerMargin,
    },
    passed,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function deriveRealBuildPrefix50Step44FeatureCorroboration(input: {
  readonly rows: readonly RealBuildPrefix50Step44ParentCameraMeasurement[];
  readonly geometry: RealBuildPrefix50Step44GeometrySelection;
  readonly sourceCommitment: `sha256:${string}`;
}): RealBuildPrefix50Step44FeatureCorroboration {
  requireStableCameraMeasurementRoster(input.rows, input.geometry.expectedPanelFace);
  const selected = input.rows.find((row) => row.branchKey === input.geometry.selectedBranchKey);
  const geometryRunnerUp = input.rows.find(
    (row) => row.branchKey === input.geometry.strongestOtherExpectedFaceBranchKey,
  );
  const unexpected = input.rows.filter(
    (row) => row.branchFace !== input.geometry.expectedPanelFace,
  );
  const geometryRunnerUpFeatureComparable =
    geometryRunnerUp !== undefined && hasComparableRegistration(geometryRunnerUp);
  const geometryRunnerUpBlueCyanF1 = geometryRunnerUpFeatureComparable
    ? geometryRunnerUp.interiorFeatureMeasurement.f1
    : null;
  const strongestUnexpectedFaceBlueCyanF1 = Math.max(
    0,
    ...unexpected.map((row) => row.interiorFeatureMeasurement.f1),
  );
  const selectedBlueCyanF1 = selected?.interiorFeatureMeasurement.f1 ?? null;
  const expectedFaceBlueCyanF1Margin =
    selectedBlueCyanF1 === null || geometryRunnerUpBlueCyanF1 === null
      ? null
      : selectedBlueCyanF1 - geometryRunnerUpBlueCyanF1;
  const passed =
    input.geometry.passed &&
    selectedBlueCyanF1 !== null &&
    selectedBlueCyanF1 >= THRESHOLDS.minimumBlueCyanF1 &&
    geometryRunnerUpBlueCyanF1 !== null &&
    expectedFaceBlueCyanF1Margin! >= THRESHOLDS.minimumExpectedFaceBlueCyanF1Margin;
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-feature-corroboration/2" as const,
    authority: "refusal-only" as const,
    selectionAuthority: false as const,
    tieBreakAuthority: false as const,
    retryAuthority: false as const,
    hogAuthority: "diagnostic-only" as const,
    metricCalibrationCommitment: REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
    sourceCommitment: input.sourceCommitment,
    geometrySelectionCommitment: input.geometry.commitment,
    branchMeasurementCommitments: input.rows.map(
      (row) => row.interiorFeatureMeasurement.commitment,
    ),
    selectedBranchKey: input.geometry.selectedBranchKey,
    selectedBlueCyanF1,
    geometryRunnerUpBranchKey: input.geometry.strongestOtherExpectedFaceBranchKey,
    geometryRunnerUpFeatureComparable,
    geometryRunnerUpBlueCyanF1,
    strongestUnexpectedFaceBlueCyanF1,
    expectedFaceBlueCyanF1Margin,
    thresholds: {
      minimumBlueCyanF1: THRESHOLDS.minimumBlueCyanF1,
      minimumExpectedFaceBlueCyanF1Margin: THRESHOLDS.minimumExpectedFaceBlueCyanF1Margin,
    },
    passed,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function deriveRealBuildPrefix50Step44CameraRefusalReasons(input: {
  readonly rows: readonly GeometryBranchMeasurement[];
  readonly geometry: RealBuildPrefix50Step44GeometrySelection;
  readonly feature: RealBuildPrefix50Step44FeatureCorroboration;
}): readonly RealBuildPrefix50Step44CameraSearchRefusal[] {
  requireStableCameraMeasurementRoster(input.rows, input.geometry.expectedPanelFace);
  const reasons: RealBuildPrefix50Step44CameraSearchRefusal[] = [];
  const expectedRows = input.rows.filter(
    (row) => row.branchFace === input.geometry.expectedPanelFace,
  );
  if (!expectedRows.every(hasComparableRegistration))
    reasons.push("incomplete-branch-registration");
  if (input.geometry.selectedBranchKey === null) {
    reasons.push("no-converged-expected-face-branch");
    return Object.freeze(reasons);
  }
  if (
    input.geometry.selectedIntersectionOverUnion! <
    THRESHOLDS.minimumParentOnlyIntersectionOverUnion
  )
    reasons.push("minimum-parent-iou-not-met");
  if (input.geometry.strongestOtherExpectedFaceIntersectionOverUnion === null)
    reasons.push("no-other-expected-face-geometry-runner");
  else if (input.geometry.expectedFaceGeometryMargin! < THRESHOLDS.minimumBranchWinnerMargin)
    reasons.push("expected-face-geometry-margin-not-met");
  if (
    input.feature.selectedBlueCyanF1 === null ||
    input.feature.selectedBlueCyanF1 < THRESHOLDS.minimumBlueCyanF1
  )
    reasons.push("blue-cyan-f1-floor-not-met");
  if (input.feature.geometryRunnerUpBlueCyanF1 === null)
    reasons.push("no-other-expected-face-feature-runner");
  else if (
    input.feature.expectedFaceBlueCyanF1Margin! < THRESHOLDS.minimumExpectedFaceBlueCyanF1Margin
  )
    reasons.push("expected-face-blue-cyan-margin-not-met");
  return Object.freeze(reasons);
}
