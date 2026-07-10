import { getColorDefinition, getPartDefinition } from "@lego-studio/catalog";
import { validateBrickDocumentV1 } from "@lego-studio/protocol";
import type {
  BrickDocumentV1,
  ConnectionEdge,
  PartInstance,
  ValidationIssue,
  ValidationReportV1,
} from "@lego-studio/protocol";

import { canonicalDigest, canonicalSha256, deepFreeze } from "./canonical.ts";
import { findCatalogCollisions } from "./collisions.ts";
import { documentStructuralHash, normalizeBrickDocument } from "./document.ts";
import { createBuiltinTruthSnapshot } from "./factory.ts";
import { getConnectorWorldFrame, TransformPolicyError } from "./transforms.ts";
import { MAX_EVIDENCE_IDS_PER_ISSUE, MAX_VALIDATION_ISSUES } from "./truth-manifests.ts";

interface IssueInput {
  readonly validatorId: string;
  readonly code: string;
  readonly message: string;
  readonly path: string;
  readonly partIds?: readonly string[];
  readonly connectionIds?: readonly string[];
  readonly severity?: ValidationIssue["severity"];
  readonly identity?: unknown;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function makeIssue(input: IssueInput): ValidationIssue {
  const fullPartIds = [...new Set(input.partIds ?? [])].sort(compareStrings);
  const fullConnectionIds = [...new Set(input.connectionIds ?? [])].sort(compareStrings);
  const seed = {
    validatorId: input.validatorId,
    code: input.code,
    message: input.message,
    partIds: fullPartIds,
    connectionIds: fullConnectionIds,
    identity: input.identity ?? null,
  };

  return deepFreeze({
    issueId: `issue-${canonicalSha256(seed).slice(0, 24)}`,
    validatorId: input.validatorId,
    code: input.code,
    severity: input.severity ?? "blocking",
    message: input.message.slice(0, 256),
    path: input.path,
    partIds: fullPartIds.slice(0, MAX_EVIDENCE_IDS_PER_ISSUE),
    connectionIds: fullConnectionIds.slice(0, MAX_EVIDENCE_IDS_PER_ISSUE),
    scope: "document",
  });
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort(compareStrings);
}

function addDuplicateIssues(
  issues: ValidationIssue[],
  values: readonly string[],
  path: string,
  code: string,
  entityKind: "part" | "connection" | "annotation",
): void {
  for (const duplicate of findDuplicates(values)) {
    issues.push(
      makeIssue({
        validatorId: "kernel.identity",
        code,
        message: `Duplicate ${entityKind} identifier: ${duplicate}`,
        path,
        partIds: entityKind === "part" ? [duplicate] : [],
        connectionIds: entityKind === "connection" ? [duplicate] : [],
        identity: duplicate,
      }),
    );
  }
}

function endpointKey(partId: string, portId: string): string {
  return `${partId}\u0000${portId}`;
}

function validateConnections(
  document: BrickDocumentV1,
  partById: ReadonlyMap<string, PartInstance>,
  issues: ValidationIssue[],
): ConnectionEdge[] {
  const validConnections: ConnectionEdge[] = [];
  const occupiedPorts = new Map<string, string>();
  const endpointPairs = new Map<string, string>();

  for (let index = 0; index < document.connections.length; index += 1) {
    const connection = document.connections[index];
    if (!connection) continue;
    const path = `/connections/${index}`;
    const aPart = partById.get(connection.a.partId);
    const bPart = partById.get(connection.b.partId);

    if (!aPart || !bPart) {
      issues.push(
        makeIssue({
          validatorId: "kernel.connections",
          code: "DANGLING_CONNECTION_PART",
          message: `Connection ${connection.id} references a missing part`,
          path,
          partIds: [connection.a.partId, connection.b.partId],
          connectionIds: [connection.id],
        }),
      );
      continue;
    }
    if (aPart.id === bPart.id) {
      issues.push(
        makeIssue({
          validatorId: "kernel.connections",
          code: "SELF_CONNECTION",
          message: `Connection ${connection.id} joins a part to itself`,
          path,
          partIds: [aPart.id],
          connectionIds: [connection.id],
        }),
      );
      continue;
    }

    let aFrame;
    let bFrame;
    try {
      aFrame = getConnectorWorldFrame(aPart, connection.a.portId);
      bFrame = getConnectorWorldFrame(bPart, connection.b.portId);
    } catch (error) {
      const message =
        error instanceof TransformPolicyError ? error.message : "Connection port lookup failed";
      issues.push(
        makeIssue({
          validatorId: "kernel.connections",
          code: "UNKNOWN_CONNECTION_PORT",
          message,
          path,
          partIds: [aPart.id, bPart.id],
          connectionIds: [connection.id],
        }),
      );
      continue;
    }

    const compatible =
      aFrame.kind !== bFrame.kind &&
      ((aFrame.kind === "stud" && bFrame.kind === "undersideClutch") ||
        (aFrame.kind === "undersideClutch" && bFrame.kind === "stud"));
    if (!compatible) {
      issues.push(
        makeIssue({
          validatorId: "kernel.connections",
          code: "INCOMPATIBLE_CONNECTION_PORTS",
          message: `Connection ${connection.id} joins incompatible port kinds`,
          path,
          partIds: [aPart.id, bPart.id],
          connectionIds: [connection.id],
        }),
      );
      continue;
    }

    const coincident = aFrame.positionLdu.every(
      (coordinate, axis) => coordinate === bFrame.positionLdu[axis],
    );
    const opposing = aFrame.normal.every(
      (coordinate, axis) => coordinate === -bFrame.normal[axis]!,
    );
    if (!coincident || !opposing) {
      issues.push(
        makeIssue({
          validatorId: "kernel.connections",
          code: "CONNECTION_TRANSFORM_MISMATCH",
          message: `Connection ${connection.id} does not agree with authoritative transforms`,
          path,
          partIds: [aPart.id, bPart.id],
          connectionIds: [connection.id],
        }),
      );
      continue;
    }

    const aKey = endpointKey(aPart.id, connection.a.portId);
    const bKey = endpointKey(bPart.id, connection.b.portId);
    const pairKey = [aKey, bKey].sort(compareStrings).join("\u0001");
    const priorPair = endpointPairs.get(pairKey);
    if (priorPair) {
      issues.push(
        makeIssue({
          validatorId: "kernel.connections",
          code: "DUPLICATE_CONNECTION",
          message: `Connection ${connection.id} duplicates ${priorPair}`,
          path,
          partIds: [aPart.id, bPart.id],
          connectionIds: [priorPair, connection.id],
        }),
      );
      continue;
    }

    const occupied = [aKey, bKey]
      .map((key) => occupiedPorts.get(key))
      .filter((value): value is string => value !== undefined);
    if (occupied.length > 0) {
      issues.push(
        makeIssue({
          validatorId: "kernel.connections",
          code: "PORT_CAPACITY_EXCEEDED",
          message: `Connection ${connection.id} reuses an occupied port`,
          path,
          partIds: [aPart.id, bPart.id],
          connectionIds: [...occupied, connection.id],
        }),
      );
      continue;
    }

    occupiedPorts.set(aKey, connection.id);
    occupiedPorts.set(bKey, connection.id);
    endpointPairs.set(pairKey, connection.id);
    validConnections.push(connection);
  }

  return validConnections;
}

function validateConnectivity(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
  issues: ValidationIssue[],
): void {
  if (parts.length <= 1) return;

  const adjacency = new Map(parts.map(({ id }) => [id, new Set<string>()]));
  for (const connection of connections) {
    adjacency.get(connection.a.partId)?.add(connection.b.partId);
    adjacency.get(connection.b.partId)?.add(connection.a.partId);
  }

  const start = [...adjacency.keys()].sort(compareStrings)[0];
  if (!start) return;
  const visited = new Set([start]);
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }

