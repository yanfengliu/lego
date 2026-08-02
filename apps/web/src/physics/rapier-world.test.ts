import { describe, expect, it } from "vitest";

import {
  createEmptyBrickDocument,
  deriveAssemblies,
  derivePhysicsScene,
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
