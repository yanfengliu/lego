import { describe, expect, it } from "vitest";

import { deriveAssemblies } from "./assemblies.ts";
import { derivePhysicsScene } from "./compound-bodies.ts";
import { createEmptyBrickDocument } from "./factory.ts";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

/**
 * The descriptors an engine is handed. Mass distribution is the thing worth
 * asserting directly: getting a chassis's balance point wrong is a bug that
 * survives every geometry test and only shows up as a vehicle that tips.
 */
const part = (id: string, catalogPartId: string, positionLdu: readonly [number, number, number]) =>
  ({
    id,
    catalogPartId,
    colorId: "builtin:light-bluish-gray",
    transform: { positionLdu, orientationId: "upright-yaw-0" },
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

  it("describes an empty document without inventing a body", () => {
    const scene = sceneOf([], []);

    expect(scene.bodies).toEqual([]);
    expect(scene.joints).toEqual([]);
  });
});
