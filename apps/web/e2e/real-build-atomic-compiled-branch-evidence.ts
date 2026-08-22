import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { RealBuildAtomicCompiledBranchBatchPreparation } from "./real-build-atomic-compiled-branch-batch-input";
import { realBuildDocumentCandidateId } from "./real-build-candidate-lineage-identity";
import type {
  RealBuildCompiledPlacementLineageEvidence,
  RealBuildCompiledPlacementTerminalFailure,
  RealBuildCompiledSearchRequest,
} from "./real-build-compiled-placement-lineage-types";
import type { RealBuildPreparedSearchReservation } from "./real-build-prepared-search-ledger";

const COMPLETION_AUTHORITY = intrinsicRealBuildFreeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "compiled-placement-lineage-is-inspection-only" as const,
});

function rootCandidates(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
): RealBuildCompiledPlacementLineageEvidence["rootCandidates"] {
  return intrinsicRealBuildFreeze(
    preparation.rootCandidates.map(({ documentSnapshot: snapshot, identities }) =>
      intrinsicRealBuildFreeze({
        candidateId: realBuildDocumentCandidateId(snapshot.documentHash),
        documentHash: snapshot.documentHash,
        identities,
        canonicalBytes: snapshot.canonicalBytes,
        canonicalBytesHash: snapshot.canonicalBytesHash,
        canonicalByteLength: snapshot.canonicalByteLength,
      }),
    ),
  );
}

export function preparedStepEvidence(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
): RealBuildCompiledPlacementLineageEvidence["preparedStep"] {
  return intrinsicRealBuildFreeze({
    preparedRunInputDigest: preparation.preparedStep.preparedRunInputDigest,
    printedStepIdentity: preparation.preparedStep.printedStepIdentity,
    actionEvidenceDigest: preparation.printedStep.sourceActionDigest,
    compilerMetadata: preparation.printedStep,
  });
}

function searchRequest(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
): RealBuildCompiledSearchRequest {
  const inspection = preparation.searchInspection;
  return intrinsicRealBuildFreeze({
    preflightIdentity: inspection.preflightIdentity,
    parents: intrinsicRealBuildFreeze(
      inspection.parentBindings.map((binding) =>
        intrinsicRealBuildFreeze({
          parentLineageId: binding.parentLineageId,
          candidateId: binding.identity.candidateId,
          documentHash: binding.identity.documentHash,
          canonicalDocumentDigest: binding.canonicalDocumentDigest,
          offeredLineages: binding.offeredLineages,
        }),
      ),
    ),
    proposals: inspection.proposals,
    offeredLineages: inspection.offeredLineages,
    witnessCount: inspection.witnessCount,
    connectionCount: inspection.connectionCount,
    programOperationCount: inspection.programOperationCount,
  });
}

export function emptyDecision(status: "unresolved" | "not-applicable") {
  return intrinsicRealBuildFreeze({
    status,
    decisionPanelStepNumber: null,
    selectedCandidateId: null,
    selectedLineageIds: intrinsicRealBuildFreeze([]),
    bestScore: null,
    runnerUpScore: null,
    margin: null,
  });
}

export function evidenceBase(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  reservation: RealBuildPreparedSearchReservation,
) {
  return {
    schemaVersion: "lego.real-build-compiled-placement-lineage/1" as const,
    throughStepNumber: preparation.preparedStep.stepNumber,
    preparedStep: preparedStepEvidence(preparation),
    rootCandidates: rootCandidates(preparation),
    searchRequest: searchRequest(preparation),
    searchReservation: reservation,
    observationBytes: null,
    observationRefs: intrinsicRealBuildFreeze([]),
    acceptedTransition: null,
    completionAuthority: COMPLETION_AUTHORITY,
  };
}

export function failedEvidence(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  reservation: RealBuildPreparedSearchReservation,
  failure: RealBuildCompiledPlacementTerminalFailure,
): RealBuildCompiledPlacementLineageEvidence {
  return {
    ...evidenceBase(preparation, reservation),
    status: "failed",
    terminalFailure: failure,
    childCandidates: intrinsicRealBuildFreeze([]),
    uniqueTransitions: intrinsicRealBuildFreeze([]),
    lineageEdges: intrinsicRealBuildFreeze([]),
    selection: emptyDecision("not-applicable"),
  };
}

export function budgetRefusedEvidence(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  reservation: RealBuildPreparedSearchReservation,
): RealBuildCompiledPlacementLineageEvidence {
  return {
    ...evidenceBase(preparation, reservation),
    status: "budget-refused",
    terminalFailure: null,
    childCandidates: intrinsicRealBuildFreeze([]),
    uniqueTransitions: intrinsicRealBuildFreeze([]),
    lineageEdges: intrinsicRealBuildFreeze([]),
    selection: emptyDecision("not-applicable"),
  };
}
