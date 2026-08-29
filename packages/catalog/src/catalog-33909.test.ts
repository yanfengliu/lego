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

const PART_ID = "builtin:plate-2x2-two-studs";
const STUDS_LDU = [
  [-10, -4, 10, 6.0001514980873605, 4],
  [10, -4, 10, 6.0001514980873605, 4],
] as const;
const CLUTCHES_LDU = [
  [-10, 4, -10],
  [-10, 4, 10],
  [10, 4, -10],
  [10, 4, 10],
] as const;

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
    "p/stug-1x2.dat",
    333,
    "sha256:5842fa1baf6ea7f18fe4e355238cd733ff9bdbdc3d722be5cf8988f1c5fce414",
  ],
  [
    "parts/33909.dat",
    738,
    "sha256:8da6789db82746f179997ed4b917d00d34d03a6486d6aa27c76d17c9b21d8609",
  ],
] as const;

describe("33909 two-stud-edge plate catalog truth", () => {
  it("appends the exact /25 identity in the regular 2 x 2 frame", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
      ({ designId }) => designId === "33909",
    );
    if (blueprint?.designId !== "33909") throw new Error("33909 blueprint is missing");

    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/29");
    expect(PART_DEFINITIONS).toHaveLength(106);
    expect(PART_DEFINITIONS.at(-10)?.id).toBe(PART_ID);
    expect(SET_6651557_MEASURED_BLUEPRINTS.at(-10)).toBe(blueprint);
    expect(SET_6651557_MEASURED_BLUEPRINTS_G).toHaveLength(12);
    expect(part).toMatchObject({
      id: PART_ID,
      family: "plate",
      displayName: "Plate 2 x 2 with 2 Studs on One Edge",
      dimensions: { widthStuds: 2, lengthStuds: 2, heightLdu: 8 },
      bodyBoundsLdu: { min: [-20, -4, -20], max: [20, 4, 20] },
      boundsLdu: { min: [-20, -8, -20], max: [20, 4, 20] },
      substitutionGroupId: "plate:2x2-two-studs",
    });
    expect(resolvePartId("33909.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:33909.dat")).toBe(PART_ID);
    expect(resolvePartId("Plate 2 x 2 with 2 Studs on One Edge")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-0",
      translationLdu: [0, -4, 0],
    });
    expect(blueprint.connectorGridCenterLdu).toEqual([0, 0]);
    expect(blueprint.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
  });

  it("pins the exact official nine-file closure and source provenance", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["33909"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
      ({ designId }) => designId === "33909",
    );

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint?.ldrawSource).toEqual({
      title: "Plate  2 x  2 with 2 Studs on One Edge",
      author: "Magnus Forsberg [MagFors]",
      ldrawOrg: "Part UPDATE 2020-01",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:8da6789db82746f179997ed4b917d00d34d03a6486d6aa27c76d17c9b21d8609",
      closureFileCount: 9,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["33909"]).toEqual({
      bytes: 10_203,
      manifestSha256: "sha256:72174370ab6b3d2e0d00d7b72a0687a67da1cccd4014f1f799e113eecb504a15",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(45);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(237);
  });

  it("records only the consulted LDCad route as active connector authority", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
      ({ designId }) => designId === "33909",
    );
    if (blueprint === undefined) throw new Error("33909 has no G measured blueprint");

    expect("builderSource" in blueprint).toBe(false);
    expect("builderConnectivitySource" in blueprint).toBe(false);
    expect(blueprint.ldcadShadowSource).toEqual({
      libraryId: "ldcad-shadow-library",
      commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
      manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      compositionId: "ldcad-shadow-composed-over-ldraw-tree/1",
      shadowFiles: ["p/stud.dat", "p/stud4.dat", "parts/33909.dat"],
    });
    expect(blueprint.studsLdu).toEqual(STUDS_LDU);
    expect(blueprint.clutchesLdu).toEqual(CLUTCHES_LDU);
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
      ...STUDS_LDU.map(([x, y, z], index) => ({
        id: `stud:${index}`,
        kind: "stud",
        gender: "male",
        positionLdu: [x, y, z],
        normal: [0, -1, 0],
        compatibleKinds: ["undersideClutch"],
      })),
      ...CLUTCHES_LDU.map(([x, y, z], index) => ({
        id: `undersideClutch:${index}`,
        kind: "undersideClutch",
        gender: "female",
        positionLdu: [x, y, z],
        normal: [0, 1, 0],
        compatibleKinds: ["stud"],
      })),
    ]);
  });

  it("binds 220 triangles, 41 body boxes, and two nominal-profile studs", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:33909.dat"]!;
    if (asset.indices === undefined) throw new Error("33909 mesh is unexpectedly unindexed");
    const boxes = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
        primitive.kind === "box",
    );
    const cylinders = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
        primitive.kind === "cylinder",
    );

    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 124 },
      { role: "stud", triangleStart: 124, triangleCount: 96 },
    ]);
    expect(asset.indices.length / 3).toBe(220);
    expect(asset.positionsLdu.length / 3).toBe(242);
    expect(part.collision.primitives).toHaveLength(43);
    expect(boxes).toHaveLength(41);
    expect(cylinders).toEqual(
      STUDS_LDU.map(([x, y, z, radiusLdu, heightLdu], index) => ({
        id: `stud:${index}`,
        kind: "cylinder",
        tag: "stud",
        axis: "y",
        centerLdu: [x, y - heightLdu / 2, z],
        radiusLdu,
        validatedConnectionProfileRadiusLdu: 6,
        heightLdu,
      })),
    );
    expect(part.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
    expect(part.collision.allowances).toEqual(
      CLUTCHES_LDU.map(([x, y, z], index) => ({
        id: `tubeSeat:${index}`,
        portId: `undersideClutch:${index}`,
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [x, y - 2, z],
        radiusLdu: 6,
        maxInsertionDepthLdu: 4,
        requiresValidatedConnection: true,
      })),
    );
    expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });
  });

  it("pins the reviewed /29 projection of the /24 prefix under its historical truth label", () => {
    const priorParts = PART_DEFINITIONS.slice(0, 96);
    const priorDefinitionBytes = JSON.stringify(priorParts).replaceAll(
      "builtin.basic-parts/29",
      "builtin.basic-parts/24",
    );
    const connectorCollision = priorParts.map(({ id, connectors, collision }) => ({
      id,
      connectors,
      collision,
    }));
    const collision = priorParts.map(({ id, collision: value }) => ({ id, collision: value }));

    expect(priorParts).toHaveLength(96);
    expect({
      definitionBytes: priorDefinitionBytes.length,
      definitionHash: createHash("sha256").update(priorDefinitionBytes).digest("hex"),
      connectorCollisionHash: createHash("sha256")
        .update(JSON.stringify(connectorCollision))
        .digest("hex"),
      collisionHash: createHash("sha256").update(JSON.stringify(collision)).digest("hex"),
    }).toEqual({
      definitionBytes: 1_608_400,
      definitionHash: "767ea8f041535a60911f2433a1543e111c91db644d8feef6cc424a77cd0f5a52",
      connectorCollisionHash: "386403af4805edd20e8c7a7b65dd58c2a02b1a3737132c6ca965c0cb46264116",
      collisionHash: "ee8ea1c7cf6614a771ebb1a6a6944c5190b03eeea3d48de15d80cc42e70f701e",
    });
  });
});
