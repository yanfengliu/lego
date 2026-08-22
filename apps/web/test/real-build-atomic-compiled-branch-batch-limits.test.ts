import { describe, expect, it, vi } from "vitest";

import { canonicalBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import {
  decodeRealBuildAtomicCompiledBranchEvidenceWire,
  executePreparedRealBuildAtomicCompiledBranchBatch,
  requireRealBuildAtomicCompiledBranchBatchResult,
} from "../e2e/real-build-atomic-compiled-branch-batch";
import { prepareRealBuildAtomicCompiledBranchBatch } from "../e2e/real-build-atomic-compiled-branch-batch-input";
import {
  compileRealBuildAtomicPhysicalWork,
  isRealBuildAtomicCompiledWorkResult,
} from "../e2e/real-build-atomic-compiled-branch-work";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { realBuildDocumentCandidateId } from "../e2e/real-build-candidate-lineage-identity";
import { deriveRealBuildExactLineageIdentity } from "../e2e/real-build-exact-lineage-identity";
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
  preparedSearchParent,
} from "./real-build-prepared-search.fixture";

function compiledStepOneRoot(positionX: number) {
  const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 1), 1);
  const parent = preparedSearchEmptyParent();
  const piece = preparedStep.expectedAtomicPieces[0]!;
  const result = executePreparedRealBuildAtomicCompiledBranchBatch(
    prepareRealBuildAtomicCompiledBranchBatch({
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
          candidates: [
            {
              partIds: [`terminal-envelope-root-${positionX}`],
              offeredCandidates: [
                snapshotRealBuildEnumeratedPlacementOffer({
                  catalogPartId: piece.catalogPartId,
                  transform: {
                    positionLdu: [positionX, 0, 0],
                    orientationId: "upright-yaw-0",
                  },
                  connections: [],
                  restsOnBuildPlate: true,
                }),
              ],
            },
          ],
        },
      ],
      ledger: createRealBuildPreparedSearchLedger(1),
    }),
  );
  const child = result.evidence.childCandidates[0];
  const identity = result.evidence.lineageEdges[0]?.child;
  if (result.status !== "compiled" || child === undefined || identity === undefined) {
    throw new TypeError("Terminal-envelope fixture failed to compile its step-one root.");
  }
  return Object.freeze({
    documentSnapshot: createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: child.canonicalBytes,
      expectedDocumentHash: child.documentHash,
    }),
    identity,
  });
}

