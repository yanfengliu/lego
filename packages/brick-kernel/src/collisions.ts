import {
  getPartDefinition,
  type CollisionAllowance,
  type CollisionWedge,
  type LduVector3,
} from "@lego-studio/catalog";
import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { transformLduPoint } from "./transforms.ts";
import { MAX_COLLISION_COMPARISONS, MAX_COLLISION_FINDINGS } from "./truth-manifests.ts";

export interface CollisionFinding {
  readonly validatorId: "kernel.collision";
  readonly code:
    | "COLLISION_COMPARISON_BUDGET_EXCEEDED"
    | "COLLISION_FINDING_BUDGET_EXCEEDED"
    | "PART_BODY_COLLISION"
    | "PART_STUD_BODY_COLLISION"
    | "PART_STUD_COLLISION";
  readonly message: string;
  readonly path: "/parts";
  readonly partIds: readonly string[];
}

interface PrimitiveBounds {
  readonly min: LduVector3;
  readonly max: LduVector3;
}

/**
 * The sloped face of a wedge, as a half-plane in the horizontal plane: the
 * solid is where `nx * x + nz * z <= offset`.
 *
 * Every body here is a vertical prism with a convex cross-section, so a box is
 * a rectangle and a wedge is that rectangle clipped by one of these. Keeping
 * the cut as a half-plane rather than a shape makes it survive a quarter turn
 * as a rotated normal, and makes the overlap test exact instead of a bounding
 * box that would claim the whole rectangle is solid.
 */
interface HorizontalCut {
  readonly nx: number;
  readonly nz: number;
  readonly offset: number;
}

interface WorldBody extends PrimitiveBounds {
  readonly kind: "body";
  readonly part: PartInstance;
  readonly primitiveId: string;
  readonly sourceIndex: number;
  /** Absent for a box, which fills its bounds. */
  readonly cut?: HorizontalCut;
}

interface WorldStud extends PrimitiveBounds {
  readonly kind: "stud";
  readonly part: PartInstance;
  readonly primitiveId: string;
  readonly sourceIndex: number;
  readonly center: LduVector3;
  readonly radiusLdu: number;
}

type WorldPrimitive = WorldBody | WorldStud;

interface WorldAllowance {
  readonly center: LduVector3;
  readonly radiusLdu: number;
  readonly minY: number;
  readonly maxY: number;
}

