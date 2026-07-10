import { getPartDefinition, type LduVector3 } from "@lego-studio/catalog";
import type {
  BrickDocumentV1,
  BuildOperation,
  PartInstance,
  PartPortRef,
  ScopeCapabilityV1,
  ValidationIssue,
  ValidationReportV1,
} from "@lego-studio/protocol";

import { canonicalStringify } from "./canonical.ts";
import { getConnectorWorldFrame, transformLduPoint } from "./transforms.ts";
import { validateBrickDocument } from "./validation.ts";

export type ScopePolicyIssueCode =
  | "SCOPE_OVERLAP"
  | "SCOPE_PART_LOCKED"
  | "SCOPE_CONNECTION_LOCKED"
  | "SCOPE_CATALOG_PART_NOT_ALLOWED"
  | "SCOPE_COLOR_NOT_ALLOWED"
  | "SCOPE_BOUNDS_UNAVAILABLE"
  | "SCOPE_VOLUME_EXCEEDED"
  | "SCOPE_ADDITION_BUDGET_EXCEEDED"
  | "SCOPE_REMOVAL_BUDGET_EXCEEDED"
  | "SCOPE_OPERATION_BUDGET_EXCEEDED"
  | "SCOPE_REQUIRED_ATTACHMENT_MISSING"
  | "SCOPE_REQUIRED_ATTACHMENT_INVALID"
  | "SCOPE_REQUIRED_ATTACHMENT_OCCUPIED";

export interface ScopePolicyIssue {
  readonly code: ScopePolicyIssueCode;
  readonly message: string;
  readonly path: string;
  readonly operationId?: string;
}

