import { describe, expect, it } from "vitest";

import type { PartInstance, RigidTransform } from "@lego-studio/protocol";

import {
  TransformPolicyError,
  composeRigidTransforms,
  createAttachedTransform,
  getConnectorWorldFrame,
  getUprightOrientation,
  rotateLduVector,
  transformLduPoint,
} from "./transforms";

const basePart: PartInstance = {
  id: "base",
  catalogPartId: "builtin:brick-1x1",
  colorId: "builtin:red",
  transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
  submodelId: "root",
  stepId: "step-1",
  semanticTags: [],
  provenance: { source: "manual" },
};

const ORIENTATION_IDS = [
  "upright-yaw-0",
  "upright-yaw-90",
  "upright-yaw-180",
  "upright-yaw-270",
] as const;

function transform(
  orientationId: (typeof ORIENTATION_IDS)[number],
  positionLdu: readonly [number, number, number] = [0, 0, 0],
): RigidTransform {
  return { positionLdu, orientationId };
}

describe("upright transform policy", () => {
  it("applies the catalog's row-major quarter-turn matrices exactly", () => {
    const yaw90 = getUprightOrientation("upright-yaw-90");
    expect(rotateLduVector(yaw90.matrix, [10, -2, 20])).toEqual([20, -2, -10]);
  });

  it("reports world connector frames in integer LDU", () => {
    expect(getConnectorWorldFrame(basePart, "stud:0:0")).toMatchObject({
      positionLdu: [0, -12, 0],
      normal: [0, -1, 0],
      kind: "stud",
    });
  });

  it("places a new part by coincident, oppositely-facing semantic ports", () => {
    const transform = createAttachedTransform(
      basePart,
      "stud:0:0",
      "builtin:brick-1x1",
      "undersideClutch:0:0",
      "upright-yaw-0",
    );

    expect(transform).toEqual({ positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" });

    const attached = { ...basePart, id: "attached", transform };
    expect(getConnectorWorldFrame(attached, "undersideClutch:0:0").positionLdu).toEqual(
      getConnectorWorldFrame(basePart, "stud:0:0").positionLdu,
    );
  });

  it("rejects same-kind, missing, and unknown-orientation connections", () => {
    expect(() =>
      createAttachedTransform(
        basePart,
        "stud:0:0",
        "builtin:brick-1x1",
        "stud:0:0",
        "upright-yaw-0",
      ),
    ).toThrow(TransformPolicyError);
    expect(() => getConnectorWorldFrame(basePart, "missing")).toThrow(/Unknown port/);
    expect(() => getUprightOrientation("upside-down")).toThrow(/Unknown upright orientation/);
  });

  it("composes identity exactly on both sides without mutating either input", () => {
    const identity = transform("upright-yaw-0");
    const subject = transform("upright-yaw-270", [20, -24, 40]);
    const identityBefore = structuredClone(identity);
    const subjectBefore = structuredClone(subject);

    expect(composeRigidTransforms(identity, subject)).toEqual(subject);
    expect(composeRigidTransforms(subject, identity)).toEqual(subject);
    expect(identity).toEqual(identityBefore);
    expect(subject).toEqual(subjectBefore);
  });

  it("rejects accessor-bearing transforms before they can mutate the other input", () => {
    const local = transform("upright-yaw-0", [1, 0, 0]);
    const parent = {
      orientationId: "upright-yaw-0",
      get positionLdu() {
        (local.positionLdu as [number, number, number])[0] = 9;
        return [0, 0, 0] as const;
      },
    } as RigidTransform;

    expect(() => composeRigidTransforms(parent, local)).toThrow(/data properties only/);
    expect(local.positionLdu).toEqual([1, 0, 0]);

    const positionWithAccessor = [0, 0, 0];
    Object.defineProperty(positionWithAccessor, 0, {
      configurable: true,
      enumerable: true,
      get: () => 0,
    });
    expect(() =>
      composeRigidTransforms(transform("upright-yaw-0"), {
        positionLdu: positionWithAccessor,
        orientationId: "upright-yaw-0",
      } as unknown as RigidTransform),
    ).toThrow(/data properties only/);
  });

  it("resolves every upright yaw pair to the exact closed catalog orientation", () => {
    for (let parentIndex = 0; parentIndex < ORIENTATION_IDS.length; parentIndex += 1) {
      for (let localIndex = 0; localIndex < ORIENTATION_IDS.length; localIndex += 1) {
        expect(
          composeRigidTransforms(
            transform(ORIENTATION_IDS[parentIndex]!),
            transform(ORIENTATION_IDS[localIndex]!),
          ),
        ).toEqual({
          positionLdu: [0, 0, 0],
          orientationId: ORIENTATION_IDS[(parentIndex + localIndex) % ORIENTATION_IDS.length],
        });
      }
    }
  });

  it("rotates local translation before adding the parent translation", () => {
    expect(
      composeRigidTransforms(
        transform("upright-yaw-90", [100, -10, 200]),
        transform("upright-yaw-180", [10, -2, 20]),
      ),
    ).toEqual({
      positionLdu: [120, -12, 190],
      orientationId: "upright-yaw-270",
    });
  });

  it("is associative and agrees with sequential point transformation over legal fixtures", () => {
    for (let firstIndex = 0; firstIndex < ORIENTATION_IDS.length; firstIndex += 1) {
      for (let secondIndex = 0; secondIndex < ORIENTATION_IDS.length; secondIndex += 1) {
        for (let thirdIndex = 0; thirdIndex < ORIENTATION_IDS.length; thirdIndex += 1) {
          const first = transform(ORIENTATION_IDS[firstIndex]!, [20, -24, 40]);
          const second = transform(ORIENTATION_IDS[secondIndex]!, [-40, 8, 20]);
          const third = transform(ORIENTATION_IDS[thirdIndex]!, [10, -16, -30]);
          const leftAssociated = composeRigidTransforms(
            composeRigidTransforms(first, second),
            third,
          );
          const rightAssociated = composeRigidTransforms(
            first,
            composeRigidTransforms(second, third),
          );

          expect(leftAssociated).toEqual(rightAssociated);
          expect(transformLduPoint(leftAssociated, [7, -3, 11])).toEqual(
            transformLduPoint(
              first,
              transformLduPoint(second, transformLduPoint(third, [7, -3, 11])),
            ),
          );
        }
      }
    }
  });

  it("rejects unknown, non-integral, and composed out-of-policy transforms", () => {
    expect(() =>
      composeRigidTransforms(
        { positionLdu: [0, 0, 0], orientationId: "unknown-orientation" },
        transform("upright-yaw-0"),
      ),
    ).toThrow(TransformPolicyError);
    expect(() =>
      composeRigidTransforms(
        {
          positionLdu: [0.5, 0, 0],
          orientationId: "upright-yaw-0",
        } as RigidTransform,
        transform("upright-yaw-0"),
      ),
    ).toThrow(TransformPolicyError);
    expect(() =>
      composeRigidTransforms(
        transform("upright-yaw-0", [10_000_000, 0, 0]),
        transform("upright-yaw-0", [1, 0, 0]),
      ),
    ).toThrow(TransformPolicyError);
  });
});
