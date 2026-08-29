import { getPartDefinition, type LduVector3 } from "@lego-studio/catalog";
import { createCollisionWorld, transformLduPoint } from "@lego-studio/brick-kernel";
import type {
  BrickDocumentV1,
  ConnectionEdge,
  PartInstance,
  RigidTransform,
} from "@lego-studio/protocol";

import {
  GROUND_UNDERSIDE_LDU,
  bodyBoundsLdu,
  restsOnBuildPlate,
  type DiscoveredConnection,
} from "../placement";
import { occupiedConnectorCapacityClaims } from "../connector-capacity";
import { buildPlateOrigins } from "./build-plate-origins";
import {
  createPlacementConnectorIndexes,
  discoverIndexedConnections,
  enumerateConnectorOrigins,
  type PlacementConnectorSeedReceipt,
} from "./connector-placement-enumeration";
import {
  emptyPlacementEnumerationWork,
  type MutablePlacementEnumerationWork,
} from "./enumerate-placement-work";
import { protocolConnectionKindForDiscoveredConnection } from "./placement-connection-kind";
import {
  createPreparedPlacementEnumerationWorld,
  preparedCollisionWorld,
  preparedFreePortIndex,
  requirePreparedPlacementEnumerationState,
  type PreparedPlacementEnumerationWorld,
} from "./prepared-placement-enumeration-world";

export type {
  PlacementEnumerationWork,
  PlacementEnumerationWorkObserver,
} from "./enumerate-placement-work";
export type { PreparedPlacementEnumerationWorld } from "./prepared-placement-enumeration-world";

/**
 * Every legal place one part could go on the current assembly.
 *
 * This is the branching factor of the whole closed-loop search, so it is
 * enumerated from connections rather than swept over a lattice. Solving
 * `origin = port - rotate(port)` maps each compatible port pair to one origin.
 *
 * A stud-tube joint has two sides and the enumeration seeds from both. The
 * candidate's clutches landing on the assembly's free studs is the part going
 * *on top*; the candidate's studs landing on the assembly's free clutches is the
 * part sliding in *underneath*, which is what an instruction booklet draws with
 * an upward arrow. Seeding only the first kind is not a smaller search, it is a
 * search whose set can never contain that answer: measured on the booklet's
 * printed step 2, the two seed sets are disjoint and the drawn placement is only
 * in the second.
 *
 * Nothing here re-implements the rules. Support comes from the same predicate
 * the editor refuses placements with, and collisions are adjudicated by the
 * kernel's own `findCatalogCollisions` over the candidate and its neighbours,
 * so a candidate this accepts is one the document validator accepts. The tests
 * assert both directions of that against brute force.
 */
export const PLACEMENT_ENUMERATION_VERSION = "lego.placement-enumeration/3" as const;

export interface PlacementCandidate {
  readonly catalogPartId: string;
  readonly transform: RigidTransform;
  /** The stud/clutch pairs this placement would author, in kernel order. */
  readonly connections: readonly DiscoveredConnection[];
  readonly restsOnBuildPlate: boolean;
}

export interface PlacementEnumerationCounts {
  /** Studs on the assembly with no connection already using them. */
  readonly freeStuds: number;
  /** Underside clutches on the assembly with no connection already using them. */
  readonly freeClutches: number;
  /** Axis-compatible (free stud, candidate clutch, orientation) triples. */
  readonly rawFromStuds: number;
  /** Axis-compatible (free clutch, candidate stud, orientation) triples. */
  readonly rawFromClutches: number;
  readonly rawFromBuildPlate: number;
  readonly distinctTransforms: number;
  readonly rejectedUnsupported: number;
  /** Held up by the plate but touching no other part, so the assembly splits. */
  readonly rejectedDetached: number;
  /** Connected, but its body would be inside the build plate. */
  readonly rejectedBelowBuildPlate: number;
  readonly rejectedColliding: number;
  readonly accepted: number;
}

