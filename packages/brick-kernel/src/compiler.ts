import { getPartDefinition, type LduVector3 } from "@lego-studio/catalog";
import {
  validateAssemblyPatchV1,
  validateBrickDocumentV1,
  validateBuildProgramV1,
  validateScopeCapabilityV1,
} from "@lego-studio/protocol";
import type {
  AssemblyPatchV1,
  BrickDocumentV1,
  BuildOperation,
  BuildProgramV1,
  ConnectionEdge,
  EntityProvenance,
  PartInstance,
  PartPortRef,
  ProgramOperation,
  ScopeCapabilityV1,
  ValidationIssue,
  ValidationReportV1,
} from "@lego-studio/protocol";

import { canonicalDigest, canonicalSha256, canonicalStringify, deepFreeze } from "./canonical.ts";
import { documentStructuralHash, normalizeBrickDocument } from "./document.ts";
import { createBuiltinTruthSnapshot } from "./factory.ts";
import {
  BUILD_PROGRAM_NORMALIZATION_VERSION,
  normalizeBuildProgram,
  normalizeScopeCapability,
  SCOPE_CAPABILITY_NORMALIZATION_VERSION,
} from "./normalization.ts";
import { applyBuildOperations, OperationApplicationError } from "./operations.ts";
import { transformLduPoint } from "./transforms.ts";
import { validateBrickDocument } from "./validation.ts";

export const BUILD_PROGRAM_COMPILER_VERSION = "lego.build-program-compiler/1" as const;
export const BUILD_PROGRAM_COMPILER_MANIFEST = deepFreeze({
  schemaVersion: "lego.build-program-compiler-manifest/1",
  compilerVersion: BUILD_PROGRAM_COMPILER_VERSION,
  acceptedProgramSchema: "lego.build-program/1",
  acceptedScopeSchema: "lego.scope-capability/1",
  emittedPatchSchema: "lego.assembly-patch/1",
  programNormalization: BUILD_PROGRAM_NORMALIZATION_VERSION,
  scopeNormalization: SCOPE_CAPABILITY_NORMALIZATION_VERSION,
  truthSnapshotPolicy: "exact-active-bundle-migration-required/1",
  scopeBudgetPolicy: "independent-pre-append-hard-ceilings/1",
  requiredAttachmentPolicy: "free-in-base-and-patch-added-surviving-edge/1",
  deterministicIdPolicy: "canonical-json-sha256-first-96-bits/1",
  supportedInstructionKinds: [
    "placePart",
    "attach",
    "removePart",
    "replacePart",
    "movePart",
    "recolorPart",
    "assignStep",
  ],
  unsupportedInstructionKinds: ["instantiateTemplate"],
  emittedOperationKinds: [
    "addPart",
    "removePart",
    "updatePart",
    "addConnection",
    "removeConnection",
  ],
} as const);
export const BUILTIN_COMPILER_SNAPSHOT_HASH = canonicalDigest(BUILD_PROGRAM_COMPILER_MANIFEST);

export type CompilationIssueCode =
  | "BASE_DOCUMENT_SCHEMA_INVALID"
  | "BASE_TRUTH_SNAPSHOT_UNSUPPORTED"
  | "BUILD_PROGRAM_SCHEMA_INVALID"
  | "SCOPE_SCHEMA_INVALID"
  | "SCOPE_BASE_MISMATCH"
  | "SCOPE_OVERLAP"
  | "DUPLICATE_PROGRAM_OPERATION_ID"
  | "DUPLICATE_LOCAL_PART_ID"
  | "PART_REFERENCE_NOT_FOUND"
  | "CONNECTION_REFERENCE_NOT_FOUND"
  | "TEMPLATE_NOT_SUPPORTED"
  | "OPERATION_APPLICATION_FAILED"
  | "SCOPE_PART_LOCKED"
  | "SCOPE_CONNECTION_LOCKED"
  | "SCOPE_CATALOG_PART_NOT_ALLOWED"
  | "SCOPE_COLOR_NOT_ALLOWED"
  | "SCOPE_VOLUME_EXCEEDED"
  | "SCOPE_ADDITION_BUDGET_EXCEEDED"
  | "SCOPE_REMOVAL_BUDGET_EXCEEDED"
  | "SCOPE_OPERATION_BUDGET_EXCEEDED"
  | "SCOPE_REQUIRED_ATTACHMENT_MISSING"
  | "SCOPE_REQUIRED_ATTACHMENT_OCCUPIED"
  | "PATCH_INTRODUCES_BLOCKING_ISSUE"
  | "HARD_VALIDATION_INCOMPLETE"
  | "PATCH_SCHEMA_INVALID"
  | "COMPILER_INTERNAL_MISMATCH";

