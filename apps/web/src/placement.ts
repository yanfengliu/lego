import {
  BRICK_HEIGHT_LDU,
  STUD_PITCH_LDU,
  connectorAccepts,
  getPartDefinition,
  type ConnectorKind,
  type LduVector3,
  type PartDefinition,
} from "@lego-studio/catalog";
import {
  getProperOrientation,
  rotateLduVector,
  transformLduPoint,
} from "@lego-studio/brick-kernel";
import type { PartInstance, RigidTransform } from "@lego-studio/protocol";

import { connectorAxesAlign } from "./connector-frame-alignment";
import {
  capacityClaimsForEndpoint,
  capacityEndpointForConnector,
  connectorCapacityIsFree,
  reserveConnectorCapacity,
  type ConnectorCapacityEndpoint,
} from "./connector-capacity";
import {
  nextLegalOrientationId,
  PlacementError,
  placementOrientationIdForCatalogSelection,
  worldFootprint,
  type WorldFootprint,
} from "./placement-orientation";
import { LATERAL_SNAP_LDU, type LduBox } from "./placement-types";

export {
  nextLegalOrientationId,
  PlacementError,
  placementOrientationIdForCatalogSelection,
  worldFootprint,
  type WorldFootprint,
};
export { LATERAL_SNAP_LDU, type LduBox };

/**
 * Placement lattice, in canonical -Y-up LDU.
 *
 * The build plate's top surface sits at +BRICK_HEIGHT_LDU / 2 so that a brick
 * dropped on empty plate rests exactly where "Place at origin" has always put
 * it. Resting *surfaces* are what live on the PLATE_HEIGHT_LDU lattice — the
 * plate, then a plate's height at a time above it. Upright parts usually place
 * their origin half their nominal height from that surface; a reviewed proper
 * turn instead uses the transformed body's actual extremum, including measured
 * half-LDU bounds that cannot themselves become a canonical integer origin.
 */
export const GROUND_UNDERSIDE_LDU = BRICK_HEIGHT_LDU / 2;

function requireDefinition(catalogPartId: string): PartDefinition {
  const definition = getPartDefinition(catalogPartId);
  if (!definition) {
    throw new PlacementError(
      `Cannot place unknown catalog part ${catalogPartId}; it is absent from the pinned catalog`,
    );
  }
  return definition;
}

/**
 * Stud centres live on the half-stud offset lattice (20n + 10). Most parts'
 * origin residue follows footprint parity; an asymmetric source frame can
 * declare another connector-grid centre, and `worldFootprint` carries its
 * rotated residue here without silently recentering the part.
 */
function snapLateral(raw: number, offset: number): number {
  return Math.round((raw - offset) / STUD_PITCH_LDU) * STUD_PITCH_LDU + offset;
}

/** World Y of a placed part's actual top body surface. */
export function partTopSurfaceLdu(part: Pick<PartInstance, "catalogPartId" | "transform">): number {
  return bodyBoundsLdu(part).min[1];
}

export interface SnapPlacementOptions {
  readonly catalogPartId: string;
  readonly orientationId: string;
  /** Unsnapped cursor position in canonical LDU. */
  readonly rawLdu: LduVector3;
  /** World Y the part's underside should rest on; defaults to the build plate. */
  readonly supportUndersideLdu?: number;
}

export interface DefinitionSnapPlacementOptions {
  readonly definition: PartDefinition;
  readonly orientationId: string;
  /** Unsnapped cursor position in canonical LDU. */
  readonly rawLdu: LduVector3;
  /** World Y the part's underside should rest on; defaults to the build plate. */
  readonly supportUndersideLdu?: number;
}

/** Core snap operation for an already resolved catalog definition. */
export function snapPlacementOriginForDefinition({
  definition,
  orientationId,
  rawLdu,
  supportUndersideLdu = GROUND_UNDERSIDE_LDU,
}: DefinitionSnapPlacementOptions): LduVector3 {
  if (!rawLdu.every((coordinate) => Number.isFinite(coordinate))) {
    throw new PlacementError(
      `Placement needs a finite LDU position, received [${rawLdu.join(", ")}]`,
    );
  }
  if (!Number.isFinite(supportUndersideLdu)) {
    throw new PlacementError(
      `Placement needs a finite support surface, received ${supportUndersideLdu}`,
    );
  }
  const footprint = worldFootprint(definition, orientationId);
  return [
    snapLateral(rawLdu[0], footprint.originOffsetX),
    // Canonical transforms require whole LDU. If exact geometry has a
    // half-LDU underside (4519 does when stood vertically), floor the origin:
    // the body keeps a sub-LDU clearance instead of penetrating its support.
    Math.floor(supportUndersideLdu - footprint.undersideOffsetLdu),
    snapLateral(rawLdu[2], footprint.originOffsetZ),
  ];
}

