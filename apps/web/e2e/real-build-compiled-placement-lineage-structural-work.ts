import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { RealBuildCompiledPlacementLineageEvidence } from "./real-build-compiled-placement-lineage-types";
import { preparedSearchUtf8ByteLength } from "./real-build-prepared-search-boundary";

export interface RealBuildCompiledPlacementLineageWork {
  readonly rootCandidateGroups: number;
  readonly rootLineages: number;
  readonly childCandidates: number;
  readonly uniqueTransitions: number;
  readonly lineageEdges: number;
  readonly searchProposals: number;
  readonly searchParents: number;
  readonly placementWitnesses: number;
  readonly placementProgramOperations: number;
  readonly transitionPlacementWitnesses: number;
  readonly transitionPlacementProgramOperations: number;
  readonly legacyObservations: number;
  readonly rootCanonicalDocumentBytes: number;
  readonly childCanonicalDocumentBytes: number;
}

export function measureRealBuildCompiledPlacementLineageStructuralWork(
  evidence: RealBuildCompiledPlacementLineageEvidence,
): RealBuildCompiledPlacementLineageWork {
  let placementWitnesses = 0;
  let placementProgramOperations = 0;
  for (let index = 0; index < evidence.searchRequest.proposals.length; index += 1) {
    const proposal = evidence.searchRequest.proposals[index]!;
    placementWitnesses += proposal.pieces.length;
    placementProgramOperations += proposal.pieces.reduce(
      (total, piece) => total + 1 + piece.connections.length,
      0,
    );
  }
  let transitionPlacementWitnesses = 0;
  let transitionPlacementProgramOperations = 0;
  for (let index = 0; index < evidence.uniqueTransitions.length; index += 1) {
    const transition = evidence.uniqueTransitions[index]!;
    transitionPlacementWitnesses += transition.pieces.length;
    transitionPlacementProgramOperations += transition.pieces.reduce(
      (total, piece) => total + 1 + piece.connections.length,
      0,
    );
  }
  return intrinsicRealBuildFreeze({
    rootCandidateGroups: evidence.rootCandidates.length,
    rootLineages: evidence.rootCandidates.reduce(
      (total, candidate) => total + candidate.identities.length,
      0,
    ),
    childCandidates: evidence.childCandidates.length,
    uniqueTransitions: evidence.uniqueTransitions.length,
    lineageEdges: evidence.lineageEdges.length,
    searchProposals: evidence.searchRequest.proposals.length,
    searchParents: evidence.searchRequest.parents.length,
    placementWitnesses,
    placementProgramOperations,
    transitionPlacementWitnesses,
    transitionPlacementProgramOperations,
    legacyObservations: evidence.observationRefs.length,
    rootCanonicalDocumentBytes: evidence.rootCandidates.reduce(
      (total, candidate) =>
        total + preparedSearchUtf8ByteLength(candidate.canonicalBytes, Number.MAX_SAFE_INTEGER),
      0,
    ),
    childCanonicalDocumentBytes: evidence.childCandidates.reduce(
      (total, candidate) =>
        total + preparedSearchUtf8ByteLength(candidate.canonicalBytes, Number.MAX_SAFE_INTEGER),
      0,
    ),
  });
}
