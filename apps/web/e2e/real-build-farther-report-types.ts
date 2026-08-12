import type { BudgetReservationFailure } from "./real-build-deferral";
import type {
  FartherCarryEvidence,
  FartherOriginEvidence,
  FartherPanelEvidence,
  FartherPlacementWitness,
  FartherRefusal,
} from "./real-build-farther-panel-types";

/** Sixteen score renders plus the required N+1 and K source panels. */
export const MAXIMUM_REAL_BUILD_FARTHER_CAPTURES = 18;

export interface RealBuildFartherOriginCandidate {
  readonly candidateId: string;
  readonly documentHash: string;
  readonly pieces: readonly FartherPlacementWitness[];
  /** Agreement already measured on panel N+1 before farther carry began. */
  readonly lookaheadAgreement: number;
  /** Translation used to register the retained score render to panel N+1. */
  readonly lookaheadShiftPx: readonly [number, number];
}

export interface RealBuildFartherOriginEvidence {
  readonly evidence: FartherOriginEvidence;
  readonly candidates: readonly RealBuildFartherOriginCandidate[];
}

/** One atomic intervening-step expansion, without any retained document object. */
export interface RealBuildFartherCarryEvidence extends FartherCarryEvidence {
  readonly stepNumber: number;
}

export interface RealBuildFartherBudgetEvidence {
  /** Complete children offered across every parent and intervening carry. */
  readonly offeredCandidates: number;
  readonly maximumCandidates: number;
  /** Own-panel narrowing renders spent across every parent and carry. */
  readonly narrowingRenders: number;
  readonly maximumNarrowingRenders: number;
  /** Candidate renders scored across N+1 and every inspected farther panel. */
  readonly panelRenders: number;
  readonly maximumPanelRenders: number;
  /** Furthest panel inspected relative to the origin step. */
  readonly reachSteps: number;
  readonly maximumReachSteps: number;
  /** True only when the shared narrowing ledger refused a reservation. */
  readonly refusedReservation: boolean;
  /** Exact first narrowing batch that the shared ledger refused atomically. */
  readonly failedNarrowingReservation: BudgetReservationFailure | null;
  /** True only when the shared candidate ledger refused a reservation. */
  readonly candidateRefusedReservation: boolean;
  /** Exact first complete-candidate batch that the shared ledger refused. */
  readonly failedCandidateReservation: BudgetReservationFailure | null;
}

export interface RealBuildFartherDecision {
  /** The surviving step-N family, never an assertion that one descendant won. */
  readonly originCandidateId: string;
  readonly revealingStepNumber: number;
  readonly survivingCandidateIds: readonly string[];
  readonly rejectedCandidateIds: readonly string[];
  readonly descendantSettled: boolean;
}

/**
 * JSON-safe branch evidence retained on the origin step's report.
 *
 * Documents are intentionally absent. Exact document hashes, immutable
 * placement witnesses, per-parent expansion facts, and measured lineages are
 * enough to distinguish every retained branch without turning report JSON into
 * a second document authority.
 */
export interface RealBuildFartherEvidence {
  readonly origin: RealBuildFartherOriginEvidence;
  readonly carries: readonly RealBuildFartherCarryEvidence[];
  readonly panels: readonly FartherPanelEvidence[];
  readonly budgets: RealBuildFartherBudgetEvidence;
  readonly refusal: FartherRefusal | null;
  readonly decision: RealBuildFartherDecision | null;
}

export type RealBuildFartherCaptureRole = "source-panel" | "candidate-render";

/** Exact visual bytes retained separately from the branch decision record. */
export interface RealBuildFartherCapture {
  /** Dense 0-based ordinal and the only capture-controlled filename component. */
  readonly captureId: number;
  readonly role: RealBuildFartherCaptureRole;
  readonly panelStepNumber: number;
  /** Null for source art and required for a candidate render. */
  readonly candidateId: string | null;
  readonly png: string;
}