function scopeIssue(
  code: ScopePolicyIssueCode,
  message: string,
  path: string,
  operationId?: string,
): ScopePolicyIssue {
  return operationId === undefined ? { code, message, path } : { code, message, path, operationId };
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

/**
 * Compares the complete before/after document state and the operations that
 * produced it against one retained scope capability. Callers must pass
 * detached, schema-valid and normalized values.
 */
export function collectScopePolicyIssues(
  base: BrickDocumentV1,
  result: BrickDocumentV1,
  operations: readonly BuildOperation[],
  scope: ScopeCapabilityV1,
): ScopePolicyIssue[] {
  const issues: ScopePolicyIssue[] = [];
  const mutable = new Set(scope.mutablePartIds);
  const frozen = new Set(scope.frozenPartIds);
  const overlap = scope.mutablePartIds.filter((id) => frozen.has(id));
  if (overlap.length > 0) {
    issues.push(
      scopeIssue(
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
        scopeIssue(
          "SCOPE_PART_LOCKED",
          `Patch changes a part outside mutable scope: ${part.id}`,
          "/operations",
        ),
      );
    }
  }

  if (added.length > scope.budgets.maxAddedParts) {
    issues.push(
      scopeIssue(
        "SCOPE_ADDITION_BUDGET_EXCEEDED",
        `Patch adds ${added.length} parts but the capability allows ${scope.budgets.maxAddedParts}`,
        "/operations",
      ),
    );
  }
  if (removed.length > scope.budgets.maxRemovedParts) {
    issues.push(
      scopeIssue(
        "SCOPE_REMOVAL_BUDGET_EXCEEDED",
        `Patch removes ${removed.length} parts but the capability allows ${scope.budgets.maxRemovedParts}`,
        "/operations",
      ),
    );
  }
  if (operations.length > scope.budgets.maxOperations) {
    issues.push(
      scopeIssue(
        "SCOPE_OPERATION_BUDGET_EXCEEDED",
        `Patch contains ${operations.length} operations but the capability allows ${scope.budgets.maxOperations}`,
        "/operations",
      ),
    );
  }

  for (const part of [...added, ...changed]) {
    if (!scope.allowedCatalogPartIds.includes(part.catalogPartId)) {
      issues.push(
        scopeIssue(
          "SCOPE_CATALOG_PART_NOT_ALLOWED",
          `Catalog part is outside scope: ${part.catalogPartId}`,
          "/operations",
        ),
      );
    }
    if (!scope.allowedColorIds.includes(part.colorId)) {
      issues.push(
        scopeIssue(
          "SCOPE_COLOR_NOT_ALLOWED",
          `Color is outside scope: ${part.colorId}`,
          "/operations",
        ),
      );
    }
    const bounds = fullPartBounds(part);
    if (!bounds) {
      issues.push(
        scopeIssue(
          "SCOPE_BOUNDS_UNAVAILABLE",
          `Patch scope cannot establish authoritative bounds for part: ${part.id}`,
          "/operations",
        ),
      );
      continue;
    }
    if (
      bounds.min.some((coordinate, axis) => coordinate < scope.allowedVolume.minLdu[axis]!) ||
      bounds.max.some((coordinate, axis) => coordinate > scope.allowedVolume.maxLdu[axis]!)
    ) {
      issues.push(
        scopeIssue(
          "SCOPE_VOLUME_EXCEEDED",
          `Part leaves the allowed volume: ${part.id}`,
          "/operations",
        ),
      );
    }
  }

  const requiredPorts = new Set(scope.requiredAttachmentPorts.map(portRefKey));
  const occupiedBasePorts = new Set(
    base.connections.flatMap((connection) => [portRefKey(connection.a), portRefKey(connection.b)]),
  );
  for (let index = 0; index < scope.requiredAttachmentPorts.length; index += 1) {
    const requiredPort = scope.requiredAttachmentPorts[index]!;
    const required = portRefKey(requiredPort);
    const basePart = baseParts.get(requiredPort.partId);
    let resolvesOnBase = false;
    if (basePart) {
      try {
        getConnectorWorldFrame(basePart, requiredPort.portId);
        resolvesOnBase = true;
      } catch {
        // Malformed required ports fail scope before result evaluation.
      }
    }
    if (!resolvesOnBase) {
      issues.push(
        scopeIssue(
          "SCOPE_REQUIRED_ATTACHMENT_INVALID",
          `Required attachment must resolve to a retained base port: ${requiredPort.partId}/${requiredPort.portId}`,
          `/scope/requiredAttachmentPorts/${index}`,
        ),
      );
    } else if (occupiedBasePorts.has(required)) {
      issues.push(
        scopeIssue(
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
        scopeIssue(
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
        scopeIssue(
          "SCOPE_CONNECTION_LOCKED",
          "Patch connects to a locked port that was not authorized as an attachment",
          "/operations",
          operation.operationId,
        ),
      );
    }
  }

  const finalResultPorts = new Set(
    result.connections.flatMap((connection) => [
      portRefKey(connection.a),
      portRefKey(connection.b),
    ]),
  );
  for (const required of requiredPorts) {
    if (!finalResultPorts.has(required)) {
      issues.push(
        scopeIssue(
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

export interface PatchHardValidationAssessment {
  readonly validationReport: ValidationReportV1;
  readonly incompleteCodes: readonly string[];
  readonly introducedBlockingIssues: readonly ValidationIssue[];
  readonly globalValidityPreserved: boolean;
}

/** Runs the complete hard validators and compares deterministic issue identity. */
export function assessPatchHardValidation(
  base: BrickDocumentV1,
  result: BrickDocumentV1,
): PatchHardValidationAssessment {
  const baseValidation = validateBrickDocument(base);
  const resultValidation = validateBrickDocument(result);
  const incompleteCodes = [
    ...new Set(
      [...baseValidation.issues, ...resultValidation.issues]
        .map(({ code }) => code)
        .filter((code) => INCOMPLETE_VALIDATION_CODES.has(code)),
    ),
  ];
  const baseBlocking = new Set(
    baseValidation.issues
      .filter(({ severity }) => severity === "blocking")
      .map(validationIssueSignature),
  );
  const introducedBlockingIssues = resultValidation.issues.filter(
    (validationIssue) =>
      validationIssue.severity === "blocking" &&
      !baseBlocking.has(validationIssueSignature(validationIssue)),
  );

  return {
    validationReport: {
      ...resultValidation,
      patchValid: introducedBlockingIssues.length === 0,
    },
    incompleteCodes,
    introducedBlockingIssues,
    globalValidityPreserved:
      !baseValidation.documentGloballyValid || resultValidation.documentGloballyValid,
  };
}
