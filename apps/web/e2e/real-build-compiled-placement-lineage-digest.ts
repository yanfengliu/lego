import { canonicalDigest } from "@lego-studio/brick-kernel";

import type {
  RealBuildCompiledPlacementLineageEvidence,
  RealBuildCompiledSearchRequest,
  RealBuildCompiledPlacementTerminalFailure,
  RealBuildCompiledPlacementTransitionEvidence,
  RealBuildCompiledTransitionId,
} from "./real-build-compiled-placement-lineage-types";

const TRANSITION_DIGEST_SCHEMA = "lego.real-build-compiled-placement-transition/1";

/** Reproduces the private prepared-search preflight identity without granting its authority. */
export function deriveRealBuildCompiledSearchRequestPreflightIdentity(input: {
  readonly printedStepIdentity: RealBuildCompiledPlacementLineageEvidence["preparedStep"]["printedStepIdentity"];
  readonly request: Omit<RealBuildCompiledSearchRequest, "preflightIdentity">;
}) {
  return canonicalDigest({
    schemaVersion: "lego.real-build-prepared-search-preflight/1",
    printedStepIdentity: input.printedStepIdentity,
    parents: input.request.parents.map(
      ({
        parentLineageId,
        candidateId,
        documentHash,
        canonicalDocumentDigest,
        offeredLineages,
      }) => ({
        candidateId,
        documentHash,
        lineageId: parentLineageId,
        canonicalDocumentDigest,
        offeredLineages,
      }),
    ),
    proposals: input.request.proposals,
  });
}

/** Commits every retained transition field except the self-describing ID itself. */
export function deriveRealBuildCompiledTransitionId(
  transition: Omit<RealBuildCompiledPlacementTransitionEvidence, "transitionId">,
): RealBuildCompiledTransitionId {
  return `transition:${canonicalDigest({
    schemaVersion: TRANSITION_DIGEST_SCHEMA,
    parentCandidateId: transition.parentCandidateId,
    parentDocumentHash: transition.parentDocumentHash,
    childCandidateId: transition.childCandidateId,
    childDocumentHash: transition.childDocumentHash,
    printedStep: transition.printedStep,
    pieces: transition.pieces,
    receipt: transition.receipt,
  })}`;
}

export function deriveRealBuildCompiledTerminalFailureDigest(input: {
  readonly throughStepNumber: number;
  readonly preparedStep: RealBuildCompiledPlacementLineageEvidence["preparedStep"];
  readonly searchRequestPreflightIdentity: RealBuildCompiledPlacementLineageEvidence["searchRequest"]["preflightIdentity"];
  readonly searchReservation: RealBuildCompiledPlacementLineageEvidence["searchReservation"];
  readonly failure: Omit<RealBuildCompiledPlacementTerminalFailure, "failureDigest">;
}) {
  return canonicalDigest({
    schemaVersion: "lego.real-build-compiled-placement-terminal-failure-digest/1",
    throughStepNumber: input.throughStepNumber,
    preparedStep: input.preparedStep,
    searchRequestPreflightIdentity: input.searchRequestPreflightIdentity,
    searchReservation: input.searchReservation,
    failure: input.failure,
  });
}
