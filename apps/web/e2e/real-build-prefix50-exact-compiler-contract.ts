import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import type {
  PlacementEnumeration,
  PlacementTransformDiagnosis,
} from "../src/assembly/enumerate-placements";
import type { RealBuildAutomaticPlacementWitness } from "./real-build-automatic-placement-input";
import { BUILDER_STEP1_ORIGIN_POLICY } from "./real-build-builder-sources";
import type { RealBuildPrefix50Occurrence30SourceRepairEvidence } from "./real-build-prefix50-occurrence30-source-repair";
import type { RealBuildPrefix50ProjectionOccurrence } from "./real-build-prefix50-projection";
import type { RealBuildPrefix50SourcePlacementRepairProposal } from "./real-build-prefix50-source-placement-repair";

export const REAL_BUILD_PREFIX50_MAXIMUM_DISTINCT_TRANSFORMS = 200_000;
export const REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES = 100_000;

export interface RealBuildPrefix50StateCommitment {
  readonly completedPrintedStep: number;
  readonly partCount: number;
  readonly documentHash: `sha256:${string}`;
}

export interface RealBuildPrefix50ExactCompilation {
  readonly schemaVersion: "lego.real-build-prefix50-exact-compilation/2";
  readonly projectionCommitment: `sha256:${string}`;
  readonly gauge: RigidTransform;
  readonly gaugeCommitment: `sha256:${string}`;
  readonly worldGaugeSourceRepair: RealBuildPrefix50WorldGaugeSourceRepair | null;
  readonly occurrence30SourceRepair: RealBuildPrefix50BoundOccurrence30SourceRepair;
  readonly placementOrdinals: readonly number[];
  readonly stateCommitments: readonly RealBuildPrefix50StateCommitment[];
  readonly enumerationCount: number;
  readonly orientationNarrowedEnumerationCount: number;
  readonly searchNodeCount: number;
  readonly sourcePlacementRepairs: readonly RealBuildPrefix50BoundPlacementRepair[];
  readonly document: BrickDocumentV1;
}

export type RealBuildPrefix50ExactCompilationCore = Omit<
  RealBuildPrefix50ExactCompilation,
  "schemaVersion" | "occurrence30SourceRepair"
> & {
  readonly occurrence30SourceRepair: RealBuildPrefix50BoundOccurrence30SourceRepair | null;
};

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
