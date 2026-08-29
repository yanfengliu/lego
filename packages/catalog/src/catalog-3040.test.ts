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

const PART_ID = "builtin:slope-1x2-45";
const STUD_POSITION_LDU = [0, -12, 10] as const;
const CLUTCH_Z_LDU = [-10, 10] as const;

const EXPECTED_CLOSURE = [
  [
    "p/1-4cyls.dat",
    1_107,
    "sha256:aaee6ffe6e4a191d6cad4496677132eb0349303d6e48c13c7a2240dcea1db621",
  ],
  [
    "p/2-4cyli.dat",
    1_543,
    "sha256:d486780f0f84893899d9eadcd13150f13a42e15e77a3cda38cdf24ded98862c6",
  ],
  ["p/2-4edge.dat", 683, "sha256:665400f76566b161c28303cdadce40d17d979a8ff9a8a133675af2d17fbe6763"],
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
  ["p/stud.dat", 698, "sha256:db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4"],
  ["p/stud3a.dat", 603, "sha256:91b1f54ed55b2f57dd73225da3198b5198e31f7587a5e8b7d3351b1478c8881c"],
  [
    "parts/3040.dat",
    462,
    "sha256:12c4aaf0642dc49397b2f269a64c9298f1650fce51a97d463f910f81a9d8068e",
  ],
  [
    "parts/3040b.dat",
    636,
    "sha256:47a73c42c206e34c11f6d54a48ee186e53a5a941d56923b5221bd244f7926fed",
  ],
  [
    "parts/s/3040s01.dat",
    2_410,
    "sha256:e350abf28f7b7e91b9dfbc7f6780974f0841960a0c8d50b7abf5a9e8c9550bf5",
  ],
] as const;

interface SourceAuditFile {
  readonly fileId: string;
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly title: string;
  readonly directReferences: readonly string[];
}

const readSourceAuditFiles = (): readonly SourceAuditFile[] => {
  const payload = JSON.parse(
    readFileSync(
      new URL("./quarantine/set-6651557-ldraw-source-audit.generated.json", import.meta.url),
      "utf8",
    ),
  ) as { readonly files: readonly SourceAuditFile[] };
  return payload.files;
};

