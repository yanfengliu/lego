import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import type { RealBuildPrefix50Step44RealDomainBranchKey } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";
import {
  assertRealBuildPrefix50Step44RealDomainBatch,
  deriveRealBuildPrefix50Step44RealDomainPredecessorCase,
  requireRealBuildPrefix50Step44RealDomainPredecessorCase,
  type RealBuildPrefix50Step44RealDomainPanelStep,
  type RealBuildPrefix50Step44RealDomainPredecessorCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts";
import {
  requireRealBuildPrefix50LiveCameraSearchAttemptEvidence,
  type RealBuildPrefix50Step44CameraSearchAttemptEvidence,
} from "./real-build-prefix50-subbuild-return-review-camera-search.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  requireRealBuildPrefix50Step44BrowserCaptureCapability,
  type RealBuildPrefix50Step44BrowserCaptureCapability,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-capture.ts";
import {
  requireRealBuildPrefix50Step44RealDomainCalibrationSession,
  requireRealBuildPrefix50Step44RealDomainHeldOutPair,
  type RealBuildPrefix50Step44RealDomainCalibrationSession,
  type RealBuildPrefix50Step44RealDomainHeldOutPair,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_THRESHOLDS,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-preregistration.ts";

export {
  deriveRealBuildPrefix50Step44RealDomainPreregistration,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_THRESHOLDS,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-preregistration.ts";
export type {
  RealBuildPrefix50Step44RealDomainPreregistration,
  RealBuildPrefix50Step44RealDomainThresholds,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-preregistration.ts";

export type { RealBuildPrefix50Step44RealDomainBranchKey } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";
export {
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_BATCH_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CHILD_ROSTER_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_ENUMERATION_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_NEGATIVE_COLOR_IDS,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_REPLAY_BASE_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_DOCUMENT_HASH,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_TARGET_COLOR_IDS,
  requireRealBuildPrefix50Step44RealDomainPredecessorCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts";
export type {
  RealBuildPrefix50Step44RealDomainCalibrationStep,
  RealBuildPrefix50Step44RealDomainDocumentSummary,
  RealBuildPrefix50Step44RealDomainPanelStep,
  RealBuildPrefix50Step44RealDomainPredecessorCase,
  RealBuildPrefix50Step44RealDomainSemanticClassification,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts";

const predecessorSequenceBrands = new WeakSet<object>();
const observationBrands = new WeakSet<object>();
const calibrationReceiptBrands = new WeakSet<object>();
const heldOutReceiptBrands = new WeakSet<object>();

export interface RealBuildPrefix50Step44RealDomainPredecessorSequence {
  readonly calibrationCases: readonly [
    RealBuildPrefix50Step44RealDomainPredecessorCase,
    RealBuildPrefix50Step44RealDomainPredecessorCase,
  ];
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

export function prepareRealBuildPrefix50Step44RealDomainPredecessorSequence(
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
): RealBuildPrefix50Step44RealDomainPredecessorSequence {
  assertRealBuildPrefix50Step44RealDomainBatch(batch);
  const calibrationCases = Object.freeze([
    deriveRealBuildPrefix50Step44RealDomainPredecessorCase(batch, 41),
    deriveRealBuildPrefix50Step44RealDomainPredecessorCase(batch, 42),
  ]) as RealBuildPrefix50Step44RealDomainPredecessorSequence["calibrationCases"];
  const body = {
    calibrationCases,
    reviewBatchEnvelopeCommitment: batch.commitment,
  };
  const sequence: RealBuildPrefix50Step44RealDomainPredecessorSequence = Object.freeze({
    ...body,
    commitment: canonicalDigest(body),
  });
  predecessorSequenceBrands.add(sequence);
  return sequence;
}

export function requireRealBuildPrefix50Step44RealDomainPredecessorSequence(
  value: RealBuildPrefix50Step44RealDomainPredecessorSequence,
): RealBuildPrefix50Step44RealDomainPredecessorSequence {
  if (!predecessorSequenceBrands.has(value))
    throw new TypeError("Real-domain camera predecessor sequence lacks its holdout lock brand.");
  return value;
}

export interface RealBuildPrefix50Step44RealDomainObservation {
  readonly panelStep: RealBuildPrefix50Step44RealDomainPanelStep;
  readonly predecessorCaseCommitment: Sha256Digest;
  readonly sourceCaseCommitment: Sha256Digest;
  readonly sourceLockCommitment: Sha256Digest;
  /** Legacy name: schema `bounded-calibration-crop-set/1`, not a full-page raster. */
  readonly pageRasterCommitment: Sha256Digest;
  readonly semanticPolicyCommitment: Sha256Digest;
  readonly liveSearchAttemptCommitment: Sha256Digest;
  readonly renderArtifactRosterCommitment: Sha256Digest;
  readonly registrationReceiptsCommitment: Sha256Digest;
  readonly sourceSharedOrientationAnchorCommitment: Sha256Digest;
  readonly sourcePerPanelLatticeCounterevidenceCommitment: Sha256Digest;
  readonly sourcePooledLatticeCounterevidenceFailure: string | null;
  readonly sourceLatticeFitCommitment: Sha256Digest;
  readonly sourceLatticeFitQualified: boolean;
  readonly sourceLatticeFitFailure: string | null;
  readonly expectedBranchKey: RealBuildPrefix50Step44RealDomainBranchKey;
  readonly selectedBranchKey: string | null;
  readonly parentOnlyIntersectionOverUnion: number;
  readonly expectedBranchGeometryMargin: number;
  readonly maximumObservedPredictionActualIntersectionOverUnionDrift: number;
  readonly blueCyanF1: number;
  readonly expectedBranchBlueCyanF1Margin: number;
  readonly observationCommitment: Sha256Digest;
}

export function replayRealBuildPrefix50Step44RealDomainObservationCommitment(
  observation: RealBuildPrefix50Step44RealDomainObservation,
): Sha256Digest {
  const { observationCommitment, ...body } = observation;
  void observationCommitment;
  return canonicalDigest(body);
}

export function recordRealBuildPrefix50Step44RealDomainObservation(input: {
  readonly browserCaptureCapability: RealBuildPrefix50Step44BrowserCaptureCapability;
  readonly predecessorCase: RealBuildPrefix50Step44RealDomainPredecessorCase;
  readonly sourceCase: {
    readonly panelStep: RealBuildPrefix50Step44RealDomainPanelStep;
    readonly sourceCaseCommitment: Sha256Digest;
    readonly commitment: Sha256Digest;
    readonly sourceLockCommitment: Sha256Digest;
    /** Legacy name: schema `bounded-calibration-crop-set/1`, not a full-page raster. */
    readonly pageRasterCommitment: Sha256Digest;
    readonly expectedBranchKey: RealBuildPrefix50Step44RealDomainBranchKey;
    readonly interiorFeatureSourceCommitment: Sha256Digest;
    readonly sharedOrientationAnchorCommitment: Sha256Digest;
    readonly sharedOrientationAnchor: {
      readonly pooledCounterevidenceFailure: string | null;
    } | null;
    readonly perPanelLatticeCounterevidence: {
      readonly commitment: Sha256Digest;
    };
    readonly latticeFitCommitment: Sha256Digest;
    readonly latticeFitQualified: boolean;
    readonly latticeFitFailure: string | null;
  };
  readonly semanticPolicyCommitment: Sha256Digest;
  readonly evidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence;
}): RealBuildPrefix50Step44RealDomainObservation {
  const browserCapture = requireRealBuildPrefix50Step44BrowserCaptureCapability(
    input.browserCaptureCapability,
  );
  const predecessor = requireRealBuildPrefix50Step44RealDomainPredecessorCase(
    input.predecessorCase,
  );
  const evidence = requireRealBuildPrefix50LiveCameraSearchAttemptEvidence(input.evidence);
  const { attempt, renderArtifacts } = evidence;
  const selected = attempt.branchMeasurements.find(
    ({ branchKey }) => branchKey === attempt.geometrySelection.selectedBranchKey,
  );
  const maximumDrift = Math.max(
    0,
    ...attempt.branchMeasurements.flatMap(({ alignmentPasses }) =>
      alignmentPasses.map(
        ({ incomingPredictionActualIntersectionOverUnionDrift }) =>
          incomingPredictionActualIntersectionOverUnionDrift ?? 0,
      ),
    ),
  );
  const renderArtifactRosterCommitment = canonicalDigest(
    Object.keys(renderArtifacts)
      .sort()
      .map((artifactFile) => ({
        artifactFile,
        byteLength: renderArtifacts[artifactFile]!.byteLength,
        pngDigest: sha256RealBuildPrefix50Step44ReviewBytes(renderArtifacts[artifactFile]!),
      })),
  );
  const registrationReceiptsCommitment = canonicalDigest(
    attempt.branchMeasurements.map(({ branchKey, alignmentPasses }) => ({
      branchKey,
      passes: alignmentPasses.map(({ commitment, registrationProposal }) => ({
        passCommitment: commitment,
        registrationProposalCommitment: registrationProposal?.commitment ?? null,
      })),
    })),
  );
  if (
    browserCapture.panelStep !== predecessor.panelStep ||
    browserCapture.predecessorCaseCommitment !== predecessor.commitment ||
    browserCapture.sourceCaseCommitment !== input.sourceCase.commitment ||
    browserCapture.attemptCommitment !== attempt.commitment ||
    browserCapture.runtimeCaptureCount !== attempt.totalCaptureCount ||
    input.sourceCase.panelStep !== predecessor.panelStep ||
    attempt.expectedPanelFace !== "studs-up" ||
    attempt.featureCorroboration.sourceCommitment !==
      input.sourceCase.interiorFeatureSourceCommitment ||
    attempt.branchMeasurements.some(
      ({ semanticColorArtifact, interiorFeatureMeasurement }) =>
        semanticColorArtifact.policyCommitment !== input.semanticPolicyCommitment ||
        interiorFeatureMeasurement.semanticPolicyCommitment !== input.semanticPolicyCommitment,
    ) ||
    input.sourceCase.commitment !== browserCapture.sourceCaseCommitment
  )
    throw new TypeError(
      `Real-domain panel ${predecessor.panelStep} observation must bind its live source, semantic render policy, and registration receipts.`,
    );
  const body = {
    panelStep: predecessor.panelStep,
    predecessorCaseCommitment: predecessor.commitment,
    sourceCaseCommitment: input.sourceCase.sourceCaseCommitment,
    sourceLockCommitment: input.sourceCase.sourceLockCommitment,
    pageRasterCommitment: input.sourceCase.pageRasterCommitment,
    semanticPolicyCommitment: input.semanticPolicyCommitment,
    liveSearchAttemptCommitment: attempt.commitment,
    renderArtifactRosterCommitment,
    registrationReceiptsCommitment,
    sourceSharedOrientationAnchorCommitment: input.sourceCase.sharedOrientationAnchorCommitment,
    sourcePerPanelLatticeCounterevidenceCommitment:
      input.sourceCase.perPanelLatticeCounterevidence.commitment,
    sourcePooledLatticeCounterevidenceFailure:
      input.sourceCase.sharedOrientationAnchor?.pooledCounterevidenceFailure ?? null,
    sourceLatticeFitCommitment: input.sourceCase.latticeFitCommitment,
    sourceLatticeFitQualified: input.sourceCase.latticeFitQualified,
    sourceLatticeFitFailure: input.sourceCase.latticeFitFailure,
    expectedBranchKey: input.sourceCase.expectedBranchKey,
    selectedBranchKey: attempt.geometrySelection.selectedBranchKey,
    parentOnlyIntersectionOverUnion: attempt.geometrySelection.selectedIntersectionOverUnion ?? 0,
    expectedBranchGeometryMargin: attempt.geometrySelection.expectedFaceGeometryMargin ?? 0,
    maximumObservedPredictionActualIntersectionOverUnionDrift: maximumDrift,
    blueCyanF1: selected?.interiorFeatureMeasurement.f1 ?? 0,
    expectedBranchBlueCyanF1Margin: attempt.featureCorroboration.expectedFaceBlueCyanF1Margin ?? 0,
  };
  const observation = deepFreeze({ ...body, observationCommitment: canonicalDigest(body) });
  observationBrands.add(observation);
  return observation;
}

function requireObservation(
  observation: RealBuildPrefix50Step44RealDomainObservation,
  predecessor: RealBuildPrefix50Step44RealDomainPredecessorCase,
): readonly string[] {
  const thresholds = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_THRESHOLDS;
  const failures: string[] = [];
  requireRealBuildPrefix50Step44RealDomainPredecessorCase(predecessor);
  if (!observationBrands.has(observation))
    throw new TypeError(
      `Real-domain panel ${predecessor.panelStep} observation lacks the opaque brand minted from its live browser capture.`,
    );
  if (observation.predecessorCaseCommitment !== predecessor.commitment)
    throw new TypeError(
      `Real-domain panel ${predecessor.panelStep} observation predecessor commitment ${observation.predecessorCaseCommitment} does not match expected ${predecessor.commitment}.`,
    );
  const replayedObservationCommitment =
    replayRealBuildPrefix50Step44RealDomainObservationCommitment(observation);
  if (observation.observationCommitment !== replayedObservationCommitment)
    throw new TypeError(
      `Real-domain panel ${predecessor.panelStep} observation self commitment ${observation.observationCommitment} does not match replayed ${replayedObservationCommitment}.`,
    );
  if (observation.selectedBranchKey !== observation.expectedBranchKey)
    failures.push("expected-branch-not-selected");
  if (!observation.sourceLatticeFitQualified) failures.push("source-lattice-control-failed");
  if (
    observation.parentOnlyIntersectionOverUnion < thresholds.minimumParentOnlyIntersectionOverUnion
  )
    failures.push("parent-only-iou-floor-not-met");
  if (observation.expectedBranchGeometryMargin < thresholds.minimumExpectedBranchGeometryMargin)
    failures.push("expected-branch-geometry-margin-not-met");
  if (
    observation.maximumObservedPredictionActualIntersectionOverUnionDrift >
    thresholds.maximumPredictionActualIntersectionOverUnionDrift
  )
    failures.push("prediction-actual-iou-drift-exceeded");
  if (observation.blueCyanF1 < thresholds.minimumBlueCyanF1)
    failures.push("blue-cyan-f1-floor-not-met");
  if (observation.expectedBranchBlueCyanF1Margin < thresholds.minimumExpectedBranchBlueCyanF1Margin)
    failures.push("expected-branch-blue-cyan-margin-not-met");
  return Object.freeze(failures);
}

export interface RealBuildPrefix50Step44RealDomainCalibrationReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-real-domain-calibration-receipt/1";
  readonly preregistrationCommitment: Sha256Digest;
  readonly calibrationPanelSteps: readonly [41, 42];
  readonly observations: readonly RealBuildPrefix50Step44RealDomainObservation[];
  readonly failuresByPanelStep: readonly {
    readonly panelStep: 41 | 42;
    readonly failures: readonly string[];
  }[];
  readonly status: "qualified-for-heldout" | "refused";
  readonly thresholdsChanged: false;
  readonly commitment: Sha256Digest;
}

export function evaluateRealBuildPrefix50Step44RealDomainCalibration(input: {
  readonly predecessorCases: readonly [
    RealBuildPrefix50Step44RealDomainPredecessorCase,
    RealBuildPrefix50Step44RealDomainPredecessorCase,
  ];
  readonly observations: readonly [
    RealBuildPrefix50Step44RealDomainObservation,
    RealBuildPrefix50Step44RealDomainObservation,
  ];
}): RealBuildPrefix50Step44RealDomainCalibrationReceipt {
  const calibrationCases = input.predecessorCases.map(
    requireRealBuildPrefix50Step44RealDomainPredecessorCase,
  );
  if (
    calibrationCases.length !== 2 ||
    calibrationCases.some(({ splitRole }) => splitRole !== "calibration") ||
    canonicalDigest(calibrationCases.map(({ panelStep }) => panelStep)) !==
      canonicalDigest([41, 42]) ||
    input.observations.length !== 2 ||
    canonicalDigest(input.observations.map(({ panelStep }) => panelStep)) !==
      canonicalDigest([41, 42])
  )
    throw new TypeError(
      "Real-domain calibration must consume exactly Steps 41 and 42 while Step 43 remains unopened.",
    );
  const failuresByPanelStep = calibrationCases.map((predecessor, index) => ({
    panelStep: predecessor.panelStep as 41 | 42,
    failures: requireObservation(input.observations[index]!, predecessor),
  }));
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-real-domain-calibration-receipt/1" as const,
    preregistrationCommitment: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION.commitment,
    calibrationPanelSteps: [41, 42] as const,
    observations: input.observations,
    failuresByPanelStep,
    status: failuresByPanelStep.every(({ failures }) => failures.length === 0)
      ? ("qualified-for-heldout" as const)
      : ("refused" as const),
    thresholdsChanged: false as const,
  };
  const receipt = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  calibrationReceiptBrands.add(receipt);
  return receipt;
}

export function requireRealBuildPrefix50Step44QualifiedRealDomainCalibration(
  receipt: RealBuildPrefix50Step44RealDomainCalibrationReceipt,
): RealBuildPrefix50Step44RealDomainCalibrationReceipt {
  const { commitment, ...body } = receipt;
  if (
    !calibrationReceiptBrands.has(receipt) ||
    receipt.status !== "qualified-for-heldout" ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError(
      "Real-domain Step-43 holdout requires the runtime-branded qualified Steps-41/42 receipt.",
    );
  return receipt;
}

export function requireRealBuildPrefix50Step44RealDomainCalibrationReceipt(
  receipt: RealBuildPrefix50Step44RealDomainCalibrationReceipt,
): RealBuildPrefix50Step44RealDomainCalibrationReceipt {
  const { commitment, ...body } = receipt;
  if (!calibrationReceiptBrands.has(receipt) || commitment !== canonicalDigest(body))
    throw new TypeError(
      "Real-domain calibration result must be the runtime-branded exact ordered Steps-41/42 receipt, including refusals.",
    );
  return receipt;
}

export interface RealBuildPrefix50Step44RealDomainHeldOutReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-real-domain-heldout-receipt/1";
  readonly preregistrationCommitment: Sha256Digest;
  readonly calibrationReceiptCommitment: Sha256Digest;
  readonly calibrationSessionCommitment: Sha256Digest;
  readonly heldOutPanelStep: 43;
  readonly observation: RealBuildPrefix50Step44RealDomainObservation;
  readonly failures: readonly string[];
  readonly status: "validated" | "refused";
  readonly thresholdsChanged: false;
  readonly commitment: Sha256Digest;
}

export function evaluateRealBuildPrefix50Step44RealDomainHeldOut(input: {
  readonly calibrationReceipt: RealBuildPrefix50Step44RealDomainCalibrationReceipt;
  readonly calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
  readonly heldOutPair: RealBuildPrefix50Step44RealDomainHeldOutPair;
  readonly predecessorCase: RealBuildPrefix50Step44RealDomainPredecessorCase;
  readonly observation: RealBuildPrefix50Step44RealDomainObservation;
}): RealBuildPrefix50Step44RealDomainHeldOutReceipt {
  const calibration = requireRealBuildPrefix50Step44QualifiedRealDomainCalibration(
    input.calibrationReceipt,
  );
  const sessionState = requireRealBuildPrefix50Step44RealDomainCalibrationSession(
    input.calibrationSession,
  );
  requireRealBuildPrefix50Step44RealDomainHeldOutPair(input.heldOutPair, input.calibrationSession);
  const commitment = calibration.commitment;
  if (
    requireRealBuildPrefix50Step44RealDomainPredecessorCase(input.predecessorCase).panelStep !==
      43 ||
    sessionState.calibrationReceipt !== calibration ||
    input.heldOutPair.predecessorCase !== input.predecessorCase ||
    input.predecessorCase.splitRole !== "held-out-validation" ||
    input.observation.panelStep !== 43
  )
    throw new TypeError(
      "Real-domain Step-43 holdout may open only after an exact qualified Step-41/42 calibration receipt.",
    );
  const failures = requireObservation(input.observation, input.predecessorCase);
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-real-domain-heldout-receipt/1" as const,
    preregistrationCommitment: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION.commitment,
    calibrationReceiptCommitment: commitment,
    calibrationSessionCommitment: input.calibrationSession.commitment,
    heldOutPanelStep: 43 as const,
    observation: input.observation,
    failures,
    status: failures.length === 0 ? ("validated" as const) : ("refused" as const),
    thresholdsChanged: false as const,
  };
  const receipt = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  heldOutReceiptBrands.add(receipt);
  return receipt;
}

export function requireRealBuildPrefix50Step44ValidatedRealDomainHeldOut(
  receipt: RealBuildPrefix50Step44RealDomainHeldOutReceipt,
): RealBuildPrefix50Step44RealDomainHeldOutReceipt {
  const { commitment, ...body } = receipt;
  if (
    !heldOutReceiptBrands.has(receipt) ||
    receipt.status !== "validated" ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError(
      "Step-44 camera gate requires the runtime-branded validated real-domain Step-43 holdout receipt.",
    );
  return receipt;
}

export function requireRealBuildPrefix50Step44RealDomainHeldOutReceipt(
  receipt: RealBuildPrefix50Step44RealDomainHeldOutReceipt,
): RealBuildPrefix50Step44RealDomainHeldOutReceipt {
  const { commitment, ...body } = receipt;
  if (!heldOutReceiptBrands.has(receipt) || commitment !== canonicalDigest(body))
    throw new TypeError(
      "Real-domain held-out result must be the runtime-branded Step-43 receipt, including refusals.",
    );
  return receipt;
}
