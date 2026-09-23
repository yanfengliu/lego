import type {
  BrickDocumentV1,
  BuildOperation,
  ScopeCapabilityV1,
  ValidationIssue,
  ValidationReportV1,
} from "@lego-studio/protocol";

import { deepFreeze } from "./canonical.ts";
import { expandBuildProgram, type CompilationIssue, type CompilationContext } from "./compiler.ts";

declare const BUILD_PROGRAM_CANDIDATE_DRAFT: unique symbol;
const candidateDrafts = new WeakSet<object>();

export interface BuildProgramCandidateContext {
  readonly scope: ScopeCapabilityV1;
  readonly candidateId: string;
}

/**
 * A deterministic expansion with no acceptance or patch authority. Its hard
 * report can remain blocking while a caller evaluates an intentional draft.
 */
export interface BuildProgramCandidateDraft {
  readonly [BUILD_PROGRAM_CANDIDATE_DRAFT]: true;
  readonly kind: "buildProgramCandidate";
  readonly status: "draft";
  readonly authority: "none";
  readonly hardValidationComplete: true;
  readonly operations: readonly BuildOperation[];
  readonly document: BrickDocumentV1;
  readonly validationReport: ValidationReportV1;
  readonly introducedBlockingIssues: readonly ValidationIssue[];
  readonly globalValidityPreserved: boolean;
}

export interface BuildProgramCandidateRejection {
  readonly kind: "buildProgramCandidate";
  readonly status: "rejected";
  readonly authority: "none";
  readonly issues: readonly CompilationIssue[];
}

export type BuildProgramCandidateResult =
  BuildProgramCandidateDraft | BuildProgramCandidateRejection;

/**
 * Expands an untrusted BuildProgram and computes its complete hard report, but
 * never emits an AssemblyPatch or a success value that can be accepted.
 */
export function compileBuildProgramCandidate(
  baseValue: unknown,
  programValue: unknown,
  context: BuildProgramCandidateContext,
): BuildProgramCandidateResult {
  const expansionContext: CompilationContext = {
    scope: context.scope,
    candidateId: context.candidateId,
    jobId: "authority-free-candidate",
  };
  const expansion = expandBuildProgram(baseValue, programValue, expansionContext);
  if ("ok" in expansion) {
    return deepFreeze({
      kind: "buildProgramCandidate",
      status: "rejected",
      authority: "none",
      issues: expansion.issues,
    });
  }

  const draft = deepFreeze({
    kind: "buildProgramCandidate",
    status: "draft",
    authority: "none",
    hardValidationComplete: true,
    operations: expansion.operations,
    document: expansion.document,
    validationReport: expansion.hardValidation.validationReport,
    introducedBlockingIssues: expansion.hardValidation.introducedBlockingIssues,
    globalValidityPreserved: expansion.hardValidation.globalValidityPreserved,
  }) as BuildProgramCandidateDraft;
  candidateDrafts.add(draft);
  return draft;
}

/** Proves that a draft was produced by this authority-free compiler instance. */
export function isBuildProgramCandidateDraft(value: unknown): value is BuildProgramCandidateDraft {
  return typeof value === "object" && value !== null && candidateDrafts.has(value);
}