describe("3040 straight-slope catalog truth", () => {
  it("appends the exact /21 identity and pins its source-to-catalog frame", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "3040")!;

    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/29");
    expect(PART_DEFINITIONS).toHaveLength(106);
    expect(PART_DEFINITIONS.at(-14)?.id).toBe(PART_ID);
    expect(part).toMatchObject({
      id: PART_ID,
      family: "slope",
      displayName: "Slope 45 1 x 2",
      dimensions: { widthStuds: 1, lengthStuds: 2, heightLdu: 24 },
      bodyBoundsLdu: { min: [-10, -12, -20], max: [10, 12, 20] },
      boundsLdu: { min: [-10, -16, -20], max: [10, 12, 20] },
      substitutionGroupId: "slope:1x2-45",
    });
    expect(resolvePartId("3040.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:3040.dat")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-0",
      translationLdu: [0, -12, 10],
    });
    expect(part.geometry.contentHash).toBe(
      "sha256:a13e57548def8bd0a43aadf1ca4fa4947fd3a5218d2fb0fa70fc9fc0db9bb4b5",
    );
    expect(part.provenance).toMatchObject({
      sourceId: "lego-studio:measured-part-admission",
      sourceVersion: "set-6651557/1",
      runtimeRole: "catalog-truth",
    });
  });

  it("pins the exact moved-alias root, 11-file official closure, and manifest", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["3040"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "3040")!;
    const files = readSourceAuditFiles();

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint.ldrawSource).toEqual({
      title: "~Moved to 3040b",
      author: "[PTadmin]",
      ldrawOrg: "Part UPDATE 2004-04",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:12c4aaf0642dc49397b2f269a64c9298f1650fce51a97d463f910f81a9d8068e",
      closureFileCount: 11,
    });
    expect(files.find(({ fileId }) => fileId === "official:parts/3040.dat")).toMatchObject({
      path: "parts/3040.dat",
      bytes: 462,
      sha256: "sha256:12c4aaf0642dc49397b2f269a64c9298f1650fce51a97d463f910f81a9d8068e",
      title: "~Moved to 3040b",
      directReferences: ["official:parts/3040b.dat"],
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["3040"]).toEqual({
      bytes: 13_050,
      manifestSha256: "sha256:2770e66191388e6ffc5b85c85782f9dabe63d3e90d36ea60ef876da33a44329a",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(45);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(237);
  });

  it("binds stud3a's exact source identity to the diagnostic clutch-tube role", () => {
    const files = readSourceAuditFiles();
    const candidateSource = readFileSync(
      new URL("../../../scripts/part_admission_ldraw_candidate.py", import.meta.url),
      "utf8",
    );

    expect(files.find(({ fileId }) => fileId === "official:p/stud3a.dat")).toMatchObject({
      path: "p/stud3a.dat",
      bytes: 603,
      sha256: "sha256:91b1f54ed55b2f57dd73225da3198b5198e31f7587a5e8b7d3351b1478c8881c",
      title: "Stud Tube Solid without Base Edges",
      directReferences: [
        "official:p/4-4cyli.dat",
        "official:p/4-4disc.dat",
        "official:p/4-4edge.dat",
      ],
    });
    expect(candidateSource).toMatch(
      /\("official", "p\/stud3a\.dat"\): \(\s*"sha256:91b1f54ed55b2f57dd73225da3198b5198e31f7587a5e8b7d3351b1478c8881c",\s*CLUTCH_ROLE,\s*\),/u,
    );
  });

  it("binds the revision-F Builder record, reviewed bytes, and exact turn-zero frame", () => {
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "3040")!;
    const builderNativeSource = readFileSync(
      new URL("../../../scripts/builder_native_source.py", import.meta.url),
      "utf8",
    );
    const builderFramePins = readFileSync(
      new URL("../../../scripts/builder_ldraw_frame_pins.py", import.meta.url),
      "utf8",
    );
    const reviewDigestRows = /NATIVE_REVIEW_RECORD_SHA256 = \{([\s\S]*?)\r?\n\}/u.exec(
      builderNativeSource,
    )?.[1];

    expect(SET_6651557_NATIVE_RECORD_DIGESTS.find(({ designId }) => designId === "3040")).toEqual({
      designId: "3040",
      recordSha256: "sha256:63ab72a4ff3b2d85b58af6586a1592124ab42019a84cb5faef137ee699836b28",
    });
    expect("builderSource" in blueprint ? blueprint.builderSource : null).toEqual({
      revision: "F",
      recordSha256: "sha256:63ab72a4ff3b2d85b58af6586a1592124ab42019a84cb5faef137ee699836b28",
      frameSha256: "sha256:65d6be01240cad2790e9fb54fabb056b99c232c26736b33b7340f8a85511a4bf",
    });
    expect(reviewDigestRows).toContain(
      '"3040": "17afd7907052b6e3e78343a6d26af45c81b7d277d80128b35e9f02c483905075"',
    );
    expect(builderFramePins).toMatch(
      /"3040",\s*"F",\s*"63ab72a4ff3b2d85b58af6586a1592124ab42019a84cb5faef137ee699836b28",\s*"turn0",\s*\(0, 24, 0\),\s*EXACT,\s*"65d6be01240cad2790e9fb54fabb056b99c232c26736b33b7340f8a85511a4bf"/u,
    );
    expect("ldcadShadowSource" in blueprint).toBe(false);
    expect("builderConnectivitySource" in blueprint).toBe(false);
  });

  it("keeps one source stud and only the two Builder-authored underside clutches", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "3040")!;

    expect(blueprint.studsLdu).toEqual([[...STUD_POSITION_LDU, 6.0001514980873605, 4]]);
    expect(
      "validatedConnectionStudProfile" in blueprint
        ? blueprint.validatedConnectionStudProfile
        : undefined,
    ).toBe("nominal-stud-tube/1");
    expect(blueprint.clutchesLdu).toEqual(CLUTCH_Z_LDU.map((z) => [0, 12, z]));
    expect(
      part.connectors.map(
        ({
          id,
          kind,
          geometryRole,
          profileId,
          gender,
          positionLdu,
          normal,
          orientationId,
          capacity,
          compatibleKinds,
        }) => ({
          id,
          kind,
          geometryRole,
          profileId,
          gender,
          positionLdu,
          normal,
          orientationId,
          capacity,
          compatibleKinds,
        }),
      ),
    ).toEqual([
      {
        id: "stud:0",
        kind: "stud",
        geometryRole: "stud",
        profileId: "stud-tube/1",
        gender: "male",
        positionLdu: STUD_POSITION_LDU,
        normal: [0, -1, 0],
        orientationId: "connector-up",
        capacity: 1,
        compatibleKinds: ["undersideClutch"],
      },
      ...CLUTCH_Z_LDU.map((z, index) => ({
        id: `undersideClutch:${index}`,
        kind: "undersideClutch" as const,
        geometryRole: "tubeSeat" as const,
        profileId: "stud-tube/1" as const,
        gender: "female" as const,
        positionLdu: [0, 12, z],
        normal: [0, 1, 0],
        orientationId: "connector-down",
        capacity: 1,
        compatibleKinds: ["stud"],
      })),
    ]);
  });

  it("binds the 178-triangle mesh and all 68 positive-volume collision bodies", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:3040.dat"]!;
    if (asset.indices === undefined) throw new Error("3040 mesh is unexpectedly unindexed");
    const boxes = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
        primitive.kind === "box",
    );
    const cylinders = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
        primitive.kind === "cylinder",
    );

    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 130 },
      { role: "stud", triangleStart: 130, triangleCount: 48 },
    ]);
    expect(asset.indices.length / 3).toBe(178);
    expect(asset.positionsLdu.length / 3).toBe(184);
    expect(part.collision.primitives).toHaveLength(68);
    expect(boxes).toHaveLength(67);
    expect(
      createHash("sha256")
        .update(JSON.stringify(boxes.map(({ minLdu, maxLdu }) => [...minLdu, ...maxLdu])))
        .digest("hex"),
    ).toBe("fec563a3cc1bc6a1ee19cf1c3f409fbaa2b064acd0a354e3f61a4da2261857b8");
    expect(cylinders).toEqual([
      {
        id: "stud:0",
        kind: "cylinder",
        tag: "stud",
        axis: "y",
        centerLdu: [0, -14, 10],
        radiusLdu: 6.0001514980873605,
        validatedConnectionProfileRadiusLdu: 6,
        heightLdu: 4,
      },
    ]);
    expect(part.collision.validatedConnectionStudProfile).toBe("nominal-stud-tube/1");
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

  it("pins the reviewed /29 projection of the /20 prefix under its historical truth label", () => {
    const priorParts = PART_DEFINITIONS.slice(0, 92);
    const priorDefinitionBytes = JSON.stringify(priorParts).replaceAll(
      "builtin.basic-parts/29",
      "builtin.basic-parts/20",
    );
    const connectorCollision = priorParts.map(({ id, connectors, collision }) => ({
      id,
      connectors,
      collision,
    }));
    const collision = priorParts.map(({ id, collision: value }) => ({ id, collision: value }));

    expect(priorParts).toHaveLength(92);
    expect({
      definitionBytes: priorDefinitionBytes.length,
      definitionHash: createHash("sha256").update(priorDefinitionBytes).digest("hex"),
      connectorCollisionHash: createHash("sha256")
        .update(JSON.stringify(connectorCollision))
        .digest("hex"),
      collisionHash: createHash("sha256").update(JSON.stringify(collision)).digest("hex"),
    }).toEqual({
      definitionBytes: 1_553_902,
      definitionHash: "57db94777b7a49b702e352cc9a1e8390e01ca326e573f5783147d3292e388040",
      connectorCollisionHash: "8a3f5113311b3148e83e6950519bf8e35adb4de6f097f0162b79193974467936",
      collisionHash: "0849c367e12e089e5696639be807c04cb6daab992263512a67921c6dd20e2ba0",
    });
  });
});
