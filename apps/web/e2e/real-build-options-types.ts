import type { PanelFace } from "../src/assembly/panel-face";

import type { CoverageInputBindings, StepCoverageCalloutClaim } from "./real-build-coverage";
import type { RealBuildSourceAttestation } from "./real-build-farther-origin-source-manifest";
import type { TrustedIdentificationConfidence } from "./real-build-identification-trust";
import type { StepFailure } from "./real-build-step-failure";

export interface RealBuildAccounting {
  readonly rawCalloutQuantity: number;
  readonly classifiedPhysicalCalloutPieces: number;
  readonly semanticMultiplierQuantity: number;
  readonly omittedPhysicalPieces: number;
  readonly directCalloutPieces: number;
  readonly multiBuildCopyPieces: number;
  readonly looseInventoryPieces: number;
  readonly assembledTargetPieces: number;
  readonly inventoryPieces: number;
}

export type RealBuildStepAction =
  | {
      readonly kind: "place-callouts";
      readonly assembledPieces: number;
      readonly evidenceDigest: string | null;
    }
  | {
      readonly kind: "multi-build-copy";
      readonly assembledPieces: number;
      readonly sourceStepNumber: number;
      readonly evidenceDigest: string | null;
      readonly copies: readonly {
        readonly identityKey: string;
        readonly sourceIdentityKey: string;
        readonly designId: string;
        readonly materialId: string;
        readonly catalogPartId: string;
        readonly colorId: string;
        readonly evidenceDigest: string;
        readonly transform: {
          readonly positionLdu: readonly [number, number, number];
          readonly orientationId: string;
        };
      }[];
    }
  | {
      readonly kind: "transition";
      readonly assembledPieces: 0;
      readonly transition: "rotation" | "attachment" | "final-view" | "unclassified";
      readonly panelEvidenceDigest: string | null;
      readonly classificationEvidenceDigest: string | null;
      readonly evidenceDigest: string | null;
    };

export interface RealBuildInputDigests {
  readonly pdf: string;
  readonly calloutManifest: string;
  readonly coverage: string;
  readonly officialModel: string;
  readonly actionLedger: string;
  readonly highlightCalibration: string;
  readonly builderCalibration: string;
  readonly builderGeometry: string;
  readonly transitionClassifications: string;
}

export interface RealBuildPanelSpec {
  readonly stepNumber: number;
  readonly pageNumber: number;
  /**
   * Which face of the assembly this panel is drawn from, folded from the
   * booklet's rotate-the-model icon.
   *
   * Nullable, and a null is a refusal rather than a default. The face is a
   * running parity from step 1, so it is only derivable over a contiguous
   * prefix; a step outside the derived prefix has no face, and rendering it as
   * studs-up would silently compare the candidate against the opposite side of
   * the drawing — which is precisely the failure this field exists to stop.
   */
  readonly panelFace: PanelFace | null;
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
  readonly calloutBoxes: readonly {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  }[];
  readonly mappedCalloutKeys: readonly string[];
  readonly action: RealBuildStepAction;
  readonly pieces: readonly {
    readonly identityKey: string;
    readonly designId: string;
    readonly materialId: string;
    readonly catalogPartId: string;
    readonly colorId: string;
    readonly calloutKey: string;
    readonly identificationConfidence: TrustedIdentificationConfidence;
    readonly cropDigest: string | null;
    readonly identificationInputDigest: string | null;
    readonly expectedTransform: {
      readonly positionLdu: readonly [number, number, number];
      readonly orientationId: string;
    };
  }[];
  readonly omittedPieces: readonly {
    readonly identityKey: string;
    readonly designId: string;
    readonly materialId: string;
    readonly catalogPartId: string;
    readonly colorId: string;
    readonly evidenceDigest: string;
    readonly transform: {
      readonly positionLdu: readonly [number, number, number];
      readonly orientationId: string;
    };
  }[];
  readonly calloutPieces: number;
  readonly classifiedPhysicalCalloutPieces: number;
  readonly semanticMultiplierQuantity: number;
  readonly omittedPhysicalPieces: number;
  readonly coverageFailures: readonly StepFailure[];
  readonly missingDesigns: readonly string[];
  readonly unresolvedCallouts: readonly string[];
}

