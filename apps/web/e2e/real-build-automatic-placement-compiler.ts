import {
  BUILTIN_COMPILER_SNAPSHOT_HASH,
  canonicalDigest,
  compileBuildProgram,
  deepFreeze,
  documentStructuralHash,
  verifyAssemblyPatchAgainstCapability,
  type CompilationResult,
} from "@lego-studio/brick-kernel";
import type { AssemblyPatchV1, BrickDocumentV1, ScopeCapabilityV1 } from "@lego-studio/protocol";

export type {
  RealBuildAutomaticPlacementConnection,
  RealBuildAutomaticPlacementWitness,
} from "./real-build-automatic-placement-input";
import { realBuildDocumentCandidateId } from "./real-build-candidate-lineage-identity";
import { prepareRealBuildAutomaticPlacementExpansion } from "./real-build-automatic-placement-expansion";
import {
  REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH,
  type RealBuildAutomaticPlacementCompilationSuccess,
  type RealBuildAutomaticPlacementCompilationResult,
  type RealBuildAutomaticPrintedStepProgram,
  type RealBuildPreparedAutomaticPrintedStep,
} from "./real-build-automatic-placement-step";

const automaticPlacementCompilationResults = new WeakSet<object>();

function retainAutomaticPlacementCompilationResult<
  T extends RealBuildAutomaticPlacementCompilationResult,
>(result: T): T {
  automaticPlacementCompilationResults.add(result);
  return result;
}

/** Proves a compiler result was created by this module before any caller-shaped field is read. */
export function isRealBuildAutomaticPlacementCompilationResult(
  value: unknown,
): value is RealBuildAutomaticPlacementCompilationResult {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    automaticPlacementCompilationResults.has(value)
  );
}

type CompilationSuccess = Extract<CompilationResult, { readonly ok: true }>;

/**
 * Lexically private: every argument is derived in the sole public compiler
 * invocation after input snapshotting and the two deterministic compile passes.
 */
