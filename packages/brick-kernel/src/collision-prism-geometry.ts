import type { LduVector3 } from "@lego-studio/catalog";
import type { PartInstance } from "@lego-studio/protocol";

import {
  axisAlignedStudIntersectsVerticalPrism,
  type CollisionAxis,
  type VerticalPrismBounds,
} from "./axis-stud-collision.ts";

export interface PrimitiveBounds {
  readonly min: LduVector3;
  readonly max: LduVector3;
}

export type Point2 = readonly [first: number, second: number];
export type AxisIndex = 0 | 1 | 2;

export const COLLISION_AXES = ["x", "y", "z"] as const;

export interface WorldBody extends PrimitiveBounds {
  readonly kind: "body";
  readonly part: PartInstance;
  readonly primitiveId: string;
  readonly sourceIndex: number;
  /** World axis along which the exact convex section is extruded. */
  readonly prismAxis: CollisionAxis;
  readonly prismAxisIndex: AxisIndex;
  /** The two ascending world-coordinate indices represented by each section point. */
  readonly sectionAxisIndices: readonly [AxisIndex, AxisIndex];
  readonly minAlongPrismAxis: number;
  readonly maxAlongPrismAxis: number;
  /** Exact convex section in `sectionAxisIndices`; local Y need not remain world Y. */
  readonly section: readonly Point2[];
}

const uprightPrismBoundsByBody = new WeakMap<WorldBody, VerticalPrismBounds>();

function uprightPrismBounds(body: WorldBody): VerticalPrismBounds {
  const existing = uprightPrismBoundsByBody.get(body);
  if (existing) return existing;
  const bounds: VerticalPrismBounds = {
    get min() {
      return body.min;
    },
    get max() {
      return body.max;
    },
    get sectionXZ() {
      return body.section;
    },
  };
  uprightPrismBoundsByBody.set(body, bounds);
  return bounds;
}

export interface WorldStud extends PrimitiveBounds {
  readonly kind: "stud";
  readonly part: PartInstance;
  readonly primitiveId: string;
  readonly sourceIndex: number;
  readonly center: LduVector3;
  readonly radiusLdu: number;
  readonly validatedConnectionProfileRadiusLdu?: number;
  readonly axis: CollisionAxis;
}

export type WorldPrimitive = WorldBody | WorldStud;

export function axisIndexForUnitVector(vector: LduVector3): AxisIndex | undefined {
  const nonzero = vector
    .map((coordinate, index) => ({ coordinate, index }))
    .filter(({ coordinate }) => coordinate !== 0);
  if (nonzero.length !== 1 || Math.abs(nonzero[0]!.coordinate) !== 1) return undefined;
  return nonzero[0]!.index as AxisIndex;
}

export function otherAxisIndices(axisIndex: AxisIndex): readonly [AxisIndex, AxisIndex] {
  if (axisIndex === 0) return [1, 2];
  if (axisIndex === 1) return [0, 2];
  return [0, 1];
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

function signedPolygonArea(polygon: readonly Point2[]): number {
  let total = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    total += current[0] * next[1] - next[0] * current[1];
  }
  return total / 2;
}

function counterClockwise(polygon: readonly Point2[]): readonly Point2[] {
  return signedPolygonArea(polygon) < 0 ? [...polygon].reverse() : polygon;
}

function edgeSide(edgeStart: Point2, edgeEnd: Point2, point: Point2): number {
  return (
    (edgeEnd[0] - edgeStart[0]) * (point[1] - edgeStart[1]) -
    (edgeEnd[1] - edgeStart[1]) * (point[0] - edgeStart[0])
  );
}

/** Sutherland-Hodgman clipping against one directed edge of a CCW polygon. */
function clipByEdge(
  polygon: readonly Point2[],
  edgeStart: Point2,
  edgeEnd: Point2,
): readonly Point2[] {
  const clipped: Point2[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!;
    const currentSide = edgeSide(edgeStart, edgeEnd, current);
    const previousSide = edgeSide(edgeStart, edgeEnd, previous);
    const currentIn = currentSide >= 0;
    const previousIn = previousSide >= 0;
    if (currentIn !== previousIn) {
      const denominator = previousSide - currentSide;
      const t = denominator === 0 ? 0 : previousSide / denominator;
      clipped.push([
        previous[0] + t * (current[0] - previous[0]),
        previous[1] + t * (current[1] - previous[1]),
      ]);
    }
    if (currentIn) clipped.push(current);
  }
  return clipped;
}

function convexIntersection(left: readonly Point2[], right: readonly Point2[]): readonly Point2[] {
  let intersection = counterClockwise(left);
  const clipper = counterClockwise(right);
  for (let index = 0; index < clipper.length && intersection.length > 0; index += 1) {
    intersection = clipByEdge(
      intersection,
      clipper[index]!,
      clipper[(index + 1) % clipper.length]!,
    );
  }
  return intersection;
}

function prismVertices(body: WorldBody): readonly LduVector3[] {
  const vertices: LduVector3[] = [];
  for (const [first, second] of body.section) {
    for (const along of [body.minAlongPrismAxis, body.maxAlongPrismAxis]) {
      const vertex: [number, number, number] = [0, 0, 0];
      vertex[body.prismAxisIndex] = along;
      vertex[body.sectionAxisIndices[0]] = first;
      vertex[body.sectionAxisIndices[1]] = second;
      vertices.push(vertex);
    }
  }
  return vertices;
}

