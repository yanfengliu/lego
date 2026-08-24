import { describe, expect, it } from "vitest";

import { getPartDefinition } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { validBrickConnections, validateBrickDocument } from "./validation";

function withAssembly(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "4519-connections", name: "4519 connection gate" });
  return {
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
  };
}

describe("4519 connection semantics", () => {
  it("projects the three exact LDCad axle seats onto the measured source axis", () => {
    const axle = getPartDefinition("builtin:axle-1x3");
    if (axle === undefined) throw new Error("Catalog /22 must include builtin:axle-1x3");

    expect(
      axle.connectors.map(
        ({ id, kind, positionLdu, normal, profileId, gender, compatibleKinds }) => ({
          id,
          kind,
          positionLdu,
          normal,
          profileId,
          gender,
          compatibleKinds,
        }),
      ),
    ).toEqual([
      {
        id: "axle:0",
        kind: "axle",
        positionLdu: [-20, 0, 0],
        normal: [-1, 0, 0],
        profileId: "axle-cross/1",
        gender: "male",
        compatibleKinds: ["axleHole", "pinHole"],
      },
      {
        id: "axle:1",
        kind: "axle",
        positionLdu: [0, 0, 0],
        normal: [1, 0, 0],
        profileId: "axle-cross/1",
        gender: "male",
        compatibleKinds: ["axleHole", "pinHole"],
      },
      {
        id: "axle:2",
        kind: "axle",
        positionLdu: [20, 0, 0],
        normal: [1, 0, 0],
        profileId: "axle-cross/1",
        gender: "male",
        compatibleKinds: ["axleHole", "pinHole"],
      },
    ]);
  });

  it("accepts an exact axle-seat to pin-hole edge without claiming bore collision relief", () => {
    const bearing = createPartInstance({
      id: "bearing",
      catalogPartId: "builtin:technic-brick-1x2",
    });
    const axle = createPartInstance({
      id: "axle",
      catalogPartId: "builtin:axle-1x3",
      transform: { positionLdu: [20, -2, 0], orientationId: "upright-yaw-0" },
    });
    const edge: ConnectionEdge = {
      id: "axle-seat-to-bearing",
      // The protocol's versioned edge discriminator remains the legacy
      // `stud-tube`; the endpoint taxonomy decides this is an axle joint.
      kind: "stud-tube",
      a: { partId: "axle", portId: "axle:0" },
      b: { partId: "bearing", portId: "pinHole:0" },
      provenance: { source: "manual" },
    };
    const document = withAssembly([axle, bearing], [edge]);

    expect(validBrickConnections(document)).toEqual([edge]);
    const codes = validateBrickDocument(document).issues.map(({ code }) => code);
    expect(codes).not.toEqual(
      expect.arrayContaining([
        "UNKNOWN_CONNECTION_PORT",
        "INCOMPATIBLE_CONNECTION_PORTS",
        "CONNECTION_TRANSFORM_MISMATCH",
      ]),
    );
    expect(codes).toContain("PART_BODY_COLLISION");
  });
});