describe("atomic compiled real-build branch child-byte limit", () => {
  it("rejects an unbranded oversized compiler success before reading its document entries", () => {
    const source = prepareRealBuildAtomicCompiledBranchBatch({
      ...(() => {
        const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 1), 1);
        const parent = preparedSearchEmptyParent();
        const piece = preparedStep.expectedAtomicPieces[0]!;
        return {
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
              candidates: [
                {
                  partIds: ["hostile-success-part"],
                  offeredCandidates: [
                    snapshotRealBuildEnumeratedPlacementOffer({
                      catalogPartId: piece.catalogPartId,
                      transform: {
                        positionLdu: [0, 0, 0],
                        orientationId: "upright-yaw-0",
                      },
                      connections: [],
                      restsOnBuildPlate: true,
                    }),
                  ],
                },
              ],
            },
          ],
          ledger: createRealBuildPreparedSearchLedger(1),
        };
      })(),
    });
    let documentEntryReads = 0;
    const parts = new Array(10_001);
    Object.defineProperty(parts, "0", {
      enumerable: true,
      get() {
        documentEntryReads += 1;
        throw new Error("unbounded document entry must remain inert");
      },
    });
    const compiler = vi.fn(() => ({
      ok: true,
      document: { parts },
    })) as unknown as typeof compileRealBuildAutomaticPlacement;

    const result = executePreparedRealBuildAtomicCompiledBranchBatch(source, compiler);

    expect(result.status).toBe("failed");
    expect(compiler).toHaveBeenCalledOnce();
    expect(documentEntryReads).toBe(0);
    expect(result.evidence.terminalFailure).toMatchObject({
      phase: "evidence-closure",
      code: "compiled-evidence-closure-failed",
      attemptedUniqueTransitionNumber: 1,
    });
    expect(result.evidence.childCandidates).toEqual([]);
    expect(result.evidence.uniqueTransitions).toEqual([]);
    expect(result.evidence.lineageEdges).toEqual([]);
  });

  it("stops at the first child that crosses the aggregate cap and retains no frontier", () => {
    const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 1), 1);
    const parent = preparedSearchEmptyParent();
    const piece = preparedStep.expectedAtomicPieces[0]!;
    const candidates = [0, 20, 40].map((x, index) => ({
      partIds: [`bounded-child-${index}`],
      offeredCandidates: [
        snapshotRealBuildEnumeratedPlacementOffer({
          catalogPartId: piece.catalogPartId,
          transform: { positionLdu: [x, 0, 0], orientationId: "upright-yaw-0" },
          connections: [],
          restsOnBuildPlate: true,
        }),
      ],
    }));
    const preparation = prepareRealBuildAtomicCompiledBranchBatch({
      preparedStep,
      rootCandidates: [
        {
          documentSnapshot: parent.documentSnapshot,
          identities: [parent.identity],
        },
      ],
      enumeratedParents: [{ parentLineageId: parent.identity.lineageId, candidates }],
      ledger: createRealBuildPreparedSearchLedger(3),
    });
    const calibrated = compileRealBuildAtomicPhysicalWork(
      preparation,
      preparation.searchInspection.proposals[0]!,
      compileRealBuildAutomaticPlacement,
    );
    if (!isRealBuildAtomicCompiledWorkResult(calibrated)) {
      throw new TypeError("Child-byte limit fixture failed its first deterministic compilation.");
    }
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);

    const result = executePreparedRealBuildAtomicCompiledBranchBatch(
      preparation,
      compiler,
      calibrated.childCandidate.canonicalByteLength,
    );

    expect(result.status).toBe("failed");
    expect(compiler).toHaveBeenCalledTimes(2);
    expect(result.evidence.searchReservation).toMatchObject({
      admitted: true,
      requested: 3,
      reservedBefore: 0,
      reservedAfter: 3,
    });
    expect(result.evidence.terminalFailure).toMatchObject({
      phase: "evidence-closure",
      code: "compiled-evidence-closure-failed",
      attemptedUniqueTransitionNumber: 2,
      uniquePhysicalTransitionCount: 3,
      proposalId: result.evidence.searchRequest.proposals[1]!.proposalId,
      issue: {
        code: "LOCAL_EVIDENCE_CLOSURE_FAILED",
        path: "compiledLineage",
      },
    });
    expect(result.evidence.childCandidates).toEqual([]);
    expect(result.evidence.uniqueTransitions).toEqual([]);
    expect(result.evidence.lineageEdges).toEqual([]);
    expect(result.evidence.acceptedTransition).toBeNull();
    expect(result.acceptedDocument).toBeNull();
    expect(
      parseRealBuildCompiledPlacementLineage(
        decodeRealBuildAtomicCompiledBranchEvidenceWire(result.evidenceWire),
      ),
    ).toEqual(result.evidence);
  });

  it("does not converge identical witness bytes across distinct parent documents", () => {
    const first = preparedSearchParent();
    const secondDocument = {
      ...first.documentSnapshot.document,
      semanticRegions: [
        {
          id: "unrelated-distinct-root-region",
          label: "Unrelated distinct root region",
          partIds: ["base-part"],
        },
      ],
    };
    const secondHash = documentStructuralHash(secondDocument);
    const secondSnapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: canonicalBrickDocument(secondDocument),
      expectedDocumentHash: secondHash,
    });
    const second = Object.freeze({
      documentSnapshot: secondSnapshot,
      identity: deriveRealBuildExactLineageIdentity({
        candidateId: realBuildDocumentCandidateId(secondHash),
        documentHash: secondHash,
        documentSnapshot: secondSnapshot,
        parent: first.rootIdentity,
        throughStepNumber: 1,
        localIdentity: { kind: "decision", id: "same-witness-distinct-root" },
      }),
    });
    const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 2), 2);
    const piece = preparedStep.expectedAtomicPieces[0]!;
    const sharedOffer = snapshotRealBuildEnumeratedPlacementOffer({
      catalogPartId: piece.catalogPartId,
      transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
      connections: [
        {
          targetPartId: "base-part",
          targetPortId: "stud:0:0",
          candidatePortId: "undersideClutch:0:0",
        },
      ],
      restsOnBuildPlate: false,
    });
    const roots = [first, second];
    const preparation = prepareRealBuildAtomicCompiledBranchBatch({
      preparedStep,
      rootCandidates: roots.map(({ documentSnapshot, identity }) => ({
        documentSnapshot,
        identities: [identity],
      })),
      enumeratedParents: roots.map(({ identity }, index) => ({
        parentLineageId: identity.lineageId,
        candidates: [
          {
            partIds: [`same-witness-child-${index}`],
            offeredCandidates: [sharedOffer],
          },
        ],
      })),
      ledger: createRealBuildPreparedSearchLedger(2),
    });
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);

    const result = executePreparedRealBuildAtomicCompiledBranchBatch(preparation, compiler);

    expect(result.evidence.terminalFailure).toBeNull();
    expect(result.status).toBe("compiled");
    expect(compiler).toHaveBeenCalledTimes(2);
    expect(result.evidence.searchRequest.proposals[0]!.pieces).toEqual(
      result.evidence.searchRequest.proposals[1]!.pieces,
    );
    expect(result.evidence.uniqueTransitions).toHaveLength(2);
    expect(
      new Set(result.evidence.uniqueTransitions.map(({ parentCandidateId }) => parentCandidateId)),
    ).toHaveLength(2);
  });

  it("reserves distinct roots only after the exact terminal envelope fits", () => {
    const roots = [compiledStepOneRoot(0), compiledStepOneRoot(20)];
    const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 2), 2);
    const piece = preparedStep.expectedAtomicPieces[0]!;
    const createPreparation = (ledger: ReturnType<typeof createRealBuildPreparedSearchLedger>) =>
      prepareRealBuildAtomicCompiledBranchBatch({
        preparedStep,
        rootCandidates: roots.map(({ documentSnapshot, identity }) => ({
          documentSnapshot,
          identities: [identity],
        })),
        enumeratedParents: roots.map(({ documentSnapshot, identity }, index) => {
          const base = documentSnapshot.document.parts[0]!;
          const [x, y, z] = base.transform.positionLdu;
          return {
            parentLineageId: identity.lineageId,
            candidates: [
              {
                partIds: [`terminal-envelope-child-${index}`],
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
        }),
        ledger,
      });
    const ledger = createRealBuildPreparedSearchLedger(2);
    const preparation = createPreparation(ledger);
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);

    let requiredTerminalBytes = 0;
    try {
      executePreparedRealBuildAtomicCompiledBranchBatch(preparation, compiler, undefined, 1);
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      const match = /requires (\d+) serialized bytes/iu.exec((error as Error).message);
      requiredTerminalBytes = Number(match?.[1] ?? 0);
    }
    expect(requiredTerminalBytes).toBeGreaterThan(1);
    expect(compiler).not.toHaveBeenCalled();
    expect(snapshotRealBuildPreparedSearchLedger(ledger)).toMatchObject({
      reserved: 0,
      reservationCount: 0,
      refused: false,
    });
    expect(() =>
      executePreparedRealBuildAtomicCompiledBranchBatch(
        preparation,
        compiler,
        undefined,
        requiredTerminalBytes - 1,
      ),
    ).toThrow(`requires ${requiredTerminalBytes} serialized bytes`);
    expect(compiler).not.toHaveBeenCalled();
    expect(snapshotRealBuildPreparedSearchLedger(ledger).reservationCount).toBe(0);

    const originalArrayMap = Array.prototype.map;
    let poisonedEnvelopeError: unknown = null;
    try {
      Array.prototype.map = function <T, U>(
        this: T[],
        callback: (value: T, index: number, array: T[]) => U,
        thisArg?: unknown,
      ): U[] {
        const phase = Object.getOwnPropertyDescriptor(this[0] ?? {}, "phase")?.value;
        if (this.length === 3 && (phase === "compilation" || phase === "evidence-closure")) {
          return [];
        }
        return originalArrayMap.call(this, callback, thisArg) as U[];
      } as typeof Array.prototype.map;
      try {
        executePreparedRealBuildAtomicCompiledBranchBatch(
          preparation,
          compiler,
          undefined,
          requiredTerminalBytes - 1,
        );
      } catch (error) {
        poisonedEnvelopeError = error;
      }
    } finally {
      Array.prototype.map = originalArrayMap;
    }
    expect(poisonedEnvelopeError).toBeInstanceOf(RangeError);
    expect((poisonedEnvelopeError as Error).message).toContain(
      `requires ${requiredTerminalBytes} serialized bytes`,
    );
    expect(compiler).not.toHaveBeenCalled();
    expect(snapshotRealBuildPreparedSearchLedger(ledger).reservationCount).toBe(0);

    const result = executePreparedRealBuildAtomicCompiledBranchBatch(
      preparation,
      compiler,
      undefined,
      requiredTerminalBytes,
    );

    expect(requireRealBuildAtomicCompiledBranchBatchResult(result)).toBe(result);
    expect(result.status).toBe("failed");
    expect(compiler).toHaveBeenCalledTimes(2);
    expect(result.evidence.rootCandidates).toHaveLength(2);
    expect(result.evidence.searchReservation).toMatchObject({
      admitted: true,
      requested: 2,
      reservedBefore: 0,
      reservedAfter: 2,
      reservationNumber: 1,
    });
    expect(result.evidence.terminalFailure).toMatchObject({
      phase: "aggregate-evidence-closure",
      code: "compiled-evidence-closure-failed",
      attemptedUniqueTransitionNumber: null,
      uniquePhysicalTransitionCount: 2,
      proposalId: null,
    });
    expect(result.evidence.childCandidates).toEqual([]);
    expect(result.evidence.uniqueTransitions).toEqual([]);
    expect(result.evidence.lineageEdges).toEqual([]);
    expect(result.evidenceWire.byteLength).toBeLessThanOrEqual(requiredTerminalBytes);
    expect(snapshotRealBuildPreparedSearchLedger(ledger)).toMatchObject({
      reserved: 2,
      reservationCount: 1,
      refused: false,
    });
    expect(
      parseRealBuildCompiledPlacementLineage(
        decodeRealBuildAtomicCompiledBranchEvidenceWire(result.evidenceWire),
        requiredTerminalBytes,
      ),
    ).toEqual(result.evidence);

    const highLedger = createRealBuildPreparedSearchLedger(2);
    const highCompiler = vi.fn(compileRealBuildAutomaticPlacement);
    const highResult = executePreparedRealBuildAtomicCompiledBranchBatch(
      createPreparation(highLedger),
      highCompiler,
    );
    expect(highResult.status).toBe("compiled");
    expect(highCompiler).toHaveBeenCalledTimes(2);
    expect(highResult.evidenceWire.byteLength).toBeGreaterThan(requiredTerminalBytes);
    expect(snapshotRealBuildPreparedSearchLedger(highLedger)).toMatchObject({
      reserved: 2,
      reservationCount: 1,
      refused: false,
    });
  });
});
