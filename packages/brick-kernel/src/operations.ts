import { validateBrickDocumentV1, validateBuildOperation } from "@lego-studio/protocol";
import type {
  BrickDocumentV1,
  BuildOperation,
  ConnectionEdge,
  PartInstance,
} from "@lego-studio/protocol";

import { canonicalDigest, canonicalSha256, canonicalStringify } from "./canonical.ts";
import {
  normalizeBrickDocument,
  normalizeConnectionEdge,
  normalizePartInstance,
} from "./document.ts";
import { createBuiltinTruthSnapshot } from "./factory.ts";

export type OperationApplicationErrorCode =
  | "DUPLICATE_OPERATION_ID"
  | "OPERATION_LIMIT_EXCEEDED"
  | "OPERATION_SCHEMA_INVALID"
  | "BASE_SCHEMA_INVALID"
  | "BASE_TRUTH_SNAPSHOT_UNSUPPORTED"
  | "BASE_DUPLICATE_PART_ID"
  | "BASE_DUPLICATE_CONNECTION_ID"
  | "BASE_DUPLICATE_SUBMODEL_ID"
  | "BASE_DUPLICATE_STEP_ID"
  | "BASE_DUPLICATE_SEMANTIC_REGION_ID"
  | "PART_ALREADY_EXISTS"
  | "PART_NOT_FOUND"
  | "PART_BEFORE_MISMATCH"
  | "PART_ID_CHANGED"
  | "PART_STILL_CONNECTED"
  | "CONNECTION_ALREADY_EXISTS"
  | "CONNECTION_NOT_FOUND"
  | "CONNECTION_BEFORE_MISMATCH"
  | "SEMANTIC_REGION_NOT_FOUND"
  | "SEMANTIC_MEMBERSHIP_MISMATCH"
  | "RESULT_SCHEMA_INVALID";

export class OperationApplicationError extends Error {
  public readonly code: OperationApplicationErrorCode;
  public readonly operationId: string;

  public constructor(code: OperationApplicationErrorCode, operationId: string, message: string) {
    super(message);
    this.name = "OperationApplicationError";
    this.code = code;
    this.operationId = operationId;
  }
}

export const MAX_BUILD_OPERATIONS = 10_000 as const;

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

function normalizeOperationPayload(
  operation: BuildOperation,
  parts: ReadonlyMap<string, PartInstance>,
): BuildOperation {
  const partValues = [...parts.values()];
  switch (operation.kind) {
    case "addPart":
    case "removePart":
      return {
        ...operation,
        part: normalizePartInstance(operation.part),
        semanticRegionIds: [...operation.semanticRegionIds].sort(),
      };
    case "updatePart":
      return {
        ...operation,
        before: normalizePartInstance(operation.before),
        after: normalizePartInstance(operation.after),
      };
    case "addConnection":
    case "removeConnection":
      return {
        ...operation,
        connection: normalizeConnectionEdge(operation.connection, partValues),
      };
  }
}

function replaceMembership(
  memberships: Map<string, Set<string>>,
  partId: string,
  beforeId: string | undefined,
  afterId: string | undefined,
): void {
  if (beforeId === afterId) return;
  if (beforeId !== undefined) memberships.get(beforeId)?.delete(partId);
  if (afterId !== undefined) memberships.get(afterId)?.add(partId);
}

function requireMatchingPart(
  parts: ReadonlyMap<string, PartInstance>,
  expected: PartInstance,
  operationId: string,
): PartInstance {
  const actual = parts.get(expected.id);
  if (!actual) {
    throw new OperationApplicationError(
      "PART_NOT_FOUND",
      operationId,
      `Part does not exist: ${expected.id}`,
    );
  }
  if (!sameCanonicalValue(actual, expected)) {
    throw new OperationApplicationError(
      "PART_BEFORE_MISMATCH",
      operationId,
      `Part before-value is stale: ${expected.id}`,
    );
  }
  return actual;
}

