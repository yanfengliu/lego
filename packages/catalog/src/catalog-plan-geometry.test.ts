import { describe, expect, it } from "vitest";

import {
  type CollisionConvexPrism,
  getPartDefinition,
  PART_DEFINITIONS,
  type PartDefinition,
  sampleBodyArcPlanBoundary,
  STUD_HEIGHT_LDU,
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
} from "./index.js";

/**
 * Which cells of a compound part's footprint carry a stud and which carry a
 * clutch, written out rather than recomputed.
 *
 * These are facts about the real parts, read off their LDraw solids: an arch
 * has a flat studded top over a void, so its middle cells hold a stud and no
 * clutch and its legs hold both; a corner plate's missing quarter holds
 * neither. Deriving them here the way the catalog derives them would assert
 * only that the code agrees with itself.
 */
const COMPOUND_CELLS: Readonly<
  Record<string, { readonly studs: readonly string[]; readonly clutches: readonly string[] }>
> = {
  "builtin:arch-1x4": { studs: ["0:0", "0:1", "0:2", "0:3"], clutches: ["0:0", "0:3"] },
  "builtin:arch-1x6": {
    studs: ["0:0", "0:1", "0:2", "0:3", "0:4", "0:5"],
    clutches: ["0:0", "0:5"],
  },
  "builtin:curved-slope-1x2": { studs: [], clutches: ["0:0", "0:1"] },
  "builtin:curved-slope-1x3": { studs: [], clutches: ["0:0", "0:1", "0:2"] },
  "builtin:curved-slope-1x4": { studs: [], clutches: ["0:0", "0:1", "0:2", "0:3"] },
  "builtin:cheese-slope-1x1": { studs: [], clutches: ["0:0"] },
  "builtin:cheese-slope-2x1": { studs: [], clutches: ["0:0", "1:0"] },
  "builtin:corner-plate-2x2": {
    studs: ["0:0", "0:1", "1:0"],
    clutches: ["0:0", "0:1", "1:0"],
  },
};

/**
 * Connector cells whose complete stud circle is backed. A wedge's sloped edge
 * may contain the centre while failing to support the incoming stud footprint.
 */
const cellHoldsStudFootprint = (part: PartDefinition, x: number, z: number): boolean => {
  const wedge = part.collision.primitives.find((primitive) => primitive.kind === "wedge");
  if (!wedge) return true;
  return [
    [x - STUD_RADIUS_LDU, z - STUD_RADIUS_LDU],
    [x + STUD_RADIUS_LDU, z - STUD_RADIUS_LDU],
    [x + STUD_RADIUS_LDU, z + STUD_RADIUS_LDU],
    [x - STUD_RADIUS_LDU, z + STUD_RADIUS_LDU],
  ].every(
    ([cornerX, cornerZ]) =>
      wedge.cutNormalXZ[0] * cornerX! + wedge.cutNormalXZ[1] * cornerZ! <= wedge.cutOffsetLdu,
  );
};

const solidCellCount = (part: PartDefinition): number => {
  if (NO_CLUTCH_FAMILIES.has(part.family)) return 0;
  if (part.geometry.clutchOffsetsLdu !== undefined) return part.geometry.clutchOffsetsLdu.length;
  const compound = COMPOUND_CELLS[part.id];
  if (compound) return compound.clutches.length;
  const { widthStuds, lengthStuds } = part.dimensions;
  const wedge = part.collision.primitives.find((primitive) => primitive.kind === "wedge");
  if (!wedge) return widthStuds * lengthStuds;
  let count = 0;
  for (let xIndex = 0; xIndex < widthStuds; xIndex += 1) {
    for (let zIndex = 0; zIndex < lengthStuds; zIndex += 1) {
      const x = (xIndex - (widthStuds - 1) / 2) * STUD_PITCH_LDU;
      const z = (zIndex - (lengthStuds - 1) / 2) * STUD_PITCH_LDU;
      if (cellHoldsStudFootprint(part, x, z)) count += 1;
    }
  }
  return count;
};

const expectedStudCells = (part: PartDefinition): number => {
  const compound = COMPOUND_CELLS[part.id];
  if (compound) return compound.studs.length;
  if (SMOOTH_TOP_FAMILIES.has(part.family)) return 0;
  return part.geometry.studOffsetsLdu?.length ?? solidCellCount(part);
};

