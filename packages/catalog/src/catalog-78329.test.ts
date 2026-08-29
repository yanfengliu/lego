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

const PART_ID = "builtin:plate-1x5";
const STUDS_LDU = [-40, -20, 0, 20, 40].map((z) => [0, -4, z, 6.0001514980873605, 4] as const);
const CLUTCHES_LDU = [-40, -20, 0, 20, 40].map((z) => [0, 4, z] as const);

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
  ["p/box5.dat", 963, "sha256:ccb7b8a1d36692335b10ea6aa196849afcad4b15331683ed8112a10b50977318"],
  ["p/stud.dat", 698, "sha256:db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4"],
  ["p/stud3.dat", 710, "sha256:d29e9160faeaf85b2b72a098e89a81f41e0082517a82065d7b1f149b5fd2addd"],
  [
    "p/stug-1x5.dat",
    453,
    "sha256:9d7c7dc1ea19c9370dd1dc439aee1a69fb6deb190a09f7b1561a1a34ae7103b4",
  ],
  [
    "p/stug3-1x4.dat",
    430,
    "sha256:cae88c418acb36719fb6bc1d56916ab7e0734ffaf9204d7e3077a3c45ae7c79a",
  ],
  [
    "parts/78329.dat",
    599,
    "sha256:79ec75c5092750b0f2022dab9c7561376d8b2b33fc3dea7059081ef273d4f7fc",
  ],
] as const;

describe("78329 regular 1 x 5 plate catalog truth", () => {
  it("appends the exact /26 identity in the width-first frame", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
      ({ designId }) => designId === "78329",
    );
    if (blueprint?.designId !== "78329") throw new Error("78329 blueprint is missing");

    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/29");
    expect(PART_DEFINITIONS).toHaveLength(106);
    expect(PART_DEFINITIONS.at(-9)?.id).toBe(PART_ID);
    expect(SET_6651557_MEASURED_BLUEPRINTS.at(-9)).toBe(blueprint);
    expect(SET_6651557_MEASURED_BLUEPRINTS_G).toHaveLength(12);
    expect(part).toMatchObject({
      id: PART_ID,
      family: "plate",
      displayName: "Plate 1 x 5",
      dimensions: { widthStuds: 1, lengthStuds: 5, heightLdu: 8 },
      bodyBoundsLdu: { min: [-10, -4, -50], max: [10, 4, 50] },
      boundsLdu: { min: [-10, -8, -50], max: [10, 4, 50] },
      substitutionGroupId: "plate:1x5",
    });
    expect(resolvePartId("78329.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:78329.dat")).toBe(PART_ID);
    expect(resolvePartId("Plate 1 x 5")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-90",
      translationLdu: [0, -4, 0],
    });
    expect(blueprint.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
  });

  it("pins the exact official nine-file closure and source provenance", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["78329"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
      ({ designId }) => designId === "78329",
    );

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint?.ldrawSource).toEqual({
      title: "Plate  1 x  5",
      author: "Gerald Lasser [GeraldLasser]",
      ldrawOrg: "Part UPDATE 2022-01",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:79ec75c5092750b0f2022dab9c7561376d8b2b33fc3dea7059081ef273d4f7fc",
      closureFileCount: 9,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["78329"]).toEqual({
      bytes: 8_761,
      manifestSha256: "sha256:d203ae681cfa3842e210b894d46e69e555e64e638796d260c3a2cabdb474f283",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(45);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(237);
  });

  it("binds only the exact LDCad route and regular connector line", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
      ({ designId }) => designId === "78329",
    );
    if (blueprint === undefined) throw new Error("78329 has no G measured blueprint");

    expect("builderSource" in blueprint).toBe(false);
    expect(blueprint.ldcadShadowSource).toMatchObject({
      commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
      manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      shadowFiles: ["p/stud.dat", "p/stud3.dat", "parts/78329.dat"],
    });
    expect(blueprint.studsLdu).toEqual(STUDS_LDU);
    expect(blueprint.clutchesLdu).toEqual(CLUTCHES_LDU);
    expect(part.connectors.map(({ kind, positionLdu }) => [kind, positionLdu])).toEqual([
      ...STUDS_LDU.map(([x, y, z]) => ["stud", [x, y, z]]),
      ...CLUTCHES_LDU.map(([x, y, z]) => ["undersideClutch", [x, y, z]]),
    ]);
  });

  it("binds 460 triangles, 39 body boxes, and five nominal-profile studs", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:78329.dat"]!;
    if (asset.indices === undefined) throw new Error("78329 mesh is unexpectedly unindexed");
    const boxes = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
        primitive.kind === "box",
    );
    const cylinders = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
        primitive.kind === "cylinder",
    );

    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 220 },
      { role: "stud", triangleStart: 220, triangleCount: 240 },
    ]);
    expect(asset.indices.length / 3).toBe(460);
    expect(asset.positionsLdu.length / 3).toBe(489);
    expect(boxes).toHaveLength(39);
    expect(cylinders).toHaveLength(5);
    expect(cylinders.every(({ radiusLdu }) => radiusLdu === 6.0001514980873605)).toBe(true);
    expect(
      cylinders.every(
        ({ validatedConnectionProfileRadiusLdu }) => validatedConnectionProfileRadiusLdu === 6,
      ),
    ).toBe(true);
    expect(part.collision.allowances).toHaveLength(5);
    expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });
  });

  it("pins the reviewed /29 projection of the /25 prefix under its historical truth label", () => {
    const priorParts = PART_DEFINITIONS.slice(0, 97);
    const priorDefinitionBytes = JSON.stringify(priorParts).replaceAll(
      "builtin.basic-parts/29",
      "builtin.basic-parts/25",
    );
    const connectorCollision = priorParts.map(({ id, connectors, collision }) => ({
      id,
      connectors,
      collision,
    }));

    expect(priorParts).toHaveLength(97);
    expect({
      definitionBytes: priorDefinitionBytes.length,
      definitionHash: createHash("sha256").update(priorDefinitionBytes).digest("hex"),
      connectorCollisionHash: createHash("sha256")
        .update(JSON.stringify(connectorCollision))
        .digest("hex"),
    }).toEqual({
      definitionBytes: 1_619_557,
      definitionHash: "b7bfd7c394ee8188b2ead326a2c16e1a2c8605a75d14d4ce11c4cfe9e2a9ad20",
      connectorCollisionHash: "7e7b46ceaa24d4533ab024c12acd43d1d1fc6fb34ce52f0d502b2dd9d16c9f6e",
    });
  });
});
