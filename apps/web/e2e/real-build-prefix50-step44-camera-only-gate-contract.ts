import { canonicalDigest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50Step44Page45CameraReceipt } from "./real-build-prefix50-subbuild-return-review-camera-receipt-types.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS,
  type RealBuildPrefix50Step44CameraBranchKey,
  type RealBuildPrefix50Step44CameraSearchAttempt,
  type RealBuildPrefix50Step44CameraSearchRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import { stableBranchKeys } from "./real-build-prefix50-subbuild-return-review-camera-search-primitives.ts";
import { requireRealBuildPrefix50Step44SemanticColorPolicy } from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";
import {
  deriveRealBuildPrefix50Step44InteriorFeatureCalibration,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
} from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import type { RealBuildPrefix50Step44CameraOnlyRefusalSummary } from "./real-build-prefix50-step44-camera-only-gate-contract-types.ts";
import { REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE } from "./real-build-prefix50-step44-camera-only-gate-input.ts";

export type { RealBuildPrefix50Step44CameraOnlyRefusalSummary } from "./real-build-prefix50-step44-camera-only-gate-contract-types.ts";

export {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_DEFAULT_OUTPUT_NAME,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_GATE_ENV,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_OUTPUT_ENV,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_QUALIFICATION_OUTPUT_ENV,
  requireRealBuildPrefix50Step44CameraOnlyOutputName,
} from "./real-build-prefix50-step44-camera-only-gate-input.ts";
export {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_BYTES_HASH,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH,
} from "./real-build-prefix50-step44-review-batch-pin.ts";

const CAMERA_ONLY_POLICY =
  "page45-and-shared-step43-parent-only-no-candidate-no-step45-no-page46" as const;
const BRANCH_RENDER =
  /^real-build-prefix50-step44-page45-camera-branch-[0-9]{2}-(?:seed|confirmation|rebase)\.png$/u;
const BRANCH_OVERLAY =
  /^real-build-prefix50-step44-page45-camera-branch-[0-9]{2}-(?:seed|confirmation|rebase)-overlay\.png$/u;
const BRANCH_SEMANTIC_RENDER =
  /^real-build-prefix50-step44-page45-camera-branch-[0-9]{2}-semantic-blue-cyan\.png$/u;
const COMPLETE_FIXED_OUTPUT_FILES = new Set([
  "camera-only-static-app.log",
  "real-build-prefix50-step44-page45-camera-attempt.json",
  "real-build-prefix50-step44-page45-camera-source-crop.png",
  "real-build-prefix50-step44-page45-camera-eligible-mask.png",
  "real-build-prefix50-step44-page45-camera-parent-target-mask.png",
  "real-build-prefix50-step44-page45-camera-selected-parent.png",
  "real-build-prefix50-step44-page45-camera-beauty-restoration-control.png",
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
]);
const REFUSED_FIXED_OUTPUT_FILES = new Set([
  "camera-only-static-app.log",
  "real-build-prefix50-step44-page45-camera-attempt.json",
  "real-build-prefix50-step44-page45-camera-beauty-restoration-control.png",
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
]);
const ALLOWED_FIXED_OUTPUT_FILES = new Set([
  ...COMPLETE_FIXED_OUTPUT_FILES,
  ...REFUSED_FIXED_OUTPUT_FILES,
]);

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TypeError(message);
}

const sameValue = (left: unknown, right: unknown): boolean =>
  canonicalDigest(left) === canonicalDigest(right);

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

