import { PROPER_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import { createCollisionWorld, createPartInstance, deepFreeze } from "@lego-studio/brick-kernel";
import type { ConnectionEdge, PartInstance, RigidTransform } from "@lego-studio/protocol";

import {
  createPlacementConnectorIndexes,
  discoverIndexedConnections,
  enumerateConnectorOrigins,
  type PlacementConnectorSeedReceipt,
} from "../src/assembly/connector-placement-enumeration";
import { placementOccupancyKey } from "../src/assembly/enumerate-placements";
import { protocolConnectionKindForCatalogPorts } from "../src/assembly/placement-connection-kind";
import type { DiscoveredConnection } from "../src/placement";
import type { RealBuildPrefix50ProjectionOccurrence } from "./real-build-prefix50-projection";

export const REAL_BUILD_PREFIX50_STEP41_SEAT_ENUMERATION_VERSION =
  "lego.real-build-prefix50-step41-seat-enumeration/1" as const;

export interface RealBuildPrefix50Step41SeatCandidate {
  readonly catalogPartId: string;
  readonly transform: RigidTransform;
  readonly connections: readonly DiscoveredConnection[];
  readonly occupancyKey: string;
}

export interface RealBuildPrefix50Step41SeatEnumeration {
  readonly schemaVersion: typeof REAL_BUILD_PREFIX50_STEP41_SEAT_ENUMERATION_VERSION;
  readonly baseOrdinal: number;
  readonly candidateOrdinal: number;
  readonly orientationIds: readonly string[];
  readonly connectorSeedReceipt: readonly PlacementConnectorSeedReceipt[];
  readonly candidates: readonly RealBuildPrefix50Step41SeatCandidate[];
  readonly counts: {
    readonly rawSeeds: number;
    readonly distinctTransforms: number;
    readonly rejectedNoConnections: number;
    readonly rejectedColliding: number;
    readonly accepted: number;
  };
}

export interface RealBuildPrefix50Step41TransformDiagnosis {
  readonly connections: readonly DiscoveredConnection[];
  readonly collisionFindingCodes: readonly string[];
}

const orientationIds = deepFreeze(PROPER_ORIENTATIONS.map(({ id }) => id));

function exactPart(
  row: RealBuildPrefix50ProjectionOccurrence,
  transform: RigidTransform,
): PartInstance {
  return createPartInstance({
    id: `prefix50-step41-source-${row.ordinal}`,
    catalogPartId: row.partIdentity.reconciledCatalogPartId,
    colorId: row.colorId,
    transform,
    source: "ai",
    sourceId: `prefix50-step41-source-${row.ordinal}`,
  });
}

function edgesFor(
  base: PartInstance,
  candidate: PartInstance,
  connections: readonly DiscoveredConnection[],
): readonly ConnectionEdge[] {
  return connections.map((connection, index) => {
    if (connection.targetPartId !== base.id) {
      throw new TypeError(
        "Step-41 reciprocal-seat evidence may connect only the exact isolated receiver; third bodies are forbidden.",
      );
    }
    return {
      id: `prefix50-step41-seat-${base.id}-${candidate.id}-${index}`,
      kind: protocolConnectionKindForCatalogPorts(
        base.catalogPartId,
        connection.targetPortId,
        candidate.catalogPartId,
        connection.candidatePortId,
      ),
      a: { partId: base.id, portId: connection.targetPortId },
      b: { partId: candidate.id, portId: connection.candidatePortId },
      provenance: { source: "ai", sourceId: "prefix50-step41-source-repair" },
    };
  });
}

function compareCandidates(
  left: RealBuildPrefix50Step41SeatCandidate,
  right: RealBuildPrefix50Step41SeatCandidate,
): number {
  return (
    left.transform.positionLdu[0] - right.transform.positionLdu[0] ||
    left.transform.positionLdu[1] - right.transform.positionLdu[1] ||
    left.transform.positionLdu[2] - right.transform.positionLdu[2] ||
    left.transform.orientationId.localeCompare(right.transform.orientationId)
  );
}

export function enumerateRealBuildPrefix50Step41Seats(
  baseRow: RealBuildPrefix50ProjectionOccurrence,
  candidateRow: RealBuildPrefix50ProjectionOccurrence,
): RealBuildPrefix50Step41SeatEnumeration {
  const base = exactPart(baseRow, baseRow.sourceWorldTransform);
  const definition = getPartDefinition(candidateRow.partIdentity.reconciledCatalogPartId);
  if (definition === undefined) {
    throw new TypeError(
      `Step-41 seat enumeration requires catalog part ${candidateRow.partIdentity.reconciledCatalogPartId}.`,
    );
  }
  const indexes = createPlacementConnectorIndexes([base], new Set(), definition, orientationIds);
  const origins = new Map<string, RigidTransform>();
  const originCounts = enumerateConnectorOrigins(
    indexes,
    orientationIds,
    (positionLdu, orientationId) => {
      const key = `${positionLdu.join(",")}|${orientationId}`;
      if (!origins.has(key)) origins.set(key, { positionLdu, orientationId });
    },
  );
  const candidates: RealBuildPrefix50Step41SeatCandidate[] = [];
  let rejectedNoConnections = 0;
  let rejectedColliding = 0;
  for (const transform of origins.values()) {
    const candidate = exactPart(candidateRow, transform);
    const connections = discoverIndexedConnections(indexes, transform, candidate.id);
    if (connections.length === 0) {
      rejectedNoConnections += 1;
      continue;
    }
    if (
      createCollisionWorld([base]).findCollisionsWith(
        candidate,
        edgesFor(base, candidate, connections),
      ).length > 0
    ) {
      rejectedColliding += 1;
      continue;
    }
    candidates.push(
      deepFreeze({
        catalogPartId: candidate.catalogPartId,
        transform: deepFreeze({
          positionLdu: [...transform.positionLdu] as [number, number, number],
          orientationId: transform.orientationId,
        }),
        connections: connections.map((connection) => deepFreeze({ ...connection })),
        occupancyKey: placementOccupancyKey(candidate.catalogPartId, transform),
      }),
    );
  }
  candidates.sort(compareCandidates);
  const rawSeeds =
    originCounts.rawFromStuds +
    originCounts.rawFromClutches +
    originCounts.rawFromOtherConnectorPairs;
  return deepFreeze({
    schemaVersion: REAL_BUILD_PREFIX50_STEP41_SEAT_ENUMERATION_VERSION,
    baseOrdinal: baseRow.ordinal,
    candidateOrdinal: candidateRow.ordinal,
    orientationIds,
    connectorSeedReceipt: originCounts.seedReceipt,
    candidates,
    counts: {
      rawSeeds,
      distinctTransforms: origins.size,
      rejectedNoConnections,
      rejectedColliding,
      accepted: candidates.length,
    },
  });
}

export function diagnoseRealBuildPrefix50Step41Transform(
  baseRow: RealBuildPrefix50ProjectionOccurrence,
  candidateRow: RealBuildPrefix50ProjectionOccurrence,
  transform: RigidTransform,
): RealBuildPrefix50Step41TransformDiagnosis {
  const base = exactPart(baseRow, baseRow.sourceWorldTransform);
  const candidate = exactPart(candidateRow, transform);
  const definition = getPartDefinition(candidate.catalogPartId);
  if (definition === undefined)
    throw new TypeError(`Unknown step-41 part ${candidate.catalogPartId}.`);
  const indexes = createPlacementConnectorIndexes([base], new Set(), definition, [
    transform.orientationId,
  ]);
  const connections = discoverIndexedConnections(indexes, transform, candidate.id);
  const findings = createCollisionWorld([base]).findCollisionsWith(
    candidate,
    edgesFor(base, candidate, connections),
  );
  return deepFreeze({
    connections: connections.map((connection) => deepFreeze({ ...connection })),
    collisionFindingCodes: findings.map(({ code }) => code).sort(),
  });
}

export function requireCompleteRealBuildPrefix50Step41SeatEnumeration(
  value: RealBuildPrefix50Step41SeatEnumeration,
  baseRow: RealBuildPrefix50ProjectionOccurrence,
  candidateRow: RealBuildPrefix50ProjectionOccurrence,
): RealBuildPrefix50Step41SeatEnumeration {
  const expectedOrientations = PROPER_ORIENTATIONS.map(({ id }) => id);
  const receiptSeeds = value.connectorSeedReceipt.reduce(
    (sum, receipt) => sum + receipt.axisCompatibleSeeds,
    0,
  );
  const acceptedKeys = value.candidates.map(
    ({ transform }) => `${transform.positionLdu.join(",")}|${transform.orientationId}`,
  );
  if (
    value.schemaVersion !== REAL_BUILD_PREFIX50_STEP41_SEAT_ENUMERATION_VERSION ||
    value.baseOrdinal !== baseRow.ordinal ||
    value.candidateOrdinal !== candidateRow.ordinal ||
    value.orientationIds.length !== expectedOrientations.length ||
    value.orientationIds.some((id, index) => id !== expectedOrientations[index]) ||
    value.counts.rawSeeds !== receiptSeeds ||
    value.counts.accepted !== value.candidates.length ||
    value.counts.accepted + value.counts.rejectedNoConnections + value.counts.rejectedColliding !==
      value.counts.distinctTransforms ||
    new Set(acceptedKeys).size !== acceptedKeys.length
  ) {
    throw new TypeError(
      "Step-41 reciprocal-seat enumeration is incomplete or internally inconsistent; no orientation, origin, or candidate may be truncated.",
    );
  }
  const base = exactPart(baseRow, baseRow.sourceWorldTransform);
  for (const candidateValue of value.candidates) {
    const candidate = exactPart(candidateRow, candidateValue.transform);
    if (
      candidateValue.catalogPartId !== candidate.catalogPartId ||
      candidateValue.occupancyKey !==
        placementOccupancyKey(candidate.catalogPartId, candidateValue.transform) ||
      candidateValue.connections.length === 0 ||
      candidateValue.connections.some(({ targetPartId }) => targetPartId !== base.id) ||
      createCollisionWorld([base]).findCollisionsWith(
        candidate,
        edgesFor(base, candidate, candidateValue.connections),
      ).length !== 0
    ) {
      throw new TypeError(
        "Step-41 reciprocal-seat enumeration contains a forged transform, port, third body, or colliding candidate.",
      );
    }
  }
  return value;
}
