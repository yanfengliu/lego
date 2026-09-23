import { PROPER_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  canonicalDigest,
  createCollisionWorld,
  createEmptyBrickDocument,
  deepFreeze,
  documentStructuralHash,
  findCatalogCollisions,
  type CollisionFinding,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, PartInstance, RigidTransform } from "@lego-studio/protocol";

import {
  createPlacementConnectorIndexes,
  discoverIndexedConnections,
  enumerateConnectorOrigins,
} from "../src/assembly/connector-placement-enumeration";
import { placementOccupancyKey } from "../src/assembly/enumerate-placements";
import { occupiedConnectorCapacityClaims } from "../src/connector-capacity";
import type { DiscoveredConnection } from "../src/placement";
import type { RealBuildPrefix50ProjectionOccurrence } from "./real-build-prefix50-projection";
import {
  REAL_BUILD_PREFIX50_STEP42_43_REPAIRS,
  type RealBuildPrefix50Step42_43ConnectionEvidence,
  type RealBuildPrefix50Step42_43RowEvidence,
} from "./real-build-prefix50-step42-43-source-repair-contract";
import { prefix50TemporaryOperations } from "./real-build-prefix50-temporary-placement";

interface ContextTransform {
  readonly ordinal: number;
  readonly positionLdu: readonly [number, number, number];
  readonly orientationId: string;
}

const CONTEXT_TRANSFORMS = [
  [258, 440, -98, -86, "proper-m-00nn000p0"],
  [259, 340, -98, -78, "proper-m-00nn000p0"],
  [260, 240, -98, -86, "proper-m-00nn000p0"],
  [261, 270, -98, -94, "proper-m-00nn000p0"],
  [262, 380, -98, -86, "proper-m-00nn000p0"],
  [263, 300, -98, -86, "proper-m-00nn000p0"],
  [264, 340, -98, -94, "proper-m-00pp000p0"],
  [265, 410, -98, -94, "proper-m-00nn000p0"],
  [266, 240, -88, -104, "proper-m-p0000n0p0"],
  [267, 440, -88, -104, "proper-m-p0000n0p0"],
  [268, 380, -88, -104, "proper-m-p0000n0p0"],
  [269, 300, -88, -104, "proper-m-p0000n0p0"],
  [270, 440, -80, -108, "proper-m-00n0n0n00"],
  [271, 240, -80, -108, "proper-m-00n0n0n00"],
  [272, 300, -80, -108, "proper-m-00n0n0n00"],
  [273, 380, -80, -108, "proper-m-00n0n0n00"],
  [274, 400, -72, -108, "proper-m-00n0n0n00"],
].map(([ordinal, x, y, z, orientationId]) => ({
  ordinal,
  positionLdu: [x, y, z],
  orientationId,
})) as readonly ContextTransform[];

const ORIENTATION_IDS = deepFreeze(PROPER_ORIENTATIONS.map(({ id }) => id));
const EXPECTED_CATALOG_VERSION = "builtin.basic-parts/30" as const;
const EXPECTED_CATALOG_HASH =
  "sha256:a030be3e20eeb1592594c43e321be64ac2f84875c40ad2445c48ca9e104ef290" as const;
const EXPECTED_TRUTH_HASH =
  "sha256:c304c3eb673e86d48580c6b28309f1fdf8bf4d71f7259ecc75f6f5691a336d51" as const;

function ordinalForPartId(partId: string): number {
  const match = /^prefix50-temp-(\d+)$/u.exec(partId);
  if (match === null) {
    throw new TypeError(`Late Step-42/43 evidence found unexpected part id ${partId}.`);
  }
  return Number(match[1]);
}

function collisionEvidence(findings: readonly CollisionFinding[], candidateOrdinal: number) {
  return findings
    .map((finding) => ({
      code: finding.code,
      counterpartOrdinals: finding.partIds
        .map(ordinalForPartId)
        .filter((ordinal) => ordinal !== candidateOrdinal)
        .sort((left, right) => left - right),
    }))
    .sort(
      (left, right) =>
        left.code.localeCompare(right.code) ||
        left.counterpartOrdinals.join(",").localeCompare(right.counterpartOrdinals.join(",")),
    );
}

function exactPart(row: RealBuildPrefix50ProjectionOccurrence, transform: RigidTransform) {
  const definition = getPartDefinition(row.partIdentity.reconciledCatalogPartId);
  if (definition === undefined)
    throw new TypeError(`Unknown catalog part at occurrence ${row.ordinal}.`);
  const part: PartInstance = {
    id: `prefix50-temp-${row.ordinal}`,
    catalogPartId: definition.id,
    colorId: row.colorId,
    transform,
    submodelId: "root",
    stepId: "step-1",
    semanticTags: [],
    provenance: { source: "manual" },
  };
  return { definition, part };
}

