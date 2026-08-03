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

const probe = (positionLdu: readonly [number, number, number]): PartInstance =>
  part("probe", "builtin:brick-1x1", positionLdu);

const codes = (parts: readonly PartInstance[]) =>
  findCatalogCollisions(parts, []).map(({ code }) => code);

const edgeSeatConnection = (clutchIndex: 2 | 4): ConnectionEdge => ({
  id: `edge-seat-${clutchIndex}`,
  kind: "stud-tube",
  a: { partId: "probe", portId: "stud:0:0" },
  b: { partId: "ring", portId: `undersideClutch:${clutchIndex}` },
  provenance: { source: "manual" },
});

describe("convex-prism arc collision", () => {
  const ring = part("ring", "builtin:corner-plate-5x5-quarter-ring", [0, 0, 0]);
  const inHole = probe([20, -8, -20]);
  const onArc = probe([50, -8, -50]);
  const onStartCap = probe([-10, -8, -70]);
  const besideStartCap = probe([-10, -8, -50]);

  it("keeps the quarter-ring hole empty in full and indexed collision", () => {
    expect(findCatalogCollisions([ring, inHole], [])).toEqual([]);
    expect(createCollisionWorld([ring]).findCollisionsWith(inHole, [])).toEqual([]);
  });

  it("refuses both the curved band and its authored endpoint cap", () => {
    expect(codes([ring, onArc])).toContain("PART_BODY_COLLISION");
    expect(codes([ring, onStartCap])).toContain("PART_BODY_COLLISION");
    expect(codes([ring, besideStartCap])).not.toContain("PART_BODY_COLLISION");

    const indexed = createCollisionWorld([ring]);
    expect(indexed.findCollisionsWith(onArc, []).map(({ code }) => code)).toContain(
      "PART_BODY_COLLISION",
    );
    expect(indexed.findCollisionsWith(onStartCap, []).map(({ code }) => code)).toContain(
      "PART_BODY_COLLISION",
    );
  });

  it("preserves every verdict through all four legal yaws", () => {
    for (const orientationId of [
      "upright-yaw-0",
      "upright-yaw-90",
      "upright-yaw-180",
      "upright-yaw-270",
    ]) {
      const turn = { positionLdu: [0, 0, 0] as const, orientationId };
      const turnedRing = { ...ring, transform: turn };
      const turnedProbe = (source: PartInstance): PartInstance => ({
        ...source,
        transform: {
          ...source.transform,
          positionLdu: transformLduPoint(turn, source.transform.positionLdu),
        },
      });
      const hole = turnedProbe(inHole);
      const arc = turnedProbe(onArc);

      expect([orientationId, findCatalogCollisions([turnedRing, hole], [])]).toEqual([
        orientationId,
        [],
      ]);
      expect(findCatalogCollisions([turnedRing, arc], []).map(({ code }) => code)).toContain(
        "PART_BODY_COLLISION",
      );
      const indexed = createCollisionWorld([turnedRing]);
      expect(indexed.findCollisionsWith(hole, [])).toEqual([]);
      expect(indexed.findCollisionsWith(arc, []).map(({ code }) => code)).toContain(
        "PART_BODY_COLLISION",
      );
    }
  });

  it("opens each source-verified edge seat only for its exact validated connection", () => {
    for (const [clutchIndex, x, z] of [
      [2, 30, -70],
      [4, 70, -30],
    ] as const) {
      const lowerPlate = part("probe", "builtin:plate-1x1", [x, 8, z]);
      expect(codes([ring, lowerPlate]), `edge seat ${x},${z}`).toContain(
        "PART_STUD_BODY_COLLISION",
      );

      const connectedCodes = findCatalogCollisions(
        [ring, lowerPlate],
        [edgeSeatConnection(clutchIndex)],
      ).map(({ code }) => code);
      expect(connectedCodes, `edge seat ${x},${z}`).not.toContain("PART_STUD_BODY_COLLISION");
      expect(connectedCodes, `edge seat ${x},${z}`).not.toContain("PART_BODY_COLLISION");
    }
  });
});