export interface CompilationIssue {
  readonly code: CompilationIssueCode;
  readonly message: string;
  readonly path: string;
  readonly operationId?: string;
}

export interface CompilationContext {
  readonly scope: ScopeCapabilityV1;
  readonly jobId: string;
  readonly candidateId: string;
}

export interface CompilationSuccess {
  readonly ok: true;
  readonly patch: AssemblyPatchV1;
  readonly document: BrickDocumentV1;
  readonly validationReport: ValidationReportV1;
}

export interface CompilationFailure {
  readonly ok: false;
  readonly issues: readonly CompilationIssue[];
}

export type CompilationResult = CompilationSuccess | CompilationFailure;

function issue(
  code: CompilationIssueCode,
  message: string,
  path: string,
  operationId?: string,
): CompilationIssue {
  return operationId === undefined ? { code, message, path } : { code, message, path, operationId };
}

function schemaIssues(
  code: "BASE_DOCUMENT_SCHEMA_INVALID" | "BUILD_PROGRAM_SCHEMA_INVALID" | "SCOPE_SCHEMA_INVALID",
  errors:
    readonly { readonly instancePath?: string; readonly message?: string }[] | null | undefined,
): CompilationIssue[] {
  return (errors ?? [{ instancePath: "", message: "schema validation failed" }])
    .slice(0, 16)
    .map((error) =>
      issue(code, error.message ?? "schema validation failed", error.instancePath ?? ""),
    );
}

function deriveId(prefix: "part" | "connection" | "operation", seed: unknown): string {
  return `${prefix}-${canonicalSha256(seed).slice(0, 24)}`;
}

function resolvePartId(reference: string, localPartIds: ReadonlyMap<string, string>): string {
  return localPartIds.get(reference) ?? reference;
}

function updateProvenance(
  part: PartInstance,
  provenance: EntityProvenance,
  changes: Partial<Pick<PartInstance, "catalogPartId" | "colorId" | "transform" | "stepId">>,
): PartInstance {
  return { ...part, ...changes, provenance };
}

function makeOperationId(
  baseDocumentHash: string,
  buildProgramHash: string,
  instruction: ProgramOperation,
  instructionIndex: number,
  expansionIndex: number,
): string {
  return deriveId("operation", {
    baseDocumentHash,
    buildProgramHash,
    sourceOperationId: instruction.operationId,
    instructionIndex,
    expansionIndex,
  });
}

interface ProgramCompilationState {
  document: BrickDocumentV1;
  readonly operations: BuildOperation[];
  readonly localPartIds: Map<string, string>;
  readonly basePartIds: ReadonlySet<string>;
  readonly addedPartIds: Set<string>;
  readonly removedPartIds: Set<string>;
  readonly budgets: ScopeCapabilityV1["budgets"];
}

class CompilationLimitError extends Error {
  readonly compilationIssue: CompilationIssue;

  constructor(compilationIssue: CompilationIssue) {
    super(compilationIssue.message);
    this.name = "CompilationLimitError";
    this.compilationIssue = compilationIssue;
  }
}