export interface RealBuildOptions {
  readonly pdfjsUrl: string;
  readonly workerUrl: string;
  readonly pdfUrl: string;
  readonly latticeUrl: string;
  readonly renderingUrl: string;
  readonly kernelUrl: string;
  readonly commandsUrl: string;
  readonly assemblyUrl: string;
  readonly measuredFartherOriginSourceAttestation: RealBuildSourceAttestation | null;
  readonly panels: readonly RealBuildPanelSpec[];
  readonly expectedPrintedSteps: 359;
  readonly lastStep: number;
  readonly renderScale: number;
  readonly panelWidth: number;
  readonly workFactor: number;
  readonly maxRendersPerPiece: number;
  readonly blindRenderBudget: number;
  /**
   * Most whole-step candidates a deferred step may carry to the next panel.
   *
   * A step deferred for want of any local signal has no highlight to narrow
   * against, so its candidate set is the full product over the printed step's
   * pieces. Exceeding this is refused rather than truncated: a silently capped
   * product would report a step as settled against a set that never contained
   * the answer.
   */
  readonly deferredCandidateBudget: number;
  /**
   * Most renders a deferral may spend narrowing a step against its own panel.
   *
   * Only a step deferred because its panel could not *separate* its candidates
   * spends any: that panel drew a highlight, so it can still say which
   * placements it cannot tell apart from its best one, and carrying only those
   * forward is what keeps the product finite. Printed step 4's full product is
   * 240 x 334 = 80,160 whole-step candidates, which no lookahead can score.
   *
   * A render is the same 20.8ms one the per-piece search measures (220 renders
   * in 4583ms on printed step 4), so this is about a minute and a half of
   * narrowing. Exceeding it is refused rather than truncated, for the same
   * reason the candidate product is.
   */
  readonly deferredNarrowingRenderBudget: number;
  /**
   * Furthest printed-panel distance a branch-aware deferral may inspect from N.
   *
   * This is an aggregate search limit, not an allowance that may be restarted
   * for each surviving parent. The current measured N/N+1/K policy uses 2.
   */
  readonly fartherPanelMaximumReachSteps: number;
  /**
   * Total candidate renders available to one branch-aware N/N+1/K observation.
   *
   * Source-panel captures do not spend this render budget, while every scored
   * candidate does. The evidence row records the exact aggregate consumption.
   */
  readonly fartherPanelRenderBudget: number;
  /**
   * Most ghost renders an exploded step may perform.
   *
   * A different resource from the candidate budget above, and it used to be
   * counted against it. An exploded step renders its whole-step candidate set
   * once per member of the arrow's travel family, so the render count is a
   * *product* of two independent counts and bounding it by the candidate budget
   * only ever held because the family had four members. Exceeding this is
   * refused rather than truncated, for the same reason the candidate product is.
   */
  readonly explodedGhostRenderBudget: number;
  /**
   * Margin the best deferred candidate must beat the runner-up by on the
   * lookahead panel. Set from `DEFERRED_STEP_MINIMUM_MARGIN`, which is a noise
   * floor rather than a discriminator — see that constant for why.
   */
  readonly minimumDeferredAgreementMargin: number;
  /**
   * Agreement the best deferred candidate must reach against the lookahead
   * panel's already-built art. Set from `DEFERRED_STEP_MINIMUM_AGREEMENT`, and
   * it is the gate that actually decides a deferral.
   */
  readonly minimumDeferredAgreement: number;
  readonly proximityMarginPx: number;
  readonly targetPartCount: number;
  readonly maxParts: number;
  readonly minimumScoreMargin: number;
  readonly minimumWholeStepScore: number;
  readonly minimumExclusiveHighlightPixelsPerPiece: number;
  readonly highlightCalibrationDigest: string | null;
  readonly accounting: RealBuildAccounting;
  readonly inputDigests: RealBuildInputDigests;
  readonly coverageInputBindings: CoverageInputBindings;
  readonly coverageByCallout: Readonly<Record<string, StepCoverageCalloutClaim>>;
}
