import type { BuildPlaybackTraceV1 } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import type {
  PlacementEnumeration,
  PlacementTransformDiagnosis,
} from "../src/assembly/enumerate-placements";
import type { RealBuildAutomaticPlacementWitness } from "./real-build-automatic-placement-input";
import type { RigidSubassemblyReturnEnumeration } from "../src/assembly/rigid-subassembly-return";
import { BUILDER_STEP1_ORIGIN_POLICY } from "./real-build-builder-sources";
import type { RealBuildPrefix50Occurrence30SourceRepairEvidence } from "./real-build-prefix50-occurrence30-source-repair";
import type {
  RealBuildPrefix50ProjectionOccurrence,
  RealBuildPrefix50ProjectionStep,
} from "./real-build-prefix50-projection";
import type { RealBuildPrefix50SourcePlacementRepairProposal } from "./real-build-prefix50-source-placement-repair";
import type { RealBuildPrefix50BoundStep41SourceRepair } from "./real-build-prefix50-step41-source-repair-application";
import type {
  RealBuildPrefix50BoundStep42_43SourceRepair,
  RealBuildPrefix50BoundStep42SourceRepair,
} from "./real-build-prefix50-late-source-repair-binding";
import type { RealBuildPrefix50AtomicSubBuildRoot } from "./real-build-prefix50-subbuild-root";
import type { RealBuildPrefix50DetachedSubBuildState } from "./real-build-prefix50-subbuild-state";
import type { RealBuildPrefix50SelectedSubBuildReturn } from "./real-build-prefix50-subbuild-return";
import type { RealBuildPrefix50Step45RelationalResolution } from "./real-build-prefix50-step45-relational-resolver";
import type { RealBuildPrefix50Step50AtomicRoot } from "./real-build-prefix50-suffix-root";
import type { RealBuildPrefix50SuffixSubBuildPlan } from "./real-build-prefix50-suffix-subbuild-plan";
import type {
  RealBuildPrefix50SameStepReturnStates,
  RealBuildPrefix50TerminalDetachedState,
} from "./real-build-prefix50-suffix-state";

export const REAL_BUILD_PREFIX50_MAXIMUM_DISTINCT_TRANSFORMS = 200_000;
export const REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES = 100_000;

export interface RealBuildPrefix50StateCommitment {
  readonly completedPrintedStep: number;
  readonly partCount: number;
  readonly documentHash: `sha256:${string}`;
  readonly canonicalDocumentDigest: `sha256:${string}`;
}

export interface RealBuildPrefix50ExactCompilation {
  readonly schemaVersion: "lego.real-build-prefix50-exact-compilation/6";
  readonly projectionCommitment: `sha256:${string}`;
  readonly gauge: RigidTransform;
  readonly gaugeCommitment: `sha256:${string}`;
  readonly worldGaugeSourceRepair: RealBuildPrefix50WorldGaugeSourceRepair | null;
  readonly occurrence30SourceRepair: RealBuildPrefix50BoundOccurrence30SourceRepair;
  readonly step41SourceRepair: RealBuildPrefix50BoundStep41SourceRepair;
  readonly step42SourceRepair: RealBuildPrefix50BoundStep42SourceRepair;
  readonly step42_43SourceRepair: RealBuildPrefix50BoundStep42_43SourceRepair;
  readonly placementOrdinals: readonly number[];
  readonly stateCommitments: readonly RealBuildPrefix50StateCommitment[];
  readonly playbackTrace: BuildPlaybackTraceV1;
  readonly enumerationCount: number;
  readonly orientationNarrowedEnumerationCount: number;
  readonly searchNodeCount: number;
  readonly sourcePlacementRepairs: readonly RealBuildPrefix50BoundPlacementRepair[];
  readonly candidateStepCommitments: readonly {
    readonly printedStepNumber: number;
    readonly commitment: `sha256:${string}`;
  }[];
  readonly atomicSubBuildRoot: RealBuildPrefix50AtomicSubBuildRoot | null;
  readonly detachedSubBuildStates: readonly RealBuildPrefix50DetachedSubBuildState[];
  readonly subBuildReturnEnumeration: RigidSubassemblyReturnEnumeration | null;
  readonly selectedSubBuildReturn: RealBuildPrefix50SelectedSubBuildReturn;
  readonly step44SelectionEvidence: RealBuildPrefix50Step44SelectionEvidence;
  readonly step45RelationalEvidence: RealBuildPrefix50Step45RelationalCompilationEvidence;
  readonly suffixSubBuildPlan: RealBuildPrefix50SuffixSubBuildPlan;
  readonly sameStepReturnStates: RealBuildPrefix50SameStepReturnStates;
  readonly step50AtomicRoot: RealBuildPrefix50Step50AtomicRoot;
  readonly terminalDetachedState: RealBuildPrefix50TerminalDetachedState;
  readonly document: BrickDocumentV1;
}

