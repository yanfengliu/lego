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
import { SET_6651557_MEASURED_BLUEPRINTS_G } from "./part-blueprints-6651557-measured-g.ts";

const PART_ID = "builtin:technic-brick-1x2-axle-hole";
const STUD_Z_LDU = [-10, 10] as const;
const CLUTCH_Z_LDU = [-10, 10] as const;

const EXPECTED_CLOSURE = [
  [
    "p/1-16chrd.dat",
    701,
    "sha256:e429dd760eb6f0cf460a74e6ebf52c023bedbdea82de7801efa1694b5a1a82e8",
  ],
  ["p/1-8chrd.dat", 561, "sha256:7694157b725563188a6efd69b3f558b00533b375b8a4e82f469497a03e471e74"],
  ["p/1-8cyli.dat", 806, "sha256:46def63dc8293ad9a2dd1d1a5cb720b9ba883850e65d3280d2093c664a6140c4"],
  ["p/1-8cylo.dat", 381, "sha256:870bbbf6052e075598de7dce7efe7a139ea5189820e7a296442fe2b3318c18bf"],
  ["p/1-8edge.dat", 480, "sha256:50436a0bce461198c342dccbccb658a1bffae13e44b7c48689b158c946c2c2ab"],
  [
    "p/3-16ndis.dat",
    557,
    "sha256:abb7da370e72fe9e75faf5d10c637b476202dbd8ced9cb5b0f96433e1f72f529",
  ],
  [
    "p/4-4cyli.dat",
    2_687,
    "sha256:4a742c2765b6ebf98245baaf8a160a4ff587fc93d36c8ee2b9074712a2f968c4",
  ],
  [
    "p/4-4edge.dat",
    1_084,
    "sha256:54a52196e421fd1717d291ff52ea57553b1fb238907c1678cc1f1a84c698b1da",
  ],
  [
    "p/4-4ring2.dat",
    1_628,
    "sha256:6fb38804b1f5e9bee8c0b80caf1397b09454fc58b048dc19045b6f37c8762ab0",
  ],
  [
    "p/axl5ho10.dat",
    1_173,
    "sha256:5658b3df4183184a5d5104624ff85b3048a658972991b1dfc489dc05728278ba",
  ],
  [
    "p/axl5hol9.dat",
    677,
    "sha256:d46a457be819e6b46b7fc85f8610b8850e0d0a40556c65b74dbda04179b68a20",
  ],
  [
    "p/axlehol5.dat",
    3_125,
    "sha256:5977860888c76d8170d9ec33c93f6c431133bfdc79435e7eac9c32bb15c0a83d",
  ],
  ["p/box2-7.dat", 577, "sha256:e0474c5ad7fb9ff77b67883a5b1e327d028e3eb4e59921a626b4215632dd9f00"],
  ["p/box3u2p.dat", 818, "sha256:df73118b95f23d693c3b7d25c57c483db3bf61ae017d757848119955d28d59e0"],
  ["p/empty.dat", 825, "sha256:192c9b9ee2e425cfbc9e9b12ff61ee0f05ae1cb0c12dc37d5590adb6abb65128"],
  ["p/rect.dat", 654, "sha256:ffeb2dd3d9b83c38841f18f1f74800fbba9e90c5fb6badfff2a795f08a96cb71"],
  ["p/rect2p.dat", 594, "sha256:faac2b36241a9de0c0108471e59c45734df6c79813332d9cacf97f6391886acc"],
  ["p/rect3.dat", 605, "sha256:07ac46908b6668d993b6de0fb001a34cd996542106b80ebc7de63317d8dde865"],
  ["p/stud2.dat", 930, "sha256:5ed3702c7d7000bfac2906f12b74ae312c59194a8e3b504952820c826b51c810"],
  [
    "p/stug2-1x2.dat",
    341,
    "sha256:9cd034fe99c6efd6e158c73a8a95d7b0e6ff4f1671a7ee22e2323c74a43b7f1e",
  ],
  [
    "parts/32064.dat",
    322,
    "sha256:b6240d5798083701834cec8f566d7fca05cbc51123fad8500d3125fa68b4c465",
  ],
  [
    "parts/32064a.dat",
    6_122,
    "sha256:b35a848b805493527b83b3a087d0a7f139084834c1f3325045905aa09ded26d2",
  ],
  [
    "parts/s/32064s01.dat",
    1_455,
    "sha256:e89d5e33547325f5a84aa9b0c374f3cd997eae841057dc2697e76f5dc1cfd502",
  ],
] as const;

interface SourceAuditFile {
  readonly fileId: string;
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly title: string;
  readonly declaredName: string;
  readonly author: string;
  readonly ldrawOrg: string;
  readonly licenseExpression: string;
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

describe("32064 Technic brick with axle-hole catalog truth", () => {
  it("retains the exact /23 identity and G source-to-catalog frame under /24", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS_G.find(
      ({ designId }) => designId === "32064",
    );
    if (blueprint === undefined) throw new Error("32064 blueprint is missing");

    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/24");
    expect(PART_DEFINITIONS).toHaveLength(96);
    expect(PART_DEFINITIONS.at(-2)?.id).toBe(PART_ID);
    expect(SET_6651557_MEASURED_BLUEPRINTS.at(-2)).toBe(blueprint);
    expect(SET_6651557_MEASURED_BLUEPRINTS_G).toHaveLength(2);
    expect(part).toMatchObject({
      id: PART_ID,
      family: "technic-brick",
      displayName: "Technic Brick 1 x 2 with Axle Hole",
      dimensions: { widthStuds: 1, lengthStuds: 2, heightLdu: 24 },
      bodyBoundsLdu: { min: [-10, -12, -20], max: [10, 12, 20] },
      boundsLdu: { min: [-10, -16, -20], max: [10, 12, 20] },
      substitutionGroupId: "technic-brick:1x2",
    });
    expect(resolvePartId("32064.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:32064.dat")).toBe(PART_ID);
    expect(resolvePartId("Technic Brick 1 x 2 with Axle Hole")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-90",
      translationLdu: [0, -12, 0],
    });
  });