const SMOOTH_TOP_FAMILIES = new Set<string>([
  "tile",
  "grille-tile",
  "axle",
  "wheel",
  "curved-slope",
  "cheese-slope",
]);
const NO_CLUTCH_FAMILIES = new Set<string>(["axle", "wheel"]);

const planSignedTwiceArea = (vertices: readonly (readonly [number, number])[]): number =>
  vertices.reduce((area, [x, z], index) => {
    const [nextX, nextZ] = vertices[(index + 1) % vertices.length]!;
    return area + x * nextZ - nextX * z;
  }, 0);

const pointInConvexPlan = (
  [x, z]: readonly [number, number],
  vertices: readonly (readonly [number, number])[],
): boolean =>
  vertices.every(([x0, z0], index) => {
    const [x1, z1] = vertices[(index + 1) % vertices.length]!;
    return (x1 - x0) * (z - z0) - (z1 - z0) * (x - x0) >= -1e-8;
  });

const convexPlansHaveInteriorOverlap = (
  left: readonly (readonly [number, number])[],
  right: readonly (readonly [number, number])[],
): boolean => {
  for (const polygon of [left, right]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const [x0, z0] = polygon[index]!;
      const [x1, z1] = polygon[(index + 1) % polygon.length]!;
      const axisX = -(z1 - z0);
      const axisZ = x1 - x0;
      const leftProjection = left.map(([x, z]) => x * axisX + z * axisZ);
      const rightProjection = right.map(([x, z]) => x * axisX + z * axisZ);
      if (
        Math.max(...leftProjection) <= Math.min(...rightProjection) + 1e-8 ||
        Math.max(...rightProjection) <= Math.min(...leftProjection) + 1e-8
      ) {
        return false;
      }
    }
  }
  return true;
};

