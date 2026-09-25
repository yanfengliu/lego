import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { getPartDefinition } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getConnectorWorldFrame } from "./transforms.ts";
import { validBrickConnections, validateBrickDocument } from "./validation.ts";

/**
 * Booklet step 40: a 1 x 2 round-end plate pressed by both studs into the back
 * recess of a 41682 bracket's wall. The plate's studs keep the LDraw source
 * radius 6.0001514980873605 LDU and the recess is exactly stud-sized, so the
 * seated studs touch the recess walls, the stud3 pin and the ribs, overlapping
 * each by 0.00015 LDU; the two tube-seat allowances of undersideClutch:4 and :5
 * cover that only through validated edges, across body prisms that run along Y
 * while the studs run along Z.
 *
 * Bound: one bracket and one plate at the booklet's relative pose, upright
 * bracket; a rotated bracket is left to the clutch-seat class gate's orientation
 * handling, which this does not repeat.
 */
const BRACKET = "builtin:bracket-2x2-1x2-vertical-studs";
const PLATE = "builtin:plate-1x2-round-end";

function recessDocument(connected: boolean): {
  readonly document: BrickDocumentV1;
  readonly edges: readonly ConnectionEdge[];
} {
  const bracket = createPartInstance({ id: "bracket", catalogPartId: BRACKET });
  // The plate's studs face -Z at [10, -4, 4] and [-10, -4, 4]; its body sits behind the wall.
  const plate: PartInstance = createPartInstance({
    id: "plate",
    catalogPartId: PLATE,
    transform: { positionLdu: [0, -4, 8], orientationId: "proper-m-00nn000p0" },
  });
  const plateStuds = getPartDefinition(PLATE)!.connectors.filter(({ kind }) => kind === "stud");
  const edges = ["undersideClutch:4", "undersideClutch:5"].map((clutchId, index) => {
    const seat = getConnectorWorldFrame(bracket, clutchId);
    const stud = plateStuds.find(({ id }) =>
      getConnectorWorldFrame(plate, id).positionLdu.every(
        (value, axis) => value === seat.positionLdu[axis],
      ),
    )!;
    return {
      id: `recess-${index}`,
      kind: "stud-tube" as const,
      a: { partId: plate.id, portId: stud.id },
      b: { partId: bracket.id, portId: clutchId },
      provenance: { source: "manual" as const },
    };
  });
  const base = createEmptyBrickDocument({ id: "recess", name: "Bracket recess seat" });
  const partIds = [bracket.id, plate.id];
  return {
    edges,
    document: {
      ...base,
      parts: [bracket, plate],
      connections: connected ? edges : [],
      submodels: [{ ...base.submodels[0]!, partIds }],
      steps: [{ ...base.steps[0]!, partIds }],
    },
  };
}

describe("41682 wall recess seat", () => {
  it("takes a round-end plate by both studs through validated edges with no collision", () => {
    const { document, edges } = recessDocument(true);
    for (const edge of edges) {
      const stud = getConnectorWorldFrame(document.parts[1]!, edge.a.portId);
      const seat = getConnectorWorldFrame(document.parts[0]!, edge.b.portId);
      expect(stud.positionLdu).toEqual(seat.positionLdu);
      expect(stud.normal).toEqual([0, 0, -1]);
      expect(seat.normal).toEqual([0, 0, 1]);
    }

    expect(validBrickConnections(document)).toHaveLength(2);
    const report = validateBrickDocument(document);
    expect(report.issues.filter(({ severity }) => severity === "blocking")).toEqual([]);
    expect(report.documentGloballyValid).toBe(true);
  });

  it("still collides and hangs loose when the same plate is not connected", () => {
    const codes = validateBrickDocument(recessDocument(false).document).issues.map(
      ({ code }) => code,
    );

    // Only the validated edges relieve the source-radius studs' 0.00015 LDU contact.
    expect(codes).toContain("PART_STUD_BODY_COLLISION");
    expect(codes).toContain("DISCONNECTED_ASSEMBLY");
    expect(codes).not.toContain("PART_BODY_COLLISION");
  });
});
