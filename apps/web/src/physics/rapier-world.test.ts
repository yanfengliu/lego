import { describe, expect, it, vi } from "vitest";

import {
  createEmptyBrickDocument,
  deriveAssemblies,
  derivePhysicsScene,
  type PhysicsScene,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { createSimulation } from "./rapier-world";

/**
 * Does the translation actually run.
 *
 * The kernel's descriptors are tested on their own; these check that Rapier
 * agrees — that a body falls the right way, that the ground stops it, that a
 * weld holds and a revolute joint does not.
 *
 * Falling the right way is worth a test on its own: LDU is Y-down and the
 * solver is Y-up, so a sign error makes a model rise instead, and nothing in
 * the kernel would notice.
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

const sceneOf = (parts: readonly PartInstance[], validConnections: readonly ConnectionEdge[]) => {
  const document: BrickDocumentV1 = {
    ...createEmptyBrickDocument({ id: "sim", name: "Sim" }),
    parts: [...parts],
  };
  const graph = deriveAssemblies(document, { validConnections });
  return derivePhysicsScene(document, graph, { validConnections });
};

/** Runs a second of simulation at a fixed step, so a run is repeatable. */
const settle = (simulation: { step(seconds: number): void }, steps = 60) => {
  for (let index = 0; index < steps; index += 1) simulation.step(1 / 60);
};

describe("createSimulation", () => {
  it("reports which convex prism Rapier rejected and how to fix it", async () => {
    const invalidScene: PhysicsScene = {
      schemaVersion: "lego.compound-bodies/2",
      bodies: [
        {
          id: "assembly:degenerate-ring",
          partIds: ["degenerate-ring"],
          originLdu: [0, 0, 0],
          massGrams: 1,
          shapes: [
            {
              kind: "convex-prism",
              verticesXZLdu: [
                [0, 0],
                [0, 0],
                [0, 0],
              ],
              minYLdu: -4,
              maxYLdu: 4,
              centerLdu: [0, 0, 0],
            },
          ],
        },
      ],
      joints: [],
    };

    await expect(createSimulation(invalidScene)).rejects.toThrow(
      "Rapier rejected the convex-prism collider for body assembly:degenerate-ring: 3 plan vertices with Y bounds [-4, 4] did not form a finite three-dimensional hull; provide at least three non-collinear finite plan vertices and distinct finite Y bounds",
    );
  }, 30_000);

  it("rejects malformed wedges with actionable context and frees the partial world", async () => {
    const rapier = await import("@dimforge/rapier3d-compat");
    await rapier.init();
    const free = vi.spyOn(rapier.World.prototype, "free");
    const invalidScene: PhysicsScene = {
      schemaVersion: "lego.compound-bodies/2",
      bodies: [
        {
          id: "assembly:non-finite-wedge",
          partIds: ["non-finite-wedge"],
          originLdu: [0, 0, 0],
          massGrams: 1,
          shapes: [
            {
              kind: "wedge",
              halfExtentsLdu: [Number.POSITIVE_INFINITY, 4, 40],
              centerLdu: [0, 0, 0],
              cutNormalXZ: [1, -1],
              cutOffsetLdu: 20,
            },
          ],
        },
      ],
      joints: [],
    };

    try {
      await expect(createSimulation(invalidScene)).rejects.toThrow(
        "Rapier could not build the wedge collider for body assembly:non-finite-wedge: half-extents [Infinity, 4, 40], center [0, 0, 0], cut normal [1, -1], and cut offset 20 must all be finite, every half-extent must be positive, and the cut normal must be non-zero",
      );
      expect(free).toHaveBeenCalledTimes(1);
    } finally {
      free.mockRestore();
    }
  }, 30_000);

  it("drops a body downward, not upward", async () => {
    // LDU is Y-down, so falling means y increases.
    const simulation = await createSimulation(
      sceneOf([part("a", "builtin:brick-2x4", [0, 0, 0])], []),
    );
    const before = simulation.poses().get("assembly:a")!.positionLdu[1];
    settle(simulation);
    const after = simulation.poses().get("assembly:a")!.positionLdu[1];

    expect(after).toBeGreaterThan(before);
    simulation.dispose();
  }, 30_000);

  it("lands a body on the plate and leaves it there", async () => {
    const simulation = await createSimulation(
      sceneOf([part("a", "builtin:brick-2x4", [0, -200, 0])], []),
      { groundYLdu: 12 },
    );
    settle(simulation, 240);
    const landed = simulation.poses().get("assembly:a")!.positionLdu[1];
    settle(simulation, 120);
    const later = simulation.poses().get("assembly:a")!.positionLdu[1];

    // Came to rest above the plate rather than falling through it.
    expect(landed).toBeLessThan(12);
    expect(later).toBeCloseTo(landed, 0);
    simulation.dispose();
  }, 30_000);

  it("builds and simulates the quarter-ring convex hulls", async () => {
    const scene = sceneOf(
      [part("ring", "builtin:corner-plate-5x5-quarter-ring", [0, -100, 0])],
      [],
    );
    expect(scene.bodies[0]!.shapes.filter(({ kind }) => kind === "convex-prism")).toHaveLength(14);

    const simulation = await createSimulation(scene, { groundYLdu: 12 });
    settle(simulation, 180);
    expect(simulation.poses().get("assembly:ring")!.positionLdu[1]).toBeLessThan(12);
    simulation.dispose();
  }, 30_000);

  it("keeps a welded pair as one body, so they cannot drift apart", async () => {
    const scene = sceneOf(
      [part("a", "builtin:brick-2x4", [0, 0, 0]), part("b", "builtin:brick-2x4", [0, -24, 0])],
      [edge("ab", "a", "stud:0:0", "b", "undersideClutch:0:0")],
    );
    expect(scene.bodies).toHaveLength(1);

    const simulation = await createSimulation(scene);
    settle(simulation);

    // One body means there is nothing that could come apart.
    expect(simulation.poses().size).toBe(1);
    simulation.dispose();
  }, 30_000);

  it("lets an axle turn in its bearing while the bearing is held still", async () => {
    const scene = sceneOf(
      [
        part("bearing", "builtin:technic-brick-1x2", [0, 0, 0]),
        part("shaft", "builtin:axle-1x2", [10, -2, 0]),
      ],
      [edge("spin", "shaft", "axle:0", "bearing", "pinHole:0")],
    );
    expect(scene.joints).toHaveLength(1);

    const bearingId = scene.bodies.find(({ partIds }) => partIds.includes("bearing"))!.id;
    const shaftId = scene.bodies.find(({ partIds }) => partIds.includes("shaft"))!.id;
    const simulation = await createSimulation(scene, { fixedBodyIds: [bearingId] });
    settle(simulation, 120);

    const bearing = simulation.poses().get(bearingId)!;
    const shaft = simulation.poses().get(shaftId)!;

    // The bearing is pinned, so it has not moved at all.
    expect(bearing.positionLdu[1]).toBeCloseTo(scene.bodies[0]!.originLdu[1]!, 3);
    // The shaft hangs off it: the joint holds its anchor, so it cannot simply
    // fall away, but it is free to swing about the axis.
    const anchorDrift = Math.hypot(
      shaft.positionLdu[0] - 10,
      shaft.positionLdu[1] - -2,
      shaft.positionLdu[2] - 0,
    );
    expect(anchorDrift).toBeLessThan(40);
    simulation.dispose();
  }, 30_000);

  it("refuses to step after disposal rather than crashing in the solver", async () => {
    const simulation = await createSimulation(
      sceneOf([part("a", "builtin:brick-2x4", [0, 0, 0])], []),
    );
    simulation.dispose();

    expect(() => simulation.step(1 / 60)).toThrow(/disposed/);
  }, 30_000);
});