export interface PlacementEnumerationOptions {
  /** Defaults to every orientation the part's catalog entry allows. */
  readonly orientationIds?: readonly string[];
  /**
   * Whether to enumerate placements resting on the build plate. They are the
   * only legal placements for the first part of a build and are worthless
   * afterwards, so a search that already has an assembly usually turns them off.
   */
  readonly includeBuildPlate?: boolean;
  /**
   * Refuses to enumerate rather than silently truncating. The count is the
   * branching factor of the search, so a quietly capped count would read as a
   * tractable step that is not one.
   */
  readonly maxDistinctTransforms?: number;
  /**
   * Whether to keep a placement that rests on the build plate without touching
   * anything already built. The editor allows one — manual editing may leave a
   * document draft-invalid — but the document validator calls the result a
   * DISCONNECTED_ASSEMBLY, so a search that accepted it would be searching
   * states no build sequence can pass through. Only the first part of a build
   * is exempt, and that exemption is automatic.
   */
  readonly allowDetached?: boolean;
  /** Receives deterministic work without changing branching-factor counts. */
  readonly observeWork?: import("./enumerate-placement-work").PlacementEnumerationWorkObserver;
}

export class PlacementEnumerationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PlacementEnumerationError";
  }
}

const DEFAULT_MAX_DISTINCT_TRANSFORMS = 200_000;

export function preparePlacementEnumerationWorld(
  document: BrickDocumentV1,
): PreparedPlacementEnumerationWorld {
  return createPreparedPlacementEnumerationWorld(document);
}

/**
 * What a placement occupies, as a string two placements share exactly when they
 * are the same placement written differently.
 *
 * A 2x4 brick at yaw 0 and at yaw 180 fill the same space and cover the same
 * studs; a 1x1 brick is the same in all four. Enumeration deliberately does not
 * collapse them — it is verified complete against a brute-force lattice sweep,
 * and folding equivalence into it puts that verification at risk for an
 * optimisation. Callers that care collapse the result instead, which is what
 * the search driver does before it spends a render on a candidate.
 *
 * Keyed on the world body box and the world stud positions rather than on the
 * footprint, because a part need not be rectilinear for this to keep working.
 */
export function placementOccupancyKey(catalogPartId: string, transform: RigidTransform): string {
  const definition = getPartDefinition(catalogPartId);
  if (!definition) {
    throw new PlacementEnumerationError(
      `Cannot key an occupancy for unknown catalog part ${catalogPartId}; it is absent from the pinned catalog.`,
    );
  }
  const box = bodyBoundsLdu({ catalogPartId, transform });
  const studs = definition.connectors
    .filter((connector) => connector.kind === "stud")
    .map((connector) => transformLduPoint(transform, connector.positionLdu).join(","))
    .sort();
  return [box.min.join(","), box.max.join(","), ...studs].join("|");
}

function compareCandidates(left: PlacementCandidate, right: PlacementCandidate): number {
  const leftPosition = left.transform.positionLdu;
  const rightPosition = right.transform.positionLdu;
  return (
    leftPosition[0] - rightPosition[0] ||
    leftPosition[1] - rightPosition[1] ||
    leftPosition[2] - rightPosition[2] ||
    left.transform.orientationId.localeCompare(right.transform.orientationId)
  );
}

function connectionEdgesFor(
  parts: readonly PartInstance[],
  candidateCatalogPartId: string,
  candidateId: string,
  connections: readonly DiscoveredConnection[],
): ConnectionEdge[] {
  return connections.map((connection, index) => ({
    id: `enumeration-edge-${index}`,
    kind: protocolConnectionKindForDiscoveredConnection(parts, candidateCatalogPartId, connection),
    a: { partId: connection.targetPartId, portId: connection.targetPortId },
    b: { partId: candidateId, portId: connection.candidatePortId },
    provenance: { source: "manual" },
  }));
}

