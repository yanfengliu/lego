import {
  getPartDefinition,
  type ConnectorPortDefinition,
  type LduVector3,
} from "@lego-studio/catalog";
import { canonicalSha256, getConnectorWorldFrame } from "@lego-studio/brick-kernel";
import type {
  BrickDocumentV1,
  BuildOperation,
  ConnectionEdge,
  PartInstance,
  RigidTransform,
  ValidationReportV1,
} from "@lego-studio/protocol";

import {
  capacityEndpointForConnector,
  connectorCapacityIsFree,
  type ConnectorCapacityEndpoint,
} from "../connector-capacity";
import { connectorAxesAlign } from "../connector-frame-alignment";
import { protocolConnectionKindForCatalogPorts } from "./placement-connection-kind";

export const RIGID_SUBASSEMBLY_RETURN_ENUMERATION_VERSION =
  "lego.rigid-subassembly-return-enumeration/1" as const;

const WORK_LIMIT_KEYS = [
  "maxCandidateDocuments",
  "maxConnectorPairingChecks",
  "maxCrossConnectionChecks",
  "maxCrossEdgesPerCandidate",
  "maxDistinctGroupDeltas",
  "maxDocumentConnections",
  "maxDocumentParts",
  "maxTransformedChildParts",
] as const;

export interface RigidSubassemblyReturnWorkLimits {
  readonly maxDocumentParts: number;
  readonly maxDocumentConnections: number;
  readonly maxConnectorPairingChecks: number;
  readonly maxDistinctGroupDeltas: number;
  readonly maxCandidateDocuments: number;
  readonly maxTransformedChildParts: number;
  readonly maxCrossConnectionChecks: number;
  readonly maxCrossEdgesPerCandidate: number;
}

export interface RigidSubassemblyReturnInput {
  readonly document: BrickDocumentV1;
  readonly childPartIds: readonly string[];
  readonly workLimits: RigidSubassemblyReturnWorkLimits;
}

export type RigidSubassemblyReturnErrorCode =
  | "INPUT_NOT_DETACHABLE"
  | "INPUT_SHAPE_INVALID"
  | "WORK_LIMIT_INVALID"
  | "WORK_LIMIT_EXCEEDED"
  | "DOCUMENT_SCHEMA_INVALID"
  | "BASE_VALIDATION_INCOMPLETE"
  | "BASE_BLOCKER_INVALID"
  | "CHILD_ID_INVALID"
  | "CHILD_ID_DUPLICATE"
  | "CHILD_PART_MISSING"
  | "PARENT_EMPTY"
  | "INTERNAL_CONNECTION_INVALID"
  | "PREEXISTING_CROSS_EDGE"
  | "CHILD_DISCONNECTED"
  | "PARENT_DISCONNECTED"
  | "ORIENTATION_SET_INVALID"
  | "CANDIDATE_VALIDATION_INCOMPLETE";

export class RigidSubassemblyReturnError extends Error {
  public constructor(
    public readonly code: RigidSubassemblyReturnErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RigidSubassemblyReturnError";
  }
}

export interface RigidSubassemblyReturnCandidate {
  readonly candidateKey: string;
  readonly groupDelta: RigidTransform;
  readonly transformedChildParts: readonly PartInstance[];
  readonly crossEdges: readonly ConnectionEdge[];
  /** Normal kernel operations that reproduce this return from sourceDocumentHash. */
  readonly operations: readonly BuildOperation[];
  readonly validationReport: ValidationReportV1;
  readonly hardValidDocument: BrickDocumentV1;
}

export interface RigidSubassemblyReturnCounts {
  readonly properGroupOrientations: 24;
  readonly parentParts: number;
  readonly childParts: number;
  readonly existingInternalEdges: number;
  readonly freeParentConnectors: number;
  readonly freeChildConnectors: number;
  readonly connectorPairingChecks: number;
  readonly axisCompatiblePairingSeeds: number;
  readonly rejectedNonIntegralDeltaSeeds: number;
  readonly duplicateDeltaSeeds: number;
  readonly distinctGroupDeltas: number;
  readonly groupDeltasVisited: number;
  readonly transformedChildPartComputations: number;
  readonly crossConnectionChecks: number;
  readonly exactCrossEdgesDiscovered: number;
  readonly candidateValidationRuns: number;
  readonly rejectedTransformPolicy: number;
  readonly rejectedIllegalPartOrientation: number;
  readonly rejectedBelowGround: number;
  readonly rejectedNoCrossEdge: number;
  readonly rejectedConnectorCapacityConflict: number;
  readonly rejectedCollision: number;
  readonly rejectedDisconnected: number;
  readonly rejectedOtherBlockingValidation: number;
  readonly accepted: number;
}