export function assertRealBuildPrefix50Step44CameraOnlyOutputEntries(input: {
  readonly files: readonly string[];
  readonly directories: readonly string[];
  readonly complete: boolean;
  readonly status?: "complete" | "refused";
  readonly expectedCompleteFiles?: readonly string[];
  readonly expectedRefusalFiles?: readonly string[];
}): void {
  requireCondition(
    input.directories.length === 0,
    `Camera-only Step-44 output may not contain artifact directories: ${input.directories.join(", ")}.`,
  );
  const files = [...input.files].sort();
  requireCondition(
    new Set(files).size === files.length,
    "Camera-only Step-44 output file names must be unique.",
  );
  for (const file of files) {
    requireCondition(
      !file.toLowerCase().includes("candidate"),
      `Candidate artifact escaped: ${file}.`,
    );
    requireCondition(!file.toLowerCase().includes("page46"), `Page-46 artifact escaped: ${file}.`);
    requireCondition(
      ALLOWED_FIXED_OUTPUT_FILES.has(file) ||
        BRANCH_RENDER.test(file) ||
        BRANCH_OVERLAY.test(file) ||
        BRANCH_SEMANTIC_RENDER.test(file),
      `Unexpected camera-only Step-44 artifact: ${file}.`,
    );
  }
  if (input.complete) {
    for (const required of COMPLETE_FIXED_OUTPUT_FILES)
      requireCondition(
        files.includes(required),
        `Camera-only Step-44 artifact is absent: ${required}.`,
      );
    const renders = files.filter((file) => BRANCH_RENDER.test(file));
    const overlays = files.filter((file) => BRANCH_OVERLAY.test(file));
    const semanticRenders = files.filter((file) => BRANCH_SEMANTIC_RENDER.test(file));
    const expectedOverlays = renders.map((file) => `${file.slice(0, -4)}-overlay.png`).sort();
    requireCondition(
      renders.length >= 16 && renders.length <= 48 && sameValue(overlays, expectedOverlays),
      "Camera-only Step-44 output must retain 16..48 renders and the exact stem-matched overlay set.",
    );
    requireCondition(
      semanticRenders.length === 16,
      "Camera-only Step-44 output must retain exactly one semantic color-ID render per branch.",
    );
    requireCondition(
      sameValue(files, [...(input.expectedCompleteFiles ?? [])].sort()),
      "Complete camera-only Step-44 output must contain exactly its verified attempt renders, generated overlays, fixed instrument artifacts, log, and manifest.",
    );
  }
  if (input.status === "refused") {
    for (const required of REFUSED_FIXED_OUTPUT_FILES)
      requireCondition(
        files.includes(required),
        `Refused camera-only Step-44 artifact is absent: ${required}.`,
      );
    const renders = files.filter((file) => BRANCH_RENDER.test(file));
    const overlays = files.filter((file) => BRANCH_OVERLAY.test(file));
    const semanticRenders = files.filter((file) => BRANCH_SEMANTIC_RENDER.test(file));
    requireCondition(
      !input.complete &&
        renders.length >= 16 &&
        renders.length <= 48 &&
        semanticRenders.length === 16 &&
        overlays.length === 0 &&
        files.length ===
          renders.length + semanticRenders.length + REFUSED_FIXED_OUTPUT_FILES.size &&
        sameValue(files, [...(input.expectedRefusalFiles ?? [])].sort()),
      "Refused camera-only Step-44 output must contain exactly its persisted beauty passes, 16 semantic renders, restoration control, attempt, log, and refusal manifest.",
    );
  }
}

