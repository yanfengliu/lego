import type { RealBuildCompiledGraphIndex } from "./real-build-compiled-placement-lineage-validation-graph";
import { validateRealBuildCompiledGraph } from "./real-build-compiled-placement-lineage-validation-graph";
import { validateRealBuildCompiledObservations } from "./real-build-compiled-placement-lineage-validation-observations";
import { validateRealBuildCompiledSearchRequest } from "./real-build-compiled-placement-lineage-validation-search-request";
import type {
  RealBuildCompiledAcceptedTransition,
  RealBuildCompiledPlacementLineageEvidence,
  RealBuildCompiledValidationEvidence,
} from "./real-build-compiled-placement-lineage-types";
import { deriveRealBuildCompiledTerminalFailureDigest } from "./real-build-compiled-placement-lineage-digest";

function exactArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameValidation(
  left: RealBuildCompiledValidationEvidence,
  right: RealBuildCompiledValidationEvidence,
): boolean {
  return (
    left.targetDocumentHash === right.targetDocumentHash &&
    left.truthSnapshotHash === right.truthSnapshotHash &&
    left.validatorSetHash === right.validatorSetHash &&
    left.documentGloballyValid === right.documentGloballyValid &&
    left.blockingIssues.length === 0 &&
    right.blockingIssues.length === 0
  );
}

function validateSelectionShape(evidence: RealBuildCompiledPlacementLineageEvidence): void {
  const selection = evidence.selection;
  const uniqueLineages = new Set(selection.selectedLineageIds);
  if (uniqueLineages.size !== selection.selectedLineageIds.length) {
    throw new TypeError("compiledLineage.selection.selectedLineageIds must be unique.");
  }
  if (selection.status === "selected") {
    if (selection.selectedCandidateId === null || selection.selectedLineageIds.length === 0) {
      throw new TypeError(
        "A selected compiledLineage.selection requires one candidate and at least one lineage.",
      );
    }
  } else if (selection.selectedCandidateId !== null || selection.selectedLineageIds.length !== 0) {
    throw new TypeError(
      "A non-selected compiledLineage.selection cannot retain a selected candidate or lineage.",
    );
  }
  if (
    selection.status === "not-applicable" &&
    (selection.decisionPanelStepNumber !== null ||
      selection.bestScore !== null ||
      selection.runnerUpScore !== null ||
      selection.margin !== null)
  ) {
    throw new TypeError(
      "A not-applicable compiledLineage.selection cannot retain a decision panel or ranking.",
    );
  }
}

function validateTopLevelStatus(evidence: RealBuildCompiledPlacementLineageEvidence): void {
  const expectedSelectionStatus =
    evidence.status === "selected"
      ? "selected"
      : evidence.status === "unresolved"
        ? "unresolved"
        : "not-applicable";
  if (evidence.selection.status !== expectedSelectionStatus) {
    throw new TypeError(
      `compiledLineage status ${evidence.status} requires selection.status ${expectedSelectionStatus}.`,
    );
  }
  if (evidence.status !== "selected" && evidence.acceptedTransition !== null) {
    throw new TypeError(
      "Only selected compiledLineage evidence may inspect a retained acceptedTransition.",
    );
  }
  if ((evidence.status === "failed") !== (evidence.terminalFailure !== null)) {
    throw new TypeError(
      "Only failed compiledLineage evidence must retain one typed terminalFailure.",
    );
  }
  if (evidence.terminalFailure !== null) {
    const { failureDigest, ...failure } = evidence.terminalFailure;
    const aggregate = evidence.terminalFailure.phase === "aggregate-evidence-closure";
    const hasProposal = evidence.terminalFailure.proposalId !== null;
    const hasOrdinal = evidence.terminalFailure.attemptedUniqueTransitionNumber !== null;
    if (
      (aggregate && (hasProposal || hasOrdinal)) ||
      (!aggregate && (!hasProposal || !hasOrdinal)) ||
      (!aggregate &&
        evidence.terminalFailure.attemptedUniqueTransitionNumber! >
          evidence.terminalFailure.uniquePhysicalTransitionCount) ||
      (evidence.terminalFailure.phase === "compilation") !==
        (evidence.terminalFailure.code === "automatic-compilation-failed") ||
      failureDigest !==
        deriveRealBuildCompiledTerminalFailureDigest({
          throughStepNumber: evidence.throughStepNumber,
          preparedStep: evidence.preparedStep,
          searchRequestPreflightIdentity: evidence.searchRequest.preflightIdentity,
          searchReservation: evidence.searchReservation,
          failure,
        })
    ) {
      throw new TypeError(
        "compiledLineage.terminalFailure does not reproduce its exact phase, context, and digest.",
      );
    }
  }
  if (evidence.status === "budget-refused") {
    if (
      evidence.searchReservation.admitted ||
      evidence.childCandidates.length !== 0 ||
      evidence.uniqueTransitions.length !== 0 ||
      evidence.lineageEdges.length !== 0 ||
      evidence.observationRefs.length !== 0
    ) {
      throw new TypeError(
        "A budget-refused compiledLineage row must retain only its refusal and root evidence.",
      );
    }
  } else if (evidence.status === "failed") {
    if (
      !evidence.searchReservation.admitted ||
      evidence.searchReservation.requested < 1 ||
      evidence.childCandidates.length !== 0 ||
      evidence.uniqueTransitions.length !== 0 ||
      evidence.lineageEdges.length !== 0 ||
      evidence.observationRefs.length !== 0
    ) {
      throw new TypeError(
        "A failed compiledLineage row must retain its admitted reservation and typed failure with no partial frontier or observations.",
      );
    }
  } else if (!evidence.searchReservation.admitted) {
    throw new TypeError(
      `compiledLineage status ${evidence.status} cannot claim a refused search reservation.`,
    );
  }
}

