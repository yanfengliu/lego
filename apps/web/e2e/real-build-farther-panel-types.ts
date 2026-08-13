import type {
  RealBuildLineageId,
  RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import type { RealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type {
  TrustedLineagedFartherPanelObservation,
  TrustedLineagedFartherPanelScore,
} from "./real-build-farther-lineage-panel-authority";
import type { RealBuildValidatedFartherPlacementTransition } from "./real-build-farther-lineage-transition";

export const MAXIMUM_LINEAGED_FARTHER_LINEAGES = 800_000;
export const MAXIMUM_LINEAGED_FARTHER_SNAPSHOT_BYTES = 64 * 1024 * 1024;

declare const lineagedFartherDocumentType: unique symbol;
declare const lineagedFartherFrontierType: unique symbol;
declare const lineagedFartherOriginAuthorityType: unique symbol;
declare const lineagedFartherCarryAuthorityType: unique symbol;
declare const lineagedFartherPanelAuthorityType: unique symbol;

export interface FartherPlacementWitness {
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: {
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId: string;
  };
}

export type FartherAtomicPieceIdentity = Pick<FartherPlacementWitness, "catalogPartId" | "colorId">;

export interface FartherLineageStep {
  readonly stepNumber: number;
  readonly documentHash: string;
  readonly pieces: readonly FartherPlacementWitness[];
}

export interface FartherCandidate<D> {
  readonly candidateId: string;
  readonly parentCandidateId: string | null;
  readonly originCandidateId: string;
  readonly document: D;
  readonly lineage: readonly FartherLineageStep[];
}

export interface FartherFrontier<D> {
  readonly originStepNumber: number;
  readonly throughStepNumber: number;
  readonly candidates: readonly FartherCandidate<D>[];
}

export interface FartherOriginCandidateInput<D> {
  readonly candidateId: string;
  readonly document: D;
  readonly documentHash: string;
  readonly pieces: readonly FartherPlacementWitness[];
}

export interface FartherOriginInput<D> {
  readonly stepNumber: number;
  readonly candidates: readonly FartherOriginCandidateInput<D>[];
}

export interface FartherOriginResult<D> {
  readonly frontier: FartherFrontier<D> | null;
  readonly refusal: FartherRefusal | null;
}

export interface FartherParentExpansion<D> {
  readonly parentCandidateId: string;
  readonly narrowingRenders: number;
  readonly offeredPerPiece: readonly number[];
  readonly carriedPerPiece: readonly number[];
  readonly children: readonly {
    readonly candidateId: string;
    readonly document: D;
    readonly documentHash: string;
    readonly pieces: readonly FartherPlacementWitness[];
  }[];
}

export interface FartherCarryEvidence {
  readonly parentCandidates: number;
  readonly parentsExpanded: number;
  readonly offeredCandidates: number;
  readonly narrowingRenders: number;
  readonly maximumCandidates: number;
  readonly maximumNarrowingRenders: number;
  readonly expectedAtomicPieces: readonly FartherAtomicPieceIdentity[];
  readonly perParent: readonly {
    readonly parentCandidateId: string;
    readonly offeredCandidates: number;
    readonly narrowingRenders: number;
    readonly offeredPerPiece: readonly number[];
    readonly carriedPerPiece: readonly number[];
  }[];
  readonly measuredLineages: readonly Omit<FartherCandidate<never>, "document">[];
}

export interface FartherCarryResult<D> {
  readonly frontier: FartherFrontier<D> | null;
  readonly refusal: FartherRefusal | null;
  readonly evidence: FartherCarryEvidence;
}

export interface FartherCarryInput<D> {
  readonly frontier: FartherFrontier<D>;
  readonly stepNumber: number;
  readonly expectedAtomicPieces: readonly FartherAtomicPieceIdentity[];
  readonly expansions: readonly FartherParentExpansion<D>[];
  readonly maximumCandidates: number;
  readonly maximumNarrowingRenders: number;
}

export type FartherRefusalCode =
  | "farther-input-invalid"
  | "incomplete-parent-expansion"
  | "incomplete-atomic-step"
  | "empty-parent-expansion"
  | "aggregate-candidate-budget-exhausted"
  | "aggregate-narrowing-budget-exhausted"
  | "panel-render-budget-exhausted"
  | "incomplete-panel-evidence"
  | "farther-panel-limit-reached"
  | "calibration-mismatch"
  | "not-observable";

export interface FartherRefusal {
  readonly code: FartherRefusalCode;
  readonly stage: "input" | "budget" | "evidence";
  readonly stepNumber: number;
  readonly message: string;
}

export type FartherPanelObservationInput =
  | {
      readonly stepNumber: number;
      readonly status: "not-observable";
      readonly reason: "occluded" | "no-built-art" | "camera-unresolved";
    }
  | {
      readonly stepNumber: number;
      readonly status: "scored";
      readonly subject: "origin" | "frontier";
      readonly scores: readonly { readonly candidateId: string; readonly agreement: number }[];
    };

export interface FartherPanelEvidence {
  readonly stepNumber: number;
  readonly reachSteps: number;
  readonly status: "not-observable" | "unrevealing" | "revealing";
  readonly reason:
    | "occluded"
    | "no-built-art"
    | "camera-unresolved"
    | "weak-agreement"
    | "ambiguous-family"
    | null;
  readonly scores: readonly { readonly candidateId: string; readonly agreement: number }[];
  readonly bestAgreement: number | null;
  readonly familyMargin: number | null;
  readonly descendantMargin: number | null;
}

export interface FartherOriginEvidence {
  readonly stepNumber: number;
  readonly status: "no-local-signal" | "unseparated";
  readonly margin: number | null;
  readonly minimumMargin: number | null;
}

export interface FirstRevealingPanelResult {
  readonly decision: {
    readonly originCandidateId: string;
    readonly revealingStepNumber: number;
    readonly survivingCandidateIds: readonly string[];
    readonly rejectedCandidateIds: readonly string[];
    readonly descendantSettled: boolean;
  } | null;
  readonly refusal: FartherRefusal | null;
  readonly evidence: {
    readonly origin: FartherOriginEvidence | null;
    readonly panels: readonly FartherPanelEvidence[];
    readonly panelRenders: number;
    readonly maximumPanelRenders: number;
    readonly maximumReachSteps: number;
  };
}

export interface FirstRevealingPanelInput<D> {
  readonly frontier: FartherFrontier<D>;
  readonly originEvidence: FartherOriginEvidence;
  readonly panels: readonly FartherPanelObservationInput[];
  readonly minimumAgreement: number;
  readonly minimumMargin: number;
  readonly maximumPanelRenders: number;
  readonly maximumReachSteps: number;
  readonly fartherPanelsAvailable: boolean;
}

/** One normalized local DAG node; global ancestry remains committed by its identity. */
export interface LineagedFartherNode {
  readonly identity: RealBuildLineageIdentity;
  /** Exact immutable bytes retained for every historical decision/evidence node. */
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly pieces: readonly FartherPlacementWitness[] | null;
}

/**
 * A farther branch. `identity.lineageId` is branch identity, while candidateId
 * remains only the stable identity of the exact document bytes.
 */
export interface LineagedFartherCandidate<D> {
  readonly identity: RealBuildLineageIdentity;
  /** Step-N decision lineage that began this local family, not the global run root. */
  readonly fartherOriginLineageId: RealBuildLineageId;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  /** Compile-time document association; execution retains only the immutable BrickDocument. */
  readonly [lineagedFartherDocumentType]?: D;
}

/** Detached normalized state for inspection and validation only. */
export interface LineagedFartherFrontierSnapshot<D> {
  readonly originStepNumber: number;
  readonly throughStepNumber: number;
  /** Last panel consumed; may advance while same-prefix evidence retains throughStepNumber. */
  readonly observationPanelStepNumber: number;
  readonly panelRendersUsed: number;
  readonly candidates: readonly LineagedFartherCandidate<D>[];
  /** Persistent local DAG shared by every current branch; lineageId is the unique key. */
  readonly nodes: readonly LineagedFartherNode[];
}

/** Nonforgeable execution state; no public producer exists in the fail-closed tranche. */
export interface LineagedFartherFrontier<D> extends LineagedFartherFrontierSnapshot<D> {
  readonly [lineagedFartherFrontierType]: true;
}

export interface LineagedFartherOriginInput<D> {
  readonly stepNumber: number;
  readonly observationPanelStepNumber: number;
  readonly panelRendersUsed: number;
  readonly candidates: readonly LineagedFartherCandidate<D>[];
  readonly nodes: readonly LineagedFartherNode[];
}

export interface LineagedFartherOriginResult<D> {
  readonly frontier: LineagedFartherFrontier<D> | null;
  readonly refusal: FartherRefusal | null;
}

export interface LineagedFartherParentExpansion<D> {
  readonly parentLineageId: RealBuildLineageId;
  readonly narrowingRenders: number;
  readonly offeredPerPiece: readonly number[];
  readonly carriedPerPiece: readonly number[];
  /** Every child is derived by the project-owned placement and validation authority. */
  readonly children: readonly RealBuildValidatedFartherPlacementTransition[];
  readonly [lineagedFartherDocumentType]?: D;
}

export interface LineagedFartherCarryEvidence {
  readonly parentLineages: number;
  readonly parentsExpanded: number;
  readonly offeredLineages: number;
  readonly narrowingRenders: number;
  readonly maximumLineages: number;
  readonly maximumNarrowingRenders: number;
  readonly expectedAtomicPieces: readonly FartherAtomicPieceIdentity[];
  readonly perParent: readonly {
    readonly parentLineageId: RealBuildLineageId;
    readonly offeredLineages: number;
    readonly narrowingRenders: number;
    readonly offeredPerPiece: readonly number[];
    readonly carriedPerPiece: readonly number[];
  }[];
  readonly measuredLineages: readonly Omit<LineagedFartherCandidate<never>, "documentSnapshot">[];
  readonly nodes: readonly LineagedFartherNode[];
}

export interface LineagedFartherCarryInput<D> {
  readonly frontier: LineagedFartherFrontierSnapshot<D>;
  readonly stepNumber: number;
  readonly expectedAtomicPieces: readonly FartherAtomicPieceIdentity[];
  readonly expansions: readonly LineagedFartherParentExpansion<D>[];
  readonly maximumLineages: number;
  readonly maximumNarrowingRenders: number;
}

export interface LineagedFartherCarryResult<D> {
  readonly frontier: LineagedFartherFrontier<D> | null;
  readonly refusal: FartherRefusal | null;
  readonly evidence: LineagedFartherCarryEvidence;
}

export type LineagedFartherPanelObservationInput = TrustedLineagedFartherPanelObservation;

export type LineagedFartherPanelScore = TrustedLineagedFartherPanelScore;

export interface LineagedFartherPanelEvidence {
  readonly stepNumber: number;
  readonly reachSteps: number;
  readonly status: "not-observable" | "unrevealing" | "revealing";
  readonly reason:
    | "occluded"
    | "no-built-art"
    | "camera-unresolved"
    | "weak-agreement"
    | "ambiguous-family"
    | null;
  readonly scores: readonly LineagedFartherPanelScore[];
  readonly bestAgreement: number | null;
  readonly familyMargin: number | null;
  readonly descendantMargin: number | null;
}

export interface FirstLineagedRevealingPanelInput<D> {
  readonly frontier: LineagedFartherFrontierSnapshot<D>;
  readonly panels: readonly LineagedFartherPanelObservationInput[];
  readonly minimumAgreement: number;
  readonly minimumMargin: number;
  readonly maximumPanelRenders: number;
  readonly maximumReachSteps: number;
  readonly fartherPanelsAvailable: boolean;
}

export interface FirstLineagedRevealingPanelResult<D> {
  readonly decision: {
    /** All ancestry families reaching the same winning document observation. */
    readonly fartherOriginLineageIds: readonly RealBuildLineageId[];
    readonly revealingStepNumber: number;
    readonly survivingLineageIds: readonly RealBuildLineageId[];
    readonly rejectedLineageIds: readonly RealBuildLineageId[];
    readonly descendantSettled: boolean;
  } | null;
  readonly refusal: FartherRefusal | null;
  /** Latest fully admitted observation frontier; null only for invalid input. */
  readonly frontier: LineagedFartherFrontier<D> | null;
  readonly evidence: {
    readonly panels: readonly LineagedFartherPanelEvidence[];
    readonly panelRenders: number;
    readonly maximumPanelRenders: number;
    readonly maximumReachSteps: number;
    readonly nodes: readonly LineagedFartherNode[];
  };
}

/** Reserved private input from a future validated origin/search producer. */
export interface LineagedFartherOriginAuthority<D> {
  readonly [lineagedFartherOriginAuthorityType]: D;
}

/** Reserved private input binding an exact branded frontier to one prepared search batch. */
export interface LineagedFartherCarryAuthority<D> {
  readonly [lineagedFartherCarryAuthorityType]: D;
}

/** Reserved private input binding an exact branded frontier to trusted negative/scored evidence. */
export interface FirstLineagedRevealingPanelAuthority<D> {
  readonly [lineagedFartherPanelAuthorityType]: D;
}
