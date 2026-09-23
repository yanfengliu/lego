import {
  applyBuildOperations,
  canonicalDigest,
  compileBuildProgramCandidate,
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
  type CompilationIssue,
} from "@lego-studio/brick-kernel";
import type {
  BrickDocumentV1,
  BuildOperation,
  ScopeCapabilityV1,
  ValidationIssue,
  ValidationReportV1,
} from "@lego-studio/protocol";

import {
  prepareRealBuildAutomaticPlacementExpansion,
  type PreparedRealBuildAutomaticPlacementExpansion,
  type RealBuildAutomaticPlacementWitnessPolicy,
} from "./real-build-automatic-placement-expansion";
import { realBuildDocumentCandidateId } from "./real-build-candidate-lineage-identity";
import {
  REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH,
  type RealBuildAutomaticPrintedStepProgram,
} from "./real-build-automatic-placement-step";
import {
  prepareRealBuildPrefix50ZeroPieceStep,
  REAL_BUILD_PREFIX50_ZERO_STEP_COMPILER_SNAPSHOT_HASH,
  REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER,
} from "./real-build-prefix50-zero-step";

const automaticPlacementCandidates = new WeakSet<object>();

export interface RealBuildAutomaticPlacementCandidateLineage {
  readonly compilerSnapshotHash: `sha256:${string}`;
  readonly programHash: `sha256:${string}`;
  readonly placementProgramHash: `sha256:${string}`;
  readonly proposalId: string;
  readonly jobId: string;
  readonly candidateId: string;
  readonly program: RealBuildAutomaticPrintedStepProgram;
  readonly placementScope: ScopeCapabilityV1;
  readonly combinedScope: ScopeCapabilityV1;
}

interface CandidateEvidence {
  readonly hardValidationComplete: true;
  readonly operations: readonly BuildOperation[];
  readonly document: BrickDocumentV1;
  readonly validationReport: ValidationReportV1;
  readonly introducedBlockingIssues: readonly ValidationIssue[];
  readonly globalValidityPreserved: boolean;
  readonly lineage: RealBuildAutomaticPlacementCandidateLineage;
}

interface CandidateIdentity {
  readonly kind: "realBuildAutomaticPlacementCandidate";
  readonly authority: "none";
  readonly mode: RealBuildAutomaticPlacementWitnessPolicy;
}

export interface RealBuildAutomaticPlacementCandidateDraft
  extends CandidateIdentity, CandidateEvidence {
  readonly status: "draft";
}

export interface RealBuildAutomaticPlacementCandidateRejection extends CandidateIdentity {
  readonly status: "rejected";
  readonly stage: "expansion";
  readonly issues: readonly CompilationIssue[];
}

export interface RealBuildIntentionalDetachedSubassemblyPolicyRejection
  extends CandidateIdentity, CandidateEvidence {
  readonly status: "rejected";
  readonly stage: "intentionalDetachedSubassemblyPolicy";
  readonly issues: readonly {
    readonly code:
      | "DETACHED_SUBASSEMBLY_NOT_INTERNALLY_CONNECTED"
      | "DETACHED_SUBASSEMBLY_BLOCKING_CODE_SET_MISMATCH";
    readonly message: string;
    readonly path: string;
  }[];
}

export type RealBuildAutomaticPlacementCandidateResult =
  | RealBuildAutomaticPlacementCandidateDraft
  | RealBuildAutomaticPlacementCandidateRejection
  | RealBuildIntentionalDetachedSubassemblyPolicyRejection;

function retainCandidate<T extends RealBuildAutomaticPlacementCandidateResult>(value: T): T {
  const frozen = deepFreeze(value);
  automaticPlacementCandidates.add(frozen);
  return frozen;
}

export function isRealBuildAutomaticPlacementCandidateResult(
  value: unknown,
): value is RealBuildAutomaticPlacementCandidateResult {
  return typeof value === "object" && value !== null && automaticPlacementCandidates.has(value);
}

function internallyConnectsAllAddedParts(
  base: BrickDocumentV1,
  result: BrickDocumentV1,
  expectedAddedParts: number,
): boolean {
  const basePartIds = new Set(base.parts.map(({ id }) => id));
  const addedPartIds = result.parts.filter(({ id }) => !basePartIds.has(id)).map(({ id }) => id);
  if (addedPartIds.length !== expectedAddedParts || addedPartIds.length < 2) return false;
  const added = new Set(addedPartIds);
  const adjacency = new Map(addedPartIds.map((id) => [id, new Set<string>()]));
  for (const { a, b } of result.connections) {
    if (!added.has(a.partId) || !added.has(b.partId)) continue;
    adjacency.get(a.partId)!.add(b.partId);
    adjacency.get(b.partId)!.add(a.partId);
  }
  const visited = new Set([addedPartIds[0]!]);
  const pending = [addedPartIds[0]!];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }
  return visited.size === addedPartIds.length;
}

