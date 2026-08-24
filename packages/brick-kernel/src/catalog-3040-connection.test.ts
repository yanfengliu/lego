import { describe, expect, it } from "vitest";

import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { validateBrickDocument } from "./validation";

function withAssembly(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "3040-connections", name: "3040 connection gate" });
  return {
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
  };
}

describe("3040 connection semantics", () => {
  it("seats the rounded source stud through the validated nominal connection profile", () => {
    const slope = createPartInstance({ id: "slope", catalogPartId: "builtin:slope-1x2-45" });
    const receiver = createPartInstance({
      id: "receiver",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [0, -16, 10], orientationId: "upright-yaw-0" },
    });
    const edge: ConnectionEdge = {
      id: "slope-stud-to-receiver",
      kind: "stud-tube",
      a: { partId: "slope", portId: "stud:0" },
      b: { partId: "receiver", portId: "undersideClutch:0:0" },
      provenance: { source: "manual" },
    };

    expect(
      validateBrickDocument(withAssembly([slope, receiver], [])).issues.map(({ code }) => code),
    ).toEqual(expect.arrayContaining(["DISCONNECTED_ASSEMBLY", "PART_STUD_BODY_COLLISION"]));
    const report = validateBrickDocument(withAssembly([slope, receiver], [edge]));
    expect(report.issues).toEqual([]);
    expect(report.documentGloballyValid).toBe(true);
  });

  it.each([
    [0, -10],
    [1, 10],
  ] as const)("seats a nominal plate stud in underside clutch %i", (clutchIndex, zLdu) => {
    const lower = createPartInstance({
      id: "lower",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [0, 16, zLdu], orientationId: "upright-yaw-0" },
    });
    const slope = createPartInstance({ id: "slope", catalogPartId: "builtin:slope-1x2-45" });
    const edge: ConnectionEdge = {
      id: `lower-to-slope-${clutchIndex}`,
      kind: "stud-tube",
      a: { partId: "lower", portId: "stud:0:0" },
      b: { partId: "slope", portId: `undersideClutch:${clutchIndex}` },
      provenance: { source: "manual" },
    };

    const report = validateBrickDocument(withAssembly([lower, slope], [edge]));
    expect(report.issues).toEqual([]);
    expect(report.documentGloballyValid).toBe(true);
  });
});
