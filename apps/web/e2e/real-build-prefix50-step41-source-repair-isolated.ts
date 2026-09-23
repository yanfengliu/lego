import { getPartDefinition } from "@lego-studio/catalog";
import { createPartInstance, findCatalogCollisions } from "@lego-studio/brick-kernel";
import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { protocolConnectionKindForCatalogPorts } from "../src/assembly/placement-connection-kind";
import { capacityEndpointForConnector, reserveConnectorCapacity } from "../src/connector-capacity";
import type { RealBuildPrefix50ProjectionOccurrence } from "./real-build-prefix50-projection";
import type { RealBuildPrefix50Step41PairEvidence } from "./real-build-prefix50-step41-source-repair-contract";

export function proveRealBuildPrefix50Step41IsolatedCapacityAndCollision(
  rows: readonly RealBuildPrefix50ProjectionOccurrence[],
  pairs: readonly RealBuildPrefix50Step41PairEvidence[],
): number {
  const parts: PartInstance[] = [];
  const edges: ConnectionEdge[] = [];
  const occupied = new Set<string>();
  for (const pair of pairs) {
    const receiverRow = rows[pair.receiverOrdinal - 266]!;
    const candidateRow = rows[pair.candidateOrdinal - 266]!;
    const receiver = createPartInstance({
      id: `prefix50-step41-repaired-${pair.receiverOrdinal}`,
      catalogPartId: receiverRow.partIdentity.reconciledCatalogPartId,
      colorId: receiverRow.colorId,
      transform: receiverRow.sourceWorldTransform,
    });
    const candidate = createPartInstance({
      id: `prefix50-step41-repaired-${pair.candidateOrdinal}`,
      catalogPartId: candidateRow.partIdentity.reconciledCatalogPartId,
      colorId: candidateRow.colorId,
      transform: pair.repairedSourceWorldTransform,
    });
    parts.push(receiver, candidate);
    for (const [index, connection] of pair.canonicalConnections.entries()) {
      const receiverPort = getPartDefinition(receiver.catalogPartId)?.connectors.find(
        ({ id }) => id === connection.receiverPortId,
      );
      const candidatePort = getPartDefinition(candidate.catalogPartId)?.connectors.find(
        ({ id }) => id === connection.candidatePortId,
      );
      if (
        receiverPort === undefined ||
        candidatePort === undefined ||
        !reserveConnectorCapacity(
          [
            capacityEndpointForConnector(receiver.id, receiverPort),
            capacityEndpointForConnector(candidate.id, candidatePort),
          ],
          occupied,
        )
      ) {
        throw new TypeError(
          "Step-41 isolated eight-body reciprocal edges exceed connector capacity.",
        );
      }
      edges.push({
        id: `prefix50-step41-repaired-edge-${pair.candidateOrdinal}-${index}`,
        kind: protocolConnectionKindForCatalogPorts(
          receiver.catalogPartId,
          receiverPort.id,
          candidate.catalogPartId,
          candidatePort.id,
        ),
        a: { partId: receiver.id, portId: receiverPort.id },
        b: { partId: candidate.id, portId: candidatePort.id },
        provenance: { source: "ai", sourceId: "prefix50-step41-source-repair" },
      });
    }
  }
  const findings = findCatalogCollisions(parts, edges);
  if (findings.length !== 0) {
    throw new TypeError(
      `Step-41 isolated eight-body repaired window has ${findings.length} connected collision findings.`,
    );
  }
  return occupied.size;
}
