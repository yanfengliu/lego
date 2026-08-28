import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createCollisionWorld, findCatalogCollisions } from "./collisions.ts";
import { transformLduPoint } from "./transforms.ts";

const part = (
  id: string,
  catalogPartId: string,
  positionLdu: readonly [number, number, number],
  orientationId = "upright-yaw-0",
): PartInstance => ({
  id,
  catalogPartId,
  colorId: "builtin:light-bluish-gray",
  transform: { positionLdu, orientationId },
  submodelId: "root",
  stepId: "step-1",
  semanticTags: [],
  provenance: { source: "manual" },
});

const bracket = part("bracket", "builtin:bracket-1x2-1x4-rounded-bottom", [0, 0, 0]);
const probe = part("probe", "builtin:brick-1x1", [-30, 0, -24]);
const forgedSideConnection: ConnectionEdge = {
  id: "forged-side-connection",
  kind: "stud-tube",
  a: { partId: "bracket", portId: "stud:0" },
  b: { partId: "probe", portId: "undersideClutch:0:0" },
  provenance: { source: "manual" },
};

describe("horizontal stud collision", () => {
  it("detects a side stud entering an upright body through all four legal yaws", () => {
    for (const orientationId of [
      "upright-yaw-0",
      "upright-yaw-90",
      "upright-yaw-180",
      "upright-yaw-270",
    ]) {
      const turn = { positionLdu: [0, 0, 0] as const, orientationId };
      const turnedBracket = { ...bracket, transform: turn };
      const turnedProbe = {
        ...probe,
        transform: {
          ...probe.transform,
          positionLdu: transformLduPoint(turn, probe.transform.positionLdu),
        },
      };
      expect(
        findCatalogCollisions([turnedBracket, turnedProbe], []).map(({ code }) => code),
        orientationId,
      ).toContain("PART_STUD_BODY_COLLISION");
      expect(
        createCollisionWorld([turnedBracket])
          .findCollisionsWith(turnedProbe, [])
          .map(({ code }) => code),
        orientationId,
      ).toContain("PART_STUD_BODY_COLLISION");
    }
  });

  it("does not turn a near miss into body overlap", () => {
    const clear = part("probe", "builtin:brick-1x1", [-30, 19, -24]);
    expect(findCatalogCollisions([bracket, clear], [])).toEqual([]);
    expect(createCollisionWorld([bracket]).findCollisionsWith(clear, [])).toEqual([]);
  });

  it("never grants a vertical clutch allowance to a forged horizontal connection", () => {
    expect(
      findCatalogCollisions([bracket, probe], [forgedSideConnection]).map(({ code }) => code),
    ).toContain("PART_STUD_BODY_COLLISION");
    expect(
      createCollisionWorld([bracket])
        .findCollisionsWith(probe, [forgedSideConnection])
        .map(({ code }) => code),
    ).toContain("PART_STUD_BODY_COLLISION");
  });

  it("detects overlap for a trusted non-upright proper transform", () => {
    const turned = part("turned", "builtin:brick-1x1", [0, 0, 0], "proper-m-p0000p0n0");
    const overlapping = part("overlapping", "builtin:brick-1x1", [0, 0, 0]);

    expect(findCatalogCollisions([turned, overlapping], []).map(({ code }) => code)).toContain(
      "PART_BODY_COLLISION",
    );
    expect(
      createCollisionWorld([turned])
        .findCollisionsWith(overlapping, [])
        .map(({ code }) => code),
    ).toContain("PART_BODY_COLLISION");
  });
});