function requireMatchingConnection(
  connections: ReadonlyMap<string, ConnectionEdge>,
  expected: ConnectionEdge,
  operationId: string,
): ConnectionEdge {
  const actual = connections.get(expected.id);
  if (!actual) {
    throw new OperationApplicationError(
      "CONNECTION_NOT_FOUND",
      operationId,
      `Connection does not exist: ${expected.id}`,
    );
  }
  if (!sameCanonicalValue(actual, expected)) {
    throw new OperationApplicationError(
      "CONNECTION_BEFORE_MISMATCH",
      operationId,
      `Connection before-value is stale: ${expected.id}`,
    );
  }
  return actual;
}

export function applyBuildOperations(
  base: BrickDocumentV1,
  operations: readonly BuildOperation[],
): BrickDocumentV1 {
  let detachedBase: unknown;
  let detachedOperations: unknown;
  try {
    detachedBase = structuredClone(base);
  } catch {
    throw new OperationApplicationError(
      "BASE_SCHEMA_INVALID",
      "operation-set",
      "Base document must be detached structured-cloneable data",
    );
  }
  try {
    detachedOperations = structuredClone(operations);
  } catch {
    throw new OperationApplicationError(
      "OPERATION_SCHEMA_INVALID",
      "operation-set",
      "Build operations must be detached structured-cloneable data",
    );
  }
  if (!Array.isArray(detachedOperations)) {
    throw new OperationApplicationError(
      "OPERATION_SCHEMA_INVALID",
      "operation-set",
      "Build operations must be an array",
    );
  }
  const operationSet = detachedOperations as BuildOperation[];
  if (operationSet.length > MAX_BUILD_OPERATIONS) {
    throw new OperationApplicationError(
      "OPERATION_LIMIT_EXCEEDED",
      "operation-set",
      `Operation count exceeds ${MAX_BUILD_OPERATIONS}`,
    );
  }
  let baseSchemaValid = false;
  try {
    baseSchemaValid = validateBrickDocumentV1(detachedBase);
  } catch {
    // Hostile getters and proxies are rejected at the schema boundary.
  }
  if (!baseSchemaValid) {
    throw new OperationApplicationError(
      "BASE_SCHEMA_INVALID",
      "operation-set",
      `Base document failed runtime schema validation: ${validateBrickDocumentV1.errors?.[0]?.message ?? "unreadable input"}`,
    );
  }
  const normalizedBase = normalizeBrickDocument(detachedBase as BrickDocumentV1);
  if (canonicalDigest(normalizedBase.truth) !== canonicalDigest(createBuiltinTruthSnapshot())) {
    throw new OperationApplicationError(
      "BASE_TRUTH_SNAPSHOT_UNSUPPORTED",
      "operation-set",
      "Base document requires an explicit truth-snapshot migration before operations can apply",
    );
  }
  if (new Set(normalizedBase.parts.map(({ id }) => id)).size !== normalizedBase.parts.length) {
    throw new OperationApplicationError(
      "BASE_DUPLICATE_PART_ID",
      "operation-set",
      "Cannot apply operations to a document with duplicate part identifiers",
    );
  }
  if (
    new Set(normalizedBase.connections.map(({ id }) => id)).size !==
    normalizedBase.connections.length
  ) {
    throw new OperationApplicationError(
      "BASE_DUPLICATE_CONNECTION_ID",
      "operation-set",
      "Cannot apply operations to a document with duplicate connection identifiers",
    );
  }
  if (
    new Set(normalizedBase.submodels.map(({ id }) => id)).size !== normalizedBase.submodels.length
  ) {
    throw new OperationApplicationError(
      "BASE_DUPLICATE_SUBMODEL_ID",
      "operation-set",
      "Cannot apply operations to a document with duplicate submodel identifiers",
    );
  }
  if (new Set(normalizedBase.steps.map(({ id }) => id)).size !== normalizedBase.steps.length) {
    throw new OperationApplicationError(
      "BASE_DUPLICATE_STEP_ID",
      "operation-set",
      "Cannot apply operations to a document with duplicate step identifiers",
    );
  }
  if (
    new Set(normalizedBase.semanticRegions.map(({ id }) => id)).size !==
    normalizedBase.semanticRegions.length
  ) {
    throw new OperationApplicationError(
      "BASE_DUPLICATE_SEMANTIC_REGION_ID",
      "operation-set",
      "Cannot apply operations to a document with duplicate semantic-region identifiers",
    );
  }
  const parts = new Map(normalizedBase.parts.map((part) => [part.id, part]));
  const connections = new Map(
    normalizedBase.connections.map((connection) => [connection.id, connection]),
  );
  const submodelMemberships = new Map(
    normalizedBase.submodels.map((submodel) => [submodel.id, new Set(submodel.partIds)]),
  );
  const stepMemberships = new Map(
    normalizedBase.steps.map((step) => [step.id, new Set(step.partIds)]),
  );
  const semanticMemberships = new Map(
    normalizedBase.semanticRegions.map((region) => [region.id, new Set(region.partIds)]),
  );
  const seenOperationIds = new Set<string>();
  const appliedOperations: BuildOperation[] = [];

  for (const rawOperation of operationSet) {
    let operationSchemaValid = false;
    try {
      operationSchemaValid = validateBuildOperation(rawOperation);
    } catch {
      // Hostile getters and proxies are rejected at the schema boundary.
    }
    if (!operationSchemaValid) {
      const candidate =
        typeof rawOperation === "object" && rawOperation !== null
          ? (rawOperation as { readonly operationId?: unknown })
          : undefined;
      throw new OperationApplicationError(
        "OPERATION_SCHEMA_INVALID",
        typeof candidate?.operationId === "string" ? candidate.operationId : "unknown-operation",
        `Build operation failed runtime schema validation: ${validateBuildOperation.errors?.[0]?.message ?? "unknown schema error"}`,
      );
    }
    const operation = normalizeOperationPayload(rawOperation, parts);
    if (seenOperationIds.has(operation.operationId)) {
      throw new OperationApplicationError(
        "DUPLICATE_OPERATION_ID",
        operation.operationId,
        `Operation identifier is duplicated: ${operation.operationId}`,
      );
    }
    seenOperationIds.add(operation.operationId);

    switch (operation.kind) {
      case "addPart": {
        const { part } = operation;
        if (parts.has(part.id)) {
          throw new OperationApplicationError(
            "PART_ALREADY_EXISTS",
            operation.operationId,
            `Part already exists: ${part.id}`,
          );
        }
        replaceMembership(submodelMemberships, part.id, undefined, part.submodelId);
        replaceMembership(stepMemberships, part.id, undefined, part.stepId);
        for (const semanticRegionId of operation.semanticRegionIds) {
          const membership = semanticMemberships.get(semanticRegionId);
          if (!membership) {
            throw new OperationApplicationError(
              "SEMANTIC_REGION_NOT_FOUND",
              operation.operationId,
              `Semantic region does not exist: ${semanticRegionId}`,
            );
          }
          membership.add(part.id);
        }
        parts.set(part.id, part);
        break;
      }
      case "removePart": {
        const part = requireMatchingPart(parts, operation.part, operation.operationId);
        if (
          [...connections.values()].some(({ a, b }) => a.partId === part.id || b.partId === part.id)
        ) {
          throw new OperationApplicationError(
            "PART_STILL_CONNECTED",
            operation.operationId,
            `Remove incident connections before removing part: ${part.id}`,
          );
        }
        replaceMembership(submodelMemberships, part.id, part.submodelId, undefined);
        replaceMembership(stepMemberships, part.id, part.stepId, undefined);
        const actualSemanticRegionIds = [...semanticMemberships]
          .filter(([, membership]) => membership.has(part.id))
          .map(([regionId]) => regionId)
          .sort();
        const expectedSemanticRegionIds = [...operation.semanticRegionIds].sort();
        if (!sameCanonicalValue(actualSemanticRegionIds, expectedSemanticRegionIds)) {
          throw new OperationApplicationError(
            "SEMANTIC_MEMBERSHIP_MISMATCH",
            operation.operationId,
            `Part semantic-region membership is stale: ${part.id}`,
          );
        }
        for (const membership of semanticMemberships.values()) membership.delete(part.id);
        parts.delete(part.id);
        break;
      }
      case "updatePart": {
        requireMatchingPart(parts, operation.before, operation.operationId);
        if (operation.before.id !== operation.after.id) {
          throw new OperationApplicationError(
            "PART_ID_CHANGED",
            operation.operationId,
            "An updatePart operation cannot change stable part identity",
          );
        }
        replaceMembership(
          submodelMemberships,
          operation.before.id,
          operation.before.submodelId,
          operation.after.submodelId,
        );
        replaceMembership(
          stepMemberships,
          operation.before.id,
          operation.before.stepId,
          operation.after.stepId,
        );
        parts.set(operation.after.id, operation.after);
        break;
      }
      case "addConnection": {
        if (connections.has(operation.connection.id)) {
          throw new OperationApplicationError(
            "CONNECTION_ALREADY_EXISTS",
            operation.operationId,
            `Connection already exists: ${operation.connection.id}`,
          );
        }
        connections.set(operation.connection.id, operation.connection);
        break;
      }
      case "removeConnection": {
        requireMatchingConnection(connections, operation.connection, operation.operationId);
        connections.delete(operation.connection.id);
        break;
      }
      default: {
        const unknownOperation: never = operation;
        throw new OperationApplicationError(
          "OPERATION_SCHEMA_INVALID",
          "unknown-operation",
          `Unsupported build operation: ${JSON.stringify(unknownOperation)}`,
        );
      }
    }
    appliedOperations.push(operation);
  }

  const result: BrickDocumentV1 = normalizeBrickDocument({
    ...normalizedBase,
    revision: `revision-${canonicalSha256({
      baseRevision: normalizedBase.revision,
      operations: appliedOperations,
    }).slice(0, 24)}`,
    parts: [...parts.values()],
    connections: [...connections.values()],
    submodels: normalizedBase.submodels.map((submodel) => ({
      ...submodel,
      partIds: [...(submodelMemberships.get(submodel.id) ?? [])],
    })),
    steps: normalizedBase.steps.map((step) => ({
      ...step,
      partIds: [...(stepMemberships.get(step.id) ?? [])],
    })),
    semanticRegions: normalizedBase.semanticRegions.map((region) => ({
      ...region,
      partIds: [...(semanticMemberships.get(region.id) ?? [])],
    })),
  });

  if (!validateBrickDocumentV1(result)) {
    throw new OperationApplicationError(
      "RESULT_SCHEMA_INVALID",
      operationSet.at(-1)?.operationId ?? "operation-set",
      `Applied operations produced an invalid wire document: ${validateBrickDocumentV1.errors?.[0]?.message ?? "unknown schema error"}`,
    );
  }
  return result;
}

