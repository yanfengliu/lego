import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { RealBuildAtomicCompiledBranchBatchPreparation } from "./real-build-atomic-compiled-branch-batch-input";
import { createRealBuildAtomicTerminalFailure } from "./real-build-atomic-compiled-branch-failure";
import type { RealBuildAtomicCompiledPhysicalWorkPlan } from "./real-build-atomic-compiled-branch-work";
import { parseRealBuildCompiledPlacementLineage } from "./real-build-compiled-placement-lineage";
import {
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
  type RealBuildCompiledPlacementLineageEvidence,
  type RealBuildCompiledPlacementTerminalFailure,
} from "./real-build-compiled-placement-lineage-types";
import {
  snapshotRealBuildPreparedSearchLedger,
  type RealBuildPreparedSearchReservation,
} from "./real-build-prepared-search-ledger";
import { encodeRealBuildSafeJson } from "./real-build-safe-json-bytes";

type TerminalEvidenceFactory = (
  reservation: RealBuildPreparedSearchReservation,
  terminalFailure: RealBuildCompiledPlacementTerminalFailure | null,
) => RealBuildCompiledPlacementLineageEvidence;

const MAXIMUM_SERIALIZED_FAILURE_ISSUE = intrinsicRealBuildFreeze({
  // A lone surrogate JSON-escapes to six ASCII bytes, so this is the exact
  // largest encoding admitted by the three stable issue character bounds.
  code: "\ud800".repeat(256),
  path: "\ud800".repeat(256),
  reason: "\ud800".repeat(1_024),
});

export function requireRealBuildAtomicCompiledLineageMaximumBytes(value: number): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES
  ) {
    throw new RangeError(
      `Atomic compiled lineage maximum bytes must be 1 through ${MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES}.`,
    );
  }
  return value;
}

export function serializeRealBuildAtomicCompiledPlacementLineageEvidence(
  evidence: RealBuildCompiledPlacementLineageEvidence,
): Uint8Array {
  return encodeRealBuildSafeJson(evidence);
}

function previewSearchReservation(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
): RealBuildPreparedSearchReservation {
  const state = snapshotRealBuildPreparedSearchLedger(preparation.ledger);
  const requested = preparation.searchInspection.offeredLineages;
  if (state.refused) {
    if (state.failedReservation === null) {
      throw new TypeError("A refused prepared search ledger must retain its terminal failure.");
    }
    return intrinsicRealBuildFreeze({
      admitted: false,
      refusal: "ledger-already-refused",
      reservedBefore: state.reserved,
      requested,
      reservedAfter: state.reserved,
      budget: state.budget,
      reservationNumber: state.reservationCount,
      terminalFailure: state.failedReservation,
    });
  }
  const reservationNumber = state.reservationCount + 1;
  if (requested > state.budget - state.reserved) {
    const terminalFailure = intrinsicRealBuildFreeze({
      preflightIdentity: preparation.searchInspection.preflightIdentity,
      reservationNumber,
      reservedBefore: state.reserved,
      requested,
      budget: state.budget,
    });
    return intrinsicRealBuildFreeze({
      admitted: false,
      refusal: "budget-exceeded",
      reservedBefore: state.reserved,
      requested,
      reservedAfter: state.reserved,
      budget: state.budget,
      reservationNumber,
      terminalFailure,
    });
  }
  return intrinsicRealBuildFreeze({
    admitted: true,
    refusal: null,
    reservedBefore: state.reserved,
    requested,
    reservedAfter: state.reserved + requested,
    budget: state.budget,
    reservationNumber,
    terminalFailure: null,
  });
}

/**
 * Proves the next refusal or largest admitted typed failure envelope before the
 * authoritative ledger is mutated. The returned reservation is preview-only.
 */
export function preflightRealBuildAtomicCompiledTerminalEnvelope(
  preparation: RealBuildAtomicCompiledBranchBatchPreparation,
  workPlan: RealBuildAtomicCompiledPhysicalWorkPlan,
  preparedStep: RealBuildCompiledPlacementLineageEvidence["preparedStep"],
  maximumCompiledLineageBytes: number,
  createEvidence: TerminalEvidenceFactory,
): RealBuildPreparedSearchReservation {
  const reservation = previewSearchReservation(preparation);
  if (reservation.admitted && workPlan.unique.length === 0) {
    throw new TypeError(
      "Atomic compiled terminal zero-frontier preflight requires at least one unique physical work before reservation.",
    );
  }
  const terminalFailures: readonly (RealBuildCompiledPlacementTerminalFailure | null)[] =
    reservation.admitted
      ? intrinsicRealBuildFreeze([
          createRealBuildAtomicTerminalFailure({
            preparation,
            preparedStep,
            reservation,
            workPlan,
            workIndex: workPlan.unique.length - 1,
            phase: "compilation",
            code: "automatic-compilation-failed",
            issue: MAXIMUM_SERIALIZED_FAILURE_ISSUE,
          }),
          createRealBuildAtomicTerminalFailure({
            preparation,
            preparedStep,
            reservation,
            workPlan,
            workIndex: workPlan.unique.length - 1,
            phase: "evidence-closure",
            code: "compiled-evidence-closure-failed",
            issue: MAXIMUM_SERIALIZED_FAILURE_ISSUE,
          }),
          createRealBuildAtomicTerminalFailure({
            preparation,
            preparedStep,
            reservation,
            workPlan,
            workIndex: null,
            phase: "aggregate-evidence-closure",
            code: "compiled-evidence-closure-failed",
            issue: MAXIMUM_SERIALIZED_FAILURE_ISSUE,
          }),
        ])
      : intrinsicRealBuildFreeze([null]);
  const candidates: Uint8Array[] = [];
  let requiredBytes = 0;
  for (let index = 0; index < terminalFailures.length; index += 1) {
    const bytes = serializeRealBuildAtomicCompiledPlacementLineageEvidence(
      createEvidence(reservation, terminalFailures[index]!),
    );
    candidates[index] = bytes;
    if (bytes.byteLength > requiredBytes) requiredBytes = bytes.byteLength;
  }
  if (requiredBytes > maximumCompiledLineageBytes) {
    throw new RangeError(
      `Atomic compiled terminal zero-frontier preflight requires ${requiredBytes} serialized bytes above maximum ${maximumCompiledLineageBytes}; no prepared search reservation or compiler work occurred.`,
    );
  }
  try {
    for (let index = 0; index < candidates.length; index += 1) {
      const bytes = candidates[index]!;
      // A maximum-width deterministic compiler issue is a sizing adversary, not
      // a truthful refusal for a proposal that may compile successfully here.
      // The two local-closure shapes and the budget refusal remain fully replayed.
      if (reservation.admitted && index === 0) continue;
      parseRealBuildCompiledPlacementLineage(bytes, maximumCompiledLineageBytes);
    }
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new TypeError(
      `Atomic compiled terminal zero-frontier preflight could not verify its exact serialized evidence before reservation; no prepared search reservation or compiler work occurred.${detail}`,
      { cause: error },
    );
  }
  return reservation;
}