function probe(
  document: BrickDocumentV1,
  row: RealBuildPrefix50ProjectionOccurrence,
  transform: RigidTransform,
) {
  const { definition, part } = exactPart(row, transform);
  const indexes = createPlacementConnectorIndexes(
    document.parts,
    occupiedConnectorCapacityClaims(document.parts, document.connections),
    definition,
    [transform.orientationId],
  );
  const connections = discoverIndexedConnections(indexes, transform, part.id);
  const operations = prefix50TemporaryOperations(document, row, {
    catalogPartId: part.catalogPartId,
    transform,
    connections,
    restsOnBuildPlate: false,
  });
  const edges = operations.flatMap((operation) =>
    operation.kind === "addConnection" ? [operation.connection] : [],
  );
  const collisions = createCollisionWorld(document.parts).findCollisionsWith(part, edges);
  return { connections, collisions, operations };
}

function place(
  document: BrickDocumentV1,
  row: RealBuildPrefix50ProjectionOccurrence,
  transform: RigidTransform,
): BrickDocumentV1 {
  const result = probe(document, row, transform);
  if (row.ordinal !== 258 && result.connections.length === 0) {
    throw new TypeError(`Occurrence ${row.ordinal} has no reciprocal connector seat.`);
  }
  if (result.collisions.length !== 0) {
    throw new TypeError(
      `Occurrence ${row.ordinal} has connected collisions ${collisionEvidence(
        result.collisions,
        row.ordinal,
      )
        .map(({ code, counterpartOrdinals }) => `${code}@[${counterpartOrdinals.join(",")}]`)
        .join("|")}.`,
    );
  }
  return applyBuildOperations(document, result.operations);
}

function normalizeConnections(
  connections: readonly DiscoveredConnection[],
): readonly RealBuildPrefix50Step42_43ConnectionEvidence[] {
  return connections
    .map((connection) => {
      const ordinal = Number(/^prefix50-temp-(\d+)$/u.exec(connection.targetPartId)?.[1]);
      if (!Number.isSafeInteger(ordinal)) {
        throw new TypeError("Late Step-42/43 enumeration discovered a non-window third body.");
      }
      return {
        targetOrdinal: ordinal,
        targetPortId: connection.targetPortId,
        candidatePortId: connection.candidatePortId,
      };
    })
    .sort(
      (left, right) =>
        left.targetOrdinal - right.targetOrdinal ||
        left.targetPortId.localeCompare(right.targetPortId) ||
        left.candidatePortId.localeCompare(right.candidatePortId),
    );
}

function reciprocalSeatEvidence(
  document: BrickDocumentV1,
  rows: readonly RealBuildPrefix50ProjectionOccurrence[],
  row: RealBuildPrefix50ProjectionOccurrence,
  repair: (typeof REAL_BUILD_PREFIX50_STEP42_43_REPAIRS)[number],
  forward: readonly RealBuildPrefix50Step42_43ConnectionEvidence[],
): { readonly targetCount: number; readonly connectionCount: number } {
  const empty = createEmptyBrickDocument({
    id: `step42-43-reverse-${repair.ordinal}`,
    name: `Step 42/43 reverse ${repair.ordinal}`,
  });
  const candidateOnly = applyBuildOperations(
    empty,
    prefix50TemporaryOperations(empty, row, {
      catalogPartId: repair.catalogPartId,
      transform: repair.repaired,
      connections: [],
      restsOnBuildPlate: false,
    }),
  );
  const targets = [...new Set(forward.map(({ targetOrdinal }) => targetOrdinal))].sort(
    (left, right) => left - right,
  );
  let connectionCount = 0;
  for (const targetOrdinal of targets) {
    const targetRow = rows[targetOrdinal - 258];
    const targetPart = document.parts.find(({ id }) => id === `prefix50-temp-${targetOrdinal}`);
    if (targetRow === undefined || targetPart === undefined) {
      throw new TypeError(
        `Occurrence ${repair.ordinal} reverse reciprocity cannot find target ${targetOrdinal}.`,
      );
    }
    const definition = getPartDefinition(targetPart.catalogPartId)!;
    const indexes = createPlacementConnectorIndexes(
      candidateOnly.parts,
      occupiedConnectorCapacityClaims(candidateOnly.parts, candidateOnly.connections),
      definition,
      ORIENTATION_IDS,
    );
    const origins = new Map<string, RigidTransform>();
    enumerateConnectorOrigins(indexes, ORIENTATION_IDS, (positionLdu, orientationId) => {
      origins.set(`${positionLdu.join(",")}|${orientationId}`, { positionLdu, orientationId });
    });
    const exactOrigins = [...origins.values()].filter(
      ({ positionLdu, orientationId }) =>
        orientationId === targetPart.transform.orientationId &&
        positionLdu.every(
          (coordinate, axis) => coordinate === targetPart.transform.positionLdu[axis],
        ),
    );
    const reverse = probe(candidateOnly, targetRow, targetPart.transform);
    const reverseRoster = reverse.connections
      .map((connection) => ({
        targetOrdinal,
        targetPortId: connection.candidatePortId,
        candidatePortId: connection.targetPortId,
      }))
      .sort(
        (left, right) =>
          left.targetPortId.localeCompare(right.targetPortId) ||
          left.candidatePortId.localeCompare(right.candidatePortId),
      );
    const forwardRoster = forward
      .filter((connection) => connection.targetOrdinal === targetOrdinal)
      .sort(
        (left, right) =>
          left.targetPortId.localeCompare(right.targetPortId) ||
          left.candidatePortId.localeCompare(right.candidatePortId),
      );
    if (
      exactOrigins.length !== 1 ||
      reverse.collisions.length !== 0 ||
      canonicalDigest(reverseRoster) !== canonicalDigest(forwardRoster)
    ) {
      throw new TypeError(
        `Occurrence ${repair.ordinal} lacks one literal reverse-enumerated reciprocal seat for target ${targetOrdinal}; exact/collisions/forward/reverse=${exactOrigins.length}/${reverse.collisions.length}/${forwardRoster.length}/${reverseRoster.length}.`,
      );
    }
    connectionCount += reverseRoster.length;
  }
  return { targetCount: targets.length, connectionCount };
}