export type RealBuildPrefix50ExactCompilationCore = Omit<
  RealBuildPrefix50ExactCompilation,
  | "schemaVersion"
  | "occurrence30SourceRepair"
  | "sameStepReturnStates"
  | "selectedSubBuildReturn"
  | "step41SourceRepair"
  | "step42SourceRepair"
  | "step42_43SourceRepair"
  | "step44SelectionEvidence"
  | "step45RelationalEvidence"
  | "step50AtomicRoot"
  | "suffixSubBuildPlan"
  | "terminalDetachedState"
> & {
  readonly occurrence30SourceRepair: RealBuildPrefix50BoundOccurrence30SourceRepair | null;
  readonly sameStepReturnStates: RealBuildPrefix50SameStepReturnStates | null;
  readonly selectedSubBuildReturn: RealBuildPrefix50SelectedSubBuildReturn | null;
  readonly step41SourceRepair: RealBuildPrefix50BoundStep41SourceRepair | null;
  readonly step42SourceRepair: RealBuildPrefix50BoundStep42SourceRepair | null;
  readonly step42_43SourceRepair: RealBuildPrefix50BoundStep42_43SourceRepair | null;
  readonly step44SelectionEvidence: RealBuildPrefix50Step44SelectionEvidence | null;
  readonly step45RelationalEvidence: RealBuildPrefix50Step45RelationalCompilationEvidence | null;
  readonly step50AtomicRoot: RealBuildPrefix50Step50AtomicRoot | null;
  readonly suffixSubBuildPlan: RealBuildPrefix50SuffixSubBuildPlan | null;
  readonly terminalDetachedState: RealBuildPrefix50TerminalDetachedState | null;
};

