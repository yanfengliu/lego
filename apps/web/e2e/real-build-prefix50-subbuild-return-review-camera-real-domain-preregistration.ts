import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION,
  REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
} from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_NEGATIVE_COLOR_IDS,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_TARGET_COLOR_IDS,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_BOUNDED_CALIBRATION_SOURCE_SPEC_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC,
  type RealBuildPrefix50Step44RealDomainBranchKey,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";

export interface RealBuildPrefix50Step44RealDomainThresholds {
  readonly minimumParentOnlyIntersectionOverUnion: 0.9;
  readonly minimumExpectedBranchGeometryMargin: 0.015;
  readonly maximumPredictionActualIntersectionOverUnionDrift: 0.02;
  readonly minimumBlueCyanF1: number;
  readonly minimumExpectedBranchBlueCyanF1Margin: number;
}

export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_THRESHOLDS = deepFreeze({
  minimumParentOnlyIntersectionOverUnion: 0.9 as const,
  minimumExpectedBranchGeometryMargin: 0.015 as const,
  maximumPredictionActualIntersectionOverUnionDrift: 0.02 as const,
  minimumBlueCyanF1:
    REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION.derivedThresholds.minimumBlueCyanF1,
  minimumExpectedBranchBlueCyanF1Margin:
    REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION.derivedThresholds
      .minimumExpectedFaceBlueCyanF1Margin,
}) satisfies RealBuildPrefix50Step44RealDomainThresholds;

export interface RealBuildPrefix50Step44RealDomainPreregistration {
  readonly schemaVersion: "lego.real-build-prefix50-step44-real-domain-camera-calibration/1";
  readonly authority: "none";
  readonly intendedUse: "future-camera-instrument-qualification-only";
  readonly selectionAuthority: false;
  readonly dataExclusionPolicy: "page44-source-plus-step40-42-predecessors-no-page45-no-step44-search-no-v3";
  readonly split: {
    readonly calibrationPanelSteps: readonly [41, 42];
    readonly heldOutValidationPanelStep: 43;
    readonly heldOutMayOpenOnlyAfterBothCalibrationCasesPass: true;
    readonly postObservationRetuningAllowed: false;
  };
  readonly sourceSetId: "6651557";
  readonly sourcePdfDigest: typeof REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourcePdfDigest;
  readonly physicalPageNumber: 44;
  readonly panelFace: "studs-up";
  readonly expectedBranchKey: RealBuildPrefix50Step44RealDomainBranchKey;
  readonly sourceToPanelFaceQuarterTurn: typeof REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourceToPanelFaceQuarterTurn;
  /** Legacy field name: binds only the bounded Step-41/42 source spec. */
  readonly sourceSpecCommitment: Sha256Digest;
  readonly sourceTransformFixtureCommitment: Sha256Digest;
  readonly targetColorIds: typeof REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_TARGET_COLOR_IDS;
  readonly negativeColorIds: typeof REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_NEGATIVE_COLOR_IDS;
  readonly syntheticMetricCalibrationCommitment: typeof REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT;
  readonly thresholds: RealBuildPrefix50Step44RealDomainThresholds;
  readonly decisionRule: "both-calibration-cases-pass-frozen-thresholds-then-one-shot-heldout-same-thresholds";
  readonly commitment: Sha256Digest;
}

export function deriveRealBuildPrefix50Step44RealDomainPreregistration(): RealBuildPrefix50Step44RealDomainPreregistration {
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-real-domain-camera-calibration/1" as const,
    authority: "none" as const,
    intendedUse: "future-camera-instrument-qualification-only" as const,
    selectionAuthority: false as const,
    dataExclusionPolicy:
      "page44-source-plus-step40-42-predecessors-no-page45-no-step44-search-no-v3" as const,
    split: {
      calibrationPanelSteps: [41, 42] as const,
      heldOutValidationPanelStep: 43 as const,
      heldOutMayOpenOnlyAfterBothCalibrationCasesPass: true as const,
      postObservationRetuningAllowed: false as const,
    },
    sourceSetId: "6651557" as const,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourcePdfDigest,
    physicalPageNumber: 44 as const,
    panelFace: "studs-up" as const,
    expectedBranchKey: "face:studs-up/hand:as-fitted/turn:0" as const,
    sourceToPanelFaceQuarterTurn:
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourceToPanelFaceQuarterTurn,
    sourceSpecCommitment: REAL_BUILD_PREFIX50_STEP44_BOUNDED_CALIBRATION_SOURCE_SPEC_COMMITMENT,
    sourceTransformFixtureCommitment:
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourceTransformFixtureCommitment,
    targetColorIds: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_TARGET_COLOR_IDS,
    negativeColorIds: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_NEGATIVE_COLOR_IDS,
    syntheticMetricCalibrationCommitment:
      REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
    thresholds: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_THRESHOLDS,
    decisionRule:
      "both-calibration-cases-pass-frozen-thresholds-then-one-shot-heldout-same-thresholds" as const,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION =
  deriveRealBuildPrefix50Step44RealDomainPreregistration();
