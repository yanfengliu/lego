import {
  deriveAssemblies,
  derivePhysicsScene,
  validBrickConnections,
  type PhysicsScene,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { createSimulation, type CreateSimulationOptions, type Simulation } from "./rapier-world";

/**
 * A run of the simulation, as something to look at rather than something that
 * happens to the model.
 *
 * The document is never touched. A session reads it once, builds bodies from
 * it, and afterwards reports only where those bodies have got to — so leaving
 * simulation mode restores nothing, because nothing changed. That is the whole
 * reason to do it this way: "restore" as an operation could fail or be
 * interrupted, and an operation that does not exist cannot.
 *
 * It also sidesteps a real conflict. Positions here are integers on a stud
 * lattice; a solver produces a brick resting at 23.37 and tilted four degrees,
 * which is not a lattice position and never will be. Keeping simulated poses
 * out of the document keeps that arithmetic exact.
 */

export interface PartPose {
  readonly positionLdu: readonly [number, number, number];
  /** Quaternion x y z w, in the document's own -Y-up frame. */
  readonly rotation: readonly [number, number, number, number];
}

export interface SimulationSession {
  readonly scene: PhysicsScene;
  step(seconds: number): void;
  /** Advances by a fixed step as many times as `seconds` allows. */
  advance(seconds: number): void;
  /** Where every part has got to. Display only — never write these back. */
  partPoses(): ReadonlyMap<string, PartPose>;
  dispose(): void;
}

/** Sixty hertz, fixed, so a run does not depend on how fast frames arrive. */
const FIXED_STEP_SECONDS = 1 / 60;
/** Never simulate more than a quarter second of catch-up in one call. */
const MAX_CATCHUP_STEPS = 15;

function rotateByQuaternion(
  [x, y, z]: readonly [number, number, number],
  [qx, qy, qz, qw]: readonly [number, number, number, number],
): [number, number, number] {
  // v + 2q_v x (q_v x v + w v), the standard form that avoids building a matrix.
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

export interface StartSimulationOptions extends CreateSimulationOptions {
  /** Injected so a test can run the session without a solver. */
  readonly createWorld?: (
    scene: PhysicsScene,
    options: CreateSimulationOptions,
  ) => Promise<Simulation>;
}

export async function startSimulation(
  document: BrickDocumentV1,
  options: StartSimulationOptions = {},
): Promise<SimulationSession> {
  const validConnections = validBrickConnections(document);
  const graph = deriveAssemblies(document, { validConnections });
  const scene = derivePhysicsScene(document, graph, { validConnections });
  const { createWorld = createSimulation, ...worldOptions } = options;
  const world = await createWorld(scene, worldOptions);

  // Where each part sat inside its body when the run started. A part's pose is
  // that offset carried by whatever the body has since done, so the parts of one
  // body cannot drift apart no matter how long it runs.
  const restOffsets = new Map<string, { bodyId: string; offsetLdu: [number, number, number] }>();
  const restOrigins = new Map<string, readonly [number, number, number]>();
  for (const body of scene.bodies) {
    restOrigins.set(body.id, body.originLdu);
    for (const partId of body.partIds) {
      const part = document.parts.find(({ id }) => id === partId);
      if (!part) continue;
      restOffsets.set(partId, {
        bodyId: body.id,
        offsetLdu: [
          part.transform.positionLdu[0] - body.originLdu[0],
          part.transform.positionLdu[1] - body.originLdu[1],
          part.transform.positionLdu[2] - body.originLdu[2],
        ],
      });
    }
  }

  let carrySeconds = 0;
  let disposed = false;

  return {
    scene,
    step(seconds: number) {
      if (disposed) throw new Error("Cannot step a simulation session that has been disposed");
      world.step(seconds);
    },
    advance(seconds: number) {
      if (disposed) throw new Error("Cannot advance a simulation session that has been disposed");
      if (!Number.isFinite(seconds) || seconds < 0) {
        throw new RangeError(
          `A simulation advances by a non-negative finite number of seconds, not ${seconds}`,
        );
      }
      carrySeconds += seconds;
      let steps = 0;
      while (carrySeconds >= FIXED_STEP_SECONDS && steps < MAX_CATCHUP_STEPS) {
        world.step(FIXED_STEP_SECONDS);
        carrySeconds -= FIXED_STEP_SECONDS;
        steps += 1;
      }
      // A long stall must not turn into a burst of catch-up that teleports
      // everything; drop the backlog instead and carry on from now.
      if (steps === MAX_CATCHUP_STEPS) carrySeconds = 0;
    },
    partPoses() {
      const bodies = world.poses();
      const poses = new Map<string, PartPose>();
      for (const [partId, { bodyId, offsetLdu }] of restOffsets) {
        const body = bodies.get(bodyId);
        const origin = restOrigins.get(bodyId);
        if (!body || !origin) continue;
        const carried = rotateByQuaternion(offsetLdu, body.rotation);
        poses.set(partId, {
          positionLdu: [
            body.positionLdu[0] + carried[0],
            body.positionLdu[1] + carried[1],
            body.positionLdu[2] + carried[2],
          ],
          rotation: body.rotation,
        });
      }
      return poses;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      world.dispose();
    },
  };
}
