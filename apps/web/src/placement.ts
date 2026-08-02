import {
  BRICK_HEIGHT_LDU,
  PLATE_HEIGHT_LDU,
  STUD_PITCH_LDU,
  UPRIGHT_ORIENTATIONS,
  connectorAccepts,
  getPartDefinition,
  type ConnectorKind,
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
 * it. Resting *surfaces* are what live on the PLATE_HEIGHT_LDU lattice — the
 * plate, then a plate's height at a time above it — and a part's origin is half
 * its own height below the surface it sits on. For a brick that is y=0 and for
 * a plate y=8, both on the lattice, which is why rounding the origin looked
 * right until a two-plate-tall cheese slope wanted y=+4.
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

/**
 * The nearest legal surface for a part's underside to rest on.
 *
 * Surfaces are on the plate lattice — the build plate, then a plate's height at
 * a time above it — and it is the *surface* that lands there, not the part's
 * origin. Rounding the origin instead works only while every part is a whole
 * number of plates tall in a way that halves onto the same lattice: a
 * two-plate-tall cheese slope resting on the plate has its origin at +4, which
 * the origin lattice rounds to +8 and buries four LDU under the plate.
 */
function snapSupportSurface(raw: number): number {
  const plates = Math.round((raw - GROUND_UNDERSIDE_LDU) / VERTICAL_SNAP_LDU);
  return GROUND_UNDERSIDE_LDU + plates * VERTICAL_SNAP_LDU;
}

/**
 * The next legal yaw, cycling through the catalog's quarter turns. Rotating a
 * part is a transform edit like any other, so it stays inside the finite
 * upright-orientation policy rather than inventing a matrix.
 */
export function nextYawOrientationId(orientationId: string): string {
  const current = getUprightOrientation(orientationId);
  const ordered = [...UPRIGHT_ORIENTATIONS].sort((a, b) => a.quarterTurns - b.quarterTurns);
  const next = ordered[(current.quarterTurns + 1) % ordered.length];
  if (!next) throw new PlacementError(`No legal yaw follows ${orientationId}`);
  return next.id;
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
    snapSupportSurface(supportUndersideLdu) - footprint.heightLdu / 2,
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
  kind: ConnectorKind,
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
 * Every compatible pair the candidate lands exactly on, in deterministic
 * order. Ports already occupied by an existing connection are skipped so a
 * placement never proposes an over-capacity edge.
 */
export function findStudConnections(
  candidate: Pick<PartInstance, "id" | "catalogPartId" | "transform">,
  parts: readonly PartInstance[],
  occupiedEndpoints: ReadonlySet<string> = new Set(),
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
  const usedCandidatePorts = new Set<string>();

  for (const part of [...parts].sort((left, right) => (left.id < right.id ? -1 : 1))) {
    if (part.id === candidate.id || !getPartDefinition(part.catalogPartId)) continue;

    const pairings = [...candidatePortsByKind].flatMap(([kind, ports]) =>
      connectorAccepts(kind).map((targetKind) => [ports, targetKind] as const),
    );
    for (const [candidatePorts, targetKind] of pairings) {
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

export type SupportVerdict =
  | { readonly supported: true; readonly held: "build-plate" | "connections" }
  | { readonly supported: false; readonly reason: string };

/** World Y of a part's underside, which is where it would rest on something. */
export function partUndersideLdu(part: Pick<PartInstance, "catalogPartId" | "transform">): number {
  return bodyBoundsLdu(part).max[1];
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
  if (partUndersideLdu(candidate) === GROUND_UNDERSIDE_LDU) {
    return { supported: true, held: "build-plate" };
  }
  const definition = requireDefinition(candidate.catalogPartId);
  const heightAbovePlate = GROUND_UNDERSIDE_LDU - partUndersideLdu(candidate);
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
