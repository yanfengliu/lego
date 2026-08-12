import { describe, expect, it } from "vitest";

import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  admitRealBuildPanelCameraBranches,
  compareRealBuildPanelCameraObservationIds,
  createRealBuildPanelCameraBranchBudgetLedger,
  type RealBuildPanelCameraBranchBudgetLedger,
  type RealBuildPanelCameraBranchInput,
} from "../e2e/real-build-panel-camera-branches";
import { createRealBuildPanelCameraRegistration } from "../e2e/real-build-panel-camera-registration";

const HASH_A = `sha256:${"a".repeat(64)}` as Sha256Digest;
const HASH_B = `sha256:${"b".repeat(64)}` as Sha256Digest;

const registration = (
  latticeHand: "as-fitted" | "x-reflected" = "as-fitted",
  turnDegrees: 0 | 90 | 180 | 270 = 0,
  shiftPx: readonly [number, number] = [17, -23],
  registrationPanelStepNumber = 6,
) =>
  createRealBuildPanelCameraRegistration({
    latticeHand,
    latticeDeterminant: latticeHand === "as-fitted" ? 1 : -1,
    registrationPanelStepNumber,
    turnDegrees,
    shiftPx,
  });

type TestDocument = { name: string; nested: { values: number[] } };

const row = (
  overrides: Partial<RealBuildPanelCameraBranchInput<TestDocument>> = {},
): RealBuildPanelCameraBranchInput<TestDocument> => ({
  stepNumber: 5,
  document: { name: "candidate", nested: { values: [1, 2] } },
  documentHash: HASH_A,
  registration: registration(),
  silhouetteIou: 0.75,
  ...overrides,
});

const hashDocument = (document: TestDocument): Sha256Digest =>
  document.name === "candidate-b" ? HASH_B : HASH_A;

const admit = (input: {
  readonly rows: readonly RealBuildPanelCameraBranchInput<TestDocument>[];
  readonly ledger: RealBuildPanelCameraBranchBudgetLedger;
}) => admitRealBuildPanelCameraBranches({ ...input, hashDocument });