export function assertRealBuildPrefix50Step44CameraOnlyRefusedAttempt(input: {
  readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  readonly typedAttemptCommitment: string;
  readonly typedRefusalReasons: readonly RealBuildPrefix50Step44CameraSearchRefusal[];
}): RealBuildPrefix50Step44CameraOnlyRefusalSummary {
  const { attempt } = input;
  const calibration = deriveRealBuildPrefix50Step44InteriorFeatureCalibration();
  requireCondition(
    attempt.commitment === canonicalDigest(withoutCommitment(attempt)) &&
      attempt.commitment === input.typedAttemptCommitment &&
      attempt.status === "refused" &&
      attempt.refusalReasons.length > 0 &&
      sameValue(attempt.refusalReasons, input.typedRefusalReasons),
    "Camera-only Step-44 refusal did not exactly bind its typed persisted attempt commitment and reasons.",
  );
  requireCondition(
    attempt.metricCalibrationCommitment === calibration.commitment &&
      attempt.metricCalibrationCommitment ===
        REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT &&
      attempt.featureCorroboration.metricCalibrationCommitment === calibration.commitment &&
      attempt.thresholds.minimumBlueCyanF1 === calibration.derivedThresholds.minimumBlueCyanF1 &&
      attempt.thresholds.minimumExpectedFaceBlueCyanF1Margin ===
        calibration.derivedThresholds.minimumExpectedFaceBlueCyanF1Margin,
    "Camera-only Step-44 refusal drifted from its independently reproduced metric-v2 calibration.",
  );
  const renderCount = attempt.branchMeasurements.reduce(
    (count, branch) => count + branch.alignmentPasses.length,
    0,
  );
  requireCondition(
    attempt.branchMeasurements.length === 16 &&
      attempt.renderCount === renderCount &&
      renderCount >= 16 &&
      renderCount <= 48 &&
      attempt.semanticRenderCount === 16 &&
      attempt.restorationControlRenderCount === 1 &&
      attempt.totalCaptureCount === renderCount + 17 &&
      attempt.totalCaptureCount <= attempt.maximumTotalCaptureCount &&
      (!attempt.geometrySelection.passed ||
        !attempt.featureCorroboration.passed ||
        !attempt.beautyRestorationControl.byteIdenticalToPublishedRender),
    "Camera-only Step-44 refused attempt did not retain its exact closed capture accounting and failed refusal control.",
  );
  return Object.freeze({
    status: "refused" as const,
    searchAttemptCommitment: attempt.commitment,
    refusalReasons: Object.freeze([...attempt.refusalReasons]),
    selectedBranchKey: attempt.geometrySelection.selectedBranchKey,
    geometryPassed: attempt.geometrySelection.passed,
    featurePassed: attempt.featureCorroboration.passed,
    beautyRestorationPassed: attempt.beautyRestorationControl.byteIdenticalToPublishedRender,
    renderCount,
    semanticRenderCount: 16 as const,
    restorationControlRenderCount: 1 as const,
    totalCaptureCount: attempt.totalCaptureCount,
  });
}

interface CameraOnlyReceiptProofBinding {
  readonly branchMeasurements: readonly unknown[];
  readonly branchMeasurementsCommitment: string;
  readonly geometrySelection: object;
  readonly geometrySelectionCommitment: string;
  readonly featureCorroboration: object;
  readonly featureCorroborationCommitment: string;
  readonly selectedBranchKey: string;
  readonly metricCalibrationCommitment: string;
}

interface CameraOnlyVerifiedAttemptBinding {
  readonly branchMeasurements: readonly unknown[];
  readonly branchMeasurementsCommitment: string;
  readonly geometrySelection: object & { readonly selectedBranchKey?: unknown };
  readonly geometrySelectionCommitment: string;
  readonly featureCorroboration: object;
  readonly featureCorroborationCommitment: string;
  readonly status: unknown;
  readonly renderCount: unknown;
  readonly semanticRenderCount: unknown;
  readonly restorationControlRenderCount: unknown;
  readonly totalCaptureCount: unknown;
  readonly metricCalibrationCommitment: unknown;
}

