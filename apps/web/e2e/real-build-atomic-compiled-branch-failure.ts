import type { RealBuildAtomicCompiledBranchBatchPreparation } from "./real-build-atomic-compiled-branch-batch-input";
import type { RealBuildAtomicCompiledPhysicalWorkPlan } from "./real-build-atomic-compiled-branch-work";
import { deriveRealBuildCompiledTerminalFailureDigest } from "./real-build-compiled-placement-lineage-digest";
import type {
  RealBuildCompiledPlacementLineageEvidence,
  RealBuildCompiledPlacementTerminalFailure,
} from "./real-build-compiled-placement-lineage-types";
import type { RealBuildPreparedSearchReservation } from "./real-build-prepared-search-ledger";

export interface RealBuildAtomicStableFailureIssue {
  readonly code: string;
  readonly path: string;
  readonly reason: string;
}

function bounded(value: unknown, fallback: string, maximum: number): string {
  if (typeof value !== "string") return fallback;
  const cleaned = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .trim();
  return (cleaned.length === 0 ? fallback : cleaned).slice(0, maximum);
}

export function projectRealBuildAtomicCompilationFailure(
  value: unknown,
): RealBuildAtomicStableFailureIssue | null {
  if (value === null || typeof value !== "object" || !("ok" in value) || value.ok !== false) {
    return null;
  }
  const issues = "issues" in value && Array.isArray(value.issues) ? value.issues : [];
  const issue = issues[0];
  if (issue === null || typeof issue !== "object") {
    return Object.freeze({
      code: "COMPILATION_FAILED_WITHOUT_ISSUE",
      path: "compiler",
      reason: "The deterministic compiler refused the proposal without one retained issue.",
    });
  }
  return Object.freeze({
    code: bounded("code" in issue ? issue.code : null, "COMPILATION_FAILED", 256),
    path: bounded("path" in issue ? issue.path : null, "compiler", 256),
    reason: bounded(
      "message" in issue ? issue.message : null,
      "The deterministic compiler refused this exact proposal.",
      1_024,
    ),
  });
}

export function sameRealBuildAtomicFailureIssue(
  left: RealBuildAtomicStableFailureIssue | null,
  right: RealBuildAtomicStableFailureIssue | null,
): boolean {
  return (
    left !== null &&
    right !== null &&
    left.code === right.code &&
    left.path === right.path &&
    left.reason === right.reason
  );
}

export function realBuildAtomicLocalFailureIssue(
  reason: string,
): RealBuildAtomicStableFailureIssue {
  return Object.freeze({
    code: "LOCAL_EVIDENCE_CLOSURE_FAILED",
    path: "compiledLineage",
    reason,
  });
}

export function createRealBuildAtomicTerminalFailure(input: {
  readonly preparation: RealBuildAtomicCompiledBranchBatchPreparation;
  readonly preparedStep: RealBuildCompiledPlacementLineageEvidence["preparedStep"];
  readonly reservation: RealBuildPreparedSearchReservation;
  readonly workPlan: RealBuildAtomicCompiledPhysicalWorkPlan;
  readonly workIndex: number | null;
  readonly phase: RealBuildCompiledPlacementTerminalFailure["phase"];
  readonly code: RealBuildCompiledPlacementTerminalFailure["code"];
  readonly issue: RealBuildAtomicStableFailureIssue;
}): RealBuildCompiledPlacementTerminalFailure {
  const proposalId =
    input.workIndex === null ? null : input.workPlan.unique[input.workIndex]!.proposal.proposalId;
  const failure = Object.freeze({
    schemaVersion: "lego.real-build-compiled-placement-terminal-failure/1" as const,
    proposalId,
    phase: input.phase,
    code: input.code,
    attemptedUniqueTransitionNumber: input.workIndex === null ? null : input.workIndex + 1,
    uniquePhysicalTransitionCount: input.workPlan.unique.length,
    issue: input.issue,
  });
  return Object.freeze({
    ...failure,
    failureDigest: deriveRealBuildCompiledTerminalFailureDigest({
      throughStepNumber: input.preparation.preparedStep.stepNumber,
      preparedStep: input.preparedStep,
      searchRequestPreflightIdentity: input.preparation.searchInspection.preflightIdentity,
      searchReservation: input.reservation,
      failure,
    }),
  });
}
