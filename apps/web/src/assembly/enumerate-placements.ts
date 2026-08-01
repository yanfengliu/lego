import {
  STUD_PITCH_LDU,
  getPartDefinition,
  type LduVector3,
  type PartDefinition,
} from "@lego-studio/catalog";
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
  endpointKey,
  worldFootprint,
  type DiscoveredConnection,
} from "../placement";

/**
 * Every legal place one part could go on the current assembly.
 *
 * This is the branching factor of the whole closed-loop search, so it is
 * enumerated from connections rather than swept over a lattice: a placement is
 * legal almost always because some of the part's underside clutches land on
 * studs that are free, and there are far fewer free studs than lattice cells.
 * Solving `origin = stud - rotate(clutch)` turns each (free stud, clutch,
 * orientation) triple straight into an exact integer origin.
 *
 * Nothing here re-implements the rules. Support comes from the same predicate
 * the editor refuses placements with, and collisions are adjudicated by the
 * kernel's own `findCatalogCollisions` over the candidate and its neighbours,
 * so a candidate this accepts is one the document validator accepts. The tests
 * assert both directions of that against brute force.
 */
export const PLACEMENT_ENUMERATION_VERSION = "lego.placement-enumeration/1" as const;

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
  /** (free stud x clutch x orientation) triples, before deduplication. */
  readonly rawFromStuds: number;
  readonly rawFromBuildPlate: number;
  readonly distinctTransforms: number;
  readonly rejectedUnsupported: number;
  /** Held up by the plate but touching no other part, so the assembly splits. */
  readonly rejectedDetached: number;
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

function positionKey(position: LduVector3): string {
  return `${position[0]},${position[1]},${position[2]}`;
}

interface PortIndexEntry {
  readonly partId: string;
  readonly portId: string;
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
      if (occupied.has(endpointKey(part.id, connector.id))) continue;
      const key = positionKey(transformLduPoint(part.transform, connector.positionLdu));
      // Two free ports of the same kind at one point means the assembly is
      // already invalid there; keep the first so enumeration stays a pure
      // function of the document rather than of iteration order.
      if (!index.has(key)) index.set(key, { partId: part.id, portId: connector.id });
    }
  }
  return index;
}

interface RotatedPorts {
  readonly clutches: readonly RotatedPort[];
  readonly studs: readonly RotatedPort[];
}

interface RotatedPort {
  readonly portId: string;
  readonly offset: LduVector3;
}

/** Local port offsets once an orientation is applied, with no translation. */
function rotatedPorts(
  definition: PartDefinition,
  orientationId: string,
  kind: "stud" | "undersideClutch",
): readonly RotatedPort[] {
  const rotation: RigidTransform = { positionLdu: [0, 0, 0], orientationId };
  return definition.connectors
    .filter((connector) => connector.kind === kind)
    .map((connector) => ({
      portId: connector.id,
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

  const occupied = new Set<string>();
  for (const connection of document.connections) {
    occupied.add(endpointKey(connection.a.partId, connection.a.portId));
    occupied.add(endpointKey(connection.b.partId, connection.b.portId));
  }
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
  let rawFromBuildPlate = 0;

  const remember = (origin: LduVector3, orientationId: string): void => {
    const key = `${positionKey(origin)}|${orientationId}`;
    if (!origins.has(key)) origins.set(key, { origin, orientationId });
    if (origins.size > maxDistinctTransforms) {
      throw new PlacementEnumerationError(
        `Enumerating ${catalogPartId} over ${document.parts.length} parts passed the ${maxDistinctTransforms} distinct-transform bound ` +
          `(${freeStuds.size} free studs x ${definition.connectors.filter((c) => c.kind === "undersideClutch").length} clutches x ${orientationIds.length} orientations). ` +
          `Nothing was truncated — a silently capped count would read as a tractable step that is not one. ` +
          `Raise maxDistinctTransforms deliberately, narrow orientationIds, or prune the assembly before enumerating.`,
      );
    }
  };

  for (const orientationId of orientationIds) {
    const clutchOffsets = portsByOrientation.get(orientationId)!.clutches;
    for (const studPosition of freeStuds.keys()) {
      const [x, y, z] = studPosition.split(",").map(Number) as [number, number, number];
      for (const clutch of clutchOffsets) {
        rawFromStuds += 1;
        remember([x - clutch.offset[0], y - clutch.offset[1], z - clutch.offset[2]], orientationId);
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
    const connections = discoverConnections(
      portsByOrientation.get(orientationId)!,
      transform,
      candidateId,
      freeStuds,
      freeClutches,
    );
    const restsOnBuildPlate = bodyBoundsLdu(candidate).max[1] === GROUND_UNDERSIDE_LDU;
    if (connections.length === 0) {
      if (!restsOnBuildPlate) rejectedUnsupported += 1;
      else if (!allowDetached) rejectedDetached += 1;
      if (!restsOnBuildPlate || !allowDetached) continue;
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
      rawFromStuds,
      rawFromBuildPlate,
      distinctTransforms: origins.size,
      rejectedUnsupported,
      rejectedDetached,
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
  const usedCandidatePorts = new Set<string>();
  const usedTargets = new Set<string>();

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
      const targetKey = endpointKey(target.partId, target.portId);
      if (usedCandidatePorts.has(port.portId) || usedTargets.has(targetKey)) continue;
      usedCandidatePorts.add(port.portId);
      usedTargets.add(targetKey);
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

/**
 * Lattice positions where the part would rest on the build plate, bounded by
 * the assembly's own footprint plus one part's reach. The plate is unbounded,
 * so without that bound this is not an enumeration at all.
 */
function buildPlateOrigins(
  document: BrickDocumentV1,
  definition: PartDefinition,
  orientationId: string,
): readonly LduVector3[] {
  const y = GROUND_UNDERSIDE_LDU - definition.dimensions.heightLdu / 2;
  const placed = document.parts.filter((part) => getPartDefinition(part.catalogPartId));
  if (placed.length === 0) return [[0, y, 0]];

  const boxes = placed.map((part) => bodyBoundsLdu(part));
  const reach = Math.max(definition.dimensions.widthLdu, definition.dimensions.lengthLdu);
  const minX = Math.min(...boxes.map((box) => box.min[0])) - reach;
  const maxX = Math.max(...boxes.map((box) => box.max[0])) + reach;
  const minZ = Math.min(...boxes.map((box) => box.min[2])) - reach;
  const maxZ = Math.max(...boxes.map((box) => box.max[2])) + reach;

  // A part's origin sits on the stud lattice, offset by half a pitch when its
  // footprint has an odd number of studs in that axis — the same rule the
  // editor's own lateral snap applies.
  const footprint = worldFootprint(definition, orientationId);
  const origins: LduVector3[] = [];
  for (let x = alignedStart(minX, footprint.studsX); x <= maxX; x += STUD_PITCH_LDU) {
    for (let z = alignedStart(minZ, footprint.studsZ); z <= maxZ; z += STUD_PITCH_LDU) {
      origins.push([x, y, z]);
    }
  }
  return origins;
}

/** First lattice origin at or above `from` for a footprint this many studs wide. */
function alignedStart(from: number, studs: number): number {
  const offset = studs % 2 === 0 ? 0 : STUD_PITCH_LDU / 2;
  return Math.ceil((from - offset) / STUD_PITCH_LDU) * STUD_PITCH_LDU + offset;
}
