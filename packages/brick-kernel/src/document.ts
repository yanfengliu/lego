import { getPartDefinition, type ConnectorGender } from "@lego-studio/catalog";
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

/**
 * Which half of a pair an endpoint is, or undefined if the part or port is not
 * in the catalog. Read from the connector taxonomy rather than by naming kinds,
 * so an axle in an axle hole canonicalises the same way a stud in a clutch does.
 */
function connectorGender(
  endpoint: ConnectionEdge["a"],
  partById: ReadonlyMap<string, PartInstance>,
): ConnectorGender | undefined {
  const part = partById.get(endpoint.partId);
  if (part === undefined) return undefined;
  return getPartDefinition(part.catalogPartId)?.connectors.find(({ id }) => id === endpoint.portId)
    ?.gender;
}

export function normalizeConnectionEdge(
  connection: ConnectionEdge,
  parts: readonly PartInstance[],
): ConnectionEdge {
  const partById = new Map(parts.map((part) => [part.id, part]));
  return normalizeConnectionEdgeWithPartIndex(connection, partById);
}

function normalizeConnectionEdgeWithPartIndex(
  connection: ConnectionEdge,
  partById: ReadonlyMap<string, PartInstance>,
): ConnectionEdge {
  // The male half goes first, so one join has one spelling. Where neither side
  // resolves to a gender, fall back to sorting by key so it is still stable.
  const aGender = connectorGender(connection.a, partById);
  const bGender = connectorGender(connection.b, partById);
  const shouldSwap =
    aGender === "female" && bGender === "male"
      ? true
      : aGender === "male" && bGender === "female"
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
  const partById = new Map(document.parts.map((part) => [part.id, part]));
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
      .map((connection) => normalizeConnectionEdgeWithPartIndex(connection, partById))
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
