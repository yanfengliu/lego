import { describe, expect, it, vi } from "vitest";

vi.mock("../e2e/real-build-compiled-placement-lineage-replay-work", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../e2e/real-build-compiled-placement-lineage-replay-work")
    >();
  return {
    ...actual,
    requireRealBuildCompiledPlacementLineageReplayWorkWithinLimits: vi.fn(
      actual.requireRealBuildCompiledPlacementLineageReplayWorkWithinLimits,
    ),
  };
});

import { parseRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage";
import {
  deriveRealBuildCompiledTerminalFailureDigest,
  deriveRealBuildCompiledTransitionId,
} from "../e2e/real-build-compiled-placement-lineage-digest";
import {
  inspectRealBuildCompiledPlacementLineageReplayWork,
  inspectRealBuildCompiledPlacementLineageWork,
  requireValidatedRealBuildCompiledPlacementLineageWorkInspection,
  validateRealBuildCompiledPlacementLineageReplayWorkInspection,
  validateRealBuildCompiledPlacementLineageWorkInspection,
} from "../e2e/real-build-compiled-placement-lineage-parser";
import { requireRealBuildCompiledPlacementLineageReplayWorkWithinLimits } from "../e2e/real-build-compiled-placement-lineage-replay-work";
import {
  REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS,
} from "../e2e/real-build-automatic-placement-step";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS } from "../e2e/real-build-prepared-search-plan";
import {
  compiledPlacementLineageBytes,
  compiledPlacementLineageFixture,
} from "./real-build-compiled-placement-lineage.fixture";

function bytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

