import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type {
  RealBuildDocumentCandidateId,
  RealBuildLineageId,
  RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import type { RealBuildPreparedPlacementWitness } from "./real-build-prepared-search-boundary";

export const REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_SCHEMA_VERSION =
  "lego.real-build-compiled-placement-lineage/1" as const;

export const MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES = 64 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_DEPTH = 128;
export const MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_JSON_VALUES = 2_000_000;
export const MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROOTS = 8_192;
export const MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_TRANSITIONS = 8_192;
export const MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_EDGES = 8_192;
export const MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_OBSERVATIONS = 800_000;
export const MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_MASK_PIXELS = 16_777_216;
export const MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROLE_BYTES = 512 * 1024 * 1024;

export type RealBuildCompiledPlacementLineageStatus =
  "selected" | "unresolved" | "failed" | "budget-refused";

export interface RealBuildCompiledPreparedStepEvidence {
  readonly preparedRunInputDigest: Sha256Digest;
  readonly printedStepIdentity: Sha256Digest;
  readonly actionEvidenceDigest: Sha256Digest;
  readonly compilerMetadata: {
    readonly name: string;
    readonly sourceActionDigest: Sha256Digest;
  };
}

/** One parent of this one-step subgraph; its global lineage may itself be a descendant. */
export interface RealBuildCompiledLineageRootCandidate {
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
  readonly identities: readonly RealBuildLineageIdentity[];
  readonly canonicalBytes: string;
  readonly canonicalBytesHash: Sha256Digest;
  readonly canonicalByteLength: number;
}

/** Exact canonical child bytes shared by every convergent edge that reaches this document. */
export interface RealBuildCompiledLineageChildCandidate {
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
  readonly canonicalBytes: string;
  readonly canonicalBytesHash: Sha256Digest;
  readonly canonicalByteLength: number;
}

export interface RealBuildCompiledSearchReservation {
  readonly budget: number;
  readonly reservedBefore: number;
  readonly requested: number;
  readonly reservedAfter: number;
  readonly reservationNumber: number;
  readonly admitted: boolean;
  readonly refusal: null | "budget-exceeded" | "ledger-already-refused";
  readonly terminalFailure: {
    readonly preflightIdentity: Sha256Digest;
    readonly reservationNumber: number;
    readonly reservedBefore: number;
    readonly requested: number;
    readonly budget: number;
  } | null;
}

export interface RealBuildCompiledSearchRequestParent {
  readonly parentLineageId: RealBuildLineageId;
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
  readonly canonicalDocumentDigest: Sha256Digest;
  readonly offeredLineages: number;
}

export interface RealBuildCompiledSearchRequestProposal {
  readonly proposalId: Sha256Digest;
  readonly parentLineageId: RealBuildLineageId;
  readonly pieces: readonly RealBuildPreparedPlacementWitness[];
  readonly connectionCount: number;
  readonly programOperationCount: number;
}

/** Exact ordered prepared-search preflight retained even when execution has no frontier. */
export interface RealBuildCompiledSearchRequest {
  readonly preflightIdentity: Sha256Digest;
  readonly parents: readonly RealBuildCompiledSearchRequestParent[];
  readonly proposals: readonly RealBuildCompiledSearchRequestProposal[];
  readonly offeredLineages: number;
  readonly witnessCount: number;
  readonly connectionCount: number;
  readonly programOperationCount: number;
}

export interface RealBuildCompiledPlacementTerminalFailure {
  readonly schemaVersion: "lego.real-build-compiled-placement-terminal-failure/1";
  readonly proposalId: Sha256Digest | null;
  readonly phase: "compilation" | "evidence-closure" | "aggregate-evidence-closure";
  readonly code: "automatic-compilation-failed" | "compiled-evidence-closure-failed";
  readonly attemptedUniqueTransitionNumber: number | null;
  readonly uniquePhysicalTransitionCount: number;
  readonly issue: {
    readonly code: string;
    readonly path: string;
    readonly reason: string;
  };
  readonly failureDigest: Sha256Digest;
}

export interface RealBuildCompiledValidationEvidence {
  readonly targetDocumentHash: Sha256Digest;
  readonly truthSnapshotHash: Sha256Digest;
  readonly validatorSetHash: Sha256Digest;
  readonly documentGloballyValid: true;
  readonly blockingIssues: readonly [];
}

/** Projected receipt fields required to reproduce the full automatic compiler result later. */
export interface RealBuildCompiledAutomaticReceiptEvidence {
  readonly schemaVersion: "lego.real-build-automatic-placement-receipt/1";
  readonly compilerSnapshotHash: Sha256Digest;
  readonly compilerInputDigest: Sha256Digest;
  readonly programHash: Sha256Digest;
  readonly placementProgramHash: Sha256Digest;
  readonly jobId: string;
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly baseCanonicalBytesHash: Sha256Digest;
  readonly baseCanonicalByteLength: number;
  readonly baseDocumentHash: Sha256Digest;
  readonly printedStepNumber: number;
  readonly canonicalStepId: string;
  readonly finalDocumentHash: Sha256Digest;
  readonly finalRevision: string;
  readonly validation: RealBuildCompiledValidationEvidence;
}

export type RealBuildCompiledTransitionId = `transition:sha256:${string}`;

/** One unique document transition; several lineage edges may converge through it. */
export interface RealBuildCompiledPlacementTransitionEvidence {
  readonly transitionId: RealBuildCompiledTransitionId;
  readonly parentCandidateId: RealBuildDocumentCandidateId;
  readonly parentDocumentHash: Sha256Digest;
  readonly childCandidateId: RealBuildDocumentCandidateId;
  readonly childDocumentHash: Sha256Digest;
  readonly printedStep: {
    readonly name: string;
    readonly sourceActionDigest: Sha256Digest;
  };
  readonly pieces: readonly RealBuildPreparedPlacementWitness[];
  readonly receipt: RealBuildCompiledAutomaticReceiptEvidence;
}

export interface RealBuildCompiledLineageEdge {
  readonly parentLineageId: RealBuildLineageId;
  readonly proposalId: Sha256Digest;
  readonly child: RealBuildLineageIdentity;
  readonly transitionId: RealBuildCompiledTransitionId;
}

export interface RealBuildCompiledObservationByteReference {
  readonly role: "branch-observation-bytes";
  readonly offset: number;
  readonly bytes: number;
  readonly digest: Sha256Digest;
  readonly encoding: "packed-binary-mask-msb/1";
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface RealBuildCompiledObservationByteRole {
  readonly role: "branch-observation-bytes";
  readonly bytes: number;
  readonly digest: Sha256Digest;
}

export type RealBuildCompiledObservationStatus = "scored" | "not-observable" | "failed";

export interface RealBuildCompiledObservationReference {
  readonly observationId: string;
  readonly lineageId: RealBuildLineageId;
  readonly sourceEvidenceId: string;
  readonly cameraEvidenceId: string | null;
  readonly registrationPanelStepNumber: number;
  readonly status: RealBuildCompiledObservationStatus;
  readonly score: number | null;
  readonly sourceMask: RealBuildCompiledObservationByteReference | null;
  readonly candidateMask: RealBuildCompiledObservationByteReference | null;
  readonly excludedMask: RealBuildCompiledObservationByteReference | null;
}

export interface RealBuildCompiledLineageSelection {
  readonly status: "not-applicable" | "selected" | "unresolved";
  /** Exact later booklet panel whose scored observations participate in this decision. */
  readonly decisionPanelStepNumber: number | null;
  readonly selectedCandidateId: RealBuildDocumentCandidateId | null;
  readonly selectedLineageIds: readonly RealBuildLineageId[];
  readonly bestScore: number | null;
  readonly runnerUpScore: number | null;
  readonly margin: number | null;
}

/** Browser-local accepted-transition facts; never user-document or completion authority. */
export interface RealBuildCompiledAcceptedTransition {
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
  readonly lineageIds: readonly RealBuildLineageId[];
  readonly transitionIds: readonly RealBuildCompiledTransitionId[];
  readonly beforeRevision: string;
  readonly afterRevision: string;
  readonly canonicalStepId: string;
  readonly placedPieces: number;
  readonly validation: RealBuildCompiledValidationEvidence;
}

export interface RealBuildCompiledPlacementLineageEvidence {
  readonly schemaVersion: typeof REAL_BUILD_COMPILED_PLACEMENT_LINEAGE_SCHEMA_VERSION;
  readonly status: RealBuildCompiledPlacementLineageStatus;
  readonly throughStepNumber: number;
  readonly preparedStep: RealBuildCompiledPreparedStepEvidence;
  readonly rootCandidates: readonly RealBuildCompiledLineageRootCandidate[];
  readonly searchRequest: RealBuildCompiledSearchRequest;
  readonly searchReservation: RealBuildCompiledSearchReservation;
  readonly terminalFailure: RealBuildCompiledPlacementTerminalFailure | null;
  readonly childCandidates: readonly RealBuildCompiledLineageChildCandidate[];
  readonly uniqueTransitions: readonly RealBuildCompiledPlacementTransitionEvidence[];
  readonly lineageEdges: readonly RealBuildCompiledLineageEdge[];
  readonly observationBytes: RealBuildCompiledObservationByteRole | null;
  readonly observationRefs: readonly RealBuildCompiledObservationReference[];
  readonly selection: RealBuildCompiledLineageSelection;
  readonly acceptedTransition: RealBuildCompiledAcceptedTransition | null;
  readonly completionAuthority: {
    readonly status: "absent";
    readonly authorized: false;
    readonly reason: "compiled-placement-lineage-is-inspection-only";
  };
}