export interface PlacementEnumeration {
  readonly schemaVersion: typeof PLACEMENT_ENUMERATION_VERSION;
  readonly catalogPartId: string;
  readonly orientationIds: readonly string[];
  /** Complete taxonomy-pair seed arithmetic, independent of accepted candidates. */
  readonly connectorSeedReceipt: readonly PlacementConnectorSeedReceipt[];
  readonly candidates: readonly PlacementCandidate[];
  readonly counts: PlacementEnumerationCounts;
}

export interface PlacementTransformDiagnosis {
  readonly originSeeded: boolean;
  readonly connections: readonly DiscoveredConnection[];
  readonly restsOnBuildPlate: boolean;
  readonly belowBuildPlate: boolean;
  readonly collisionFindings: readonly {
    readonly code: string;
    readonly partIds: readonly string[];
    readonly message: string;
  }[];
  readonly unconnectedCollisionFindings: readonly {
    readonly code: string;
    readonly partIds: readonly string[];
    readonly message: string;
  }[];
}

/** Exact rejection evidence for one transform, using the same indexes and collision world. */
export function diagnosePlacementTransform(
  document: BrickDocumentV1,
  catalogPartId: string,
  transform: RigidTransform,
): PlacementTransformDiagnosis {
  const definition = getPartDefinition(catalogPartId);
  if (definition === undefined) {
    throw new PlacementEnumerationError(
      `Cannot diagnose placement for unknown catalog part ${catalogPartId}; it is absent from the pinned catalog`,
    );
  }
  if (!definition.legalOrientationIds.includes(transform.orientationId)) {
    throw new PlacementEnumerationError(
      `Cannot diagnose illegal orientation ${transform.orientationId} for ${catalogPartId}.`,
    );
  }
  const occupied = occupiedConnectorCapacityClaims(document.parts, document.connections);
  const indexes = createPlacementConnectorIndexes(document.parts, occupied, definition, [
    transform.orientationId,
  ]);
  let originSeeded = false;
  enumerateConnectorOrigins(indexes, [transform.orientationId], (origin, orientationId) => {
    if (
      orientationId === transform.orientationId &&
      origin.every((coordinate, axis) => coordinate === transform.positionLdu[axis])
    ) {
      originSeeded = true;
    }
  });
  const candidateId = "enumeration-candidate";
  const candidate: PartInstance = {
    id: candidateId,
    catalogPartId,
    colorId: definition.availableColorIds[0]!,
    transform,
    submodelId: document.submodels[0]?.id ?? "root",
    stepId: document.steps[0]?.id ?? "step-1",
    semanticTags: [],
    provenance: { source: "manual" },
  };
  const connections = discoverIndexedConnections(indexes, transform, candidateId);
  const bounds = bodyBoundsLdu(candidate);
  const supportedByBuildPlate = restsOnBuildPlate(candidate);
  const collisionWorld = createCollisionWorld(document.parts);
  const collisionFindings = collisionWorld.findCollisionsWith(
    candidate,
    connectionEdgesFor(document.parts, catalogPartId, candidateId, connections),
  );
  const unconnectedCollisionFindings =
    connections.length === 0 ? collisionFindings : collisionWorld.findCollisionsWith(candidate, []);
  const boundedFinding = ({ code, partIds, message }: (typeof collisionFindings)[number]) => ({
    code,
    partIds,
    message,
  });
  return {
    originSeeded,
    connections,
    restsOnBuildPlate: supportedByBuildPlate,
    belowBuildPlate: bounds.max[1] > GROUND_UNDERSIDE_LDU,
    collisionFindings: collisionFindings.map(boundedFinding),
    unconnectedCollisionFindings: unconnectedCollisionFindings.map(boundedFinding),
  };
}

