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
  const empty = createEmptyBrickDocument({ id: "step-16-seat", name: "Step 16 seat" });
  return {
    ...empty,
    parts,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-15", index: 0, name: "Step 15", partIds: parts.map(({ id }) => id) }],
  };
}

describe("35480 exact step-16 connected placement", () => {
  it("keeps measured stud collision off-seat and uses nominal radius only at both exact wedge seats", () => {
    const definition = getPartDefinition("builtin:plate-1x2-round-end");
    if (definition === undefined) throw new Error("35480 is missing from the catalog");
    const studs = definition.collision.primitives.filter(
      (primitive): primitive is CollisionCylinder =>
        primitive.kind === "cylinder" && primitive.tag === "stud",
    );
    expect(definition.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(studs).toHaveLength(2);
    expect(studs.every(({ radiusLdu }) => radiusLdu === 6.0001514980873605)).toBe(true);
    expect(
      studs.every(
        ({ validatedConnectionProfileRadiusLdu }) => validatedConnectionProfileRadiusLdu === 6,
      ),
    ).toBe(true);

    const receiver = createPartInstance({
      id: "ordinal-33",
      catalogPartId: "builtin:wedge-plate-6x6-cut-corner",
      transform: { positionLdu: [-500, 0, -20], orientationId: "upright-yaw-180" },
    });
    const roundEnd = createPartInstance({
      id: "enumeration-candidate",
      catalogPartId: "builtin:plate-1x2-round-end",
      transform: { positionLdu: [-470, 8, 0], orientationId: "upright-yaw-0" },
    });
    const base = documentWith([receiver]);
    const diagnosis = diagnosePlacementTransform(base, roundEnd.catalogPartId, roundEnd.transform);

    expect(diagnosis).toMatchObject({ originSeeded: true, collisionFindings: [] });
    expect(diagnosis.connections).toHaveLength(2);
    expect(
      diagnosis.connections.map(({ targetPartId, targetPortId, candidatePortId }) => [
        targetPartId,
        targetPortId,
        candidatePortId,
      ]),
    ).toEqual([
      [receiver.id, "undersideClutch:7", "stud:1"],
      [receiver.id, "undersideClutch:8", "stud:0"],
    ]);
    expect(diagnosis.unconnectedCollisionFindings.map(({ message }) => message)).toContain(
      "Stud enumeration-candidate/stud:0 overlaps body ordinal-33/body",
    );

    const edges: ConnectionEdge[] = diagnosis.connections.map((connection, index) => ({
      id: `step-16-seat-${index + 1}`,
      kind: protocolConnectionKindForDiscoveredConnection(
        base.parts,
        roundEnd.catalogPartId,
        connection,
      ),
      a: { partId: connection.targetPartId, portId: connection.targetPortId },
      b: { partId: roundEnd.id, portId: connection.candidatePortId },
      provenance: { source: "manual" },
    }));
    const collisionWorld = createCollisionWorld(base.parts);
    expect(collisionWorld.findCollisionsWith(roundEnd, []).map(({ message }) => message)).toContain(
      "Stud enumeration-candidate/stud:0 overlaps body ordinal-33/body",
    );
    expect(collisionWorld.findCollisionsWith(roundEnd, edges)).toEqual([]);

    expect(
      enumeratePlacements(base, roundEnd.catalogPartId, {
        orientationIds: [roundEnd.transform.orientationId],
      }).candidates.find(({ transform }) =>
        transform.positionLdu.every(
          (coordinate, axis) => coordinate === roundEnd.transform.positionLdu[axis],
        ),
      ),
    ).toMatchObject({ transform: roundEnd.transform, connections: diagnosis.connections });
  });
});
