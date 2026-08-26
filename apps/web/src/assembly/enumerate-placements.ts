import { getPartDefinition, type LduVector3, type PartDefinition } from "@lego-studio/catalog";
import {
  createCollisionWorld,
  getUprightOrientation,
  rotateLduVector,
  transformLduPoint,
} from "@lego-studio/brick-kernel";
import type {
  BrickDocumentV1,
  ConnectionEdge,
  PartInstance,
  RigidTransform,
} from "@lego-studio/protocol";

import { GROUND_UNDERSIDE_LDU, bodyBoundsLdu, type DiscoveredConnection } from "../placement";
import {
  capacityEndpointForConnector,
  connectorCapacityIsFree,
  occupiedConnectorCapacityClaims,
  reserveConnectorCapacity,
  type ConnectorCapacityEndpoint,
} from "../connector-capacity";
import { connectorAxesAlign } from "../connector-frame-alignment";
import { buildPlateOrigins } from "./build-plate-origins";

/**
 * Every legal place one part could go on the current assembly.
 *
 * This is the branching factor of the whole closed-loop search, so it is
 * enumerated from connections rather than swept over a lattice: a placement is
 * legal because some of its ports meet a free port of the assembly, and there
 * are far fewer free ports than lattice cells. Solving `origin = port -
 * rotate(port)` turns each (free port, candidate port, orientation) triple
 * straight into an exact integer origin.
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
export const PLACEMENT_ENUMERATION_VERSION = "lego.placement-enumeration/2" as const;

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
}

export class PlacementEnumerationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PlacementEnumerationError";
  }
}

const DEFAULT_MAX_DISTINCT_TRANSFORMS = 200_000;

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

function positionKey(position: LduVector3): string {
  return `${position[0]},${position[1]},${position[2]}`;
}

interface PortIndexEntry extends ConnectorCapacityEndpoint {
  readonly kind: "stud" | "undersideClutch";
  readonly normal: LduVector3;
}

/**
 * Where every unused stud and clutch in the assembly is, keyed by exact
 * position. Connection discovery is an integer lattice lookup because
 * orientations are quarter turns and every catalog position is an integer, so
 * two ports meet only when their coordinates are equal.
 */
function indexFreePorts(
  parts: readonly PartInstance[],
  occupied: ReadonlySet<string>,
  kind: "stud" | "undersideClutch",
): Map<string, PortIndexEntry> {
  const index = new Map<string, PortIndexEntry>();
  for (const part of parts) {
    const definition = getPartDefinition(part.catalogPartId);
    if (!definition) continue;
    for (const connector of definition.connectors) {
      if (connector.kind !== kind) continue;
      const capacityEndpoint = capacityEndpointForConnector(part.id, connector);
      if (!connectorCapacityIsFree(capacityEndpoint, occupied)) continue;
      const key = positionKey(transformLduPoint(part.transform, connector.positionLdu));
      const orientation = getUprightOrientation(part.transform.orientationId);
      const normal = rotateLduVector(orientation.matrix, connector.normal);
      // Two free ports of the same kind at one point means the assembly is
      // already invalid there; keep the first so enumeration stays a pure
      // function of the document rather than of iteration order.
      if (!index.has(key)) {
        index.set(key, { ...capacityEndpoint, kind: connector.kind, normal });
      }
    }
  }
  return index;
}

interface RotatedPorts {
  readonly clutches: readonly RotatedPort[];
  readonly studs: readonly RotatedPort[];
}

interface RotatedPort extends ConnectorCapacityEndpoint {
  readonly kind: "stud" | "undersideClutch";
  readonly normal: LduVector3;
  readonly offset: LduVector3;
}

/** Local port offsets once an orientation is applied, with no translation. */
function rotatedPorts(
  definition: PartDefinition,
  orientationId: string,
  kind: "stud" | "undersideClutch",
): readonly RotatedPort[] {
  const rotation: RigidTransform = { positionLdu: [0, 0, 0], orientationId };
  const orientation = getUprightOrientation(orientationId);
  return definition.connectors
    .filter((connector) => connector.kind === kind)
    .map((connector) => ({
      ...capacityEndpointForConnector("enumeration-candidate", connector),
      kind,
      normal: rotateLduVector(orientation.matrix, connector.normal),
      offset: transformLduPoint(rotation, connector.positionLdu),
    }));
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
  candidateId: string,
  connections: readonly DiscoveredConnection[],
): ConnectionEdge[] {
  return connections.map((connection, index) => ({
    id: `enumeration-edge-${index}`,
    kind: "stud-tube",
    a: { partId: connection.targetPartId, portId: connection.targetPortId },
    b: { partId: candidateId, portId: connection.candidatePortId },
    provenance: { source: "manual" },
  }));
}

export interface PlacementEnumeration {
  readonly schemaVersion: typeof PLACEMENT_ENUMERATION_VERSION;
  readonly catalogPartId: string;
  readonly orientationIds: readonly string[];
  readonly candidates: readonly PlacementCandidate[];
  readonly counts: PlacementEnumerationCounts;
}

