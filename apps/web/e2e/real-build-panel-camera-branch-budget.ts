export interface RealBuildPanelCameraBranchBudgetFailure {
  readonly reservedBefore: number;
  readonly requested: number;
  readonly budget: number;
}

/** One terminal-on-refusal allowance shared by panel-camera observation batches. */
export interface RealBuildPanelCameraBranchBudgetLedger {
  readonly budget: number;
  readonly reserved: number;
  readonly refusedReservation: boolean;
  readonly failedReservation: RealBuildPanelCameraBranchBudgetFailure | null;
  tryReserve(observationCount: number): boolean;
}

export function createRealBuildPanelCameraBranchBudgetLedger(
  budget: number,
): RealBuildPanelCameraBranchBudgetLedger {
  if (!Number.isSafeInteger(budget) || budget < 0) {
    throw new RangeError(
      `Panel-camera branch budget is ${String(budget)}; required a non-negative safe integer.`,
    );
  }
  let reserved = 0;
  let failedReservation: RealBuildPanelCameraBranchBudgetFailure | null = null;
  return Object.freeze({
    budget,
    get reserved() {
      return reserved;
    },
    get refusedReservation() {
      return failedReservation !== null;
    },
    get failedReservation() {
      return failedReservation;
    },
    tryReserve(observationCount: number): boolean {
      if (!Number.isSafeInteger(observationCount) || observationCount < 0) {
        throw new RangeError(
          `Panel-camera branch reservation is ${String(observationCount)}; required a non-negative safe integer.`,
        );
      }
      if (failedReservation !== null) return false;
      if (observationCount > budget - reserved) {
        failedReservation = Object.freeze({
          reservedBefore: reserved,
          requested: observationCount,
          budget,
        });
        return false;
      }
      reserved += observationCount;
      return true;
    },
  });
}