  if (visited.size !== parts.length) {
    const disconnected = parts.map(({ id }) => id).filter((id) => !visited.has(id));
    issues.push(
      makeIssue({
        validatorId: "kernel.connectivity",
        code: "DISCONNECTED_ASSEMBLY",
        message: "Every multi-part document must form one connected assembly",
        path: "/connections",
        partIds: disconnected,
      }),
    );
  }
}

function validateMemberships(
  document: BrickDocumentV1,
  partById: ReadonlyMap<string, PartInstance>,
  issues: ValidationIssue[],
): void {
  const submodelById = new Map(document.submodels.map((submodel) => [submodel.id, submodel]));
  const stepById = new Map(document.steps.map((step) => [step.id, step]));

  for (let index = 0; index < document.parts.length; index += 1) {
    const part = document.parts[index];
    if (!part) continue;
    const submodel = submodelById.get(part.submodelId);
    const step = stepById.get(part.stepId);
    if (!submodel || !submodel.partIds.includes(part.id)) {
      issues.push(
        makeIssue({
          validatorId: "kernel.membership",
          code: "SUBMODEL_MEMBERSHIP_MISMATCH",
          message: `Part ${part.id} is not declared in submodel ${part.submodelId}`,
          path: `/parts/${index}/submodelId`,
          partIds: [part.id],
        }),
      );
    }
    if (!step || !step.partIds.includes(part.id)) {
      issues.push(
        makeIssue({
          validatorId: "kernel.membership",
          code: "STEP_MEMBERSHIP_MISMATCH",
          message: `Part ${part.id} is not declared in build step ${part.stepId}`,
          path: `/parts/${index}/stepId`,
          partIds: [part.id],
        }),
      );
    }
  }

  const annotations = [
    ...document.submodels.map((entry, index) => ({
      path: `/submodels/${index}/partIds`,
      assignedId: entry.id,
      kind: "submodel" as const,
      partIds: entry.partIds,
    })),
    ...document.steps.map((entry, index) => ({
      path: `/steps/${index}/partIds`,
      assignedId: entry.id,
      kind: "step" as const,
      partIds: entry.partIds,
    })),
  ];

  for (const annotation of annotations) {
    for (const partId of annotation.partIds) {
      const part = partById.get(partId);
      const assigned = annotation.kind === "submodel" ? part?.submodelId : part?.stepId;
      if (!part || assigned !== annotation.assignedId) {
        issues.push(
          makeIssue({
            validatorId: "kernel.membership",
            code: "ANNOTATION_MEMBERSHIP_MISMATCH",
            message: `${annotation.kind} ${annotation.assignedId} contains an inconsistent part reference`,
            path: annotation.path,
            partIds: [partId],
          }),
        );
      }
    }
  }

  for (let index = 0; index < document.semanticRegions.length; index += 1) {
    const region = document.semanticRegions[index];
    if (!region) continue;
    for (const partId of region.partIds) {
      if (!partById.has(partId)) {
        issues.push(
          makeIssue({
            validatorId: "kernel.membership",
            code: "DANGLING_SEMANTIC_REGION_PART",
            message: `Semantic region ${region.id} references a missing part`,
            path: `/semanticRegions/${index}/partIds`,
            partIds: [partId],
          }),
        );
      }
    }
  }
}

