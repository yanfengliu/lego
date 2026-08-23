import type { BudgetReservationFailure } from "./real-build-deferral";

export interface NarrowingSubjectRenderLease {
  readonly maximum: number;
  readonly charged: number;
  charge(renderCount: number): void;
}

export type NarrowingSubjectRenderLeaseAttempt<T> =
  | {
      readonly admitted: true;
      readonly value: T;
      readonly charged: number;
      readonly released: number;
    }
  | { readonly admitted: false; readonly failure: BudgetReservationFailure };

export interface NarrowingSubjectRenderBudgetLedger {
  readonly budget: number;
  readonly committed: number;
  readonly held: number;
  readonly activeLease: boolean;
  readonly refusedReservation: boolean;
  readonly failedReservation: BudgetReservationFailure | null;
  tryLease<T>(
    maximumRenderCount: number,
    work: (lease: NarrowingSubjectRenderLease) => T,
  ): NarrowingSubjectRenderLeaseAttempt<T>;
}

function requireSubjectRenderCount(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${label} is ${String(value)}; required a non-negative safe integer render count.`,
    );
  }
  return value;
}

/** Holds a worst-case subject-render cost before synchronous work and commits only charged work. */
export function createNarrowingSubjectRenderBudgetLedger(
  suppliedBudget: number,
): NarrowingSubjectRenderBudgetLedger {
  const budget = requireSubjectRenderCount(suppliedBudget, "Narrowing subject-render budget");
  let committed = 0;
  let held = 0;
  let activeToken: object | null = null;
  let activeMaximum = 0;
  let failedReservation: BudgetReservationFailure | null = null;
  return Object.freeze({
    budget,
    get committed() {
      return committed;
    },
    get held() {
      return held;
    },
    get activeLease() {
      return activeToken !== null;
    },
    get refusedReservation() {
      return failedReservation !== null;
    },
    get failedReservation() {
      return failedReservation;
    },
    tryLease<T>(
      suppliedMaximum: number,
      work: (lease: NarrowingSubjectRenderLease) => T,
    ): NarrowingSubjectRenderLeaseAttempt<T> {
      const maximum = requireSubjectRenderCount(
        suppliedMaximum,
        "Narrowing subject-render lease maximum",
      );
      if (typeof work !== "function") {
        throw new TypeError(
          "Narrowing subject-render lease requires a synchronous work callback so unused capacity can be released when it returns.",
        );
      }
      if (activeToken !== null) {
        throw new TypeError(
          `Cannot open a narrowing subject-render lease for ${maximum} render(s) while another lease is active with ${held} of ${activeMaximum} render(s) still held. Finish the active lease callback first.`,
        );
      }
      if (failedReservation !== null) {
        return Object.freeze({ admitted: false, failure: failedReservation });
      }
      if (maximum > budget - committed) {
        failedReservation = Object.freeze({
          reservedBefore: committed,
          requested: maximum,
          budget,
        });
        return Object.freeze({ admitted: false, failure: failedReservation });
      }
      const token = Object.freeze({});
      let charged = 0;
      activeToken = token;
      activeMaximum = maximum;
      held = maximum;
      const lease = Object.freeze({
        maximum,
        get charged() {
          return charged;
        },
        charge(suppliedCount: number): void {
          const count = requireSubjectRenderCount(
            suppliedCount,
            "Narrowing subject-render lease charge",
          );
          if (activeToken !== token) {
            throw new TypeError(
              "Cannot charge a closed narrowing subject-render lease; charge synchronously inside its lease callback.",
            );
          }
          if (count > maximum - charged) {
            throw new RangeError(
              `Narrowing subject-render lease maximum is ${maximum}; ${charged} render(s) are already charged, so charging ${count} more would exceed the lease by ${count - (maximum - charged)}. Increase the pre-work maximum instead.`,
            );
          }
          charged += count;
          committed += count;
          held -= count;
        },
      } satisfies NarrowingSubjectRenderLease);
      try {
        const value = work(lease);
        return Object.freeze({
          admitted: true,
          value,
          charged,
          released: maximum - charged,
        });
      } finally {
        held = 0;
        activeMaximum = 0;
        activeToken = null;
      }
    },
  });
}