export interface RigidSubassemblyReturnEnumeration {
  readonly schemaVersion: typeof RIGID_SUBASSEMBLY_RETURN_ENUMERATION_VERSION;
  readonly sourceDocumentHash: string;
  readonly childPartIds: readonly string[];
  readonly workLimits: RigidSubassemblyReturnWorkLimits;
  readonly counts: RigidSubassemblyReturnCounts;
  readonly candidates: readonly RigidSubassemblyReturnCandidate[];
}

export interface FreePort {
  readonly part: PartInstance;
  readonly connector: ConnectorPortDefinition;
  readonly capacity: ConnectorCapacityEndpoint;
  readonly positionLdu: LduVector3;
  readonly normal: LduVector3;
}

export interface CrossMatch {
  readonly parent: FreePort;
  readonly child: FreePort;
}

export type ParentPortPositionIndex = ReadonlyMap<string, readonly FreePort[]>;

export function fail(code: RigidSubassemblyReturnErrorCode, message: string): never {
  throw new RigidSubassemblyReturnError(code, message);
}

export function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function safeProduct(label: string, ...factors: number[]): number {
  let result = 1;
  for (const factor of factors) {
    result *= factor;
    if (!Number.isSafeInteger(result)) {
      fail("WORK_LIMIT_EXCEEDED", `${label} exceeds safe-integer accounting.`);
    }
  }
  return result;
}

export function requireWithinLimit(observed: number, maximum: number, label: string): void {
  if (observed > maximum) {
    fail("WORK_LIMIT_EXCEEDED", `${label} requires ${observed} work units; limit is ${maximum}.`);
  }
}

export function requireWorkLimits(value: unknown): RigidSubassemblyReturnWorkLimits {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("WORK_LIMIT_INVALID", "Rigid-subassembly return work limits must be a data object.");
  }
  const keys = Object.keys(value).sort(compareStrings);
  if (
    keys.length !== WORK_LIMIT_KEYS.length ||
    WORK_LIMIT_KEYS.some((key, index) => key !== keys[index])
  ) {
    fail(
      "WORK_LIMIT_INVALID",
      `Rigid-subassembly return work limits must contain exactly ${WORK_LIMIT_KEYS.join(", ")}.`,
    );
  }
  for (const key of WORK_LIMIT_KEYS) {
    const field = (value as Record<string, unknown>)[key];
    if (!Number.isSafeInteger(field) || (field as number) <= 0) {
      fail(
        "WORK_LIMIT_INVALID",
        `Rigid-subassembly return limit ${key} must be a positive safe integer.`,
      );
    }
  }
  return value as RigidSubassemblyReturnWorkLimits;
}

export function isConnected(partIds: readonly string[], edges: readonly ConnectionEdge[]): boolean {
  if (partIds.length <= 1) return true;
  const allowed = new Set(partIds);
  const adjacency = new Map(partIds.map((id) => [id, new Set<string>()] as const));
  for (const edge of edges) {
    if (!allowed.has(edge.a.partId) || !allowed.has(edge.b.partId)) continue;
    adjacency.get(edge.a.partId)!.add(edge.b.partId);
    adjacency.get(edge.b.partId)!.add(edge.a.partId);
  }
  const visited = new Set([partIds[0]!]);
  const pending = [partIds[0]!];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const neighbour of adjacency.get(current) ?? []) {
      if (visited.has(neighbour)) continue;
      visited.add(neighbour);
      pending.push(neighbour);
    }
  }
  return visited.size === partIds.length;
}

