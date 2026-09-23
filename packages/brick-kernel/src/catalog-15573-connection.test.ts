import { describe, expect, it } from "vitest";

import type {
  BrickDocumentV1,
  ConnectionEdge,
  PartInstance,
  PartPortRef,
  ScopeCapabilityV1,
} from "@lego-studio/protocol";

import { documentStructuralHash } from "./document";
import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { collectScopePolicyIssues } from "./patch-policy";
import { validBrickConnections, validateBrickDocument } from "./validation";

const JUMPER_ID = "jumper";
const OUTER_PORTS = ["undersideClutch:0:0", "undersideClutch:0:1"] as const;

function withAssembly(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "15573-capacity", name: "15573 capacity gate" });
  return {
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
  };
}

function lower(id: string, zLdu: number): PartInstance {
  return createPartInstance({
    id,
    catalogPartId: "builtin:plate-1x1",
    transform: { positionLdu: [0, 8, zLdu], orientationId: "upright-yaw-0" },
  });
}

function edge(lowerId: string, jumperId: string, portId: string): ConnectionEdge {
  return {
    id: `${lowerId}-to-${jumperId}`,
    kind: "stud-tube",
    a: { partId: lowerId, portId: "stud:0:0" },
    b: { partId: jumperId, portId },
    provenance: { source: "manual" },
  };
}

function jumperStudToSkateClutch() {
  const jumper = createPartInstance({
    id: "receiver-jumper",
    catalogPartId: "builtin:jumper-plate-1x2",
    transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-270" },
  });
  const skate = createPartInstance({
    id: "candidate-skate",
    catalogPartId: "builtin:roller-skate",
    transform: { positionLdu: [0, -8, 0], orientationId: "upright-yaw-90" },
  });
  const connection: ConnectionEdge = {
    id: "jumper-stud-to-skate-clutch",
    kind: "stud-tube",
    a: { partId: jumper.id, portId: "stud:0" },
    b: { partId: skate.id, portId: "undersideClutch:0" },
    provenance: { source: "manual" },
  };
  return { jumper, skate, connection };
}

function scopeFor(
  base: BrickDocumentV1,
  requiredAttachmentPorts: readonly PartPortRef[],
): ScopeCapabilityV1 {
  return {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "15573-capacity-scope",
    baseRevision: base.revision,
    baseDocumentHash: documentStructuralHash(base),
    frozenPartIds: [],
    mutablePartIds: [],
    requiredAttachmentPorts,
    allowedVolume: { minLdu: [-1000, -1000, -1000], maxLdu: [1000, 1000, 1000] },
    allowedCatalogPartIds: base.constraints.allowedCatalogPartIds,
    allowedColorIds: base.constraints.allowedColorIds,
    budgets: { maxAddedParts: 0, maxRemovedParts: 0, maxOperations: 0 },
  };
}

