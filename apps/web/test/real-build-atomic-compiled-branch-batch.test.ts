import { describe, expect, it, vi } from "vitest";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import {
  executePreparedRealBuildAtomicCompiledBranchBatch,
  executeRealBuildAtomicCompiledBranchBatch,
  decodeRealBuildAtomicCompiledBranchEvidenceWire,
} from "../e2e/real-build-atomic-compiled-branch-batch";
import { prepareRealBuildAtomicCompiledBranchBatch } from "../e2e/real-build-atomic-compiled-branch-batch-input";
import { createRealBuildLineageIdentity } from "../e2e/real-build-candidate-lineage-identity";
import { parseRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage";
import { snapshotRealBuildEnumeratedPlacementOffer } from "../e2e/real-build-enumerated-placement-witness";
import {
  createRealBuildPreparedSearchLedger,
  snapshotRealBuildPreparedSearchLedger,
} from "../e2e/real-build-prepared-search-ledger";
import { inspectRealBuildPreparedStepInput } from "../e2e/real-build-prepared-step-authority";
import {
  preparedSearchEmptyParent,
  preparedSearchOptionsBytes,
} from "./real-build-prepared-search.fixture";

function fixture(rootCount: number, ledger = createRealBuildPreparedSearchLedger(rootCount)) {
  const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 1), 1);
  const parent = preparedSearchEmptyParent();
  const roots = [
    parent.identity,
    ...Array.from({ length: rootCount - 1 }, (_, index) =>
      createRealBuildLineageIdentity({
        candidateId: parent.identity.candidateId,
        documentHash: parent.identity.documentHash,
        parent: null,
        throughStepNumber: 0,
        localIdentity: { kind: "evidence", id: `atomic-camera-root:${index + 1}` },
      }),
    ),
  ];
  const piece = preparedStep.expectedAtomicPieces[0]!;
  const offer = snapshotRealBuildEnumeratedPlacementOffer({
    catalogPartId: piece.catalogPartId,
    transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
    connections: [],
    restsOnBuildPlate: true,
  });
  const enumeratedParents = roots.map((identity, index) => ({
    parentLineageId: identity.lineageId,
    candidates: [
      {
        partIds: [`provisional-part-${index}`],
        offeredCandidates: [offer],
      },
    ],
  }));
  return {
    ledger,
    enumeratedParents,
    input: {
      preparedStep,
      rootCandidate: { documentSnapshot: parent.documentSnapshot, identities: roots },
      enumeratedParents,
      ledger,
    },
  };
}