function enumerateRow(
  document: BrickDocumentV1,
  rows: readonly RealBuildPrefix50ProjectionOccurrence[],
  row: RealBuildPrefix50ProjectionOccurrence,
  repair: (typeof REAL_BUILD_PREFIX50_STEP42_43_REPAIRS)[number],
): RealBuildPrefix50Step42_43RowEvidence {
  const definition = getPartDefinition(repair.catalogPartId)!;
  const indexes = createPlacementConnectorIndexes(
    document.parts,
    occupiedConnectorCapacityClaims(document.parts, document.connections),
    definition,
    ORIENTATION_IDS,
  );
  const origins = new Map<string, RigidTransform>();
  const counts = enumerateConnectorOrigins(
    indexes,
    ORIENTATION_IDS,
    (positionLdu, orientationId) => {
      origins.set(`${positionLdu.join(",")}|${orientationId}`, { positionLdu, orientationId });
    },
  );
  const acceptedAtSourceX = [];
  let rejectedNoConnections = 0;
  let rejectedColliding = 0;
  let accepted = 0;
  for (const transform of origins.values()) {
    const result = probe(document, row, transform);
    if (result.connections.length === 0) {
      rejectedNoConnections += 1;
    } else if (result.collisions.length !== 0) {
      rejectedColliding += 1;
    } else {
      accepted += 1;
      if (transform.positionLdu[0] === repair.repaired.positionLdu[0]) {
        acceptedAtSourceX.push({
          transform: deepFreeze({
            positionLdu: [...transform.positionLdu] as [number, number, number],
            orientationId: transform.orientationId,
          }),
          occupancyKey: placementOccupancyKey(repair.catalogPartId, transform),
          currentCatalogLegal: definition.legalOrientationIds.includes(transform.orientationId),
          connections: normalizeConnections(result.connections),
        });
      }
    }
  }
  const rawSeedCount =
    counts.rawFromStuds + counts.rawFromClutches + counts.rawFromOtherConnectorPairs;
  const receiptSeedCount = counts.seedReceipt.reduce(
    (sum, receipt) => sum + receipt.axisCompatibleSeeds,
    0,
  );
  if (
    ORIENTATION_IDS.length !== 24 ||
    rawSeedCount !== receiptSeedCount ||
    rejectedNoConnections + rejectedColliding + accepted !== origins.size
  ) {
    throw new TypeError("Late Step-42/43 orientation/origin enumeration is incomplete.");
  }
  const selected = probe(document, row, repair.repaired);
  const canonical = acceptedAtSourceX.find(
    ({ transform }) =>
      transform.orientationId === repair.repaired.orientationId &&
      transform.positionLdu.join(",") === repair.repaired.positionLdu.join(","),
  );
  const alternative = acceptedAtSourceX.find(
    ({ transform }) =>
      transform.orientationId === repair.equivalentOrientationId &&
      transform.positionLdu.join(",") === repair.repaired.positionLdu.join(","),
  );
  if (canonical === undefined || alternative === undefined || selected.collisions.length !== 0) {
    throw new TypeError(`Occurrence ${repair.ordinal} lacks both reviewed physical labels.`);
  }
  const sameOccupancy = canonical.occupancyKey === alternative.occupancyKey;
  const shouldMatch = repair.catalogPartId !== "builtin:slope-1x2-45";
  if (sameOccupancy !== shouldMatch) {
    throw new TypeError(`Occurrence ${repair.ordinal} symmetry occupancy class changed.`);
  }
  const raw = probe(document, row, repair.raw);
  const normalizedSelected = normalizeConnections(selected.connections);
  const reciprocal = reciprocalSeatEvidence(document, rows, row, repair, normalizedSelected);
  return deepFreeze({
    ordinal: repair.ordinal,
    rawSourceWorldTransform: repair.raw,
    repairedSourceWorldTransform: repair.repaired,
    rawConnectionCount: raw.connections.length,
    rawCollisionFindingCodes: raw.collisions.map(({ code }) => code).sort(),
    rawCollisionFindings: collisionEvidence(raw.collisions, repair.ordinal),
    completeOrientationCount: 24 as const,
    rawSeedCount,
    distinctTransformCount: origins.size,
    enumerationCounts: { rejectedNoConnections, rejectedColliding, accepted },
    sourceXAcceptedCandidates: acceptedAtSourceX,
    selectedConnections: normalizedSelected,
    selectedCollisionFindingCount: 0 as const,
    reciprocalExactTargetCount: reciprocal.targetCount,
    reciprocalExactConnectionCount: reciprocal.connectionCount,
    symmetryOccupancyRelation: sameOccupancy
      ? ("same-physical-occupancy" as const)
      : ("distinct-facing-occupancy" as const),
  });
}