export function invertBuildOperations(operations: readonly BuildOperation[]): BuildOperation[] {
  const inverted = [...operations].reverse().map((operation): BuildOperation => {
    switch (operation.kind) {
      case "addPart":
        return { ...operation, kind: "removePart" };
      case "removePart":
        return { ...operation, kind: "addPart" };
      case "updatePart":
        return { ...operation, before: operation.after, after: operation.before };
      case "addConnection":
        return { ...operation, kind: "removeConnection" };
      case "removeConnection":
        return { ...operation, kind: "addConnection" };
    }
  });

  const dependencies = inverted.map(() => new Set<number>());
  for (let index = 0; index < inverted.length; index += 1) {
    const operation = inverted[index]!;
    if (operation.kind === "removePart") {
      inverted.forEach((candidate, candidateIndex) => {
        if (
          candidate.kind === "removeConnection" &&
          (candidate.connection.a.partId === operation.part.id ||
            candidate.connection.b.partId === operation.part.id)
        ) {
          dependencies[index]!.add(candidateIndex);
        }
      });
    } else if (operation.kind === "addConnection") {
      inverted.forEach((candidate, candidateIndex) => {
        if (
          candidate.kind === "addPart" &&
          (operation.connection.a.partId === candidate.part.id ||
            operation.connection.b.partId === candidate.part.id)
        ) {
          dependencies[index]!.add(candidateIndex);
        }
      });
    }
  }

  const ordered: BuildOperation[] = [];
  const emitted = new Set<number>();
  while (ordered.length < inverted.length) {
    const nextIndex = dependencies.findIndex(
      (required, index) =>
        !emitted.has(index) && [...required].every((value) => emitted.has(value)),
    );
    if (nextIndex < 0) {
      throw new Error("Build-operation inverse dependencies contain a cycle");
    }
    emitted.add(nextIndex);
    ordered.push(inverted[nextIndex]!);
  }
  return ordered;
}
