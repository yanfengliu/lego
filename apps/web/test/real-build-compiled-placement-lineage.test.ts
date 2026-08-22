import { describe, expect, it } from "vitest";

import { parseRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage";
import { deriveRealBuildCompiledTerminalFailureDigest } from "../e2e/real-build-compiled-placement-lineage-digest";
import {
  deriveRealBuildPreparedSearchCanonicalDocumentDigest,
  deriveRealBuildPreparedSearchProposalId,
} from "../e2e/real-build-prepared-search-digest";
import {
  compiledPlacementLineageBytes,
  compiledPlacementLineageFixture,
  compiledPlacementMaskDigests,
} from "./real-build-compiled-placement-lineage.fixture";

function bytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

describe("compiled placement lineage evidence generation 1", () => {
  it("retains eight root lineages and eight step-1 edges through one unique Node transition", () => {
    const parsed = parseRealBuildCompiledPlacementLineage(compiledPlacementLineageBytes());
    expect(parsed.rootCandidates).toHaveLength(1);
    expect(parsed.rootCandidates[0]!.identities).toHaveLength(8);
    expect(parsed.childCandidates).toHaveLength(1);
    expect(parsed.uniqueTransitions).toHaveLength(1);
    expect(parsed.lineageEdges).toHaveLength(8);
    expect(parsed.searchRequest).toMatchObject({
      offeredLineages: 8,
      witnessCount: 8,
      connectionCount: 0,
      programOperationCount: 8,
    });
    expect(parsed.searchRequest.parents).toHaveLength(8);
    expect(parsed.searchRequest.proposals).toHaveLength(8);
    expect(new Set(parsed.lineageEdges.map(({ transitionId }) => transitionId)).size).toBe(1);
    const transition = parsed.uniqueTransitions[0]!;
    const canonicalDocumentDigest = deriveRealBuildPreparedSearchCanonicalDocumentDigest(
      parsed.rootCandidates[0]!.canonicalBytesHash,
    );
    expect(new Set(parsed.lineageEdges.map(({ proposalId }) => proposalId)).size).toBe(8);
    expect(parsed.lineageEdges.map(({ proposalId }) => proposalId)).toEqual(
      parsed.lineageEdges.map(({ parentLineageId }) =>
        deriveRealBuildPreparedSearchProposalId({
          printedStepIdentity: parsed.preparedStep.printedStepIdentity,
          parentLineageId,
          canonicalDocumentDigest,
          pieces: transition.pieces,
        }),
      ),
    );
    expect(parsed.observationRefs).toEqual([]);
    expect(parsed.selection).toMatchObject({
      status: "unresolved",
      decisionPanelStepNumber: null,
    });
    expect(parsed.acceptedTransition).toBeNull();
    expect(parsed.completionAuthority.authorized).toBe(false);
  });
  it("recomputes current Node compiler input, job, and physical transition commitments", () => {
    const source = compiledPlacementLineageFixture();
    const transition = source.uniqueTransitions[0]!;
    for (const drift of [
      {
        receipt: {
          ...transition.receipt,
          compilerInputDigest: source.preparedStep.printedStepIdentity,
        },
      },
      { receipt: { ...transition.receipt, jobId: "real-build-job-000000000000000000000000" } },
      { printedStep: { ...transition.printedStep, name: "Drifted printed step" } },
    ]) {
      expect(() =>
        parseRealBuildCompiledPlacementLineage(
          bytes({ ...source, uniqueTransitions: [{ ...transition, ...drift }] }),
        ),
      ).toThrow(/transitionId|current Node compiler/u);
    }
  });
  it("rejects a proposal ID that does not bind its exact parent lineage edge", () => {
    const source = compiledPlacementLineageFixture();
    const edges = source.lineageEdges.map((edge, index) =>
      index === 0 ? { ...edge, proposalId: source.lineageEdges[1]!.proposalId } : edge,
    );
    expect(() =>
      parseRealBuildCompiledPlacementLineage(bytes({ ...source, lineageEdges: edges })),
    ).toThrow(/ordered edge for every exact search request|proposalId does not reproduce/iu);
  });
  it("retains aggregate evidence-closure failure without blaming a physical proposal", () => {
    const source = compiledPlacementLineageFixture();
    const failureWithoutDigest = {
      schemaVersion: "lego.real-build-compiled-placement-terminal-failure/1" as const,
      proposalId: null,
      phase: "aggregate-evidence-closure" as const,
      code: "compiled-evidence-closure-failed" as const,
      attemptedUniqueTransitionNumber: null,
      uniquePhysicalTransitionCount: 1,
      issue: {
        code: "LOCAL_EVIDENCE_CLOSURE_FAILED",
        path: "compiledLineage",
        reason: "The aggregate envelope did not close after every physical work closed.",
      },
    };
    const terminalFailure = {
      ...failureWithoutDigest,
      failureDigest: deriveRealBuildCompiledTerminalFailureDigest({
        throughStepNumber: source.throughStepNumber,
        preparedStep: source.preparedStep,
        searchRequestPreflightIdentity: source.searchRequest.preflightIdentity,
        searchReservation: source.searchReservation,
        failure: failureWithoutDigest,
      }),
    };
    const failed = {
      ...source,
      status: "failed",
      terminalFailure,
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
    };

    expect(parseRealBuildCompiledPlacementLineage(bytes(failed)).terminalFailure).toMatchObject({
      proposalId: null,
      phase: "aggregate-evidence-closure",
      attemptedUniqueTransitionNumber: null,
    });
    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        bytes({
          ...failed,
          terminalFailure: {
            ...terminalFailure,
            proposalId: source.searchRequest.proposals[0]!.proposalId,
          },
        }),
      ),
    ).toThrow(/aggregate|digest/iu);
  });

  it("permits inspection of fully byte-bound scored selection without granting authority", () => {
    const source = compiledPlacementLineageFixture();
    const transition = source.uniqueTransitions[0]!;
    const lineageIds = source.lineageEdges.map(({ child }) => child.lineageId);
    const mask = (offset: number, digest: string) => ({
      role: "branch-observation-bytes" as const,
      offset,
      bytes: 1,
      digest,
      encoding: "packed-binary-mask-msb/1" as const,
      widthPx: 1,
      heightPx: 1,
    });
    const selected = {
      ...source,
      status: "selected" as const,
      observationBytes: {
        role: "branch-observation-bytes" as const,
        bytes: 2,
        digest: compiledPlacementMaskDigests.role,
      },
      observationRefs: lineageIds.map((lineageId, index) => ({
        observationId: `observation-${index}`,
        lineageId,
        sourceEvidenceId: "printed-panel-2-mask",
        cameraEvidenceId: `camera-${index}`,
        registrationPanelStepNumber: 2,
        status: "scored" as const,
        score: 0.9,
        sourceMask: mask(0, compiledPlacementMaskDigests.source),
        candidateMask: mask(1, compiledPlacementMaskDigests.candidate),
        excludedMask: null,
      })),
      selection: {
        status: "selected" as const,
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
        beforeRevision: "revision-0",
        afterRevision: transition.receipt.finalRevision,
        canonicalStepId: transition.receipt.canonicalStepId,
        placedPieces: transition.pieces.length,
        validation: transition.receipt.validation,
      },
    };
    const parsed = parseRealBuildCompiledPlacementLineage(bytes(selected));
    expect(parsed.acceptedTransition?.candidateId).toBe(transition.childCandidateId);
    expect(parsed.completionAuthority).toEqual({
      status: "absent",
      authorized: false,
      reason: "compiled-placement-lineage-is-inspection-only",
    });
  });

  it("rejects unbound scored claims, role gaps, partial overlaps, and shared-root byte drift", () => {
    const source = compiledPlacementLineageFixture();
    const firstLineage = source.lineageEdges[0]!.child.lineageId;
    const scoredWithoutBytes = {
      ...source,
      observationRefs: [
        {
          observationId: "unbound-score",
          lineageId: firstLineage,
          sourceEvidenceId: "source",
          cameraEvidenceId: "camera",
          registrationPanelStepNumber: 2,
          status: "scored",
          score: 0.5,
          sourceMask: null,
          candidateMask: null,
          excludedMask: null,
        },
      ],
    };
    expect(() => parseRealBuildCompiledPlacementLineage(bytes(scoredWithoutBytes))).toThrow(
      /scored only with.*byte reference/iu,
    );

    const roots = source.rootCandidates.map((root) => ({
      ...root,
      canonicalByteLength: root.canonicalByteLength + 1,
    }));
    expect(() =>
      parseRealBuildCompiledPlacementLineage(bytes({ ...source, rootCandidates: roots })),
    ).toThrow(/hash or UTF-8 length/iu);

    const edgeLineages = source.lineageEdges.map(({ child }) => child.lineageId);
    const reference = (offset: number, byteCount: number, digest: string) => ({
      role: "branch-observation-bytes",
      offset,
      bytes: byteCount,
      digest,
      encoding: "packed-binary-mask-msb/1",
      widthPx: byteCount * 8,
      heightPx: 1,
    });
    const observation = (lineageId: string, offset: number, maskBytes: number) => ({
      observationId: `observation-${offset}`,
      lineageId,
      sourceEvidenceId: "source",
      cameraEvidenceId: "camera",
      registrationPanelStepNumber: 2,
      status: "scored",
      score: 0.5,
      sourceMask: reference(offset, maskBytes, compiledPlacementMaskDigests.source),
      candidateMask: reference(
        offset + maskBytes,
        maskBytes,
        compiledPlacementMaskDigests.candidate,
      ),
      excludedMask: null,
    });
    const withRole = (observationRefs: readonly unknown[], roleBytes: number) => ({
      ...source,
      observationBytes: {
        role: "branch-observation-bytes",
        bytes: roleBytes,
        digest: compiledPlacementMaskDigests.role,
      },
      observationRefs,
    });
    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        bytes(withRole([observation(edgeLineages[0]!, 1, 1)], 3)),
      ),
    ).toThrow(/complete role coverage.*at 0/iu);
    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        bytes(
          withRole([observation(edgeLineages[0]!, 0, 2), observation(edgeLineages[1]!, 1, 2)], 4),
        ),
      ),
    ).toThrow(/partially overlaps/iu);
  });

  it("independently rebuilds one exact shared child snapshot and rejects drift or orphans", () => {
    const source = compiledPlacementLineageFixture();
    const child = source.childCandidates[0]!;
    expect(source.lineageEdges).toHaveLength(8);
    expect(source.uniqueTransitions.map(({ childCandidateId }) => childCandidateId)).toEqual([
      child.candidateId,
    ]);

    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        bytes({
          ...source,
          childCandidates: [{ ...child, canonicalByteLength: child.canonicalByteLength + 1 }],
        }),
      ),
    ).toThrow(/hash or UTF-8 length/iu);
    expect(() =>
      parseRealBuildCompiledPlacementLineage(bytes({ ...source, childCandidates: [] })),
    ).toThrow(/does not name retained exact child bytes/iu);
    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        bytes({ ...source, childCandidates: [child, { ...child }] }),
      ),
    ).toThrow(/duplicates a child candidate/iu);

    const root = source.rootCandidates[0]!;
    const orphan = {
      candidateId: root.candidateId,
      documentHash: root.documentHash,
      canonicalBytes: root.canonicalBytes,
      canonicalBytesHash: root.canonicalBytesHash,
      canonicalByteLength: root.canonicalByteLength,
    };
    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        bytes({ ...source, childCandidates: [child, orphan] }),
      ),
    ).toThrow(/contains orphan/iu);
  });

  it("accepts only bounded immutable UTF-8 bytes and exact schema shapes", () => {
    const source = compiledPlacementLineageFixture();
    expect(() => parseRealBuildCompiledPlacementLineage(JSON.stringify(source))).toThrow(
      /genuine Uint8Array/u,
    );
    expect(() => parseRealBuildCompiledPlacementLineage(new Uint8Array([0xff]))).toThrow(
      /well-formed UTF-8/u,
    );
    expect(() => parseRealBuildCompiledPlacementLineage(bytes(source), 16)).toThrow(
      /no text was decoded or parsed/u,
    );
    expect(() =>
      parseRealBuildCompiledPlacementLineage(bytes({ ...source, unexpected: true })),
    ).toThrow(/inexact shape/u);
    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        bytes({
          ...source,
          uniqueTransitions: [
            {
              ...source.uniqueTransitions[0],
              proposalId: source.lineageEdges[0]!.proposalId,
            },
          ],
        }),
      ),
    ).toThrow(/inexact shape/u);
    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        bytes({
          ...source,
          lineageEdges: [
            {
              parentLineageId: source.lineageEdges[0]!.parentLineageId,
              child: source.lineageEdges[0]!.child,
              transitionId: source.lineageEdges[0]!.transitionId,
            },
            ...source.lineageEdges.slice(1),
          ],
        }),
      ),
    ).toThrow(/inexact shape/u);
    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        new Uint8Array(new SharedArrayBuffer(compiledPlacementLineageBytes().length)),
      ),
    ).toThrow(/SharedArrayBuffer/u);

    let deep: unknown = null;
    for (let index = 0; index < 130; index += 1) deep = { child: deep };
    expect(() => parseRealBuildCompiledPlacementLineage(bytes(deep))).toThrow(/exceeds depth 128/u);
  });
});
