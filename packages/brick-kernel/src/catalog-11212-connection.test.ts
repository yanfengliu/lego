import { describe, expect, it } from "vitest";

import { getPartDefinition, type CollisionCylinder } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { validBrickConnections, validateBrickDocument } from "./validation";

function withAssembly(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "11212-connections",
    name: "11212 two-direction connection gate",
  });
  return {
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
  };
}

function studBodyCollisionPairs(document: BrickDocumentV1): readonly string[] {
  return validateBrickDocument(document)
    .issues.filter(({ code }) => code === "PART_STUD_BODY_COLLISION")
    .map(({ partIds }) => partIds.join("/"))
    .sort();
}

describe("11212 regular plate connection semantics", () => {
  it("uses the nominal profile only for validated edges while retaining measured collision", () => {
    const part = getPartDefinition("builtin:plate-3x3");
    if (part === undefined) throw new Error("11212 is missing from the catalog");
    const studCylinders = part.collision.primitives.filter(
      (primitive): primitive is CollisionCylinder =>
        primitive.kind === "cylinder" && primitive.tag === "stud",
    );

    expect(part.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(studCylinders).toHaveLength(9);
    expect(studCylinders.every(({ radiusLdu }) => radiusLdu === 6.0001514980873605)).toBe(true);
    expect(
      studCylinders.every(
        ({ validatedConnectionProfileRadiusLdu }) => validatedConnectionProfileRadiusLdu === 6,
      ),
    ).toBe(true);
  });

  it("connects through both its underside clutches and its top studs", () => {
    const lower = createPartInstance({
      id: "lower",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
    });
    const plate = createPartInstance({
      id: "plate-3x3",
      catalogPartId: "builtin:plate-3x3",
    });
    const upper = createPartInstance({
      id: "upper",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [0, -8, 0], orientationId: "upright-yaw-0" },
    });
    const parts = [lower, plate, upper] as const;
    const lowerEdge: ConnectionEdge = {
      id: "lower-to-plate-3x3",
      kind: "stud-tube",
      a: { partId: "lower", portId: "stud:0:0" },
      b: { partId: "plate-3x3", portId: "undersideClutch:4" },
      provenance: { source: "manual" },
    };
    const upperEdge: ConnectionEdge = {
      id: "plate-3x3-to-upper",
      kind: "stud-tube",
      a: { partId: "plate-3x3", portId: "stud:4" },
      b: { partId: "upper", portId: "undersideClutch:0:0" },
      provenance: { source: "manual" },
    };

    expect(studBodyCollisionPairs(withAssembly(parts, []))).toEqual([
      "lower/plate-3x3",
      "plate-3x3/upper",
    ]);
    expect(validBrickConnections(withAssembly(parts, [lowerEdge]))).toEqual([lowerEdge]);
    expect(studBodyCollisionPairs(withAssembly(parts, [lowerEdge]))).toEqual(["plate-3x3/upper"]);
    expect(validBrickConnections(withAssembly(parts, [upperEdge]))).toEqual([upperEdge]);
    expect(studBodyCollisionPairs(withAssembly(parts, [upperEdge]))).toEqual(["lower/plate-3x3"]);

    const complete = withAssembly(parts, [lowerEdge, upperEdge]);
    expect(validBrickConnections(complete)).toEqual([lowerEdge, upperEdge]);
    expect(validateBrickDocument(complete).issues).toEqual([]);
    expect(validateBrickDocument(complete).documentGloballyValid).toBe(true);
  });
});
