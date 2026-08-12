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
