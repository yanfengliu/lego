import type { CollisionPrimitive, LduVector3, PartDefinition } from "./types.ts";

/**
 * What a part weighs and where it balances, from the solid it already declares.
 *
 * Derived rather than stored, so there is nothing to keep in step with the body
 * and nothing new in the geometry digest. A union of prisms has an exact volume
 * and an exact centroid; this is arithmetic on data that exists.
 *
 * The volume is of the *modelled* solid, and the model is solid where a real
 * brick is hollow. A 2x4 brick comes out around 5 g against a real 2.4 g, so
 * `estimatedMassGrams` is an over-estimate by roughly the wall fraction and is
 * a placeholder for a measured value, not a substitute for one — which is what
 * `inventory.knownMassGrams` is for.
 */

/** ABS, in grams per cubic centimetre. */
const ABS_DENSITY_G_PER_CM3 = 1.05;
/** One LDU is 0.4 mm, so one cubic LDU is 0.064 cubic mm. */
const CM3_PER_LDU3 = 0.4 ** 3 / 1000;

export interface MassProperties {
  /** Volume of the modelled solid. Studs count; the hollow interior does not. */
  readonly solidVolumeLdu3: number;
  /** Volume-weighted centroid, in LDU from the part's origin. */
  readonly centerOfMassLdu: LduVector3;
  /** An over-estimate: see the note above. */
  readonly estimatedMassGrams: number;
}

interface Piece {
  readonly volume: number;
  readonly centroid: LduVector3;
}

/** The corners of a wedge's cross-section, clipped by its sloped face. */
function wedgeSection(
  primitive: Extract<CollisionPrimitive, { kind: "wedge" }>,
): readonly (readonly [number, number])[] {
  const [nx, nz] = primitive.cutNormalXZ;
  const corners: (readonly [number, number])[] = [
    [primitive.minLdu[0], primitive.minLdu[2]],
    [primitive.maxLdu[0], primitive.minLdu[2]],
    [primitive.maxLdu[0], primitive.maxLdu[2]],
    [primitive.minLdu[0], primitive.maxLdu[2]],
  ];
  const inside = ([x, z]: readonly [number, number]) => nx * x + nz * z <= primitive.cutOffsetLdu;
  const section: (readonly [number, number])[] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const current = corners[index]!;
    const previous = corners[(index + 3) % 4]!;
    if (inside(current) !== inside(previous)) {
      const here = nx * current[0] + nz * current[1] - primitive.cutOffsetLdu;
      const there = nx * previous[0] + nz * previous[1] - primitive.cutOffsetLdu;
      const t = there / (there - here);
      section.push([
        previous[0] + t * (current[0] - previous[0]),
        previous[1] + t * (current[1] - previous[1]),
      ]);
    }
    if (inside(current)) section.push(current);
  }
  return section;
}

/** Signed area and centroid of a simple polygon, by the shoelace formula. */
function polygonAreaAndCentroid(polygon: readonly (readonly [number, number])[]): {
  area: number;
  x: number;
  z: number;
} {
  let twiceArea = 0;
  let cx = 0;
  let cz = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const [x0, z0] = polygon[index]!;
    const [x1, z1] = polygon[(index + 1) % polygon.length]!;
    const cross = x0 * z1 - x1 * z0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
    cz += (z0 + z1) * cross;
  }
  if (twiceArea === 0) return { area: 0, x: 0, z: 0 };
  return { area: Math.abs(twiceArea) / 2, x: cx / (3 * twiceArea), z: cz / (3 * twiceArea) };
}

function pieceOf(primitive: CollisionPrimitive): Piece | null {
  if (primitive.kind === "cylinder") {
    const volume = Math.PI * primitive.radiusLdu ** 2 * primitive.heightLdu;
    return { volume, centroid: primitive.centerLdu };
  }
  const minY = primitive.kind === "convex-prism" ? primitive.minYLdu : primitive.minLdu[1];
  const maxY = primitive.kind === "convex-prism" ? primitive.maxYLdu : primitive.maxLdu[1];
  const height = maxY - minY;
  const midY = (minY + maxY) / 2;
  if (primitive.kind === "box") {
    const volume =
      (primitive.maxLdu[0] - primitive.minLdu[0]) *
      height *
      (primitive.maxLdu[2] - primitive.minLdu[2]);
    return {
      volume,
      centroid: [
        (primitive.minLdu[0] + primitive.maxLdu[0]) / 2,
        midY,
        (primitive.minLdu[2] + primitive.maxLdu[2]) / 2,
      ],
    };
  }
  const section =
    primitive.kind === "convex-prism" ? primitive.verticesXZLdu : wedgeSection(primitive);
  if (section.length < 3) return null;
  const { area, x, z } = polygonAreaAndCentroid(section);
  return { volume: area * height, centroid: [x, midY, z] };
}

/**
 * Assumes the body primitives do not overlap each other, which is how parts are
 * authored here: a part is a union of disjoint prisms plus the studs standing on
 * top of them. Overlapping bodies would be double-counted.
 */
export function partMassProperties(part: PartDefinition): MassProperties {
  const pieces = part.collision.primitives
    .map(pieceOf)
    .filter((piece): piece is Piece => piece !== null);
  const solidVolumeLdu3 = pieces.reduce((total, piece) => total + piece.volume, 0);
  if (solidVolumeLdu3 === 0) {
    return { solidVolumeLdu3: 0, centerOfMassLdu: [0, 0, 0], estimatedMassGrams: 0 };
  }

  const weighted = pieces.reduce<[number, number, number]>(
    (total, piece) => [
      total[0] + piece.centroid[0] * piece.volume,
      total[1] + piece.centroid[1] * piece.volume,
      total[2] + piece.centroid[2] * piece.volume,
    ],
    [0, 0, 0],
  );

  return {
    solidVolumeLdu3,
    centerOfMassLdu: [
      weighted[0] / solidVolumeLdu3,
      weighted[1] / solidVolumeLdu3,
      weighted[2] / solidVolumeLdu3,
    ],
    estimatedMassGrams: solidVolumeLdu3 * CM3_PER_LDU3 * ABS_DENSITY_G_PER_CM3,
  };
}

/** What physics should use: a measured mass where one exists, the estimate otherwise. */
export function partMassGrams(part: PartDefinition): number {
  return part.inventory.knownMassGrams ?? partMassProperties(part).estimatedMassGrams;
}
