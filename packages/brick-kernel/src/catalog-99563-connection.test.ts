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

function withAssembly(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "99563-capacity", name: "99563 capacity gate" });
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

function edge(lowerId: string, clutchIndex: 0 | 1 | 2): ConnectionEdge {
  return edgeToTile(lowerId, "tile", clutchIndex);
}

function edgeToTile(lowerId: string, tileId: string, clutchIndex: 0 | 1 | 2): ConnectionEdge {
  return {
    id: `${lowerId}-to-${tileId}`,
    kind: "stud-tube",
    a: { partId: lowerId, portId: "stud:0:0" },
    b: { partId: tileId, portId: `undersideClutch:${clutchIndex}` },
    provenance: { source: "manual" },
  };
}

function scopeFor(
  base: BrickDocumentV1,
  requiredAttachmentPorts: readonly PartPortRef[],
): ScopeCapabilityV1 {
  return {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "99563-capacity-scope",
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

describe("99563 shared connector capacity", () => {
  const tile = createPartInstance({
    id: "tile",
    catalogPartId: "builtin:tile-1x2-chamfered-indented",
  });

  it("allows both primary-grid outer seats to be occupied together", () => {
    const negative = lower("negative", -10);
    const positive = lower("positive", 10);
    const connections = [edge("negative", 0), edge("positive", 2)] as const;
    const document = withAssembly([tile, negative, positive], connections);

    expect(validBrickConnections(document)).toEqual(connections);
    expect(validateBrickDocument(document).issues).toEqual([]);
    expect(validateBrickDocument(document).documentGloballyValid).toBe(true);
  });

  it("allows the alternate center seat by itself", () => {
    const center = lower("center", 0);
    const connection = edge("center", 1);
    const document = withAssembly([tile, center], [connection]);

    expect(validBrickConnections(document)).toEqual([connection]);
    expect(validateBrickDocument(document).issues).toEqual([]);
  });

  it.each([
    ["negative", -10, 0],
    ["positive", 10, 2],
  ] as const)(
    "rejects center plus the %s outer seat through shared capacity",
    (id, zLdu, clutch) => {
      const center = lower("center", 0);
      const outer = lower(id, zLdu);
      const document = withAssembly([tile, center, outer], [edge("center", 1), edge(id, clutch)]);
      const report = validateBrickDocument(document);

      expect(validBrickConnections(document)).toHaveLength(1);
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "PORT_CAPACITY_EXCEEDED",
            message: expect.stringContaining(
              `Prior connection center-to-tile conflicts at shared connector-capacity cell 99563:${id === "negative" ? "negative" : "positive"}-z-half on part tile`,
            ),
          }),
        ]),
      );
      expect(report.documentGloballyValid).toBe(false);
      expect(
        validateBrickDocument({ ...document, connections: [...document.connections].reverse() }),
      ).toEqual(report);
    },
  );

  it("keeps identical part-local group names isolated between instances", () => {
    const otherTile = createPartInstance({
      id: "other-tile",
      catalogPartId: "builtin:tile-1x2-chamfered-indented",
      transform: { positionLdu: [0, 0, 100], orientationId: "upright-yaw-0" },
    });
    const center = lower("center", 0);
    const otherCenter = lower("other-center", 100);
    const connections = [
      edgeToTile("center", "tile", 1),
      edgeToTile("other-center", "other-tile", 1),
    ] as const;
    const document = withAssembly([tile, otherTile, center, otherCenter], connections);

    expect(validBrickConnections(document)).toEqual(connections);
    expect(validateBrickDocument(document).issues.map(({ code }) => code)).not.toContain(
      "PORT_CAPACITY_EXCEEDED",
    );
  });

  it("keeps remediation, the exact cell, and prior evidence visible at maximum identifier length", () => {
    const tileId = "t".repeat(128);
    const centerId = "c".repeat(128);
    const outerId = "o".repeat(128);
    const priorConnectionId = "a".repeat(128);
    const currentConnectionId = "b".repeat(128);
    const longTile = createPartInstance({
      id: tileId,
      catalogPartId: "builtin:tile-1x2-chamfered-indented",
    });
    const center = lower(centerId, 0);
    const outer = lower(outerId, -10);
    const prior = { ...edgeToTile(centerId, tileId, 1), id: priorConnectionId };
    const current = { ...edgeToTile(outerId, tileId, 0), id: currentConnectionId };
    const issue = validateBrickDocument(
      withAssembly([longTile, center, outer], [prior, current]),
    ).issues.find(({ code }) => code === "PORT_CAPACITY_EXCEEDED");

    expect(issue).toBeDefined();
    expect(issue?.message).toContain("Use a non-overlapping endpoint.");
    expect(issue?.message).toContain(`Prior connection ${"a".repeat(32)}...sha256:`);
    expect(issue?.message).toContain("shared connector-capacity cell 99563:negative-z-half");
    expect(issue?.message.length).toBeLessThanOrEqual(256);
    expect(issue?.partIds).toEqual(expect.arrayContaining([tileId, outerId]));
    expect(issue?.connectionIds).toEqual([priorConnectionId, currentConnectionId]);
  });

  it.each([
    ["center then negative", [1, 0]],
    ["negative then center", [0, 1]],
    ["center then positive", [1, 2]],
    ["positive then center", [2, 1]],
  ] as const)("refuses mutually exclusive required ports: %s", (_label, indices) => {
    const base = withAssembly([tile], []);
    const required = indices.map((index) => ({
      partId: tile.id,
      portId: `undersideClutch:${index}`,
    }));
    const conflicts = collectScopePolicyIssues(base, base, [], scopeFor(base, required)).filter(
      ({ code }) => code === "SCOPE_REQUIRED_ATTACHMENT_OCCUPIED",
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.message).toContain("shared connector-capacity cell");
    expect(conflicts[0]?.message).toContain("a capability must name attachment ports");
  });

  it("permits both outer required ports and isolates groups between instances", () => {
    const otherTile = createPartInstance({
      id: "other-tile",
      catalogPartId: "builtin:tile-1x2-chamfered-indented",
      transform: { positionLdu: [0, 0, 100], orientationId: "upright-yaw-0" },
    });
    const base = withAssembly([tile, otherTile], []);
    const required = [
      { partId: tile.id, portId: "undersideClutch:0" },
      { partId: tile.id, portId: "undersideClutch:2" },
      { partId: otherTile.id, portId: "undersideClutch:1" },
    ];

    expect(
      collectScopePolicyIssues(base, base, [], scopeFor(base, required)).filter(
        ({ code }) => code === "SCOPE_REQUIRED_ATTACHMENT_OCCUPIED",
      ),
    ).toEqual([]);
  });

  it("names the exact shared cell and prior base connection for occupied scope ports", () => {
    const center = lower("center", 0);
    const connection = edge("center", 1);
    const base = withAssembly([tile, center], [connection]);
    const required = [{ partId: tile.id, portId: "undersideClutch:0" }];
    const conflicts = collectScopePolicyIssues(base, base, [], scopeFor(base, required)).filter(
      ({ code }) => code === "SCOPE_REQUIRED_ATTACHMENT_OCCUPIED",
    );

    expect(conflicts).toEqual([
      expect.objectContaining({
        message: expect.stringContaining(
          "shared connector-capacity cell 99563:negative-z-half on part tile, already occupied by base connection center-to-tile",
        ),
      }),
    ]);
  });
});
