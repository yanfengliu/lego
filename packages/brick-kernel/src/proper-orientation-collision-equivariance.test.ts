import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createCollisionWorld } from "./collisions.ts";
import { createEmptyBrickDocument } from "./factory.ts";
import { composeRigidTransforms } from "./transforms.ts";
import { validateBrickDocument } from "./validation.ts";

const part = (id: string, y: number): PartInstance => ({
  id,
  catalogPartId: "builtin:plate-1x1",
  colorId: "builtin:light-bluish-gray",
  transform: { positionLdu: [0, y, 0], orientationId: "upright-yaw-0" },
  submodelId: "root",
  stepId: "step-1",
  semanticTags: [],
  provenance: { source: "manual" },
});

const connection = (id: string, lowerPartId: string, upperPartId: string): ConnectionEdge => ({
  id,
  kind: "stud-tube",
  a: { partId: lowerPartId, portId: "stud:0:0" },
  b: { partId: upperPartId, portId: "undersideClutch:0:0" },
  provenance: { source: "manual" },
});

function documentOf(parts: readonly PartInstance[], connections: readonly ConnectionEdge[]) {
  const base = createEmptyBrickDocument({ id: "proper-collision", name: "Proper collision" });
  return {
    ...base,
    parts: [...parts],
    connections: [...connections],
    submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id }) => id) }],
    steps: [{ ...base.steps[0]!, partIds: parts.map(({ id }) => id) }],
  } satisfies BrickDocumentV1;
}

describe("proper-orientation collision equivariance", () => {
  it("carries both validated stud allowances through a non-upright global rotation", () => {
    const parts = [part("lower", 0), part("middle", -8), part("upper", -16)];
    const connections = [
      connection("lower-middle", "lower", "middle"),
      connection("middle-upper", "middle", "upper"),
    ];
    expect(validateBrickDocument(documentOf(parts, connections)).issues).toEqual([]);

    const globalRotation = {
      positionLdu: [0, 0, 0] as const,
      orientationId: "proper-m-p0000p0n0",
    };
    const rotatedParts = parts.map((source): PartInstance => ({
      ...source,
      transform: composeRigidTransforms(globalRotation, source.transform),
    }));
    const rotatedIssues = validateBrickDocument(documentOf(rotatedParts, connections)).issues;

    expect(rotatedIssues.filter(({ code }) => code.startsWith("PART_"))).toEqual([]);
    expect(rotatedIssues.filter(({ code }) => code === "ILLEGAL_ORIENTATION")).toHaveLength(3);
    expect(
      createCollisionWorld(rotatedParts.slice(0, 2)).findCollisionsWith(rotatedParts[2]!, [
        connections[1]!,
      ]),
    ).toEqual([]);
  });
});