function appendOperation(state: ProgramCompilationState, operation: BuildOperation): void {
  if (state.operations.length + 1 > state.budgets.maxOperations) {
    throw new CompilationLimitError(
      issue(
        "SCOPE_OPERATION_BUDGET_EXCEEDED",
        `Compiler expansion exceeds the capability limit of ${state.budgets.maxOperations} operations`,
        "/operations",
        operation.operationId,
      ),
    );
  }
  if (
    operation.kind === "addPart" &&
    !state.basePartIds.has(operation.part.id) &&
    !state.addedPartIds.has(operation.part.id) &&
    state.addedPartIds.size + 1 > state.budgets.maxAddedParts
  ) {
    throw new CompilationLimitError(
      issue(
        "SCOPE_ADDITION_BUDGET_EXCEEDED",
        `Compiler expansion exceeds the capability limit of ${state.budgets.maxAddedParts} added parts`,
        "/operations",
        operation.operationId,
      ),
    );
  }
  if (
    operation.kind === "removePart" &&
    state.basePartIds.has(operation.part.id) &&
    !state.removedPartIds.has(operation.part.id) &&
    state.removedPartIds.size + 1 > state.budgets.maxRemovedParts
  ) {
    throw new CompilationLimitError(
      issue(
        "SCOPE_REMOVAL_BUDGET_EXCEEDED",
        `Compiler expansion exceeds the capability limit of ${state.budgets.maxRemovedParts} removed parts`,
        "/operations",
        operation.operationId,
      ),
    );
  }
  state.document = applyBuildOperations(state.document, [operation]);
  state.operations.push(operation);
  if (operation.kind === "addPart") {
    if (state.basePartIds.has(operation.part.id)) state.removedPartIds.delete(operation.part.id);
    else state.addedPartIds.add(operation.part.id);
  } else if (operation.kind === "removePart") {
    if (state.basePartIds.has(operation.part.id)) state.removedPartIds.add(operation.part.id);
    else state.addedPartIds.delete(operation.part.id);
  }
}

function compileInstruction(
  state: ProgramCompilationState,
  instruction: ProgramOperation,
  instructionIndex: number,
  baseDocumentHash: string,
  buildProgramHash: string,
  provenance: EntityProvenance,
): CompilationIssue | undefined {
  let expansionIndex = 0;
  const nextOperationId = (): string =>
    makeOperationId(
      baseDocumentHash,
      buildProgramHash,
      instruction,
      instructionIndex,
      expansionIndex++,
    );
  const partById = (): Map<string, PartInstance> =>
    new Map(state.document.parts.map((part) => [part.id, part]));

  switch (instruction.kind) {
    case "placePart": {
      if (
        state.localPartIds.has(instruction.localPartId) ||
        state.document.parts.some(({ id }) => id === instruction.localPartId)
      ) {
        return issue(
          "DUPLICATE_LOCAL_PART_ID",
          `Local part identifier is ambiguous: ${instruction.localPartId}`,
          `/operations/${instructionIndex}/localPartId`,
          instruction.operationId,
        );
      }
      const partId = deriveId("part", {
        baseDocumentHash,
        buildProgramHash,
        instructionIndex,
        localPartId: instruction.localPartId,
      });
      const part: PartInstance = {
        id: partId,
        catalogPartId: instruction.catalogPartId,
        colorId: instruction.colorId,
        transform: instruction.transform,
        submodelId: instruction.submodelId,
        stepId: instruction.stepId,
        semanticTags: instruction.semanticTags,
        provenance,
      };
      appendOperation(state, {
        kind: "addPart",
        operationId: nextOperationId(),
        part,
        semanticRegionIds: [],
      });
      state.localPartIds.set(instruction.localPartId, partId);
      return undefined;
    }
    case "attach": {
      const aPartId = resolvePartId(instruction.a.partId, state.localPartIds);
      const bPartId = resolvePartId(instruction.b.partId, state.localPartIds);
      const parts = partById();
      if (!parts.has(aPartId) || !parts.has(bPartId)) {
        return issue(
          "CONNECTION_REFERENCE_NOT_FOUND",
          "An attach instruction references a part that does not exist at this point",
          `/operations/${instructionIndex}`,
          instruction.operationId,
        );
      }
      const connection: ConnectionEdge = {
        id: deriveId("connection", {
          baseDocumentHash,
          buildProgramHash,
          instructionIndex,
          a: { ...instruction.a, partId: aPartId },
          b: { ...instruction.b, partId: bPartId },
        }),
        kind: instruction.connectionKind,
        a: { ...instruction.a, partId: aPartId },
        b: { ...instruction.b, partId: bPartId },
        provenance,
      };
      appendOperation(state, {
        kind: "addConnection",
        operationId: nextOperationId(),
        connection,
      });
      return undefined;
    }
    case "removePart": {
      const partId = resolvePartId(instruction.partId, state.localPartIds);
      const part = partById().get(partId);
      if (!part) {
        return issue(
          "PART_REFERENCE_NOT_FOUND",
          `Part does not exist: ${instruction.partId}`,
          `/operations/${instructionIndex}/partId`,
          instruction.operationId,
        );
      }
      const incident = state.document.connections
        .filter(({ a, b }) => a.partId === partId || b.partId === partId)
        .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
      for (const connection of incident) {
        appendOperation(state, {
          kind: "removeConnection",
          operationId: nextOperationId(),
          connection,
        });
      }
      const semanticRegionIds = state.document.semanticRegions
        .filter((region) => region.partIds.includes(part.id))
        .map(({ id }) => id)
        .sort();
      appendOperation(state, {
        kind: "removePart",
        operationId: nextOperationId(),
        part,
        semanticRegionIds,
      });
      return undefined;
    }
    case "replacePart":
    case "movePart":
    case "recolorPart":
    case "assignStep": {
      const partId = resolvePartId(instruction.partId, state.localPartIds);
      const before = partById().get(partId);
      if (!before) {
        return issue(
          "PART_REFERENCE_NOT_FOUND",
          `Part does not exist: ${instruction.partId}`,
          `/operations/${instructionIndex}/partId`,
          instruction.operationId,
        );
      }
      const changes =
        instruction.kind === "replacePart"
          ? { catalogPartId: instruction.catalogPartId, colorId: instruction.colorId }
          : instruction.kind === "movePart"
            ? { transform: instruction.transform }
            : instruction.kind === "recolorPart"
              ? { colorId: instruction.colorId }
              : { stepId: instruction.stepId };
      const after = updateProvenance(before, provenance, changes);
      appendOperation(state, {
        kind: "updatePart",
        operationId: nextOperationId(),
        before,
        after,
      });
      return undefined;
    }
    case "instantiateTemplate":
      return issue(
        "TEMPLATE_NOT_SUPPORTED",
        `Template is not installed in this compiler snapshot: ${instruction.templateId}`,
        `/operations/${instructionIndex}/templateId`,
        instruction.operationId,
      );
  }
}