describe("compiled placement lineage admission work", () => {
  it("preserves public /1 parsing while keeping replay-work admission explicit", () => {
    const requireLimits = vi.mocked(requireRealBuildCompiledPlacementLineageReplayWorkWithinLimits);
    requireLimits.mockClear();
    expect(parseRealBuildCompiledPlacementLineage(compiledPlacementLineageBytes())).toMatchObject({
      schemaVersion: "lego.real-build-compiled-placement-lineage/1",
    });
    expect(requireLimits).not.toHaveBeenCalled();

    const inspection = inspectRealBuildCompiledPlacementLineageWork(
      compiledPlacementLineageBytes(),
    );
    validateRealBuildCompiledPlacementLineageReplayWorkInspection(
      inspectRealBuildCompiledPlacementLineageReplayWork(inspection),
    );
    expect(requireLimits).toHaveBeenCalledOnce();
  });

  it("brands exact structural work before admitting document reconstruction", () => {
    const inspection = inspectRealBuildCompiledPlacementLineageWork(
      compiledPlacementLineageBytes(),
    );
    const rootBytes = inspection.evidence.rootCandidates.reduce(
      (total, candidate) => total + new TextEncoder().encode(candidate.canonicalBytes).length,
      0,
    );
    const childBytes = inspection.evidence.childCandidates.reduce(
      (total, candidate) => total + new TextEncoder().encode(candidate.canonicalBytes).length,
      0,
    );

    expect(inspection.work).toMatchObject({
      rootCandidateGroups: 1,
      rootLineages: 8,
      childCandidates: 1,
      placementWitnesses: 8,
      transitionPlacementWitnesses: 1,
      searchParents: 8,
      rootCanonicalDocumentBytes: rootBytes,
      childCanonicalDocumentBytes: childBytes,
    });
    expect(() =>
      validateRealBuildCompiledPlacementLineageWorkInspection({ ...inspection }),
    ).toThrow(/exact branded structural work inspection/iu);
    expect(() =>
      requireValidatedRealBuildCompiledPlacementLineageWorkInspection(inspection),
    ).toThrow(/prior semantic validation/iu);
    expect(validateRealBuildCompiledPlacementLineageWorkInspection(inspection)).toBe(
      inspection.evidence,
    );
    expect(requireValidatedRealBuildCompiledPlacementLineageWorkInspection(inspection)).toBe(
      inspection,
    );
  });

  it("measures canonical UTF-8 work from parsed strings rather than retained byte claims", () => {
    const source = compiledPlacementLineageFixture();
    const root = source.rootCandidates[0]!;
    const inspection = inspectRealBuildCompiledPlacementLineageWork(
      bytes({
        ...source,
        rootCandidates: [{ ...root, canonicalByteLength: root.canonicalByteLength + 17 }],
      }),
    );

    expect(inspection.work.rootCanonicalDocumentBytes).toBe(
      new TextEncoder().encode(root.canonicalBytes).length,
    );
    expect(() => validateRealBuildCompiledPlacementLineageWorkInspection(inspection)).toThrow(
      /hash or UTF-8 length/iu,
    );
  });

  it("admits exact compiler-work limits and refuses each limit plus one", () => {
    const exact = {
      compilerReplayOperations: MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS,
      compilerGraphVisits: REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS,
      compilerByteVisits: REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS,
    };
    expect(() =>
      requireRealBuildCompiledPlacementLineageReplayWorkWithinLimits(exact),
    ).not.toThrow();
    for (const field of [
      "compilerReplayOperations",
      "compilerGraphVisits",
      "compilerByteVisits",
    ] as const) {
      expect(() =>
        requireRealBuildCompiledPlacementLineageReplayWorkWithinLimits({
          ...exact,
          [field]: exact[field] + 1,
          ...(field === "compilerGraphVisits"
            ? { compilerReplayOperations: 0 }
            : field === "compilerByteVisits"
              ? { compilerReplayOperations: 0, compilerGraphVisits: 0 }
              : {}),
        }),
      ).toThrow(/replay preflight aggregates.*maximum/iu);
    }
  });

  it("binds each transition's full printed-step metadata to prepared compiler metadata", () => {
    const source = compiledPlacementLineageFixture();
    const transition = source.uniqueTransitions[0]!;
    const drifted = {
      parentCandidateId: transition.parentCandidateId,
      parentDocumentHash: transition.parentDocumentHash,
      childCandidateId: transition.childCandidateId,
      childDocumentHash: transition.childDocumentHash,
      printedStep: { ...transition.printedStep, name: "Drifted printed step" },
      pieces: transition.pieces,
      receipt: transition.receipt,
    };
    const transitionId = deriveRealBuildCompiledTransitionId(drifted);
    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        bytes({
          ...source,
          uniqueTransitions: [{ transitionId, ...drifted }],
          lineageEdges: source.lineageEdges.map((edge) => ({ ...edge, transitionId })),
        }),
      ),
    ).toThrow(/exact root, child, and prepared printed step/u);
  });

  it("rebuilds the ordered preflight request and retains it across zero-frontier outcomes", () => {
    const source = compiledPlacementLineageFixture();
    const request = source.searchRequest;
    for (const drift of [
      {
        searchRequest: { ...request, preflightIdentity: source.preparedStep.actionEvidenceDigest },
      },
      {
        searchRequest: {
          ...request,
          parents: [
            {
              ...request.parents[0]!,
              canonicalDocumentDigest: source.preparedStep.actionEvidenceDigest,
            },
            ...request.parents.slice(1),
          ],
        },
      },
      {
        searchRequest: {
          ...request,
          proposals: [
            { ...request.proposals[0]!, connectionCount: 1 },
            ...request.proposals.slice(1),
          ],
        },
      },
      { searchRequest: { ...request, witnessCount: request.witnessCount + 1 } },
    ]) {
      expect(() => parseRealBuildCompiledPlacementLineage(bytes({ ...source, ...drift }))).toThrow(
        /searchRequest|operation counts|aggregate counts/iu,
      );
    }
    const refused = parseRealBuildCompiledPlacementLineage(
      bytes({
        ...source,
        status: "budget-refused",
        searchReservation: {
          budget: 7,
          reservedBefore: 0,
          requested: 8,
          reservedAfter: 0,
          reservationNumber: 1,
          admitted: false,
          refusal: "budget-exceeded",
          terminalFailure: {
            preflightIdentity: request.preflightIdentity,
            reservationNumber: 1,
            reservedBefore: 0,
            requested: 8,
            budget: 7,
          },
        },
        terminalFailure: null,
        childCandidates: [],
        uniqueTransitions: [],
        lineageEdges: [],
        selection: {
          status: "not-applicable",
          decisionPanelStepNumber: null,
          selectedCandidateId: null,
          selectedLineageIds: [],
          bestScore: null,
          runnerUpScore: null,
          margin: null,
        },
      }),
    );
    expect(refused.searchRequest).toEqual(request);
    const failureWithoutDigest = {
      schemaVersion: "lego.real-build-compiled-placement-terminal-failure/1" as const,
      proposalId: request.proposals[0]!.proposalId,
      phase: "compilation" as const,
      code: "automatic-compilation-failed" as const,
      attemptedUniqueTransitionNumber: 1,
      uniquePhysicalTransitionCount: 1,
      issue: {
        code: "unsupported-placement",
        path: "compiler.proposals[0]",
        reason: "Deterministic compilation refused the exact prepared placement request.",
      },
    };
    const claimedFailure = {
      ...source,
      status: "failed" as const,
      terminalFailure: {
        ...failureWithoutDigest,
        failureDigest: deriveRealBuildCompiledTerminalFailureDigest({
          throughStepNumber: source.throughStepNumber,
          preparedStep: source.preparedStep,
          searchRequestPreflightIdentity: request.preflightIdentity,
          searchReservation: source.searchReservation,
          failure: failureWithoutDigest,
        }),
      },
      childCandidates: [],
      uniqueTransitions: [],
      lineageEdges: [],
      selection: {
        status: "not-applicable" as const,
        decisionPanelStepNumber: null,
        selectedCandidateId: null,
        selectedLineageIds: [],
        bestScore: null,
        runnerUpScore: null,
        margin: null,
      },
    };
    const failureInspection = inspectRealBuildCompiledPlacementLineageWork(bytes(claimedFailure));
    expect(failureInspection.evidence.uniqueTransitions).toHaveLength(0);
    expect(
      inspectRealBuildCompiledPlacementLineageReplayWork(failureInspection).work
        .compilerReplayOperations,
    ).toBeGreaterThan(0);
    expect(() => parseRealBuildCompiledPlacementLineage(bytes(claimedFailure))).toThrow(
      /claims a deterministic compiler refusal that succeeded/iu,
    );
  });
});
