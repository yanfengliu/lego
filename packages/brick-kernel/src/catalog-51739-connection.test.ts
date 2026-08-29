import { describe, expect, it } from "vitest";

import { getPartDefinition, type CollisionCylinder } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { validBrickConnections, validateBrickDocument } from "./validation";

function documentWith(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const empty = createEmptyBrickDocument({ id: "51739-seat", name: "51739 seat" });
  return {
    ...empty,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
  };
}

function studBodyCollisions(document: BrickDocumentV1): readonly string[] {
  return validateBrickDocument(document)
    .issues.filter(({ code }) => code === "PART_STUD_BODY_COLLISION")
    .map(({ message }) => message);
}

describe("51739 measured-stud connection profile", () => {
  it("keeps the measured radius for ordinary collision and uses nominal radius only at a validated seat", () => {
    const definition = getPartDefinition("builtin:wedge-plate-2x4-wing");
    if (definition === undefined) throw new Error("51739 is missing from the catalog");
    const studs = definition.collision.primitives.filter(
      (primitive): primitive is CollisionCylinder =>
        primitive.kind === "cylinder" && primitive.tag === "stud",
    );

    expect(definition.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(studs).toHaveLength(4);
    expect(studs.every(({ radiusLdu }) => radiusLdu === 6.0001514980873605)).toBe(true);
    expect(
      studs.every(
        ({ validatedConnectionProfileRadiusLdu }) => validatedConnectionProfileRadiusLdu === 6,
      ),
    ).toBe(true);

    const target = createPartInstance({
      id: "plate-2x6",
      catalogPartId: "builtin:plate-2x6",
      transform: { positionLdu: [-60, 0, -40], orientationId: "upright-yaw-270" },
    });
    const wing = createPartInstance({
      id: "wing-51739",
      catalogPartId: "builtin:wedge-plate-2x4-wing",
      transform: { positionLdu: [-40, 8, -60], orientationId: "upright-yaw-180" },
    });
    const exactEdge: ConnectionEdge = {
      id: "exact-step-7-seat",
      kind: "stud-tube",
      a: { partId: wing.id, portId: "stud:2" },
      b: { partId: target.id, portId: "undersideClutch:0:2" },
      provenance: { source: "manual" },
    };
    const parts = [target, wing] as const;

    expect(studBodyCollisions(documentWith(parts, []))).toContain(
      "Stud wing-51739/stud:2 overlaps body plate-2x6/body:1",
    );
    expect(validBrickConnections(documentWith(parts, [exactEdge]))).toEqual([exactEdge]);
    expect(studBodyCollisions(documentWith(parts, [exactEdge]))).not.toContain(
      "Stud wing-51739/stud:2 overlaps body plate-2x6/body:1",
    );
  });
});
