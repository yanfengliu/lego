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

const PART_ID = "builtin:axle-1x3";

const EXPECTED_CLOSURE = [
  [
    "p/axleend2.dat",
    8_085,
    "sha256:cedcec0918b69285f612c94d1f6532f7352a08f18b2749dde6f6a5235c1a0c73",
  ],
  [
    "p/axlehol8.dat",
    1_706,
    "sha256:e3cf8856c972ecaf486a344c171cb4ab601efcb08956bd7b6cfafa39b0439493",
  ],
  ["p/box2-9p.dat", 539, "sha256:6c68301a34e42d105e716e5ae5edf02e3d58978db24619f0364887c339edd331"],
  [
    "parts/4519.dat",
    653,
    "sha256:ecec609013e9d7af63c352cb61d990077c005c4c5453e121b3d192914ab55ff0",
  ],
] as const;

describe("4519 three-module axle catalog truth", () => {
  it("appends the exact /22 identity and keeps it searchable by source identity", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "4519")!;

    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/28");
    expect(PART_DEFINITIONS).toHaveLength(104);
    expect(PART_DEFINITIONS.at(-11)?.id).toBe(PART_ID);
    expect(part).toMatchObject({
      id: PART_ID,
      family: "axle",
      displayName: "Technic Axle 3",
      dimensions: { widthStuds: 1, lengthStuds: 3, heightLdu: 12 },
      bodyBoundsLdu: { min: [-29.5, -6, -6], max: [29.5, 6, 6] },
      boundsLdu: { min: [-29.5, -6, -6], max: [29.5, 6, 6] },
      substitutionGroupId: "axle:1x3",
    });
    expect(resolvePartId("4519.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:4519.dat")).toBe(PART_ID);
    expect(resolvePartId("Technic Axle 3")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-0",
      translationLdu: [0, 0, 0],
    });
  });

  it("pins the exact four-file official closure and its attribution", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["4519"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "4519")!;

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint.ldrawSource).toEqual({
      title: "Technic Axle  3",
      author: "James Jessiman",
      ldrawOrg: "Part UPDATE 2025-09",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:ecec609013e9d7af63c352cb61d990077c005c4c5453e121b3d192914ab55ff0",
      closureFileCount: 4,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["4519"]).toEqual({
      bytes: 10_983,
      manifestSha256: "sha256:6349bb679ab7388ed086d151d855cf4b002bcd99a79c8814a5bfba0a097b9e12",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(43);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(228);
  });

  it("uses only the exact LDCad 4519 route for three discrete axle ports", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "4519")!;
    if (!("ldcadShadowSource" in blueprint)) throw new Error("4519 has no pinned LDCad route");
    if (!("sourceConnectorsLdu" in blueprint)) {
      throw new Error("4519 has no emitted source connector rows");
    }

    expect("builderSource" in blueprint).toBe(false);
    expect("builderConnectivitySource" in blueprint).toBe(false);
    expect(blueprint.ldcadShadowSource).toEqual({
      libraryId: "ldcad-shadow-library",
      commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
      manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      compositionId: "ldcad-shadow-composed-over-ldraw-tree/1",
      shadowFiles: ["parts/4519.dat"],
    });
    expect(blueprint.sourceConnectorsLdu).toEqual([
      { kind: "axle", positionLdu: [-20, 0, 0], normal: [-1, 0, 0] },
      { kind: "axle", positionLdu: [0, 0, 0], normal: [1, 0, 0] },
      { kind: "axle", positionLdu: [20, 0, 0], normal: [1, 0, 0] },
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
    ).toEqual(
      [-20, 0, 20].map((x, index) => ({
        id: `axle:${index}`,
        kind: "axle",
        geometryRole: "axleShaft",
        profileId: "axle-cross/1",
        gender: "male",
        positionLdu: [x, 0, 0],
        normal: index === 0 ? [-1, 0, 0] : [1, 0, 0],
        orientationId: "connector-up",
        capacity: 1,
        compatibleKinds: ["axleHole", "pinHole"],
      })),
    );
  });

  it("binds the 176-triangle shaft and all 41 positive-volume collision boxes", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:4519.dat"]!;
    if (asset.indices === undefined) throw new Error("4519 mesh is unexpectedly unindexed");
    const boxes = part.collision.primitives.filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
        primitive.kind === "box",
    );

    expect(asset.groups).toEqual([{ role: "body", triangleStart: 0, triangleCount: 176 }]);
    expect(asset.indices.length / 3).toBe(176);
    expect(boxes).toHaveLength(41);
    expect(part.collision.primitives).toEqual(boxes);
    expect(part.collision.allowances).toEqual([]);
    for (const box of boxes) {
      expect(box.minLdu.every((value, axis) => value < box.maxLdu[axis]!)).toBe(true);
    }
    expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });
  });
});