export function enumeratePlacements(
  document: BrickDocumentV1,
  catalogPartId: string,
  options: PlacementEnumerationOptions = {},
): PlacementEnumeration {
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

  const occupied = occupiedConnectorCapacityClaims(document.parts, document.connections);
  const freeStuds = indexFreePorts(document.parts, occupied, "stud");
  const freeClutches = indexFreePorts(document.parts, occupied, "undersideClutch");
  // Built once for the whole enumeration. Rebuilding the neighbourhood per
  // candidate is what made this quadratic in assembly size.
  const world = createCollisionWorld(document.parts);
  const portsByOrientation = new Map(
    orientationIds.map((orientationId) => [
      orientationId,
      {
        clutches: rotatedPorts(definition, orientationId, "undersideClutch"),
        studs: rotatedPorts(definition, orientationId, "stud"),
      },
    ]),
  );

  const origins = new Map<string, { origin: LduVector3; orientationId: string }>();
  let rawFromStuds = 0;
  let rawFromClutches = 0;
  let rawFromBuildPlate = 0;
  const remember = (origin: LduVector3, orientationId: string): void => {
    const key = `${positionKey(origin)}|${orientationId}`;
    if (!origins.has(key)) origins.set(key, { origin, orientationId });
    if (origins.size > maxDistinctTransforms) {
      throw new PlacementEnumerationError(
        `Enumerating ${catalogPartId} over ${document.parts.length} parts passed the ${maxDistinctTransforms} distinct-transform bound ` +
          `after considering ${rawFromStuds} axis-compatible stud seeds, ${rawFromClutches} axis-compatible clutch seeds, and ${rawFromBuildPlate} build-plate seeds ` +
          `(${freeStuds.size} total free studs and ${freeClutches.size} total free clutches across ${orientationIds.length} orientations). ` +
          `Nothing was truncated — a silently capped count would read as a tractable step that is not one. ` +
          `Raise maxDistinctTransforms deliberately, narrow orientationIds, or prune the assembly before enumerating.`,
      );
    }
  };

  for (const orientationId of orientationIds) {
    const ports = portsByOrientation.get(orientationId)!;
    // The candidate goes on top: its clutches land on free studs.
    for (const [studPosition, stud] of freeStuds) {
      const [x, y, z] = studPosition.split(",").map(Number) as [number, number, number];
      for (const clutch of ports.clutches) {
        if (!connectorAxesAlign(stud, clutch)) continue;
        rawFromStuds += 1;
        remember([x - clutch.offset[0], y - clutch.offset[1], z - clutch.offset[2]], orientationId);
      }
    }
    // The candidate goes underneath: its studs land on free clutches. The two
    // sets are disjoint in general — a seat under the assembly is not a seat on
    // it — so this is reachability, not a duplicate spelling of the loop above.
    for (const [clutchPosition, clutch] of freeClutches) {
      const [x, y, z] = clutchPosition.split(",").map(Number) as [number, number, number];
      for (const stud of ports.studs) {
        if (!connectorAxesAlign(clutch, stud)) continue;
        rawFromClutches += 1;
        remember([x - stud.offset[0], y - stud.offset[1], z - stud.offset[2]], orientationId);
      }
    }
  }

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
    const ports = portsByOrientation.get(orientationId)!;
    const box = bodyBoundsLdu(candidate);
    const connections = discoverConnections(ports, transform, candidateId, freeStuds, freeClutches);
    const restsOnBuildPlate = box.max[1] === GROUND_UNDERSIDE_LDU;
    if (connections.length === 0) {
      if (!restsOnBuildPlate) rejectedUnsupported += 1;
      else if (!allowDetached) rejectedDetached += 1;
      if (!restsOnBuildPlate || !allowDetached) continue;
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
      connectionEdgesFor(candidateId, connections),
    );
    if (findings.length > 0) {
      rejectedColliding += 1;
      continue;
    }

    candidates.push({ catalogPartId, transform, connections, restsOnBuildPlate });
  }

  candidates.sort(compareCandidates);
  return {
    schemaVersion: PLACEMENT_ENUMERATION_VERSION,
    catalogPartId,
    orientationIds,
    candidates,
    counts: {
      freeStuds: freeStuds.size,
      freeClutches: freeClutches.size,
      rawFromStuds,
      rawFromClutches,
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

/**
 * The same pairs `findStudConnections` finds, by lattice lookup instead of a
 * scan over every part. Kept in that function's sort order so a candidate can
 * be handed straight to the placement command path.
 */
function discoverConnections(
  ports: RotatedPorts,
  transform: RigidTransform,
  candidateId: string,
  freeStuds: ReadonlyMap<string, PortIndexEntry>,
  freeClutches: ReadonlyMap<string, PortIndexEntry>,
): readonly DiscoveredConnection[] {
  const discovered: DiscoveredConnection[] = [];
  const reservedCapacityClaims = new Set<string>();

  for (const [offsets, index] of [
    [ports.clutches, freeStuds],
    [ports.studs, freeClutches],
  ] as const) {
    for (const port of offsets) {
      const world: LduVector3 = [
        port.offset[0] + transform.positionLdu[0],
        port.offset[1] + transform.positionLdu[1],
        port.offset[2] + transform.positionLdu[2],
      ];
      const target = index.get(positionKey(world));
      if (!target || target.partId === candidateId) continue;
      if (!connectorAxesAlign(port, target)) continue;
      if (!reserveConnectorCapacity([port, target], reservedCapacityClaims)) continue;
      discovered.push({
        targetPartId: target.partId,
        targetPortId: target.portId,
        candidatePortId: port.portId,
      });
    }
  }

  return discovered.sort(
    (left, right) =>
      left.targetPartId.localeCompare(right.targetPartId) ||
      left.targetPortId.localeCompare(right.targetPortId) ||
      left.candidatePortId.localeCompare(right.candidatePortId),
  );
}
