import { describe, expect, it, vi } from "vitest";

import type { RealBuildCompiledGraphIndex } from "../e2e/real-build-compiled-placement-lineage-validation-graph";
import type { RealBuildCompiledPlacementLineageEvidence } from "../e2e/real-build-compiled-placement-lineage-types";
import { compiledPlacementLineageFixture } from "./real-build-compiled-placement-lineage.fixture";

const graphState = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("../e2e/real-build-compiled-placement-lineage-validation-graph", () => ({
  validateRealBuildCompiledGraph: () => graphState.current,
}));

vi.mock("../e2e/real-build-compiled-placement-lineage-validation-observations", () => ({
  validateRealBuildCompiledObservations: () => undefined,
}));

import { validateRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage-validation";

function selectedEvidence(beforeRevision: string): RealBuildCompiledPlacementLineageEvidence {
  const source = compiledPlacementLineageFixture();
  const transition = source.uniqueTransitions[0]!;
  const lineageIds = source.lineageEdges.slice(0, 2).map(({ child }) => child.lineageId);
  return {
    ...source,
    status: "selected",
    selection: {
      status: "selected",
      decisionPanelStepNumber: 2,
      selectedCandidateId: transition.childCandidateId,
      selectedLineageIds: lineageIds,
      bestScore: 0.9,
      runnerUpScore: null,
      margin: null,
    },
    acceptedTransition: {
      candidateId: transition.childCandidateId,
      documentHash: transition.childDocumentHash,
      lineageIds,
      transitionIds: [transition.transitionId],
      beforeRevision,
      afterRevision: transition.receipt.finalRevision,
      canonicalStepId: transition.receipt.canonicalStepId,
      placedPieces: transition.pieces.length,
      validation: transition.receipt.validation,
    },
  };
}

function graphWithParentRevisions(
  evidence: RealBuildCompiledPlacementLineageEvidence,
  revisions: readonly string[],
): RealBuildCompiledGraphIndex {
  const rootsByLineage = new Map<string, unknown>();
  for (const [index, edge] of evidence.lineageEdges.entries()) {
    rootsByLineage.set(edge.parentLineageId, {
      identity: evidence.rootCandidates[0]!.identities[index]!,
      snapshot: { document: { revision: revisions[index] ?? revisions[0] } },
    });
  }
  return {
    rootsByLineage,
    transitionsById: new Map(
      evidence.uniqueTransitions.map((transition) => [transition.transitionId, transition]),
    ),
    edgesByChildLineage: new Map(evidence.lineageEdges.map((edge) => [edge.child.lineageId, edge])),
  } as RealBuildCompiledGraphIndex;
}

describe("compiled accepted-transition parent revision closure", () => {
  it("requires the exact common direct-parent revision", () => {
    const exact = selectedEvidence("revision-parent");
    graphState.current = graphWithParentRevisions(exact, ["revision-parent"]);
    expect(() => validateRealBuildCompiledPlacementLineage(exact)).not.toThrow();

    const forged = selectedEvidence("revision-forged");
    graphState.current = graphWithParentRevisions(forged, ["revision-parent"]);
    expect(() => validateRealBuildCompiledPlacementLineage(forged)).toThrow(
      /beforeRevision must equal the exact selected direct parent root revision/iu,
    );
  });

  it("refuses aggregation across selected direct parents with different revisions", () => {
    const evidence = selectedEvidence("revision-parent-a");
    graphState.current = graphWithParentRevisions(evidence, [
      "revision-parent-a",
      "revision-parent-b",
    ]);
    expect(() => validateRealBuildCompiledPlacementLineage(evidence)).toThrow(
      /cannot aggregate.*direct parent root revisions differ/iu,
    );
  });
});