function rejectedValueDigest(value: unknown): `sha256:${string}` {
  try {
    return canonicalDigest(value);
  } catch {
    let rejectedValueKind = "unreadable";
    try {
      rejectedValueKind = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    } catch {
      // Revoked proxies and hostile wrappers deliberately collapse to one safe digest class.
    }
    return canonicalDigest({
      rejectedValueKind,
      canonicalizable: false,
    });
  }
}

function schemaFailureReport(value: unknown, validatorThrew: boolean): ValidationReportV1 {
  const expectedTruth = createBuiltinTruthSnapshot();
  const error = validatorThrew ? undefined : validateBrickDocumentV1.errors?.[0];
  const instancePath = error?.instancePath ?? "";
  const path = instancePath.length <= 512 ? instancePath : "";
  const detail = validatorThrew
    ? "the input could not be read safely"
    : `${error?.keyword ?? "unknown"} ${error?.message ?? "schema mismatch"}`;
  const issue = makeIssue({
    validatorId: "kernel.protocol-schema",
    code: "DOCUMENT_SCHEMA_INVALID",
    message: `BrickDocument schema validation failed: ${detail}`.slice(0, 256),
    path,
  });
  return deepFreeze({
    schemaVersion: "lego.validation-report/1",
    targetDocumentHash: rejectedValueDigest(value),
    truthSnapshotHash: canonicalDigest(expectedTruth),
    validatorSetHash: expectedTruth.validatorSet.hash,
    patchValid: false,
    documentGloballyValid: false,
    issues: [issue],
  });
}

