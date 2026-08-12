export type StepFailureStage =
  | "coverage"
  | "callout-resolution"
  | "catalog"
  | "budget"
  | "camera-fit"
  | "evidence"
  | "camera-registration"
  | "placement"
  | "benchmark"
  | "validation"
  | "rendering"
  | "atomicity"
  | "causality"
  | "loading"
  | "replay"
  | "publication"
  | "input";

export type StepFailureCode =
  /**
   * The catalog-coverage closure never bound, so every coverage-derived check
   * was left unevaluated rather than failed. Distinct from `coverage-key-mismatch`,
   * which reports a bound index that disagrees with the ledger.
   */
  | "coverage-closure-unbound"
  | "coverage-key-mismatch"
  | "unresolved-callout"
  | "missing-catalog-part"
  | "camera-fit-failed"
  | "panel-face-unknown"
  | "no-placement-signal"
  | "camera-anchor-failed"
  | "camera-handedness-unresolved"
  | "no-placement-candidate"
  | "resource-budget-exhausted"
  | "placement-error"
  | "incomplete-placement-scoring"
  | "zero-placement-score"
  | "tied-placement-score"
  | "ambiguous-placement-score"
  | "deferred-panel-unscored"
  | "deferred-reach-unmeasured"
  | "weak-deferred-agreement"
  | "ambiguous-deferred-placement"
  | "ambiguous-exploded-ghost"
  | "benchmark-prefix-mismatch"
  | "hard-validation-failed"
  | "hard-validation-error"
  | "rendering-error"
  | "piece-placement-failed"
  | "atomic-step-rollback"
  | "blocked-by-prior-step"
  | "set-accounting-mismatch"
  | "printed-step-sequence-invalid"
  | "untrusted-identification"
  | "input-digest-mismatch"
  | "unsupported-instruction-action"
  | "whole-step-score-too-low"
  | "visual-evidence-unverified"
  | "highlight-reuse-unexplained"
  | "benchmark-policy-mismatch"
  | "benchmark-disagreement"
  | "action-ledger-incomplete"
  | "omitted-piece-identity-missing"
  | "multi-build-source-invalid"
  | "fixed-ledger-frame-unresolved"
  | "transition-evidence-missing"
  | "highlight-calibration-missing"
  | "builder-calibration-invalid"
  | "official-frame-calibration-missing"
  | "official-transform-unrepresentable"
  | "official-model-accounting-mismatch"
  | "transition-classification-unverified"
  | "dynamic-import-failed"
  | "pdf-fetch-failed"
  | "pdf-load-failed"
  | "source-drift-detected"
  | "replay-closure-invalid"
  | "path-policy-violation"
  | "artifact-publish-failed"
  | "run-incomplete";

export interface StepFailure {
  readonly code: StepFailureCode;
  readonly stage: StepFailureStage;
  readonly message: string;
  readonly causedByStep?: number;
  readonly pieceIndex?: number;
  readonly catalogPartId?: string;
  readonly inputKey?: string;
  readonly stepNumber?: number;
}
