import {
  getPartDefinition,
  partMassGrams,
  partMassProperties,
  type CollisionPrimitive,
  type ConnectorRotation,
  type LduVector3,
} from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import type { AssemblyGraph } from "./assemblies.ts";
import {
  getConnectorWorldFrame,
  getProperOrientation,
  rotateLduVector,
  transformLduPoint,
} from "./transforms.ts";

/**
 * What an engine needs, without naming one.
 *
 * A rigid component becomes one body: its parts' masses summed, its centre of
 * mass their weighted average, its collider the union of their shapes. An
 * articulated joint becomes one constraint, anchored where the two connectors
 * actually meet.
 *
 * Everything here is plain data in LDU. No solver, no scene, no floating-point
 * integration — an adapter converts it to whatever engine is chosen, and this
 * stays testable without one. Getting the mass distribution of a chassis wrong
 * is a bug that survives every geometry test, so it is worth being able to
 * assert on it directly.
 */

export const COMPOUND_BODY_SCHEMA_VERSION = "lego.compound-bodies/4" as const;

export interface BodyBoxShape {
  readonly kind: "box";
  /** Half-extents, so a shape is its centre plus how far it reaches. */
  readonly halfExtentsLdu: LduVector3;
  readonly centerLdu: LduVector3;
}

export interface BodyWedgeShape {
  readonly kind: "wedge";
  readonly halfExtentsLdu: LduVector3;
  readonly centerLdu: LduVector3;
  /** The sloped face, in body space: solid where `nx*x + nz*z <= offset`. */
  readonly cutNormalXZ: readonly [number, number];
  readonly cutOffsetLdu: number;
}

export interface BodyCylinderShape {
  readonly kind: "cylinder";
  readonly axis: "x" | "y" | "z";
  readonly centerLdu: LduVector3;
  readonly radiusLdu: number;
  readonly heightLdu: number;
}

export interface BodyConvexPrismShape {
  readonly kind: "convex-prism";
  /** Polygon and vertical limits in the same frame as the containing body. */
  readonly verticesXZLdu: readonly (readonly [x: number, z: number])[];
  readonly minYLdu: number;
  readonly maxYLdu: number;
  /** Geometric centre for inspection and parity with the other shape records. */
  readonly centerLdu: LduVector3;
}

export interface BodyConvexHullShape {
  readonly kind: "convex-hull";
  /** Exact vertices in the same frame as the containing body. */
  readonly verticesLdu: readonly LduVector3[];
  /** Geometric centre for inspection and parity with the other shape records. */
  readonly centerLdu: LduVector3;
}

export type BodyShape =
  BodyBoxShape | BodyWedgeShape | BodyCylinderShape | BodyConvexPrismShape | BodyConvexHullShape;

export interface CompoundBody {
  readonly id: string;
  readonly partIds: readonly string[];
  /**
   * Where the body's own frame sits in the document, which is its centre of
   * mass. An engine integrates about the centre of mass, so putting the origin
   * anywhere else means carrying an offset through every step.
   */
  readonly originLdu: LduVector3;
  readonly massGrams: number;
  /** Colliders in body space, so shapes move with the body and not the document. */
  readonly shapes: readonly BodyShape[];
}

export interface PhysicsJoint {
  readonly connectionId: string;
  readonly bodyIds: readonly [string, string];
  /** Where the two connectors meet, in each body's own space. */
  readonly anchorsLdu: readonly [LduVector3, LduVector3];
  /** The axis the joint turns about, in the first body's space. */
  readonly axisLdu: LduVector3;
  readonly allowedRotation: ConnectorRotation;
}

export interface PhysicsScene {
  readonly schemaVersion: typeof COMPOUND_BODY_SCHEMA_VERSION;
  readonly bodies: readonly CompoundBody[];
  readonly joints: readonly PhysicsJoint[];
}

const subtract = (point: LduVector3, origin: LduVector3): LduVector3 => [
  point[0] - origin[0],
  point[1] - origin[1],
  point[2] - origin[2],
];

type PlanPoint = readonly [x: number, z: number];

function clipPlanToHalfPlane(
  polygon: readonly PlanPoint[],
  normal: readonly [number, number],
  offset: number,
): readonly PlanPoint[] {
  const [nx, nz] = normal;
  const inside = ([x, z]: PlanPoint) => nx * x + nz * z <= offset;
  const clipped: PlanPoint[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!;
    if (inside(current) !== inside(previous)) {
      const currentDistance = nx * current[0] + nz * current[1] - offset;
      const previousDistance = nx * previous[0] + nz * previous[1] - offset;
      const t = previousDistance / (previousDistance - currentDistance);
      clipped.push([
        previous[0] + t * (current[0] - previous[0]),
        previous[1] + t * (current[1] - previous[1]),
      ]);
    }
    if (inside(current)) clipped.push(current);
  }
  return clipped;
}

