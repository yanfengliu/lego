import { createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import { lduDirectionToThree, lduRotationToThreeQuaternion } from "@lego-studio/rendering";
import type { BrickDocumentV1, PartInstance } from "@lego-studio/protocol";
import { Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { startSimulation } from "./simulation-session";
import type { BodyPose, Simulation } from "./rapier-world";

/**
 * Gate: a body that has genuinely tipped renders tipped the same way, all the
 * way from Rapier's raw sim-frame quaternion through the session (the
 * document-frame conversion this file's fix adds) and then through the
 * standard document-to-scene conversion. Until now nothing asserted the
 * DIRECTION of a tilt; only saved PNGs showed it, and nobody reads a PNG's
 * sign bit.
 *
 * Bound: one body tipped 40 degrees about the LDU Z axis, Rapier's `poses()`
 * stubbed exactly as `simulation-session.test.ts` stubs it (the live solver is
 * not under test here). Z, not X: a pure X-axis tip happens to render
 * identically under main's old ad hoc `(-x, y, -z, w)` formula and under this
 * fix (the two wrongs it compounds cancel for that one axis by coincidence),
 * so an X-only gate would not catch that regression. A Z-axis tip is wrong
 * under both main's old formula and this branch's pre-fix formula (raw
 * sim-frame quaternion forwarded unconverted), and right only under the fix;
 * see `scratchpad/review-handedness/` for the numbers. Two markers straddling
 * the rotation's axis stand in for "the body"; a real part's mesh is outside
 * this bound.
 */

const TILT_RADIANS = (40 * Math.PI) / 180;

/** `B * R * B`, `B = diag(signs)`: the same conjugation the fix uses, built
 * independently here so the test does not just check the code against itself. */
function conjugate(rotation: Quaternion, signs: readonly [number, number, number]): Quaternion {
  const basis = new Matrix4().makeScale(...signs);
  const matrix = new Matrix4().makeRotationFromQuaternion(rotation);
  const conjugated = basis.clone().multiply(matrix).multiply(basis.clone().invert());
  return new Quaternion().setFromRotationMatrix(conjugated);
}

// Ground truth: a body that has truly tipped 40 degrees about the LDU Z axis.
const TRUE_TILT_LDU = new Quaternion().setFromRotationMatrix(
  new Matrix4().makeRotationZ(TILT_RADIANS),
);
// What Rapier would report for that physical event, in its own Y-up sim
// frame (conjugate by diag(1, -1, 1), the same sign vector `toSimulation` and
// `toLdu` use for points in rapier-world.ts).
const RAPIER_REPORTS = conjugate(TRUE_TILT_LDU, [1, -1, 1]);

const part = (id: string, positionLdu: readonly [number, number, number]) =>
  ({
    id,
    catalogPartId: "builtin:brick-2x4",
    colorId: "builtin:light-bluish-gray",
    transform: { positionLdu, orientationId: "upright-yaw-0" },
    submodelId: "root",
    stepId: "step-1",
    semanticTags: [],
    provenance: { source: "manual" },
  }) satisfies PartInstance;

const documentOf = (parts: readonly PartInstance[]): BrickDocumentV1 => ({
  ...createEmptyBrickDocument({ id: "tilt-direction", name: "Tilt direction" }),
  parts: [...parts],
});

/** A world that reports one fixed pose, never moving further, as `simulation-session.test.ts` does. */
const stubbedWorld = (poses: ReadonlyMap<string, BodyPose>) => async (): Promise<Simulation> => ({
  step: () => {},
  poses: () => poses,
  dispose: () => {},
});

async function reportedPose() {
  const document = documentOf([part("a", [0, 0, 0])]);
  const session = await startSimulation(document, {
    createWorld: async (scene) =>
      await stubbedWorld(
        new Map(
          scene.bodies.map((body) => [
            body.id,
            {
              positionLdu: body.originLdu,
              rotation: RAPIER_REPORTS.toArray() as [number, number, number, number],
            },
          ]),
        ),
      )(),
  });
  const pose = session.partPoses().get("a")!;
  session.dispose();
  return pose;
}

describe("a Rapier tilt renders in the same direction it physically happened", () => {
  it("converts Rapier's sim-frame rotation into the document's frame", async () => {
    const pose = await reportedPose();

    // q and -q mean the same rotation, so compare by effect on a point that
    // is not on the rotation axis, rather than by raw component.
    const probe = new Vector3(50, 0, 0);
    const got = probe.clone().applyQuaternion(new Quaternion(...pose.rotation));
    const want = probe.clone().applyQuaternion(TRUE_TILT_LDU);
    expect(got.x).toBeCloseTo(want.x, 6);
    expect(got.y).toBeCloseTo(want.y, 6);
    expect(got.z).toBeCloseTo(want.z, 6);
    // The ground truth itself must not be degenerate, or the check above proves nothing.
    expect(Math.abs(want.y)).toBeGreaterThan(30);
  });

  it("renders the tilt with the physically correct side lowest", async () => {
    const pose = await reportedPose();
    const sceneRotation = lduRotationToThreeQuaternion(pose.rotation);

    // Two markers straddling the LDU X axis (the plane a Z-axis tilt moves),
    // converted to Three.js rest offsets the way a renderer would, then
    // carried by the reported turn.
    const plusXScene = new Vector3(...lduDirectionToThree(50, 0, 0)).applyQuaternion(sceneRotation);
    const minusXScene = new Vector3(...lduDirectionToThree(-50, 0, 0)).applyQuaternion(
      sceneRotation,
    );

    // Independent ground truth for which side is physically lower: LDU is
    // Y-down, so the marker with the larger LDU Y after the true tilt is the
    // one that went down.
    const plusXLdu = new Vector3(50, 0, 0).applyMatrix4(new Matrix4().makeRotationZ(TILT_RADIANS));
    const minusXLdu = new Vector3(-50, 0, 0).applyMatrix4(
      new Matrix4().makeRotationZ(TILT_RADIANS),
    );
    expect(Math.abs(plusXLdu.y)).toBeGreaterThan(30);
    const plusXIsPhysicallyLower = plusXLdu.y > minusXLdu.y;

    // Three.js is Y-up, so "lower" on screen is the smaller Y.
    const plusXIsRenderedLower = plusXScene.y < minusXScene.y;
    expect(plusXIsRenderedLower).toBe(plusXIsPhysicallyLower);
  });
});
