import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  BUILTIN_CATALOG_VERSION,
  PART_DEFINITIONS,
  getPartDefinition,
  resolvePartId,
  validateMeshPartDefinitionAdmission,
  type CollisionPrimitive,
} from "./index.js";
import {
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_CLOSURE_MANIFESTS,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";
import { SET_6651557_MEASURED_BLUEPRINTS_G } from "./part-blueprints-6651557-measured-g.ts";

const PART_ID = "builtin:plate-3x3";
const GRID_LDU = [-20, 0, 20] as const;
const SEATS_LDU = GRID_LDU.flatMap((x) => GRID_LDU.map((z) => [x, z] as const));

const EXPECTED_CLOSURE = [
  [
    "p/4-4cyli.dat",
    2_687,
    "sha256:4a742c2765b6ebf98245baaf8a160a4ff587fc93d36c8ee2b9074712a2f968c4",
  ],
  [
    "p/4-4disc.dat",
    1_137,
    "sha256:a00b5547776f61a7389d303616987c76b3c4de86ad8ec32f22857e1bd5e5e40f",
  ],
  [
    "p/4-4edge.dat",
    1_084,
    "sha256:54a52196e421fd1717d291ff52ea57553b1fb238907c1678cc1f1a84c698b1da",
  ],
  [
    "p/4-4ring3.dat",
    1_628,
    "sha256:1f2835ac308154edc2d6f479d8e742a55be981f6167b20bfa100c195bc0731dd",
  ],
  ["p/box5.dat", 963, "sha256:ccb7b8a1d36692335b10ea6aa196849afcad4b15331683ed8112a10b50977318"],
  ["p/stud.dat", 698, "sha256:db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4"],
  ["p/stud4.dat", 935, "sha256:871cdcab26e7f5113488a24c453d6fabda75b275b06de592e0bfaad4292c12a3"],
  [
    "p/stug-3x3.dat",
    869,
    "sha256:ec81497656a4a77a32cc09b131026c9882ab2da35944f701aa7575d43667d7f0",
  ],
  [
    "p/stug4-2x2.dat",
    435,
    "sha256:cf6e68b84d37562ed1a035015c23f804157ce6a80a7632a179e4def8ddcacfcb",
  ],
  [
    "parts/11212.dat",
    642,
    "sha256:c527adbbc5db2983cdc9d0b28481d57a248fd0125d8aa00c13aebd7c32b6633f",
  ],
] as const;

describe("11212 regular 3 x 3 plate catalog truth", () => {
  it("appends the exact /24 identity in the canonical square frame", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
      ({ designId }) => designId === "11212",
    );
    if (blueprint?.designId !== "11212") throw new Error("11212 blueprint is missing");

    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/24");
    expect(PART_DEFINITIONS).toHaveLength(96);
    expect(PART_DEFINITIONS.at(-1)?.id).toBe(PART_ID);
    expect(SET_6651557_MEASURED_BLUEPRINTS.at(-1)).toBe(blueprint);
    expect(SET_6651557_MEASURED_BLUEPRINTS_G).toHaveLength(2);
    expect(part).toMatchObject({
      id: PART_ID,
      family: "plate",
      displayName: "Plate 3 x 3",
      dimensions: { widthStuds: 3, lengthStuds: 3, heightLdu: 8 },
      bodyBoundsLdu: { min: [-30, -4, -30], max: [30, 4, 30] },
      boundsLdu: { min: [-30, -8, -30], max: [30, 4, 30] },
      substitutionGroupId: "plate:3x3",
    });
    expect(resolvePartId("11212.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:11212.dat")).toBe(PART_ID);
    expect(resolvePartId("Plate 3 x 3")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-0",
      translationLdu: [0, -4, 0],
    });
    expect(blueprint.connectorGridCenterLdu).toEqual([0, 0]);
    expect(blueprint.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
  });

  it("pins the exact official ten-file closure and source provenance", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["11212"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
      ({ designId }) => designId === "11212",
    );

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint?.ldrawSource).toEqual({
      title: "Plate  3 x  3",
      author: "Rolf Osterthun [Rolf]",
      ldrawOrg: "Part UPDATE 2012-03",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:c527adbbc5db2983cdc9d0b28481d57a248fd0125d8aa00c13aebd7c32b6633f",
      closureFileCount: 10,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["11212"]).toEqual({
      bytes: 11_078,
      manifestSha256: "sha256:8ff079db5d230fbba570a54ef1718c37a33db1059b31034fdd5a5ba9f12e0c73",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(35);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(207);
  });

  it("records the consulted LDCad route and its active regular clutch lattice", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
      ({ designId }) => designId === "11212",
    );
    if (blueprint === undefined) throw new Error("11212 has no G measured blueprint");

    expect("builderSource" in blueprint).toBe(false);
    expect("builderConnectivitySource" in blueprint).toBe(false);
    expect(blueprint.ldcadShadowSource).toEqual({
      libraryId: "ldcad-shadow-library",
      commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
      manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      compositionId: "ldcad-shadow-composed-over-ldraw-tree/1",
      shadowFiles: ["p/stud.dat", "p/stud4.dat", "parts/11212.dat"],
    });
    expect(blueprint.studsLdu).toEqual(
      SEATS_LDU.map(([x, z]) => [x, -4, z, 6.0001514980873605, 4]),
    );
    expect(blueprint.clutchesLdu).toEqual(SEATS_LDU.map(([x, z]) => [x, 4, z]));
    expect(
      part.connectors.map(({ id, kind, gender, positionLdu, normal, compatibleKinds }) => ({
        id,
        kind,
        gender,
        positionLdu,
        normal,
        compatibleKinds,
      })),
    ).toEqual([
      ...SEATS_LDU.map(([x, z], index) => ({
        id: `stud:${index}`,
        kind: "stud",
        gender: "male",
        positionLdu: [x, -4, z],
        normal: [0, -1, 0],
        compatibleKinds: ["undersideClutch"],
      })),
      ...SEATS_LDU.map(([x, z], index) => ({
        id: `undersideClutch:${index}`,
        kind: "undersideClutch",
        gender: "female",
        positionLdu: [x, 4, z],
        normal: [0, 1, 0],
        compatibleKinds: ["stud"],
      })),
    ]);
  });

  it("binds 844 triangles, 129 body boxes, and nine nominal-profile studs", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:11212.dat"]!;
    if (asset.indices === undefined) throw new Error("11212 mesh is unexpectedly unindexed");
    const boxes = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
        primitive.kind === "box",
    );
    const cylinders = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
        primitive.kind === "cylinder",
    );

    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 412 },
      { role: "stud", triangleStart: 412, triangleCount: 432 },
    ]);
    expect(asset.indices.length / 3).toBe(844);
    expect(asset.positionsLdu.length / 3).toBe(873);
    expect(part.collision.primitives).toHaveLength(138);
    expect(boxes).toHaveLength(129);
    expect(cylinders).toEqual(
      SEATS_LDU.map(([x, z], index) => ({
        id: `stud:${index}`,
        kind: "cylinder",
        tag: "stud",
        axis: "y",
        centerLdu: [x, -6, z],
        radiusLdu: 6.0001514980873605,
        validatedConnectionProfileRadiusLdu: 6,
        heightLdu: 4,
      })),
    );
    expect(part.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(part.collision.allowances).toEqual(
      SEATS_LDU.map(([x, z], index) => ({
        id: `tubeSeat:${index}`,
        portId: `undersideClutch:${index}`,
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [x, 2, z],
        radiusLdu: 6,
        maxInsertionDepthLdu: 4,
        requiresValidatedConnection: true,
      })),
    );
    expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });
  });

  it("keeps every /23 part payload byte unchanged after restoring its historical truth label", () => {
    const priorParts = PART_DEFINITIONS.slice(0, 95);
    const priorDefinitionBytes = JSON.stringify(priorParts).replaceAll(
      "builtin.basic-parts/24",
      "builtin.basic-parts/23",
    );
    const connectorCollision = priorParts.map(({ id, connectors, collision }) => ({
      id,
      connectors,
      collision,
    }));
    const collision = priorParts.map(({ id, collision: value }) => ({ id, collision: value }));

    expect(priorParts).toHaveLength(95);
    expect({
      definitionBytes: priorDefinitionBytes.length,
      definitionHash: createHash("sha256").update(priorDefinitionBytes).digest("hex"),
      connectorCollisionHash: createHash("sha256")
        .update(JSON.stringify(connectorCollision))
        .digest("hex"),
      collisionHash: createHash("sha256").update(JSON.stringify(collision)).digest("hex"),
    }).toEqual({
      definitionBytes: 1_583_353,
      definitionHash: "ceff2b3acbb53f647eea56d6ae4d271c1c048f94c7a035faf8a60b2979521ba3",
      connectorCollisionHash: "cd14902b4fda0525457091ed7e59820113cf52dd5cbcf15d0c88f58690bc486f",
      collisionHash: "2c6a27bf11f5f9d16ef8535b053df64b8c46940af4875a94b3380cf0d52b7bee",
    });
  });
});
