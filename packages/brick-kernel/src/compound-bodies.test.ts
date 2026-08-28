import {
  PROPER_ORIENTATIONS,
  getPartDefinition,
  type CollisionPrimitive,
  type LduVector3,
} from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { deriveAssemblies } from "./assemblies.ts";
import {
  COMPOUND_BODY_SCHEMA_VERSION,
  derivePhysicsScene,
  type BodyShape,
} from "./compound-bodies.ts";
import { createEmptyBrickDocument } from "./factory.ts";
import { transformLduPoint } from "./transforms.ts";

/**
 * The descriptors an engine is handed. Mass distribution is the thing worth
 * asserting directly: getting a chassis's balance point wrong is a bug that
 * survives every geometry test and only shows up as a vehicle that tips.
 */
const part = (
  id: string,
  catalogPartId: string,
  positionLdu: readonly [number, number, number],
  orientationId = "upright-yaw-0",
) =>
  ({
    id,
    catalogPartId,
    colorId: "builtin:light-bluish-gray",
    transform: { positionLdu, orientationId },
    submodelId: "root",
    stepId: "step-1",
    semanticTags: [],
    provenance: { source: "manual" },
  }) satisfies PartInstance;

const edge = (
  id: string,
  aPartId: string,
  aPortId: string,
  bPartId: string,
  bPortId: string,
): ConnectionEdge => ({
  id,
  kind: "stud-tube",
  a: { partId: aPartId, portId: aPortId },
  b: { partId: bPartId, portId: bPortId },
  provenance: { source: "manual" },
});

const documentOf = (parts: readonly PartInstance[]): BrickDocumentV1 => ({
  ...createEmptyBrickDocument({ id: "physics", name: "Physics" }),
  parts: [...parts],
});

const sceneOf = (parts: readonly PartInstance[], validConnections: readonly ConnectionEdge[]) => {
  const document = documentOf(parts);
  const graph = deriveAssemblies(document, { validConnections });
  return derivePhysicsScene(document, graph, { validConnections });
};

type PlanPoint = readonly [x: number, z: number];
type SectionPrimitive = Extract<CollisionPrimitive, { kind: "wedge" | "convex-prism" }>;
type SectionShape = Extract<BodyShape, { kind: "wedge" | "convex-prism" | "convex-hull" }>;

function clipPlan(
  polygon: readonly PlanPoint[],
  [nx, nz]: readonly [number, number],
  offset: number,
): readonly PlanPoint[] {
  const inside = ([x, z]: PlanPoint) => nx * x + nz * z <= offset;
  const clipped: PlanPoint[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!;
    if (inside(current) !== inside(previous)) {
      const here = nx * current[0] + nz * current[1] - offset;
      const there = nx * previous[0] + nz * previous[1] - offset;
      const t = there / (there - here);
      clipped.push([
        previous[0] + t * (current[0] - previous[0]),
        previous[1] + t * (current[1] - previous[1]),
      ]);
    }
    if (inside(current)) clipped.push(current);
  }
  return clipped;
}

function primitiveVertices(primitive: SectionPrimitive): readonly LduVector3[] {
  const plan =
    primitive.kind === "convex-prism"
      ? primitive.verticesXZLdu
      : clipPlan(
          [
            [primitive.minLdu[0], primitive.minLdu[2]],
            [primitive.maxLdu[0], primitive.minLdu[2]],
            [primitive.maxLdu[0], primitive.maxLdu[2]],
            [primitive.minLdu[0], primitive.maxLdu[2]],
          ],
          primitive.cutNormalXZ,
          primitive.cutOffsetLdu,
        );
  const [minY, maxY] =
    primitive.kind === "convex-prism"
      ? [primitive.minYLdu, primitive.maxYLdu]
      : [primitive.minLdu[1], primitive.maxLdu[1]];
  return plan.flatMap(([x, z]) => [[x, minY, z] as const, [x, maxY, z] as const]);
}

function shapeVertices(shape: SectionShape): readonly LduVector3[] {
  if (shape.kind === "convex-hull") return shape.verticesLdu;
  const plan =
    shape.kind === "convex-prism"
      ? shape.verticesXZLdu
      : clipPlan(
          [
            [
              shape.centerLdu[0] - shape.halfExtentsLdu[0],
              shape.centerLdu[2] - shape.halfExtentsLdu[2],
            ],
            [
              shape.centerLdu[0] + shape.halfExtentsLdu[0],
              shape.centerLdu[2] - shape.halfExtentsLdu[2],
            ],
            [
              shape.centerLdu[0] + shape.halfExtentsLdu[0],
              shape.centerLdu[2] + shape.halfExtentsLdu[2],
            ],
            [
              shape.centerLdu[0] - shape.halfExtentsLdu[0],
              shape.centerLdu[2] + shape.halfExtentsLdu[2],
            ],
          ],
          shape.cutNormalXZ,
          shape.cutOffsetLdu,
        );
  const [minY, maxY] =
    shape.kind === "convex-prism"
      ? [shape.minYLdu, shape.maxYLdu]
      : [
          shape.centerLdu[1] - shape.halfExtentsLdu[1],
          shape.centerLdu[1] + shape.halfExtentsLdu[1],
        ];
  return plan.flatMap(([x, z]) => [[x, minY, z] as const, [x, maxY, z] as const]);
}