function validateAcceptedTransition(
  accepted: RealBuildCompiledAcceptedTransition,
  evidence: RealBuildCompiledPlacementLineageEvidence,
  graph: RealBuildCompiledGraphIndex,
): void {
  const selection = evidence.selection;
  if (
    selection.status !== "selected" ||
    selection.selectedCandidateId !== accepted.candidateId ||
    !exactArray(accepted.lineageIds, selection.selectedLineageIds)
  ) {
    throw new TypeError(
      "compiledLineage.acceptedTransition must name the exact selected candidate and lineages.",
    );
  }
  if (accepted.afterRevision === accepted.beforeRevision) {
    throw new TypeError(
      "compiledLineage.acceptedTransition.afterRevision must differ from beforeRevision.",
    );
  }
  const transitions = [];
  const expectedTransitionIds: string[] = [];
  const seenTransitionIds = new Set<string>();
  for (const lineageId of accepted.lineageIds) {
    const edge = graph.edgesByChildLineage.get(lineageId);
    if (edge === undefined) {
      throw new TypeError(
        `compiledLineage.acceptedTransition lineage ${lineageId} is not a retained child edge.`,
      );
    }
    const transition = graph.transitionsById.get(edge.transitionId)!;
    transitions.push(transition);
    if (!seenTransitionIds.has(edge.transitionId)) {
      expectedTransitionIds.push(edge.transitionId);
      seenTransitionIds.add(edge.transitionId);
    }
  }
  if (!exactArray(accepted.transitionIds, expectedTransitionIds)) {
    throw new TypeError(
      "compiledLineage.acceptedTransition.transitionIds must exactly deduplicate selected lineage transitions in order.",
    );
  }
  if (
    transitions.some(
      (transition) =>
        transition.childCandidateId !== accepted.candidateId ||
        transition.childDocumentHash !== accepted.documentHash ||
        transition.receipt.finalRevision !== accepted.afterRevision ||
        transition.receipt.canonicalStepId !== accepted.canonicalStepId ||
        transition.pieces.length !== accepted.placedPieces ||
        !sameValidation(transition.receipt.validation, accepted.validation),
    )
  ) {
    throw new TypeError(
      "compiledLineage.acceptedTransition does not reproduce every selected compiler receipt, revision, piece count, and validation.",
    );
  }
}

/** Inspection-only semantic closure; this function never accepts or completes a build. */
export function validateRealBuildCompiledPlacementLineage(
  evidence: RealBuildCompiledPlacementLineageEvidence,
): void {
  validateSelectionShape(evidence);
  validateTopLevelStatus(evidence);
  validateRealBuildCompiledSearchRequest(evidence);
  const graph = validateRealBuildCompiledGraph(evidence);
  validateRealBuildCompiledObservations(evidence, graph);
  if (evidence.acceptedTransition !== null) {
    validateAcceptedTransition(evidence.acceptedTransition, evidence, graph);
  }
}
