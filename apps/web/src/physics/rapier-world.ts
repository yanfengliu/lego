import type { BodyShape, PhysicsScene } from "@lego-studio/brick-kernel";

/**
 * Runs a `PhysicsScene` in Rapier.
 *
 * A translation, not a design: the kernel already decided what the bodies and
 * constraints are, and this only says them in one engine's vocabulary. Swapping
 * engines should touch this file and nothing above it.
 *
 * Units are centimetres, grams and seconds. Not LDU, because one LDU is 0.4 mm
 * and a solver tuned for metre-scale objects behaves badly when everything is a
 * few thousandths of a unit across; not metres, because then a brick is 0.03
 * units and the same problem appears. At a centimetre a 2x4 brick is about
 * 3.2 by 1.6, which is the range solvers are tuned for. Gravity is written in
 * the same system, so it is 981 rather than 9.81.
 */

/** One LDU is 0.4 mm, so 0.04 cm. */
const CM_PER_LDU = 0.04;
const GRAVITY_CM_PER_S2 = 981;

export interface BodyPose {
  /** Body origin in LDU, in the document's frame. */
  readonly positionLdu: readonly [number, number, number];
  /** Rotation as a quaternion, x y z w. */
  readonly rotation: readonly [number, number, number, number];
}

export interface Simulation {
  step(seconds: number): void;
  /** Where each body has got to, keyed by the component id it came from. */
  poses(): ReadonlyMap<string, BodyPose>;
  dispose(): void;
}

export interface CreateSimulationOptions {
  /**
   * The build plate's top surface in LDU. Bodies rest on it; without it every
   * assembly falls forever.
   */
  readonly groundYLdu?: number;
  /** Bodies that must not move, by component id — a baseplate, say. */
  readonly fixedBodyIds?: readonly string[];
}

type Rapier = typeof import("@dimforge/rapier3d-compat");

/**
 * LDU is Y-down and the simulation is Y-up, so every vertical coordinate flips
 * sign crossing this boundary. Doing it in one place is the only way it stays
 * consistent; doing it at each call site is how a model ends up falling upward.
 */
const toSimulation = (ldu: readonly [number, number, number]): [number, number, number] => [
  ldu[0] * CM_PER_LDU,
  -ldu[1] * CM_PER_LDU,
  ldu[2] * CM_PER_LDU,
];

const toLdu = (sim: { x: number; y: number; z: number }): [number, number, number] => [
  sim.x / CM_PER_LDU,
  -sim.y / CM_PER_LDU,
  sim.z / CM_PER_LDU,
];

