import type { RigidTransform } from "@lego-studio/protocol";

import type {
  RealBuildPrefix50ProjectionOccurrence,
  RealBuildPrefix50VerifiedProjectionReader,
} from "./real-build-prefix50-projection";
import type { RealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair-contract";
import type { RealBuildPrefix50Step42PanelFaceFixture } from "./real-build-prefix50-step42-panel-face-fixture";
import type { RealBuildPrefix50PhysicalLayerCommitments } from "./real-build-prefix50-step42-physical-equivalence";

export const REAL_BUILD_PREFIX50_STEP42_RAW_ORIENTATION = "proper-m-00nn000p0" as const;
export const REAL_BUILD_PREFIX50_STEP42_OLDER_REFUSED_ORIENTATION = "proper-m-00pp000p0" as const;
export const REAL_BUILD_PREFIX50_STEP42_CANONICAL_ORIENTATION = "proper-m-00n0n0n00" as const;
export const REAL_BUILD_PREFIX50_STEP42_EQUIVALENT_ORIENTATION = "proper-m-00p0n0p00" as const;
export const REAL_BUILD_PREFIX50_STEP42_RAW_TRANSFORM = {
  positionLdu: [400, -98, -110],
  orientationId: REAL_BUILD_PREFIX50_STEP42_RAW_ORIENTATION,
} as const satisfies RigidTransform;
export const REAL_BUILD_PREFIX50_STEP42_REPAIRED_TRANSFORM = {
  positionLdu: [400, -72, -108],
  orientationId: REAL_BUILD_PREFIX50_STEP42_CANONICAL_ORIENTATION,
} as const satisfies RigidTransform;

export interface RealBuildPrefix50Step42WindowRow {
  readonly ordinal: number;
  readonly printedStepNumber: number;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly sourceWorldTransform: RigidTransform;
}

export interface RealBuildPrefix50Step42NormalizedConnection {
  readonly receiverOrdinal: 270 | 273;
  readonly receiverPortId: "stud:0" | "stud:1";
  readonly candidatePortId:
    "undersideClutch:0:0" | "undersideClutch:0:1" | "undersideClutch:0:3" | "undersideClutch:0:4";
  readonly connectionKind: "stud-tube";
}

export interface RealBuildPrefix50Step42PreflightEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-step42-preflight-evidence/1";
  readonly authority: "none";
  readonly sourceRowsCommitment: `sha256:${string}`;
  readonly catalogVersion: "builtin.basic-parts/30";
  readonly catalogSnapshotHash: `sha256:${string}`;
  readonly truthSnapshotHash: `sha256:${string}`;
  readonly preRepairDocumentHash: `sha256:${string}`;
  readonly postRepairDocumentHash: `sha256:${string}`;
  readonly exactChildPartCount: 16;
  readonly exactChildConnectionCount: 28;
  readonly exactChildBlockingIssueCount: 0;
  readonly rawSourceTransform: RigidTransform;
  readonly rawSeededConnectionCount: 2;
  readonly rawConnectedCollisionPartOrdinals: readonly [267, 268];
  readonly rawConnectedCollisionFindingCodes: readonly [
    "PART_BODY_COLLISION",
    "PART_BODY_COLLISION",
  ];
  readonly rawUnconnectedStudCollisionPartOrdinals: readonly [264, 265];
  readonly rawRosterCounts: {
    readonly rawSeeds: 24;
    readonly distinctTransforms: 13;
    readonly rejectedColliding: 13;
    readonly accepted: 0;
  };
  readonly rawAndOlderRefusedOccupancyKey: string;
  readonly exactPhysicalLayerCommitments: {
    readonly raw: RealBuildPrefix50PhysicalLayerCommitments;
    readonly olderRefused: RealBuildPrefix50PhysicalLayerCommitments;
    readonly canonical: RealBuildPrefix50PhysicalLayerCommitments;
    readonly equivalent: RealBuildPrefix50PhysicalLayerCommitments;
  };
  readonly completeOrientationCount: 24;
  readonly completeRawSeeds: 288;
  readonly completeAcceptedLabelCount: 98;
  readonly completeAcceptedOccupancyCount: 49;
  readonly panelFacePhysicalOccupancyClassCount: 1;
  readonly equivalentOrientationIds: readonly [
    typeof REAL_BUILD_PREFIX50_STEP42_CANONICAL_ORIENTATION,
    typeof REAL_BUILD_PREFIX50_STEP42_EQUIVALENT_ORIENTATION,
  ];
  readonly repairedSourceTransform: RigidTransform;
  readonly repairedOccupancyKey: string;
  readonly canonicalConnections: readonly RealBuildPrefix50Step42NormalizedConnection[];
  readonly equivalentConnections: readonly {
    readonly receiverOrdinal: 270 | 273;
    readonly receiverPortId: "stud:0" | "stud:1";
    readonly candidatePortId: string;
    readonly connectionKind: "stud-tube";
  }[];
  readonly reciprocalExactReceiverCount: 2;
  readonly repairedConnectedCollisionFindingCount: 0;
  readonly repairedChildPartCount: 17;
  readonly repairedChildConnectionCount: 32;
  readonly repairedChildBlockingIssueCount: 0;
  readonly repairCommitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step42SourceRepairEvidence extends Omit<
  RealBuildPrefix50Step42PreflightEvidence,
  "schemaVersion"
> {
  readonly schemaVersion: "lego.real-build-prefix50-step42-source-repair-evidence/1";
  readonly projectionCommitment: `sha256:${string}`;
  readonly rawProjectionRowsCommitment: `sha256:${string}`;
  readonly actionBindingCommitment: `sha256:${string}`;
  readonly panelFaceFixtureCommitment: `sha256:${string}`;
  readonly step41RepairCommitment: `sha256:${string}`;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly panelPageNumber: 44;
  readonly panelCropDigest: `sha256:${string}`;
  readonly lookaheadPageNumber: 45;
  readonly stepActionDigest: `sha256:${string}`;
  readonly phaseSourceDigest: `sha256:${string}`;
  readonly printedStepNumber: 42;
  readonly phaseSequence: 68;
  readonly occurrenceOrdinal: 274;
  readonly rawSourceTransformsPreserved: true;
  readonly catalogTruthClaimed: false;
  readonly placementAuthority: false;
}

export interface RealBuildPrefix50Step42SourceRepairInput {
  readonly projectionReader: RealBuildPrefix50VerifiedProjectionReader;
  readonly step41SourceRepairProof: RealBuildPrefix50Step41SourceRepairProof;
  readonly reviewedPanelFaceFixture: RealBuildPrefix50Step42PanelFaceFixture;
  readonly sourceRows: readonly RealBuildPrefix50ProjectionOccurrence[];
}

export interface RealBuildPrefix50Step42SourceRepairProof {
  readonly schemaVersion: "lego.real-build-prefix50-step42-source-repair-proof/1";
}
