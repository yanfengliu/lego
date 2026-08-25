import { describe, expect, it } from "vitest";

import { getPartDefinition, type CollisionCylinder } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { validBrickConnections, validateBrickDocument } from "./validation";

function withAssembly(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "78329-connections", name: "78329 connection gate" });
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

describe("78329 regular plate connection semantics", () => {
  it("retains exact source radii while reserving nominal radii for validated edges", () => {
    const part = getPartDefinition("builtin:plate-1x5");
    if (part === undefined) throw new Error("78329 is missing from the catalog");
    const studs = part.collision.primitives.filter(
      (primitive): primitive is CollisionCylinder =>
        primitive.kind === "cylinder" && primitive.tag === "stud",
    );

    expect(part.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(studs).toHaveLength(5);
    expect(studs.every(({ radiusLdu }) => radiusLdu === 6.0001514980873605)).toBe(true);
    expect(
      studs.every(
        ({ validatedConnectionProfileRadiusLdu }) => validatedConnectionProfileRadiusLdu === 6,
      ),
    ).toBe(true);
  });

  it("accepts the exact aligned ports and clears only the colliding validated pair", () => {
    const lower = createPartInstance({
      id: "lower",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
    });
    const plate = createPartInstance({ id: "plate-1x5", catalogPartId: "builtin:plate-1x5" });
    const upper = createPartInstance({
      id: "upper",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [0, -8, 0], orientationId: "upright-yaw-0" },
    });
    const parts = [lower, plate, upper] as const;
    const lowerEdge: ConnectionEdge = {
      id: "lower-to-plate",
      kind: "stud-tube",
      a: { partId: "lower", portId: "stud:0:0" },
      b: { partId: "plate-1x5", portId: "undersideClutch:2" },
      provenance: { source: "manual" },
    };
    const upperEdge: ConnectionEdge = {
      id: "plate-to-upper",
      kind: "stud-tube",
      a: { partId: "plate-1x5", portId: "stud:2" },
      b: { partId: "upper", portId: "undersideClutch:0:0" },
      provenance: { source: "manual" },
    };

    expect(studBodyCollisionPairs(withAssembly(parts, []))).toEqual(["plate-1x5/upper"]);
    expect(validBrickConnections(withAssembly(parts, [lowerEdge]))).toEqual([lowerEdge]);
    expect(studBodyCollisionPairs(withAssembly(parts, [lowerEdge]))).toEqual(["plate-1x5/upper"]);
    expect(validBrickConnections(withAssembly(parts, [upperEdge]))).toEqual([upperEdge]);
    expect(studBodyCollisionPairs(withAssembly(parts, [upperEdge]))).toEqual([]);

    const misboundUpperEdge: ConnectionEdge = {
      ...upperEdge,
      a: { partId: "plate-1x5", portId: "stud:1" },
    };
    expect(validBrickConnections(withAssembly(parts, [misboundUpperEdge]))).toEqual([]);
    expect(studBodyCollisionPairs(withAssembly(parts, [misboundUpperEdge]))).toEqual([
      "plate-1x5/upper",
    ]);

    const complete = withAssembly(parts, [lowerEdge, upperEdge]);
    expect(validBrickConnections(complete)).toEqual([lowerEdge, upperEdge]);
    expect(validateBrickDocument(complete).issues).toEqual([]);
    expect(validateBrickDocument(complete).documentGloballyValid).toBe(true);
  });
});
