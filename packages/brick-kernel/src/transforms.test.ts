import { describe, expect, it } from "vitest";

import type { PartInstance } from "@lego-studio/protocol";

import {
  TransformPolicyError,
  createAttachedTransform,
  getConnectorWorldFrame,
  getUprightOrientation,
  rotateLduVector,
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
});
