import { canonicalBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { createRealBuildLineageIdentity } from "../e2e/real-build-candidate-lineage-identity";
import {
  createRealBuildPreparedSearchBatchPreflight,
  inspectRealBuildPreparedSearchBatch,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS,
  requireRealBuildPreparedSearchBatchAuthority,
} from "../e2e/real-build-prepared-search-batch-authority";
import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES,
} from "../e2e/real-build-prepared-search-boundary";
import {
  createRealBuildPreparedSearchLedger,
  reserveRealBuildPreparedSearchBatch,
  snapshotRealBuildPreparedSearchLedger,
} from "../e2e/real-build-prepared-search-ledger";
import { inspectRealBuildPreparedStepInput } from "../e2e/real-build-prepared-step-authority";
import {
  preparedSearchOptionsBytes,
  preparedSearchEmptyParent,
  preparedSearchParent,
  preparedWitnesses,
} from "./real-build-prepared-search.fixture";

function inspectionInput(pieceCount = 1, children?: readonly unknown[]) {
  const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(pieceCount), 2);
  const parent = preparedSearchParent();
  return {
    preparedStep,
    parent,
    input: {
      preparedStep,
      parents: [
        {
          ...parent,
          children: children ?? [{ pieces: preparedWitnesses(pieceCount) }],
        },
      ],
    },
  };
}