/**
 * Resolves a raw pointer position to the nearest legal origin for a part. The
 * result is always integral and lattice-aligned, so it is directly
 * representable in the canonical document.
 */
export function snapPlacementOrigin({
  catalogPartId,
  orientationId,
  rawLdu,
  supportUndersideLdu = GROUND_UNDERSIDE_LDU,
}: SnapPlacementOptions): LduVector3 {
  if (!rawLdu.every((coordinate) => Number.isFinite(coordinate))) {
    throw new PlacementError(
      `Placement needs a finite LDU position, received [${rawLdu.join(", ")}]`,
    );
  }
  const definition = requireDefinition(catalogPartId);
  return snapPlacementOriginForDefinition({
    definition,
    orientationId,
    rawLdu,
    supportUndersideLdu,
  });
}

/** World-space AABB of a part's solid body, excluding its studs. */
export function bodyBoundsLdu(part: Pick<PartInstance, "catalogPartId" | "transform">): LduBox {
  const definition = requireDefinition(part.catalogPartId);
  const { min, max } = definition.bodyBoundsLdu;
  const corners: LduVector3[] = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        corners.push(transformLduPoint(part.transform, [x, y, z]));
      }
    }
  }
  return {
    min: [
      Math.min(...corners.map(([x]) => x)),
      Math.min(...corners.map(([, y]) => y)),
      Math.min(...corners.map(([, , z]) => z)),
    ],
    max: [
      Math.max(...corners.map(([x]) => x)),
      Math.max(...corners.map(([, y]) => y)),
      Math.max(...corners.map(([, , z]) => z)),
    ],
  };
}

function boxesOverlap(left: LduBox, right: LduBox): boolean {
  return [0, 1, 2].every(
    (axis) => left.min[axis]! < right.max[axis]! && right.min[axis]! < left.max[axis]!,
  );
}

/**
 * Part IDs whose bodies would interpenetrate the candidate. This is the cheap
 * affordance the drag ghost colours itself with; the authoritative collision
 * verdict still comes from the kernel validators once an edit is applied.
 */
export function findBodyOverlaps(
  candidate: Pick<PartInstance, "catalogPartId" | "transform">,
  parts: readonly PartInstance[],
  ignorePartIds: readonly string[] = [],
): readonly string[] {
  const ignored = new Set(ignorePartIds);
  const candidateBounds = bodyBoundsLdu(candidate);
  return parts
    .filter((part) => !ignored.has(part.id) && getPartDefinition(part.catalogPartId) !== undefined)
    .filter((part) => boxesOverlap(candidateBounds, bodyBoundsLdu(part)))
    .map(({ id }) => id)
    .sort();
}

export interface DiscoveredConnection {
  readonly targetPartId: string;
  readonly targetPortId: string;
  readonly candidatePortId: string;
}

/** Matches the kernel's endpoint key so occupancy sets can be shared verbatim. */
export function endpointKey(partId: string, portId: string): string {
  return capacityClaimsForEndpoint({ partId, portId, sharedCapacityGroupIds: [] })[0]!;
}

type PlacementConnectorFrame = ConnectorCapacityEndpoint & {
  readonly kind: ConnectorKind;
  readonly normal: LduVector3;
  readonly position: LduVector3;
};

function connectorFrames(
  part: Pick<PartInstance, "id" | "catalogPartId" | "transform">,
  kind: ConnectorKind,
): readonly PlacementConnectorFrame[] {
  const definition = requireDefinition(part.catalogPartId);
  if (!definition.legalOrientationIds.includes(part.transform.orientationId)) {
    throw new PlacementError(
      `Cannot discover connectors for ${part.id} (${part.catalogPartId}) at illegal orientation ${part.transform.orientationId}; the catalog allows ${definition.legalOrientationIds.join(", ")}`,
    );
  }
  const orientation = getProperOrientation(part.transform.orientationId);
  return definition.connectors
    .filter((connector) => connector.kind === kind)
    .map((connector) => ({
      ...capacityEndpointForConnector(part.id, connector),
      kind: connector.kind,
      normal: rotateLduVector(orientation.matrix, connector.normal),
      position: transformLduPoint(part.transform, connector.positionLdu),
    }));
}

function samePosition(left: LduVector3, right: LduVector3): boolean {
  return left.every((coordinate, axis) => coordinate === right[axis]);
}

/**
 * Every compatible pair the candidate lands exactly on, in deterministic
 * order. Ports already occupied by an existing connection are skipped so a
 * placement never proposes an over-capacity edge.
 */
