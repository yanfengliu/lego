import { CONNECTOR_PAIR_RULES, PART_DEFINITIONS, getPartDefinition } from "@lego-studio/catalog";
import type { ConnectorKind } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { ProjectedConnectionSemantics } from "./connection-semantics-projection.ts";
import {
  connectionEndpointKey,
  connectionPairKey,
  projectConnectionSemantics,
} from "./connection-semantics-projection.ts";
import type { ReviewedHistoricalConnectionSemantics } from "./historical-connection-authorities.ts";
import {
  CURRENT_CONNECTION_SEMANTICS_AUTHORITY,
  REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH,
} from "./historical-connection-authorities.ts";
import type { CarriedEndpointAssessment } from "./historical-connection-carry-forward.ts";
import { carriedEndpointPeerFailure } from "./historical-connection-carry-forward.ts";

export type { ReviewedHistoricalConnectionSemantics } from "./historical-connection-authorities.ts";
export {
  CURRENT_CONNECTION_SEMANTICS_AUTHORITY,
  REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH,
} from "./historical-connection-authorities.ts";

const LIVE_CONNECTION_SEMANTICS = projectConnectionSemantics(
  PART_DEFINITIONS,
  CONNECTOR_PAIR_RULES,
  "live-strict",
);

function targetAuthorityFailures(
  targetTruthHash: string,
  target: ProjectedConnectionSemantics,
): string[] {
  const failures: string[] = [];
  if (targetTruthHash !== CURRENT_CONNECTION_SEMANTICS_AUTHORITY.truthHash) {
    failures.push(
      `Current truth hash ${targetTruthHash} differs from connector migration authority ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.truthHash}; regenerate and review historical connector semantics before migrating`,
    );
  }
  if (
    target.endpointCount !== CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointCount ||
    target.endpointMapDigest !== CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest
  ) {
    failures.push(
      `Current connector endpoint projection is ${target.endpointCount}/${target.endpointMapDigest}, expected ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointCount}/${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest}; run npm run migration-history:check and review the complete delta`,
    );
  }
  if (
    target.pairCount !== CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairCount ||
    target.pairMapDigest !== CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest
  ) {
    failures.push(
      `Current reachable connector-pair projection is ${target.pairCount}/${target.pairMapDigest}, expected ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairCount}/${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest}; run npm run migration-history:check and review the complete delta`,
    );
  }
  return failures;
}

function connectorPair(
  left: { readonly kind: ConnectorKind; readonly gender: "male" | "female" },
  right: { readonly kind: ConnectorKind; readonly gender: "male" | "female" },
): readonly [male: ConnectorKind, female: ConnectorKind] | undefined {
  if (left.gender === "male" && right.gender === "female") return [left.kind, right.kind];
  if (right.gender === "male" && left.gender === "female") return [right.kind, left.kind];
  return undefined;
}

/** What migration may do with a document's saved connections under one source truth. */
export interface HistoricalConnectionSemanticsAssessment {
  readonly blockingReasons: readonly string[];
  /** Endpoints carried across a reviewed change, in connection order; empty when blocked. */
  readonly carriedEndpoints: readonly CarriedEndpointAssessment[];
}

/**
 * Authenticates every saved connection of `document` against the reviewed
 * connector semantics of `sourceTruthHash` and the live target. An endpoint
 * whose meaning changed is refused unless its row carries it across a
 * reviewed class (`historical-connection-carry-forward.ts`). `authorities`
 * exists so a test can hand in a row the reviewed table does not hold.
 */
