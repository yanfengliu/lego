import type { RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt } from "./real-build-prefix50-subbuild-return-contract.ts";

function safeProduct(...factors: readonly number[]): number | null {
  let product = 1;
  for (const factor of factors) {
    product *= factor;
    if (!Number.isSafeInteger(product)) return null;
  }
  return product;
}

function safeSum(...terms: readonly number[]): number | null {
  let sum = 0;
  for (const term of terms) {
    sum += term;
    if (!Number.isSafeInteger(sum)) return null;
  }
  return sum;
}

export function requireRealBuildPrefix50Step44EnumerationAccounting(
  receipt: RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt,
  candidateCount: number,
): void {
  const counts = receipt.counts;
  const limits = receipt.workLimits;
  const connectorPairProduct = safeProduct(counts.freeParentConnectors, counts.freeChildConnectors);
  const connectorPairingChecks =
    connectorPairProduct === null
      ? null
      : safeProduct(counts.properGroupOrientations, connectorPairProduct);
  const axisCompatibleSeeds = safeSum(
    counts.rejectedNonIntegralDeltaSeeds,
    counts.duplicateDeltaSeeds,
    counts.distinctGroupDeltas,
  );
  const geometryRejects = safeSum(
    counts.rejectedTransformPolicy,
    counts.rejectedIllegalPartOrientation,
    counts.rejectedBelowGround,
  );
  const maximumTransformComputations = safeProduct(counts.groupDeltasVisited, counts.childParts);
  const maximumCrossConnectionChecks =
    connectorPairProduct === null
      ? null
      : safeProduct(counts.groupDeltasVisited, connectorPairProduct);
  if (
    connectorPairProduct === null ||
    connectorPairingChecks === null ||
    axisCompatibleSeeds === null ||
    geometryRejects === null ||
    maximumTransformComputations === null ||
    maximumCrossConnectionChecks === null
  )
    throw new TypeError("Step-44 review enumeration receipt contains unsafe work accounting.");
  const visitedAfterGeometryRejects = counts.groupDeltasVisited - geometryRejects;
  const matchBearingVisits = visitedAfterGeometryRejects - counts.rejectedNoCrossEdge;
  const validatedTerminalOutcomes = safeSum(
    counts.rejectedCollision,
    counts.rejectedDisconnected,
    counts.rejectedOtherBlockingValidation,
    counts.accepted,
  );
  const terminalOutcomes = safeSum(
    counts.rejectedTransformPolicy,
    counts.rejectedIllegalPartOrientation,
    counts.rejectedBelowGround,
    counts.rejectedNoCrossEdge,
    counts.rejectedConnectorCapacityConflict,
    validatedTerminalOutcomes ?? Number.MAX_SAFE_INTEGER,
  );
  const completeTransformComputations = safeProduct(
    counts.groupDeltasVisited - counts.rejectedTransformPolicy,
    counts.childParts,
  );
  const minimumTransformComputations =
    completeTransformComputations === null
      ? null
      : safeSum(completeTransformComputations, counts.rejectedTransformPolicy);
  const maximumNewEdges = limits.maxDocumentConnections - counts.existingInternalEdges;
  const maximumMatchEdges = Math.min(
    connectorPairProduct,
    limits.maxCrossEdgesPerCandidate,
    maximumNewEdges,
  );
  const maximumCapacitySafeEdges = Math.min(
    counts.freeParentConnectors,
    counts.freeChildConnectors,
    limits.maxCrossEdgesPerCandidate,
    maximumNewEdges,
  );
  if (
    validatedTerminalOutcomes === null ||
    terminalOutcomes === null ||
    minimumTransformComputations === null
  )
    throw new TypeError("Step-44 review enumeration receipt contains unsafe terminal accounting.");
  const preValidationCapacityRejects = matchBearingVisits - counts.candidateValidationRuns;
  const exactCrossConnectionChecks = safeProduct(visitedAfterGeometryRejects, connectorPairProduct);
  const minimumDiscoveredEdges = safeSum(
    safeProduct(2, preValidationCapacityRejects) ?? Number.MAX_SAFE_INTEGER,
    counts.candidateValidationRuns,
  );
  const maximumDiscoveredEdges = safeSum(
    safeProduct(preValidationCapacityRejects, maximumMatchEdges) ?? Number.MAX_SAFE_INTEGER,
    safeProduct(counts.candidateValidationRuns, maximumCapacitySafeEdges) ??
      Number.MAX_SAFE_INTEGER,
  );
  if (
    counts.properGroupOrientations !== 24 ||
    counts.parentParts !== 257 ||
    counts.childParts !== 23 ||
    counts.accepted !== candidateCount ||
    counts.connectorPairingChecks !== connectorPairingChecks ||
    counts.axisCompatiblePairingSeeds !== axisCompatibleSeeds ||
    counts.groupDeltasVisited !== counts.distinctGroupDeltas ||
    terminalOutcomes !== counts.groupDeltasVisited ||
    minimumTransformComputations > counts.transformedChildPartComputations ||
    counts.transformedChildPartComputations > maximumTransformComputations ||
    visitedAfterGeometryRejects < 0 ||
    exactCrossConnectionChecks === null ||
    counts.crossConnectionChecks !== exactCrossConnectionChecks ||
    matchBearingVisits < 0 ||
    preValidationCapacityRejects < 0 ||
    minimumDiscoveredEdges === null ||
    maximumDiscoveredEdges === null ||
    counts.exactCrossEdgesDiscovered < minimumDiscoveredEdges ||
    counts.exactCrossEdgesDiscovered > maximumDiscoveredEdges ||
    counts.exactCrossEdgesDiscovered > counts.crossConnectionChecks ||
    counts.candidateValidationRuns < validatedTerminalOutcomes ||
    counts.candidateValidationRuns >
      validatedTerminalOutcomes + counts.rejectedConnectorCapacityConflict ||
    counts.candidateValidationRuns > matchBearingVisits ||
    maximumNewEdges < 0 ||
    counts.parentParts + counts.childParts > limits.maxDocumentParts ||
    counts.existingInternalEdges < counts.parentParts + counts.childParts - 2 ||
    counts.existingInternalEdges > limits.maxDocumentConnections ||
    counts.connectorPairingChecks > limits.maxConnectorPairingChecks ||
    counts.distinctGroupDeltas > limits.maxDistinctGroupDeltas ||
    counts.groupDeltasVisited > limits.maxCandidateDocuments ||
    maximumTransformComputations > limits.maxTransformedChildParts ||
    maximumCrossConnectionChecks > limits.maxCrossConnectionChecks
  )
    throw new TypeError(
      "Step-44 review enumeration receipt must bind complete, exhaustive, bounded 257+23 accounting.",
    );
}

