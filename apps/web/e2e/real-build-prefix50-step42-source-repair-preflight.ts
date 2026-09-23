import { PROPER_ORIENTATIONS, UPRIGHT_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  canonicalDigest,
  createCollisionWorld,
  createPartInstance,
  deepFreeze,
  documentStructuralHash,
  findCatalogCollisions,
  getProperOrientation,
  rotateLduVector,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { ConnectionEdge, PartInstance, RigidTransform } from "@lego-studio/protocol";

import {
  createPlacementConnectorIndexes,
  discoverIndexedConnections,
  enumerateConnectorOrigins,
} from "../src/assembly/connector-placement-enumeration";
import {
  diagnosePlacementTransform,
  placementOccupancyKey,
  type PlacementCandidate,
} from "../src/assembly/enumerate-placements";
import { protocolConnectionKindForDiscoveredConnection } from "../src/assembly/placement-connection-kind";
import type { DiscoveredConnection } from "../src/placement";
import { occupiedConnectorCapacityClaims } from "../src/connector-capacity";
import {
  prefix50TemporaryOperations,
  prefix50TemporaryPartId,
} from "./real-build-prefix50-temporary-placement";
import {
  buildExactRealBuildPrefix50Step42Child,
  step42TemporaryOccurrence,
} from "./real-build-prefix50-step42-source-repair-child";
export { REAL_BUILD_PREFIX50_STEP42_PREFLIGHT_ROWS } from "./real-build-prefix50-step42-source-repair-child";
import {
  REAL_BUILD_PREFIX50_STEP42_CANONICAL_ORIENTATION as CANONICAL,
  REAL_BUILD_PREFIX50_STEP42_EQUIVALENT_ORIENTATION as EQUIVALENT,
  REAL_BUILD_PREFIX50_STEP42_OLDER_REFUSED_ORIENTATION as OLDER_REFUSED,
  REAL_BUILD_PREFIX50_STEP42_RAW_ORIENTATION as RAW_ORIENTATION,
  REAL_BUILD_PREFIX50_STEP42_RAW_TRANSFORM as RAW_TRANSFORM,
  REAL_BUILD_PREFIX50_STEP42_REPAIRED_TRANSFORM as REPAIRED_TRANSFORM,
  type RealBuildPrefix50Step42NormalizedConnection,
  type RealBuildPrefix50Step42PreflightEvidence,
  type RealBuildPrefix50Step42WindowRow,
} from "./real-build-prefix50-step42-source-repair-contract";
import {
  realBuildPrefix50PhysicalLayerCommitments,
  sameRealBuildPrefix50PhysicalLayers,
} from "./real-build-prefix50-step42-physical-equivalence";

const EXPECTED_CATALOG_VERSION = "builtin.basic-parts/30" as const;
const EXPECTED_CATALOG_HASH =
  "sha256:a030be3e20eeb1592594c43e321be64ac2f84875c40ad2445c48ca9e104ef290" as const;
const EXPECTED_TRUTH_HASH =
  "sha256:c304c3eb673e86d48580c6b28309f1fdf8bf4d71f7259ecc75f6f5691a336d51" as const;

interface EnumeratedSeat {
  readonly transform: RigidTransform;
  readonly connections: readonly DiscoveredConnection[];
  readonly occupancyKey: string;
}

interface SeatEnumeration {
  readonly rawSeeds: number;
  readonly distinctTransforms: number;
  readonly rejectedNoConnections: number;
  readonly rejectedColliding: number;
  readonly candidates: readonly EnumeratedSeat[];
}

function sameTransform(left: RigidTransform, right: RigidTransform): boolean {
  return (
    left.orientationId === right.orientationId &&
    left.positionLdu.every((coordinate, axis) => coordinate === right.positionLdu[axis])
  );
}

function edgesFor(
  parts: readonly PartInstance[],
  candidate: PartInstance,
  connections: readonly DiscoveredConnection[],
): readonly ConnectionEdge[] {
  return connections.map((connection, index) => ({
    id: `step42-preflight-seat-${candidate.id}-${index}`,
    kind: protocolConnectionKindForDiscoveredConnection(parts, candidate.catalogPartId, connection),
    a: { partId: connection.targetPartId, portId: connection.targetPortId },
    b: { partId: candidate.id, portId: connection.candidatePortId },
    provenance: { source: "manual" },
  }));
}

function enumerateSeats(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
  candidateCatalogPartId: string,
  candidateColorId: string,
  orientationIds: readonly string[],
): SeatEnumeration {
  const definition = getPartDefinition(candidateCatalogPartId);
  if (definition === undefined)
    throw new TypeError(`Unknown Step-42 part ${candidateCatalogPartId}.`);
  const indexes = createPlacementConnectorIndexes(
    parts,
    occupiedConnectorCapacityClaims(parts, connections),
    definition,
    orientationIds,
  );
  const origins = new Map<string, RigidTransform>();
  const receipt = enumerateConnectorOrigins(
    indexes,
    orientationIds,
    (positionLdu, orientationId) => {
      origins.set(`${positionLdu.join(",")}|${orientationId}`, { positionLdu, orientationId });
    },
  );
  const candidates: EnumeratedSeat[] = [];
  let rejectedNoConnections = 0;
  let rejectedColliding = 0;
  const world = createCollisionWorld(parts);
  for (const transform of origins.values()) {
    const candidate = createPartInstance({
      id: "step42-preflight-enumeration-candidate",
      catalogPartId: candidateCatalogPartId,
      colorId: candidateColorId,
      transform,
    });
    const discovered = discoverIndexedConnections(indexes, transform, candidate.id);
    if (discovered.length === 0) {
      rejectedNoConnections += 1;
      continue;
    }
    if (world.findCollisionsWith(candidate, edgesFor(parts, candidate, discovered)).length > 0) {
      rejectedColliding += 1;
      continue;
    }
    candidates.push({
      transform,
      connections: discovered,
      occupancyKey: placementOccupancyKey(candidateCatalogPartId, transform),
    });
  }
  const rawSeeds = receipt.seedReceipt.reduce((sum, entry) => sum + entry.axisCompatibleSeeds, 0);
  if (
    rawSeeds !==
      receipt.rawFromStuds + receipt.rawFromClutches + receipt.rawFromOtherConnectorPairs ||
    candidates.length + rejectedNoConnections + rejectedColliding !== origins.size
  ) {
    throw new TypeError("Step-42 seat enumeration is incomplete or internally inconsistent.");
  }
  return {
    rawSeeds,
    distinctTransforms: origins.size,
    rejectedNoConnections,
    rejectedColliding,
    candidates,
  };
}

function ordinalForPartId(partId: string): number {
  const match = /^prefix50-temp-(\d+)$/u.exec(partId);
  if (match === null) throw new TypeError(`Step-42 connection names unexpected part ${partId}.`);
  return Number(match[1]);
}

function panelConnections(
  candidate: EnumeratedSeat,
): RealBuildPrefix50Step42NormalizedConnection[] {
  return candidate.connections
    .map((connection) => ({
      receiverOrdinal: ordinalForPartId(connection.targetPartId) as 270 | 273,
      receiverPortId: connection.targetPortId as "stud:0" | "stud:1",
      candidatePortId:
        connection.candidatePortId as RealBuildPrefix50Step42NormalizedConnection["candidatePortId"],
      connectionKind: "stud-tube" as const,
    }))
    .sort(
      (left, right) =>
        left.receiverOrdinal - right.receiverOrdinal ||
        left.receiverPortId.localeCompare(right.receiverPortId),
    );
}

function expectedPanelRoster(candidate: EnumeratedSeat): boolean {
  return (
    panelConnections(candidate)
      .map(({ receiverOrdinal, receiverPortId }) => `${receiverOrdinal}/${receiverPortId}`)
      .join("|") === "270/stud:0|270/stud:1|273/stud:0|273/stud:1"
  );
}

function proveCanonicalDirection(
  definition: NonNullable<ReturnType<typeof getPartDefinition>>,
  canonical: EnumeratedSeat,
  equivalent: EnumeratedSeat,
): void {
  const clutches = definition.connectors
    .filter(({ kind }) => kind === "undersideClutch")
    .sort(({ id: left }, { id: right }) => left.localeCompare(right));
  if (clutches.length !== 6) throw new TypeError("Step-42 tile-1x6 must retain six clutch cells.");
  const localLength = clutches[5]!.positionLdu.map(
    (coordinate, axis) => coordinate - clutches[0]!.positionLdu[axis]!,
  ) as [number, number, number];
  const direction = (orientationId: string) =>
    rotateLduVector(getProperOrientation(orientationId).matrix, localLength);
  const rawDirection = direction(RAW_ORIENTATION);
  if (
    direction(canonical.transform.orientationId).join(",") !== rawDirection.join(",") ||
    direction(equivalent.transform.orientationId).join(",") !==
      rawDirection.map((coordinate) => -coordinate).join(",")
  ) {
    throw new TypeError(
      "Step-42 canonical label must preserve the raw local positive length axis.",
    );
  }
}

function reciprocalReceiverCount(
  tile: PartInstance,
  rows: readonly RealBuildPrefix50Step42WindowRow[],
  forward: readonly RealBuildPrefix50Step42NormalizedConnection[],
): number {
  let count = 0;
  for (const ordinal of [270, 273] as const) {
    const receiver = rows[ordinal - 258]!;
    const reverse = enumerateSeats(
      [tile],
      [],
      receiver.catalogPartId,
      receiver.colorId,
      PROPER_ORIENTATIONS.map(({ id }) => id),
    );
    const exact = reverse.candidates.filter(({ transform }) =>
      sameTransform(transform, receiver.sourceWorldTransform),
    );
    const reverseRoster = exact[0]?.connections
      .map(({ targetPortId, candidatePortId }) => `${ordinal}/${candidatePortId}/${targetPortId}`)
      .sort();
    const forwardRoster = forward
      .filter(({ receiverOrdinal }) => receiverOrdinal === ordinal)
      .map(
        ({ receiverOrdinal, receiverPortId, candidatePortId }) =>
          `${receiverOrdinal}/${receiverPortId}/${candidatePortId}`,
      )
      .sort();
    if (
      reverse.rawSeeds <= 0 ||
      reverse.candidates.length + reverse.rejectedNoConnections + reverse.rejectedColliding !==
        reverse.distinctTransforms ||
      exact.length !== 1 ||
      canonicalDigest(reverseRoster) !== canonicalDigest(forwardRoster)
    ) {
      throw new TypeError(
        `Step-42 repaired tile lacks one complete reciprocal seat for row ${ordinal}.`,
      );
    }
    count += 1;
  }
  return count;
}

export function preflightRealBuildPrefix50Step42SourceRepair(
  rows: readonly RealBuildPrefix50Step42WindowRow[],
): RealBuildPrefix50Step42PreflightEvidence {
  const document = buildExactRealBuildPrefix50Step42Child(rows);
  const truthSnapshotHash = canonicalDigest(document.truth);
  if (
    document.truth.catalog.version !== EXPECTED_CATALOG_VERSION ||
    document.truth.catalog.hash !== EXPECTED_CATALOG_HASH ||
    truthSnapshotHash !== EXPECTED_TRUTH_HASH
  ) {
    throw new TypeError(
      `Step-42 preflight is pinned to exact /30 catalog and truth ${EXPECTED_CATALOG_HASH}/${EXPECTED_TRUTH_HASH}; received ${document.truth.catalog.version}/${document.truth.catalog.hash}/${truthSnapshotHash}.`,
    );
  }
  const preRepairDocumentHash = documentStructuralHash(document);
  const rawRow = rows.at(-1)!;
  const raw = diagnosePlacementTransform(
    document,
    rawRow.catalogPartId,
    rawRow.sourceWorldTransform,
  );
  const rawCollisions = raw.collisionFindings
    .map((finding) => ({
      code: finding.code,
      ordinal: ordinalForPartId(finding.partIds.find((id) => id !== "enumeration-candidate")!),
    }))
    .sort((left, right) => left.ordinal - right.ordinal);
  const rawStudCollisions = raw.unconnectedCollisionFindings
    .filter(({ code }) => code === "PART_STUD_BODY_COLLISION")
    .map((finding) =>
      ordinalForPartId(finding.partIds.find((id) => id !== "enumeration-candidate")!),
    )
    .sort((left, right) => left - right);
  const rawRoster = enumerateSeats(
    document.parts,
    document.connections,
    rawRow.catalogPartId,
    rawRow.colorId,
    [...UPRIGHT_ORIENTATIONS.map(({ id }) => id), RAW_ORIENTATION],
  );
  if (
    !sameTransform(rawRow.sourceWorldTransform, RAW_TRANSFORM) ||
    !raw.originSeeded ||
    raw.connections.length !== 2 ||
    canonicalDigest(rawCollisions) !==
      canonicalDigest([
        { code: "PART_BODY_COLLISION", ordinal: 267 },
        { code: "PART_BODY_COLLISION", ordinal: 268 },
      ]) ||
    canonicalDigest(rawStudCollisions) !== canonicalDigest([264, 265]) ||
    rawRoster.rawSeeds !== 24 ||
    rawRoster.distinctTransforms !== 13 ||
    rawRoster.rejectedNoConnections !== 0 ||
    rawRoster.rejectedColliding !== 13 ||
    rawRoster.candidates.length !== 0
  ) {
    throw new TypeError(
      "Step-42 preflight control no longer reproduces raw occurrence 274 as 0/13 with the exact collision class.",
    );
  }
  const olderRefusedTransform = { ...RAW_TRANSFORM, orientationId: OLDER_REFUSED };
  const rawOccupancy = placementOccupancyKey(rawRow.catalogPartId, RAW_TRANSFORM);
  const rawPhysicalLayers = realBuildPrefix50PhysicalLayerCommitments(
    rawRow.catalogPartId,
    RAW_TRANSFORM,
  );
  const olderRefusedPhysicalLayers = realBuildPrefix50PhysicalLayerCommitments(
    rawRow.catalogPartId,
    olderRefusedTransform,
  );
  if (
    placementOccupancyKey(rawRow.catalogPartId, olderRefusedTransform) !== rawOccupancy ||
    !sameRealBuildPrefix50PhysicalLayers(rawPhysicalLayers, olderRefusedPhysicalLayers)
  ) {
    throw new TypeError(
      "Step-42 older refused orientation must retain exact connector, collision, allowance, and render-geometry equivalence with the raw counterevidence.",
    );
  }
  const allOrientationIds = PROPER_ORIENTATIONS.map(({ id }) => id);
  const complete = enumerateSeats(
    document.parts,
    document.connections,
    rawRow.catalogPartId,
    rawRow.colorId,
    allOrientationIds,
  );
  const occupancyCount = new Set(complete.candidates.map(({ occupancyKey }) => occupancyKey)).size;
  const panelCandidates = complete.candidates.filter(
    (candidate) =>
      candidate.transform.positionLdu[0] === 400 &&
      [CANONICAL, EQUIVALENT].includes(candidate.transform.orientationId as typeof CANONICAL) &&
      expectedPanelRoster(candidate),
  );
  const canonical = panelCandidates.find(({ transform }) => transform.orientationId === CANONICAL);
  const equivalent = panelCandidates.find(
    ({ transform }) => transform.orientationId === EQUIVALENT,
  );
  const canonicalPhysicalLayers =
    canonical === undefined
      ? null
      : realBuildPrefix50PhysicalLayerCommitments(rawRow.catalogPartId, canonical.transform);
  const equivalentPhysicalLayers =
    equivalent === undefined
      ? null
      : realBuildPrefix50PhysicalLayerCommitments(rawRow.catalogPartId, equivalent.transform);
  if (
    allOrientationIds.length !== 24 ||
    complete.rawSeeds !== 288 ||
    complete.candidates.length !== 98 ||
    occupancyCount !== 49 ||
    panelCandidates.length !== 2 ||
    canonical === undefined ||
    equivalent === undefined ||
    !sameTransform(canonical.transform, REPAIRED_TRANSFORM) ||
    canonicalPhysicalLayers === null ||
    equivalentPhysicalLayers === null ||
    !sameRealBuildPrefix50PhysicalLayers(canonicalPhysicalLayers, equivalentPhysicalLayers)
  ) {
    throw new TypeError(
      "Step-42 complete 24-orientation search no longer derives one exact two-label connector/collision/allowance/render-geometry class.",
    );
  }
  const definition = getPartDefinition(rawRow.catalogPartId)!;
  if (
    !definition.legalOrientationIds.includes(CANONICAL) ||
    definition.legalOrientationIds.includes(EQUIVALENT)
  ) {
    throw new TypeError("Step-42 /30 must admit only the canonical tile-1x6 panel-face label.");
  }
  proveCanonicalDirection(definition, canonical, equivalent);
  const canonicalConnections = panelConnections(canonical);
  const equivalentConnections = panelConnections(equivalent);
  const candidatePart = createPartInstance({
    id: prefix50TemporaryPartId(274),
    catalogPartId: rawRow.catalogPartId,
    colorId: rawRow.colorId,
    transform: canonical.transform,
  });
  const reciprocalCount = reciprocalReceiverCount(candidatePart, rows, canonicalConnections);
  const repaired = applyBuildOperations(
    document,
    prefix50TemporaryOperations(document, step42TemporaryOccurrence(rawRow), {
      catalogPartId: rawRow.catalogPartId,
      transform: canonical.transform,
      connections: canonical.connections,
      restsOnBuildPlate: false,
    } satisfies PlacementCandidate),
  );
  const repairedBlockers = validateBrickDocument(repaired).issues.filter(
    ({ severity }) => severity === "blocking",
  );
  const repairedCollisions = findCatalogCollisions(repaired.parts, repaired.connections);
  const postRepairDocumentHash = documentStructuralHash(repaired);
  if (
    reciprocalCount !== 2 ||
    repaired.parts.length !== 17 ||
    repaired.connections.length !== 32 ||
    repairedBlockers.length !== 0 ||
    repairedCollisions.length !== 0
  ) {
    throw new TypeError(
      `Step-42 repaired child must be reciprocal and hard-valid at 17 parts/32 edges/0 collisions; found ${repaired.parts.length}/${repaired.connections.length}/${repairedBlockers.length}/${repairedCollisions.length}.`,
    );
  }
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step42-preflight-evidence/1" as const,
    authority: "none" as const,
    sourceRowsCommitment: canonicalDigest(rows),
    catalogVersion: EXPECTED_CATALOG_VERSION,
    catalogSnapshotHash: EXPECTED_CATALOG_HASH,
    truthSnapshotHash: EXPECTED_TRUTH_HASH,
    preRepairDocumentHash,
    postRepairDocumentHash,
    exactChildPartCount: 16 as const,
    exactChildConnectionCount: 28 as const,
    exactChildBlockingIssueCount: 0 as const,
    rawSourceTransform: RAW_TRANSFORM,
    rawSeededConnectionCount: 2 as const,
    rawConnectedCollisionPartOrdinals: [267, 268] as const,
    rawConnectedCollisionFindingCodes: ["PART_BODY_COLLISION", "PART_BODY_COLLISION"] as const,
    rawUnconnectedStudCollisionPartOrdinals: [264, 265] as const,
    rawRosterCounts: {
      rawSeeds: 24 as const,
      distinctTransforms: 13 as const,
      rejectedColliding: 13 as const,
      accepted: 0 as const,
    },
    rawAndOlderRefusedOccupancyKey: rawOccupancy,
    exactPhysicalLayerCommitments: {
      raw: rawPhysicalLayers,
      olderRefused: olderRefusedPhysicalLayers,
      canonical: canonicalPhysicalLayers,
      equivalent: equivalentPhysicalLayers,
    },
    completeOrientationCount: 24 as const,
    completeRawSeeds: 288 as const,
    completeAcceptedLabelCount: 98 as const,
    completeAcceptedOccupancyCount: 49 as const,
    panelFacePhysicalOccupancyClassCount: 1 as const,
    equivalentOrientationIds: [CANONICAL, EQUIVALENT] as const,
    repairedSourceTransform: canonical.transform,
    repairedOccupancyKey: canonical.occupancyKey,
    canonicalConnections,
    equivalentConnections,
    reciprocalExactReceiverCount: 2 as const,
    repairedConnectedCollisionFindingCount: 0 as const,
    repairedChildPartCount: 17 as const,
    repairedChildConnectionCount: 32 as const,
    repairedChildBlockingIssueCount: 0 as const,
  });
  return deepFreeze({ ...body, repairCommitment: canonicalDigest(body) });
}
