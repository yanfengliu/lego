import {
  getPartDefinition,
  type CollisionAllowance,
  type CollisionWedge,
  type LduVector3,
} from "@lego-studio/catalog";
import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { axisAlignedStudsIntersect } from "./axis-stud-collision.ts";
import {
  COLLISION_AXES,
  axisIndexForUnitVector,
  bodiesOverlap,
  otherAxisIndices,
  studIntersectsBody,
  type Point2,
  type PrimitiveBounds,
  type WorldBody,
  type WorldPrimitive,
  type WorldStud,
} from "./collision-prism-geometry.ts";
import { getProperOrientation, rotateLduVector, transformLduPoint } from "./transforms.ts";

interface HorizontalCut {
  readonly nx: number;
  readonly nz: number;
  readonly offset: number;
}

interface WorldAllowance {
  readonly center: LduVector3;
  readonly radiusLdu: number;
  readonly axis: WorldStud["axis"];
  readonly axisIndex: WorldBody["prismAxisIndex"];
  readonly minAlongAxis: number;
  readonly maxAlongAxis: number;
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

function makeWorldBody({
  part,
  primitiveId,
  sourceIndex,
  localSection,
  minLocalY,
  maxLocalY,
  bounds,
}: {
  readonly part: PartInstance;
  readonly primitiveId: string;
  readonly sourceIndex: number;
  readonly localSection: readonly Point2[];
  readonly minLocalY: number;
  readonly maxLocalY: number;
  readonly bounds: PrimitiveBounds;
}): WorldBody {
  const orientation = getProperOrientation(part.transform.orientationId);
  const prismAxisIndex = axisIndexForUnitVector(rotateLduVector(orientation.matrix, [0, 1, 0]));
  if (prismAxisIndex === undefined) {
    throw new TypeError(
      `Proper orientation ${orientation.id} did not preserve the local collision-prism axis.`,
    );
  }
  const sectionAxisIndices = otherAxisIndices(prismAxisIndex);
  const section = localSection.map(([x, z]) => {
    const point = transformLduPoint(part.transform, [x, 0, z]);
    return [point[sectionAxisIndices[0]], point[sectionAxisIndices[1]]] as const;
  });
  const firstLimit = transformLduPoint(part.transform, [0, minLocalY, 0])[prismAxisIndex];
  const secondLimit = transformLduPoint(part.transform, [0, maxLocalY, 0])[prismAxisIndex];

  return {
    kind: "body",
    part,
    primitiveId,
    sourceIndex,
    prismAxis: COLLISION_AXES[prismAxisIndex],
    prismAxisIndex,
    sectionAxisIndices,
    minAlongPrismAxis: Math.min(firstLimit, secondLimit),
    maxAlongPrismAxis: Math.max(firstLimit, secondLimit),
    section,
    ...bounds,
  };
}

function rectangleSection(min: LduVector3, max: LduVector3): readonly Point2[] {
  return [
    [min[0], min[2]],
    [max[0], min[2]],
    [max[0], max[2]],
    [min[0], max[2]],
  ];
}

/** Keep the part of a polygon where `nx*x + nz*z <= offset`. */
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

function wedgeSection(wedge: CollisionWedge): readonly Point2[] {
  const [nx, nz] = wedge.cutNormalXZ;
  return clipByCut(rectangleSection(wedge.minLdu, wedge.maxLdu), {
    nx,
    nz,
    offset: wedge.cutOffsetLdu,
  });
}

export function makeWorldPrimitives(parts: readonly PartInstance[]): WorldPrimitive[] {
  const primitives: WorldPrimitive[] = [];

  for (let sourceIndex = 0; sourceIndex < parts.length; sourceIndex += 1) {
    const part = parts[sourceIndex];
    if (!part) continue;
    const definition = getPartDefinition(part.catalogPartId);
    if (!definition) continue;
    let orientation;
    try {
      orientation = getProperOrientation(part.transform.orientationId);
    } catch {
      continue;
    }

    for (const primitive of definition.collision.primitives) {
      if (primitive.kind === "box" || primitive.kind === "wedge") {
        const bounds = transformedBoxBounds(part, primitive.minLdu, primitive.maxLdu);
        primitives.push(
          makeWorldBody({
            part,
            primitiveId: primitive.id,
            sourceIndex,
            localSection:
              primitive.kind === "box"
                ? rectangleSection(primitive.minLdu, primitive.maxLdu)
                : wedgeSection(primitive),
            minLocalY: primitive.minLdu[1],
            maxLocalY: primitive.maxLdu[1],
            bounds,
          }),
        );
        continue;
      }

      if (primitive.kind === "convex-prism") {
        const xs = primitive.verticesXZLdu.map(([x]) => x);
        const zs = primitive.verticesXZLdu.map(([, z]) => z);
        const bounds = transformedBoxBounds(
          part,
          [Math.min(...xs), primitive.minYLdu, Math.min(...zs)],
          [Math.max(...xs), primitive.maxYLdu, Math.max(...zs)],
        );
        primitives.push(
          makeWorldBody({
            part,
            primitiveId: primitive.id,
            sourceIndex,
            localSection: primitive.verticesXZLdu,
            minLocalY: primitive.minYLdu,
            maxLocalY: primitive.maxYLdu,
            bounds,
          }),
        );
        continue;
      }

      const center = transformLduPoint(part.transform, primitive.centerLdu);
      const halfHeight = primitive.heightLdu / 2;
      const localHalf: LduVector3 =
        primitive.axis === "x"
          ? [halfHeight, primitive.radiusLdu, primitive.radiusLdu]
          : primitive.axis === "z"
            ? [primitive.radiusLdu, primitive.radiusLdu, halfHeight]
            : [primitive.radiusLdu, halfHeight, primitive.radiusLdu];
      const rotatedHalf = rotateLduVector(orientation.matrix, localHalf);
      const localAxis: LduVector3 =
        primitive.axis === "x" ? [1, 0, 0] : primitive.axis === "y" ? [0, 1, 0] : [0, 0, 1];
      const rotatedAxis = rotateLduVector(orientation.matrix, localAxis);
      const axisIndex = axisIndexForUnitVector(rotatedAxis);
      if (axisIndex === undefined) continue;
      const half: LduVector3 = [
        Math.abs(rotatedHalf[0]),
        Math.abs(rotatedHalf[1]),
        Math.abs(rotatedHalf[2]),
      ];
      if (primitive.tag === "body") {
        const localMin: LduVector3 = [
          primitive.centerLdu[0] - localHalf[0],
          primitive.centerLdu[1] - localHalf[1],
          primitive.centerLdu[2] - localHalf[2],
        ];
        const localMax: LduVector3 = [
          primitive.centerLdu[0] + localHalf[0],
          primitive.centerLdu[1] + localHalf[1],
          primitive.centerLdu[2] + localHalf[2],
        ];
        primitives.push(
          makeWorldBody({
            part,
            primitiveId: primitive.id,
            sourceIndex,
            localSection: rectangleSection(localMin, localMax),
            minLocalY: localMin[1],
            maxLocalY: localMax[1],
            bounds: transformedBoxBounds(part, localMin, localMax),
          }),
        );
        continue;
      }
      primitives.push({
        kind: "stud",
        part,
        primitiveId: primitive.id,
        sourceIndex,
        center,
        radiusLdu: primitive.radiusLdu,
        ...(definition.collision.validatedConnectionStudProfile !== "nominal-stud-tube/1" ||
        primitive.validatedConnectionProfileRadiusLdu === undefined
          ? {}
          : {
              validatedConnectionProfileRadiusLdu: primitive.validatedConnectionProfileRadiusLdu,
            }),
        axis: COLLISION_AXES[axisIndex],
        min: [center[0] - half[0], center[1] - half[1], center[2] - half[2]],
        max: [center[0] + half[0], center[1] + half[1], center[2] + half[2]],
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

function worldAllowance(
  part: PartInstance,
  allowance: CollisionAllowance,
  connectorNormal: LduVector3,
): WorldAllowance {
  const center = transformLduPoint(part.transform, allowance.centerLdu);
  const orientation = getProperOrientation(part.transform.orientationId);
  const axisIndex = axisIndexForUnitVector(rotateLduVector(orientation.matrix, connectorNormal));
  if (axisIndex === undefined) {
    throw new TypeError(
      `Connector allowance ${allowance.id} on ${part.id} does not have an axis-aligned proper world normal.`,
    );
  }
  const halfDepth = allowance.maxInsertionDepthLdu / 2;
  return {
    center,
    radiusLdu: allowance.radiusLdu,
    axis: COLLISION_AXES[axisIndex],
    axisIndex,
    minAlongAxis: center[axisIndex] - halfDepth,
    maxAlongAxis: center[axisIndex] + halfDepth,
  };
}

function penetrationKey(studPartId: string, studPrimitiveId: string, clutchPartId: string): string {
  return `${studPartId}\u0000${studPrimitiveId}\u0001${clutchPartId}`;
}

export function collectAllowedPenetrations(
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
      allowance: worldAllowance(clutch.part, allowance, clutch.port.normal),
    };
    const key = penetrationKey(value.studPartId, value.studPrimitiveId, value.clutchPartId);
    const existing = allowed.get(key);
    if (existing) existing.push(value);
    else allowed.set(key, [value]);
  }

  return allowed;
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

  return candidates.some(({ allowance }) => {
    if (allowance.axis !== stud.axis || body.prismAxis !== stud.axis) return false;
    const axisIndex = allowance.axisIndex;
    const radialAxisIndices = otherAxisIndices(axisIndex);
    const overlapMinimum = Math.max(stud.min[axisIndex], body.minAlongPrismAxis);
    const overlapMaximum = Math.min(stud.max[axisIndex], body.maxAlongPrismAxis);
    const connectionRadiusLdu = stud.validatedConnectionProfileRadiusLdu ?? stud.radiusLdu;
    const radialClearance = allowance.radiusLdu - connectionRadiusLdu;
    if (radialClearance < 0) return false;
    const firstRadialOffset =
      allowance.center[radialAxisIndices[0]] - stud.center[radialAxisIndices[0]];
    const secondRadialOffset =
      allowance.center[radialAxisIndices[1]] - stud.center[radialAxisIndices[1]];
    return (
      firstRadialOffset * firstRadialOffset + secondRadialOffset * secondRadialOffset <=
        radialClearance * radialClearance &&
      overlapMinimum >= allowance.minAlongAxis &&
      overlapMaximum <= allowance.maxAlongAxis
    );
  });
}

export function primitivesCollide(
  left: WorldPrimitive,
  right: WorldPrimitive,
  allowedPenetrations: ReadonlyMap<string, readonly AllowedPenetration[]>,
): boolean {
  if (left.kind === "body" && right.kind === "body") return bodiesOverlap(left, right);
  if (left.kind === "stud" && right.kind === "stud") return axisAlignedStudsIntersect(left, right);
  const stud = left.kind === "stud" ? left : (right as WorldStud);
  const body = left.kind === "body" ? left : (right as WorldBody);
  return (
    studIntersectsBody(stud, body) &&
    !penetrationCoveredByAllowance(stud, body, allowedPenetrations)
  );
}