describe("prepared search batch prerequisite", () => {
  it("retains exact parent snapshot references and derives proposal counts without authority", () => {
    const fixture = inspectionInput();
    const result = inspectRealBuildPreparedSearchBatch(fixture.input);

    expect(result).toMatchObject({
      stepNumber: 2,
      offeredLineages: 1,
      witnessCount: 1,
      connectionCount: 1,
      programOperationCount: 2,
      authority: "absent",
      refusal: "automatic-compiled-placement-authority-unavailable",
    });
    expect(result.parentBindings[0]).toMatchObject({
      parentLineageId: fixture.parent.identity.lineageId,
      offeredLineages: 1,
      canonicalDocumentDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    });
    expect(result.parentBindings[0]!.identity).toEqual(fixture.parent.identity);
    expect(result.parentBindings[0]!.identity).not.toBe(fixture.parent.identity);
    expect(result.parentBindings[0]!.documentSnapshot).toBe(fixture.parent.documentSnapshot);
    expect(result.proposals[0]!.pieces[0]).toMatchObject({
      identityKey: "direct-0",
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:black",
    });
    expect(result.proposals[0]!.proposalId).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(result.proposals[0]!.pieces[0]!.connections).toEqual([
      {
        target: { kind: "base", partId: "base-part" },
        targetPortId: "stud:0:0",
        candidatePortId: "undersideClutch:0:0",
        connectionKind: "stud-tube",
      },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.proposals[0]!.pieces)).toBe(true);
  });

  it("refuses convergent candidate/hash rows with differing canonical parent bytes", () => {
    const first = inspectionInput();
    const otherDocument = {
      ...first.parent.documentSnapshot.document,
      id: "cosmetically-different-parent",
      name: "Different cosmetic name",
    };
    expect(documentStructuralHash(otherDocument)).toBe(first.parent.identity.documentHash);
    const otherSnapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: canonicalBrickDocument(otherDocument),
      expectedDocumentHash: first.parent.identity.documentHash,
    });
    const secondRoot = createRealBuildLineageIdentity({
      candidateId: first.parent.rootIdentity.candidateId,
      documentHash: first.parent.rootIdentity.documentHash,
      parent: null,
      throughStepNumber: 0,
      localIdentity: { kind: "decision", id: "prepared-search-empty-root-bytes" },
    });
    const secondIdentity = createRealBuildLineageIdentity({
      candidateId: first.parent.identity.candidateId,
      documentHash: first.parent.identity.documentHash,
      parent: secondRoot,
      throughStepNumber: 1,
      localIdentity: { kind: "decision", id: "prepared-search-root-bytes" },
    });
    const differingInput = {
      preparedStep: first.preparedStep,
      parents: [
        {
          ...first.parent,
          children: [{ pieces: preparedWitnesses() }],
        },
        {
          identity: secondIdentity,
          documentSnapshot: otherSnapshot,
          children: [{ pieces: preparedWitnesses() }],
        },
      ],
    };

    expect(() => inspectRealBuildPreparedSearchBatch(differingInput)).toThrow(
      /share the exact branded parent snapshot reference/u,
    );
  });

  it("admits an inspection-only ground-supported first witness with zero connections", () => {
    const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 1), 1);
    const parent = preparedSearchEmptyParent();
    const pieces = preparedWitnesses(1, 1).map((piece) => ({ ...piece, connections: [] }));
    const result = inspectRealBuildPreparedSearchBatch({
      preparedStep,
      parents: [{ ...parent, children: [{ pieces }] }],
    });

    expect(result).toMatchObject({
      stepNumber: 1,
      witnessCount: 1,
      connectionCount: 0,
      programOperationCount: 1,
      authority: "absent",
    });
    expect(result.proposals[0]!.pieces[0]!.connections).toEqual([]);
  });

  it("reuses one exact canonical-byte binding across converged parent lineages", () => {
    const fixture = inspectionInput();
    const secondRoot = createRealBuildLineageIdentity({
      candidateId: fixture.parent.rootIdentity.candidateId,
      documentHash: fixture.parent.rootIdentity.documentHash,
      parent: null,
      throughStepNumber: 0,
      localIdentity: { kind: "decision", id: "prepared-search-empty-root-2" },
    });
    const secondIdentity = createRealBuildLineageIdentity({
      candidateId: fixture.parent.identity.candidateId,
      documentHash: fixture.parent.identity.documentHash,
      parent: secondRoot,
      throughStepNumber: 1,
      localIdentity: { kind: "decision", id: "prepared-search-root-2" },
    });
    const result = inspectRealBuildPreparedSearchBatch({
      preparedStep: fixture.preparedStep,
      parents: [
        {
          ...fixture.parent,
          children: [{ pieces: preparedWitnesses() }],
        },
        {
          identity: secondIdentity,
          documentSnapshot: fixture.parent.documentSnapshot,
          children: [{ pieces: preparedWitnesses() }],
        },
      ],
    });

    expect(result.offeredLineages).toBe(2);
    expect(result.parentBindings[0]!.canonicalDocumentDigest).toBe(
      result.parentBindings[1]!.canonicalDocumentDigest,
    );
    expect(result.parentBindings[0]!.documentSnapshot).toBe(
      result.parentBindings[1]!.documentSnapshot,
    );
    expect(result.proposals[0]!.proposalId).not.toBe(result.proposals[1]!.proposalId);
  });

  it("uses one descriptor/index plan and never enumerates caller keys", () => {
    const fixture = inspectionInput();
    const witness = { pieces: preparedWitnesses() };
    let parentLengthReads = 0;
    let childLengthReads = 0;
    let pieceLengthReads = 0;
    let ownKeyCalls = 0;
    const tracked = (value: unknown[], count: () => void) =>
      new Proxy(value, {
        getOwnPropertyDescriptor(target, key) {
          if (key === "length") count();
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        ownKeys() {
          ownKeyCalls += 1;
          throw new Error("must not enumerate");
        },
      });
    const pieces = tracked(witness.pieces as unknown[], () => {
      pieceLengthReads += 1;
    });
    const children = tracked([{ pieces }], () => {
      childLengthReads += 1;
    });
    const parents = tracked([{ ...fixture.parent, children }], () => {
      parentLengthReads += 1;
    });
    const envelope = new Proxy(
      { preparedStep: fixture.preparedStep, parents },
      {
        ownKeys() {
          ownKeyCalls += 1;
          throw new Error("must not enumerate");
        },
      },
    );

    expect(inspectRealBuildPreparedSearchBatch(envelope).offeredLineages).toBe(1);
    expect({ parentLengthReads, childLengthReads, pieceLengthReads, ownKeyCalls }).toEqual({
      parentLengthReads: 1,
      childLengthReads: 1,
      pieceLengthReads: 1,
      ownKeyCalls: 0,
    });
  });

  it("refuses duplicate or relabelled witness sequences", () => {
    const witness = { pieces: preparedWitnesses() };
    expect(() =>
      inspectRealBuildPreparedSearchBatch(inspectionInput(1, [witness, witness]).input),
    ).toThrow(/repeats an exact parent and witness sequence/u);
    const mismatched = preparedWitnesses().map((piece) => ({
      ...piece,
      identityKey: "caller-selected-identity",
    }));
    expect(() =>
      inspectRealBuildPreparedSearchBatch(inspectionInput(1, [{ pieces: mismatched }]).input),
    ).toThrow(/does not match prepared identity/u);

    const forward = preparedWitnesses(2);
    const first = forward[0]!;
    const forwardReference = [
      {
        ...first,
        connections: [
          {
            target: { kind: "witness", witnessIndex: 1 },
            targetPortId: "stud-forward",
            candidatePortId: "undersideClutch:0:0",
            connectionKind: "stud-tube",
          },
        ],
      },
      forward[1]!,
    ];
    expect(() =>
      inspectRealBuildPreparedSearchBatch(inspectionInput(2, [{ pieces: forwardReference }]).input),
    ).toThrow(/must name an earlier witness/u);

    const duplicatePorts = preparedWitnesses().map((piece) => ({
      ...piece,
      connections: [...piece.connections, piece.connections[0]!],
    }));
    expect(() =>
      inspectRealBuildPreparedSearchBatch(inspectionInput(1, [{ pieces: duplicatePorts }]).input),
    ).toThrow(/reuses an occupied connection port/u);

    const detachedBase = preparedWitnesses().map((piece) => ({
      ...piece,
      connections: piece.connections.map((connection) => ({
        ...connection,
        target: { kind: "base", partId: "not-in-parent" },
      })),
    }));
    expect(() =>
      inspectRealBuildPreparedSearchBatch(inspectionInput(1, [{ pieces: detachedBase }]).input),
    ).toThrow(/is not an exact part in the bound parent snapshot/u);

    const connection = preparedWitnesses()[0]!.connections[0]!;
    let connectionIndexInspections = 0;
    let connectionOwnKeyCalls = 0;
    const hostileOversizeConnections = new Proxy(
      new Array(MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS + 1),
      {
        getOwnPropertyDescriptor(target, key) {
          if (key !== "length") connectionIndexInspections += 1;
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        ownKeys() {
          connectionOwnKeyCalls += 1;
          throw new Error("must not enumerate oversize connections");
        },
      },
    );
    const tooManyConnections = preparedWitnesses().map((piece) => ({
      ...piece,
      connections: hostileOversizeConnections,
    }));
    expect(() =>
      inspectRealBuildPreparedSearchBatch(
        inspectionInput(1, [{ pieces: tooManyConnections }]).input,
      ),
    ).toThrow(/connections must contain/u);
    expect({ connectionIndexInspections, connectionOwnKeyCalls }).toEqual({
      connectionIndexInspections: 0,
      connectionOwnKeyCalls: 0,
    });

    const tooManyOperations = preparedWitnesses(2).map((piece, index) => ({
      ...piece,
      connections:
        index === 0
          ? new Array(1_023).fill(0).map((_, connectionIndex) => ({
              ...connection,
              targetPortId: `stud:${connectionIndex}:0`,
              candidatePortId: `undersideClutch:${connectionIndex}:0`,
            }))
          : piece.connections,
    }));
    expect(() =>
      inspectRealBuildPreparedSearchBatch(
        inspectionInput(2, [{ pieces: tooManyOperations }]).input,
      ),
    ).toThrow(/automatic compiler limit is 1024/u);
  });

  it("checks parent, child, and aggregate witness bounds before identity inspection", () => {
    const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(5), 2);
    let identityReads = 0;
    const hostileParent = (children: unknown[]) => {
      const row = { children } as Record<string, unknown>;
      Object.defineProperty(row, "identity", {
        enumerable: true,
        get() {
          identityReads += 1;
          throw new Error("must remain inert");
        },
      });
      Object.defineProperty(row, "documentSnapshot", { enumerable: true, value: {} });
      return row;
    };
    expect(() =>
      inspectRealBuildPreparedSearchBatch({
        preparedStep,
        parents: new Array(MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS + 1),
      }),
    ).toThrow(/Prepared search parents must contain/u);
    expect(() =>
      inspectRealBuildPreparedSearchBatch({
        preparedStep,
        parents: [hostileParent(new Array(MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN + 1))],
      }),
    ).toThrow(/children must contain/u);
    const child = { pieces: preparedWitnesses(5) };
    const overWitnessCount = Math.floor(MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES / 5) + 1;
    expect(() =>
      inspectRealBuildPreparedSearchBatch({
        preparedStep,
        parents: [hostileParent(new Array(overWitnessCount).fill(child))],
      }),
    ).toThrow(/witness total exceeds/u);

    const twoPieceStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(2), 2);
    const [firstPiece, secondPiece] = preparedWitnesses(2);
    const connection = firstPiece!.connections[0]!;
    const fullProgram = {
      pieces: [
        { ...firstPiece!, connections: new Array(1_022).fill(connection) },
        { ...secondPiece!, connections: [] },
      ],
    };
    const tooManyPrograms = new Array(
      Math.floor(MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS / 1_024) + 1,
    ).fill(fullProgram);
    expect(() =>
      inspectRealBuildPreparedSearchBatch({
        preparedStep: twoPieceStep,
        parents: [hostileParent(tooManyPrograms)],
      }),
    ).toThrow(/aggregate program operations exceed/u);
    expect(identityReads).toBe(0);
  });

  it("keeps transition issuance and ledger reservation fail-closed", () => {
    const fixture = inspectionInput();
    const inspection = inspectRealBuildPreparedSearchBatch(fixture.input);
    const ledger = createRealBuildPreparedSearchLedger(4);

    expect(() => createRealBuildPreparedSearchBatchPreflight(fixture.input)).toThrow(
      /private result of bounded run-input preflight/u,
    );
    expect(() => reserveRealBuildPreparedSearchBatch(ledger, inspection)).toThrow(
      /trusted prepared-step authority/u,
    );
    expect(() => requireRealBuildPreparedSearchBatchAuthority(inspection)).toThrow(
      /unavailable until automatic compiled-patch replay/u,
    );
    expect(snapshotRealBuildPreparedSearchLedger(ledger)).toEqual({
      budget: 4,
      reserved: 0,
      refused: false,
      reservationCount: 0,
      failedReservation: null,
    });
  });
});
