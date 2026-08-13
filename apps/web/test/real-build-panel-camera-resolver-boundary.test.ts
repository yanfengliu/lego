import { describe, expect, it } from "vitest";

import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import { resolveRealBuildPanelCameraBranches } from "../e2e/real-build-panel-camera-resolver";
import {
  BUILT_MASK,
  HASH,
  OTHER_HASH,
  WEAKER_MASK,
  document,
  observedInput,
  prefix,
} from "./real-build-panel-camera-resolver.fixture";

describe("resolveRealBuildPanelCameraBranches hostile boundaries", () => {
  it("atomically refuses all eight branches before an empty seed or render can escape", () => {
    for (const empty of [false, true]) {
      let renders = 0;
      const ledger = createRealBuildPanelCameraBranchBudgetLedger(7);
      const result = resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        prefix: empty
          ? prefix({ throughStepNumber: 0, parentLineageId: null, document: document(0) })
          : prefix(),
        registrationPanelStepNumber: empty ? 1 : 6,
        ledger,
        renderModelMask: () => {
          renders += 1;
          return BUILT_MASK;
        },
      });

      expect(result.status).toBe("budget-refused");
      expect(result.seeds).toEqual([]);
      expect(result.observations).toEqual([]);
      expect(result.reservation.failure).toEqual({ reservedBefore: 0, requested: 8, budget: 7 });
      expect(result.failure?.stepNumber).toBe(empty ? 1 : 6);
      expect(ledger.reserved).toBe(0);
      expect(renders).toBe(0);
    }
  });

  it("rejects reservation answers that contradict the remaining capacity", () => {
    let overReserved = 0;
    const dishonestAcceptance = {
      budget: 7,
      get reserved() {
        return overReserved;
      },
      refusedReservation: false,
      failedReservation: null,
      tryReserve(count: number) {
        overReserved += count;
        return true;
      },
    };
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        ledger: dishonestAcceptance,
      }),
    ).toThrow(/non-atomic acceptance.*8 angular branches/su);

    let refused = false;
    const dishonestRefusal = {
      budget: 8,
      reserved: 0,
      get refusedReservation() {
        return refused;
      },
      get failedReservation() {
        return refused ? { reservedBefore: 0, requested: 8, budget: 8 } : null;
      },
      tryReserve() {
        refused = true;
        return false;
      },
    };
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        ledger: dishonestRefusal,
      }),
    ).toThrow(/non-atomic refusal.*8 angular branches/su);
  });

  it.each(["throw", "malformed"] as const)(
    "evaluates the full batch but authorizes no selection when one render is %s",
    (mode) => {
      let calls = 0;
      const result = resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        renderModelMask: ({ hypothesis }) => {
          calls += 1;
          if (hypothesis.latticeHand === "x-reflected" && hypothesis.turnDegrees === 270) {
            if (mode === "throw") throw new Error("GPU context disappeared");
            return new Uint8Array(3);
          }
          return hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
            ? BUILT_MASK
            : WEAKER_MASK;
        },
      });

      expect(calls).toBe(8);
      expect(result.status).toBe("failed");
      expect(result.failure).toMatchObject({ code: "rendering-error", stage: "rendering" });
      expect(result.failure?.stepNumber).toBe(6);
      expect(result.failure?.message).toMatch(
        /counterevidence.*incomplete batch authorizes no selection/su,
      );
      expect(result.attempts).toHaveLength(8);
      expect(result.observations).toHaveLength(7);
      expect(result.selectedObservationId).toBeNull();
    },
  );

  it("rejects a non-forward panel and a false document hash before budget or rendering", () => {
    let renders = 0;
    let hashes = 0;
    const backwardLedger = createRealBuildPanelCameraBranchBudgetLedger(8);
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        registrationPanelStepNumber: 4,
        ledger: backwardLedger,
        renderModelMask: () => {
          renders += 1;
          return BUILT_MASK;
        },
        hashDocument: () => {
          hashes += 1;
          return HASH;
        },
      }),
    ).toThrow(/registration panel 4 is not later than prefix step 5/su);
    expect(hashes).toBe(0);
    expect(renders).toBe(0);
    expect(backwardLedger.reserved).toBe(0);

    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        registrationPanelStepNumber: 5,
      }),
    ).toThrow(/registration panel 5 is not later than prefix step 5/su);

    const mismatchLedger = createRealBuildPanelCameraBranchBudgetLedger(8);
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        ledger: mismatchLedger,
        hashDocument: () => OTHER_HASH,
        renderModelMask: () => {
          renders += 1;
          return BUILT_MASK;
        },
      }),
    ).toThrow(/claims documentHash.*detached document hashes to.*no budget was reserved/su);
    expect(renders).toBe(0);
    expect(mismatchLedger.reserved).toBe(0);
  });

  it("detects renderer ledger poisoning instead of partially admitting observations", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(9);
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        ledger,
        renderModelMask: () => {
          expect(ledger.tryReserve(1)).toBe(true);
          return BUILT_MASK;
        },
      }),
    ).toThrow(/renderModelMask changed the shared ledger.*discard the mutated ledger/su);
    expect(ledger.reserved).toBe(9);
  });

  it("snapshots the reservation callback before hashing and surfaces throwing ledger mutation", () => {
    let firstReservationCalls = 0;
    let replacementCalls = 0;
    let reserved = 0;
    const ledger = {
      budget: 8,
      get reserved() {
        return reserved;
      },
      refusedReservation: false,
      failedReservation: null,
      tryReserve(count: number) {
        firstReservationCalls += 1;
        reserved += count;
        return true;
      },
    };
    const result = resolveRealBuildPanelCameraBranches({
      ...observedInput(),
      ledger,
      hashDocument: () => {
        ledger.tryReserve = () => {
          replacementCalls += 1;
          return false;
        };
        return HASH;
      },
    });
    expect(result.status).toBe("observed");
    expect(firstReservationCalls).toBe(1);
    expect(replacementCalls).toBe(0);

    let poisonedReserved = 0;
    const throwingLedger = {
      budget: 8,
      get reserved() {
        return poisonedReserved;
      },
      refusedReservation: false,
      failedReservation: null,
      tryReserve() {
        poisonedReserved = 1;
        throw new Error("reservation backend unavailable");
      },
    };
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        ledger: throwingLedger,
      }),
    ).toThrow(
      /tryReserve\(8\) threw an untrusted value.*thrown value was discarded.*ledger must be discarded/su,
    );
    expect(poisonedReserved).toBe(1);

    let malformedReserved = 0;
    const malformedLedger = {
      budget: 8,
      get reserved() {
        return malformedReserved;
      },
      refusedReservation: false,
      failedReservation: null,
      tryReserve() {
        malformedReserved = 2;
        return "accepted";
      },
    };
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        ledger: malformedLedger as never,
      }),
    ).toThrow(
      /returned "accepted".*State before.*reserved":0.*state after.*reserved":2.*discarded/su,
    );
  });

  it("snapshots raster evidence before the document-hash callback can mutate the caller", () => {
    const builtMask = new Uint8Array(BUILT_MASK);
    const excludedMask = new Uint8Array(4);
    const result = resolveRealBuildPanelCameraBranches({
      ...observedInput(),
      builtMask,
      excludedMask,
      hashDocument: () => {
        builtMask.fill(0);
        excludedMask.fill(1);
        return HASH;
      },
    });

    expect(result.status).toBe("observed");
    expect(result.attempts).toHaveLength(8);
    expect(result.selectedObservationId).toContain(":as-fitted:d1:p006:q000:");
  });

  it("bounds raster and root lineage inputs before callbacks", () => {
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        widthPx: 2,
        heightPx: 2,
        builtMask: new Uint8Array(3),
      }),
    ).toThrow(/builtMask.*exactly 4 pixels/su);
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        prefix: prefix({ throughStepNumber: 0, document: document(0) }),
        registrationPanelStepNumber: 1,
      }),
    ).toThrow(/step-0 root parentLineageId must be null/su);
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        prefix: prefix({ parentLineageId: "a".repeat(257) }),
      }),
    ).toThrow(/parentLineageId.*1-256 character ASCII lineage id/su);
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        prefix: prefix({ parentLineageId: "parent 🧱" }),
      }),
    ).toThrow(/parentLineageId.*ASCII lineage id/su);
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        prefix: prefix({ parentLineageId: "parent/child" }),
      }),
    ).toThrow(/parentLineageId.*ASCII lineage id/su);
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        prefix: prefix({ parentLineageId: null }),
      }),
    ).toThrow(/non-root prefix through step 5 requires a parentLineageId/su);
  });
});
