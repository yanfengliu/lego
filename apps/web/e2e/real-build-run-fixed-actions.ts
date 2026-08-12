import {
  executeRealBuildFixedActionWithPhysicalAuthority,
  type RealBuildFixedActionKind,
} from "./real-build-fixed-frame-authority";
import type { StepFailure } from "./real-build-safety";

export interface RealBuildRunFixedActionInput<T> {
  readonly stepNumber: number;
  readonly actionKind: RealBuildFixedActionKind;
  readonly sourceDocumentHash: string;
  readonly frameDecision: unknown;
  /** The exact printed-step base retained when authority is refused. */
  readonly rollbackDocument: T;
  /**
   * Kept lazy behind the authority boundary. The current guard deliberately
   * does not even read this property because no trusted authority producer
   * exists yet.
   */
  readonly execute: () => unknown;
}

export interface RefusedRealBuildRunFixedAction<T> {
  readonly status: "refused";
  readonly document: T;
  readonly partIds: readonly [];
  readonly registrations: readonly [];
  readonly placed: 0;
  readonly stepId: null;
  readonly failure: StepFailure;
}

/**
 * Applies the physical-frame authority boundary before a runner fixed action.
 * Current authority admission always refuses, so the callback and every hash,
 * source lookup, placement, and assessment behind it remain unread.
 */
export function executeRunFixedActionWithPhysicalAuthority<T>(
  input: RealBuildRunFixedActionInput<T>,
): RefusedRealBuildRunFixedAction<T> {
  const guarded = executeRealBuildFixedActionWithPhysicalAuthority(input);
  return Object.freeze({
    status: "refused",
    document: input.rollbackDocument,
    partIds: Object.freeze([] as []),
    registrations: Object.freeze([] as []),
    placed: 0,
    stepId: null,
    failure: guarded.failure,
  });
}
