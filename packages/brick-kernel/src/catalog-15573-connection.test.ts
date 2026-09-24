import { describe, expect, it } from "vitest";

import { getPartDefinition } from "@lego-studio/catalog";
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

/**
 * 15573, "Plate 1 x 2 with Groove with 1 Centre Stud, without Understud", seats
 * centred on one stud as well as on two studs under its cells. Booklet 6651557
 * step 29 prints it centred on each 11253 roller skate's single stud; with only
 * its two grid seats nothing found a clutch there, and each jumper and the tile
 * on it were an assembly of their own (DISCONNECTED_ASSEMBLY).
 *
 * Bound: these documents hold one jumper at yaw 0 or yaw 270 on a 1 x 1 plate,
 * a 1 x 2 plate or a skate at the skate's own yaw. They prove the catalog seat,
 * its collision allowance and its shared capacity through the kernel validator;
 * placement discovery is `apps/web/src/placement-15573.test.ts`.
 */

const JUMPER = "builtin:jumper-plate-1x2";
const CENTER = "undersideClutch:center";

function withAssembly(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "15573-center-seat", name: "15573 center seat" });
  return {
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
  };
}

function placed(
  id: string,
  catalogPartId: string,
  positionLdu: readonly [number, number, number],
  orientationId = "upright-yaw-0",
): PartInstance {
  return createPartInstance({ id, catalogPartId, transform: { positionLdu, orientationId } });
}

function edge(id: string, stud: PartPortRef, clutch: PartPortRef): ConnectionEdge {
  return { id, kind: "stud-tube", a: stud, b: clutch, provenance: { source: "manual" } };
}

/** A 1 x 1 plate under the jumper at world z, the jumper's own origin at [10, 0, 0]. */
function plateUnder(id: string, zLdu: number): PartInstance {
  return placed(id, "builtin:plate-1x1", [10, 8, zLdu]);
}

