import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
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

const PART_ID = "builtin:arch-1x6-thin-top";
const STUD_Z_LDU = [-50, -30, -10, 10, 30, 50] as const;
const CLUTCH_Z_LDU = [-50, 50] as const;

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
    "p/48/1-4edge.dat",
    1_196,
    "sha256:e4ebabd21711f16411b3c8b8b278995a56c5f25919cd424976357da5b19943c6",
  ],
  [
    "p/48/2-4cyli.dat",
    3_676,
    "sha256:685652b02ba31d357cb53ab845f0256a3d1580f530d28e57e9a34fe00e82111b",
  ],
  [
    "p/48/2-4cylo.dat",
    405,
    "sha256:8664bb8070cc7b44b3f60c6dde9c3a96b2ef5f20e6585d340d543441d356e50c",
  ],
  [
    "p/48/2-4edge.dat",
    619,
    "sha256:e059b74394567300989a6189e8db33f885334455c20137f27b4739bf424042f5",
  ],
  [
    "p/48/2-4ndis.dat",
    1_468,
    "sha256:cf41e8d57710415bc170b8b20817ee213d2f74d18e0077d2e928915539e5ad43",
  ],
  ["p/box3u2p.dat", 818, "sha256:df73118b95f23d693c3b7d25c57c483db3bf61ae017d757848119955d28d59e0"],
  ["p/box3u4a.dat", 545, "sha256:15463f41f9947dd75486dc7af3231b1037704f1b654c2555e3ba705817a2db75"],
  ["p/box5.dat", 963, "sha256:ccb7b8a1d36692335b10ea6aa196849afcad4b15331683ed8112a10b50977318"],
  ["p/recte3.dat", 319, "sha256:e7f5ccbb040191aaa4cd469a25b086299cba4a3eaa8d3b0fbf71240e3de0359a"],
  ["p/stud.dat", 698, "sha256:db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4"],
  [
    "p/stug-1x6.dat",
    495,
    "sha256:907b74bad03688f6d2f22220db6ec4a6c922203a3e3001aa24f214c6ed48a226",
  ],
  [
    "parts/15254.dat",
    1_951,
    "sha256:d0a46511d5348dcab1d16852e930fb2f7ea96ed461aed46cf0343b0a2feae883",
  ],
] as const;

