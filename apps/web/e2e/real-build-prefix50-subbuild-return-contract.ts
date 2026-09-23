import type { BrickDocumentV1, BuildOperation, RigidTransform } from "@lego-studio/protocol";

import type {
  RigidSubassemblyReturnEnumeration,
  RigidSubassemblyReturnWorkLimits,
} from "../src/assembly/rigid-subassembly-return";
import type {
  RealBuildPrefix50ChildSubBuildWindow,
  RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import type { RealBuildPrefix50Step42_43SourceRepairProof } from "./real-build-prefix50-step42-43-source-repair-contract";

export const REAL_BUILD_PREFIX50_SUBBUILD_RETURN_CHILD_PATH = [
  "7004cf0d-d97f-4b0d-8572-970e23815c05",
  "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
] as const;

export const REAL_BUILD_PREFIX50_SUBBUILD_RETURN_MEMBERS = [
  [258, 38, 64, 1],
  [259, 38, 64, 2],
  [260, 39, 65, 1],
  [261, 39, 65, 2],
  [262, 39, 65, 3],
  [263, 39, 65, 4],
  [264, 39, 65, 5],
  [265, 39, 65, 6],
  [266, 40, 66, 1],
  [267, 40, 66, 2],
  [268, 40, 66, 3],
  [269, 40, 66, 4],
  [270, 41, 67, 1],
  [271, 41, 67, 2],
  [272, 41, 67, 3],
  [273, 41, 67, 4],
  [274, 42, 68, 1],
  [275, 42, 68, 2],
  [276, 42, 68, 3],
  [277, 43, 69, 1],
  [278, 43, 70, 1],
  [279, 43, 70, 2],
  [280, 43, 71, 1],
] as const;

export { REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS } from "./real-build-prefix50-subbuild-return-work-limits.ts";

export interface RealBuildPrefix50Step43CombinedDraft {
  readonly schemaVersion: "lego.real-build-prefix50-step43-combined-draft/1";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly completedPrintedStep: 43;
  readonly documentHash: `sha256:${string}`;
  readonly document: BrickDocumentV1;
}

/** Opaque runtime identity minted only at the exact loop's completed Step-43 boundary. */
export interface RealBuildPrefix50Step43ReturnPredecessor {
  readonly schemaVersion: "lego.real-build-prefix50-step43-return-predecessor/1";
}

export interface RealBuildPrefix50Step43ReturnPredecessorMintInput {
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly window: RealBuildPrefix50ChildSubBuildWindow;
  readonly combinedDraft: RealBuildPrefix50Step43CombinedDraft;
  readonly ordinalPartRows: readonly RealBuildPrefix50SubBuildReturnPartRow[];
  readonly detachedStateCommitment: `sha256:${string}`;
  readonly step42_43SourceRepairProof: RealBuildPrefix50Step42_43SourceRepairProof;
}

export interface RealBuildPrefix50SubBuildReturnPartRow {
  readonly ordinal: number;
  readonly partId: string;
}

export interface RealBuildPrefix50SubBuildReturnInput {
  readonly predecessor: RealBuildPrefix50Step43ReturnPredecessor;
}

export interface RealBuildPrefix50SubBuildReturnCandidateDescriptor {
  readonly candidateKey: string;
  readonly groupDelta: RigidTransform;
  readonly crossPorts: readonly {
    readonly aPartId: string;
    readonly aPortId: string;
    readonly bPartId: string;
    readonly bPortId: string;
  }[];
}

export interface RealBuildPrefix50SubBuildReturnResult {
  readonly schemaVersion: "lego.real-build-prefix50-subbuild-return/1";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly completedPrintedStep: 43;
  readonly returnPrintedStepNumber: 44;
  readonly projectionCommitment: `sha256:${string}`;
  readonly childSubBuildWindowCommitment: `sha256:${string}`;
  readonly sourceMemberRowsCommitment: `sha256:${string}`;
  readonly detachedStateCommitment: `sha256:${string}`;
  readonly step42_43RepairCommitment: `sha256:${string}`;
  readonly step43PredecessorCommitment: `sha256:${string}`;
  readonly sourceDocumentHash: `sha256:${string}`;
  readonly parentPartCount: 257;
  readonly childPartCount: 23;
  readonly workLimits: RigidSubassemblyReturnWorkLimits;
  readonly enumeration: RigidSubassemblyReturnEnumeration;
  readonly candidateRoster: readonly RealBuildPrefix50SubBuildReturnCandidateDescriptor[];
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope {
  readonly schemaVersion: "lego.real-build-prefix50-subbuild-return-review-harness-input/2";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly projectionCommitment: `sha256:${string}`;
  readonly childSubBuildWindowCommitment: `sha256:${string}`;
  readonly sourceMemberRowsCommitment: `sha256:${string}`;
  readonly detachedStateCommitment: `sha256:${string}`;
  readonly step42_43RepairCommitment: `sha256:${string}`;
  readonly step43PredecessorCommitment: `sha256:${string}`;
  readonly sourceDocumentHash: `sha256:${string}`;
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly selectedDocument: BrickDocumentV1;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50SubBuildReturnReviewRosterSummaryCandidate extends RealBuildPrefix50SubBuildReturnCandidateDescriptor {
  readonly rosterIndex: number;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
}

export interface RealBuildPrefix50SubBuildReturnReviewRosterSummary {
  readonly schemaVersion: "lego.real-build-prefix50-subbuild-return-review-roster/1";
  readonly authority: "none";
  readonly selectionAuthority: false;
  readonly fixturePromotionAuthority: false;
  readonly sourceSetId: "6651557";
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly sourceDocumentHash: `sha256:${string}`;
  readonly enumerationComplete: true;
  readonly candidateCount: number;
  readonly candidates: readonly RealBuildPrefix50SubBuildReturnReviewRosterSummaryCandidate[];
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-subbuild-return-review-enumeration-receipt/1";
  readonly enumerationSchemaVersion: RigidSubassemblyReturnEnumeration["schemaVersion"];
  readonly sourceDocumentHash: `sha256:${string}`;
  readonly childPartIds: readonly string[];
  readonly workLimits: RigidSubassemblyReturnEnumeration["workLimits"];
  readonly counts: RigidSubassemblyReturnEnumeration["counts"];
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50SubBuildReturnCompactReviewCandidate {
  readonly candidateKey: string;
  readonly rosterIndex: number;
  readonly operations: readonly BuildOperation[];
  readonly operationsCommitment: `sha256:${string}`;
  readonly selectedDocumentRevision: string;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50SubBuildReturnReviewBatchEnvelope {
  readonly schemaVersion: "lego.real-build-prefix50-subbuild-return-review-batch-input/2";
  readonly authority: "none";
  readonly selectionAuthority: false;
  readonly fixturePromotionAuthority: false;
  readonly sourceSetId: "6651557";
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly projectionCommitment: `sha256:${string}`;
  readonly childSubBuildWindowCommitment: `sha256:${string}`;
  readonly sourceMemberRowsCommitment: `sha256:${string}`;
  readonly detachedStateCommitment: `sha256:${string}`;
  readonly step42_43RepairCommitment: `sha256:${string}`;
  readonly step43PredecessorCommitment: `sha256:${string}`;
  readonly sourceDocumentHash: `sha256:${string}`;
  readonly reviewReplayBaseRevisionPolicy: "synthetic-structural-source-v1";
  readonly reviewReplayBaseDocumentCommitment: `sha256:${string}`;
  readonly reviewReplayBaseDocument: BrickDocumentV1;
  readonly enumerationReceipt: RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt;
  readonly ordering: "candidate-key-lexicographic";
  readonly candidateCount: number;
  readonly candidateKeysCommitment: `sha256:${string}`;
  readonly rosterSummary: RealBuildPrefix50SubBuildReturnReviewRosterSummary;
  readonly candidates: readonly RealBuildPrefix50SubBuildReturnCompactReviewCandidate[];
  readonly commitment: `sha256:${string}`;
}

export type RealBuildPrefix50SubBuildReturnErrorCode =
  "AMBIGUOUS_RETURN_REQUIRES_VISUAL_BINDING" | "NO_HARD_VALID_RETURN";

export class RealBuildPrefix50SubBuildReturnError extends TypeError {
  public constructor(
    public readonly code: RealBuildPrefix50SubBuildReturnErrorCode,
    message: string,
    public readonly result: RealBuildPrefix50SubBuildReturnResult,
  ) {
    super(message);
    this.name = "RealBuildPrefix50SubBuildReturnError";
  }
}

export interface RealBuildPrefix50ReviewedVisualBinding {
  readonly schemaVersion: "lego.real-build-prefix50-reviewed-return-visual-binding/4";
  readonly sourceSetId: "6651557";
  readonly repositoryReviewCommitment: `sha256:${string}`;
  readonly artifactVerificationCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly projectionCommitment: `sha256:${string}`;
  readonly childSubBuildWindowCommitment: `sha256:${string}`;
  readonly sourceMemberRowsCommitment: `sha256:${string}`;
  readonly detachedStateCommitment: `sha256:${string}`;
  readonly step42_43RepairCommitment: `sha256:${string}`;
  readonly step43PredecessorCommitment: `sha256:${string}`;
  readonly sourceDocumentHash: `sha256:${string}`;
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly blindReviewPacketCommitment: `sha256:${string}`;
  readonly publicHarnessSuccessCommitment: `sha256:${string}`;
  readonly laneCommitments: readonly [`sha256:${string}`, `sha256:${string}`];
  readonly fullResolutionOutcomeCommitment: `sha256:${string}`;
  readonly blindReviewClosureCommitment: `sha256:${string}`;
  readonly publicPixelVerificationCommitment: `sha256:${string}`;
  readonly withheldUnblindingMapCommitment: `sha256:${string}`;
  readonly selectedMapRowCommitment: `sha256:${string}`;
  readonly reviewBatchEnvelopeCommitment: `sha256:${string}`;
  readonly allSixCriteriaSame: true;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50SelectedSubBuildReturn {
  readonly schemaVersion: "lego.real-build-prefix50-selected-subbuild-return/1";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly returnResultCommitment: `sha256:${string}`;
  readonly reviewedVisualBinding: RealBuildPrefix50ReviewedVisualBinding;
  readonly candidateKey: string;
  readonly groupDelta: RigidTransform;
  readonly crossPorts: RealBuildPrefix50SubBuildReturnCandidateDescriptor["crossPorts"];
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocument: BrickDocumentV1;
  readonly commitment: `sha256:${string}`;
}