  it("pins the exact moved root, resolved header, official closure, and manifest", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["32064"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const [blueprint] = SET_6651557_MEASURED_BLUEPRINTS_G;
    const files = readSourceAuditFiles();

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint.ldrawSource).toEqual({
      title: "~Moved to 32064a",
      author: "[PTadmin]",
      ldrawOrg: "Part UPDATE 2009-03",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:b6240d5798083701834cec8f566d7fca05cbc51123fad8500d3125fa68b4c465",
      closureFileCount: 23,
    });
    expect(files.find(({ fileId }) => fileId === "official:parts/32064.dat")).toEqual({
      archiveId: "official",
      fileId: "official:parts/32064.dat",
      path: "parts/32064.dat",
      bytes: 322,
      sha256: "sha256:b6240d5798083701834cec8f566d7fca05cbc51123fad8500d3125fa68b4c465",
      title: "~Moved to 32064a",
      declaredName: "32064.dat",
      author: "[PTadmin]",
      ldrawOrg: "Part UPDATE 2009-03",
      licenseExpression: "CC-BY-4.0",
      directReferences: ["official:parts/32064a.dat"],
    });
    expect(files.find(({ fileId }) => fileId === "official:parts/32064a.dat")).toEqual({
      archiveId: "official",
      fileId: "official:parts/32064a.dat",
      path: "parts/32064a.dat",
      bytes: 6_122,
      sha256: "sha256:b35a848b805493527b83b3a087d0a7f139084834c1f3325045905aa09ded26d2",
      title: "Technic Brick  1 x  2 with Axlehole with Open Sides and Stud Blocker",
      declaredName: "32064a.dat",
      author: "Lutz Uhlmann [El-Lutzo]",
      ldrawOrg: "Part UPDATE 2022-02",
      licenseExpression: "CC-BY-2.0 OR CC-BY-4.0",
      directReferences: [
        "official:p/1-8cylo.dat",
        "official:p/axlehol5.dat",
        "official:p/box2-7.dat",
        "official:p/rect.dat",
        "official:p/rect2p.dat",
        "official:parts/s/32064s01.dat",
      ],
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["32064"]).toEqual({
      bytes: 27_103,
      manifestSha256: "sha256:85d190886138b76cb9a98f4d3351652d6fea64423bc576a4ef1116a99dfd686e",
    });
  });

  it("uses only the exact three-file LDCad composition for its five connector seats", () => {
    const part = getPartDefinition(PART_ID)!;
    const [blueprint] = SET_6651557_MEASURED_BLUEPRINTS_G;
    if (!blueprint) throw new Error("32064 has no G measured blueprint");

    expect("builderSource" in blueprint).toBe(false);
    expect("builderConnectivitySource" in blueprint).toBe(false);
    expect(blueprint.ldcadShadowSource).toEqual({
      libraryId: "ldcad-shadow-library",
      commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
      manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      compositionId: "ldcad-shadow-composed-over-ldraw-tree/1",
      shadowFiles: ["p/axlehol5.dat", "p/stud2.dat", "parts/32064a.dat"],
    });
    expect(blueprint.studsLdu).toEqual(STUD_Z_LDU.map((z) => [0, -12, z, 6.0001514980873605, 4]));
    expect(blueprint.clutchesLdu).toEqual(CLUTCH_Z_LDU.map((z) => [0, 12, z]));
    expect(blueprint.sourceConnectorsLdu).toEqual([
      { kind: "axleHole", positionLdu: [0, -2, 0], normal: [1, 0, 0] },
    ]);
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
      ...STUD_Z_LDU.map((z, index) => ({
        id: `stud:${index}`,
        kind: "stud" as const,
        geometryRole: "stud" as const,
        profileId: "stud-tube/1" as const,
        gender: "male" as const,
        positionLdu: [0, -12, z],
        normal: [0, -1, 0],
        orientationId: "connector-up",
        capacity: 1,
        compatibleKinds: ["undersideClutch"],
      })),
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
      {
        id: "axleHole:0",
        kind: "axleHole",
        geometryRole: "axleBore",
        profileId: "axle-cross/1",
        gender: "female",
        positionLdu: [0, -2, 0],
        normal: [1, 0, 0],
        orientationId: "connector-up",
        capacity: 1,
        compatibleKinds: ["axle"],
      },
    ]);
  });

  it("binds 458 triangles, 23 body boxes, two studs, and two clutch allowances", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:32064.dat"]!;
    if (asset.indices === undefined) throw new Error("32064 mesh is unexpectedly unindexed");
    const boxes = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
        primitive.kind === "box",
    );
    const cylinders = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
        primitive.kind === "cylinder",
    );

    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 266 },
      { role: "stud", triangleStart: 266, triangleCount: 192 },
    ]);
    expect(asset.indices.length / 3).toBe(458);
    expect(part.collision.primitives).toHaveLength(25);
    expect(boxes).toHaveLength(23);
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
    expect(part.collision.primitives).toEqual([...boxes, ...cylinders]);
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
});