interface AllowedPenetration {
  readonly studPartId: string;
  readonly studPrimitiveId: string;
  readonly clutchPartId: string;
  readonly allowance: WorldAllowance;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function transformedBoxBounds(
  part: PartInstance,
  min: LduVector3,
  max: LduVector3,
): PrimitiveBounds {
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

function makeWorldPrimitives(parts: readonly PartInstance[]): WorldPrimitive[] {
  const primitives: WorldPrimitive[] = [];

  for (let sourceIndex = 0; sourceIndex < parts.length; sourceIndex += 1) {
    const part = parts[sourceIndex];
    if (!part) continue;
    const definition = getPartDefinition(part.catalogPartId);
    if (!definition || !definition.legalOrientationIds.includes(part.transform.orientationId)) {
      continue;
    }

    for (const primitive of definition.collision.primitives) {
      if (primitive.kind === "box") {
        primitives.push({
          kind: "body",
          part,
          primitiveId: primitive.id,
          sourceIndex,
          ...transformedBoxBounds(part, primitive.minLdu, primitive.maxLdu),
        });
        continue;
      }

      if (primitive.kind === "wedge") {
        primitives.push({
          kind: "body",
          part,
          primitiveId: primitive.id,
          sourceIndex,
          ...transformedBoxBounds(part, primitive.minLdu, primitive.maxLdu),
          cut: transformedCut(part, primitive),
        });
        continue;
      }

      const center = transformLduPoint(part.transform, primitive.centerLdu);
      const halfHeight = primitive.heightLdu / 2;
      primitives.push({
        kind: "stud",
        part,
        primitiveId: primitive.id,
        sourceIndex,
        center,
        radiusLdu: primitive.radiusLdu,
        min: [
          center[0] - primitive.radiusLdu,
          center[1] - halfHeight,
          center[2] - primitive.radiusLdu,
        ],
        max: [
          center[0] + primitive.radiusLdu,
          center[1] + halfHeight,
          center[2] + primitive.radiusLdu,
        ],
      });
    }
  }

  return primitives.sort(
    (left, right) =>
      left.min[0] - right.min[0] ||
      compareStrings(left.part.id, right.part.id) ||
      compareStrings(left.primitiveId, right.primitiveId) ||
      left.sourceIndex - right.sourceIndex,
  );
}

function worldAllowance(part: PartInstance, allowance: CollisionAllowance): WorldAllowance {
  const center = transformLduPoint(part.transform, allowance.centerLdu);
  const halfDepth = allowance.maxInsertionDepthLdu / 2;
  return {
    center,
    radiusLdu: allowance.radiusLdu,
    minY: center[1] - halfDepth,
    maxY: center[1] + halfDepth,
  };
}

function penetrationKey(studPartId: string, studPrimitiveId: string, clutchPartId: string): string {
  return `${studPartId}\u0000${studPrimitiveId}\u0001${clutchPartId}`;
}

function collectAllowedPenetrations(
  parts: readonly PartInstance[],
  validConnections: readonly ConnectionEdge[],
): ReadonlyMap<string, readonly AllowedPenetration[]> {
  const partById = new Map(parts.map((part) => [part.id, part]));
  const allowed = new Map<string, AllowedPenetration[]>();

  for (const connection of validConnections) {
    const aPart = partById.get(connection.a.partId);
    const bPart = partById.get(connection.b.partId);
    if (!aPart || !bPart) continue;
    const aDefinition = getPartDefinition(aPart.catalogPartId);
    const bDefinition = getPartDefinition(bPart.catalogPartId);
    if (!aDefinition || !bDefinition) continue;
    const aPort = aDefinition.connectors.find(({ id }) => id === connection.a.portId);
    const bPort = bDefinition.connectors.find(({ id }) => id === connection.b.portId);
    if (!aPort || !bPort) continue;

    const stud =
      aPort.kind === "stud" ? { part: aPart, port: aPort } : { part: bPart, port: bPort };
    const clutch =
      aPort.kind === "undersideClutch"
        ? { part: aPart, port: aPort, definition: aDefinition }
        : { part: bPart, port: bPort, definition: bDefinition };
    if (stud.port.kind !== "stud" || clutch.port.kind !== "undersideClutch") continue;

    const studDefinition = getPartDefinition(stud.part.catalogPartId);
    const studPrimitive = studDefinition?.collision.primitives.find(
      (primitive) => primitive.kind === "cylinder" && primitive.id === stud.port.id,
    );
    const allowance = clutch.definition.collision.allowances.find(
      (candidate) =>
        candidate.portId === clutch.port.id &&
        candidate.incomingPrimitiveTag === "stud" &&
        candidate.requiresValidatedConnection,
    );
    if (!studPrimitive || !allowance) continue;

    const value: AllowedPenetration = {
      studPartId: stud.part.id,
      studPrimitiveId: studPrimitive.id,
      clutchPartId: clutch.part.id,
      allowance: worldAllowance(clutch.part, allowance),
    };
    const key = penetrationKey(value.studPartId, value.studPrimitiveId, value.clutchPartId);
    const existing = allowed.get(key);
    if (existing) existing.push(value);
    else allowed.set(key, [value]);
  }

  return allowed;
}

/**
 * Carries a wedge's sloped face into world space.
 *
 * The transform is rigid, so the plane's normal is the image of the local
 * normal as a direction — the difference of two transformed points — and its
 * offset is that normal dotted with any transformed point on the plane.
 */
function transformedCut(part: PartInstance, wedge: CollisionWedge): HorizontalCut {
  const [nx, nz] = wedge.cutNormalXZ;
  const origin = transformLduPoint(part.transform, [0, 0, 0]);
  const tip = transformLduPoint(part.transform, [nx, 0, nz]);
  const worldNx = tip[0] - origin[0];
  const worldNz = tip[2] - origin[2];
  const lengthSquared = nx * nx + nz * nz;
  const onPlane = transformLduPoint(part.transform, [
    (nx * wedge.cutOffsetLdu) / lengthSquared,
    0,
    (nz * wedge.cutOffsetLdu) / lengthSquared,
  ]);
  return { nx: worldNx, nz: worldNz, offset: worldNx * onPlane[0] + worldNz * onPlane[2] };
}

/** Whether any of a circle reaches the solid side of a sloped face. */
function cutAdmitsCircle(cut: HorizontalCut, x: number, z: number, radius: number): boolean {
  const length = Math.hypot(cut.nx, cut.nz);
  if (length === 0) return true;
  return (cut.nx * x + cut.nz * z - cut.offset) / length < radius;
}

/** Area below which a polygon is a seam rather than an overlap. */
const OVERLAP_AREA_EPSILON = 1e-6;

type Point2 = readonly [number, number];

/** Sutherland-Hodgman: keep the part of the polygon inside `nx*x + nz*z <= offset`. */
function clipByCut(polygon: readonly Point2[], cut: HorizontalCut): readonly Point2[] {
  const inside = (point: Point2) => cut.nx * point[0] + cut.nz * point[1] <= cut.offset;
  const clipped: Point2[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!;
    const currentIn = inside(current);
    if (currentIn !== inside(previous)) {
      const currentDistance = cut.nx * current[0] + cut.nz * current[1] - cut.offset;
      const previousDistance = cut.nx * previous[0] + cut.nz * previous[1] - cut.offset;
      const t = previousDistance / (previousDistance - currentDistance);
      clipped.push([
        previous[0] + t * (current[0] - previous[0]),
        previous[1] + t * (current[1] - previous[1]),
      ]);
    }
    if (currentIn) clipped.push(current);
  }
  return clipped;
}

function polygonArea(polygon: readonly Point2[]): number {
  let total = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    total += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(total) / 2;
}

/**
 * Whether two bodies share space, exactly.
 *
 * Both are vertical prisms, so their vertical extents must overlap and their
 * cross-sections must share area. The cross-sections are their shared bounding
 * rectangle clipped by whichever sloped faces they have, which is exact rather
 * than conservative: the wedge really is its rectangle minus that half-plane.
 */
function bodiesOverlap(left: WorldBody, right: WorldBody): boolean {
  if (left.cut === undefined && right.cut === undefined) return true;
  const minX = Math.max(left.min[0], right.min[0]);
  const maxX = Math.min(left.max[0], right.max[0]);
  const minZ = Math.max(left.min[2], right.min[2]);
  const maxZ = Math.min(left.max[2], right.max[2]);
  let polygon: readonly Point2[] = [
    [minX, minZ],
    [maxX, minZ],
    [maxX, maxZ],
    [minX, maxZ],
  ];
  if (left.cut) polygon = clipByCut(polygon, left.cut);
  if (right.cut) polygon = clipByCut(polygon, right.cut);
  return polygon.length >= 3 && polygonArea(polygon) > OVERLAP_AREA_EPSILON;
}

function boundsOverlap(left: PrimitiveBounds, right: PrimitiveBounds): boolean {
  return (
    left.min[0] < right.max[0] &&
    right.min[0] < left.max[0] &&
    left.min[1] < right.max[1] &&
    right.min[1] < left.max[1] &&
    left.min[2] < right.max[2] &&
    right.min[2] < left.max[2]
  );
}

function studIntersectsBody(stud: WorldStud, body: WorldBody): boolean {
  if (stud.min[1] >= body.max[1] || body.min[1] >= stud.max[1]) {
    return false;
  }
  // A stud over the empty corner of a wedge is over nothing, however far inside
  // the wedge's bounding box it sits.
  if (body.cut && !cutAdmitsCircle(body.cut, stud.center[0], stud.center[2], stud.radiusLdu)) {
    return false;
  }
  const closestX = Math.max(body.min[0], Math.min(stud.center[0], body.max[0]));
  const closestZ = Math.max(body.min[2], Math.min(stud.center[2], body.max[2]));
  const dx = stud.center[0] - closestX;
  const dz = stud.center[2] - closestZ;
  return dx * dx + dz * dz < stud.radiusLdu * stud.radiusLdu;
}

function studsIntersect(left: WorldStud, right: WorldStud): boolean {
  if (left.min[1] >= right.max[1] || right.min[1] >= left.max[1]) return false;
  const dx = left.center[0] - right.center[0];
  const dz = left.center[2] - right.center[2];
  const combinedRadius = left.radiusLdu + right.radiusLdu;
  return dx * dx + dz * dz < combinedRadius * combinedRadius;
}

function penetrationCoveredByAllowance(
  stud: WorldStud,
  body: WorldBody,
  allowedPenetrations: ReadonlyMap<string, readonly AllowedPenetration[]>,
): boolean {
  const candidates = allowedPenetrations.get(
    penetrationKey(stud.part.id, stud.primitiveId, body.part.id),
  );
  if (!candidates) return false;

  const overlapMinY = Math.max(stud.min[1], body.min[1]);
  const overlapMaxY = Math.min(stud.max[1], body.max[1]);
  return candidates.some(({ allowance }) => {
    const radialClearance = allowance.radiusLdu - stud.radiusLdu;
    if (radialClearance < 0) return false;
    const dx = allowance.center[0] - stud.center[0];
    const dz = allowance.center[2] - stud.center[2];
    return (
      dx * dx + dz * dz <= radialClearance * radialClearance &&
      overlapMinY >= allowance.minY &&
      overlapMaxY <= allowance.maxY
    );
  });
}

function collisionFinding(left: WorldPrimitive, right: WorldPrimitive): CollisionFinding {
  const partIds = [left.part.id, right.part.id].sort(compareStrings);
  if (left.kind === "body" && right.kind === "body") {
    return {
      validatorId: "kernel.collision",
      code: "PART_BODY_COLLISION",
      message: `Part bodies overlap: ${partIds[0]} and ${partIds[1]}`,
      path: "/parts",
      partIds,
    };
  }
  if (left.kind === "stud" && right.kind === "stud") {
    return {
      validatorId: "kernel.collision",
      code: "PART_STUD_COLLISION",
      message: `Part studs overlap: ${left.part.id}/${left.primitiveId} and ${right.part.id}/${right.primitiveId}`,
      path: "/parts",
      partIds,
    };
  }
  const stud = left.kind === "stud" ? left : (right as WorldStud);
  const body = left.kind === "body" ? left : (right as WorldBody);
  return {
    validatorId: "kernel.collision",
    code: "PART_STUD_BODY_COLLISION",
    message: `Stud ${stud.part.id}/${stud.primitiveId} overlaps body ${body.part.id}/${body.primitiveId}`,
    path: "/parts",
    partIds,
  };
}

function collisionClassKey(finding: CollisionFinding): string {
  return `${finding.code}\u0000${finding.partIds.join("\u0001")}`;
}

export function findCatalogCollisions(
  parts: readonly PartInstance[],
  validConnections: readonly ConnectionEdge[],
): CollisionFinding[] {
  const primitives = makeWorldPrimitives(parts);
  const allowedPenetrations = collectAllowedPenetrations(parts, validConnections);
  const findings: CollisionFinding[] = [];
  const reportedClasses = new Set<string>();
  let comparisons = 0;

  for (let leftIndex = 0; leftIndex < primitives.length; leftIndex += 1) {
    const left = primitives[leftIndex];
    if (!left) continue;

    for (let rightIndex = leftIndex + 1; rightIndex < primitives.length; rightIndex += 1) {
      const right = primitives[rightIndex];
      if (!right || right.min[0] >= left.max[0]) break;
      if (left.sourceIndex === right.sourceIndex || !boundsOverlap(left, right)) continue;

      comparisons += 1;
      if (comparisons > MAX_COLLISION_COMPARISONS) {
        return [
          {
            validatorId: "kernel.collision",
            code: "COLLISION_COMPARISON_BUDGET_EXCEEDED",
            message: `Collision validation exceeded its deterministic ${MAX_COLLISION_COMPARISONS}-comparison budget`,
            path: "/parts",
            partIds: [],
          },
        ];
      }

      let collides: boolean;
      if (left.kind === "body" && right.kind === "body") {
        collides = bodiesOverlap(left, right);
      } else if (left.kind === "stud" && right.kind === "stud") {
        collides = studsIntersect(left, right);
      } else {
        const stud = left.kind === "stud" ? left : (right as WorldStud);
        const body = left.kind === "body" ? left : (right as WorldBody);
        collides =
          studIntersectsBody(stud, body) &&
          !penetrationCoveredByAllowance(stud, body, allowedPenetrations);
      }
      if (!collides) continue;

      const finding = collisionFinding(left, right);
      const key = collisionClassKey(finding);
      if (reportedClasses.has(key)) continue;
      reportedClasses.add(key);
      findings.push(finding);
      if (findings.length >= MAX_COLLISION_FINDINGS) {
        return [
          ...findings.slice(0, MAX_COLLISION_FINDINGS - 1),
          {
            validatorId: "kernel.collision",
            code: "COLLISION_FINDING_BUDGET_EXCEEDED",
            message: `Collision findings exceeded the deterministic ${MAX_COLLISION_FINDINGS}-finding budget`,
            path: "/parts",
            partIds: [],
          },
        ];
      }
    }
  }

  return findings;
}

const WORLD_CELL_LDU = 100;

function cellKeysFor(bounds: PrimitiveBounds): readonly string[] {
  const keys: string[] = [];
  const minX = Math.floor(bounds.min[0] / WORLD_CELL_LDU);
  const maxX = Math.floor(bounds.max[0] / WORLD_CELL_LDU);
  const minZ = Math.floor(bounds.min[2] / WORLD_CELL_LDU);
  const maxZ = Math.floor(bounds.max[2] / WORLD_CELL_LDU);
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) keys.push(`${x}:${z}`);
  }
  return keys;
}