export interface RealBuildPrefix50Step44SelectionEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-step44-selection-evidence/2";
  readonly authority: "none";
  readonly printedStepNumber: 44;
  readonly step44PrintedStep: RealBuildPrefix50ProjectionStep;
  readonly step44PrintedStepCommitment: `sha256:${string}`;
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly selectedSubBuildReturnCommitment: `sha256:${string}`;
  readonly reviewedVisualBindingCommitment: `sha256:${string}`;
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step45RelationalCompilationEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-step45-relational-compilation/1";
  readonly authority: "none";
  readonly printedStepNumber: 45;
  readonly selectedSubBuildReturnCommitment: `sha256:${string}`;
  readonly reviewedVisualBindingCommitment: `sha256:${string}`;
  readonly step44SelectionEvidenceCommitment: `sha256:${string}`;
  readonly step44ZeroStepProgramHash: `sha256:${string}`;
  readonly resolution: RealBuildPrefix50Step45RelationalResolution;
  readonly accounting: {
    readonly relationalResolverCallCount: 1;
    readonly genericSearchCallCount: 0;
    readonly enumerationDelta: 1;
    readonly orientationNarrowedEnumerationDelta: 0;
    readonly searchNodeDelta: 3;
  };
  readonly receiverPairs: readonly {
    readonly occurrenceOrdinal: 281 | 282 | 283;
    readonly receiverOrdinal: 261 | 264 | 265;
    readonly candidatePartId: string;
    readonly receiverPartId: string;
    readonly connectionId: string;
    readonly candidateCommitment: `sha256:${string}`;
  }[];
  readonly candidateStepCommitment: `sha256:${string}`;
  readonly playbackOperationsCommitment: `sha256:${string}`;
  readonly resultDocumentHash: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50DiagnosticObservation {
  readonly schemaVersion: "lego.real-build-prefix50-selected-path-diagnostic/1";
  readonly placementAuthority: false;
  readonly completionAuthority: false;
  readonly documentAuthority: false;
  readonly publicationAuthority: false;
  readonly searchScope: {
    readonly committedPrefixSelection: "first-locally-complete-order-per-step";
    readonly currentStepBacktracking: "within-step-only";
    readonly crossStepBacktracking: false;
    readonly nodeBudget: "cumulative-across-prefix";
  };
  readonly outcome: "selected-committed-prefix-within-step-blocker" | "selected-path-complete";
  readonly sourceSetId: string;
  readonly sourceArtifactDigest: `sha256:${string}`;
  readonly projectionCommitment: `sha256:${string}`;
  readonly truthDigest: `sha256:${string}`;
  readonly blocker: {
    readonly message: string;
    readonly printedStepNumber: number;
    readonly occurrenceOrdinal: number | null;
    readonly catalogPartId: string | null;
    readonly sourceWorldTransform: RigidTransform | null;
    readonly targetTransform: RigidTransform | null;
    readonly diagnosis: PlacementTransformDiagnosis | null;
    readonly lastCounts: PlacementEnumeration["counts"] | null;
    readonly basePartCount: number;
    readonly baseStepCount: number;
    readonly enumerationCount: number;
    readonly searchNodeCount: number;
  } | null;
  readonly observation: {
    readonly completedPrintedStep: number;
    readonly compiledPartCount: number;
    readonly compiledStepCount: number;
    readonly enumerationCount: number;
    readonly searchNodeCount: number;
  };
}

export class RealBuildPrefix50SelectedPathBlockerError extends TypeError {
  constructor(
    message: string,
    readonly blocker: NonNullable<RealBuildPrefix50DiagnosticObservation["blocker"]>,
  ) {
    super(message);
  }
}

export interface RealBuildPrefix50WorldGaugeSourceRepairProposal {
  readonly schemaVersion: "lego.real-build-prefix50-world-gauge-source-repair/1";
  readonly occurrenceOrdinal: 1;
  readonly catalogPartId: "builtin:corner-plate-5x5-quarter-ring";
  readonly sourceWorldTransform: RigidTransform;
  readonly repairedSourceWorldTransform: RigidTransform;
  readonly sourceResidualLdu: readonly [60, 0, 40];
  readonly projectAnchorPolicy: typeof BUILDER_STEP1_ORIGIN_POLICY.protocol;
  readonly provisionalBasis: "occurrence-scoped-project-anchor-awaiting-complete-prefix-proof";
}

export interface RealBuildPrefix50WorldGaugeSourceRepairProof {
  readonly schemaVersion: "lego.real-build-prefix50-world-gauge-source-repair-proof/1";
  readonly projectionCommitment: `sha256:${string}`;
  readonly completedPrintedStep: 50;
  readonly stepCount: 50;
  readonly compiledPartCount: 320;
  readonly occurrenceCount: 320;
  readonly occurrenceOrdinalOrder: "exact-indexed-1-through-320";
  readonly sourceSuffixOccurrenceCount: 0;
  readonly placementOrdinalCount: 320;
  readonly placementOrdinalRoster: "exact-unique-1-through-320";
  readonly stepIndexOrder: "exact-indexed-0-through-49";
  readonly zeroPieceStepNumber: 44;
  readonly hasStep51Suffix: false;
  readonly finalDocumentHash: `sha256:${string}`;
}

