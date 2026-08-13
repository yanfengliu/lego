import {
  requireRealBuildPreparedSearchBatchPreflight,
  type RealBuildPreparedSearchBatchPreflight,
} from "./real-build-prepared-search-batch-authority";

export const MAXIMUM_REAL_BUILD_PREPARED_SEARCH_RESERVATIONS = 8_192;

declare const preparedSearchLedgerType: unique symbol;

export interface RealBuildPreparedSearchLedger {
  readonly budget: number;
  readonly [preparedSearchLedgerType]: true;
}

export interface RealBuildPreparedSearchLedgerSnapshot {
  readonly budget: number;
  readonly reserved: number;
  readonly refused: boolean;
  readonly reservationCount: number;
  readonly failedReservation: RealBuildPreparedSearchReservationFailure | null;
}

export interface RealBuildPreparedSearchReservationFailure {
  readonly reservedBefore: number;
  readonly requested: number;
  readonly budget: number;
}

export interface RealBuildPreparedSearchReservation {
  readonly admitted: boolean;
  readonly reservedBefore: number;
  readonly requested: number;
  readonly reservedAfter: number;
  readonly budget: number;
  readonly reservationNumber: number;
}

interface MutableLedgerState {
  readonly budget: number;
  reserved: number;
  refused: boolean;
  reservationCount: number;
  failure: RealBuildPreparedSearchReservationFailure | null;
}

const states = new WeakMap<object, MutableLedgerState>();
const reservedPreflights = new WeakSet<object>();

function requireCount(value: unknown, path: string): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_RESERVATIONS
  ) {
    throw new RangeError(
      `${path} must be a safe integer from 0 through ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_RESERVATIONS}.`,
    );
  }
  return value as number;
}

function requireState(value: unknown): MutableLedgerState {
  if (value === null || typeof value !== "object") {
    throw new TypeError("Prepared search ledger must be a module-created private ledger.");
  }
  const state = states.get(value);
  if (state === undefined) {
    throw new TypeError("Prepared search ledger must be a module-created private ledger.");
  }
  return state;
}

/** One terminal-on-refusal candidate allowance shared across prepared batches. */
export function createRealBuildPreparedSearchLedger(
  budget: unknown,
): RealBuildPreparedSearchLedger {
  const maximum = requireCount(budget, "Prepared search ledger budget");
  const ledger = Object.freeze({ budget: maximum }) as RealBuildPreparedSearchLedger;
  states.set(ledger, {
    budget: maximum,
    reserved: 0,
    refused: false,
    reservationCount: 0,
    failure: null,
  });
  return ledger;
}

export function snapshotRealBuildPreparedSearchLedger(
  value: unknown,
): RealBuildPreparedSearchLedgerSnapshot {
  const state = requireState(value);
  return Object.freeze({
    budget: state.budget,
    reserved: state.reserved,
    refused: state.refused,
    reservationCount: state.reservationCount,
    failedReservation: state.failure,
  });
}

/**
 * Atomically reserves one complete preflighted batch. This is budget state,
 * never evidence that placement replay or search correctness succeeded.
 */
export function reserveRealBuildPreparedSearchBatch(
  value: unknown,
  suppliedPreflight: unknown,
): RealBuildPreparedSearchReservation {
  const state = requireState(value);
  const preflight = requireRealBuildPreparedSearchBatchPreflight(suppliedPreflight);
  if (reservedPreflights.has(preflight)) {
    throw new TypeError("Prepared search preflight may be reserved exactly once.");
  }
  reservedPreflights.add(preflight);
  const count = preflight.offeredLineages;
  const reservedBefore = state.reserved;
  if (state.refused) {
    return Object.freeze({
      admitted: false,
      reservedBefore,
      requested: count,
      reservedAfter: reservedBefore,
      budget: state.budget,
      reservationNumber: state.reservationCount,
    });
  }
  state.reservationCount += 1;
  if (count > state.budget - reservedBefore) {
    state.refused = true;
    state.failure = Object.freeze({ requested: count, reservedBefore, budget: state.budget });
    return Object.freeze({
      admitted: false,
      reservedBefore,
      requested: count,
      reservedAfter: reservedBefore,
      budget: state.budget,
      reservationNumber: state.reservationCount,
    });
  }
  state.reserved += count;
  return Object.freeze({
    admitted: true,
    reservedBefore,
    requested: count,
    reservedAfter: state.reserved,
    budget: state.budget,
    reservationNumber: state.reservationCount,
  });
}

export function isReservedRealBuildPreparedSearchBatchPreflight(
  value: RealBuildPreparedSearchBatchPreflight,
): boolean {
  return reservedPreflights.has(value);
}