describe("atomic compiled real-build branch batch", () => {
  it("compiles one physical transition for eight roots while retaining eight distinct edges", () => {
    const source = fixture(8);
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);
    const result = executeRealBuildAtomicCompiledBranchBatch(source.input, compiler);

    expect(result.status).toBe("compiled");
    expect(compiler).toHaveBeenCalledOnce();
    expect(result.evidence.rootCandidates[0]!.identities).toHaveLength(8);
    expect(result.evidence.searchReservation).toMatchObject({
      requested: 8,
      reservedBefore: 0,
      reservedAfter: 8,
      admitted: true,
    });
    expect(result.evidence.uniqueTransitions).toHaveLength(1);
    expect(result.evidence.childCandidates).toHaveLength(1);
    expect(result.evidence.lineageEdges).toHaveLength(8);
    expect(new Set(result.evidence.lineageEdges.map(({ proposalId }) => proposalId))).toHaveLength(
      8,
    );
    expect(new Set(result.evidence.lineageEdges.map(({ child }) => child.lineageId))).toHaveLength(
      8,
    );
    expect(
      new Set(result.evidence.lineageEdges.map(({ transitionId }) => transitionId)),
    ).toHaveLength(1);
    expect(result.evidence.acceptedTransition).toBeNull();
    expect(result.acceptedDocument).toBeNull();
    expect(result.scoreAuthority).toMatchObject({ status: "absent", authorized: false });
    expect(result.completionAuthority).toMatchObject({ status: "absent", authorized: false });
    expect(
      parseRealBuildCompiledPlacementLineage(
        decodeRealBuildAtomicCompiledBranchEvidenceWire(result.evidenceWire),
      ),
    ).toEqual(result.evidence);
  });

  it("refuses budget-minus-one before any compile and retains no partial child frontier", () => {
    const ledger = createRealBuildPreparedSearchLedger(7);
    const source = fixture(8, ledger);
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);
    const result = executeRealBuildAtomicCompiledBranchBatch(source.input, compiler);

    expect(result.status).toBe("budget-refused");
    expect(compiler).not.toHaveBeenCalled();
    expect(result.evidence.searchReservation).toEqual({
      budget: 7,
      reservedBefore: 0,
      requested: 8,
      reservedAfter: 0,
      reservationNumber: 1,
      admitted: false,
      refusal: "budget-exceeded",
      terminalFailure: {
        budget: 7,
        preflightIdentity: result.evidence.searchRequest.preflightIdentity,
        requested: 8,
        reservationNumber: 1,
        reservedBefore: 0,
      },
    });
    expect(result.evidence.searchRequest.proposals).toHaveLength(8);
    expect(result.evidence.childCandidates).toEqual([]);
    expect(result.evidence.uniqueTransitions).toEqual([]);
    expect(result.evidence.lineageEdges).toEqual([]);
    expect(result.evidence.acceptedTransition).toBeNull();
    expect(result.acceptedDocument).toBeNull();
  });

  it("shares sequential admitted reservations and remains terminal after aggregate refusal", () => {
    const ledger = createRealBuildPreparedSearchLedger(3);
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);
    const first = executeRealBuildAtomicCompiledBranchBatch(fixture(1, ledger).input, compiler);
    const second = executeRealBuildAtomicCompiledBranchBatch(fixture(1, ledger).input, compiler);
    const refused = executeRealBuildAtomicCompiledBranchBatch(fixture(2, ledger).input, compiler);
    const terminal = executeRealBuildAtomicCompiledBranchBatch(fixture(1, ledger).input, compiler);

    expect(first.evidence.searchReservation).toMatchObject({
      reservedBefore: 0,
      reservedAfter: 1,
      reservationNumber: 1,
      admitted: true,
    });
    expect(second.evidence.searchReservation).toMatchObject({
      reservedBefore: 1,
      reservedAfter: 2,
      reservationNumber: 2,
      admitted: true,
    });
    expect(refused.evidence.searchReservation).toMatchObject({
      reservedBefore: 2,
      requested: 2,
      reservedAfter: 2,
      reservationNumber: 3,
      admitted: false,
      refusal: "budget-exceeded",
    });
    expect(terminal.evidence.searchReservation).toMatchObject({
      reservedBefore: 2,
      requested: 1,
      reservedAfter: 2,
      reservationNumber: 3,
      admitted: false,
      refusal: "ledger-already-refused",
    });
    expect(terminal.evidence.searchReservation.terminalFailure?.preflightIdentity).toBe(
      refused.evidence.searchRequest.preflightIdentity,
    );
    expect(terminal.evidence.searchReservation.terminalFailure?.preflightIdentity).not.toBe(
      terminal.evidence.searchRequest.preflightIdentity,
    );
    expect(compiler).toHaveBeenCalledTimes(2);
    expect(snapshotRealBuildPreparedSearchLedger(ledger)).toMatchObject({
      budget: 3,
      reserved: 2,
      refused: true,
      reservationCount: 3,
    });
  });

  it("finishes projection before reservation and executes only detached prepared facts", () => {
    const source = fixture(1);
    const preparation = prepareRealBuildAtomicCompiledBranchBatch(source.input);
    const candidate = source.enumeratedParents[0]!.candidates[0]!;
    candidate.partIds[0] = "mutated-after-projection";
    candidate.offeredCandidates.length = 0;
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);

    const result = executePreparedRealBuildAtomicCompiledBranchBatch(preparation, compiler);
    expect(result.status).toBe("compiled");
    expect(compiler).toHaveBeenCalledOnce();

    const hostile = fixture(1);
    const hostileCandidate = hostile.enumeratedParents[0]!.candidates[0]!;
    Object.defineProperty(hostileCandidate, "partIds", {
      enumerable: true,
      get() {
        throw new Error("must remain inert");
      },
    });
    expect(() => prepareRealBuildAtomicCompiledBranchBatch(hostile.input)).toThrow(
      /own data property/iu,
    );
    expect(snapshotRealBuildPreparedSearchLedger(hostile.ledger)).toMatchObject({
      reserved: 0,
      reservationCount: 0,
    });
  });

  it("ignores caller compiler metadata and bounds enumerated structure before identity entries", () => {
    const source = fixture(1);
    let metadataReads = 0;
    Object.defineProperty(source.input, "printedStep", {
      enumerable: true,
      get() {
        metadataReads += 1;
        throw new Error("caller metadata must remain outside preparation");
      },
    });
    const result = executeRealBuildAtomicCompiledBranchBatch(source.input);
    expect(metadataReads).toBe(0);
    expect(result.evidence.uniqueTransitions[0]!.printedStep).toEqual(
      source.input.preparedStep.compilerMetadata,
    );

    const bounded = fixture(1);
    let identityReads = 0;
    const identities: unknown[] = [];
    Object.defineProperty(identities, "0", {
      enumerable: true,
      get() {
        identityReads += 1;
        throw new Error("identity must remain inert until structural bounds pass");
      },
    });
    const input = {
      ...bounded.input,
      rootCandidate: { ...bounded.input.rootCandidate, identities },
      enumeratedParents: [
        {
          parentLineageId: bounded.input.preparedStep.printedStepIdentity,
          candidates: new Array(8_193),
        },
      ],
    };
    expect(() => prepareRealBuildAtomicCompiledBranchBatch(input)).toThrow(
      /candidates must contain/iu,
    );
    expect(identityReads).toBe(0);
    expect(snapshotRealBuildPreparedSearchLedger(bounded.ledger).reserved).toBe(0);
  });

  it("bounds aggregate witnesses before inspecting any offered-candidate entry", () => {
    const ledger = createRealBuildPreparedSearchLedger(8_192);
    const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1_024, 1), 1);
    const parent = preparedSearchEmptyParent();
    let offerEntryReads = 0;
    const offeredCandidates = new Array(1_024).fill(null);
    Object.defineProperty(offeredCandidates, "0", {
      enumerable: true,
      get() {
        offerEntryReads += 1;
        throw new Error("offer entry must remain inert until the aggregate bound passes");
      },
    });
    const candidate = {
      partIds: Array.from({ length: 1_024 }, (_, index) => `part-${index}`),
      offeredCandidates,
    };
    const input = {
      preparedStep,
      rootCandidate: {
        documentSnapshot: parent.documentSnapshot,
        identities: [parent.identity],
      },
      enumeratedParents: [
        {
          parentLineageId: parent.identity.lineageId,
          candidates: new Array(33).fill(candidate),
        },
      ],
      ledger,
    };

    expect(() => prepareRealBuildAtomicCompiledBranchBatch(input)).toThrow(
      /witness total exceeds 32768/iu,
    );
    expect(offerEntryReads).toBe(0);
    expect(snapshotRealBuildPreparedSearchLedger(ledger)).toMatchObject({
      reserved: 0,
      reservationCount: 0,
      refused: false,
    });
  });

  it("rejects duplicate physical candidates and independently catches compiler substitution", () => {
    const duplicate = fixture(1);
    duplicate.enumeratedParents[0]!.candidates.push({
      partIds: ["alternate-provisional-id"],
      offeredCandidates: [duplicate.enumeratedParents[0]!.candidates[0]!.offeredCandidates[0]!],
    });
    expect(() => prepareRealBuildAtomicCompiledBranchBatch(duplicate.input)).toThrow(
      /repeats an exact parent and witness sequence/iu,
    );
    expect(snapshotRealBuildPreparedSearchLedger(duplicate.ledger).reserved).toBe(0);

    const substituted = fixture(1);
    const compiler = vi.fn(((input: Parameters<typeof compileRealBuildAutomaticPlacement>[0]) => {
      const row = input as {
        readonly documentSnapshot: unknown;
        readonly printedStepNumber: number;
        readonly printedStep: { readonly sourceActionDigest: string };
        readonly witnesses: readonly unknown[];
      };
      return compileRealBuildAutomaticPlacement({
        ...row,
        printedStep: {
          name: "Substituted compiler step",
          sourceActionDigest: row.printedStep.sourceActionDigest,
        },
      });
    }) as typeof compileRealBuildAutomaticPlacement);
    const failure = executeRealBuildAtomicCompiledBranchBatch(substituted.input, compiler);
    expect(failure.status).toBe("failed");
    expect(failure.evidence.terminalFailure).toMatchObject({
      phase: "evidence-closure",
      code: "compiled-evidence-closure-failed",
    });
    expect(failure.evidence.searchReservation).toMatchObject({
      admitted: true,
      requested: 1,
      reservedAfter: 1,
    });
    expect(failure.evidence.childCandidates).toEqual([]);
    expect(failure.evidence.uniqueTransitions).toEqual([]);
    expect(failure.evidence.lineageEdges).toEqual([]);
    expect(
      parseRealBuildCompiledPlacementLineage(
        decodeRealBuildAtomicCompiledBranchEvidenceWire(failure.evidenceWire),
      ),
    ).toEqual(failure.evidence);
    expect(compiler).toHaveBeenCalledOnce();
  });

  it("returns fresh wire bytes and never exposes mutable evidence storage", () => {
    const result = executeRealBuildAtomicCompiledBranchBatch(fixture(1).input);
    const first = decodeRealBuildAtomicCompiledBranchEvidenceWire(result.evidenceWire);
    const second = decodeRealBuildAtomicCompiledBranchEvidenceWire(result.evidenceWire);
    first[0] = first[0]! ^ 0xff;

    expect(first).not.toEqual(second);
    expect(Object.isFrozen(result.evidenceWire)).toBe(true);
    expect(parseRealBuildCompiledPlacementLineage(second)).toEqual(result.evidence);
    expect(
      parseRealBuildCompiledPlacementLineage(
        decodeRealBuildAtomicCompiledBranchEvidenceWire(result.evidenceWire),
      ),
    ).toEqual(result.evidence);
  });

  it("fails atomically on the second unique transition and charges the one-use batch", () => {
    const ledger = createRealBuildPreparedSearchLedger(2);
    const source = fixture(1, ledger);
    const firstOffer = source.enumeratedParents[0]!.candidates[0]!.offeredCandidates[0]!;
    source.enumeratedParents[0]!.candidates.push({
      partIds: ["second-physical-part"],
      offeredCandidates: [
        snapshotRealBuildEnumeratedPlacementOffer({
          ...firstOffer,
          transform: { positionLdu: [20, 0, 0], orientationId: "upright-yaw-0" },
        }),
      ],
    });
    const preparation = prepareRealBuildAtomicCompiledBranchBatch(source.input);
    let call = 0;
    const compiler = vi.fn(((input: Parameters<typeof compileRealBuildAutomaticPlacement>[0]) => {
      call += 1;
      if (call === 2) throw new Error("hostile injected secret must not be serialized");
      return compileRealBuildAutomaticPlacement(input);
    }) as typeof compileRealBuildAutomaticPlacement);

    const result = executePreparedRealBuildAtomicCompiledBranchBatch(preparation, compiler);
    expect(result.status).toBe("failed");
    expect(compiler).toHaveBeenCalledTimes(2);
    expect(result.evidence.searchReservation).toMatchObject({
      admitted: true,
      requested: 2,
      reservedAfter: 2,
    });
    expect(result.evidence.terminalFailure).toMatchObject({
      phase: "evidence-closure",
      code: "compiled-evidence-closure-failed",
      attemptedUniqueTransitionNumber: 2,
      uniquePhysicalTransitionCount: 2,
      issue: { code: "LOCAL_EVIDENCE_CLOSURE_FAILED", path: "compiledLineage" },
    });
    expect(JSON.stringify(result.evidence)).not.toContain("hostile injected secret");
    expect(result.evidence.childCandidates).toEqual([]);
    expect(result.evidence.uniqueTransitions).toEqual([]);
    expect(result.evidence.lineageEdges).toEqual([]);
    expect(
      parseRealBuildCompiledPlacementLineage(
        decodeRealBuildAtomicCompiledBranchEvidenceWire(result.evidenceWire),
      ),
    ).toEqual(result.evidence);
    expect(() => executePreparedRealBuildAtomicCompiledBranchBatch(preparation, compiler)).toThrow(
      /reserved exactly once/iu,
    );
    expect(compiler).toHaveBeenCalledTimes(2);
  });

  it("catches hostile compiler-result traps after reservation without leaking a partial frontier", () => {
    const source = fixture(1);
    const hostileResult = new Proxy(
      { ok: false },
      {
        has() {
          throw new Error("hostile result trap secret");
        },
      },
    );
    const compiler = vi.fn(
      () => hostileResult,
    ) as unknown as typeof compileRealBuildAutomaticPlacement;
    const result = executeRealBuildAtomicCompiledBranchBatch(source.input, compiler);

    expect(result.status).toBe("failed");
    expect(result.evidence.terminalFailure).toMatchObject({
      phase: "evidence-closure",
      code: "compiled-evidence-closure-failed",
      attemptedUniqueTransitionNumber: 1,
    });
    expect(JSON.stringify(result.evidence)).not.toContain("hostile result trap secret");
    expect(result.evidence.searchReservation).toMatchObject({ admitted: true, reservedAfter: 1 });
    expect(result.evidence.childCandidates).toEqual([]);
    expect(result.evidence.uniqueTransitions).toEqual([]);
    expect(result.evidence.lineageEdges).toEqual([]);
  });

  it("attributes first-work replay corruption to unique ordinal one", () => {
    const source = fixture(1, createRealBuildPreparedSearchLedger(2));
    const firstOffer = source.enumeratedParents[0]!.candidates[0]!.offeredCandidates[0]!;
    source.enumeratedParents[0]!.candidates.push({
      partIds: ["second-physical-part"],
      offeredCandidates: [
        snapshotRealBuildEnumeratedPlacementOffer({
          ...firstOffer,
          transform: { positionLdu: [20, 0, 0], orientationId: "upright-yaw-0" },
        }),
      ],
    });
    const compiler = vi.fn(((input: Parameters<typeof compileRealBuildAutomaticPlacement>[0]) => {
      const row = input as Parameters<typeof compileRealBuildAutomaticPlacement>[0] & {
        readonly printedStep: { readonly sourceActionDigest: string };
      };
      return compileRealBuildAutomaticPlacement({
        ...row,
        printedStep: {
          name: "Corrupted first unique work",
          sourceActionDigest: row.printedStep.sourceActionDigest,
        },
      });
    }) as typeof compileRealBuildAutomaticPlacement);

    const result = executeRealBuildAtomicCompiledBranchBatch(source.input, compiler);
    expect(result.status).toBe("failed");
    expect(compiler).toHaveBeenCalledOnce();
    expect(result.evidence.terminalFailure).toMatchObject({
      phase: "evidence-closure",
      attemptedUniqueTransitionNumber: 1,
      uniquePhysicalTransitionCount: 2,
      proposalId: result.evidence.searchRequest.proposals[0]!.proposalId,
    });
    expect(result.evidence.uniqueTransitions).toEqual([]);
    expect(result.evidence.lineageEdges).toEqual([]);
  });
});
