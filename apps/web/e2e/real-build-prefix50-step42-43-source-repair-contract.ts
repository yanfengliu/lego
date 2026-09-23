import type { RigidTransform } from "@lego-studio/protocol";

import type {
  RealBuildPrefix50ProjectionOccurrence,
  RealBuildPrefix50VerifiedProjectionReader,
} from "./real-build-prefix50-projection";
import type { RealBuildPrefix50Step42_43PanelFixture } from "./real-build-prefix50-step42-43-panel-fixture";
import type { RealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair-contract";
import type { RealBuildPrefix50Step42SourceRepairProof } from "./real-build-prefix50-step42-source-repair-contract";

export const REAL_BUILD_PREFIX50_STEP42_43_CHILD_PATH = [
  "7004cf0d-d97f-4b0d-8572-970e23815c05",
  "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
] as const;

export const REAL_BUILD_PREFIX50_STEP42_43_REPAIRS = [
  {
    ordinal: 275,
    catalogPartId: "builtin:tile-1x2",
    raw: { positionLdu: [240, -98, -110], orientationId: "proper-m-00pp000p0" },
    repaired: { positionLdu: [240, -72, -108], orientationId: "proper-m-00n0n0n00" },
    equivalentOrientationId: "proper-m-00p0n0p00",
  },
  {
    ordinal: 276,
    catalogPartId: "builtin:plate-1x4",
    raw: { positionLdu: [300, -98, -110], orientationId: "proper-m-00nn000p0" },
    repaired: { positionLdu: [300, -72, -108], orientationId: "proper-m-00n0n0n00" },
    equivalentOrientationId: "proper-m-00p0n0p00",
  },
  {
    ordinal: 277,
    catalogPartId: "builtin:plate-1x4",
    raw: { positionLdu: [300, -98, -118], orientationId: "proper-m-00nn000p0" },
    repaired: { positionLdu: [300, -64, -108], orientationId: "proper-m-00n0n0n00" },
    equivalentOrientationId: "proper-m-00p0n0p00",
  },
  {
    ordinal: 278,
    catalogPartId: "builtin:slope-1x2-45",
    raw: { positionLdu: [320, -98, -134], orientationId: "proper-m-00nn000p0" },
    repaired: { positionLdu: [320, -48, -108], orientationId: "proper-m-00n0n0n00" },
    equivalentOrientationId: "proper-m-00p0n0p00",
  },
  {
    ordinal: 279,
    catalogPartId: "builtin:slope-1x2-45",
    raw: { positionLdu: [280, -98, -134], orientationId: "proper-m-00pp000p0" },
    repaired: { positionLdu: [280, -48, -108], orientationId: "proper-m-00p0n0p00" },
    equivalentOrientationId: "proper-m-00n0n0n00",
  },
  {
    ordinal: 280,
    catalogPartId: "builtin:tile-1x2",
    raw: { positionLdu: [300, -98, -150], orientationId: "proper-m-00nn000p0" },
    repaired: { positionLdu: [300, -32, -108], orientationId: "proper-m-00n0n0n00" },
    equivalentOrientationId: "proper-m-00p0n0p00",
  },
] as const satisfies readonly {
  ordinal: number;
  catalogPartId: string;
  raw: RigidTransform;
  repaired: RigidTransform;
  equivalentOrientationId: string;
}[];

export interface RealBuildPrefix50Step42_43ConnectionEvidence {
  readonly targetOrdinal: number;
  readonly targetPortId: string;
  readonly candidatePortId: string;
}

export interface RealBuildPrefix50Step42_43RowEvidence {
  readonly ordinal: number;
  readonly rawSourceWorldTransform: RigidTransform;
  readonly repairedSourceWorldTransform: RigidTransform;
  readonly rawConnectionCount: number;
  readonly rawCollisionFindingCodes: readonly string[];
  readonly rawCollisionFindings: readonly {
    readonly code: string;
    readonly counterpartOrdinals: readonly number[];
  }[];
  readonly completeOrientationCount: 24;
  readonly rawSeedCount: number;
  readonly distinctTransformCount: number;
  readonly enumerationCounts: {
    readonly rejectedNoConnections: number;
    readonly rejectedColliding: number;
    readonly accepted: number;
  };
  readonly sourceXAcceptedCandidates: readonly {
    readonly transform: RigidTransform;
    readonly occupancyKey: string;
    readonly currentCatalogLegal: boolean;
    readonly connections: readonly RealBuildPrefix50Step42_43ConnectionEvidence[];
  }[];
  readonly selectedConnections: readonly RealBuildPrefix50Step42_43ConnectionEvidence[];
  readonly selectedCollisionFindingCount: 0;
  readonly reciprocalExactTargetCount: number;
  readonly reciprocalExactConnectionCount: number;
  readonly symmetryOccupancyRelation: "same-physical-occupancy" | "distinct-facing-occupancy";
}

export interface RealBuildPrefix50Step42_43SourceRepairEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-step42-43-source-repair-evidence/1";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly projectionCommitment: `sha256:${string}`;
  readonly step41RepairCommitment: `sha256:${string}`;
  readonly step42RepairCommitment: `sha256:${string}`;
  readonly step42ActionBindingCommitment: `sha256:${string}`;
  readonly step43ActionBindingCommitment: `sha256:${string}`;
  readonly panelFixtureCommitment: `sha256:${string}`;
  readonly sourceRowsCommitment: `sha256:${string}`;
  readonly catalogVersion: "builtin.basic-parts/30";
  readonly catalogSnapshotHash: `sha256:${string}`;
  readonly truthSnapshotHash: `sha256:${string}`;
  readonly predecessorDocumentHash: `sha256:${string}`;
  readonly terminalDocumentHash: `sha256:${string}`;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly physicalPageNumber: 44;
  readonly lookaheadPhysicalPageNumber: 45;
  readonly rawSourceTransformsPreserved: true;
  readonly exhaustiveOrientationEnumeration: true;
  readonly catalogTruthClaimed: false;
  readonly placementAuthority: false;
  readonly collisionOrEnumerationWaiver: false;
  readonly reviewedNonUprightOrientationLabelsByPartId: Readonly<Record<string, readonly string[]>>;
  readonly rows: readonly RealBuildPrefix50Step42_43RowEvidence[];
  readonly terminalPartCount: 23;
  readonly terminalConnectionCount: 46;
  readonly terminalCollisionFindingCount: 0;
  readonly terminalBlockingIssueCount: 0;
  readonly terminalReciprocalConnectionCount: 14;
  readonly terminalConnectorCapacityClaimCount: number;
  readonly repairCommitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step42_43SourceRepairInput {
  readonly projectionReader: RealBuildPrefix50VerifiedProjectionReader;
  readonly reviewedPanelFixture: RealBuildPrefix50Step42_43PanelFixture;
  readonly sourceRows: readonly RealBuildPrefix50ProjectionOccurrence[];
  readonly step41SourceRepairProof: RealBuildPrefix50Step41SourceRepairProof;
  readonly step42SourceRepairProof: RealBuildPrefix50Step42SourceRepairProof;
}

export interface RealBuildPrefix50Step42_43SourceRepairProof {
  readonly schemaVersion: "lego.real-build-prefix50-step42-43-source-repair-proof/1";
}
