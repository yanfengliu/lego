import { describe, expect, it, vi } from "vitest";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import {
  decodeRealBuildAtomicCompiledBranchEvidenceWire,
  executePreparedRealBuildAtomicCompiledBranchBatch,
} from "../e2e/real-build-atomic-compiled-branch-batch";
import { prepareRealBuildAtomicCompiledBranchBatch } from "../e2e/real-build-atomic-compiled-branch-batch-input";
import {
  compileRealBuildAtomicPhysicalWork,
  isRealBuildAtomicCompiledWorkResult,
} from "../e2e/real-build-atomic-compiled-branch-work";
import { parseRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage";
import { snapshotRealBuildEnumeratedPlacementOffer } from "../e2e/real-build-enumerated-placement-witness";
import { createRealBuildPreparedSearchLedger } from "../e2e/real-build-prepared-search-ledger";
import { inspectRealBuildPreparedStepInput } from "../e2e/real-build-prepared-step-authority";
import {
  preparedSearchEmptyParent,
  preparedSearchOptionsBytes,
} from "./real-build-prepared-search.fixture";

describe("atomic compiled real-build branch child-byte limit", () => {
  it("rejects an unbranded oversized compiler success before reading its document entries", () => {
    const source = prepareRealBuildAtomicCompiledBranchBatch({
      ...(() => {
        const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 1), 1);
        const parent = preparedSearchEmptyParent();
        const piece = preparedStep.expectedAtomicPieces[0]!;
        return {
          preparedStep,
          rootCandidate: {
            documentSnapshot: parent.documentSnapshot,
            identities: [parent.identity],
          },
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
      rootCandidate: {
        documentSnapshot: parent.documentSnapshot,
        identities: [parent.identity],
      },
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
});