export function validateBrickDocument(value: unknown): ValidationReportV1 {
  let detachedValue: unknown;
  try {
    detachedValue = structuredClone(value);
  } catch {
    return schemaFailureReport(value, true);
  }
  let schemaValid: boolean;
  try {
    schemaValid = validateBrickDocumentV1(detachedValue);
  } catch {
    return schemaFailureReport(detachedValue, true);
  }
  if (!schemaValid) return schemaFailureReport(detachedValue, false);

  const document = normalizeBrickDocument(detachedValue as BrickDocumentV1);
  const issues: ValidationIssue[] = [];
  const expectedTruth = createBuiltinTruthSnapshot();
  if (canonicalDigest(document.truth) !== canonicalDigest(expectedTruth)) {
    issues.push(
      makeIssue({
        validatorId: "kernel.truth",
        code: "TRUTH_SNAPSHOT_MISMATCH",
        message: "The document is not pinned to the truth bundle supported by this kernel",
        path: "/truth",
      }),
    );
  }

  addDuplicateIssues(
    issues,
    document.parts.map(({ id }) => id),
    "/parts",
    "DUPLICATE_PART_ID",
    "part",
  );
  for (const duplicateIndex of findDuplicates(document.steps.map(({ index }) => String(index)))) {
    issues.push(
      makeIssue({
        validatorId: "kernel.identity",
        code: "DUPLICATE_STEP_INDEX",
        message: `Duplicate build-step index: ${duplicateIndex}`,
        path: "/steps",
        identity: duplicateIndex,
      }),
    );
  }
  addDuplicateIssues(
    issues,
    document.connections.map(({ id }) => id),
    "/connections",
    "DUPLICATE_CONNECTION_ID",
    "connection",
  );
  addDuplicateIssues(
    issues,
    document.submodels.map(({ id }) => id),
    "/submodels",
    "DUPLICATE_SUBMODEL_ID",
    "annotation",
  );
  addDuplicateIssues(
    issues,
    document.steps.map(({ id }) => id),
    "/steps",
    "DUPLICATE_STEP_ID",
    "annotation",
  );
  addDuplicateIssues(
    issues,
    document.semanticRegions.map(({ id }) => id),
    "/semanticRegions",
    "DUPLICATE_REGION_ID",
    "annotation",
  );

  if (document.parts.length > document.constraints.maxParts) {
    issues.push(
      makeIssue({
        validatorId: "kernel.constraints",
        code: "PART_BUDGET_EXCEEDED",
        message: `Document has ${document.parts.length} parts but allows ${document.constraints.maxParts}`,
        path: "/parts",
        partIds: document.parts.map(({ id }) => id),
      }),
    );
  }

  for (let index = 0; index < document.constraints.allowedCatalogPartIds.length; index += 1) {
    const catalogPartId = document.constraints.allowedCatalogPartIds[index]!;
    const definition = getPartDefinition(catalogPartId);
    if (!definition || definition.id !== catalogPartId) {
      issues.push(
        makeIssue({
          validatorId: "kernel.constraints",
          code: "CATALOG_ALLOWLIST_ENTRY_INVALID",
          message: `Catalog allowlist contains an unknown or non-canonical part ID: ${catalogPartId}`,
          path: `/constraints/allowedCatalogPartIds/${index}`,
          identity: catalogPartId,
        }),
      );
    }
  }
  for (let index = 0; index < document.constraints.allowedColorIds.length; index += 1) {
    const colorId = document.constraints.allowedColorIds[index]!;
    if (!getColorDefinition(colorId)) {
      issues.push(
        makeIssue({
          validatorId: "kernel.constraints",
          code: "COLOR_ALLOWLIST_ENTRY_INVALID",
          message: `Color allowlist contains an unknown color ID: ${colorId}`,
          path: `/constraints/allowedColorIds/${index}`,
          identity: colorId,
        }),
      );
    }
  }

  const partById = new Map<string, PartInstance>();
  for (let index = 0; index < document.parts.length; index += 1) {
    const part = document.parts[index];
    if (!part) continue;
    if (!partById.has(part.id)) partById.set(part.id, part);
    const definition = getPartDefinition(part.catalogPartId);
    if (
      !definition ||
      definition.id !== part.catalogPartId ||
      !document.constraints.allowedCatalogPartIds.includes(part.catalogPartId)
    ) {
      issues.push(
        makeIssue({
          validatorId: "kernel.catalog",
          code: "CATALOG_PART_NOT_ALLOWED",
          message: `Part ${part.id} uses an unknown or disallowed catalog part`,
          path: `/parts/${index}/catalogPartId`,
          partIds: [part.id],
        }),
      );
      continue;
    }
    if (
      !getColorDefinition(part.colorId) ||
      !definition.availableColorIds.includes(part.colorId) ||
      !document.constraints.allowedColorIds.includes(part.colorId)
    ) {
      issues.push(
        makeIssue({
          validatorId: "kernel.catalog",
          code: "COLOR_NOT_ALLOWED",
          message: `Part ${part.id} uses an unknown or disallowed color`,
          path: `/parts/${index}/colorId`,
          partIds: [part.id],
        }),
      );
    }
    if (!definition.legalOrientationIds.includes(part.transform.orientationId)) {
      issues.push(
        makeIssue({
          validatorId: "kernel.transforms",
          code: "ILLEGAL_ORIENTATION",
          message: `Part ${part.id} uses an orientation that is illegal for its catalog definition`,
          path: `/parts/${index}/transform/orientationId`,
          partIds: [part.id],
        }),
      );
    }
  }

  validateMemberships(document, partById, issues);
  const validConnections = validateConnections(document, partById, issues);
  validateConnectivity(document.parts, validConnections, issues);
  for (const finding of findCatalogCollisions(document.parts, validConnections)) {
    issues.push(makeIssue(finding));
  }

  issues.sort(
    (left, right) =>
      compareStrings(left.code, right.code) ||
      compareStrings(left.path, right.path) ||
      compareStrings(left.issueId, right.issueId),
  );
  if (issues.length > MAX_VALIDATION_ISSUES) {
    const omittedCount = issues.length - (MAX_VALIDATION_ISSUES - 1);
    issues.splice(MAX_VALIDATION_ISSUES - 1);
    issues.push(
      makeIssue({
        validatorId: "kernel.issue-budget",
        code: "VALIDATION_ISSUE_BUDGET_EXCEEDED",
        message: `${omittedCount} additional validation issues were deterministically omitted`,
        path: "",
      }),
    );
    issues.sort(
      (left, right) =>
        compareStrings(left.code, right.code) ||
        compareStrings(left.path, right.path) ||
        compareStrings(left.issueId, right.issueId),
    );
  }
  const documentGloballyValid = !issues.some(({ severity }) => severity === "blocking");

  return deepFreeze({
    schemaVersion: "lego.validation-report/1",
    targetDocumentHash: documentStructuralHash(document),
    truthSnapshotHash: canonicalDigest(expectedTruth),
    validatorSetHash: expectedTruth.validatorSet.hash,
    patchValid: documentGloballyValid,
    documentGloballyValid,
    issues,
  });
}
