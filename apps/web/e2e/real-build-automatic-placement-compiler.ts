import {
  BUILTIN_COMPILER_SNAPSHOT_HASH,
  canonicalDigest,
  canonicalSha256,
  canonicalStringify,
  compileBuildProgram,
  deepFreeze,
  documentStructuralHash,
  verifyAssemblyPatchAgainstCapability,
  type CompilationResult,
} from "@lego-studio/brick-kernel";
import type {
  AssemblyPatchV1,
  BrickDocumentV1,
  ProgramOperation,
  ScopeCapabilityV1,
} from "@lego-studio/protocol";

import { assessSupport } from "../src/placement";
import {
  snapshotRealBuildAutomaticPlacementInput,
  type RealBuildAutomaticPlacementInput,
  type RealBuildAutomaticPlacementWitness,
} from "./real-build-automatic-placement-input";
export type {
  RealBuildAutomaticPlacementConnection,
  RealBuildAutomaticPlacementWitness,
} from "./real-build-automatic-placement-input";
import { realBuildDocumentCandidateId } from "./real-build-candidate-lineage-identity";
import {
  createRealBuildAutomaticScope,
  measureRealBuildAutomaticCollisionPrimitiveCount,
  prepareRealBuildAutomaticPrintedStep,
  REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_REQUIRED_BASE_PORTS,
  REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH,
  realBuildAutomaticUtf8ByteLength,
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

function deterministicId(prefix: string, value: unknown): string {
  return `${prefix}-${canonicalSha256(value).slice(0, 24)}`;
}

function requireBoundedCompilationWork(
  input: RealBuildAutomaticPlacementInput,
  operationCount: number,
): void {
  const addedConnections = input.witnesses.reduce(
    (total, witness) => total + witness.connections.length,
    0,
  );
  const collisionPrimitiveCount = measureRealBuildAutomaticCollisionPrimitiveCount([
    ...input.documentSnapshot.document.parts.map(({ catalogPartId }) => catalogPartId),
    ...input.witnesses.map(({ catalogPartId }) => catalogPartId),
  ]);
  const finalGraphEntries =
    input.documentSnapshot.document.parts.length +
    input.documentSnapshot.document.connections.length +
    input.documentSnapshot.document.submodels.length +
    input.documentSnapshot.document.steps.length +
    input.documentSnapshot.document.semanticRegions.length +
    input.witnesses.length +
    addedConnections +
    collisionPrimitiveCount +
    1;
  // Provenance is rebound by a second deterministic compile. Both passes apply
  // placement operations, then the combined add-step patch is independently
  // replayed and hard-validated, so charge all three passes up front.
  const graphVisits = 3 * finalGraphEntries * operationCount;
  const proposalBytes = realBuildAutomaticUtf8ByteLength(
    canonicalStringify({ printedStep: input.printedStep, witnesses: input.witnesses }),
  );
  const byteVisits =
    3 *
    (realBuildAutomaticUtf8ByteLength(input.documentSnapshot.canonicalBytes) + proposalBytes) *
    operationCount;
  if (
    graphVisits > REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS ||
    byteVisits > REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS
  ) {
    throw new RangeError(
      `Automatic placement would require ${graphVisits} graph-entry visits and ${byteVisits} byte-visits across two compiler passes plus one combined hard-validation replay; ` +
        `the bounded limits are ${REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS} and ${REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS}. Reduce the proposal or split it into separately verified printed steps.`,
    );
  }
}

function programFor(
  document: BrickDocumentV1,
  targetStepId: string,
  proposalId: string,
  witnesses: readonly RealBuildAutomaticPlacementWitness[],
): {
  readonly operations: readonly ProgramOperation[];
  readonly requiredPorts: ScopeCapabilityV1["requiredAttachmentPorts"];
} {
  const operations: ProgramOperation[] = [];
  const localPartIds: string[] = [];
  const retained = new Set(document.parts.map(({ id }) => id));
  const required = new Map<string, { partId: string; portId: string }>();
  witnesses.forEach((witness, index) => {
    const localPartId = deterministicId("candidate-part", { proposalId, index, witness });
    operations.push({
      kind: "placePart",
      operationId: `place-${index + 1}`,
      localPartId,
      catalogPartId: witness.catalogPartId,
      colorId: witness.colorId,
      transform: witness.transform,
      submodelId: document.submodels[0]?.id ?? "root",
      stepId: targetStepId,
      semanticTags: [],
    });
    const discovered = witness.connections.map((connection, connectionIndex) => {
      const targetPartId =
        connection.target.kind === "base"
          ? connection.target.partId
          : localPartIds[connection.target.witnessIndex];
      if (
        targetPartId === undefined ||
        (connection.target.kind === "witness" && connection.target.witnessIndex >= index)
      ) {
        throw new TypeError(
          `Witness ${index} connection ${connectionIndex} must target the base or an earlier witness.`,
        );
      }
      return { ...connection, targetPartId };
    });
    const support = assessSupport(
      { id: localPartId, catalogPartId: witness.catalogPartId, transform: witness.transform },
      discovered,
    );
    if (!support.supported)
      throw new TypeError(
        `Automatic placement witness ${index} is not supported: ${support.reason}`,
      );
    discovered.forEach((connection, connectionIndex) => {
      operations.push({
        kind: "attach",
        operationId: `attach-${index + 1}-${connectionIndex + 1}`,
        a: { partId: connection.targetPartId, portId: connection.targetPortId },
        b: { partId: localPartId, portId: connection.candidatePortId },
        connectionKind: connection.connectionKind,
      });
      if (retained.has(connection.targetPartId)) {
        required.set(`${connection.targetPartId}\0${connection.targetPortId}`, {
          partId: connection.targetPartId,
          portId: connection.targetPortId,
        });
      }
    });
    localPartIds.push(localPartId);
  });
  if (required.size > REAL_BUILD_AUTOMATIC_MAXIMUM_REQUIRED_BASE_PORTS) {
    throw new RangeError(
      `Automatic placement requires ${required.size} base attachment ports above the ${REAL_BUILD_AUTOMATIC_MAXIMUM_REQUIRED_BASE_PORTS} scope limit.`,
    );
  }
  return Object.freeze({
    operations: Object.freeze(operations),
    requiredPorts: Object.freeze([...required.values()]),
  });
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
  const input = snapshotRealBuildAutomaticPlacementInput(unsafeInput);
  const document = input.documentSnapshot.document;
  const compilerInputDigest = canonicalDigest({
    schemaVersion: "lego.real-build-automatic-placement-input/2",
    baseCanonicalBytesHash: input.documentSnapshot.canonicalBytesHash,
    baseCanonicalByteLength: input.documentSnapshot.canonicalByteLength,
    baseDocumentHash: input.documentSnapshot.documentHash,
    printedStepNumber: input.printedStepNumber,
    printedStep: input.printedStep,
    witnesses: input.witnesses,
  });
  const proposalId = deterministicId("real-build-proposal", {
    compilerInputDigest,
  });
  const preparedStep = prepareRealBuildAutomaticPrintedStep({
    document,
    printedStepNumber: input.printedStepNumber,
    metadata: input.printedStep,
    compilerInputDigest,
  });
  const program = programFor(
    preparedStep.documentWithStep,
    preparedStep.step.id,
    proposalId,
    input.witnesses,
  );
  const placementProgram = deepFreeze({
    schemaVersion: "lego.build-program/1" as const,
    operations: program.operations,
  });
  const automaticProgram: RealBuildAutomaticPrintedStepProgram = deepFreeze({
    schemaVersion: "lego.real-build-automatic-printed-step-program/1",
    compilerInputDigest,
    baseCanonicalBytesHash: input.documentSnapshot.canonicalBytesHash,
    baseCanonicalByteLength: input.documentSnapshot.canonicalByteLength,
    baseDocumentHash: input.documentSnapshot.documentHash,
    printedStepNumber: input.printedStepNumber,
    printedStep: input.printedStep,
    preparationOperations: preparedStep.preparationOperations,
    placementProgram,
  });
  const combinedOperationCount =
    program.operations.length + preparedStep.preparationOperations.length;
  if (combinedOperationCount > REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS) {
    throw new RangeError(
      `Automatic printed step expands to ${combinedOperationCount} operations above the ${REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS}-operation compiler limit.`,
    );
  }
  requireBoundedCompilationWork(input, combinedOperationCount);
  const placementScope = createRealBuildAutomaticScope({
    document: preparedStep.documentWithStep,
    printedStepNumber: input.printedStepNumber,
    maximumAddedParts: input.witnesses.length,
    maximumOperations: program.operations.length,
    requiredAttachmentPorts: program.requiredPorts,
    compilerInputDigest,
    phase: "placement",
  });
  const combinedScope = createRealBuildAutomaticScope({
    document,
    printedStepNumber: input.printedStepNumber,
    maximumAddedParts: input.witnesses.length,
    maximumOperations: combinedOperationCount,
    requiredAttachmentPorts: program.requiredPorts,
    compilerInputDigest,
    phase: "combined",
  });
  const jobId = deterministicId("real-build-job", { compilerInputDigest });
  const draft = compileBuildProgram(preparedStep.documentWithStep, placementProgram, {
    scope: placementScope,
    jobId,
    candidateId: proposalId,
  });
  if (!draft.ok) return retainAutomaticPlacementCompilationResult(draft);
  const candidateId = realBuildDocumentCandidateId(documentStructuralHash(draft.document));
  const result = compileBuildProgram(preparedStep.documentWithStep, placementProgram, {
    scope: placementScope,
    jobId,
    candidateId,
  });
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
      baseDocument: document,
      preparedStep,
      placement: result,
      combinedScope,
      jobId,
      candidateId,
      automaticProgram,
      placementScope,
    }),
  );
}
