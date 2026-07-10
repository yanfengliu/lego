import { getPartDefinition } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { canonicalDigest, canonicalStringify, type Sha256Digest } from "./canonical.ts";

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedStrings(values: readonly string[]): string[] {
  return [...values].sort(compareStrings);
}

export function normalizePartInstance(part: PartInstance): PartInstance {
  return {
    ...part,
    transform: {
      ...part.transform,
      positionLdu: [...part.transform.positionLdu],
    },
    semanticTags: sortedStrings(part.semanticTags),
    provenance: { ...part.provenance },
  };
}

function endpointKey(endpoint: ConnectionEdge["a"]): string {
  return `${endpoint.partId}\u0000${endpoint.portId}`;
}

function connectorKind(
  endpoint: ConnectionEdge["a"],
  partById: ReadonlyMap<string, PartInstance>,
): "stud" | "undersideClutch" | undefined {
  const part = partById.get(endpoint.partId);
  return part === undefined
    ? undefined
    : getPartDefinition(part.catalogPartId)?.connectors.find(({ id }) => id === endpoint.portId)
        ?.kind;
}

export function normalizeConnectionEdge(
  connection: ConnectionEdge,
  parts: readonly PartInstance[],
): ConnectionEdge {
  const partById = new Map(parts.map((part) => [part.id, part]));
  const aKind = connectorKind(connection.a, partById);
  const bKind = connectorKind(connection.b, partById);
  const shouldSwap =
    aKind === "undersideClutch" && bKind === "stud"
      ? true
      : aKind === "stud" && bKind === "undersideClutch"
        ? false
        : endpointKey(connection.a) > endpointKey(connection.b);
  const [a, b] = shouldSwap ? [connection.b, connection.a] : [connection.a, connection.b];

  return {
    ...connection,
    a: { ...a },
    b: { ...b },
    provenance: { ...connection.provenance },
  };
}

export function normalizeBrickDocument(document: BrickDocumentV1): BrickDocumentV1 {
  return {
    ...document,
    truth: {
      ...document.truth,
      catalog: { ...document.truth.catalog },
      connectorTaxonomy: { ...document.truth.connectorTaxonomy },
      collisionModel: { ...document.truth.collisionModel },
      transformPolicy: { ...document.truth.transformPolicy },
      validatorSet: { ...document.truth.validatorSet },
    },
    parts: document.parts
      .map(normalizePartInstance)
      .sort((left, right) => compareStrings(left.id, right.id)),
    connections: document.connections
      .map((connection) => normalizeConnectionEdge(connection, document.parts))
      .sort((left, right) => compareStrings(left.id, right.id)),
    submodels: document.submodels
      .map((submodel) => ({
        ...submodel,
        partIds: sortedStrings(submodel.partIds),
      }))
      .sort((left, right) => compareStrings(left.id, right.id)),
    steps: document.steps
      .map((step) => ({
        ...step,
        partIds: sortedStrings(step.partIds),
      }))
      .sort((left, right) => left.index - right.index || compareStrings(left.id, right.id)),
    semanticRegions: document.semanticRegions
      .map((region) => ({
        ...region,
        partIds: sortedStrings(region.partIds),
      }))
      .sort((left, right) => compareStrings(left.id, right.id)),
    constraints: {
      ...document.constraints,
      allowedCatalogPartIds: sortedStrings(document.constraints.allowedCatalogPartIds),
      allowedColorIds: sortedStrings(document.constraints.allowedColorIds),
    },
    provenance: { ...document.provenance },
  };
}

export function canonicalBrickDocument(document: BrickDocumentV1): string {
  return canonicalStringify(normalizeBrickDocument(document));
}

export function structuralDocumentValue(document: BrickDocumentV1): unknown {
  const normalized = normalizeBrickDocument(document);

  return {
    schemaVersion: normalized.schemaVersion,
    truth: normalized.truth,
    parts: normalized.parts.map(
      ({ id, catalogPartId, colorId, transform, submodelId, stepId, semanticTags }) => ({
        id,
        catalogPartId,
        colorId,
        transform,
        submodelId,
        stepId,
        semanticTags,
      }),
    ),
    connections: normalized.connections.map(({ id, kind, a, b }) => ({ id, kind, a, b })),
    submodels: normalized.submodels.map(({ id, partIds }) => ({ id, partIds })),
    steps: normalized.steps.map(({ id, index, partIds }) => ({ id, index, partIds })),
    semanticRegions: normalized.semanticRegions,
    constraints: normalized.constraints,
  };
}

export function documentStructuralHash(document: BrickDocumentV1): Sha256Digest {
  return canonicalDigest(structuralDocumentValue(document));
}