export function findStudConnections(
  candidate: Pick<PartInstance, "id" | "catalogPartId" | "transform">,
  parts: readonly PartInstance[],
  occupiedCapacityClaims: ReadonlySet<string> = new Set(),
): readonly DiscoveredConnection[] {
  // Every pairing the taxonomy allows, not only studs and clutches. An axle
  // held in a bearing is as attached as a brick pressed onto studs, and a rule
  // that only knew about studs called the whole running gear of a cart
  // unsupported.
  const candidatePortsByKind = new Map(
    (getPartDefinition(candidate.catalogPartId)?.connectors ?? []).map(
      (connector) => [connector.kind, connectorFrames(candidate, connector.kind)] as const,
    ),
  );
  const discovered: DiscoveredConnection[] = [];
  const reservedCapacityClaims = new Set<string>(occupiedCapacityClaims);

  for (const part of [...parts].sort((left, right) => (left.id < right.id ? -1 : 1))) {
    if (part.id === candidate.id || !getPartDefinition(part.catalogPartId)) continue;

    const pairings = [...candidatePortsByKind].flatMap(([kind, ports]) =>
      connectorAccepts(kind).map((targetKind) => [ports, targetKind] as const),
    );
    for (const [candidatePorts, targetKind] of pairings) {
      for (const target of connectorFrames(part, targetKind)) {
        if (!connectorCapacityIsFree(target, reservedCapacityClaims)) continue;
        const match = candidatePorts.find(
          (candidatePort) =>
            connectorCapacityIsFree(candidatePort, reservedCapacityClaims) &&
            samePosition(candidatePort.position, target.position) &&
            connectorAxesAlign(candidatePort, target),
        );
        if (!match) continue;
        if (!reserveConnectorCapacity([target, match], reservedCapacityClaims)) continue;
        discovered.push({
          targetPartId: part.id,
          targetPortId: target.portId,
          candidatePortId: match.portId,
        });
      }
    }
  }

  return discovered.sort(
    (left, right) =>
      left.targetPartId.localeCompare(right.targetPartId) ||
      left.targetPortId.localeCompare(right.targetPortId) ||
      left.candidatePortId.localeCompare(right.candidatePortId),
  );
}

export type SupportVerdict =
  | { readonly supported: true; readonly held: "build-plate" | "connections" }
  | { readonly supported: false; readonly reason: string };

/** World Y of a part's underside, which is where it would rest on something. */
export function partUndersideLdu(part: Pick<PartInstance, "catalogPartId" | "transform">): number {
  return bodyBoundsLdu(part).max[1];
}

/** Whether this transform uses the part's exact safe vertical build-plate snap. */
export function restsOnBuildPlate(
  candidate: Pick<PartInstance, "catalogPartId" | "transform">,
): boolean {
  const definition = requireDefinition(candidate.catalogPartId);
  const plateClearanceLdu = GROUND_UNDERSIDE_LDU - partUndersideLdu(candidate);
  const snappedGroundY = snapPlacementOriginForDefinition({
    definition,
    orientationId: candidate.transform.orientationId,
    rawLdu: candidate.transform.positionLdu,
  })[1];
  return (
    plateClearanceLdu >= 0 &&
    plateClearanceLdu < 1 &&
    candidate.transform.positionLdu[1] === snappedGroundY
  );
}

/**
 * Whether a placement would actually stay put. A brick is held either by the
 * build plate underneath it or by at least one stud/clutch pair — the same
 * connections the kernel validates. Anything else is floating, and a floating
 * brick falls, so the editor refuses it rather than writing a document that
 * only looks buildable.
 *
 * Studs engaging a part *above* count too: pushing a brick up under an overhang
 * is held by clutch friction exactly as a brick pressed down onto studs is.
 */
export function assessSupport(
  candidate: Pick<PartInstance, "id" | "catalogPartId" | "transform">,
  connections: readonly DiscoveredConnection[],
): SupportVerdict {
  if (connections.length > 0) return { supported: true, held: "connections" };
  const definition = requireDefinition(candidate.catalogPartId);
  const plateClearanceLdu = GROUND_UNDERSIDE_LDU - partUndersideLdu(candidate);
  // A signed-permutation turn can put a measured half-LDU body extremum on Y,
  // while canonical transforms remain whole-LDU. Placement floors that origin
  // to preserve the plate, so accept its deliberate sub-LDU clearance only.
  if (restsOnBuildPlate(candidate)) {
    return { supported: true, held: "build-plate" };
  }
  const heightAbovePlate = plateClearanceLdu;
  return {
    supported: false,
    reason:
      `${definition.displayName} would rest ${heightAbovePlate} LDU above the build plate with nothing under it. ` +
      `Place it on the plate, or line it up so at least one stud meets a tube.`,
  };
}

export function createPlacementTransform(
  positionLdu: LduVector3,
  orientationId: string,
): RigidTransform {
  return { positionLdu, orientationId };
}
