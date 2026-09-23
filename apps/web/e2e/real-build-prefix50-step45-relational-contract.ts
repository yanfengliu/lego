import { deepFreeze } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import type {
  PlacementEnumeration,
  PlacementEnumerationWork,
} from "../src/assembly/enumerate-placements";
import { PLACEMENT_ENUMERATION_VERSION } from "../src/assembly/enumerate-placements";
import type { RealBuildPrefix50SourcePlacementRepairProposal } from "./real-build-prefix50-source-placement-repair";

export const STEP45_AXLE = "builtin:axle-1x3" as const;
export const STEP45_AXLE_PORT = "axle:2" as const;
export const STEP45_RECEIVER_PORT = "axleHole:0" as const;
export const STEP45_EXPECTED_DOCUMENT_PARTS = 280 as const;
export const STEP45_MAX_DISTINCT_TRANSFORMS = 200_000 as const;
export const STEP45_MAX_DOCUMENT_CONNECTIONS = 4_096 as const;
export const STEP45_MAX_RECORDED_WORK = 1_000_000_000 as const;
export const STEP45_MAX_SEED_RECEIPT_ROWS = 64 as const;
export const STEP45_MAX_CANDIDATE_CONNECTIONS = 256 as const;

export const STEP45_EXPECTED_ROWS = deepFreeze([
  {
    occurrenceOrdinal: 281,
    receiverOrdinal: 265,
    receiverCatalogPartId: "builtin:technic-brick-1x1-axle-hole",
    receiverColorId: "builtin:dark-azure",
    sourcePositionLdu: [410, -118, -96.5] as const,
    repairedPositionLdu: [410, -118, -96] as const,
    receiverSourcePositionLdu: [410, -98, -94] as const,
    receiverSourceOrientationId: "proper-m-00nn000p0",
  },
  {
    occurrenceOrdinal: 282,
    receiverOrdinal: 261,
    receiverCatalogPartId: "builtin:technic-brick-1x1-axle-hole",
    receiverColorId: "builtin:dark-azure",
    sourcePositionLdu: [270, -118, -96.5] as const,
    repairedPositionLdu: [270, -118, -96] as const,
    receiverSourcePositionLdu: [270, -98, -94] as const,
    receiverSourceOrientationId: "proper-m-00nn000p0",
  },
  {
    occurrenceOrdinal: 283,
    receiverOrdinal: 264,
    receiverCatalogPartId: "builtin:technic-brick-1x2-axle-hole",
    receiverColorId: "builtin:medium-azure",
    sourcePositionLdu: [340, -118, -96.5] as const,
    repairedPositionLdu: [340, -118, -96] as const,
    receiverSourcePositionLdu: [340, -98, -94] as const,
    receiverSourceOrientationId: "proper-m-00pp000p0",
  },
] as const);

export interface RealBuildPrefix50Step45OrdinalPartRow {
  readonly ordinal: number;
  readonly partId: string;
}

export interface RealBuildPrefix50Step45RelationalResolverInput {
  readonly selectedStep44Document: BrickDocumentV1;
  readonly selectedStep44EvidenceCommitment: `sha256:${string}`;
  readonly ordinalPartRows: readonly RealBuildPrefix50Step45OrdinalPartRow[];
  readonly sourceRepairs: readonly RealBuildPrefix50SourcePlacementRepairProposal[];
}

export interface RealBuildPrefix50Step45RelationalRow {
  readonly occurrenceOrdinal: 281 | 282 | 283;
  readonly receiverOrdinal: 261 | 264 | 265;
  readonly receiverPartId: string;
  readonly receiverCatalogPartId: string;
  readonly receiverTransform: RigidTransform;
  readonly candidatePortId: "axle:2";
  readonly receiverPortId: "axleHole:0";
  readonly connectionKind: "stud-tube";
  readonly candidateRosterIndex: number;
  readonly enumeratedTransform: RigidTransform;
  readonly connections: readonly {
    readonly targetPartId: string;
    readonly targetPortId: string;
    readonly candidatePortId: string;
    readonly connectionKind: "stud-tube";
  }[];
  readonly sourceToResolvedTransform: RigidTransform;
  readonly connectionWitnessCommitment: `sha256:${string}`;
  readonly candidateCommitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step45RelationalResolution {
  readonly schemaVersion: "lego.real-build-prefix50-step45-relational-resolution/1";
  readonly authority: "none";
  readonly selectionAuthority: false;
  readonly placementAuthority: false;
  readonly completionAuthority: false;
  readonly sourceSetId: "6651557";
  readonly printedStepNumber: 45;
  readonly selectedStep44EvidenceCommitment: `sha256:${string}`;
  readonly selectedStep44DocumentHash: `sha256:${string}`;
  readonly selectedStep44DocumentCommitment: `sha256:${string}`;
  readonly selectedStep44BuildStepCount: 44;
  readonly limits: {
    readonly exactDocumentPartCount: 280;
    readonly maxDocumentConnections: 4_096;
    readonly maxDistinctTransforms: 200_000;
    readonly maxRecordedWorkPerCounter: 1_000_000_000;
    readonly maxSeedReceiptRows: 64;
    readonly maxCandidateConnections: 256;
  };
  readonly ordinalPartRowsCommitment: `sha256:${string}`;
  readonly sourceRepairsCommitment: `sha256:${string}`;
  readonly query: {
    readonly schemaVersion: "lego.real-build-prefix50-step45-relational-query/1";
    readonly catalogPartId: "builtin:axle-1x3";
    readonly includeBuildPlate: false;
    readonly allowDetached: false;
    readonly maxDistinctTransforms: 200_000;
    readonly orientationIdsOmitted: true;
    readonly freshEnumeration: true;
    readonly enumerationCallCount: 1;
  };
  readonly enumeration: {
    readonly schemaVersion: typeof PLACEMENT_ENUMERATION_VERSION;
    readonly orientationIds: readonly string[];
    readonly connectorSeedReceipt: PlacementEnumeration["connectorSeedReceipt"];
    readonly counts: PlacementEnumeration["counts"];
    readonly work: PlacementEnumerationWork;
    readonly candidateRosterCommitment: `sha256:${string}`;
    readonly enumerationCommitment: `sha256:${string}`;
    readonly complete: true;
    readonly bounded: true;
  };
  readonly rows: readonly RealBuildPrefix50Step45RelationalRow[];
  readonly coherentSourceToResolvedTransform: RigidTransform;
  readonly coherentTransformCommitment: `sha256:${string}`;
  readonly combinedValidation: {
    readonly candidatePartCount: 3;
    readonly candidateConnectionCount: number;
    readonly combinedPartCount: 283;
    readonly combinedBuildStepCount: 45;
    readonly prospectivePrintedStepNumber: 45;
    readonly collisionFindingCount: 0;
    readonly blockingIssueCount: 0;
    readonly documentGloballyValid: true;
    readonly prospectiveDocumentHash: `sha256:${string}`;
  };
  readonly commitment: `sha256:${string}`;
}
