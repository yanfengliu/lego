import { canonicalStringify } from "@lego-studio/brick-kernel";

import { compileRealBuildAutomaticPlacement } from "./real-build-automatic-placement-compiler";
import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import { deriveRealBuildCompiledSearchRequestPreflightIdentity } from "./real-build-compiled-placement-lineage-digest";
import type { RealBuildCompiledPlacementLineageEvidence } from "./real-build-compiled-placement-lineage-types";
import {
  deriveRealBuildPreparedSearchCanonicalDocumentDigest,
  deriveRealBuildPreparedSearchProposalId,
} from "./real-build-prepared-search-digest";

/** Rebuilds the complete ordered request that existed before reservation or compilation. */
export function validateRealBuildCompiledSearchRequest(
  evidence: RealBuildCompiledPlacementLineageEvidence,
): void {
  const roots = new Map<
    string,
    {
      readonly group: RealBuildCompiledPlacementLineageEvidence["rootCandidates"][number];
    }
  >();
  evidence.rootCandidates.forEach((group) => {
    group.identities.forEach((identity) => roots.set(identity.lineageId, { group }));
  });

  const request = evidence.searchRequest;
  if (
    evidence.preparedStep.compilerMetadata.sourceActionDigest !==
    evidence.preparedStep.actionEvidenceDigest
  ) {
    throw new TypeError(
      "compiledLineage.preparedStep.compilerMetadata.sourceActionDigest must equal actionEvidenceDigest.",
    );
  }
  if (request.parents.length !== roots.size) {
    throw new TypeError(
      "compiledLineage.searchRequest.parents must retain every exact local root lineage once.",
    );
  }
  const requestParents = new Map<
    string,
    {
      readonly group: RealBuildCompiledPlacementLineageEvidence["rootCandidates"][number];
      readonly row: RealBuildCompiledPlacementLineageEvidence["searchRequest"]["parents"][number];
    }
  >();
  for (let index = 0; index < request.parents.length; index += 1) {
    const row = request.parents[index]!;
    const path = `compiledLineage.searchRequest.parents[${index}]`;
    const root = roots.get(row.parentLineageId);
    if (root === undefined || requestParents.has(row.parentLineageId)) {
      throw new TypeError(`${path} must name one previously unlisted retained root lineage.`);
    }
    const expectedDigest = deriveRealBuildPreparedSearchCanonicalDocumentDigest(
      root.group.canonicalBytesHash,
    );
    if (
      row.candidateId !== root.group.candidateId ||
      row.documentHash !== root.group.documentHash ||
      row.canonicalDocumentDigest !== expectedDigest
    ) {
      throw new TypeError(
        `${path} does not bind its exact grouped root candidate, document hash, and canonical bytes.`,
      );
    }
    requestParents.set(row.parentLineageId, { ...root, row });
  }

  const proposalIds = new Set<string>();
  const offeredByParent = new Map<string, number>();
  const physicalRootBytes = new Map<string, string>();
  const uniquePhysicalProposalIds: string[] = [];
  let witnessCount = 0;
  let connectionCount = 0;
  let programOperationCount = 0;
  for (let index = 0; index < request.proposals.length; index += 1) {
    const proposal = request.proposals[index]!;
    const path = `compiledLineage.searchRequest.proposals[${index}]`;
    const parent = requestParents.get(proposal.parentLineageId);
    if (parent === undefined)
      throw new TypeError(`${path}.parentLineageId is not a request parent.`);
    const expectedId = deriveRealBuildPreparedSearchProposalId({
      printedStepIdentity: evidence.preparedStep.printedStepIdentity,
      parentLineageId: proposal.parentLineageId,
      canonicalDocumentDigest: parent.row.canonicalDocumentDigest,
      pieces: proposal.pieces,
    });
    if (proposal.proposalId !== expectedId || proposalIds.has(proposal.proposalId)) {
      throw new TypeError(
        `${path}.proposalId is duplicated or does not reproduce its exact request.`,
      );
    }
    const measuredConnections = proposal.pieces.reduce(
      (total, piece) => total + piece.connections.length,
      0,
    );
    if (
      proposal.connectionCount !== measuredConnections ||
      proposal.programOperationCount !== proposal.pieces.length + measuredConnections
    ) {
      throw new TypeError(
        `${path} operation counts do not reproduce its exact placement witnesses.`,
      );
    }
    proposalIds.add(proposal.proposalId);
    offeredByParent.set(
      proposal.parentLineageId,
      (offeredByParent.get(proposal.parentLineageId) ?? 0) + 1,
    );
    witnessCount += proposal.pieces.length;
    connectionCount += measuredConnections;
    programOperationCount += proposal.programOperationCount;

    const physicalKey = canonicalStringify({
      schemaVersion: "lego.real-build-atomic-compiled-physical-work/1",
      parentCandidateId: parent.group.candidateId,
      parentDocumentHash: parent.group.documentHash,
      parentCanonicalBytesHash: parent.group.canonicalBytesHash,
      parentCanonicalByteLength: parent.group.canonicalByteLength,
      preparedRunInputDigest: evidence.preparedStep.preparedRunInputDigest,
      printedStepIdentity: evidence.preparedStep.printedStepIdentity,
      printedStepNumber: evidence.throughStepNumber,
      printedStep: evidence.preparedStep.compilerMetadata,
      projectedWitnesses: proposal.pieces,
    });
    const priorRootBytes = physicalRootBytes.get(physicalKey);
    if (priorRootBytes !== undefined && priorRootBytes !== parent.group.canonicalBytes) {
      throw new TypeError(
        `${path} aliases non-identical exact root bytes under one physical request descriptor.`,
      );
    }
    if (priorRootBytes === undefined) {
      physicalRootBytes.set(physicalKey, parent.group.canonicalBytes);
      uniquePhysicalProposalIds.push(proposal.proposalId);
    }
  }

  for (let index = 0; index < request.parents.length; index += 1) {
    const parent = request.parents[index]!;
    if (parent.offeredLineages !== (offeredByParent.get(parent.parentLineageId) ?? 0)) {
      throw new TypeError(
        `compiledLineage.searchRequest.parents[${index}].offeredLineages does not equal its ordered proposals.`,
      );
    }
  }
  if (
    request.offeredLineages !== request.proposals.length ||
    request.witnessCount !== witnessCount ||
    request.connectionCount !== connectionCount ||
    request.programOperationCount !== programOperationCount
  ) {
    throw new TypeError(
      "compiledLineage.searchRequest aggregate counts do not reproduce its proposals.",
    );
  }
  const { preflightIdentity, ...requestWithoutIdentity } = request;
  if (
    preflightIdentity !==
    deriveRealBuildCompiledSearchRequestPreflightIdentity({
      printedStepIdentity: evidence.preparedStep.printedStepIdentity,
      request: requestWithoutIdentity,
    })
  ) {
    throw new TypeError(
      "compiledLineage.searchRequest.preflightIdentity does not reproduce its exact ordered prepared search.",
    );
  }
  if (evidence.searchReservation.requested !== request.proposals.length) {
    throw new TypeError(
      "compiledLineage.searchReservation.requested must equal the retained search request proposal count.",
    );
  }

  if (evidence.status === "selected" || evidence.status === "unresolved") {
    const transitionById = new Map(
      evidence.uniqueTransitions.map((transition) => [transition.transitionId, transition]),
    );
    if (
      evidence.lineageEdges.length !== request.proposals.length ||
      evidence.lineageEdges.some((edge, index) => {
        const proposal = request.proposals[index]!;
        const transition = transitionById.get(edge.transitionId);
        return (
          edge.proposalId !== proposal.proposalId ||
          edge.parentLineageId !== proposal.parentLineageId ||
          transition === undefined ||
          canonicalStringify(transition.pieces) !== canonicalStringify(proposal.pieces)
        );
      })
    ) {
      throw new TypeError(
        "A successful compiledLineage frontier must retain one ordered edge for every exact search request proposal.",
      );
    }
  }

  const failure = evidence.terminalFailure;
  if (failure !== null) {
    const aggregate = failure.phase === "aggregate-evidence-closure";
    if (
      failure.uniquePhysicalTransitionCount !== uniquePhysicalProposalIds.length ||
      (aggregate &&
        (failure.proposalId !== null || failure.attemptedUniqueTransitionNumber !== null)) ||
      (!aggregate &&
        (failure.proposalId === null ||
          failure.attemptedUniqueTransitionNumber === null ||
          failure.proposalId !==
            uniquePhysicalProposalIds[failure.attemptedUniqueTransitionNumber - 1]))
    ) {
      throw new TypeError(
        "compiledLineage.terminalFailure must bind the exact unique physical count and attribute only a non-aggregate attempted request.",
      );
    }
  }
  if (failure?.code === "automatic-compilation-failed") {
    const proposal = request.proposals.find(({ proposalId }) => proposalId === failure.proposalId)!;
    const parent = requestParents.get(proposal.parentLineageId)!;
    const snapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: parent.group.canonicalBytes,
      expectedDocumentHash: parent.group.documentHash,
    });
    let replay: ReturnType<typeof compileRealBuildAutomaticPlacement>;
    try {
      replay = compileRealBuildAutomaticPlacement({
        documentSnapshot: snapshot,
        printedStepNumber: evidence.throughStepNumber,
        printedStep: evidence.preparedStep.compilerMetadata,
        witnesses: proposal.pieces.map(({ catalogPartId, colorId, transform, connections }) => ({
          catalogPartId,
          colorId,
          transform,
          connections,
        })),
      });
    } catch {
      throw new TypeError(
        "compiledLineage.terminalFailure claims a deterministic compiler refusal that instead threw during Node replay.",
      );
    }
    if (replay.ok) {
      throw new TypeError(
        "compiledLineage.terminalFailure claims a deterministic compiler refusal that succeeded during Node replay.",
      );
    }
    const rawIssue = replay.issues[0];
    const cleaned = (value: string, maximum: number): string =>
      [...value]
        .map((character) => {
          const code = character.charCodeAt(0);
          return code < 32 || code === 127 ? " " : character;
        })
        .join("")
        .trim()
        .slice(0, maximum);
    const replayedIssue =
      rawIssue === undefined
        ? {
            code: "COMPILATION_FAILED_WITHOUT_ISSUE",
            path: "compiler",
            reason: "The deterministic compiler refused the proposal without one retained issue.",
          }
        : {
            code: cleaned(rawIssue.code || "COMPILATION_FAILED", 256),
            path: cleaned(rawIssue.path || "compiler", 256),
            reason: cleaned(
              rawIssue.message || "The deterministic compiler refused this exact proposal.",
              1_024,
            ),
          };
    if (
      failure.issue.code !== replayedIssue.code ||
      failure.issue.path !== replayedIssue.path ||
      failure.issue.reason !== replayedIssue.reason
    ) {
      throw new TypeError(
        "compiledLineage.terminalFailure issue does not reproduce the current Node compiler's first stable issue.",
      );
    }
  }
}