export function freePorts(
  parts: readonly PartInstance[],
  occupied: ReadonlySet<string>,
): readonly FreePort[] {
  return parts
    .flatMap((part) => {
      const definition = getPartDefinition(part.catalogPartId)!;
      return definition.connectors.flatMap((connector) => {
        const capacity = capacityEndpointForConnector(part.id, connector);
        if (!connectorCapacityIsFree(capacity, occupied)) return [];
        const frame = getConnectorWorldFrame(part, connector.id);
        return [
          { part, connector, capacity, positionLdu: frame.positionLdu, normal: frame.normal },
        ];
      });
    })
    .sort(
      (left, right) =>
        compareStrings(left.part.id, right.part.id) ||
        compareStrings(left.connector.id, right.connector.id),
    );
}

export function deltaKey(delta: RigidTransform): string {
  return `${delta.positionLdu.join(",")}|${delta.orientationId}`;
}

export function compareDeltas(left: RigidTransform, right: RigidTransform): number {
  return (
    left.positionLdu[0] - right.positionLdu[0] ||
    left.positionLdu[1] - right.positionLdu[1] ||
    left.positionLdu[2] - right.positionLdu[2] ||
    compareStrings(left.orientationId, right.orientationId)
  );
}

function samePosition(left: LduVector3, right: LduVector3): boolean {
  return left.every((coordinate, axis) => coordinate === right[axis]);
}

function positionKey(positionLdu: LduVector3): string {
  return positionLdu.join(",");
}

export function indexPortsByPosition(ports: readonly FreePort[]): ParentPortPositionIndex {
  const mutable = new Map<string, FreePort[]>();
  for (const port of ports) {
    const key = positionKey(port.positionLdu);
    const bucket = mutable.get(key);
    if (bucket) bucket.push(port);
    else mutable.set(key, [port]);
  }
  return mutable;
}

export function crossMatches(
  parentPortsByPosition: ParentPortPositionIndex,
  childPorts: readonly FreePort[],
  transformedChildById: ReadonlyMap<string, PartInstance>,
): readonly CrossMatch[] {
  const matches: CrossMatch[] = [];
  for (const child of childPorts) {
    const transformedPart = transformedChildById.get(child.part.id)!;
    const frame = getConnectorWorldFrame(transformedPart, child.connector.id);
    for (const parent of parentPortsByPosition.get(positionKey(frame.positionLdu)) ?? []) {
      if (!samePosition(parent.positionLdu, frame.positionLdu)) continue;
      if (
        !connectorAxesAlign(
          { kind: parent.connector.kind, normal: parent.normal },
          { kind: child.connector.kind, normal: frame.normal },
        )
      ) {
        continue;
      }
      matches.push({ parent, child });
    }
  }
  return matches.sort(
    (left, right) =>
      compareStrings(left.parent.part.id, right.parent.part.id) ||
      compareStrings(left.parent.connector.id, right.parent.connector.id) ||
      compareStrings(left.child.part.id, right.child.part.id) ||
      compareStrings(left.child.connector.id, right.child.connector.id),
  );
}

export function crossEdgesFor(
  matches: readonly CrossMatch[],
  existingIds: ReadonlySet<string>,
  sourceId: string,
): readonly ConnectionEdge[] {
  const usedIds = new Set(existingIds);
  return matches.map(({ parent, child }) => {
    const baseId = `rigid-return-${canonicalSha256({
      parentPartId: parent.part.id,
      parentPortId: parent.connector.id,
      childPartId: child.part.id,
      childPortId: child.connector.id,
    }).slice(0, 24)}`;
    let id = baseId;
    for (let suffix = 1; usedIds.has(id); suffix += 1) id = `${baseId}-${suffix}`;
    usedIds.add(id);
    return {
      id,
      kind: protocolConnectionKindForCatalogPorts(
        parent.part.catalogPartId,
        parent.connector.id,
        child.part.catalogPartId,
        child.connector.id,
      ),
      a: { partId: parent.part.id, portId: parent.connector.id },
      b: { partId: child.part.id, portId: child.connector.id },
      provenance: { source: "ai", sourceId },
    };
  });
}

export function incompleteValidation(report: ValidationReportV1): boolean {
  return report.issues.some(({ code }) =>
    [
      "COLLISION_COMPARISON_BUDGET_EXCEEDED",
      "COLLISION_FINDING_BUDGET_EXCEEDED",
      "VALIDATION_ISSUE_BUDGET_EXCEEDED",
    ].includes(code),
  );
}