describe("15254 thin-top arch catalog truth", () => {
  it("retains the exact /18 admission position and pins its upright catalog frame", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "15254")!;

    expect(PART_DEFINITIONS[89]?.id).toBe(PART_ID);
    expect(part).toMatchObject({
      id: PART_ID,
      family: "arch",
      displayName: "Arch 1 x 6 x 2 Thin Top",
      dimensions: { widthStuds: 1, lengthStuds: 6, heightLdu: 48 },
      bodyBoundsLdu: { min: [-10, -24, -60], max: [10, 24, 60] },
      boundsLdu: { min: [-10, -28, -60], max: [10, 24, 60] },
      substitutionGroupId: "arch:1x6-thin-top",
    });
    expect(resolvePartId("15254.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:15254.dat")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-90",
      translationLdu: [0, -24, 0],
    });
    expect(part.geometry.contentHash).toBe(
      "sha256:0bcb944b46fba5832617bfcc3c45bda0a19dbf1a44ee2f565e40be241ff9d8f1",
    );
    expect(part.provenance).toMatchObject({
      sourceId: "lego-studio:measured-part-admission",
      sourceVersion: "set-6651557/1",
      runtimeRole: "catalog-truth",
    });
  });

  it("pins the exact official 15-file closure, root attribution, and manifest", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["15254"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "15254")!;

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint.ldrawSource).toEqual({
      title: "Arch  1 x  6 x  2 with Thin Top",
      author: "Michael Heidemann [mikeheide]",
      ldrawOrg: "Part UPDATE 2025-09",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:d0a46511d5348dcab1d16852e930fb2f7ea96ed461aed46cf0343b0a2feae883",
      closureFileCount: 15,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["15254"]).toEqual({
      bytes: 18_061,
      manifestSha256: "sha256:45ddc1adf831202895cbfb51c38f7b443fd7702514ac13c429369188e9452e20",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(30);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(190);
  });

  it("binds the revision-J Builder record, reviewed bytes, and exact frame", () => {
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "15254")!;
    const builderNativeSource = readFileSync(
      new URL("../../../scripts/builder_native_source.py", import.meta.url),
      "utf8",
    );
    const reviewDigestRows = /NATIVE_REVIEW_RECORD_SHA256 = \{([\s\S]*?)\r?\n\}/u.exec(
      builderNativeSource,
    )?.[1];

    expect(SET_6651557_NATIVE_RECORD_DIGESTS.find(({ designId }) => designId === "15254")).toEqual({
      designId: "15254",
      recordSha256: "sha256:0ae335fc6d5ee2adf9e2aadf4dc71bce8db432d9ce1dc5283fbe1da7456ff6f2",
    });
    expect("builderSource" in blueprint ? blueprint.builderSource : null).toEqual({
      revision: "J",
      recordSha256: "sha256:0ae335fc6d5ee2adf9e2aadf4dc71bce8db432d9ce1dc5283fbe1da7456ff6f2",
      frameSha256: "sha256:3fab6aeb6e5bcbab80d312937e62d53d86e671816b6f8e1c3eaecc89afc728c5",
    });
    expect(reviewDigestRows).toContain(
      '"15254": "64570313b8688b360eb007a929c6222fbca1c85d274218ed69d0e9f4727803b9"',
    );
    expect("ldcadShadowSource" in blueprint).toBe(false);
    expect("builderConnectivitySource" in blueprint).toBe(false);
  });

  it("keeps six top studs and only the two Builder-authored end clutches", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "15254")!;

    expect(blueprint.studsLdu).toEqual(STUD_Z_LDU.map((z) => [0, -24, z, 6.0001514980873605, 4]));
    expect(blueprint.clutchesLdu).toEqual(CLUTCH_Z_LDU.map((z) => [0, 24, z]));
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
        positionLdu: [0, -24, z],
        normal: [0, -1, 0],
        orientationId: "connector-up",
        capacity: 1,
        compatibleKinds: ["undersideClutch"],
      })),
      ...CLUTCH_Z_LDU.map((z, index) => ({
        id: `undersideClutch:${index}`,
        kind: "undersideClutch",
        gender: "female",
        positionLdu: [0, 24, z],
        normal: [0, 1, 0],
        orientationId: "connector-down",
        capacity: 1,
        compatibleKinds: ["stud"],
      })),
    ]);
  });

  it("binds the 548-triangle mesh and all 173 positive-volume collision bodies", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:15254.dat"]!;
    if (asset.indices === undefined) throw new Error("15254 mesh is unexpectedly unindexed");
    const boxes = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
        primitive.kind === "box",
    );
    const cylinders = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
        primitive.kind === "cylinder",
    );

    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 260 },
      { role: "stud", triangleStart: 260, triangleCount: 288 },
    ]);
    expect(asset.indices.length / 3).toBe(548);
    expect(asset.positionsLdu.length / 3).toBe(594);
    expect(part.collision.primitives).toHaveLength(173);
    expect(boxes).toHaveLength(167);
    expect(cylinders).toEqual(
      STUD_Z_LDU.map((z, index) => ({
        id: `stud:${index}`,
        kind: "cylinder",
        tag: "stud",
        axis: "y",
        centerLdu: [0, -26, z],
        radiusLdu: 6.0001514980873605,
        heightLdu: 4,
      })),
    );
    for (const box of boxes) {
      expect(box.minLdu.every((value, axis) => value < box.maxLdu[axis]!)).toBe(true);
    }
    for (const cylinder of cylinders) {
      expect(cylinder.radiusLdu).toBeGreaterThan(0);
      expect(cylinder.heightLdu).toBeGreaterThan(0);
    }
    expect(part.collision.allowances).toEqual(
      CLUTCH_Z_LDU.map((z, index) => ({
        id: `tubeSeat:${index}`,
        portId: `undersideClutch:${index}`,
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [0, 22, z],
        radiusLdu: 6,
        maxInsertionDepthLdu: 4,
        requiresValidatedConnection: true,
      })),
    );
    expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });
  });

  it("keeps every /17 part payload byte unchanged after restoring its historical truth label", () => {
    const priorParts = PART_DEFINITIONS.slice(0, 89);
    const priorDefinitionBytes = JSON.stringify(priorParts).replaceAll(
      "builtin.basic-parts/19",
      "builtin.basic-parts/17",
    );
    const rows = priorParts.map(({ id, connectors, collision }) => ({ id, connectors, collision }));
    const collisionRows = priorParts.map(({ id, collision }) => ({ id, collision }));

    expect(priorParts).toHaveLength(89);
    expect({
      definitionBytes: priorDefinitionBytes.length,
      definitionHash: createHash("sha256").update(priorDefinitionBytes).digest("hex"),
      connectorCollisionHash: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
      collisionHash: createHash("sha256").update(JSON.stringify(collisionRows)).digest("hex"),
    }).toEqual({
      definitionBytes: 1_508_153,
      definitionHash: "867afbdf9ad7e1e4fb446a5916a6060800e740509b0750ab3b47f61b0107ceaa",
      connectorCollisionHash: "47d480e5a23a6da1b4db88ff9faf760e30e04ab3ee3624aa0cc5db68de6fe7e5",
      collisionHash: "93066f53efe25aefd104d43f648925e4c27df30705a633ec2b3e27d76c181a82",
    });
  });
});