export function requireRealBuildPrefix50Step44CandidatePacketAccounting(
  receipt: RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt,
  aggregateOperationCount: number,
  aggregateCrossEdgeAdds: number,
): void {
  const counts = receipt.counts;
  const matchBearingVisits =
    counts.groupDeltasVisited -
    counts.rejectedTransformPolicy -
    counts.rejectedIllegalPartOrientation -
    counts.rejectedBelowGround -
    counts.rejectedNoCrossEdge;
  const preValidationCapacityRejects = matchBearingVisits - counts.candidateValidationRuns;
  const maximumCapacitySafeEdges = Math.min(
    counts.freeParentConnectors,
    counts.freeChildConnectors,
    receipt.workLimits.maxCrossEdgesPerCandidate,
    receipt.workLimits.maxDocumentConnections - counts.existingInternalEdges,
  );
  const minimumReceiptEdges = safeSum(
    aggregateCrossEdgeAdds,
    safeProduct(2, preValidationCapacityRejects) ?? Number.MAX_SAFE_INTEGER,
    counts.candidateValidationRuns - counts.accepted,
  );
  const maximumAcceptedEdges = safeProduct(counts.accepted, maximumCapacitySafeEdges);
  const expectedOperations = safeSum(
    safeProduct(counts.accepted, counts.childParts) ?? Number.MAX_SAFE_INTEGER,
    aggregateCrossEdgeAdds,
  );
  if (
    minimumReceiptEdges === null ||
    maximumAcceptedEdges === null ||
    expectedOperations === null ||
    aggregateOperationCount !== expectedOperations ||
    aggregateCrossEdgeAdds < counts.accepted ||
    aggregateCrossEdgeAdds > maximumAcceptedEdges ||
    counts.exactCrossEdgesDiscovered < minimumReceiptEdges
  )
    throw new TypeError(
      "Step-44 compact candidates exceed their complete update and cross-edge aggregate accounting.",
    );
}
