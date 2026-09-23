import { getPartDefinition } from "@lego-studio/catalog";
import { createPartInstance, findCatalogCollisions } from "@lego-studio/brick-kernel";
import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import type { PlacementCandidate } from "../src/assembly/enumerate-placements";
import { protocolConnectionKindForCatalogPorts } from "../src/assembly/placement-connection-kind";
import { capacityEndpointForConnector, reserveConnectorCapacity } from "../src/connector-capacity";
import type { RealBuildPrefix50TargetOccurrence } from "./real-build-prefix50-exact-compiler-contract";

export interface RealBuildPrefix50NormalizedRootConnection {
  readonly occurrence258PortId: string;
  readonly occurrence259PortId: string;
  readonly connectionKind: "stud-tube";
}

export function normalizeRealBuildPrefix50SubBuildRootConnections(
  baseOrdinal: 258 | 259,
  candidateOrdinal: 258 | 259,
  candidate: PlacementCandidate,
  rows: readonly [RealBuildPrefix50TargetOccurrence, RealBuildPrefix50TargetOccurrence],
): RealBuildPrefix50NormalizedRootConnection[] {
  const byOrdinal = new Map(rows.map((row) => [row.ordinal, row] as const));
  const base = byOrdinal.get(baseOrdinal)!;
  const added = byOrdinal.get(candidateOrdinal)!;
  return candidate.connections
    .map((connection) => {
      const basePortId = connection.targetPortId;
      const candidatePortId = connection.candidatePortId;
      const connectionKind = protocolConnectionKindForCatalogPorts(
        base.partIdentity.reconciledCatalogPartId,
        basePortId,
        added.partIdentity.reconciledCatalogPartId,
        candidatePortId,
      );
      if (connectionKind !== "stud-tube") {
        throw new TypeError(
          `Prefix-50 atomic SubBuild root requires a stud-tube reciprocal root edge, not ${connectionKind}.`,
        );
      }
      return baseOrdinal === 258
        ? { occurrence258PortId: basePortId, occurrence259PortId: candidatePortId, connectionKind }
        : {
            occurrence258PortId: candidatePortId,
            occurrence259PortId: basePortId,
            connectionKind,
          };
    })
    .sort(
      (left, right) =>
        left.occurrence258PortId.localeCompare(right.occurrence258PortId) ||
        left.occurrence259PortId.localeCompare(right.occurrence259PortId) ||
        left.connectionKind.localeCompare(right.connectionKind),
    );
}

export function proveRealBuildPrefix50SubBuildRootCapacityAndCollision(
  rows: readonly [RealBuildPrefix50TargetOccurrence, RealBuildPrefix50TargetOccurrence],
  connections: readonly RealBuildPrefix50NormalizedRootConnection[],
): number {
  const parts = rows.map((row) =>
    createPartInstance({
      id: `prefix50-subbuild-root-${row.ordinal}`,
      catalogPartId: row.partIdentity.reconciledCatalogPartId,
      colorId: row.colorId,
      transform: row.targetTransform,
      source: "ai",
      sourceId: `prefix50-occurrence-${row.ordinal}`,
    }),
  ) as [PartInstance, PartInstance];
  const occupied = new Set<string>();
  const edges: ConnectionEdge[] = [];
  for (const [index, connection] of connections.entries()) {
    const connectors = [
      getPartDefinition(parts[0].catalogPartId)?.connectors.find(
        ({ id }) => id === connection.occurrence258PortId,
      ),
      getPartDefinition(parts[1].catalogPartId)?.connectors.find(
        ({ id }) => id === connection.occurrence259PortId,
      ),
    ] as const;
    if (
      connectors[0] === undefined ||
      connectors[1] === undefined ||
      !reserveConnectorCapacity(
        [
          capacityEndpointForConnector(parts[0].id, connectors[0]),
          capacityEndpointForConnector(parts[1].id, connectors[1]),
        ],
        occupied,
      )
    ) {
      throw new TypeError(
        "Prefix-50 atomic SubBuild root reciprocal edge set exceeds exact connector capacity.",
      );
    }
    edges.push({
      id: `prefix50-subbuild-root-edge-${index}`,
      kind: connection.connectionKind,
      a: { partId: parts[0].id, portId: connection.occurrence258PortId },
      b: { partId: parts[1].id, portId: connection.occurrence259PortId },
      provenance: { source: "ai", sourceId: "prefix50-subbuild-root" },
    });
  }
  const findings = findCatalogCollisions(parts, edges);
  if (findings.length !== 0) {
    throw new TypeError(
      `Prefix-50 atomic SubBuild root exact reciprocal edge set has ${findings.length} collision findings.`,
    );
  }
  return occupied.size;
}
