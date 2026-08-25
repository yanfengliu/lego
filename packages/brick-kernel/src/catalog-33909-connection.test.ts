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
    id: "33909-connections",
    name: "33909 two-direction connection gate",
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

describe("33909 two-stud-edge plate connection semantics", () => {
  it("uses the nominal profile only for validated edges while retaining measured collision", () => {
    const part = getPartDefinition("builtin:plate-2x2-two-studs");
    if (part === undefined) throw new Error("33909 is missing from the catalog");
    const studCylinders = part.collision.primitives.filter(
      (primitive): primitive is CollisionCylinder =>
        primitive.kind === "cylinder" && primitive.tag === "stud",
    );

    expect(part.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(studCylinders).toHaveLength(2);
    expect(studCylinders.every(({ radiusLdu }) => radiusLdu === 6.0001514980873605)).toBe(true);
    expect(
      studCylinders.every(
        ({ validatedConnectionProfileRadiusLdu }) => validatedConnectionProfileRadiusLdu === 6,
      ),
    ).toBe(true);
  });

  it("connects through one underside clutch and one of its two top studs", () => {
    const lower = createPartInstance({
      id: "lower",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [-10, 8, -10], orientationId: "upright-yaw-0" },
    });
    const plate = createPartInstance({
      id: "plate-2x2-two-studs",
      catalogPartId: "builtin:plate-2x2-two-studs",
    });
    const upper = createPartInstance({
      id: "upper",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [-10, -8, 10], orientationId: "upright-yaw-0" },
    });
    const parts = [lower, plate, upper] as const;
    const lowerEdge: ConnectionEdge = {
      id: "lower-to-plate-2x2-two-studs",
      kind: "stud-tube",
      a: { partId: "lower", portId: "stud:0:0" },
      b: { partId: "plate-2x2-two-studs", portId: "undersideClutch:0" },
      provenance: { source: "manual" },
    };
    const upperEdge: ConnectionEdge = {
      id: "plate-2x2-two-studs-to-upper",
      kind: "stud-tube",
      a: { partId: "plate-2x2-two-studs", portId: "stud:0" },
      b: { partId: "upper", portId: "undersideClutch:0:0" },
      provenance: { source: "manual" },
    };

    expect(studBodyCollisionPairs(withAssembly(parts, []))).toEqual([
      "lower/plate-2x2-two-studs",
      "plate-2x2-two-studs/upper",
    ]);
    expect(validBrickConnections(withAssembly(parts, [lowerEdge]))).toEqual([lowerEdge]);
    expect(studBodyCollisionPairs(withAssembly(parts, [lowerEdge]))).toEqual([
      "plate-2x2-two-studs/upper",
    ]);
    expect(validBrickConnections(withAssembly(parts, [upperEdge]))).toEqual([upperEdge]);
    expect(studBodyCollisionPairs(withAssembly(parts, [upperEdge]))).toEqual([
      "lower/plate-2x2-two-studs",
    ]);

    const complete = withAssembly(parts, [lowerEdge, upperEdge]);
    expect(validBrickConnections(complete)).toEqual([lowerEdge, upperEdge]);
    expect(validateBrickDocument(complete).issues).toEqual([]);
    expect(validateBrickDocument(complete).documentGloballyValid).toBe(true);
  });
});
