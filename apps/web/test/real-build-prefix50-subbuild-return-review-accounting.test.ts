import { describe, expect, it } from "vitest";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt } from "../e2e/real-build-prefix50-subbuild-return-contract";
import {
  requireRealBuildPrefix50Step44CandidatePacketAccounting,
  requireRealBuildPrefix50Step44EnumerationAccounting,
} from "../e2e/real-build-prefix50-subbuild-return-review-batch-accounting";
import { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-support";

const CROSS_EDGE_HISTOGRAM = {
  1: 66,
  2: 49,
  3: 23,
  4: 27,
  5: 13,
  6: 16,
  7: 8,
  8: 9,
} as const;

function heterogeneousReceipt(): RealBuildPrefix50SubBuildReturnReviewEnumerationReceipt {
  const enumeration = createStep44ReviewTestResult(1).enumeration;
  const counts = {
    properGroupOrientations: 24 as const,
    parentParts: 257,
    childParts: 23,
    existingInternalEdges: 873,
    freeParentConnectors: 675,
    freeChildConnectors: 31,
    connectorPairingChecks: 502_200,
    axisCompatiblePairingSeeds: 28_288,
    rejectedNonIntegralDeltaSeeds: 0,
    duplicateDeltaSeeds: 13_372,
    distinctGroupDeltas: 14_916,
    groupDeltasVisited: 14_916,
    transformedChildPartComputations: 343_068,
    crossConnectionChecks: 38_250_900,
    exactCrossEdgesDiscovered: 4_720,
    candidateValidationRuns: 1_828,
    rejectedTransformPolicy: 0,
    rejectedIllegalPartOrientation: 12_393,
    rejectedBelowGround: 695,
    rejectedNoCrossEdge: 0,
    rejectedConnectorCapacityConflict: 0,
    rejectedCollision: 1_617,
    rejectedDisconnected: 0,
    rejectedOtherBlockingValidation: 0,
    accepted: 211,
  };
  const body = {
    schemaVersion: "lego.real-build-prefix50-subbuild-return-review-enumeration-receipt/1" as const,
    enumerationSchemaVersion: enumeration.schemaVersion,
    sourceDocumentHash: enumeration.sourceDocumentHash as `sha256:${string}`,
    childPartIds: enumeration.childPartIds,
    workLimits: enumeration.workLimits,
    counts,
  };
  return { ...body, commitment: canonicalDigest(body) };
}

describe("prefix-50 Step-44 heterogeneous receipt accounting", () => {
  it("accepts the exact mixed 211-candidate branch and packet population", () => {
    const receipt = heterogeneousReceipt();
    const candidateCount = Object.values(CROSS_EDGE_HISTOGRAM).reduce(
      (sum, count) => sum + count,
      0,
    );
    const aggregateCrossEdges = Object.entries(CROSS_EDGE_HISTOGRAM).reduce(
      (sum, [edgeCount, candidateRows]) => sum + Number(edgeCount) * candidateRows,
      0,
    );
    const aggregateOperations = candidateCount * receipt.counts.childParts + aggregateCrossEdges;

    expect(candidateCount).toBe(211);
    expect(aggregateCrossEdges).toBe(630);
    expect(aggregateOperations).toBe(5_483);
    expect(Math.min(...Object.keys(CROSS_EDGE_HISTOGRAM).map(Number))).toBe(1);
    expect(Math.max(...Object.keys(CROSS_EDGE_HISTOGRAM).map(Number))).toBe(8);
    expect(() => requireRealBuildPrefix50Step44EnumerationAccounting(receipt, 211)).not.toThrow();
    expect(() =>
      requireRealBuildPrefix50Step44CandidatePacketAccounting(receipt, 5_483, 630),
    ).not.toThrow();
  });

  it("rejects stage drift and aggregate operation/edge drift", () => {
    const receipt = heterogeneousReceipt();
    const stageDrift = {
      ...receipt,
      counts: { ...receipt.counts, candidateValidationRuns: 1_827 },
    };
    const discoveryDrift = {
      ...receipt,
      counts: { ...receipt.counts, exactCrossEdgesDiscovered: 2_246 },
    };
    expect(() => requireRealBuildPrefix50Step44EnumerationAccounting(stageDrift, 211)).toThrow(
      /complete, exhaustive/u,
    );
    expect(() =>
      requireRealBuildPrefix50Step44CandidatePacketAccounting(discoveryDrift, 5_483, 630),
    ).toThrow(/aggregate accounting/u);
    expect(() =>
      requireRealBuildPrefix50Step44CandidatePacketAccounting(receipt, 5_482, 630),
    ).toThrow(/aggregate accounting/u);
    expect(() =>
      requireRealBuildPrefix50Step44CandidatePacketAccounting(receipt, 5_483, 629),
    ).toThrow(/aggregate accounting/u);
  });
});