const pointKeys = (vertices: readonly LduVector3[]) =>
  vertices.map((vertex) => vertex.map((coordinate) => coordinate.toFixed(8)).join(",")).sort();

describe("derivePhysicsScene", () => {
  it("makes one body per rigid component, not one per part", () => {
    const scene = sceneOf(
      [
        part("a", "builtin:brick-2x4", [0, 0, 0]),
        part("b", "builtin:brick-2x4", [0, -24, 0]),
        part("loose", "builtin:brick-2x4", [400, 0, 0]),
      ],
      [edge("ab", "a", "stud:0:0", "b", "undersideClutch:0:0")],
    );

    expect(scene.bodies).toHaveLength(2);
    expect(scene.bodies[0]!.partIds).toEqual(["a", "b"]);
    expect(scene.joints).toEqual([]);
  });

  it("adds up the mass of everything welded together", () => {
    const one = sceneOf([part("a", "builtin:brick-2x4", [0, 0, 0])], []);
    const two = sceneOf(
      [part("a", "builtin:brick-2x4", [0, 0, 0]), part("b", "builtin:brick-2x4", [0, -24, 0])],
      [edge("ab", "a", "stud:0:0", "b", "undersideClutch:0:0")],
    );

    expect(two.bodies[0]!.massGrams).toBeCloseTo(one.bodies[0]!.massGrams * 2, 6);
  });

  it("puts the body origin at the balance point, and moves it when mass moves", () => {
    // Two identical bricks side by side balance between them; make one of them
    // heavier by using a longer part and the balance point must slide toward it.
    const even = sceneOf(
      [part("a", "builtin:brick-2x4", [-40, 0, 0]), part("b", "builtin:brick-2x4", [40, 0, 0])],
      [],
    );
    expect(even.bodies).toHaveLength(2);

    const welded = sceneOf(
      [part("a", "builtin:plate-2x2", [-40, 0, 0]), part("b", "builtin:plate-2x8", [40, 0, 0])],
      [edge("ab", "a", "stud:0:0", "b", "undersideClutch:0:0")],
    );

    // One body, balancing nearer the heavier half rather than midway.
    expect(welded.bodies).toHaveLength(1);
    expect(welded.bodies[0]!.originLdu[0]).toBeGreaterThan(0);
  });

  it("gives shapes in body space, so they move with the body", () => {
    // A single part's shapes are centred on its own balance point, wherever the
    // part sits in the document.
    const near = sceneOf([part("a", "builtin:brick-2x4", [0, 0, 0])], []);
    const far = sceneOf([part("a", "builtin:brick-2x4", [200, 0, 400])], []);

    expect(far.bodies[0]!.originLdu[0]).toBeCloseTo(near.bodies[0]!.originLdu[0]! + 200, 6);
    expect(far.bodies[0]!.shapes).toHaveLength(near.bodies[0]!.shapes.length);
    far.bodies[0]!.shapes.forEach((shape, index) => {
      const same = near.bodies[0]!.shapes[index]!;
      expect(shape.kind).toBe(same.kind);
      for (const axis of [0, 1, 2]) {
        expect(shape.centerLdu[axis]).toBeCloseTo(same.centerLdu[axis]!, 6);
      }
    });
  });

  it("anchors a joint where the two connectors actually meet", () => {
    const parts = [
      part("bearing", "builtin:technic-brick-1x2", [0, 0, 0]),
      // Placed so the axle's first port really lands in the hole: the port is
      // 10 LDU along the shaft, and the hole is at the brick's centre, 2 LDU
      // above its middle. An edge that only claims a join would fail the anchor
      // check below, which is the point of checking it.
      part("shaft", "builtin:axle-1x2", [10, -2, 0]),
    ];
    const connections = [edge("spin", "shaft", "axle:0", "bearing", "pinHole:0")];
    const scene = sceneOf(parts, connections);

    expect(scene.bodies).toHaveLength(2);
    expect(scene.joints).toHaveLength(1);
    const joint = scene.joints[0]!;
    expect(joint.allowedRotation).toBe("continuous");

    // Both anchors name the same point in the document once each is put back
    // into its own body's frame — that is what makes it one joint.
    const [aAnchor, bAnchor] = joint.anchorsLdu;
    const aOrigin = scene.bodies.find(({ id }) => id === joint.bodyIds[0])!.originLdu;
    const bOrigin = scene.bodies.find(({ id }) => id === joint.bodyIds[1])!.originLdu;
    for (const axis of [0, 1, 2]) {
      expect(aAnchor[axis]! + aOrigin[axis]!).toBeCloseTo(bAnchor[axis]! + bOrigin[axis]!, 6);
    }
  });

  it("carries a wedge's sloped face into body space", () => {
    const scene = sceneOf([part("w", "builtin:wedge-plate-2x4-left", [0, 0, 0])], []);
    const wedge = scene.bodies[0]!.shapes.find((shape) => shape.kind === "wedge");

    expect(wedge).toBeDefined();
    // The body origin is the wedge's balance point, which is off the box centre,
    // so the plane offset must have shifted with it rather than staying at 40.
    expect(wedge!.cutOffsetLdu).not.toBe(40);
  });

  it("carries an arc decomposition into body-space convex prisms", () => {
    const scene = sceneOf(
      [part("ring", "builtin:corner-plate-5x5-quarter-ring", [120, -8, -60])],
      [],
    );
    const prisms = scene.bodies[0]!.shapes.filter((shape) => shape.kind === "convex-prism");

    expect(scene.schemaVersion).toBe(COMPOUND_BODY_SCHEMA_VERSION);
    expect(COMPOUND_BODY_SCHEMA_VERSION).toBe("lego.compound-bodies/4");
    expect(prisms).toHaveLength(14);
    expect(prisms.every(({ verticesXZLdu }) => verticesXZLdu.length >= 4)).toBe(true);
    expect(prisms.every(({ minYLdu, maxYLdu }) => minYLdu < maxYLdu)).toBe(true);
  });

  it.each(PROPER_ORIENTATIONS)(
    "preserves wedge and convex-prism vertices under $id",
    (orientation) => {
      for (const catalogPartId of [
        "builtin:wedge-plate-2x4-left",
        "builtin:corner-plate-5x5-quarter-ring",
      ]) {
        const sourcePart = part("shape", catalogPartId, [37, -19, 53], orientation.id);
        const scene = sceneOf([sourcePart], []);
        const body = scene.bodies[0]!;
        const definition = getPartDefinition(catalogPartId)!;
        const primitives = definition.collision.primitives.filter(
          (primitive): primitive is SectionPrimitive =>
            primitive.kind === "wedge" || primitive.kind === "convex-prism",
        );
        const shapes = body.shapes.filter(
          (shape): shape is SectionShape =>
            shape.kind === "wedge" || shape.kind === "convex-prism" || shape.kind === "convex-hull",
        );

        expect(shapes).toHaveLength(primitives.length);
        primitives.forEach((primitive, index) => {
          const expected = primitiveVertices(primitive).map((vertex) => {
            const world = transformLduPoint(sourcePart.transform, vertex);
            return [
              world[0] - body.originLdu[0],
              world[1] - body.originLdu[1],
              world[2] - body.originLdu[2],
            ] as const;
          });
          expect(pointKeys(shapeVertices(shapes[index]!))).toEqual(pointKeys(expected));
        });

        if (Math.abs(orientation.matrix[4]) === 1) {
          expect(shapes.every(({ kind }) => kind !== "convex-hull")).toBe(true);
        } else {
          expect(shapes.every(({ kind }) => kind === "convex-hull")).toBe(true);
        }
      }
    },
  );

  it("carries a trusted non-upright proper transform through box and cylinder shapes", () => {
    const upright = sceneOf([part("upright", "builtin:brick-1x2", [0, 0, 0])], []);
    const turned = sceneOf(
      [part("turned", "builtin:brick-1x2", [0, 0, 0], "proper-m-p0000p0n0")],
      [],
    );
    const uprightBoxes = upright.bodies[0]!.shapes.filter((shape) => shape.kind === "box");
    const turnedBoxes = turned.bodies[0]!.shapes.filter((shape) => shape.kind === "box");
    const turnedCylinders = turned.bodies[0]!.shapes.filter((shape) => shape.kind === "cylinder");

    expect(turnedBoxes.map(({ halfExtentsLdu }) => halfExtentsLdu)).toEqual(
      uprightBoxes.map(({ halfExtentsLdu: [x, y, z] }) => [x, z, y]),
    );
    expect(turnedCylinders.length).toBeGreaterThan(0);
    expect(turnedCylinders.every(({ axis }) => axis === "z")).toBe(true);
  });

  it("rejects an unknown orientation before deriving compound shapes", () => {
    expect(() =>
      sceneOf([part("hostile", "builtin:brick-1x1", [0, 0, 0], "unknown-proper-id")], []),
    ).toThrow(/Unknown proper orientation: unknown-proper-id/u);
  });

  it("describes an empty document without inventing a body", () => {
    const scene = sceneOf([], []);

    expect(scene.bodies).toEqual([]);
    expect(scene.joints).toEqual([]);
  });
});
