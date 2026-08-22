import { describe, expect, it, vi } from "vitest";

import {
  canonicalBrickDocument,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";

import { compileRealBuildAutomaticPlacement as compilePlacement } from "../e2e/real-build-automatic-placement-compiler";
import {
  executePreparedRealBuildAtomicCompiledBranchBatch,
  executeRealBuildAtomicCompiledBranchBatch as executeBatch,
  decodeRealBuildAtomicCompiledBranchEvidenceWire,
  requireRealBuildAtomicCompiledBranchBatchResult,
} from "../e2e/real-build-atomic-compiled-branch-batch";
import {
  prepareRealBuildAtomicCompiledBranchBatch,
  requireRealBuildAtomicCompiledBranchBatchPreparation,
} from "../e2e/real-build-atomic-compiled-branch-batch-input";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import {
  createRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
} from "../e2e/real-build-candidate-lineage-identity";
import {
  bindRealBuildExactRootLineageIdentity,
  deriveRealBuildExactLineageIdentity,
  snapshotRealBuildExactLineageIdentity,
} from "../e2e/real-build-exact-lineage-identity";
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
      bindRealBuildExactRootLineageIdentity({
        documentSnapshot: parent.documentSnapshot,
        identity: createRealBuildLineageIdentity({
          candidateId: parent.identity.candidateId,
          documentHash: parent.identity.documentHash,
          parent: null,
          throughStepNumber: 0,
          localIdentity: { kind: "evidence", id: `atomic-camera-root:${index + 1}` },
        }),
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
      rootCandidates: [{ documentSnapshot: parent.documentSnapshot, identities: roots }],
      enumeratedParents,
      ledger,
    },
  };
}

function compiledStepOneRoot(positionX: number) {
  const source = fixture(1);
  const piece = source.input.preparedStep.expectedAtomicPieces[0]!;
  source.enumeratedParents[0]!.candidates[0]!.offeredCandidates[0] =
    snapshotRealBuildEnumeratedPlacementOffer({
      catalogPartId: piece.catalogPartId,
      transform: { positionLdu: [positionX, 0, 0], orientationId: "upright-yaw-0" },
      connections: [],
      restsOnBuildPlate: true,
    });
  const result = executeBatch(source.input);
  const child = result.evidence.childCandidates[0];
  const identity = result.evidence.lineageEdges[0]?.child;
  if (result.status !== "compiled" || child === undefined || identity === undefined) {
    throw new TypeError("Distinct-root fixture failed to compile its exact step-one parent.");
  }
  return Object.freeze({
    documentSnapshot: createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: child.canonicalBytes,
      expectedDocumentHash: child.documentHash,
    }),
    identity,
  });
}

