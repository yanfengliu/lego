import type {
  RealBuildLineageId,
  RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import type { RealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type {
  FartherAtomicPieceIdentity,
  FartherPlacementWitness,
} from "./real-build-farther-panel-types";

export type LineagedFartherInspectionKind = "frontier" | "origin" | "carry" | "panel";

export interface InspectedLineagedFartherCandidate {
  readonly identity: RealBuildLineageIdentity;
  readonly fartherOriginLineageId: RealBuildLineageId;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
}

export interface InspectedLineagedFartherNode {
  readonly identity: RealBuildLineageIdentity;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly pieces: readonly FartherPlacementWitness[] | null;
}

export interface InspectedLineagedFartherFrontier {
  readonly originStepNumber: number;
  readonly throughStepNumber: number;
  readonly observationPanelStepNumber: number;
  readonly panelRendersUsed: number;
  readonly candidates: readonly InspectedLineagedFartherCandidate[];
  readonly nodes: readonly InspectedLineagedFartherNode[];
}

export interface InspectedLineagedFartherOrigin {
  readonly stepNumber: number;
  readonly observationPanelStepNumber: number;
  readonly panelRendersUsed: number;
  readonly candidates: readonly InspectedLineagedFartherCandidate[];
  readonly nodes: readonly InspectedLineagedFartherNode[];
}

export interface InspectedLineagedFartherTransition {
  readonly parentLineageId: RealBuildLineageId;
  readonly throughStepNumber: number;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly pieces: readonly FartherPlacementWitness[];
}

export interface InspectedLineagedFartherChildProposal {
  readonly parentLineageId: RealBuildLineageId;
  readonly throughStepNumber: number;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly pieces: readonly FartherPlacementWitness[];
}

export interface InspectedLineagedFartherExpansion {
  readonly parentLineageId: RealBuildLineageId;
  readonly narrowingRenders: number;
  readonly offeredPerPiece: readonly number[];
  readonly carriedPerPiece: readonly number[];
  readonly children: readonly InspectedLineagedFartherTransition[];
}

export interface InspectedLineagedFartherCarry {
  readonly frontier: InspectedLineagedFartherFrontier;
  readonly stepNumber: number;
  readonly expectedAtomicPieces: readonly FartherAtomicPieceIdentity[];
  readonly expansions: readonly InspectedLineagedFartherExpansion[];
  readonly maximumLineages: number;
  readonly maximumNarrowingRenders: number;
}

export interface InspectedLineagedFartherPanelScore {
  readonly identity: RealBuildLineageIdentity;
  readonly fartherOriginLineageId: RealBuildLineageId;
  readonly cameraEvidenceId: string;
  readonly measure: "iou" | "containment";
  readonly candidateMaskDigest: string;
  readonly builtMaskDigest: string;
  readonly excludedMaskDigest: string | null;
  readonly shiftPx: readonly [number, number];
  readonly agreement: number;
}

export interface InspectedLineagedFartherPanelObservation {
  readonly stepNumber: number;
  readonly status: "scored";
  readonly renderCount: number;
  readonly scores: readonly InspectedLineagedFartherPanelScore[];
}

export interface InspectedFirstLineagedRevealingPanel {
  readonly frontier: InspectedLineagedFartherFrontier;
  readonly panels: readonly InspectedLineagedFartherPanelObservation[];
  readonly minimumAgreement: number;
  readonly minimumMargin: number;
  readonly maximumPanelRenders: number;
  readonly maximumReachSteps: number;
  readonly fartherPanelsAvailable: boolean;
}

export interface LineagedFartherInspectionValueMap {
  readonly frontier: InspectedLineagedFartherFrontier;
  readonly origin: InspectedLineagedFartherOrigin;
  readonly carry: InspectedLineagedFartherCarry;
  readonly panel: InspectedFirstLineagedRevealingPanel;
}

export interface LineagedFartherProjectionBudget {
  entries: number;
  stringUnits: number;
  witnesses: number;
  children: number;
  scores: number;
}

export interface LineagedFartherProjectionContext {
  readonly budget: LineagedFartherProjectionBudget;
  readonly identities: WeakMap<object, RealBuildLineageIdentity>;
  readonly candidates: WeakMap<object, InspectedLineagedFartherCandidate>;
  readonly nodes: WeakMap<object, InspectedLineagedFartherNode>;
  readonly witnesses: WeakMap<object, FartherPlacementWitness>;
  readonly witnessArrays: WeakMap<object, readonly FartherPlacementWitness[]>;
  readonly snapshotsByCandidateId: Map<string, object>;
  readonly snapshotsByBytesHash: Map<string, object>;
  readonly chargedSnapshots: WeakSet<object>;
  retainedSnapshotBytes: number;
}

declare const lineagedFartherInspectionType: unique symbol;

export interface LineagedFartherInspectionSnapshot<
  K extends LineagedFartherInspectionKind = LineagedFartherInspectionKind,
> {
  readonly kind: K;
  readonly value: LineagedFartherInspectionValueMap[K];
  readonly [lineagedFartherInspectionType]: true;
}