export interface RealBuildPrefix50WorldGaugeSourceRepair extends Omit<
  RealBuildPrefix50WorldGaugeSourceRepairProposal,
  "provisionalBasis" | "schemaVersion"
> {
  readonly schemaVersion: "lego.real-build-prefix50-world-gauge-source-repair/2";
  readonly basis: "complete-prefix50-exact-enumeration";
  readonly repairedTargetTransform: RigidTransform;
  readonly candidatePartId: string;
  readonly proof: RealBuildPrefix50WorldGaugeSourceRepairProof;
}

export interface RealBuildPrefix50BoundPlacementRepair extends RealBuildPrefix50SourcePlacementRepairProposal {
  readonly basis: "unique-exact-catalog-connector-seat";
  readonly repairedTargetTransform: RigidTransform;
  readonly candidatePartId: string;
  readonly receiverPartId: string;
  readonly connectionId: string;
}

export interface RealBuildPrefix50Occurrence30SourceRepairProposal {
  readonly schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair/1";
  readonly occurrenceOrdinal: 30;
  readonly expectedReceiverOrdinal: 31;
  readonly futureCollisionControlOrdinal: 147;
  readonly catalogPartId: "builtin:corner-plate-3x3";
  readonly sourceWorldTransform: RigidTransform;
  readonly repairedSourceWorldTransform: RigidTransform;
  readonly sourceResidualLdu: readonly [-20, 0, 20];
  readonly sourceEvidence: RealBuildPrefix50Occurrence30SourceRepairEvidence;
  readonly repairCommitment: `sha256:${string}`;
  readonly provisionalBasis: "opaque-builder-source-awaiting-complete-prefix-proof";
}

export interface RealBuildPrefix50BoundOccurrence30SourceRepair extends Omit<
  RealBuildPrefix50Occurrence30SourceRepairProposal,
  "provisionalBasis" | "schemaVersion"
> {
  readonly schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair/2";
  readonly basis: "opaque-source-plus-complete-prefix50-exact-enumeration";
  readonly repairedTargetTransform: RigidTransform;
  readonly candidatePartId: string;
  readonly receiverPartId: string;
  readonly connectionIds: readonly [string, string, string, string, string];
  readonly futureCollisionControlPartId: string;
  readonly proof: {
    readonly schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair-final-proof/1";
    readonly projectionCommitment: `sha256:${string}`;
    readonly completedPrintedStep: 50;
    readonly compiledPartCount: 320;
    readonly occurrenceOrdinalRoster: "exact-unique-1-through-320";
    readonly exactEnumeratedPoseRetained: true;
    readonly distinctCandidatePortCount: 5;
    readonly distinctReceiverPortCount: 5;
    readonly finalDocumentCollisionCount: 0;
    readonly occurrence30To147CollisionCount: 0;
    readonly finalDocumentHash: `sha256:${string}`;
  };
}

export interface RealBuildPrefix50TargetOccurrence extends RealBuildPrefix50ProjectionOccurrence {
  readonly targetTransform: RigidTransform;
}

export interface RealBuildPrefix50SearchState {
  readonly document: BrickDocumentV1;
  readonly remaining: readonly RealBuildPrefix50TargetOccurrence[];
  readonly witnesses: readonly RealBuildAutomaticPlacementWitness[];
  readonly ordinals: readonly number[];
  readonly witnessIndexByTempId: ReadonlyMap<string, number>;
}

export interface RealBuildPrefix50SearchBudget {
  nodes: number;
  enumerations: number;
  orientationNarrowedEnumerations: number;
  readonly targetAttempts: Map<
    number,
    {
      attempts: number;
      matches: number;
      lastCounts: PlacementEnumeration["counts"];
    }
  >;
}