describe("real-build panel-camera branches", () => {
  it("detaches one immutable document observation without replacing its stable candidate ID", () => {
    const supplied = row();
    const result = admit({
      rows: [supplied],
      ledger: createRealBuildPanelCameraBranchBudgetLedger(1),
    });

    expect(result.status).toBe("admitted");
    const branch = result.branches[0]!;
    expect(branch.candidateId).toBe(`step-005:${HASH_A}`);
    expect(branch.observationId).toBe(
      `step-005:${HASH_A}:panel-camera:as-fitted:d1:p006:q000:x17:y-23`,
    );
    expect(branch.document).not.toBe(supplied.document);
    expect(branch.document).toEqual(supplied.document);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(branch.document)).toBe(true);
    expect(Object.isFrozen(branch.document.nested)).toBe(true);
    expect(Object.isFrozen(branch.document.nested.values)).toBe(true);
    expect(Object.isFrozen(branch.registration.shiftPx)).toBe(true);
    supplied.document.nested.values.push(3);
    expect(branch.document.nested.values).toEqual([1, 2]);
  });

  it("keeps one stable candidate while N+1 and K append distinct panel observations", () => {
    const result = admit({
      rows: [
        row({ registration: registration("as-fitted", 90, [17, -23], 6) }),
        row({ registration: registration("as-fitted", 90, [19, -21], 7) }),
      ],
      ledger: createRealBuildPanelCameraBranchBudgetLedger(2),
    });

    expect(new Set(result.branches.map(({ candidateId }) => candidateId))).toEqual(
      new Set([`step-005:${HASH_A}`]),
    );
    expect(new Set(result.branches.map(({ observationId }) => observationId)).size).toBe(2);
    expect(result.branches.map(({ observationId }) => observationId).join(" ")).toContain("p006");
    expect(result.branches.map(({ observationId }) => observationId).join(" ")).toContain("p007");
    expect(result.documentGroups).toHaveLength(1);
    expect(result.documentGroups[0]!.branches).toHaveLength(2);
  });

  it("groups equal hashes without collapsing opposite hands or quarter turns", () => {
    const result = admit({
      rows: [
        row({ registration: registration("x-reflected", 90) }),
        row({ registration: registration("as-fitted", 90) }),
        row({ registration: registration("as-fitted", 180) }),
        row({
          document: { name: "candidate-b", nested: { values: [1, 2] } },
          documentHash: HASH_B,
          registration: registration("as-fitted", 0),
        }),
      ],
      ledger: createRealBuildPanelCameraBranchBudgetLedger(4),
    });

    expect(result.documentGroups.map(({ documentHash }) => documentHash)).toEqual([HASH_A, HASH_B]);
    expect(result.documentGroups[0]!.branches).toHaveLength(3);
    expect(
      new Set(result.documentGroups[0]!.branches.map(({ observationId }) => observationId)),
    ).toHaveLength(3);
    expect(
      result.documentGroups[0]!.branches.map(
        ({ registration: value }) => `${value.latticeHand}:${value.turnDegrees}`,
      ),
    ).toEqual(["as-fitted:90", "as-fitted:180", "x-reflected:90"]);
  });

  it("rejects a duplicate exact observation before reserving", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(2);
    expect(() => admit({ rows: [row(), row()], ledger })).toThrow(
      /duplicate observation.*panel-camera.*p006/su,
    );
    expect(ledger.reserved).toBe(0);
    expect(ledger.failedReservation).toBeNull();
  });

  it("reserves the document-observation pair batch atomically", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(3);
    const first = admit({
      rows: [row(), row({ registration: registration("as-fitted", 90) })],
      ledger,
    });
    expect(first.reservation).toEqual({
      budget: 3,
      reservedBefore: 0,
      requested: 2,
      reservedAfter: 2,
      failure: null,
    });

    const refused = admit({
      rows: [
        row({ registration: registration("as-fitted", 180) }),
        row({ registration: registration("as-fitted", 270) }),
      ],
      ledger,
    });
    expect(refused.status).toBe("budget-refused");
    expect(refused.branches).toEqual([]);
    expect(ledger.reserved).toBe(2);
    expect(refused.reservation.failure).toEqual({ reservedBefore: 2, requested: 2, budget: 3 });
    const firstFailure = ledger.failedReservation;
    expect(ledger.tryReserve(0)).toBe(false);
    expect(ledger.failedReservation).toBe(firstFailure);
  });

  it("retains cross-hand ties but never promotes silhouette IoU to physical authority", () => {
    const tied = admit({
      rows: [
        row({ registration: registration("as-fitted", 90), silhouetteIou: 1 }),
        row({ registration: registration("x-reflected", 270), silhouetteIou: 1 }),
        row({ registration: registration("as-fitted", 0), silhouetteIou: 0.4 }),
      ],
      ledger: createRealBuildPanelCameraBranchBudgetLedger(3),
    });

    expect(tied.crossHandTies).toHaveLength(1);
    expect(tied.crossHandTies[0]!.observationIds).toHaveLength(2);
    expect(tied.handDecision).toEqual({
      status: "unresolved",
      selectedLatticeHand: null,
      reason: "silhouette-registration-is-not-physical-frame-authority",
    });

    const unequal = admit({
      rows: [
        row({ registration: registration("as-fitted"), silhouetteIou: 0.99 }),
        row({ registration: registration("x-reflected"), silhouetteIou: 0.1 }),
      ],
      ledger: createRealBuildPanelCameraBranchBudgetLedger(2),
    });
    expect(unequal.crossHandTies).toEqual([]);
    expect(unequal.handDecision.selectedLatticeHand).toBeNull();
  });

  it("orders observation IDs by Unicode code point rather than locale", () => {
    const bmpPrivateUse = "observation-\uE000";
    const astral = "observation-\u{1F600}";
    expect(compareRealBuildPanelCameraObservationIds(bmpPrivateUse, astral)).toBeLessThan(0);
    expect(compareRealBuildPanelCameraObservationIds(astral, bmpPrivateUse)).toBeGreaterThan(0);
    expect(compareRealBuildPanelCameraObservationIds(astral, astral)).toBe(0);
  });

  it("snapshots all rows before hash callbacks can mutate a later supplied row", () => {
    const rows = [
      row(),
      row({
        document: { name: "candidate-b", nested: { values: [4, 5] } },
        documentHash: HASH_B,
        registration: registration("as-fitted", 90),
      }),
    ];
    let calls = 0;
    const result = admitRealBuildPanelCameraBranches({
      rows,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(2),
      hashDocument(document) {
        calls += 1;
        if (calls === 1) {
          rows[1]!.document.name = "attacker-rewrite";
          (rows[1] as { documentHash: Sha256Digest }).documentHash = HASH_A;
        }
        return document.name === "candidate-b" ? HASH_B : HASH_A;
      },
    });

    expect(result.status).toBe("admitted");
    expect(result.documentGroups.map(({ documentHash }) => documentHash)).toEqual([HASH_A, HASH_B]);
    expect(result.branches.find(({ documentHash }) => documentHash === HASH_B)?.document.name).toBe(
      "candidate-b",
    );
  });

  it("rejects a hash callback that spends or poisons the shared ledger", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(2);
    expect(() =>
      admitRealBuildPanelCameraBranches({
        rows: [row()],
        ledger,
        hashDocument(document) {
          expect(ledger.tryReserve(1)).toBe(true);
          return hashDocument(document);
        },
      }),
    ).toThrow(/hashDocument changed the shared budget ledger.*mutated ledger must be discarded/su);
    expect(ledger.reserved).toBe(1);
  });

  it.each(["throw", "mismatch"] as const)(
    "reports ledger poisoning even when the hash callback would otherwise %s",
    (outcome) => {
      const ledger = createRealBuildPanelCameraBranchBudgetLedger(2);
      expect(() =>
        admitRealBuildPanelCameraBranches({
          rows: [row()],
          ledger,
          hashDocument() {
            expect(ledger.tryReserve(1)).toBe(true);
            if (outcome === "throw") throw new Error("hidden hash failure");
            return HASH_B;
          },
        }),
      ).toThrow(
        /hashDocument changed the shared budget ledger.*mutated ledger must be discarded/su,
      );
      expect(ledger.reserved).toBe(1);
    },
  );

  it("rejects false document hashes and mutable internal-slot objects before budget use", () => {
    const mismatchLedger = createRealBuildPanelCameraBranchBudgetLedger(1);
    expect(() =>
      admitRealBuildPanelCameraBranches({
        rows: [row()],
        ledger: mismatchLedger,
        hashDocument: () => HASH_B,
      }),
    ).toThrow(/claims documentHash.*detached document hashes to/su);
    expect(mismatchLedger.reserved).toBe(0);

    const nonJsonLedger = createRealBuildPanelCameraBranchBudgetLedger(1);
    expect(() =>
      admit({ rows: [row({ document: new Date(0) as never })], ledger: nonJsonLedger }),
    ).toThrow(/canonical plain JSON.*plain JSON object/su);
    expect(nonJsonLedger.reserved).toBe(0);
  });

  it("rejects malformed rows and hash failures before budget use", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(1);
    expect(() => admit({ rows: [row({ silhouetteIou: Number.NaN })], ledger })).toThrow(
      /silhouetteIou.*0 through 1.*NaN/su,
    );
    expect(() =>
      admitRealBuildPanelCameraBranches({
        rows: [row()],
        ledger,
        hashDocument: () => {
          throw new Error("hash unavailable");
        },
      }),
    ).toThrow(/hash verification failed.*hash unavailable/su);
    expect(ledger.reserved).toBe(0);
  });

  it("detects a non-atomic external ledger and copies coherent refusal witnesses", () => {
    const dishonest = {
      budget: 1,
      reserved: 0,
      refusedReservation: false,
      failedReservation: null,
      tryReserve: () => true,
    };
    expect(() =>
      admitRealBuildPanelCameraBranches({ rows: [row()], ledger: dishonest, hashDocument }),
    ).toThrow(/non-atomic acceptance.*reserved 1/su);

    const mutableFailure = { reservedBefore: 0, requested: 1, budget: 0 };
    let refused = false;
    const external = {
      budget: 0,
      get reserved() {
        return 0;
      },
      get refusedReservation() {
        return refused;
      },
      get failedReservation() {
        return refused ? mutableFailure : null;
      },
      tryReserve() {
        refused = true;
        return false;
      },
    };
    const result = admitRealBuildPanelCameraBranches({
      rows: [row()],
      ledger: external,
      hashDocument,
    });
    expect(result.reservation.failure).toEqual(mutableFailure);
    expect(result.reservation.failure).not.toBe(mutableFailure);
    mutableFailure.requested = 99;
    expect(result.reservation.failure?.requested).toBe(1);
  });

  it("bounds ledger inputs", () => {
    expect(() => createRealBuildPanelCameraBranchBudgetLedger(-1)).toThrow(
      /budget is -1.*non-negative safe integer/su,
    );
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(1);
    expect(() => ledger.tryReserve(0.5)).toThrow(/reservation is 0.5.*safe integer/su);
  });
});