function scopeFor(
  base: BrickDocumentV1,
  requiredAttachmentPorts: readonly PartPortRef[],
): ScopeCapabilityV1 {
  return {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "15573-center-seat-scope",
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

describe("15573 center seat", () => {
  it("declares a center seat between its two grid seats, each grid seat sharing one of its cells", () => {
    const jumper = getPartDefinition(JUMPER)!;

    expect(
      jumper.connectors.map(({ id, kind, positionLdu, sharedCapacityGroupIds }) => ({
        id,
        kind,
        positionLdu,
        sharedCapacityGroupIds,
      })),
    ).toEqual([
      {
        id: "undersideClutch:0:0",
        kind: "undersideClutch",
        positionLdu: [0, 4, -10],
        sharedCapacityGroupIds: ["15573:negative-z-half"],
      },
      {
        id: "undersideClutch:0:1",
        kind: "undersideClutch",
        positionLdu: [0, 4, 10],
        sharedCapacityGroupIds: ["15573:positive-z-half"],
      },
      {
        id: CENTER,
        kind: "undersideClutch",
        positionLdu: [0, 4, 0],
        sharedCapacityGroupIds: ["15573:negative-z-half", "15573:positive-z-half"],
      },
      { id: "stud:0", kind: "stud", positionLdu: [0, -4, 0], sharedCapacityGroupIds: undefined },
    ]);
    // The same stud-entry allowance every other seat has, so a seated stud is
    // not reported as colliding with the shell it enters.
    expect(jumper.collision.allowances.filter(({ portId }) => portId === CENTER)).toEqual([
      {
        id: "tubeSeat:center",
        portId: CENTER,
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [0, 2, 0],
        radiusLdu: 6,
        maxInsertionDepthLdu: 4,
        requiresValidatedConnection: true,
      },
    ]);
  });

  it("seats centred on a single plate stud through the center seat with no issue at all", () => {
    const plate = placed("plate", "builtin:plate-1x1", [10, 8, 10]);
    const jumper = placed("jumper", JUMPER, [10, 0, 10]);
    const connection = edge(
      "plate-to-jumper",
      { partId: "plate", portId: "stud:0:0" },
      { partId: "jumper", portId: CENTER },
    );
    const document = withAssembly([plate, jumper], [connection]);
    const report = validateBrickDocument(document);

    expect(validBrickConnections(document)).toEqual([connection]);
    expect(report.issues).toEqual([]);
    expect(report.documentGloballyValid).toBe(true);
  });

  it("seats on a roller skate's one stud as booklet 6651557 step 29 places it", () => {
    // The skate's stud at [40, -20, -20] (a synthetic position), the jumper's origin
    // at [40, -24, -20] at yaw 270, where its grid seats sit at x 30 and 50.
    const skate = placed("skate", "builtin:roller-skate", [40, -16, -20], "upright-yaw-270");
    const jumper = placed("jumper", JUMPER, [40, -24, -20], "upright-yaw-270");
    const connection = edge(
      "skate-to-jumper",
      { partId: "skate", portId: "stud:0" },
      { partId: "jumper", portId: CENTER },
    );
    const document = withAssembly([skate, jumper], [connection]);
    const report = validateBrickDocument(document);

    expect(validBrickConnections(document)).toEqual([connection]);
    expect(report.issues).toEqual([]);
    expect(report.documentGloballyValid).toBe(true);
  });

  it("still seats on two studs of a 1 x 2 plate through both grid seats", () => {
    const plate = placed("plate", "builtin:plate-1x2", [10, 8, 0]);
    const jumper = placed("jumper", JUMPER, [10, 0, 0]);
    const connections = [
      edge(
        "negative",
        { partId: "plate", portId: "stud:0:0" },
        { partId: "jumper", portId: "undersideClutch:0:0" },
      ),
      edge(
        "positive",
        { partId: "plate", portId: "stud:0:1" },
        { partId: "jumper", portId: "undersideClutch:0:1" },
      ),
    ] as const;
    const document = withAssembly([plate, jumper], connections);
    const report = validateBrickDocument(document);

    expect(validBrickConnections(document)).toEqual(connections);
    expect(report.issues).toEqual([]);
    expect(report.documentGloballyValid).toBe(true);
  });

  it.each([
    ["negative", -10, "undersideClutch:0:0"],
    ["positive", 10, "undersideClutch:0:1"],
  ] as const)(
    "refuses the center seat together with the %s grid seat through shared capacity",
    (side, zLdu, gridPort) => {
      const jumper = placed("jumper", JUMPER, [10, 0, 0]);
      const center = plateUnder("center", 0);
      const outer = plateUnder(side, zLdu);
      const document = withAssembly(
        [jumper, center, outer],
        [
          edge(
            "center-to-jumper",
            { partId: "center", portId: "stud:0:0" },
            { partId: "jumper", portId: CENTER },
          ),
          edge(
            `${side}-to-jumper`,
            { partId: side, portId: "stud:0:0" },
            { partId: "jumper", portId: gridPort },
          ),
        ],
      );
      const report = validateBrickDocument(document);

      expect(validBrickConnections(document)).toHaveLength(1);
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "PORT_CAPACITY_EXCEEDED",
            message: expect.stringContaining(
              `shared connector-capacity cell 15573:${side}-z-half on part jumper`,
            ),
          }),
        ]),
      );
      expect(report.documentGloballyValid).toBe(false);
    },
  );

  it("refuses a scope that requires the center seat and a grid seat, and allows both grid seats", () => {
    const base = withAssembly([placed("jumper", JUMPER, [10, 0, 0])], []);
    const occupiedConflicts = (portIds: readonly string[]) =>
      collectScopePolicyIssues(
        base,
        base,
        [],
        scopeFor(
          base,
          portIds.map((portId) => ({ partId: "jumper", portId })),
        ),
      ).filter(({ code }) => code === "SCOPE_REQUIRED_ATTACHMENT_OCCUPIED");

    expect(occupiedConflicts([CENTER, "undersideClutch:0:0"])).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("shared connector-capacity cell 15573:negative-z-half"),
      }),
    ]);
    expect(occupiedConflicts(["undersideClutch:0:0", "undersideClutch:0:1"])).toEqual([]);
  });
});
