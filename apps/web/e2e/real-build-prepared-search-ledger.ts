import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  requireRealBuildPreparedSearchBatchInspection,
  requireRealBuildPreparedSearchBatchPreflight,
  type RealBuildPreparedSearchBatchInspection,
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
  readonly preflightIdentity: `sha256:${string}`;
  readonly reservationNumber: number;
  readonly reservedBefore: number;
  readonly requested: number;
  readonly budget: number;
}

export interface RealBuildPreparedSearchReservation {
  readonly admitted: boolean;
  readonly refusal: null | "budget-exceeded" | "ledger-already-refused";
  readonly reservedBefore: number;
  readonly requested: number;
  readonly reservedAfter: number;
  readonly budget: number;
  readonly reservationNumber: number;
  readonly terminalFailure: RealBuildPreparedSearchReservationFailure | null;
}

interface MutableLedgerState {
  readonly budget: number;
  reserved: number;
  refused: boolean;
  reservationCount: number;
  failure: RealBuildPreparedSearchReservationFailure | null;
}

const states = new WeakMap<object, MutableLedgerState>();
const reservedBatches = new WeakSet<object>();
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_WEAK_MAP_GET = WeakMap.prototype.get;
const SAFE_WEAK_MAP_SET = WeakMap.prototype.set;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;

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
  const state = SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_GET, states, [value]) as
    MutableLedgerState | undefined;
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
  const ledger = intrinsicRealBuildFreeze({ budget: maximum }) as RealBuildPreparedSearchLedger;
  SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_SET, states, [
    ledger,
    {
      budget: maximum,
      reserved: 0,
      refused: false,
      reservationCount: 0,
      failure: null,
    },
  ]);
  return ledger;
}

export function snapshotRealBuildPreparedSearchLedger(
  value: unknown,
): RealBuildPreparedSearchLedgerSnapshot {
  const state = requireState(value);
  return intrinsicRealBuildFreeze({
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
  return reservePreparedSearchCount(
    state,
    preflight,
    preflight.preflightIdentity,
    preflight.offeredLineages,
    "preflight",
  );
}

function reservePreparedSearchCount(
  state: MutableLedgerState,
  batch: object,
  preflightIdentity: `sha256:${string}`,
  count: number,
  label: "preflight" | "inspection",
): RealBuildPreparedSearchReservation {
  if (SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, reservedBatches, [batch]) as boolean) {
    throw new TypeError(`Prepared search ${label} may be reserved exactly once.`);
  }
  SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, reservedBatches, [batch]);
  const reservedBefore = state.reserved;
  if (state.refused) {
    return intrinsicRealBuildFreeze({
      admitted: false,
      refusal: "ledger-already-refused",
      reservedBefore,
      requested: count,
      reservedAfter: reservedBefore,
      budget: state.budget,
      reservationNumber: state.reservationCount,
      terminalFailure: state.failure,
    });
  }
  state.reservationCount += 1;
  if (count > state.budget - reservedBefore) {
    state.refused = true;
    state.failure = intrinsicRealBuildFreeze({
      preflightIdentity,
      reservationNumber: state.reservationCount,
      requested: count,
      reservedBefore,
      budget: state.budget,
    });
    return intrinsicRealBuildFreeze({
      admitted: false,
      refusal: "budget-exceeded",
      reservedBefore,
      requested: count,
      reservedAfter: reservedBefore,
      budget: state.budget,
      reservationNumber: state.reservationCount,
      terminalFailure: state.failure,
    });
  }
  state.reserved += count;
  return intrinsicRealBuildFreeze({
    admitted: true,
    refusal: null,
    reservedBefore,
    requested: count,
    reservedAfter: state.reserved,
    budget: state.budget,
    reservationNumber: state.reservationCount,
    terminalFailure: null,
  });
}

/**
 * Reserves a complete inspection-only batch on the same aggregate ledger. This
 * grants budget state only; it cannot create prepared-step, search, score, or
 * completion authority.
 */
export function reserveRealBuildPreparedSearchInspectionBatch(
  value: unknown,
  suppliedInspection: unknown,
): RealBuildPreparedSearchReservation {
  const state = requireState(value);
  const inspection = requireRealBuildPreparedSearchBatchInspection(suppliedInspection);
  return reservePreparedSearchCount(
    state,
    inspection,
    inspection.preflightIdentity,
    inspection.offeredLineages,
    "inspection",
  );
}

export function isReservedRealBuildPreparedSearchBatchPreflight(
  value: RealBuildPreparedSearchBatchPreflight,
): boolean {
  return SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, reservedBatches, [value]) as boolean;
}

export function isReservedRealBuildPreparedSearchBatchInspection(
  value: RealBuildPreparedSearchBatchInspection,
): boolean {
  return SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, reservedBatches, [value]) as boolean;
}