function primitivesCollide(
  left: WorldPrimitive,
  right: WorldPrimitive,
  allowedPenetrations: ReadonlyMap<string, readonly AllowedPenetration[]>,
): boolean {
  if (left.kind === "body" && right.kind === "body") return true;
  if (left.kind === "stud" && right.kind === "stud") return studsIntersect(left, right);
  const stud = left.kind === "stud" ? left : (right as WorldStud);
  const body = left.kind === "body" ? left : (right as WorldBody);
  return (
    studIntersectsBody(stud, body) &&
    !penetrationCoveredByAllowance(stud, body, allowedPenetrations)
  );
}

/**
 * An assembly's collision primitives, indexed once so a candidate placement can
 * be tested against them without rebuilding them.
 *
 * `findCatalogCollisions` is the right shape for validating a document: it
 * looks at everything against everything, once. It is the wrong shape for a
 * search, which asks "does this one part fit?" thousands of times against an
 * assembly that has not changed — rebuilding and re-sorting every neighbour's
 * primitives per question made enumerating one part over a 120-part model take
 * 3.6 seconds. Both share the pairwise predicates below, so there is still
 * exactly one definition of what a collision is.
 */
export interface CollisionWorld {
  readonly primitiveCount: number;
  /**
   * Findings between `candidate` and the assembly. Candidate-internal pairs are
   * never reported: a part cannot collide with itself, and the caller is asking
   * whether it fits, not whether the catalog entry is self-consistent.
   */
  findCollisionsWith(
    candidate: PartInstance,
    candidateConnections: readonly ConnectionEdge[],
  ): CollisionFinding[];
}

