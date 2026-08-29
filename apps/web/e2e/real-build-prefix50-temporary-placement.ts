import type {
  BrickDocumentV1,
  BuildOperation,
  ConnectionEdge,
  PartInstance,
} from "@lego-studio/protocol";

import type { PlacementCandidate } from "../src/assembly/enumerate-placements";
import { protocolConnectionKindForDiscoveredConnection } from "../src/assembly/placement-connection-kind";

interface Prefix50TemporaryOccurrence {
  readonly ordinal: number;
  readonly colorId: string;
  readonly partIdentity: { readonly reconciledCatalogPartId: string };
}

export function prefix50TemporaryPartId(ordinal: number): string {
  return `prefix50-temp-${ordinal}`;
}

/** Applies one enumerated row only while resolving within-step dependencies. */
export function prefix50TemporaryOperations(
  document: BrickDocumentV1,
  occurrence: Prefix50TemporaryOccurrence,
  candidate: PlacementCandidate,
): readonly BuildOperation[] {
  const partId = prefix50TemporaryPartId(occurrence.ordinal);
  const part: PartInstance = {
    id: partId,
    catalogPartId: occurrence.partIdentity.reconciledCatalogPartId,
    colorId: occurrence.colorId,
    transform: candidate.transform,
    submodelId: document.submodels[0]?.id ?? "root",
    stepId: document.steps.at(-1)?.id ?? "step-1",
    semanticTags: [],
    provenance: { source: "manual" },
  };
  const connections: ConnectionEdge[] = candidate.connections.map((connection, index) => ({
    id: `prefix50-temp-edge-${occurrence.ordinal}-${index + 1}`,
    kind: protocolConnectionKindForDiscoveredConnection(
      document.parts,
      occurrence.partIdentity.reconciledCatalogPartId,
      connection,
    ),
    a: { partId: connection.targetPartId, portId: connection.targetPortId },
    b: { partId, portId: connection.candidatePortId },
    provenance: { source: "manual" },
  }));
  return [
    {
      kind: "addPart",
      operationId: `prefix50-temp-add-${occurrence.ordinal}`,
      part,
      semanticRegionIds: [],
    },
    ...connections.map((connection, index) => ({
      kind: "addConnection" as const,
      operationId: `prefix50-temp-connect-${occurrence.ordinal}-${index + 1}`,
      connection,
    })),
  ];
}
