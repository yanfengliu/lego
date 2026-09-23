import type { RigidTransform } from "@lego-studio/protocol";

import type {
  RealBuildPrefix50ProjectionOccurrence,
  RealBuildPrefix50VerifiedProjectionReader,
} from "./real-build-prefix50-projection";
import type { RealBuildPrefix50Step41PanelFaceFixture } from "./real-build-prefix50-step41-panel-face-fixture";
import type { RealBuildPrefix50Step41SeatEnumeration } from "./real-build-prefix50-step41-source-repair-enumeration";

export const REAL_BUILD_PREFIX50_STEP41_CHILD_PATH = [
  "7004cf0d-d97f-4b0d-8572-970e23815c05",
  "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
] as const;
export const REAL_BUILD_PREFIX50_STEP41_CANONICAL_ORIENTATION = "proper-m-00n0n0n00" as const;
export const REAL_BUILD_PREFIX50_STEP41_EQUIVALENT_ORIENTATION = "proper-m-00p0n0p00" as const;
export const REAL_BUILD_PREFIX50_STEP41_PAIRS = [
  { receiverOrdinal: 267, candidateOrdinal: 270, repairedX: 440 },
  { receiverOrdinal: 266, candidateOrdinal: 271, repairedX: 240 },
  { receiverOrdinal: 269, candidateOrdinal: 272, repairedX: 300 },
  { receiverOrdinal: 268, candidateOrdinal: 273, repairedX: 380 },
] as const;

export interface RealBuildPrefix50Step41NormalizedConnection {
  readonly receiverPortId: string;
  readonly candidatePortId: string;
  readonly connectionKind: "stud-tube";
}

export interface RealBuildPrefix50Step41PairEvidence {
  readonly receiverOrdinal: number;
  readonly candidateOrdinal: number;
  readonly rawSourceWorldTransform: RigidTransform;
  readonly repairedSourceWorldTransform: RigidTransform;
  readonly rawConnectionCount: 0;
  readonly rawCollisionFindingCodes: readonly ["PART_BODY_COLLISION", "PART_STUD_BODY_COLLISION"];
  readonly equivalentOrientationIds: readonly [
    typeof REAL_BUILD_PREFIX50_STEP41_CANONICAL_ORIENTATION,
    typeof REAL_BUILD_PREFIX50_STEP41_EQUIVALENT_ORIENTATION,
  ];
  readonly physicalOccupancyClassCount: 1;
  readonly canonicalOrientationBasis: "raw-long-axis-direction-preserved";
  readonly canonicalConnections: readonly RealBuildPrefix50Step41NormalizedConnection[];
  readonly alternativeConnections: readonly RealBuildPrefix50Step41NormalizedConnection[];
  readonly forwardCounts: RealBuildPrefix50Step41SeatEnumeration["counts"];
  readonly reverseCounts: RealBuildPrefix50Step41SeatEnumeration["counts"];
  readonly reciprocalExactCandidateCount: 1;
  readonly connectedCollisionFindingCount: 0;
}

export interface RealBuildPrefix50Step41SourceRepairEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-step41-source-repair-evidence/1";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly projectionCommitment: `sha256:${string}`;
  readonly actionBindingCommitment: `sha256:${string}`;
  readonly panelFaceFixtureCommitment: `sha256:${string}`;
  readonly sourceRowsCommitment: `sha256:${string}`;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly panelPageNumber: 44;
  readonly panelCropDigest: `sha256:${string}`;
  readonly stepActionDigest: `sha256:${string}`;
  readonly phaseSourceDigest: `sha256:${string}`;
  readonly printedStepNumber: 41;
  readonly phaseSequence: 67;
  readonly rawSourceTransformsPreserved: true;
  readonly catalogTruthClaimed: false;
  readonly placementAuthority: false;
  readonly orientationEnumerationCountPerDirection: 24;
  readonly pairs: readonly RealBuildPrefix50Step41PairEvidence[];
  readonly totalReciprocalConnectionCount: 8;
  readonly collisionAndCapacityScope: "isolated-source-rows-266..273-eight-body";
  readonly isolatedConnectorCapacityEndpointClaimCount: number;
  readonly isolatedConnectedCollisionFindingCount: 0;
  readonly repairCommitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step41SourceRepairInput {
  readonly projectionReader: RealBuildPrefix50VerifiedProjectionReader;
  readonly reviewedPanelFaceFixture: RealBuildPrefix50Step41PanelFaceFixture;
  readonly sourceRows: readonly RealBuildPrefix50ProjectionOccurrence[];
}

export interface RealBuildPrefix50Step41SourceRepairProof {
  readonly schemaVersion: "lego.real-build-prefix50-step41-source-repair-proof/1";
}

export type RealBuildPrefix50Step41ReceiptMutation = (
  receipt: RealBuildPrefix50Step41SeatEnumeration,
  context: {
    readonly direction: "forward" | "reverse";
    readonly receiverOrdinal: number;
    readonly candidateOrdinal: number;
  },
) => RealBuildPrefix50Step41SeatEnumeration;