export function assertRealBuildPrefix50Step44CameraOnlyVerifiedAttemptBinding(input: {
  readonly receipt: CameraOnlyReceiptProofBinding;
  readonly attempt: CameraOnlyVerifiedAttemptBinding;
  readonly expectedRenderCount: number;
  readonly expectedTotalCaptureCount: number;
}): void {
  const { receipt, attempt } = input;
  requireCondition(
    receipt.branchMeasurementsCommitment === canonicalDigest(receipt.branchMeasurements) &&
      attempt.branchMeasurementsCommitment === receipt.branchMeasurementsCommitment &&
      sameValue(attempt.branchMeasurements, receipt.branchMeasurements),
    "Camera-only Step-44 verified attempt branches do not exactly equal the live receipt branches.",
  );
  requireCondition(
    attempt.geometrySelectionCommitment === receipt.geometrySelectionCommitment &&
      sameValue(attempt.geometrySelection, receipt.geometrySelection),
    "Camera-only Step-44 verified attempt geometry selection does not exactly equal the live receipt.",
  );
  requireCondition(
    attempt.featureCorroborationCommitment === receipt.featureCorroborationCommitment &&
      sameValue(attempt.featureCorroboration, receipt.featureCorroboration),
    "Camera-only Step-44 verified attempt feature corroboration does not exactly equal the live receipt.",
  );
  requireCondition(
    attempt.geometrySelection.selectedBranchKey === receipt.selectedBranchKey &&
      attempt.status === "resolved" &&
      attempt.renderCount === input.expectedRenderCount &&
      attempt.semanticRenderCount === 16 &&
      attempt.restorationControlRenderCount === 1 &&
      attempt.totalCaptureCount === input.expectedTotalCaptureCount,
    "Camera-only Step-44 verified attempt selected branch, status, or capture accounting drifted from the live receipt.",
  );
  requireCondition(
    attempt.metricCalibrationCommitment === receipt.metricCalibrationCommitment &&
      attempt.metricCalibrationCommitment ===
        REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
    "Camera-only Step-44 verified attempt drifted from the preregistered metric-v2 calibration.",
  );
}

export interface RealBuildPrefix50Step44CameraOnlyDecisionSummary {
  readonly selectedBranchKey: RealBuildPrefix50Step44CameraBranchKey;
  readonly selectedIntersectionOverUnion: number;
  readonly strongestOtherExpectedFaceIntersectionOverUnion: number;
  readonly expectedFaceGeometryMargin: number;
  readonly selectedBlueCyanF1: number;
  readonly expectedFaceBlueCyanF1Margin: number;
  readonly selectedHogSimilarity: number;
  readonly branchCount: 16;
  readonly expectedFaceBranchCount: 8;
  readonly renderCount: number;
  readonly semanticRenderCount: 16;
  readonly restorationControlRenderCount: 1;
  readonly totalCaptureCount: number;
}

