import { describe, expect, it } from "vitest";

import { getPartDefinition } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { validBrickConnections, validateBrickDocument } from "./validation";

function withAssembly(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "32064-connections",
    name: "32064 connection gate",
  });
  return {
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
  };
}

describe("32064 connection semantics", () => {
  it("projects the one exact LDCad axle-hole seat onto the measured transverse axis", () => {
    const bearing = getPartDefinition("builtin:technic-brick-1x2-axle-hole");
    if (bearing === undefined) {
      throw new Error("Catalog /23 must include builtin:technic-brick-1x2-axle-hole");
    }

    expect(
      bearing.connectors
        .filter(({ kind }) => kind === "axleHole")
        .map(({ id, kind, positionLdu, normal, profileId, gender, compatibleKinds }) => ({
          id,
          kind,
          positionLdu,
          normal,
          profileId,
          gender,
          compatibleKinds,
        })),
    ).toEqual([
      {
        id: "axleHole:0",
        kind: "axleHole",
        positionLdu: [0, -2, 0],
        normal: [1, 0, 0],
        profileId: "axle-cross/1",
        gender: "female",
        compatibleKinds: ["axle"],
      },
    ]);
  });

  it("accepts the exact shared axle seat while retaining conservative body collision", () => {
    const bearing = createPartInstance({
      id: "bearing",
      catalogPartId: "builtin:technic-brick-1x2-axle-hole",
    });
    const axle = createPartInstance({
      id: "axle",
      catalogPartId: "builtin:axle-1x3",
      transform: { positionLdu: [20, -2, 0], orientationId: "upright-yaw-0" },
    });
    const edge: ConnectionEdge = {
      id: "axle-seat-to-axle-hole",
      // The protocol discriminator remains versioned as `stud-tube`; the two
      // exact endpoint ports carry this joint's axle/axle-hole taxonomy.
      kind: "stud-tube",
      a: { partId: "axle", portId: "axle:0" },
      b: { partId: "bearing", portId: "axleHole:0" },
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
    // The discrete seat validates only the structural edge. There is no bore
    // relief, continuous-slide range, or stability claim in this admission.
    expect(codes).toContain("PART_BODY_COLLISION");
  });
});
