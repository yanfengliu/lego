import type { BodyArcFeature, CollisionConvexPrism, LduBounds } from "./types.ts";

/** Twelve slices keep both boundaries of an 80/60 LDU quarter ring within 0.2 LDU. */
export const ARC_SEGMENTS_PER_QUARTER = 12;
export const GEOMETRY_EPSILON = 1e-9;
const MAX_CONVEX_PRISM_VERTICES = 8;
const MAX_COLLISION_COORDINATE_LDU = 10_000;

const polygonSignedTwiceArea = (vertices: readonly (readonly [number, number])[]): number =>
  vertices.reduce((area, [x, z], index) => {
    const [nextX, nextZ] = vertices[(index + 1) % vertices.length]!;
    return area + x * nextZ - nextX * z;
  }, 0);

const samePlanPoint = (
  left: readonly [number, number],
  right: readonly [number, number],
): boolean =>
  Math.abs(left[0] - right[0]) <= GEOMETRY_EPSILON &&
  Math.abs(left[1] - right[1]) <= GEOMETRY_EPSILON;

const validateBodyArcFeature = (feature: BodyArcFeature): void => {
  const values = [
    ...feature.centerXZLdu,
    feature.innerRadiusLdu,
    feature.outerRadiusLdu,
    feature.startAngleDegrees,
    feature.endAngleDegrees,
    feature.segmentCount,
  ];
  if (!values.every(Number.isFinite)) throw new Error("bodyArc values must all be finite");
  const sweepDegrees = feature.endAngleDegrees - feature.startAngleDegrees;
  if (
    feature.innerRadiusLdu < 0 ||
    feature.outerRadiusLdu <= feature.innerRadiusLdu ||
    sweepDegrees <= 0 ||
    sweepDegrees > 180 ||
    !Number.isInteger(feature.segmentCount) ||
    feature.segmentCount < 1 ||
    feature.segmentCount > 64
  ) {
    throw new Error(
      "bodyArc needs 0 <= inner < outer, a (0, 180] degree sweep, and 1..64 segments",
    );
  }
  for (const [index, cap] of (feature.capRectanglesLdu ?? []).entries()) {
    if (
      ![...cap.minXZLdu, ...cap.maxXZLdu].every(Number.isFinite) ||
      cap.minXZLdu[0] >= cap.maxXZLdu[0] ||
      cap.minXZLdu[1] >= cap.maxXZLdu[1]
    ) {
      throw new Error(`bodyArc cap ${index} must have finite, increasing bounds`);
    }
  }
};

const capContainsPlanPoint = (
  cap: NonNullable<BodyArcFeature["capRectanglesLdu"]>[number],
  [x, z]: readonly [number, number],
): boolean =>
  x >= cap.minXZLdu[0] - GEOMETRY_EPSILON &&
  x <= cap.maxXZLdu[0] + GEOMETRY_EPSILON &&
  z >= cap.minXZLdu[1] - GEOMETRY_EPSILON &&
  z <= cap.maxXZLdu[1] + GEOMETRY_EPSILON;

const capExteriorPath = (
  cap: NonNullable<BodyArcFeature["capRectanglesLdu"]>[number] | undefined,
  from: readonly [number, number],
  to: readonly [number, number],
): readonly (readonly [number, number])[] => {
  if (cap === undefined) return [to];
  const [minX, minZ] = cap.minXZLdu;
  const [maxX, maxZ] = cap.maxXZLdu;
  const onMinX =
    Math.abs(from[0] - minX) <= GEOMETRY_EPSILON && Math.abs(to[0] - minX) <= GEOMETRY_EPSILON;
  const onMaxX =
    Math.abs(from[0] - maxX) <= GEOMETRY_EPSILON && Math.abs(to[0] - maxX) <= GEOMETRY_EPSILON;
  if (onMinX || onMaxX) {
    const farX = onMinX ? maxX : minX;
    return [[farX, from[1]], [farX, to[1]], to];
  }
  const onMinZ =
    Math.abs(from[1] - minZ) <= GEOMETRY_EPSILON && Math.abs(to[1] - minZ) <= GEOMETRY_EPSILON;
  const onMaxZ =
    Math.abs(from[1] - maxZ) <= GEOMETRY_EPSILON && Math.abs(to[1] - maxZ) <= GEOMETRY_EPSILON;
  if (onMinZ || onMaxZ) {
    const farZ = onMinZ ? maxZ : minZ;
    return [[from[0], farZ], [to[0], farZ], to];
  }
  throw new Error("bodyArc cap must extend one endpoint between its inner and outer radii");
};

/**
 * Samples the exact smooth source feature as one counter-clockwise simple plan
 * outline. Collision tangent expansion is deliberately absent. Endpoint caps
 * are spliced into the outline, so renderers and previews never draw the
 * conservative collision decomposition or duplicate its seams.
 */
