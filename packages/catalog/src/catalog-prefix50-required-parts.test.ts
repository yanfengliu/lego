import { describe, expect, it } from "vitest";

import {
  BUILTIN_CATALOG_VERSION,
  PART_DEFINITIONS,
  getPartDefinition,
  resolvePartId,
  validateMeshPartDefinitionAdmission,
  type CollisionPrimitive,
  type PartDefinition,
} from "./index.js";
import {
  BUNDLED_LDRAW_CLOSURE_MANIFESTS,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import { SET_6651557_MEASURED_BLUEPRINTS_G } from "./part-blueprints-6651557-measured-g.ts";

const REQUIRED = [
  {
    designId: "99563",
    id: "builtin:tile-1x2-chamfered-indented",
    family: "tile",
    dimensions: [1, 2, 8],
    bounds: [
      [-10, -4, -20],
      [10, 4, 20],
    ],
    triangles: 228,
    boxes: 20,
    studs: 0,
    clutches: 3,
    sourceConnectors: 0,
    closure: [
      10,
      12_212,
      "sha256:80b536b9d216c1db5a225b67f9bd852d98a7faf8474016984fdbf3a2dc06f9a4",
    ],
  },
  {
    designId: "73230",
    id: "builtin:technic-brick-1x1-axle-hole",
    family: "technic-brick",
    dimensions: [1, 1, 24],
    bounds: [
      [-10, -16, -10],
      [10, 12, 10],
    ],
    triangles: 294,
    boxes: 10,
    studs: 1,
    clutches: 1,
    sourceConnectors: 1,
    closure: [
      18,
      20_939,
      "sha256:75581e2b138e94f7060a86cabda442b9b134375d7ef84d16c3453f3907863cf7",
    ],
  },
  {
    designId: "35464",
    id: "builtin:slope-1x1-double-45",
    family: "slope",
    dimensions: [1, 1, 16],
    bounds: [
      [-10, -8, -10],
      [10, 8, 10],
    ],
    triangles: 52,
    boxes: 75,
    studs: 0,
    clutches: 1,
    sourceConnectors: 0,
    closure: [5, 3_703, "sha256:7df7208fa114b44aa9e4104b1693d614a480d1b0336224c87dfa2b8d0a595c28"],
  },
  {
    designId: "49307",
    id: "builtin:curved-slope-1x1-outside-bow",
    family: "curved-slope",
    dimensions: [1, 1, 16],
    bounds: [
      [-10, -8, -10],
      [10, 8, 10],
    ],
    triangles: 100,
    boxes: 75,
    studs: 0,
    clutches: 1,
    sourceConnectors: 0,
    closure: [7, 5_912, "sha256:dfe1399ae48a4097300f04b2181e8733521e3d8d14c8c3468aeda09e59c36dce"],
  },
] as const;

describe("bounded first-50 required catalog tranche", () => {
  it("appends four exact /27 definitions without moving the /26 roster", () => {
    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/27");
    expect(PART_DEFINITIONS).toHaveLength(102);
    expect(PART_DEFINITIONS.slice(-4).map(({ id }) => id)).toEqual(REQUIRED.map(({ id }) => id));
    expect(SET_6651557_MEASURED_BLUEPRINTS_G).toHaveLength(8);
  });

  it.each(REQUIRED)(
    "pins $designId identity, source closure, and physical representation",
    (expected) => {
      const part = getPartDefinition(expected.id)!;
      const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
        ({ designId }) => designId === expected.designId,
      );
      const asset = SET_6651557_MESH_ASSETS[`ldraw:official:${expected.designId}.dat`]!;
      const boxes = part.collision.primitives.filter(
        (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
          primitive.kind === "box",
      );
      const studs = part.connectors.filter(({ kind }) => kind === "stud");
      const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch");
      const sourceConnectors = part.connectors.filter(
        ({ kind }) => kind !== "stud" && kind !== "undersideClutch",
      );

      expect(blueprint).toBeDefined();
      expect(part.family).toBe(expected.family);
      expect([
        part.dimensions.widthStuds,
        part.dimensions.lengthStuds,
        part.dimensions.heightLdu,
      ]).toEqual(expected.dimensions);
      expect([part.boundsLdu.min, part.boundsLdu.max]).toEqual(expected.bounds);
      expect(asset.indices?.length).toBe(expected.triangles * 3);
      expect(boxes).toHaveLength(expected.boxes);
      expect(studs).toHaveLength(expected.studs);
      expect(clutches).toHaveLength(expected.clutches);
      expect(sourceConnectors).toHaveLength(expected.sourceConnectors);
      expect(resolvePartId(`${expected.designId}.dat`)).toBe(expected.id);
      expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });

      const [closureFiles, closureBytes, closureDigest] = expected.closure;
      expect(blueprint?.ldrawSource.closureFileCount).toBe(closureFiles);
      expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS[expected.designId]).toEqual({
        bytes: closureBytes,
        manifestSha256: closureDigest,
      });
    },
  );

  it("binds 73230's transverse axle-hole direction to the exact shadow walk", () => {
    const part = getPartDefinition("builtin:technic-brick-1x1-axle-hole")!;
    expect(part.connectors.find(({ kind }) => kind === "axleHole")).toMatchObject({
      id: "axleHole:0",
      positionLdu: [0, -2, 0],
      normal: [-1, 0, 0],
    });
  });

  it("admits 99563's center seat only through its exact two half-slot claims", () => {
    const part = getPartDefinition("builtin:tile-1x2-chamfered-indented")!;
    const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch");
    expect(
      clutches.map(({ positionLdu, sharedCapacityGroupIds }) => ({
        positionLdu,
        sharedCapacityGroupIds,
      })),
    ).toEqual([
      {
        positionLdu: [0, 4, -10],
        sharedCapacityGroupIds: ["99563:negative-z-half"],
      },
      {
        positionLdu: [0, 4, 0],
        sharedCapacityGroupIds: ["99563:negative-z-half", "99563:positive-z-half"],
      },
      {
        positionLdu: [0, 4, 10],
        sharedCapacityGroupIds: ["99563:positive-z-half"],
      },
    ]);

    const mutateCenter = (
      sharedCapacityGroupIds: readonly string[] | undefined,
    ): PartDefinition => ({
      ...part,
      connectors: part.connectors.map((connector) => {
        if (connector.id !== "undersideClutch:1") return connector;
        const { sharedCapacityGroupIds: ignored, ...withoutGroups } = connector;
        void ignored;
        return sharedCapacityGroupIds === undefined
          ? withoutGroups
          : { ...withoutGroups, sharedCapacityGroupIds };
      }),
    });
    for (const mutation of [
      mutateCenter(undefined),
      mutateCenter(["99563:negative-z-half"]),
      mutateCenter(["invented:left", "invented:right"]),
    ]) {
      expect(
        validateMeshPartDefinitionAdmission(mutation).issues.map(({ code }) => code),
      ).toContain("MESH_ADMISSION_CONNECTOR_GRID_MISMATCH");
    }
  });

  it("rejects a relabeled duplicate of 99563's three physical clutch frames", () => {
    const part = getPartDefinition("builtin:tile-1x2-chamfered-indented")!;
    const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch");
    const clonedPortIds = new Map(clutches.map(({ id }) => [id, `${id}:clone`] as const));
    const clonedClutches = clutches.map((connector) => {
      if (connector.sharedCapacityGroupIds === undefined) {
        throw new Error(`99563 connector ${connector.id} lacks its measured capacity claims.`);
      }
      return {
        ...connector,
        id: clonedPortIds.get(connector.id)!,
        sharedCapacityGroupIds: connector.sharedCapacityGroupIds.map(
          (groupId) => `clone:${groupId}`,
        ),
      };
    });
    const clonedAllowances = part.collision.allowances
      .filter(({ portId }) => clonedPortIds.has(portId))
      .map((allowance) => ({
        ...allowance,
        id: `${allowance.id}:clone`,
        portId: clonedPortIds.get(allowance.portId)!,
      }));
    const mutation: PartDefinition = {
      ...part,
      connectors: [...part.connectors, ...clonedClutches],
      collision: {
        ...part.collision,
        allowances: [...part.collision.allowances, ...clonedAllowances],
      },
    };

    const result = validateMeshPartDefinitionAdmission(mutation);
    const duplicateFrameIssues = result.issues.filter(
      ({ code, message }) =>
        code === "MESH_ADMISSION_CONNECTOR_INVALID" &&
        message.includes("changing connector ids or shared-capacity labels"),
    );
    expect(result.accepted).toBe(false);
    expect(duplicateFrameIssues.map(({ path }) => path)).toEqual([
      "/connectors/3",
      "/connectors/4",
      "/connectors/5",
    ]);
  });

  it("retains per-file attribution for every newly bundled source file", () => {
    const newFiles = BUNDLED_LDRAW_SOURCE_FILES.slice(211);
    expect(newFiles).toHaveLength(13);
    expect(newFiles.every(({ licenseExpression }) => licenseExpression === "CC-BY-4.0")).toBe(true);
    expect(newFiles.every(({ author, title }) => author.length > 0 && title.length > 0)).toBe(true);
  });
});