export function enumerateRealBuildPrefix50Step42_43SourceRepair(
  rows: readonly RealBuildPrefix50ProjectionOccurrence[],
) {
  if (rows.length !== 23 || rows.some((row, index) => row.ordinal !== index + 258)) {
    throw new TypeError("Late Step-42/43 proof requires exact source ordinals 258..280.");
  }
  let document = createEmptyBrickDocument({ id: "step42-43-proof", name: "Step 42/43 proof" });
  for (const context of CONTEXT_TRANSFORMS) {
    document = place(document, rows[context.ordinal - 258]!, {
      positionLdu: context.positionLdu,
      orientationId: context.orientationId,
    });
  }
  const truthSnapshotHash = canonicalDigest(document.truth);
  if (
    document.truth.catalog.version !== EXPECTED_CATALOG_VERSION ||
    document.truth.catalog.hash !== EXPECTED_CATALOG_HASH ||
    truthSnapshotHash !== EXPECTED_TRUTH_HASH
  ) {
    throw new TypeError(
      `Late Step-42/43 enumeration requires exact /30 catalog truth; received ${document.truth.catalog.version}/${document.truth.catalog.hash}/${truthSnapshotHash}.`,
    );
  }
  const predecessorDocumentHash = documentStructuralHash(document);
  const evidence: RealBuildPrefix50Step42_43RowEvidence[] = [];
  let reciprocalConnectionCount = 0;
  for (const repair of REAL_BUILD_PREFIX50_STEP42_43_REPAIRS) {
    const row = rows[repair.ordinal - 258]!;
    const rowEvidence = enumerateRow(document, rows, row, repair);
    evidence.push(rowEvidence);
    reciprocalConnectionCount += rowEvidence.reciprocalExactConnectionCount;
    document = place(document, row, repair.repaired);
  }
  const collisions = findCatalogCollisions(document.parts, document.connections);
  const capacityClaims = occupiedConnectorCapacityClaims(document.parts, document.connections);
  const blockingIssues = validateBrickDocument(document).issues.filter(
    ({ severity }) => severity === "blocking",
  );
  const terminalDocumentHash = documentStructuralHash(document);
  if (
    document.parts.length !== 23 ||
    document.connections.length !== 46 ||
    collisions.length !== 0 ||
    blockingIssues.length !== 0 ||
    reciprocalConnectionCount !== 14
  ) {
    throw new TypeError(
      `Late Step-42/43 terminal proof expected 23 parts, 46 edges, zero collisions/blockers and 14 reciprocal edges; received ${document.parts.length}/${document.connections.length}/${collisions.length}/${blockingIssues.length}/${reciprocalConnectionCount}.`,
    );
  }
  return deepFreeze({
    rows: evidence,
    catalogVersion: EXPECTED_CATALOG_VERSION,
    catalogSnapshotHash: EXPECTED_CATALOG_HASH,
    truthSnapshotHash: EXPECTED_TRUTH_HASH,
    predecessorDocumentHash,
    terminalDocumentHash,
    terminalPartCount: 23 as const,
    terminalConnectionCount: 46 as const,
    terminalCollisionFindingCount: 0 as const,
    terminalBlockingIssueCount: 0 as const,
    terminalReciprocalConnectionCount: 14 as const,
    terminalConnectorCapacityClaimCount: capacityClaims.size,
  });
}
