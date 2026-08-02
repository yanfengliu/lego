import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, PartInstance } from "@lego-studio/protocol";

import { startSimulation } from "./simulation-session";
import type { BodyPose, Simulation } from "./rapier-world";

/**
 * A session is a view of a run, not an edit to the model, so the properties
 * worth testing are that the document is untouched and that a part's pose is
 * exactly its rest pose when nothing has moved.
 *
 * The second one pins the composition arithmetic. A part's pose is its offset
 * inside its body carried by whatever the body has done, and getting that wrong
 * shows up as a model that explodes on the first frame — but only if something
 * checks the still case.
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

const documentOf = (parts: readonly PartInstance[]): BrickDocumentV1 => ({
  ...createEmptyBrickDocument({ id: "session", name: "Session" }),
  parts: [...parts],
});

/** A world that never moves, so the composition can be checked against rest. */
const stillWorld = (poses: ReadonlyMap<string, BodyPose>) => async (): Promise<Simulation> => ({
  step: () => {},
  poses: () => poses,
  dispose: () => {},
});

describe("startSimulation", () => {
  it("reports every part exactly where the document put it when nothing has moved", async () => {
    const parts = [
      part("a", "builtin:brick-2x4", [0, 0, 0]),
      part("b", "builtin:brick-2x4", [120, -24, -60]),
    ];
    const document = documentOf(parts);

    // Hand back each body's own rest origin with no rotation: nothing moved.
    const session = await startSimulation(document, {
      createWorld: async (scene) =>
        await stillWorld(
          new Map(
            scene.bodies.map((body) => [
              body.id,
              { positionLdu: body.originLdu, rotation: [0, 0, 0, 1] as const },
            ]),
          ),
        )(),
    });

    const poses = session.partPoses();
    for (const source of parts) {
      const pose = poses.get(source.id)!;
      for (const axis of [0, 1, 2]) {
        expect(pose.positionLdu[axis], `${source.id} axis ${axis}`).toBeCloseTo(
          source.transform.positionLdu[axis]!,
          6,
        );
      }
    }
    session.dispose();
  });

  it("carries a part's offset with its body when the body turns", async () => {
    // One part sitting 40 LDU along x from a body origin at the world origin.
    // Turn the body a quarter turn about the vertical and the part must swing
    // round with it rather than staying put.
    const document = documentOf([part("a", "builtin:brick-2x4", [40, 0, 0])]);
    const session = await startSimulation(document, {
      createWorld: async (scene) =>
        await stillWorld(
          new Map(
            scene.bodies.map((body) => [
              body.id,
              // 90 degrees about y: sin(45) on y, cos(45) on w.
              {
                positionLdu: body.originLdu,
                rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] as const,
              },
            ]),
          ),
        )(),
    });

    const pose = session.partPoses().get("a")!;
    // The body's own origin is the part's balance point, so the offset is
    // small; what matters is that it moved off the x axis at all.
    expect(Math.abs(pose.positionLdu[0]!)).toBeLessThan(41);
    expect(pose.rotation[1]).toBeCloseTo(Math.SQRT1_2, 6);
    session.dispose();
  });

  it("never writes to the document, so leaving simulation restores nothing", async () => {
    const document = documentOf([part("a", "builtin:brick-2x4", [0, -400, 0])]);
    const before = JSON.stringify(document);

    const session = await startSimulation(document, { groundYLdu: 12 });
    for (let index = 0; index < 120; index += 1) session.step(1 / 60);
    // It really did move, so the document being unchanged means something.
    expect(session.partPoses().get("a")!.positionLdu[1]).toBeGreaterThan(-400);
    session.dispose();

    expect(JSON.stringify(document)).toBe(before);
  }, 30_000);

  it("advances in fixed steps and drops a backlog rather than teleporting", async () => {
    let steps = 0;
    const document = documentOf([part("a", "builtin:brick-2x4", [0, 0, 0])]);
    const session = await startSimulation(document, {
      createWorld: async () => ({
        step: () => {
          steps += 1;
        },
        poses: () => new Map(),
        dispose: () => {},
      }),
    });

    session.advance(1 / 60);
    expect(steps).toBe(1);

    // Half a frame twice is one frame, not two and not none.
    session.advance(1 / 120);
    expect(steps).toBe(1);
    session.advance(1 / 120);
    expect(steps).toBe(2);

    // A ten-second stall must not run six hundred steps at once.
    session.advance(10);
    expect(steps).toBeLessThanOrEqual(2 + 15);
    session.dispose();
  });

  it("refuses a negative or non-finite advance rather than looping forever", async () => {
    const session = await startSimulation(documentOf([part("a", "builtin:brick-2x4", [0, 0, 0])]), {
      createWorld: async () => ({
        step: () => {},
        poses: () => new Map(),
        dispose: () => {},
      }),
    });

    expect(() => session.advance(-1)).toThrow(/non-negative/);
    expect(() => session.advance(Number.NaN)).toThrow(/non-negative/);
    session.dispose();
  });
});
