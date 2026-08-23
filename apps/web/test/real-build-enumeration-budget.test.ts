import { describe, expect, it } from "vitest";

import {
  createNarrowingRenderBudgetLedger,
  createNarrowingSubjectRenderBudgetLedger,
  createWholeStepCandidateBudgetLedger,
  enumerateWholeStepCandidates,
  type WholeStepPlacementTransform,
} from "../e2e/real-build-deferral";

describe("whole-step enumeration budgets and identical pieces", () => {
  type SyntheticDocument = { readonly placements: readonly string[] };

  const placement = (key: string): WholeStepPlacementTransform => ({
    positionLdu: [0, 0, 0],
    orientationId: key,
  });

  const placeSynthetic = (
    document: SyntheticDocument,
    _catalogPartId: string,
    transform: WholeStepPlacementTransform,
    _colorId: string,
    stepId: string | null,
  ) => ({
    document: { placements: [...document.placements, transform.orientationId] },
    partId: `part-${document.placements.length + 1}`,
    stepId: stepId ?? "synthetic-step",
  });

  it("shares one live reservation ledger and refuses an over-budget batch before rendering", () => {
    const ledger = createNarrowingRenderBudgetLedger(7);
    const narrowCalls: string[] = [];
    const narrow = (input: {
      readonly catalogPartId: string;
      readonly offered: readonly WholeStepPlacementTransform[];
    }) => {
      narrowCalls.push(
        `${input.catalogPartId}:${input.offered.map(({ orientationId }) => orientationId).join(",")}`,
      );
      return input.offered;
    };
    const shared = {
      baseDocument: { placements: [] } satisfies SyntheticDocument,
      stepId: null,
      narrow,
      narrowingRenderBudget: 100,
      narrowingRenderBudgetLedger: ledger,
      place: placeSynthetic,
      budget: 100,
    } as const;

    const firstParent = enumerateWholeStepCandidates({
      ...shared,
      pieces: [{ catalogPartId: "prefill", colorId: "black" }],
      enumerateDistinct: () => [placement("P"), placement("Q")],
    });
    expect(firstParent.overNarrowingBudget).toBe(false);
    expect(firstParent.candidates).toHaveLength(2);
    expect(ledger.reserved).toBe(2);

    const nextParent = enumerateWholeStepCandidates({
      ...shared,
      pieces: [
        { catalogPartId: "root", colorId: "black" },
        { catalogPartId: "child", colorId: "black" },
      ],
      enumerateDistinct: (_document, catalogPartId) =>
        catalogPartId === "root"
          ? [placement("A"), placement("B")]
          : [placement("C"), placement("D"), placement("E")],
    });

    // The root batch reserves two, and the first child batch reserves the final
    // three exactly. Its callback runs and produces complete candidates. The
    // next three-render batch is refused atomically before that callback fires.
    expect(narrowCalls).toEqual(["prefill:P,Q", "root:A,B", "child:C,D,E"]);
    expect(ledger.reserved).toBe(7);
    expect(nextParent.narrowingRenders).toBe(8);
    expect(nextParent.overNarrowingBudget).toBe(true);
    expect(nextParent.candidates).toEqual([]);
    expect(nextParent.exploredCandidates).toHaveLength(3);
    expect(ledger.failedReservation).toEqual({
      reservedBefore: 7,
      requested: 3,
      budget: 7,
    });
    const firstFailure = ledger.failedReservation;
    expect(Object.isFrozen(firstFailure)).toBe(true);
    expect(ledger.tryReserve(5)).toBe(false);
    expect(ledger.failedReservation).toBe(firstFailure);
  });

  it("keeps the local narrowing limit when no shared ledger is supplied", () => {
    let narrowCalls = 0;
    const enumeration = enumerateWholeStepCandidates<SyntheticDocument>({
      baseDocument: { placements: [] },
      stepId: null,
      pieces: [{ catalogPartId: "piece", colorId: "black" }],
      enumerateDistinct: () => [placement("A"), placement("B"), placement("C")],
      narrow: ({ offered }) => {
        narrowCalls += 1;
        return offered;
      },
      narrowingRenderBudget: 2,
      place: placeSynthetic,
      budget: 100,
    });

    expect(enumeration.narrowingRenders).toBe(3);
    expect(enumeration.overNarrowingBudget).toBe(true);
    expect(enumeration.candidates).toEqual([]);
    expect(narrowCalls).toBe(0);
  });

  it("leases the planned physical maximum before work and reports only charged renders", () => {
    const ledger = createNarrowingSubjectRenderBudgetLedger(5);
    const events: string[] = [];
    const enumeration = enumerateWholeStepCandidates<SyntheticDocument>({
      baseDocument: { placements: [] },
      stepId: null,
      pieces: [{ catalogPartId: "piece", colorId: "black" }],
      enumerateDistinct: () => [placement("A"), placement("B"), placement("C")],
      narrow: null,
      prepareNarrowing: ({ offered }) => {
        events.push("planned");
        return {
          maximumSubjectRenders: 5,
          execute: (lease) => {
            events.push("executed");
            lease.charge(2);
            return offered.slice(0, 2);
          },
        };
      },
      narrowingRenderBudget: 5,
      narrowingSubjectRenderBudgetLedger: ledger,
      place: placeSynthetic,
      budget: 100,
    });

    expect(events).toEqual(["planned", "executed"]);
    expect(enumeration).toMatchObject({
      overNarrowingBudget: false,
      narrowingRenders: 2,
      perPiece: [3],
      perPieceCarried: [2],
    });
    expect(enumeration.candidates.map(({ document }) => document.placements)).toEqual([
      ["A"],
      ["B"],
    ]);
    expect(ledger).toMatchObject({ committed: 2, held: 0, activeLease: false });
  });

  it("refuses a planned physical maximum before execute, placement, or partial frontier work", () => {
    const ledger = createNarrowingSubjectRenderBudgetLedger(4);
    let executeCalls = 0;
    let placeCalls = 0;
    const enumeration = enumerateWholeStepCandidates<SyntheticDocument>({
      baseDocument: { placements: [] },
      stepId: null,
      pieces: [{ catalogPartId: "piece", colorId: "black" }],
      enumerateDistinct: () => [placement("A"), placement("B"), placement("C")],
      narrow: null,
      prepareNarrowing: ({ offered }) => ({
        maximumSubjectRenders: 5,
        execute: () => {
          executeCalls += 1;
          return offered;
        },
      }),
      narrowingRenderBudget: 4,
      narrowingSubjectRenderBudgetLedger: ledger,
      place: (document, catalogPartId, transform, colorId, stepId) => {
        placeCalls += 1;
        return placeSynthetic(document, catalogPartId, transform, colorId, stepId);
      },
      budget: 100,
    });

    expect(executeCalls).toBe(0);
    expect(placeCalls).toBe(0);
    expect(enumeration).toMatchObject({
      overNarrowingBudget: true,
      narrowingRenders: 0,
      candidates: [],
      exploredCandidates: [],
    });
    expect(ledger.failedReservation).toEqual({ reservedBefore: 0, requested: 5, budget: 4 });
  });

  it("shares one aggregate complete-candidate budget without erasing earlier leaves", () => {
    const ledger = createWholeStepCandidateBudgetLedger(4);
    const placed: string[] = [];
    const shared = {
      baseDocument: { placements: [] } satisfies SyntheticDocument,
      stepId: null,
      narrow: null,
      narrowingRenderBudget: 100,
      candidateBudgetLedger: ledger,
      place: (
        document: SyntheticDocument,
        catalogPartId: string,
        transform: WholeStepPlacementTransform,
        colorId: string,
        stepId: string | null,
      ) => {
        placed.push(transform.orientationId);
        return placeSynthetic(document, catalogPartId, transform, colorId, stepId);
      },
      budget: 100,
    } as const;

    const firstParent = enumerateWholeStepCandidates({
      ...shared,
      pieces: [{ catalogPartId: "first", colorId: "black" }],
      enumerateDistinct: () => [placement("A"), placement("B")],
    });
    expect(firstParent.candidates).toHaveLength(2);
    expect(firstParent.overBudget).toBe(false);
    expect(ledger.reserved).toBe(2);

    const secondParent = enumerateWholeStepCandidates({
      ...shared,
      pieces: [{ catalogPartId: "second", colorId: "black" }],
      enumerateDistinct: () => [placement("C"), placement("D"), placement("E"), placement("F")],
    });

    expect(ledger.reserved).toBe(4);
    expect(secondParent.overBudget).toBe(true);
    expect(secondParent.candidates).toEqual([]);
    expect(secondParent.exploredCandidates.map(({ document }) => document.placements)).toEqual([
      ["C"],
      ["D"],
    ]);
    expect(ledger.failedReservation).toEqual({
      reservedBefore: 4,
      requested: 1,
      budget: 4,
    });
    const firstFailure = ledger.failedReservation;
    expect(Object.isFrozen(firstFailure)).toBe(true);
    expect(ledger.tryReserve(3)).toBe(false);
    expect(ledger.failedReservation).toBe(firstFailure);
    // The refused leaf is needed to prove the product exceeds the limit, but
    // traversal stops immediately and never starts the following placement.
    expect(placed).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("records the shared refusal when local and aggregate candidate limits are equal", () => {
    const ledger = createWholeStepCandidateBudgetLedger(2);
    const enumeration = enumerateWholeStepCandidates<SyntheticDocument>({
      baseDocument: { placements: [] },
      stepId: null,
      pieces: [{ catalogPartId: "piece", colorId: "black" }],
      enumerateDistinct: () => [placement("A"), placement("B"), placement("C")],
      narrow: null,
      narrowingRenderBudget: 10,
      candidateBudgetLedger: ledger,
      place: placeSynthetic,
      budget: 2,
    });

    expect(enumeration.overBudget).toBe(true);
    expect(enumeration.candidates).toEqual([]);
    expect(enumeration.exploredCandidates.map(({ document }) => document.placements)).toEqual([
      ["A"],
      ["B"],
    ]);
    expect(ledger).toMatchObject({
      budget: 2,
      reserved: 2,
      refusedReservation: true,
      failedReservation: {
        reservedBefore: 2,
        requested: 1,
        budget: 2,
      },
    });
  });

  it("makes both aggregate ledgers terminal after their first refused reservation", () => {
    const candidateLedger = createWholeStepCandidateBudgetLedger(10);
    const narrowingLedger = createNarrowingRenderBudgetLedger(10);
    expect(candidateLedger.tryReserve(3)).toBe(true);
    expect(narrowingLedger.tryReserve(4)).toBe(true);
    expect(candidateLedger.tryReserve(8)).toBe(false);
    expect(narrowingLedger.tryReserve(7)).toBe(false);

    const candidateFailure = candidateLedger.failedReservation;
    const narrowingFailure = narrowingLedger.failedReservation;
    expect(candidateLedger.tryReserve(1)).toBe(false);
    expect(narrowingLedger.tryReserve(1)).toBe(false);
    expect(candidateLedger.reserved).toBe(3);
    expect(narrowingLedger.reserved).toBe(4);
    expect(candidateLedger.failedReservation).toBe(candidateFailure);
    expect(narrowingLedger.failedReservation).toBe(narrowingFailure);
  });

  it("deduplicates identical-piece final occupancies without assuming placement commutativity", () => {
    const run = (reverseOffers: boolean, canonical: boolean) => {
      const ledger = createNarrowingRenderBudgetLedger(20);
      const narrowCalls: string[][] = [];
      const enumeration = enumerateWholeStepCandidates<SyntheticDocument>({
        baseDocument: { placements: [] },
        stepId: null,
        pieces: [
          { catalogPartId: "same-part", colorId: "same-color" },
          { catalogPartId: "same-part", colorId: "same-color" },
        ],
        enumerateDistinct: (document) => {
          const remaining = ["A", "B", "C"]
            .filter((key) => !document.placements.includes(key))
            .map(placement);
          return reverseOffers ? [...remaining].reverse() : remaining;
        },
        narrow: ({ offered }) => {
          narrowCalls.push(offered.map(({ orientationId }) => orientationId));
          return offered;
        },
        narrowingRenderBudget: 100,
        ...(canonical
          ? {
              narrowingRenderBudgetLedger: ledger,
              placementKey: (_catalogPartId: string, transform: WholeStepPlacementTransform) =>
                transform.orientationId,
            }
          : {}),
        place: placeSynthetic,
        budget: 100,
      });
      return {
        enumeration,
        ledger,
        narrowCalls,
        occupancies: enumeration.candidates.map(({ document }) =>
          [...document.placements].sort().join("+"),
        ),
      };
    };

    const forward = run(false, true);
    const reversed = run(true, true);
    for (const result of [forward, reversed]) {
      expect(result.enumeration.overNarrowingBudget).toBe(false);
      expect(result.enumeration.narrowingRenders).toBe(9);
      expect(result.ledger.reserved).toBe(9);
      expect([...result.occupancies].sort()).toEqual(["A+B", "A+C", "B+C"]);
    }
    expect([...reversed.occupancies].sort()).toEqual([...forward.occupancies].sort());

    // Omitting the injected key preserves the former ordered-piece product:
    // all six permutations remain, and their three second-piece batches count.
    const legacy = run(false, false);
    expect(legacy.enumeration.candidates).toHaveLength(6);
    expect(legacy.enumeration.narrowingRenders).toBe(9);
  });

  it("keeps the only valid identical-piece construction order", () => {
    const enumeration = enumerateWholeStepCandidates<SyntheticDocument>({
      baseDocument: { placements: [] },
      stepId: null,
      pieces: [
        { catalogPartId: "same-part", colorId: "same-color" },
        { catalogPartId: "same-part", colorId: "same-color" },
      ],
      enumerateDistinct: (document) =>
        document.placements.length === 0 ? [placement("Z")] : [placement("A")],
      narrow: null,
      narrowingRenderBudget: 10,
      placementKey: (_catalogPartId, transform) => transform.orientationId,
      place: placeSynthetic,
      budget: 10,
    });

    expect(enumeration.candidates.map(({ document }) => document.placements)).toEqual([["Z", "A"]]);
  });

  it("retains each chosen placement payload through every two-piece product branch", () => {
    type ConnectionRow = {
      readonly targetPartId: string;
      readonly targetPortId: string;
      readonly candidatePortId: string;
    };
    type OfferedPlacement = {
      readonly key: string;
      readonly transform: WholeStepPlacementTransform;
      readonly connections: readonly ConnectionRow[];
      readonly restsOnBuildPlate: boolean;
    };
    const offered = (
      key: string,
      orientationId: string,
      connections: readonly ConnectionRow[],
      restsOnBuildPlate: boolean,
    ): OfferedPlacement => ({
      key,
      transform: placement(orientationId),
      connections,
      restsOnBuildPlate,
    });
    const north = offered("north", "root-north", [], true);
    const south = offered("south", "root-south", [], true);
    const northLeft = offered(
      "north-left",
      "child-left",
      [{ targetPartId: "part-1", targetPortId: "north-stud", candidatePortId: "left-clutch" }],
      false,
    );
    const northRight = offered(
      "north-right",
      "child-right",
      [{ targetPartId: "part-1", targetPortId: "north-edge", candidatePortId: "right-clutch" }],
      false,
    );
    const southLeft = offered(
      "south-left",
      "child-left",
      [{ targetPartId: "part-1", targetPortId: "south-stud", candidatePortId: "left-clutch" }],
      false,
    );
    const southRight = offered(
      "south-right",
      "child-right",
      [{ targetPartId: "part-1", targetPortId: "south-edge", candidatePortId: "right-clutch" }],
      false,
    );

    const enumeration = enumerateWholeStepCandidates<SyntheticDocument, OfferedPlacement>({
      baseDocument: { placements: [] },
      stepId: null,
      pieces: [
        { catalogPartId: "root-part", colorId: "black" },
        { catalogPartId: "child-part", colorId: "red" },
      ],
      enumerateDistinct: (document, catalogPartId) =>
        catalogPartId === "root-part"
          ? [north, south]
          : document.placements[0] === "north"
            ? [northLeft, northRight]
            : [southLeft, southRight],
      narrow: ({ offered: branchOffers }) => branchOffers,
      narrowingRenderBudget: 10,
      transformOf: (candidate) => candidate.transform,
      snapshotOfferedCandidate: (candidate) =>
        Object.freeze({
          ...candidate,
          transform: Object.freeze({
            ...candidate.transform,
            positionLdu: Object.freeze([...candidate.transform.positionLdu]) as readonly [
              number,
              number,
              number,
            ],
          }),
          connections: Object.freeze(
            candidate.connections.map((connection) => Object.freeze({ ...connection })),
          ),
        }),
      placementKey: (_catalogPartId, transform) => transform.orientationId,
      place: (document, _catalogPartId, candidate, _colorId, stepId) => ({
        document: { placements: [...document.placements, candidate.key] },
        partId: `part-${document.placements.length + 1}`,
        stepId: stepId ?? "synthetic-step",
      }),
      budget: 10,
    });

    expect(enumeration.candidates.map(({ document }) => document.placements)).toEqual([
      ["north", "north-left"],
      ["north", "north-right"],
      ["south", "south-left"],
      ["south", "south-right"],
    ]);
    const byBranch = new Map(
      enumeration.candidates.map((candidate) => [
        candidate.document.placements.join("/"),
        candidate,
      ]),
    );
    const expectedPayloads = new Map<string, readonly [OfferedPlacement, OfferedPlacement]>([
      ["north/north-left", [north, northLeft]],
      ["north/north-right", [north, northRight]],
      ["south/south-left", [south, southLeft]],
      ["south/south-right", [south, southRight]],
    ]);
    for (const [branch, [rootPayload, childPayload]] of expectedPayloads) {
      const retained = byBranch.get(branch)?.offeredCandidates;
      expect(retained?.[0]).not.toBe(rootPayload);
      expect(retained?.[1]).not.toBe(childPayload);
      expect(retained?.[0]?.restsOnBuildPlate).toBe(true);
      expect(retained?.[1]?.restsOnBuildPlate).toBe(false);
    }
    expect(byBranch.get("north/north-left")?.offeredCandidates[1]?.connections).toEqual([
      { targetPartId: "part-1", targetPortId: "north-stud", candidatePortId: "left-clutch" },
    ]);
    expect(byBranch.get("south/south-left")?.offeredCandidates[1]?.connections).toEqual([
      { targetPartId: "part-1", targetPortId: "south-stud", candidatePortId: "left-clutch" },
    ]);
    expect(byBranch.get("north/north-left")?.transforms).toEqual([
      north.transform,
      northLeft.transform,
    ]);
    expect(enumeration.candidates).toHaveLength(4);
  });

  it("refuses duplicate transforms before opaque connection payloads can be collapsed", () => {
    type OfferedPlacement = {
      readonly transform: WholeStepPlacementTransform;
      readonly connections: readonly { readonly targetPartId: string }[];
    };
    const transform = placement("same-transform");
    let placeCalls = 0;

    expect(() =>
      enumerateWholeStepCandidates<SyntheticDocument, OfferedPlacement>({
        baseDocument: { placements: [] },
        stepId: null,
        pieces: [{ catalogPartId: "piece", colorId: "black" }],
        enumerateDistinct: () => [
          { transform, connections: [{ targetPartId: "first-parent" }] },
          { transform, connections: [{ targetPartId: "different-parent" }] },
        ],
        narrow: null,
        narrowingRenderBudget: 10,
        transformOf: (candidate) => candidate.transform,
        snapshotOfferedCandidate: (candidate) => Object.freeze({ ...candidate }),
        placementKey: (_catalogPartId, candidateTransform) => candidateTransform.orientationId,
        place: (document, _catalogPartId, _candidate, _colorId, stepId) => {
          placeCalls += 1;
          return {
            document,
            partId: "part-1",
            stepId: stepId ?? "synthetic-step",
          };
        },
        budget: 10,
      }),
    ).toThrowError(/each transform must have exactly one opaque candidate payload/u);
    expect(placeCalls).toBe(0);
  });
});