export function assessHistoricalConnectionSemantics(
  document: BrickDocumentV1,
  sourceTruthHash: string,
  targetTruthHash: string,
  target: ProjectedConnectionSemantics = LIVE_CONNECTION_SEMANTICS,
  authorities: Readonly<
    Record<string, ReviewedHistoricalConnectionSemantics>
  > = REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH,
): HistoricalConnectionSemanticsAssessment {
  const targetFailures = targetAuthorityFailures(targetTruthHash, target);
  if (targetFailures.length > 0) return { blockingReasons: targetFailures, carriedEndpoints: [] };
  const authority = authorities[sourceTruthHash];
  if (authority === undefined) {
    return {
      blockingReasons: [
        `Truth snapshot ${sourceTruthHash} has no reviewed connector-semantics authority; migration cannot infer historical ports from the current catalog, so review its row with npm run migration-history:check -- --print before migrating documents pinned to it`,
      ],
      carriedEndpoints: [],
    };
  }

  const endpointDeltas = new Map(
    authority.endpointDeltas.map((delta) => [
      connectionEndpointKey(delta.partId, delta.portId),
      delta,
    ]),
  );
  const carriedDeltas = new Map(
    (authority.carriedEndpointDeltas ?? []).map((carried) => [
      connectionEndpointKey(carried.partId, carried.portId),
      carried,
    ]),
  );
  const pairDeltas = new Map(
    authority.pairDeltas.map((delta) => [connectionPairKey(delta.male, delta.female), delta]),
  );
  const partById = new Map<string, BrickDocumentV1["parts"][number]>();
  const duplicatePartIds = new Set<string>();
  for (const part of document.parts) {
    if (partById.has(part.id)) duplicatePartIds.add(part.id);
    else partById.set(part.id, part);
  }
  const blockingReasons: string[] = [];
  const carriedEndpoints: CarriedEndpointAssessment[] = [];

  for (const connection of document.connections) {
    const resolved = [];
    // What satisfies an edge-level refusal: drop the saved edge, and where
    // current truth still has both ports, re-attach once the document migrates.
    const removeEdge = `remove connection ${connection.id} from the saved document`;
    const reattach = `${removeEdge} and re-attach the parts after migration`;
    for (const endpoint of [connection.a, connection.b]) {
      const label = `${endpoint.partId}/${endpoint.portId}`;
      if (duplicatePartIds.has(endpoint.partId)) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} resolves to multiple source part instances with duplicate ID ${endpoint.partId} under reviewed source truth ${sourceTruthHash}; make part IDs unique before migration so connector semantics can be authenticated`,
        );
        continue;
      }
      const instance = partById.get(endpoint.partId);
      if (instance === undefined) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} references missing part ${endpoint.partId} under reviewed source truth ${sourceTruthHash}; add that source-truth-valid part instance or remove the dangling connection before migration`,
        );
        continue;
      }
      const definition = getPartDefinition(instance.catalogPartId);
      if (definition === undefined) continue;
      const connector = definition.connectors.find(({ id }) => id === endpoint.portId);
      const key = connectionEndpointKey(instance.catalogPartId, endpoint.portId);
      const delta = endpointDeltas.get(key);
      if (delta?.sourceDigest === null) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} did not exist in reviewed source truth ${sourceTruthHash}; migration cannot legitimize a later connector, so ${reattach}`,
        );
      } else if (delta?.targetDigest === null) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} existed in reviewed source truth ${sourceTruthHash} but current truth removes it; migration cannot preserve the edge, so ${removeEdge} before migrating`,
        );
      } else if (delta !== undefined && delta.sourceDigest !== delta.targetDigest) {
        const carried = carriedDeltas.get(key);
        const failure =
          carried === undefined
            ? undefined
            : carriedEndpointPeerFailure(carried, delta, authority.endpointDeltas, definition);
        if (carried !== undefined && failure === undefined) {
          carriedEndpoints.push({
            connectionId: connection.id,
            partId: endpoint.partId,
            catalogPartId: instance.catalogPartId,
            portId: endpoint.portId,
            deltaClass: carried.deltaClass,
            addedSharedCapacityGroupIds: carried.addedSharedCapacityGroupIds,
            reportedUnderCatalogVersion: carried.reportedUnderCatalogVersion,
          });
        } else {
          const why =
            failure === undefined
              ? ""
              : `, and its reviewed carry-forward does not hold (${failure})`;
          blockingReasons.push(
            `Connection ${connection.id} endpoint ${label} changed after reviewed source truth ${sourceTruthHash}${why}; migration cannot preserve its connector semantics, so ${reattach}`,
          );
        }
      } else if (connector === undefined) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} is absent from both reviewed source truth ${sourceTruthHash} and current truth; migration cannot authorize an unknown connector, so ${removeEdge}`,
        );
      }
      if (connector !== undefined) resolved.push(connector);
    }
    if (resolved.length !== 2) continue;
    const pair = connectorPair(resolved[0]!, resolved[1]!);
    if (pair === undefined) continue;
    const delta = pairDeltas.get(connectionPairKey(...pair));
    if (delta?.sourceDigest === null) {
      blockingReasons.push(
        `Connection ${connection.id} uses ${pair[0]} to ${pair[1]}, which reviewed source truth ${sourceTruthHash} did not admit; migration cannot legitimize a later connector pair, so ${reattach}`,
      );
    } else if (delta?.targetDigest === null) {
      blockingReasons.push(
        `Connection ${connection.id} uses ${pair[0]} to ${pair[1]}, which current truth removes; migration cannot preserve the historical pair, so ${removeEdge} before migrating`,
      );
    } else if (delta !== undefined && delta.sourceDigest !== delta.targetDigest) {
      blockingReasons.push(
        `Connection ${connection.id} uses ${pair[0]} to ${pair[1]}, whose behavior changed after reviewed source truth ${sourceTruthHash}; migration cannot reinterpret the pair, so ${reattach}`,
      );
    }
  }
  return { blockingReasons, carriedEndpoints: blockingReasons.length > 0 ? [] : carriedEndpoints };
}

export function historicalConnectionSemanticsBlockingReasons(
  document: BrickDocumentV1,
  sourceTruthHash: string,
  targetTruthHash: string,
  target: ProjectedConnectionSemantics = LIVE_CONNECTION_SEMANTICS,
): readonly string[] {
  return assessHistoricalConnectionSemantics(document, sourceTruthHash, targetTruthHash, target)
    .blockingReasons;
}