function evidenceFor(
  prepared: PreparedRealBuildAutomaticPlacementExpansion,
  candidateId: string,
  placement: Extract<ReturnType<typeof compileBuildProgramCandidate>, { readonly status: "draft" }>,
): CandidateEvidence {
  const operations = [...prepared.preparedStep.preparationOperations, ...placement.operations];
  const document = applyBuildOperations(prepared.document, operations);
  if (documentStructuralHash(document) !== documentStructuralHash(placement.document)) {
    throw new TypeError(
      "Automatic placement candidate combined replay changed structural candidate identity.",
    );
  }
  return {
    hardValidationComplete: true,
    operations,
    document,
    validationReport: placement.validationReport,
    introducedBlockingIssues: placement.introducedBlockingIssues,
    globalValidityPreserved: placement.globalValidityPreserved,
    lineage: {
      compilerSnapshotHash: REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH,
      programHash: canonicalDigest(prepared.automaticProgram),
      placementProgramHash: canonicalDigest(prepared.placementProgram),
      proposalId: prepared.proposalId,
      jobId: prepared.jobId,
      candidateId,
      program: prepared.automaticProgram,
      placementScope: prepared.placementScope,
      combinedScope: prepared.combinedScope,
    },
  };
}

function compileCandidate(
  unsafeInput: unknown,
  mode: RealBuildAutomaticPlacementWitnessPolicy,
): RealBuildAutomaticPlacementCandidateResult {
  const prepared = prepareRealBuildAutomaticPlacementExpansion(unsafeInput, mode);
  const first = compileBuildProgramCandidate(
    prepared.preparedStep.documentWithStep,
    prepared.placementProgram,
    { scope: prepared.placementScope, candidateId: prepared.proposalId },
  );
  if (first.status === "rejected") {
    return retainCandidate({
      kind: "realBuildAutomaticPlacementCandidate",
      status: "rejected",
      stage: "expansion",
      authority: "none",
      mode,
      issues: first.issues,
    } as RealBuildAutomaticPlacementCandidateRejection);
  }
  const candidateId = realBuildDocumentCandidateId(documentStructuralHash(first.document));
  const placement = compileBuildProgramCandidate(
    prepared.preparedStep.documentWithStep,
    prepared.placementProgram,
    { scope: prepared.placementScope, candidateId },
  );
  if (placement.status === "rejected") {
    return retainCandidate({
      kind: "realBuildAutomaticPlacementCandidate",
      status: "rejected",
      stage: "expansion",
      authority: "none",
      mode,
      issues: placement.issues,
    } as RealBuildAutomaticPlacementCandidateRejection);
  }
  if (documentStructuralHash(placement.document) !== documentStructuralHash(first.document)) {
    throw new TypeError(
      "Automatic placement candidate provenance recompile changed structural candidate identity.",
    );
  }
  const evidence = evidenceFor(prepared, candidateId, placement);
  const identity = {
    kind: "realBuildAutomaticPlacementCandidate" as const,
    authority: "none" as const,
    mode,
  };
  if (mode === "intentionalDetachedSubassembly") {
    if (
      !internallyConnectsAllAddedParts(
        prepared.document,
        evidence.document,
        prepared.input.witnesses.length,
      )
    ) {
      return retainCandidate({
        ...identity,
        ...evidence,
        status: "rejected",
        stage: "intentionalDetachedSubassemblyPolicy",
        issues: [
          {
            code: "DETACHED_SUBASSEMBLY_NOT_INTERNALLY_CONNECTED",
            message: "Every newly added part must form one internally connected component.",
            path: "/witnesses",
          },
        ],
      } as RealBuildIntentionalDetachedSubassemblyPolicyRejection);
    }
    const blockingCodes = [
      ...new Set(
        placement.validationReport.issues
          .filter(({ severity }) => severity === "blocking")
          .map(({ code }) => code),
      ),
    ].sort();
    if (blockingCodes.length !== 1 || blockingCodes[0] !== "DISCONNECTED_ASSEMBLY") {
      return retainCandidate({
        ...identity,
        ...evidence,
        status: "rejected",
        stage: "intentionalDetachedSubassemblyPolicy",
        issues: [
          {
            code: "DETACHED_SUBASSEMBLY_BLOCKING_CODE_SET_MISMATCH",
            message: `Intentional detached subassembly requires the complete blocking-code set [DISCONNECTED_ASSEMBLY]; observed [${blockingCodes.join(", ")}].`,
            path: "/validation/issues",
          },
        ],
      } as RealBuildIntentionalDetachedSubassemblyPolicyRejection);
    }
  }
  return retainCandidate({
    ...identity,
    ...evidence,
    status: "draft",
  } as RealBuildAutomaticPlacementCandidateDraft);
}

