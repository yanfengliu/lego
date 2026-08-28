import { isDeepStrictEqual } from "node:util";

import { transformPrefix50Vector } from "./part-identification-prefix50-official-world-reconciliation-math.mjs";
import { PREFIX50_FIRST_EIGHT_EXPECTED_CONTACTS } from "./part-identification-prefix50-official-world-reconciliation-source.mjs";

function worldConnector(connector, row, orientationById) {
  const matrix = orientationById.get(row.catalogWorldTransform.orientationId);
  if (matrix === undefined) {
    throw new TypeError(
      `First-eight topology row ${row.sourceBuilderIdentityOrdinal} has an unknown orientation.`,
    );
  }
  const offset = transformPrefix50Vector(matrix, connector.positionLdu);
  const normal = transformPrefix50Vector(matrix, connector.normal);
  return {
    connectorId: connector.id,
    kind: connector.kind,
    positionLdu: row.catalogWorldTransform.positionLdu.map(
      (coordinate, axis) => coordinate + offset[axis],
    ),
    normal,
  };
}

function connectorsCoincide(left, right, pair) {
  if (!left.positionLdu.every((coordinate, axis) => coordinate === right.positionLdu[axis])) {
    return false;
  }
  const opposing = left.normal.every((coordinate, axis) => coordinate === -right.normal[axis]);
  const same = left.normal.every((coordinate, axis) => coordinate === right.normal[axis]);
  return pair.axisMatching === "collinear" ? opposing || same : opposing;
}

function componentCount(ordinals, contacts) {
  const parent = new Map(ordinals.map((ordinal) => [ordinal, ordinal]));
  const find = (value) => {
    let cursor = value;
    while (parent.get(cursor) !== cursor) cursor = parent.get(cursor);
    return cursor;
  };
  for (const contact of contacts) {
    const left = find(contact.aOrdinal);
    const right = find(contact.bOrdinal);
    if (left !== right) parent.set(right, left);
  }
  return new Set(ordinals.map(find)).size;
}

export function measurePrefix50FirstEightConnectorTopology(rows, catalog) {
  const firstEight = [...rows]
    .filter(({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal <= 8)
    .sort((left, right) => left.sourceBuilderIdentityOrdinal - right.sourceBuilderIdentityOrdinal);
  if (
    firstEight.length !== 8 ||
    firstEight.some(
      (row, index) =>
        row.sourceBuilderIdentityOrdinal !== index + 1 || row.catalogWorldTransform === null,
    )
  ) {
    throw new TypeError(
      "First-eight topology requires reconciled official-world occurrence ordinals 1 through 8.",
    );
  }
  const orientationById = new Map(
    catalog.PROPER_ORIENTATIONS.map(({ id, matrix }) => [id, [...matrix]]),
  );
  const prepared = firstEight.map((row) => {
    const definition = catalog.getPartDefinition(row.catalogPartId);
    if (definition === undefined) {
      throw new TypeError(
        `First-eight topology row ${row.sourceBuilderIdentityOrdinal} has no catalog definition ${row.catalogPartId}.`,
      );
    }
    return {
      row,
      connectors: definition.connectors.map((connector) =>
        worldConnector(connector, row, orientationById),
      ),
    };
  });
  const contacts = [];
  let connectorPairComparisons = 0;
  for (let leftIndex = 0; leftIndex < prepared.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < prepared.length; rightIndex += 1) {
      const left = prepared[leftIndex];
      const right = prepared[rightIndex];
      let connectorPairs = 0;
      for (const leftConnector of left.connectors) {
        for (const rightConnector of right.connectors) {
          connectorPairComparisons += 1;
          const pair = catalog.connectorPairRule(leftConnector.kind, rightConnector.kind);
          if (pair !== undefined && connectorsCoincide(leftConnector, rightConnector, pair)) {
            connectorPairs += 1;
          }
        }
      }
      if (connectorPairs > 0) {
        contacts.push({
          aOrdinal: left.row.sourceBuilderIdentityOrdinal,
          bOrdinal: right.row.sourceBuilderIdentityOrdinal,
          connectorPairs,
        });
      }
    }
  }
  const components = componentCount(
    firstEight.map(({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal),
    contacts,
  );
  if (components !== 1 || !isDeepStrictEqual(contacts, PREFIX50_FIRST_EIGHT_EXPECTED_CONTACTS)) {
    throw new TypeError(
      `First-eight reconciled connector topology drifted: components=${components}, contacts=${JSON.stringify(contacts)}.`,
    );
  }
  return Object.freeze({
    scope: Object.freeze({ firstOrdinal: 1, lastOrdinal: 8 }),
    instrument: "catalog-connector-position-coincidence-only",
    fullConnectionCensus: false,
    capacityResolved: false,
    collisionChecked: false,
    documentLegalityClaimed: false,
    parts: 8,
    catalogConnectors: prepared.reduce((total, row) => total + row.connectors.length, 0),
    connectorPairComparisons,
    components,
    contacts: Object.freeze(contacts.map((contact) => Object.freeze(contact))),
  });
}