describe("catalog plan geometry", () => {
  it("does not infer wedge connectors from a centre whose stud footprint crosses the cut", () => {
    const left = getPartDefinition("builtin:wedge-plate-2x4-left");
    expect(left).toBeDefined();
    expect(
      left!.connectors
        .filter(({ kind }) => kind === "undersideClutch")
        .map(({ positionLdu }) => [positionLdu[0], positionLdu[2]]),
    ).toEqual([
      [-10, -30],
      [-10, -10],
      [-10, 10],
      [-10, 30],
      [10, 30],
    ]);
    expect(
      left!.connectors.some(
        ({ kind, positionLdu }) =>
          kind === "undersideClutch" && positionLdu[0] === 10 && positionLdu[2] === 10,
      ),
    ).toBe(false);
  });

  it("places one semantic stud and one underside tube seat at every grid point", () => {
    for (const part of PART_DEFINITIONS) {
      const { widthStuds, lengthStuds, heightLdu } = part.dimensions;
      const expectedPortCount = solidCellCount(part);
      // A jumper plate names its studs, so its count is what it declared, not
      // one per grid point.
      const expectedStudCount = expectedStudCells(part);
      const compound = COMPOUND_CELLS[part.id];
      const studs = part.connectors.filter(({ kind }) => kind === "stud");
      const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch");

      expect(studs).toHaveLength(expectedStudCount);
      expect(clutches).toHaveLength(expectedPortCount);

      // Irregular parts declare their complete connector lists. Dedicated
      // measured-facts assertions below check every location; no rectangular
      // grid may be synthesized around those declarations here.
      if (part.geometry.clutchOffsetsLdu !== undefined) continue;

      for (let xIndex = 0; xIndex < widthStuds; xIndex += 1) {
        for (let zIndex = 0; zIndex < lengthStuds; zIndex += 1) {
          const x = (xIndex - (widthStuds - 1) / 2) * STUD_PITCH_LDU;
          const z = (zIndex - (lengthStuds - 1) / 2) * STUD_PITCH_LDU;
          const stud = studs.find(({ id }) => id === `stud:${xIndex}:${zIndex}`);
          const clutch = clutches.find(({ id }) => id === `undersideClutch:${xIndex}:${zIndex}`);
          // An axle has no underside and no top, so no cell holds either.
          if (NO_CLUTCH_FAMILIES.has(part.family)) {
            expect(stud).toBeUndefined();
            expect(clutch).toBeUndefined();
            continue;
          }
          // A wedge's tapered corner is empty, so it holds neither.
          if (!cellHoldsStudFootprint(part, x, z)) {
            expect(stud).toBeUndefined();
            expect(clutch).toBeUndefined();
            continue;
          }
          // A compound part's two faces are independent: an arch's span is
          // studded above and open below.
          if (compound) {
            const cell = `${xIndex}:${zIndex}`;
            expect([cell, stud === undefined]).toEqual([cell, !compound.studs.includes(cell)]);
            expect([cell, clutch === undefined]).toEqual([cell, !compound.clutches.includes(cell)]);
            if (clutch === undefined) continue;
            expect(clutch).toMatchObject({
              geometryRole: "tubeSeat",
              positionLdu: [x, heightLdu / 2, z],
              normal: [0, 1, 0],
            });
            continue;
          }

          if (!SMOOTH_TOP_FAMILIES.has(part.family) && part.geometry.studOffsetsLdu === undefined)
            expect(stud).toMatchObject({
              geometryRole: "stud",
              positionLdu: [x, -heightLdu / 2, z],
              normal: [0, -1, 0],
              capacity: 1,
              compatibleKinds: ["undersideClutch"],
            });
          expect(clutch).toMatchObject({
            geometryRole: "tubeSeat",
            positionLdu: [x, heightLdu / 2, z],
            normal: [0, 1, 0],
            capacity: 1,
            compatibleKinds: ["stud"],
          });
        }
      }
    }
  });

  it("provides body and stud collision primitives with connection-gated clearances", () => {
    for (const part of PART_DEFINITIONS) {
      const expectedStudCount = expectedStudCells(part);
      const body = part.collision.primitives.find(({ id }) => id === "body");
      // Tagged, not merely round: a wheel's body is a cylinder and not a stud.
      const studs = part.collision.primitives.filter(
        (primitive) => primitive.kind === "cylinder" && primitive.tag === "stud",
      );

      // A wedge is the same bounding box with one face sloped away, so its
      // bounds still have to match; only its kind differs.
      // A wheel is round so it can roll; everything else is a box or a wedge.
      const expectedBodyKind =
        part.family === "wheel"
          ? "cylinder"
          : part.geometry.bodyMode === "arc-prism"
            ? "convex-prism"
            : part.geometry.bodyMode === "compound"
              ? "wedge"
              : "box";
      if (part.geometry.bodyArc !== undefined) {
        expect(body).toBeUndefined();
        expect(
          part.collision.primitives
            .filter(({ tag }) => tag === "body")
            .every(({ kind }) => kind === "convex-prism"),
        ).toBe(true);
      } else if (part.geometry.bodyBoxesLdu === undefined) {
        expect(body).toMatchObject(
          expectedBodyKind === "cylinder"
            ? { kind: "cylinder", tag: "body" }
            : {
                kind: expectedBodyKind,
                minLdu: part.bodyBoundsLdu.min,
                maxLdu: part.bodyBoundsLdu.max,
              },
        );
      } else {
        // A union has no single body, so it numbers its boxes; the part that
        // keeps the unnumbered "body" is the part that is one prism, which is
        // why sixty-three parts did not re-hash when unions arrived.
        expect(body).toBeUndefined();
        expect(part.geometry.bodyMode).toBe("compound");
        expect(
          part.collision.primitives
            .filter(({ tag }) => tag === "body")
            .map((primitive) => [primitive.id, primitive.kind]),
        ).toEqual(part.geometry.bodyBoxesLdu.map((_, index) => [`body:${index}`, "box"]));
      }
      expect(studs).toHaveLength(expectedStudCount);
      // One per cell the body fills: a wedge has no clutch over its empty corner.
      expect(part.collision.allowances).toHaveLength(solidCellCount(part));

      for (const allowance of part.collision.allowances) {
        expect(allowance).toMatchObject({
          portKind: "undersideClutch",
          incomingPrimitiveTag: "stud",
          requiresValidatedConnection: true,
          maxInsertionDepthLdu: STUD_HEIGHT_LDU,
        });
        expect(
          part.connectors.some(
            (port) => port.id === allowance.portId && port.kind === "undersideClutch",
          ),
        ).toBe(true);
      }
    }
  });

  it("builds a compound body from boxes that neither overlap nor leave their footprint", () => {
    const compoundParts = PART_DEFINITIONS.filter(
      (part) => part.geometry.bodyBoxesLdu !== undefined,
    );
    expect(compoundParts.map(({ id }) => id)).toEqual(Object.keys(COMPOUND_CELLS));

    for (const part of compoundParts) {
      const boxes = part.geometry.bodyBoxesLdu!;
      expect(boxes.length).toBeGreaterThan(1);

      for (const box of boxes) {
        for (const axis of [0, 1, 2] as const) {
          expect(box.min[axis]).toBeLessThan(box.max[axis]);
          // Inside the part's own bounding box, so no box can reach past the
          // footprint the lattice reserved for it.
          expect(box.min[axis]).toBeGreaterThanOrEqual(part.bodyBoundsLdu.min[axis]);
          expect(box.max[axis]).toBeLessThanOrEqual(part.bodyBoundsLdu.max[axis]);
        }
      }

      // The union is the declared body, on every axis: a shape that fell short
      // would leave the part reporting a bounding box it does not fill.
      for (const axis of [0, 1, 2] as const) {
        expect(Math.min(...boxes.map(({ min }) => min[axis]))).toBe(part.bodyBoundsLdu.min[axis]);
        expect(Math.max(...boxes.map(({ max }) => max[axis]))).toBe(part.bodyBoundsLdu.max[axis]);
      }

      // Disjoint interiors, because mass and centre of mass add the boxes up
      // and an overlap would be counted twice.
      for (let left = 0; left < boxes.length; left += 1) {
        for (let right = left + 1; right < boxes.length; right += 1) {
          const a = boxes[left]!;
          const b = boxes[right]!;
          const overlaps = ([0, 1, 2] as const).every(
            (axis) => a.min[axis] < b.max[axis] && b.min[axis] < a.max[axis],
          );
          expect([part.id, left, right, overlaps]).toEqual([part.id, left, right, false]);
        }
      }
    }
  });

  it("derives bounded, disjoint conservative prisms from each smooth body arc", () => {
    const arcParts = [
      getPartDefinition("builtin:corner-plate-4x4-round")!,
      getPartDefinition("builtin:corner-plate-5x5-quarter-ring")!,
    ];
    const primitiveCosts: number[] = [];

    for (const part of arcParts) {
      const feature = part.geometry.bodyArc!;
      const bodyPrisms = part.collision.primitives.filter(
        (primitive): primitive is CollisionConvexPrism => primitive.kind === "convex-prism",
      );
      const delta =
        ((feature.endAngleDegrees - feature.startAngleDegrees) * Math.PI) /
        180 /
        feature.segmentCount;
      const outerOverclaim = feature.outerRadiusLdu * (1 / Math.cos(delta / 2) - 1);
      const innerOverclaim = feature.innerRadiusLdu * (1 - Math.cos(delta / 2));
      const maxRadialOverclaimLdu = Math.max(outerOverclaim, innerOverclaim);

      expect(feature.segmentCount).toBe(12);
      expect(maxRadialOverclaimLdu).toBeLessThanOrEqual(0.2);
      primitiveCosts.push(bodyPrisms.length);
      expect(bodyPrisms).toHaveLength(
        feature.segmentCount + (feature.capRectanglesLdu?.length ?? 0),
      );

      for (const primitive of bodyPrisms) {
        expect(primitive.verticesXZLdu.length).toBeGreaterThanOrEqual(3);
        expect(primitive.verticesXZLdu.length).toBeLessThanOrEqual(8);
        expect(primitive.verticesXZLdu.flat().every(Number.isFinite)).toBe(true);
        expect(primitive.verticesXZLdu.flat().every((value) => Math.abs(value) <= 10_000)).toBe(
          true,
        );
        expect(planSignedTwiceArea(primitive.verticesXZLdu)).toBeGreaterThan(0);
        for (let index = 0; index < primitive.verticesXZLdu.length; index += 1) {
          const [ax, az] =
            primitive.verticesXZLdu[
              (index + primitive.verticesXZLdu.length - 1) % primitive.verticesXZLdu.length
            ]!;
          const [bx, bz] = primitive.verticesXZLdu[index]!;
          const [cx, cz] = primitive.verticesXZLdu[(index + 1) % primitive.verticesXZLdu.length]!;
          expect((bx - ax) * (cz - bz) - (bz - az) * (cx - bx)).toBeGreaterThan(0);
        }
      }

      for (let left = 0; left < bodyPrisms.length; left += 1) {
        for (let right = left + 1; right < bodyPrisms.length; right += 1) {
          expect(
            convexPlansHaveInteriorOverlap(
              bodyPrisms[left]!.verticesXZLdu,
              bodyPrisms[right]!.verticesXZLdu,
            ),
            `${part.id}: ${bodyPrisms[left]!.id} vs ${bodyPrisms[right]!.id}`,
          ).toBe(false);
        }
      }

      // Every sampled point on both exact circular boundaries is inside the
      // conservative collision union. The collision may claim at most the
      // quantified radial error above, but it may never cut into the part.
      for (let sample = 0; sample <= 96; sample += 1) {
        const angle =
          ((feature.startAngleDegrees +
            (feature.endAngleDegrees - feature.startAngleDegrees) * (sample / 96)) *
            Math.PI) /
          180;
        const radii =
          feature.innerRadiusLdu === 0
            ? [0, feature.outerRadiusLdu / 2, feature.outerRadiusLdu]
            : [
                feature.innerRadiusLdu,
                (feature.innerRadiusLdu + feature.outerRadiusLdu) / 2,
                feature.outerRadiusLdu,
              ];
        for (const radius of radii) {
          const point = [
            feature.centerXZLdu[0] + radius * Math.cos(angle),
            feature.centerXZLdu[1] + radius * Math.sin(angle),
          ] as const;
          expect(
            bodyPrisms.some((primitive) => pointInConvexPlan(point, primitive.verticesXZLdu)),
            `${part.id}: missing exact point ${String(point)}`,
          ).toBe(true);
        }
      }

      for (const cap of feature.capRectanglesLdu ?? []) {
        for (const point of [
          cap.minXZLdu,
          [cap.maxXZLdu[0], cap.minXZLdu[1]] as const,
          cap.maxXZLdu,
          [cap.minXZLdu[0], cap.maxXZLdu[1]] as const,
        ]) {
          expect(
            bodyPrisms.some((primitive) => pointInConvexPlan(point, primitive.verticesXZLdu)),
          ).toBe(true);
        }
      }

      const smoothOutline = sampleBodyArcPlanBoundary(feature, 2);
      expect(planSignedTwiceArea(smoothOutline)).toBeGreaterThan(0);
      expect(
        smoothOutline.every(
          (point, index) =>
            index === 0 ||
            point[0] !== smoothOutline[index - 1]![0] ||
            point[1] !== smoothOutline[index - 1]![1],
        ),
      ).toBe(true);
    }

    expect(primitiveCosts).toEqual([12, 14]);
    expect(primitiveCosts.reduce((total, count) => total + count, 0)).toBe(26);
    expect(80 * (1 / Math.cos(Math.PI / 48) - 1)).toBeCloseTo(0.1716536646, 9);
    expect(60 * (1 - Math.cos(Math.PI / 48))).toBeCloseTo(0.1284646057, 9);

    const filledOutline = sampleBodyArcPlanBoundary(arcParts[0]!.geometry.bodyArc!, 2);
    expect(filledOutline).toHaveLength(26);
    expect(filledOutline[0]).toEqual([-40, 40]);
    const ringOutline = sampleBodyArcPlanBoundary(arcParts[1]!.geometry.bodyArc!, 2);
    expect(ringOutline).toContainEqual([-20, -80]);
    expect(ringOutline).toContainEqual([-20, -60]);
    expect(ringOutline).toContainEqual([80, 20]);
    expect(ringOutline).toContainEqual([60, 20]);
    expect(ringOutline[0]).not.toEqual(ringOutline[ringOutline.length - 1]);
    expect(() => sampleBodyArcPlanBoundary(arcParts[0]!.geometry.bodyArc!, 0)).toThrow(
      /samplesPerSegment/,
    );
  });
});