export function assertRealBuildPrefix50Step44CameraOnlyDecision(
  receipt: RealBuildPrefix50Step44Page45CameraReceipt,
): RealBuildPrefix50Step44CameraOnlyDecisionSummary {
  requireCondition(receipt.authority === "none", "Camera-only Step-44 receipt gained authority.");
  requireCondition(
    receipt.schemaVersion === "lego.real-build-prefix50-step44-page45-camera/3" &&
      receipt.semanticColorPolicyCommitment === receipt.semanticColorPolicy.commitment,
    "Camera-only Step-44 receipt did not bind semantic camera schema v3 and its exact policy.",
  );
  requireRealBuildPrefix50Step44SemanticColorPolicy(receipt.semanticColorPolicy);
  const calibration = deriveRealBuildPrefix50Step44InteriorFeatureCalibration();
  requireCondition(
    sameValue(receipt.metricCalibration, calibration) &&
      receipt.metricCalibrationCommitment === calibration.commitment &&
      receipt.metricCalibrationCommitment ===
        REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT &&
      receipt.featureCorroboration.metricCalibrationCommitment === calibration.commitment &&
      receipt.searchThresholds.minimumBlueCyanF1 ===
        calibration.derivedThresholds.minimumBlueCyanF1 &&
      receipt.searchThresholds.minimumExpectedFaceBlueCyanF1Margin ===
        calibration.derivedThresholds.minimumExpectedFaceBlueCyanF1Margin,
    "Camera-only Step-44 gate did not independently reproduce and bind its preregistered metric-v2 calibration.",
  );
  requireCondition(
    receipt.sourceKind === "repository-runtime" &&
      receipt.sourcePdfArtifactPath === "recipes/6651557.pdf",
    "Camera-only Step-44 gate requires the exact repository PDF runtime source.",
  );
  requireCondition(
    receipt.dataExclusionPolicy === CAMERA_ONLY_POLICY,
    "Camera-only Step-44 receipt crossed its page/parent/candidate exclusion boundary.",
  );
  const face = receipt.panelFacePrefixEvidence;
  requireCondition(
    face.authority === "repository-pdf-vector" &&
      face.firstPrintedStep === 1 &&
      face.lastPrintedStep === 44 &&
      face.coveredPageCeiling === 45 &&
      face.rows.length === 44 &&
      face.rows.every(
        (row, index) => row.stepNumber === index + 1 && row.pageNumber >= 1 && row.pageNumber <= 45,
      ) &&
      face.rows.at(-1)?.pageNumber === 45 &&
      receipt.expectedPanelFace === "studs-up",
    "Camera-only Step-44 gate requires the exact steps-1..44/page-45-bounded studs-up face fold.",
  );
  requireCondition(
    sameValue(receipt.searchThresholds, REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS),
    "Camera-only Step-44 receipt did not use the fixed preregistered thresholds.",
  );
  requireCondition(
    receipt.commitment === canonicalDigest(withoutCommitment(receipt)),
    "Camera-only Step-44 receipt commitment did not reproduce.",
  );

  const rows = receipt.branchMeasurements;
  const keys = stableBranchKeys();
  requireCondition(rows.length === 16, "Camera-only Step-44 gate requires exactly 16 branches.");
  let renderCount = 0;
  for (const [index, row] of rows.entries()) {
    requireCondition(
      row.branchIndex === index && row.branchKey === keys[index],
      `Camera-only Step-44 branch ${index} drifted from stable ordering.`,
    );
    requireCondition(
      row.expectedPanelFace === receipt.expectedPanelFace &&
        row.geometryEligible === (row.branchFace === receipt.expectedPanelFace),
      `Camera-only Step-44 branch ${index} has inconsistent face eligibility.`,
    );
    requireCondition(
      row.alignmentPasses.length >= 1 && row.alignmentPasses.length <= 3,
      `Camera-only Step-44 branch ${index} must contain one to three renders.`,
    );
    const kinds = row.alignmentPasses.map(({ passKind }) => passKind);
    requireCondition(
      sameValue(kinds, ["seed", "confirmation", "rebase"].slice(0, kinds.length)),
      `Camera-only Step-44 branch ${index} has a noncanonical pass sequence.`,
    );
    requireCondition(
      kinds.filter((kind) => kind === "rebase").length <= 1,
      `Camera-only Step-44 branch ${index} exceeded one rebase.`,
    );
    if (row.converged) {
      requireCondition(
        row.alignmentPasses[0]?.registrationProposal?.status === "locally-contained",
        `Camera-only Step-44 branch ${index} converged without a locally-contained seed proposal.`,
      );
      if (row.alignmentPasses.length === 3)
        requireCondition(
          row.alignmentPasses[1]?.registrationProposal?.status === "locally-contained",
          `Camera-only Step-44 branch ${index} rebased without a locally-contained proposal.`,
        );
    }
    requireCondition(
      row.interiorFeatureMeasurement.selectionAuthority === false &&
        row.interiorFeatureMeasurement.tieBreakAuthority === false &&
        row.interiorFeatureMeasurement.intendedUse === "diagnostic-and-refusal-evidence-only" &&
        row.interiorFeatureMeasurement.schemaVersion ===
          "lego.real-build-prefix50-step44-interior-feature-measurement/2" &&
        row.interiorFeatureMeasurement.semanticPolicyCommitment ===
          receipt.semanticColorPolicyCommitment &&
        row.interiorFeatureMeasurement.semanticMaskPixelDigest ===
          row.semanticColorArtifact.semanticBlueCyanMaskDigest &&
        row.semanticColorArtifact.policyCommitment === receipt.semanticColorPolicyCommitment &&
        row.semanticColorArtifact.classificationCommitment ===
          receipt.semanticColorPolicy.classificationCommitment &&
        row.semanticColorArtifact.artifactFile ===
          `real-build-prefix50-step44-page45-camera-branch-${index
            .toString()
            .padStart(2, "0")}-semantic-blue-cyan.png`,
      `Camera-only Step-44 branch ${index} granted interior features selection authority.`,
    );
    renderCount += row.alignmentPasses.length;
  }
  requireCondition(
    renderCount >= 16 && renderCount <= 48,
    `Camera-only Step-44 gate rendered ${renderCount} frames, outside 16..48.`,
  );

  const eligible = rows.filter(({ geometryEligible }) => geometryEligible);
  requireCondition(
    eligible.length === 8,
    "Camera-only Step-44 gate requires eight expected-face rows.",
  );
  const rankedConverged = eligible
    .filter(({ converged }) => converged)
    .sort(
      (left, right) =>
        right.selectedIntersectionOverUnion - left.selectedIntersectionOverUnion ||
        left.branchIndex - right.branchIndex,
    );
  const selected = rankedConverged[0]!;
  const other = eligible
    .filter(({ branchKey }) => branchKey !== selected.branchKey)
    .sort(
      (left, right) =>
        right.selectedIntersectionOverUnion - left.selectedIntersectionOverUnion ||
        left.branchIndex - right.branchIndex,
    )[0]!;
  const geometryMargin =
    selected.selectedIntersectionOverUnion - other.selectedIntersectionOverUnion;
  requireCondition(
    receipt.selectedBranchKey === selected.branchKey &&
      receipt.geometrySelection.selectedBranchKey === selected.branchKey &&
      receipt.geometrySelection.authority === "eligible-silhouette-iou-only" &&
      receipt.geometrySelection.passed &&
      receipt.selectedIntersectionOverUnion === selected.selectedIntersectionOverUnion &&
      receipt.geometrySelection.strongestOtherExpectedFaceIntersectionOverUnion ===
        other.selectedIntersectionOverUnion &&
      receipt.geometrySelection.strongestOtherExpectedFaceBranchKey === other.branchKey &&
      receipt.branchWinnerMargin === geometryMargin &&
      geometryMargin >= receipt.searchThresholds.minimumBranchWinnerMargin,
    "Camera-only Step-44 selected branch is not the actual expected-face geometry winner.",
  );
  const feature = receipt.featureCorroboration;
  requireCondition(
    feature.authority === "refusal-only" &&
      feature.selectionAuthority === false &&
      feature.tieBreakAuthority === false &&
      feature.retryAuthority === false &&
      feature.hogAuthority === "diagnostic-only" &&
      feature.selectedBranchKey === selected.branchKey &&
      feature.selectedBlueCyanF1 === selected.interiorFeatureMeasurement.f1 &&
      feature.geometryRunnerUpBranchKey === other.branchKey &&
      feature.geometryRunnerUpFeatureComparable === true &&
      feature.geometryRunnerUpBlueCyanF1 === other.interiorFeatureMeasurement.f1 &&
      feature.passed &&
      feature.selectedBlueCyanF1 !== null &&
      feature.expectedFaceBlueCyanF1Margin !== null &&
      feature.selectedBlueCyanF1 >= receipt.searchThresholds.minimumBlueCyanF1 &&
      feature.expectedFaceBlueCyanF1Margin >=
        receipt.searchThresholds.minimumExpectedFaceBlueCyanF1Margin,
    "Camera-only Step-44 blue/cyan refusal control or HOG diagnostic authority failed.",
  );
  requireCondition(
    receipt.selectedAlignmentPassCount === selected.alignmentPasses.length,
    "Camera-only Step-44 selected alignment pass count drifted.",
  );
  return Object.freeze({
    selectedBranchKey: selected.branchKey,
    selectedIntersectionOverUnion: selected.selectedIntersectionOverUnion,
    strongestOtherExpectedFaceIntersectionOverUnion: other.selectedIntersectionOverUnion,
    expectedFaceGeometryMargin: geometryMargin,
    selectedBlueCyanF1: feature.selectedBlueCyanF1,
    expectedFaceBlueCyanF1Margin: feature.expectedFaceBlueCyanF1Margin,
    selectedHogSimilarity: selected.interiorFeatureMeasurement.hogSimilarity,
    branchCount: 16,
    expectedFaceBranchCount: 8,
    renderCount,
    semanticRenderCount: 16,
    restorationControlRenderCount: 1,
    totalCaptureCount: renderCount + 17,
  });
}