/** A wedge's cross-section corners, so it can become a convex hull. */
function wedgeCorners(shape: Extract<BodyShape, { kind: "wedge" }>): [number, number][] {
  const [hx, , hz] = shape.halfExtentsLdu;
  const cx = shape.centerLdu[0];
  const cz = shape.centerLdu[2];
  const corners: [number, number][] = [
    [cx - hx, cz - hz],
    [cx + hx, cz - hz],
    [cx + hx, cz + hz],
    [cx - hx, cz + hz],
  ];
  const [nx, nz] = shape.cutNormalXZ;
  const inside = ([x, z]: [number, number]) => nx * x + nz * z <= shape.cutOffsetLdu;
  const section: [number, number][] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const current = corners[index]!;
    const previous = corners[(index + 3) % 4]!;
    if (inside(current) !== inside(previous)) {
      const here = nx * current[0] + nz * current[1] - shape.cutOffsetLdu;
      const there = nx * previous[0] + nz * previous[1] - shape.cutOffsetLdu;
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

function addCollider(
  rapier: Rapier,
  world: InstanceType<Rapier["World"]>,
  body: ReturnType<InstanceType<Rapier["World"]>["createRigidBody"]>,
  shape: BodyShape,
): void {
  if (shape.kind === "cylinder") {
    const descriptor = rapier.ColliderDesc.cylinder(
      (shape.heightLdu / 2) * CM_PER_LDU,
      shape.radiusLdu * CM_PER_LDU,
    )
      // Mass comes from the kernel, not from the collider's own volume, so the
      // engine never disagrees with what the catalog says a part weighs.
      .setDensity(0)
      .setTranslation(...toSimulation(shape.centerLdu));
    world.createCollider(descriptor, body);
    return;
  }

  if (shape.kind === "box") {
    const descriptor = rapier.ColliderDesc.cuboid(
      shape.halfExtentsLdu[0] * CM_PER_LDU,
      shape.halfExtentsLdu[1] * CM_PER_LDU,
      shape.halfExtentsLdu[2] * CM_PER_LDU,
    )
      .setDensity(0)
      .setTranslation(...toSimulation(shape.centerLdu));
    world.createCollider(descriptor, body);
    return;
  }

  const section = wedgeCorners(shape);
  if (section.length < 3) return;
  const topY = shape.centerLdu[1] - shape.halfExtentsLdu[1];
  const bottomY = shape.centerLdu[1] + shape.halfExtentsLdu[1];
  const points = new Float32Array(section.length * 6);
  section.forEach(([x, z], index) => {
    points.set(toSimulation([x, topY, z]), index * 3);
    points.set(toSimulation([x, bottomY, z]), (section.length + index) * 3);
  });
  const hull = rapier.ColliderDesc.convexHull(points);
  if (!hull) return;
  world.createCollider(hull.setDensity(0), body);
}

export async function createSimulation(
  scene: PhysicsScene,
  options: CreateSimulationOptions = {},
): Promise<Simulation> {
  const rapier = await import("@dimforge/rapier3d-compat");
  await rapier.init();

  const world = new rapier.World({ x: 0, y: -GRAVITY_CM_PER_S2, z: 0 });
  const fixed = new Set(options.fixedBodyIds ?? []);
  const bodies = new Map<string, ReturnType<typeof world.createRigidBody>>();

  for (const descriptor of scene.bodies) {
    const builder = fixed.has(descriptor.id)
      ? rapier.RigidBodyDesc.fixed()
      : rapier.RigidBodyDesc.dynamic();
    const body = world.createRigidBody(
      builder.setTranslation(...toSimulation(descriptor.originLdu)),
    );
    for (const shape of descriptor.shapes) addCollider(rapier, world, body, shape);
    // Colliders carry no density, so the body's whole mass is stated here and
    // is exactly what the catalog says. Rapier needs a non-zero mass for a
    // dynamic body, so a massless one would silently never move.
    if (!fixed.has(descriptor.id)) {
      body.setAdditionalMass(Math.max(descriptor.massGrams, 1e-6), true);
      // Bricks are small and fall fast, so a step can carry one clean through
      // whatever it was about to land on.
      body.enableCcd(true);
    }
    bodies.set(descriptor.id, body);
  }

  if (options.groundYLdu !== undefined) {
    // A slab, not a sheet. The first version was 20 micrometres thick and a
    // brick dropped from 8 cm moves 2 cm in a step, so it passed straight
    // through and kept going. Deep enough that nothing can cross it in one
    // step, positioned so its top face is the plate.
    const halfDepth = 50;
    const surfaceY = toSimulation([0, options.groundYLdu, 0])[1];
    const ground = world.createRigidBody(
      rapier.RigidBodyDesc.fixed().setTranslation(0, surfaceY - halfDepth, 0),
    );
    world.createCollider(rapier.ColliderDesc.cuboid(1000, halfDepth, 1000), ground);
  }

  for (const joint of scene.joints) {
    const a = bodies.get(joint.bodyIds[0]);
    const b = bodies.get(joint.bodyIds[1]);
    if (!a || !b) continue;
    const [ax, ay, az] = toSimulation(joint.anchorsLdu[0]);
    const [bx, by, bz] = toSimulation(joint.anchorsLdu[1]);
    // A direction, so it is scaled but not flipped in the same way a point is;
    // normalising keeps Rapier from rejecting a zero-length axis.
    const axis = toSimulation(joint.axisLdu);
    const length = Math.hypot(axis[0], axis[1], axis[2]) || 1;
    const params =
      joint.allowedRotation === "continuous"
        ? rapier.JointData.revolute(
            { x: ax, y: ay, z: az },
            { x: bx, y: by, z: bz },
            { x: axis[0] / length, y: axis[1] / length, z: axis[2] / length },
          )
        : rapier.JointData.fixed(
            { x: ax, y: ay, z: az },
            { w: 1, x: 0, y: 0, z: 0 },
            { x: bx, y: by, z: bz },
            { w: 1, x: 0, y: 0, z: 0 },
          );
    world.createImpulseJoint(params, a, b, true);
  }

  let disposed = false;
  return {
    step(seconds: number) {
      if (disposed) throw new Error("Cannot step a simulation that has been disposed");
      world.timestep = seconds;
      world.step();
    },
    poses() {
      const out = new Map<string, BodyPose>();
      for (const [id, body] of bodies) {
        const rotation = body.rotation();
        out.set(id, {
          positionLdu: toLdu(body.translation()),
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
        });
      }
      return out;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      world.free();
      bodies.clear();
    },
  };
}