export function createCollisionWorld(parts: readonly PartInstance[]): CollisionWorld {
  const primitives = makeWorldPrimitives(parts);
  const partById = new Map(parts.map((part) => [part.id, part]));
  const cells = new Map<string, WorldPrimitive[]>();
  for (const primitive of primitives) {
    for (const key of cellKeysFor(primitive)) {
      const cell = cells.get(key);
      if (cell) cell.push(primitive);
      else cells.set(key, [primitive]);
    }
  }

  return {
    primitiveCount: primitives.length,
    findCollisionsWith(candidate, candidateConnections) {
      const candidatePrimitives = makeWorldPrimitives([candidate]);
      if (candidatePrimitives.length === 0) return [];
      // Allowances need both endpoints, so the candidate joins the roster only
      // for this query and never enters the indexed world.
      const roster = [candidate];
      for (const connection of candidateConnections) {
        for (const endpoint of [connection.a, connection.b]) {
          const part = partById.get(endpoint.partId);
          if (part && !roster.includes(part)) roster.push(part);
        }
      }
      const allowedPenetrations = collectAllowedPenetrations(roster, candidateConnections);

      const neighbourhood = new Set<WorldPrimitive>();
      for (const primitive of candidatePrimitives) {
        for (const key of cellKeysFor(primitive)) {
          for (const other of cells.get(key) ?? []) {
            if (other.part.id !== candidate.id) neighbourhood.add(other);
          }
        }
      }

      const findings: CollisionFinding[] = [];
      const reportedClasses = new Set<string>();
      for (const left of candidatePrimitives) {
        for (const right of neighbourhood) {
          if (!boundsOverlap(left, right)) continue;
          if (!primitivesCollide(left, right, allowedPenetrations)) continue;
          const finding = collisionFinding(left, right);
          const classKey = collisionClassKey(finding);
          if (reportedClasses.has(classKey)) continue;
          reportedClasses.add(classKey);
          findings.push(finding);
          if (findings.length >= MAX_COLLISION_FINDINGS) return findings;
        }
      }
      return findings;
    },
  };
}