function axisVector(axisIndex: AxisIndex): LduVector3 {
  return axisIndex === 0 ? [1, 0, 0] : axisIndex === 1 ? [0, 1, 0] : [0, 0, 1];
}

function cross(left: LduVector3, right: LduVector3): LduVector3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function sectionEdgeDirections(body: WorldBody): readonly LduVector3[] {
  return body.section.map((start, index) => {
    const end = body.section[(index + 1) % body.section.length]!;
    const direction: [number, number, number] = [0, 0, 0];
    direction[body.sectionAxisIndices[0]] = end[0] - start[0];
    direction[body.sectionAxisIndices[1]] = end[1] - start[1];
    return direction;
  });
}

function prismEdgeDirections(body: WorldBody): readonly LduVector3[] {
  return [axisVector(body.prismAxisIndex), ...sectionEdgeDirections(body)];
}

function prismFaceNormals(body: WorldBody): readonly LduVector3[] {
  const extrusionAxis = axisVector(body.prismAxisIndex);
  return [extrusionAxis, ...sectionEdgeDirections(body).map((edge) => cross(extrusionAxis, edge))];
}

const SAT_OVERLAP_EPSILON = 1e-9;

function separatedAlongAxis(
  leftVertices: readonly LduVector3[],
  rightVertices: readonly LduVector3[],
  axis: LduVector3,
): boolean {
  const length = Math.hypot(axis[0], axis[1], axis[2]);
  if (length <= SAT_OVERLAP_EPSILON) return false;
  const project = (point: LduVector3) =>
    (point[0] * axis[0] + point[1] * axis[1] + point[2] * axis[2]) / length;
  const left = leftVertices.map(project);
  const right = rightVertices.map(project);
  return (
    Math.min(Math.max(...left), Math.max(...right)) -
      Math.max(Math.min(...left), Math.min(...right)) <=
    SAT_OVERLAP_EPSILON
  );
}

/** Exact separating-axis test for two differently directed convex prisms. */
function differentlyDirectedPrismsOverlap(left: WorldBody, right: WorldBody): boolean {
  const leftVertices = prismVertices(left);
  const rightVertices = prismVertices(right);
  const candidateAxes: LduVector3[] = [...prismFaceNormals(left), ...prismFaceNormals(right)];
  for (const leftEdge of prismEdgeDirections(left)) {
    for (const rightEdge of prismEdgeDirections(right)) {
      candidateAxes.push(cross(leftEdge, rightEdge));
    }
  }
  return !candidateAxes.some((axis) => separatedAlongAxis(leftVertices, rightVertices, axis));
}

const OVERLAP_AREA_EPSILON = 1e-6;

/** Whether two convex prisms share positive volume, in any proper orientation. */
export function bodiesOverlap(left: WorldBody, right: WorldBody): boolean {
  if (left.prismAxis !== right.prismAxis) {
    return differentlyDirectedPrismsOverlap(left, right);
  }
  if (
    left.minAlongPrismAxis >= right.maxAlongPrismAxis ||
    right.minAlongPrismAxis >= left.maxAlongPrismAxis
  ) {
    return false;
  }
  const intersection = convexIntersection(left.section, right.section);
  return intersection.length >= 3 && polygonArea(intersection) > OVERLAP_AREA_EPSILON;
}

export function boundsOverlap(left: PrimitiveBounds, right: PrimitiveBounds): boolean {
  return (
    left.min[0] < right.max[0] &&
    right.min[0] < left.max[0] &&
    left.min[1] < right.max[1] &&
    right.min[1] < left.max[1] &&
    left.min[2] < right.max[2] &&
    right.min[2] < left.max[2]
  );
}

function remapIntoBodyPrismFrame(vector: LduVector3, body: WorldBody): LduVector3 {
  return [
    vector[body.sectionAxisIndices[0]],
    vector[body.prismAxisIndex],
    vector[body.sectionAxisIndices[1]],
  ];
}

export function studIntersectsBody(stud: WorldStud, body: WorldBody): boolean {
  if (
    body.prismAxisIndex === 1 &&
    body.sectionAxisIndices[0] === 0 &&
    body.sectionAxisIndices[1] === 2
  ) {
    return axisAlignedStudIntersectsVerticalPrism(stud, uprightPrismBounds(body));
  }
  const studWorldAxisIndex = COLLISION_AXES.indexOf(stud.axis) as AxisIndex;
  const worldToPrism = [
    body.sectionAxisIndices[0],
    body.prismAxisIndex,
    body.sectionAxisIndices[1],
  ] as const;
  const studPrismAxisIndex = worldToPrism.indexOf(studWorldAxisIndex) as AxisIndex;
  return axisAlignedStudIntersectsVerticalPrism(
    {
      ...stud,
      center: remapIntoBodyPrismFrame(stud.center, body),
      min: remapIntoBodyPrismFrame(stud.min, body),
      max: remapIntoBodyPrismFrame(stud.max, body),
      axis: COLLISION_AXES[studPrismAxisIndex],
    },
    {
      min: remapIntoBodyPrismFrame(body.min, body),
      max: remapIntoBodyPrismFrame(body.max, body),
      sectionXZ: body.section,
    },
  );
}