describe("atomic compiled real-build branch batch", () => {
  it("compiles one physical transition for eight roots while retaining eight distinct edges", () => {
    const source = fixture(8);
    const compiler = vi.fn(compilePlacement);
    const result = executeBatch(source.input, compiler);

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

  it("compiles distinct root documents as one globally reserved frontier", () => {
    const roots = [compiledStepOneRoot(0), compiledStepOneRoot(20)];
    const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 2), 2);
    const piece = preparedStep.expectedAtomicPieces[0]!;
    const enumeratedParents = roots.map(({ documentSnapshot, identity }, index) => {
      const base = documentSnapshot.document.parts[0]!;
      const [x, y, z] = base.transform.positionLdu;
      return {
        parentLineageId: identity.lineageId,
        candidates: [
          {
            partIds: [`distinct-root-step-two-${index}`],
            offeredCandidates: [
              snapshotRealBuildEnumeratedPlacementOffer({
                catalogPartId: piece.catalogPartId,
                transform: {
                  positionLdu: [x, y - 24, z],
                  orientationId: "upright-yaw-0",
                },
                connections: [
                  {
                    targetPartId: base.id,
                    targetPortId: "stud:0:0",
                    candidatePortId: "undersideClutch:0:0",
                  },
                ],
                restsOnBuildPlate: false,
              }),
            ],
          },
        ],
      };
    });
    const rootCandidates = roots.map(({ documentSnapshot, identity }) => ({
      documentSnapshot,
      identities: [identity],
    }));
    const refusedCompiler = vi.fn(compilePlacement);
    const refused = executeBatch(
      {
        preparedStep,
        rootCandidates,
        enumeratedParents,
        ledger: createRealBuildPreparedSearchLedger(1),
      },
      refusedCompiler,
    );
    expect(refused.status).toBe("budget-refused");
    expect(refusedCompiler).not.toHaveBeenCalled();
    expect(refused.evidence.searchReservation).toMatchObject({
      requested: 2,
      reservedBefore: 0,
      reservedAfter: 0,
      reservationNumber: 1,
      admitted: false,
    });

    const ledger = createRealBuildPreparedSearchLedger(2);
    const compiler = vi.fn(compilePlacement);
    const result = executeBatch(
      { preparedStep, rootCandidates, enumeratedParents, ledger },
      compiler,
    );

    expect(result.status).toBe("compiled");
    expect(compiler).toHaveBeenCalledTimes(2);
    expect(result.evidence.rootCandidates).toHaveLength(2);
    expect(result.evidence.searchReservation).toMatchObject({
      requested: 2,
      reservedBefore: 0,
      reservedAfter: 2,
      reservationNumber: 1,
      admitted: true,
    });
    expect(result.evidence.uniqueTransitions).toHaveLength(2);
    expect(result.evidence.childCandidates).toHaveLength(2);
    expect(result.evidence.lineageEdges).toHaveLength(2);
    expect(
      new Set(result.evidence.uniqueTransitions.map(({ parentCandidateId }) => parentCandidateId)),
    ).toHaveLength(2);
    expect(snapshotRealBuildPreparedSearchLedger(ledger)).toMatchObject({
      reserved: 2,
      reservationCount: 1,
      refused: false,
    });
    expect(
      parseRealBuildCompiledPlacementLineage(
        decodeRealBuildAtomicCompiledBranchEvidenceWire(result.evidenceWire),
      ),
    ).toEqual(result.evidence);
  });

  it("binds same-structural roots to distinct exact bytes and rejects cross-substitution", () => {
    const first = preparedSearchEmptyParent();
    const alternateDocument = {
      ...createEmptyBrickDocument({
        id: "alternate-exact-empty-parent",
        name: "Alternate exact empty parent",
        maxParts: 1_464,
      }),
      revision: "alternate-exact-revision",
    };
    const alternateHash = documentStructuralHash(alternateDocument);
    expect(alternateHash).toBe(first.identity.documentHash);
    const alternateSnapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: canonicalBrickDocument(alternateDocument),
      expectedDocumentHash: alternateHash,
    });
    const alternateIdentity = bindRealBuildExactRootLineageIdentity({
      documentSnapshot: alternateSnapshot,
      identity: createRealBuildLineageIdentity({
        candidateId: realBuildDocumentCandidateId(alternateHash),
        documentHash: alternateHash,
        parent: null,
        throughStepNumber: 0,
        localIdentity: { kind: "evidence", id: "alternate-exact-empty-root" },
      }),
    });
    const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 1), 1);
    const piece = preparedStep.expectedAtomicPieces[0]!;
    const offer = snapshotRealBuildEnumeratedPlacementOffer({
      catalogPartId: piece.catalogPartId,
      transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      connections: [],
      restsOnBuildPlate: true,
    });
    const enumeratedParents = [first.identity, alternateIdentity].map((identity) => ({
      parentLineageId: identity.lineageId,
      candidates: [
        {
          partIds: ["same-structural-exact-child"],
          offeredCandidates: [offer],
        },
      ],
    }));
    const refusedLedger = createRealBuildPreparedSearchLedger(2);
    expect(() =>
      prepareRealBuildAtomicCompiledBranchBatch({
        preparedStep,
        rootCandidates: [{ documentSnapshot: alternateSnapshot, identities: [first.identity] }],
        enumeratedParents: [enumeratedParents[0]],
        ledger: refusedLedger,
      }),
    ).toThrow(/does not bind this exact canonical document snapshot/iu);
    expect(snapshotRealBuildPreparedSearchLedger(refusedLedger).reservationCount).toBe(0);

    const compiler = vi.fn(compilePlacement);
    const result = executeBatch(
      {
        preparedStep,
        rootCandidates: [
          { documentSnapshot: first.documentSnapshot, identities: [first.identity] },
          { documentSnapshot: alternateSnapshot, identities: [alternateIdentity] },
        ],
        enumeratedParents,
        ledger: createRealBuildPreparedSearchLedger(2),
      },
      compiler,
    );
    expect(result.status).toBe("compiled");
    expect(compiler).toHaveBeenCalledTimes(2);
    expect(new Set(result.evidence.rootCandidates.map((root) => root.documentHash))).toHaveLength(
      1,
    );
    expect(
      new Set(result.evidence.rootCandidates.map((root) => root.canonicalBytesHash)),
    ).toHaveLength(2);
    expect(result.evidence.childCandidates).toHaveLength(2);
    expect(
      new Set(result.evidence.childCandidates.map((child) => child.canonicalBytesHash)),
    ).toHaveLength(2);

    const firstEdge = result.evidence.lineageEdges[0]!;
    const wrongChild = result.evidence.childCandidates[1]!;
    const wrongChildSnapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: wrongChild.canonicalBytes,
      expectedDocumentHash: wrongChild.documentHash,
    });
    const reboundWrongChild = deriveRealBuildExactLineageIdentity({
      candidateId: wrongChild.candidateId,
      documentHash: wrongChild.documentHash,
      documentSnapshot: wrongChildSnapshot,
      parent: snapshotRealBuildExactLineageIdentity(
        result.evidence.rootCandidates[0]!.identities[0]!,
      ),
      throughStepNumber: result.evidence.throughStepNumber,
      localIdentity: firstEdge.child.localIdentity,
    });
    expect(() =>
      parseRealBuildCompiledPlacementLineage(
        new TextEncoder().encode(
          JSON.stringify({
            ...result.evidence,
            lineageEdges: [
              { ...firstEdge, child: reboundWrongChild },
              ...result.evidence.lineageEdges.slice(1),
            ],
          }),
        ),
      ),
    ).toThrow(/does not bind the exact child bytes reproduced by its transition/iu);
  });

  it("requires convergent identities in one root group and exact frontier order", () => {
    const split = fixture(2);
    const [first, second] = split.input.rootCandidates[0]!.identities;
    expect(() =>
      prepareRealBuildAtomicCompiledBranchBatch({
        ...split.input,
        rootCandidates: [
          {
            documentSnapshot: split.input.rootCandidates[0]!.documentSnapshot,
            identities: [first],
          },
          {
            documentSnapshot: createRealBuildCandidateDocumentSnapshot({
              canonicalDocument: split.input.rootCandidates[0]!.documentSnapshot.canonicalBytes,
              expectedDocumentHash: split.input.rootCandidates[0]!.documentSnapshot.documentHash,
            }),
            identities: [second],
          },
        ],
      }),
    ).toThrow(/convergent exact lineages must share one group/iu);
    expect(snapshotRealBuildPreparedSearchLedger(split.ledger).reservationCount).toBe(0);

    const reordered = fixture(2);
    expect(() =>
      prepareRealBuildAtomicCompiledBranchBatch({
        ...reordered.input,
        enumeratedParents: [...reordered.input.enumeratedParents].reverse(),
      }),
    ).toThrow(/in retained frontier order/iu);
    expect(snapshotRealBuildPreparedSearchLedger(reordered.ledger).reservationCount).toBe(0);
  });

  it("refuses budget-minus-one before any compile and retains no partial child frontier", () => {
    const ledger = createRealBuildPreparedSearchLedger(7);
    const source = fixture(8, ledger);
    const compiler = vi.fn(compilePlacement);
    const result = executeBatch(source.input, compiler);

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
    const compiler = vi.fn(compilePlacement);
    const first = executeBatch(fixture(1, ledger).input, compiler);
    const second = executeBatch(fixture(1, ledger).input, compiler);
    const refused = executeBatch(fixture(2, ledger).input, compiler);
    const terminal = executeBatch(fixture(1, ledger).input, compiler);

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
    const compiler = vi.fn(compilePlacement);

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
    const result = executeBatch(source.input);
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
      rootCandidates: [{ ...bounded.input.rootCandidates[0]!, identities }],
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
      rootCandidates: [
        {
          documentSnapshot: parent.documentSnapshot,
          identities: [parent.identity],
        },
      ],
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
    const compiler = vi.fn(((input: Parameters<typeof compilePlacement>[0]) => {
      const row = input as {
        readonly documentSnapshot: unknown;
        readonly printedStepNumber: number;
        readonly printedStep: { readonly sourceActionDigest: string };
        readonly witnesses: readonly unknown[];
      };
      return compilePlacement({
        ...row,
        printedStep: {
          name: "Substituted compiler step",
          sourceActionDigest: row.printedStep.sourceActionDigest,
        },
      });
    }) as typeof compilePlacement);
    const failure = executeBatch(substituted.input, compiler);
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
    const result = executeBatch(fixture(1).input);
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

  it("keeps atomic provenance closed when WeakSet membership and WeakMap publication are poisoned", () => {
    const source = fixture(1);
    const retainedLineageId = source.input.rootCandidates[0]!.identities[0]!.lineageId;
    const originalWeakHas = WeakSet.prototype.has;
    const originalWeakMapSet = WeakMap.prototype.set;
    const originalMapHas = Map.prototype.has;
    const capturedWeakValues: unknown[] = [];
    let forgedPreparationError: unknown = null;
    let forgedResultError: unknown = null;
    let preparation: ReturnType<typeof prepareRealBuildAtomicCompiledBranchBatch> | undefined;
    try {
      WeakSet.prototype.has = () => true;
      WeakMap.prototype.set = function (key: object, value: unknown) {
        capturedWeakValues.push(value);
        return originalWeakMapSet.call(this, key, value);
      };
      preparation = prepareRealBuildAtomicCompiledBranchBatch(source.input);
      try {
        requireRealBuildAtomicCompiledBranchBatchPreparation({});
      } catch (error) {
        forgedPreparationError = error;
      }
      try {
        requireRealBuildAtomicCompiledBranchBatchResult({});
      } catch (error) {
        forgedResultError = error;
      }
    } finally {
      WeakSet.prototype.has = originalWeakHas;
      WeakMap.prototype.set = originalWeakMapSet;
    }
    const capturedPrivateMaps = capturedWeakValues.filter(
      (value) => value instanceof Map && originalMapHas.call(value, retainedLineageId),
    );
    expect(forgedPreparationError).toBeInstanceOf(TypeError);
    expect(forgedResultError).toBeInstanceOf(TypeError);
    expect(capturedPrivateMaps).toEqual([]);
    expect(() => requireRealBuildAtomicCompiledBranchBatchPreparation(preparation)).not.toThrow();
  });

  it("reserves the real private ledger and preserves exactly-once under poisoned WeakMap and WeakSet dispatch", () => {
    const source = fixture(1);
    const preparation = prepareRealBuildAtomicCompiledBranchBatch(source.input);
    const originalWeakMapGet = WeakMap.prototype.get;
    const originalWeakSetHas = WeakSet.prototype.has;
    let result: ReturnType<typeof executePreparedRealBuildAtomicCompiledBranchBatch> | undefined;
    try {
      WeakMap.prototype.get = function (key: object) {
        if (key === source.ledger) {
          return {
            budget: 1,
            reserved: 0,
            refused: false,
            reservationCount: 0,
            failure: null,
          };
        }
        return originalWeakMapGet.call(this, key);
      };
      result = executePreparedRealBuildAtomicCompiledBranchBatch(preparation);
    } finally {
      WeakMap.prototype.get = originalWeakMapGet;
    }
    expect(result?.evidence.searchReservation).toMatchObject({
      admitted: true,
      reservedBefore: 0,
      reservedAfter: 1,
      reservationNumber: 1,
    });
    expect(snapshotRealBuildPreparedSearchLedger(source.ledger)).toMatchObject({
      reserved: 1,
      reservationCount: 1,
      refused: false,
    });

    let repeatError: unknown = null;
    try {
      WeakSet.prototype.has = () => false;
      try {
        executePreparedRealBuildAtomicCompiledBranchBatch(preparation);
      } catch (error) {
        repeatError = error;
      }
    } finally {
      WeakSet.prototype.has = originalWeakSetHas;
    }
    expect(repeatError).toBeInstanceOf(TypeError);
    expect((repeatError as Error).message).toMatch(/reserved exactly once/iu);
    expect(snapshotRealBuildPreparedSearchLedger(source.ledger).reservationCount).toBe(1);
  });

  it("retains deeply immutable branded preparation and result graphs when Object.freeze is poisoned", () => {
    const source = fixture(1);
    const originalFreeze = Object.freeze;
    let preparation: ReturnType<typeof prepareRealBuildAtomicCompiledBranchBatch> | undefined;
    let result: ReturnType<typeof executePreparedRealBuildAtomicCompiledBranchBatch> | undefined;
    try {
      Object.freeze = ((value: unknown) => value) as typeof Object.freeze;
      preparation = prepareRealBuildAtomicCompiledBranchBatch(source.input);
      result = executePreparedRealBuildAtomicCompiledBranchBatch(preparation);
    } finally {
      Object.freeze = originalFreeze;
    }
    expect(Object.isFrozen(preparation)).toBe(true);
    expect(Object.isFrozen(preparation!.rootCandidates)).toBe(true);
    expect(Object.isFrozen(preparation!.searchInspection)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result!.evidence)).toBe(true);
    expect(Object.isFrozen(result!.evidence.rootCandidates)).toBe(true);
    expect(Object.isFrozen(result!.evidence.rootCandidates[0]!.identities[0]!)).toBe(true);
    expect(Object.isFrozen(result!.evidence.childCandidates[0]!)).toBe(true);
    expect(Reflect.set(result!.evidence, "throughStepNumber", 359)).toBe(false);
    expect(result!.evidence.throughStepNumber).toBe(1);
    expect(Reflect.set(result!, "acceptedDocument", {})).toBe(false);
    expect(result!.acceptedDocument).toBeNull();
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
    const compiler = vi.fn(((input: Parameters<typeof compilePlacement>[0]) => {
      call += 1;
      if (call === 2) throw new Error("hostile injected secret must not be serialized");
      return compilePlacement(input);
    }) as typeof compilePlacement);

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
    const originalIterator = Array.prototype[Symbol.iterator];
    const originalNumberIsFinite = Number.isFinite;
    let iteratorPoisoned = false;
    const compiler = vi.fn(() => {
      iteratorPoisoned = true;
      Array.prototype[Symbol.iterator] = function () {
        return {
          next: () => ({ done: true, value: undefined }),
          [Symbol.iterator]() {
            return this;
          },
        };
      } as (typeof Array.prototype)[typeof Symbol.iterator];
      Number.isFinite = () => {
        throw new Error("hostile numeric intrinsic trap secret");
      };
      throw new Error("hostile compiler trap secret");
    }) as unknown as typeof compilePlacement;
    let result: ReturnType<typeof executeBatch> | undefined;
    let escapedError: unknown = null;
    try {
      result = executeBatch(source.input, compiler);
    } catch (error) {
      escapedError = error;
    } finally {
      Array.prototype[Symbol.iterator] = originalIterator;
      Number.isFinite = originalNumberIsFinite;
    }
    expect(iteratorPoisoned).toBe(true);
    expect(escapedError).toBeNull();
    expect(result?.status).toBe("failed");
    expect(result!.evidence.terminalFailure).toMatchObject({
      phase: "evidence-closure",
      code: "compiled-evidence-closure-failed",
      attemptedUniqueTransitionNumber: 1,
    });
    expect(JSON.stringify(result!.evidence)).not.toContain("hostile compiler trap secret");
    expect(result!.evidence.searchReservation).toMatchObject({
      admitted: true,
      reservedAfter: 1,
    });
    expect(result!.evidence.childCandidates).toEqual([]);
    expect(result!.evidence.uniqueTransitions).toEqual([]);
    expect(result!.evidence.lineageEdges).toEqual([]);
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
    const compiler = vi.fn(((input: Parameters<typeof compilePlacement>[0]) => {
      const row = input as Parameters<typeof compilePlacement>[0] & {
        readonly printedStep: { readonly sourceActionDigest: string };
      };
      return compilePlacement({
        ...row,
        printedStep: {
          name: "Corrupted first unique work",
          sourceActionDigest: row.printedStep.sourceActionDigest,
        },
      });
    }) as typeof compilePlacement);

    const result = executeBatch(source.input, compiler);
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
