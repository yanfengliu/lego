import { connectorPairRule, getPartDefinition } from "@lego-studio/catalog";
import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import type { DiscoveredConnection } from "../placement";

export class PlacementConnectionKindError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PlacementConnectionKindError";
  }
}

/**
 * Resolves the generation-1 protocol discriminator from authoritative catalog
 * endpoints. The discriminator is still `stud-tube`; axle-vs-stud semantics
 * live on the endpoint kinds, so callers must not supply or guess it.
 */
export function protocolConnectionKindForCatalogPorts(
  targetCatalogPartId: string,
  targetPortId: string,
  candidateCatalogPartId: string,
  candidatePortId: string,
): ConnectionEdge["kind"] {
  const target = getPartDefinition(targetCatalogPartId);
  const candidate = getPartDefinition(candidateCatalogPartId);
  if (target === undefined || candidate === undefined) {
    throw new PlacementConnectionKindError(
      `Cannot resolve a placement connection across unknown catalog parts ${JSON.stringify(targetCatalogPartId)} and ${JSON.stringify(candidateCatalogPartId)}.`,
    );
  }
  const targetPort = target.connectors.find(({ id }) => id === targetPortId);
  const candidatePort = candidate.connectors.find(({ id }) => id === candidatePortId);
  if (targetPort === undefined || candidatePort === undefined) {
    throw new PlacementConnectionKindError(
      `Cannot resolve a placement connection from ${targetCatalogPartId}/${targetPortId} to ${candidateCatalogPartId}/${candidatePortId}; both exact catalog ports must exist.`,
    );
  }
  if (connectorPairRule(targetPort.kind, candidatePort.kind) === undefined) {
    throw new PlacementConnectionKindError(
      `Cannot resolve a placement connection from ${targetPort.kind} ${targetCatalogPartId}/${targetPortId} to ${candidatePort.kind} ${candidateCatalogPartId}/${candidatePortId}; the pinned connector taxonomy has no compatible pair rule.`,
    );
  }
  return "stud-tube";
}

export function protocolConnectionKindForDiscoveredConnection(
  parts: readonly Pick<PartInstance, "id" | "catalogPartId">[],
  candidateCatalogPartId: string,
  connection: DiscoveredConnection,
): ConnectionEdge["kind"] {
  const target = parts.find(({ id }) => id === connection.targetPartId);
  if (target === undefined) {
    throw new PlacementConnectionKindError(
      `Discovered placement connection targets missing part ${JSON.stringify(connection.targetPartId)}; it must name the exact assembly being enumerated.`,
    );
  }
  return protocolConnectionKindForCatalogPorts(
    target.catalogPartId,
    connection.targetPortId,
    candidateCatalogPartId,
    connection.candidatePortId,
  );
}