function composeRealBuildAutomaticPrintedStepCompilation(input: {
  readonly baseDocument: BrickDocumentV1;
  readonly preparedStep: RealBuildPreparedAutomaticPrintedStep;
  readonly placement: CompilationSuccess;
  readonly combinedScope: ScopeCapabilityV1;
  readonly jobId: string;
  readonly candidateId: string;
  readonly automaticProgram: RealBuildAutomaticPrintedStepProgram;
  readonly placementScope: ScopeCapabilityV1;
}): RealBuildAutomaticPlacementCompilationSuccess {
  const operations = [
    ...input.preparedStep.preparationOperations,
    ...input.placement.patch.operations,
  ];
  const programHash = canonicalDigest(input.automaticProgram);
  const patch: AssemblyPatchV1 = {
    schemaVersion: "lego.assembly-patch/1",
    baseRevision: input.baseDocument.revision,
    baseDocumentHash: documentStructuralHash(input.baseDocument),
    truthSnapshotHash: canonicalDigest(input.baseDocument.truth),
    scopeCapabilityId: input.combinedScope.capabilityId,
    scopeDigest: canonicalDigest(input.combinedScope),
    operations,
    provenance: {
      jobId: input.jobId,
      candidateId: input.candidateId,
      compilerSnapshotHash: REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH,
      buildProgramHash: programHash,
    },
  };
  const verified = verifyAssemblyPatchAgainstCapability(
    input.baseDocument,
    patch,
    input.combinedScope,
  );
  if (!verified.ok) {
    const first = verified.issues[0];
    throw new TypeError(
      `Combined automatic printed-step patch failed independent hard validation${first ? ` (${first.code} at ${first.path})` : ""}.`,
    );
  }
  const verifiedHash = documentStructuralHash(verified.document);
  const placementProgramHash = canonicalDigest(input.automaticProgram.placementProgram);
  const basePartIds = new Set(input.baseDocument.parts.map(({ id }) => id));
  const baseConnectionIds = new Set(input.baseDocument.connections.map(({ id }) => id));
  const addedPartIds = new Set(
    verified.document.parts.filter(({ id }) => !basePartIds.has(id)).map(({ id }) => id),
  );
  const addedConnections = verified.document.connections.filter(
    ({ id }) => !baseConnectionIds.has(id),
  );
  if (
    verifiedHash !== documentStructuralHash(input.placement.document) ||
    realBuildDocumentCandidateId(verifiedHash) !== input.candidateId ||
    input.placement.patch.provenance.candidateId !== input.candidateId ||
    input.placement.patch.provenance.jobId !== input.jobId ||
    input.placement.patch.provenance.compilerSnapshotHash !== BUILTIN_COMPILER_SNAPSHOT_HASH ||
    input.placement.patch.provenance.buildProgramHash !== placementProgramHash ||
    input.placement.patch.baseRevision !== input.preparedStep.documentWithStep.revision ||
    input.placement.patch.baseDocumentHash !==
      documentStructuralHash(input.preparedStep.documentWithStep) ||
    input.placement.patch.scopeCapabilityId !== input.placementScope.capabilityId ||
    input.placement.patch.scopeDigest !== canonicalDigest(input.placementScope) ||
    verified.document.parts.some(
      (part) =>
        addedPartIds.has(part.id) &&
        (part.provenance.source !== "ai" || part.provenance.sourceId !== input.candidateId),
    ) ||
    addedConnections.some(
      ({ provenance }) => provenance.source !== "ai" || provenance.sourceId !== input.candidateId,
    )
  ) {
    throw new TypeError(
      "Combined automatic printed-step replay did not preserve the exact compiled candidate identity.",
    );
  }
  return deepFreeze({
    ok: true,
    patch,
    document: verified.document,
    validationReport: verified.validationReport,
    automaticPlacement: {
      schemaVersion: "lego.real-build-automatic-placement-receipt/1",
      compilerSnapshotHash: REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH,
      programHash,
      placementProgramHash,
      jobId: input.jobId,
      candidateId: input.candidateId,
      program: input.automaticProgram,
      placementScope: input.placementScope,
      combinedScope: input.combinedScope,
    },
  });
}

export function compileRealBuildAutomaticPlacement(
  unsafeInput: unknown,
): RealBuildAutomaticPlacementCompilationResult {
  const expansion = prepareRealBuildAutomaticPlacementExpansion(unsafeInput, "ordinary");
  const draft = compileBuildProgram(
    expansion.preparedStep.documentWithStep,
    expansion.placementProgram,
    {
      scope: expansion.placementScope,
      jobId: expansion.jobId,
      candidateId: expansion.proposalId,
    },
  );
  if (!draft.ok) return retainAutomaticPlacementCompilationResult(draft);
  const candidateId = realBuildDocumentCandidateId(documentStructuralHash(draft.document));
  const result = compileBuildProgram(
    expansion.preparedStep.documentWithStep,
    expansion.placementProgram,
    {
      scope: expansion.placementScope,
      jobId: expansion.jobId,
      candidateId,
    },
  );
  if (
    result.ok &&
    documentStructuralHash(result.document) !== documentStructuralHash(draft.document)
  ) {
    throw new TypeError(
      "Automatic placement provenance recompile changed structural candidate identity.",
    );
  }
  if (!result.ok) return retainAutomaticPlacementCompilationResult(result);
  return retainAutomaticPlacementCompilationResult(
    composeRealBuildAutomaticPrintedStepCompilation({
      baseDocument: expansion.document,
      preparedStep: expansion.preparedStep,
      placement: result,
      combinedScope: expansion.combinedScope,
      jobId: expansion.jobId,
      candidateId,
      automaticProgram: expansion.automaticProgram,
      placementScope: expansion.placementScope,
    }),
  );
}
