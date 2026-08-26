import { getPartDefinition, type ConnectorPortDefinition } from "@lego-studio/catalog";
import { connectorCapacityClaimKeys } from "@lego-studio/brick-kernel";
import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";

export interface ConnectorCapacityEndpoint {
  readonly partId: string;
  readonly portId: string;
  readonly sharedCapacityGroupIds: readonly string[];
}

/**
 * The kernel owns connector-capacity semantics. Web discovery carries the same
 * part-local claims so it never proposes an edge the validator must reject.
 */
export function capacityClaimsForEndpoint(endpoint: ConnectorCapacityEndpoint): readonly string[] {
  return connectorCapacityClaimKeys(endpoint);
}

export function capacityEndpointForConnector(
  partId: string,
  connector: Pick<ConnectorPortDefinition, "id" | "sharedCapacityGroupIds">,
): ConnectorCapacityEndpoint {
  return {
    partId,
    portId: connector.id,
    sharedCapacityGroupIds: connector.sharedCapacityGroupIds ?? [],
  };
}

/**
 * Resolves an authored endpoint to its complete capacity claim. Invalid legacy
 * references retain their exact-port claim; the validator still reports the
 * unknown port, while editor discovery cannot accidentally reuse its spelling.
 */
export function capacityClaimsForPartPort(
  part: Pick<PartInstance, "id" | "catalogPartId">,
  portId: string,
): readonly string[] {
  const connector = getPartDefinition(part.catalogPartId)?.connectors.find(
    ({ id }) => id === portId,
  );
  return capacityClaimsForEndpoint({
    partId: part.id,
    portId,
    sharedCapacityGroupIds: connector?.sharedCapacityGroupIds ?? [],
  });
}

/** Every capacity cell consumed by a set of already-authored connections. */
export function occupiedConnectorCapacityClaims(
  parts: readonly Pick<PartInstance, "id" | "catalogPartId">[],
  connections: readonly ConnectionEdge[],
): ReadonlySet<string> {
  const partById = new Map(parts.map((part) => [part.id, part] as const));
  const occupied = new Set<string>();
  for (const connection of connections) {
    for (const endpoint of [connection.a, connection.b]) {
      const part = partById.get(endpoint.partId);
      const claims = part
        ? capacityClaimsForPartPort(part, endpoint.portId)
        : capacityClaimsForEndpoint({
            partId: endpoint.partId,
            portId: endpoint.portId,
            sharedCapacityGroupIds: [],
          });
      for (const claim of claims) occupied.add(claim);
    }
  }
  return occupied;
}

export function connectorCapacityIsFree(
  endpoint: ConnectorCapacityEndpoint,
  occupiedClaims: ReadonlySet<string>,
): boolean {
  return capacityClaimsForEndpoint(endpoint).every((claim) => !occupiedClaims.has(claim));
}

/** Atomically reserves both endpoints of one proposed connection. */
export function reserveConnectorCapacity(
  endpoints: readonly ConnectorCapacityEndpoint[],
  occupiedClaims: Set<string>,
): boolean {
  const claims = endpoints.flatMap(capacityClaimsForEndpoint);
  if (claims.some((claim) => occupiedClaims.has(claim))) return false;
  for (const claim of claims) occupiedClaims.add(claim);
  return true;
}
