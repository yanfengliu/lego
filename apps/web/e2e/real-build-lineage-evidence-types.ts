import type {
  RealBuildLineageIdentity,
  RealBuildLineageLocalIdentity,
} from "./real-build-candidate-lineage-identity";

export const REAL_BUILD_LINEAGE_EVIDENCE_SCHEMA_VERSION =
  "lego.real-build-lineage-evidence/1" as const;

export const DEFAULT_REAL_BUILD_LINEAGE_EVIDENCE_MAXIMUM_ATTEMPTS = 8_192;
/** Matches the current run-contract panelCameraBranchBudget hard ceiling. */
export const MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_ATTEMPTS = 800_000;
export const MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_BYTES = 64 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_JSON_DEPTH = 128;
export const MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_JSON_NODES = 2_000_000;

export type RealBuildLineageAttemptStatus = "seeded" | "scored" | "not-observable" | "failed";

export type RealBuildLineageEvidenceStatus = "seeded" | "selected" | "unresolved" | "failed";

export interface RealBuildLineageTiePolicy {
  readonly metric: "panel-agreement/1";
  readonly direction: "higher-is-better";
  readonly minimumScore: number;
  readonly minimumMargin: number;
  readonly exactTie: "refuse";
}

/** One immutable branch identity. candidateId is document identity, never branch identity. */
export interface RealBuildLineageAttemptEvidence {
  readonly candidateId: string;
  readonly lineageId: string;
  readonly lineageOrigin: "root" | "descendant";
  readonly parentLineageId: string | null;
  readonly originLineageId: string;
  readonly localIdentity: RealBuildLineageLocalIdentity;
  /** External typed score/failure/not-observable witness identity. */
  readonly sourceEvidenceId: string | null;
  /** Exact attempt/hypothesis evidence identity, present for every non-seed row. */
  readonly attemptEvidenceId: string | null;
  readonly cameraEvidenceId: string | null;
  readonly documentHash: string;
  readonly throughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  readonly status: RealBuildLineageAttemptStatus;
  readonly score: number | null;
}

export interface RealBuildLineageTransitionEvidence {
  readonly parentLineageId: string;
  readonly childLineageId: string;
}

export interface RealBuildLineageSelectionEvidence {
  readonly status: "not-applicable" | "selected" | "unresolved";
  readonly scoredGroups: number;
  readonly selectedCandidateId: string | null;
  readonly selectedCameraEvidenceId: string | null;
  readonly selectedLineageIds: readonly string[];
  readonly bestScore: number | null;
  readonly runnerUpScore: number | null;
  readonly margin: number | null;
}

/**
 * Inspection evidence only. In particular, `selection` cannot authorize a
 * placement: it is reproduced from the score rows and fixed tie policy.
 */
export interface RealBuildLineageEvidence {
  readonly schemaVersion: typeof REAL_BUILD_LINEAGE_EVIDENCE_SCHEMA_VERSION;
  readonly status: RealBuildLineageEvidenceStatus;
  readonly throughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  readonly decisionPanelStepNumber: number | null;
  readonly tiePolicy: RealBuildLineageTiePolicy;
  /** Exact direct-parent set; cross-panel continuity proves its prior retention. */
  readonly parents: readonly RealBuildLineageIdentity[];
  readonly attempts: readonly RealBuildLineageAttemptEvidence[];
  readonly selection: RealBuildLineageSelectionEvidence;
  readonly transitions: readonly RealBuildLineageTransitionEvidence[];
  readonly completionAuthority: {
    readonly status: "absent";
    readonly authorized: false;
    readonly reason: "lineage-evidence-is-inspection-only";
  };
}

/** Input deliberately omits all derived claims. */
export interface RealBuildLineageEvidenceProjectionInput {
  readonly throughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  readonly decisionPanelStepNumber: number | null;
  readonly tiePolicy: RealBuildLineageTiePolicy;
  readonly parents: readonly RealBuildLineageIdentity[];
  readonly attempts: readonly RealBuildLineageAttemptEvidence[];
}