describe("15573 centered half-pitch connector capacity", () => {
  const jumper = createPartInstance({
    id: JUMPER_ID,
    catalogPartId: "builtin:jumper-plate-1x2",
  });

  it("admits the source-authored center seat as a real stud-tube connection", () => {
    const center = lower("center", 0);
    const connection = edge(center.id, jumper.id, "undersideClutch:center");
    const document = withAssembly([jumper, center], [connection]);

    expect(validBrickConnections(document)).toEqual([connection]);
    expect(validateBrickDocument(document)).toMatchObject({
      documentGloballyValid: true,
      issues: [],
    });
  });

  it("allows both historical outer seats to remain occupied together", () => {
    const negative = lower("negative", -10);
    const positive = lower("positive", 10);
    const connections = [
      edge(negative.id, jumper.id, OUTER_PORTS[0]),
      edge(positive.id, jumper.id, OUTER_PORTS[1]),
    ];
    const document = withAssembly([jumper, negative, positive], connections);

    expect(validBrickConnections(document)).toEqual(connections);
    expect(validateBrickDocument(document).issues).toEqual([]);
  });

  it.each([
    ["negative", -10, OUTER_PORTS[0], "15573:negative-z-half"],
    ["positive", 10, OUTER_PORTS[1], "15573:positive-z-half"],
  ] as const)("rejects center plus the %s outer seat", (id, zLdu, outerPort, groupId) => {
    const center = lower("center", 0);
    const outer = lower(id, zLdu);
    const connections = [
      edge(center.id, jumper.id, "undersideClutch:center"),
      edge(outer.id, jumper.id, outerPort),
    ];
    const document = withAssembly([jumper, center, outer], connections);
    const report = validateBrickDocument(document);

    expect(validBrickConnections(document)).toHaveLength(1);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PORT_CAPACITY_EXCEEDED",
          message: expect.stringContaining(
            `Prior connection center-to-jumper conflicts at shared connector-capacity cell ${groupId} on part jumper`,
          ),
        }),
      ]),
    );
    expect(report.documentGloballyValid).toBe(false);
    expect(
      validateBrickDocument({ ...document, connections: [...document.connections].reverse() }),
    ).toEqual(report);
  });

  it("applies the same exclusivity to scope-required attachment ports", () => {
    const base = withAssembly([jumper], []);
    const required = [
      { partId: jumper.id, portId: "undersideClutch:center" },
      { partId: jumper.id, portId: OUTER_PORTS[0] },
    ];

    expect(
      collectScopePolicyIssues(base, base, [], scopeFor(base, required)).filter(
        ({ code }) => code === "SCOPE_REQUIRED_ATTACHMENT_OCCUPIED",
      ),
    ).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("shared connector-capacity cell 15573:negative-z-half"),
      }),
    ]);
  });
});

describe("15573 source-rounded top-stud connection profile", () => {
  it("admits the exact 15573 stud into 11253's clutch through its validated edge", () => {
    const { jumper, skate, connection } = jumperStudToSkateClutch();
    const document = withAssembly([jumper, skate], [connection]);

    expect(validBrickConnections(document)).toEqual([connection]);
    expect(validateBrickDocument(document)).toMatchObject({
      documentGloballyValid: true,
      issues: [],
    });
  });

  it("keeps the same 15573-to-11253 placement colliding without its edge", () => {
    const { jumper, skate } = jumperStudToSkateClutch();
    const report = validateBrickDocument(withAssembly([jumper, skate], []));

    expect(report.documentGloballyValid).toBe(false);
    expect(report.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["DISCONNECTED_ASSEMBLY", "PART_STUD_BODY_COLLISION"]),
    );
  });

  it("does not grant the connected collision relief to a one-LDU misalignment", () => {
    const { jumper, skate, connection } = jumperStudToSkateClutch();
    const misaligned = {
      ...skate,
      transform: { ...skate.transform, positionLdu: [1, -8, 0] as const },
    };
    const document = withAssembly([jumper, misaligned], [connection]);
    const report = validateBrickDocument(document);

    expect(validBrickConnections(document)).toEqual([]);
    expect(report.documentGloballyValid).toBe(false);
    expect(report.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["PART_STUD_BODY_COLLISION"]),
    );
  });

  it("never extends the connected pair's relief to an identical third body", () => {
    const { jumper, skate, connection } = jumperStudToSkateClutch();
    const blocker = { ...skate, id: "unconnected-third-body" };
    const report = validateBrickDocument(withAssembly([jumper, skate, blocker], [connection]));

    expect(report.documentGloballyValid).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PART_STUD_BODY_COLLISION",
          partIds: [jumper.id, blocker.id],
        }),
      ]),
    );
  });

  it("keeps an equivalent already-profiled measured stud-to-clutch fit valid", () => {
    const lower = createPartInstance({
      id: "profiled-lower",
      catalogPartId: "builtin:roller-skate",
      transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-270" },
    });
    const upper = createPartInstance({
      id: "profiled-upper",
      catalogPartId: "builtin:roller-skate",
      transform: { positionLdu: [0, -8, 0], orientationId: "upright-yaw-90" },
    });
    const connection: ConnectionEdge = {
      id: "profiled-stud-to-profiled-clutch",
      kind: "stud-tube",
      a: { partId: lower.id, portId: "stud:0" },
      b: { partId: upper.id, portId: "undersideClutch:0" },
      provenance: { source: "manual" },
    };

    expect(validateBrickDocument(withAssembly([lower, upper], [connection]))).toMatchObject({
      documentGloballyValid: true,
      issues: [],
    });
  });
});