function fullPartBounds(part: PartInstance): { min: LduVector3; max: LduVector3 } | undefined {
  const definition = getPartDefinition(part.catalogPartId);
  if (!definition || !definition.legalOrientationIds.includes(part.transform.orientationId)) {
    return undefined;
  }
  const { min, max } = definition.boundsLdu;
  const points: LduVector3[] = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        points.push(transformLduPoint(part.transform, [x, y, z]));
      }
    }
  }
  return {
    min: [
      Math.min(...points.map(([x]) => x)),
      Math.min(...points.map(([, y]) => y)),
      Math.min(...points.map(([, , z]) => z)),
    ],
    max: [
      Math.max(...points.map(([x]) => x)),
      Math.max(...points.map(([, y]) => y)),
      Math.max(...points.map(([, , z]) => z)),
    ],
  };
}

function portRefKey({ partId, portId }: PartPortRef): string {
  return `${partId}\u0000${portId}`;
}

function scopeIssues(
  base: BrickDocumentV1,
  result: BrickDocumentV1,
  operations: readonly BuildOperation[],
  scope: ScopeCapabilityV1,
): CompilationIssue[] {
  const issues: CompilationIssue[] = [];
  const mutable = new Set(scope.mutablePartIds);
  const frozen = new Set(scope.frozenPartIds);
  const overlap = scope.mutablePartIds.filter((id) => frozen.has(id));
  if (overlap.length > 0) {
    issues.push(
      issue(
        "SCOPE_OVERLAP",
        `Parts cannot be both frozen and mutable: ${overlap.join(", ")}`,
        "/scope",
      ),
    );
  }

  const baseParts = new Map(base.parts.map((part) => [part.id, part]));
  const resultParts = new Map(result.parts.map((part) => [part.id, part]));
  const added = result.parts.filter(({ id }) => !baseParts.has(id));
  const removed = base.parts.filter(({ id }) => !resultParts.has(id));
  const changed = result.parts.filter((part) => {
    const before = baseParts.get(part.id);
    return before !== undefined && canonicalStringify(before) !== canonicalStringify(part);
  });

  for (const part of [...removed, ...changed]) {
    if (!mutable.has(part.id)) {
      issues.push(
        issue(
          "SCOPE_PART_LOCKED",
          `Patch changes a part outside mutable scope: ${part.id}`,
          "/operations",
        ),
      );
    }
  }

  if (added.length > scope.budgets.maxAddedParts) {
    issues.push(
      issue(
        "SCOPE_ADDITION_BUDGET_EXCEEDED",
        `Patch adds ${added.length} parts but the capability allows ${scope.budgets.maxAddedParts}`,
        "/operations",
      ),
    );
  }
  if (removed.length > scope.budgets.maxRemovedParts) {
    issues.push(
      issue(
        "SCOPE_REMOVAL_BUDGET_EXCEEDED",
        `Patch removes ${removed.length} parts but the capability allows ${scope.budgets.maxRemovedParts}`,
        "/operations",
      ),
    );
  }
  if (operations.length > scope.budgets.maxOperations) {
    issues.push(
      issue(
        "SCOPE_OPERATION_BUDGET_EXCEEDED",
        `Compiler expanded ${operations.length} operations but the capability allows ${scope.budgets.maxOperations}`,
        "/operations",
      ),
    );
  }

  for (const part of [...added, ...changed]) {
    if (!scope.allowedCatalogPartIds.includes(part.catalogPartId)) {
      issues.push(
        issue(
          "SCOPE_CATALOG_PART_NOT_ALLOWED",
          `Catalog part is outside scope: ${part.catalogPartId}`,
          "/operations",
        ),
      );
    }
    if (!scope.allowedColorIds.includes(part.colorId)) {
      issues.push(
        issue("SCOPE_COLOR_NOT_ALLOWED", `Color is outside scope: ${part.colorId}`, "/operations"),
      );
    }
    const bounds = fullPartBounds(part);
    if (
      (bounds &&
        bounds.min.some((coordinate, axis) => coordinate < scope.allowedVolume.minLdu[axis]!)) ||
      (bounds &&
        bounds.max.some((coordinate, axis) => coordinate > scope.allowedVolume.maxLdu[axis]!))
    ) {
      issues.push(
        issue("SCOPE_VOLUME_EXCEEDED", `Part leaves the allowed volume: ${part.id}`, "/operations"),
      );
    }
  }

  const requiredPorts = new Set(
    scope.requiredAttachmentPorts.map(({ partId, portId }) =>
      portRefKey({ partId: resolvePartId(partId, new Map()), portId }),
    ),
  );
  const occupiedBasePorts = new Set(
    base.connections.flatMap((connection) => [portRefKey(connection.a), portRefKey(connection.b)]),
  );
  for (const required of requiredPorts) {
    if (occupiedBasePorts.has(required)) {
      issues.push(
        issue(
          "SCOPE_REQUIRED_ATTACHMENT_OCCUPIED",
          "A required patch attachment port is already occupied in the base document",
          "/scope/requiredAttachmentPorts",
        ),
      );
    }
  }
  for (const operation of operations) {
    if (operation.kind !== "addConnection" && operation.kind !== "removeConnection") continue;
    const endpointIds = [operation.connection.a.partId, operation.connection.b.partId];
    const lockedEndpointIds = endpointIds.filter(
      (partId) => baseParts.has(partId) && !mutable.has(partId),
    );
    if (operation.kind === "removeConnection" && lockedEndpointIds.length > 0) {
      issues.push(
        issue(
          "SCOPE_CONNECTION_LOCKED",
          `Patch detaches a locked part: ${lockedEndpointIds.join(", ")}`,
          "/operations",
          operation.operationId,
        ),
      );
    }
    if (
      operation.kind === "addConnection" &&
      lockedEndpointIds.some((partId) => {
        const endpoint =
          operation.connection.a.partId === partId
            ? operation.connection.a
            : operation.connection.b;
        return !requiredPorts.has(portRefKey(endpoint));
      })
    ) {
      issues.push(
        issue(
          "SCOPE_CONNECTION_LOCKED",
          "Patch connects to a locked port that was not authorized as an attachment",
          "/operations",
          operation.operationId,
        ),
      );
    }
  }

  const resultConnectionIds = new Set(result.connections.map(({ id }) => id));
  const patchAddedResultPorts = new Set(
    operations
      .filter(
        (operation) =>
          operation.kind === "addConnection" && resultConnectionIds.has(operation.connection.id),
      )
      .flatMap((operation) =>
        operation.kind === "addConnection"
          ? [portRefKey(operation.connection.a), portRefKey(operation.connection.b)]
          : [],
      ),
  );
  for (const required of requiredPorts) {
    if (!patchAddedResultPorts.has(required)) {
      issues.push(
        issue(
          "SCOPE_REQUIRED_ATTACHMENT_MISSING",
          "Patch does not preserve a required attachment port",
          "/operations",
        ),
      );
    }
  }

  return issues;
}