export const sampleBodyArcPlanBoundary = (
  feature: BodyArcFeature,
  samplesPerSegment = 1,
): readonly (readonly [x: number, z: number])[] => {
  validateBodyArcFeature(feature);
  if (!Number.isInteger(samplesPerSegment) || samplesPerSegment < 1 || samplesPerSegment > 16) {
    throw new Error("samplesPerSegment must be an integer from 1 through 16");
  }
  const sampleCount = feature.segmentCount * samplesPerSegment;
  const start = (feature.startAngleDegrees * Math.PI) / 180;
  const sweep = ((feature.endAngleDegrees - feature.startAngleDegrees) * Math.PI) / 180;
  const [centerX, centerZ] = feature.centerXZLdu;
  const point = (radius: number, angle: number): readonly [number, number] => [
    centerX + radius * Math.cos(angle),
    centerZ + radius * Math.sin(angle),
  ];
  const arc = (radius: number, reversed = false) =>
    Array.from({ length: sampleCount + 1 }, (_, index) => {
      const fraction = index / sampleCount;
      return point(radius, start + sweep * (reversed ? 1 - fraction : fraction));
    });
  const outer = arc(feature.outerRadiusLdu);
  if (feature.innerRadiusLdu === 0) {
    if ((feature.capRectanglesLdu?.length ?? 0) > 0) {
      throw new Error("a filled bodyArc cannot splice endpoint caps through a zero-radius centre");
    }
    const outline = [feature.centerXZLdu, ...outer];
    if (polygonSignedTwiceArea(outline) <= GEOMETRY_EPSILON) {
      throw new Error("sampled bodyArc boundary must be counter-clockwise with positive area");
    }
    return outline;
  }

  const innerReversed = arc(feature.innerRadiusLdu, true);
  const caps = feature.capRectanglesLdu ?? [];
  const capFor = (
    outerEndpoint: readonly [number, number],
    innerEndpoint: readonly [number, number],
  ) => {
    const matches = caps.filter(
      (cap) => capContainsPlanPoint(cap, outerEndpoint) && capContainsPlanPoint(cap, innerEndpoint),
    );
    if (matches.length > 1) throw new Error("bodyArc endpoint belongs to more than one cap");
    return matches[0];
  };
  const startCap = capFor(outer[0]!, innerReversed[innerReversed.length - 1]!);
  const endCap = capFor(outer[outer.length - 1]!, innerReversed[0]!);
  if (caps.some((cap) => cap !== startCap && cap !== endCap)) {
    throw new Error("every bodyArc cap must extend its start or end radial face");
  }

  const withAdjacentDuplicates: (readonly [number, number])[] = [
    ...outer,
    ...capExteriorPath(endCap, outer[outer.length - 1]!, innerReversed[0]!),
    ...innerReversed.slice(1),
    ...capExteriorPath(startCap, innerReversed[innerReversed.length - 1]!, outer[0]!),
  ];
  const outline = withAdjacentDuplicates.filter(
    (pointValue, index) =>
      index === 0 || !samePlanPoint(pointValue, withAdjacentDuplicates[index - 1]!),
  );
  if (outline.length > 1 && samePlanPoint(outline[0]!, outline[outline.length - 1]!)) outline.pop();
  if (polygonSignedTwiceArea(outline) <= GEOMETRY_EPSILON) {
    throw new Error("sampled bodyArc boundary must be counter-clockwise with positive area");
  }
  return outline;
};

const validateConvexPrism = (primitive: CollisionConvexPrism): CollisionConvexPrism => {
  const { verticesXZLdu: vertices } = primitive;
  if (
    !Number.isFinite(primitive.minYLdu) ||
    !Number.isFinite(primitive.maxYLdu) ||
    primitive.minYLdu >= primitive.maxYLdu
  ) {
    throw new Error(`${primitive.id} must have finite, increasing Y bounds`);
  }
  if (vertices.length < 3 || vertices.length > MAX_CONVEX_PRISM_VERTICES) {
    throw new Error(
      `${primitive.id} must have 3..${MAX_CONVEX_PRISM_VERTICES} plan vertices, got ${vertices.length}`,
    );
  }
  for (const [x, z] of vertices) {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      Math.abs(x) > MAX_COLLISION_COORDINATE_LDU ||
      Math.abs(z) > MAX_COLLISION_COORDINATE_LDU
    ) {
      throw new Error(`${primitive.id} has a non-finite or out-of-range plan vertex [${x}, ${z}]`);
    }
  }
  if (polygonSignedTwiceArea(vertices) <= GEOMETRY_EPSILON) {
    throw new Error(`${primitive.id} must have positive area and counter-clockwise vertices`);
  }
  for (let index = 0; index < vertices.length; index += 1) {
    const [ax, az] = vertices[(index + vertices.length - 1) % vertices.length]!;
    const [bx, bz] = vertices[index]!;
    const [cx, cz] = vertices[(index + 1) % vertices.length]!;
    const cross = (bx - ax) * (cz - bz) - (bz - az) * (cx - bx);
    if (cross <= GEOMETRY_EPSILON) {
      throw new Error(`${primitive.id} must be strictly convex at vertex ${index}`);
    }
  }
  return primitive;
};