export function compileRealBuildAutomaticPlacementCandidate(
  unsafeInput: unknown,
): RealBuildAutomaticPlacementCandidateResult {
  return compileCandidate(unsafeInput, "ordinary");
}

export function compileRealBuildIntentionalDetachedSubassemblyCandidate(
  unsafeInput: unknown,
): RealBuildAutomaticPlacementCandidateResult {
  return compileCandidate(unsafeInput, "intentionalDetachedSubassembly");
}

const zeroPieceStepCandidates = new WeakSet<object>();

export interface RealBuildPrefix50ZeroPieceStepCandidate {
  readonly kind: "realBuildPrefix50ZeroPieceStepCandidate";
  readonly status: "draft";
  readonly authority: "none";
  readonly hardValidationComplete: true;
  readonly operations: readonly BuildOperation[];
  readonly document: BrickDocumentV1;
  readonly validationReport: ValidationReportV1;
  readonly lineage: {
    readonly compilerSnapshotHash: `sha256:${string}`;
    readonly compilerInputDigest: `sha256:${string}`;
    readonly programHash: `sha256:${string}`;
    readonly candidateId: string;
    readonly targetDocumentHash: `sha256:${string}`;
    readonly scope: ScopeCapabilityV1;
  };
}

export function isRealBuildPrefix50ZeroPieceStepCandidate(
  value: unknown,
): value is RealBuildPrefix50ZeroPieceStepCandidate {
  return typeof value === "object" && value !== null && zeroPieceStepCandidates.has(value);
}

export function compileRealBuildPrefix50ZeroPieceStepCandidate(
  unsafeInput: unknown,
): RealBuildPrefix50ZeroPieceStepCandidate {
  const prepared = prepareRealBuildPrefix50ZeroPieceStep(unsafeInput);
  const result = prepared.preparedStep.documentWithStep;
  const target = result.steps[REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER - 1];
  if (
    canonicalDigest(result.parts) !== canonicalDigest(prepared.document.parts) ||
    canonicalDigest(result.connections) !== canonicalDigest(prepared.document.connections) ||
    result.steps.length !== prepared.document.steps.length + 1 ||
    target?.index !== REAL_BUILD_PREFIX50_ZERO_STEP_NUMBER - 1 ||
    target.partIds.length !== 0 ||
    prepared.scope.budgets.maxAddedParts !== 0 ||
    prepared.scope.budgets.maxRemovedParts !== 0 ||
    prepared.scope.budgets.maxOperations !== prepared.preparedStep.preparationOperations.length
  ) {
    throw new TypeError(
      "Authority-free zero-piece candidate must append exactly one empty contiguous step without adding or changing parts or connections.",
    );
  }
  const validationReport = validateBrickDocument(result);
  const incompleteCodes = [
    ...new Set(
      validationReport.issues
        .map(({ code }) => code)
        .filter((code) =>
          [
            "COLLISION_COMPARISON_BUDGET_EXCEEDED",
            "COLLISION_FINDING_BUDGET_EXCEEDED",
            "VALIDATION_ISSUE_BUDGET_EXCEEDED",
          ].includes(code),
        ),
    ),
  ];
  if (
    incompleteCodes.length > 0 ||
    !validationReport.documentGloballyValid ||
    validationReport.issues.some(({ severity }) => severity === "blocking")
  ) {
    const refusedCodes = [
      ...new Set([
        ...incompleteCodes,
        ...validationReport.issues
          .filter(({ severity }) => severity === "blocking")
          .map(({ code }) => code),
      ]),
    ].sort();
    throw new TypeError(
      `Authority-free zero-piece candidate requires one complete hard-valid document; blocking or incomplete codes: ${refusedCodes.join(", ")}.`,
    );
  }
  const programHash = canonicalDigest({
    schemaVersion: "lego.real-build-prefix50-zero-step-program/1",
    compilerInputDigest: prepared.compilerInputDigest,
    operations: prepared.preparedStep.preparationOperations,
  });
  const candidate = deepFreeze({
    kind: "realBuildPrefix50ZeroPieceStepCandidate" as const,
    status: "draft" as const,
    authority: "none" as const,
    hardValidationComplete: true as const,
    operations: prepared.preparedStep.preparationOperations,
    document: result,
    validationReport,
    lineage: {
      compilerSnapshotHash: REAL_BUILD_PREFIX50_ZERO_STEP_COMPILER_SNAPSHOT_HASH,
      compilerInputDigest: prepared.compilerInputDigest,
      programHash,
      candidateId: realBuildDocumentCandidateId(prepared.targetDocumentHash),
      targetDocumentHash: prepared.targetDocumentHash,
      scope: prepared.scope,
    },
  });
  zeroPieceStepCandidates.add(candidate);
  return candidate;
}
