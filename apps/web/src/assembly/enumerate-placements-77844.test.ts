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
  const empty = createEmptyBrickDocument({ id: "step-14-seat", name: "Step 14 seat" });
  return {
    ...empty,
    parts,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-13", index: 0, name: "Step 13", partIds: parts.map(({ id }) => id) }],
  };
}

describe("77844 exact step-14 connected placement", () => {
  it("keeps measured stud collision off-seat and uses nominal radius only at both exact 4x6 seats", () => {
    const definition = getPartDefinition("builtin:corner-plate-3x3");
    if (definition === undefined) throw new Error("77844 is missing from the catalog");
    const studs = definition.collision.primitives.filter(
      (primitive): primitive is CollisionCylinder =>
        primitive.kind === "cylinder" && primitive.tag === "stud",
    );
    expect(definition.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(studs).toHaveLength(5);
    expect(studs.every(({ radiusLdu }) => radiusLdu === 6.0001514980873605)).toBe(true);
    expect(
      studs.every(
        ({ validatedConnectionProfileRadiusLdu }) => validatedConnectionProfileRadiusLdu === 6,
      ),
    ).toBe(true);

    const bridge = createPartInstance({
      id: "ordinal-31",
      catalogPartId: "builtin:plate-4x6",
      transform: { positionLdu: [-500, 0, -120], orientationId: "upright-yaw-270" },
    });
    const corner = createPartInstance({
      id: "enumeration-candidate",
      catalogPartId: "builtin:corner-plate-3x3",
      transform: { positionLdu: [-530, 8, -170], orientationId: "upright-yaw-0" },
    });
    const base = documentWith([bridge]);
    const diagnosis = diagnosePlacementTransform(base, corner.catalogPartId, corner.transform);

    expect(diagnosis).toMatchObject({ originSeeded: true, collisionFindings: [] });
    expect(diagnosis.unconnectedCollisionFindings.map(({ message }) => message)).toContain(
      "Stud enumeration-candidate/stud:1 overlaps body ordinal-31/body:1",
    );
    expect(diagnosis.connections).toHaveLength(2);
    expect(
      diagnosis.connections.map(({ targetPartId, candidatePortId }) => [
        targetPartId,
        candidatePortId,
      ]),
    ).toContainEqual([bridge.id, "stud:1"]);

    const edges: ConnectionEdge[] = diagnosis.connections.map((connection, index) => ({
      id: `step-14-seat-${index + 1}`,
      kind: protocolConnectionKindForDiscoveredConnection(
        base.parts,
        corner.catalogPartId,
        connection,
      ),
      a: { partId: connection.targetPartId, portId: connection.targetPortId },
      b: { partId: corner.id, portId: connection.candidatePortId },
      provenance: { source: "manual" },
    }));
    const collisionWorld = createCollisionWorld(base.parts);
    expect(collisionWorld.findCollisionsWith(corner, []).map(({ message }) => message)).toContain(
      "Stud enumeration-candidate/stud:1 overlaps body ordinal-31/body:1",
    );
    expect(collisionWorld.findCollisionsWith(corner, edges)).toEqual([]);

    expect(
      enumeratePlacements(base, corner.catalogPartId, {
        orientationIds: [corner.transform.orientationId],
      }).candidates.find(({ transform }) =>
        transform.positionLdu.every(
          (coordinate, axis) => coordinate === corner.transform.positionLdu[axis],
        ),
      ),
    ).toMatchObject({ transform: corner.transform, connections: diagnosis.connections });
  });
});