function enumeratePlacementsInPreparedWorldInternal(
  prepared: PreparedPlacementEnumerationWorld,
  catalogPartId: string,
  options: PlacementEnumerationOptions,
  work?: MutablePlacementEnumerationWork,
): PlacementEnumeration {
  const state = requirePreparedPlacementEnumerationState(prepared);
  const { document } = state;
  const definition = getPartDefinition(catalogPartId);
  if (!definition) {
    throw new PlacementEnumerationError(
      `Cannot enumerate placements for unknown catalog part ${catalogPartId}; it is absent from the pinned catalog`,
    );
  }
  const orientationIds = options.orientationIds ?? definition.legalOrientationIds;
  for (const orientationId of orientationIds) {
    if (!definition.legalOrientationIds.includes(orientationId)) {
      throw new PlacementEnumerationError(
        `Orientation ${orientationId} is not legal for ${catalogPartId}; the catalog allows ${definition.legalOrientationIds.join(", ")}`,
      );
    }
  }
  const maxDistinctTransforms = options.maxDistinctTransforms ?? DEFAULT_MAX_DISTINCT_TRANSFORMS;

  if (work) work.occupiedCapacitySeedEdges = document.connections.length;
  if (work) work.occupiedCapacityClaims = state.occupiedCapacityClaims.size;
  const connectorIndexes = createPlacementConnectorIndexes(
    document.parts,
    state.occupiedCapacityClaims,
    definition,
    orientationIds,
    work,
    (kind, indexWork) => preparedFreePortIndex(state, kind, indexWork),
  );
  const freeStuds = connectorIndexes.freeByKind.get("stud")!;
  const freeClutches = connectorIndexes.freeByKind.get("undersideClutch")!;
  const world = preparedCollisionWorld(state, work);
  const origins = new Map<string, { origin: LduVector3; orientationId: string }>();
  let rawFromBuildPlate = 0;
  let rawProgress = { rawFromStuds: 0, rawFromClutches: 0, rawFromOtherConnectorPairs: 0 };
  const remember = (origin: LduVector3, orientationId: string, progress = rawProgress): void => {
    rawProgress = progress;
    if (work) work.originProposals += 1;
    const key = `${origin.join(",")}|${orientationId}`;
    if (!origins.has(key)) origins.set(key, { origin, orientationId });
    if (origins.size > maxDistinctTransforms) {
      const otherSeeds = rawProgress.rawFromOtherConnectorPairs;
      const otherClause =
        otherSeeds === 0 ? "" : `, ${otherSeeds} other taxonomy-compatible connector seeds`;
      throw new PlacementEnumerationError(
        `Enumerating ${catalogPartId} over ${document.parts.length} parts passed the ${maxDistinctTransforms} distinct-transform bound ` +
          `after considering ${rawProgress.rawFromStuds} axis-compatible stud seeds, ${rawProgress.rawFromClutches} axis-compatible clutch seeds${otherClause}, and ${rawFromBuildPlate} build-plate seeds ` +
          `(${freeStuds.size} total free studs and ${freeClutches.size} total free clutches across ${orientationIds.length} orientations). ` +
          `Nothing was truncated — a silently capped count would read as a tractable step that is not one. ` +
          `Raise maxDistinctTransforms deliberately, narrow orientationIds, or prune the assembly before enumerating.`,
      );
    }
  };
  const connectorOriginCounts = enumerateConnectorOrigins(
    connectorIndexes,
    orientationIds,
    remember,
    work,
  );

  if (options.includeBuildPlate ?? document.parts.length === 0) {
    for (const orientationId of orientationIds) {
      for (const origin of buildPlateOrigins(document, definition, orientationId)) {
        rawFromBuildPlate += 1;
        remember(origin, orientationId);
      }
    }
  }

  const candidates: PlacementCandidate[] = [];
  const assemblyIsEmpty = document.parts.every(
    (part) => getPartDefinition(part.catalogPartId) === undefined,
  );
  const allowDetached = options.allowDetached ?? assemblyIsEmpty;
  let rejectedUnsupported = 0;
  let rejectedDetached = 0;
  let rejectedBelowBuildPlate = 0;
  let rejectedColliding = 0;
  const candidateId = "enumeration-candidate";

  for (const { origin, orientationId } of origins.values()) {
    if (work) work.candidateTransformsVisited += 1;
    const transform: RigidTransform = { positionLdu: origin, orientationId };
    const candidate: PartInstance = {
      id: candidateId,
      catalogPartId,
      colorId: definition.availableColorIds[0]!,
      transform,
      submodelId: document.submodels[0]?.id ?? "root",
      stepId: document.steps[0]?.id ?? "step-1",
      semanticTags: [],
      provenance: { source: "manual" },
    };
    const box = bodyBoundsLdu(candidate);
    const connections = discoverIndexedConnections(connectorIndexes, transform, candidateId, work);
    const supportedByBuildPlate = restsOnBuildPlate(candidate);
    if (connections.length === 0) {
      if (!supportedByBuildPlate) rejectedUnsupported += 1;
      else if (!allowDetached) rejectedDetached += 1;
      if (!supportedByBuildPlate || !allowDetached) continue;
    }
    // Seeding from free clutches reaches under the assembly, and under the
    // assembly is sometimes under the build plate: a part whose studs enter the
    // clutches of something already resting on the plate has its own body inside
    // the plate. The kernel has no collider for the plate, so the validator
    // accepts it, but no build sequence can pass through that state — the same
    // reason a detached placement is refused above. Rejected rather than scored,
    // because a candidate the search can render is a candidate it can pick.
    if (box.max[1] > GROUND_UNDERSIDE_LDU) {
      rejectedBelowBuildPlate += 1;
      continue;
    }

    const findings = world.findCollisionsWith(
      candidate,
      connectionEdgesFor(document.parts, catalogPartId, candidateId, connections),
    );
    if (findings.length > 0) {
      rejectedColliding += 1;
      continue;
    }

    candidates.push({
      catalogPartId,
      transform,
      connections,
      restsOnBuildPlate: supportedByBuildPlate,
    });
  }

  candidates.sort((left, right) => {
    if (work) work.candidateSortComparisons += 1;
    return compareCandidates(left, right);
  });
  options.observeWork?.(Object.freeze({ ...work! }));
  return {
    schemaVersion: PLACEMENT_ENUMERATION_VERSION,
    catalogPartId,
    orientationIds,
    connectorSeedReceipt: connectorOriginCounts.seedReceipt,
    candidates,
    counts: {
      freeStuds: freeStuds.size,
      freeClutches: freeClutches.size,
      rawFromStuds: connectorOriginCounts.rawFromStuds,
      rawFromClutches: connectorOriginCounts.rawFromClutches,
      rawFromBuildPlate,
      distinctTransforms: origins.size,
      rejectedUnsupported,
      rejectedDetached,
      rejectedBelowBuildPlate,
      rejectedColliding,
      accepted: candidates.length,
    },
  };
}

export function enumeratePlacementsInPreparedWorld(
  prepared: PreparedPlacementEnumerationWorld,
  catalogPartId: string,
  options: PlacementEnumerationOptions = {},
): PlacementEnumeration {
  if (options.observeWork !== undefined) {
    throw new PlacementEnumerationError(
      "enumeratePlacementsInPreparedWorld does not accept observeWork because reusable cache history would make accounting order-dependent; call fresh enumeratePlacements(document, ...) for deterministic work measurement.",
    );
  }
  const work = options.observeWork ? emptyPlacementEnumerationWork() : undefined;
  return enumeratePlacementsInPreparedWorldInternal(prepared, catalogPartId, options, work);
}

export function enumeratePlacements(
  document: BrickDocumentV1,
  catalogPartId: string,
  options: PlacementEnumerationOptions = {},
): PlacementEnumeration {
  const work = options.observeWork ? emptyPlacementEnumerationWork() : undefined;
  return enumeratePlacementsInPreparedWorldInternal(
    createPreparedPlacementEnumerationWorld(document, work),
    catalogPartId,
    options,
    work,
  );
}
