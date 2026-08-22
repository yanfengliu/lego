import {
  measureRealBuildAutomaticPlacementBaseWork,
  measureRealBuildAutomaticPlacementWork,
} from "./real-build-automatic-placement-work";
import type { RealBuildAutomaticPlacementWitness } from "./real-build-automatic-placement-input";
import {
  REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS,
} from "./real-build-automatic-placement-step";
import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type { RealBuildCompiledPlacementLineageEvidence } from "./real-build-compiled-placement-lineage-types";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS } from "./real-build-prepared-search-plan";

export interface RealBuildCompiledPlacementLineageReplayWork {
  readonly compilerReplayOperations: number;
  readonly compilerGraphVisits: number;
  readonly compilerByteVisits: number;
}

interface RootWork {
  readonly snapshot: ReturnType<typeof createRealBuildCandidateDocumentSnapshot>;
  readonly base: ReturnType<typeof measureRealBuildAutomaticPlacementBaseWork>;
}

function safeAdd(label: string, total: number, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || total > Number.MAX_SAFE_INTEGER - value) {
    throw new RangeError(`Compiled lineage ${label} exceeds the safe-integer work boundary.`);
  }
  return total + value;
}

function compilerWitnesses(
  pieces: RealBuildCompiledPlacementLineageEvidence["uniqueTransitions"][number]["pieces"],
): readonly RealBuildAutomaticPlacementWitness[] {
  return pieces.map(({ catalogPartId, colorId, transform, connections }) => ({
    catalogPartId,
    colorId,
    transform,
    connections,
  }));
}

/**
 * Reconstructs each bounded root once for admission-work measurement, then
 * measures every compiler replay attempt using the same conservative
 * work-policy estimator as the compiler.
 */
export function measureRealBuildCompiledPlacementLineageReplayWork(
  evidence: RealBuildCompiledPlacementLineageEvidence,
): RealBuildCompiledPlacementLineageReplayWork {
  const rootsByCandidate = new Map<string, RootWork>();
  const rootsByLineage = new Map<string, RootWork>();
  for (const [index, group] of evidence.rootCandidates.entries()) {
    const path = `compiledLineage.rootCandidates[${index}]`;
    if (rootsByCandidate.has(group.candidateId)) {
      throw new TypeError(`${path}.candidateId duplicates an earlier root candidate.`);
    }
    const snapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: group.canonicalBytes,
      expectedDocumentHash: group.documentHash,
    });
    if (
      snapshot.canonicalBytesHash !== group.canonicalBytesHash ||
      snapshot.canonicalByteLength !== group.canonicalByteLength
    ) {
      throw new TypeError(`${path} canonical byte hash or UTF-8 length does not reproduce.`);
    }
    const root = Object.freeze({
      snapshot,
      base: measureRealBuildAutomaticPlacementBaseWork(
        snapshot.document,
        snapshot.canonicalByteLength,
      ),
    });
    rootsByCandidate.set(group.candidateId, root);
    for (const [identityIndex, identity] of group.identities.entries()) {
      if (rootsByLineage.has(identity.lineageId)) {
        throw new TypeError(`${path}.identities[${identityIndex}].lineageId is duplicated.`);
      }
      rootsByLineage.set(identity.lineageId, root);
    }
  }

  let compilerReplayOperations = 0;
  let compilerGraphVisits = 0;
  let compilerByteVisits = 0;
  const chargeAttempt = (
    root: RootWork | undefined,
    printedStep: RealBuildCompiledPlacementLineageEvidence["preparedStep"]["compilerMetadata"],
    pieces: RealBuildCompiledPlacementLineageEvidence["uniqueTransitions"][number]["pieces"],
    path: string,
  ): void => {
    if (root === undefined) {
      throw new TypeError(`${path} does not name a retained root candidate.`);
    }
    const work = measureRealBuildAutomaticPlacementWork({
      base: root.base,
      printedStepNumber: evidence.throughStepNumber,
      printedStep,
      witnesses: compilerWitnesses(pieces),
    });
    compilerReplayOperations = safeAdd(
      "compiler replay-operation count",
      compilerReplayOperations,
      work.combinedOperations,
    );
    compilerGraphVisits = safeAdd(
      "compiler graph-visit count",
      compilerGraphVisits,
      work.graphVisits,
    );
    compilerByteVisits = safeAdd("compiler byte-visit count", compilerByteVisits, work.byteVisits);
  };

  for (const [index, transition] of evidence.uniqueTransitions.entries()) {
    chargeAttempt(
      rootsByCandidate.get(transition.parentCandidateId),
      transition.printedStep,
      transition.pieces,
      `compiledLineage.uniqueTransitions[${index}].parentCandidateId`,
    );
  }
  if (evidence.terminalFailure?.code === "automatic-compilation-failed") {
    const proposal = evidence.searchRequest.proposals.find(
      ({ proposalId }) => proposalId === evidence.terminalFailure!.proposalId,
    );
    if (proposal === undefined) {
      throw new TypeError(
        "compiledLineage.terminalFailure.proposalId does not name a retained search proposal.",
      );
    }
    chargeAttempt(
      rootsByLineage.get(proposal.parentLineageId),
      evidence.preparedStep.compilerMetadata,
      proposal.pieces,
      "compiledLineage.terminalFailure proposal parentLineageId",
    );
  }

  return Object.freeze({
    compilerReplayOperations,
    compilerGraphVisits,
    compilerByteVisits,
  });
}

export function requireRealBuildCompiledPlacementLineageReplayWorkWithinLimits(
  work: RealBuildCompiledPlacementLineageReplayWork,
): void {
  const bounds = [
    [
      "compiler replay operations",
      work.compilerReplayOperations,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS,
    ],
    [
      "compiler graph-visit work-policy units",
      work.compilerGraphVisits,
      REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS,
    ],
    [
      "compiler byte-visit work-policy units",
      work.compilerByteVisits,
      REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS,
    ],
  ] as const;
  const exceeded = bounds.find(([, value, maximum]) => value > maximum);
  if (exceeded !== undefined) {
    throw new RangeError(
      `Compiled lineage replay preflight aggregates ${exceeded[1]} ${exceeded[0]}; maximum is ${exceeded[2]}. Split or refuse the retained search before compiler replay.`,
    );
  }
}
