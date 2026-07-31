import {
  BRICK_HEIGHT_LDU,
  PLATE_HEIGHT_LDU,
  STUD_PITCH_LDU,
  getPartDefinition,
  type LduVector3,
  type PartDefinition,
} from "@lego-studio/catalog";
import { getUprightOrientation, transformLduPoint } from "@lego-studio/brick-kernel";
import type { PartInstance, RigidTransform } from "@lego-studio/protocol";

/**
 * Placement lattice, in canonical -Y-up LDU.
 *
 * The build plate's top surface sits at +BRICK_HEIGHT_LDU / 2 so that a brick
 * dropped on empty plate rests exactly where "Place at origin" has always put
 * it. That choice makes every resting origin land on the PLATE_HEIGHT_LDU
 * lattice: a brick resolves to y=0 and a plate to y=8, and every stack built on
 * top of either stays on the same lattice.
 */
export const GROUND_UNDERSIDE_LDU = BRICK_HEIGHT_LDU / 2;
export const VERTICAL_SNAP_LDU = PLATE_HEIGHT_LDU;
export const LATERAL_SNAP_LDU = STUD_PITCH_LDU / 2;

export interface WorldFootprint {
  /** Stud columns along world X after the part's yaw is applied. */
  readonly studsX: number;
  /** Stud columns along world Z after the part's yaw is applied. */
  readonly studsZ: number;
  readonly heightLdu: number;
}

export interface LduBox {
  readonly min: LduVector3;
  readonly max: LduVector3;
}

export class PlacementError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PlacementError";
  }
}

function requireDefinition(catalogPartId: string): PartDefinition {
  const definition = getPartDefinition(catalogPartId);
  if (!definition) {
    throw new PlacementError(
      `Cannot place unknown catalog part ${catalogPartId}; it is absent from the pinned catalog`,
    );
  }
  return definition;
}

/** A quarter or three-quarter yaw exchanges the part's stud axes in world space. */
export function worldFootprint(definition: PartDefinition, orientationId: string): WorldFootprint {
  const { quarterTurns } = getUprightOrientation(orientationId);
  const swapped = quarterTurns % 2 === 1;
  const { widthStuds, lengthStuds, heightLdu } = definition.dimensions;
  return {
    studsX: swapped ? lengthStuds : widthStuds,
    studsZ: swapped ? widthStuds : lengthStuds,
    heightLdu,
  };
}

/**
 * Stud centres live on the half-stud offset lattice (20n + 10), so an even
 * footprint centres on a grid line and an odd one centres inside a cell. This
 * keeps every free placement stud-aligned with everything already on the plate.
 */
function snapLateral(raw: number, studs: number): number {
  const offset = studs % 2 === 0 ? 0 : LATERAL_SNAP_LDU;
  return Math.round((raw - offset) / STUD_PITCH_LDU) * STUD_PITCH_LDU + offset;
}

function snapVertical(raw: number): number {
  return Math.round(raw / VERTICAL_SNAP_LDU) * VERTICAL_SNAP_LDU;
}

/** World Y of the surface a part's underside rests on, given its origin. */
export function partTopSurfaceLdu(definition: PartDefinition, originY: number): number {
  return originY - definition.dimensions.heightLdu / 2;
}

export interface SnapPlacementOptions {
  readonly catalogPartId: string;
  readonly orientationId: string;
  /** Unsnapped cursor position in canonical LDU. */
  readonly rawLdu: LduVector3;
  /** World Y the part's underside should rest on; defaults to the build plate. */
  readonly supportUndersideLdu?: number;
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
  const footprint = worldFootprint(definition, orientationId);
  return [
    snapLateral(rawLdu[0], footprint.studsX),
    snapVertical(supportUndersideLdu - footprint.heightLdu / 2),
    snapLateral(rawLdu[2], footprint.studsZ),
  ];
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
  return `${partId}\u0000${portId}`;
}

function connectorFrames(
  part: Pick<PartInstance, "id" | "catalogPartId" | "transform">,
  kind: "stud" | "undersideClutch",
): readonly { readonly portId: string; readonly position: LduVector3 }[] {
  const definition = requireDefinition(part.catalogPartId);
  return definition.connectors
    .filter((connector) => connector.kind === kind)
    .map((connector) => ({
      portId: connector.id,
      position: transformLduPoint(part.transform, connector.positionLdu),
    }));
}

function samePosition(left: LduVector3, right: LduVector3): boolean {
  return left.every((coordinate, axis) => coordinate === right[axis]);
}

/**
 * Every stud/clutch pair the candidate lands exactly on, in deterministic
 * order. Ports already occupied by an existing connection are skipped so a
 * placement never proposes an over-capacity edge.
 */
export function findStudConnections(
  candidate: Pick<PartInstance, "id" | "catalogPartId" | "transform">,
  parts: readonly PartInstance[],
  occupiedEndpoints: ReadonlySet<string> = new Set(),
): readonly DiscoveredConnection[] {
  const candidateClutches = connectorFrames(candidate, "undersideClutch");
  const candidateStuds = connectorFrames(candidate, "stud");
  const discovered: DiscoveredConnection[] = [];
  const usedCandidatePorts = new Set<string>();

  for (const part of [...parts].sort((left, right) => (left.id < right.id ? -1 : 1))) {
    if (part.id === candidate.id || !getPartDefinition(part.catalogPartId)) continue;

    // The candidate's underside meets the target's studs, and vice versa.
    for (const [candidatePorts, targetKind] of [
      [candidateClutches, "stud"],
      [candidateStuds, "undersideClutch"],
    ] as const) {
      for (const target of connectorFrames(part, targetKind)) {
        if (occupiedEndpoints.has(endpointKey(part.id, target.portId))) continue;
        const match = candidatePorts.find(
          (candidatePort) =>
            !usedCandidatePorts.has(candidatePort.portId) &&
            samePosition(candidatePort.position, target.position),
        );
        if (!match) continue;
        usedCandidatePorts.add(match.portId);
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

export function createPlacementTransform(
  positionLdu: LduVector3,
  orientationId: string,
): RigidTransform {
  return { positionLdu, orientationId };
}
