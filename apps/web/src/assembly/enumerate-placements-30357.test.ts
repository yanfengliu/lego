import { describe, expect, it } from "vitest";

import { getPartDefinition, type CollisionCylinder } from "@lego-studio/catalog";
import {
  createCollisionWorld,
  createEmptyBrickDocument,
  createPartInstance,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { diagnosePlacementTransform, enumeratePlacements } from "./enumerate-placements";
import { protocolConnectionKindForDiscoveredConnection } from "./placement-connection-kind";

function documentWith(parts: readonly PartInstance[]): BrickDocumentV1 {
  const empty = createEmptyBrickDocument({ id: "step-16-corner-seat", name: "Step 16 seat" });
  return {
    ...empty,
    parts,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-16", index: 0, name: "Step 16", partIds: parts.map(({ id }) => id) }],
  };
}

describe("30357 exact step-16 connected placement", () => {
  it("uses nominal stud radii only across the five exact seats after occurrence 37", () => {
    const definition = getPartDefinition("builtin:plate-3x3-corner-round");
    if (definition === undefined) throw new Error("30357 is missing from the catalog");
    const studs = definition.collision.primitives.filter(
      (primitive): primitive is CollisionCylinder =>
        primitive.kind === "cylinder" && primitive.tag === "stud",
    );
    expect(definition.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(studs).toHaveLength(8);
    expect(studs.every(({ radiusLdu }) => radiusLdu === 6.0001514980873605)).toBe(true);
    expect(
      studs.every(
        ({ validatedConnectionProfileRadiusLdu }) => validatedConnectionProfileRadiusLdu === 6,
      ),
    ).toBe(true);

    const occurrence29 = createPartInstance({
      id: "ordinal-29",
      catalogPartId: "builtin:plate-2x14",
      transform: { positionLdu: [-420, 0, -20], orientationId: "upright-yaw-0" },
    });
    const occurrence33 = createPartInstance({
      id: "ordinal-33",
      catalogPartId: "builtin:wedge-plate-6x6-cut-corner",
      transform: { positionLdu: [-500, 0, -20], orientationId: "upright-yaw-180" },
    });
    const occurrence37 = createPartInstance({
      id: "ordinal-37",
      catalogPartId: "builtin:plate-1x2",
      transform: { positionLdu: [-440, 8, 90], orientationId: "upright-yaw-90" },
    });
    const cornerRound = createPartInstance({
      id: "enumeration-candidate",
      catalogPartId: "builtin:plate-3x3-corner-round",
      transform: { positionLdu: [-430, 8, 30], orientationId: "upright-yaw-270" },
    });
    const base = documentWith([occurrence29, occurrence33, occurrence37]);
    const diagnosis = diagnosePlacementTransform(
      base,
      cornerRound.catalogPartId,
      cornerRound.transform,
    );

    expect(diagnosis).toMatchObject({ originSeeded: true, collisionFindings: [] });
    expect(diagnosis.connections).toHaveLength(5);
    expect(
      diagnosis.connections.map(({ targetPartId, targetPortId, candidatePortId }) => [
        targetPartId,
        targetPortId,
        candidatePortId,
      ]),
    ).toEqual([
      [occurrence29.id, "undersideClutch:0:10", "stud:3"],
      [occurrence29.id, "undersideClutch:0:11", "stud:6"],
      [occurrence29.id, "undersideClutch:0:9", "stud:0"],
      [occurrence33.id, "undersideClutch:0", "stud:1"],
      [occurrence33.id, "undersideClutch:6", "stud:2"],
    ]);

    const edges: ConnectionEdge[] = diagnosis.connections.map((connection, index) => ({
      id: `step-16-corner-seat-${index + 1}`,
      kind: protocolConnectionKindForDiscoveredConnection(
        base.parts,
        cornerRound.catalogPartId,
        connection,
      ),
      a: { partId: connection.targetPartId, portId: connection.targetPortId },
      b: { partId: cornerRound.id, portId: connection.candidatePortId },
      provenance: { source: "manual" },
    }));
    const collisionWorld = createCollisionWorld(base.parts);
    expect(
      collisionWorld.findCollisionsWith(cornerRound, []).map(({ message }) => message),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ordinal-29"),
        expect.stringContaining("ordinal-33"),
      ]),
    );
    expect(collisionWorld.findCollisionsWith(cornerRound, edges)).toEqual([]);
    const misaligned = {
      ...cornerRound,
      transform: {
        ...cornerRound.transform,
        positionLdu: [
          cornerRound.transform.positionLdu[0] + 1,
          cornerRound.transform.positionLdu[1],
          cornerRound.transform.positionLdu[2],
        ] as [number, number, number],
      },
    };
    expect(collisionWorld.findCollisionsWith(misaligned, []).length).toBeGreaterThan(0);

    expect(
      enumeratePlacements(base, cornerRound.catalogPartId, {
        orientationIds: [cornerRound.transform.orientationId],
      }).candidates.find(({ transform }) =>
        transform.positionLdu.every(
          (coordinate, axis) => coordinate === cornerRound.transform.positionLdu[axis],
        ),
      ),
    ).toMatchObject({ transform: cornerRound.transform, connections: diagnosis.connections });
  });
});