const polygonsHaveInteriorOverlap = (
  left: readonly (readonly [number, number])[],
  right: readonly (readonly [number, number])[],
): boolean => {
  for (const polygon of [left, right]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const [x0, z0] = polygon[index]!;
      const [x1, z1] = polygon[(index + 1) % polygon.length]!;
      const axisX = -(z1 - z0);
      const axisZ = x1 - x0;
      const project = (vertices: readonly (readonly [number, number])[]) =>
        vertices.map(([x, z]) => x * axisX + z * axisZ);
      const leftProjection = project(left);
      const rightProjection = project(right);
      const leftMin = Math.min(...leftProjection);
      const leftMax = Math.max(...leftProjection);
      const rightMin = Math.min(...rightProjection);
      const rightMax = Math.max(...rightProjection);
      if (leftMax <= rightMin + GEOMETRY_EPSILON || rightMax <= leftMin + GEOMETRY_EPSILON) {
        return false;
      }
    }
  }
  return true;
};

/**
 * Conservatively decomposes one smooth arc source into disjoint vertical
 * prisms. Each slice uses an outer midpoint tangent (`R / cos(delta / 2)`) and
 * an inner chord, so the union contains the real sector on both boundaries.
 */
export const arcCollisionPrimitives = (
  feature: BodyArcFeature,
  bodyBoundsLdu: LduBounds,
): readonly CollisionConvexPrism[] => {
  validateBodyArcFeature(feature);
  const sweepDegrees = feature.endAngleDegrees - feature.startAngleDegrees;
  sampleBodyArcPlanBoundary(feature);

  const toRadians = Math.PI / 180;
  const start = feature.startAngleDegrees * toRadians;
  const delta = (sweepDegrees * toRadians) / feature.segmentCount;
  const tangentOuterRadius = feature.outerRadiusLdu / Math.cos(delta / 2);
  const [centerX, centerZ] = feature.centerXZLdu;
  const point = (radius: number, angle: number): readonly [number, number] => [
    centerX + radius * Math.cos(angle),
    centerZ + radius * Math.sin(angle),
  ];
  const primitives: CollisionConvexPrism[] = [];

  for (let index = 0; index < feature.segmentCount; index += 1) {
    const angle0 = start + delta * index;
    const angle1 = angle0 + delta;
    const outer0 = point(tangentOuterRadius, angle0);
    const outer1 = point(tangentOuterRadius, angle1);
    const vertices =
      feature.innerRadiusLdu === 0
        ? ([feature.centerXZLdu, outer0, outer1] as const)
        : ([
            point(feature.innerRadiusLdu, angle0),
            outer0,
            outer1,
            point(feature.innerRadiusLdu, angle1),
          ] as const);
    primitives.push(
      validateConvexPrism({
        id: `body:arc:${index}`,
        kind: "convex-prism",
        tag: "body",
        verticesXZLdu: vertices,
        minYLdu: bodyBoundsLdu.min[1],
        maxYLdu: bodyBoundsLdu.max[1],
      }),
    );
  }

  for (const [index, cap] of (feature.capRectanglesLdu ?? []).entries()) {
    const [[minX, minZ], [maxX, maxZ]] = [cap.minXZLdu, cap.maxXZLdu];
    if (![minX, minZ, maxX, maxZ].every(Number.isFinite) || minX >= maxX || minZ >= maxZ) {
      throw new Error(`bodyArc cap ${index} must have finite, increasing bounds`);
    }
    primitives.push(
      validateConvexPrism({
        id: `body:cap:${index}`,
        kind: "convex-prism",
        tag: "body",
        verticesXZLdu: [
          [minX, minZ],
          [maxX, minZ],
          [maxX, maxZ],
          [minX, maxZ],
        ],
        minYLdu: bodyBoundsLdu.min[1],
        maxYLdu: bodyBoundsLdu.max[1],
      }),
    );
  }

  for (let left = 0; left < primitives.length; left += 1) {
    for (let right = left + 1; right < primitives.length; right += 1) {
      if (
        polygonsHaveInteriorOverlap(
          primitives[left]!.verticesXZLdu,
          primitives[right]!.verticesXZLdu,
        )
      ) {
        throw new Error(
          `bodyArc collision prisms ${primitives[left]!.id} and ${primitives[right]!.id} overlap`,
        );
      }
    }
  }
  return primitives;
};