function wedgePlan(
  primitive: Extract<CollisionPrimitive, { kind: "wedge" }>,
): readonly PlanPoint[] {
  return clipPlanToHalfPlane(
    [
      [primitive.minLdu[0], primitive.minLdu[2]],
      [primitive.maxLdu[0], primitive.minLdu[2]],
      [primitive.maxLdu[0], primitive.maxLdu[2]],
      [primitive.minLdu[0], primitive.maxLdu[2]],
    ],
    primitive.cutNormalXZ,
    primitive.cutOffsetLdu,
  );
}

function worldConvexHullShape(
  part: PartInstance,
  plan: readonly PlanPoint[],
  minYLdu: number,
  maxYLdu: number,
): BodyConvexHullShape {
  const verticesLdu = plan.flatMap(([x, z]) => [
    transformLduPoint(part.transform, [x, minYLdu, z]),
    transformLduPoint(part.transform, [x, maxYLdu, z]),
  ]);
  const centerLdu: LduVector3 = [
    verticesLdu.reduce((sum, vertex) => sum + vertex[0], 0) / verticesLdu.length,
    verticesLdu.reduce((sum, vertex) => sum + vertex[1], 0) / verticesLdu.length,
    verticesLdu.reduce((sum, vertex) => sum + vertex[2], 0) / verticesLdu.length,
  ];
  return { kind: "convex-hull", verticesLdu, centerLdu };
}

/** A part's collision primitive carried into the document's frame. */
function worldShape(part: PartInstance, primitive: CollisionPrimitive): BodyShape {
  const orientation = getProperOrientation(part.transform.orientationId);
  if (primitive.kind === "cylinder") {
    const localAxis: LduVector3 =
      primitive.axis === "x" ? [1, 0, 0] : primitive.axis === "y" ? [0, 1, 0] : [0, 0, 1];
    const rotatedAxis = rotateLduVector(orientation.matrix, localAxis);
    const axisIndex = rotatedAxis.findIndex((coordinate) => Math.abs(coordinate) === 1);
    const axis = "xyz"[axisIndex] as "x" | "y" | "z" | undefined;
    if (axis === undefined) {
      throw new TypeError(
        `Proper orientation ${orientation.id} did not preserve cylinder axis ${primitive.axis}.`,
      );
    }
    return {
      kind: "cylinder",
      axis,
      centerLdu: transformLduPoint(part.transform, primitive.centerLdu),
      radiusLdu: primitive.radiusLdu,
      heightLdu: primitive.heightLdu,
    };
  }

  if (primitive.kind === "convex-prism") {
    if (Math.abs(orientation.matrix[4]) !== 1) {
      return worldConvexHullShape(
        part,
        primitive.verticesXZLdu,
        primitive.minYLdu,
        primitive.maxYLdu,
      );
    }
    const verticesXZLdu = primitive.verticesXZLdu.map(([x, z]) => {
      const point = transformLduPoint(part.transform, [x, 0, z]);
      return [point[0], point[2]] as const;
    });
    const transformedMinY = transformLduPoint(part.transform, [0, primitive.minYLdu, 0])[1];
    const transformedMaxY = transformLduPoint(part.transform, [0, primitive.maxYLdu, 0])[1];
    const minYLdu = Math.min(transformedMinY, transformedMaxY);
    const maxYLdu = Math.max(transformedMinY, transformedMaxY);
    return {
      kind: "convex-prism",
      verticesXZLdu,
      minYLdu,
      maxYLdu,
      centerLdu: [
        verticesXZLdu.reduce((total, [x]) => total + x, 0) / verticesXZLdu.length,
        (minYLdu + maxYLdu) / 2,
        verticesXZLdu.reduce((total, [, z]) => total + z, 0) / verticesXZLdu.length,
      ],
    };
  }

  const box = worldBoxShape(part, primitive.minLdu, primitive.maxLdu);

  if (primitive.kind === "box") return box;
  if (Math.abs(orientation.matrix[4]) !== 1) {
    return worldConvexHullShape(
      part,
      wedgePlan(primitive),
      primitive.minLdu[1],
      primitive.maxLdu[1],
    );
  }

  // The sloped face is a plane, so its normal rotates as a direction and its
  // offset is that normal dotted with any point still on the plane.
  const [nx, nz] = primitive.cutNormalXZ;
  const rotatedNormal = rotateLduVector(orientation.matrix, [nx, 0, nz]);
  const lengthSquared = nx * nx + nz * nz;
  const onPlane = transformLduPoint(part.transform, [
    (nx * primitive.cutOffsetLdu) / lengthSquared,
    0,
    (nz * primitive.cutOffsetLdu) / lengthSquared,
  ]);
  return {
    ...box,
    kind: "wedge",
    cutNormalXZ: [rotatedNormal[0], rotatedNormal[2]],
    cutOffsetLdu: rotatedNormal[0] * onPlane[0] + rotatedNormal[2] * onPlane[2],
  };
}

