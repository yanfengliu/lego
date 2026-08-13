import type { RealBuildLineageId } from "./real-build-candidate-lineage-identity";
import type { RealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type { FartherPlacementWitness } from "./real-build-farther-panel-types";

export const MAXIMUM_VALIDATED_FARTHER_BATCH_PARENTS = 8_192;
export const MAXIMUM_VALIDATED_FARTHER_BATCH_CHILDREN = 8_192;
export const MAXIMUM_VALIDATED_FARTHER_BATCH_WITNESSES = 32_768;
export const MAXIMUM_VALIDATED_FARTHER_PLACEMENT_PIECES = 1_024;

declare const fartherTransitionType: unique symbol;
declare const fartherTransitionBatchType: unique symbol;

/**
 * Reserved result of a future restricted BuildProgram compilation and hard-validation pass.
 * There is deliberately no public producer while only the manual placement command exists.
 */
export interface RealBuildValidatedFartherPlacementTransition {
  readonly parentLineageId: RealBuildLineageId;
  readonly throughStepNumber: number;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly pieces: readonly FartherPlacementWitness[];
  readonly [fartherTransitionType]: true;
}

/** One atomically preflighted transition set; individual rows are never independently issued. */
export interface RealBuildValidatedFartherPlacementTransitionBatch {
  readonly throughStepNumber: number;
  readonly transitions: readonly RealBuildValidatedFartherPlacementTransition[];
  readonly parentCount: number;
  readonly childCount: number;
  readonly witnessCount: number;
  readonly [fartherTransitionBatchType]: true;
}

const transitions = new WeakSet<object>();
const batches = new WeakSet<object>();

/**
 * Fail closed until restricted compilation can emit automatic provenance and bind the exact
 * prepared step, ledger reservation, retained parent snapshot, and aggregate byte/work budget.
 */
export function createRealBuildValidatedFartherPlacementTransitionBatch(
  ..._unavailable: readonly [unknown]
): RealBuildValidatedFartherPlacementTransitionBatch {
  void _unavailable;
  throw new TypeError(
    "Farther placement replay requires a restricted automatic BuildProgram compiler authority; the manual placement command cannot issue executable lineage transitions.",
  );
}

export function requireRealBuildValidatedFartherPlacementTransition(
  value: unknown,
  parentLineageId?: RealBuildLineageId,
): RealBuildValidatedFartherPlacementTransition {
  if (value === null || typeof value !== "object" || !transitions.has(value)) {
    throw new TypeError("Farther transition must be an exact member of a validated batch.");
  }
  const transition = value as RealBuildValidatedFartherPlacementTransition;
  if (parentLineageId !== undefined && transition.parentLineageId !== parentLineageId) {
    throw new TypeError("Farther transition must be an exact member of a validated batch.");
  }
  return transition;
}

export function requireRealBuildValidatedFartherPlacementTransitionBatch(
  value: unknown,
): RealBuildValidatedFartherPlacementTransitionBatch {
  if (value === null || typeof value !== "object" || !batches.has(value)) {
    throw new TypeError("Farther transition batch must be the exact result of bounded replay.");
  }
  return value as RealBuildValidatedFartherPlacementTransitionBatch;
}
