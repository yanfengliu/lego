import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

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
import { SET_6651557_NATIVE_RECORD_DIGESTS } from "./quarantine/set-6651557-native-record-digests.ts";

const PART_ID = "builtin:brick-1x2-grille";
const STUD_Z_LDU = [-10, 10] as const;
const CLUTCH_Z_LDU = [-10, 10] as const;

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
    "parts/2877.dat",
    5_566,
    "sha256:46c3a0dc6329d3f0be9b3b4485b5e2e41295bad750a0f4c4b6a2e6631c0c0029",
  ],
] as const;

describe("2877 grille brick catalog truth", () => {
  it("appends the exact /20 identity and pins its reviewed upright frame", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "2877")!;

    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/29");
    expect(PART_DEFINITIONS).toHaveLength(106);
    expect(PART_DEFINITIONS.at(-15)?.id).toBe(PART_ID);
    expect(part).toMatchObject({
      id: PART_ID,
      family: "brick",
      displayName: "Brick 1 x 2 with Grille",
      dimensions: { widthStuds: 1, lengthStuds: 2, heightLdu: 24 },
      bodyBoundsLdu: { min: [-10, -12, -20], max: [10, 12, 20] },
      boundsLdu: { min: [-10, -16, -20], max: [10, 12, 20] },
      substitutionGroupId: "brick:1x2-grille",
    });
    expect(resolvePartId("2877.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:2877.dat")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-90",
      translationLdu: [0, -12, 0],
    });
    expect(part.geometry.contentHash).toBe(
      "sha256:d9481ce2e412c82ef4aef7d07f877c95ac671763e55e2016a858328a7e113abf",
    );
    expect(part.provenance).toMatchObject({
      sourceId: "lego-studio:measured-part-admission",
      sourceVersion: "set-6651557/1",
      runtimeRole: "catalog-truth",
    });
  });

  it("pins the exact official seven-file closure, root attribution, and manifest", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["2877"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "2877")!;

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint.ldrawSource).toEqual({
      title: "Brick  1 x  2 with Grille",
      author: "James Jessiman",
      ldrawOrg: "Part UPDATE 2003-03",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:46c3a0dc6329d3f0be9b3b4485b5e2e41295bad750a0f4c4b6a2e6631c0c0029",
      closureFileCount: 7,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["2877"]).toEqual({
      bytes: 12_845,
      manifestSha256: "sha256:61128d15f095eaa9353037ebae2d3e8413835db9c01870b979221dd5bc55afd2",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(45);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(237);
  });

  it("binds the revision-E Builder record, reviewed bytes, and exact frame", () => {
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "2877")!;
    const builderNativeSource = readFileSync(
      new URL("../../../scripts/builder_native_source.py", import.meta.url),
      "utf8",
    );
    const reviewDigestRows = /NATIVE_REVIEW_RECORD_SHA256 = \{([\s\S]*?)\r?\n\}/u.exec(
      builderNativeSource,
    )?.[1];

    expect(SET_6651557_NATIVE_RECORD_DIGESTS.find(({ designId }) => designId === "2877")).toEqual({
      designId: "2877",
      recordSha256: "sha256:10259d71b0993d4131d2267fcd9247a20f8593bb542a1d1eee36ad4041f029b8",
    });
    expect("builderSource" in blueprint ? blueprint.builderSource : null).toEqual({
      revision: "E",
      recordSha256: "sha256:10259d71b0993d4131d2267fcd9247a20f8593bb542a1d1eee36ad4041f029b8",
      frameSha256: "sha256:234d34ebbabe20f9d2a4b351b31ed2922356b63c7a0bd01203b2bb22ccbff78d",
    });
    expect(reviewDigestRows).toContain(
      '"2877": "6fc98f0a013a96db3c66dac27c9b34e4d79c88f8379b32f6c1116f346265d490"',
    );
    expect("ldcadShadowSource" in blueprint).toBe(false);
    expect("builderConnectivitySource" in blueprint).toBe(false);
  });

  it("keeps two source studs and only the two Builder-authored underside clutches", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "2877")!;

    expect(blueprint.studsLdu).toEqual(STUD_Z_LDU.map((z) => [0, -12, z, 6.0001514980873605, 4]));
    expect(blueprint.clutchesLdu).toEqual(CLUTCH_Z_LDU.map((z) => [0, 12, z]));
    expect(
      part.connectors.map(
        ({ id, kind, gender, positionLdu, normal, orientationId, capacity, compatibleKinds }) => ({
          id,
          kind,
          gender,
          positionLdu,
          normal,
          orientationId,
          capacity,
          compatibleKinds,
        }),
      ),
    ).toEqual([
      ...STUD_Z_LDU.map((z, index) => ({
        id: `stud:${index}`,
        kind: "stud",
        gender: "male",
        positionLdu: [0, -12, z],
        normal: [0, -1, 0],
        orientationId: "connector-up",
        capacity: 1,
        compatibleKinds: ["undersideClutch"],
      })),
      ...CLUTCH_Z_LDU.map((z, index) => ({
        id: `undersideClutch:${index}`,
        kind: "undersideClutch",
        gender: "female",
        positionLdu: [0, 12, z],
        normal: [0, 1, 0],
        orientationId: "connector-down",
        capacity: 1,
        compatibleKinds: ["stud"],
      })),
    ]);
  });

  it("binds the 264-triangle mesh and all 28 positive-volume collision bodies", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:2877.dat"]!;
    if (asset.indices === undefined) throw new Error("2877 mesh is unexpectedly unindexed");
    const boxes = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
        primitive.kind === "box",
    );
    const cylinders = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
        primitive.kind === "cylinder",
    );

    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 168 },
      { role: "stud", triangleStart: 168, triangleCount: 96 },
    ]);
    expect(asset.indices.length / 3).toBe(264);
    expect(asset.positionsLdu.length / 3).toBe(375);
    expect(part.collision.primitives).toHaveLength(28);
    expect(boxes).toHaveLength(26);
    expect(
      createHash("sha256")
        .update(JSON.stringify(boxes.map(({ minLdu, maxLdu }) => [...minLdu, ...maxLdu])))
        .digest("hex"),
    ).toBe("b2e20bf2963016137b2d2d56e8051f69619210dc27508b9a79c580e0c0efad30");
    expect(cylinders).toEqual(
      STUD_Z_LDU.map((z, index) => ({
        id: `stud:${index}`,
        kind: "cylinder",
        tag: "stud",
        axis: "y",
        centerLdu: [0, -14, z],
        radiusLdu: 6.0001514980873605,
        heightLdu: 4,
      })),
    );
    for (const box of boxes) {
      expect(box.minLdu.every((value, axis) => value < box.maxLdu[axis]!)).toBe(true);
    }
    expect(part.collision.allowances).toEqual(
      CLUTCH_Z_LDU.map((z, index) => ({
        id: `tubeSeat:${index}`,
        portId: `undersideClutch:${index}`,
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [0, 10, z],
        radiusLdu: 6,
        maxInsertionDepthLdu: 4,
        requiresValidatedConnection: true,
      })),
    );
    expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });
  });

  it("pins the reviewed /29 projection of the /19 prefix under its historical truth label", () => {
    const priorParts = PART_DEFINITIONS.slice(0, 91);
    const priorDefinitionBytes = JSON.stringify(priorParts).replaceAll(
      "builtin.basic-parts/29",
      "builtin.basic-parts/19",
    );
    const connectorCollision = priorParts.map(({ id, connectors, collision }) => ({
      id,
      connectors,
      collision,
    }));
    const collision = priorParts.map(({ id, collision: value }) => ({ id, collision: value }));

    expect(priorParts).toHaveLength(91);
    expect({
      definitionBytes: priorDefinitionBytes.length,
      definitionHash: createHash("sha256").update(priorDefinitionBytes).digest("hex"),
      connectorCollisionHash: createHash("sha256")
        .update(JSON.stringify(connectorCollision))
        .digest("hex"),
      collisionHash: createHash("sha256").update(JSON.stringify(collision)).digest("hex"),
    }).toEqual({
      definitionBytes: 1_545_383,
      definitionHash: "82f2cac948bbd979517dc9eb4e26702d1ddd937c2f8cc8d12a52b46481c197d1",
      connectorCollisionHash: "10561ca1317d1b908880ec0f93699a22a2e76539d13c38edd26a12c66fc2a5d1",
      collisionHash: "5f1536f9135152cb4db37c2306f9d03ce703815ea86390e9bc7e6da8454acc18",
    });
  });
});