function validationIssueSignature(validationIssue: ValidationIssue): string {
  return canonicalStringify({
    code: validationIssue.code,
    issueId: validationIssue.issueId,
    partIds: [...validationIssue.partIds].sort(),
    connectionIds: [...validationIssue.connectionIds].sort(),
  });
}

const INCOMPLETE_VALIDATION_CODES = new Set([
  "COLLISION_COMPARISON_BUDGET_EXCEEDED",
  "COLLISION_FINDING_BUDGET_EXCEEDED",
  "VALIDATION_ISSUE_BUDGET_EXCEEDED",
]);

export function compileBuildProgram(
  baseValue: unknown,
  programValue: unknown,
  context: CompilationContext,
): CompilationResult {
  let detachedBaseValue: unknown;
  let detachedProgramValue: unknown;
  let detachedScopeValue: unknown;
  try {
    detachedBaseValue = structuredClone(baseValue);
  } catch {
    return {
      ok: false,
      issues: [
        issue(
          "BASE_DOCUMENT_SCHEMA_INVALID",
          "Base document must be detached structured-cloneable data",
          "/base",
        ),
      ],
    };
  }
  try {
    detachedProgramValue = structuredClone(programValue);
  } catch {
    return {
      ok: false,
      issues: [
        issue(
          "BUILD_PROGRAM_SCHEMA_INVALID",
          "Build program must be detached structured-cloneable data",
          "/program",
        ),
      ],
    };
  }
  try {
    detachedScopeValue = structuredClone(context.scope);
  } catch {
    return {
      ok: false,
      issues: [
        issue(
          "SCOPE_SCHEMA_INVALID",
          "Scope capability must be detached structured-cloneable data",
          "/scope",
        ),
      ],
    };
  }

  if (!validateBrickDocumentV1(detachedBaseValue)) {
    return {
      ok: false,
      issues: schemaIssues("BASE_DOCUMENT_SCHEMA_INVALID", validateBrickDocumentV1.errors),
    };
  }
  if (!validateBuildProgramV1(detachedProgramValue)) {
    return {
      ok: false,
      issues: schemaIssues("BUILD_PROGRAM_SCHEMA_INVALID", validateBuildProgramV1.errors),
    };
  }
  if (!validateScopeCapabilityV1(detachedScopeValue)) {
    return {
      ok: false,
      issues: schemaIssues("SCOPE_SCHEMA_INVALID", validateScopeCapabilityV1.errors),
    };
  }

  const base = normalizeBrickDocument(detachedBaseValue);
  const program: BuildProgramV1 = normalizeBuildProgram(detachedProgramValue);
  const scope = normalizeScopeCapability(detachedScopeValue);
  if (canonicalDigest(base.truth) !== canonicalDigest(createBuiltinTruthSnapshot())) {
    return {
      ok: false,
      issues: [
        issue(
          "BASE_TRUTH_SNAPSHOT_UNSUPPORTED",
          "Base document requires an explicit truth-snapshot migration before compilation",
          "/base/truth",
        ),
      ],
    };
  }
  const baseDocumentHash = documentStructuralHash(base);
  if (scope.baseRevision !== base.revision || scope.baseDocumentHash !== baseDocumentHash) {
    return {
      ok: false,
      issues: [
        issue(
          "SCOPE_BASE_MISMATCH",
          "Scope capability does not match the exact base revision and structural hash",
          "/scope",
        ),
      ],
    };
  }

  const buildProgramHash = canonicalDigest(program);
  const provenance: EntityProvenance = { source: "ai", sourceId: context.candidateId };
  const state: ProgramCompilationState = {
    document: base,
    operations: [],
    localPartIds: new Map(),
    basePartIds: new Set(base.parts.map(({ id }) => id)),
    addedPartIds: new Set(),
    removedPartIds: new Set(),
    budgets: scope.budgets,
  };
  const seenProgramOperationIds = new Set<string>();

  for (let index = 0; index < program.operations.length; index += 1) {
    const instruction = program.operations[index];
    if (!instruction) continue;
    if (seenProgramOperationIds.has(instruction.operationId)) {
      return {
        ok: false,
        issues: [
          issue(
            "DUPLICATE_PROGRAM_OPERATION_ID",
            `Program operation identifier is duplicated: ${instruction.operationId}`,
            `/operations/${index}/operationId`,
            instruction.operationId,
          ),
        ],
      };
    }
    seenProgramOperationIds.add(instruction.operationId);
    try {
      const instructionIssue = compileInstruction(
        state,
        instruction,
        index,
        baseDocumentHash,
        buildProgramHash,
        provenance,
      );
      if (instructionIssue) return { ok: false, issues: [instructionIssue] };
    } catch (error) {
      if (error instanceof CompilationLimitError) {
        return { ok: false, issues: [error.compilationIssue] };
      }
      const message =
        error instanceof OperationApplicationError ? error.message : "Operation application failed";
      return {
        ok: false,
        issues: [
          issue(
            "OPERATION_APPLICATION_FAILED",
            message,
            `/operations/${index}`,
            instruction.operationId,
          ),
        ],
      };
    }
  }

  let resultDocument: BrickDocumentV1;
  try {
    resultDocument = applyBuildOperations(base, state.operations);
  } catch (error) {
    return {
      ok: false,
      issues: [
        issue(
          "OPERATION_APPLICATION_FAILED",
          error instanceof Error ? error.message : "Operation application failed",
          "/operations",
        ),
      ],
    };
  }
  if (documentStructuralHash(resultDocument) !== documentStructuralHash(state.document)) {
    return {
      ok: false,
      issues: [
        issue(
          "COMPILER_INTERNAL_MISMATCH",
          "Incremental and aggregate operation application produced different documents",
          "/operations",
        ),
      ],
    };
  }

  const scopedIssues = scopeIssues(base, resultDocument, state.operations, scope);
  if (scopedIssues.length > 0) return { ok: false, issues: scopedIssues };

  const baseValidation = validateBrickDocument(base);
  const resultValidation = validateBrickDocument(resultDocument);
  const incompleteValidation = [...baseValidation.issues, ...resultValidation.issues].filter(
    ({ code }) => INCOMPLETE_VALIDATION_CODES.has(code),
  );
  if (incompleteValidation.length > 0) {
    return {
      ok: false,
      issues: [
        issue(
          "HARD_VALIDATION_INCOMPLETE",
          `Compilation cannot continue without complete hard validation: ${[
            ...new Set(incompleteValidation.map(({ code }) => code)),
          ].join(", ")}`,
          "/validation",
        ),
      ],
    };
  }
  const baseBlocking = new Set(
    baseValidation.issues
      .filter(({ severity }) => severity === "blocking")
      .map(validationIssueSignature),
  );
  const introduced = resultValidation.issues.filter(
    (validationIssue) =>
      validationIssue.severity === "blocking" &&
      !baseBlocking.has(validationIssueSignature(validationIssue)),
  );
  const validationReport: ValidationReportV1 = {
    ...resultValidation,
    patchValid: introduced.length === 0,
  };
  if (
    !validationReport.patchValid ||
    (baseValidation.documentGloballyValid && !validationReport.documentGloballyValid)
  ) {
    return {
      ok: false,
      issues: introduced.map((introducedIssue) =>
        issue(
          "PATCH_INTRODUCES_BLOCKING_ISSUE",
          `${introducedIssue.code}: ${introducedIssue.message}`,
          introducedIssue.path,
        ),
      ),
    };
  }

  const patch: AssemblyPatchV1 = {
    schemaVersion: "lego.assembly-patch/1",
    baseRevision: base.revision,
    baseDocumentHash,
    truthSnapshotHash: canonicalDigest(base.truth),
    scopeCapabilityId: scope.capabilityId,
    scopeDigest: canonicalDigest(scope),
    operations: state.operations,
    provenance: {
      jobId: context.jobId,
      candidateId: context.candidateId,
      compilerSnapshotHash: BUILTIN_COMPILER_SNAPSHOT_HASH,
      buildProgramHash,
    },
  };
  if (!validateAssemblyPatchV1(patch)) {
    return {
      ok: false,
      issues: [
        issue(
          "PATCH_SCHEMA_INVALID",
          validateAssemblyPatchV1.errors?.[0]?.message ?? "Compiled patch failed schema validation",
          validateAssemblyPatchV1.errors?.[0]?.instancePath ?? "/patch",
        ),
      ],
    };
  }

  return deepFreeze({ ok: true, patch, document: resultDocument, validationReport });
}
