import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PART_DEFINITIONS, getPartDefinition, resolvePartId } from "./index.js";
import {
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_CLOSURE_MANIFESTS,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import { resolvePreloadedMeshAsset } from "./mesh-assets.ts";
import { meshClutchUndersides } from "./mesh-underside.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";
import { SET_6651557_NATIVE_RECORD_DIGESTS } from "./quarantine/set-6651557-native-record-digests.ts";

const PART_ID = "builtin:tile-2x2-triangular";

const EXPECTED_CLOSURE = [
  [
    "p/1-16chrd.dat",
    701,
    "sha256:e429dd760eb6f0cf460a74e6ebf52c023bedbdea82de7801efa1694b5a1a82e8",
  ],
  [
    "p/1-16cyli.dat",
    693,
    "sha256:b60f031d9dfd0995c1741992a5695ee3789419886e8189dead961d05f75f7bfc",
  ],
  [
    "p/1-16cylo.dat",
    394,
    "sha256:6cef884c4f96ec15f5bd1428264af2efba4443cb1e47ead116a8a094febefc67",
  ],
  [
    "p/1-16edge.dat",
    506,
    "sha256:42fc4d69af1281b71cb2eb9546e99e8bca2fc231d05a0379e71d4e1c9a60c95c",
  ],
  [
    "p/1-4cyli.dat",
    1044,
    "sha256:5a7168952a5a3570327873b9a5802fa7b3be40967ab78c03b6a2bfd4419a1f10",
  ],
  ["p/1-4cylo.dat", 388, "sha256:792a01362608c3f385dd7f01a1bd7d19cf9ed8a40f793266345cc86d1d98f3af"],
  ["p/1-4edge.dat", 545, "sha256:9ce2de7e67bbac575d52cfdc771b9d00856efc9b88002d97db8e665e50f4d467"],
  [
    "p/1-4ring3.dat",
    1198,
    "sha256:4048b121d53509363cfaa7422648dd29b2eeb93074279feb0bcc7a45bbb7c2e1",
  ],
  [
    "p/1-4stud4.dat",
    404,
    "sha256:cc27fe29307676a8f46d25ad35304ce2e576f3c8bee81c20cb461c401512b58e",
  ],
  [
    "p/2-4stud4t45.dat",
    1998,
    "sha256:86dcd81d51a7537612d5703db90af852daf1f2a7eabdaaccbd87ae07c5d0b941",
  ],
  [
    "p/8/2-4chrd.dat",
    343,
    "sha256:2caebc5de687f190e7ef2f25724665284bf0139e4db42844d0e2691128b9c0ea",
  ],
  [
    "p/8/2-4cyli.dat",
    763,
    "sha256:9e5869a3bf444fcda1cc9908ef96ce782b53fc68f94eaf6903a0dbca6c582215",
  ],
  [
    "p/8/2-4cylo.dat",
    394,
    "sha256:cf7a9969c8d7396d17966b65c8ea48ea36445e98580dc76d18e5aa1fc5afd54f",
  ],
  [
    "p/8/2-4edge.dat",
    406,
    "sha256:3154ed3f142d644552b2533457c13c56ef326b0f7d31ea425585d6cdde2a3129",
  ],
  ["p/box2-5.dat", 609, "sha256:8f297b754f87da1dbe19eec8704a5ce03a23b794ccd7cd015508e3758a206174"],
  ["p/box2-7.dat", 577, "sha256:e0474c5ad7fb9ff77b67883a5b1e327d028e3eb4e59921a626b4215632dd9f00"],
  ["p/empty.dat", 825, "sha256:192c9b9ee2e425cfbc9e9b12ff61ee0f05ae1cb0c12dc37d5590adb6abb65128"],
  ["p/rect.dat", 654, "sha256:ffeb2dd3d9b83c38841f18f1f74800fbba9e90c5fb6badfff2a795f08a96cb71"],
  ["p/rect2p.dat", 594, "sha256:faac2b36241a9de0c0108471e59c45734df6c79813332d9cacf97f6391886acc"],
  ["p/rect3.dat", 605, "sha256:07ac46908b6668d993b6de0fb001a34cd996542106b80ebc7de63317d8dde865"],
  [
    "parts/35787.dat",
    381,
    "sha256:15504e50d1cf297ead59fb2120663613049fddf604181c1af99479cf9a9a3602",
  ],
  [
    "parts/s/35787s01.dat",
    2162,
    "sha256:11b63d550c632afaa6b0178c233ae8d87a624bad04ce90d86d22702af1107729",
  ],
] as const;

describe("35787 triangular tile catalog truth", () => {
  it("pins the exact identity, upright frame, and occupied triangular half", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "35787")!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:35787.dat"]!;
    const positions = Array.from({ length: asset.positionsLdu.length / 3 }, (_, index) =>
      asset.positionsLdu.slice(index * 3, index * 3 + 3),
    );

    expect(part).toMatchObject({
      id: PART_ID,
      family: "tile",
      displayName: "Tile 2 x 2 Triangular",
      dimensions: { widthStuds: 2, lengthStuds: 2, heightLdu: 8 },
      bodyBoundsLdu: { min: [-20, -4, -20], max: [17, 4, 17] },
      boundsLdu: { min: [-20, -4, -20], max: [17, 4, 17] },
    });
    expect(resolvePartId("35787.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:35787.dat")).toBe(PART_ID);
    expect(blueprint.assetToCatalogFrame).toEqual({
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-0",
      translationLdu: [0, -4, 0],
    });
    // The source top face reaches three bounding corners and omits +x/+z. This
    // pins the admitted diagonal and quarter-turn without inventing chirality:
    // reflection across x=z preserves this triangle and its connector set.
    for (const corner of [
      [-20, 0, -20],
      [-20, 0, 17],
      [17, 0, -20],
    ]) {
      expect(positions).toContainEqual(corner);
    }
    expect(positions).not.toContainEqual([17, 0, 17]);

    if (asset.indices === undefined) throw new Error("35787 mesh is unexpectedly unindexed");
    const topTriangles = Array.from({ length: asset.indices.length / 3 }, (_, triangle) =>
      [0, 1, 2].map((corner) => positions[asset.indices![triangle * 3 + corner]!]!),
    ).filter((triangle) => triangle.every(([, y]) => y === 0));
    expect(topTriangles).toEqual([
      [
        [-20, 0, 17],
        [-20, 0, -20],
        [17, 0, -20],
      ],
      [
        [-17, 0, 17],
        [-20, 0, 17],
        [17, 0, -20],
      ],
      [
        [-17, 0, 17],
        [17, 0, -20],
        [17, 0, -17],
      ],
    ]);
  });

  it("pins the exact official 22-file closure and both root attributions", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["35787"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "35787")!;

    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint.ldrawSource).toEqual({
      title: "Tile  2 x  2 Triangular",
      author: "Gerald Lasser [GeraldLasser]",
      ldrawOrg: "Part UPDATE 2018-02",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:15504e50d1cf297ead59fb2120663613049fddf604181c1af99479cf9a9a3602",
      closureFileCount: 22,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["35787"]).toEqual({
      bytes: 16_184,
      manifestSha256: "sha256:64d0e836c0fc63f1a604c98f13ec5529a755589648675887c3896404b7bf7091",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(37);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(211);
  });

  it("retains the native Builder record only as counterevidence and selects one exact LDCad route", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "35787")!;
    if (!("ldcadShadowSource" in blueprint)) throw new Error("35787 has no pinned LDCad route");

    expect(SET_6651557_NATIVE_RECORD_DIGESTS.find(({ designId }) => designId === "35787")).toEqual({
      designId: "35787",
      recordSha256: "sha256:72d7a7d2db1ddb19f9c00ca968b597bdcd596dc826d106a6bca96068c597ad89",
    });
    expect("builderSource" in blueprint).toBe(false);
    expect("builderConnectivitySource" in blueprint).toBe(false);
    expect(blueprint.ldcadShadowSource).toEqual({
      libraryId: "ldcad-shadow-library",
      commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
      manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      compositionId: "ldcad-shadow-composed-over-ldraw-tree/1",
      shadowFiles: ["parts/s/35787s01.dat"],
    });
    expect(part.provenance.sourceId).toBe("lego-studio:ldcad-shadow-measured-part-admission");
  });

  it("maps the three raw shadow cells through the frame and leaves the fourth corner absent", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "35787")!;
    const rawCells = [
      [-10, 8, -10],
      [-10, 8, 10],
      [10, 8, -10],
    ] as const;
    const catalogCells = rawCells.map((cell) =>
      cell.map(
        (coordinate, axis) => coordinate + blueprint.assetToCatalogFrame.translationLdu[axis]!,
      ),
    );

    expect(blueprint.clutchesLdu).toEqual(catalogCells);
    expect(
      part.connectors.map(
        ({ kind, positionLdu, normal, orientationId, capacity, compatibleKinds }) => ({
          kind,
          positionLdu,
          normal,
          orientationId,
          capacity,
          compatibleKinds,
        }),
      ),
    ).toEqual(
      catalogCells.map((positionLdu) => ({
        kind: "undersideClutch",
        positionLdu,
        normal: [0, 1, 0],
        orientationId: "connector-down",
        capacity: 1,
        compatibleKinds: ["stud"],
      })),
    );
    expect(catalogCells).not.toContainEqual([10, 4, 10]);
  });

  it("binds each conservative-collision insertion path to one connection-gated allowance", () => {
    const part = getPartDefinition(PART_ID)!;
    const boxes = part.collision.primitives.filter((primitive) => primitive.kind === "box");
    const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch");

    expect(boxes).toHaveLength(66);
    expect(part.collision.primitives.filter(({ kind }) => kind === "cylinder")).toEqual([]);
    for (const clutch of clutches) {
      const [x, y, z] = clutch.positionLdu;
      const allowance = part.collision.allowances.find(({ portId }) => portId === clutch.id);
      expect(allowance).toEqual({
        id: `tubeSeat:${clutch.id.split(":").at(-1)}`,
        portId: clutch.id,
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [x, y - 2, z],
        radiusLdu: 6,
        maxInsertionDepthLdu: 4,
        requiresValidatedConnection: true,
      });
    }
    expect(part.collision.allowances).toHaveLength(3);
  });

  it("draws one recessed underside stop above each authored LDCad clutch", () => {
    const part = getPartDefinition(PART_ID)!;
    if (part.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
      throw new Error("35787 is unexpectedly not a preloaded mesh");
    }
    const resolution = resolvePreloadedMeshAsset(part.geometry);
    if (!resolution.ok) throw new Error(`35787 mesh resolution failed: ${resolution.message}`);

    expect(
      meshClutchUndersides({
        positionsLdu: resolution.asset.positionsLdu,
        indices: resolution.asset.indices,
        groups: resolution.asset.groups,
        bodyBoundsLdu: part.bodyBoundsLdu,
        clutchSeatsLdu: part.connectors
          .filter(({ kind }) => kind === "undersideClutch")
          .map(({ positionLdu }) => positionLdu),
      }),
    ).toEqual(["recessed", "recessed", "recessed"]);
  });

  it("binds the 128-triangle mesh and keeps collision inside exact visual bounds", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:35787.dat"]!;
    if (asset.indices === undefined) throw new Error("35787 mesh is unexpectedly unindexed");

    expect(asset.groups).toEqual([{ role: "body", triangleStart: 0, triangleCount: 128 }]);
    expect(asset.indices.length / 3).toBe(128);
    expect(asset.positionsLdu.length / 3).toBe(161);
    for (const primitive of part.collision.primitives) {
      if (primitive.kind !== "box") throw new Error("35787 collision unexpectedly has a cylinder");
      expect(primitive.minLdu.every((value, axis) => value >= part.boundsLdu.min[axis]!)).toBe(
        true,
      );
      expect(primitive.maxLdu.every((value, axis) => value <= part.boundsLdu.max[axis]!)).toBe(
        true,
      );
    }
  });

  it("keeps every /15 part payload byte unchanged after restoring its historical truth labels", () => {
    const priorParts = PART_DEFINITIONS.slice(0, 87);
    const priorDefinitionBytes = JSON.stringify(priorParts)
      .replaceAll("builtin.basic-parts/26", "builtin.basic-parts/15")
      .replaceAll("rectilinear-stud-clearance/3", "rectilinear-stud-clearance/2");
    const rows = priorParts.map(({ id, connectors, collision }) => ({ id, connectors, collision }));
    const collisionRows = priorParts.map(({ id, collision }) => ({ id, collision }));

    expect(priorParts).toHaveLength(87);
    expect({
      definitionBytes: priorDefinitionBytes.length,
      definitionHash: createHash("sha256").update(priorDefinitionBytes).digest("hex"),
      connectorCollisionHash: createHash("sha256")
        .update(
          JSON.stringify(rows).replaceAll(
            "rectilinear-stud-clearance/3",
            "rectilinear-stud-clearance/2",
          ),
        )
        .digest("hex"),
      collisionHash: createHash("sha256")
        .update(
          JSON.stringify(collisionRows).replaceAll(
            "rectilinear-stud-clearance/3",
            "rectilinear-stud-clearance/2",
          ),
        )
        .digest("hex"),
    }).toEqual({
      definitionBytes: 1_482_732,
      definitionHash: "5b69d9e01889d473e1dd3260624f64ff7d27ebae049eb00ee53e9fef59d23d15",
      connectorCollisionHash: "0ea67bcd18a6e44d1be623b182fb3037c61981f21622d315c9e9f62d50639615",
      collisionHash: "fa926e20179af939ae93c846a62b6c2d68bca6d9c21515a8d6ffafc35e3e146c",
    });
  });
});