function worldBoxShape(part: PartInstance, minLdu: LduVector3, maxLdu: LduVector3): BodyBoxShape {
  const localCenter: LduVector3 = [
    (minLdu[0] + maxLdu[0]) / 2,
    (minLdu[1] + maxLdu[1]) / 2,
    (minLdu[2] + maxLdu[2]) / 2,
  ];
  const centerLdu = transformLduPoint(part.transform, localCenter);
  const localHalf: LduVector3 = [
    (maxLdu[0] - minLdu[0]) / 2,
    (maxLdu[1] - minLdu[1]) / 2,
    (maxLdu[2] - minLdu[2]) / 2,
  ];
  // Every proper orientation is a signed permutation, so boxes remain axis
  // aligned even when a former vertical dimension becomes horizontal.
  const orientation = getProperOrientation(part.transform.orientationId);
  const rotatedHalf = rotateLduVector(orientation.matrix, localHalf);
  const halfExtentsLdu: LduVector3 = [
    Math.abs(rotatedHalf[0]),
    Math.abs(rotatedHalf[1]),
    Math.abs(rotatedHalf[2]),
  ];

  return { kind: "box", halfExtentsLdu, centerLdu };
}

function shapeInBodySpace(shape: BodyShape, origin: LduVector3): BodyShape {
  const centerLdu = subtract(shape.centerLdu, origin);
  if (shape.kind === "cylinder") return { ...shape, centerLdu };
  if (shape.kind === "box") return { ...shape, centerLdu };
  if (shape.kind === "convex-hull") {
    return {
      ...shape,
      centerLdu,
      verticesLdu: shape.verticesLdu.map((vertex) => subtract(vertex, origin)),
    };
  }
  if (shape.kind === "convex-prism") {
    return {
      ...shape,
      centerLdu,
      verticesXZLdu: shape.verticesXZLdu.map(([x, z]) => [x - origin[0], z - origin[2]] as const),
      minYLdu: shape.minYLdu - origin[1],
      maxYLdu: shape.maxYLdu - origin[1],
    };
  }
  return {
    ...shape,
    centerLdu,
    // Moving the frame moves the plane with it.
    cutOffsetLdu:
      shape.cutOffsetLdu - (shape.cutNormalXZ[0] * origin[0] + shape.cutNormalXZ[1] * origin[2]),
  };
}

export interface DerivePhysicsSceneOptions {
  readonly validConnections: readonly ConnectionEdge[];
}

export function derivePhysicsScene(
  document: BrickDocumentV1,
  graph: AssemblyGraph,
  { validConnections }: DerivePhysicsSceneOptions,
): PhysicsScene {
  const partById = new Map(document.parts.map((part) => [part.id, part] as const));

  const bodies = graph.components.map((component) => {
    let massGrams = 0;
    const weighted: [number, number, number] = [0, 0, 0];
    const worldShapes: BodyShape[] = [];

    for (const partId of component.partIds) {
      const part = partById.get(partId);
      if (!part) continue;
      const definition = getPartDefinition(part.catalogPartId);
      if (!definition) continue;

      const mass = partMassGrams(definition);
      const centre = transformLduPoint(
        part.transform,
        partMassProperties(definition).centerOfMassLdu,
      );
      massGrams += mass;
      weighted[0] += centre[0] * mass;
      weighted[1] += centre[1] * mass;
      weighted[2] += centre[2] * mass;

      for (const primitive of definition.collision.primitives) {
        worldShapes.push(worldShape(part, primitive));
      }
    }

    const originLdu: LduVector3 =
      massGrams === 0
        ? [0, 0, 0]
        : [weighted[0] / massGrams, weighted[1] / massGrams, weighted[2] / massGrams];

    return {
      id: component.id,
      partIds: component.partIds,
      originLdu,
      massGrams,
      shapes: worldShapes.map((shape) => shapeInBodySpace(shape, originLdu)),
    } satisfies CompoundBody;
  });

  const originByBodyId = new Map(bodies.map((body) => [body.id, body.originLdu] as const));
  const connectionById = new Map(
    validConnections.map((connection) => [connection.id, connection] as const),
  );

  const joints = graph.joints.flatMap((joint) => {
    const connection = connectionById.get(joint.connectionId);
    if (!connection) return [];
    const aPart = partById.get(connection.a.partId);
    const bPart = partById.get(connection.b.partId);
    if (!aPart || !bPart) return [];

    const aFrame = getConnectorWorldFrame(aPart, connection.a.portId);
    const bFrame = getConnectorWorldFrame(bPart, connection.b.portId);
    const aOrigin = originByBodyId.get(joint.componentIds[0]);
    const bOrigin = originByBodyId.get(joint.componentIds[1]);
    if (!aOrigin || !bOrigin) return [];

    return [
      {
        connectionId: joint.connectionId,
        bodyIds: joint.componentIds,
        anchorsLdu: [subtract(aFrame.positionLdu, aOrigin), subtract(bFrame.positionLdu, bOrigin)],
        axisLdu: aFrame.normal,
        allowedRotation: joint.allowedRotation,
      } satisfies PhysicsJoint,
    ];
  });

  return { schemaVersion: COMPOUND_BODY_SCHEMA_VERSION, bodies, joints };
}
